import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    String, Integer, Boolean, DateTime, Numeric, Text, Index, ForeignKey, Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


# ── Enums ───────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    RECEPTIONIST = "RECEPTIONIST"


class RoomStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    OCCUPIED = "OCCUPIED"
    MAINTENANCE = "MAINTENANCE"
    CLEANING = "CLEANING"
    INSPECTED = "INSPECTED"


class BookingStatus(str, enum.Enum):
    CONFIRMED = "CONFIRMED"
    CHECKED_IN = "CHECKED_IN"
    CHECKED_OUT = "CHECKED_OUT"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class BookingSource(str, enum.Enum):
    WALK_IN = "WALK_IN"
    PHONE = "PHONE"
    ONLINE = "ONLINE"
    OTA = "OTA"
    WHATSAPP = "WHATSAPP"
    REFERRAL = "REFERRAL"
    PARTNER = "PARTNER"
    IMPORT = "IMPORT"


class GuestSource(str, enum.Enum):
    WALK_IN = "WALK_IN"
    PHONE = "PHONE"
    ONLINE = "ONLINE"
    OTA = "OTA"
    WHATSAPP = "WHATSAPP"
    REFERRAL = "REFERRAL"
    PARTNER = "PARTNER"
    IMPORT = "IMPORT"


class LeadOccasion(str, enum.Enum):
    STAY = "STAY"
    BIRTHDAY = "BIRTHDAY"
    WEDDING = "WEDDING"
    CORPORATE = "CORPORATE"
    OTHER = "OTHER"


class LeadStage(str, enum.Enum):
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    QUOTED = "QUOTED"
    HOLD = "HOLD"
    WON = "WON"
    LOST = "LOST"


class PartnerType(str, enum.Enum):
    PLANNER = "PLANNER"
    PHOTOGRAPHER = "PHOTOGRAPHER"
    DECORATOR = "DECORATOR"
    TRAVEL = "TRAVEL"
    CORPORATE = "CORPORATE"
    INFLUENCER = "INFLUENCER"
    OTHER = "OTHER"


class CommissionStatus(str, enum.Enum):
    DUE = "DUE"
    PAID = "PAID"


class EventVenue(str, enum.Enum):
    LAWN = "LAWN"
    ROOFTOP = "ROOFTOP"
    POOL = "POOL"
    OTHER = "OTHER"


class EventDealStatus(str, enum.Enum):
    INQUIRY = "INQUIRY"
    QUOTED = "QUOTED"
    CONFIRMED = "CONFIRMED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class OutboxStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class InventoryBlockSource(str, enum.Enum):
    MANUAL = "MANUAL"
    OTA_AIRBNB = "OTA_AIRBNB"
    OTA_MMT = "OTA_MMT"
    OTA_BOOKING = "OTA_BOOKING"
    HOLD = "HOLD"
    EVENT = "EVENT"


class IdType(str, enum.Enum):
    AADHAAR = "AADHAAR"
    PAN = "PAN"
    PASSPORT = "PASSPORT"
    DRIVING_LICENSE = "DRIVING_LICENSE"
    VOTER_ID = "VOTER_ID"


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    UPI = "UPI"
    CARD = "CARD"
    RAZORPAY = "RAZORPAY"
    BANK_TRANSFER = "BANK_TRANSFER"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    REFUNDED = "REFUNDED"


class OrderType(str, enum.Enum):
    ROOM_SERVICE = "ROOM_SERVICE"
    DINE_IN = "DINE_IN"
    WALK_IN = "WALK_IN"


class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    PREPARING = "PREPARING"
    READY = "READY"
    SERVED = "SERVED"
    CANCELLED = "CANCELLED"


class HousekeepingTaskType(str, enum.Enum):
    CLEANING = "CLEANING"
    INSPECTION = "INSPECTION"
    MAINTENANCE = "MAINTENANCE"


class TaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class DayType(str, enum.Enum):
    WEEKDAY = "WEEKDAY"
    WEEKEND = "WEEKEND"
    ALL = "ALL"


