import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTravelReminderDto } from './dto/create-travel-reminder.dto';

@Injectable()
export class TravelRemindersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTravelReminderDto) {
    const data: Prisma.TravelReminderCreateInput = {
      clientId: dto.clientId,
      clientName: dto.clientName,
      clientPhone: dto.clientPhone,
      clientEmail: dto.clientEmail,
      passengerName: dto.passengerName,
      passengerDoc: dto.passengerDoc,
      route: dto.route,
      airline: dto.airline,
      flightNumber: dto.flightNumber,
      ticketNumber: dto.ticketNumber,
      departureDate: new Date(dto.departureDate),
      departureTime: dto.departureTime,
      returnDate: dto.returnDate ? new Date(dto.returnDate) : null,
      returnTime: dto.returnTime,
      hasReturn: dto.hasReturn ?? false,
      hotelName: dto.hotelName,
      status: dto.status ?? 'PROGRAMADO',
      observations: dto.observations,
    };
    return this.prisma.travelReminder.create({ data });
  }

  async findAll(from?: string, to?: string) {
    const where: Prisma.TravelReminderWhereInput = {};
    if (from && to) {
      where.departureDate = {
        gte: new Date(from),
        lte: new Date(to),
      };
    }
    return this.prisma.travelReminder.findMany({
      where,
      orderBy: { departureDate: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.travelReminder.findUnique({ where: { id } });
  }

  async update(id: string, dto: Partial<CreateTravelReminderDto>) {
    const data: Prisma.TravelReminderUpdateInput = { ...dto };
    if (dto.departureDate) data.departureDate = new Date(dto.departureDate);
    if (dto.returnDate) data.returnDate = new Date(dto.returnDate);
    return this.prisma.travelReminder.update({ where: { id }, data });
  }

  async remove(id: string) {
    try {
      return await this.prisma.travelReminder.delete({ where: { id } });
    } catch (err) {
      const e = err as { code?: string };
      if (e && e.code === 'P2025') {
        throw new BadRequestException('El itinerario no existe.');
      }
      throw err;
    }
  }
}