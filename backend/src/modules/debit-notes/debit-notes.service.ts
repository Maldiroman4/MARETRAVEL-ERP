import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Currency, DebitNoteStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDebitNoteDto } from './dto/create-debit-note.dto';
import { UpdateDebitNoteDto } from './dto/update-debit-note.dto';
import { CorrectDebitNoteDto } from './dto/correct-debit-note.dto';

const DEFAULT_RATE = 6.96;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type Tx = Prisma.TransactionClient;

@Injectable()
export class DebitNotesService {
  constructor(private prisma: PrismaService) {}

  private async nextNdNumber(tx: Tx | PrismaService) {
    const last = await tx.debitNote.findFirst({
      orderBy: { ndNumber: 'desc' },
      select: { ndNumber: true },
    });
    return (last?.ndNumber ?? 0) + 1;
  }

  private async nextNcNumber(tx: Tx | PrismaService) {
    const last = await tx.creditNote.findFirst({
      orderBy: { ncNumber: 'desc' },
      select: { ncNumber: true },
    });
    return (last?.ncNumber ?? 0) + 1;
  }

  private assertMotivo(motivo?: string) {
    if (!motivo || !motivo.trim()) {
      throw new BadRequestException('El motivo es obligatorio');
    }
  }

  async findAll(status?: DebitNoteStatus) {
    const where: Prisma.DebitNoteWhereInput = {};
    if (status) where.status = status;
    return this.prisma.debitNote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true, creditNotes: true, client: true },
    });
  }

  async findOne(id: string) {
    const nd = await this.prisma.debitNote.findUnique({
      where: { id },
      include: { items: true, creditNotes: true, client: true },
    });
    if (!nd) throw new NotFoundException('Nota de débito no encontrada');
    return nd;
  }

  async create(dto: CreateDebitNoteDto, userId?: string) {
    const rate = dto.exchangeRate ?? DEFAULT_RATE;
    const sumItems = dto.items.reduce((s, i) => s + Number(i.totalAmount), 0);
    let totalAmountBob: number;
    let totalAmountUsd: number;
    if (dto.currency === Currency.BOB) {
      totalAmountBob = round2(sumItems);
      totalAmountUsd = round2(sumItems / rate);
    } else {
      totalAmountUsd = round2(sumItems);
      totalAmountBob = round2(sumItems * rate);
    }

    const ndNumber = await this.nextNdNumber(this.prisma);

    return this.prisma.debitNote.create({
      data: {
        ndNumber,
        accountId: dto.accountId,
        issueDate: new Date(dto.issueDate),
        paymentTerm: dto.paymentTerm,
        currency: dto.currency,
        totalAmountBob,
        totalAmountUsd,
        paidAmountBob: 0,
        paidAmountUsd: 0,
        balanceBob: totalAmountBob,
        balanceUsd: totalAmountUsd,
        status: 'BORRADOR',
        observations: dto.observations,
        createdById: userId,
        items: {
          create: dto.items.map((i) => ({
            serviceType: i.serviceType,
            ticketId: i.ticketId,
            ticketNumber: i.ticketNumber,
            passengerName: i.passengerName,
            operatorId: i.operatorId,
            description: i.description,
            currency: i.currency,
            totalAmount: Number(i.totalAmount),
            feeAmount: Number(i.feeAmount ?? 0),
            providerCommissionRate: Number(i.providerCommissionRate ?? 0),
            providerCommissionAmount: Number(i.providerCommissionAmount ?? 0),
            clientCommissionRate: Number(i.clientCommissionRate ?? 0),
            clientCommissionAmount: Number(i.clientCommissionAmount ?? 0),
            netCostToProvider: Number(i.netCostToProvider ?? i.totalAmount),
          })),
        },
      },
      include: { items: true },
    });
  }

  async update(id: string, dto: UpdateDebitNoteDto) {
    await this.findOne(id);
    const data: Prisma.DebitNoteUpdateInput = {};
    if (dto.issueDate) data.issueDate = new Date(dto.issueDate);
    if (dto.requesterText !== undefined) data.requesterText = dto.requesterText;
    if (dto.passengerName !== undefined) data.passengerName = dto.passengerName;
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    if (dto.paymentTerm) data.paymentTerm = dto.paymentTerm;
    if (dto.observations !== undefined) data.observations = dto.observations;
    return this.prisma.debitNote.update({
      where: { id },
      data,
      include: { items: true, creditNotes: true },
    });
  }

  async close(id: string) {
    const nd = await this.prisma.debitNote.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!nd) throw new NotFoundException('Nota de débito no encontrada');
    if (nd.status !== 'BORRADOR') {
      throw new BadRequestException(
        'Solo se pueden cerrar notas de débito en estado BORRADOR',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of nd.items) {
        if (item.ticketId) {
          await tx.ticket.update({
            where: { id: item.ticketId },
            data: { status: 'ASIGNADO' },
          });
        }
      }

      const groups = new Map<string, number[]>();
      for (const item of nd.items) {
        if (!item.operatorId) continue;
        const value = Number(item.netCostToProvider ?? item.totalAmount);
        const arr = groups.get(item.operatorId) ?? [];
        arr.push(value);
        groups.set(item.operatorId, arr);
      }

      let ncNumber = await this.nextNcNumber(tx);
      for (const [operatorId, values] of groups) {
        const sum = values.reduce((a, b) => a + b, 0);
        let bob: number;
        let usd: number;
        if (nd.currency === Currency.BOB) {
          bob = round2(sum);
          usd = round2(sum / DEFAULT_RATE);
        } else {
          usd = round2(sum);
          bob = round2(sum * DEFAULT_RATE);
        }
        await tx.creditNote.create({
          data: {
            ncNumber: ncNumber++,
            debitNoteId: nd.id,
            providerAccountId: operatorId,
            isAutomatic: true,
            concept: 'NC automática por cierre de ND',
            currency: nd.currency,
            totalAmountBob: bob,
            totalAmountUsd: usd,
            paidAmountBob: 0,
            paidAmountUsd: 0,
            balanceBob: bob,
            balanceUsd: usd,
            status: 'PENDIENTE',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'CLOSE',
          entityType: 'DEBIT_NOTE',
          entityId: nd.id,
          newValue: { status: 'IMPAGA' },
        },
      });

      return tx.debitNote.update({
        where: { id },
        data: { status: 'IMPAGA' },
        include: { items: true, creditNotes: true },
      });
    });
  }

  async reopen(id: string) {
    const nd = await this.prisma.debitNote.findUnique({
      where: { id },
      include: { items: true, paymentLines: true, creditNotes: true },
    });
    if (!nd) throw new NotFoundException('Nota de débito no encontrada');
    if (nd.status !== 'IMPAGA' && nd.status !== 'PARCIAL') {
      throw new BadRequestException(
        'Solo se pueden reabrir notas de débito cerradas (IMPAGA/PARCIAL)',
      );
    }
    const hasPayments =
      nd.paymentLines.length > 0 ||
      Number(nd.paidAmountBob) > 0 ||
      Number(nd.paidAmountUsd) > 0 ||
      nd.creditNotes.some(
        (c) => Number(c.paidAmountBob) > 0 || Number(c.paidAmountUsd) > 0,
      );
    if (hasPayments) {
      throw new BadRequestException(
        'No se puede reabrir una nota de débito con pagos registrados',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of nd.items) {
        if (item.ticketId) {
          await tx.ticket.update({
            where: { id: item.ticketId },
            data: { status: 'DISPONIBLE' },
          });
        }
      }
      await tx.creditNote.updateMany({
        where: { debitNoteId: id, isAutomatic: true },
        data: { status: 'ANULADA', voidReason: 'Reapertura de ND' },
      });
      await tx.auditLog.create({
        data: {
          action: 'REOPEN',
          entityType: 'DEBIT_NOTE',
          entityId: id,
          newValue: { status: 'BORRADOR' },
        },
      });
      return tx.debitNote.update({
        where: { id },
        data: { status: 'BORRADOR' },
        include: { items: true, creditNotes: true },
      });
    });
  }

  async void(id: string, motivo?: string) {
    this.assertMotivo(motivo);
    const nd = await this.prisma.debitNote.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!nd) throw new NotFoundException('Nota de débito no encontrada');

    return this.prisma.$transaction(async (tx) => {
      for (const item of nd.items) {
        if (item.ticketId) {
          await tx.ticket.update({
            where: { id: item.ticketId },
            data: { status: 'DISPONIBLE' },
          });
        }
      }
      await tx.creditNote.updateMany({
        where: { debitNoteId: id, isAutomatic: true },
        data: { status: 'ANULADA', voidReason: motivo },
      });
      const appended = nd.observations?.trim()
        ? `${nd.observations.trim()} | ANULADA: ${motivo}`
        : `ANULADA: ${motivo}`;
      await tx.auditLog.create({
        data: {
          action: 'VOID',
          entityType: 'DEBIT_NOTE',
          entityId: id,
          reason: motivo,
          newValue: { status: 'ANULADA' },
        },
      });
      return tx.debitNote.update({
        where: { id },
        data: { status: 'ANULADA', observations: appended },
        include: { items: true, creditNotes: true },
      });
    });
  }

  async correct(id: string, dto: CorrectDebitNoteDto) {
    this.assertMotivo(dto.motivo);
    const nd = await this.prisma.debitNote.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!nd) throw new NotFoundException('Nota de débito no encontrada');

    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.DebitNoteUpdateInput = {};
      const oldValue: Record<string, unknown> = {};
      const newValue: Record<string, unknown> = {};

      if (dto.issueDate) {
        oldValue.issueDate = nd.issueDate;
        newValue.issueDate = dto.issueDate;
        data.issueDate = new Date(dto.issueDate);
      }
      if (dto.requesterText !== undefined) {
        oldValue.requesterText = nd.requesterText;
        newValue.requesterText = dto.requesterText;
        data.requesterText = dto.requesterText;
      }
      if (dto.observations !== undefined) {
        oldValue.observations = nd.observations;
        newValue.observations = dto.observations;
        data.observations = dto.observations;
      }

      if (dto.nit !== undefined || dto.legalName !== undefined) {
        const accountData: Prisma.AccountUpdateInput = {};
        if (dto.nit !== undefined) {
          oldValue.nit = nd.client?.nit;
          newValue.nit = dto.nit;
          accountData.nit = dto.nit;
        }
        if (dto.legalName !== undefined) {
          oldValue.legalName = nd.client?.legalName;
          newValue.legalName = dto.legalName;
          accountData.legalName = dto.legalName;
        }
        await tx.account.update({
          where: { id: nd.accountId },
          data: accountData,
        });
      }

      if (Object.keys(data).length > 0) {
        await tx.debitNote.update({ where: { id }, data });
      }

      await tx.auditLog.create({
        data: {
          action: 'CORRECT',
          entityType: 'DEBIT_NOTE',
          entityId: id,
          oldValue: oldValue as Prisma.InputJsonValue,
          newValue: newValue as Prisma.InputJsonValue,
          reason: dto.motivo,
        },
      });

      return tx.debitNote.findUnique({
        where: { id },
        include: { items: true, creditNotes: true, client: true },
      });
    });
  }
}
