import { PrismaClient, Currency } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
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
    { code: 'BS-02', name: 'Banco Nacional de Bolivia BNB BOB', currency: Currency.BOB, type: 'AMBOS', bankAccount: 'Cta. Cte. 100-29384-2' },
  ];
  for (const pm of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { code: pm.code },
      update: {},
      create: pm,
    });
  }

  const serviceTypes = [
    { code: 'BOLETO_GDS', name: 'BOLETO AÉREO / GDS', category: 'AÉREO' },
    { code: 'HOTEL', name: 'HOTEL / HOSPEDAJE', category: 'HOSPEDAJE' },
    { code: 'PAQUETE', name: 'PAQUETE TURÍSTICO', category: 'PAQUETES' },
  ];
  for (const st of serviceTypes) {
    await prisma.serviceTypeCatalog.upsert({
      where: { code: st.code },
      update: {},
      create: st,
    });
  }

  await prisma.financialAccount.createMany({
    data: [
      { type: 'BANCO', bankName: 'Banco Mercantil Santa Cruz BMSC', accountNumber: '401-09823-1', currency: Currency.BOB, currentBalance: 45200 },
      { type: 'BANCO', bankName: 'Banco Bisa S.A.', accountNumber: '029-91823-7', currency: Currency.USD, currentBalance: 12400 },
      { type: 'EFECTIVO', bankName: 'Caja Central BOB', currency: Currency.BOB, currentBalance: 5000 },
      { type: 'EFECTIVO', bankName: 'Caja Central USD', currency: Currency.USD, currentBalance: 2100 },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });