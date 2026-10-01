import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { GuestsService } from './guests.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { SearchGuestDto } from './dto/search-guest.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Guests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('guests')
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new guest' })
  async create(@Body() dto: CreateGuestDto) {
    return this.guestsService.createGuest(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all guests with pagination' })
  async findAll(@Query() pagination: PaginationDto) {
    return this.guestsService.getGuests(pagination);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search guests' })
  async search(@Query() dto: SearchGuestDto) {
    return this.guestsService.searchGuests(dto.query);
  }

  @Get('birthdays')
  @ApiOperation({ summary: 'Get guests with birthday on given date' })
  async birthdays(@Query('date') date: string) {
    return this.guestsService.getGuestsBirthday(new Date(date));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get guest by ID' })
  async findOne(@Param('id') id: string) {
    return this.guestsService.getGuestById(id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get guest booking history' })
  async history(@Param('id') id: string) {
    return this.guestsService.getGuestHistory(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update guest' })
  async update(@Param('id') id: string, @Body() dto: UpdateGuestDto) {
    return this.guestsService.updateGuest(id, dto);
  }

  @Post(':id/upload-id')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload guest ID document' })
  async uploadId(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.guestsService.uploadIdDocument(id, file);
  }
}
