import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is Prisma.InputJsonValue {
  if (value === null) return true;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return true;
  if (Array.isArray(value)) return value.every((v) => isJsonValue(v));
  if (isPlainObject(value)) {
    return Object.values(value).every((v) => isJsonValue(v));
  }
  return false;
}

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  findServiceTypes() {
    return this.prisma.serviceTypeCatalog.findMany({
      orderBy: { code: 'asc' },
    });
  }

  findPaymentMethods() {
    return this.prisma.paymentMethod.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async getExchangeRate() {
    const latest = await this.prisma.exchangeRate.findFirst({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 1,
    });
    if (!latest) {
      return { id: null, date: null, buyRate: null, sellRate: null };
    }
    return {
      id: latest.id,
      date: latest.date,
      buyRate: Number(latest.buyRate),
      sellRate: Number(latest.sellRate),
    };
  }

  async updateExchangeRate(buyRate: number, sellRate: number) {
    if (isNaN(buyRate) || buyRate <= 0 || isNaN(sellRate) || sellRate <= 0) {
      throw new BadRequestException(
        'Los valores de compra y venta deben ser números positivos válidos.',
      );
    }
    const created = await this.prisma.exchangeRate.create({
      data: {
        date: new Date(),
        buyRate,
        sellRate,
        createdById: 'USR-001',
      },
    });
    return {
      id: created.id,
      date: created.date,
      buyRate: Number(created.buyRate),
      sellRate: Number(created.sellRate),
    };
  }

  async updateSettings(input: Record<string, unknown>) {
    if (!isPlainObject(input)) {
      throw new BadRequestException(
        'El cuerpo debe ser un objeto JSON de configuración',
      );
    }
    const map = isPlainObject(input.settings) ? input.settings : input;
    if (!isPlainObject(map)) {
      throw new BadRequestException(
        'El cuerpo debe ser un objeto JSON de configuración',
      );
    }

    for (const key of Object.keys(map)) {
      const value = map[key];
      if (!isJsonValue(value)) {
        throw new BadRequestException(
          `El valor de "${key}" no es un valor JSON válido`,
        );
      }
      await this.prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    const stored = await this.prisma.systemSetting.findMany();
    return Object.fromEntries(stored.map((s) => [s.key, s.value]));
  }
}