class ActivityBookingStatus(str, enum.Enum):
    CONFIRMED = "CONFIRMED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


# ── Models ──────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    passwordHash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="UserRole", create_type=False), default=UserRole.RECEPTIONIST)
    isActive: Mapped[bool] = mapped_column(Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (Index("User_email_idx", "email"),)


class RoomType(Base):
    __tablename__ = "RoomType"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    maxOccupancy: Mapped[int] = mapped_column(Integer, nullable=False)
    basePrice: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    amenities: Mapped[dict] = mapped_column(JSONB, default=list)
    images: Mapped[dict] = mapped_column(JSONB, default=list)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    rooms: Mapped[list["Room"]] = relationship(back_populates="roomType", lazy="selectin")
    ratePlans: Mapped[list["RatePlan"]] = relationship(back_populates="roomType", lazy="selectin")


class Room(Base):
    __tablename__ = "Room"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    roomTypeId: Mapped[str] = mapped_column(String, ForeignKey("RoomType.id"), nullable=False)
    roomNumber: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    floor: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[RoomStatus] = mapped_column(SAEnum(RoomStatus, name="RoomStatus", create_type=False), default=RoomStatus.AVAILABLE)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    roomType: Mapped["RoomType"] = relationship(back_populates="rooms", lazy="selectin")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="room", lazy="noload")
    housekeepingTasks: Mapped[list["HousekeepingTask"]] = relationship(back_populates="room", lazy="noload")
    inventoryBlocks: Mapped[list["InventoryBlock"]] = relationship(back_populates="room", lazy="noload")

    __table_args__ = (
        Index("Room_roomTypeId_idx", "roomTypeId"),
        Index("Room_status_idx", "status"),
        Index("Room_floor_idx", "floor"),
    )


class Guest(Base):
    __tablename__ = "Guest"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    firstName: Mapped[str] = mapped_column(String, nullable=False)
    lastName: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    state: Mapped[str | None] = mapped_column(String, nullable=True)
    idType: Mapped[IdType | None] = mapped_column(SAEnum(IdType, name="IdType", create_type=False), nullable=True)
    idNumber: Mapped[str | None] = mapped_column(String, nullable=True)
    idDocumentUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    dateOfBirth: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    anniversary: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[GuestSource | None] = mapped_column(SAEnum(GuestSource, name="GuestSource", create_type=False), nullable=True)
    whatsappConsent: Mapped[bool] = mapped_column(Boolean, default=True)
    dnd: Mapped[bool] = mapped_column(Boolean, default=False)
    lastStayOccasion: Mapped[str | None] = mapped_column(String, nullable=True)
    totalStays: Mapped[int] = mapped_column(Integer, default=0)
    totalSpent: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    deletedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    bookings: Mapped[list["Booking"]] = relationship(back_populates="guest", lazy="noload")
    foodOrders: Mapped[list["FoodOrder"]] = relationship(back_populates="guest", lazy="noload")
    activityBookings: Mapped[list["ActivityBooking"]] = relationship(back_populates="guest", lazy="noload")
    leads: Mapped[list["Lead"]] = relationship(back_populates="convertedGuest", lazy="noload")

    __table_args__ = (
        Index("Guest_phone_idx", "phone"),
        Index("Guest_email_idx", "email"),
        Index("Guest_idNumber_idx", "idNumber"),
        Index("Guest_firstName_lastName_idx", "firstName", "lastName"),
    )


