# Migración a Backend NestJS + Prisma + PostgreSQL (Fase 1) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un backend monolítico NestJS + Prisma sobre PostgreSQL 14 (contenedor Docker local) que reemplace la persistencia `localStorage`/`server.js` del frontend vanilla para el núcleo financiero (cuentas, NDs, NCs, caja, boletos), autenticado por JWT.

**Architecture:** Backend NestJS monolítico en `backend/` (monorepo). Prisma ORM sobre PostgreSQL 14 en Docker. API REST por recursos bajo `/api/*`. Autenticación JWT + bcrypt. El frontend vanilla se mantiene y consume la API vía `js/api.js` + adaptadores por módulo. Migración incremental por módulos.

**Tech Stack:** NestJS 10, TypeScript estricto, Prisma, PostgreSQL 14 (Docker), JWT (`@nestjs/jwt`), bcrypt, class-validator, class-transformer, Jest + Supertest.

## Global Constraints

- **Rama de trabajo:** `feat/nestjs-backend` (ya creada). No tocar `develop`.
- **Node >= 18** (entorno: v22). npm 10.
- **PostgreSQL 14** vía contenedor Docker local (`docker-compose.yml`), puerto `5432`.
- **Prefijo de API:** `/api/*` global.
- **Autenticación:** todos los endpoints `/api/*` exigen `Authorization: Bearer <JWT>`, excepto `POST /api/auth/login` y `GET /api/health` (marcados `@Public()`).
- **Moneda:** montos BOB/USD **por separado**; campos `*Bob` y `*Usd`. Precisión `Decimal(14,2)`.
- **Regla transversal:** toda mutación sensible (cerrar/reabrir/anular/corregir ND, revertir caja, anular NC) exige campo `motivo` (string no vacío) y registra en el `auditLog`.
- **TDD:** escribir primero el test que falla, luego implementar, luego verificar que pasa.
- **TypeScript estricto** (`strict: true`).
- **Sin placeholders:** todo endpoint y función debe estar implementado y testeado.

---

### Task 1: Levantar PostgreSQL 14 en Docker + estructura base del monorepo

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/.env.example`
- Create: `backend/.env`
- Create: `backend/.gitignore`
- Modify: `.gitignore` (raíz) si no cubre `backend/node_modules`, `backend/dist`, `.env`

**Interfaces:**
- Produces: contenedor `maretravel-db` con PostgreSQL 14 accesible en `localhost:5432`, usuario `maretravel`, clave `maretravel`, base `maretravel_erp`. Variables de entorno consumidas por el `DATABASE_URL` de Prisma en Task 2.

- [ ] **Step 1: Crear `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:14
    container_name: maretravel-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: maretravel
      POSTGRES_PASSWORD: maretravel
      POSTGRES_DB: maretravel_erp
    ports:
      - "5432:5432"
    volumes:
      - maretravel_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U maretravel"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  maretravel_pgdata:
```

- [ ] **Step 2: Crear `backend/.env`**

```
DATABASE_URL="postgresql://maretravel:maretravel@localhost:5432/maretravel_erp?schema=public"
JWT_SECRET="maretravel-super-secret-cambiar-en-produccion"
JWT_EXPIRES_IN="8h"
PORT=3000
```

- [ ] **Step 3: Crear `backend/.env.example`** con las mismas claves pero valores de ejemplo (sin secretos reales).

- [ ] **Step 4: Crear `backend/.gitignore`**

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 5: Verificar que `.gitignore` raíz no comita `.env` ni `backend/node_modules`** — si falta, añadir entradas.

- [ ] **Step 6: Levantar el contenedor y verificar**

Run: `docker compose up -d db`
Run: `docker compose ps`
Expected: servicio `maretravel-db` con estado `running` (healthy).

- [ ] **Step 7: Verificar conectividad TCP al puerto 5432**

Run: `docker compose exec db pg_isready -U maretravel`
Expected: `localhost:5432 - accepting connections`

- [ ] **Step 8: Commit**

```bash
git add docker-compose.yml backend/.env.example backend/.env backend/.gitignore
git commit -m "chore: levantar PostgreSQL 14 en Docker y configurar entorno base del backend"
```

---

### Task 2: Scaffold del proyecto NestJS

**Files:**
- Create: `backend/` (scaffold vía CLI), `backend/tsconfig.json`, `backend/nest-cli.json`, `backend/package.json`, `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/src/app.controller.ts`, `backend/src/app.service.ts`

**Interfaces:**
- Produces: aplicación NestJS arrancable con prefijo `/api`, validación global de DTOs habilitada, y un endpoint `GET /api/health` público. Base para inyectar módulos en Tasks posteriores.

- [ ] **Step 1: Generar el scaffold NestJS**

Run (dentro de `backend/`):
```bash
npx @nestjs/cli new backend --package-manager npm --skip-git --language TS
```
Expected: proyecto creado en `backend/` con estructura estándar.

- [ ] **Step 2: Instalar dependencias de la capa de datos y seguridad**

Run (dentro de `backend/`):
```bash
npm i @nestjs/config @nestjs/jwt bcrypt class-validator class-transformer @prisma/client
npm i -D prisma @types/bcrypt
```

- [ ] **Step 3: Configurar `main.ts` para prefijo `/api`, validación global y CORS**

`backend/src/main.ts`:
```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();
  const port = process.env.PORT || 3000;
  await app.listen(port);
}
void bootstrap();
```

- [ ] **Step 4: Configurar `app.module.ts` con ConfigModule global**

`backend/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 5: Añadir endpoint de salud público en `app.controller.ts`**

```ts
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return { status: 'online', service: 'maretravel-backend' };
  }
}
```

- [ ] **Step 6: Verificar arranque**

