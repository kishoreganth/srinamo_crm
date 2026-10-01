import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RestaurantService } from './restaurant.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Menu')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('restaurant/menu')
export class MenuController {
  constructor(private readonly restaurantService: RestaurantService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create menu item' })
  async create(@Body() dto: CreateMenuItemDto) {
    return this.restaurantService.createMenuItem(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all menu items' })
  async findAll() {
    return this.restaurantService.getMenuItems();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get menu categories' })
  async categories() {
    return this.restaurantService.getMenuCategories();
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update menu item' })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateMenuItemDto>) {
    return this.restaurantService.updateMenuItem(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete menu item' })
  async remove(@Param('id') id: string) {
    return this.restaurantService.deleteMenuItem(id);
  }
}
