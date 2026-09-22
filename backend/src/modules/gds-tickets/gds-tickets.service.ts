import { Injectable } from '@nestjs/common';
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
}