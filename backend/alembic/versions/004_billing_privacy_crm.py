"""Folio unit prices, guest tags, feedback, and audit events.

Revision ID: 004_billing_crm
Revises: 003_partner_geo
Create Date: 2026-10-26

Existing PACKAGE and AMENITY rows stored the extended total in amount and a
quantity greater than 1. Totals now use amount * quantity, so those rows are
divided once. Rows already stored as a unit price (quantity 1) are unchanged.
"""
from alembic import op
import sqlalchemy as sa

revision = "004_billing_crm"
down_revision = "003_partner_geo"
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


def _has_index(table: str, index: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if table not in insp.get_table_names():
        return False
    return index in {i["name"] for i in insp.get_indexes(table)}


def upgrade() -> None:
    if _has_table("FolioItem"):
        op.execute(
            """
            UPDATE "FolioItem"
            SET amount = ROUND(amount / quantity, 2)
            WHERE quantity > 1 AND category IN ('PACKAGE', 'AMENITY')
            """
        )
    if _has_table("Guest") and not _has_column("Guest", "tags"):
        op.add_column("Guest", sa.Column("tags", sa.Text(), nullable=True))
    if not _has_table("Feedback"):
        op.create_table(
            "Feedback",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("bookingId", sa.String(), sa.ForeignKey("Booking.id"), nullable=False),
            sa.Column("token", sa.String(), nullable=False),
            sa.Column("score", sa.Integer(), nullable=True),
            sa.Column("comment", sa.Text(), nullable=True),
            sa.Column("nps", sa.Integer(), nullable=True),
            sa.Column("createdAt", sa.DateTime(timezone=True), nullable=True),
            sa.UniqueConstraint("token", name="Feedback_token_key"),
        )
        op.create_index("Feedback_bookingId_idx", "Feedback", ["bookingId"])
        op.create_index("Feedback_score_idx", "Feedback", ["score"])
    if not _has_table("AuditEvent"):
        op.create_table(
            "AuditEvent",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("userId", sa.String(), sa.ForeignKey("User.id"), nullable=True),
            sa.Column("action", sa.String(), nullable=False),
            sa.Column("entity", sa.String(), nullable=False),
            sa.Column("entityId", sa.String(), nullable=True),
            sa.Column("detail", sa.Text(), nullable=True),
            sa.Column("createdAt", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("AuditEvent_entity_idx", "AuditEvent", ["entity", "entityId"])
        op.create_index("AuditEvent_createdAt_idx", "AuditEvent", ["createdAt"])
    if _has_table("Invoice") and not _has_index("Invoice", "Invoice_invoiceNumber_uidx"):
        op.execute(
            'CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_uidx" ON "Invoice" ("invoiceNumber")'
        )


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS "Invoice_invoiceNumber_uidx"')
    if _has_table("AuditEvent"):
        op.drop_index("AuditEvent_createdAt_idx", table_name="AuditEvent")
        op.drop_index("AuditEvent_entity_idx", table_name="AuditEvent")
        op.drop_table("AuditEvent")
    if _has_table("Feedback"):
        op.drop_index("Feedback_score_idx", table_name="Feedback")
        op.drop_index("Feedback_bookingId_idx", table_name="Feedback")
        op.drop_table("Feedback")
    if _has_column("Guest", "tags"):
        op.drop_column("Guest", "tags")
    if _has_table("FolioItem"):
        op.execute(
            """
            UPDATE "FolioItem"
            SET amount = ROUND(amount * quantity, 2)
            WHERE quantity > 1 AND category IN ('PACKAGE', 'AMENITY')
            """
        )
