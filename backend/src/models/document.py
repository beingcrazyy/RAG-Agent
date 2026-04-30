import datetime
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from src.db.base import Base

class Document(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspace.id"), nullable=False)
    name = Column(String, nullable=False)
    gcs_uri = Column(String, nullable=False)
    status = Column(String, default="PENDING") # PENDING, PROCESSING, READY, FAILED
    summary = Column(Text, nullable=True)
    suggested_questions = Column(JSON, nullable=True)  # list[str]
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    workspace = relationship("Workspace", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = "document_chunk"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("document.id"), nullable=False)
    partition_id = Column(Integer, nullable=False) # e.g. chunk number
    text = Column(String, nullable=False)
    metadata_ = Column(JSON, nullable=True) # Page numbers, etc.
    embedding = Column(Vector(1536)) # Dimension configured to 1536 (OpenAI spec)

    document = relationship("Document", back_populates="chunks")
