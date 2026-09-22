import { Module } from '@nestjs/common';
import { GdsTicketsService } from './gds-tickets.service';
import { GdsTicketsController } from './gds-tickets.controller';

@Module({
  controllers: [GdsTicketsController],
  providers: [GdsTicketsService],
  exports: [GdsTicketsService],
})
export class GdsTicketsModule {}