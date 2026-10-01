"""Add check-in enhancements: BookingGuest table, actualAdults/actualChildren, paymentType

Revision ID: 001_checkin
Revises:
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa

revision = "001_checkin"
down_revision = None
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
    if _has_table("Booking"):
        if not _has_column("Booking", "actualAdults"):
            op.add_column("Booking", sa.Column("actualAdults", sa.Integer(), nullable=True))
        if not _has_column("Booking", "actualChildren"):
            op.add_column("Booking", sa.Column("actualChildren", sa.Integer(), nullable=True))
    if _has_table("Payment") and not _has_column("Payment", "paymentType"):
        op.add_column("Payment", sa.Column("paymentType", sa.String(), nullable=True))

    if _has_table("BookingGuest"):
        return

    op.create_table(
        "BookingGuest",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("bookingId", sa.String(), sa.ForeignKey("Booking.id"), nullable=False),
        sa.Column("guestName", sa.String(), nullable=False),
        sa.Column("idType", sa.String(), nullable=True),
        sa.Column("idNumber", sa.String(), nullable=True),
        sa.Column("idDocumentUrl", sa.String(), nullable=True),
        sa.Column("createdAt", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("BookingGuest_bookingId_idx", "BookingGuest", ["bookingId"])


def downgrade() -> None:
    op.drop_index("BookingGuest_bookingId_idx", table_name="BookingGuest")
    op.drop_table("BookingGuest")
    op.drop_column("Payment", "paymentType")
    op.drop_column("Booking", "actualChildren")
    op.drop_column("Booking", "actualAdults")