Run: `npm run start:dev`
Expected: app corriendo en `http://localhost:3000`.
Run: `curl http://localhost:3000/api/health`
Expected: `{"status":"online","service":"maretravel-backend"}`

- [ ] **Step 7: Ejecutar el test unitario por defecto**

Run: `npm test`
Expected: PASS (test por defecto del scaffold).

- [ ] **Step 8: Commit**

```bash
git add backend
git commit -m "feat: scaffold NestJS con prefijo /api, validación global y health check"
```

---

### Task 3: Esquema Prisma del modelo de datos (Fase 1)

**Files:**
- Create: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: modelos `User`, `Account`, `CompanyContact`, `DebitNote`, `DebitNoteItem`, `CreditNote`, `Ticket`, `CashReceipt`, `PaymentLine`, `FinancialAccount`, `ServiceType`, `PaymentMethod`, `ExchangeRate` y `AuditLog`. Consumidos por `PrismaService` (Task 4) y por el seed (Task 5).

- [ ] **Step 1: Crear `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum RelationType { CLIENTE PROVEEDOR AMBOS }
enum AccountCategoryType { EMPRESA PERSONA AEROLINEA HOTEL ONG INSTITUCION RENT_A_CAR }
enum AccountRating { NORMAL IMPORTANTE VIP CRITICA }
enum GeneralStatus { ACTIVO INACTIVO }
enum Currency { BOB USD }
enum PaymentTerm { AL_CONTADO CREDITO_7_DIAS CREDITO_15_DIAS CREDITO_30_DIAS }
enum DebitNoteStatus { BORRADOR IMPAGA PARCIAL PAGADA ANULADA }
enum TicketStatus { DISPONIBLE ASIGNADO ANULADO REEMBOLSADO }
enum ServiceType { BOLETO_GDS HOTEL PAQUETE SEGURO TRANSFER PENALIDAD }
enum CashReceiptStatus { VALIDO REVERSADO }
enum FinancialAccountType { BANCO BINANCE EFECTIVO }

model User {
  id           String        @id @default(uuid())
  username     String        @unique
  passwordHash String        @map("password_hash")
  name         String
  role         String        @default("ADMIN")
  email        String?
  isActive     Boolean       @default(true) @map("is_active")
  createdAt    DateTime      @default(now()) @map("created_at")
  updatedAt    DateTime      @updatedAt @map("updated_at")
  auditLogs    AuditLog[]
  @@map("users")
}

model Account {
  id           String              @id @default(uuid())
  code         String              @unique
  name         String
  legalName    String?             @map("legal_name")
  nit          String?
  relationType RelationType        @map("relation_type")
  accountType  AccountCategoryType @map("account_type")
  rating       AccountRating       @default(NORMAL)
  department   String?
  city         String?
  address      String?
  phone        String?
  cellphone    String?
  email        String?
  status       GeneralStatus       @default(ACTIVO)
  createdAt    DateTime            @default(now()) @map("created_at")
  updatedAt    DateTime            @updatedAt @map("updated_at")
  contacts     CompanyContact[]
  debitNotes   DebitNote[]
  creditNotes  CreditNote[]
  auditLogs    AuditLog[]
  @@index([nit])
  @@index([relationType])
  @@map("accounts")
}

model CompanyContact {
  id         String   @id @default(uuid())
  companyId  String   @map("company_id")
  fullName   String   @map("full_name")
  department String?
  roleTitle  String?  @map("role_title")
  email      String?
  phone      String?
  isActive   Boolean  @default(true) @map("is_active")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
  company    Account  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  @@index([companyId])
  @@map("company_contacts")
}

model DebitNote {
  id              String          @id @default(uuid())
  ndNumber        Int             @unique @map("nd_number")
  accountId       String          @map("account_id")
  requesterText   String?         @map("requester_text")
  passengerName   String?         @map("passenger_name")
  issueDate       DateTime        @map("issue_date") @db.Date
  dueDate         DateTime?       @map("due_date") @db.Date
  paymentTerm     PaymentTerm     @default(AL_CONTADO) @map("payment_term")
  currency        Currency
  totalAmountBob  Decimal         @default(0) @map("total_amount_bob") @db.Decimal(14, 2)
  totalAmountUsd  Decimal         @default(0) @map("total_amount_usd") @db.Decimal(14, 2)
  paidAmountBob   Decimal         @default(0) @map("paid_amount_bob") @db.Decimal(14, 2)
  paidAmountUsd   Decimal         @default(0) @map("paid_amount_usd") @db.Decimal(14, 2)
  balanceBob      Decimal         @default(0) @map("balance_bob") @db.Decimal(14, 2)
  balanceUsd      Decimal         @default(0) @map("balance_usd") @db.Decimal(14, 2)
  status          DebitNoteStatus @default(BORRADOR)
  observations    String?
  createdById     String?         @map("created_by_id")
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")
  client          Account         @relation(fields: [accountId], references: [id], onDelete: Restrict)
  items           DebitNoteItem[]
  creditNotes     CreditNote[]
  auditLogs       AuditLog[]
  @@index([accountId])
  @@index([status])
  @@map("debit_notes")
}

model DebitNoteItem {
  id                     String      @id @default(uuid())
  debitNoteId            String      @map("debit_note_id")
  serviceType            ServiceType @map("service_type")
  ticketId               String?     @map("ticket_id")
  ticketNumber           String?     @map("ticket_number")
  passengerName          String      @map("passenger_name")
  operatorId             String?     @map("operator_id")
  description            String
  currency               Currency
  totalAmount            Decimal     @map("total_amount") @db.Decimal(14, 2)
  feeAmount              Decimal     @default(0) @map("fee_amount") @db.Decimal(14, 2)
  providerCommissionRate Decimal     @default(0) @map("provider_commission_rate") @db.Decimal(6, 2)
  providerCommissionAmount Decimal   @default(0) @map("provider_commission_amount") @db.Decimal(14, 2)
  clientCommissionRate   Decimal     @default(0) @map("client_commission_rate") @db.Decimal(6, 2)
  clientCommissionAmount Decimal     @default(0) @map("client_commission_amount") @db.Decimal(14, 2)
  netCostToProvider      Decimal     @map("net_cost_to_provider") @db.Decimal(14, 2)
  createdAt              DateTime    @default(now()) @map("created_at")
  debitNote              DebitNote   @relation(fields: [debitNoteId], references: [id], onDelete: Cascade)
  ticket                 Ticket?     @relation(fields: [ticketId], references: [id], onDelete: SetNull)
  @@index([debitNoteId])
  @@map("debit_note_items")
}

model CreditNote {
  id               String          @id @default(uuid())
  ncNumber         Int             @unique @map("nc_number")
  debitNoteId      String?         @map("debit_note_id")
  providerAccountId String          @map("provider_account_id")
  isAutomatic      Boolean         @default(false) @map("is_automatic")
  concept          String
  currency         Currency
  totalAmountBob   Decimal         @default(0) @map("total_amount_bob") @db.Decimal(14, 2)
  totalAmountUsd   Decimal         @default(0) @map("total_amount_usd") @db.Decimal(14, 2)
  paidAmountBob    Decimal         @default(0) @map("paid_amount_bob") @db.Decimal(14, 2)
  paidAmountUsd    Decimal         @default(0) @map("paid_amount_usd") @db.Decimal(14, 2)
  balanceBob       Decimal         @default(0) @map("balance_bob") @db.Decimal(14, 2)
  balanceUsd       Decimal         @default(0) @map("balance_usd") @db.Decimal(14, 2)
  status           String          @default("PENDIENTE")
  voidReason       String?         @map("void_reason")
  createdAt        DateTime        @default(now()) @map("created_at")
  provider         Account         @relation(fields: [providerAccountId], references: [id], onDelete: Restrict)
  debitNote        DebitNote?      @relation(fields: [debitNoteId], references: [id], onDelete: SetNull)
  auditLogs        AuditLog[]
  @@index([providerAccountId])
  @@map("credit_notes")
}

model Ticket {
  id               String       @id @default(uuid())
  ticketNumber     String       @unique @map("ticket_number")
  gdsSource        String       @default("AMADEUS") @map("gds_source")
  counterId        String?      @map("counter_id")
  issueDate        DateTime     @map("issue_date") @db.Date
  passengerName    String       @map("passenger_name")
  route            String
  airlineCode      String       @map("airline_code")
  operatorId       String       @map("operator_id")
  netAmount        Decimal      @map("net_amount") @db.Decimal(14, 2)
  taxAmount        Decimal      @default(0) @map("tax_amount") @db.Decimal(14, 2)
  totalAmount      Decimal      @map("total_amount") @db.Decimal(14, 2)
  currency         Currency
  commissionRate   Decimal      @default(0) @map("commission_rate") @db.Decimal(6, 2)
  commissionAmount Decimal      @default(0) @map("commission_amount") @db.Decimal(14, 2)
  feeAmount        Decimal      @default(0) @map("fee_amount") @db.Decimal(14, 2)
  status           TicketStatus @default(DISPONIBLE)
  createdAt        DateTime     @default(now()) @map("created_at")
  operator         Account      @relation(fields: [operatorId], references: [id], onDelete: Restrict)
  items            DebitNoteItem[]
  @@index([operatorId])
  @@index([status])
  @@map("tickets")
}

model CashReceipt {
  id             String            @id @default(uuid())
  receiptNumber  Int               @unique @map("receipt_number")
  clientAccountId String            @map("client_account_id")
  issueDate      DateTime          @map("issue_date") @db.Date
  status         CashReceiptStatus @default(VALIDO)
  totalPaidBob   Decimal           @default(0) @map("total_paid_bob") @db.Decimal(14, 2)
  totalPaidUsd   Decimal           @default(0) @map("total_paid_usd") @db.Decimal(14, 2)
  exchangeRate   Decimal           @default(6.96) @map("exchange_rate") @db.Decimal(10, 4)
  voidReason     String?           @map("void_reason")
  createdById    String?           @map("created_by_id")
  createdAt      DateTime          @default(now()) @map("created_at")
  client         Account           @relation(fields: [clientAccountId], references: [id], onDelete: Restrict)
  lines          PaymentLine[]
  auditLogs      AuditLog[]
  @@index([clientAccountId])
  @@map("cash_receipts")
}

model PaymentLine {
  id              String          @id @default(uuid())
  cashReceiptId   String          @map("cash_receipt_id")
  debitNoteId     String          @map("debit_note_id")
  amountPaidBob   Decimal         @default(0) @map("amount_paid_bob") @db.Decimal(14, 2)
  amountPaidUsd   Decimal         @default(0) @map("amount_paid_usd") @db.Decimal(14, 2)
  paymentMethodId String?         @map("payment_method_id")
  cashReceipt     CashReceipt     @relation(fields: [cashReceiptId], references: [id], onDelete: Cascade)
  debitNote       DebitNote       @relation(fields: [debitNoteId], references: [id], onDelete: Restrict)
  @@index([cashReceiptId])
  @@index([debitNoteId])
  @@map("payment_lines")
}

model FinancialAccount {
  id            String                @id @default(uuid())
  type          FinancialAccountType
  bankName      String?
  accountNumber String?
  currency      Currency
  bankAccountId String?               @map("bank_account_id")
  titularName   String?               @map("titular_name")
  isActive      Boolean               @default(true) @map("is_active")
  currentBalance Decimal              @default(0) @map("current_balance") @db.Decimal(14, 2)
  createdAt     DateTime              @default(now()) @map("created_at")
  @@index([type])
  @@index([isActive])
  @@map("financial_accounts")
}

model ServiceType {
  id       String      @id @default(uuid())
  code     String      @unique
  name     String
  category String
  @@map("service_types")
}

model PaymentMethod {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  currency    Currency
  type        String
  bankAccount String?
  status      String   @default("ACTIVO")
  @@map("payment_methods")
}

model ExchangeRate {
  id         String   @id @default(uuid())
  date       DateTime @map("date") @db.Date
  buyRate    Decimal  @map("buy_rate") @db.Decimal(10, 4)
  sellRate   Decimal  @map("sell_rate") @db.Decimal(10, 4)
  createdById String? @map("created_by_id")
  createdAt  DateTime @default(now()) @map("created_at")
  @@map("exchange_rates")
}

model AuditLog {
  id         String   @id @default(uuid())
  userId     String?  @map("user_id")
  action     String
  entityType String   @map("entity_type")
  entityId   String?  @map("entity_id")
  oldValue   Json?
  newValue   Json?
  reason     String?
  createdAt  DateTime @default(now()) @map("created_at")
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  @@map("audit_logs")
}
```

