import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ActivityBookingStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { BookActivityDto } from './dto/book-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async createActivity(dto: CreateActivityDto) {
    return this.prisma.activity.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        maxParticipants: dto.maxParticipants,
        duration: dto.duration,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async getActivities() {
    return this.prisma.activity.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async updateActivity(id: string, dto: Partial<CreateActivityDto>) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('Activity not found');
    return this.prisma.activity.update({ where: { id }, data: dto });
  }

  async deleteActivity(id: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('Activity not found');
    return this.prisma.activity.update({ where: { id }, data: { isActive: false } });
  }

  async bookActivity(dto: BookActivityDto) {
    const activity = await this.prisma.activity.findUnique({ where: { id: dto.activityId } });
    if (!activity) throw new NotFoundException('Activity not found');
    if (!activity.isActive) throw new BadRequestException('Activity is not available');

    const guest = await this.prisma.guest.findUnique({ where: { id: dto.guestId } });
    if (!guest) throw new NotFoundException('Guest not found');

    const scheduledDate = new Date(dto.scheduledDate);
    const startOfDay = new Date(scheduledDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(scheduledDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingBookings = await this.prisma.activityBooking.findMany({
      where: {
        activityId: dto.activityId,
        scheduledDate: { gte: startOfDay, lte: endOfDay },
        status: ActivityBookingStatus.CONFIRMED,
      },
    });

    const totalBooked = existingBookings.reduce((sum, b) => sum + b.participants, 0);
    if (totalBooked + dto.participants > activity.maxParticipants) {
      throw new BadRequestException(
        `Capacity exceeded. Available spots: ${activity.maxParticipants - totalBooked}`,
      );
    }

    const activityBooking = await this.prisma.activityBooking.create({
      data: {
        activityId: dto.activityId,
        guestId: dto.guestId,
        bookingId: dto.bookingId || null,
        scheduledDate,
        participants: dto.participants,
        notes: dto.notes,
      },
      include: { activity: true, guest: { select: { firstName: true, lastName: true } } },
    });

    if (dto.bookingId) {
      const totalCost = new Decimal(activity.price.toString()).mul(dto.participants);
      await this.prisma.folioItem.create({
        data: {
          bookingId: dto.bookingId,
          description: `${activity.name} (x${dto.participants})`,
          category: 'ACTIVITY',
          amount: totalCost,
          quantity: 1,
        },
      });
    }

    return activityBooking;
  }

  async getActivityBookings(activityId?: string, guestId?: string, status?: ActivityBookingStatus) {
    const where: Record<string, unknown> = {};
    if (activityId) where.activityId = activityId;
    if (guestId) where.guestId = guestId;
    if (status) where.status = status;

    return this.prisma.activityBooking.findMany({
      where,
      include: {
        activity: { select: { name: true, price: true } },
        guest: { select: { firstName: true, lastName: true, phone: true } },
        booking: { select: { bookingCode: true } },
      },
      orderBy: { scheduledDate: 'desc' },
    });
  }

  async updateActivityBookingStatus(id: string, status: ActivityBookingStatus) {
    const booking = await this.prisma.activityBooking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Activity booking not found');

    return this.prisma.activityBooking.update({
      where: { id },
      data: { status },
      include: { activity: true, guest: { select: { firstName: true, lastName: true } } },
    });
  }
}
