import asyncio
import bcrypt
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import selectinload

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.config import get_settings
from app.models import (
    Base, User, RoomType, Room, RoomStatus, MenuItem, Activity,
    Guest, Booking, Partner, DayPackage, Amenity,
)
from app.services.phone import normalize_phone

# Public business numbers from company websites / listings. First 5 are the desk sheet.
PARTNERS = [
    {"name": "V Wedding Planner", "phone": "9444759920", "type": "PLANNER", "firm": "V Wedding Planner", "location": "Sunguvarchatram", "tier": "Local", "email": "vweddingplanner2@gmail.com", "rate": 10, "notes": "Desk sheet. Event planner. Alt 8668193456. Branches Ambattur / Kanchipuram."},
    {"name": "Chennai Corporate Events", "phone": "9841435108", "type": "PLANNER", "firm": "Chennai Event Management Service", "location": "Anna Nagar", "tier": "National", "email": "info@chennaieventmanagementservice.com", "rate": 10, "notes": "Desk sheet. Event planner."},
    {"name": "EPIX Entertainment", "phone": "9884316816", "type": "CORPORATE", "firm": "Epix Entertainment", "location": "Guindy", "tier": "Chennai", "email": "marketing@epixentertainment.com", "rate": 10, "notes": "Desk sheet. Corporate planner. Ramapuram / Guindy."},
    {"name": "DA Events", "phone": "9884055199", "type": "PLANNER", "firm": "DA Eventz", "location": "Ashok Nagar", "tier": "Chennai", "email": "punithan@daeventz.com", "rate": 10, "notes": "Desk sheet. Event planner. Also corporate work across Guindy / Sriperumbudur."},
    {"name": "Aramm Events", "phone": "9884522335", "type": "CORPORATE", "firm": "Aramm Events", "location": "Thiruverkadu", "tier": "Chennai", "email": "selvaraj@arammevents.com", "rate": 10, "notes": "Desk sheet. Corporate planner. Office Velappanchavadi / Poonamallee High Road."},
    {"name": "Oh Yes Events", "phone": "8939759966", "type": "PLANNER", "firm": "Oh Yes Events", "location": "Chromepet", "tier": "National", "email": "info@ohyesevents.com", "rate": 10, "notes": "Wedding + corporate. Also Bangalore / UAE. Alt 9003521140."},
    {"name": "Aaha Decor Events", "phone": "7897444744", "type": "DECORATOR", "firm": "Aaha Decor Events", "location": "Chennai", "tier": "Chennai", "email": "info@aahadecorevents.com", "rate": 8, "notes": "Decor + wedding / corporate coordination."},
    {"name": "Aki Event Management", "phone": "9344395663", "type": "PLANNER", "firm": "Aki Event Management", "location": "Royapuram", "tier": "Chennai", "email": "akieventmanagement@gmail.com", "rate": 10, "notes": "Wedding planners. WhatsApp alt 9363505663."},
    {"name": "OM Events", "phone": "8939174777", "type": "CORPORATE", "firm": "OM Events", "location": "Madipakkam", "tier": "Chennai", "email": "events@omeventschennai.com", "rate": 10, "notes": "Corporate-only. Offsites / conferences."},
    {"name": "Inemai", "phone": "9445668787", "type": "PLANNER", "firm": "Inemai", "location": "Porur", "tier": "Local", "email": "mail@inemai.com", "rate": 10, "notes": "West Chennai / Sriperumbudur / Kanchipuram coverage."},
    {"name": "Aalam Event", "phone": "9095250984", "type": "PLANNER", "firm": "Aalam Event", "location": "Guindy", "tier": "Chennai", "email": None, "rate": 10, "notes": "Wedding + corporate. SIDCO Guindy."},
    {"name": "Scube Corporate Solutions", "phone": "9500009232", "type": "CORPORATE", "firm": "Scube Corporate Solutions", "location": "Ambattur", "tier": "Chennai", "email": None, "rate": 10, "notes": "Corporate events / exhibits. VGN Oval Garden."},
    {"name": "Saviour Progress", "phone": "9677823971", "type": "CORPORATE", "firm": "Saviour Progress", "location": "Porur", "tier": "Local", "email": "saviourprogress@gmail.com", "rate": 10, "notes": "Corporate. Also Sriperumbudur office. Alt 9677823998."},
    {"name": "Lumea Eventz", "phone": "6381309270", "type": "PLANNER", "firm": "Lumea Eventz", "location": "Tambaram West", "tier": "Chennai", "email": "lumeaeventz@gmail.com", "rate": 10, "notes": "Wedding + corporate. Tambaram belt."},
    {"name": "Hosanna Decors & Events", "phone": "9840788001", "type": "DECORATOR", "firm": "Hosanna Decors & Events", "location": "Nandambakkam", "tier": "Chennai", "email": "hosannadecorations07@gmail.com", "rate": 8, "notes": "Decor + exhibitions opp. Chennai Trade Centre. Alt 9884883718."},
    {"name": "Pranaya Weddings", "phone": "9841079573", "type": "PLANNER", "firm": "Pranaya", "location": "Kottivakkam", "tier": "National", "email": "sriram.kalyanasundaram@gmail.com", "rate": 10, "notes": "Luxury wedding planner. Also Pondicherry / Mysore."},
    {"name": "Kanaiyaazhi Weddings", "phone": "9344943161", "type": "PLANNER", "firm": "Kanaiyaazhi Weddings", "location": "Arumbakkam", "tier": "Chennai", "email": "kanaiyazhi01@gmail.com", "rate": 10, "notes": "Full-service wedding planner. Alt 9629148371."},
    {"name": "The Wingmen Events", "phone": "8939894099", "type": "PLANNER", "firm": "The Wingmen", "location": "Adyar", "tier": "Chennai", "email": "info@thewingmen.events", "rate": 10, "notes": "Wedding + corporate + social."},
    {"name": "Dvine Event Management", "phone": "9884442619", "type": "PLANNER", "firm": "Dvine Event Management", "location": "Anna Nagar", "tier": "Chennai", "email": None, "rate": 10, "notes": "W126 3rd Avenue Anna Nagar."},
    {"name": "Tinderbox Events", "phone": "9940099227", "type": "CORPORATE", "firm": "Tinderbox Events", "location": "Adyar", "tier": "Chennai", "email": None, "rate": 10, "notes": "Corporate / launches / roadshows. Landline 044-43504717."},
    {"name": "Porur GK Studio", "phone": "9840368958", "type": "PHOTOGRAPHER", "firm": "GK Studio", "location": "Porur", "tier": "Local", "email": "gopigkstudio@gmail.com", "rate": 8, "notes": "Wedding photography. Alt 9176885553. Offer sunrise pre-wedding slot."},
    {"name": "SM Digital Studio", "phone": "9444679054", "type": "PHOTOGRAPHER", "firm": "SM Digital Studio", "location": "Poonamallee", "tier": "Local", "email": None, "rate": 8, "notes": "Local west-Chennai studio. Pre-wedding / wedding coverage."},
    {"name": "Sri Jaya Studio", "phone": "9962156699", "type": "PHOTOGRAPHER", "firm": "Sri Jaya Studio", "location": "Porur", "tier": "Local", "email": None, "instagram": None, "rate": 8, "notes": "Mt Poonamallee Road. Alt 9789022880."},
    {"name": "Together App", "phone": None, "type": "INFLUENCER", "firm": "togetherapp.in", "location": "Chennai", "tier": "Chennai", "email": None, "instagram": "togetherapp.in", "rate": 0, "notes": "Reached out. Ready to post about Srinamo Farms. 21K followers. Stranger meetup dinners. Invite for a farm collab / hosted table."},
    {"name": "Chennaites", "phone": None, "type": "INFLUENCER", "firm": "Explore Chennai page", "location": "Chennai", "tier": "Chennai", "email": None, "instagram": "chennaites", "rate": 0, "notes": "Reached out. Ready to post about Srinamo Farms. 213K followers. City showcase / explore Chennai. Invite for a feature."},
    {"name": "Unseen Chennai", "phone": None, "type": "INFLUENCER", "firm": "Explore Chennai page", "location": "Chennai", "tier": "National", "email": None, "instagram": "unseenchennai", "rate": 0, "notes": "Reached out. Ready to post about Srinamo Farms. 618K followers. City showcase. Invite for a farm feature."},
    {"name": "Things2Do In Chennai", "phone": None, "type": "INFLUENCER", "firm": "Explore Chennai page", "location": "Chennai", "tier": "Chennai", "email": None, "instagram": "things2doinchennai", "rate": 0, "notes": "Reached out. Ready to post about Srinamo Farms. 343K followers. Things to do / stay / food in Chennai. Invite for a listing + Reels."},
    {"name": "Wanderlust Prachi", "phone": None, "type": "INFLUENCER", "firm": "Staycation influencer", "location": "Chennai", "tier": "Chennai", "email": None, "instagram": "wanderlost_prachi", "rate": 0, "notes": "Reached out. Ready to post about Srinamo Farms. 55K followers. Staycation / travel creator (IG @wanderlost_prachi). Hosted stay invite."},
    {"name": "Foodtalk Chennai", "phone": None, "type": "INFLUENCER", "firm": "Marwari foodie", "location": "Chennai", "tier": "Chennai", "email": None, "instagram": "foodtalk_chennai", "rate": 0, "notes": "Reached out. Ready to post about Srinamo Farms. 130K followers. Veg / Marwari food influencer. Hosted thali + farm Reels invite."},
]


