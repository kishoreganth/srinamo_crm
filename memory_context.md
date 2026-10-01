# SriNamo Farms Resort PMS - Memory Context

## Project Overview
Full-stack Property Management System for SriNamo Farms Resort & Farm Stays (40 rooms).
Internal tool for Admin + Receptionist. No guest-facing portal.
- **Backend**: FastAPI (Python) + SQLAlchemy 2.0 async + asyncpg + Alembic + PostgreSQL 16 + Redis 7 (port 3000)
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui (port 5173)
- **Infra**: Docker Compose (Postgres, Redis, MinIO, n8n, Nginx) | 7 services
- **Automation**: n8n (self-hosted) for WhatsApp workflows
- **Payments**: Razorpay (online) + manual recording (cash/UPI/card)
- **Storage**: MinIO (S3-compatible) for ID documents and invoice PDFs

## Backend Migration: NestJS -> FastAPI Python (2026-06-02)
- Migrating from NestJS/TypeScript to FastAPI/Python
- ORM: Prisma Client Python (reusing existing schema.prisma, fully async)
- Task Queue: arq (async, Redis-backed, replaces BullMQ)
- No Node.js dependency -- Prisma engine is Rust binary
- README.md updated with Python dev setup instructions
- schema.prisma: generator changed to prisma-client-py with enable_experimental_decimal=true
- Auth endpoint working: POST /api/auth/login, GET /api/auth/me (bcrypt direct, not passlib)
- Seed script: backend/seed.py (Python, uses prisma Json() for JSON fields)
- Frontend login page: added quick-select toggle for Admin/Receptionist credentials
- DB migrated and seeded: 2 users, 4 room types, 40 rooms, 22 menu items, 4 activities
- PATH note: prisma-client-py.exe in C:\Users\kisho\AppData\Roaming\Python\Python311\Scripts (needs PATH or python -m prisma)
- Routers created: rooms.py, room_types.py, guests.py (with schemas/rooms.py), restaurant.py, housekeeping.py, activities.py, bookings.py, pricing.py, billing.py, reports.py, notifications.py, users.py
  - rooms: CRUD, availability check (date-range conflict detection), status board, by-type filter
  - room_types: CRUD with Json fields (amenities/images), delete protection if rooms exist
  - guests: CRUD with pagination, search (multi-field OR), guest history (bookings+payments), soft-delete aware
  - restaurant: Menu CRUD, food orders (room service/dine-in/walk-in), kitchen display endpoint, auto folio integration on order
  - housekeeping: Task CRUD, board view (rooms with pending tasks), auto room status update on cleaning completion
  - activities: Activity catalog CRUD, activity booking with capacity check per day, auto folio integration
  - bookings: Full lifecycle (CONFIRMED->CHECKED_IN->CHECKED_OUT), calendar, today arrivals/departures, conflict detection, auto folio creation, webhook triggers, booking code generation (SNF-YYYYMMDD-NNN), rate plan-based pricing
  - pricing: Rate plans CRUD (admin-only create/update/delete), day type (WEEKDAY/WEEKEND/ALL), priority-based
  - billing: Folio CRUD, payments (CASH/UPI/CARD/RAZORPAY/BANK_TRANSFER), payment summary with balance, GST invoice generation (6%+6% or 9%+9% based on tariff <=7500), invoice numbering (SNF-INV-FYFY-NNNNN)
  - reports: dashboard KPIs (occupancy, revenue, arrivals/departures, room status), occupancy/revenue/food-sales/guest-analytics reports
  - notifications: test webhook endpoint (POST to n8n)
  - users: Staff CRUD (admin-only), create/list/get/update/deactivate, bcrypt password hashing

## Backend Architecture (Created: 2026-06-02)

### 13 Modules (migrating to FastAPI routers/services)
- **auth**: JWT login/refresh + RBAC (Admin/Receptionist) via python-jose
- **users**: Staff CRUD (admin only)
- **rooms**: Room types CRUD + room inventory + status board + availability check
- **guests**: CRM with ID upload (Aadhaar/PAN/Passport/DL/Voter) to MinIO, search, birthday query
- **bookings**: Full lifecycle (confirm->checkin->checkout), calendar data, auto folio creation, conflict detection
- **pricing**: Rate plans (seasonal/weekday/weekend), priority-based price calculation per night
- **billing**: Folio tracking, payments, GST invoicing (6%+6% or 9%+9% based on tariff), invoice generation
- **restaurant**: Menu CRUD, food orders (room service/dine-in/walk-in), kitchen display, auto folio integration
- **housekeeping**: Room status board, task CRUD, auto-create cleaning task on checkout
- **activities**: Activity catalog + booking with capacity check, auto folio integration
- **reports**: Dashboard KPIs, occupancy/revenue/food-sales/guest-analytics reports
- **notifications**: n8n webhook triggers on booking events (confirmed/checkin/checkout/cancelled)
- **prisma**: Global PrismaService wrapping PrismaClient

