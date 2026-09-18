import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { DebitNoteStatus } from '@prisma/client';
import { DebitNotesService } from './debit-notes.service';
import { CreateDebitNoteDto } from './dto/create-debit-note.dto';
import { UpdateDebitNoteDto } from './dto/update-debit-note.dto';
import { VoidDebitNoteDto } from './dto/void-debit-note.dto';
import { CorrectDebitNoteDto } from './dto/correct-debit-note.dto';

@Controller('debit-notes')
export class DebitNotesController {
  constructor(private service: DebitNotesService) {}

  @Get()
  findAll(@Query('status') status?: DebitNoteStatus) {
    return this.service.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateDebitNoteDto,
    @Req() req: { user?: { id?: string } },
  ) {
    return this.service.create(dto, req.user?.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDebitNoteDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/close')
  close(@Param('id') id: string) {
    return this.service.close(id);
  }

  @Post(':id/reopen')
  reopen(@Param('id') id: string) {
    return this.service.reopen(id);
  }

  @Post(':id/void')
  void(@Param('id') id: string, @Body() dto: VoidDebitNoteDto) {
    return this.service.void(id, dto.motivo);
  }

  @Post(':id/correct')
  correct(@Param('id') id: string, @Body() dto: CorrectDebitNoteDto) {
    return this.service.correct(id, dto);
  }
}
