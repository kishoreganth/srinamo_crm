import { Injectable } from '@nestjs/common';
import { BookingStatus, PaymentStatus, RoomStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalRooms,
      occupiedRooms,
      bookingsToday,
      pendingCheckIns,
      revenueToday,
      revenueWeek,
      revenueMonth,
      todayArrivals,
      todayDepartures,
      roomStatusCounts,
      recentBookings,
    ] = await Promise.all([
      this.prisma.room.count(),
      this.prisma.room.count({ where: { status: RoomStatus.OCCUPIED } }),
      this.prisma.booking.count({
        where: { checkIn: { gte: today, lt: tomorrow }, deletedAt: null },
      }),
      this.prisma.booking.count({
        where: {
          checkIn: { gte: today, lt: tomorrow },
          status: BookingStatus.CONFIRMED,
          deletedAt: null,
        },
      }),
      this.sumPayments(today, tomorrow),
      this.sumPayments(weekStart, tomorrow),
      this.sumPayments(monthStart, tomorrow),
      this.prisma.booking.findMany({
        where: {
          checkIn: { gte: today, lt: tomorrow },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
          deletedAt: null,
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
          status: BookingStatus.CHECKED_IN,
          deletedAt: null,
        },
        include: {
          guest: { select: { firstName: true, lastName: true, phone: true } },
          room: { include: { roomType: { select: { name: true } } } },
        },
        orderBy: { checkOut: 'asc' },
      }),
      this.prisma.room.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.booking.findMany({
        where: { deletedAt: null },
        include: {
          guest: { select: { firstName: true, lastName: true } },
          room: { select: { roomNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    const roomStatusMap: Record<string, number> = {};
    for (const r of roomStatusCounts) {
      roomStatusMap[r.status] = r._count.id;
    }

    return {
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      bookingsToday,
      revenueToday,
      revenueWeek,
      revenueMonth,
      pendingCheckIns,
      todayArrivals,
      todayDepartures,
      roomStatusCounts: roomStatusMap,
      recentBookings,
    };
  }

  async getOccupancyReport(from: Date, to: Date) {
    const totalRooms = await this.prisma.room.count();
    const result: { date: string; occupancy: number; occupiedRooms: number }[] = [];
    const currentDate = new Date(from);

    while (currentDate <= to) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const occupiedCount = await this.prisma.booking.count({
        where: {
          checkIn: { lte: dayEnd },
          checkOut: { gt: dayStart },
          status: { in: [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] },
          deletedAt: null,
        },
      });

      const occupancy = totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 10000) / 100 : 0;

      result.push({
        date: dayStart.toISOString().slice(0, 10),
        occupancy,
        occupiedRooms: occupiedCount,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return { totalRooms, data: result };
  }

  async getRevenueReport(from: Date, to: Date) {
    const folioItems = await this.prisma.folioItem.findMany({
      where: {
        createdAt: { gte: from, lte: to },
      },
      select: { category: true, amount: true, quantity: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const dailyMap: Record<string, Record<string, Decimal>> = {};

    for (const item of folioItems) {
      const dateKey = item.createdAt.toISOString().slice(0, 10);
      if (!dailyMap[dateKey]) dailyMap[dateKey] = {};
      const lineTotal = new Decimal(item.amount.toString()).mul(item.quantity);
      dailyMap[dateKey][item.category] = (dailyMap[dateKey][item.category] || new Decimal(0)).add(lineTotal);
    }

    const data = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, categories]) => ({ date, ...categories }));

    const categoryTotals: Record<string, Decimal> = {};
    for (const item of folioItems) {
      const lineTotal = new Decimal(item.amount.toString()).mul(item.quantity);
      categoryTotals[item.category] = (categoryTotals[item.category] || new Decimal(0)).add(lineTotal);
    }

    const grandTotal = Object.values(categoryTotals).reduce((s, v) => s.add(v), new Decimal(0));

    return { data, categoryTotals, grandTotal };
  }

  async getFoodSalesReport(from: Date, to: Date) {
    const orders = await this.prisma.foodOrder.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: { items: { include: { menuItem: { select: { name: true, category: true } } } } },
    });

    const menuItemSales: Record<string, { name: string; category: string; quantity: number; revenue: Decimal }> = {};

    for (const order of orders) {
      for (const item of order.items) {
        const key = item.menuItemId;
        if (!menuItemSales[key]) {
          menuItemSales[key] = {
            name: item.menuItem.name,
            category: item.menuItem.category,
            quantity: 0,
            revenue: new Decimal(0),
          };
        }
        menuItemSales[key].quantity += item.quantity;
        menuItemSales[key].revenue = menuItemSales[key].revenue.add(
          new Decimal(item.unitPrice.toString()).mul(item.quantity),
        );
      }
    }

    const topItems = Object.values(menuItemSales).sort((a, b) => b.quantity - a.quantity);

    const categoryTotals: Record<string, { quantity: number; revenue: Decimal }> = {};
    for (const item of topItems) {
      if (!categoryTotals[item.category]) {
        categoryTotals[item.category] = { quantity: 0, revenue: new Decimal(0) };
      }
      categoryTotals[item.category].quantity += item.quantity;
      categoryTotals[item.category].revenue = categoryTotals[item.category].revenue.add(item.revenue);
    }

    return {
      topItems,
      categoryTotals,
      orderCount: orders.length,
    };
  }

  async getGuestAnalytics() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalGuests, newGuestsThisMonth, repeatGuests, topBySpent, cityData] = await Promise.all([
      this.prisma.guest.count({ where: { deletedAt: null } }),
      this.prisma.guest.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } }),
      this.prisma.guest.count({ where: { totalStays: { gt: 1 }, deletedAt: null } }),
      this.prisma.guest.findMany({
        where: { deletedAt: null },
        select: { firstName: true, lastName: true, phone: true, totalStays: true, totalSpent: true },
        orderBy: { totalSpent: 'desc' },
        take: 10,
      }),
      this.prisma.guest.groupBy({
        by: ['city'],
        where: { deletedAt: null, city: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 15,
      }),
    ]);

    const cityDistribution = cityData.map((c) => ({
      city: c.city,
      count: c._count.id,
    }));

    return {
      totalGuests,
      newGuestsThisMonth,
      repeatGuests,
      topBySpent,
      cityDistribution,
    };
  }

  private async sumPayments(from: Date, to: Date): Promise<Decimal> {
    const result = await this.prisma.payment.aggregate({
      where: {
        status: PaymentStatus.COMPLETED,
        paidAt: { gte: from, lt: to },
      },
      _sum: { amount: true },
    });
    return result._sum.amount || new Decimal(0);
  }
}
