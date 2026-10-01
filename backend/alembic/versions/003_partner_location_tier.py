"""Partner location and tier for the call list

Revision ID: 003_partner_geo
Revises: 002_crm
Create Date: 2026-09-18
"""
from alembic import op
import sqlalchemy as sa

revision = "003_partner_geo"
down_revision = "002_crm"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    return name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table: str, col: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if table not in insp.get_table_names():
        return False
    return col in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    op.execute("ALTER TYPE \"PartnerType\" ADD VALUE IF NOT EXISTS 'INFLUENCER'")
    if not _has_table("Partner"):
        return
    if not _has_column("Partner", "location"):
        op.add_column("Partner", sa.Column("location", sa.String(), nullable=True))
    if not _has_column("Partner", "tier"):
        op.add_column("Partner", sa.Column("tier", sa.String(), nullable=True))
    if not _has_column("Partner", "instagram"):
        op.add_column("Partner", sa.Column("instagram", sa.String(), nullable=True))


def downgrade() -> None:
    if not _has_table("Partner"):
        return
    if _has_column("Partner", "tier"):
        op.drop_column("Partner", "tier")
    if _has_column("Partner", "location"):
        op.drop_column("Partner", "location")
