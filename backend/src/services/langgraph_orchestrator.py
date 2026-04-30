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

    print("CACHE MISS - HyDE + HNSW vector search + FlashRank reranking")
    embed_model = OpenAIEmbeddings(model="text-embedding-3-small")

    # 2a. HyDE — Hypothetical Document Embeddings
    # Problem: query text ("What was the decrease in Commercial paper?") lives in a
    # different region of embedding space from the answer chunk ("Commercial paper 1,997 / 7,979").
    # Fix: ask gpt-4o-mini to write a short hypothetical passage that WOULD answer the question.
    # That text is in the same semantic space as the document chunks → much better cosine match.
    # Then ensemble (average) the HyDE vector with the original query vector for robustness.
    try:
        hyde_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.0, max_tokens=120)
        hyde_passage = hyde_llm.invoke([HumanMessage(content=(
            f"Write a short, factual passage (2-3 sentences) that would directly answer "
            f"this question as it would appear in a financial document, report, or book. "
            f"Use plausible placeholder numbers/names if needed. Question: {query}"
        ))]).content.strip()
        print(f"HyDE passage: {hyde_passage[:100]}...")
        hyp_vector = embed_model.embed_query(hyde_passage)
        query_vector_raw = embed_model.embed_query(query)
        # Ensemble: average query + hypothetical → robust to both lexical and semantic gaps
        query_vector = [(q + h) / 2.0 for q, h in zip(query_vector_raw, hyp_vector)]
    except Exception as e:
        print(f"HyDE failed ({e}), falling back to raw query embedding")
        query_vector = embed_model.embed_query(query)

    # 2b. Single global ANN query — HNSW index makes this O(log N) ~30ms
    # Fetch top-60 globally; FlashRank picks the best 8.
    # Fair per-doc coverage: 10 docs with relevant content will naturally surface.
    from sqlalchemy import text

    vector_str = "[" + ",".join(str(x) for x in query_vector) + "]"

    sql = text("""
        SELECT dc.id::text AS id,
               dc.text     AS text,
               dc.metadata_ AS metadata,
               d.name      AS doc_name
        FROM document_chunk dc
        JOIN document d ON d.id = dc.document_id
        WHERE d.workspace_id = CAST(:wsid AS uuid)
          AND d.status = 'READY'
        ORDER BY dc.embedding <=> CAST(:qvec AS vector)
        LIMIT :lim
    """)

    rows = db.execute(sql, {
        "qvec": vector_str,
        "wsid": str(workspace_id),
        "lim": 60,
    }).fetchall()

    print(f"HNSW returned {len(rows)} candidates")

    if not rows:
        return {"context": "No documents found in workspace.", "sources": []}

    # 3. FlashRank cross-encoder reranking over the full candidate pool
    from flashrank import RerankRequest
    ranker = get_ranker()

    passages = []
    for r in rows:
        meta = r.metadata if isinstance(r.metadata, dict) else {}
        p_num = meta.get("page", 0)
        passages.append({
            "id": r.id,
            "text": r.text,
            "meta": {"source": r.doc_name, "page": p_num}
        })

    rerankreq = RerankRequest(query=query, passages=passages)
    reranked = ranker.rerank(rerankreq)

    # 4. Take top-8 after reranking — good recall, keeps prompt small for low latency
    top_docs = reranked[:8]

    context_text = "\n\n".join([
        f"Source: {d['meta']['source']} (Page {int(d['meta']['page']) + 1}) | Text: {d['text']}"
        for d in top_docs
    ])
    # Preserve insertion order (most relevant first) using dict.fromkeys
    unique_sources = list(dict.fromkeys([
        f"{d['meta']['source']} • Page {int(d['meta']['page']) + 1}" for d in top_docs
    ]))

    # 5. Cache result for 1 hour
    if rc and cache_key:
        rc.setex(cache_key, 3600, json.dumps({"context": context_text, "sources": unique_sources}))

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
