"""One resort profile row for Settings > Resort Info.

Revision ID: 006_resort_profile
Revises: 005_enquiries
Create Date: 2026-10-30

Additive. Downgrade drops only ResortProfile.
"""
from alembic import op
import sqlalchemy as sa

revision = "006_resort_profile"
down_revision = "005_enquiries"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    return name in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    if _has_table("ResortProfile"):
        return
    op.create_table(
        "ResortProfile",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("gstin", sa.String(), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    if _has_table("ResortProfile"):
        op.drop_table("ResortProfile")
