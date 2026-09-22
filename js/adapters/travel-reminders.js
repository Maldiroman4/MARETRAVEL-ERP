const TravelRemindersAdapter = {
  async list(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.from) qs.set('from', filters.from);
    if (filters.to) qs.set('to', filters.to);
    return API.get(`/travel-reminders${qs.toString() ? '?' + qs.toString() : ''}`);
  },
  create(payload) { return API.post('/travel-reminders', payload); },
  update(id, payload) { return API.patch(`/travel-reminders/${id}`, payload); },
  get(id) { return API.get(`/travel-reminders/${id}`); },
  remove(id) { return API.del(`/travel-reminders/${id}`); },

  /**
   * Dual-source sync: trae los itinerarios del backend y los fusiona en el espejo
   * local (window.db.travelReminders) preservando el `id` local y guardando
   * `backendId`. Empareja por (pasajero + ruta + fecha de salida).
   */
  async syncMirror() {
    const backend = await this.list();
    if (!Array.isArray(backend)) return null;
    const data = window.db ? window.db.get() : null;
    if (!data) return backend;

    const locals = data.travelReminders || [];
    const key = (r) => `${r.passengerName}|${r.route}|${r.departureDate}`;
    const byKey = new Map(locals.map(r => [key(r), r]));
    const now = new Date().toLocaleString();

    const merged = backend.map((b) => {
      const dep = b.departureDate ? String(b.departureDate).slice(0, 10) : '';
      const existing = byKey.get(`${b.passengerName}|${b.route}|${dep}`);
      return {
        id: existing ? existing.id : 'TRV-' + Date.now() + Math.random().toString(36).substr(2, 6),
        backendId: b.id,
        clientId: b.clientId || (existing ? existing.clientId : ''),
        clientName: b.clientName || (existing ? existing.clientName : 'Cliente Particular'),
        clientPhone: b.clientPhone || (existing ? existing.clientPhone : ''),
        clientEmail: b.clientEmail || (existing ? existing.clientEmail : ''),
        passengerName: b.passengerName,
        passengerDoc: b.passengerDoc || (existing ? existing.passengerDoc : ''),
        route: b.route,
        airline: b.airline || (existing ? existing.airline : ''),
        flightNumber: b.flightNumber || (existing ? existing.flightNumber : ''),
        ticketNumber: b.ticketNumber || (existing ? existing.ticketNumber : ''),
        departureDate: dep,
        departureTime: b.departureTime || (existing ? existing.departureTime : ''),
        returnDate: b.returnDate ? String(b.returnDate).slice(0, 10) : '',
        returnTime: b.returnTime || (existing ? existing.returnTime : ''),
        hasReturn: b.hasReturn === true,
        hotelName: b.hotelName || (existing ? existing.hotelName : '-'),
        status: b.status || 'PROGRAMADO',
        observations: b.observations || (existing ? existing.observations : ''),
        createdAt: existing ? existing.createdAt : now,
      };
    });

    data.travelReminders = merged;
    if (window.db && typeof window.db.save === 'function') window.db.save(data);
    return merged;
  },
};