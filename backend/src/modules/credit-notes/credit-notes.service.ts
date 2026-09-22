import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CreditNotesService {
  constructor(private prisma: PrismaService) {}

  private async nextNcNumber(tx: Tx | PrismaService) {
    const last = await tx.creditNote.findFirst({
      orderBy: { ncNumber: 'desc' },
      select: { ncNumber: true },
    });
    return (last?.ncNumber ?? 0) + 1;
  }

  private assertAmounts(dto: CreateCreditNoteDto) {
    const bob = Number(dto.totalAmountBob ?? 0);
    const usd = Number(dto.totalAmountUsd ?? 0);
    if (bob <= 0 && usd <= 0) {
      throw new BadRequestException(
        'El monto total (BOB o USD) debe ser mayor a 0',
      );
    }
  }

  async findAll(status?: string) {
    const where: Prisma.CreditNoteWhereInput = {};
    if (status) where.status = status;
    return this.prisma.creditNote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { provider: true, debitNote: true },
    });
  }

  async findOne(id: string) {
    const nc = await this.prisma.creditNote.findUnique({
      where: { id },
      include: { provider: true, debitNote: true },
    });
    if (!nc) throw new NotFoundException('Nota de crédito no encontrada');
    return nc;
  }

  async create(dto: CreateCreditNoteDto, userId?: string) {
    this.assertAmounts(dto);
    const ncNumber = await this.nextNcNumber(this.prisma);
    const totalAmountBob = Number(dto.totalAmountBob ?? 0);
    const totalAmountUsd = Number(dto.totalAmountUsd ?? 0);

    const nc = await this.prisma.creditNote.create({
      data: {
        ncNumber,
        debitNoteId: dto.debitNoteId,
        providerAccountId: dto.providerAccountId,
        isAutomatic: false,
        concept: dto.concept,
        currency: dto.currency,
        totalAmountBob,
        totalAmountUsd,
        paidAmountBob: 0,
        paidAmountUsd: 0,
        balanceBob: totalAmountBob,
        balanceUsd: totalAmountUsd,
        status: 'PENDIENTE',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'CREATE_NC',
        entityType: 'CREDIT_NOTE',
        entityId: nc.id,
        userId,
        newValue: {
          ncNumber,
          concept: dto.concept,
          currency: dto.currency,
          totalAmountBob,
          totalAmountUsd,
        },
      },
    });

    return nc;
  }

  async void(id: string, motivo?: string, userId?: string) {
    if (!motivo || !motivo.trim()) {
      throw new BadRequestException('El motivo es obligatorio');
    }
    const nc = await this.prisma.creditNote.findUnique({ where: { id } });
    if (!nc) throw new NotFoundException('Nota de crédito no encontrada');

    return this.prisma.$transaction(async (tx) => {
      const guard = await tx.creditNote.updateMany({
        where: {
          id,
          status: { in: ['PENDIENTE', 'PARCIAL'] },
        },
        data: { status: 'ANULADA', voidReason: motivo },
      });
      if (guard.count !== 1) {
        throw new BadRequestException(
          'No se puede anular una nota de crédito en su estado actual',
        );
      }

      await tx.auditLog.create({
        data: {
          action: 'VOID_NC',
          entityType: 'CREDIT_NOTE',
          entityId: id,
          userId,
          reason: motivo,
          newValue: { status: 'ANULADA' },
        },
      });

      return tx.creditNote.update({
        where: { id },
        data: { status: 'ANULADA', voidReason: motivo },
      });
    });
  }
}
