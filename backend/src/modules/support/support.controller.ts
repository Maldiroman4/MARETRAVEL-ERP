import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { SupportService } from './support.service';

@Controller()
export class SupportController {
  constructor(private service: SupportService) {}

  @Get('service-types')
  findServiceTypes() {
    return this.service.findServiceTypes();
  }

  @Get('payment-methods')
  findPaymentMethods() {
    return this.service.findPaymentMethods();
  }

  @Get('exchange-rate')
  getExchangeRate() {
    return this.service.getExchangeRate();
  }

  @Post('exchange-rate')
  updateExchangeRate(@Body() body: { buyRate?: number; sellRate?: number }) {
    return this.service.updateExchangeRate(
      Number(body?.buyRate),
      Number(body?.sellRate),
    );
  }

  @Patch('settings')
  updateSettings(@Req() req: { body: unknown }) {
    return this.service.updateSettings(
      (req.body ?? {}) as Record<string, unknown>,
    );
  }
}
