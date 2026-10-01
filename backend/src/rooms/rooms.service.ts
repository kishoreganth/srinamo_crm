import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { CreateRoomDto } from './dto/create-room.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRoomType(dto: CreateRoomTypeDto) {
    return this.prisma.roomType.create({ data: dto });
  }

  async getRoomTypes() {
    return this.prisma.roomType.findMany({
      include: { _count: { select: { rooms: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async updateRoomType(id: string, dto: Partial<CreateRoomTypeDto>) {
    const existing = await this.prisma.roomType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Room type not found');
    return this.prisma.roomType.update({ where: { id }, data: dto });
  }

  async deleteRoomType(id: string) {
    const rooms = await this.prisma.room.count({ where: { roomTypeId: id } });
    if (rooms > 0) throw new ConflictException('Cannot delete room type with existing rooms');
    return this.prisma.roomType.delete({ where: { id } });
  }

  async createRoom(dto: CreateRoomDto) {
    const existing = await this.prisma.room.findUnique({ where: { roomNumber: dto.roomNumber } });
    if (existing) throw new ConflictException('Room number already exists');
    return this.prisma.room.create({
      data: dto,
      include: { roomType: true },
    });
  }

  async getRooms() {
    return this.prisma.room.findMany({
      include: { roomType: { select: { id: true, name: true, basePrice: true, maxOccupancy: true } } },
      orderBy: { roomNumber: 'asc' },
    });
  }

  async getRoomsByType(roomTypeId: string) {
    return this.prisma.room.findMany({
      where: { roomTypeId },
      include: { roomType: true },
      orderBy: { roomNumber: 'asc' },
    });
  }

  async updateRoomStatus(id: string, status: RoomStatus) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');
    return this.prisma.room.update({ where: { id }, data: { status } });
  }

  async getAvailableRooms(checkIn: Date, checkOut: Date, roomTypeId?: string) {
    const bookedRoomIds = await this.prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { roomId: true },
    });

    const bookedIds = bookedRoomIds.map((b) => b.roomId);

    const where: Record<string, unknown> = {
      id: { notIn: bookedIds },
      status: { in: [RoomStatus.AVAILABLE, RoomStatus.INSPECTED] },
    };

    if (roomTypeId) {
      where.roomTypeId = roomTypeId;
    }

    return this.prisma.room.findMany({
      where,
      include: { roomType: true },
      orderBy: { roomNumber: 'asc' },
    });
  }

  async getRoomStatusBoard() {
    const rooms = await this.prisma.room.findMany({
      include: {
        roomType: { select: { name: true } },
        bookings: {
          where: {
            status: 'CHECKED_IN',
          },
          include: { guest: { select: { firstName: true, lastName: true } } },
          take: 1,
        },
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
    });

    return rooms.map((room) => ({
      id: room.id,
      roomNumber: room.roomNumber,
      floor: room.floor,
      status: room.status,
      roomType: room.roomType.name,
      currentGuest: room.bookings[0]?.guest
        ? `${room.bookings[0].guest.firstName} ${room.bookings[0].guest.lastName}`
        : null,
    }));
  }
}
