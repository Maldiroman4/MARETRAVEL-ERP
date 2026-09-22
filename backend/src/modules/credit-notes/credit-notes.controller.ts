import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { CreditNotesService } from './credit-notes.service';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { VoidCreditNoteDto } from './dto/void-credit-note.dto';

@Controller('credit-notes')
export class CreditNotesController {
  constructor(private service: CreditNotesService) {}

  @Get()
  findAll(@Query('status') status?: string) {
    return this.service.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateCreditNoteDto,
    @Req() req: { user?: { id?: string } },
  ) {
    return this.service.create(dto, req.user?.id);
  }

  @Post(':id/void')
  void(
    @Param('id') id: string,
    @Body() dto: VoidCreditNoteDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.service.void(id, dto.motivo, req.user.id);
  }
}
