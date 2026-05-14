"""Add missing document columns (progress, file_size)

Revision ID: 005_add_missing_cols
Revises: 004_add_file_size
Create Date: 2026-05-14

"""
from alembic import op

revision = '005_add_missing_cols'
down_revision = '004_add_file_size'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE document ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0")
    op.execute("ALTER TABLE document ADD COLUMN IF NOT EXISTS file_size VARCHAR")


def downgrade():
    op.execute("ALTER TABLE document DROP COLUMN IF EXISTS file_size")
    op.execute("ALTER TABLE document DROP COLUMN IF EXISTS progress")
