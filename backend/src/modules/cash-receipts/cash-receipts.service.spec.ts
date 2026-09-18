/* eslint-disable @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-return */
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CashReceiptsService } from './cash-receipts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCashReceiptDto } from './dto/create-cash-receipt.dto';

describe('CashReceiptsService', () => {
  let service: CashReceiptsService;

  const prisma = {
    account: {
      findUnique: jest.fn(),
    },
    cashReceipt: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    debitNote: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  } as Record<string, unknown> & {
    account: { findUnique: jest.Mock };
    cashReceipt: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    debitNote: { findUnique: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  prisma.$transaction = jest.fn((arg: any) =>
    typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
  );

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CashReceiptsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(CashReceiptsService);
  });

  it('create computes totals, reduces ND balances, and marks the ND PAGADA when fully paid', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 'acc1' });
    prisma.cashReceipt.findFirst.mockResolvedValue(null);
    prisma.debitNote.findUnique.mockResolvedValue({
      id: 'nd1',
      status: 'IMPAGA',
      accountId: 'acc1',
      balanceBob: 100,
      balanceUsd: 0,
      paidAmountBob: 0,
      paidAmountUsd: 0,
    });
    prisma.debitNote.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'nd1', ...data }),
    );
    prisma.cashReceipt.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'cr1', ...data, lines: data.lines.create }),
    );
    prisma.auditLog.create.mockResolvedValue({});

    const dto = {
      clientAccountId: 'acc1',
      issueDate: '2026-09-18',
      lines: [{ debitNoteId: 'nd1', amountPaidBob: 100 }],
    } as unknown as CreateCashReceiptDto;

    const result = await service.create(dto, 'u1');

    expect(prisma.cashReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          receiptNumber: 1,
          clientAccountId: 'acc1',
          status: 'VALIDO',
          exchangeRate: 6.96,
          totalPaidBob: 100,
          totalPaidUsd: 0,
          lines: {
            create: [
              expect.objectContaining({
                debitNoteId: 'nd1',
                amountPaidBob: 100,
                amountPaidUsd: 0,
              }),
            ],
          },
        }),
      }),
    );
    expect(prisma.debitNote.update).toHaveBeenCalledWith({
      where: { id: 'nd1' },
      data: expect.objectContaining({
        balanceBob: 0,
        balanceUsd: 0,
        paidAmountBob: 100,
        paidAmountUsd: 0,
        status: 'PAGADA',
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CREATE_RECEIPT',
          entityType: 'CASH_RECEIPT',
          userId: 'u1',
          newValue: expect.objectContaining({
            receiptNumber: 1,
            totalPaidBob: 100,
            totalPaidUsd: 0,
          }),
        }),
      }),
    );
    expect(result.receiptNumber).toBe(1);
    expect(result.lines).toHaveLength(1);
  });

  it('create with a partial payment marks the ND PARCIAL and keeps a balance', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 'acc1' });
    prisma.cashReceipt.findFirst.mockResolvedValue({ receiptNumber: 3 });
    prisma.debitNote.findUnique.mockResolvedValue({
      id: 'nd1',
      status: 'IMPAGA',
      accountId: 'acc1',
      balanceBob: 500,
      balanceUsd: 0,
      paidAmountBob: 0,
      paidAmountUsd: 0,
    });
    prisma.debitNote.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'nd1', ...data }),
    );
    prisma.cashReceipt.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'cr2', ...data, lines: data.lines.create }),
    );
    prisma.auditLog.create.mockResolvedValue({});

    const dto = {
      clientAccountId: 'acc1',
      issueDate: '2026-09-18',
      exchangeRate: 7,
      lines: [{ debitNoteId: 'nd1', amountPaidBob: 200 }],
    } as unknown as CreateCashReceiptDto;

    await service.create(dto);

    expect(prisma.cashReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          receiptNumber: 4,
          exchangeRate: 7,
          totalPaidBob: 200,
        }),
      }),
    );
    expect(prisma.debitNote.update).toHaveBeenCalledWith({
      where: { id: 'nd1' },
      data: expect.objectContaining({
        balanceBob: 300,
        paidAmountBob: 200,
        status: 'PARCIAL',
      }),
    });
  });

  it('create requires at least one amount > 0 per line', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 'acc1' });
    const dto = {
      clientAccountId: 'acc1',
      issueDate: '2026-09-18',
      lines: [{ debitNoteId: 'nd1' }],
    } as unknown as CreateCashReceiptDto;

    await expect(service.create(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.cashReceipt.create).not.toHaveBeenCalled();
  });

  it('create rejects a line whose ND is BORRADOR', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 'acc1' });
    prisma.cashReceipt.findFirst.mockResolvedValue(null);
    prisma.debitNote.findUnique.mockResolvedValue({
      id: 'nd1',
      status: 'BORRADOR',
    });
    const dto = {
      clientAccountId: 'acc1',
      issueDate: '2026-09-18',
      lines: [{ debitNoteId: 'nd1', amountPaidBob: 100 }],
    } as unknown as CreateCashReceiptDto;

    await expect(service.create(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.cashReceipt.create).not.toHaveBeenCalled();
  });

  it('create validates that the client account exists', async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    const dto = {
      clientAccountId: 'nope',
      issueDate: '2026-09-18',
      lines: [{ debitNoteId: 'nd1', amountPaidBob: 100 }],
    } as unknown as CreateCashReceiptDto;

    await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('void restores ND balances/status and marks the receipt REVERSADO with motivo', async () => {
    prisma.cashReceipt.updateMany.mockResolvedValue({ count: 1 });
    prisma.cashReceipt.findUnique.mockResolvedValue({
      id: 'cr1',
      status: 'VALIDO',
      lines: [
        {
          id: 'pl1',
          debitNoteId: 'nd1',
          amountPaidBob: 100,
          amountPaidUsd: 0,
        },
      ],
    });
    prisma.debitNote.findUnique.mockResolvedValue({
      id: 'nd1',
      status: 'PAGADA',
      balanceBob: 0,
      balanceUsd: 0,
      paidAmountBob: 100,
      paidAmountUsd: 0,
    });
    prisma.debitNote.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'nd1', ...data }),
    );
    prisma.auditLog.create.mockResolvedValue({});

    const result = await service.void('cr1', 'error de caja', 'u1');

    expect(prisma.cashReceipt.updateMany).toHaveBeenCalledWith({
      where: { id: 'cr1', status: 'VALIDO' },
      data: { status: 'REVERSADO', voidReason: 'error de caja' },
    });
    expect(prisma.debitNote.update).toHaveBeenCalledWith({
      where: { id: 'nd1' },
      data: expect.objectContaining({
        balanceBob: 100,
        balanceUsd: 0,
        paidAmountBob: 0,
        paidAmountUsd: 0,
        status: 'IMPAGA',
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'VOID_RECEIPT',
          entityType: 'CASH_RECEIPT',
          userId: 'u1',
          reason: 'error de caja',
        }),
      }),
    );
    expect(result.status).toBe('REVERSADO');
  });

  it('void without motivo throws BadRequestException before touching the DB', async () => {
    await expect(service.void('cr1', '')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.cashReceipt.findUnique).not.toHaveBeenCalled();
  });

  it('void on an already-reversed receipt throws BadRequestException', async () => {
    prisma.cashReceipt.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.void('cr1', 'duplicado', 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.debitNote.update).not.toHaveBeenCalled();
  });

  it('void on a missing receipt throws BadRequestException', async () => {
    prisma.cashReceipt.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.void('cr1', 'no existe', 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('create rejects an overpayment that exceeds the ND balance', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 'acc1' });
    prisma.debitNote.findUnique.mockResolvedValue({
      id: 'nd1',
      status: 'IMPAGA',
      accountId: 'acc1',
      balanceBob: 100,
      balanceUsd: 0,
      paidAmountBob: 0,
      paidAmountUsd: 0,
    });
    const dto = {
      clientAccountId: 'acc1',
      issueDate: '2026-09-18',
      lines: [{ debitNoteId: 'nd1', amountPaidBob: 150 }],
    } as unknown as CreateCashReceiptDto;

    await expect(service.create(dto, 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.debitNote.update).not.toHaveBeenCalled();
    expect(prisma.cashReceipt.create).not.toHaveBeenCalled();
  });

  it('create rejects a line whose ND belongs to a different client', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 'acc1' });
    prisma.debitNote.findUnique.mockResolvedValue({
      id: 'nd1',
      status: 'IMPAGA',
      accountId: 'other-acc',
      balanceBob: 100,
      balanceUsd: 0,
      paidAmountBob: 0,
      paidAmountUsd: 0,
    });
    const dto = {
      clientAccountId: 'acc1',
      issueDate: '2026-09-18',
      lines: [{ debitNoteId: 'nd1', amountPaidBob: 50 }],
    } as unknown as CreateCashReceiptDto;

    await expect(service.create(dto, 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.debitNote.update).not.toHaveBeenCalled();
    expect(prisma.cashReceipt.create).not.toHaveBeenCalled();
  });

  it('create rejects paying an ND already in PAGADA status', async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 'acc1' });
    prisma.debitNote.findUnique.mockResolvedValue({
      id: 'nd1',
      status: 'PAGADA',
      accountId: 'acc1',
      balanceBob: 0,
      balanceUsd: 0,
      paidAmountBob: 100,
      paidAmountUsd: 0,
    });
    const dto = {
      clientAccountId: 'acc1',
      issueDate: '2026-09-18',
      lines: [{ debitNoteId: 'nd1', amountPaidBob: 50 }],
    } as unknown as CreateCashReceiptDto;

    await expect(service.create(dto, 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.cashReceipt.create).not.toHaveBeenCalled();
  });

  it('void only succeeds once; a second void on an already-REVERSADO receipt throws and does not reverse again', async () => {
    prisma.cashReceipt.updateMany.mockResolvedValue({ count: 1 });
    prisma.cashReceipt.findUnique.mockResolvedValue({
      id: 'cr1',
      status: 'VALIDO',
      lines: [
        {
          id: 'pl1',
          debitNoteId: 'nd1',
          amountPaidBob: 100,
          amountPaidUsd: 0,
        },
      ],
    });
    prisma.debitNote.findUnique.mockResolvedValue({
      id: 'nd1',
      status: 'PAGADA',
      balanceBob: 0,
      balanceUsd: 0,
      paidAmountBob: 100,
      paidAmountUsd: 0,
    });
    prisma.debitNote.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'nd1', ...data }),
    );
    prisma.auditLog.create.mockResolvedValue({});

    await service.void('cr1', 'error', 'u1');
    expect(prisma.debitNote.update).toHaveBeenCalledTimes(1);

    prisma.cashReceipt.updateMany.mockResolvedValue({ count: 0 });
    prisma.debitNote.update.mockClear();

    await expect(service.void('cr1', 'error', 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.debitNote.update).not.toHaveBeenCalled();
  });
});
