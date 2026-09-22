import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class GdsTicketsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTicketDto) {
    return this.prisma.ticket.create({
      data: {
        ...dto,
        issueDate: new Date(dto.issueDate),
        gdsSource: dto.gdsSource ?? 'AMADEUS',
        status: dto.status ?? 'DISPONIBLE',
      },
    });
  }

  async findAll(status?: TicketStatus, airlineCode?: string) {
    const where: Prisma.TicketWhereInput = {};
    if (status) where.status = status;
    if (airlineCode) where.airlineCode = airlineCode;
    return this.prisma.ticket.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async update(id: string, dto: Partial<CreateTicketDto>) {
    const data: Prisma.TicketUpdateInput = { ...dto };
    if (dto.issueDate) data.issueDate = new Date(dto.issueDate);
    return this.prisma.ticket.update({ where: { id }, data });
  }

  async remove(id: string) {
    const linked = await this.prisma.debitNoteItem.count({ where: { ticketId: id } });
    if (linked > 0) {
      throw new BadRequestException(
        `El boleto está vinculado a ${linked} ítem(s) de Notas de Débito. No se puede eliminar.`,
      );
    }
    try {
      return await this.prisma.ticket.delete({ where: { id } });
    } catch (err) {
      const e = err as { code?: string };
      if (e && e.code === 'P2003') {
        throw new BadRequestException(
          'El boleto está referenciado por otros registros. No se puede eliminar.',
        );
      }
      throw err;
    }
  }
}