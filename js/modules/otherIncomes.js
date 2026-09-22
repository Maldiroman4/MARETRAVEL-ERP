/**
 * MARETRAVEL ERP - Módulo: Otros Ingresos Operativos
 * Gestiona comisiones de plataforma de boletos aéreos y otros ingresos operativos.
 * Inician en estado "IMPAGA" y pueden editarse o marcarse como "PAGADO".
 * Permite generar Notas de Débito oficiales agrupando únicamente comisiones PAGADAS.
 */

window.otherIncomesModule = {
  currentStatusFilter: 'TODOS',
  currentOperatorFilter: 'TODOS',
  searchTerm: '',
  editingIncomeId: null,
  previewNdItems: [],

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    const searchInput = document.getElementById('inc-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase().trim();
        this.renderTable();
      });
    }

    const statusFilter = document.getElementById('inc-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentStatusFilter = e.target.value;
        this.renderTable();
      });
    }

    const operatorFilter = document.getElementById('inc-operator-filter');
    if (operatorFilter) {
      operatorFilter.addEventListener('change', (e) => {
        this.currentOperatorFilter = e.target.value;
        this.renderTable();
      });
    }

    const btnNew = document.getElementById('btn-new-other-income');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.openNewManualModal());
    }

    const btnOpenGenNd = document.getElementById('btn-open-generate-nd-modal');
    if (btnOpenGenNd) {
      btnOpenGenNd.addEventListener('click', () => this.openGenerateNdModal());
    }

    const form = document.getElementById('other-income-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSave(e));
    }

    const btnExport = document.getElementById('btn-export-other-income-csv');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportCsv());
    }
  },

  render() {
    this.populateOperatorFilter();
    this.updateKpis();
    this.renderTable();
  },

  populateOperatorFilter() {
    const select = document.getElementById('inc-operator-filter');
    if (!select) return;

    const data = window.db.get();
    const providers = (data.accounts || []).filter(a => a.relationType === 'PROVEEDOR' || a.relationType === 'AMBOS');
    
    const currentVal = select.value || 'TODOS';
    select.innerHTML = `
      <option value="TODOS">Todos los Operadores / Plataformas</option>
      ${providers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
    `;
    select.value = currentVal;
  },

  updateKpis() {
    const data = window.db.get();
    const list = data.otherIncomes || [];
    const sellRate = data.systemSettings?.activeExchangeSell || 6.96;

    let totalAllBob = 0;
    let totalImpagaBob = 0;
    let totalPagadoBob = 0;
    let countImpaga = 0;
    let countPagado = 0;

    list.forEach(item => {
      const amount = Number(item.amount) || 0;
      const amountBob = item.currency === 'USD' ? amount * sellRate : amount;

      totalAllBob += amountBob;
      if (item.status === 'PAGADO') {
        totalPagadoBob += amountBob;
        countPagado++;
      } else {
        totalImpagaBob += amountBob;
        countImpaga++;
      }
    });

    const elTotal = document.getElementById('inc-kpi-total');
    const elPagado = document.getElementById('inc-kpi-pagado');
    const elImpaga = document.getElementById('inc-kpi-impaga');
    const elCount = document.getElementById('inc-kpi-count');

    if (elTotal) elTotal.textContent = `BOB ${totalAllBob.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elPagado) elPagado.textContent = `BOB ${totalPagadoBob.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elImpaga) elImpaga.textContent = `BOB ${totalImpagaBob.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elCount) elCount.textContent = `${list.length} (${countImpaga} impagas / ${countPagado} pagadas)`;
  },

  renderTable() {
    const tbody = document.getElementById('other-income-table-body');
    if (!tbody) return;

    const data = window.db.get();
    const list = data.otherIncomes || [];

    let filtered = list.filter(item => {
      if (this.currentStatusFilter !== 'TODOS' && item.status !== this.currentStatusFilter) {
        return false;
      }
      if (this.currentOperatorFilter !== 'TODOS' && item.operatorId !== this.currentOperatorFilter) {
        return false;
      }
      if (this.searchTerm) {
        const text = `${item.ticketNumber || ''} ${item.operatorName || ''} ${item.passengerName || ''} ${item.route || ''} ${item.description || ''} ${item.issueDate || ''} ${item.paymentNotes || ''}`.toLowerCase();
        if (!text.includes(this.searchTerm)) {
          return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 28px; color: var(--text-muted);">
            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 6px;">No se encontraron ingresos operativos</div>
            <div style="font-size: 0.82rem;">Cada vez que registres o emitas un Boleto Aéreo, su comisión de plataforma aparecerá aquí automáticamente en estado IMPAGA.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(item => {
      const isPagado = item.status === 'PAGADO';
      const statusBadge = isPagado 
        ? `<span class="badge badge-emerald" style="display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="check-circle" style="width: 12px; height: 12px;"></i> PAGADO</span>` 
        : `<span class="badge badge-amber" style="display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="clock" style="width: 12px; height: 12px;"></i> IMPAGA</span>`;

      const ndBadge = item.assignedNdNumber 
        ? `<span class="badge badge-indigo" style="margin-left: 4px;" title="Incluido en Nota de Débito ND #${item.assignedNdNumber}">ND #${item.assignedNdNumber}</span>` 
        : '';

      return `
        <tr>
          <td class="font-mono" style="font-weight: 600;">${item.issueDate || '-'}</td>
          <td class="font-mono">
            <strong>${item.ticketNumber || 'S/N'}</strong>
            ${ndBadge}
            ${item.originType === 'COMISION_PLATAFORMA' ? '<div style="font-size: 0.72rem; color: #0284c7;">Boleto Aéreo</div>' : '<div style="font-size: 0.72rem; color: #64748b;">Manual</div>'}
          </td>
          <td>
            <div style="font-weight: 700; color: var(--navy);">${item.operatorName || 'Sin Operador'}</div>
          </td>
          <td>
            <div style="font-size: 0.85rem; color: #334155; line-height: 1.35;">${item.description || '-'}</div>
            ${item.paidAt ? `
              <div style="font-size: 0.75rem; color: #15803d; margin-top: 3px; font-weight: 600; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                <span style="display: inline-flex; align-items: center; gap: 3px;">
                  <i data-lucide="calendar-check" style="width: 12px; height: 12px;"></i> Cobrado el: ${item.paidAt}
                </span>
                ${item.depositAccountName ? `
                  <span class="badge badge-emerald" style="font-size: 0.72rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;">
                    <i data-lucide="landmark" style="width: 12px; height: 12px;"></i> ${item.depositAccountName} ${item.depositVoucherRef ? '(Ref: ' + item.depositVoucherRef + ')' : ''}
                  </span>
                ` : `
                  <button type="button" class="btn btn-sm" onclick="window.otherIncomesModule.openAssignAccountModal('${item.id}')" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-size: 0.7rem; font-weight: 700; padding: 1px 6px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;">
                    <i data-lucide="alert-triangle" style="width: 11px; height: 11px;"></i> + Asignar Cuenta Depósito
                  </button>
                `}
                ${item.paymentNotes ? `<span style="font-size: 0.72rem; color: #64748b;">(${item.paymentNotes})</span>` : ''}
              </div>
            ` : ''}
          </td>
          <td class="font-mono" style="text-align: right; font-weight: 800; font-size: 0.95rem; color: #0369a1;">
            ${item.currency} ${Number(item.amount || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td style="text-align: center;">
            ${statusBadge}
          </td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 4px; justify-content: center; align-items: center; flex-wrap: wrap;">
              <button class="btn btn-sm ${isPagado ? 'btn-secondary' : 'btn-success'}" 
                      onclick="window.otherIncomesModule.toggleStatus('${item.id}')" 
                      title="${isPagado ? 'Cambiar a IMPAGA' : 'Marcar como PAGADO y Asignar Cuenta'}"
                      style="padding: 4px 8px; font-size: 0.75rem; font-weight: 600;">
                <i data-lucide="${isPagado ? 'rotate-ccw' : 'check'}"></i> ${isPagado ? 'Impaga' : 'Pagado'}
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.otherIncomesModule.openEditModal('${item.id}')" title="Editar ingreso / cuenta de depósito" style="padding: 4px 8px;">
                <i data-lucide="edit-3"></i>
              </button>
              <button class="btn btn-primary btn-sm" onclick="window.otherIncomesModule.openAssignAccountModal('${item.id}')" title="Asignar / Cambiar Cuenta de Depósito" style="padding: 4px 8px; background: #0284c7; border-color: #0369a1;">
                <i data-lucide="landmark"></i>
              </button>
              <button class="btn btn-danger btn-sm" onclick="window.otherIncomesModule.deleteIncome('${item.id}')" title="Eliminar registro" style="padding: 4px 8px;">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  toggleStatus(id) {
    const data = window.db.get();
    data.otherIncomes = data.otherIncomes || [];
    const item = data.otherIncomes.find(i => i.id === id);
    if (!item) return;

    if (item.status === 'PAGADO') {
      item.status = 'IMPAGA';
      item.paidAt = null;
      item.depositAccountId = null;
      item.depositAccountName = null;
      item.depositVoucherRef = null;
      item.updatedAt = new Date().toLocaleString();
      window.db.save(data);
      window.app.showToast(`Comisión ${item.ticketNumber || item.id} marcada como IMPAGA`, 'info');
      this.updateKpis();
      this.renderTable();
    } else {
      // Al marcar como pagado, abrir directamente el modal para elegir la cuenta de depósito
      this.openAssignAccountModal(id);
    }
  },

  /* =========================================================================
     GENERACIÓN DE NOTA DE DÉBITO POR COMISIONES PAGADAS (SOLO PAGADAS)
     ========================================================================= */

  openGenerateNdModal() {
    const data = window.db.get();
    const providers = (data.accounts || []).filter(a => a.relationType === 'PROVEEDOR' || a.relationType === 'AMBOS');
    const selectOp = document.getElementById('gen-nd-operator-select');
    if (!selectOp) return;

    selectOp.innerHTML = providers.map(p => `<option value="${p.id}">${p.name} (${p.code})</option>`).join('');

    // Preseleccionar según filtro activo o el primero que tenga ingresos pagados
    if (this.currentOperatorFilter !== 'TODOS') {
      selectOp.value = this.currentOperatorFilter;
    } else {
      // Buscar el primer operador que tenga comisiones pagadas
      const opWithPaid = (data.otherIncomes || []).find(i => i.status === 'PAGADO')?.operatorId;
      if (opWithPaid) selectOp.value = opWithPaid;
    }

    // Configurar rango de fechas por defecto:
    const today = new Date().toISOString().split('T')[0];
    const firstDayMonth = today.substring(0, 8) + '01';

    const inputFrom = document.getElementById('gen-nd-date-from');
    const inputTo = document.getElementById('gen-nd-date-to');
    const inputIssue = document.getElementById('gen-nd-issue-date');

    if (inputFrom) inputFrom.value = firstDayMonth;
    if (inputTo) inputTo.value = today;
    if (inputIssue) inputIssue.value = today;

    const obsInput = document.getElementById('gen-nd-observations');
    if (obsInput) obsInput.value = '';

    const statusSelect = document.getElementById('gen-nd-status');
    if (statusSelect) statusSelect.value = 'PAGADA';

    this.populateDepositAccounts('gen-nd-deposit-account');

    this.recalcNdCommissionsPreview();
    if (window.lucide) window.lucide.createIcons();
    window.app.openModal('modal-generate-nd-commission');
  },

  recalcNdCommissionsPreview() {
    const data = window.db.get();
    const opId = document.getElementById('gen-nd-operator-select')?.value;
    const dateFrom = document.getElementById('gen-nd-date-from')?.value;
    const dateTo = document.getElementById('gen-nd-date-to')?.value;

    const tbody = document.getElementById('gen-nd-items-table-body');
    const countBadge = document.getElementById('gen-nd-item-count');
    if (!tbody) return;

    // REGLA CRÍTICA SOLICITADA POR EL USUARIO:
    // "QUE SOLO ESTEN LAS PAGADAS, OSEA EL TOTAL DE LAS PAGADAS, NO ENTRAN LAS POR COBRAR."
    const list = (data.otherIncomes || []).filter(item => {
      // 1. SOLO PAGADAS:
      if (item.status !== 'PAGADO') return false;

      // 2. Operador seleccionado:
      if (opId && item.operatorId !== opId) {
        // También verificar por nombre si no tenía operatorId
        const op = (data.accounts || []).find(a => a.id === opId);
        if (!op || op.name !== item.operatorName) return false;
      }

      // 3. Rango de Fechas (por issueDate o paidAt):
      const dateToCheck = item.issueDate || item.paidAt;
      if (dateFrom && dateToCheck && dateToCheck < dateFrom) return false;
      if (dateTo && dateToCheck && dateToCheck > dateTo) return false;

      return true;
    });

    this.previewNdItems = list;

    if (countBadge) {
      countBadge.textContent = `${list.length} comisiones pagadas`;
      countBadge.className = list.length > 0 ? 'badge badge-emerald' : 'badge badge-slate';
    }

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">
            No se encontraron comisiones <strong>PAGADAS</strong> para este operador en el rango de fechas seleccionado.<br>
            <span style="font-size: 0.78rem;">Recuerda que las comisiones deben estar marcadas como <strong>PAGADO</strong> para entrar en la Nota de Débito.</span>
          </td>
        </tr>
      `;
      this.updateModalTotalsFromCheckboxes();
      return;
    }

    tbody.innerHTML = list.map(item => `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" class="gen-nd-item-checkbox" value="${item.id}" data-amount="${item.amount}" data-currency="${item.currency}" checked onchange="window.otherIncomesModule.updateModalTotalsFromCheckboxes()" style="width: 16px; height: 16px; cursor: pointer;">
        </td>
        <td class="font-mono"><strong>${item.ticketNumber || 'S/N'}</strong></td>
        <td>
          <div style="font-weight: 600;">${item.passengerName || 'Sin Pasajero'}</div>
          <div style="font-size: 0.72rem; color: #64748b;">${item.route || '-'}</div>
        </td>
        <td class="font-mono">${item.issueDate || '-'}</td>
        <td class="font-mono" style="color: #15803d; font-weight: 600;">${item.paidAt || item.issueDate}</td>
        <td class="font-mono" style="text-align: right; font-weight: 800; color: #0369a1;">
          ${item.currency} ${Number(item.amount).toFixed(2)}
        </td>
      </tr>
    `).join('');

    this.updateModalTotalsFromCheckboxes();
  },

  toggleSelectAllNdItems(checked) {
    document.querySelectorAll('.gen-nd-item-checkbox').forEach(cb => {
      cb.checked = checked;
    });
    this.updateModalTotalsFromCheckboxes();
  },

  updateModalTotalsFromCheckboxes() {
    const checked = document.querySelectorAll('.gen-nd-item-checkbox:checked');
    let total = 0;
    let currency = 'BOB';

    checked.forEach(cb => {
      total += parseFloat(cb.getAttribute('data-amount')) || 0;
      currency = cb.getAttribute('data-currency') || 'BOB';
    });

    const display = document.getElementById('gen-nd-total-display');
    const subInfo = document.getElementById('gen-nd-subtotal-info');

    if (display) {
      display.textContent = `${currency} ${total.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (subInfo) {
      subInfo.textContent = `${checked.length} boletos seleccionados (${currency} ${total.toFixed(2)})`;
    }
  },

  confirmGenerateNd() {
    const checkboxes = document.querySelectorAll('.gen-nd-item-checkbox:checked');
    if (checkboxes.length === 0) {
      window.app.showToast('Debes seleccionar al menos una comisión pagada para generar la ND', 'warning');
      return;
    }

    const data = window.db.get();
    const opId = document.getElementById('gen-nd-operator-select').value;
    const operator = (data.accounts || []).find(a => a.id === opId);
    if (!operator) {
      window.app.showToast('Operador no encontrado', 'danger');
      return;
    }

    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    const selectedIncomes = (data.otherIncomes || []).filter(i => selectedIds.includes(i.id));

    const dateFrom = document.getElementById('gen-nd-date-from').value;
    const dateTo = document.getElementById('gen-nd-date-to').value;
    const issueDate = document.getElementById('gen-nd-issue-date').value || new Date().toISOString().split('T')[0];
    const paymentTerm = document.getElementById('gen-nd-payment-term').value;
    const ndStatus = document.getElementById('gen-nd-status').value;
    const manualObs = document.getElementById('gen-nd-observations').value.trim();

    const sellRate = data.systemSettings?.activeExchangeSell || 6.96;
    let totalBob = 0;
    let totalUsd = 0;
    let mainCurrency = 'BOB';

    const ticketNums = [];

    selectedIncomes.forEach(inc => {
      const amount = Number(inc.amount) || 0;
      if (inc.currency === 'USD') {
        totalUsd += amount;
        totalBob += (amount * sellRate);
      } else {
        totalBob += amount;
        totalUsd += (amount / sellRate);
      }
      mainCurrency = inc.currency || 'BOB';
      if (inc.ticketNumber) ticketNums.push(inc.ticketNumber);
    });

    totalBob = parseFloat(totalBob.toFixed(2));
    totalUsd = parseFloat(totalUsd.toFixed(2));

    const formatSlash = (d) => {
      if (!d) return '';
      const p = d.split('-');
      return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
    };
    const dateRangeStr = (dateFrom && dateTo)
      ? `DEL ${formatSlash(dateFrom)} AL ${formatSlash(dateTo)}`
      : (dateFrom ? `DESDE ${formatSlash(dateFrom)}` : (dateTo ? `HASTA ${formatSlash(dateTo)}` : 'PERIODO COMPLETO'));

    const nextNd = (data.debitNotes.length > 0) ? Math.max(...data.debitNotes.map(n => n.ndNumber)) + 1 : 1001;
    const isPagada = ndStatus === 'PAGADA';

    // Ítem consolidado de comisión para la Nota de Débito (requerimiento: solo Operador, Rango de Fechas y Total a Facturar)
    const consolidatedItem = {
      id: 'NDI-' + Date.now(),
      serviceType: 'COMISION_PLATAFORMA',
      isCommissionItem: true,
      operatorId: operator.id,
      operatorName: operator.name,
      description: `Liquidación de Comisiones de Plataforma (${dateRangeStr}) - ${operator.name}`,
      dateRange: dateRangeStr,
      dateFrom: dateFrom,
      dateTo: dateTo,
      currency: mainCurrency,
      fareAmount: 0,
      totalAmount: totalBob,
      feeAmount: 0,
      providerCommissionRate: 0,
      providerCommissionAmount: 0,
      clientCommissionRate: 0,
      clientCommissionAmount: 0,
      counterCommissionAmount: 0,
      netCostToProvider: 0,
      includedTicketsCount: selectedIncomes.length,
      includedIncomeIds: selectedIds
    };

    const newNd = {
      id: 'ND-' + Date.now(),
      ndNumber: nextNd,
      isCommissionNd: true,
      serviceType: 'COMISION_PLATAFORMA',
      operatorId: operator.id,
      operatorName: operator.name,
      dateFrom: dateFrom,
      dateTo: dateTo,
      dateRange: dateRangeStr,
      accountId: operator.id,
      accountName: operator.name,
      accountNit: operator.nit || '',
      requesterId: null,
      solicitante: 'Liquidación de Comisiones Plataforma',
      passengerName: '',
      issueDate: issueDate,
      paymentTerm: paymentTerm,
      currency: mainCurrency,
      totalAmountBob: totalBob,
      totalAmountUsd: totalUsd,
      paidAmountBob: isPagada ? totalBob : 0.00,
      paidAmountUsd: isPagada ? totalUsd : 0.00,
      balanceBob: isPagada ? 0.00 : totalBob,
      balanceUsd: isPagada ? 0.00 : totalUsd,
      status: ndStatus,
      closedAt: isPagada ? new Date().toLocaleString() : null,
      observations: manualObs || `Liquidación oficial de comisiones de plataforma - ${dateRangeStr}`,
      manualObservations: manualObs,
      createdById: data.currentUser?.id || 'USR-001',
      createdByName: data.currentUser?.name || 'Luis',
      items: [consolidatedItem],
      createdAt: new Date().toLocaleString()
    };

    const depositNdSelect = document.getElementById('gen-nd-deposit-account');
    if (isPagada && depositNdSelect && depositNdSelect.value) {
      newNd.depositAccountId = depositNdSelect.value;
      newNd.depositAccountName = (depositNdSelect.selectedIndex > 0)
        ? depositNdSelect.options[depositNdSelect.selectedIndex].getAttribute('data-name') || depositNdSelect.options[depositNdSelect.selectedIndex].text.trim()
        : '';
    }

    data.debitNotes = data.debitNotes || [];
    data.debitNotes.unshift(newNd);

    // Marcar los ingresos con el Nro de ND asignada y cuenta de depósito si aplica
    selectedIncomes.forEach(inc => {
      inc.assignedNdId = newNd.id;
      inc.assignedNdNumber = newNd.ndNumber;
      if (newNd.depositAccountId && !inc.depositAccountId) {
        inc.depositAccountId = newNd.depositAccountId;
        inc.depositAccountName = newNd.depositAccountName;
      }
      inc.updatedAt = new Date().toLocaleString();
    });

    window.db.save(data);
    window.app.closeModal('modal-generate-nd-commission');

    window.app.showToast(`Nota de Débito ND #${newNd.ndNumber} generada con éxito por ${mainCurrency} ${totalBob.toFixed(2)} a ${operator.name}`, 'success');

    this.render();
    if (window.debitNotesModule) window.debitNotesModule.render();
    if (window.cashRegisterModule) window.cashRegisterModule.render();
  },

  /* =========================================================================
     GESTIÓN DE CUENTAS DE DEPÓSITO Y MODAL DE EDICIÓN
     ========================================================================= */

  /**
   * Llena un selector desplegable con las cuentas bancarias oficiales y cajas registradas
   */
  populateDepositAccounts(selectId, selectedVal = '') {
    const select = typeof selectId === 'string' ? document.getElementById(selectId) : selectId;
    if (!select) return;

    const data = window.db.get();
    const bankAccounts = (data.bankAccounts || []).filter(b => b.isActive !== false);
    const payMethods = (data.paymentMethods || []).filter(m => m.status === 'ACTIVO');

    let html = `<option value="">-- Seleccionar Cuenta / Caja de Destino --</option>`;

    if (bankAccounts.length > 0) {
      html += `<optgroup label="🏦 Cuentas Bancarias Oficiales (Agencia)">`;
      bankAccounts.forEach(b => {
        const val = b.id;
        const isSel = selectedVal === val || selectedVal === b.accountNumber;
        const formattedName = `${b.bankName} - Cta. ${b.accountNumber} (${b.currency})`;
        html += `<option value="${val}" data-type="BANK" data-name="${formattedName}" ${isSel ? 'selected' : ''}>
          ${b.bankName} - Cta. ${b.accountNumber} (${b.currency} - ${b.accountType})
        </option>`;
      });
      html += `</optgroup>`;
    }

    if (payMethods.length > 0) {
      html += `<optgroup label="💵 Cajas y Métodos de Cobro">`;
      payMethods.forEach(m => {
        const val = m.id;
        const isSel = selectedVal === val || selectedVal === m.name;
        const extra = m.bankAccount && m.bankAccount !== '-' ? ` (${m.bankAccount})` : '';
        const formattedName = `${m.name}${extra}`;
        html += `<option value="${val}" data-type="PM" data-name="${formattedName}" ${isSel ? 'selected' : ''}>
          ${m.name}${extra}
        </option>`;
      });
      html += `</optgroup>`;
    }

    select.innerHTML = html;
  },

  /**
   * Abre directamente el modal para crear una nueva cuenta bancaria
   */
  quickNewBankAccount() {
    if (window.bankAccountsModule && typeof window.bankAccountsModule.openNewModal === 'function') {
      window.bankAccountsModule.openNewModal();
    } else {
      window.app.showToast('Módulo de cuentas bancarias no disponible', 'warning');
    }
  },

  /**
   * Modal Rápido: Asignar o Cambiar Cuenta de Depósito a una comisión
   */
  openAssignAccountModal(id) {
    this.assigningIncomeId = id;
    const data = window.db.get();
    const item = (data.otherIncomes || []).find(i => i.id === id);
    if (!item) return;

    const lblTicket = document.getElementById('assign-acc-ticket');
    const lblOperator = document.getElementById('assign-acc-operator');
    const lblAmount = document.getElementById('assign-acc-amount');

    if (lblTicket) lblTicket.textContent = item.ticketNumber || 'S/N';
    if (lblOperator) lblOperator.textContent = item.operatorName || 'General';
    if (lblAmount) lblAmount.textContent = `${item.currency || 'BOB'} ${Number(item.amount || 0).toFixed(2)}`;

    this.populateDepositAccounts('assign-acc-select', item.depositAccountId);

    const inputDate = document.getElementById('assign-acc-date');
    if (inputDate) inputDate.value = item.paidAt || new Date().toISOString().split('T')[0];

    const inputRef = document.getElementById('assign-acc-ref');
    if (inputRef) inputRef.value = item.depositVoucherRef || '';

    const inputNotes = document.getElementById('assign-acc-notes');
    if (inputNotes) inputNotes.value = item.paymentNotes || '';

    if (window.lucide) window.lucide.createIcons();
    window.app.openModal('modal-assign-deposit-account');
  },

  /**
   * Guarda los datos de depósito desde el modal rápido
   */
  handleSaveDepositAccount(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!this.assigningIncomeId) return;

    const data = window.db.get();
    data.otherIncomes = data.otherIncomes || [];
    const item = data.otherIncomes.find(i => i.id === this.assigningIncomeId);
    if (!item) return;

    const selectAcc = document.getElementById('assign-acc-select');
    const accId = selectAcc ? selectAcc.value : '';
    if (!accId) {
      window.app.showToast('Por favor selecciona la cuenta donde se depositó el dinero.', 'warning');
      return;
    }

    const accName = (selectAcc && selectAcc.selectedIndex > 0)
      ? selectAcc.options[selectAcc.selectedIndex].getAttribute('data-name') || selectAcc.options[selectAcc.selectedIndex].text.trim()
      : 'Cuenta Bancaria';

    const paidDate = document.getElementById('assign-acc-date')?.value || new Date().toISOString().split('T')[0];
    const depositRef = document.getElementById('assign-acc-ref')?.value.trim() || '';
    const notes = document.getElementById('assign-acc-notes')?.value.trim() || '';

    item.status = 'PAGADO';
    item.paidAt = paidDate;
    item.depositAccountId = accId;
    item.depositAccountName = accName;
    item.depositVoucherRef = depositRef;
    if (notes) item.paymentNotes = notes;
    item.updatedAt = new Date().toLocaleString();

    window.db.save(data);
    window.app.closeModal('modal-assign-deposit-account');
    window.app.showToast(`Depósito registrado exitosamente en: ${accName}`, 'success');

    this.updateKpis();
    this.renderTable();
  },

  openEditModal(id) {
    this.editingIncomeId = id;
    const data = window.db.get();
    const item = (data.otherIncomes || []).find(i => i.id === id);
    if (!item) return;

    const modalTitle = document.getElementById('other-income-modal-title');
    if (modalTitle) modalTitle.innerHTML = `<i data-lucide="edit-3"></i> Editar Ingreso Operativo`;

    this.populateModalOperators(item.operatorId);
    this.populateDepositAccounts('inc-form-deposit-account', item.depositAccountId);

    document.getElementById('inc-form-ticket-number').value = item.ticketNumber || '';
    document.getElementById('inc-form-issue-date').value = item.issueDate || new Date().toISOString().split('T')[0];
    document.getElementById('inc-form-currency').value = item.currency || 'BOB';
    document.getElementById('inc-form-amount').value = Number(item.amount || 0).toFixed(2);
    document.getElementById('inc-form-status').value = item.status || 'IMPAGA';
    document.getElementById('inc-form-paid-date').value = item.paidAt || '';
    document.getElementById('inc-form-deposit-ref').value = item.depositVoucherRef || '';
    document.getElementById('inc-form-description').value = item.description || '';
    document.getElementById('inc-form-notes').value = item.paymentNotes || '';

    this.onStatusChangeInModal();

    if (window.lucide) window.lucide.createIcons();
    window.app.openModal('modal-other-income');
  },

  openNewManualModal() {
    this.editingIncomeId = null;
    const form = document.getElementById('other-income-form');
    if (form) form.reset();

    const modalTitle = document.getElementById('other-income-modal-title');
    if (modalTitle) modalTitle.innerHTML = `<i data-lucide="plus-circle"></i> Nuevo Ingreso Operativo`;

    this.populateModalOperators();
    this.populateDepositAccounts('inc-form-deposit-account');

    document.getElementById('inc-form-ticket-number').value = 'ING-' + Math.floor(1000 + Math.random() * 9000);
    document.getElementById('inc-form-issue-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('inc-form-currency').value = 'BOB';
    document.getElementById('inc-form-amount').value = '';
    document.getElementById('inc-form-status').value = 'IMPAGA';
    document.getElementById('inc-form-paid-date').value = '';
    document.getElementById('inc-form-deposit-ref').value = '';
    document.getElementById('inc-form-description').value = '';
    document.getElementById('inc-form-notes').value = '';

    this.onStatusChangeInModal();

    if (window.lucide) window.lucide.createIcons();
    window.app.openModal('modal-other-income');
  },

  populateModalOperators(selectedId = null) {
    const select = document.getElementById('inc-form-operator');
    if (!select) return;

    const data = window.db.get();
    const providers = (data.accounts || []).filter(a => a.relationType === 'PROVEEDOR' || a.relationType === 'AMBOS');

    select.innerHTML = `
      <option value="">-- Seleccione Proveedor / Operador --</option>
      ${providers.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.name} (${p.code})</option>`).join('')}
    `;
  },

  onStatusChangeInModal() {
    const status = document.getElementById('inc-form-status')?.value;
    const depositWrap = document.getElementById('inc-form-deposit-wrap');
    const paidDateInput = document.getElementById('inc-form-paid-date');

    if (status === 'PAGADO') {
      if (depositWrap) depositWrap.style.display = 'block';
      if (paidDateInput && !paidDateInput.value) {
        paidDateInput.value = new Date().toISOString().split('T')[0];
      }
    } else {
      if (depositWrap) depositWrap.style.display = 'none';
      if (paidDateInput) paidDateInput.value = '';
    }
  },

  handleSave(e) {
    e.preventDefault();
    const data = window.db.get();
    data.otherIncomes = data.otherIncomes || [];

    const opId = document.getElementById('inc-form-operator').value;
    const op = (data.accounts || []).find(a => a.id === opId);
    const opName = op ? op.name : 'Operador General';

    const ticketNumber = document.getElementById('inc-form-ticket-number').value.trim();
    const issueDate = document.getElementById('inc-form-issue-date').value;
    const currency = document.getElementById('inc-form-currency').value;
    const amount = parseFloat(document.getElementById('inc-form-amount').value) || 0;
    const status = document.getElementById('inc-form-status').value;
    const paidAt = status === 'PAGADO' ? (document.getElementById('inc-form-paid-date').value || new Date().toISOString().split('T')[0]) : null;
    
    const depositSelect = document.getElementById('inc-form-deposit-account');
    const depositAccountId = (status === 'PAGADO' && depositSelect) ? depositSelect.value : '';
    const depositAccountName = (status === 'PAGADO' && depositSelect && depositSelect.selectedIndex > 0)
      ? depositSelect.options[depositSelect.selectedIndex].getAttribute('data-name') || depositSelect.options[depositSelect.selectedIndex].text.trim()
      : '';
    const depositRef = (status === 'PAGADO') ? (document.getElementById('inc-form-deposit-ref')?.value.trim() || '') : '';

    const description = document.getElementById('inc-form-description').value.trim();
    const notes = document.getElementById('inc-form-notes').value.trim();

    if (this.editingIncomeId) {
      const idx = data.otherIncomes.findIndex(i => i.id === this.editingIncomeId);
      if (idx !== -1) {
        data.otherIncomes[idx] = {
          ...data.otherIncomes[idx],
          operatorId: opId,
          operatorName: opName,
          ticketNumber: ticketNumber,
          issueDate: issueDate,
          currency: currency,
          amount: amount,
          status: status,
          paidAt: paidAt,
          depositAccountId: depositAccountId,
          depositAccountName: depositAccountName,
          depositVoucherRef: depositRef,
          description: description,
          paymentNotes: notes,
          updatedAt: new Date().toLocaleString()
        };
        window.app.showToast('Ingreso operativo actualizado correctamente', 'success');
      }
    } else {
      const newIncome = {
        id: 'INC-' + Date.now(),
        originType: 'MANUAL',
        ticketId: null,
        ticketNumber: ticketNumber,
        operatorId: opId,
        operatorName: opName,
        issueDate: issueDate,
        passengerName: '',
        route: '',
        currency: currency,
        amount: amount,
        status: status,
        paidAt: paidAt,
        depositAccountId: depositAccountId,
        depositAccountName: depositAccountName,
        depositVoucherRef: depositRef,
        description: description || `Ingreso Operativo ${ticketNumber} - ${opName}`,
        paymentNotes: notes,
        depositAccountId: depositAccountId,
        depositAccountName: depositAccountName,
        depositVoucherRef: depositRef,
        createdAt: new Date().toLocaleString()
      };
      data.otherIncomes.unshift(newIncome);
      window.app.showToast('Nuevo ingreso operativo registrado correctamente', 'success');
    }

    window.db.save(data);
    window.app.closeModal('modal-other-income');
    this.updateKpis();
    this.renderTable();
  },

  deleteIncome(id) {
    const data = window.db.get();
    const item = (data.otherIncomes || []).find(i => i.id === id);
    if (!item) return;

    if (confirm(`¿Estás seguro de eliminar el registro de ingreso ${item.ticketNumber || item.id}?`)) {
      data.otherIncomes = data.otherIncomes.filter(i => i.id !== id);
      window.db.save(data);
      window.app.showToast('Registro eliminado correctamente', 'success');
      this.updateKpis();
      this.renderTable();
    }
  },

  exportCsv() {
    const data = window.db.get();
    const list = data.otherIncomes || [];
    if (list.length === 0) {
      window.app.showToast('No hay ingresos registrados para exportar', 'warning');
      return;
    }

    const headers = ['ID', 'Fecha Emisión', 'Nro Boleto / Ref', 'Operador', 'Descripción', 'Moneda', 'Monto', 'Estado', 'Fecha Pago', 'ND Asignada', 'Notas'];
    const rows = list.map(i => [
      i.id,
      i.issueDate,
      `"${(i.ticketNumber || '').replace(/"/g, '""')}"`,
      `"${(i.operatorName || '').replace(/"/g, '""')}"`,
      `"${(i.description || '').replace(/"/g, '""')}"`,
      i.currency,
      i.amount,
      i.status,
      i.paidAt || '',
      i.assignedNdNumber ? `ND #${i.assignedNdNumber}` : '',
      `"${(i.paymentNotes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Otros_Ingresos_Operativos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.app.showToast('Archivo CSV descargado correctamente', 'success');
  }
};
