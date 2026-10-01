import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchGuestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  query!: string;
}
