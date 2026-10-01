import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class RestaurantService {
  constructor(private readonly prisma: PrismaService) {}

  async createMenuItem(dto: CreateMenuItemDto) {
    return this.prisma.menuItem.create({ data: dto });
  }

  async getMenuItems() {
    const items = await this.prisma.menuItem.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    const grouped: Record<string, typeof items> = {};
    for (const item of items) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    return { items, grouped };
  }

  async updateMenuItem(id: string, dto: Partial<CreateMenuItemDto>) {
    const item = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Menu item not found');
    return this.prisma.menuItem.update({ where: { id }, data: dto });
  }

  async deleteMenuItem(id: string) {
    const item = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Menu item not found');
    return this.prisma.menuItem.update({ where: { id }, data: { isAvailable: false } });
  }

  async createOrder(dto: CreateOrderDto) {
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: dto.items.map((i) => i.menuItemId) } },
    });

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));
    let totalAmount = new Decimal(0);

    const orderItems = dto.items.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem) throw new NotFoundException(`Menu item ${item.menuItemId} not found`);
      const unitPrice = menuItem.price;
      totalAmount = totalAmount.add(new Decimal(unitPrice.toString()).mul(item.quantity));
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice,
        notes: item.notes,
      };
    });

    const order = await this.prisma.foodOrder.create({
      data: {
        bookingId: dto.bookingId || null,
        guestId: dto.guestId || null,
        orderType: dto.orderType,
        totalAmount,
        notes: dto.notes,
        items: { create: orderItems },
      },
      include: { items: { include: { menuItem: true } } },
    });

    if (dto.bookingId) {
      await this.prisma.folioItem.create({
        data: {
          bookingId: dto.bookingId,
          description: `Food Order #${order.id.slice(0, 8)}`,
          category: 'FOOD',
          amount: totalAmount,
          quantity: 1,
        },
      });
    }

    return order;
  }

  async getMenuCategories() {
    const items = await this.prisma.menuItem.findMany({
      where: { isAvailable: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return items.map((i) => i.category);
  }

  async getOrderById(id: string) {
    const order = await this.prisma.foodOrder.findUnique({
      where: { id },
      include: {
        items: { include: { menuItem: true } },
        guest: { select: { firstName: true, lastName: true, phone: true } },
        booking: { select: { bookingCode: true, room: { select: { roomNumber: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async getOrders(status?: OrderStatus) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    return this.prisma.foodOrder.findMany({
      where,
      include: {
        items: { include: { menuItem: { select: { name: true, category: true } } } },
        guest: { select: { firstName: true, lastName: true } },
        booking: { select: { bookingCode: true, room: { select: { roomNumber: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getKitchenOrders() {
    return this.prisma.foodOrder.findMany({
      where: { status: { in: [OrderStatus.PENDING, OrderStatus.PREPARING] } },
      include: {
        items: { include: { menuItem: { select: { name: true, category: true, isVeg: true } } } },
        booking: { select: { room: { select: { roomNumber: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateOrderStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.foodOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    return this.prisma.foodOrder.update({
      where: { id },
      data: { status },
      include: { items: { include: { menuItem: true } } },
    });
  }
}