class Booking(Base):
    __tablename__ = "Booking"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    bookingCode: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    guestId: Mapped[str] = mapped_column(String, ForeignKey("Guest.id"), nullable=False)
    roomId: Mapped[str] = mapped_column(String, ForeignKey("Room.id"), nullable=False)
    checkIn: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    checkOut: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    adults: Mapped[int] = mapped_column(Integer, default=1)
    children: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[BookingStatus] = mapped_column(SAEnum(BookingStatus, name="BookingStatus", create_type=False), default=BookingStatus.CONFIRMED)
    source: Mapped[BookingSource] = mapped_column(SAEnum(BookingSource, name="BookingSource", create_type=False), default=BookingSource.WALK_IN)
    partnerId: Mapped[str | None] = mapped_column(String, ForeignKey("Partner.id"), nullable=True)
    packageId: Mapped[str | None] = mapped_column(String, ForeignKey("DayPackage.id"), nullable=True)
    totalAmount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    specialRequests: Mapped[str | None] = mapped_column(Text, nullable=True)
    actualAdults: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actualChildren: Mapped[int | None] = mapped_column(Integer, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    deletedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    guest: Mapped["Guest"] = relationship(back_populates="bookings", lazy="selectin")
    room: Mapped["Room"] = relationship(back_populates="bookings", lazy="selectin")
    payments: Mapped[list["Payment"]] = relationship(back_populates="booking", lazy="noload")
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="booking", lazy="noload")
    folioItems: Mapped[list["FolioItem"]] = relationship(back_populates="booking", lazy="noload")
    foodOrders: Mapped[list["FoodOrder"]] = relationship(back_populates="booking", lazy="noload")
    activityBookings: Mapped[list["ActivityBooking"]] = relationship(back_populates="booking", lazy="noload")
    bookingGuests: Mapped[list["BookingGuest"]] = relationship(back_populates="booking", lazy="noload")
    extraRooms: Mapped[list["BookingRoom"]] = relationship(back_populates="booking", lazy="noload")
    bookingAmenities: Mapped[list["BookingAmenity"]] = relationship(back_populates="booking", lazy="noload")
    partner: Mapped["Partner | None"] = relationship(lazy="noload")
    commissions: Mapped[list["Commission"]] = relationship(back_populates="booking", lazy="noload")

    __table_args__ = (
        Index("Booking_checkIn_checkOut_idx", "checkIn", "checkOut"),
        Index("Booking_status_idx", "status"),
        Index("Booking_guestId_idx", "guestId"),
        Index("Booking_roomId_idx", "roomId"),
        Index("Booking_bookingCode_idx", "bookingCode"),
        Index("Booking_partnerId_idx", "partnerId"),
    )


