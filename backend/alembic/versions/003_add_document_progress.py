"""Add progress column to document

Revision ID: 003_add_document_progress
Revises: 002_add_llm_provider
Create Date: 2026-05-13

"""
from alembic import op

revision = '003_add_document_progress'
down_revision = '002_add_llm_provider'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE document ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0")


def downgrade():
    op.execute("ALTER TABLE document DROP COLUMN IF EXISTS progress")