async def _replace_rooms(db: AsyncSession, room_type_data: list, real_numbers: list[str]) -> None:
    """Drop sample rooms that are not on the property list, then upsert the real rooms."""
    placeholders = ", ".join(f":n{i}" for i in range(len(real_numbers)))
    params = {f"n{i}": n for i, n in enumerate(real_numbers)}
    not_in = f'NOT IN ({placeholders})'

    booking_ids = f'''
        SELECT b.id FROM "Booking" b
        JOIN "Room" r ON r.id = b."roomId"
        WHERE r."roomNumber" {not_in}
    '''
    room_ids = f'SELECT id FROM "Room" WHERE "roomNumber" {not_in}'

    await db.execute(text(f'''
        DELETE FROM "FoodOrderItem"
        WHERE "orderId" IN (
            SELECT fo.id FROM "FoodOrder" fo
            WHERE fo."bookingId" IN ({booking_ids})
        )
    '''), params)
    for table, column in (
        ("FoodOrder", "bookingId"),
        ("ActivityBooking", "bookingId"),
        ("BookingGuest", "bookingId"),
        ("Commission", "bookingId"),
        ("FolioItem", "bookingId"),
        ("Invoice", "bookingId"),
        ("Payment", "bookingId"),
    ):
        await db.execute(text(f'DELETE FROM "{table}" WHERE "{column}" IN ({booking_ids})'), params)
    await db.execute(text(f'UPDATE "Lead" SET "convertedBookingId" = NULL WHERE "convertedBookingId" IN ({booking_ids})'), params)
    await db.execute(text(f'DELETE FROM "Booking" WHERE "roomId" IN ({room_ids})'), params)
    await db.execute(text(f'DELETE FROM "HousekeepingTask" WHERE "roomId" IN ({room_ids})'), params)
    await db.execute(text(f'DELETE FROM "InventoryBlock" WHERE "roomId" IN ({room_ids})'), params)
    await db.execute(text(f'DELETE FROM "Room" WHERE "roomNumber" {not_in}'), params)
    await db.commit()

    for rt_data in room_type_data:
        existing = await db.execute(select(RoomType).where(RoomType.name == rt_data["name"]))
        rt = existing.scalar_one_or_none()
        if not rt:
            rt = RoomType(
                name=rt_data["name"],
                description=rt_data["description"],
                maxOccupancy=rt_data["maxOccupancy"],
                basePrice=Decimal(str(rt_data["basePrice"])),
                amenities=rt_data["amenities"],
                images=[],
            )
            db.add(rt)
            await db.flush()
        else:
            rt.description = rt_data["description"]
            rt.maxOccupancy = rt_data["maxOccupancy"]
            rt.basePrice = Decimal(str(rt_data["basePrice"]))
            rt.amenities = rt_data["amenities"]

        for room_number, floor in rt_data["rooms"]:
            ex_room = await db.execute(select(Room).where(Room.roomNumber == room_number))
            room = ex_room.scalar_one_or_none()
            if room:
                room.roomTypeId = rt.id
                room.floor = floor
            else:
                db.add(Room(roomTypeId=rt.id, roomNumber=room_number, floor=floor, status=RoomStatus.AVAILABLE))
    await db.commit()

    await db.execute(text('''
        DELETE FROM "RatePlan"
        WHERE "roomTypeId" IN (
            SELECT t.id FROM "RoomType" t
            WHERE NOT EXISTS (SELECT 1 FROM "Room" r WHERE r."roomTypeId" = t.id)
        )
    '''))
    await db.execute(text('''
        DELETE FROM "RoomType" t
        WHERE NOT EXISTS (SELECT 1 FROM "Room" r WHERE r."roomTypeId" = t.id)
    '''))
    await db.commit()
    print(f"  Rooms: {len(real_numbers)} real rooms saved")