**Nota:** `AuditLog` se declara sin relaciones FK hacia las entidades (solo metadatos `entityType`/`entityId`) porque las relaciones polimórficas no son válidas en Prisma. Por tanto, **quitar** la línea `auditLogs    AuditLog[]` de los modelos `User`, `Account`, `DebitNote`, `CreditNote` y `CashReceipt` (si aparece en alguno).

- [ ] **Step 2: Ejecutar la migración inicial**

Run (dentro de `backend/`):
```bash
npx prisma migrate dev --name init
```
Expected: tablas creadas en `maretravel_erp`, cliente Prisma generado.

- [ ] **Step 3: Verificar el cliente generado**

Run: `npx prisma validate`
Expected: `Schema is valid`.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma backend/package.json backend/package-lock.json
git commit -m "feat: esquema Prisma del modelo de datos Fase 1 con migración inicial"
```

---

### Task 4: PrismaService y ConfigModule tipado

**Files:**
- Create: `backend/src/prisma/prisma.module.ts`, `backend/src/prisma/prisma.service.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `PrismaService` global exportado (módulo `PrismaModule`). Consumido por `AuthService`, `AccountsService` y demás servicios. Extiende `PrismaClient` con `OnModuleInit`/`OnModuleDestroy`.

- [ ] **Step 1: Escribir el test del servicio (fails: servicio no existe)**

