import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoomsModule } from './rooms/rooms.module';
import { GuestsModule } from './guests/guests.module';
import { BookingsModule } from './bookings/bookings.module';
import { BillingModule } from './billing/billing.module';
import { PricingModule } from './pricing/pricing.module';
import { RestaurantModule } from './restaurant/restaurant.module';
import { HousekeepingModule } from './housekeeping/housekeeping.module';
import { ActivitiesModule } from './activities/activities.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RoomsModule,
    GuestsModule,
    BookingsModule,
    BillingModule,
    PricingModule,
    RestaurantModule,
    HousekeepingModule,
    ActivitiesModule,
    ReportsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
