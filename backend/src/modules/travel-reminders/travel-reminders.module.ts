import { Module } from '@nestjs/common';
import { TravelRemindersService } from './travel-reminders.service';
import { TravelRemindersController } from './travel-reminders.controller';

@Module({
  controllers: [TravelRemindersController],
  providers: [TravelRemindersService],
  exports: [TravelRemindersService],
})
export class TravelRemindersModule {}