async def _seed_day_rates(db: AsyncSession) -> None:
    packages = [
        ("10:00 to 17:00", 2200, "10:00", "17:00", "Lunch and hi-tea. All amenities except auditorium, cricket turf and steam bath.", 1),
        ("07:30 to 17:00", 2600, "07:30", "17:00", "Breakfast, lunch and hi-tea. All amenities except auditorium, cricket turf and steam bath.", 2),
        ("10:00 to 21:30", 2900, "10:00", "21:30", "Lunch, hi-tea and dinner. All amenities except auditorium, cricket turf and steam bath.", 3),
        ("07:30 to 21:30", 3100, "07:30", "21:30", "Breakfast, lunch, hi-tea and dinner. All amenities except auditorium, cricket turf and steam bath.", 4),
    ]
    for name, price, start, end, includes, order in packages:
        existing = await db.execute(select(DayPackage).where(DayPackage.name == name))
        row = existing.scalar_one_or_none()
        if row:
            row.pricePerPerson = Decimal(price)
            row.startsAt = start
            row.endsAt = end
            row.includes = includes
            row.sortOrder = order
            row.isActive = True
        else:
            db.add(DayPackage(
                name=name, pricePerPerson=Decimal(price), startsAt=start, endsAt=end,
                includes=includes, sortOrder=order, isActive=True,
            ))

    amenities = [
        ("Swimming pool, pool volleyball and jacuzzi", "Kids and adults", 0, "FLAT", True),
        ("Rain dance", None, 0, "FLAT", True),
        ("Children's play area", None, 0, "FLAT", True),
        ("Cycling for kids", None, 0, "FLAT", True),
        ("Volleyball and badminton court", None, 0, "FLAT", True),
        ("Indoor games", "Table tennis, chess, carrom, fuseball and board games", 0, "FLAT", True),
        ("Pergola sitting", None, 0, "FLAT", True),
        ("Selfie corner", None, 0, "FLAT", True),
        ("Terrace garden", None, 0, "FLAT", True),
        ("Bonfire", None, 0, "FLAT", True),
        ("Open air theatre", None, 0, "FLAT", True),
        ("Jain food", None, 0, "FLAT", True),
        ("Gaushala", None, 0, "FLAT", True),
        ("Auditorium", "3 hours", 25000, "FLAT", False),
        ("Cricket turf before 5pm", "2 hours", 3000, "FLAT", False),
        ("Cricket turf from 5pm", "2 hours", 5000, "FLAT", False),
        ("Steam bath", "15 minutes. About 50 people at a time.", 150, "PER_PERSON", False),
        ("Extra bedding", "35 to 40 extra beds are available.", 0, "FLAT", False),
    ]
    for name, description, price, charge, included in amenities:
        existing = await db.execute(select(Amenity).where(Amenity.name == name))
        row = existing.scalar_one_or_none()
        if row:
            row.description = description
            row.price = Decimal(price)
            row.chargeType = charge
            row.included = included
            row.isActive = True
        else:
            db.add(Amenity(
                name=name, description=description, price=Decimal(price),
                chargeType=charge, included=included, isActive=True,
            ))
    await db.commit()
    print("  Day packages and amenities saved")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


