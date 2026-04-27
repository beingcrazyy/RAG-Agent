import os
import tempfile
import logging
from sqlalchemy.orm import Session
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
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
        _embedding_model = OpenAIEmbeddings(model="text-embedding-3-small")
    return _embedding_model

def process_document(db: Session, document_id: str):
    # Fetch DB record
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        logger.error(f"Document {document_id} not found in DB.")
        return
    
    doc.status = "PROCESSING"
    db.commit()

    try:
        # 1. Copy from persistent uploads volume to a temp path for processing
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{doc.name}") as tmp:
            logger.info(f"Loading file from uploads volume for document {doc.id}")
            download_file_to_temp(str(doc.workspace_id), str(doc.id), doc.name, tmp.name)
            local_path = tmp.name

        # 2. Extract Text
        logger.info("Extracting document features..")
        loader = PyPDFLoader(local_path)
        raw_docs = loader.load()

        # 3. Agentic Chunking Routing — GPT-4o-mini classifies doc type
        logger.info("Agentically assessing document structure...")
        combined_preview = " ".join([d.page_content for d in raw_docs])[:2000]
        
        try:
            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
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

        # 4. Embeddings & Persistence
        logger.info("Generating embeddings and writing vectors..")
        embed_model = get_embedding_model()

        db_chunks = []
        for i, chunk in enumerate(chunks):
            vector = embed_model.embed_query(chunk.page_content)
            # OpenAI text-embedding-3-small produces exactly 1536 dims natively

            # Extract native page bounds from PyPDF loader standard mapping
            page_no = chunk.metadata.get('page', 0)
            enhanced_metadata = {
                "source": doc.name,
                "page": page_no,
                "agentic_type": doc_type
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
        
        doc.status = "READY"
        db.commit()
        logger.info(f"Successfully processed Document {doc.id}")

    except Exception as e:
        logger.error(f"Failed processing document {document_id}: {e}")
        db.rollback()
        doc.status = "FAILED"
        db.commit()
    finally:
        if 'local_path' in locals() and os.path.exists(local_path):
            os.remove(local_path)
