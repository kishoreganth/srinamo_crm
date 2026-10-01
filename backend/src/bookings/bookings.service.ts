import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { BookingStatus, RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HousekeepingService } from '../housekeeping/housekeeping.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingFilterDto } from './dto/booking-filter.dto';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly notificationsService: NotificationsService,
    private readonly housekeepingService: HousekeepingService,
  ) {}

  async createBooking(dto: CreateBookingDto) {
    const checkIn = new Date(dto.checkIn);
    const checkOut = new Date(dto.checkOut);

    if (checkIn >= checkOut) {
      throw new BadRequestException('Check-out must be after check-in');
    }

    const room = await this.prisma.room.findUnique({ where: { id: dto.roomId }, include: { roomType: true } });
    if (!room) throw new NotFoundException('Room not found');

    const conflicting = await this.prisma.booking.findFirst({
      where: {
        roomId: dto.roomId,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    });

    if (conflicting) {
      throw new ConflictException('Room is not available for the selected dates');
    }

    const totalAmount = await this.pricingService.calculatePrice(room.roomTypeId, checkIn, checkOut);
    const bookingCode = await this.generateBookingCode();

    const booking = await this.prisma.booking.create({
      data: {
        bookingCode,
        guestId: dto.guestId,
        roomId: dto.roomId,
        checkIn,
        checkOut,
        adults: dto.adults || 1,
        children: dto.children || 0,
        status: BookingStatus.CONFIRMED,
        source: dto.source || 'WALK_IN',
        totalAmount,
        specialRequests: dto.specialRequests,
      },
      include: { guest: true, room: { include: { roomType: true } } },
    });

    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    await this.prisma.folioItem.create({
      data: {
        bookingId: booking.id,
        description: `Room Charges - ${room.roomType.name} (${nights} night${nights > 1 ? 's' : ''})`,
        category: 'ROOM',
        amount: totalAmount,
        quantity: 1,
      },
    });

    await this.notificationsService.triggerWebhook('booking.confirmed', booking);

    return booking;
  }

  async getBookings(filters: BookingFilterDto) {
    const where: Record<string, unknown> = { deletedAt: null };

    if (filters.status) where.status = filters.status;
    if (filters.guestId) where.guestId = filters.guestId;
    if (filters.from && filters.to) {
      where.checkIn = { gte: new Date(filters.from) };
      where.checkOut = { lte: new Date(filters.to) };
    }

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          guest: { select: { firstName: true, lastName: true, phone: true } },
          room: { include: { roomType: { select: { name: true } } } },
        },
        skip: filters.skip,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data,
      meta: { total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) },
    };
  }

  async getBookingById(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        guest: true,
        room: { include: { roomType: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        folioItems: { orderBy: { createdAt: 'desc' } },
        foodOrders: { include: { items: { include: { menuItem: true } } } },
        activityBookings: { include: { activity: true } },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async updateBookingStatus(id: string, status: BookingStatus) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { room: true },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    this.validateStatusTransition(booking.status, status);

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status },
      include: { guest: true, room: { include: { roomType: true } } },
    });

    if (status === BookingStatus.CHECKED_IN) {
      await this.prisma.room.update({
        where: { id: booking.roomId },
        data: { status: RoomStatus.OCCUPIED },
      });
      await this.notificationsService.triggerWebhook('booking.checkin', updated);
    }

    if (status === BookingStatus.CHECKED_OUT) {
      await this.prisma.room.update({
        where: { id: booking.roomId },
        data: { status: RoomStatus.CLEANING },
      });
      await this.housekeepingService.autoCreateCleaningTask(booking.roomId);
      await this.prisma.guest.update({
        where: { id: booking.guestId },
        data: { totalStays: { increment: 1 } },
      });
      await this.notificationsService.triggerWebhook('booking.checkout', updated);
    }

    if (status === BookingStatus.CANCELLED) {
      await this.prisma.room.update({
        where: { id: booking.roomId },
        data: { status: RoomStatus.AVAILABLE },
      });
      await this.notificationsService.triggerWebhook('booking.cancelled', updated);
    }

    return updated;
  }

  async getCalendarData(from: Date, to: Date) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        checkIn: { lte: to },
        checkOut: { gte: from },
      },
      include: {
        guest: { select: { firstName: true, lastName: true } },
        room: { select: { id: true, roomNumber: true } },
      },
      orderBy: { checkIn: 'asc' },
    });

    const grouped: Record<string, typeof bookings> = {};
    for (const booking of bookings) {
      const roomId = booking.room.id;
      if (!grouped[roomId]) grouped[roomId] = [];
      grouped[roomId].push(booking);
    }

    return grouped;
  }

  async getTodayBookings() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [arrivals, departures] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          checkIn: { gte: today, lt: tomorrow },
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        },
        include: {
          guest: { select: { firstName: true, lastName: true, phone: true } },
          room: { include: { roomType: { select: { name: true } } } },
        },
        orderBy: { checkIn: 'asc' },
      }),
      this.prisma.booking.findMany({
        where: {
          checkOut: { gte: today, lt: tomorrow },
          status: 'CHECKED_IN',
        },
        include: {
          guest: { select: { firstName: true, lastName: true, phone: true } },
          room: { include: { roomType: { select: { name: true } } } },
        },
        orderBy: { checkOut: 'asc' },
      }),
    ]);

    return { arrivals, departures };
  }

  private validateStatusTransition(current: BookingStatus, next: BookingStatus) {
    const allowed: Record<BookingStatus, BookingStatus[]> = {
      CONFIRMED: [BookingStatus.CHECKED_IN, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
      CHECKED_IN: [BookingStatus.CHECKED_OUT],
      CHECKED_OUT: [],
      CANCELLED: [],
      NO_SHOW: [],
    };

    if (!allowed[current]?.includes(next)) {
      throw new BadRequestException(`Cannot transition from ${current} to ${next}`);
    }
  }

  private async generateBookingCode(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `SNF-${dateStr}`;

    const lastBooking = await this.prisma.booking.findFirst({
      where: { bookingCode: { startsWith: prefix } },
      orderBy: { bookingCode: 'desc' },
    });

    let sequence = 1;
    if (lastBooking) {
      const lastSeq = parseInt(lastBooking.bookingCode.split('-')[2], 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}-${String(sequence).padStart(3, '0')}`;
  }
}
