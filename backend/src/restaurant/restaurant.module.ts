import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { OrdersController } from './orders.controller';
import { RestaurantService } from './restaurant.service';

@Module({
  controllers: [MenuController, OrdersController],
  providers: [RestaurantService],
  exports: [RestaurantService],
})
export class RestaurantModule {}
