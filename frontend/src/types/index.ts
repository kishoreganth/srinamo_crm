export type UserRole = 'ADMIN' | 'RECEPTIONIST';
export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'CLEANING' | 'INSPECTED';
export type BookingStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
export type BookingSource = 'WALK_IN' | 'PHONE' | 'ONLINE' | 'OTA' | 'WHATSAPP' | 'REFERRAL' | 'PARTNER' | 'IMPORT';
export type GuestSource = BookingSource;
export type LeadOccasion = 'STAY' | 'BIRTHDAY' | 'WEDDING' | 'CORPORATE' | 'OTHER';
export type LeadStage = 'NEW' | 'CONTACTED' | 'QUOTED' | 'HOLD' | 'WON' | 'LOST';
export type PartnerType = 'PLANNER' | 'PHOTOGRAPHER' | 'DECORATOR' | 'TRAVEL' | 'CORPORATE' | 'INFLUENCER' | 'OTHER';
export type PartnerTier = 'Local' | 'Chennai' | 'National';
export type CommissionStatus = 'DUE' | 'PAID';
export type EventVenue = 'LAWN' | 'ROOFTOP' | 'POOL' | 'OTHER';
export type EventDealStatus = 'INQUIRY' | 'QUOTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
export type OutboxStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
export type InventoryBlockSource = 'MANUAL' | 'OTA_AIRBNB' | 'OTA_MMT' | 'OTA_BOOKING' | 'HOLD' | 'EVENT';
export type IdType = 'AADHAAR' | 'PAN' | 'PASSPORT' | 'DRIVING_LICENSE' | 'VOTER_ID';
export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'RAZORPAY' | 'BANK_TRANSFER';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'REFUNDED';
export type FoodOrderType = 'ROOM_SERVICE' | 'DINE_IN' | 'WALK_IN';
export type FoodOrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
export type TaskType = 'CLEANING' | 'INSPECTION' | 'MAINTENANCE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type DayType = 'WEEKDAY' | 'WEEKEND' | 'ALL';
export type ActivityBookingStatus = 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
export type FolioCategory = 'ROOM' | 'FOOD' | 'ACTIVITY' | 'LAUNDRY' | 'MINIBAR' | 'DAMAGE' | 'OTHER';
export type InvoiceType = 'GST' | 'SIMPLE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RoomType {
  id: string;
  name: string;
  description?: string;
  maxOccupancy: number;
  basePrice: number;
  amenities: string[];
  images: string[];
  createdAt: string;
  updatedAt: string;
  rooms?: Room[];
  _count?: { rooms: number };
}

export interface Room {
  id: string;
  roomTypeId: string;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  createdAt: string;
  updatedAt: string;
  roomType?: RoomType;
}

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  idType?: IdType;
  idNumber?: string;
  idDocumentUrl?: string;
  dateOfBirth?: string;
  anniversary?: string;
  notes?: string;
  source?: GuestSource;
  whatsappConsent?: boolean;
  dnd?: boolean;
  lastStayOccasion?: string;
  totalStays: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  bookings?: Booking[];
}

export interface CreateGuestRequest {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  idType?: IdType;
  idNumber?: string;
  dateOfBirth?: string;
  anniversary?: string;
  notes?: string;
  source?: GuestSource;
  whatsappConsent?: boolean;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: GuestSource;
  occasion: LeadOccasion;
  stage: LeadStage;
  expectedValue?: number;
  lostReason?: string;
  nextFollowUpAt?: string;
  ownerUserId?: string;
  partnerId?: string;
  convertedGuestId?: string;
  convertedBookingId?: string;
  convertedEventId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  partner?: Partner;
}

export interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  phone?: string;
  email?: string;
  firm?: string;
  location?: string;
  tier?: PartnerTier | string;
  instagram?: string;
  commissionRate?: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Commission {
  id: string;
  partnerId: string;
  bookingId?: string;
  eventId?: string;
  baseAmount: number;
  rate: number;
  amount: number;
  status: CommissionStatus;
  paidAt?: string;
  createdAt: string;
  partner?: Partner;
}

export interface EventDeal {
  id: string;
  type: LeadOccasion;
  eventDate: string;
  venue: EventVenue;
  pax: number;
  status: EventDealStatus;
  quotedAmount?: number;
  exclusiveBuyout: boolean;
  leadId?: string;
  guestId?: string;
  partnerId?: string;
  notes?: string;
  createdAt: string;
  guest?: Guest;
  partner?: Partner;
  roomHolds?: InventoryBlock[];
}

export interface MessageOutbox {
  id: string;
  templateKey: string;
  toPhone: string;
  payload?: Record<string, unknown>;
  status: OutboxStatus;
  providerMessageId?: string;
  error?: string;
  relatedType: string;
  relatedId: string;
  createdAt: string;
}