### Prisma Schema: 16 models, 13 enums
Key models: User, RoomType, Room, Guest, Booking, RatePlan, Payment, Invoice, FolioItem, MenuItem, FoodOrder, FoodOrderItem, HousekeepingTask, Activity, ActivityBooking

### Seed Data
- Admin: admin@srinamo.com / admin123
- Receptionist: reception@srinamo.com / reception123
- 4 room types: Deluxe (12), Premium Suite (8), Farm Stay Cottage (10), Family Room (10) = 40 rooms
- 22 Indian cuisine menu items across 5 categories
- 4 activities: Farm Tour, Bonfire Night, Nature Walk, Cooking Class
- 12 sample guests (Indian names, with phone/email/ID/city)
- 16 bookings: 4 CHECKED_IN (one per room type), 8 CONFIRMED (today/tomorrow/this week), 4 CHECKED_OUT (past history)

### n8n Workflows (5 templates in n8n/workflows/)
- booking-confirmation.json, checkin-reminder.json, checkout-thankyou.json, birthday-wishes.json, promotional-offers.json

## Frontend Architecture (Created: 2026-06-02)

### Stack
- React 19, TypeScript 5.7, Vite 6, Tailwind CSS 3.4
- State: Zustand (auth), TanStack Query (server state)
- Forms: react-hook-form + zod validation
- UI: Custom shadcn-style components built on Radix primitives
- Charts: Recharts
- Routing: Custom hash-based (window.history + popstate events)
- API: Axios with JWT interceptor

### File Structure
```
frontend/src/
├── hooks/ (9 files - ALL fully implemented)
│   ├── useAuth.ts: useLogin, useCurrentUser, useLogout
│   ├── useRooms.ts: useRoomTypes, useRooms, useRoomStatusBoard, useAvailableRooms, CRUD
│   ├── useGuests.ts: useGuests, useGuest, useCreateGuest, useUpdateGuest, useSearchGuests
│   ├── useBookings.ts: useBookings, useBooking, useCreateBooking, useUpdateBookingStatus, useCalendarData
│   ├── useBilling.ts: useFolio, useAddFolioItem, usePayments, useRecordPayment, usePaymentSummary, useGenerateInvoice
│   ├── useRestaurant.ts: useMenuItems, useMenuCategories, CRUD, useOrders, useKitchenOrders(10s refresh)
│   ├── useHousekeeping.ts: useHousekeepingBoard, useHousekeepingTasks, useCreateTask, useUpdateTask
│   ├── useActivities.ts: useActivities, useCreateActivity, useUpdateActivity, useActivityBookings, useBookActivity
│   └── useReports.ts: useDashboard, useOccupancyReport, useRevenueReport, useFoodSalesReport, useGuestAnalytics
├── components/layout/ (header.tsx, app-layout.tsx - routing + lazy loading)
└── pages/ (15 page files - ALL fully implemented)
    ├── login.tsx, dashboard.tsx, calendar.tsx, rooms.tsx
    ├── bookings/ (index.tsx, new.tsx, detail.tsx)
    ├── guests/ (index.tsx, detail.tsx)
    ├── restaurant/ (index.tsx, kitchen.tsx)
    ├── housekeeping.tsx, activities.tsx, reports.tsx, settings.tsx
```

### Design System
- Brand: Emerald/green theme (bg-emerald-950 sidebar, emerald-600 primary)
- Layout: Dark sidebar + white content area
- Status colors: Emerald=Available/Confirmed, Blue=Occupied/CheckedIn, Red=Maintenance, Yellow=Cleaning, Purple=Inspected, Gray=Cancelled/NoShow

### Key Pages
- **Dashboard**: KPI cards + Recharts (occupancy line, revenue bar) + arrival/departure tables
- **Bookings**: List with filters + New booking form (guest search + room selection) + Detail with folio/payments
- **Calendar**: Custom grid-based booking calendar (rooms as rows, dates as columns)
- **Restaurant POS**: Menu grid + cart sidebar + order placement + kitchen display (3-column Kanban)
- **Housekeeping**: Color-coded room board + task management
- **Billing**: Folio items by category + payments + invoice generation (GST/Simple)
- **Reports**: Tabbed (Overview, Occupancy, Revenue, Food Sales, Guest Analytics) with Recharts
- **Settings**: Resort info, room types, rate plans, menu items, staff management

