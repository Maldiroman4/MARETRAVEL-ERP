/**
 * MARETRAVEL ERP - Módulo Guardrails Financieros & Centralización T/C
 * Proporciona validación estricta en tiempo real de cuentas financieras
 * (Bancarias, Binance/Digitales y Cajas Físicas) y control centralizado de T/C.
 */

window.financialGuard = {
  /**
   * Valida exhaustivamente una cuenta financiera contra las reglas de negocio
   */
  validateAccount(account) {
    if (!account || typeof account !== 'object') {
      return {
        valid: false,
        errors: ['Cuenta financiera inexistente o no seleccionada.'],
        summary: 'Sin cuenta asignada'
      };
    }

    const errors = [];
    const type = account.type || 'BANCO';

    if (account.isActive === false) {
      errors.push('La cuenta se encuentra INACTIVA. Solo se permiten movimientos en cuentas activas.');
    }

    if (type === 'BANCO') {
      if (!account.bankName || account.bankName.trim().length < 3) {
        errors.push('Falta especificar el nombre de la Entidad Bancaria.');
      }
      if (!account.accountNumber || account.accountNumber.trim().length < 5) {
        errors.push('El Número de Cuenta bancaria debe contener al menos 5 dígitos.');
      }
      if (!account.titularName || account.titularName.trim().length < 3) {
        errors.push('Falta registrar el Titular oficial de la cuenta bancaria.');
      }
      if (!['BOB', 'USD'].includes(account.currency)) {
        errors.push('La moneda de la cuenta debe ser BOB o USD.');
      }
    } else if (type === 'BINANCE') {
      const hasId = account.binanceId && account.binanceId.trim().length >= 5;
      const hasWallet = account.walletAddress && account.walletAddress.trim().length >= 5;
      const hasAcc = account.accountNumber && account.accountNumber.trim().length >= 5;
      if (!hasId && !hasWallet && !hasAcc) {
        errors.push('La cuenta Binance/Cripto requiere Binance ID o Wallet Address (mín. 5 caracteres).');
      }
      if (!['USDT', 'USD'].includes(account.currency)) {
        errors.push('La moneda de la cuenta cripto debe ser USDT o USD.');
      }
    } else if (type === 'EFECTIVO') {
      const desk = account.cashDeskName || account.bankName || account.name;
      if (!desk || desk.trim().length < 3) {
        errors.push('La caja física debe tener un nombre asignado (ej. Caja Central).');
      }
      if (!account.custodianName || account.custodianName.trim().length < 3) {
        errors.push('La caja física debe tener un responsable o custodio activo asignado.');
      }
      if (!['BOB', 'USD'].includes(account.currency)) {
        errors.push('La moneda de la caja física debe ser BOB o USD.');
      }
    } else {
      errors.push(`Tipo de cuenta desconocido: ${type}`);
    }

    const valid = (errors.length === 0);
    let summary = '';
    if (valid) {
      if (type === 'BANCO') summary = `${account.bankName} - Cta. ${account.accountNumber} (${account.currency}) | Titular: ${account.titularName}`;
      else if (type === 'BINANCE') summary = `Binance Pay / Wallet ID: ${account.binanceId || account.walletAddress} (${account.currency})`;
      else if (type === 'EFECTIVO') summary = `${account.cashDeskName || 'Caja Central'} (${account.currency}) | Custodio: ${account.custodianName}`;
    } else {
      summary = errors.join('; ');
    }

    return { valid, errors, summary };
  },

  /**
   * Obtiene la lista completa de cuentas financieras activas y validadas
   */
  getActiveAccounts(currencyFilter = null) {
    const data = window.db ? window.db.get() : null;
    if (!data) return [];
    const list = data.bankAccounts || [];
    return list.filter(acc => {
      const isAct = acc.isActive !== false && acc.status !== 'INACTIVO';
      const currMatch = !currencyFilter || currencyFilter === 'TODOS' || acc.currency === currencyFilter;
      const check = this.validateAccount(acc);
      return isAct && currMatch && check.valid;
    });
  },

  /**
   * Obtiene una cuenta financiera por su ID
   */
  getAccountById(id) {
    if (!id) return null;
    const data = window.db ? window.db.get() : null;
    if (!data) return null;
    return (data.bankAccounts || []).find(a => a.id === id) || null;
  },

  /**
   * Registra una transacción en la cuenta indicada (INGRESO/EGRESO)
   */
  recordTransaction(accountId, datos) {
    const data = window.db ? window.db.get() : null;
    if (!data || !accountId) return null;
    const acc = (data.bankAccounts || []).find(a => a.id === accountId);
    if (!acc || acc.isActive === false) return null; // cuenta inactiva: no transactable
    if (!data.bankTransactions) data.bankTransactions = [];
    const tx = {
      id: 'BTX-' + Date.now() + Math.random().toString(36).substr(2, 6),
      accountId: accountId,
      type: datos.type === 'EGRESO' ? 'EGRESO' : 'INGRESO',
      amount: Number(datos.amount) || 0,
      medio: datos.medio || 'TRANSFERENCIA',
      date: datos.date || new Date().toISOString().split('T')[0],
      reference: datos.reference || '',
      description: datos.description || '',
      createdAt: new Date().toLocaleString()
    };
    data.bankTransactions.unshift(tx);
    if (window.db && typeof window.db.save === 'function') window.db.save(data);
    return tx;
  },

  /**
   * Calcula el saldo derivado de una cuenta a partir de su saldo inicial y transacciones
   */
  getAccountBalance(accountId) {
    const data = window.db ? window.db.get() : null;
    const acc = (data && data.bankAccounts || []).find(a => a.id === accountId);
    const initial = acc ? Number(acc.initialBalance) || 0 : 0;
    const txs = (data && data.bankTransactions || []).filter(t => t.accountId === accountId);
    let ingresos = 0, egresos = 0;
    txs.forEach(t => {
      if (t.type === 'EGRESO') egresos += Number(t.amount) || 0;
      else ingresos += Number(t.amount) || 0;
    });
    return { saldo: +(initial + ingresos - egresos).toFixed(2), ingresos: +ingresos.toFixed(2), egresos: +egresos.toFixed(2), transactions: txs };
  },

  /**
   * Llena un selector <select> con las cuentas activas agrupadas por categoría
   */
  populateSelect(selectEl, selectedId = null, options = {}) {
    if (!selectEl) return;
    const accounts = this.getActiveAccounts(options.currency || null);

    const bnkAccounts = accounts.filter(a => (a.type || 'BANCO') === 'BANCO');
    const cryptoAccounts = accounts.filter(a => a.type === 'BINANCE');
    const cashAccounts = accounts.filter(a => a.type === 'EFECTIVO');

    let html = `<option value="">${options.placeholder || '-- Seleccionar Cuenta Financiera Activa --'}</option>`;

    if (bnkAccounts.length > 0) {
      html += `<optgroup label="🏦 Cuentas Bancarias Oficiales">`;
      bnkAccounts.forEach(a => {
        const sel = a.id === selectedId ? 'selected' : '';
        html += `<option value="${a.id}" data-type="BANCO" data-curr="${a.currency}" ${sel}>${a.bankName} - Cta ${a.accountNumber} [${a.currency}] (${a.titularName})</option>`;
      });
      html += `</optgroup>`;
    }

    if (cryptoAccounts.length > 0) {
      html += `<optgroup label="🪙 Billeteras Digitales / Binance P2P">`;
      cryptoAccounts.forEach(a => {
        const sel = a.id === selectedId ? 'selected' : '';
        html += `<option value="${a.id}" data-type="BINANCE" data-curr="${a.currency}" ${sel}>${a.bankName || 'Binance'} ID: ${a.binanceId || a.walletAddress} [${a.currency}] (${a.titularName})</option>`;
      });
      html += `</optgroup>`;
    }

    if (cashAccounts.length > 0) {
      html += `<optgroup label="💵 Cajas Físicas / Custodio">`;
      cashAccounts.forEach(a => {
        const sel = a.id === selectedId ? 'selected' : '';
        html += `<option value="${a.id}" data-type="EFECTIVO" data-curr="${a.currency}" ${sel}>${a.cashDeskName || a.bankName} [${a.currency}] (Custodio: ${a.custodianName})</option>`;
      });
      html += `</optgroup>`;
    }

    selectEl.innerHTML = html;
  },

  /**
   * Retorna el Tipo de Cambio oficial vigente (Single Source of Truth)
   */
  getExchangeRates() {
    const data = window.db ? window.db.get() : null;
    const settings = (data && data.systemSettings) || {};
    const sellRate = parseFloat(settings.activeExchangeSell) || 6.96;
    const buyRate = parseFloat(settings.activeExchangeBuy) || 6.86;
    return { buyRate, sellRate };
  },

  /**
   * Convierte importe entre monedas usando el T/C global
   */
  convertAmount(amount, fromCurr, toCurr) {
    const num = parseFloat(amount) || 0;
    if (fromCurr === toCurr) return num;
    const { sellRate } = this.getExchangeRates();

    if (fromCurr === 'USD' && toCurr === 'BOB') {
      return parseFloat((num * sellRate).toFixed(2));
    }
    if (fromCurr === 'BOB' && toCurr === 'USD') {
      return parseFloat((num / sellRate).toFixed(2));
    }
    if (fromCurr === 'USDT' && toCurr === 'BOB') {
      return parseFloat((num * sellRate).toFixed(2));
    }
    return num;
  },

  /**
   * Renderiza el badge visual de T/C Oficial bloqueado
   */
  renderTcBadgeHtml() {
    const { sellRate } = this.getExchangeRates();
    return `
      <span class="badge badge-blue font-mono" style="font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:4px; padding:3px 8px;" title="Tipo de Cambio Único Oficial gestionado desde Configuración General">
        <i data-lucide="lock" style="width:12px; height:12px;"></i>
        T/C Oficial: 1 USD = ${sellRate.toFixed(2)} BOB (Centralizado)
      </span>
    `;
  }
};
