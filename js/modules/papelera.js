/**
 * MARETRAVEL ERP - Papelera de Súper Usuario
 * Acceso exclusivo del súper usuario: ver registros con soft-delete (deleted:true),
 * restaurarlos o purgarlos definitivamente de la base de datos (SQLite/Turso + snapshot JSON).
 */
(function () {
  const TOKEN_KEY = 'maretravel_super_token';

  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  async function api(path, options = {}) {
    const token = getToken();
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(options.headers || {})
      }
    });
    return res;
  }

  const TYPE_LABELS = {
    accounts: 'Cuenta',
    debitNotes: 'Nota de Débito',
    creditNotes: 'Nota de Crédito',
    gdsTickets: 'Boleto GDS',
    bankAccounts: 'Cuenta Bancaria',
    passengers: 'Pasajero',
    otherIncomes: 'Otro Ingreso',
    financialAccounts: 'Cuenta Financiera'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function login() {
    const username = document.getElementById('papelera-username').value.trim();
    const password = document.getElementById('papelera-password').value;
    if (!username || !password) {
      window.app.showToast('Ingrese usuario y contraseña del súper usuario.', 'error');
      return;
    }
    const res = await fetch('/api/super/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) {
      window.app.showToast(data.error || 'Credenciales inválidas.', 'error');
      return;
    }
    try { sessionStorage.setItem(TOKEN_KEY, data.token); } catch (e) {}
    resetUI();
    document.getElementById('papelera-content').style.display = 'block';
    await load();
  }

  function resetUI() {
    const loginEl = document.getElementById('papelera-login');
    const contentEl = document.getElementById('papelera-content');
    if (loginEl) loginEl.style.display = 'block';
    if (contentEl) contentEl.style.display = 'none';
  }

  async function load() {
    const container = document.getElementById('papelera-list');
    if (!container) return;
    container.innerHTML = '<p style="color:#64748b">Cargando papelera...</p>';
    const res = await api('/api/papelera');
    if (res.status === 401) {
      try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
      resetUI();
      container.innerHTML = '<p style="color:#dc2626">Sesión de súper usuario expirada. Vuelva a entrar.</p>';
      return;
    }
    const data = await res.json().catch(() => ({}));
    const items = data.items || [];
    if (items.length === 0) {
      container.innerHTML = '<p style="color:#64748b">La papelera está vacía. No hay registros borrados en la base de datos.</p>';
      return;
    }
    container.innerHTML = items.map(it => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;background:#f8fafc;">
        <div style="min-width:0;">
          <div style="font-weight:600;font-size:0.85rem;color:#0f172a;">${esc(TYPE_LABELS[it.type] || it.type)} — ${esc(it.label || it.id)}</div>
          <div style="font-size:0.72rem;color:#64748b;">${it.deletedAt ? 'Eliminado: ' + esc(it.deletedAt) : ''}${it.deletedBy ? ' por ' + esc(it.deletedBy) : ''} · id: ${esc(it.id)}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn btn-secondary btn-sm" onclick="window.papeleraModule.restore('${esc(it.type)}', '${esc(it.id)}')">Restaurar</button>
          <button class="btn btn-danger btn-sm" onclick="window.papeleraModule.purge('${esc(it.type)}', '${esc(it.id)}', '${esc(it.label || '')}')" style="background:#fee2e2;color:#dc2626;border-color:#fca5a5;">Borrar (DB)</button>
        </div>
      </div>
    `).join('');
    if (window.lucide) window.lucide.createIcons();
  }

  async function restore(type, id) {
    if (!confirm('¿Restaurar este registro?\n\nVolverá a ser visible nuevamente en el sistema.')) return;
    const res = await api('/api/papelera/restore', {
      method: 'POST',
      body: JSON.stringify({ type, id })
    });
    await afterAction(res, 'restaurado');
  }

  async function purge(type, id, label) {
    const typed = prompt(
      'BORRADO PERMANENTE DE LA BASE DE DATOS: ' + (label || id) + '\n\n' +
      'Esto elimina el registro de SQLite, Turso y del snapshot JSON.\n' +
      'No hay vuelta atrás.\n\n' +
      'Escriba BORRAR para confirmar la purga:'
    );
    if (typed !== 'BORRAR') {
      window.app.showToast('Purga cancelada.', 'info');
      return;
    }
    const res = await api('/api/papelera/purge', {
      method: 'POST',
      body: JSON.stringify({ type, id })
    });
    await afterAction(res, 'purgado de la base de datos');
  }

  async function afterAction(res, verb) {
    if (res.status === 401) {
      window.app.showToast('Sesión de súper usuario expirada.', 'error');
      try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
      resetUI();
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.app.showToast(data.error || 'Error en la operación.', 'error');
      return;
    }
    window.app.showToast('Registro ' + verb + ' correctamente.', 'success');
    if (window.db && typeof window.db.syncWithServerFile === 'function') {
      await window.db.syncWithServerFile();
    }
    reloadViews();
    await load();
  }

  function reloadViews() {
    ['accountsModule', 'operationsHubModule', 'gdsModule', 'bankAccountsModule', 'cashRegisterModule', 'otherIncomesModule', 'debitNotesModule', 'creditNotesModule'].forEach(m => {
      if (window[m] && typeof window[m].render === 'function') window[m].render();
    });
    if (window.app && typeof window.app.updateDashboardKpis === 'function') window.app.updateDashboardKpis();
  }

  function showButtonForAdmin() {
    const btn = document.getElementById('btn-papelera');
    if (!btn) return;
    try {
      const data = window.db.get();
      if (data && data.currentUser && data.currentUser.role === 'ADMIN') {
        btn.style.display = 'block';
      }
    } catch (e) {}
  }

  function open() {
    window.app.openModal('modal-papelera');
    const hasToken = !!getToken();
    document.getElementById('papelera-login').style.display = hasToken ? 'none' : 'block';
    document.getElementById('papelera-content').style.display = hasToken ? 'block' : 'none';
    if (hasToken) load();
  }

  function init() {
    showButtonForAdmin();
    window.addEventListener('maretravel_db_updated', showButtonForAdmin);
    if (window.db && window.db.initPromise) {
      window.db.initPromise.then(showButtonForAdmin);
    }
  }

  window.papeleraModule = { open, login, load, restore, purge };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})();