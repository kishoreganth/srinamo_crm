"""Staff enquiry call log and private call recordings.

Revision ID: 005_enquiries
Revises: 004_billing_crm
Create Date: 2026-10-29

Additive. Existing lead and booking tables are not changed.
Downgrade drops only EnquiryRecording and Enquiry.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

revision = "005_enquiries"
down_revision = "004_billing_crm"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    return name in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    enquiry_type = sa.Enum(
        "ROOM_STAY", "DAY_OUTING", "EVENT", "RESTAURANT", "ACTIVITY", "OTHER",
        name="EnquiryType",
    )
    enquiry_source = sa.Enum(
        "PHONE", "WHATSAPP", "WALK_IN", "INSTAGRAM", "REFERRAL", "OTHER",
        name="EnquirySource",
    )
    enquiry_status = sa.Enum(
        "NEW", "FOLLOW_UP", "QUOTED", "CONVERTED", "LOST",
        name="EnquiryStatus",
    )
    call_direction = sa.Enum("INCOMING", "OUTGOING", name="CallDirection")
    bind = op.get_bind()
    enquiry_type.create(bind, checkfirst=True)
    enquiry_source.create(bind, checkfirst=True)
    enquiry_status.create(bind, checkfirst=True)
    call_direction.create(bind, checkfirst=True)
    enquiry_type = ENUM(name="EnquiryType", create_type=False)
    enquiry_source = ENUM(name="EnquirySource", create_type=False)
    enquiry_status = ENUM(name="EnquiryStatus", create_type=False)
    call_direction = ENUM(name="CallDirection", create_type=False)

    if not _has_table("Enquiry"):
        op.create_table(
            "Enquiry",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("callerName", sa.String(), nullable=False),
            sa.Column("phone", sa.String(), nullable=False),
            sa.Column("alternatePhone", sa.String(), nullable=True),
            sa.Column("email", sa.String(), nullable=True),
            sa.Column("enquiryType", enquiry_type, nullable=False),
            sa.Column("source", enquiry_source, nullable=False),
            sa.Column("preferredCheckIn", sa.DateTime(timezone=True), nullable=True),
            sa.Column("preferredCheckOut", sa.DateTime(timezone=True), nullable=True),
            sa.Column("adults", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("children", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("interest", sa.Text(), nullable=True),
            sa.Column("budget", sa.Numeric(12, 2), nullable=True),
            sa.Column("heardAbout", sa.String(), nullable=True),
            sa.Column("callDirection", call_direction, nullable=False),
            sa.Column("callAt", sa.DateTime(timezone=True), nullable=True),
            sa.Column("durationSeconds", sa.Integer(), nullable=True),
            sa.Column("takenByUserId", sa.String(), sa.ForeignKey("User.id"), nullable=True),
            sa.Column("status", enquiry_status, nullable=False),
            sa.Column("nextFollowUpAt", sa.DateTime(timezone=True), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("guestId", sa.String(), sa.ForeignKey("Guest.id"), nullable=True),
            sa.Column("bookingId", sa.String(), sa.ForeignKey("Booking.id"), nullable=True),
            sa.Column("createdAt", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("Enquiry_phone_idx", "Enquiry", ["phone"])
        op.create_index("Enquiry_status_idx", "Enquiry", ["status"])
        op.create_index("Enquiry_source_idx", "Enquiry", ["source"])
        op.create_index("Enquiry_nextFollowUpAt_idx", "Enquiry", ["nextFollowUpAt"])
        op.create_index("Enquiry_takenByUserId_idx", "Enquiry", ["takenByUserId"])
        op.create_index("Enquiry_callAt_idx", "Enquiry", ["callAt"])

    if not _has_table("EnquiryRecording"):
        op.create_table(
            "EnquiryRecording",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("enquiryId", sa.String(), sa.ForeignKey("Enquiry.id"), nullable=False),
            sa.Column("filename", sa.String(), nullable=False),
            sa.Column("originalName", sa.String(), nullable=False),
            sa.Column("sizeBytes", sa.Integer(), nullable=False),
            sa.Column("mime", sa.String(), nullable=False),
            sa.Column("uploadedByUserId", sa.String(), sa.ForeignKey("User.id"), nullable=True),
            sa.Column("createdAt", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("EnquiryRecording_enquiryId_idx", "EnquiryRecording", ["enquiryId"])


def downgrade() -> None:
    if _has_table("EnquiryRecording"):
        op.drop_index("EnquiryRecording_enquiryId_idx", table_name="EnquiryRecording")
        op.drop_table("EnquiryRecording")
    if _has_table("Enquiry"):
        op.drop_index("Enquiry_callAt_idx", table_name="Enquiry")
        op.drop_index("Enquiry_takenByUserId_idx", table_name="Enquiry")
        op.drop_index("Enquiry_nextFollowUpAt_idx", table_name="Enquiry")
        op.drop_index("Enquiry_source_idx", table_name="Enquiry")
        op.drop_index("Enquiry_status_idx", table_name="Enquiry")
        op.drop_index("Enquiry_phone_idx", table_name="Enquiry")
        op.drop_table("Enquiry")
    bind = op.get_bind()
    for name in ("CallDirection", "EnquiryStatus", "EnquirySource", "EnquiryType"):
        sa.Enum(name=name).drop(bind, checkfirst=True)
