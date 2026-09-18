import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CashReceiptStatus, DebitNoteStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCashReceiptDto } from './dto/create-cash-receipt.dto';

const DEFAULT_RATE = 6.96;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type Tx = Prisma.TransactionClient;

@Injectable()
export class CashReceiptsService {
  constructor(private prisma: PrismaService) {}

  private async nextReceiptNumber(tx: Tx | PrismaService) {
    const last = await tx.cashReceipt.findFirst({
      orderBy: { receiptNumber: 'desc' },
      select: { receiptNumber: true },
    });
    return (last?.receiptNumber ?? 0) + 1;
  }

  private assertLines(dto: CreateCashReceiptDto) {
    for (const line of dto.lines) {
      const bob = Number(line.amountPaidBob ?? 0);
      const usd = Number(line.amountPaidUsd ?? 0);
      if (bob <= 0 && usd <= 0) {
        throw new BadRequestException(
          'Cada línea de pago debe tener un monto mayor a 0 en BOB o USD',
        );
      }
    }
  }

  private assertMotivo(motivo?: string) {
    if (!motivo || !motivo.trim()) {
      throw new BadRequestException('El motivo es obligatorio');
    }
  }

  async findAll() {
    return this.prisma.cashReceipt.findMany({
      orderBy: { createdAt: 'desc' },
      include: { lines: true, client: true },
    });
  }

  async findOne(id: string) {
    const receipt = await this.prisma.cashReceipt.findUnique({
      where: { id },
      include: { lines: true, client: true },
    });
    if (!receipt) {
      throw new NotFoundException('Recibo de caja no encontrado');
    }
    return receipt;
  }

  async create(dto: CreateCashReceiptDto, userId?: string) {
    this.assertLines(dto);

    const client = await this.prisma.account.findUnique({
      where: { id: dto.clientAccountId },
    });
    if (!client) {
      throw new NotFoundException('Cuenta del cliente no encontrada');
    }

    const receiptNumber = await this.nextReceiptNumber(this.prisma);
    const exchangeRate = dto.exchangeRate ?? DEFAULT_RATE;
    const totalPaidBob = round2(
      dto.lines.reduce((s, l) => s + Number(l.amountPaidBob ?? 0), 0),
    );
    const totalPaidUsd = round2(
      dto.lines.reduce((s, l) => s + Number(l.amountPaidUsd ?? 0), 0),
    );

    return this.prisma.$transaction(async (tx) => {
      for (const line of dto.lines) {
        const nd = await tx.debitNote.findUnique({
          where: { id: line.debitNoteId },
        });
        if (!nd) {
          throw new NotFoundException('Nota de débito no encontrada');
        }
        if (
          nd.status === DebitNoteStatus.BORRADOR ||
          nd.status === DebitNoteStatus.ANULADA
        ) {
          throw new BadRequestException(
            'No se puede pagar una nota de débito en estado BORRADOR o ANULADA',
          );
        }

        const paidBob = Number(line.amountPaidBob ?? 0);
        const paidUsd = Number(line.amountPaidUsd ?? 0);
        const newBalanceBob = round2(
          Math.max(Number(nd.balanceBob) - paidBob, 0),
        );
        const newBalanceUsd = round2(
          Math.max(Number(nd.balanceUsd) - paidUsd, 0),
        );
        const newPaidBob = round2(Number(nd.paidAmountBob) + paidBob);
        const newPaidUsd = round2(Number(nd.paidAmountUsd) + paidUsd);
        const newStatus =
          newBalanceBob <= 0 && newBalanceUsd <= 0
            ? DebitNoteStatus.PAGADA
            : DebitNoteStatus.PARCIAL;

        await tx.debitNote.update({
          where: { id: line.debitNoteId },
          data: {
            balanceBob: newBalanceBob,
            balanceUsd: newBalanceUsd,
            paidAmountBob: newPaidBob,
            paidAmountUsd: newPaidUsd,
            status: newStatus,
          },
        });
      }

      const receipt = await tx.cashReceipt.create({
        data: {
          receiptNumber,
          clientAccountId: dto.clientAccountId,
          issueDate: new Date(dto.issueDate),
          status: CashReceiptStatus.VALIDO,
          exchangeRate,
          totalPaidBob,
          totalPaidUsd,
          createdById: userId,
          lines: {
            create: dto.lines.map((l) => ({
              debitNoteId: l.debitNoteId,
              amountPaidBob: Number(l.amountPaidBob ?? 0),
              amountPaidUsd: Number(l.amountPaidUsd ?? 0),
              paymentMethodId: l.paymentMethodId,
            })),
          },
        },
        include: { lines: true },
      });

      await tx.auditLog.create({
        data: {
          action: 'CREATE_RECEIPT',
          entityType: 'CASH_RECEIPT',
          entityId: receipt.id,
          userId,
          newValue: {
            receiptNumber,
            totalPaidBob,
            totalPaidUsd,
          },
        },
      });

      return receipt;
    });
  }

  async void(id: string, motivo?: string, userId?: string) {
    this.assertMotivo(motivo);

    const receipt = await this.prisma.cashReceipt.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!receipt || receipt.status !== CashReceiptStatus.VALIDO) {
      throw new BadRequestException(
        'Solo se pueden reversar recibos de caja en estado VÁLIDO',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const line of receipt.lines) {
        const nd = await tx.debitNote.findUnique({
          where: { id: line.debitNoteId },
        });
        if (!nd) {
          throw new NotFoundException('Nota de débito no encontrada');
        }

        const paidBob = Number(line.amountPaidBob);
        const paidUsd = Number(line.amountPaidUsd);
        const newBalanceBob = round2(Number(nd.balanceBob) + paidBob);
        const newBalanceUsd = round2(Number(nd.balanceUsd) + paidUsd);
        const newPaidBob = round2(
          Math.max(Number(nd.paidAmountBob) - paidBob, 0),
        );
        const newPaidUsd = round2(
          Math.max(Number(nd.paidAmountUsd) - paidUsd, 0),
        );

        let newStatus: DebitNoteStatus;
        if (newPaidBob <= 0 && newPaidUsd <= 0) {
          newStatus = DebitNoteStatus.IMPAGA;
        } else if (newBalanceBob <= 0 && newBalanceUsd <= 0) {
          newStatus = DebitNoteStatus.PAGADA;
        } else {
          newStatus = DebitNoteStatus.PARCIAL;
        }

        await tx.debitNote.update({
          where: { id: line.debitNoteId },
          data: {
            balanceBob: newBalanceBob,
            balanceUsd: newBalanceUsd,
            paidAmountBob: newPaidBob,
            paidAmountUsd: newPaidUsd,
            status: newStatus,
          },
        });
      }

      const updated = await tx.cashReceipt.update({
        where: { id },
        data: { status: CashReceiptStatus.REVERSADO, voidReason: motivo },
        include: { lines: true },
      });

      await tx.auditLog.create({
        data: {
          action: 'VOID_RECEIPT',
          entityType: 'CASH_RECEIPT',
          entityId: id,
          userId,
          reason: motivo,
          newValue: { status: CashReceiptStatus.REVERSADO },
        },
      });

      return updated;
    });
  }
}
