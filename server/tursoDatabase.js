/**
 * MARETRAVEL ERP - Capa de Persistencia Cloud en Turso (libSQL)
 * Provee almacenamiento SQLite en la nube para entornos efímeros (como Render)
 * y sincronización de datos con 0 pérdida tras reinicios o despliegues.
 *
 * IMPORTANTE: usa EXACTAMENTE el mismo esquema relacional que server/schema.sql
 * y server/sqlDatabase.js (SQLite local). No inventar nombres de columnas:
 * si la capa local funciona, aquí debe quedar idéntico.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let tursoClient = null;

function isAvailable() {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}

function getClient() {
  if (tursoClient) return tursoClient;
  if (!isAvailable()) {
    throw new Error('Variables de entorno TURSO_DATABASE_URL y TURSO_AUTH_TOKEN no configuradas.');
  }

  tursoClient = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });

  return tursoClient;
}

const tursoDatabase = {
  isAvailable,
  getClient,

  async init() {
    if (!isAvailable()) return false;
    const client = getClient();
    try {
      // Verificar si las tablas principales ya existen
      const check = await client.execute("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='accounts'");
      const count = Number(check.rows[0]?.cnt || 0);
      if (count === 0 && fs.existsSync(SCHEMA_PATH)) {
        console.log('[TURSO CLOUD] Inicializando esquema relacional completo en Turso...');
        const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
        await client.executeMultiple(schemaSql);
        console.log('[TURSO CLOUD] Tablas e índices creados con éxito en la nube.');
      }
      // Limpiar tabla de chequeo si existiera
      try {
        await client.execute('DROP TABLE IF EXISTS _turso_healthcheck');
      } catch (_) {}
      return true;
    } catch (err) {
      console.error('[TURSO CLOUD ERROR] Error al inicializar esquema en Turso:', err.message);
      throw err;
    }
  },

  async getFullState() {
    const client = getClient();
    const [
      settingsRes,
      finRes,
      pmRes,
      stRes,
      tcRes,
      accRes,
      histRes,
      ndRes,
      ndiRes,
      ncRes,
      nciRes,
      rcpRes,
      gdsRes,
      paxRes,
      subRes
    ] = await client.batch([
      'SELECT key, value FROM system_settings',
      'SELECT * FROM financial_accounts ORDER BY id ASC',
      'SELECT * FROM payment_methods ORDER BY id ASC',
      'SELECT * FROM service_types ORDER BY id ASC',
      'SELECT * FROM exchange_rates ORDER BY date DESC',
      'SELECT * FROM accounts ORDER BY name ASC',
      'SELECT * FROM account_history ORDER BY created_at DESC LIMIT 150',
      'SELECT * FROM debit_notes ORDER BY nd_number DESC',
      'SELECT * FROM debit_note_items ORDER BY id ASC',
      'SELECT * FROM credit_notes ORDER BY nc_number DESC',
      'SELECT * FROM credit_note_items ORDER BY id ASC',
      'SELECT * FROM cash_receipts ORDER BY receipt_number DESC',
      'SELECT * FROM gds_tickets ORDER BY issue_date DESC',
      'SELECT * FROM passengers ORDER BY name ASC',
      'SELECT * FROM subservices ORDER BY name ASC'
    ], 'read');

    // Parse Settings
    const systemSettings = {};
    for (const r of settingsRes.rows) {
      try {
        systemSettings[r.key] = JSON.parse(r.value);
      } catch (_) {
        systemSettings[r.key] = r.value;
      }
    }

    const parseRaw = (r) => {
      let base = {};
      if (r.raw_json) {
        try { base = JSON.parse(r.raw_json); } catch (_) {}
      }
      return { ...base, ...r };
    };

    // Financial Accounts
    const financialAccounts = finRes.rows.map(r => {
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
        accountType: r.account_type || 'CORRIENTE',
        titularName: r.titular_name,
        currency: r.currency || 'BOB',
        isActive: Boolean(r.is_active),
        currentBalance: Number(r.current_balance || 0),
        cashDeskName: r.cash_desk_name || base.cashDeskName || '',
        custodianName: r.custodian_name || base.custodianName || '',
        binanceId: r.binance_id || base.binanceId || '',
        walletAddress: r.wallet_address || base.walletAddress || '',
        createdAt: r.created_at || base.createdAt
      };
    });

    // Accounts
    const accounts = accRes.rows.map(r => {
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
        providerServices: r.provider_services || base.providerServices || '',
        accountManager: r.account_manager || base.accountManager || '',
        status: r.status || base.status || 'ACTIVO',
        createdAt: r.created_at || base.createdAt,
        updatedAt: r.updated_at || base.updatedAt
      };
    });

    // Debit Note Items Map
    const ndiByNdId = {};
    for (const it of ndiRes.rows) {
      if (!ndiByNdId[it.debit_note_id]) ndiByNdId[it.debit_note_id] = [];
      let itBase = {};
      if (it.raw_json) {
        try { itBase = JSON.parse(it.raw_json); } catch (_) {}
      }
      ndiByNdId[it.debit_note_id].push({
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
      });
    }

    // Debit Notes
    const debitNotes = ndRes.rows.map(r => {
      let base = {};
      if (r.raw_json) {
        try { base = JSON.parse(r.raw_json); } catch (_) {}
      }
      const items = ndiByNdId[r.id] || base.items || [];
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
        items,
        createdAt: r.created_at || base.createdAt
      };
    });

    // Credit Note Items Map
    const nciByNcId = {};
    for (const it of nciRes.rows) {
      if (!nciByNcId[it.credit_note_id]) nciByNcId[it.credit_note_id] = [];
      let itBase = {};
      if (it.raw_json) {
        try { itBase = JSON.parse(it.raw_json); } catch (_) {}
      }
      nciByNcId[it.credit_note_id].push({
        ...itBase,
        id: it.id,
        totalAmount: it.total_amount,
        netCostToProvider: it.net_cost_to_provider
      });
    }

    // Credit Notes
    const creditNotes = ncRes.rows.map(r => {
      let base = {};
      if (r.raw_json) {
        try { base = JSON.parse(r.raw_json); } catch (_) {}
      }
      const items = nciByNcId[r.id] || base.items || [];
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
        items,
        createdAt: r.created_at || base.createdAt
      };
    });

    // Cash Receipts
    const cashReceipts = rcpRes.rows.map(r => {
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

    // GDS Tickets
    const gdsTickets = gdsRes.rows.map(r => {
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

    // Passengers
    const passengers = paxRes.rows.map(r => ({
      id: r.id,
      name: r.name,
      doc: r.doc,
      count: r.count,
      lastUse: r.last_use,
      createdAt: r.created_at
    }));

    // Subservices
    const subservices = subRes.rows.map(r => ({
      id: r.id,
      name: r.name,
      serviceType: r.service_type || 'BOLETO_AEREO',
      createdAt: r.created_at
    }));

    // Payment Methods
    const paymentMethods = pmRes.rows.map(r => {
      if (r.raw_json) {
        try { return JSON.parse(r.raw_json); } catch (_) {}
      }
      return r;
    });

    // Service Types
    const serviceTypes = stRes.rows.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.category
    }));

    // Exchange Rates
    const exchangeRates = tcRes.rows.map(r => ({
      id: r.id,
      date: r.date,
      buyRate: r.buy_rate,
      sellRate: r.sell_rate,
      createdById: r.created_by_id,
      createdByName: r.created_by_name,
      createdAt: r.created_at
    }));

    // Account History
    const accountHistory = histRes.rows.map(r => ({
      id: r.id,
      accountId: r.account_id,
      accountName: r.account_name,
      changeType: r.change_type,
      fieldChanged: r.field_changed,
      oldValue: r.old_value,
      newValue: r.new_value,
      userId: r.user_id,
      userName: r.user_name,
      createdAt: r.created_at
    }));

    return {
      systemSettings,
      currentUser: {
        id: 'USR-001',
        name: 'Luis',
        username: 'luis',
        role: 'ADMIN',
        email: 'luis@maretravel.bo'
      },
      exchangeRates: exchangeRates.length > 0 ? exchangeRates : [
        { id: 'TC-001', date: new Date().toISOString().split('T')[0], buyRate: systemSettings.activeExchangeBuy || 6.86, sellRate: systemSettings.activeExchangeSell || 6.96 }
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

  async saveFullState(state) {
    const client = getClient();
    const stmts = [];

    // 1. Settings
    if (state.systemSettings) {
      for (const [k, v] of Object.entries(state.systemSettings)) {
        stmts.push({
          sql: 'INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          args: [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]
        });
      }
    }

    // 2. Financial Accounts
    if (Array.isArray(state.financialAccounts)) {
      for (const fa of state.financialAccounts) {
        stmts.push({
          sql: `INSERT INTO financial_accounts (
            id, type, bank_name, account_number, account_type, titular_name,
            currency, is_active, current_balance, cash_desk_name, custodian_name,
            binance_id, wallet_address, created_at, updated_at, raw_json
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
            raw_json = excluded.raw_json`,
          args: [
            fa.id,
            fa.type || 'BANCO',
            fa.bankName || '',
            fa.accountNumber || '',
            fa.accountType || 'CORRIENTE',
            fa.titularName || '',
            fa.currency || 'BOB',
            fa.isActive ? 1 : 0,
            Number(fa.currentBalance || 0),
            fa.cashDeskName || null,
            fa.custodianName || null,
            fa.binanceId || null,
            fa.walletAddress || null,
            fa.createdAt || new Date().toLocaleString(),
            new Date().toLocaleString(),
            JSON.stringify(fa)
          ]
        });
      }
    }

    // 3. Accounts
    if (Array.isArray(state.accounts)) {
      for (const acc of state.accounts) {
        stmts.push({
          sql: `INSERT INTO accounts (
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
            raw_json = excluded.raw_json`,
          args: [
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
            JSON.stringify(acc)
          ]
        });
      }
    }

    // 4. Account History
    if (Array.isArray(state.accountHistory)) {
      for (const h of state.accountHistory) {
        stmts.push({
          sql: `INSERT INTO account_history (
            id, account_id, account_name, change_type, field_changed, old_value, new_value, user_id, user_name, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING`,
          args: [
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
          ]
        });
      }
    }

    // 5. Debit Notes & Items
    if (Array.isArray(state.debitNotes)) {
      for (const nd of state.debitNotes) {
        stmts.push({
          sql: `INSERT INTO debit_notes (
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
            passenger_name = excluded.passenger_name,
            issue_date = excluded.issue_date,
            currency = excluded.currency,
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
            observations = excluded.observations,
            updated_at = excluded.updated_at,
            raw_json = excluded.raw_json`,
          args: [
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
            JSON.stringify(nd)
          ]
        });

        // Debit note items
        if (Array.isArray(nd.items)) {
          stmts.push({
            sql: 'DELETE FROM debit_note_items WHERE debit_note_id = ?',
            args: [nd.id]
          });
          for (const item of nd.items) {
            stmts.push({
              sql: `INSERT INTO debit_note_items (
                id, debit_note_id, service_type, ticket_id, ticket_number,
                voucher_number, passenger_name, passenger_doc_id, operator_id,
                operator_name, sub_service_name, description, service_details,
                settlement_model, currency, fare_amount, gross_cost, fee_amount,
                total_amount, fare_amount_bob, gross_cost_bob, fee_amount_bob,
                total_amount_bob, provider_commission_rate, provider_commission_amount,
                provider_commission_amount_bob, client_commission_rate, client_commission_amount,
                counter_commission_amount, net_cost_to_provider, net_cost_to_provider_bob,
                created_at, raw_json
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                item.id || ('NDI-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)),
                nd.id,
                item.serviceType || 'BOLETO_AEREO',
                item.ticketId || null,
                item.ticketNumber || null,
                item.voucherNumber || null,
                item.passengerName || nd.passengerName || 'PASAJERO',
                item.passengerDocId || null,
                item.operatorId || null,
                item.operatorName || null,
                item.subServiceName || null,
                item.description || item.subServiceName || '',
                typeof item.serviceDetails === 'object' ? JSON.stringify(item.serviceDetails) : (item.serviceDetails || null),
                item.settlementModel || 'DEDUCCION_DIRECTA',
                item.currency || nd.currency || 'BOB',
                Number(item.fareAmount || 0),
                Number(item.grossCost || 0),
                Number(item.feeAmount || 0),
                Number(item.totalAmount || 0),
                Number(item.fareAmountBob || 0),
                Number(item.grossCostBob || 0),
                Number(item.feeAmountBob || 0),
                Number(item.totalAmountBob || item.totalAmount || 0),
                Number(item.providerCommissionRate || 0),
                Number(item.providerCommissionAmount || 0),
                Number(item.providerCommissionAmountBob || 0),
                Number(item.clientCommissionRate || 0),
                Number(item.clientCommissionAmount || 0),
                Number(item.counterCommissionAmount || 0),
                Number(item.netCostToProvider || 0),
                Number(item.netCostToProviderBob || 0),
                item.createdAt || new Date().toLocaleString(),
                JSON.stringify(item)
              ]
            });
          }
        }
      }
    }

    // 6. Credit Notes & Items
    if (Array.isArray(state.creditNotes)) {
      for (const nc of state.creditNotes) {
        stmts.push({
          sql: `INSERT INTO credit_notes (
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
            raw_json = excluded.raw_json`,
          args: [
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
            JSON.stringify(nc)
          ]
        });

        if (Array.isArray(nc.items)) {
          stmts.push({
            sql: 'DELETE FROM credit_note_items WHERE credit_note_id = ?',
            args: [nc.id]
          });
          for (const item of nc.items) {
            stmts.push({
              sql: `INSERT INTO credit_note_items (
                id, credit_note_id, service_type, gds_ticket_id, ticket_number,
                voucher_number, passenger_name, passenger_doc_id, operator_id,
                operator_name, sub_service_name, description, service_details,
                settlement_model, currency, fare_amount, gross_cost, fee_amount,
                total_amount, net_cost_to_provider, net_cost_to_provider_bob,
                created_at, raw_json
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                item.id || ('NCI-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)),
                nc.id,
                item.serviceType || nc.serviceCategory,
                item.gdsTicketId || null,
                item.ticketNumber || null,
                item.voucherNumber || null,
                item.passengerName || null,
                item.passengerDocId || null,
                item.operatorId || null,
                item.operatorName || null,
                item.subServiceName || null,
                item.description || '',
                typeof item.serviceDetails === 'object' ? JSON.stringify(item.serviceDetails) : (item.serviceDetails || null),
                item.settlementModel || nc.settlementModel || 'DEDUCCION_DIRECTA',
                item.currency || nc.currency || 'BOB',
                Number(item.fareAmount || 0),
                Number(item.grossCost || 0),
                Number(item.feeAmount || 0),
                Number(item.totalAmount || 0),
                Number(item.netCostToProvider || 0),
                Number(item.netCostToProviderBob || 0),
                item.createdAt || new Date().toLocaleString(),
                JSON.stringify(item)
              ]
            });
          }
        }
      }
    }

    // 7. Cash Receipts
    if (Array.isArray(state.cashReceipts)) {
      for (const rcp of state.cashReceipts) {
        const detailsJson = JSON.stringify(rcp.details || []);
        const paymentsJson = JSON.stringify(rcp.payments || []);
        stmts.push({
          sql: `INSERT INTO cash_receipts (
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
            raw_json = excluded.raw_json`,
          args: [
            rcp.id,
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
            JSON.stringify(rcp)
          ]
        });
      }
    }

    // 8. GDS Tickets
    if (Array.isArray(state.gdsTickets)) {
      for (const t of state.gdsTickets) {
        stmts.push({
          sql: `INSERT INTO gds_tickets (
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
            raw_json = excluded.raw_json`,
          args: [
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
            JSON.stringify(t)
          ]
        });
      }
    }

    // 9. Passengers
    if (Array.isArray(state.passengers)) {
      for (const p of state.passengers) {
        stmts.push({
          sql: `INSERT INTO passengers (id, name, doc, count, last_use, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET count = excluded.count, last_use = excluded.last_use`,
          args: [
            p.id || ('PAX-' + Date.now()),
            p.name,
            p.doc || null,
            p.count || 1,
            p.lastUse || new Date().toLocaleString(),
            p.createdAt || new Date().toLocaleString()
          ]
        });
      }
    }

    // 10. Subservices
    if (Array.isArray(state.savedSubServices)) {
      for (const ss of state.savedSubServices) {
        stmts.push({
          sql: `INSERT INTO subservices (id, name, service_type, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name, service_type = excluded.service_type`,
          args: [
            ss.id || ('SS-' + Date.now()),
            ss.name || '',
            ss.serviceType || ss.category || 'BOLETO_AEREO',
            ss.createdAt || new Date().toLocaleString()
          ]
        });
      }
    }

    // 11. Payment Methods
    if (Array.isArray(state.paymentMethods)) {
      for (const pm of state.paymentMethods) {
        stmts.push({
          sql: `INSERT INTO payment_methods (id, code, name, currency, type, bank_account, status, financial_account_id, raw_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = excluded.status, raw_json = excluded.raw_json`,
          args: [
            pm.id,
            pm.code || null,
            pm.name || '',
            pm.currency || 'BOB',
            pm.type || null,
            pm.bankAccount || null,
            pm.status || 'ACTIVO',
            pm.financialAccountId || null,
            JSON.stringify(pm)
          ]
        });
      }
    }

    // 12. Service Types
    if (Array.isArray(state.serviceTypes)) {
      for (const st of state.serviceTypes) {
        stmts.push({
          sql: `INSERT INTO service_types (id, code, name, category)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name, category = excluded.category`,
          args: [st.id, st.code, st.name, st.category || null]
        });
      }
    }

    // 13. Pruning de registros eliminados (espejo fiel: lo que NO está en el estado guardado se borra).
    // Las filas con flag soft-delete (deleted:true en raw_json, papelera) se conservan SIEMPRE.
    const SOFT_DELETED_GUARD = `COALESCE(json_extract(raw_json, '$.deleted'), 0) = 0`;
    const addPruneStmt = (tableName, idCol, keepList) => {
      if (!Array.isArray(keepList)) return;
      const ids = keepList.map(item => (typeof item === 'string' ? item : item.id)).filter(Boolean);
      if (ids.length === 0) {
        // Lista vacía = tabla vacía (mismo comportamiento que la capa SQLite local).
        // El guard anterior dejaba filas fantasma al borrar el último registro.
        stmts.push({ sql: `DELETE FROM ${tableName} WHERE ${SOFT_DELETED_GUARD}`, args: [] });
        return;
      }
      const placeholders = ids.map(() => '?').join(',');
      stmts.push({
        sql: `DELETE FROM ${tableName} WHERE ${idCol} NOT IN (${placeholders}) AND ${SOFT_DELETED_GUARD}`,
        args: ids
      });
    };

    addPruneStmt('cash_receipts', 'id', state.cashReceipts);
    addPruneStmt('credit_notes', 'id', state.creditNotes);
    addPruneStmt('debit_notes', 'id', state.debitNotes);
    addPruneStmt('gds_tickets', 'id', state.gdsTickets);
    addPruneStmt('accounts', 'id', state.accounts);
    addPruneStmt('financial_accounts', 'id', state.financialAccounts);

    if (stmts.length === 0) return { success: true, count: 0 };

    // Ejecución atómica en un único round-trip en Turso
    await client.batch(stmts, 'write');
    return { success: true, count: stmts.length };
  },

  // Borrado físico directo (purga definitiva de la papelera): ignora el flag soft-delete.
  // table y whereCol deben venir de un allowlist del servidor (nunca del input del usuario).
  async deleteRow(table, whereCol, whereVal) {
    const client = getClient();
    const result = await client.execute({
      sql: `DELETE FROM ${table} WHERE ${whereCol} = ?`,
      args: [whereVal]
    });
    return { deleted: Number(result.rowsAffected || 0) };
  },

  async getStats() {
    const client = getClient();
    const [acc, nd, nc, rcp, tkt, pax, fin] = await client.batch([
      'SELECT count(*) as c FROM accounts',
      'SELECT count(*) as c FROM debit_notes',
      'SELECT count(*) as c FROM credit_notes',
      'SELECT count(*) as c FROM cash_receipts',
      'SELECT count(*) as c FROM gds_tickets',
      'SELECT count(*) as c FROM passengers',
      'SELECT count(*) as c FROM financial_accounts'
    ], 'read');

    return {
      engine: 'Turso Cloud (libSQL ACID)',
      url: process.env.TURSO_DATABASE_URL,
      counts: {
        accounts: Number(acc.rows[0]?.c || 0),
        debitNotes: Number(nd.rows[0]?.c || 0),
        creditNotes: Number(nc.rows[0]?.c || 0),
        cashReceipts: Number(rcp.rows[0]?.c || 0),
        gdsTickets: Number(tkt.rows[0]?.c || 0),
        passengers: Number(pax.rows[0]?.c || 0),
        financialAccounts: Number(fin.rows[0]?.c || 0)
      }
    };
  }
};

module.exports = tursoDatabase;