`backend/src/prisma/prisma.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('should be defined', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    const service = moduleRef.get(PrismaService);
    expect(service).toBeDefined();
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npx jest src/prisma/prisma.service.spec.ts`
Expected: FAIL (módulo/servicio no encontrado).

- [ ] **Step 3: Crear `backend/src/prisma/prisma.service.ts`**

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 4: Crear `backend/src/prisma/prisma.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 5: Registrar `PrismaModule` en `app.module.ts`**

Añadir `import { PrismaModule } from './prisma/prisma.module';` y `PrismaModule` en el array `imports`.

- [ ] **Step 6: Ejecutar el test para verificar que pasa**

Run: `npx jest src/prisma/prisma.service.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/prisma backend/src/app.module.ts
git commit -m "feat: PrismaService global conectado a PostgreSQL"
```

---

### Task 5: Seed de datos de demostración

**Files:**
- Create: `backend/prisma/seed.ts`
- Modify: `backend/package.json` (script `prisma.seed`)

**Interfaces:**
- Produces: base poblada con usuario `luis` (hash bcrypt de `585858`), métodos de pago, cuentas financieras, tipos de servicio, T/C inicial. Consumido por tests e2e de módulos posteriores.

- [ ] **Step 1: Escribir el seed**

`backend/prisma/seed.ts`:
```ts
import { PrismaClient, Prisma } from '@prisma/client';
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
    { code: 'BS-01', name: 'Efectivo Moneda Nacional (BOB)', currency: 'BOB', type: 'COBRANZAS' },
    { code: 'US-01', name: 'Efectivo Dólares Americanos (USD)', currency: 'USD', type: 'COBRANZAS' },
    { code: 'BS-02', name: 'Banco Nacional de Bolivia BNB BOB', currency: 'BOB', type: 'AMBOS', bankAccount: 'Cta. Cte. 100-29384-2' },
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
    await prisma.serviceType.upsert({
      where: { code: st.code },
      update: {},
      create: st,
    });
  }

  await prisma.financialAccount.createMany({
    data: [
      { type: 'BANCO', bankName: 'Banco Mercantil Santa Cruz BMSC', accountNumber: '401-09823-1', currency: 'BOB', currentBalance: 45200 },
      { type: 'BANCO', bankName: 'Banco Bisa S.A.', accountNumber: '029-91823-7', currency: 'USD', currentBalance: 12400 },
      { type: 'EFECTIVO', bankName: 'Caja Central BOB', currency: 'BOB', currentBalance: 5000 },
      { type: 'EFECTIVO', bankName: 'Caja Central USD', currency: 'USD', currentBalance: 2100 },
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
```

- [ ] **Step 2: Añadir script de seed en `backend/package.json`**

```json
"prisma": { "seed": "ts-node prisma/seed.ts" }
```

- [ ] **Step 3: Instalar ts-node (si falta)**

Run: `npm i -D ts-node @types/node`

- [ ] **Step 4: Ejecutar el seed**

Run: `npx prisma db seed`
Expected: mensaje de éxito, sin errores.

- [ ] **Step 5: Verificar en la BD**

Run: `docker compose exec db psql -U maretravel -d maretravel_erp -c "SELECT username FROM users;"`
Expected: fila `luis`.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/seed.ts backend/package.json
git commit -m "feat: seed de datos de demostración (usuario, métodos de pago, cuentas, servicios)"
```

---

### Task 6: Módulo Auth (login JWT + guard)

**Files:**
- Create: `backend/src/auth/auth.module.ts`, `auth.service.ts`, `auth.controller.ts`, `auth.service.spec.ts`
- Create: `backend/src/common/public.decorator.ts`, `backend/src/common/jwt-auth.guard.ts`, `backend/src/common/jwt.strategy.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `AuthService.login(username, password)` → `{ access_token, user }`; `JwtAuthGuard` global con `@Public()` opt-out; estrategia `jwt` de Passport. Consumido por todos los módulos.

- [ ] **Step 1: Instalar dependencias de autenticación**

Run: `npm i @nestjs/passport passport passport-jwt && npm i -D @types/passport-jwt`

- [ ] **Step 2: Escribir el test de `AuthService.login` (fails)**

`backend/src/auth/auth.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'u1',
        username: 'luis',
        passwordHash: '$2b$10$maretravelhash',
        name: 'Luis',
        role: 'ADMIN',
        isActive: true,
      }),
    },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('token') };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('should return token for valid credentials', async () => {
    const result = await service.login('luis', '585858');
    expect(result.access_token).toBe('token');
    expect(result.user.username).toBe('luis');
  });

  it('should throw for invalid password', async () => {
    await expect(service.login('luis', 'wrong')).rejects.toThrow('Credenciales inválidas');
  });
});
```

- [ ] **Step 3: Ejecutar el test para verificar que falla**

Run: `npx jest src/auth/auth.service.spec.ts`
Expected: FAIL (AuthService no definido).

- [ ] **Step 4: Crear `backend/src/auth/auth.service.ts`**

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) throw new UnauthorizedException('Credenciales inválidas');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');
    const payload = { sub: user.id, username: user.username, role: user.role };
    const access_token = await this.jwt.signAsync(payload);
    return { access_token, user: { id: user.id, username: user.username, name: user.name, role: user.role } };
  }
}
```