class RatePlan(Base):
    __tablename__ = "RatePlan"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    roomTypeId: Mapped[str] = mapped_column(String, ForeignKey("RoomType.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    startDate: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    endDate: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    dayType: Mapped[DayType] = mapped_column(SAEnum(DayType, name="DayType", create_type=False), default=DayType.ALL)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    isActive: Mapped[bool] = mapped_column(Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    roomType: Mapped["RoomType"] = relationship(back_populates="ratePlans", lazy="selectin")

    __table_args__ = (
        Index("RatePlan_roomTypeId_idx", "roomTypeId"),
        Index("RatePlan_startDate_endDate_idx", "startDate", "endDate"),
        Index("RatePlan_isActive_idx", "isActive"),
    )


class Payment(Base):
    __tablename__ = "Payment"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    bookingId: Mapped[str] = mapped_column(String, ForeignKey("Booking.id"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    method: Mapped[PaymentMethod] = mapped_column(SAEnum(PaymentMethod, name="PaymentMethod", create_type=False), nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(SAEnum(PaymentStatus, name="PaymentStatus", create_type=False), default=PaymentStatus.PENDING)
    transactionId: Mapped[str | None] = mapped_column(String, nullable=True)
    paidAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    paymentType: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    booking: Mapped["Booking"] = relationship(back_populates="payments", lazy="selectin")

    __table_args__ = (
        Index("Payment_bookingId_idx", "bookingId"),
        Index("Payment_status_idx", "status"),
    )


class Invoice(Base):
    __tablename__ = "Invoice"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    bookingId: Mapped[str] = mapped_column(String, ForeignKey("Booking.id"), nullable=False)
    invoiceNumber: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    cgst: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    sgst: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    igst: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    totalAmount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    guestGstin: Mapped[str | None] = mapped_column(String, nullable=True)
    isGstInvoice: Mapped[bool] = mapped_column(Boolean, default=False)
    pdfUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    booking: Mapped["Booking"] = relationship(back_populates="invoices", lazy="selectin")

    __table_args__ = (
        Index("Invoice_bookingId_idx", "bookingId"),
        Index("Invoice_invoiceNumber_idx", "invoiceNumber"),
    )


class FolioItem(Base):
    __tablename__ = "FolioItem"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    bookingId: Mapped[str] = mapped_column(String, ForeignKey("Booking.id"), nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    booking: Mapped["Booking"] = relationship(back_populates="folioItems", lazy="noload")

    __table_args__ = (
        Index("FolioItem_bookingId_idx", "bookingId"),
        Index("FolioItem_category_idx", "category"),
    )


class MenuItem(Base):
    __tablename__ = "MenuItem"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    isVeg: Mapped[bool] = mapped_column(Boolean, nullable=False)
    isAvailable: Mapped[bool] = mapped_column(Boolean, default=True)
    sortOrder: Mapped[int] = mapped_column(Integer, default=0)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    orderItems: Mapped[list["FoodOrderItem"]] = relationship(back_populates="menuItem", lazy="noload")

    __table_args__ = (
        Index("MenuItem_category_idx", "category"),
        Index("MenuItem_isAvailable_idx", "isAvailable"),
    )


class FoodOrder(Base):
    __tablename__ = "FoodOrder"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    bookingId: Mapped[str | None] = mapped_column(String, ForeignKey("Booking.id"), nullable=True)
    guestId: Mapped[str | None] = mapped_column(String, ForeignKey("Guest.id"), nullable=True)
    orderType: Mapped[OrderType] = mapped_column(SAEnum(OrderType, name="OrderType", create_type=False), nullable=False)
    status: Mapped[OrderStatus] = mapped_column(SAEnum(OrderStatus, name="OrderStatus", create_type=False), default=OrderStatus.PENDING)
    totalAmount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    booking: Mapped["Booking | None"] = relationship(back_populates="foodOrders", lazy="selectin")
    guest: Mapped["Guest | None"] = relationship(back_populates="foodOrders", lazy="selectin")
    items: Mapped[list["FoodOrderItem"]] = relationship(back_populates="order", lazy="selectin")

    __table_args__ = (
        Index("FoodOrder_bookingId_idx", "bookingId"),
        Index("FoodOrder_status_idx", "status"),
        Index("FoodOrder_orderType_idx", "orderType"),
    )


class FoodOrderItem(Base):
    __tablename__ = "FoodOrderItem"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    orderId: Mapped[str] = mapped_column(String, ForeignKey("FoodOrder.id"), nullable=False)
    menuItemId: Mapped[str] = mapped_column(String, ForeignKey("MenuItem.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unitPrice: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    order: Mapped["FoodOrder"] = relationship(back_populates="items", lazy="noload")
    menuItem: Mapped["MenuItem"] = relationship(lazy="selectin")

    __table_args__ = (Index("FoodOrderItem_orderId_idx", "orderId"),)


class HousekeepingTask(Base):
    __tablename__ = "HousekeepingTask"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    roomId: Mapped[str] = mapped_column(String, ForeignKey("Room.id"), nullable=False)
    taskType: Mapped[HousekeepingTaskType] = mapped_column(SAEnum(HousekeepingTaskType, name="HousekeepingTaskType", create_type=False), nullable=False)
    status: Mapped[TaskStatus] = mapped_column(SAEnum(TaskStatus, name="TaskStatus", create_type=False), default=TaskStatus.PENDING)
    assignedTo: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    room: Mapped["Room"] = relationship(back_populates="housekeepingTasks", lazy="selectin")

    __table_args__ = (
        Index("HousekeepingTask_roomId_idx", "roomId"),
        Index("HousekeepingTask_status_idx", "status"),
        Index("HousekeepingTask_taskType_idx", "taskType"),
    )


class Activity(Base):
    __tablename__ = "Activity"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    maxParticipants: Mapped[int] = mapped_column(Integer, nullable=False)
    duration: Mapped[str | None] = mapped_column(String, nullable=True)
    isActive: Mapped[bool] = mapped_column(Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    bookings: Mapped[list["ActivityBooking"]] = relationship(back_populates="activity", lazy="noload")

    __table_args__ = (Index("Activity_isActive_idx", "isActive"),)


class ActivityBooking(Base):
    __tablename__ = "ActivityBooking"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    activityId: Mapped[str] = mapped_column(String, ForeignKey("Activity.id"), nullable=False)
    guestId: Mapped[str] = mapped_column(String, ForeignKey("Guest.id"), nullable=False)
    bookingId: Mapped[str | None] = mapped_column(String, ForeignKey("Booking.id"), nullable=True)
    scheduledDate: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    participants: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[ActivityBookingStatus] = mapped_column(SAEnum(ActivityBookingStatus, name="ActivityBookingStatus", create_type=False), default=ActivityBookingStatus.CONFIRMED)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    activity: Mapped["Activity"] = relationship(back_populates="bookings", lazy="selectin")
    guest: Mapped["Guest"] = relationship(back_populates="activityBookings", lazy="selectin")
    booking: Mapped["Booking | None"] = relationship(back_populates="activityBookings", lazy="selectin")

    __table_args__ = (
        Index("ActivityBooking_activityId_idx", "activityId"),
        Index("ActivityBooking_guestId_idx", "guestId"),
        Index("ActivityBooking_scheduledDate_idx", "scheduledDate"),
        Index("ActivityBooking_status_idx", "status"),
    )


class DayPackage(Base):
    __tablename__ = "DayPackage"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    pricePerPerson: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    startsAt: Mapped[str] = mapped_column(String, nullable=False)
    endsAt: Mapped[str] = mapped_column(String, nullable=False)
    includes: Mapped[str] = mapped_column(Text, nullable=False)
    sortOrder: Mapped[int] = mapped_column(Integer, default=0)
    isActive: Mapped[bool] = mapped_column(Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class BookingRoom(Base):
    __tablename__ = "BookingRoom"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    bookingId: Mapped[str] = mapped_column(String, ForeignKey("Booking.id"), nullable=False)
    roomId: Mapped[str] = mapped_column(String, ForeignKey("Room.id"), nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    booking: Mapped["Booking"] = relationship(back_populates="extraRooms", lazy="noload")
    room: Mapped["Room"] = relationship(lazy="selectin")

    __table_args__ = (
        Index("BookingRoom_bookingId_idx", "bookingId"),
        Index("BookingRoom_roomId_idx", "roomId"),
        Index("BookingRoom_booking_room_uidx", "bookingId", "roomId", unique=True),
    )


class Amenity(Base):
    __tablename__ = "Amenity"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    chargeType: Mapped[str] = mapped_column(String, default="FLAT")
    included: Mapped[bool] = mapped_column(Boolean, default=False)
    isActive: Mapped[bool] = mapped_column(Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class BookingAmenity(Base):
    __tablename__ = "BookingAmenity"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    bookingId: Mapped[str] = mapped_column(String, ForeignKey("Booking.id"), nullable=False)
    amenityId: Mapped[str] = mapped_column(String, ForeignKey("Amenity.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    booking: Mapped["Booking"] = relationship(back_populates="bookingAmenities", lazy="noload")
    amenity: Mapped["Amenity"] = relationship(lazy="selectin")

    __table_args__ = (
        Index("BookingAmenity_bookingId_idx", "bookingId"),
        Index("BookingAmenity_booking_amenity_uidx", "bookingId", "amenityId", unique=True),
    )


class BookingGuest(Base):
    __tablename__ = "BookingGuest"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    bookingId: Mapped[str] = mapped_column(String, ForeignKey("Booking.id"), nullable=False)
    guestName: Mapped[str] = mapped_column(String, nullable=False)
    idType: Mapped[str | None] = mapped_column(String, nullable=True)
    idNumber: Mapped[str | None] = mapped_column(String, nullable=True)
    idDocumentUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    booking: Mapped["Booking"] = relationship(back_populates="bookingGuests", lazy="noload")

    __table_args__ = (
        Index("BookingGuest_bookingId_idx", "bookingId"),
    )


class Partner(Base):
    __tablename__ = "Partner"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[PartnerType] = mapped_column(SAEnum(PartnerType, name="PartnerType", create_type=False), default=PartnerType.OTHER)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    firm: Mapped[str | None] = mapped_column(String, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    tier: Mapped[str | None] = mapped_column(String, nullable=True)
    instagram: Mapped[str | None] = mapped_column(String, nullable=True)
    commissionRate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("10"))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    isActive: Mapped[bool] = mapped_column(Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    leads: Mapped[list["Lead"]] = relationship(back_populates="partner", lazy="noload")
    commissions: Mapped[list["Commission"]] = relationship(back_populates="partner", lazy="noload")

    __table_args__ = (
        Index("Partner_type_idx", "type"),
        Index("Partner_phone_idx", "phone"),
        Index("Partner_isActive_idx", "isActive"),
    )


class Lead(Base):
    __tablename__ = "Lead"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    source: Mapped[GuestSource] = mapped_column(SAEnum(GuestSource, name="GuestSource", create_type=False), default=GuestSource.PHONE)
    occasion: Mapped[LeadOccasion] = mapped_column(SAEnum(LeadOccasion, name="LeadOccasion", create_type=False), default=LeadOccasion.STAY)
    stage: Mapped[LeadStage] = mapped_column(SAEnum(LeadStage, name="LeadStage", create_type=False), default=LeadStage.NEW)
    expectedValue: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    lostReason: Mapped[str | None] = mapped_column(String, nullable=True)
    nextFollowUpAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ownerUserId: Mapped[str | None] = mapped_column(String, ForeignKey("User.id"), nullable=True)
    partnerId: Mapped[str | None] = mapped_column(String, ForeignKey("Partner.id"), nullable=True)
    convertedGuestId: Mapped[str | None] = mapped_column(String, ForeignKey("Guest.id"), nullable=True)
    convertedBookingId: Mapped[str | None] = mapped_column(String, ForeignKey("Booking.id"), nullable=True)
    convertedEventId: Mapped[str | None] = mapped_column(String, ForeignKey("EventDeal.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    owner: Mapped["User | None"] = relationship(lazy="noload")
    partner: Mapped["Partner | None"] = relationship(back_populates="leads", lazy="selectin")
    convertedGuest: Mapped["Guest | None"] = relationship(back_populates="leads", lazy="noload")

    __table_args__ = (
        Index("Lead_phone_idx", "phone"),
        Index("Lead_stage_idx", "stage"),
        Index("Lead_nextFollowUpAt_idx", "nextFollowUpAt"),
        Index("Lead_ownerUserId_idx", "ownerUserId"),
        Index("Lead_partnerId_idx", "partnerId"),
    )


class EventDeal(Base):
    __tablename__ = "EventDeal"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    type: Mapped[LeadOccasion] = mapped_column(SAEnum(LeadOccasion, name="LeadOccasion", create_type=False), default=LeadOccasion.WEDDING)
    eventDate: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    venue: Mapped[EventVenue] = mapped_column(SAEnum(EventVenue, name="EventVenue", create_type=False), default=EventVenue.LAWN)
    pax: Mapped[int] = mapped_column(Integer, default=50)
    status: Mapped[EventDealStatus] = mapped_column(SAEnum(EventDealStatus, name="EventDealStatus", create_type=False), default=EventDealStatus.INQUIRY)
    quotedAmount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    exclusiveBuyout: Mapped[bool] = mapped_column(Boolean, default=False)
    leadId: Mapped[str | None] = mapped_column(String, ForeignKey("Lead.id"), nullable=True)
    guestId: Mapped[str | None] = mapped_column(String, ForeignKey("Guest.id"), nullable=True)
    partnerId: Mapped[str | None] = mapped_column(String, ForeignKey("Partner.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    lead: Mapped["Lead | None"] = relationship(foreign_keys=[leadId], lazy="selectin")
    guest: Mapped["Guest | None"] = relationship(lazy="selectin")
    partner: Mapped["Partner | None"] = relationship(lazy="selectin")
    commissions: Mapped[list["Commission"]] = relationship(back_populates="event", lazy="noload")
    roomHolds: Mapped[list["InventoryBlock"]] = relationship(back_populates="event", lazy="noload")

    __table_args__ = (
        Index("EventDeal_eventDate_idx", "eventDate"),
        Index("EventDeal_status_idx", "status"),
        Index("EventDeal_leadId_idx", "leadId"),
    )


class Commission(Base):
    __tablename__ = "Commission"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    partnerId: Mapped[str] = mapped_column(String, ForeignKey("Partner.id"), nullable=False)
    bookingId: Mapped[str | None] = mapped_column(String, ForeignKey("Booking.id"), nullable=True)
    eventId: Mapped[str | None] = mapped_column(String, ForeignKey("EventDeal.id"), nullable=True)
    baseAmount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[CommissionStatus] = mapped_column(SAEnum(CommissionStatus, name="CommissionStatus", create_type=False), default=CommissionStatus.DUE)
    paidAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    partner: Mapped["Partner"] = relationship(back_populates="commissions", lazy="selectin")
    booking: Mapped["Booking | None"] = relationship(back_populates="commissions", lazy="noload")
    event: Mapped["EventDeal | None"] = relationship(back_populates="commissions", lazy="noload")

    __table_args__ = (
        Index("Commission_partnerId_idx", "partnerId"),
        Index("Commission_bookingId_idx", "bookingId"),
        Index("Commission_eventId_idx", "eventId"),
        Index("Commission_status_idx", "status"),
        Index("Commission_partner_booking_uidx", "partnerId", "bookingId", unique=True),
    )


class MessageOutbox(Base):
    __tablename__ = "MessageOutbox"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    templateKey: Mapped[str] = mapped_column(String, nullable=False)
    toPhone: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[OutboxStatus] = mapped_column(SAEnum(OutboxStatus, name="OutboxStatus", create_type=False), default=OutboxStatus.PENDING)
    providerMessageId: Mapped[str | None] = mapped_column(String, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    relatedType: Mapped[str] = mapped_column(String, nullable=False)
    relatedId: Mapped[str] = mapped_column(String, nullable=False)
    idempotencyKey: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    createdByUserId: Mapped[str | None] = mapped_column(String, ForeignKey("User.id"), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("MessageOutbox_status_idx", "status"),
        Index("MessageOutbox_related_idx", "relatedType", "relatedId"),
        Index("MessageOutbox_template_related_idx", "templateKey", "relatedId"),
    )


class InventoryBlock(Base):
    __tablename__ = "InventoryBlock"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    roomId: Mapped[str | None] = mapped_column(String, ForeignKey("Room.id"), nullable=True)
    start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[InventoryBlockSource] = mapped_column(SAEnum(InventoryBlockSource, name="InventoryBlockSource", create_type=False), default=InventoryBlockSource.MANUAL)
    externalUid: Mapped[str | None] = mapped_column(String, nullable=True)
    expiresAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    eventId: Mapped[str | None] = mapped_column(String, ForeignKey("EventDeal.id"), nullable=True)
    leadId: Mapped[str | None] = mapped_column(String, ForeignKey("Lead.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    createdByUserId: Mapped[str | None] = mapped_column(String, ForeignKey("User.id"), nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    room: Mapped["Room | None"] = relationship(back_populates="inventoryBlocks", lazy="selectin")
    event: Mapped["EventDeal | None"] = relationship(back_populates="roomHolds", lazy="noload")

    __table_args__ = (
        Index("InventoryBlock_roomId_idx", "roomId"),
        Index("InventoryBlock_start_end_idx", "start", "end"),
        Index("InventoryBlock_source_idx", "source"),
        Index("InventoryBlock_externalUid_idx", "externalUid"),
        Index("InventoryBlock_eventId_idx", "eventId"),
    )