export interface InventoryBlock {
  id: string;
  roomId?: string;
  start: string;
  end: string;
  source: InventoryBlockSource;
  externalUid?: string;
  expiresAt?: string;
  eventId?: string;
  leadId?: string;
  notes?: string;
  room?: Room;
}

export interface Scoreboard {
  weekdayOccupancy: number;
  weekendOccupancy: number;
  leadsThisWeek: number;
  leadsWon: number;
  leadWinRate: number;
  outboxFailed: number;
  commissionsDue: number;
  weekStart: string;
}

export interface Booking {
  id: string;
  bookingCode: string;
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  actualAdults?: number;
  actualChildren?: number;
  status: BookingStatus;
  source: BookingSource;
  partnerId?: string;
  totalAmount: number;
  paidAmount: number;
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  guest?: Guest;
  room?: Room;
  payments?: Payment[];
  invoices?: Invoice[];
  folioItems?: FolioItem[];
  foodOrders?: FoodOrder[];
  activityBookings?: ActivityBooking[];
  bookingGuests?: BookingGuest[];
  rooms?: Room[];
  amenities?: Amenity[];
  package?: DayPackage;
}

export interface Amenity {
  id: string;
  name: string;
  description?: string;
  price: number;
  chargeType?: 'FLAT' | 'PER_PERSON' | string;
  included?: boolean;
  isActive: boolean;
}

export interface DayPackage {
  id: string;
  name: string;
  pricePerPerson: number;
  startsAt: string;
  endsAt: string;
  includes: string;
  sortOrder: number;
  isActive: boolean;
}

export interface BookingGuest {
  id: string;
  bookingId: string;
  guestName: string;
  idType?: string;
  idNumber?: string;
  idDocumentUrl?: string;
  createdAt: string;
}

export interface CreateBookingRequest {
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults?: number;
  children?: number;
  source?: BookingSource;
  specialRequests?: string;
  companions?: { guestName: string }[];
  roomIds?: string[];
  packageId?: string;
  amenityIds?: string[];
  amenitySelections?: { amenityId: string; quantity: number }[];
}

export interface RatePlan {
  id: string;
  roomTypeId: string;
  name: string;
  startDate: string;
  endDate: string;
  dayType: DayType;
  price: number;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  roomType?: RoomType;
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paymentType?: string;
  transactionId?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentRequest {
  bookingId: string;
  amount: number;
  method: PaymentMethod;
  paymentType?: string;
  transactionId?: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  bookingId: string;
  invoiceNumber: string;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  guestGstin?: string;
  isGstInvoice: boolean;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FolioItem {
  id: string;
  bookingId: string;
  description: string;
  category: FolioCategory;
  amount: number;
  quantity: number;
  createdAt: string;
}

export interface CreateFolioItemRequest {
  bookingId: string;
  description: string;
  category: FolioCategory;
  amount: number;
  quantity?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  isVeg: boolean;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FoodOrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  menuItem?: MenuItem;
}

export interface FoodOrder {
  id: string;
  bookingId?: string;
  guestId?: string;
  orderType: FoodOrderType;
  status: FoodOrderStatus;
  totalAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items?: FoodOrderItem[];
  guest?: Guest;
  booking?: Booking;
}

export interface CreateFoodOrderRequest {
  bookingId?: string;
  guestId?: string;
  orderType: FoodOrderType;
  notes?: string;
  items: { menuItemId: string; quantity: number; notes?: string }[];
}

export interface HousekeepingTask {
  id: string;
  roomId: string;
  taskType: TaskType;
  status: TaskStatus;
  assignedTo?: string;
  notes?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  room?: Room;
}

export interface CreateHousekeepingTaskRequest {
  roomId: string;
  taskType: TaskType;
  assignedTo?: string;
  notes?: string;
}

export interface Activity {
  id: string;
  name: string;
  description?: string;
  price: number;
  maxParticipants: number;
  duration?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityBooking {
  id: string;
  activityId: string;
  guestId: string;
  bookingId?: string;
  scheduledDate: string;
  participants: number;
  status: ActivityBookingStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  activity?: Activity;
  guest?: Guest;
}

export interface CreateActivityBookingRequest {
  activityId: string;
  guestId: string;
  bookingId?: string;
  scheduledDate: string;
  participants?: number;
  notes?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardData {
  occupancyRate: number;
  totalRevenue: number;
  todayArrivals: number;
  todayDepartures: number;
  availableRooms: number;
  occupiedRooms: number;
  maintenanceRooms: number;
  recentBookings: Booking[];
  roomStatusSummary: { status: string; count: number }[];
  revenueChart: { date: string; revenue: number }[];
  occupancyChart: { date: string; rate: number }[];
}

export interface OccupancyData {
  date: string;
  totalRooms: number;
  occupiedRooms: number;
  rate: number;
}

export interface RevenueData {
  date: string;
  room: number;
  food: number;
  activity: number;
  total: number;
}
