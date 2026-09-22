import { Test } from '@nestjs/testing';
import { Prisma, TicketStatus } from '@prisma/client';
import { GdsTicketsService } from './gds-tickets.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

describe('GdsTicketsService', () => {
  let service: GdsTicketsService;
  const prisma = {
    ticket: {
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 't1', ...data }),
        ),
      findMany: jest.fn().mockResolvedValue([{ id: 't1', status: 'DISPONIBLE' }]),
      update: jest
        .fn()
        .mockImplementation(({ data }) => Promise.resolve({ id: 't1', ...data })),
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GdsTicketsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(GdsTicketsService);
  });

  it('creates a ticket persisting DISPONIBLE default and AMADEUS gdsSource', async () => {
    const dto: CreateTicketDto = {
      ticketNumber: 'TKT-001',
      issueDate: '2026-09-18',
      passengerName: 'LUIS PEREZ',
      route: 'LPB-SCZ',
      airlineCode: 'OB',
      operatorId: 'op1',
      netAmount: 100,
      totalAmount: 120,
      currency: 'USD',
    };
    const created = await service.create(dto);
    expect(created.id).toBe('t1');
    expect(prisma.ticket.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketNumber: 'TKT-001',
        status: 'DISPONIBLE',
        gdsSource: 'AMADEUS',
      }),
    });
  });

  it('filters findAll by status', async () => {
    await service.findAll(TicketStatus.DISPONIBLE, undefined);
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'DISPONIBLE',
        }) as Prisma.TicketWhereInput,
      }),
    );
  });
});