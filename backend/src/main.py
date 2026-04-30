from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from .core.config import settings
from src.api import documents, chat, auth

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(documents.router, prefix=f"{settings.API_V1_STR}/documents", tags=["documents"])
app.include_router(chat.router, prefix=f"{settings.API_V1_STR}/chat", tags=["chat"])


@app.on_event("startup")
def create_hnsw_index():
    """
    Create HNSW approximate-nearest-neighbour index on document_chunk.embedding.
    Without this every vector search is a full sequential scan — O(N) per query.
    HNSW reduces it to O(log N), cutting retrieval from ~3s to ~30ms.
    m=16, ef_construction=64 are safe defaults for accuracy vs speed balance.
    CREATE INDEX IF NOT EXISTS is idempotent — safe to run on every restart.
    """
    from src.db.session import engine
    try:
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_chunk_embedding_hnsw
                ON document_chunk
                USING hnsw (embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64)
            """))
        print("HNSW index ready on document_chunk.embedding")
    except Exception as e:
        print(f"HNSW index creation skipped: {e}")


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Loomind API is running"}
