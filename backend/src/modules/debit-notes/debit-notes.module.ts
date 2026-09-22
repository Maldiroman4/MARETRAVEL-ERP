import { Module } from '@nestjs/common';
import { DebitNotesService } from './debit-notes.service';
import { DebitNotesController } from './debit-notes.controller';

@Module({
  controllers: [DebitNotesController],
  providers: [DebitNotesService],
  exports: [DebitNotesService],
})
export class DebitNotesModule {}
