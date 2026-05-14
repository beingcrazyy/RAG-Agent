"""Add LLM provider columns to enterprise

Revision ID: 002_add_llm_provider
Revises:
Create Date: 2026-05-13

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '002_add_llm_provider'
down_revision = '001_enterprise'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('enterprise', sa.Column('llm_provider', sa.String(), nullable=True, server_default='azure_openai'))
    op.add_column('enterprise', sa.Column('llm_api_key', sa.Text(), nullable=True))
    op.add_column('enterprise', sa.Column('llm_endpoint', sa.Text(), nullable=True))
    op.add_column('enterprise', sa.Column('llm_deployment', sa.String(), nullable=True))
    op.add_column('enterprise', sa.Column('llm_api_version', sa.String(), nullable=True))


def downgrade():
    op.drop_column('enterprise', 'llm_api_version')
    op.drop_column('enterprise', 'llm_deployment')
    op.drop_column('enterprise', 'llm_endpoint')
    op.drop_column('enterprise', 'llm_api_key')
    op.drop_column('enterprise', 'llm_provider')