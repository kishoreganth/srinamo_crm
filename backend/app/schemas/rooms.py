from pydantic import BaseModel
from typing import Optional
from enum import Enum


class RoomStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    OCCUPIED = "OCCUPIED"
    MAINTENANCE = "MAINTENANCE"
    CLEANING = "CLEANING"
    INSPECTED = "INSPECTED"


class CreateRoomTypeRequest(BaseModel):
    name: str
    description: Optional[str] = None
    maxOccupancy: int
    basePrice: float
    amenities: Optional[list] = []
    images: Optional[list] = []


class CreateRoomRequest(BaseModel):
    roomTypeId: str
    roomNumber: str
    floor: int


class UpdateRoomStatusRequest(BaseModel):
    status: RoomStatus
