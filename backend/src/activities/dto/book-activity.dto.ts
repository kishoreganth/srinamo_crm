import { IsNotEmpty, IsString, IsOptional, IsDateString, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookActivityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  activityId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  guestId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bookingId?: string;

  @ApiProperty()
  @IsDateString()
  scheduledDate!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  participants!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
