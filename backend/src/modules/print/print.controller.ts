import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrintService } from './print.service';

@Controller('print')
export class PrintController {
  constructor(private service: PrintService) {}

  @Get(':docType/:id')
  async render(
    @Param('docType') docType: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const html = await this.service.render(docType as 'ND' | 'NC', id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