- [ ] **Step 5: Crear `backend/src/common/public.decorator.ts`**

```ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 6: Crear `backend/src/common/jwt.strategy.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'maretravel-super-secret-cambiar-en-produccion',
    });
  }
  async validate(payload: { sub: string; username: string; role: string }) {
    return { id: payload.sub, username: payload.username, role: payload.role };
  }
}
```

- [ ] **Step 7: Crear `backend/src/common/jwt-auth.guard.ts`**

```ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

- [ ] **Step 8: Crear `backend/src/auth/auth.controller.ts`**

```ts
import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../common/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: { username: string; password: string }) {
    return this.authService.login(body.username, body.password);
  }

  @Get('me')
  me(@Req() req: { user: { id: string; username: string; role: string } }) {
    return req.user;
  }
}
```

- [ ] **Step 9: Crear `backend/src/auth/auth.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from '../common/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'maretravel-super-secret-cambiar-en-produccion',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 10: Registrar `AuthModule` y aplicar el guard global en `app.module.ts`**

Añadir `AuthModule` a `imports`, e importar `APP_GUARD`:
```ts
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/jwt-auth.guard';
```
y en `providers`:
```ts
providers: [
  AppService,
  { provide: APP_GUARD, useClass: JwtAuthGuard },
],
```

- [ ] **Step 11: Ejecutar el test para verificar que pasa**

Run: `npx jest src/auth/auth.service.spec.ts`
Expected: PASS.

- [ ] **Step 12: Probar el login real**

Run: `curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"luis","password":"585858"}'`
Expected: `{"access_token":"...","user":{...}}`

- [ ] **Step 13: Commit**

```bash
git add backend/src/auth backend/src/common backend/src/app.module.ts
git commit -m "feat: autenticación JWT + bcrypt con guard global y login"
```

---

### Task 7: Módulo Accounts — API + servicio (vertical slice)

**Files:**
- Create: `backend/src/modules/accounts/dto/create-account.dto.ts`, `update-account.dto.ts`
- Create: `backend/src/modules/accounts/accounts.service.ts`, `accounts.controller.ts`, `accounts.module.ts`, `accounts.service.spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: CRUD de cuentas REST (`GET/POST/PATCH /api/accounts`, `GET /api/accounts/:id`) con validación de DTOs y filtros. Consumido por el frontend (Task 8) y por `DebitNotesService`/`CashReceiptsService`.

- [ ] **Step 1: Crear DTOs**

`backend/src/modules/accounts/dto/create-account.dto.ts`:
```ts
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { RelationType, AccountCategoryType, AccountRating } from '@prisma/client';

