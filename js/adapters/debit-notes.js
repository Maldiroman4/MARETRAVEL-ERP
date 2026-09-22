const DebitNotesAdapter = {
  async list(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.status) qs.set('status', filters.status);
    return API.get(`/debit-notes${qs.toString() ? '?' + qs.toString() : ''}`);
  },
  create(payload) { return API.post('/debit-notes', payload); },
  update(id, payload) { return API.patch(`/debit-notes/${id}`, payload); },
  get(id) { return API.get(`/debit-notes/${id}`); },
  remove(id) { return API.del(`/debit-notes/${id}`); },
  close(id, motivo) { return API.post(`/debit-notes/${id}/close`, { motivo }); },
  reopen(id, motivo) { return API.post(`/debit-notes/${id}/reopen`, { motivo }); },
  void(id, motivo) { return API.post(`/debit-notes/${id}/void`, { motivo }); },
  correct(id, dto) { return API.post(`/debit-notes/${id}/correct`, dto); },

  /**
   * Dual-source sync: trae las NDs del backend (PostgreSQL) y las fusiona en el
   * espejo local (window.db.debitNotes) preservando el `id` local (usado por la
   * impresión y módulos legacy) y guardando `backendId`. Mapea `accountId` de
   * vuelta al id local de la cuenta.
   */
  async syncMirror() {
    const backend = await this.list();
    if (!Array.isArray(backend)) return null;
    const data = window.db ? window.db.get() : null;
    if (!data) return backend;

    const locals = data.debitNotes || [];
    const byNum = new Map(locals.map(n => [String(n.ndNumber), n]));
    const accounts = data.accounts || [];
    const accByBackend = new Map(accounts.map(a => [a.backendId, a]));

    const merged = backend.map((b) => {
      const existing = byNum.get(String(b.ndNumber));
      const localAcc = accByBackend.get(b.accountId);
      return {
        id: existing ? existing.id : 'ND-' + Date.now() + Math.random().toString(36).substr(2, 6),
        backendId: b.id,
        ndNumber: b.ndNumber,
        accountId: localAcc ? localAcc.id : (existing ? existing.accountId : b.accountId),
        accountName: localAcc ? localAcc.name : (existing ? existing.accountName : ''),
        accountNit: localAcc ? localAcc.nit : (existing ? existing.accountNit : ''),
        requesterId: existing ? existing.requesterId : (b.requesterText || null),
        solicitante: existing ? existing.solicitante : (b.requesterText || 'Oficina Central'),
        passengerName: existing ? existing.passengerName : (b.passengerName || ''),
        issueDate: b.issueDate ? String(b.issueDate).slice(0, 10) : '',
        paymentTerm: b.paymentTerm,
        currency: b.currency,
        totalAmountBob: Number(b.totalAmountBob) || 0,
        totalAmountUsd: Number(b.totalAmountUsd) || 0,
        paidAmountBob: Number(b.paidAmountBob) || 0,
        paidAmountUsd: Number(b.paidAmountUsd) || 0,
        balanceBob: Number(b.balanceBob) || 0,
        balanceUsd: Number(b.balanceUsd) || 0,
        status: b.status || 'BORRADOR',
        observations: existing ? existing.observations : (b.observations || ''),
        createdById: existing ? existing.createdById : b.createdById,
        createdByName: existing ? existing.createdByName : '',
        items: existing ? existing.items || [] : [],
        createdAt: existing ? existing.createdAt : (b.createdAt ? new Date(b.createdAt).toLocaleString() : new Date().toLocaleString()),
        updatedAt: b.updatedAt ? new Date(b.updatedAt).toLocaleString() : (existing ? existing.updatedAt : ''),
      };
    });

    data.debitNotes = merged;
    if (window.db && typeof window.db.save === 'function') window.db.save(data);
    return merged;
  },
};