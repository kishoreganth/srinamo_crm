import { Injectable, NotFoundException } from '@nestjs/common';
import { HousekeepingTaskType, RoomStatus, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class HousekeepingService {
  constructor(private readonly prisma: PrismaService) {}

  async createTask(dto: CreateTaskDto) {
    const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
    if (!room) throw new NotFoundException('Room not found');

    return this.prisma.housekeepingTask.create({
      data: {
        roomId: dto.roomId,
        taskType: dto.taskType,
        assignedTo: dto.assignedTo,
        notes: dto.notes,
      },
      include: { room: { select: { roomNumber: true, floor: true } } },
    });
  }

  async getTasks(status?: TaskStatus, taskType?: HousekeepingTaskType, roomId?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (taskType) where.taskType = taskType;
    if (roomId) where.roomId = roomId;

    return this.prisma.housekeepingTask.findMany({
      where,
      include: { room: { select: { roomNumber: true, floor: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTask(id: string, dto: UpdateTaskDto) {
    const task = await this.prisma.housekeepingTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    const data: Record<string, unknown> = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo;
    if (dto.notes !== undefined) data.notes = dto.notes;

    if (dto.status === TaskStatus.COMPLETED) {
      data.completedAt = new Date();
    }

    const updated = await this.prisma.housekeepingTask.update({
      where: { id },
      data,
      include: { room: { select: { id: true, roomNumber: true } } },
    });

    if (dto.status === TaskStatus.COMPLETED && task.taskType === HousekeepingTaskType.CLEANING) {
      await this.prisma.room.update({
        where: { id: task.roomId },
        data: { status: RoomStatus.INSPECTED },
      });
    }

    return updated;
  }

  async getRoomStatusBoard() {
    const rooms = await this.prisma.room.findMany({
      include: {
        roomType: { select: { name: true } },
        housekeepingTasks: {
          where: { status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } },
          select: { id: true, taskType: true, status: true, assignedTo: true },
        },
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
    });

    return rooms.map((room) => ({
      id: room.id,
      roomNumber: room.roomNumber,
      floor: room.floor,
      roomType: room.roomType.name,
      status: room.status,
      pendingTasks: room.housekeepingTasks.length,
      tasks: room.housekeepingTasks,
    }));
  }

  async autoCreateCleaningTask(roomId: string) {
    await this.prisma.room.update({
      where: { id: roomId },
      data: { status: RoomStatus.CLEANING },
    });

    return this.prisma.housekeepingTask.create({
      data: {
        roomId,
        taskType: HousekeepingTaskType.CLEANING,
        status: TaskStatus.PENDING,
      },
    });
  }
}
