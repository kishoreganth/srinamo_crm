import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvoiceDto {
  @ApiProperty({ default: false })
  @IsBoolean()
  isGstInvoice!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  guestGstin?: string;
}
