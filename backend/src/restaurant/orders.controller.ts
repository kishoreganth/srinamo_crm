import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RestaurantService } from './restaurant.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrderStatus } from '@prisma/client';

@ApiTags('Restaurant Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('restaurant/orders')
export class OrdersController {
  constructor(private readonly restaurantService: RestaurantService) {}

  @Post()
  @ApiOperation({ summary: 'Create food order' })
  async create(@Body() dto: CreateOrderDto) {
    return this.restaurantService.createOrder(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders' })
  async findAll(@Query('status') status?: OrderStatus) {
    return this.restaurantService.getOrders(status);
  }

  @Get('kitchen')
  @ApiOperation({ summary: 'Get kitchen display orders' })
  async kitchen() {
    return this.restaurantService.getKitchenOrders();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  async findOne(@Param('id') id: string) {
    return this.restaurantService.getOrderById(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  async updateStatus(@Param('id') id: string, @Body('status') status: OrderStatus) {
    return this.restaurantService.updateOrderStatus(id, status);
  }
}
