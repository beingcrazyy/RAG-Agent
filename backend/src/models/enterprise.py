import datetime
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.db.base import Base


class Enterprise(Base):
    __tablename__ = "enterprise"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)
    invite_code = Column(String, unique=True, nullable=False, index=True)
    allowed_email_domains = Column(JSON, default=list)   # e.g. ["acme.com"]
    logo_url = Column(String, nullable=True)
    theme_json = Column(JSON, nullable=True)             # {"primary_color": "#e00", ...}
    system_prompt = Column(Text, nullable=True)          # org-level agent persona
    llm_model = Column(String, default="gpt-4.1-mini")  # preset model choice (for backward compat)

    # Multi-provider LLM configuration
    llm_provider = Column(String, default="azure_openai")  # azure_openai, openai, anthropic, gemini
    llm_api_key = Column(Text, nullable=True)  # encrypted API key (optional - use workspace credentials if not set)
    llm_endpoint = Column(Text, nullable=True)  # for Azure: endpoint URL
    llm_deployment = Column(String, nullable=True)  # for Azure: deployment name
    llm_api_version = Column(String, nullable=True)  # for Azure: API version

    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspace.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    members = relationship("EnterpriseUser", back_populates="enterprise", cascade="all, delete-orphan")


class EnterpriseUser(Base):
    __tablename__ = "enterprise_user"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enterprise_id = Column(UUID(as_uuid=True), ForeignKey("enterprise.id"), nullable=False)
    user_id = Column(String, ForeignKey("user.id"), nullable=False)
    role = Column(String, default="member")    # "admin" | "member"
    status = Column(String, default="pending") # "pending" | "active" | "revoked"
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)

    enterprise = relationship("Enterprise", back_populates="members")
    user = relationship("User", back_populates="enterprise_memberships")


class TokenUsageLog(Base):
    __tablename__ = "token_usage_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enterprise_id = Column(UUID(as_uuid=True), ForeignKey("enterprise.id"), nullable=False)
    user_id = Column(String, ForeignKey("user.id"), nullable=False)
    tokens_in = Column(Integer, default=0)
    tokens_out = Column(Integer, default=0)
    model = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class QueryLog(Base):
    __tablename__ = "query_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enterprise_id = Column(UUID(as_uuid=True), ForeignKey("enterprise.id"), nullable=False)
    user_id = Column(String, ForeignKey("user.id"), nullable=False)
    query_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
