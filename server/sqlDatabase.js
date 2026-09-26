/**
 * MARETRAVEL ERP - Capa de Persistencia y Acceso a Base de Datos SQL Relacional
 * Motor: SQLite nativo (node:sqlite) con WAL y Transacciones Atómicas ACID.
 * Cero dependencias npm externas.
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_SQLITE_PATH = path.join(DATA_DIR, 'maretravel.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbInstance = null;

/**
 * Normaliza providerServices al contrato del frontend (array).
 * Las capas SQL lo almacenan como JSON string; se decodifica al leer.
 */
function parseProviderServices(v) {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p : [];
  } catch (e) {
    return [];
  }
}

function getSqlDb() {
  if (dbInstance) return dbInstance;

  dbInstance = new DatabaseSync(DB_SQLITE_PATH);

  // Optimizaciones de concurrencia y seguridad relacional
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec('PRAGMA synchronous = NORMAL;');

  // Inicializar esquema relacional si no existe
  if (fs.existsSync(SCHEMA_PATH)) {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    dbInstance.exec(schemaSql);
  }

  return dbInstance;
}

// ----------------------------------------------------------------------------
// REPOSITORIOS Y OPERACIONES SQL
// ----------------------------------------------------------------------------

const sqlDatabase = {
  getRawDb() {
    return getSqlDb();
  },

  // 1. CUENTAS (accounts)
  getAccounts() {
    const db = getSqlDb();
    const rows = db.prepare('SELECT * FROM accounts ORDER BY name ASC').all();
    return rows.map(r => {
      let base = {};
      if (r.raw_json) {
        try { base = JSON.parse(r.raw_json); } catch (_) {}
      }
      return {
        ...base,
        id: r.id,
        code: r.code,
        name: r.name,
        legalName: r.legal_name || base.legalName || '',
        nit: r.nit || base.nit || '',
        relationType: r.relation_type || base.relationType || 'CLIENTE',
        accountType: r.account_type || base.accountType || 'EMPRESA',
        rating: r.rating || base.rating || 'NORMAL',
        department: r.department || base.department || '',
        city: r.city || base.city || '',
        address: r.address || base.address || '',
        phone: r.phone || base.phone || '',
        cellphone: r.cellphone || base.cellphone || '',
        email: r.email || base.email || '',
        webPage: r.web_page || base.webPage || '',
        providerServices: parseProviderServices(r.provider_services || base.providerServices || ''),
        accountManager: r.account_manager || base.accountManager || '',
        status: r.status || base.status || 'ACTIVO',
        createdAt: r.created_at || base.createdAt,
        updatedAt: r.updated_at || base.updatedAt
      };
    });
  },

  saveAccount(acc) {
    const db = getSqlDb();
    const rawJson = JSON.stringify(acc);
    const stmt = db.prepare(`
      INSERT INTO accounts (
        id, code, name, legal_name, nit, relation_type, account_type,
        rating, department, city, address, phone, cellphone, email,
        web_page, provider_services, account_manager, status, created_at, updated_at, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        code = excluded.code,
        name = excluded.name,
        legal_name = excluded.legal_name,
        nit = excluded.nit,
        relation_type = excluded.relation_type,
        account_type = excluded.account_type,
        rating = excluded.rating,
        department = excluded.department,
        city = excluded.city,
        address = excluded.address,
        phone = excluded.phone,
        cellphone = excluded.cellphone,
        email = excluded.email,
        web_page = excluded.web_page,
        provider_services = excluded.provider_services,
        account_manager = excluded.account_manager,
        status = excluded.status,
        updated_at = excluded.updated_at,
        raw_json = excluded.raw_json
    `);

    stmt.run(
      String(acc.id || 'ACC-' + Date.now()),
      String(acc.code || ''),
      String(acc.name || ''),
      acc.legalName || null,
      acc.nit || null,
      acc.relationType || 'CLIENTE',
      acc.accountType || 'EMPRESA',
      acc.rating || 'NORMAL',
      acc.department || null,
      acc.city || null,
      acc.address || null,
      acc.phone || null,
      acc.cellphone || null,
      acc.email || null,
      acc.webPage || null,
      acc.providerServices ? (typeof acc.providerServices === 'string' ? acc.providerServices : JSON.stringify(acc.providerServices)) : null,
      acc.accountManager || null,
      acc.status || 'ACTIVO',
      acc.createdAt || new Date().toLocaleString(),
      new Date().toLocaleString(),
      rawJson
    );
  },

  deleteAccount(id) {
    const db = getSqlDb();
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  },

  // 2. NOTAS DE DÉBITO (debit_notes & debit_note_items)
  getDebitNotes() {
    const db = getSqlDb();
    const rows = db.prepare('SELECT * FROM debit_notes ORDER BY nd_number DESC').all();
    const itemStmt = db.prepare('SELECT * FROM debit_note_items WHERE debit_note_id = ?');

    return rows.map(r => {
      let base = {};
      if (r.raw_json) {
        try { base = JSON.parse(r.raw_json); } catch (_) {}
      }
      const itemRows = itemStmt.all(r.id);
      const items = itemRows.map(it => {
        let itBase = {};
        if (it.raw_json) {
          try { itBase = JSON.parse(it.raw_json); } catch (_) {}
        }
        return {
          ...itBase,
          id: it.id,
          serviceType: it.service_type,
          ticketNumber: it.ticket_number,
          voucherNumber: it.voucher_number,
          passengerName: it.passenger_name,
          passengerDocId: it.passenger_doc_id,
          operatorId: it.operator_id,
          operatorName: it.operator_name,
          subServiceName: it.sub_service_name,
          description: it.description,
          totalAmount: it.total_amount,
          feeAmount: it.fee_amount,
          netCostToProvider: it.net_cost_to_provider
        };
      });

      return {
        ...base,
        id: r.id,
        ndNumber: r.nd_number,
        ndCode: r.nd_code || base.ndCode || ('#nd' + r.nd_number),
        accountId: r.account_id,
        accountName: r.account_name || base.accountName,
        accountNit: r.account_nit || base.accountNit,
        passengerName: r.passenger_name || base.passengerName,
        issueDate: r.issue_date,
        currency: r.currency || 'BOB',
        totalAmountBob: r.total_amount_bob,
        totalAmountUsd: r.total_amount_usd,
        paidAmountBob: r.paid_amount_bob,
        paidAmountUsd: r.paid_amount_usd,
        balanceBob: r.balance_bob,
        balanceUsd: r.balance_usd,
        total_documento: r.total_documento || r.total_amount_bob,
        saldo_pendiente: r.saldo_pendiente || r.balance_bob,
        monto_acumulado_pagado: r.monto_acumulado_pagado || r.paid_amount_bob,
        status: r.status,
        estado: r.estado || r.status,
        observations: r.observations || base.observations || '',
        items: items.length > 0 ? items : (base.items || []),
        createdAt: r.created_at || base.createdAt
      };
    });
  },

  saveDebitNote(nd) {
    const db = getSqlDb();
    const rawJson = JSON.stringify(nd);
    const stmt = db.prepare(`
      INSERT INTO debit_notes (
        id, nd_number, nd_code, account_id, account_name, account_nit,
        requester_id, solicitante, passenger_name, issue_date, due_date,
        payment_term, currency, frozen_exchange_rate, exchange_rate_used,
        total_amount_bob, total_amount_usd, paid_amount_bob, paid_amount_usd,
        balance_bob, balance_usd, total_documento, saldo_pendiente,
        monto_acumulado_pagado, status, estado, deposit_account_id,
        financial_account_id, observations, created_by_id, created_by_name,
        created_at, updated_at, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        nd_number = excluded.nd_number,
        nd_code = excluded.nd_code,
        account_id = excluded.account_id,
        account_name = excluded.account_name,
        account_nit = excluded.account_nit,
        requester_id = excluded.requester_id,
        solicitante = excluded.solicitante,
        passenger_name = excluded.passenger_name,
        issue_date = excluded.issue_date,
        due_date = excluded.due_date,
        payment_term = excluded.payment_term,
        currency = excluded.currency,
        frozen_exchange_rate = excluded.frozen_exchange_rate,
        exchange_rate_used = excluded.exchange_rate_used,
        total_amount_bob = excluded.total_amount_bob,
        total_amount_usd = excluded.total_amount_usd,
        paid_amount_bob = excluded.paid_amount_bob,
        paid_amount_usd = excluded.paid_amount_usd,
        balance_bob = excluded.balance_bob,
        balance_usd = excluded.balance_usd,
        total_documento = excluded.total_documento,
        saldo_pendiente = excluded.saldo_pendiente,
        monto_acumulado_pagado = excluded.monto_acumulado_pagado,
        status = excluded.status,
        estado = excluded.estado,
        deposit_account_id = excluded.deposit_account_id,
        financial_account_id = excluded.financial_account_id,
        observations = excluded.observations,
        updated_at = excluded.updated_at,
        raw_json = excluded.raw_json
    `);

    stmt.run(
      nd.id,
      Number(nd.ndNumber || 0),
      nd.ndCode || null,
      nd.accountId || 'ACC-001',
      nd.accountName || null,
      nd.accountNit || null,
      nd.requesterId || null,
      nd.solicitante || null,
      nd.passengerName || null,
      nd.issueDate || new Date().toISOString().split('T')[0],
      nd.dueDate || null,
      nd.paymentTerm || 'AL_CONTADO',
      nd.currency || 'BOB',
      Number(nd.frozenExchangeRate || 6.96),
      Number(nd.exchangeRateUsed || 6.96),
      Number(nd.totalAmountBob || nd.total_documento || 0),
      Number(nd.totalAmountUsd || 0),
      Number(nd.paidAmountBob || nd.monto_acumulado_pagado || 0),
      Number(nd.paidAmountUsd || 0),
      Number(nd.balanceBob || nd.saldo_pendiente || 0),
      Number(nd.balanceUsd || 0),
      Number(nd.total_documento || nd.totalAmountBob || 0),
      Number(nd.saldo_pendiente || nd.balanceBob || 0),
      Number(nd.monto_acumulado_pagado || nd.paidAmountBob || 0),
      nd.status || 'PENDIENTE',
      nd.estado || nd.status || 'PENDIENTE',
      nd.depositAccountId || null,
      nd.financialAccountId || null,
      nd.observations || null,
      nd.createdById || null,
      nd.createdByName || null,
      nd.createdAt || new Date().toLocaleString(),
      new Date().toLocaleString(),
      rawJson
    );

    // Guardar ítems asociados
    db.prepare('DELETE FROM debit_note_items WHERE debit_note_id = ?').run(nd.id);
    if (Array.isArray(nd.items) && nd.items.length > 0) {
      const itemStmt = db.prepare(`
        INSERT INTO debit_note_items (
          id, debit_note_id, service_type, ticket_id, ticket_number,
          voucher_number, passenger_name, passenger_doc_id, operator_id,
          operator_name, sub_service_name, description, service_details,
          settlement_model, currency, fare_amount, gross_cost, fee_amount,
          total_amount, fare_amount_bob, gross_cost_bob, fee_amount_bob,
          total_amount_bob, provider_commission_rate, provider_commission_amount,
          provider_commission_amount_bob, client_commission_rate, client_commission_amount,
          counter_commission_amount, net_cost_to_provider, net_cost_to_provider_bob,
          created_at, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const it of nd.items) {
        itemStmt.run(
          it.id || ('NDI-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)),
          nd.id,
          it.serviceType || 'BOLETO_AEREO',
          it.ticketId || null,
          it.ticketNumber || null,
          it.voucherNumber || null,
          it.passengerName || nd.passengerName || 'PASAJERO',
          it.passengerDocId || null,
          it.operatorId || null,
          it.operatorName || null,
          it.subServiceName || null,
          it.description || it.subServiceName || '',
          typeof it.serviceDetails === 'object' ? JSON.stringify(it.serviceDetails) : (it.serviceDetails || null),
          it.settlementModel || 'DEDUCCION_DIRECTA',
          it.currency || nd.currency || 'BOB',
          Number(it.fareAmount || 0),
          Number(it.grossCost || 0),
          Number(it.feeAmount || 0),
          Number(it.totalAmount || 0),
          Number(it.fareAmountBob || 0),
          Number(it.grossCostBob || 0),
          Number(it.feeAmountBob || 0),
          Number(it.totalAmountBob || it.totalAmount || 0),
          Number(it.providerCommissionRate || 0),
          Number(it.providerCommissionAmount || 0),
          Number(it.providerCommissionAmountBob || 0),
          Number(it.clientCommissionRate || 0),
          Number(it.clientCommissionAmount || 0),
          Number(it.counterCommissionAmount || 0),
          Number(it.netCostToProvider || 0),
          Number(it.netCostToProviderBob || 0),
          it.createdAt || new Date().toLocaleString(),
          JSON.stringify(it)
        );
      }
    }
  },

  deleteDebitNote(id) {
    const db = getSqlDb();
    db.prepare('DELETE FROM debit_notes WHERE id = ?').run(id);
    db.prepare('DELETE FROM credit_notes WHERE origin_debit_note_id = ?').run(id);
  },

  // 3. NOTAS DE CRÉDITO (credit_notes & credit_note_items)
  getCreditNotes() {
    const db = getSqlDb();
    const rows = db.prepare('SELECT * FROM credit_notes ORDER BY nc_number DESC').all();
    const itemStmt = db.prepare('SELECT * FROM credit_note_items WHERE credit_note_id = ?');

    return rows.map(r => {
      let base = {};
      if (r.raw_json) {
        try { base = JSON.parse(r.raw_json); } catch (_) {}
      }
      const itemRows = itemStmt.all(r.id);
      const items = itemRows.map(it => {
        let itBase = {};
        if (it.raw_json) {
          try { itBase = JSON.parse(it.raw_json); } catch (_) {}
        }
        return { ...itBase, id: it.id, totalAmount: it.total_amount, netCostToProvider: it.net_cost_to_provider };
      });

      return {
        ...base,
        id: r.id,
        ncNumber: r.nc_number,
        ncCode: r.nc_code || base.ncCode || ('#nc' + r.nc_number),
        providerId: r.provider_id,
        providerName: r.provider_name || base.providerName,
        providerNit: r.provider_nit || base.providerNit,
        originDebitNoteId: r.origin_debit_note_id,
        originDebitNoteNumber: r.origin_debit_note_number,
        issueDate: r.issue_date,
        concept: r.concept || base.concept,
        currency: r.currency || 'BOB',
        totalAmount: r.total_amount,
        totalAmountBob: r.total_amount_bob,
        totalAmountUsd: r.total_amount_usd,
        paidAmount: r.paid_amount,
        paidAmountBob: r.paid_amount_bob,
        paidAmountUsd: r.paid_amount_usd,
        balance: r.balance,
        balanceBob: r.balance_bob,
        balanceUsd: r.balance_usd,
        total_documento: r.total_documento || r.total_amount,
        saldo_pendiente: r.saldo_pendiente || r.balance,
        monto_acumulado_pagado: r.monto_acumulado_pagado || r.paid_amount,
        status: r.status,
        estado: r.estado || r.status,
        serviceCategory: r.service_category,
        serviceType: r.service_type || r.service_category,
        servicio_tipo: r.servicio_tipo || r.service_category,
        items: items.length > 0 ? items : (base.items || []),
        createdAt: r.created_at || base.createdAt
      };
    });
  },

  saveCreditNote(nc) {
    const db = getSqlDb();
    const rawJson = JSON.stringify(nc);
    const stmt = db.prepare(`
      INSERT INTO credit_notes (
        id, nc_number, nc_code, provider_id, provider_name, provider_nit,
        origin_debit_note_id, origin_debit_note_number, issue_date, concept,
        currency, frozen_exchange_rate, settlement_model, total_amount,
        total_amount_bob, total_amount_usd, paid_amount, paid_amount_bob,
        paid_amount_usd, balance, balance_bob, balance_usd, total_documento,
        saldo_pendiente, monto_acumulado_pagado, status, estado,
        service_category, service_type, servicio_tipo, account_id,
        created_by_id, created_at, updated_at, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        nc_number = excluded.nc_number,
        nc_code = excluded.nc_code,
        provider_id = excluded.provider_id,
        provider_name = excluded.provider_name,
        provider_nit = excluded.provider_nit,
        origin_debit_note_id = excluded.origin_debit_note_id,
        origin_debit_note_number = excluded.origin_debit_note_number,
        issue_date = excluded.issue_date,
        concept = excluded.concept,
        currency = excluded.currency,
        frozen_exchange_rate = excluded.frozen_exchange_rate,
        settlement_model = excluded.settlement_model,
        total_amount = excluded.total_amount,
        total_amount_bob = excluded.total_amount_bob,
        total_amount_usd = excluded.total_amount_usd,
        paid_amount = excluded.paid_amount,
        paid_amount_bob = excluded.paid_amount_bob,
        paid_amount_usd = excluded.paid_amount_usd,
        balance = excluded.balance,
        balance_bob = excluded.balance_bob,
        balance_usd = excluded.balance_usd,
        total_documento = excluded.total_documento,
        saldo_pendiente = excluded.saldo_pendiente,
        monto_acumulado_pagado = excluded.monto_acumulado_pagado,
        status = excluded.status,
        estado = excluded.estado,
        service_category = excluded.service_category,
        service_type = excluded.service_type,
        servicio_tipo = excluded.servicio_tipo,
        account_id = excluded.account_id,
        updated_at = excluded.updated_at,
        raw_json = excluded.raw_json
    `);

    stmt.run(
      nc.id,
      Number(nc.ncNumber || 0),
      nc.ncCode || null,
      nc.providerId || nc.accountId || null,
      nc.providerName || null,
      nc.providerNit || null,
      nc.originDebitNoteId || null,
      Number(nc.originDebitNoteNumber || 0),
      nc.issueDate || new Date().toISOString().split('T')[0],
      nc.concept || null,
      nc.currency || 'BOB',
      Number(nc.frozenExchangeRate || 6.96),
      nc.settlementModel || 'DEDUCCION_DIRECTA',
      Number(nc.totalAmount || nc.total_documento || 0),
      Number(nc.totalAmountBob || 0),
      Number(nc.totalAmountUsd || 0),
      Number(nc.paidAmount || nc.monto_acumulado_pagado || 0),
      Number(nc.paidAmountBob || 0),
      Number(nc.paidAmountUsd || 0),
      Number(nc.balance || nc.saldo_pendiente || 0),
      Number(nc.balanceBob || 0),
      Number(nc.balanceUsd || 0),
      Number(nc.total_documento || nc.totalAmount || 0),
      Number(nc.saldo_pendiente || nc.balance || 0),
      Number(nc.monto_acumulado_pagado || nc.paidAmount || 0),
      nc.status || 'IMPAGA',
      nc.estado || nc.status || 'IMPAGA',
      nc.serviceCategory || nc.serviceType || 'BOLETO_AEREO',
      nc.serviceType || nc.serviceCategory || 'BOLETO_AEREO',
      nc.servicio_tipo || nc.serviceCategory || 'BOLETO_AEREO',
      nc.accountId || nc.providerId || null,
      nc.createdById || null,
      nc.createdAt || new Date().toLocaleString(),
      new Date().toLocaleString(),
      rawJson
    );

    // Guardar ítems asociados
    db.prepare('DELETE FROM credit_note_items WHERE credit_note_id = ?').run(nc.id);
    if (Array.isArray(nc.items) && nc.items.length > 0) {
      const itemStmt = db.prepare(`
        INSERT INTO credit_note_items (
          id, credit_note_id, service_type, gds_ticket_id, ticket_number,
          voucher_number, passenger_name, passenger_doc_id, operator_id,
          operator_name, sub_service_name, description, service_details,
          settlement_model, currency, fare_amount, gross_cost, fee_amount,
          total_amount, net_cost_to_provider, net_cost_to_provider_bob,
          created_at, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const it of nc.items) {
        itemStmt.run(
          it.id || ('NCI-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)),
          nc.id,
          it.serviceType || nc.serviceCategory,
          it.gdsTicketId || null,
          it.ticketNumber || null,
          it.voucherNumber || null,
          it.passengerName || null,
          it.passengerDocId || null,
          it.operatorId || null,
          it.operatorName || null,
          it.subServiceName || null,
          it.description || '',
          typeof it.serviceDetails === 'object' ? JSON.stringify(it.serviceDetails) : (it.serviceDetails || null),
          it.settlementModel || nc.settlementModel || 'DEDUCCION_DIRECTA',
          it.currency || nc.currency || 'BOB',
          Number(it.fareAmount || 0),
          Number(it.grossCost || 0),
          Number(it.feeAmount || 0),
          Number(it.totalAmount || 0),
          Number(it.netCostToProvider || 0),
          Number(it.netCostToProviderBob || 0),
          it.createdAt || new Date().toLocaleString(),
          JSON.stringify(it)
        );
      }
    }
  },

  deleteCreditNote(id) {
    const db = getSqlDb();
    db.prepare('DELETE FROM credit_notes WHERE id = ?').run(id);
  },

  // 4. RECIBOS DE CAJA / TRANSACCIONES (cash_receipts)
  getCashReceipts() {
    const db = getSqlDb();
    const rows = db.prepare('SELECT * FROM cash_receipts ORDER BY receipt_number DESC').all();
    return rows.map(r => {
      let base = {};
      if (r.raw_json) {
        try { base = JSON.parse(r.raw_json); } catch (_) {}
      }
      let details = [];
      let payments = [];
      if (r.details_json) {
        try { details = JSON.parse(r.details_json); } catch (_) {}
      }
      if (r.payments_json) {
        try { payments = JSON.parse(r.payments_json); } catch (_) {}
      }

      return {
        ...base,
        id: r.id,
        receiptNumber: r.receipt_number,
        receiptCode: r.receipt_code,
        receiptDate: r.receipt_date,
        tipo: r.tipo,
        tipoTransaccion: r.tipo_transaccion,
        subTipoTransaccion: r.sub_tipo_transaccion,
        documentoOrigen: r.documento_origen,
        debitNoteId: r.debit_note_id,
        debitNoteNumber: r.debit_note_number,
        creditNoteId: r.credit_note_id,
        creditNoteNumber: r.credit_note_number,
        accountId: r.account_id,
        accountName: r.account_name,
        serviceCategory: r.service_category,
        serviceType: r.service_type,
        monto_transaccion: r.monto_transaccion,
        monto_transaccion_usd: r.monto_transaccion_usd,
        totalPaidBob: r.total_paid_bob,
        totalPaidUsd: r.total_paid_usd,
        total_documento: r.total_documento,
        saldo_pendiente: r.saldo_pendiente,
        monto_acumulado_pagado: r.monto_acumulado_pagado,
        isPartial: Boolean(r.is_partial),
        exchangeRateUsed: r.exchange_rate_used,
        status: r.status,
        estado: r.estado,
        glosa: r.glosa,
        concept: r.concept,
        paymentMethod: r.payment_method,
        financialAccountId: r.financial_account_id,
        cajero: r.cajero,
        createdByName: r.created_by_name,
        details: details.length > 0 ? details : (base.details || []),
        payments: payments.length > 0 ? payments : (base.payments || []),
        createdAt: r.created_at || base.createdAt
      };
    });
  },

  saveCashReceipt(rcp) {
    const db = getSqlDb();
    const rawJson = JSON.stringify(rcp);
    const detailsJson = JSON.stringify(rcp.details || []);
    const paymentsJson = JSON.stringify(rcp.payments || []);

    const stmt = db.prepare(`
      INSERT INTO cash_receipts (
        id, receipt_number, receipt_code, receipt_date, tipo,
        tipo_transaccion, sub_tipo_transaccion, documento_origen,
        debit_note_id, debit_note_number, credit_note_id, credit_note_number,
        account_id, account_name, service_category, service_type,
        monto_transaccion, monto_transaccion_usd, total_paid_bob, total_paid_usd,
        total_documento, saldo_pendiente, monto_acumulado_pagado, is_partial,
        exchange_rate_used, status, estado, glosa, concept,
        payment_method, financial_account_id, cajero, created_by_name,
        details_json, payments_json, created_at, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        receipt_number = excluded.receipt_number,
        receipt_code = excluded.receipt_code,
        receipt_date = excluded.receipt_date,
        tipo = excluded.tipo,
        tipo_transaccion = excluded.tipo_transaccion,
        sub_tipo_transaccion = excluded.sub_tipo_transaccion,
        documento_origen = excluded.documento_origen,
        debit_note_id = excluded.debit_note_id,
        debit_note_number = excluded.debit_note_number,
        credit_note_id = excluded.credit_note_id,
        credit_note_number = excluded.credit_note_number,
        account_id = excluded.account_id,
        account_name = excluded.account_name,
        service_category = excluded.service_category,
        service_type = excluded.service_type,
        monto_transaccion = excluded.monto_transaccion,
        monto_transaccion_usd = excluded.monto_transaccion_usd,
        total_paid_bob = excluded.total_paid_bob,
        total_paid_usd = excluded.total_paid_usd,
        total_documento = excluded.total_documento,
        saldo_pendiente = excluded.saldo_pendiente,
        monto_acumulado_pagado = excluded.monto_acumulado_pagado,
        is_partial = excluded.is_partial,
        exchange_rate_used = excluded.exchange_rate_used,
        status = excluded.status,
        estado = excluded.estado,
        glosa = excluded.glosa,
        concept = excluded.concept,
        payment_method = excluded.payment_method,
        financial_account_id = excluded.financial_account_id,
        cajero = excluded.cajero,
        created_by_name = excluded.created_by_name,
        details_json = excluded.details_json,
        payments_json = excluded.payments_json,
        raw_json = excluded.raw_json
    `);

    stmt.run(
      rcp.id || ('RCP-' + Date.now()),
      Number(rcp.receiptNumber || 0),
      rcp.receiptCode || null,
      rcp.receiptDate || new Date().toISOString().split('T')[0],
      rcp.tipo || 'ND',
      rcp.tipoTransaccion || 'RECIBO DE PAGO',
      rcp.subTipoTransaccion || null,
      rcp.documentoOrigen || null,
      rcp.debitNoteId || null,
      rcp.debitNoteNumber ? Number(rcp.debitNoteNumber) : null,
      rcp.creditNoteId || null,
      rcp.creditNoteNumber ? Number(rcp.creditNoteNumber) : null,
      rcp.accountId || null,
      rcp.accountName || null,
      rcp.serviceCategory || null,
      rcp.serviceType || null,
      Number(rcp.monto_transaccion || 0),
      Number(rcp.monto_transaccion_usd || 0),
      Number(rcp.totalPaidBob || 0),
      Number(rcp.totalPaidUsd || 0),
      Number(rcp.total_documento || 0),
      Number(rcp.saldo_pendiente || 0),
      Number(rcp.monto_acumulado_pagado || 0),
      rcp.isPartial ? 1 : 0,
      Number(rcp.exchangeRateUsed || 6.96),
      rcp.status || 'VALIDO',
      rcp.estado || 'PENDIENTE',
      rcp.glosa || null,
      rcp.concept || null,
      rcp.paymentMethod || null,
      rcp.financialAccountId || null,
      rcp.cajero || null,
      rcp.createdByName || null,
      detailsJson,
      paymentsJson,
      rcp.createdAt || new Date().toLocaleString(),
      rawJson
    );
  },

  // 5. BOLETOS GDS (gds_tickets)
  getGdsTickets() {
    const db = getSqlDb();
    const rows = db.prepare('SELECT * FROM gds_tickets ORDER BY issue_date DESC').all();
    return rows.map(r => {
      let base = {};
      if (r.raw_json) {
        try { base = JSON.parse(r.raw_json); } catch (_) {}
      }
      return {
        ...base,
        id: r.id,
        ticketNumber: r.ticket_number,
        gdsSource: r.gds_source,
        pnrCode: r.pnr_code,
        counterId: r.counter_id,
        issueDate: r.issue_date,
        passengerName: r.passenger_name,
        passengerDocId: r.passenger_doc_id,
        route: r.route,
        flightNumber: r.flight_number,
        airlineCode: r.airline_code,
        airlineName: r.airline_name,
        operatorId: r.operator_id,
        operatorName: r.operator_name,
        netAmount: r.net_amount,
        taxAmount: r.tax_amount,
        totalAmount: r.total_amount,
        currency: r.currency,
        commissionRate: r.commission_rate,
        commissionAmount: r.commission_amount,
        feeAmount: r.fee_amount,
        netCostToProvider: r.net_cost_to_provider,
        status: r.status,
        serviceType: r.service_type,
        subServiceName: r.sub_service_name,
        createdAt: r.created_at || base.createdAt
      };
    });
  },

  saveGdsTicket(t) {
    const db = getSqlDb();
    const rawJson = JSON.stringify(t);
    const stmt = db.prepare(`
      INSERT INTO gds_tickets (
        id, ticket_number, gds_source, pnr_code, counter_id,
        issue_date, passenger_name, passenger_doc_id, route,
        flight_number, airline_code, airline_name, operator_id,
        operator_name, net_amount, tax_amount, total_amount,
        currency, commission_rate, commission_amount, fee_amount,
        net_cost_to_provider, status, service_type, sub_service_name,
        created_at, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(ticket_number) DO UPDATE SET
        pnr_code = excluded.pnr_code,
        passenger_name = excluded.passenger_name,
        passenger_doc_id = excluded.passenger_doc_id,
        route = excluded.route,
        flight_number = excluded.flight_number,
        operator_id = excluded.operator_id,
        operator_name = excluded.operator_name,
        net_amount = excluded.net_amount,
        tax_amount = excluded.tax_amount,
        total_amount = excluded.total_amount,
        currency = excluded.currency,
        commission_rate = excluded.commission_rate,
        commission_amount = excluded.commission_amount,
        fee_amount = excluded.fee_amount,
        net_cost_to_provider = excluded.net_cost_to_provider,
        status = excluded.status,
        sub_service_name = excluded.sub_service_name,
        raw_json = excluded.raw_json
    `);

    stmt.run(
      t.id || ('TKT-' + Date.now()),
      String(t.ticketNumber || ''),
      t.gdsSource || 'AMADEUS',
      t.pnrCode || null,
      t.counterId || null,
      t.issueDate || new Date().toISOString().split('T')[0],
      String(t.passengerName || ''),
      t.passengerDocId || null,
      t.route || '',
      t.flightNumber || null,
      t.airlineCode || '',
      t.airlineName || null,
      t.operatorId || '',
      t.operatorName || null,
      Number(t.netAmount || 0),
      Number(t.taxAmount || 0),
      Number(t.totalAmount || 0),
      t.currency || 'BOB',
      Number(t.commissionRate || 0),
      Number(t.commissionAmount || 0),
      Number(t.feeAmount || 0),
      Number(t.netCostToProvider || 0),
      t.status || 'DISPONIBLE',
      t.serviceType || 'BOLETO_AEREO',
      t.subServiceName || null,
      t.createdAt || new Date().toLocaleString(),
      rawJson
    );
  },

  deleteGdsTicket(ticketNumberOrId) {
    const db = getSqlDb();
    db.prepare('DELETE FROM gds_tickets WHERE ticket_number = ? OR id = ?').run(ticketNumberOrId, ticketNumberOrId);
  },

  // 6. PASAJEROS (passengers)
  getPassengers() {
    const db = getSqlDb();
    return db.prepare('SELECT id, name, doc, count, last_use as lastUse, created_at as createdAt FROM passengers ORDER BY count DESC, name ASC').all();
  },

  registerPassenger(name, doc) {
    const nm = String(name || '').trim();
    if (!nm) return;
    const db = getSqlDb();
    const dc = String(doc || '').trim();

    const existing = db.prepare('SELECT id, count FROM passengers WHERE UPPER(name) = UPPER(?) AND UPPER(COALESCE(doc, "")) = UPPER(?)').get(nm, dc);
    if (existing) {
      db.prepare('UPDATE passengers SET count = count + 1, last_use = ? WHERE id = ?').run(new Date().toLocaleString(), existing.id);
    } else {
      const id = 'PAX-' + Date.now() + '-' + Math.floor(Math.random() * 999);
      db.prepare('INSERT INTO passengers (id, name, doc, count, last_use, created_at) VALUES (?, ?, ?, 1, ?, ?)').run(
        id, nm, dc, new Date().toLocaleString(), new Date().toLocaleString()
      );
    }
  },

  // 7. SUBSERVICIOS (subservices)
  getSubservices() {
    const db = getSqlDb();
    return db.prepare('SELECT id, name, service_type as serviceType, created_at as createdAt FROM subservices ORDER BY name ASC').all();
  },

  saveSubservice(sub) {
    const db = getSqlDb();
    const id = sub.id || ('SS-' + Date.now());
    const stmt = db.prepare(`
      INSERT INTO subservices (id, name, service_type, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, service_type = excluded.service_type
    `);
    stmt.run(id, String(sub.name || ''), String(sub.serviceType || 'BOLETO_AEREO'), sub.createdAt || new Date().toLocaleString());
  },

  // 8. CUENTAS FINANCIERAS (financial_accounts)
  getFinancialAccounts() {
    const db = getSqlDb();
    const rows = db.prepare('SELECT * FROM financial_accounts ORDER BY bank_name ASC').all();
    return rows.map(r => {
      let base = {};
      if (r.raw_json) {
        try { base = JSON.parse(r.raw_json); } catch (_) {}
      }
      return {
        ...base,
        id: r.id,
        type: r.type,
        bankName: r.bank_name,
        accountNumber: r.account_number,
        accountType: r.account_type,
        titularName: r.titular_name,
        currency: r.currency,
        isActive: Boolean(r.is_active),
        currentBalance: r.current_balance,
        cashDeskName: r.cash_desk_name,
        custodianName: r.custodian_name,
        binanceId: r.binance_id,
        walletAddress: r.wallet_address
      };
    });
  },

  saveFinancialAccount(acc) {
    const db = getSqlDb();
    const rawJson = JSON.stringify(acc);
    const stmt = db.prepare(`
      INSERT INTO financial_accounts (
        id, type, bank_name, account_number, account_type,
        titular_name, currency, is_active, current_balance,
        cash_desk_name, custodian_name, binance_id, wallet_address,
        created_at, updated_at, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        bank_name = excluded.bank_name,
        account_number = excluded.account_number,
        account_type = excluded.account_type,
        titular_name = excluded.titular_name,
        currency = excluded.currency,
        is_active = excluded.is_active,
        current_balance = excluded.current_balance,
        cash_desk_name = excluded.cash_desk_name,
        custodian_name = excluded.custodian_name,
        binance_id = excluded.binance_id,
        wallet_address = excluded.wallet_address,
        updated_at = excluded.updated_at,
        raw_json = excluded.raw_json
    `);

    stmt.run(
      acc.id || ('ACC-BNK-' + Date.now()),
      acc.type || 'BANCO',
      acc.bankName || 'Banco',
      acc.accountNumber || '',
      acc.accountType || 'CORRIENTE',
      acc.titularName || '',
      acc.currency || 'BOB',
      acc.isActive !== false ? 1 : 0,
      Number(acc.currentBalance || 0),
      acc.cashDeskName || null,
      acc.custodianName || null,
      acc.binanceId || null,
      acc.walletAddress || null,
      acc.createdAt || new Date().toLocaleString(),
      new Date().toLocaleString(),
      rawJson
    );
  },

  // 9. CONFIGURACIÓN DEL SISTEMA (system_settings)
  getSystemSettings() {
    const db = getSqlDb();
    const rows = db.prepare('SELECT key, value FROM system_settings').all();
    const settings = {};
    for (const r of rows) {
      try {
        settings[r.key] = JSON.parse(r.value);
      } catch (_) {
        settings[r.key] = r.value;
      }
    }
    return settings;
  },

  saveSystemSettings(settingsObj) {
    const db = getSqlDb();
    const stmt = db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const [k, v] of Object.entries(settingsObj || {})) {
      stmt.run(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
  },

  // --------------------------------------------------------------------------
  // AGREGADOR / SNAPSHOT RELACIONAL COMPLETO (Soporte Transaccional para la UI)
  // --------------------------------------------------------------------------
  getFullState() {
    const accounts = this.getAccounts();
    const debitNotes = this.getDebitNotes();
    const creditNotes = this.getCreditNotes();
    const cashReceipts = this.getCashReceipts();
    const gdsTickets = this.getGdsTickets();
    const passengers = this.getPassengers();
    const subservices = this.getSubservices();
    const financialAccounts = this.getFinancialAccounts();
    const settings = this.getSystemSettings();

    const db = getSqlDb();
    const accountHistory = db.prepare('SELECT id, account_id as accountId, account_name as accountName, change_type as changeType, field_changed as fieldChanged, old_value as oldValue, new_value as newValue, user_id as userId, user_name as userName, created_at as createdAt FROM account_history ORDER BY created_at DESC').all();
    const paymentMethods = db.prepare('SELECT * FROM payment_methods').all().map(r => r.raw_json ? JSON.parse(r.raw_json) : r);
    const serviceTypes = db.prepare('SELECT * FROM service_types').all();
    const exchangeRates = db.prepare('SELECT * FROM exchange_rates ORDER BY date DESC').all();

    return {
      systemSettings: settings,
      currentUser: {
        id: 'USR-001',
        name: 'Luis',
        username: 'luis',
        role: 'ADMIN',
        email: 'luis@maretravel.bo'
      },
      exchangeRates: exchangeRates.length > 0 ? exchangeRates : [
        { id: 'TC-001', date: new Date().toISOString().split('T')[0], buyRate: settings.activeExchangeBuy || 6.86, sellRate: settings.activeExchangeSell || 6.96 }
      ],
      paymentMethods: paymentMethods.length > 0 ? paymentMethods : [],
      financialAccounts,
      bankAccounts: financialAccounts.filter(a => a.type === 'BANCO'),
      accounts,
      accountHistory,
      companyContacts: [],
      gdsTickets,
      debitNotes,
      creditNotes,
      cashReceipts,
      cashTransactions: [],
      expenses: [],
      travelReminders: [],
      passengers,
      auditLog: [],
      accountingModifications: [],
      otherIncomes: [],
      providerPayments: [],
      serviceTypes: serviceTypes.length > 0 ? serviceTypes : [],
      savedSubServices: subservices
    };
  },

  // Flag soft-delete: fila marcada como eliminada en raw_json (papelera) nunca se prunca
  isSoftDeleted(rawJson) {
    if (!rawJson) return false;
    try { return JSON.parse(rawJson).deleted === true; } catch (_) { return false; }
  },

  saveFullState(state) {
    const db = getSqlDb();

    // Transacción atómica ACID
    db.exec('BEGIN TRANSACTION;');
    try {
      if (state.systemSettings) {
        this.saveSystemSettings(state.systemSettings);
      }

      if (Array.isArray(state.financialAccounts)) {
        for (const fa of state.financialAccounts) {
          this.saveFinancialAccount(fa);
        }
      }

      if (Array.isArray(state.accounts)) {
        for (const acc of state.accounts) {
          this.saveAccount(acc);
        }
      }

      if (Array.isArray(state.accountHistory)) {
        const hStmt = db.prepare(`
          INSERT INTO account_history (id, account_id, account_name, change_type, field_changed, old_value, new_value, user_id, user_name, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING
        `);
        for (const h of state.accountHistory) {
          hStmt.run(
            h.id || ('HIST-' + Date.now()),
            h.accountId || h.account_id || '',
            h.accountName || h.account_name || '',
            h.changeType || h.change_type || 'UPDATE',
            h.fieldChanged || h.field_changed || '',
            h.oldValue || h.old_value || '',
            h.newValue || h.new_value || '',
            h.userId || h.user_id || 'USR-001',
            h.userName || h.user_name || 'Luis',
            h.createdAt || h.created_at || new Date().toLocaleString()
          );
        }
      }

      if (Array.isArray(state.debitNotes)) {
        for (const nd of state.debitNotes) {
          this.saveDebitNote(nd);
        }
      }

      if (Array.isArray(state.creditNotes)) {
        for (const nc of state.creditNotes) {
          this.saveCreditNote(nc);
        }
      }

      if (Array.isArray(state.cashReceipts)) {
        for (const rcp of state.cashReceipts) {
          this.saveCashReceipt(rcp);
        }
      }

      if (Array.isArray(state.gdsTickets)) {
        for (const t of state.gdsTickets) {
          this.saveGdsTicket(t);
        }
      }

      if (Array.isArray(state.passengers)) {
        const paxStmt = db.prepare(`
          INSERT INTO passengers (id, name, doc, count, last_use, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET count = excluded.count, last_use = excluded.last_use
        `);
        for (const p of state.passengers) {
          paxStmt.run(
            p.id || ('PAX-' + Date.now()),
            p.name,
            p.doc || null,
            p.count || 1,
            p.lastUse || new Date().toLocaleString(),
            p.createdAt || new Date().toLocaleString()
          );
        }
      }

      if (Array.isArray(state.savedSubServices)) {
        for (const ss of state.savedSubServices) {
          this.saveSubservice(ss);
        }
      }

      if (Array.isArray(state.paymentMethods)) {
        const pmStmt = db.prepare(`
          INSERT INTO payment_methods (id, code, name, currency, type, bank_account, status, financial_account_id, raw_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = excluded.status, raw_json = excluded.raw_json
        `);
        for (const pm of state.paymentMethods) {
          pmStmt.run(
            pm.id,
            pm.code || null,
            pm.name || '',
            pm.currency || 'BOB',
            pm.type || null,
            pm.bankAccount || null,
            pm.status || 'ACTIVO',
            pm.financialAccountId || null,
            JSON.stringify(pm)
          );
        }
      }

      if (Array.isArray(state.serviceTypes)) {
        const stStmt = db.prepare(`
          INSERT INTO service_types (id, code, name, category)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name, category = excluded.category
        `);
        for (const st of state.serviceTypes) {
          stStmt.run(st.id, st.code, st.name, st.category || null);
        }
      }

      // Sincronización bidireccional: depurar (prune) registros eliminados en el cliente.
      // Las filas con flag soft-delete (deleted:true en raw_json, papelera) se conservan SIEMPRE.
      const pruneMissing = (tableName, idCol, keepList) => {
        if (!Array.isArray(keepList)) return;
        const keepSet = new Set(keepList.map(item => (typeof item === 'string' ? item : item.id)).filter(Boolean));
        const existingRows = db.prepare(`SELECT * FROM ${tableName}`).all();
        const deleteStmt = db.prepare(`DELETE FROM ${tableName} WHERE ${idCol} = ?`);
        for (const row of existingRows) {
          if (!keepSet.has(row.id) && !this.isSoftDeleted(row.raw_json)) {
            deleteStmt.run(row.id);
          }
        }
      };

      // Orden de depuración respetando dependencias de integridad referencial
      pruneMissing('cash_receipts', 'id', state.cashReceipts);
      pruneMissing('credit_notes', 'id', state.creditNotes);
      pruneMissing('debit_notes', 'id', state.debitNotes);
      pruneMissing('gds_tickets', 'id', state.gdsTickets);
      pruneMissing('accounts', 'id', state.accounts);
      pruneMissing('passengers', 'id', state.passengers);
      pruneMissing('subservices', 'id', state.savedSubServices);
      pruneMissing('financial_accounts', 'id', state.financialAccounts);

      db.exec('COMMIT;');
      try { db.exec('PRAGMA wal_checkpoint(PASSIVE);'); } catch (_) {}
      return { success: true };
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  },

  getStats() {
    const db = getSqlDb();
    const stat = fs.existsSync(DB_SQLITE_PATH) ? fs.statSync(DB_SQLITE_PATH) : null;
    return {
      engine: 'SQLite (node:sqlite native ACID)',
      file: 'data/maretravel.sqlite',
      fileSizeBytes: stat ? stat.size : 0,
      lastModified: stat ? stat.mtime : null,
      counts: {
        accounts: db.prepare('SELECT COUNT(*) as c FROM accounts').get().c,
        debitNotes: db.prepare('SELECT COUNT(*) as c FROM debit_notes').get().c,
        creditNotes: db.prepare('SELECT COUNT(*) as c FROM credit_notes').get().c,
        cashReceipts: db.prepare('SELECT COUNT(*) as c FROM cash_receipts').get().c,
        gdsTickets: db.prepare('SELECT COUNT(*) as c FROM gds_tickets').get().c,
        passengers: db.prepare('SELECT COUNT(*) as c FROM passengers').get().c,
        subservices: db.prepare('SELECT COUNT(*) as c FROM subservices').get().c
      }
    };
  },

  // Borrado físico directo (purga definitiva de la papelera): ignora el flag soft-delete.
  // table y whereCol deben venir de un allowlist del servidor (nunca del input del usuario).
  deleteRow(table, whereCol, whereVal) {
    const db = getSqlDb();
    const result = db.prepare(`DELETE FROM ${table} WHERE ${whereCol} = ?`).run(whereVal);
    return { deleted: result.changes };
  }
};

module.exports = sqlDatabase;
