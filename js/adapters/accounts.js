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
  remove(id) { return API.del(`/accounts/${id}`); },

  /**
   * Dual-source sync: trae las cuentas del backend (PostgreSQL) y las fusiona
   * en el espejo local (window.db.accounts) preservando el `id` local usado
   * por los módulos legacy (NDs/NCs/Caja/Calendario) para no romper referencias
   * cruzadas. Cada cuenta espejo conserva el `backendId` (uuid) para las operaciones API.
   */
  async syncMirror() {
    const backend = await this.list();
    if (!Array.isArray(backend)) return null;
    const data = window.db ? window.db.get() : null;
    if (!data) return backend;

    const locals = data.accounts || [];
    const byCode = new Map(locals.map(a => [a.code, a]));
    const now = new Date().toLocaleString();

    const merged = backend.map((b) => {
      const existing = byCode.get(b.code);
      return {
        id: existing ? existing.id : 'ACC-' + Date.now() + Math.random().toString(36).substr(2, 6),
        backendId: b.id,
        code: b.code,
        name: b.name,
        legalName: b.legalName || b.name,
        nit: b.nit || '',
        relationType: b.relationType,
        accountType: b.accountType,
        rating: b.rating || 'NORMAL',
        department: b.department || existing?.department || '',
        city: b.city || existing?.city || '',
        address: b.address || existing?.address || '',
        phone: b.phone || existing?.phone || '',
        cellphone: b.cellphone || existing?.cellphone || '',
        email: b.email || existing?.email || '',
        webPage: b.webPage || existing?.webPage || '',
        status: b.status || 'ACTIVO',
        providerServices: existing?.providerServices || [],
        accountManager: existing?.accountManager || (data.currentUser ? data.currentUser.name : ''),
        createdAt: existing?.createdAt || now,
        updatedAt: b.updatedAt ? new Date(b.updatedAt).toLocaleString() : now,
      };
    });

    data.accounts = merged;
    if (window.db && typeof window.db.save === 'function') window.db.save(data);
    return merged;
  },
};