-- ============================================================================
-- MARETRAVEL ERP - ESQUEMA DE BASE DE DATOS EMPRESARIAL (PostgreSQL / MySQL)
-- Módulos: Cuentas Bancarias, Jerarquía Corporativa, Notas de Débito y Gastos
-- ============================================================================

-- Habilitar extensión UUID (en caso de PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. TABLA: accounts (Clientes Corporativos, Personas y Proveedores)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    legal_name VARCHAR(255),
    nit VARCHAR(50),
    relation_type VARCHAR(20) NOT NULL CHECK (relation_type IN ('CLIENTE', 'PROVEEDOR', 'AMBOS')),
    account_type VARCHAR(30) NOT NULL CHECK (account_type IN ('EMPRESA', 'PERSONA', 'AEROLINEA', 'HOTEL', 'ONG', 'INSTITUCION', 'RENT_A_CAR')),
    rating VARCHAR(20) DEFAULT 'NORMAL' CHECK (rating IN ('NORMAL', 'IMPORTANTE', 'VIP', 'CRITICA')),
    department VARCHAR(50),
    city VARCHAR(50),
    address TEXT,
    phone VARCHAR(50),
    cellphone VARCHAR(50),
    email VARCHAR(150),
    web_page VARCHAR(200),
    status VARCHAR(20) DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO', 'INACTIVO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accounts_nit ON accounts(nit);
CREATE INDEX idx_accounts_relation_type ON accounts(relation_type);
CREATE INDEX idx_accounts_status ON accounts(status);

-- ----------------------------------------------------------------------------
-- 2. TABLA: bank_accounts (Gestión de Cuentas Bancarias Self-Service)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_accounts (
    id VARCHAR(36) PRIMARY KEY,
    bank_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(80) NOT NULL,
    account_type VARCHAR(30) NOT NULL CHECK (account_type IN ('CORRIENTE', 'AHORROS', 'FONDO_ROTATORIO')),
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('BOB', 'USD')),
    titular_name VARCHAR(200) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_bank_account_number UNIQUE (bank_name, account_number)
);

CREATE INDEX idx_bank_accounts_active ON bank_accounts(is_active);
CREATE INDEX idx_bank_accounts_currency ON bank_accounts(currency);

