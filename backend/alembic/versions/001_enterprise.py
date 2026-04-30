"""enterprise multitenant

Revision ID: 001_enterprise
Revises:
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001_enterprise'
down_revision = '053d183cb4f3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Add columns to existing user table ──────────────────────────────────
    op.execute("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS name VARCHAR")
    op.execute("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS hashed_password VARCHAR")

    # ── enterprise ───────────────────────────────────────────────────────────
    op.create_table(
        'enterprise',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), unique=True, nullable=False),
        sa.Column('invite_code', sa.String(), unique=True, nullable=False),
        sa.Column('allowed_email_domains', sa.JSON(), nullable=True),
        sa.Column('logo_url', sa.String(), nullable=True),
        sa.Column('theme_json', sa.JSON(), nullable=True),
        sa.Column('system_prompt', sa.Text(), nullable=True),
        sa.Column('llm_model', sa.String(), nullable=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspace.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_enterprise_slug', 'enterprise', ['slug'])
    op.create_index('ix_enterprise_invite_code', 'enterprise', ['invite_code'])

    # ── enterprise_user ───────────────────────────────────────────────────────
    op.create_table(
        'enterprise_user',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('enterprise_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('enterprise.id'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('role', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('joined_at', sa.DateTime(), nullable=True),
    )

    # ── token_usage_log ───────────────────────────────────────────────────────
    op.create_table(
        'token_usage_log',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('enterprise_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('enterprise.id'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('tokens_in', sa.Integer(), nullable=True),
        sa.Column('tokens_out', sa.Integer(), nullable=True),
        sa.Column('model', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    # ── query_log ─────────────────────────────────────────────────────────────
    op.create_table(
        'query_log',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('enterprise_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('enterprise.id'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('query_text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('query_log')
    op.drop_table('token_usage_log')
    op.drop_table('enterprise_user')
    op.drop_table('enterprise')
    op.execute("ALTER TABLE \"user\" DROP COLUMN IF EXISTS name")
    op.execute("ALTER TABLE \"user\" DROP COLUMN IF EXISTS hashed_password")
