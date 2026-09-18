import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

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

beforeAll(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});