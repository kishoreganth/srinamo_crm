import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RoomStatus } from '@prisma/client';

export class UpdateRoomStatusDto {
  @ApiProperty({ enum: RoomStatus })
  @IsEnum(RoomStatus)
  status!: RoomStatus;
}
