import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ActivityBookingStatus } from '@prisma/client';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { BookActivityDto } from './dto/book-activity.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active activities' })
  async findAll() {
    return this.activitiesService.getActivities();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create an activity' })
  async create(@Body() dto: CreateActivityDto) {
    return this.activitiesService.createActivity(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update an activity' })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateActivityDto>) {
    return this.activitiesService.updateActivity(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Deactivate an activity' })
  async remove(@Param('id') id: string) {
    return this.activitiesService.deleteActivity(id);
  }

  @Post('bookings')
  @ApiOperation({ summary: 'Book an activity' })
  async book(@Body() dto: BookActivityDto) {
    return this.activitiesService.bookActivity(dto);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'Get activity bookings' })
  async getBookings(
    @Query('activityId') activityId?: string,
    @Query('guestId') guestId?: string,
    @Query('status') status?: ActivityBookingStatus,
  ) {
    return this.activitiesService.getActivityBookings(activityId, guestId, status);
  }

  @Patch('bookings/:id/status')
  @ApiOperation({ summary: 'Update activity booking status' })
  async updateBookingStatus(
    @Param('id') id: string,
    @Body('status') status: ActivityBookingStatus,
  ) {
    return this.activitiesService.updateActivityBookingStatus(id, status);
  }
}
