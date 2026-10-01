from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Optional
from pydantic import BaseModel
from enum import Enum
from sqlalchemy import select, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import MenuItem, FoodOrder, FoodOrderItem, FolioItem
from app.dependencies import get_current_user, require_admin
from app.serialize import row_to_dict


class OrderType(str, Enum):
    ROOM_SERVICE = "ROOM_SERVICE"
    DINE_IN = "DINE_IN"
    WALK_IN = "WALK_IN"


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    PREPARING = "PREPARING"
    READY = "READY"
    SERVED = "SERVED"
    CANCELLED = "CANCELLED"


class CreateMenuItemRequest(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    price: float
    isVeg: bool
    isAvailable: bool = True
    sortOrder: int = 0


class OrderItemRequest(BaseModel):
    menuItemId: str
    quantity: int
    notes: Optional[str] = None


class CreateOrderRequest(BaseModel):
    bookingId: Optional[str] = None
    guestId: Optional[str] = None
    orderType: OrderType
    items: list[OrderItemRequest]
    notes: Optional[str] = None


router = APIRouter(prefix="/api/restaurant", tags=["Restaurant"])


@router.post("/menu", dependencies=[Depends(require_admin)])
async def create_menu_item(body: CreateMenuItemRequest, db: AsyncSession = Depends(get_db)):
    item = MenuItem(**body.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return row_to_dict(item)


@router.get("/menu")
async def get_menu_items(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MenuItem).order_by(MenuItem.category.asc(), MenuItem.sortOrder.asc()))
    return [row_to_dict(i, rels=set()) for i in result.scalars().all()]


@router.get("/menu/categories")
async def get_menu_categories(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(distinct(MenuItem.category)).where(MenuItem.isAvailable == True).order_by(MenuItem.category.asc())
    )
    return [row[0] for row in result.all()]


@router.patch("/menu/{id}", dependencies=[Depends(require_admin)])
async def update_menu_item(id: str, body: CreateMenuItemRequest, db: AsyncSession = Depends(get_db)):
    item = await db.get(MenuItem, id)
    if not item:
        raise HTTPException(404, "Menu item not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return row_to_dict(item, rels=set())


@router.delete("/menu/{id}", dependencies=[Depends(require_admin)])
async def delete_menu_item(id: str, db: AsyncSession = Depends(get_db)):
    item = await db.get(MenuItem, id)
    if not item:
        raise HTTPException(404, "Menu item not found")
    item.isAvailable = False
    await db.commit()
    await db.refresh(item)
    return row_to_dict(item, rels=set())


@router.post("/orders")
async def create_order(body: CreateOrderRequest, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    menu_item_ids = [i.menuItemId for i in body.items]
    result = await db.execute(select(MenuItem).where(MenuItem.id.in_(menu_item_ids)))
    menu_items = {m.id: m for m in result.scalars().all()}

    total = Decimal("0")
    order_items_data = []
    for item in body.items:
        mi = menu_items.get(item.menuItemId)
        if not mi:
            raise HTTPException(404, f"Menu item {item.menuItemId} not found")
        unit_price = Decimal(str(mi.price))
        total += unit_price * item.quantity
        order_items_data.append({"menuItemId": item.menuItemId, "quantity": item.quantity, "unitPrice": unit_price, "notes": item.notes})

    order = FoodOrder(
        bookingId=body.bookingId,
        guestId=body.guestId,
        orderType=body.orderType,
        totalAmount=total,
        notes=body.notes,
    )
    db.add(order)
    await db.flush()

    for oi in order_items_data:
        db.add(FoodOrderItem(orderId=order.id, **oi))

    await db.commit()
    await db.refresh(order)

    if body.bookingId:
        folio = FolioItem(
            bookingId=body.bookingId,
            description=f"Food Order #{order.id[:8]}",
            category="FOOD",
            amount=float(total),
            quantity=1,
        )
        db.add(folio)
        await db.commit()

    full = await db.execute(
        select(FoodOrder).options(selectinload(FoodOrder.items).selectinload(FoodOrderItem.menuItem)).where(FoodOrder.id == order.id)
    )
    return row_to_dict(full.scalar_one(), rels={"items"})


@router.get("/orders")
async def get_orders(status: Optional[str] = None, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(FoodOrder).options(
        selectinload(FoodOrder.items).selectinload(FoodOrderItem.menuItem),
        selectinload(FoodOrder.guest),
        selectinload(FoodOrder.booking),
    )
    if status:
        stmt = stmt.where(FoodOrder.status == status)
    stmt = stmt.order_by(FoodOrder.createdAt.desc()).limit(50)
    result = await db.execute(stmt)
    return [row_to_dict(o, rels={"items", "guest", "booking"}) for o in result.scalars().all()]


@router.get("/orders/kitchen")
async def get_kitchen_orders(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(FoodOrder)
        .options(selectinload(FoodOrder.items).selectinload(FoodOrderItem.menuItem), selectinload(FoodOrder.booking))
        .where(FoodOrder.status.in_(["PENDING", "PREPARING"]))
        .order_by(FoodOrder.createdAt.asc())
    )
    return [row_to_dict(o, rels={"items", "booking"}) for o in result.scalars().all()]


@router.get("/orders/{id}")
async def get_order(id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(FoodOrder)
        .options(selectinload(FoodOrder.items).selectinload(FoodOrderItem.menuItem), selectinload(FoodOrder.guest), selectinload(FoodOrder.booking))
        .where(FoodOrder.id == id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")
    return row_to_dict(order, rels={"items", "guest", "booking"})


@router.patch("/orders/{id}/status")
async def update_order_status(id: str, status: str = Body(..., embed=True), user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    order = await db.get(FoodOrder, id)
    if not order:
        raise HTTPException(404, "Order not found")
    order.status = status
    await db.commit()

    result = await db.execute(
        select(FoodOrder).options(selectinload(FoodOrder.items).selectinload(FoodOrderItem.menuItem)).where(FoodOrder.id == id)
    )
    return row_to_dict(result.scalar_one(), rels={"items"})
