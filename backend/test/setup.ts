import 'dotenv/config';
import { PrismaClient, Currency } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function cleanDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      debit_note_items,
      payment_lines,
      credit_notes,
      cash_receipts,
      debit_notes,
      tickets,
      audit_logs
    CASCADE;
  `);
}

async function seedMasterData() {
  const passwordHash = await bcrypt.hash('585858', 10);
  await prisma.user.upsert({
    where: { username: 'luis' },
    update: {},
    create: {
      username: 'luis',
      passwordHash,
      name: 'Luis',
      role: 'ADMIN',
      email: 'luis@maretravel.bo',
    },
  });

  const paymentMethods = [
    { code: 'BS-01', name: 'Efectivo Moneda Nacional (BOB)', currency: Currency.BOB, type: 'COBRANZAS' },
    { code: 'US-01', name: 'Efectivo Dólares Americanos (USD)', currency: Currency.USD, type: 'COBRANZAS' },
  ];
  for (const pm of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { code: pm.code },
      update: {},
      create: pm,
    });
  }

  await prisma.serviceTypeCatalog.upsert({
    where: { code: 'BOLETO_GDS' },
    update: {},
    create: { code: 'BOLETO_GDS', name: 'BOLETO AÉREO / GDS', category: 'AÉREO' },
  });
}

beforeAll(async () => {
  await cleanDatabase();
  await seedMasterData();
});

afterAll(async () => {
  await prisma.$disconnect();
});