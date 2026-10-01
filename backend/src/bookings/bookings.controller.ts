import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { BookingFilterDto } from './dto/booking-filter.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new booking' })
  async create(@Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all bookings with filters' })
  async findAll(@Query() filters: BookingFilterDto) {
    return this.bookingsService.getBookings(filters);
  }

  @Get('today')
  @ApiOperation({ summary: 'Get today check-ins and check-outs' })
  async today() {
    return this.bookingsService.getTodayBookings();
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get calendar view data' })
  async calendar(@Query('from') from: string, @Query('to') to: string) {
    return this.bookingsService.getCalendarData(new Date(from), new Date(to));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking details' })
  async findOne(@Param('id') id: string) {
    return this.bookingsService.getBookingById(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update booking status' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateBookingStatusDto) {
    return this.bookingsService.updateBookingStatus(id, dto.status);
  }
}
