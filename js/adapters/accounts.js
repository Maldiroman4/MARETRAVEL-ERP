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