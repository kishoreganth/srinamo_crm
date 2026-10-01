import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { DayType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRatePlanDto } from './dto/create-rate-plan.dto';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async createRatePlan(dto: CreateRatePlanDto) {
    return this.prisma.ratePlan.create({
      data: {
        roomTypeId: dto.roomTypeId,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        dayType: dto.dayType || DayType.ALL,
        price: dto.price,
        priority: dto.priority || 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async getRatePlans() {
    return this.prisma.ratePlan.findMany({
      include: { roomType: { select: { name: true } } },
      orderBy: [{ roomTypeId: 'asc' }, { priority: 'desc' }],
    });
  }

  async updateRatePlan(id: string, dto: Partial<CreateRatePlanDto>) {
    const plan = await this.prisma.ratePlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Rate plan not found');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.dayType !== undefined) data.dayType = dto.dayType;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.ratePlan.update({ where: { id }, data });
  }

  async deleteRatePlan(id: string) {
    const plan = await this.prisma.ratePlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Rate plan not found');
    return this.prisma.ratePlan.delete({ where: { id } });
  }

  async calculatePrice(roomTypeId: string, checkIn: Date, checkOut: Date): Promise<Decimal> {
    const roomType = await this.prisma.roomType.findUnique({ where: { id: roomTypeId } });
    if (!roomType) throw new NotFoundException('Room type not found');

    let totalPrice = new Decimal(0);
    const currentDate = new Date(checkIn);

    while (currentDate < checkOut) {
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayType = isWeekend ? DayType.WEEKEND : DayType.WEEKDAY;

      const ratePlan = await this.prisma.ratePlan.findFirst({
        where: {
          roomTypeId,
          isActive: true,
          startDate: { lte: currentDate },
          endDate: { gte: currentDate },
          dayType: { in: [dayType, DayType.ALL] },
        },
        orderBy: { priority: 'desc' },
      });

      const nightPrice = ratePlan ? ratePlan.price : roomType.basePrice;
      totalPrice = totalPrice.add(nightPrice);

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return totalPrice;
  }
}
