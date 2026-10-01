import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { CreateRatePlanDto } from './dto/create-rate-plan.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Pricing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('rate-plans')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a rate plan' })
  async create(@Body() dto: CreateRatePlanDto) {
    return this.pricingService.createRatePlan(dto);
  }

  @Get('rate-plans')
  @ApiOperation({ summary: 'Get all rate plans' })
  async findAll() {
    return this.pricingService.getRatePlans();
  }

  @Patch('rate-plans/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update rate plan' })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateRatePlanDto>) {
    return this.pricingService.updateRatePlan(id, dto);
  }

  @Delete('rate-plans/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete rate plan' })
  async remove(@Param('id') id: string) {
    return this.pricingService.deleteRatePlan(id);
  }
}
