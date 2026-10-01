from datetime import datetime, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Room, Booking, Payment, FolioItem, FoodOrder, FoodOrderItem, MenuItem, Guest
from app.dependencies import get_current_user, require_admin
from app.serialize import row_to_dict

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/dashboard")
async def get_dashboard(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    total_rooms_q = await db.execute(select(func.count()).select_from(Room))
    total_rooms = total_rooms_q.scalar()

    occupied_rooms_q = await db.execute(select(func.count()).select_from(Room).where(Room.status == "OCCUPIED"))
    occupied_rooms = occupied_rooms_q.scalar()

    bookings_today_q = await db.execute(
        select(func.count()).select_from(Booking).where(Booking.checkIn >= today, Booking.checkIn < tomorrow, Booking.deletedAt.is_(None))
    )
    bookings_today = bookings_today_q.scalar()

    pending_checkins_q = await db.execute(
        select(func.count()).select_from(Booking).where(
            Booking.checkIn >= today, Booking.checkIn < tomorrow, Booking.status == "CONFIRMED", Booking.deletedAt.is_(None)
        )
    )
    pending_checkins = pending_checkins_q.scalar()

    # Revenue via SQL SUM
    async def _sum_revenue(start, end) -> float:
        q = await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.status == "COMPLETED", Payment.paidAt >= start, Payment.paidAt < end
            )
        )
        return float(q.scalar())

    revenue_today = await _sum_revenue(today, tomorrow)
    revenue_week = await _sum_revenue(week_start, tomorrow)
    revenue_month = await _sum_revenue(month_start, tomorrow)

    arrivals_q = await db.execute(
        select(Booking).options(selectinload(Booking.guest), selectinload(Booking.room).selectinload(Room.roomType))
        .where(Booking.checkIn >= today, Booking.checkIn < tomorrow, Booking.status.in_(["CONFIRMED", "CHECKED_IN"]), Booking.deletedAt.is_(None))
        .order_by(Booking.checkIn.asc())
    )
    departures_q = await db.execute(
        select(Booking).options(selectinload(Booking.guest), selectinload(Booking.room).selectinload(Room.roomType))
        .where(Booking.checkOut >= today, Booking.checkOut < tomorrow, Booking.status == "CHECKED_IN", Booking.deletedAt.is_(None))
        .order_by(Booking.checkOut.asc())
    )

    # Room status counts via SQL GROUP BY
    status_q = await db.execute(select(Room.status, func.count()).group_by(Room.status))
    room_status_counts = [{"status": row[0], "count": row[1]} for row in status_q.all()]

    recent_q = await db.execute(
        select(Booking).options(selectinload(Booking.guest), selectinload(Booking.room))
        .where(Booking.deletedAt.is_(None))
        .order_by(Booking.createdAt.desc()).limit(5)
    )

    occupancy_rate = round((occupied_rooms / total_rooms) * 100, 2) if total_rooms > 0 else 0

    return {
        "occupancyRate": occupancy_rate,
        "bookingsToday": bookings_today,
        "revenueToday": revenue_today,
        "revenueWeek": revenue_week,
        "revenueMonth": revenue_month,
        "pendingCheckIns": pending_checkins,
        "todayArrivals": [row_to_dict(b, rels={"guest", "room"}) for b in arrivals_q.scalars().all()],
        "todayDepartures": [row_to_dict(b, rels={"guest", "room"}) for b in departures_q.scalars().all()],
        "roomStatusCounts": room_status_counts,
        "recentBookings": [row_to_dict(b, rels={"guest", "room"}) for b in recent_q.scalars().all()],
    }


@router.get("/occupancy", dependencies=[Depends(require_admin)])
async def get_occupancy(from_date: str = Query(..., alias="from"), to_date: str = Query(..., alias="to"), db: AsyncSession = Depends(get_db)):
    total_rooms_q = await db.execute(select(func.count()).select_from(Room))
    total_rooms = total_rooms_q.scalar()
    f = datetime.fromisoformat(from_date)
    t = datetime.fromisoformat(to_date)
    result = []
    current = f
    while current <= t:
        day_start = current.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = current.replace(hour=23, minute=59, second=59, microsecond=999999)
        occ_q = await db.execute(
            select(func.count()).select_from(Booking).where(
                Booking.checkIn <= day_end, Booking.checkOut > day_start,
                Booking.status.in_(["CHECKED_IN", "CHECKED_OUT"]), Booking.deletedAt.is_(None)
            )
        )
        occupied = occ_q.scalar()
        occ = round((occupied / total_rooms) * 100, 2) if total_rooms > 0 else 0
        result.append({"date": day_start.strftime("%Y-%m-%d"), "occupancy": occ, "occupiedRooms": occupied})
        current += timedelta(days=1)
    return {"totalRooms": total_rooms, "data": result}


@router.get("/revenue", dependencies=[Depends(require_admin)])
async def get_revenue(from_date: str = Query(..., alias="from"), to_date: str = Query(..., alias="to"), db: AsyncSession = Depends(get_db)):
    f = datetime.fromisoformat(from_date)
    t = datetime.fromisoformat(to_date)
    items_q = await db.execute(
        select(FolioItem).where(FolioItem.createdAt >= f, FolioItem.createdAt <= t).order_by(FolioItem.createdAt.asc())
    )
    items = items_q.scalars().all()

    daily_map: dict = {}
    category_totals: dict = {}
    for item in items:
        date_key = item.createdAt.strftime("%Y-%m-%d")
        line_total = float(Decimal(str(item.amount)) * item.quantity)
        if date_key not in daily_map:
            daily_map[date_key] = {}
        daily_map[date_key][item.category] = daily_map[date_key].get(item.category, 0) + line_total
        category_totals[item.category] = category_totals.get(item.category, 0) + line_total

    data = [{"date": k, **v} for k, v in sorted(daily_map.items())]
    grand_total = sum(category_totals.values())
    return {"data": data, "categoryTotals": category_totals, "grandTotal": grand_total}