-- ----------------------------------------------------------------------------
-- 3. TABLA: company_contacts (Jerarquía Corporativa: Solicitantes Autorizados)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_contacts (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    department VARCHAR(100),
    role_title VARCHAR(100),
    email VARCHAR(150),
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_company_contact_company FOREIGN KEY (company_id) 
        REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX idx_company_contacts_company ON company_contacts(company_id);
CREATE INDEX idx_company_contacts_active ON company_contacts(is_active);

-- ----------------------------------------------------------------------------
-- 4. TABLA: debit_notes (Notas de Débito Oficiales / Liquidaciones de Ventas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS debit_notes (
    id VARCHAR(36) PRIMARY KEY,
    nd_number BIGINT NOT NULL UNIQUE,
    account_id VARCHAR(36) NOT NULL,
    requester_id VARCHAR(36),
    solicitante_text VARCHAR(200),
    passenger_name VARCHAR(200),
    issue_date DATE NOT NULL,
    due_date DATE,
    payment_term VARCHAR(40) NOT NULL DEFAULT 'AL_CONTADO' 
        CHECK (payment_term IN ('AL_CONTADO', 'CREDITO_7_DIAS', 'CREDITO_15_DIAS', 'CREDITO_30_DIAS')),
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('BOB', 'USD')),
    total_amount_bob NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_amount_usd NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    paid_amount_bob NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    paid_amount_usd NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    balance_bob NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    balance_usd NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'BORRADOR' 
        CHECK (status IN ('BORRADOR', 'IMPAGA', 'PARCIAL', 'PAGADA', 'ANULADA')),
    observations TEXT,
    created_by VARCHAR(36),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_nd_account FOREIGN KEY (account_id) 
        REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_nd_requester FOREIGN KEY (requester_id) 
        REFERENCES company_contacts(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX idx_nd_account ON debit_notes(account_id);
CREATE INDEX idx_nd_requester ON debit_notes(requester_id);
CREATE INDEX idx_nd_issue_date ON debit_notes(issue_date);
CREATE INDEX idx_nd_status ON debit_notes(status);

-- ----------------------------------------------------------------------------
-- 5. TABLA: tickets (Boletos Aéreos GDS Amadeus / Sabre / Manuales)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
    id VARCHAR(36) PRIMARY KEY,
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    gds_source VARCHAR(20) DEFAULT 'AMADEUS' CHECK (gds_source IN ('AMADEUS', 'SABRE', 'MANUAL')),
    counter_id VARCHAR(50),
    issue_date DATE NOT NULL,
    passenger_name VARCHAR(200) NOT NULL,
    passenger_doc VARCHAR(50),
    route VARCHAR(100) NOT NULL,
    airline_code VARCHAR(10) NOT NULL,
    operator_id VARCHAR(36) NOT NULL,
    net_amount NUMERIC(14, 2) NOT NULL,
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(14, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('BOB', 'USD')),
    commission_rate NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    commission_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    fee_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'DISPONIBLE' CHECK (status IN ('DISPONIBLE', 'ASIGNADO', 'ANULADO', 'REEMBOLSADO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ticket_operator FOREIGN KEY (operator_id) 
        REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX idx_tickets_ticket_number ON tickets(ticket_number);
CREATE INDEX idx_tickets_operator ON tickets(operator_id);
CREATE INDEX idx_tickets_status ON tickets(status);

-- ----------------------------------------------------------------------------
-- 6. TABLA: debit_note_items (Líneas de Detalle de Notas de Débito)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS debit_note_items (
    id VARCHAR(36) PRIMARY KEY,
    debit_note_id VARCHAR(36) NOT NULL,
    service_type VARCHAR(30) NOT NULL CHECK (service_type IN ('BOLETO_GDS', 'HOTEL', 'PAQUETE', 'SEGURO', 'TRANSFER', 'PENALIDAD')),
    ticket_id VARCHAR(36),
    ticket_number VARCHAR(50),
    passenger_name VARCHAR(200) NOT NULL,
    passenger_doc_id VARCHAR(50),
    operator_id VARCHAR(36),
    description TEXT NOT NULL,
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('BOB', 'USD')),
    total_amount NUMERIC(14, 2) NOT NULL,
    fee_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    provider_commission_rate NUMERIC(6, 2) DEFAULT 0.00,
    provider_commission_amount NUMERIC(14, 2) DEFAULT 0.00,
    client_commission_rate NUMERIC(6, 2) DEFAULT 0.00,
    client_commission_amount NUMERIC(14, 2) DEFAULT 0.00,
    net_cost_to_provider NUMERIC(14, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dni_debit_note FOREIGN KEY (debit_note_id) 
        REFERENCES debit_notes(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_dni_ticket FOREIGN KEY (ticket_id) 
        REFERENCES tickets(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_dni_operator FOREIGN KEY (operator_id) 
        REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX idx_dni_debit_note ON debit_note_items(debit_note_id);
CREATE INDEX idx_dni_ticket ON debit_note_items(ticket_id);

-- ----------------------------------------------------------------------------
-- 7. TABLA: expenses (Modelo de Gastos Operativos y Vinculados a Boletos)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id VARCHAR(36) PRIMARY KEY,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'OPERATIVO_GENERAL',
        'FEE_EMISION',
        'PENALIDAD_AEREA',
        'COMISION_PASARELA',
        'TRASLADO',
        'HOTELERIA',
        'SERVICIO_TERCERO',
        'TRAMITES_VISAS',
        'OTROS_COSTOS'
    )),
    description TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('BOB', 'USD')),
    exchange_rate NUMERIC(10, 4) NOT NULL DEFAULT 6.9600,
    ticket_id VARCHAR(36),
    debit_note_id VARCHAR(36),
    supplier_account_id VARCHAR(36),
    bank_account_id VARCHAR(36),
    receipt_voucher VARCHAR(100),
    expense_date DATE NOT NULL,
    created_by VARCHAR(36) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'REGISTRADO' 
        CHECK (status IN ('REGISTRADO', 'PAGADO', 'ANULADO')),
    observations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_exp_ticket FOREIGN KEY (ticket_id) 
        REFERENCES tickets(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_exp_debit_note FOREIGN KEY (debit_note_id) 
        REFERENCES debit_notes(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_exp_supplier FOREIGN KEY (supplier_account_id) 
        REFERENCES accounts(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_exp_bank_account FOREIGN KEY (bank_account_id) 
        REFERENCES bank_accounts(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_ticket ON expenses(ticket_id);
CREATE INDEX idx_expenses_debit_note ON expenses(debit_note_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_status ON expenses(status);

-- ----------------------------------------------------------------------------
-- 8. DATOS INICIALES SEMBRADOS (Seed Data)
-- ----------------------------------------------------------------------------

-- Cuentas Bancarias Oficiales
INSERT INTO bank_accounts (id, bank_name, account_number, account_type, currency, titular_name, is_active)
VALUES
('BNK-001', 'Banco Nacional de Bolivia (BNB)', '100-29384-2', 'CORRIENTE', 'BOB', 'MARETRAVEL S.R.L.', TRUE),
('BNK-002', 'Banco Mercantil Santa Cruz (BMSC)', '401-09823-1', 'CORRIENTE', 'BOB', 'MARETRAVEL S.R.L.', TRUE),
('BNK-003', 'Banco Bisa S.A.', '029-91823-7', 'CORRIENTE', 'USD', 'MARETRAVEL S.R.L.', TRUE),
('BNK-004', 'Banco de Crédito de Bolivia (BCP)', '201-509281-3-12', 'AHORROS', 'BOB', 'MARETRAVEL S.R.L.', FALSE)
ON CONFLICT (bank_name, account_number) DO NOTHING;

-- Cliente Corporativo: Autosud S.R.L.
INSERT INTO accounts (id, code, name, legal_name, nit, relation_type, account_type, rating, department, city, address, phone, cellphone, email, web_page, status)
VALUES
('ACC-007', 'CLI-0004', 'Autosud S.R.L.', 'Autosud Representaciones y Comercio S.R.L.', '1029482019', 'CLIENTE', 'EMPRESA', 'VIP', 'Santa Cruz', 'Santa Cruz', 'Av. Cristo Redentor entre 4to y 5to Anillo #4500', '3429000', '77012345', 'compras@autosud.com.bo', 'www.autosud.com.bo', 'ACTIVO')
ON CONFLICT (code) DO NOTHING;

-- Solicitante Autorizado: Lic. Ana María Barrenechea
INSERT INTO company_contacts (id, company_id, full_name, department, email, phone, is_active)
VALUES
('CNT-001', 'ACC-007', 'Lic. Ana María Barrenechea', 'Encargada de Logística y Viajes', 'ana.barrenechea@autosud.com.bo', '+591 770-12345', TRUE),
('CNT-002', 'ACC-007', 'Ing. Roberto Arce Mendoza', 'Gerente Comercial', 'roberto.arce@autosud.com.bo', '+591 715-99887', TRUE)
ON CONFLICT (id) DO NOTHING;
