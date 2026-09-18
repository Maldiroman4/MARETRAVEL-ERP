/* eslint-disable @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-return */
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DebitNotesService } from './debit-notes.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDebitNoteDto } from './dto/create-debit-note.dto';

describe('DebitNotesService', () => {
  let service: DebitNotesService;

  const prisma = {
    debitNote: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    debitNoteItem: { create: jest.fn() },
    creditNote: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    ticket: { update: jest.fn() },
    auditLog: { create: jest.fn() },
    account: { update: jest.fn() },
  } as Record<string, unknown> & {
    debitNote: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    debitNoteItem: { create: jest.Mock };
    creditNote: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    ticket: { update: jest.Mock };
    auditLog: { create: jest.Mock };
    account: { update: jest.Mock };
    $transaction: jest.Mock;
  };
  prisma.$transaction = jest.fn((arg: any) =>
    typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
  );

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.debitNote.updateMany.mockResolvedValue({ count: 1 });
    const moduleRef = await Test.createTestingModule({
      providers: [
        DebitNotesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(DebitNotesService);
  });

  it('create computes totalAmountBob and balanceBob for a BOB note', async () => {
    prisma.debitNote.findFirst.mockResolvedValue(null);
    prisma.debitNote.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'nd1', ...data, items: data.items.create }),
    );

    const dto = {
      accountId: 'acc1',
      issueDate: '2026-09-18',
      paymentTerm: 'AL_CONTADO',
      currency: 'BOB',
      items: [
        {
          serviceType: 'BOLETO_GDS',
          passengerName: 'Ana',
          description: 'Vuelo',
          currency: 'BOB',
          totalAmount: 100,
        },
        {
          serviceType: 'HOTEL',
          passengerName: 'Beto',
          description: 'Hotel',
          currency: 'BOB',
          totalAmount: 50,
        },
      ],
    } as unknown as CreateDebitNoteDto;

    const created = await service.create(dto);

    expect(created.ndNumber).toBe(1);
    expect(created.totalAmountBob).toBe(150);
    expect(created.totalAmountUsd).toBeCloseTo(21.55, 2);
    expect(created.balanceBob).toBe(150);
    expect(created.balanceUsd).toBeCloseTo(21.55, 2);
    expect(created.status).toBe('BORRADOR');
  });

  it('create converts USD items using the provided exchangeRate', async () => {
    prisma.debitNote.findFirst.mockResolvedValue({ ndNumber: 7 });
    prisma.debitNote.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'nd2', ...data, items: data.items.create }),
    );

    const dto = {
      accountId: 'acc1',
      issueDate: '2026-09-18',
      paymentTerm: 'CREDITO_30_DIAS',
      currency: 'USD',
      exchangeRate: 7,
      items: [
        {
          serviceType: 'PAQUETE',
          passengerName: 'Carla',
          description: 'Paquete',
          currency: 'USD',
          totalAmount: 200,
        },
      ],
    } as unknown as CreateDebitNoteDto;

    const created = await service.create(dto);

    expect(created.ndNumber).toBe(8);
    expect(created.totalAmountUsd).toBe(200);
    expect(created.totalAmountBob).toBe(1400);
    expect(created.balanceBob).toBe(1400);
  });

  it('close generates an automatic CreditNote per operator and marks tickets ASIGNADO', async () => {
    prisma.debitNote.findUnique.mockResolvedValue({
      id: 'nd1',
      status: 'BORRADOR',
      currency: 'BOB',
      items: [
        {
          id: 'i1',
          ticketId: 't1',
          operatorId: 'op1',
          currency: 'BOB',
          totalAmount: 100,
          netCostToProvider: 90,
        },
        {
          id: 'i2',
          ticketId: 't2',
          operatorId: 'op1',
          currency: 'BOB',
          totalAmount: 50,
          netCostToProvider: 45,
        },
        {
          id: 'i3',
          ticketId: 't3',
          operatorId: 'op2',
          currency: 'USD',
          totalAmount: 20,
          netCostToProvider: 20,
        },
      ],
    });
    prisma.creditNote.findFirst.mockResolvedValue(null);
    prisma.creditNote.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'nc', ...data }),
    );
    prisma.ticket.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    prisma.debitNote.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'nd1', ...data }),
    );

    const result = await service.close('nd1');

    expect(prisma.ticket.update).toHaveBeenCalledTimes(3);
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'ASIGNADO' },
    });
    expect(prisma.creditNote.create).toHaveBeenCalledTimes(2);

    const op1 = prisma.creditNote.create.mock.calls.find(
      (c) => c[0].data.providerAccountId === 'op1',
    );
    expect(op1?.[0].data.isAutomatic).toBe(true);
    expect(op1?.[0].data.totalAmountBob).toBe(135);
    expect(op1?.[0].data.balanceBob).toBe(135);

    const op2 = prisma.creditNote.create.mock.calls.find(
      (c) => c[0].data.providerAccountId === 'op2',
    );
    expect(op2?.[0].data.totalAmountBob).toBe(20);
    expect(op2?.[0].data.totalAmountUsd).toBeCloseTo(2.87, 2);

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CLOSE',
          entityType: 'DEBIT_NOTE',
          entityId: 'nd1',
        }),
      }),
    );
    expect(result.status).toBe('IMPAGA');
  });

  it('close rejects a note that is not BORRADOR (TOCTOU guard fails)', async () => {
    prisma.debitNote.findUnique.mockResolvedValue({
      id: 'nd1',
      status: 'IMPAGA',
      items: [],
      totalAmountBob: 0,
      totalAmountUsd: 0,
    });
    prisma.debitNote.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.close('nd1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('close derives the NC counter-currency rate from the ND totals', async () => {
    prisma.debitNote.findUnique.mockResolvedValue({
      id: 'nd1',
      status: 'BORRADOR',
      currency: 'USD',
      totalAmountBob: 1400,
      totalAmountUsd: 200,
      items: [
        {
          id: 'i1',
          ticketId: 't1',
          operatorId: 'op1',
          currency: 'USD',
          totalAmount: 100,
          netCostToProvider: 100,
        },
      ],
    });
    prisma.debitNote.updateMany.mockResolvedValue({ count: 1 });
    prisma.creditNote.findFirst.mockResolvedValue(null);
    prisma.creditNote.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'nc', ...data }),
    );
    prisma.ticket.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    prisma.debitNote.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'nd1', ...data }),
    );

    await service.close('nd1');

    const nc = prisma.creditNote.create.mock.calls[0]?.[0].data;
    expect(nc.totalAmountUsd).toBe(100);
    expect(nc.totalAmountBob).toBeCloseTo(700, 2);
  });

  it('void on an already-voided (ANULADA) ND throws BadRequestException', async () => {
    prisma.debitNote.findUnique.mockResolvedValue({
      id: 'nd1',
      status: 'ANULADA',
      observations: '',
      items: [],
    });
    prisma.debitNote.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.void('nd1', 'duplicado')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('void without motivo throws BadRequestException before touching the DB', async () => {
    await expect(service.void('nd1', '')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.debitNote.findUnique).not.toHaveBeenCalled();
  });

  it('correct without motivo throws BadRequestException', async () => {
    await expect(service.correct('nd1', '', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
