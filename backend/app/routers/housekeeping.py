from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from enum import Enum
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import HousekeepingTask, Room
from app.dependencies import get_current_user
from app.serialize import row_to_dict


class HousekeepingTaskTypeEnum(str, Enum):
    CLEANING = "CLEANING"
    INSPECTION = "INSPECTION"
    MAINTENANCE = "MAINTENANCE"


class TaskStatusEnum(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class CreateTaskRequest(BaseModel):
    roomId: str
    taskType: HousekeepingTaskTypeEnum
    assignedTo: Optional[str] = None
    notes: Optional[str] = None


class UpdateTaskRequest(BaseModel):
    status: Optional[TaskStatusEnum] = None
    assignedTo: Optional[str] = None
    notes: Optional[str] = None


router = APIRouter(prefix="/api/housekeeping", tags=["Housekeeping"])


@router.post("/tasks")
async def create_task(body: CreateTaskRequest, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    room = await db.get(Room, body.roomId)
    if not room:
        raise HTTPException(404, "Room not found")
    task = HousekeepingTask(roomId=body.roomId, taskType=body.taskType, assignedTo=body.assignedTo, notes=body.notes)
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return row_to_dict(task, rels={"room"})


@router.get("/tasks")
async def get_tasks(status: Optional[str] = None, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(HousekeepingTask).options(selectinload(HousekeepingTask.room))
    if status:
        stmt = stmt.where(HousekeepingTask.status == status)
    stmt = stmt.order_by(HousekeepingTask.createdAt.desc())
    result = await db.execute(stmt)
    return [row_to_dict(t, rels={"room"}) for t in result.scalars().all()]


@router.patch("/tasks/{id}")
async def update_task(id: str, body: UpdateTaskRequest, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = await db.get(HousekeepingTask, id)
    if not task:
        raise HTTPException(404, "Task not found")

    if body.status is not None:
        task.status = body.status
    if body.assignedTo is not None:
        task.assignedTo = body.assignedTo
    if body.notes is not None:
        task.notes = body.notes

    if body.status == "COMPLETED":
        from datetime import datetime
        task.completedAt = datetime.now()

    await db.commit()
    await db.refresh(task)

    if body.status == "COMPLETED" and task.taskType == "CLEANING":
        room = await db.get(Room, task.roomId)
        if room:
            room.status = "INSPECTED"
            await db.commit()

    return row_to_dict(task, rels={"room"})


@router.get("/board")
async def get_board(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Room)
        .options(selectinload(Room.roomType), selectinload(Room.housekeepingTasks))
        .order_by(Room.floor.asc(), Room.roomNumber.asc())
    )
    rooms = result.scalars().all()
    return [
        {
            "id": r.id,
            "roomNumber": r.roomNumber,
            "floor": r.floor,
            "roomType": r.roomType.name if r.roomType else None,
            "status": r.status,
            "pendingTasks": len([t for t in r.housekeepingTasks if t.status in ("PENDING", "IN_PROGRESS")]),
            "tasks": [row_to_dict(t, rels=set()) for t in r.housekeepingTasks if t.status in ("PENDING", "IN_PROGRESS")],
        }
        for r in rooms
    ]
