/**
 * MARETRAVEL ERP - Módulo de Gestión de Cuentas Bancarias (Admin Self-Service)
 * Permite a los administradores registrar, editar, activar/desactivar y auditar
 * las cuentas bancarias oficiales de la agencia utilizadas para cobros y pagos.
 */

window.bankAccountsModule = {
  editingAccountId: null,
  currencyFilter: 'TODOS',
  statusFilter: 'TODOS',

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // Botón de nueva cuenta bancaria
    const btnNew = document.getElementById('btn-new-bank-account');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.openNewModal());
    }

    // Formulario de cuenta bancaria
    const form = document.getElementById('bank-account-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSave(e));
    }

    // Filtros de moneda y estado
    const currFilter = document.getElementById('bank-currency-filter');
    if (currFilter) {
      currFilter.addEventListener('change', (e) => {
        this.currencyFilter = e.target.value;
        this.render();
      });
    }

    const statFilter = document.getElementById('bank-status-filter');
    if (statFilter) {
      statFilter.addEventListener('change', (e) => {
        this.statusFilter = e.target.value;
        this.render();
      });
    }

    // Buscador
    const searchInput = document.getElementById('bank-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.render());
    }
  },

  /**
   * Obtiene las cuentas activas para usar en facturas, notas de débito y selectores de caja
   */
  getActiveAccounts() {
    const data = window.db.get();
    return (data.bankAccounts || []).filter(acc => acc.isActive);
  },

  render() {
    const data = window.db.get();
    const accounts = data.bankAccounts || [];
    const search = (document.getElementById('bank-search-input')?.value || '').toLowerCase().trim();

    // Actualizar KPIs superiores (excluyendo eliminados)
    const validAccounts = accounts.filter(a => !a.deleted);
    const totalCount = validAccounts.length;
    const activeCount = validAccounts.filter(a => a.isActive).length;
    const bobCount = validAccounts.filter(a => a.currency === 'BOB').length;
    const usdCount = validAccounts.filter(a => a.currency === 'USD').length;

    const elTotal = document.getElementById('kpi-bank-total');
    const elActive = document.getElementById('kpi-bank-active');
    const elBob = document.getElementById('kpi-bank-bob');
    const elUsd = document.getElementById('kpi-bank-usd');

    if (elTotal) elTotal.textContent = totalCount;
    if (elActive) elActive.textContent = activeCount;
    if (elBob) elBob.textContent = bobCount;
    if (elUsd) elUsd.textContent = usdCount;

    // Filtrar cuentas
    let filtered = accounts.filter(acc => {
      if (acc.deleted) return false;
      const matchCurr = this.currencyFilter === 'TODOS' || acc.currency === this.currencyFilter;
      const matchStat = this.statusFilter === 'TODOS' || 
                        (this.statusFilter === 'ACTIVAS' && acc.isActive) ||
                        (this.statusFilter === 'INACTIVAS' && !acc.isActive);
      const matchSearch = (acc.bankName || '').toLowerCase().includes(search) ||
                          (acc.accountNumber || '').toLowerCase().includes(search) ||
                          (acc.titularName || '').toLowerCase().includes(search);
      return matchCurr && matchStat && matchSearch;
    });

    const container = document.getElementById('bank-accounts-grid');
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: #fff; border-radius: 12px; border: 1px dashed var(--border-light);">
          <i data-lucide="building-2" style="width: 44px; height: 44px; color: #94a3b8; margin: 0 auto 12px; display: block;"></i>
          <h4 style="color: var(--navy); margin-bottom: 6px; font-weight: 700;">No se encontraron cuentas o cajas</h4>
          <p style="color: var(--text-muted); font-size: 0.85rem; max-width: 400px; margin: 0 auto 16px;">
            No hay registros que coincidan con los filtros aplicados o aún no ha registrado cuentas oficiales.
          </p>
          <button class="btn btn-primary" onclick="window.bankAccountsModule.openNewModal()">
            <i data-lucide="plus"></i> Registrar Primera Cuenta o Caja
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = filtered.map(acc => {
      const isBob = acc.currency === 'BOB';
      const currencyClass = isBob ? 'badge-blue' : 'badge-emerald';
      const currencySymbol = isBob ? 'Bs.' : '$us';

      const isCash = acc.type === 'EFECTIVO' || (acc.bankName && acc.bankName.toLowerCase().includes('caja')) || acc.accountType === 'EFECTIVO';
      const isBinance = acc.type === 'BINANCE' || (acc.bankName && acc.bankName.toLowerCase().includes('binance')) || acc.accountType === 'BILLETERA_DIGITAL';

      const iconName = isCash ? 'banknote' : (isBinance ? 'wallet' : 'landmark');
      const avatarClass = isCash ? 'icon-cash' : (isBob ? 'icon-bob' : 'icon-usd');
      const typeBadge = isCash ? '<span class="badge badge-emerald">CAJA EFECTIVO</span>' :
                        (isBinance ? '<span class="badge badge-amber">BILLETERA CRIPTO</span>' :
                        `<span class="badge badge-slate">${acc.accountType || 'CORRIENTE'}</span>`);

      const numberLabel = isCash ? 'IDENTIFICADOR DE CAJA' : (isBinance ? 'ID WALLET / USUARIO' : 'NÚMERO DE CUENTA');
      const titularLabel = isCash ? 'CUSTODIO / RESPONSABLE' : 'TITULAR REGISTRADO';

      return `
        <div class="bank-card ${acc.isActive ? 'active-bank' : 'inactive-bank'}">
          <!-- Cabecera de la Tarjeta -->
          <div class="bank-card-header">
            <div class="bank-identity">
              <div class="bank-icon-avatar ${avatarClass}">
                <i data-lucide="${iconName}"></i>
              </div>
              <div>
                <h4 class="bank-name">${acc.bankName}</h4>
                <div class="bank-meta-sub">
                  <span class="badge ${currencyClass}">${acc.currency} (${currencySymbol})</span>
                  ${typeBadge}
                </div>
              </div>
            </div>

            <!-- Switch de Estado en 1-Click -->
            <div class="status-toggle-wrapper" title="${acc.isActive ? 'Clic para desactivar' : 'Clic para activar'}">
              <label class="switch-ui">
                <input type="checkbox" ${acc.isActive ? 'checked' : ''} onchange="window.bankAccountsModule.toggleStatus('${acc.id}')">
                <span class="slider-ui round"></span>
              </label>
              <span class="status-label-text ${acc.isActive ? 'text-emerald' : 'text-slate'}">
                ${acc.isActive ? 'ACTIVA' : 'INACTIVA'}
              </span>
            </div>
          </div>

          <!-- Cuerpo: Número de Cuenta y Titular -->
          <div class="bank-card-body">
            <div class="bank-field-box">
              <span class="field-title">${numberLabel}</span>
              <div class="account-number-row">
                <span class="account-number-value font-mono">${acc.accountNumber}</span>
                <button type="button" class="btn-copy-acc" onclick="window.bankAccountsModule.copyAccountNumber('${acc.accountNumber}', this)" title="Copiar identificador">
                  <i data-lucide="copy"></i>
                </button>
              </div>
            </div>

            <div class="bank-field-box" style="margin-top: 10px;">
              <span class="field-title">${titularLabel}</span>
              <div class="titular-name-value">${acc.titularName}</div>
            </div>
          </div>

          <!-- Footer con Indicadores y Acciones -->
          <div class="bank-card-footer">
            <div class="bank-print-badge" title="${acc.isActive ? 'Se muestra en el pie de página de Notas de Débito' : 'No se muestra en impresiones'}">
              <i data-lucide="${acc.isActive ? 'printer' : 'eye-off'}"></i>
              <span>${acc.isActive ? 'Visible en Facturas/ND' : 'Oculto en Impresiones'}</span>
            </div>

            <div class="bank-card-actions">
              <button class="btn btn-secondary btn-sm" onclick="window.bankAccountsModule.openLedgerModal('${acc.id}')" title="Ver movimientos y saldo derivado">
                <i data-lucide="list"></i> Movimientos
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.bankAccountsModule.openEditModal('${acc.id}')" title="Editar datos de la cuenta o caja">
                <i data-lucide="edit-2"></i> Editar
              </button>
              <button class="btn btn-danger btn-sm" onclick="window.bankAccountsModule.deleteAccount('${acc.id}')" title="Eliminar cuenta o caja">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  onEntitySelectChange(val) {
    const isCashBob = val === 'Caja Efectivo BOB';
    const isCashUsd = val === 'Caja Efectivo USD';
    const isCash = isCashBob || isCashUsd || (val && val.toLowerCase().includes('caja'));
    const isBinance = val && val.toLowerCase().includes('binance');

    const accNumLabel = document.getElementById('bank-account-number-label');
    const accNumInput = document.getElementById('bank-account-number');
    const accTypeGroup = document.getElementById('bank-account-type-group');
    const accTypeSelect = document.getElementById('bank-account-type');
    const titularLabel = document.getElementById('bank-titular-label');
    const titularInput = document.getElementById('bank-titular');
    const currencySelect = document.getElementById('bank-currency');
    const bankTypeSelect = document.getElementById('bank-type');

    if (isCash) {
      if (accNumLabel) accNumLabel.textContent = 'Nombre / Identificador de Caja (Opcional):';
      if (accNumInput) {
        accNumInput.placeholder = isCashUsd ? 'Ej: CAJA-USD, Caja Dólares' : 'Ej: CAJA-BOB, Caja General BOB';
        accNumInput.required = false;
        if (!accNumInput.value || accNumInput.value.startsWith('CAJA-')) {
          accNumInput.value = isCashUsd ? 'CAJA-USD' : 'CAJA-BOB';
        }
      }
      if (accTypeGroup) accTypeGroup.style.display = 'none';
      if (accTypeSelect) accTypeSelect.value = 'EFECTIVO';
      if (titularLabel) titularLabel.textContent = 'Custodio / Responsable de Caja:';
      if (titularInput && (!titularInput.value || titularInput.value === 'MARETRAVEL S.R.L.')) {
        titularInput.placeholder = 'Ej: Cajero Principal / Administración';
      }
      if (currencySelect) {
        currencySelect.value = isCashUsd ? 'USD' : 'BOB';
        currencySelect.disabled = true;
      }
      if (bankTypeSelect) bankTypeSelect.value = 'EFECTIVO';
    } else if (isBinance) {
      if (accNumLabel) accNumLabel.textContent = 'ID Wallet / Binance Pay ID:';
      if (accNumInput) {
        accNumInput.placeholder = 'Ej: Pay ID: 12345678 o Dirección USDT';
        accNumInput.required = true;
        if (accNumInput.value.startsWith('CAJA-')) accNumInput.value = '';
      }
      if (accTypeGroup) accTypeGroup.style.display = 'none';
      if (accTypeSelect) accTypeSelect.value = 'BILLETERA_DIGITAL';
      if (titularLabel) titularLabel.textContent = 'Titular / Alias de Wallet:';
      if (currencySelect) {
        currencySelect.disabled = false;
      }
      if (bankTypeSelect) bankTypeSelect.value = 'BINANCE';
    } else {
      if (accNumLabel) accNumLabel.textContent = 'Número de Cuenta Bancaria:';
      if (accNumInput) {
        accNumInput.placeholder = 'Ej: 10000012345678';
        accNumInput.required = true;
        if (accNumInput.value.startsWith('CAJA-')) accNumInput.value = '';
      }
      if (accTypeGroup) accTypeGroup.style.display = '';
      if (titularLabel) titularLabel.textContent = 'Titular Oficial Registrado:';
      if (currencySelect) {
        currencySelect.disabled = false;
      }
      if (bankTypeSelect) bankTypeSelect.value = 'BANCO';
    }
  },

  openNewModal() {
    this.editingAccountId = null;
    const form = document.getElementById('bank-account-form');
    if (form) form.reset();

    const titleEl = document.getElementById('bank-account-modal-title');
    if (titleEl) titleEl.textContent = 'Registrar Nueva Cuenta Bancaria / Caja';

    // Valores por defecto
    const data = window.db.get();
    const titularInput = document.getElementById('bank-titular');
    if (titularInput) titularInput.value = (data.systemSettings && data.systemSettings.agencyCommercialName) || 'MARETRAVEL S.R.L.';

    const activeCheck = document.getElementById('bank-is-active');
    if (activeCheck) activeCheck.checked = true;

    const initialBalanceInput = document.getElementById('bank-initial-balance');
    if (initialBalanceInput) initialBalanceInput.value = '';

    const nameSelect = document.getElementById('bank-name-select');
    if (nameSelect) nameSelect.value = '';

    this.onEntitySelectChange('');

    window.app.openModal('modal-bank-account');
  },

  openEditModal(id) {
    this.editingAccountId = id;
    const data = window.db.get();
    const acc = (data.bankAccounts || []).find(a => a.id === id);
    if (!acc) return;

    const isCash = acc.type === 'EFECTIVO' || (acc.bankName && acc.bankName.toLowerCase().includes('caja')) || acc.accountType === 'EFECTIVO';
    const titleEl = document.getElementById('bank-account-modal-title');
    if (titleEl) titleEl.textContent = isCash ? `Editar Caja: ${acc.bankName}` : `Editar Cuenta: ${acc.bankName}`;

    document.getElementById('bank-name-select').value = acc.bankName;
    this.onEntitySelectChange(acc.bankName);

    document.getElementById('bank-account-number').value = acc.accountNumber;
    if (document.getElementById('bank-account-type')) {
      document.getElementById('bank-account-type').value = acc.accountType || (isCash ? 'EFECTIVO' : 'CORRIENTE');
    }
    document.getElementById('bank-currency').value = acc.currency;
    document.getElementById('bank-titular').value = acc.titularName;
    document.getElementById('bank-is-active').checked = !!acc.isActive;

    document.getElementById('bank-type').value = acc.type || (isCash ? 'EFECTIVO' : 'BANCO');
    document.getElementById('bank-initial-balance').value = acc.initialBalance ?? '';

    window.app.openModal('modal-bank-account');
  },

  handleSave(e) {
    e.preventDefault();
    const bankName = document.getElementById('bank-name-select').value.trim();
    let accountNumber = document.getElementById('bank-account-number').value.trim();
    let accountType = document.getElementById('bank-account-type').value;
    let currency = document.getElementById('bank-currency').value;
    const titularName = document.getElementById('bank-titular').value.trim();
    const isActive = document.getElementById('bank-is-active').checked;
    let type = document.getElementById('bank-type').value || 'BANCO';
    const initialBalance = parseFloat(document.getElementById('bank-initial-balance').value) || 0;

    const isCash = bankName === 'Caja Efectivo BOB' || bankName === 'Caja Efectivo USD' || bankName.toLowerCase().includes('caja') || type === 'EFECTIVO';
    const isBinance = bankName.toLowerCase().includes('binance') || type === 'BINANCE';

    if (isCash) {
      type = 'EFECTIVO';
      accountType = 'EFECTIVO';
      currency = bankName.includes('USD') ? 'USD' : 'BOB';
      if (!accountNumber) {
        accountNumber = currency === 'USD' ? 'CAJA-USD' : 'CAJA-BOB';
      }
    } else if (isBinance) {
      type = 'BINANCE';
      accountType = 'BILLETERA_DIGITAL';
    }

    // Validaciones estrictas
    if (!bankName) {
      window.app.showToast('Debe seleccionar o ingresar la entidad bancaria o caja.', 'error');
      return;
    }
    if (!isCash && (!accountNumber || accountNumber.length < 5)) {
      window.app.showToast('El número de cuenta bancaria debe tener al menos 5 caracteres.', 'error');
      return;
    }
    if (!titularName) {
      window.app.showToast(isCash ? 'Debe ingresar el custodio o responsable de la caja.' : 'Debe ingresar el nombre del titular oficial de la cuenta.', 'error');
      return;
    }

    const data = window.db.get();
    if (!data.bankAccounts) data.bankAccounts = [];

    // Validar duplicidad de número de cuenta (omitiendo registros eliminados)
    const isDuplicate = data.bankAccounts.some(a => 
      !a.deleted &&
      a.accountNumber.toLowerCase().replace(/[\s-]/g, '') === accountNumber.toLowerCase().replace(/[\s-]/g, '') &&
      a.id !== this.editingAccountId
    );
    if (isDuplicate) {
      window.app.showToast(isCash ? 'Ya existe una caja registrada con este identificador.' : 'Ya existe una cuenta registrada con este mismo número bancario.', 'warning');
      return;
    }

    const now = new Date().toLocaleString();

    if (this.editingAccountId) {
      // Actualizar
      const index = data.bankAccounts.findIndex(a => a.id === this.editingAccountId);
      if (index !== -1) {
        data.bankAccounts[index] = {
          ...data.bankAccounts[index],
          bankName,
          accountNumber,
          accountType,
          currency,
          titularName,
          type,
          initialBalance,
          isActive,
          updatedAt: now
        };
        // Sincronizar en financialAccounts (fuente relacional persistente)
        if (!data.financialAccounts) data.financialAccounts = [];
        const finIndex = data.financialAccounts.findIndex(f => f.id === this.editingAccountId);
        const finPayload = {
          id: this.editingAccountId,
          type: type || 'BANCO',
          bankName,
          accountNumber,
          accountType,
          titularName,
          currency,
          isActive,
          currentBalance: initialBalance,
          initialBalance,
          updatedAt: now
        };
        if (finIndex !== -1) {
          data.financialAccounts[finIndex] = { ...data.financialAccounts[finIndex], ...finPayload };
        } else {
          data.financialAccounts.push(finPayload);
        }
        window.db.save(data);
        window.app.showToast(isCash ? 'Caja de efectivo actualizada exitosamente.' : 'Cuenta bancaria actualizada exitosamente.', 'success');
      }
    } else {
      // Crear nueva
      const prefix = isCash ? 'CSH-' : (isBinance ? 'WAL-' : 'BNK-');
      const newAccount = {
        id: prefix + Date.now().toString(36).toUpperCase(),
        bankName,
        accountNumber,
        accountType,
        currency,
        titularName,
        type,
        initialBalance,
        isActive,
        createdAt: now,
        updatedAt: now
      };
      data.bankAccounts.unshift(newAccount);
      // Sincronizar simultáneamente en financialAccounts para persistencia en SQLite/Turso
      if (!data.financialAccounts) data.financialAccounts = [];
      data.financialAccounts.unshift({
        id: newAccount.id,
        type: newAccount.type || 'BANCO',
        bankName: newAccount.bankName,
        accountNumber: newAccount.accountNumber,
        accountType: newAccount.accountType,
        titularName: newAccount.titularName,
        currency: newAccount.currency,
        isActive: newAccount.isActive,
        currentBalance: newAccount.initialBalance,
        initialBalance: newAccount.initialBalance,
        createdAt: newAccount.createdAt,
        updatedAt: newAccount.updatedAt
      });
      window.db.save(data);
      window.app.showToast(isCash ? 'Nueva caja de efectivo registrada en el sistema.' : 'Nueva cuenta bancaria registrada en el sistema.', 'success');
    }

    window.app.closeModal('modal-bank-account');
    this.render();
  },

  /**
   * Switch de Estado en 1-Click (Activar / Desactivar)
   */
  toggleStatus(id) {
    const data = window.db.get();
    const acc = (data.bankAccounts || []).find(a => a.id === id);
    if (!acc) return;

    acc.isActive = !acc.isActive;
    acc.updatedAt = new Date().toLocaleString();

    if (!data.financialAccounts) data.financialAccounts = [];
    const finAcc = data.financialAccounts.find(f => f.id === id);
    if (finAcc) {
      finAcc.isActive = acc.isActive;
      finAcc.updatedAt = acc.updatedAt;
    }

    window.db.save(data);
    const statusText = acc.isActive ? 'ACTIVADA (se mostrará en documentos e impresiones)' : 'DESACTIVADA (oculta en documentos)';
    window.app.showToast(`Cuenta ${acc.bankName} ${statusText}.`, acc.isActive ? 'success' : 'info');
    this.render();
  },

  deleteAccount(id) {
    const data = window.db.get();
    const acc = (data.bankAccounts || []).find(a => a.id === id);
    if (!acc) return;

    // Validación de Integridad Referencial: Verificar si tiene pagos vinculados
    const isReferencedInPayments = (data.paymentReceipts || []).some(r => 
      r.payments?.some(p => p.bankAccountId === id || (p.reference && p.reference.includes(acc.accountNumber)))
    );

    if (isReferencedInPayments) {
      alert(`ACCIÓN DENEGADA POR INTEGRIDAD REFERENCIAL:\n\nLa cuenta bancaria "${acc.bankName} (${acc.accountNumber})" no puede ser eliminada porque ya tiene recibos y cobros vinculados en el sistema contable.\n\nRecomendación: Utilice el switch para DESACTIVAR la cuenta en su lugar.`);
      return;
    }

    if (!confirm(`¿Confirma que desea mover a la PAPELERA la cuenta bancaria:\n${acc.bankName} - ${acc.accountNumber}?\n\nDejará de verse en el sistema, pero NO se borra de la base de datos. Solo el súper usuario puede restaurarla o purgarla definitivamente.`)) {
      return;
    }

    acc.deleted = true;
    acc.deletedAt = new Date().toLocaleString();
    acc.deletedBy = (data.currentUser && data.currentUser.name) || 'Administrador';
    // La cuenta bancaria vive realmente en financial_accounts (type='BANCO') y bankAccounts
    // es una proyección: marcar también la fuente para que el soft-delete persista en la BD.
    const finCopy = (data.financialAccounts || []).find(f => f.id === acc.id);
    if (finCopy) {
      finCopy.deleted = true;
      finCopy.deletedAt = acc.deletedAt;
      finCopy.deletedBy = acc.deletedBy;
    }
    window.db.save(data);
    window.app.showToast('Cuenta bancaria movida a la PAPELERA. No se borró de la base de datos.', 'info');
    this.render();
  },

  copyAccountNumber(number, btn) {
    const notifyCopied = () => {
      if (btn) {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="check" style="color: #10b981;"></i>';
        if (window.lucide) window.lucide.createIcons();
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          if (window.lucide) window.lucide.createIcons();
        }, 2000);
      }
      window.app.showToast(`Número copiado: ${number}`, 'info');
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(number).then(() => {
        notifyCopied();
      }).catch(() => {
        this.fallbackCopy(number, notifyCopied);
      });
    } else {
      this.fallbackCopy(number, notifyCopied);
    }
  },

  fallbackCopy(text, callback) {
    try {
      const tempInput = document.createElement('input');
      tempInput.value = text;
      tempInput.style.position = 'fixed';
      tempInput.style.opacity = '0';
      document.body.appendChild(tempInput);
      tempInput.focus();
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
      if (callback) callback();
    } catch (e) {
      window.app.showToast(`Número de cuenta: ${text}`, 'info');
    }
  },

  openLedgerModal(accountId) {
    const data = window.db.get();
    const acc = (data.bankAccounts || []).find(a => a.id === accountId);
    if (!acc) return;
    const bal = window.financialGuard.getAccountBalance(accountId);
    const neg = bal.saldo < 0;
    document.getElementById('acc-ledger-title').textContent = `${acc.bankName || acc.name || 'Cuenta'} ${acc.accountNumber ? '- Cta. ' + acc.accountNumber : ''}`;
    document.getElementById('acc-ledger-balance').textContent = `Saldo: ${acc.currency} ${bal.saldo.toFixed(2)}`;
    document.getElementById('acc-ledger-balance').style.color = neg ? '#dc2626' : '#00a884';
    const tbody = document.getElementById('acc-ledger-body');
    tbody.innerHTML = bal.transactions.length === 0
      ? '<tr><td colspan="5" style="text-align:center;padding:16px;color:#64748b;">Sin transacciones (saldo inicial: ' + acc.currency + ' ' + bal.saldo.toFixed(2) + ')</td></tr>'
      : bal.transactions.map(t => `
        <tr>
          <td>${t.date}</td>
          <td><span class="badge ${t.type === 'EGRESO' ? 'badge-rose' : 'badge-emerald'}">${t.type === 'EGRESO' ? 'EGRESO' : 'INGRESO'}</span></td>
          <td class="font-mono">${t.amount.toFixed(2)}</td>
          <td>${t.medio}</td>
          <td>${t.reference || '-'}</td>
        </tr>`).join('');
    window.app.openModal('modal-account-ledger');
  }
};
