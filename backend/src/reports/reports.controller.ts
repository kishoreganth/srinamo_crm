import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard KPIs' })
  async dashboard() {
    return this.reportsService.getDashboard();
  }

  @Get('occupancy')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get occupancy report' })
  async occupancy(@Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.getOccupancyReport(new Date(from), new Date(to));
  }

  @Get('revenue')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get revenue report' })
  async revenue(@Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.getRevenueReport(new Date(from), new Date(to));
  }

  @Get('food-sales')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get food sales report' })
  async foodSales(@Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.getFoodSalesReport(new Date(from), new Date(to));
  }

  @Get('guest-analytics')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get guest analytics' })
  async guestAnalytics() {
    return this.reportsService.getGuestAnalytics();
  }
}
