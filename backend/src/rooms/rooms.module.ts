import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomTypesController } from './room-types.controller';
import { RoomsService } from './rooms.service';

@Module({
  controllers: [RoomsController, RoomTypesController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