@router.get("/food-sales", dependencies=[Depends(require_admin)])
async def get_food_sales(from_date: str = Query(..., alias="from"), to_date: str = Query(..., alias="to"), db: AsyncSession = Depends(get_db)):
    f = datetime.fromisoformat(from_date)
    t = datetime.fromisoformat(to_date)
    orders_q = await db.execute(
        select(FoodOrder)
        .options(selectinload(FoodOrder.items).selectinload(FoodOrderItem.menuItem))
        .where(FoodOrder.createdAt >= f, FoodOrder.createdAt <= t)
    )
    orders = orders_q.scalars().all()

    menu_sales: dict = {}
    for order in orders:
        for item in order.items:
            key = item.menuItemId
            if key not in menu_sales:
                menu_sales[key] = {"name": item.menuItem.name, "category": item.menuItem.category, "quantity": 0, "revenue": 0}
            menu_sales[key]["quantity"] += item.quantity
            menu_sales[key]["revenue"] += float(Decimal(str(item.unitPrice)) * item.quantity)

    top_items = sorted(menu_sales.values(), key=lambda x: x["quantity"], reverse=True)

    category_totals: dict = {}
    for item in top_items:
        cat = item["category"]
        if cat not in category_totals:
            category_totals[cat] = {"quantity": 0, "revenue": 0}
        category_totals[cat]["quantity"] += item["quantity"]
        category_totals[cat]["revenue"] += item["revenue"]

    return {"topItems": top_items, "categoryTotals": category_totals, "orderCount": len(orders)}


@router.get("/guest-analytics", dependencies=[Depends(require_admin)])
async def get_guest_analytics(db: AsyncSession = Depends(get_db)):
    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_q = await db.execute(select(func.count()).select_from(Guest).where(Guest.deletedAt.is_(None)))
    total_guests = total_q.scalar()

    new_q = await db.execute(select(func.count()).select_from(Guest).where(Guest.createdAt >= month_start, Guest.deletedAt.is_(None)))
    new_this_month = new_q.scalar()

    repeat_q = await db.execute(select(func.count()).select_from(Guest).where(Guest.totalStays > 1, Guest.deletedAt.is_(None)))
    repeat_guests = repeat_q.scalar()

    top_q = await db.execute(
        select(Guest).where(Guest.deletedAt.is_(None)).order_by(Guest.totalSpent.desc()).limit(10)
    )
    top_by_spent = [
        {"firstName": g.firstName, "lastName": g.lastName, "phone": g.phone, "totalStays": g.totalStays, "totalSpent": float(g.totalSpent) if g.totalSpent else 0}
        for g in top_q.scalars().all()
    ]

    # City distribution via SQL GROUP BY
    city_q = await db.execute(
        select(Guest.city, func.count().label("cnt"))
        .where(Guest.deletedAt.is_(None), Guest.city.isnot(None))
        .group_by(Guest.city)
        .order_by(func.count().desc())
        .limit(15)
    )
    city_distribution = [{"city": row[0], "count": row[1]} for row in city_q.all()]

    return {
        "totalGuests": total_guests,
        "newGuestsThisMonth": new_this_month,
        "repeatGuests": repeat_guests,
        "topBySpent": top_by_spent,
        "cityDistribution": city_distribution,
    }


@router.get("/scoreboard", dependencies=[Depends(require_admin)])
async def get_scoreboard(db: AsyncSession = Depends(get_db)):
    from app.models import Commission, Lead, MessageOutbox
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=7)
    total_rooms = (await db.execute(select(func.count()).select_from(Room))).scalar() or 1

    async def _occ(start, end):
        q = await db.execute(
            select(func.count()).select_from(Booking).where(
                Booking.checkIn < end,
                Booking.checkOut > start,
                Booking.status.in_(["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"]),
                Booking.deletedAt.is_(None),
            )
        )
        return round((q.scalar() / total_rooms) * 100, 1)

    weekday_occ = []
    weekend_occ = []
    day = week_start
    while day < week_end:
        rate = await _occ(day, day + timedelta(days=1))
        if day.weekday() >= 5:
            weekend_occ.append(rate)
        else:
            weekday_occ.append(rate)
        day += timedelta(days=1)

    leads_q = await db.execute(select(Lead).where(Lead.createdAt >= week_start))
    leads = leads_q.scalars().all()
    won = sum(1 for l in leads if (l.stage.value if hasattr(l.stage, "value") else l.stage) == "WON")
    failed = (await db.execute(select(func.count()).select_from(MessageOutbox).where(MessageOutbox.status == "FAILED"))).scalar()
    due = (await db.execute(
        select(func.coalesce(func.sum(Commission.amount), 0)).where(Commission.status == "DUE")
    )).scalar()

    return {
        "weekdayOccupancy": round(sum(weekday_occ) / len(weekday_occ), 1) if weekday_occ else 0,
        "weekendOccupancy": round(sum(weekend_occ) / len(weekend_occ), 1) if weekend_occ else 0,
        "leadsThisWeek": len(leads),
        "leadsWon": won,
        "leadWinRate": round((won / len(leads)) * 100, 1) if leads else 0,
        "outboxFailed": failed,
        "commissionsDue": float(due or 0),
        "weekStart": week_start.strftime("%Y-%m-%d"),
    }
