import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HousekeepingService } from './housekeeping.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TaskStatus } from '@prisma/client';

@ApiTags('Housekeeping')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('housekeeping')
export class HousekeepingController {
  constructor(private readonly housekeepingService: HousekeepingService) {}

  @Post('tasks')
  @ApiOperation({ summary: 'Create housekeeping task' })
  async create(@Body() dto: CreateTaskDto) {
    return this.housekeepingService.createTask(dto);
  }

  @Get('tasks')
  @ApiOperation({ summary: 'Get all tasks' })
  async findAll(@Query('status') status?: TaskStatus) {
    return this.housekeepingService.getTasks(status);
  }

  @Patch('tasks/:id')
  @ApiOperation({ summary: 'Update task' })
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.housekeepingService.updateTask(id, dto);
  }

  @Get('board')
  @ApiOperation({ summary: 'Get room status board with housekeeping info' })
  async board() {
    return this.housekeepingService.getRoomStatusBoard();
  }
}
