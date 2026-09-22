const CashReceiptsAdapter = {
  async list(filters = {}) {
    return API.get('/cash-receipts');
  },
  create(payload) { return API.post('/cash-receipts', payload); },
  get(id) { return API.get(`/cash-receipts/${id}`); },
  void(id, motivo) { return API.post(`/cash-receipts/${id}/void`, { motivo }); },

  /**
   * Dual-source sync: trae los recibos del backend (PostgreSQL) y los fusiona en
   * el espejo local (window.db.cashReceipts) preservando el `id` local y
   * guardando `backendId`. Mapea `clientAccountId` al id local de la cuenta.
   */
  async syncMirror() {
    const backend = await this.list();
    if (!Array.isArray(backend)) return null;
    const data = window.db ? window.db.get() : null;
    if (!data) return backend;

    const locals = data.cashReceipts || [];
    const byNum = new Map(locals.map(r => [String(r.receiptNumber), r]));
    const accounts = data.accounts || [];
    const accByBackend = new Map(accounts.map(a => [a.backendId, a]));

    const merged = backend.map((b) => {
      const existing = byNum.get(String(b.receiptNumber));
      const client = accByBackend.get(b.clientAccountId);
      const isPartial = (Number(b.totalPaidBob) + Number(b.totalPaidUsd)) < (existing ? (Number(existing.total_documento) || 0) : 0);
      return {
        id: existing ? existing.id : 'CR-' + Date.now() + Math.random().toString(36).substr(2, 6),
        backendId: b.id,
        receiptNumber: b.receiptNumber,
        receiptCode: 'RCP-' + String(b.receiptNumber).padStart(5, '0'),
        accountId: client ? client.id : (existing ? existing.accountId : b.clientAccountId),
        accountName: client ? client.name : (existing ? existing.accountName : ''),
        solicitante: existing ? existing.solicitante : 'Oficina Central',
        receiptDate: existing ? existing.receiptDate : (b.createdAt ? new Date(b.createdAt).toLocaleString() : new Date().toLocaleString()),
        paymentType: isPartial ? 'PARCIAL' : 'TOTAL',
        tipo: 'ND',
        tipoTransaccion: 'RECIBO DE PAGO',
        monto_transaccion: Number(b.totalPaidBob) || 0,
        monto_transaccion_usd: Number(b.totalPaidUsd) || 0,
        total_documento: existing ? existing.total_documento : (Number(b.totalPaidBob) || 0),
        saldo_pendiente: existing ? existing.saldo_pendiente : 0,
        estado: b.status === 'REVERSADO' ? 'REVERSADO' : ((Number(b.balance) > 0 ? 'PENDIENTE' : 'PAGADA')),
        totalPaidBob: Number(b.totalPaidBob) || 0,
        totalPaidUsd: Number(b.totalPaidUsd) || 0,
        remainingBalanceBob: 0,
        exchangeRateUsed: Number(b.exchangeRate) || 6.96,
        frozenExchangeRate: Number(b.exchangeRate) || 6.96,
        status: b.status || 'VALIDO',
        reversalReason: b.voidReason || (existing ? existing.reversalReason : null),
        reversedAt: existing ? existing.reversedAt : null,
        reversedBy: existing ? existing.reversedBy : null,
        createdById: existing ? existing.createdById : b.createdById,
        createdByName: existing ? existing.createdByName : '',
        details: existing ? existing.details || [] : [],
        payments: existing ? existing.payments || [] : [],
      };
    });

    data.cashReceipts = merged;
    if (window.db && typeof window.db.save === 'function') window.db.save(data);
    return merged;
  },
};