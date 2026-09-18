/* eslint-disable @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-return */
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CreditNotesService } from './credit-notes.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';

describe('CreditNotesService', () => {
  let service: CreditNotesService;

  const prisma = {
    creditNote: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  } as Record<string, unknown> & {
    creditNote: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  prisma.$transaction = jest.fn((arg: any) =>
    typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
  );

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.creditNote.updateMany.mockResolvedValue({ count: 1 });
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreditNotesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(CreditNotesService);
  });

  it('create persists a manual NC with balance=total, isAutomatic=false and status PENDIENTE', async () => {
    prisma.creditNote.findFirst.mockResolvedValue({ ncNumber: 5 });
    prisma.creditNote.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'nc1', ...data }),
    );

    const dto = {
      providerAccountId: 'acc1',
      concept: 'NC manual por devolución',
      currency: 'BOB',
      totalAmountBob: 120,
      totalAmountUsd: 0,
    } as unknown as CreateCreditNoteDto;

    const created = await service.create(dto, 'u1');

    expect(created.ncNumber).toBe(6);
    expect(created.isAutomatic).toBe(false);
    expect(created.balanceBob).toBe(120);
    expect(created.balanceUsd).toBe(0);
    expect(created.status).toBe('PENDIENTE');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CREATE_NC',
          entityType: 'CREDIT_NOTE',
          userId: 'u1',
        }),
      }),
    );
  });

  it('create rejects a NC without any positive amount', async () => {
    prisma.creditNote.findFirst.mockResolvedValue(null);
    const dto = {
      providerAccountId: 'acc1',
      concept: 'sin monto',
      currency: 'BOB',
      totalAmountBob: 0,
      totalAmountUsd: 0,
    } as unknown as CreateCreditNoteDto;

    await expect(service.create(dto, 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.creditNote.create).not.toHaveBeenCalled();
  });

  it('void without motivo throws BadRequestException before touching the DB', async () => {
    await expect(service.void('nc1', '')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.creditNote.findUnique).not.toHaveBeenCalled();
  });

  it('void sets status ANULADA + voidReason and writes audit with userId', async () => {
    prisma.creditNote.findUnique.mockResolvedValue({
      id: 'nc1',
      status: 'PENDIENTE',
    });
    prisma.creditNote.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'nc1', ...data }),
    );
    prisma.auditLog.create.mockResolvedValue({});

    const result = await service.void('nc1', 'duplicado', 'u1');

    expect(prisma.creditNote.update).toHaveBeenCalledWith({
      where: { id: 'nc1' },
      data: { status: 'ANULADA', voidReason: 'duplicado' },
    });
    expect(result.status).toBe('ANULADA');
    expect(result.voidReason).toBe('duplicado');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'VOID_NC',
          entityType: 'CREDIT_NOTE',
          entityId: 'nc1',
          userId: 'u1',
          reason: 'duplicado',
        }),
      }),
    );
  });

  it('void rejects a NC already ANULADA', async () => {
    prisma.creditNote.findUnique.mockResolvedValue({
      id: 'nc1',
      status: 'ANULADA',
    });
    prisma.creditNote.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.void('nc1', 'duplicado', 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
