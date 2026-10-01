import { IsNotEmpty, IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsEnum, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DayType } from '@prisma/client';

export class CreateRatePlanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  roomTypeId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty()
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ enum: DayType, default: DayType.ALL })
  @IsOptional()
  @IsEnum(DayType)
  dayType?: DayType;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