### API Endpoints Expected
All via /api proxy to backend:3000
- /auth/login, /auth/me, /auth/logout
- /rooms, /rooms/available, /room-types
- /guests, /guests/search, /guests/:id/bookings
- /bookings, /bookings/calendar, /bookings/:id/status, /bookings/:id/folio, /bookings/:id/payments, /bookings/:id/invoices
- /menu-items, /food-orders
- /housekeeping
- /activities, /activity-bookings
- /reports/dashboard, /reports/occupancy, /reports/revenue
- /settings/resort-info, /users, /rate-plans

### Prisma Query Fix (2026-06-02)
- Fixed invalid nested `select` inside `include` across all router files
- Prisma Client Python does NOT support `{"select": {...}}` inside `include` - must use `True`
- Prisma Client Python does NOT support `select=` kwarg in `find_many()` - use `find_many()` and access attrs in code
- Fixed files: rooms.py, room_types.py, reports.py, bookings.py, restaurant.py, housekeeping.py, activities.py, guests.py, pricing.py, users.py
- room_types.py: replaced `_count` with manual count via `include={"rooms": True}` + `len(rt.rooms)`
- reports.py: replaced `aggregate`/`group_by` (not supported) with `find_many` + manual Python aggregation
- main.py: added `PrismaJSONResponse` as default_response_class to handle Decimal/datetime serialization
- billing.py: was already valid (no nested select inside include)
- All 19 GET endpoints verified 200 OK

### Types Fix (2026-06-03)
- Created `frontend/src/types/index.ts` — was completely missing, crashing entire app on load
- Exported all 16 type aliases (enums), 20+ interfaces matching Prisma schema models
- Types: User, Room, RoomType, Guest, Booking, Payment, Invoice, FolioItem, MenuItem, FoodOrder, HousekeepingTask, Activity, ActivityBooking, RatePlan + request/response types
- Moved `navigate()` from `App.tsx` to `lib/navigate.ts` to break circular dependency (App→login→App)
- Updated 13 files importing `navigate` from `@/App` to `@/lib/navigate`
- Sign-in page now loads, logout dropdown in header works

### Dashboard roomStatusCounts Fix (2026-06-03)
- Backend `reports.py` returned `roomStatusCounts` as a dict `{"AVAILABLE": 20, ...}` but frontend `dashboard.tsx` called `.map()` expecting an array
- Fixed backend to return `[{"status": "AVAILABLE", "count": 20}, ...]` array format
- Root cause: Python dict is not iterable via `.map()` in JS

### Calendar & Restaurant Fix (2026-06-03)
- Calendar: backend returned grouped dict `{roomId: [bookings]}`, frontend expected flat array — fixed to return `bookings` directly
- Restaurant menu: backend returned `{"items": [...], "grouped": {...}}`, frontend expected plain `MenuItem[]` — fixed to return `items` directly
- Header: added "Switch User" dropdown option to swap between Admin/Receptionist without closing app

### ORM Migration: Prisma Client Python -> SQLAlchemy 2.0 Async (2026-06-03)
- **Why**: Prisma Client Python lacked aggregate/group_by, select inside include, transactions, raw SQL; community-maintained (not official)
- **New Stack**: SQLAlchemy 2.0 async + asyncpg driver + Alembic migrations
- **Files Changed**: database.py, main.py, dependencies.py, all 13 routers, seed.py
- **New Files**: app/models.py (15 SQLAlchemy models + 13 enums), app/serialize.py (row_to_dict helper), alembic/ (migration setup)
- **Key Improvements**:
  - Reports: SQL `func.sum()`, `func.count()`, `GROUP BY` for revenue/room-status/city-distribution (was: fetch-all + Python loop)
  - Connection pooling: asyncpg pool_size=10, max_overflow=20 (was: single Prisma engine)
  - Session-per-request via FastAPI `Depends(get_db)` (was: global singleton)
  - JSONB native for amenities/images (was: `Json()` wrapper)
  - Proper Decimal handling without experimental flag
  - Alembic ready for future schema migrations
- **Unchanged**: Frontend, API response shapes, schema.prisma (kept as reference), all endpoint URLs
- **Removed**: `prisma` from requirements, `PrismaJSONResponse` (renamed to `AppJSONResponse`)
- **Tested**: health, login, rooms, room-types, guests, menu, activities, dashboard -- all 72 routes loaded OK