export class CreateAccountDto {
  @IsString() @MinLength(1) code: string;
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() nit?: string;
  @IsEnum(RelationType) relationType: RelationType;
  @IsEnum(AccountCategoryType) accountType: AccountCategoryType;
  @IsOptional() @IsEnum(AccountRating) rating?: AccountRating;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() cellphone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
}
```

`backend/src/modules/accounts/dto/update-account.dto.ts`:
```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateAccountDto } from './create-account.dto';
export class UpdateAccountDto extends PartialType(CreateAccountDto) {}
```

- [ ] **Step 2: Escribir el test del servicio (fails)**

`backend/src/modules/accounts/accounts.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AccountsService', () => {
  let service: AccountsService;
  const prisma = {
    account: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'a1', ...data })),
      findMany: jest.fn().mockResolvedValue([{ id: 'a1', name: 'Cliente X' }]),
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AccountsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AccountsService);
  });

  it('creates an account', async () => {
    const dto = {
      code: 'CLI-001', name: 'Cliente X', relationType: 'CLIENTE', accountType: 'PERSONA',
    } as any;
    const created = await service.create(dto);
    expect(created.id).toBe('a1');
    expect(created.name).toBe('Cliente X');
  });

  it('lists accounts filtered by relationType', async () => {
    await service.findAll('CLIENTE', undefined, undefined);
    expect(prisma.account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ relationType: 'CLIENTE' }) }),
    );
  });
});
```

- [ ] **Step 3: Ejecutar el test para verificar que falla**

Run: `npx jest src/modules/accounts/accounts.service.spec.ts`
Expected: FAIL.

- [ ] **Step 4: Crear `backend/src/modules/accounts/accounts.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { AccountCategoryType, AccountRating, Prisma, RelationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAccountDto) {
    return this.prisma.account.create({ data: { ...dto, rating: dto.rating ?? 'NORMAL' } });
  }

  async findAll(relationType?: RelationType, rating?: AccountRating, search?: string) {
    const where: Prisma.AccountWhereInput = {};
    if (relationType) where.relationType = relationType;
    if (rating) where.rating = rating;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { nit: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.account.findMany({ where, orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    return this.prisma.account.findUnique({ where: { id }, include: { contacts: true } });
  }

  async update(id: string, dto: UpdateAccountDto) {
    return this.prisma.account.update({ where: { id }, data: dto });
  }
}
```

- [ ] **Step 5: Crear `backend/src/modules/accounts/accounts.controller.ts`**

```ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AccountRating, RelationType } from '@prisma/client';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private service: AccountsService) {}

  @Get()
  findAll(
    @Query('relationType') relationType?: RelationType,
    @Query('rating') rating?: AccountRating,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(relationType, rating, search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.service.update(id, dto);
  }
}
```

- [ ] **Step 6: Crear `backend/src/modules/accounts/accounts.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';

@Module({ controllers: [AccountsController], providers: [AccountsService], exports: [AccountsService] })
export class AccountsModule {}
```

- [ ] **Step 7: Registrar `AccountsModule` en `app.module.ts`**

- [ ] **Step 8: Ejecutar el test para verificar que pasa**

Run: `npx jest src/modules/accounts/accounts.service.spec.ts`
Expected: PASS.

- [ ] **Step 9: Verificar el CRUD real con curl (usando token)**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"luis","password":"585858"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s -X POST http://localhost:3000/api/accounts -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"code":"CLI-001","name":"Cliente Prueba","relationType":"CLIENTE","accountType":"PERSONA"}'
curl -s http://localhost:3000/api/accounts -H "Authorization: Bearer $TOKEN"
```
Expected: cuenta creada y listada.

- [ ] **Step 10: Commit**

```bash
git add backend/src/modules/accounts backend/src/app.module.ts
git commit -m "feat: módulo Accounts con CRUD REST y validación"
```

---

### Task 8: Integración del frontend — `js/api.js` + adaptador de cuentas

**Files:**
- Create: `js/api.js`
- Create: `js/adapters/accounts.js`
- Modify: `index.html` (cargar `js/api.js` y `js/adapters/accounts.js` antes de `js/modules/accounts.js`)

**Interfaces:**
- Produces: `API.login`, `API.get/post/patch/delete` con JWT; adaptador `AccountsAdapter` con `list/create/update`. Consumido por el resto de módulos en fases posteriores.

- [ ] **Step 1: Crear `js/api.js`**

```js
const API = (() => {
  const BASE = '/api';
  let token = localStorage.getItem('maretravel_token') || null;

  async function request(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      localStorage.removeItem('maretravel_token');
      token = null;
      if (!path.startsWith('/auth/login')) window.location.reload();
      throw new Error('Sesión expirada');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Error ${res.status}`);
    }
    return res.json();
  }

  return {
    setToken(t) { token = t; localStorage.setItem('maretravel_token', t); },
    getToken: () => token,
    login: (username, password) => request('POST', '/auth/login', { username, password }),
    me: () => request('GET', '/auth/me'),
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
  };
})();
```

- [ ] **Step 2: Crear `js/adapters/accounts.js`**

```js
const AccountsAdapter = {
  async list(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.relationType) qs.set('relationType', filters.relationType);
    if (filters.rating) qs.set('rating', filters.rating);
    if (filters.search) qs.set('search', filters.search);
    return API.get(`/accounts${qs.toString() ? '?' + qs.toString() : ''}`);
  },
  create(payload) { return API.post('/accounts', payload); },
  update(id, payload) { return API.patch(`/accounts/${id}`, payload); },
  get(id) { return API.get(`/accounts/${id}`); },
};
```

- [ ] **Step 3: Cargar los scripts en `index.html`** antes de `js/modules/accounts.js`:
```html
<script src="js/api.js"></script>
<script src="js/adapters/accounts.js"></script>
```

- [ ] **Step 4: Verificar que el login usa `API.login`** (buscar el handler de login en `js/app.js` y reemplazar la comparación local por `API.login`, guardando el token con `API.setToken`).

- [ ] **Step 5: Verificación manual** — abrir la app, iniciar sesión y confirmar que la pestaña Cuentas lista desde la API.

- [ ] **Step 6: Commit**

```bash
git add js/api.js js/adapters/accounts.js index.html js/app.js
git commit -m "feat: capa API REST con JWT y adaptador de cuentas en el frontend"
```

---

### Task 9: Módulo GDS Tickets

**Files:**
- Create: `backend/src/modules/gds-tickets/dto/create-ticket.dto.ts`
- Create: `backend/src/modules/gds-tickets/gds-tickets.service.ts`, `.controller.ts`, `.module.ts`, `.service.spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: CRUD y filtros de boletos (`GET/POST/PATCH /api/gds-tickets`). Consumido por `DebitNotesService` (cierre asigna boletos).

- [ ] **Step 1: DTO `create-ticket.dto.ts`** (ticketNumber, gdsSource, issueDate, passengerName, route, airlineCode, operatorId, netAmount, taxAmount, totalAmount, currency; opcionales feeAmount, commissionRate).

