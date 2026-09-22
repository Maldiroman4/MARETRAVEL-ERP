const GdsAdapter = {
  async list(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.status) qs.set('status', filters.status);
    if (filters.airlineCode) qs.set('airlineCode', filters.airlineCode);
    return API.get(`/gds-tickets${qs.toString() ? '?' + qs.toString() : ''}`);
  },
  create(payload) { return API.post('/gds-tickets', payload); },
  update(id, payload) { return API.patch(`/gds-tickets/${id}`, payload); },
  get(id) { return API.get(`/gds-tickets/${id}`); },
  remove(id) { return API.del(`/gds-tickets/${id}`); },

  /**
   * Dual-source sync: trae los boletos del backend (PostgreSQL) y los fusiona
   * en el espejo local (window.db.gdsTickets) preservando el `id` local usado
   * por módulos legacy (otherIncomes, NDs) y mapeando `operatorId` de vuelta al
   * id local de la cuenta/aerolínea para no romper referencias cruzadas.
   */
  async syncMirror() {
    const backend = await this.list();
    if (!Array.isArray(backend)) return null;
    const data = window.db ? window.db.get() : null;
    if (!data) return backend;

    const locals = data.gdsTickets || [];
    const byNum = new Map(locals.map(t => [t.ticketNumber, t]));
    const accounts = data.accounts || [];
    const accByBackend = new Map(accounts.map(a => [a.backendId, a]));
    const now = new Date().toLocaleString();

    const merged = backend.map((b) => {
      const existing = byNum.get(b.ticketNumber);
      const localAcc = accByBackend.get(b.operatorId);
      const net = Number(b.netAmount) || 0;
      return {
        id: existing ? existing.id : 'TKT-' + Date.now() + Math.random().toString(36).substr(2, 6),
        backendId: b.id,
        ticketNumber: b.ticketNumber,
        gdsSource: b.gdsSource || 'AMADEUS',
        counter: existing ? existing.counter : '',
        issueDate: b.issueDate ? String(b.issueDate).slice(0, 10) : '',
        passengerName: b.passengerName,
        passengerDocId: existing ? existing.passengerDocId || '' : '',
        route: b.route,
        airlineCode: b.airlineCode,
        operatorId: localAcc ? localAcc.id : (existing ? existing.operatorId : b.operatorId),
        operatorBackendId: b.operatorId,
        providerServiceId: existing ? existing.providerServiceId || null : null,
        fareAmount: existing ? existing.fareAmount || net : net,
        ticketPrice: existing ? existing.ticketPrice || net : net,
        netAmount: net,
        taxAmount: Number(b.taxAmount) || 0,
        totalAmount: Number(b.totalAmount) || 0,
        currency: b.currency,
        commissionRate: Number(b.commissionRate) || 0,
        commissionAmount: Number(b.commissionAmount) || 0,
        feeAmount: Number(b.feeAmount) || 0,
        totalWithFee: existing ? existing.totalWithFee || net : net,
        status: b.status || 'DISPONIBLE',
        createdAt: existing ? existing.createdAt : now,
        updatedAt: b.updatedAt ? new Date(b.updatedAt).toLocaleString() : now,
      };
    });

    data.gdsTickets = merged;
    if (window.db && typeof window.db.save === 'function') window.db.save(data);
    return merged;
  },
};