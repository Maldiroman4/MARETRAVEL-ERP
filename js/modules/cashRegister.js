/**
 * MARETRAVEL ERP - Módulo 5: Caja, Cobranzas y Pagos Multimoneda
 * Incluye: Cobranza mixta multimoneda (BOB/USD), Recibo Oficial de Caja con logo,
 * Pago a NCs de proveedores, y reversión de pagos con auditoría y restauración de saldos.
 */

window.cashRegisterModule = {
  currentTab: 'cobranzas',
  selectedClientNds: [],
  selectedProviderNcs: [],
  activePaymentRows: [],

  init() {
    if (!this._eventsBound) {
      this.bindEvents();
      this._eventsBound = true;
    }
    this.render();
  },

  bindEvents() {
    // Tabs de Caja
    const tabs = document.querySelectorAll('.cash-tab-btn');
    tabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        tabs.forEach(t => {
          t.classList.remove('active', 'btn-primary');
          t.classList.add('btn-secondary');
        });
        e.currentTarget.classList.add('active', 'btn-primary');
        e.currentTarget.classList.remove('btn-secondary');
        this.currentTab = e.currentTarget.dataset.tab;
        this.showTabContent(this.currentTab);
        if (window.lucide) window.lucide.createIcons();
      });
    });

    // Cobranzas: Selección de cliente
    const clientSelect = document.getElementById('cash-client-select');
    if (clientSelect) {
      clientSelect.addEventListener('change', (e) => this.loadClientPendingNds(e.target.value));
    }

    // Cobranzas: Añadir forma de pago mixta
    const btnAddPay = document.getElementById('btn-add-payment-method-row');
    if (btnAddPay) {
      btnAddPay.addEventListener('click', () => this.addPaymentMethodRow());
    }

    // Cobranzas: Botón Procesar Cobro
    const btnProcessCollect = document.getElementById('btn-process-collection');
    if (btnProcessCollect) {
      btnProcessCollect.addEventListener('click', () => this.processCollection());
    }

    // Pagos a Proveedor: Selección de proveedor
    const provSelect = document.getElementById('cash-prov-select');
    if (provSelect) {
      provSelect.addEventListener('change', (e) => this.loadProviderPendingNcs(e.target.value));
    }

    // Pagos a Proveedor: Botón Procesar Pago
    const btnProcessProv = document.getElementById('btn-process-prov-payment');
    if (btnProcessProv) {
      btnProcessProv.addEventListener('click', () => this.processProviderPayment());
    }

    // Reversión: Formulario
    const formRev = document.getElementById('receipt-reversal-form');
    if (formRev) {
      formRev.addEventListener('submit', (e) => this.handleConfirmReversal(e));
    }
  },

  showTabContent(tab) {
    document.querySelectorAll('.cash-subview').forEach(v => v.style.display = 'none');
    const target = document.getElementById(`cash-view-${tab}`);
    if (target) target.style.display = 'block';

    if (tab === 'cobranzas') this.setupCobranzasTab();
    if (tab === 'pagos') this.setupPagosTab();
    if (tab === 'historial') this.renderReceiptsHistory();
    if (tab === 'arqueo') this.setupArqueoTab();
  },

  render() {
    this.showTabContent(this.currentTab);
  },

  // ==========================================
  // SUB-MÓDULO: COBRANZAS A CLIENTES (PAGO NDs)
  // ==========================================

  setupCobranzasTab() {
    const data = window.db.get();
    
    // Renderizar Badge de T/C Centralizado
    const tcBadge = document.getElementById('cash-tc-badge-cobranzas');
    if (tcBadge && window.financialGuard) {
      tcBadge.innerHTML = window.financialGuard.renderTcBadgeHtml();
    }

    const clients = data.accounts.filter(a => a.relationType === 'CLIENTE' || a.relationType === 'AMBOS');
    const select = document.getElementById('cash-client-select');
    if (select) {
      const curr = select.value;
      select.innerHTML = '<option value="">-- Seleccionar Cliente para Cobranza --</option>' +
        clients.map(c => `<option value="${c.id}" ${c.id === curr ? 'selected' : ''}>${c.name} (${c.code})</option>`).join('');
      if (curr) {
        this.loadClientPendingNds(curr);
      }
    }

    // Inicializar fila por defecto de forma de pago
    const container = document.getElementById('payment-methods-breakdown-list');
    if (container && container.children.length === 0) {
      this.addPaymentMethodRow();
    }

    // Cargar historial de NDs integrado
    this.renderNdHistory();
  },

  switchNdSubView(subview) {
    this.ndCurrentSubView = subview;
    document.querySelectorAll('.nd-subview-toggle').forEach(btn => {
      const active = btn.dataset.subview === subview;
      btn.classList.toggle('active', active);
      btn.classList.toggle('btn-primary', active);
      btn.classList.toggle('btn-secondary', !active);
    });
    const panelCollection = document.getElementById('nd-subview-collection');
    const panelHistory = document.getElementById('nd-subview-history');
    if (panelCollection) panelCollection.style.display = (subview === 'collection') ? 'block' : 'none';
    if (panelHistory) panelHistory.style.display = (subview === 'history') ? 'block' : 'none';
    if (subview === 'history') this.renderNdHistory();
    if (window.lucide) window.lucide.createIcons();
  },

  renderNdHistory() {
    const data = window.db.get();
    const notes = data.debitNotes || [];
    const search = (document.getElementById('cash-nd-search-input')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('cash-nd-status-filter')?.value || 'TODOS';
    const tbody = document.getElementById('cash-nd-history-table-body');
    const badge = document.getElementById('cash-nd-badge');
    if (badge) badge.textContent = notes.length;
    if (!tbody) return;

    let filtered = notes.filter(nd => {
      const matchStatus = statusFilter === 'TODOS' || nd.status === statusFilter;
      const matchSearch = String(nd.ndNumber).includes(search) ||
                          (nd.accountName && nd.accountName.toLowerCase().includes(search)) ||
                          (nd.solicitante && nd.solicitante.toLowerCase().includes(search));
      return matchStatus && matchSearch;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: var(--text-muted);">No se encontraron Notas de Débito registradas.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(nd => {
      const statusBadge = nd.status === 'PAGADA' ? 'badge-emerald' :
                          nd.status === 'PARCIAL' ? 'badge-blue' :
                          (nd.status === 'IMPAGA' || nd.status === 'PENDIENTE') ? 'badge-amber' :
                          nd.status === 'CERRADA' ? 'badge-indigo' :
                          nd.status === 'BORRADOR' ? 'badge-slate' : 'badge-rose';

      const canCollect = nd.status !== 'PAGADA' && nd.status !== 'ANULADA';

      return `
        <tr>
          <td class="font-mono" style="font-weight: 700; color: var(--navy);">ND #${nd.ndNumber}</td>
          <td class="font-mono">${nd.issueDate || '-'}</td>
          <td>
            <div style="font-weight: 600;">${nd.accountName}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">Sol: ${nd.solicitante || 'General'}</div>
          </td>
          <td><span class="badge badge-slate">${(nd.paymentTerm || 'CONTADO').replace(/_/g, ' ')}</span></td>
          <td class="font-mono" style="text-align: right; font-weight: 700;">
            ${nd.currency || 'BOB'} ${Number(nd.totalAmountBob || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
          </td>
          <td class="font-mono" style="text-align: right; color: #b91c1c; font-weight: 700;">
            ${nd.currency || 'BOB'} ${Number(nd.balanceBob || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
          </td>
          <td><span class="badge ${statusBadge}">${nd.status}</span></td>
          <td style="font-size: 0.78rem;">${(nd.items?.length || 0)} serv.</td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
              ${canCollect ? `
                <button class="btn btn-primary btn-xs" onclick="window.cashRegisterModule.quickCollectNd('${nd.id}', '${nd.accountId}')" title="Cobrar esta ND en Caja">
                  <i data-lucide="dollar-sign"></i> Cobrar
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-xs" onclick="window.debitNotesModule.directPrint('${nd.id}')" title="Imprimir Oficial">
                <i data-lucide="printer"></i>
              </button>
              <button class="btn btn-secondary btn-xs" onclick="window.debitNotesModule.printPreview('${nd.id}', 'long')" title="Ver Voucher">
                <i data-lucide="file-text"></i>
              </button>
              <button class="btn btn-secondary btn-xs" onclick="window.reportsModule.openCorrectionModal('ND', '${nd.id}')" title="Corrección Contable">
                <i data-lucide="edit-3"></i>
              </button>
              ${nd.status !== 'ANULADA' ? `
                <button class="btn btn-danger btn-xs" onclick="window.reportsModule.openVoidModal('ND', '${nd.id}')" title="Anular ND con Auditoría">
                  <i data-lucide="x-circle"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  quickCollectNd(ndId, accountId) {
    this.switchNdSubView('collection');
    const select = document.getElementById('cash-client-select');
    if (select) {
      select.value = accountId;
      this.loadClientPendingNds(accountId);
      setTimeout(() => {
        const check = document.querySelector(`.nd-collect-check[value="${ndId}"]`);
        if (check) check.checked = true;
        this.calculateTotals();
      }, 100);
    }
  },

  loadClientPendingNds(clientId) {
    const tbody = document.getElementById('client-pending-nds-table-body');
    if (!tbody) return;

    if (!clientId) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--text-muted);">Selecciona un cliente para ver sus Notas de Débito pendientes de cobro.</td></tr>`;
      this.updateCobranzaSummary();
      return;
    }

    const data = window.db.get();
    const pendingNds = data.debitNotes.filter(n => n.accountId === clientId && (n.status === 'PENDIENTE' || n.status === 'IMPAGA' || n.status === 'PARCIAL' || n.status === 'CERRADA') && n.balanceBob > 0);

    if (pendingNds.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: #15803d; font-weight: 600;">Este cliente no tiene Notas de Débito pendientes de pago. ¡Al día!</td></tr>`;
      this.updateCobranzaSummary();
      return;
    }

    tbody.innerHTML = pendingNds.map(nd => `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" class="nd-collect-check" value="${nd.id}" onchange="window.cashRegisterModule.onPaymentAmountChange()" checked style="width: 16px; height: 16px; cursor: pointer;">
        </td>
        <td class="font-mono" style="font-weight: 700; color: var(--navy);">ND #${nd.ndNumber}</td>
        <td class="font-mono">${nd.issueDate}</td>
        <td class="font-mono" style="text-align: right;">${nd.currency} ${Number(nd.totalAmountBob).toFixed(2)}</td>
        <td class="font-mono" style="text-align: right; color: #b91c1c; font-weight: 700;" id="nd-bal-${nd.id}">
          BOB ${Number(nd.balanceBob).toFixed(2)}
        </td>
        <td>
          <input type="number" step="0.01" min="0" max="${nd.balanceBob}" class="form-control nd-amount-to-pay" data-nd-id="${nd.id}" data-max-balance="${nd.balanceBob}" value="${nd.balanceBob}" oninput="window.cashRegisterModule.onNdAmountChange(this)" style="width: 130px; text-align: right; font-weight: 700;">
        </td>
        <td><span class="badge ${nd.status === 'PARCIAL' ? 'badge-blue' : 'badge-amber'}">${nd.status}</span></td>
      </tr>
    `).join('');

    this.updateCobranzaSummary();
  },

  addPaymentMethodRow() {
    const container = document.getElementById('payment-methods-breakdown-list');
    if (!container) return;

    const rowId = 'pm_row_' + Math.random().toString(36).substr(2, 9);

    const div = document.createElement('div');
    div.className = 'payment-row form-row';
    div.id = rowId;
    div.style.marginBottom = '12px';
    div.style.alignItems = 'flex-start';
    div.innerHTML = `
      <div style="grid-column: span 2;">
        <select class="form-control pm-select" onchange="window.cashRegisterModule.onPaymentAmountChange()">
          <!-- Opciones pobladas por financialGuard -->
        </select>
        <div class="pm-account-guard-pill" style="margin-top: 4px; font-size: 0.76rem;"></div>
      </div>
      <div>
        <input type="number" step="0.01" class="form-control pm-amount" placeholder="Importe" value="0.00" oninput="window.cashRegisterModule.onPaymentAmountChange()" style="text-align: right; font-weight: 700;">
      </div>
      <div>
        <input type="text" class="form-control pm-ref" placeholder="Nro Transf / Cheque / QR">
      </div>
      <div style="flex-shrink: 0; width: 40px; padding-top: 4px;">
        <button type="button" class="btn btn-danger btn-sm" onclick="document.getElementById('${rowId}').remove(); window.cashRegisterModule.onPaymentAmountChange();">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;
    container.appendChild(div);

    const selectEl = div.querySelector('.pm-select');
    if (window.financialGuard && selectEl) {
      window.financialGuard.populateSelect(selectEl, null, { placeholder: '-- Seleccionar Cuenta Financiera Activa --' });
    } else if (selectEl) {
      const data = window.db.get();
      const methods = data.paymentMethods || [];
      selectEl.innerHTML = '<option value="">-- Seleccionar Cuenta --</option>' + methods.map(m => `<option value="${m.id}" data-curr="${m.currency}">[${m.code}] ${m.name} (${m.currency})</option>`).join('');
    }

    if (window.lucide) window.lucide.createIcons();
    this.onPaymentAmountChange();
  },

  onPaymentAmountChange() {
    const data = window.db.get();
    const rates = window.financialGuard ? window.financialGuard.getExchangeRates() : { sellRate: 6.96 };
    const sellRate = rates.sellRate || 6.96;

    let allAccountsValid = true;
    let totalEnteredBob = 0;
    const paymentRows = document.querySelectorAll('#payment-methods-breakdown-list .payment-row');

    paymentRows.forEach(row => {
      const select = row.querySelector('.pm-select');
      const pill = row.querySelector('.pm-account-guard-pill');
      const accId = select ? select.value : '';
      const amount = parseFloat(row.querySelector('.pm-amount')?.value) || 0;

      let account = null;
      if (window.financialGuard) {
        account = window.financialGuard.getAccountById(accId);
      }
      if (!account && data.paymentMethods) {
        account = data.paymentMethods.find(m => m.id === accId);
      }

      if (accId && account) {
        const val = window.financialGuard ? window.financialGuard.validateAccount(account) : { valid: true, summary: '' };
        if (val.valid) {
          if (pill) pill.innerHTML = `<span style="color: #15803d; font-weight: 600;">✓ Cuenta Activa y Validada (${account.currency})</span>`;
          const curr = account.currency || 'BOB';
          if (curr === 'BOB') {
            totalEnteredBob += amount;
          } else {
            // USD o USDT
            totalEnteredBob += (amount * sellRate);
          }
        } else {
          allAccountsValid = false;
          if (pill) pill.innerHTML = `<span style="color: #dc2626; font-weight: 600;">⚠ ${val.summary}</span>`;
        }
      } else {
        allAccountsValid = false;
        if (pill) pill.innerHTML = `<span style="color: #94a3b8; font-style: italic;">Selecciona una cuenta financiera activa</span>`;
      }
    });

    // Auto-ajustar importes en la tabla de NDs según el pago ingresado
    const checks = document.querySelectorAll('.nd-collect-check:checked');
    if (checks.length === 1) {
      const ndId = checks[0].value;
      const nd = (data.debitNotes || []).find(n => n.id === ndId);
      const input = document.querySelector(`.nd-amount-to-pay[data-nd-id="${ndId}"]`);
      if (input && nd) {
        if (totalEnteredBob > 0) {
          input.value = Math.min(nd.balanceBob, totalEnteredBob).toFixed(2);
        } else {
          input.value = nd.balanceBob.toFixed(2);
        }
      }
    } else if (checks.length > 1 && totalEnteredBob > 0) {
      let remaining = totalEnteredBob;
      checks.forEach(cb => {
        const ndId = cb.value;
        const nd = (data.debitNotes || []).find(n => n.id === ndId);
        const input = document.querySelector(`.nd-amount-to-pay[data-nd-id="${ndId}"]`);
        if (input && nd) {
          const toPay = Math.min(nd.balanceBob, remaining);
          input.value = toPay.toFixed(2);
          remaining = Math.max(0, remaining - toPay);
        }
      });
    }

    this.updateCobranzaSummary();

    // Guardrail UI: Bloquear/Desbloquear botón Procesar Cobro
    const btnProcess = document.getElementById('btn-process-collection');
    if (btnProcess) {
      const hasSelectedNds = checks.length > 0;
      if (!allAccountsValid || totalEnteredBob <= 0 || !hasSelectedNds) {
        btnProcess.disabled = true;
        btnProcess.style.opacity = '0.55';
        btnProcess.style.cursor = 'not-allowed';
      } else {
        btnProcess.disabled = false;
        btnProcess.style.opacity = '1';
        btnProcess.style.cursor = 'pointer';
      }
    }
  },

  onNdAmountChange(input) {
    const maxBal = parseFloat(input.dataset.maxBalance) || 0;
    let val = parseFloat(input.value) || 0;

    if (val < 0) {
      input.value = '0.00';
      val = 0;
    }
    if (val > maxBal) {
      input.value = maxBal.toFixed(2);
      val = maxBal;
      window.app.showToast(`El monto no puede superar el saldo pendiente (BOB ${maxBal.toFixed(2)})`, 'warning');
    }

    // Si solo hay 1 fila de medio de pago, sincronizar automáticamente
    const paymentRows = document.querySelectorAll('#payment-methods-breakdown-list .payment-row');
    if (paymentRows.length === 1) {
      let totalToPay = 0;
      const checks = document.querySelectorAll('.nd-collect-check:checked');
      checks.forEach(cb => {
        const inp = document.querySelector(`.nd-amount-to-pay[data-nd-id="${cb.value}"]`);
        if (inp) totalToPay += (parseFloat(inp.value) || 0);
      });

      const firstPmInput = paymentRows[0].querySelector('.pm-amount');
      const select = paymentRows[0].querySelector('.pm-select');
      const accId = select ? select.value : '';
      let account = window.financialGuard ? window.financialGuard.getAccountById(accId) : null;
      const curr = account ? account.currency : 'BOB';
      const rates = window.financialGuard ? window.financialGuard.getExchangeRates() : { sellRate: 6.96 };
      const sellRate = rates.sellRate || 6.96;

      if (firstPmInput) {
        firstPmInput.value = curr === 'BOB' ? totalToPay.toFixed(2) : (totalToPay / sellRate).toFixed(2);
      }
    }

    this.updateCobranzaSummary();
  },

  updateCobranzaSummary() {
    const data = window.db.get();
    const rates = window.financialGuard ? window.financialGuard.getExchangeRates() : { sellRate: 6.96 };
    const sellRate = rates.sellRate || 6.96;

    // 1. Total saldo de las NDs seleccionadas
    let totalSelectedBalanceBob = 0;
    const checks = document.querySelectorAll('.nd-collect-check:checked');
    checks.forEach(cb => {
      const ndId = cb.value;
      const nd = (data.debitNotes || []).find(n => n.id === ndId);
      if (nd) {
        totalSelectedBalanceBob += (nd.balanceBob || 0);
      }
    });

    // 2. Total ingresado en medios de pago
    let totalEnteredBob = 0;
    let totalEnteredUsd = 0;
    const paymentRows = document.querySelectorAll('#payment-methods-breakdown-list .payment-row');
    paymentRows.forEach(row => {
      const select = row.querySelector('.pm-select');
      const accId = select ? select.value : '';
      let account = window.financialGuard ? window.financialGuard.getAccountById(accId) : null;
      if (!account && data.paymentMethods) account = data.paymentMethods.find(m => m.id === accId);

      const curr = account ? account.currency : 'BOB';
      const amount = parseFloat(row.querySelector('.pm-amount')?.value) || 0;

      if (curr === 'BOB') {
        totalEnteredBob += amount;
        totalEnteredUsd += (amount / sellRate);
      } else {
        totalEnteredUsd += amount;
        totalEnteredBob += (amount * sellRate);
      }
    });

    const elTotalNds = document.getElementById('sum-total-nds-bob');
    const elEnteredBob = document.getElementById('sum-total-entered-bob');
    const elEnteredUsd = document.getElementById('sum-total-entered-usd');
    const diffEl = document.getElementById('sum-diff-bob');

    if (elTotalNds) elTotalNds.textContent = `BOB ${totalSelectedBalanceBob.toFixed(2)}`;
    if (elEnteredBob) elEnteredBob.textContent = `BOB ${totalEnteredBob.toFixed(2)}`;
    if (elEnteredUsd) elEnteredUsd.textContent = `USD ${totalEnteredUsd.toFixed(2)}`;

    if (diffEl) {
      if (totalEnteredBob <= 0) {
        diffEl.style.color = '#64748b';
        diffEl.textContent = 'PENDIENTE (0.00)';
      } else if (totalEnteredBob > totalSelectedBalanceBob + 0.05) {
        const excess = totalEnteredBob - totalSelectedBalanceBob;
        diffEl.style.color = '#dc2626';
        diffEl.innerHTML = `<span style="color: #dc2626;">⚠ EXCEDE SALDO (+BOB ${excess.toFixed(2)})</span>`;
      } else if (Math.abs(totalEnteredBob - totalSelectedBalanceBob) <= 0.05) {
        diffEl.style.color = '#15803d';
        diffEl.innerHTML = `<span style="color: #15803d;">✓ PAGO TOTAL (Saldo 0.00)</span>`;
      } else {
        // Pago Parcial
        const remaining = totalSelectedBalanceBob - totalEnteredBob;
        diffEl.style.color = '#0284c7';
        diffEl.innerHTML = `<span style="color: #0284c7;">✓ PAGO PARCIAL (Saldo Restará: BOB ${remaining.toFixed(2)})</span>`;
      }
    }
  },

  processCollection() {
    const data = window.db.get();
    const clientId = document.getElementById('cash-client-select').value;
    const client = data.accounts.find(a => a.id === clientId);
    if (!client) {
      window.app.showToast('Selecciona un cliente para la cobranza', 'warning');
      return;
    }

    const checks = document.querySelectorAll('.nd-collect-check:checked');
    if (checks.length === 0) {
      window.app.showToast('Selecciona al menos una Nota de Débito a cobrar', 'warning');
      return;
    }

    const rates = window.financialGuard ? window.financialGuard.getExchangeRates() : { sellRate: 6.96 };
    const sellRate = rates.sellRate || 6.96;

    // Recopilar y validar estrictamente las formas de pago
    const payments = [];
    let totalEnteredBob = 0;
    const paymentRows = document.querySelectorAll('#payment-methods-breakdown-list .payment-row');

    for (let row of paymentRows) {
      const select = row.querySelector('.pm-select');
      const accId = select ? select.value : '';
      const amount = parseFloat(row.querySelector('.pm-amount')?.value) || 0;
      const ref = (row.querySelector('.pm-ref')?.value || '').trim();

      if (amount <= 0) continue;

      let account = null;
      if (window.financialGuard) {
        account = window.financialGuard.getAccountById(accId);
      }
      if (!account && data.paymentMethods) {
        account = data.paymentMethods.find(m => m.id === accId);
      }

      const val = window.financialGuard ? window.financialGuard.validateAccount(account) : { valid: !!account, summary: '' };
      if (!account || !val.valid) {
        window.app.showToast(`Bloqueo de Cobranza: La cuenta seleccionada no es válida o está inactiva (${val.summary})`, 'error');
        return;
      }

      const curr = account.currency || 'BOB';
      const inBob = (curr === 'BOB') ? amount : (amount * sellRate);
      totalEnteredBob += inBob;

      const accDisplayName = account.type === 'BANCO' ? `${account.bankName} - Cta. ${account.accountNumber} (${account.titularName})` :
                             account.type === 'BINANCE' ? `Binance Pay (ID: ${account.binanceId || account.walletAddress})` :
                             account.type === 'EFECTIVO' ? `${account.cashDeskName || 'Caja Central'} (Custodio: ${account.custodianName})` :
                             (account.name || 'Cuenta');

      payments.push({
        financialAccountId: account.id,
        accountType: account.type || 'BANCO',
        paymentMethodId: account.id,
        paymentMethodCode: account.bankName || account.code || 'FIN-ACC',
        paymentMethodName: accDisplayName,
        titularName: account.titularName || account.custodianName || '-',
        currency: curr,
        amount: amount,
        amountBob: parseFloat(inBob.toFixed(2)),
        exchangeRateUsed: sellRate,
        frozenExchangeRate: sellRate,
        reference: ref || '-'
      });
    }

    if (payments.length === 0 || totalEnteredBob <= 0) {
      window.app.showToast('Ingresa al menos una forma de pago válida en una cuenta financiera activa con monto mayor a cero', 'warning');
      return;
    }

    // Calcular saldo total de las NDs seleccionadas
    let totalSelectedBalanceBob = 0;
    checks.forEach(cb => {
      const nd = data.debitNotes.find(n => n.id === cb.value);
      if (nd) totalSelectedBalanceBob += (nd.balanceBob || 0);
    });

    if (totalEnteredBob > totalSelectedBalanceBob + 0.10) {
      window.app.showToast(`El importe ingresado (BOB ${totalEnteredBob.toFixed(2)}) supera el saldo pendiente total de las NDs seleccionadas (BOB ${totalSelectedBalanceBob.toFixed(2)})`, 'warning');
      return;
    }

    // Determinar montos a amortizar por cada ND
    let customAmountsValid = true;
    let customSum = 0;
    const userAmounts = [];
    for (let cb of checks) {
      const ndId = cb.value;
      const nd = data.debitNotes.find(n => n.id === ndId);
      const amountInput = document.querySelector(`.nd-amount-to-pay[data-nd-id="${ndId}"]`);
      const amt = parseFloat(amountInput?.value) || 0;
      if (amt > (nd.balanceBob || 0) + 0.05) {
        customAmountsValid = false;
        break;
      }
      customSum += amt;
      userAmounts.push({ nd, amt });
    }

    const amortizations = [];
    let totalAmortizedBob = 0;

    if (customAmountsValid && Math.abs(customSum - totalEnteredBob) <= 0.10 && customSum > 0) {
      userAmounts.forEach(({ nd, amt }) => {
        if (amt > 0) {
          totalAmortizedBob += amt;
          amortizations.push({
            nd,
            amountPaidBob: amt,
            amountPaidUsd: parseFloat((amt / sellRate).toFixed(2))
          });
        }
      });
    } else {
      let remaining = totalEnteredBob;
      for (let cb of checks) {
        if (remaining <= 0.001) break;
        const ndId = cb.value;
        const nd = data.debitNotes.find(n => n.id === ndId);
        if (!nd || (nd.balanceBob || 0) <= 0) continue;

        const toPay = Math.min(nd.balanceBob, remaining);
        const toPayBob = parseFloat(toPay.toFixed(2));
        remaining = parseFloat((remaining - toPayBob).toFixed(2));
        totalAmortizedBob += toPayBob;

        amortizations.push({
          nd,
          amountPaidBob: toPayBob,
          amountPaidUsd: parseFloat((toPayBob / sellRate).toFixed(2))
        });
      }
    }

    // Crear Recibo de Caja Oficial
    const nextReceipt = (data.cashReceipts && data.cashReceipts.length > 0) ? Math.max(...data.cashReceipts.map(r => r.receiptNumber || 0)) + 1 : 2001;
    const receiptCode = 'RCP-' + String(nextReceipt).padStart(5, '0');
    const receiptDetails = [];

    // Aplicar amortizaciones a cada ND
    amortizations.forEach(item => {
      const prevBalBob = Number(item.nd.balanceBob || 0);
      const prevBalUsd = Number(item.nd.balanceUsd || 0);
      const newBalBob = Math.max(0, prevBalBob - item.amountPaidBob);
      const newBalUsd = Math.max(0, prevBalUsd - item.amountPaidUsd);

      item.nd.paidAmountBob = parseFloat(((item.nd.paidAmountBob || 0) + item.amountPaidBob).toFixed(2));
      item.nd.paidAmountUsd = parseFloat(((item.nd.paidAmountUsd || 0) + item.amountPaidUsd).toFixed(2));
      item.nd.balanceBob = parseFloat(newBalBob.toFixed(2));
      item.nd.balanceUsd = parseFloat(newBalUsd.toFixed(2));

      // Actualización Dinámica del Estado: Si saldo <= 0.05 -> PAGADA / LIQUIDADA
      if (item.nd.balanceBob <= 0.05) {
        item.nd.status = 'PAGADA';
        item.nd.balanceBob = 0;
        item.nd.balanceUsd = 0;
      } else {
        item.nd.status = 'PARCIAL';
      }

      if (!item.nd.paymentHistory) item.nd.paymentHistory = [];
      item.nd.paymentHistory.push({
        receiptNumber: nextReceipt,
        receiptCode: receiptCode,
        amountPaidBob: item.amountPaidBob,
        amountPaidUsd: item.amountPaidUsd,
        date: new Date().toLocaleString(),
        exchangeRateUsed: sellRate
      });

      receiptDetails.push({
        debitNoteId: item.nd.id,
        ndNumber: item.nd.ndNumber,
        amountPaidBob: item.amountPaidBob,
        amountPaidUsd: item.amountPaidUsd,
        previousBalanceBob: prevBalBob,
        remainingBalanceBob: item.nd.balanceBob,
        previousBalanceUsd: prevBalUsd,
        remainingBalanceUsd: item.nd.balanceUsd
      });
    });

    const isPartial = totalEnteredBob < totalSelectedBalanceBob - 0.05;
    const remainingTotalBalance = Math.max(0, totalSelectedBalanceBob - totalEnteredBob);

    const newReceipt = {
      id: 'CR-' + Date.now(),
      receiptNumber: nextReceipt,
      receiptCode: receiptCode,
      accountId: client.id,
      accountName: client.name,
      solicitante: amortizations[0]?.nd?.solicitante || 'Oficina Central',
      receiptDate: new Date().toLocaleString(),
      paymentType: isPartial ? 'PARCIAL' : 'TOTAL',
      totalPaidBob: parseFloat(totalAmortizedBob.toFixed(2)),
      totalPaidUsd: parseFloat((totalAmortizedBob / sellRate).toFixed(2)),
      remainingBalanceBob: parseFloat(remainingTotalBalance.toFixed(2)),
      exchangeRateUsed: sellRate,
      frozenExchangeRate: sellRate,
      status: 'VALIDO',
      reversalReason: null,
      reversedAt: null,
      reversedBy: null,
      createdById: data.currentUser ? data.currentUser.id : 'usr-1',
      createdByName: data.currentUser ? data.currentUser.name : 'Administrador',
      details: receiptDetails,
      payments: payments
    };

    if (!data.cashReceipts) data.cashReceipts = [];
    data.cashReceipts.unshift(newReceipt);
    window.db.save(data);

    if (isPartial) {
      window.app.showToast(`Recibo ${receiptCode} emitido con éxito. ¡Abono Parcial registrado! Saldo restante: BOB ${remainingTotalBalance.toFixed(2)}`, 'success');
    } else {
      window.app.showToast(`Recibo ${receiptCode} emitido con éxito. ¡Liquidación total al 100%!`, 'success');
    }

    // Recargar vista y abrir impresión del Recibo Oficial
    this.loadClientPendingNds(clientId);
    if (window.debitNotesModule) window.debitNotesModule.render();
    this.printReceipt(newReceipt.id);
  },

  // ==========================================
  // SUB-MÓDULO: PAGOS A PROVEEDORES (PAGO NCs)
  // ==========================================

  setupPagosTab() {
    const data = window.db.get();

    // Renderizar Badge de T/C Centralizado
    const tcBadge = document.getElementById('cash-tc-badge-pagos');
    if (tcBadge && window.financialGuard) {
      tcBadge.innerHTML = window.financialGuard.renderTcBadgeHtml();
    }

    const providers = data.accounts.filter(a => a.relationType === 'PROVEEDOR' || a.relationType === 'AMBOS');
    const select = document.getElementById('cash-prov-select');
    if (select) {
      select.innerHTML = '<option value="">-- Seleccionar Proveedor para Liquidación --</option>' +
        providers.map(p => `<option value="${p.id}">${p.name} (${p.code})</option>`).join('');
    }

    const selectMethod = document.getElementById('prov-payment-method-select');
    if (selectMethod) {
      if (window.financialGuard) {
        window.financialGuard.populateSelect(selectMethod, null, { placeholder: '-- Seleccionar Cuenta Financiera Origen --' });
      } else {
        const payMethods = data.paymentMethods.filter(m => m.type === 'PAGOS' || m.type === 'AMBOS');
        selectMethod.innerHTML = payMethods.map(m => `<option value="${m.id}">[${m.code}] ${m.name} (${m.currency})</option>`).join('');
      }
    }

    this.onProvAccountChange();

    // Cargar historial de NCs integrado
    this.renderNcHistory();
  },

  onProvAccountChange() {
    const selectMethod = document.getElementById('prov-payment-method-select');
    const pill = document.getElementById('prov-account-guard-pill');
    const btn = document.getElementById('btn-process-prov-payment');
    if (!selectMethod) return;

    const accId = selectMethod.value;
    const account = window.financialGuard ? window.financialGuard.getAccountById(accId) : null;

    if (!accId || !account) {
      if (pill) pill.innerHTML = `<span style="color: #94a3b8; font-style: italic;">Seleccione la cuenta financiera desde donde saldrán los fondos.</span>`;
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.55';
        btn.style.cursor = 'not-allowed';
      }
      return;
    }

    const val = window.financialGuard ? window.financialGuard.validateAccount(account) : { valid: true };
    if (val.valid) {
      if (pill) pill.innerHTML = `<span style="color: #15803d; font-weight: 600;">✓ Cuenta Activa y Verificada (${account.currency}) | Titular/Custodio: ${account.titularName || account.custodianName || '-'}</span>`;
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
    } else {
      if (pill) pill.innerHTML = `<span style="color: #dc2626; font-weight: 600;">⚠ ${val.summary}</span>`;
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.55';
        btn.style.cursor = 'not-allowed';
      }
    }
  },

  switchNcSubView(subview) {
    this.ncCurrentSubView = subview;
    document.querySelectorAll('.nc-subview-toggle').forEach(btn => {
      const active = btn.dataset.subview === subview;
      btn.classList.toggle('active', active);
      btn.classList.toggle('btn-primary', active);
      btn.classList.toggle('btn-secondary', !active);
    });
    const panelPayment = document.getElementById('nc-subview-payment');
    const panelHistory = document.getElementById('nc-subview-history');
    if (panelPayment) panelPayment.style.display = (subview === 'payment') ? 'block' : 'none';
    if (panelHistory) panelHistory.style.display = (subview === 'history') ? 'block' : 'none';
    if (subview === 'history') this.renderNcHistory();
    if (window.lucide) window.lucide.createIcons();
  },

  renderNcHistory() {
    const data = window.db.get();
    const notes = data.creditNotes || [];
    const search = (document.getElementById('cash-nc-search-input')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('cash-nc-status-filter')?.value || 'TODOS';
    const tbody = document.getElementById('cash-nc-history-table-body');
    const badge = document.getElementById('cash-nc-badge');
    if (badge) badge.textContent = notes.length;
    if (!tbody) return;

    let filtered = notes.filter(nc => {
      const matchStatus = statusFilter === 'TODOS' || nc.status === statusFilter;
      const matchSearch = String(nc.ncNumber).includes(search) ||
                          (nc.providerName && nc.providerName.toLowerCase().includes(search)) ||
                          (nc.concept && nc.concept.toLowerCase().includes(search)) ||
                          (nc.originDebitNoteNumber && String(nc.originDebitNoteNumber).includes(search));
      return matchStatus && matchSearch;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: var(--text-muted);">No se encontraron Notas de Crédito registradas.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(nc => {
      const statusBadge = nc.status === 'PAGADA' ? 'badge-emerald' :
                          nc.status === 'PARCIAL' ? 'badge-blue' :
                          nc.status === 'IMPAGA' ? 'badge-amber' : 'badge-rose';

      const originBadge = nc.isAutoGenerated ?
        `<span class="badge badge-indigo" title="Generada automáticamente al cerrar ND #${nc.originDebitNoteNumber}">Auto ND #${nc.originDebitNoteNumber}</span>` :
        `<span class="badge badge-slate">Manual</span>`;

      const canPay = nc.status !== 'PAGADA' && nc.status !== 'ANULADA';

      return `
        <tr>
          <td class="font-mono" style="font-weight: 700; color: var(--navy);">NC #${nc.ncNumber}</td>
          <td class="font-mono">${nc.issueDate || '-'}</td>
          <td>
            <div style="font-weight: 600;">${nc.providerName}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${nc.concept || 'Servicio'}</div>
          </td>
          <td>${originBadge}</td>
          <td class="font-mono" style="text-align: right; font-weight: 700;">
            ${nc.currency || 'BOB'} ${Number(nc.totalAmount || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
          </td>
          <td class="font-mono" style="text-align: right; color: #15803d; font-weight: 600;">
            ${nc.currency || 'BOB'} ${Number(nc.paidAmount || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
          </td>
          <td class="font-mono" style="text-align: right; color: #b91c1c; font-weight: 700;">
            ${nc.currency || 'BOB'} ${Number(nc.balance || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
          </td>
          <td><span class="badge ${statusBadge}">${nc.status}</span></td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
              ${canPay ? `
                <button class="btn btn-primary btn-xs" onclick="window.cashRegisterModule.quickPayNc('${nc.id}', '${nc.providerId}')" title="Liquidar / Pagar NC">
                  <i data-lucide="check"></i> Liquidar
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-xs" onclick="window.reportsModule.openCorrectionModal('NC', '${nc.id}')" title="Corrección Contable">
                <i data-lucide="edit-3"></i>
              </button>
              ${nc.status !== 'ANULADA' ? `
                <button class="btn btn-danger btn-xs" onclick="window.reportsModule.openVoidModal('NC', '${nc.id}')" title="Anular NC">
                  <i data-lucide="x-circle"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  quickPayNc(ncId, providerId) {
    this.switchNcSubView('payment');
    const select = document.getElementById('cash-prov-select');
    if (select) {
      select.value = providerId;
      this.loadProviderPendingNcs(providerId);
      setTimeout(() => {
        const check = document.querySelector(`.nc-pay-check[value="${ncId}"]`);
        if (check) check.checked = true;
      }, 100);
    }
  },

  loadProviderPendingNcs(providerId) {
    const tbody = document.getElementById('provider-pending-ncs-table-body');
    if (!tbody) return;

    if (!providerId) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--text-muted);">Selecciona un proveedor para ver sus Notas de Crédito por pagar.</td></tr>`;
      return;
    }

    const data = window.db.get();
    const pendingNcs = data.creditNotes.filter(n => n.providerId === providerId && n.balance > 0);

    if (pendingNcs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: #15803d; font-weight: 600;">No hay Notas de Crédito pendientes de liquidación con este proveedor.</td></tr>`;
      return;
    }

    tbody.innerHTML = pendingNcs.map(nc => `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" class="nc-pay-check" value="${nc.id}" checked style="width: 16px; height: 16px; cursor: pointer;">
        </td>
        <td class="font-mono" style="font-weight: 700; color: var(--navy);">NC #${nc.ncNumber}</td>
        <td class="font-mono">${nc.issueDate}</td>
        <td>${nc.concept}</td>
        <td class="font-mono" style="text-align: right;">${nc.currency} ${Number(nc.totalAmount).toFixed(2)}</td>
        <td class="font-mono" style="text-align: right; color: #b91c1c; font-weight: 700;">
          ${nc.currency} ${Number(nc.balance).toFixed(2)}
        </td>
        <td>
          <input type="number" step="0.01" max="${nc.balance}" class="form-control nc-pay-amount" data-nc-id="${nc.id}" value="${nc.balance}" style="width: 130px; text-align: right; font-weight: 700;">
        </td>
      </tr>
    `).join('');
  },

  processProviderPayment() {
    const data = window.db.get();
    const provId = document.getElementById('cash-prov-select').value;
    const provider = data.accounts.find(a => a.id === provId);
    if (!provider) {
      window.app.showToast('Selecciona un proveedor', 'warning');
      return;
    }

    const checks = document.querySelectorAll('.nc-pay-check:checked');
    if (checks.length === 0) {
      window.app.showToast('Selecciona al menos una NC para pagar', 'warning');
      return;
    }

    const accId = document.getElementById('prov-payment-method-select').value;
    const account = window.financialGuard ? window.financialGuard.getAccountById(accId) : null;
    const val = window.financialGuard ? window.financialGuard.validateAccount(account) : { valid: !!account, summary: '' };

    if (!account || !val.valid) {
      window.app.showToast('Bloqueo Financiero: Cuenta de origen inválida o inactiva (' + val.summary + ')', 'error');
      return;
    }

    const ref = document.getElementById('prov-pay-ref').value.trim();
    const rates = window.financialGuard ? window.financialGuard.getExchangeRates() : { sellRate: 6.96 };
    const sellRate = rates.sellRate || 6.96;

    let totalPaid = 0;
    const details = [];

    for (let cb of checks) {
      const ncId = cb.value;
      const nc = data.creditNotes.find(c => c.id === ncId);
      const amountInput = document.querySelector(`.nc-pay-amount[data-nc-id="${ncId}"]`);
      const amount = parseFloat(amountInput?.value) || 0;

      if (amount <= 0) continue;
      if (amount > ((nc.balance || 0) + 0.01)) {
        window.app.showToast(`El monto a pagar en NC #${nc.ncNumber} excede su saldo`, 'warning');
        return;
      }

      const prevBal = Number(nc.balance || 0);
      nc.paidAmount = parseFloat(((nc.paidAmount || 0) + amount).toFixed(2));
      nc.balance = parseFloat(Math.max(0, prevBal - amount).toFixed(2));

      // Actualización Dinámica del Estado: Si saldo <= 0.01 -> PAGADA / LIQUIDADA
      if (nc.balance <= 0.01) {
        nc.status = 'PAGADA';
        nc.balance = 0;
      } else {
        nc.status = 'PARCIAL';
      }

      totalPaid += amount;
      details.push({
        creditNoteId: nc.id,
        ncNumber: nc.ncNumber,
        amountPaid: amount,
        previousBalance: prevBal,
        remainingBalance: nc.balance
      });
    }

    if (totalPaid <= 0) {
      window.app.showToast('Ingresa un monto mayor a cero para liquidar', 'warning');
      return;
    }

    const nextRec = (data.providerPayments && data.providerPayments.length > 0) ? Math.max(...data.providerPayments.map(p => p.receiptNumber || 0)) + 1 : 8001;
    const receiptCode = 'OP-' + String(nextRec).padStart(5, '0');

    const receipt = {
      id: 'PPR-' + Date.now(),
      receiptNumber: nextRec,
      receiptCode: receiptCode,
      providerId: provider.id,
      providerName: provider.name,
      paymentDate: new Date().toLocaleString(),
      totalPaid: parseFloat(totalPaid.toFixed(2)),
      currency: account.currency || 'BOB',
      financialAccountId: account.id,
      accountType: account.type || 'BANCO',
      financialAccountName: account.type === 'BANCO' ? `${account.bankName} - Cta. ${account.accountNumber}` : (account.type === 'BINANCE' ? `Binance Pay (${account.binanceId})` : account.name),
      titularName: account.titularName || account.custodianName || '-',
      exchangeRateUsed: sellRate,
      frozenExchangeRate: sellRate,
      reference: ref || '-',
      status: 'VALIDO',
      reversalReason: null,
      details: details,
      createdById: data.currentUser ? data.currentUser.id : 'usr-1',
      createdByName: data.currentUser ? data.currentUser.name : 'Administrador'
    };

    if (!data.providerPayments) data.providerPayments = [];
    data.providerPayments.unshift(receipt);
    window.db.save(data);

    window.app.showToast(`Comprobante de Pago a Proveedor ${receiptCode} emitido exitosamente`, 'success');
    this.loadProviderPendingNcs(provId);
    if (window.creditNotesModule) window.creditNotesModule.render();
  },

  // ==========================================
  // SUB-MÓDULO: HISTORIAL DE RECIBOS Y REVERSIÓN
  // ==========================================

  renderReceiptsHistory() {
    const data = window.db.get();
    const receipts = data.cashReceipts || [];
    const tbody = document.getElementById('receipts-history-table-body');
    if (!tbody) return;

    if (receipts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px; color: var(--text-muted);">Sin recibos de cobranza emitidos.</td></tr>`;
      return;
    }

    tbody.innerHTML = receipts.map(r => {
      const isValid = r.status === 'VALIDO';
      const badge = isValid ? 'badge-emerald' : 'badge-rose';

      const displayDate = r.receiptDate || r.date || (r.createdAt ? r.createdAt.split(',')[0] : '-');
      const displayUser = r.createdByName || r.cajero || 'Luis (Admin)';

      return `
        <tr>
          <td class="font-mono" style="font-weight: 700; color: var(--navy);">REC #${r.receiptNumber}</td>
          <td class="font-mono">${displayDate}</td>
          <td>
            <strong>${r.accountName}</strong>
            <div style="font-size: 0.72rem; color: var(--text-muted);">Sol: ${r.solicitante || '-'}</div>
          </td>
          <td class="font-mono" style="text-align: right; font-weight: 700; color: #15803d;">
            BOB ${Number(r.totalPaidBob).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
          </td>
          <td class="font-mono" style="text-align: right; color: #0369a1;">
            USD ${Number(r.totalPaidUsd).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
          </td>
          <td><span class="badge ${badge}">${r.status}</span></td>
          <td style="font-size: 0.75rem;">${displayUser}</td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="window.cashRegisterModule.printReceipt('${r.id}')" title="Reimprimir Recibo">
                <i data-lucide="printer"></i>
              </button>
              ${isValid ? `
                <button class="btn btn-danger btn-sm" onclick="window.cashRegisterModule.openReversalModal('${r.id}')" title="Revertir Pago con Auditoría">
                  <i data-lucide="rotate-ccw"></i> Revertir
                </button>
              ` : `
                <span style="font-size: 0.72rem; color: #b91c1c;" title="${r.reversalReason || 'Revertido'}">
                  Rev: ${(r.reversalReason || '').substring(0, 15)}...
                </span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  openReversalModal(receiptId) {
    const data = window.db.get();
    const r = data.cashReceipts.find(x => x.id === receiptId);
    if (!r) return;

    document.getElementById('rev-receipt-id').value = r.id;
    document.getElementById('rev-receipt-info').textContent = `Recibo de Caja #${r.receiptNumber} - ${r.accountName} (BOB ${r.totalPaidBob.toFixed(2)})`;
    document.getElementById('rev-reason').value = '';

    window.app.openModal('modal-reversal');
  },

  handleConfirmReversal(e) {
    e.preventDefault();
    const receiptId = document.getElementById('rev-receipt-id').value;
    const reason = document.getElementById('rev-reason').value.trim();

    if (!reason || reason.length < 5) {
      window.app.showToast('Debes ingresar un motivo de reversión justificado (mínimo 5 caracteres)', 'warning');
      return;
    }

    const data = window.db.get();
    const receipt = data.cashReceipts.find(r => r.id === receiptId);
    if (!receipt || receipt.status !== 'VALIDO') return;

    // Restaurar saldos de las NDs amortizadas en el recibo
    receipt.details.forEach(item => {
      const nd = data.debitNotes.find(n => n.id === item.debitNoteId);
      if (nd) {
        nd.paidAmountBob = Math.max(0, nd.paidAmountBob - item.amountPaidBob);
        nd.paidAmountUsd = Math.max(0, nd.paidAmountUsd - item.amountPaidUsd);
        nd.balanceBob = item.previousBalanceBob;
        nd.balanceUsd = item.previousBalanceUsd;

        if (nd.balanceBob >= nd.totalAmountBob - 0.01) {
          nd.status = 'IMPAGA';
        } else {
          nd.status = 'PARCIAL';
        }
      }
    });

    // Marcar recibo como revertido
    receipt.status = 'REVERTIDO';
    receipt.reversalReason = reason;
    receipt.reversedAt = new Date().toLocaleString();
    receipt.reversedBy = data.currentUser.name;

    window.db.save(data);
    window.app.closeModal('modal-reversal');
    window.app.showToast(`Recibo #${receipt.receiptNumber} REVERTIDO. Los saldos de las NDs fueron restaurados.`, 'info');

    this.renderReceiptsHistory();
    if (window.debitNotesModule) window.debitNotesModule.render();
  },

  /**
   * Impresión del Recibo Oficial de Caja con Logotipo y Membrete MARETRAVEL
   */
  printReceipt(receiptId) {
    const data = window.db.get();
    const r = data.cashReceipts.find(x => x.id === receiptId);
    if (!r) return;

    const settings = data.systemSettings;
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    printArea.innerHTML = `
      <div class="print-page short-format" style="max-width: 170mm;">
        <!-- Membrete Oficial MARETRAVEL -->
        <div class="print-header">
          <img src="assets/logo.jpg" class="print-logo" alt="MARETRAVEL Logo">
          <div class="print-agency-info">
            <div class="print-agency-title">${settings.agencyCommercialName}</div>
            <div>NIT: ${settings.agencyNit}</div>
            <div>${settings.agencyAddress}</div>
            <div>Telf: ${settings.agencyPhone}</div>
          </div>
        </div>

        <div class="print-doc-title">
          <h2>RECIBO OFICIAL DE CAJA</h2>
          <div class="print-doc-number">${r.receiptCode || ('RCP-' + String(r.receiptNumber).padStart(5, '0'))}</div>
          ${r.status === 'REVERTIDO' ? '<div style="color:red; font-weight:800; font-size:12pt; margin-top:4px;">*** ANULADO / REVERTIDO ***</div>' : ''}
        </div>

        <!-- Datos del Cliente y Cobranza -->
        <div class="print-meta-grid">
          <div><strong>Recibimos de:</strong> ${r.accountName}</div>
          <div><strong>Fecha / Hora:</strong> ${r.receiptDate}</div>
          <div><strong>Solicitante:</strong> ${r.solicitante || 'General'}</div>
          <div><strong>Cajero:</strong> ${r.createdByName}</div>
          <div><strong>T/C Aplicado:</strong> 1 USD = ${r.exchangeRateUsed} BOB</div>
          <div><strong>Estado:</strong> ${r.status} ${r.paymentType === 'PARCIAL' ? '<span style="color:#0284c7;font-weight:700;">(PAGO PARCIAL)</span>' : '<span style="color:#15803d;font-weight:700;">(CANCELACIÓN TOTAL)</span>'}</div>
        </div>

        <!-- Detalle de Notas de Débito Amortizadas -->
        <div style="font-size: 8.5pt; font-weight: 700; margin-bottom: 4px; text-transform: uppercase; color: #0f2742;">
          Notas de Débito Amortizadas:
        </div>
        <table class="print-table">
          <thead>
            <tr>
              <th>Documento</th>
              <th style="text-align: right;">Saldo Ant. (BOB)</th>
              <th style="text-align: right;">Monto Cobrado (BOB)</th>
              <th style="text-align: right;">Saldo Rest. (BOB)</th>
            </tr>
          </thead>
          <tbody>
            ${r.details.map(d => `
              <tr>
                <td class="font-mono"><strong>ND #${d.ndNumber}</strong></td>
                <td class="font-mono" style="text-align: right;">${Number(d.previousBalanceBob).toFixed(2)}</td>
                <td class="font-mono" style="text-align: right; font-weight: 700; color: #0369a1;">${Number(d.amountPaidBob).toFixed(2)}</td>
                <td class="font-mono" style="text-align: right; color: #b91c1c;">${Number(d.remainingBalanceBob).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Formas de Pago Aplicadas -->
        <div style="font-size: 8.5pt; font-weight: 700; margin-bottom: 4px; text-transform: uppercase; color: #0f2742;">
          Desglose de Formas de Pago (Cuentas Financieras):
        </div>
        <table class="print-table">
          <thead>
            <tr>
              <th>Cuenta Financiera / Destino</th>
              <th>Titular / Custodio</th>
              <th>Referencia</th>
              <th style="text-align: right;">Importe Pagado</th>
            </tr>
          </thead>
          <tbody>
            ${r.payments.map(p => `
              <tr>
                <td><strong>${p.paymentMethodName || p.financialAccountName || 'Cuenta'}</strong></td>
                <td>${p.titularName || '-'}</td>
                <td class="font-mono">${p.reference || '-'}</td>
                <td class="font-mono" style="text-align: right; font-weight: 700;">
                  ${p.currency} ${Number(p.amount).toFixed(2)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Totales -->
        <table class="print-totals" style="width: 100%; margin-top: 8px;">
          <tr class="total-row">
            <td style="font-size: 11pt;">TOTAL RECAUDADO (BOB):</td>
            <td class="font-mono" style="text-align: right; font-size: 12pt; font-weight: 800;">
              BOB ${Number(r.totalPaidBob).toFixed(2)}
            </td>
          </tr>
          <tr>
            <td style="font-size: 9.5pt; color: #475569;">Equivalente en Dólares (USD):</td>
            <td class="font-mono" style="text-align: right; font-size: 10pt; font-weight: 700; color: #0369a1;">
              USD ${Number(r.totalPaidUsd).toFixed(2)}
            </td>
          </tr>
          ${r.remainingBalanceBob !== undefined && r.remainingBalanceBob > 0 ? `
          <tr style="border-top: 1px dashed #cbd5e1;">
            <td style="font-size: 9.5pt; color: #b91c1c; font-weight: 700;">Saldo Pendiente Restante (BOB):</td>
            <td class="font-mono" style="text-align: right; font-size: 10.5pt; font-weight: 800; color: #b91c1c;">
              BOB ${Number(r.remainingBalanceBob).toFixed(2)}
            </td>
          </tr>
          ` : ''}
        </table>

        ${r.reversalReason ? `
          <div style="border: 1px dashed red; padding: 6px; font-size: 8pt; color: red; margin-top: 8px;">
            <strong>Motivo de Reversión:</strong> ${r.reversalReason} (Revertido por ${r.reversedBy} el ${r.reversedAt})
          </div>
        ` : ''}

        <div class="print-signatures" style="margin-top: 25px;">
          <div class="signature-box">
            <strong>CAJERO RESPONSABLE</strong><br>
            ${r.createdByName}<br>
            MARETRAVEL
          </div>
          <div class="signature-box">
            <strong>CLIENTE / PAGADOR</strong><br>
            ${r.accountName}<br>
            Firma y Aclaración
          </div>
        </div>
      </div>
    `;

    window.print();
  },

  // ==========================================
  // SUB-MÓDULO: ARQUEO DIARIO DE CAJA (CONSERVADO Y UNIFICADO)
  // ==========================================
  setupArqueoTab() {
    const fromInput = document.getElementById('cash-arqueo-date-from');
    const toInput = document.getElementById('cash-arqueo-date-to');
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    if (fromInput && !fromInput.value) fromInput.value = firstDay;
    if (toInput && !toInput.value) toInput.value = today;
    this.renderArqueo();
  },

  renderArqueo() {
    const data = window.db.get();
    const fromDate = document.getElementById('cash-arqueo-date-from')?.value;
    const toDate = document.getElementById('cash-arqueo-date-to')?.value;

    const receipts = (data.cashReceipts || []).filter(r => r.status === 'VALIDO');
    const summaryByMethod = {};
    let grandTotalBob = 0;
    let grandTotalUsd = 0;

    receipts.forEach(r => {
      const recDate = (r.receiptDate || r.date || '').split(' ')[0];
      if (fromDate && recDate < fromDate) return;
      if (toDate && recDate > toDate) return;

      const payments = (r.payments && r.payments.length > 0) ? r.payments : [{
        paymentMethodName: r.paymentMethod || 'Efectivo',
        currency: 'BOB',
        amount: r.totalPaidBob || 0
      }];

      payments.forEach(p => {
        const curr = p.currency || 'BOB';
        const name = p.paymentMethodName || p.paymentMethodCode || 'Efectivo';
        const key = `${name} (${curr})`;
        if (!summaryByMethod[key]) {
          summaryByMethod[key] = {
            name: name,
            currency: curr,
            total: 0,
            count: 0
          };
        }
        summaryByMethod[key].total += Number(p.amount || 0);
        summaryByMethod[key].count += 1;

        if (curr === 'BOB') grandTotalBob += Number(p.amount || 0);
        else grandTotalUsd += Number(p.amount || 0);
      });
    });

    const summaryTbody = document.getElementById('cash-arqueo-summary-tbody');
    if (summaryTbody) {
      const entries = Object.values(summaryByMethod);
      if (entries.length === 0) {
        summaryTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 16px; color: var(--text-muted);">Sin recaudaciones en el período seleccionado.</td></tr>`;
      } else {
        summaryTbody.innerHTML = entries.map(item => `
          <tr>
            <td><strong>${item.name}</strong></td>
            <td><span class="badge ${item.currency === 'BOB' ? 'badge-blue' : 'badge-emerald'}">${item.currency}</span></td>
            <td style="text-align: center;">${item.count} trans.</td>
            <td class="font-mono" style="text-align: right; font-weight: 700; color: #0f2742;">
              ${item.currency} ${Number(item.total).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        `).join('') + `
          <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1;">
            <td colspan="3">TOTAL RECAUDADO EN BOLIVIANOS (BOB):</td>
            <td class="font-mono" style="text-align: right; color: #15803d; font-size: 1rem;">
              BOB ${grandTotalBob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
            </td>
          </tr>
          <tr style="background: #f8fafc; font-weight: 800;">
            <td colspan="3">TOTAL RECAUDADO EN DÓLARES (USD):</td>
            <td class="font-mono" style="text-align: right; color: #0369a1; font-size: 1rem;">
              USD ${grandTotalUsd.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        `;
      }
    }

    const detailTbody = document.getElementById('cash-arqueo-details-tbody');
    if (detailTbody) {
      const movements = [];
      receipts.forEach(r => {
        const recDate = (r.receiptDate || r.date || '').split(' ')[0];
        if (fromDate && recDate < fromDate) return;
        if (toDate && recDate > toDate) return;

        const details = (r.details && r.details.length > 0) ? r.details : [{
          ndNumber: r.debitNoteNumber || '-',
          amountPaidBob: r.totalPaidBob || 0,
          remainingBalanceBob: 0
        }];

        const pmNames = (r.payments && r.payments.length > 0)
          ? r.payments.map(p => p.paymentMethodName || p.paymentMethodCode).join(' + ')
          : (r.paymentMethod || 'Efectivo');

        details.forEach(d => {
          const isTotal = Number(d.remainingBalanceBob || 0) <= 0.05;
          movements.push({
            receiptNumber: r.receiptNumber,
            ndNumber: d.ndNumber || '-',
            date: r.receiptDate || r.date || '-',
            client: r.accountName || '-',
            solicitante: r.solicitante || '-',
            amountPaidBob: d.amountPaidBob || r.totalPaidBob || 0,
            remainingBalanceBob: d.remainingBalanceBob || 0,
            paymentMethod: pmNames,
            type: isTotal ? 'TOTAL' : 'PARCIAL'
          });
        });
      });

      if (movements.length === 0) {
        detailTbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px; color: var(--text-muted);">Sin movimientos registrados en este rango de fechas.</td></tr>`;
      } else {
        detailTbody.innerHTML = movements.map(m => `
          <tr>
            <td class="font-mono" style="font-weight: 700; color: var(--navy);">REC #${m.receiptNumber}</td>
            <td class="font-mono" style="color: #0369a1; font-weight: 600;">ND #${m.ndNumber}</td>
            <td class="font-mono" style="font-size: 0.75rem;">${m.date}</td>
            <td>
              <strong>${m.client}</strong>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${m.solicitante || '-'}</div>
            </td>
            <td class="font-mono" style="text-align: right; font-weight: 700; color: #15803d;">
              BOB ${Number(m.amountPaidBob).toFixed(2)}
            </td>
            <td class="font-mono" style="text-align: right; color: #b91c1c;">
              BOB ${Number(m.remainingBalanceBob).toFixed(2)}
            </td>
            <td style="font-size: 0.75rem;">${m.paymentMethod}</td>
            <td><span class="badge ${m.type === 'TOTAL' ? 'badge-emerald' : 'badge-amber'}">${m.type}</span></td>
          </tr>
        `).join('');
      }
    }

    if (window.lucide) window.lucide.createIcons();
  },

  exportArqueoCsv() {
    const data = window.db.get();
    const fromDate = document.getElementById('cash-arqueo-date-from')?.value || 'Inicio';
    const toDate = document.getElementById('cash-arqueo-date-to')?.value || 'Hoy';

    let csvContent = '\uFEFF';
    csvContent += 'NRO_RECIBO;FECHA_HORA;CLIENTE;SOLICITANTE;MONEDA;TOTAL_PAGADO_BOB;TOTAL_PAGADO_USD;ESTADO;CAJERO\n';

    (data.cashReceipts || []).forEach(r => {
      if (r.status !== 'VALIDO') return;
      const recDate = (r.receiptDate || r.date || '').split(' ')[0];
      if (fromDate && recDate < fromDate) return;
      if (toDate && recDate > toDate) return;

      csvContent += `${r.receiptNumber};${r.receiptDate || r.date};"${(r.accountName || '').replace(/"/g, '""')}";"${(r.solicitante || '').replace(/"/g, '""')}";BOB;${Number(r.totalPaidBob || 0).toFixed(2)};${Number(r.totalPaidUsd || 0).toFixed(2)};${r.status};"${r.createdByName || ''}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MARETRAVEL_ARQUEO_CAJA_${fromDate}_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    window.app.showToast('Archivo Excel (.CSV) del Arqueo descargado con éxito', 'success');
  },

  printArqueo() {
    const data = window.db.get();
    const fromDate = document.getElementById('cash-arqueo-date-from')?.value || 'Inicio';
    const toDate = document.getElementById('cash-arqueo-date-to')?.value || 'Hoy';
    const settings = data.systemSettings;

    const receipts = (data.cashReceipts || []).filter(r => {
      if (r.status !== 'VALIDO') return false;
      const recDate = (r.receiptDate || r.date || '').split(' ')[0];
      if (fromDate && recDate < fromDate) return false;
      if (toDate && recDate > toDate) return false;
      return true;
    });

    let totalBob = 0;
    let totalUsd = 0;
    receipts.forEach(r => {
      const payments = (r.payments && r.payments.length > 0) ? r.payments : [{ currency: 'BOB', amount: r.totalPaidBob || 0 }];
      payments.forEach(p => {
        if (p.currency === 'BOB') totalBob += Number(p.amount || 0);
        else totalUsd += Number(p.amount || 0);
      });
    });

    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    printArea.innerHTML = `
      <div class="print-page" style="padding: 20px; font-family: sans-serif;">
        <div class="print-header" style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f2742; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <h2 style="margin: 0; color: #0f2742;">${settings.agencyCommercialName || settings.agencyName}</h2>
            <div>NIT: ${settings.agencyNit} | Telf: ${settings.agencyPhone}</div>
            <div>${settings.agencyAddress}</div>
          </div>
          <div style="text-align: right;">
            <h3 style="margin: 0; color: #00aeef;">ARQUEO DIARIO DE CAJA</h3>
            <div style="font-size: 0.9rem; font-weight: 600;">Período: ${fromDate} al ${toDate}</div>
            <div style="font-size: 0.8rem; color: #64748b;">Emisión: ${new Date().toLocaleString()}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <div style="background: #f1f5f9; padding: 12px; border-radius: 6px;">
            <div style="font-size: 0.8rem; color: #475569;">TOTAL RECAUDADO EN BOLIVIANOS:</div>
            <div style="font-size: 1.3rem; font-weight: 800; color: #15803d;">BOB ${totalBob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</div>
          </div>
          <div style="background: #f1f5f9; padding: 12px; border-radius: 6px;">
            <div style="font-size: 0.8rem; color: #475569;">TOTAL RECAUDADO EN DÓLARES:</div>
            <div style="font-size: 1.3rem; font-weight: 800; color: #0369a1;">USD ${totalUsd.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 10px;">
          <thead>
            <tr style="background: #0f2742; color: #fff;">
              <th style="padding: 6px; text-align: left;">Recibo</th>
              <th style="padding: 6px; text-align: left;">Fecha</th>
              <th style="padding: 6px; text-align: left;">Cliente</th>
              <th style="padding: 6px; text-align: right;">Total BOB</th>
              <th style="padding: 6px; text-align: right;">Total USD</th>
              <th style="padding: 6px; text-align: left;">Cajero</th>
            </tr>
          </thead>
          <tbody>
            ${receipts.length === 0 ? '<tr><td colspan="6" style="padding: 12px; text-align: center;">Sin movimientos.</td></tr>' :
              receipts.map(r => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px;">REC #${r.receiptNumber}</td>
                  <td style="padding: 6px;">${r.receiptDate || r.date}</td>
                  <td style="padding: 6px;">${r.accountName}</td>
                  <td style="padding: 6px; text-align: right; font-weight: 700;">BOB ${Number(r.totalPaidBob || 0).toFixed(2)}</td>
                  <td style="padding: 6px; text-align: right;">USD ${Number(r.totalPaidUsd || 0).toFixed(2)}</td>
                  <td style="padding: 6px;">${r.createdByName || 'Caja'}</td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-around; margin-top: 60px; text-align: center;">
          <div style="border-top: 1px solid #000; width: 200px; padding-top: 4px;">Firma Cajero Responsable</div>
          <div style="border-top: 1px solid #000; width: 200px; padding-top: 4px;">Firma Administración / Control</div>
        </div>
      </div>
    `;

    window.print();
  }
};
