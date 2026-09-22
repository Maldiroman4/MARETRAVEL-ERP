-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('CLIENTE', 'PROVEEDOR', 'AMBOS');

-- CreateEnum
CREATE TYPE "AccountCategoryType" AS ENUM ('EMPRESA', 'PERSONA', 'AEROLINEA', 'HOTEL', 'ONG', 'INSTITUCION', 'RENT_A_CAR');

-- CreateEnum
CREATE TYPE "AccountRating" AS ENUM ('NORMAL', 'IMPORTANTE', 'VIP', 'CRITICA');

-- CreateEnum
CREATE TYPE "GeneralStatus" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('BOB', 'USD');

-- CreateEnum
CREATE TYPE "PaymentTerm" AS ENUM ('AL_CONTADO', 'CREDITO_7_DIAS', 'CREDITO_15_DIAS', 'CREDITO_30_DIAS');

-- CreateEnum
CREATE TYPE "DebitNoteStatus" AS ENUM ('BORRADOR', 'IMPAGA', 'PARCIAL', 'PAGADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('DISPONIBLE', 'ASIGNADO', 'ANULADO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('BOLETO_GDS', 'HOTEL', 'PAQUETE', 'SEGURO', 'TRANSFER', 'PENALIDAD');

-- CreateEnum
CREATE TYPE "CashReceiptStatus" AS ENUM ('VALIDO', 'REVERSADO');

-- CreateEnum
CREATE TYPE "FinancialAccountType" AS ENUM ('BANCO', 'BINANCE', 'EFECTIVO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "nit" TEXT,
    "relation_type" "RelationType" NOT NULL,
    "account_type" "AccountCategoryType" NOT NULL,
    "rating" "AccountRating" NOT NULL DEFAULT 'NORMAL',
    "department" TEXT,
    "city" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "cellphone" TEXT,
    "email" TEXT,
    "status" "GeneralStatus" NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_contacts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "department" TEXT,
    "role_title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debit_notes" (
    "id" TEXT NOT NULL,
    "nd_number" INTEGER NOT NULL,
    "account_id" TEXT NOT NULL,
    "requester_text" TEXT,
    "passenger_name" TEXT,
    "issue_date" DATE NOT NULL,
    "due_date" DATE,
    "payment_term" "PaymentTerm" NOT NULL DEFAULT 'AL_CONTADO',
    "currency" "Currency" NOT NULL,
    "total_amount_bob" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_amount_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paid_amount_bob" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paid_amount_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance_bob" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "DebitNoteStatus" NOT NULL DEFAULT 'BORRADOR',
    "observations" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debit_note_items" (
    "id" TEXT NOT NULL,
    "debit_note_id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "ticket_id" TEXT,
    "ticket_number" TEXT,
    "passenger_name" TEXT NOT NULL,
    "operator_id" TEXT,
    "description" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "fee_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "provider_commission_rate" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "provider_commission_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "client_commission_rate" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "client_commission_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_cost_to_provider" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debit_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "nc_number" INTEGER NOT NULL,
    "debit_note_id" TEXT,
    "provider_account_id" TEXT NOT NULL,
    "is_automatic" BOOLEAN NOT NULL DEFAULT false,
    "concept" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "total_amount_bob" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_amount_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paid_amount_bob" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paid_amount_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance_bob" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "gds_source" TEXT NOT NULL DEFAULT 'AMADEUS',
    "counter_id" TEXT,
    "issue_date" DATE NOT NULL,
    "passenger_name" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "airline_code" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "net_amount" DECIMAL(14,2) NOT NULL,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "commission_rate" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "commission_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fee_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "TicketStatus" NOT NULL DEFAULT 'DISPONIBLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_receipts" (
    "id" TEXT NOT NULL,
    "receipt_number" INTEGER NOT NULL,
    "client_account_id" TEXT NOT NULL,
    "issue_date" DATE NOT NULL,
    "status" "CashReceiptStatus" NOT NULL DEFAULT 'VALIDO',
    "total_paid_bob" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_paid_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "exchange_rate" DECIMAL(10,4) NOT NULL DEFAULT 6.96,
    "void_reason" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_lines" (
    "id" TEXT NOT NULL,
    "cash_receipt_id" TEXT NOT NULL,
    "debit_note_id" TEXT NOT NULL,
    "amount_paid_bob" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount_paid_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "payment_method_id" TEXT,

    CONSTRAINT "payment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" TEXT NOT NULL,
    "type" "FinancialAccountType" NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "currency" "Currency" NOT NULL,
    "bank_account_id" TEXT,
    "titular_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "current_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "service_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "type" TEXT NOT NULL,
    "bankAccount" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "buy_rate" DECIMAL(10,4) NOT NULL,
    "sell_rate" DECIMAL(10,4) NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_code_key" ON "accounts"("code");

-- CreateIndex
CREATE INDEX "accounts_nit_idx" ON "accounts"("nit");

-- CreateIndex
CREATE INDEX "accounts_relation_type_idx" ON "accounts"("relation_type");

-- CreateIndex
CREATE INDEX "company_contacts_company_id_idx" ON "company_contacts"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "debit_notes_nd_number_key" ON "debit_notes"("nd_number");

-- CreateIndex
CREATE INDEX "debit_notes_account_id_idx" ON "debit_notes"("account_id");

-- CreateIndex
CREATE INDEX "debit_notes_status_idx" ON "debit_notes"("status");

-- CreateIndex
CREATE INDEX "debit_note_items_debit_note_id_idx" ON "debit_note_items"("debit_note_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_nc_number_key" ON "credit_notes"("nc_number");

-- CreateIndex
CREATE INDEX "credit_notes_provider_account_id_idx" ON "credit_notes"("provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_number_key" ON "tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "tickets_operator_id_idx" ON "tickets"("operator_id");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "cash_receipts_receipt_number_key" ON "cash_receipts"("receipt_number");

-- CreateIndex
CREATE INDEX "cash_receipts_client_account_id_idx" ON "cash_receipts"("client_account_id");

-- CreateIndex
CREATE INDEX "payment_lines_cash_receipt_id_idx" ON "payment_lines"("cash_receipt_id");

-- CreateIndex
CREATE INDEX "payment_lines_debit_note_id_idx" ON "payment_lines"("debit_note_id");

-- CreateIndex
CREATE INDEX "financial_accounts_type_idx" ON "financial_accounts"("type");

-- CreateIndex
CREATE INDEX "financial_accounts_is_active_idx" ON "financial_accounts"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "service_types_code_key" ON "service_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_code_key" ON "payment_methods"("code");

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_debit_note_id_fkey" FOREIGN KEY ("debit_note_id") REFERENCES "debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_provider_account_id_fkey" FOREIGN KEY ("provider_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_debit_note_id_fkey" FOREIGN KEY ("debit_note_id") REFERENCES "debit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_receipts" ADD CONSTRAINT "cash_receipts_client_account_id_fkey" FOREIGN KEY ("client_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_lines" ADD CONSTRAINT "payment_lines_cash_receipt_id_fkey" FOREIGN KEY ("cash_receipt_id") REFERENCES "cash_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_lines" ADD CONSTRAINT "payment_lines_debit_note_id_fkey" FOREIGN KEY ("debit_note_id") REFERENCES "debit_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
