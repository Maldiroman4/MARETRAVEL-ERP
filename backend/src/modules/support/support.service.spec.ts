/* eslint-disable @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access */
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SupportService } from './support.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SupportService', () => {
  let service: SupportService;

  const prisma = {
    serviceTypeCatalog: { findMany: jest.fn() },
    paymentMethod: { findMany: jest.fn() },
    exchangeRate: { findFirst: jest.fn() },
    systemSetting: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [SupportService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(SupportService);
  });

  it('findServiceTypes returns the catalog rows', async () => {
    prisma.serviceTypeCatalog.findMany.mockResolvedValue([
      { id: 's1', code: 'BOLETO_GDS', name: 'Boleto GDS', category: 'AEREOS' },
    ]);
    const result = await service.findServiceTypes();
    expect(prisma.serviceTypeCatalog.findMany).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('BOLETO_GDS');
  });

  it('findPaymentMethods returns all payment methods', async () => {
    prisma.paymentMethod.findMany.mockResolvedValue([
      {
        id: 'p1',
        code: 'EFECTIVO',
        name: 'Efectivo',
        currency: 'BOB',
        type: 'CAJA',
      },
    ]);
    const result = await service.findPaymentMethods();
    expect(prisma.paymentMethod.findMany).toHaveBeenCalledTimes(1);
    expect(result[0].code).toBe('EFECTIVO');
  });

  it('getExchangeRate returns the latest rate ordered by date desc', async () => {
    prisma.exchangeRate.findFirst.mockResolvedValue({
      id: 'r1',
      date: new Date('2026-09-18'),
      buyRate: 6.95,
      sellRate: 6.97,
    });
    const result = await service.getExchangeRate();
    expect(prisma.exchangeRate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { date: 'desc' },
        take: 1,
      }),
    );
    expect(result.buyRate).toBe(6.95);
    expect(result.sellRate).toBe(6.97);
  });

  it('updateSettings upserts each key and returns stored settings', async () => {
    prisma.systemSetting.upsert.mockImplementation(
      ({ where, update, create }: any) =>
        Promise.resolve({
          id: 'x',
          key: where.key,
          value: update.value ?? create.value,
        }),
    );
    prisma.systemSetting.findMany.mockResolvedValue([
      { id: 'x', key: 'agencyName', value: 'MARETRAVEL' },
    ]);

    const result = await service.updateSettings({ agencyName: 'MARETRAVEL' });

    expect(prisma.systemSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'agencyName' },
      update: { value: 'MARETRAVEL' },
      create: { key: 'agencyName', value: 'MARETRAVEL' },
    });
    expect(result).toEqual({ agencyName: 'MARETRAVEL' });
  });

  it('updateSettings rejects a non-object body', async () => {
    await expect(
      service.updateSettings(['nope'] as unknown as Record<string, unknown>),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