- [ ] **Step 2: Test del servicio (fails)** — `create` persiste ticket, `findAll` filtra por status y airlineCode.

- [ ] **Step 3: Ejecutar test → verificar falla.**

- [ ] **Step 4: `gds-tickets.service.ts`** — `create`, `findAll(status?, airlineCode?)`, `update(id, dto)`.

- [ ] **Step 5: `gds-tickets.controller.ts`** — `GET /gds-tickets`, `POST /gds-tickets`, `PATCH /gds-tickets/:id`.

- [ ] **Step 6: `gds-tickets.module.ts`** y registrar en `app.module.ts`.

- [ ] **Step 7: Ejecutar test → verificar pasa.**

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/gds-tickets backend/src/app.module.ts
git commit -m "feat: módulo GDS Tickets con CRUD y filtros"
```

---

### Task 10: Módulo Debit Notes — emisión y cierre (generación de NCs)

**Files:**
- Create: `backend/src/modules/debit-notes/dto/create-debit-note.dto.ts`, `close-debit-note.dto.ts`, `void-debit-note.dto.ts`, `correct-debit-note.dto.ts`
- Create: `backend/src/modules/debit-notes/debit-notes.service.ts`, `.controller.ts`, `.module.ts`, `.service.spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `create` (calcula totales BOB/USD y saldos), `close` (bloquea ND, asigna boletos a `ASIGNADO`, genera NCs automáticas, registra audit), `reopen`, `void(reason)`, `correct(reason)`. Consumido por `CreditNotesService` y `CashReceiptsService`.

- [ ] **Step 1: DTOs** — `CreateDebitNoteDto` (accountId, issueDate, paymentTerm, currency, items[]; cada item: serviceType, passengerName, description, currency, totalAmount, ticketId?, operatorId?, comisiones). `CloseDebitNoteDto`/`VoidDebitNoteDto`/`CorrectDebitNoteDto` con campo `motivo` (string, `@IsNotEmpty`).

- [ ] **Step 2: Test del servicio (fails)** — casos:
  - `create` calcula `totalAmountBob` correcto y `balanceBob` inicial = total.
  - `close` genera NC automática por cada proveedor y marca boletos `ASIGNADO`.
  - `void` sin motivo lanza `BadRequestException`.
- [ ] **Step 3: Ejecutar test → verificar falla.**

- [ ] **Step 4: `debit-notes.service.ts`** — implementar `create`, `close`, `reopen`, `void`, `correct` usando `$transaction` de Prisma para atomicidad (asignar NCs y boletos dentro de la misma transacción).

- [ ] **Step 5: `debit-notes.controller.ts`** — `GET /debit-notes`, `POST /debit-notes`, `GET /debit-notes/:id`, `PATCH /debit-notes/:id`, `POST /debit-notes/:id/close`, `POST /debit-notes/:id/reopen`, `POST /debit-notes/:id/void`, `POST /debit-notes/:id/correct`.

- [ ] **Step 6: `debit-notes.module.ts`** y registrar en `app.module.ts`.

- [ ] **Step 7: Ejecutar test → verificar pasa.**

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/debit-notes backend/src/app.module.ts
git commit -m "feat: módulo Debit Notes con emisión, cierre (genera NCs) y operaciones críticas"
```

---

### Task 11: Módulo Credit Notes (manuales)

**Files:**
- Create: `backend/src/modules/credit-notes/dto/create-credit-note.dto.ts`
- Create: `backend/src/modules/credit-notes/credit-notes.service.ts`, `.controller.ts`, `.module.ts`, `.service.spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `create` (manual), `findAll`, `findOne`, `void(reason)`. Las NC automáticas se crean desde `DebitNotesService.close`.

- [ ] **Step 1: DTO** — providerAccountId, concept, currency, totalAmountBob/totalAmountUsd, debitNoteId?.
- [ ] **Step 2: Test (fails)** — `create` persiste y `void` exige motivo.
- [ ] **Step 3: Ejecutar test → verificar falla.**
- [ ] **Step 4: Service** — `create`, `findAll`, `findOne`, `void`.
- [ ] **Step 5: Controller** — `GET /credit-notes`, `POST /credit-notes`, `GET /credit-notes/:id`.
- [ ] **Step 6: Module** y registro.
- [ ] **Step 7: Ejecutar test → verificar pasa.**
- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/credit-notes backend/src/app.module.ts
git commit -m "feat: módulo Credit Notes con emisión manual y anulación"
```

---

### Task 12: Módulo Cash Receipts (caja y cuadre multimoneda)

**Files:**
- Create: `backend/src/modules/cash-receipts/dto/create-cash-receipt.dto.ts`, `void-cash-receipt.dto.ts`
- Create: `backend/src/modules/cash-receipts/cash-receipts.service.ts`, `.controller.ts`, `.module.ts`, `.service.spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `create` (desglose multimoneda por ND, cuadre con T/C, actualiza saldos de las NDs y estados), `void(reason)` (revierte saldos). Consumido por el frontend de Caja.

- [ ] **Step 1: DTOs** — `CreateCashReceiptDto` (clientAccountId, issueDate, exchangeRate, lines[]: debitNoteId, amountPaidBob, amountPaidUsd, paymentMethodId). `VoidCashReceiptDto` con `motivo` obligatorio.
- [ ] **Step 2: Test (fails)** — `create` cuadra una ND y la marca `PAGADA`; `void` restaura los saldos originales y exige motivo.
- [ ] **Step 3: Ejecutar test → verificar falla.**
- [ ] **Step 4: Service** — `create` con `$transaction` (crear recibo + líneas + decrementar saldo ND), `void` con `$transaction` inverso.
- [ ] **Step 5: Controller** — `GET /cash-receipts`, `POST /cash-receipts`, `POST /cash-receipts/:id/void`.
- [ ] **Step 6: Module** y registro.
- [ ] **Step 7: Ejecutar test → verificar pasa.**
- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/cash-receipts backend/src/app.module.ts
git commit -m "feat: módulo Cash Receipts con cuadre multimoneda y reversión"
```

---

### Task 13: Endpoints de soporte (service-types, payment-methods, exchange-rate, settings) e impresión

**Files:**
- Create: `backend/src/modules/support/support.service.ts`, `.controller.ts`, `.module.ts`
- Create: `backend/src/modules/print/print.service.ts`, `.controller.ts`, `.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `GET /service-types`, `GET /payment-methods`, `GET /exchange-rate`, `PATCH /settings`; `GET /print/:docType/:id` (reusa lógica de `printRenderer.js`).

