from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from .core.config import settings
from src.api import documents, chat, auth, enterprise

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
app.include_router(enterprise.router, prefix=f"{settings.API_V1_STR}/enterprise", tags=["enterprise"])

# Serve enterprise logo uploads as static files
import os
os.makedirs("/app/uploads/logos", exist_ok=True)
app.mount("/logos", StaticFiles(directory="/app/uploads/logos"), name="logos")


@app.on_event("startup")
def create_tables_and_hnsw_index():
    """Create any missing tables (new enterprise tables) and HNSW index."""
    from src.db.session import engine
    from src.db.base import Base
    # Import all models so their metadata is registered
    import src.models.workspace  # noqa
    import src.models.document   # noqa
    import src.models.chat       # noqa
    import src.models.enterprise # noqa
    try:
        Base.metadata.create_all(bind=engine)
        print("DB tables ensured")
    except Exception as e:
        print(f"create_all warning: {e}")
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
