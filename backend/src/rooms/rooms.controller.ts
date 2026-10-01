import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Rooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a room' })
  async create(@Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all rooms' })
  async findAll() {
    return this.roomsService.getRooms();
  }

  @Get('available')
  @ApiOperation({ summary: 'Get available rooms for date range' })
  @ApiQuery({ name: 'checkIn', required: true })
  @ApiQuery({ name: 'checkOut', required: true })
  @ApiQuery({ name: 'roomTypeId', required: false })
  async getAvailable(
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
    @Query('roomTypeId') roomTypeId?: string,
  ) {
    return this.roomsService.getAvailableRooms(new Date(checkIn), new Date(checkOut), roomTypeId);
  }

  @Get('status-board')
  @ApiOperation({ summary: 'Get room status board' })
  async statusBoard() {
    return this.roomsService.getRoomStatusBoard();
  }

  @Get('by-type/:roomTypeId')
  @ApiOperation({ summary: 'Get rooms by type' })
  async getByType(@Param('roomTypeId') roomTypeId: string) {
    return this.roomsService.getRoomsByType(roomTypeId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update room status' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateRoomStatusDto) {
    return this.roomsService.updateRoomStatus(id, dto.status);
  }
}
