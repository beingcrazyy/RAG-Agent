import os
from typing import TypedDict, Sequence, Annotated
import operator
from sqlalchemy.orm import Session
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langgraph.graph import StateGraph, END
from src.models.document import DocumentChunk

import redis
import json
import hashlib

_ranker = None
def get_ranker():
    global _ranker
    if not _ranker:
        from flashrank import Ranker
        _ranker = Ranker(model_name="ms-marco-TinyBERT-L-2-v2", cache_dir="/tmp")
    return _ranker

_redis_client = None
def get_redis_client():
    global _redis_client
    if _redis_client is None:
        try:
            redis_url = os.environ.get("REDIS_URL", "redis://redis:6379/0")
            _redis_client = redis.Redis.from_url(redis_url, decode_responses=True)
            _redis_client.ping()
        except:
            _redis_client = None
            print("Redis warning: Could not connect to container.")
    return _redis_client

class AgentState(TypedDict):
    workspace_id: str
    messages: Annotated[Sequence[BaseMessage], operator.add]
    context: str
    db: Session

def retrieve_context(state: AgentState) -> dict:
    """
    Per-document fair sampling retrieval:
    Fetches top-K chunks from EACH document individually, then merges and reranks.
    This prevents large docs (500+ chunks) from dominating small docs (20 chunks).
    """
    db = state["db"]
    workspace_id = state["workspace_id"]
    query = state["messages"][-1].content

    # 1. Redis cache check
    rc = get_redis_client()
    cache_key = None
    if rc:
        query_hash = hashlib.md5(query.encode("utf-8")).hexdigest()
        cache_key = f"rag_cache:{workspace_id}:{query_hash}"
        cached_result = rc.get(cache_key)
        if cached_result:
            print("CACHE HIT")
            data = json.loads(cached_result)
            return {"context": data["context"], "sources": data["sources"]}

    print("CACHE MISS - Per-doc sampling + FlashRank reranking")
    embed_model = OpenAIEmbeddings(model="text-embedding-3-small")
    query_vector = embed_model.embed_query(query)
    # OpenAI text-embedding-3-small natively produces 1536 dims — no padding needed

    # 2. Per-document fair sampling
    # Get top CHUNKS_PER_DOC best chunks from every document individually.
    # This gives a 5-page resume equal footing with a 300-page annual report.
    from src.models.document import Document
    CHUNKS_PER_DOC = 15

    docs_in_workspace = db.query(Document).filter(
        Document.workspace_id == workspace_id,
        Document.status == "READY"
    ).all()

    all_candidates = []
    for doc in docs_in_workspace:
        doc_chunks = (
            db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == doc.id)
            .order_by(DocumentChunk.embedding.cosine_distance(query_vector))
            .limit(CHUNKS_PER_DOC)
            .all()
        )
        all_candidates.extend(doc_chunks)

    if not all_candidates:
        return {"context": "No documents found in workspace.", "sources": []}

    # 3. FlashRank cross-encoder reranking over the full candidate pool
    from flashrank import RerankRequest
    ranker = get_ranker()

    passages = []
    for r in all_candidates:
        p_num = r.metadata_.get("page", 0) if r.metadata_ else 0
        passages.append({
            "id": str(r.id),
            "text": r.text,
            "meta": {"source": r.document.name, "page": p_num}
        })

    rerankreq = RerankRequest(query=query, passages=passages)
    reranked = ranker.rerank(rerankreq)

    # 4. Take top-12 after reranking
    top_docs = reranked[:12]

    context_text = "\n\n".join([
        f"Source: {d['meta']['source']} (Page {int(d['meta']['page']) + 1}) | Text: {d['text']}"
        for d in top_docs
    ])
    # Preserve insertion order (most relevant first) using dict.fromkeys
    unique_sources = list(dict.fromkeys([
        f"{d['meta']['source']} • Page {int(d['meta']['page']) + 1}" for d in top_docs
    ]))

    # 5. Cache result for 15 minutes
    if rc and cache_key:
        rc.setex(cache_key, 900, json.dumps({"context": context_text, "sources": unique_sources}))

    return {"context": context_text, "sources": unique_sources}


def generate_response(state: AgentState) -> dict:
    """Generates the LLM response relying strictly on the retrieved context"""
    context = state.get("context", "")
    query = state["messages"][-1].content

    prompt = PromptTemplate.from_template(
        "You are an intelligent document assistant. Answer the question using ONLY the retrieved context below.\n"
        "If the context does not contain information to answer the question, say so clearly.\n\n"
        "Context:\n{context}\n\nQuestion: {question}\n\nAnswer:"
    )

    formatted_prompt = prompt.format(context=context, question=query)
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.1)

    response = llm.invoke([HumanMessage(content=formatted_prompt)])
    return {"messages": [AIMessage(content=response.content)]}


# LangGraph workflow (retained for compatibility)
workflow = StateGraph(AgentState)
workflow.add_node("retrieve", retrieve_context)
workflow.add_node("generate", generate_response)
workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)
rag_chain = workflow.compile()
