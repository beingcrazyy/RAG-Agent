import os
import tempfile
import logging
from sqlalchemy.orm import Session
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import AzureOpenAIEmbeddings, AzureChatOpenAI
from src.core.config import settings as _az_settings
from langchain_core.messages import HumanMessage

from src.models.document import Document, DocumentChunk
from src.services.storage import download_file_to_temp

logger = logging.getLogger(__name__)

# Cache embedding model in memory
_embedding_model = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        # OpenAI text-embedding-3-small natively produces 1536-dim vectors
        # No padding hack needed anymore!
        _embedding_model = AzureOpenAIEmbeddings(
            azure_deployment=_az_settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
            azure_endpoint=_az_settings.AZURE_OPENAI_ENDPOINT,
            api_key=_az_settings.AZURE_OPENAI_API_KEY,
            api_version=_az_settings.AZURE_OPENAI_API_VERSION,
        )
    return _embedding_model

def process_document(db: Session, document_id: str):
    # Fetch DB record
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        logger.error(f"Document {document_id} not found in DB.")
        return
    
    doc.status = "PROCESSING"
    doc.progress = 0
    db.commit()

    try:
        # 1. Copy from persistent uploads volume to a temp path for processing
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{doc.name}") as tmp:
            logger.info(f"Loading file from uploads volume for document {doc.id}")
            download_file_to_temp(str(doc.workspace_id), str(doc.id), doc.name, tmp.name)
            local_path = tmp.name

        # 2. Extract Text
        # pymupdf4llm preserves table structure as Markdown (headers stay with rows).
        # Falls back to PyPDFLoader for non-PDF or if pymupdf4llm fails.
        logger.info("Extracting document features..")
        try:
            import pymupdf4llm
            from langchain_core.documents import Document as LCDocument
            md_text = pymupdf4llm.to_markdown(local_path)
            raw_docs = [LCDocument(page_content=md_text, metadata={"source": doc.name, "page": 0})]
            logger.info("Parsed with pymupdf4llm (Markdown, table-aware)")
        except Exception as parse_err:
            logger.warning(f"pymupdf4llm failed ({parse_err}), falling back to PyPDFLoader")
            loader = PyPDFLoader(local_path)
            raw_docs = loader.load()

        doc.progress = 20
        db.commit()

        # 3. Agentic Chunking Routing — GPT-4o-mini classifies doc type
        logger.info("Agentically assessing document structure...")
        combined_preview = " ".join([d.page_content for d in raw_docs])[:2000]
        
        try:
            llm = AzureChatOpenAI(
                azure_deployment=_az_settings.AZURE_OPENAI_DEPLOYMENT,
                azure_endpoint=_az_settings.AZURE_OPENAI_ENDPOINT,
                api_key=_az_settings.AZURE_OPENAI_API_KEY,
                api_version=_az_settings.AZURE_OPENAI_API_VERSION,
                temperature=0,
            )
            routing_prompt = (
                f"Analyze this text snippet and classify its PRIMARY structure into exactly one token: "
                f"NARRATIVE, CODE, FINANCIAL_TABULAR, SHORT_FORM. "
                f"Choose FINANCIAL_TABULAR only if the document is predominantly tables/numbers (e.g. balance sheets, financial statements). "
                f"Choose NARRATIVE for annual reports, 10-K/10-Q filings that mix prose and tables. "
                f"Text: {combined_preview}"
            )
            doc_type = llm.invoke([HumanMessage(content=routing_prompt)]).content.strip().upper()
        except Exception as e:
            logger.warning(f"Doc type classification failed: {e}. Defaulting to NARRATIVE.")
            doc_type = "NARRATIVE"

        logger.info(f"Document classified natively as: {doc_type}")
        
        # Branch Splitter Logic
        # For financial/tabular docs we use TWO chunk sizes:
        #   - Large (1500) to keep table rows + surrounding context intact
        #   - With generous overlap (400) so a number is never stranded at a boundary
        # Narrative stays at 1000/200 for semantic coherence.
        if "CODE" in doc_type:
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=300)
        elif "FINANCIAL" in doc_type or "TABULAR" in doc_type:
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1500,
                chunk_overlap=400,
                separators=["\n\n", "\n", " ", ""]
            )
        elif "SHORT_FORM" in doc_type:
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=50)
        else:
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

        chunks = text_splitter.split_documents(raw_docs)

        doc.progress = 40
        db.commit()

        # 4. Embeddings & Persistence
        logger.info("Generating embeddings and writing vectors..")
        embed_model = get_embedding_model()

        db_chunks = []
        for i, chunk in enumerate(chunks):
            vector = embed_model.embed_query(chunk.page_content)
            # OpenAI text-embedding-3-small produces exactly 1536 dims natively

            # Extract native page bounds from PyPDF loader standard mapping
            page_no = chunk.metadata.get('page', 0)
            # Detect company name from filename for metadata filtering
            fname_lower = doc.name.lower()
            if "google" in fname_lower or "alphabet" in fname_lower:
                company = "Google"
            elif "microsoft" in fname_lower:
                company = "Microsoft"
            elif "rich-dad" in fname_lower or "richdad" in fname_lower:
                company = "Rich Dad"
            elif "adbe" in fname_lower or "adobe" in fname_lower:
                company = "Adobe"
            elif "10-k" in fname_lower or "10-q" in fname_lower:
                company = "Apple"
            else:
                company = "Unknown"

            enhanced_metadata = {
                "source": doc.name,
                "page": page_no,
                "agentic_type": doc_type,
                "company": company
            }

            db_chunk = DocumentChunk(
                document_id=doc.id,
                partition_id=i,
                text=chunk.page_content.replace('\x00', ''),
                metadata_=enhanced_metadata,
                embedding=vector
            )
            db_chunks.append(db_chunk)

        db.add_all(db_chunks)

        doc.progress = 70
        db.commit()

        # ── Generate document summary + suggested questions (one LLM call) ────
        try:
            summary_llm = AzureChatOpenAI(
                azure_deployment=_az_settings.AZURE_OPENAI_DEPLOYMENT,
                azure_endpoint=_az_settings.AZURE_OPENAI_ENDPOINT,
                api_key=_az_settings.AZURE_OPENAI_API_KEY,
                api_version=_az_settings.AZURE_OPENAI_API_VERSION,
                temperature=0.2,
                max_tokens=400,
            )
            preview_text = " ".join([c.page_content for c in chunks[:8]])[:6000]
            sq_prompt = (
                "You are analyzing a document that will be added to a company knowledge base.\n"
                "Return STRICT JSON with two fields:\n"
                "  \"summary\": 1-2 sentence plain-English description of what this document is about.\n"
                "  \"questions\": list of 4 short example questions a user might ask about it (max 9 words each).\n"
                "No markdown, no code fences. Just JSON.\n\n"
                f"Document name: {doc.name}\n"
                f"Content preview:\n{preview_text}"
            )
            raw = summary_llm.invoke([HumanMessage(content=sq_prompt)]).content.strip()
            # strip code fences if present
            if raw.startswith("```"):
                raw = raw.strip("`").lstrip("json").strip()
            import json as _json
            parsed = _json.loads(raw)
            doc.summary = parsed.get("summary", "")[:600]
            qs = parsed.get("questions", [])
            if isinstance(qs, list):
                doc.suggested_questions = [str(q)[:120] for q in qs[:6]]
        except Exception as e:
            logger.warning(f"Summary generation failed: {e}")

        doc.progress = 90
        db.commit()

        doc.status = "READY"
        doc.progress = 100
        db.commit()
        logger.info(f"Successfully processed Document {doc.id}")

    except Exception as e:
        logger.error(f"Failed processing document {document_id}: {e}")
        db.rollback()
        doc.status = "FAILED"
        doc.progress = 100
        db.commit()
    finally:
        if 'local_path' in locals() and os.path.exists(local_path):
            os.remove(local_path)
