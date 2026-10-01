"""CRM, outbox, partners, events, inventory blocks

Revision ID: 002_crm
Revises: 001_checkin
Create Date: 2026-08-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "002_crm"
down_revision = "001_checkin"
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


def _has_index(table: str, name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if table not in insp.get_table_names():
        return False
    return name in {idx["name"] for idx in insp.get_indexes(table)}


def _add_overlap_constraint() -> None:
    """tstzrange() is STABLE; gist indexes require IMMUTABLE."""
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.execute(
        """
        CREATE OR REPLACE FUNCTION booking_tstzrange(start_ts timestamptz, end_ts timestamptz)
        RETURNS tstzrange
        LANGUAGE sql
        IMMUTABLE
        AS $$ SELECT tstzrange($1, $2, '[)'); $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
          ALTER TABLE "Booking" ADD CONSTRAINT booking_no_overlap
          EXCLUDE USING gist (
              "roomId" WITH =,
              booking_tstzrange("checkIn", "checkOut") WITH &&
          )
          WHERE (status IN ('CONFIRMED', 'CHECKED_IN') AND "deletedAt" IS NULL);
        EXCEPTION
          WHEN duplicate_object THEN NULL;
          WHEN undefined_object THEN NULL;
        END $$;
        """
    )


def upgrade() -> None:
    op.execute("ALTER TYPE \"BookingSource\" ADD VALUE IF NOT EXISTS 'WHATSAPP'")
    op.execute("ALTER TYPE \"BookingSource\" ADD VALUE IF NOT EXISTS 'REFERRAL'")
    op.execute("ALTER TYPE \"BookingSource\" ADD VALUE IF NOT EXISTS 'PARTNER'")
    op.execute("ALTER TYPE \"BookingSource\" ADD VALUE IF NOT EXISTS 'IMPORT'")

    guest_source = sa.Enum(
        "WALK_IN", "PHONE", "ONLINE", "OTA", "WHATSAPP", "REFERRAL", "PARTNER", "IMPORT",
        name="GuestSource",
    )
    lead_occasion = sa.Enum("STAY", "BIRTHDAY", "WEDDING", "CORPORATE", "OTHER", name="LeadOccasion")
    lead_stage = sa.Enum("NEW", "CONTACTED", "QUOTED", "HOLD", "WON", "LOST", name="LeadStage")
    partner_type = sa.Enum(
        "PLANNER", "PHOTOGRAPHER", "DECORATOR", "TRAVEL", "CORPORATE", "OTHER", name="PartnerType"
    )
    commission_status = sa.Enum("DUE", "PAID", name="CommissionStatus")
    event_venue = sa.Enum("LAWN", "ROOFTOP", "POOL", "OTHER", name="EventVenue")
    event_status = sa.Enum(
        "INQUIRY", "QUOTED", "CONFIRMED", "COMPLETED", "CANCELLED", name="EventDealStatus"
    )
    outbox_status = sa.Enum("PENDING", "SENT", "FAILED", "SKIPPED", name="OutboxStatus")
    block_source = sa.Enum(
        "MANUAL", "OTA_AIRBNB", "OTA_MMT", "OTA_BOOKING", "HOLD", "EVENT", name="InventoryBlockSource"
    )

    guest_source.create(op.get_bind(), checkfirst=True)
    lead_occasion.create(op.get_bind(), checkfirst=True)
    lead_stage.create(op.get_bind(), checkfirst=True)
    partner_type.create(op.get_bind(), checkfirst=True)
    commission_status.create(op.get_bind(), checkfirst=True)
    event_venue.create(op.get_bind(), checkfirst=True)
    event_status.create(op.get_bind(), checkfirst=True)
    outbox_status.create(op.get_bind(), checkfirst=True)
    block_source.create(op.get_bind(), checkfirst=True)

    if _has_table("Guest"):
        if not _has_column("Guest", "source"):
            op.add_column("Guest", sa.Column("source", guest_source, nullable=True))
        if not _has_column("Guest", "whatsappConsent"):
            op.add_column("Guest", sa.Column("whatsappConsent", sa.Boolean(), server_default=sa.true(), nullable=False))
        if not _has_column("Guest", "dnd"):
            op.add_column("Guest", sa.Column("dnd", sa.Boolean(), server_default=sa.false(), nullable=False))
        if not _has_column("Guest", "lastStayOccasion"):
            op.add_column("Guest", sa.Column("lastStayOccasion", sa.String(), nullable=True))

    if _has_table("MessageOutbox"):
        _add_overlap_constraint()
        return

    if not _has_table("Partner"):
        op.create_table(
        "Partner",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("type", partner_type, nullable=False),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("firm", sa.String(), nullable=True),
        sa.Column("commissionRate", sa.Numeric(5, 2), server_default="10"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("isActive", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("createdAt", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updatedAt", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("Partner_type_idx", "Partner", ["type"])
    op.create_index("Partner_phone_idx", "Partner", ["phone"])
    op.create_index("Partner_isActive_idx", "Partner", ["isActive"])

    if _has_table("Booking") and not _has_column("Booking", "partnerId"):
        op.add_column("Booking", sa.Column("partnerId", sa.String(), sa.ForeignKey("Partner.id"), nullable=True))
    if _has_table("Booking") and not _has_index("Booking", "Booking_partnerId_idx"):
        op.create_index("Booking_partnerId_idx", "Booking", ["partnerId"])

    op.create_table(
        "Lead",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("source", guest_source, nullable=False),
        sa.Column("occasion", lead_occasion, nullable=False),
        sa.Column("stage", lead_stage, nullable=False),
        sa.Column("expectedValue", sa.Numeric(12, 2), nullable=True),
        sa.Column("lostReason", sa.String(), nullable=True),
        sa.Column("nextFollowUpAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ownerUserId", sa.String(), sa.ForeignKey("User.id"), nullable=True),
        sa.Column("partnerId", sa.String(), sa.ForeignKey("Partner.id"), nullable=True),
        sa.Column("convertedGuestId", sa.String(), sa.ForeignKey("Guest.id"), nullable=True),
        sa.Column("convertedBookingId", sa.String(), sa.ForeignKey("Booking.id"), nullable=True),
        sa.Column("convertedEventId", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("createdAt", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updatedAt", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("Lead_phone_idx", "Lead", ["phone"])
    op.create_index("Lead_stage_idx", "Lead", ["stage"])
    op.create_index("Lead_nextFollowUpAt_idx", "Lead", ["nextFollowUpAt"])
    op.create_index("Lead_ownerUserId_idx", "Lead", ["ownerUserId"])
    op.create_index("Lead_partnerId_idx", "Lead", ["partnerId"])

    op.create_table(
        "EventDeal",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("type", lead_occasion, nullable=False),
        sa.Column("eventDate", sa.DateTime(timezone=True), nullable=False),
        sa.Column("venue", event_venue, nullable=False),
        sa.Column("pax", sa.Integer(), server_default="50"),
        sa.Column("status", event_status, nullable=False),
        sa.Column("quotedAmount", sa.Numeric(12, 2), nullable=True),
        sa.Column("exclusiveBuyout", sa.Boolean(), server_default=sa.false()),
        sa.Column("leadId", sa.String(), sa.ForeignKey("Lead.id"), nullable=True),
        sa.Column("guestId", sa.String(), sa.ForeignKey("Guest.id"), nullable=True),
        sa.Column("partnerId", sa.String(), sa.ForeignKey("Partner.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("createdAt", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updatedAt", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("EventDeal_eventDate_idx", "EventDeal", ["eventDate"])
    op.create_index("EventDeal_status_idx", "EventDeal", ["status"])
    op.create_index("EventDeal_leadId_idx", "EventDeal", ["leadId"])
    op.create_foreign_key("Lead_convertedEventId_fkey", "Lead", "EventDeal", ["convertedEventId"], ["id"])

    op.create_table(
        "Commission",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("partnerId", sa.String(), sa.ForeignKey("Partner.id"), nullable=False),
        sa.Column("bookingId", sa.String(), sa.ForeignKey("Booking.id"), nullable=True),
        sa.Column("eventId", sa.String(), sa.ForeignKey("EventDeal.id"), nullable=True),
        sa.Column("baseAmount", sa.Numeric(12, 2), nullable=False),
        sa.Column("rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", commission_status, nullable=False),
        sa.Column("paidAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("createdAt", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updatedAt", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("Commission_partnerId_idx", "Commission", ["partnerId"])
    op.create_index("Commission_bookingId_idx", "Commission", ["bookingId"])
    op.create_index("Commission_eventId_idx", "Commission", ["eventId"])
    op.create_index("Commission_status_idx", "Commission", ["status"])
    op.create_index("Commission_partner_booking_uidx", "Commission", ["partnerId", "bookingId"], unique=True)

    op.create_table(
        "MessageOutbox",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("templateKey", sa.String(), nullable=False),
        sa.Column("toPhone", sa.String(), nullable=False),
        sa.Column("payload", JSONB(), nullable=True),
        sa.Column("status", outbox_status, nullable=False),
        sa.Column("providerMessageId", sa.String(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("relatedType", sa.String(), nullable=False),
        sa.Column("relatedId", sa.String(), nullable=False),
        sa.Column("idempotencyKey", sa.String(), unique=True, nullable=False),
        sa.Column("createdByUserId", sa.String(), sa.ForeignKey("User.id"), nullable=True),
        sa.Column("attempts", sa.Integer(), server_default="0"),
        sa.Column("createdAt", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updatedAt", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("MessageOutbox_status_idx", "MessageOutbox", ["status"])
    op.create_index("MessageOutbox_related_idx", "MessageOutbox", ["relatedType", "relatedId"])
    op.create_index("MessageOutbox_template_related_idx", "MessageOutbox", ["templateKey", "relatedId"])

    op.create_table(
        "InventoryBlock",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("roomId", sa.String(), sa.ForeignKey("Room.id"), nullable=True),
        sa.Column("start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", block_source, nullable=False),
        sa.Column("externalUid", sa.String(), nullable=True),
        sa.Column("expiresAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("eventId", sa.String(), sa.ForeignKey("EventDeal.id"), nullable=True),
        sa.Column("leadId", sa.String(), sa.ForeignKey("Lead.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("createdByUserId", sa.String(), sa.ForeignKey("User.id"), nullable=True),
        sa.Column("createdAt", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updatedAt", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("InventoryBlock_roomId_idx", "InventoryBlock", ["roomId"])
    op.create_index("InventoryBlock_start_end_idx", "InventoryBlock", ["start", "end"])
    op.create_index("InventoryBlock_source_idx", "InventoryBlock", ["source"])
    op.create_index("InventoryBlock_externalUid_idx", "InventoryBlock", ["externalUid"])
    op.create_index("InventoryBlock_eventId_idx", "InventoryBlock", ["eventId"])

    _add_overlap_constraint()


def downgrade() -> None:
    op.execute('ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_no_overlap')
    op.drop_table("InventoryBlock")
    op.drop_table("MessageOutbox")
    op.drop_table("Commission")
    op.drop_constraint("Lead_convertedEventId_fkey", "Lead", type_="foreignkey")
    op.drop_table("EventDeal")
    op.drop_table("Lead")
    op.drop_index("Booking_partnerId_idx", table_name="Booking")
    op.drop_column("Booking", "partnerId")
    op.drop_table("Partner")
    op.drop_column("Guest", "lastStayOccasion")
    op.drop_column("Guest", "dnd")
    op.drop_column("Guest", "whatsappConsent")
    op.drop_column("Guest", "source")
