-- ============================================================================
-- MARETRAVEL ERP - ESQUEMA DE BASE DE DATOS SQL RELACIONAL (SQLite / PostgreSQL)
-- Basado en docs/schema.sql y adaptado para todos los módulos operativos y contables
-- ============================================================================

-- 1. TABLA: accounts (Clientes Corporativos, Personas y Proveedores)
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    legal_name TEXT,
    nit TEXT,
    relation_type TEXT NOT NULL,
    account_type TEXT NOT NULL,
    rating TEXT DEFAULT 'NORMAL',
    department TEXT,
    city TEXT,
    address TEXT,
    phone TEXT,
    cellphone TEXT,
    email TEXT,
    web_page TEXT,
    provider_services TEXT,
    account_manager TEXT,
    status TEXT DEFAULT 'ACTIVO',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_accounts_nit ON accounts(nit);
CREATE INDEX IF NOT EXISTS idx_accounts_relation_type ON accounts(relation_type);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);

-- 2. TABLA: account_history (Historial de Modificaciones Contables de Cuentas)
CREATE TABLE IF NOT EXISTS account_history (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    account_name TEXT,
    change_type TEXT NOT NULL,
    field_changed TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    user_id TEXT,
    user_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_history_account_id ON account_history(account_id);

-- 3. TABLA: financial_accounts (Cuentas Bancarias Oficiales, Cajas Físicas y Billeteras Digitales)
CREATE TABLE IF NOT EXISTS financial_accounts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'BANCO',
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_type TEXT DEFAULT 'CORRIENTE',
    titular_name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BOB',
    is_active INTEGER NOT NULL DEFAULT 1,
    current_balance REAL DEFAULT 0.00,
    cash_desk_name TEXT,
    custodian_name TEXT,
    binance_id TEXT,
    wallet_address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_active ON financial_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_currency ON financial_accounts(currency);

-- 4. TABLA: company_contacts (Jerarquía Corporativa: Solicitantes Autorizados)
CREATE TABLE IF NOT EXISTS company_contacts (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT,
    role_title TEXT,
    email TEXT,
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company_contacts_company ON company_contacts(company_id);

-- 5. TABLA: debit_notes (Notas de Débito Oficiales / Liquidaciones de Ventas)
CREATE TABLE IF NOT EXISTS debit_notes (
    id TEXT PRIMARY KEY,
    nd_number INTEGER NOT NULL UNIQUE,
    nd_code TEXT,
    account_id TEXT NOT NULL,
    account_name TEXT,
    account_nit TEXT,
    requester_id TEXT,
    solicitante TEXT,
    passenger_name TEXT,
    issue_date TEXT NOT NULL,
    due_date TEXT,
    payment_term TEXT DEFAULT 'AL_CONTADO',
    currency TEXT NOT NULL DEFAULT 'BOB',
    frozen_exchange_rate REAL DEFAULT 6.96,
    exchange_rate_used REAL DEFAULT 6.96,
    total_amount_bob REAL NOT NULL DEFAULT 0.00,
    total_amount_usd REAL NOT NULL DEFAULT 0.00,
    paid_amount_bob REAL NOT NULL DEFAULT 0.00,
    paid_amount_usd REAL NOT NULL DEFAULT 0.00,
    balance_bob REAL NOT NULL DEFAULT 0.00,
    balance_usd REAL NOT NULL DEFAULT 0.00,
    total_documento REAL DEFAULT 0.00,
    saldo_pendiente REAL DEFAULT 0.00,
    monto_acumulado_pagado REAL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'PENDIENTE',
    estado TEXT DEFAULT 'PENDIENTE',
    deposit_account_id TEXT,
    financial_account_id TEXT,
    observations TEXT,
    created_by_id TEXT,
    created_by_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    raw_json TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_nd_account ON debit_notes(account_id);
CREATE INDEX IF NOT EXISTS idx_nd_number ON debit_notes(nd_number);
CREATE INDEX IF NOT EXISTS idx_nd_issue_date ON debit_notes(issue_date);
CREATE INDEX IF NOT EXISTS idx_nd_status ON debit_notes(status);

-- 6. TABLA: debit_note_items (Líneas de Detalle de Notas de Débito)
CREATE TABLE IF NOT EXISTS debit_note_items (
    id TEXT PRIMARY KEY,
    debit_note_id TEXT NOT NULL,
    service_type TEXT NOT NULL,
    ticket_id TEXT,
    ticket_number TEXT,
    voucher_number TEXT,
    passenger_name TEXT NOT NULL,
    passenger_doc_id TEXT,
    operator_id TEXT,
    operator_name TEXT,
    sub_service_name TEXT,
    description TEXT,
    service_details TEXT,
    settlement_model TEXT DEFAULT 'DEDUCCION_DIRECTA',
    currency TEXT NOT NULL DEFAULT 'BOB',
    fare_amount REAL DEFAULT 0.00,
    gross_cost REAL DEFAULT 0.00,
    fee_amount REAL DEFAULT 0.00,
    total_amount REAL NOT NULL DEFAULT 0.00,
    fare_amount_bob REAL DEFAULT 0.00,
    gross_cost_bob REAL DEFAULT 0.00,
    fee_amount_bob REAL DEFAULT 0.00,
    total_amount_bob REAL DEFAULT 0.00,
    provider_commission_rate REAL DEFAULT 0.00,
    provider_commission_amount REAL DEFAULT 0.00,
    provider_commission_amount_bob REAL DEFAULT 0.00,
    client_commission_rate REAL DEFAULT 0.00,
    client_commission_amount REAL DEFAULT 0.00,
    counter_commission_amount REAL DEFAULT 0.00,
    net_cost_to_provider REAL DEFAULT 0.00,
    net_cost_to_provider_bob REAL DEFAULT 0.00,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    raw_json TEXT,
    FOREIGN KEY (debit_note_id) REFERENCES debit_notes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dni_debit_note ON debit_note_items(debit_note_id);
CREATE INDEX IF NOT EXISTS idx_dni_service_type ON debit_note_items(service_type);

-- 7. TABLA: credit_notes (Notas de Crédito Oficiales / Liquidaciones a Proveedores)
CREATE TABLE IF NOT EXISTS credit_notes (
    id TEXT PRIMARY KEY,
    nc_number INTEGER NOT NULL UNIQUE,
    nc_code TEXT,
    provider_id TEXT,
    provider_name TEXT,
    provider_nit TEXT,
    origin_debit_note_id TEXT,
    origin_debit_note_number INTEGER,
    issue_date TEXT NOT NULL,
    concept TEXT,
    currency TEXT NOT NULL DEFAULT 'BOB',
    frozen_exchange_rate REAL DEFAULT 6.96,
    settlement_model TEXT DEFAULT 'DEDUCCION_DIRECTA',
    total_amount REAL NOT NULL DEFAULT 0.00,
    total_amount_bob REAL NOT NULL DEFAULT 0.00,
    total_amount_usd REAL NOT NULL DEFAULT 0.00,
    paid_amount REAL DEFAULT 0.00,
    paid_amount_bob REAL DEFAULT 0.00,
    paid_amount_usd REAL DEFAULT 0.00,
    balance REAL DEFAULT 0.00,
    balance_bob REAL DEFAULT 0.00,
    balance_usd REAL DEFAULT 0.00,
    total_documento REAL DEFAULT 0.00,
    saldo_pendiente REAL DEFAULT 0.00,
    monto_acumulado_pagado REAL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'IMPAGA',
    estado TEXT DEFAULT 'IMPAGA',
    service_category TEXT NOT NULL,
    service_type TEXT,
    servicio_tipo TEXT,
    account_id TEXT,
    created_by_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_nc_number ON credit_notes(nc_number);
CREATE INDEX IF NOT EXISTS idx_nc_service_category ON credit_notes(service_category);
CREATE INDEX IF NOT EXISTS idx_nc_origin_nd ON credit_notes(origin_debit_note_id);

-- 8. TABLA: credit_note_items (Líneas de Detalle de Notas de Crédito)
CREATE TABLE IF NOT EXISTS credit_note_items (
    id TEXT PRIMARY KEY,
    credit_note_id TEXT NOT NULL,
    service_type TEXT,
    gds_ticket_id TEXT,
    ticket_number TEXT,
    voucher_number TEXT,
    passenger_name TEXT,
    passenger_doc_id TEXT,
    operator_id TEXT,
    operator_name TEXT,
    sub_service_name TEXT,
    description TEXT,
    service_details TEXT,
    settlement_model TEXT,
    currency TEXT,
    fare_amount REAL,
    gross_cost REAL,
    fee_amount REAL,
    total_amount REAL,
    net_cost_to_provider REAL,
    net_cost_to_provider_bob REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    raw_json TEXT,
    FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cni_credit_note ON credit_note_items(credit_note_id);

-- 9. TABLA: gds_tickets (Boletos Aéreos GDS Amadeus / Sabre / Emisiones Manuales)
CREATE TABLE IF NOT EXISTS gds_tickets (
    id TEXT PRIMARY KEY,
    ticket_number TEXT NOT NULL UNIQUE,
    gds_source TEXT DEFAULT 'AMADEUS',
    pnr_code TEXT,
    counter_id TEXT,
    issue_date TEXT NOT NULL,
    passenger_name TEXT NOT NULL,
    passenger_doc_id TEXT,
    route TEXT,
    flight_number TEXT,
    airline_code TEXT,
    airline_name TEXT,
    operator_id TEXT,
    operator_name TEXT,
    net_amount REAL DEFAULT 0.00,
    tax_amount REAL DEFAULT 0.00,
    total_amount REAL NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'BOB',
    commission_rate REAL DEFAULT 0.00,
    commission_amount REAL DEFAULT 0.00,
    fee_amount REAL DEFAULT 0.00,
    net_cost_to_provider REAL DEFAULT 0.00,
    status TEXT DEFAULT 'DISPONIBLE',
    service_type TEXT DEFAULT 'BOLETO_AEREO',
    sub_service_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_gds_ticket_number ON gds_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_gds_status ON gds_tickets(status);

-- 10. TABLA: cash_receipts (Recibos Oficiales de Cobro / Transacciones de Caja)
CREATE TABLE IF NOT EXISTS cash_receipts (
    id TEXT PRIMARY KEY,
    receipt_number INTEGER NOT NULL,
    receipt_code TEXT,
    receipt_date TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'ND',
    tipo_transaccion TEXT DEFAULT 'RECIBO DE PAGO',
    sub_tipo_transaccion TEXT,
    documento_origen TEXT,
    debit_note_id TEXT,
    debit_note_number INTEGER,
    credit_note_id TEXT,
    credit_note_number INTEGER,
    account_id TEXT,
    account_name TEXT,
    service_category TEXT,
    service_type TEXT,
    monto_transaccion REAL DEFAULT 0.00,
    monto_transaccion_usd REAL DEFAULT 0.00,
    total_paid_bob REAL DEFAULT 0.00,
    total_paid_usd REAL DEFAULT 0.00,
    total_documento REAL DEFAULT 0.00,
    saldo_pendiente REAL DEFAULT 0.00,
    monto_acumulado_pagado REAL DEFAULT 0.00,
    is_partial INTEGER DEFAULT 0,
    exchange_rate_used REAL DEFAULT 6.96,
    status TEXT DEFAULT 'VALIDO',
    estado TEXT DEFAULT 'PENDIENTE',
    glosa TEXT,
    concept TEXT,
    payment_method TEXT,
    financial_account_id TEXT,
    cajero TEXT,
    created_by_name TEXT,
    details_json TEXT,
    payments_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_receipt_number ON cash_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipt_debit_note ON cash_receipts(debit_note_id);

-- 11. TABLA: passengers (Directorio Centralizado de Pasajeros)
CREATE TABLE IF NOT EXISTS passengers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    doc TEXT,
    count INTEGER DEFAULT 1,
    last_use TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_passengers_name ON passengers(name);
CREATE INDEX IF NOT EXISTS idx_passengers_doc ON passengers(doc);

-- 12. TABLA: subservices (Catálogo Dinámico de Subservicios por Categoría)
CREATE TABLE IF NOT EXISTS subservices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    service_type TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subservices_service_type ON subservices(service_type);

-- 13. TABLA: expenses (Gastos Operativos de la Agencia)
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BOB',
    exchange_rate REAL DEFAULT 6.96,
    ticket_id TEXT,
    debit_note_id TEXT,
    supplier_account_id TEXT,
    bank_account_id TEXT,
    receipt_voucher TEXT,
    expense_date TEXT NOT NULL,
    created_by TEXT,
    status TEXT DEFAULT 'REGISTRADO',
    observations TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    raw_json TEXT
);

-- 14. TABLA: system_settings (Ajustes del Sistema y Configuración Global)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 15. TABLA: exchange_rates (Historial de Tipos de Cambio Centralizados)
CREATE TABLE IF NOT EXISTS exchange_rates (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    buy_rate REAL NOT NULL,
    sell_rate REAL NOT NULL,
    created_by_id TEXT,
    created_by_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 16. TABLA: payment_methods (Métodos de Pago Habilitados)
CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BOB',
    type TEXT,
    bank_account TEXT,
    status TEXT DEFAULT 'ACTIVO',
    financial_account_id TEXT,
    raw_json TEXT
);

-- 17. TABLA: service_types (Catálogo de Tipos de Servicios)
CREATE TABLE IF NOT EXISTS service_types (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT
);