async def main():
    settings = get_settings()
    db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(db_url)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as db:
        admin_hash = hash_password("admin123")
        reception_hash = hash_password("reception123")

        # Users
        for email, name, role, pw_hash in [
            ("admin@srinamo.com", "Admin", "ADMIN", admin_hash),
            ("reception@srinamo.com", "Receptionist", "RECEPTIONIST", reception_hash),
        ]:
            existing = await db.execute(select(User).where(User.email == email))
            if not existing.scalar_one_or_none():
                db.add(User(name=name, email=email, passwordHash=pw_hash, role=role, isActive=True))
        await db.commit()

        await db.execute(text('ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS location VARCHAR'))
        await db.execute(text('ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS tier VARCHAR'))
        await db.execute(text('ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS instagram VARCHAR'))
        await db.commit()
        await db.execute(text("ALTER TYPE \"PartnerType\" ADD VALUE IF NOT EXISTS 'INFLUENCER'"))
        await db.commit()

        added_partners = 0
        for p in PARTNERS:
            phone = normalize_phone(p["phone"]) if p.get("phone") else None
            if phone:
                existing = await db.execute(select(Partner).where(Partner.phone == phone))
                if existing.scalar_one_or_none():
                    continue
            by_name = await db.execute(select(Partner).where(Partner.name == p["name"]))
            if by_name.scalar_one_or_none():
                continue
            ig = (p.get("instagram") or "").strip().lstrip("@") or None
            if ig:
                by_ig = await db.execute(select(Partner).where(Partner.instagram == ig))
                if by_ig.scalar_one_or_none():
                    continue
            db.add(Partner(
                name=p["name"],
                type=p["type"],
                phone=phone,
                email=p["email"],
                firm=p["firm"],
                location=p["location"],
                tier=p["tier"],
                instagram=ig,
                commissionRate=Decimal(str(p["rate"])),
                notes=p["notes"],
                isActive=True,
            ))
            added_partners += 1
        await db.commit()
        print(f"  Partners: {added_partners} new / {len(PARTNERS)} in seed list")

        # 5 deluxe rooms sleep 4. Three family suites sleep 12, 10 and 8.
        room_type_data = [
            {
                "name": "Family suite · 10 guests",
                "description": "Room 0111. 6 single beds, 1 double bed, 2 sofa cum beds",
                "maxOccupancy": 10,
                "basePrice": 0,
                "amenities": ["6 single beds", "1 double bed", "2 sofa cum beds"],
                "rooms": [("0111", 1)],
            },
            {
                "name": "Family suite · 12 guests",
                "description": "Room 0112. 6 single beds, 3 sofa cum beds",
                "maxOccupancy": 12,
                "basePrice": 0,
                "amenities": ["6 single beds", "3 sofa cum beds"],
                "rooms": [("0112", 1)],
            },
            {
                "name": "Family suite · 8 guests",
                "description": "Room 0011. 2 double beds, 4 sofa cum beds",
                "maxOccupancy": 8,
                "basePrice": 0,
                "amenities": ["2 double beds", "4 sofa cum beds"],
                "rooms": [("0011", 0)],
            },
            {
                "name": "Deluxe · 4 guests",
                "description": "2 double beds, 1 sofa cum bed",
                "maxOccupancy": 4,
                "basePrice": 0,
                "amenities": ["2 double beds", "1 sofa cum bed"],
                "rooms": [("0022", 0), ("0033", 0), ("0044", 0), ("0055", 0), ("0066", 0)],
            },
        ]
        real_numbers = [num for rt in room_type_data for num, _floor in rt["rooms"]]
        await _replace_rooms(db, room_type_data, real_numbers)
        await _seed_day_rates(db)

        # Menu Items
        menu_count_q = await db.execute(select(MenuItem.id).limit(1))
        if not menu_count_q.scalar_one_or_none():
            menu_categories = [
                ("Starters", [("Paneer Tikka", 280, True, "Marinated cottage cheese grilled in tandoor"), ("Chicken 65", 320, False, "Spicy deep-fried chicken"), ("Veg Manchurian", 240, True, "Indo-Chinese vegetable balls in tangy sauce"), ("Fish Fry", 350, False, "Crispy fried fish with masala coating")]),
                ("Main Course", [("Butter Chicken", 380, False, "Tender chicken in rich tomato-butter gravy"), ("Paneer Butter Masala", 320, True, "Cottage cheese in creamy tomato gravy"), ("Dal Makhani", 260, True, "Black lentils slow-cooked with butter and cream"), ("Mutton Biryani", 420, False, "Fragrant basmati rice layered with spiced mutton"), ("Veg Biryani", 280, True, "Aromatic rice with seasonal vegetables"), ("Chicken Curry", 340, False, "Traditional home-style chicken curry")]),
                ("Breads", [("Butter Naan", 60, True, None), ("Garlic Naan", 70, True, None), ("Tandoori Roti", 40, True, None), ("Paratha", 80, True, None)]),
                ("Beverages", [("Masala Chai", 50, True, "Traditional Indian spiced tea"), ("Filter Coffee", 60, True, "South Indian style filter coffee"), ("Fresh Lime Soda", 80, True, None), ("Mango Lassi", 120, True, "Creamy yogurt drink with mango pulp"), ("Buttermilk", 60, True, "Spiced traditional chaas")]),
                ("Desserts", [("Gulab Jamun", 100, True, "Deep-fried milk solids soaked in sugar syrup"), ("Rasmalai", 120, True, "Soft paneer dumplings in saffron milk"), ("Ice Cream", 90, True, "Choice of vanilla, chocolate, or butterscotch")]),
            ]
            sort_order = 0
            for category, items in menu_categories:
                for name, price, is_veg, desc in items:
                    sort_order += 1
                    db.add(MenuItem(name=name, category=category, description=desc, price=price, isVeg=is_veg, isAvailable=True, sortOrder=sort_order))
            await db.commit()

        # Activities
        act_count_q = await db.execute(select(Activity.id).limit(1))
        if not act_count_q.scalar_one_or_none():
            for a in [
                {"name": "Farm Tour", "description": "Guided tour of the organic farm with hands-on farming experience", "price": 500, "maxParticipants": 20, "duration": "2 hours"},
                {"name": "Bonfire Night", "description": "Evening bonfire with live music and barbecue", "price": 800, "maxParticipants": 30, "duration": "3 hours"},
                {"name": "Nature Walk", "description": "Early morning nature walk through forest trails", "price": 300, "maxParticipants": 15, "duration": "1.5 hours"},
                {"name": "Cooking Class", "description": "Learn to cook traditional regional dishes with our chef", "price": 1200, "maxParticipants": 10, "duration": "2.5 hours"},
            ]:
                db.add(Activity(**a))
            await db.commit()

        # Sample Guests & Bookings
        guest_count_q = await db.execute(select(Guest.id).limit(1))
        if not guest_count_q.scalar_one_or_none():
            today = datetime.now().replace(hour=12, minute=0, second=0, microsecond=0)

            guests_data = [
                {"firstName": "Rajesh",   "lastName": "Kumar",    "phone": "9876543210", "email": "rajesh.kumar@gmail.com",  "city": "Hyderabad", "state": "Telangana",    "idType": "AADHAAR",         "idNumber": "1234-5678-9012"},
                {"firstName": "Priya",    "lastName": "Sharma",   "phone": "9876543211", "email": "priya.sharma@gmail.com",  "city": "Bangalore", "state": "Karnataka",    "idType": "PAN",             "idNumber": "ABCDE1234F"},
                {"firstName": "Amit",     "lastName": "Patel",    "phone": "9876543212", "email": "amit.patel@gmail.com",    "city": "Mumbai",    "state": "Maharashtra",  "idType": "DRIVING_LICENSE", "idNumber": "MH0120230001"},
                {"firstName": "Sneha",    "lastName": "Reddy",    "phone": "9876543213", "email": "sneha.reddy@gmail.com",   "city": "Chennai",   "state": "Tamil Nadu",   "idType": "AADHAAR",         "idNumber": "9876-5432-1098"},
                {"firstName": "Vikram",   "lastName": "Singh",    "phone": "9876543214", "email": "vikram.singh@gmail.com",  "city": "Delhi",     "state": "Delhi",        "idType": "PASSPORT",        "idNumber": "J8765432"},
                {"firstName": "Ananya",   "lastName": "Nair",     "phone": "9876543215", "email": "ananya.nair@gmail.com",   "city": "Kochi",     "state": "Kerala",       "idType": "VOTER_ID",        "idNumber": "KER1234567"},
                {"firstName": "Suresh",   "lastName": "Rao",      "phone": "9876543216", "email": "suresh.rao@gmail.com",    "city": "Pune",      "state": "Maharashtra",  "idType": "AADHAAR",         "idNumber": "5555-6666-7777"},
                {"firstName": "Meera",    "lastName": "Joshi",    "phone": "9876543217", "email": "meera.joshi@gmail.com",   "city": "Jaipur",    "state": "Rajasthan",    "idType": "PAN",             "idNumber": "FGHIJ5678K"},
                {"firstName": "Karthik",  "lastName": "Menon",    "phone": "9876543218", "email": "karthik.menon@gmail.com", "city": "Trivandrum","state": "Kerala",       "idType": "AADHAAR",         "idNumber": "1111-2222-3333"},
                {"firstName": "Divya",    "lastName": "Gupta",    "phone": "9876543219", "email": "divya.gupta@gmail.com",   "city": "Lucknow",   "state": "Uttar Pradesh","idType": "DRIVING_LICENSE", "idNumber": "UP3220240005"},
                {"firstName": "Arjun",    "lastName": "Deshmukh", "phone": "9876543220", "email": "arjun.d@gmail.com",       "city": "Nagpur",    "state": "Maharashtra",  "idType": "AADHAAR",         "idNumber": "4444-3333-2222"},
                {"firstName": "Lakshmi",  "lastName": "Iyer",     "phone": "9876543221", "email": "lakshmi.iyer@gmail.com",  "city": "Coimbatore","state": "Tamil Nadu",   "idType": "PAN",             "idNumber": "LMNOP9012Q"},
            ]

            created_guests = []
            for g in guests_data:
                guest = Guest(**g)
                db.add(guest)
                await db.flush()
                created_guests.append(guest)
            await db.commit()

            rooms_q = await db.execute(
                select(Room).options(selectinload(Room.roomType)).order_by(Room.roomNumber.asc())
            )
            all_rooms = rooms_q.scalars().all()
            rooms_by_type: dict = {}
            for r in all_rooms:
                tname = r.roomType.name if r.roomType else "Unknown"
                rooms_by_type.setdefault(tname, []).append(r)

            booking_counter = 0
            bookings_plan = [
                (0,  "6 Single + 1 Double + 2 Sofa", 0,  -2, 4, "CHECKED_IN", 2, 0, "PHONE"),
                (1,  "6 Single + 3 Sofa",            0,  -1, 3, "CHECKED_IN", 2, 1, "ONLINE"),
                (2,  "2 Double + 4 Sofa",            0,  -3, 5, "CHECKED_IN", 2, 0, "WALK_IN"),
                (3,  "2 Double + 1 Sofa",            0,  -1, 4, "CHECKED_IN", 2, 2, "PHONE"),
                (4,  "2 Double + 1 Sofa",            1,   0, 3, "CONFIRMED",  1, 0, "ONLINE"),
                (5,  "2 Double + 1 Sofa",            2,   1, 2, "CONFIRMED",  2, 0, "OTA"),
                (6,  "2 Double + 1 Sofa",            3,   0, 4, "CONFIRMED",  2, 1, "PHONE"),
                (7,  "2 Double + 1 Sofa",            4,   1, 3, "CONFIRMED",  2, 1, "WALK_IN"),
                (8,  "6 Single + 1 Double + 2 Sofa", 0,   8, 2, "CONFIRMED",  2, 0, "ONLINE"),
                (9,  "6 Single + 3 Sofa",            0,   9, 3, "CONFIRMED",  2, 1, "OTA"),
                (10, "2 Double + 4 Sofa",            0,  10, 2, "CONFIRMED",  1, 0, "PHONE"),
                (11, "2 Double + 1 Sofa",            0,  12, 4, "CONFIRMED",  2, 1, "ONLINE"),
                (0,  "2 Double + 1 Sofa",            1, -10, 3, "CHECKED_OUT",2, 0, "WALK_IN"),
                (1,  "2 Double + 1 Sofa",            2,  -8, 2, "CHECKED_OUT",2, 1, "PHONE"),
                (4,  "2 Double + 4 Sofa",            0, -20, 4, "CHECKED_OUT",1, 0, "ONLINE"),
                (7,  "6 Single + 3 Sofa",            0, -18, 3, "CHECKED_OUT",2, 1, "OTA"),
            ]

            for guest_idx, room_type_name, room_idx, offset, nights, status, adults, children, source in bookings_plan:
                guest = created_guests[guest_idx]
                type_rooms = rooms_by_type.get(room_type_name, [])
                if room_idx >= len(type_rooms):
                    continue
                room = type_rooms[room_idx]
                base_price = float(room.roomType.basePrice) if room.roomType else 4500
                total = base_price * nights

                check_in = today + timedelta(days=offset)
                check_out = check_in + timedelta(days=nights)
                booking_counter += 1
                code = f"SNF-{today.strftime('%Y%m%d')}-{booking_counter:03d}"

                db.add(Booking(
                    bookingCode=code, guestId=guest.id, roomId=room.id,
                    checkIn=check_in, checkOut=check_out,
                    adults=adults, children=children,
                    status=status, source=source,
                    totalAmount=Decimal(str(total)),
                ))

                if status == "CHECKED_IN":
                    room.status = "OCCUPIED"

                if status == "CHECKED_OUT":
                    guest.totalStays = (guest.totalStays or 0) + 1
                    guest.totalSpent = Decimal(str(float(guest.totalSpent or 0) + total))

            await db.commit()
            print(f"  Created {len(created_guests)} guests, {booking_counter} bookings")

    print("Seed completed successfully")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
