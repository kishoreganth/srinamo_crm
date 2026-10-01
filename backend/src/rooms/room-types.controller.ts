import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Room Types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create room type' })
  async create(@Body() dto: CreateRoomTypeDto) {
    return this.roomsService.createRoomType(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all room types' })
  async findAll() {
    return this.roomsService.getRoomTypes();
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update room type' })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateRoomTypeDto>) {
    return this.roomsService.updateRoomType(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete room type' })
  async remove(@Param('id') id: string) {
    return this.roomsService.deleteRoomType(id);
  }
}
