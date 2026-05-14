"""Add file_size column to document

Revision ID: 004_add_file_size
Revises: 003_add_document_progress
Create Date: 2026-05-14

"""
from alembic import op

revision = '004_add_file_size'
down_revision = '003_add_document_progress'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE document ADD COLUMN IF NOT EXISTS file_size VARCHAR")


def downgrade():
    op.execute("ALTER TABLE document DROP COLUMN IF EXISTS file_size")
