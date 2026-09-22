import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { CashReceiptsService } from './cash-receipts.service';
import { CreateCashReceiptDto } from './dto/create-cash-receipt.dto';
import { VoidCashReceiptDto } from './dto/void-cash-receipt.dto';

@Controller('cash-receipts')
export class CashReceiptsController {
  constructor(private service: CashReceiptsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateCashReceiptDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.service.create(dto, req.user.id);
  }

  @Post(':id/void')
  void(
    @Param('id') id: string,
    @Body() dto: VoidCashReceiptDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.service.void(id, dto.motivo, req.user.id);
  }
}
