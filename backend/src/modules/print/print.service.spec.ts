import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrintService } from './print.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PrintService', () => {
  let service: PrintService;

  const prisma = {
    debitNote: { findUnique: jest.fn() },
    creditNote: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [PrintService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(PrintService);
  });

  it('render ND returns membretado HTML containing the ND number and logo', async () => {
    prisma.debitNote.findUnique.mockResolvedValue({
      id: 'nd1',
      ndNumber: 4001,
      issueDate: new Date('2026-09-18'),
      requesterText: 'GERENCIA GENERAL',
      currency: 'BOB',
      totalAmountBob: 150,
      totalAmountUsd: 21.55,
      observations: 'PRUEBA',
      client: { code: 'CLI-001', name: 'ACME' },
      items: [
        {
          serviceType: 'BOLETO_GDS',
          description: 'Vuelo LPB-CBB',
          currency: 'BOB',
          totalAmount: 150,
          ticketNumber: 'TKT123',
          passengerName: 'Ana',
        },
      ],
    });

    const html = await service.render('ND', 'nd1');

    expect(html).toContain('NOTA DE DÉBITO');
    expect(html).toContain('4001');
    expect(html).toContain('ACME');
    expect(html).toContain('data:image');
    expect(prisma.debitNote.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'nd1' } }),
    );
  });

  it('render NC returns HTML containing the NC number and provider', async () => {
    prisma.creditNote.findUnique.mockResolvedValue({
      id: 'nc1',
      ncNumber: 100,
      concept: 'NC POR CIERRE',
      currency: 'USD',
      totalAmountBob: 700,
      totalAmountUsd: 100,
      provider: { code: 'PRV-001', name: 'BOLIVIANA DE AVIACION' },
    });

    const html = await service.render('NC', 'nc1');

    expect(html).toContain('NOTA DE CRÉDITO');
    expect(html).toContain('100');
    expect(html).toContain('BOLIVIANA DE AVIACION');
    expect(prisma.creditNote.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'nc1' } }),
    );
  });

  it('throws NotFoundException when the ND does not exist', async () => {
    prisma.debitNote.findUnique.mockResolvedValue(null);
    await expect(service.render('ND', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws NotFoundException when the NC does not exist', async () => {
    prisma.creditNote.findUnique.mockResolvedValue(null);
    await expect(service.render('NC', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws BadRequestException for an invalid docType', async () => {
    await expect(service.render('XX' as 'ND', 'x')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