### Receptionist Role Restrictions (2026-06-03)
- Hidden from Receptionist login: Reports page (sidebar + route), Revenue Today card on dashboard, Occupancy/Revenue charts on dashboard
- Sidebar: `adminOnly: true` added to Reports nav item
- Dashboard: Revenue card + charts wrapped in `{isAdmin && ...}` conditional
- App Layout: `adminOnlyRoutes` array blocks `/reports` for non-ADMIN, redirects to `/dashboard`
- Hooks: `useOccupancyReport` and `useRevenueReport` accept `enabled` param — skips API calls for receptionist

### Booking Detail Fixes (2026-06-03)
- `useCancelBooking` missing from `useBookings.ts` — added (calls `PATCH /bookings/:id/status` with `CANCELLED`)
- `useFolioItems` missing from `useBilling.ts` — added as alias for `useFolio`
- `app-layout.tsx` was not passing `bookingId`/`guestId` props extracted from URL path to detail page components — fixed with `pageProps` extraction
- Route type changed to `React.ComponentType<any>` to support props on lazy-loaded pages

### Performance
- Lazy-loaded pages via React.lazy + Suspense
- TanStack Query with 30s staleTime, auto-refetch off
- Dashboard auto-refreshes every 60s
- Kitchen display auto-refreshes every 10s
- Skeleton loading states on all pages
- SQLAlchemy asyncpg connection pool (pool_size=10, max_overflow=20)
- SQL-level aggregations in reports (no more fetch-all-then-count in Python)

### PMS Core Enhancements (2026-06-03)

#### Phase 1: Check-In Workflow Dialog
- **New model**: `BookingGuest` (id, bookingId, guestName, idType, idNumber, idDocumentUrl, createdAt) — tracks companions per booking
- **Booking model**: added `actualAdults`, `actualChildren` (nullable) — populated at check-in time
- **Upload router**: `POST /api/upload/id-document` — saves files to `backend/uploads/id-documents/`, serves via FastAPI StaticFiles at `/uploads/`
- **Check-in endpoint enhanced**: `PATCH /api/bookings/:id/status` now accepts `actualAdults`, `actualChildren`, `primaryIdDocumentUrl`, `companions[]` when status=CHECKED_IN
- **Frontend check-in dialog**: Opens on "Check In" click — collects guest count, primary ID file upload (required), optional companion names + ID uploads
- **Guest details section**: Shows actual guest count + companion list with ID doc links after check-in
- **Alembic migration**: `001_checkin_enhancements.py` — adds columns + BookingGuest table
- **Vite proxy**: `/uploads` proxied to backend:3000

#### Phase 2: Payment & Balance Improvements
- **Payment model**: added `paymentType` (nullable string: ADVANCE/PARTIAL/FINAL/REFUND)
- **Booking list**: added `paidAmount` calculation via batch SQL query, shows Paid/Partial/Unpaid badge
- **Checkout warning**: if balance > 0, shows dialog with "Settle Balance" or "Proceed Anyway" options
- **Billing API**: `POST /api/billing/payments` accepts optional `paymentType` field

#### Phase 3: Booking & Guest Edit
- **PUT /api/bookings/:id**: Edit dates, room, adults, children, specialRequests (CONFIRMED only), recalculates price on date/room change, validates room conflicts
- **Guest edit UI**: Edit dialog on guest detail page (name, phone, email, ID, address, city, state, notes) via existing `PATCH /api/guests/:id`
- **Guest update**: Added `idDocumentUrl` to `UpdateGuestRequest` schema
- **Frontend hooks**: `useUpdateBooking` added to useBookings.ts, `useGuestBookings` added to useGuests.ts

#### Phase 4: Logout/Switch User Polish
- **Header**: "Switch User" now shows target role label ("Switch to Receptionist" / "Switch to Admin"), navigates to `/login?switch=<role>`
- **Login page**: Auto-fills credentials for target role when `?switch=` query param present
- **Logout**: Unchanged — clears tokens, navigates to clean `/login`

#### Files Changed
- Backend: models.py, main.py, routers/bookings.py, routers/billing.py, routers/guests.py, routers/upload.py (new), alembic/versions/001_checkin_enhancements.py (new)
- Frontend: types/index.ts, hooks/useBookings.ts, hooks/useGuests.ts, pages/bookings/[id].tsx, pages/bookings/index.tsx, pages/guests/[id].tsx, components/layout/header.tsx, pages/login.tsx, vite.config.ts