- [ ] **Step 1: `support.module`** — `findServiceTypes`, `findPaymentMethods`, `getExchangeRate`, `updateSettings` (solo `systemSettings`).
- [ ] **Step 2: `print.module`** — `renderDoc(docType, id)` genera HTML membretado; copiar la lógica de `printRenderer.js` a un servicio TS.
- [ ] **Step 3: Registrar ambos módulos.**
- [ ] **Step 4: Verificación manual con curl (requiere token) para cada endpoint.**
- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/support backend/src/modules/print backend/src/app.module.ts
git commit -m "feat: endpoints de soporte e impresión de documentos"
```

---

### Task 14: Configuración de tests e2e y CI

**Files:**
- Create: `backend/test/app.e2e-spec.ts`, `backend/test/jest-e2e.json`
- Create: `backend/test/setup.ts`

**Interfaces:**
- Produces: suite e2e que levanta la app contra la BD de prueba, prueba login + flujo completo (crear cuenta → ND → cerrar → cobrar → cuadrar), y limpia datos entre tests.

- [ ] **Step 1: `setup.ts`** — antes de cada suite, ejecutar seed y truncar tablas transaccionales.
- [ ] **Step 2: Test e2e de login + flujo de cuentas** con Supertest:
  - login → obtiene token.
  - crea cuenta.
  - crea ND con un item.
  - cierra ND → verifica que se creó una NC.
- [ ] **Step 3: Ejecutar**

Run: `npm run test:e2e`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/test backend/package.json
git commit -m "test: suite e2e de login y flujo financiero completo"
```

---

### Task 15: Retiro del `server.js` legacy y servir estáticos desde NestJS

**Files:**
- Modify: `backend/src/main.ts` (servir estáticos), `backend/package.json` (script start), `INICIAR_SISTEMA.bat`

**Interfaces:**
- Produces: un solo proceso NestJS sirve UI + API en el puerto 3000. `server.js` y `js/db.js` (localStorage) quedan obsoletos.

- [ ] **Step 1: Instalar serve-static**

Run: `npm i @nestjs/serve-static`

- [ ] **Step 2: Configurar `ServeStaticModule`** para servir `../` (raíz del monorepo) como raíz estática, `index.html` como página principal.

- [ ] **Step 3: Eliminar/renombrar `server.js`** (mover a `server.legacy.js`), y dejar `js/db.js` sin uso (los módulos migrados usan `api.js`).

- [ ] **Step 4: Actualizar `INICIAR_SISTEMA.bat`** para ejecutar `npm run start` dentro de `backend/` en lugar de `node server.js`.

- [ ] **Step 5: Verificación** — arrancar NestJS, abrir `http://localhost:3000`, iniciar sesión y operar.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main.ts backend/package.json INICIAR_SISTEMA.bat
git commit -m "feat: servir estáticos desde NestJS y retirar server legacy"
```

---

## Self-Review

**1. Cobertura del spec:**
- Arquitectura monorepo → Tasks 1-2 ✓
- Modelo de datos Prisma → Task 3 ✓
- Seed desde cero → Task 5 ✓
- JWT + bcrypt → Task 6 ✓
- REST por recursos → Tasks 7, 9-13 ✓
- BOB/USD por separado → Task 3 (schema) + Tasks 10, 12 ✓
- Regla de motivo + auditLog → Tasks 10, 11, 12 ✓
- Integración frontend (api.js + adaptadores) → Task 8 ✓
- Testing unit + e2e → Tasks 4,6,7,9-12 (unit) y Task 14 (e2e) ✓
- Despliegue un solo proceso → Task 15 ✓
- Incremental por módulos → Tasks 7→15 ✓

**2. Placeholder scan:** Sin TBD/TODO. Cada tarea tiene pasos con código o comandos concretos. Nota: las tareas 9-13 usan descripciones compactas en algunos pasos; cada una define DTOs/servicios/controllers concretos con su test correspondiente. (Se puede expandir al ejecutar cada fase.)

**3. Consistencia de tipos:** `AuthService.login` (Task 6) → consumido por controller y test e2e (Task 14) con firma `login(username, password)`. `AccountsService.findAll(relationType, rating, search)` (Task 7) → consistente con controller y adaptador. `PrismaService` (Task 4) inyectado en todos los servicios. Nombres de modelos Prisma coinciden con Task 3.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-18-nestjs-backend-migration.md`.**

---

## Estado transicional (decisión de ejecución)

- **`server.js` retirado** (→ `server.legacy.js`): NestJS sirve UI + API. Módulos del frontend aún no
  migrados quedan en `localStorage`-solo hasta su fase. Ver spec §8bis.
- **`POST /accounts/:id/contacts`** diferido (descopado en Fase 1).
- **Numeración `max+1`** acotada por `@unique` (P2002, sin corrupción); secuencia atómica en fase posterior.
- **`close` de ND exige `motivo`** obligatorio (regla transversal), registrado en auditoría.
- **ND pagada en su propia moneda → `PAGADA`**; anular una ND con pagos está bloqueado (integridad).