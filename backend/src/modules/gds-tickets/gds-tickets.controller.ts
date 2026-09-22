import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { GdsTicketsService } from './gds-tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Controller('gds-tickets')
export class GdsTicketsController {
  constructor(private service: GdsTicketsService) {}

  @Get()
  findAll(
    @Query('status') status?: TicketStatus,
    @Query('airlineCode') airlineCode?: string,
  ) {
    return this.service.findAll(status, airlineCode);
  }

  @Post()
  create(@Body() dto: CreateTicketDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateTicketDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}