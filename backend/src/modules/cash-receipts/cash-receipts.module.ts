import { Module } from '@nestjs/common';
import { CashReceiptsService } from './cash-receipts.service';
import { CashReceiptsController } from './cash-receipts.controller';

@Module({
  controllers: [CashReceiptsController],
  providers: [CashReceiptsService],
  exports: [CashReceiptsService],
})
export class CashReceiptsModule {}
