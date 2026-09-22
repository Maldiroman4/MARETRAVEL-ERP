/**
 * MARETRAVEL ERP - Módulo 4: Notas de Crédito a Proveedores (NC - Cuentas por Pagar)
 * Incluye: Visualización de NCs automáticas (originadas por ND) vs manuales y saldos.
 */

window.creditNotesModule = {
  currentStatusFilter: 'TODOS',

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    const statusFilter = document.getElementById('nc-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentStatusFilter = e.target.value;
        this.render();
      });
    }

    const searchInput = document.getElementById('nc-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.render());
    }

    const btnNew = document.getElementById('btn-new-nc');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.openManualNcModal());
    }

    const form = document.getElementById('nc-manual-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSaveManualNc(e));
    }
  },

  isNcForActiveService(nc, activeService, allDebitNotes) {
    if (!activeService || activeService === 'ALL' || activeService === 'TODOS') return true;
    const srv = activeService.toUpperCase();

    const matchesService = (val) => {
      if (!val) return false;
      const v = String(val).toUpperCase();
      if (v === srv) return true;
      if (srv === 'BOLETO_AEREO' && (v.includes('BOLETO') || v.includes('AEREO') || v.includes('GDS'))) return true;
      if (srv === 'SEGURO_VIAJE' && (v.includes('SEGURO'))) return true;
      if (srv === 'CERTIFICACION_FA' && (v.includes('CERTIFICACION') || v.includes('IFA'))) return true;
      if (srv === 'ASESORAMIENTO_VISAS' && (v.includes('VISA') || v.includes('ASESORAMIENTO'))) return true;
      if (srv === 'PAQUETES' && (v.includes('PAQUETE'))) return true;
      if (srv === 'HOTEL' && (v.includes('HOTEL') || v.includes('HOSPEDAJE'))) return true;
      if (srv === 'RENT_A_CAR' && (v.includes('RENT') || v.includes('CAR') || v.includes('TRASLADO') || v.includes('AUTO'))) return true;
      return false;
    };

    // 1. Coincidencia directa por campos de servicio en la NC
    if (matchesService(nc.serviceCategory)) return true;
    if (matchesService(nc.serviceType)) return true;
    if (matchesService(nc.servicio_tipo)) return true;

    // 2. Coincidencia por ítems directos en la NC si los tiene
    if (nc.items && Array.isArray(nc.items) && nc.items.some(it => matchesService(it.serviceType || it.serviceCategory))) {
      return true;
    }

    // 3. Coincidencia por la Nota de Débito de origen que generó esta NC
    if (nc.originDebitNoteId || nc.originDebitNoteNumber) {
      const originNd = (allDebitNotes || []).find(nd => 
        (nc.originDebitNoteId && nd.id === nc.originDebitNoteId) ||
        (nc.originDebitNoteNumber && nd.ndNumber === nc.originDebitNoteNumber)
      );
      if (originNd) {
        if (matchesService(originNd.serviceCategory) || matchesService(originNd.serviceType)) return true;
        if (originNd.items && Array.isArray(originNd.items) && originNd.items.some(it => matchesService(it.serviceType || it.serviceCategory))) {
          return true;
        }
      }
    }

    // 4. Coincidencia por concepto / glosa (ej: "(Servicios: BOLETO_AEREO)", "(Servicios: PAQUETES)")
    if (nc.concept) {
      const c = String(nc.concept).toUpperCase();
      if (c.includes(`SERVICIOS: ${srv}`)) return true;
      if (matchesService(c)) return true;
    }

    return false;
  },

  render() {
    const data = window.db.get();
    const notes = data.creditNotes || [];
    const debitNotes = data.debitNotes || [];
    const search = (document.getElementById('nc-search-input')?.value || '').toLowerCase();
    const tableBodies = document.querySelectorAll('#nc-table-body');
    if (tableBodies.length === 0) return;

    // Obtener servicio activo del estado global
    const activeService = (window.state?.servicioActivo || window.currentServiceCategory || window.app?.servicioActivo || window.operationsHubModule?.filterService || 'ALL').toUpperCase();

    // 1. Filtrar exclusivamente por el servicio donde se generó la NC
    let list = notes.filter(nc => this.isNcForActiveService(nc, activeService, debitNotes));

    // 2. Filtros secundarios por estado y búsqueda
    let filtered = list.filter(nc => {
      const isPaid = nc.status === 'PAGADA' || (nc.balance <= 0.01 && (nc.paidAmount > 0 || nc.paidAmountBob > 0));
      const isPartial = !isPaid && ((nc.paidAmount > 0.01 || nc.paidAmountBob > 0.01) || nc.status === 'PARCIAL');
      const isUnpaid = !isPaid && !isPartial;

      const matchStatus = this.currentStatusFilter === 'TODOS' ||
                          (this.currentStatusFilter === 'PAGADA' && isPaid) ||
                          (this.currentStatusFilter === 'PARCIAL' && isPartial) ||
                          (this.currentStatusFilter === 'IMPAGA' && isUnpaid);

      const matchSearch = String(nc.ncNumber).includes(search) ||
                          (nc.providerName && nc.providerName.toLowerCase().includes(search)) ||
                          (nc.concept && nc.concept.toLowerCase().includes(search)) ||
                          (nc.originDebitNoteNumber && String(nc.originDebitNoteNumber).includes(search));
      return matchStatus && matchSearch;
    });

    if (filtered.length === 0) {
      tableBodies.forEach(tb => {
        tb.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: 24px; color: var(--text-muted);">
              No se encontraron Notas de Crédito de proveedores.
            </td>
          </tr>
        `;
      });
      return;
    }

    const rowsHtml = filtered.map(nc => {
      const isPaid = nc.status === 'PAGADA' || (nc.balance <= 0.01 && (nc.paidAmount > 0 || nc.paidAmountBob > 0));
      const isPartial = !isPaid && ((nc.paidAmount > 0.01 || nc.paidAmountBob > 0.01) || nc.status === 'PARCIAL');
      const statusBadge = isPaid ? 'badge-emerald' : (isPartial ? 'badge-blue' : 'badge-amber');
      const statusText = isPaid ? 'PAGADA' : (isPartial ? 'PARCIAL' : 'IMPAGA');

      const originBadge = nc.isAutoGenerated ?
        `<span class="badge badge-indigo" title="Generada automáticamente al emitir/cerrar ND #${nc.originDebitNoteNumber}">Auto ND #${nc.originDebitNoteNumber}</span>` :
        `<span class="badge badge-slate">Manual</span>`;

      return `
        <tr>
          <td class="font-mono" style="font-weight: 700; color: var(--navy);">${nc.ncCode || ('NC #' + nc.ncNumber)}</td>
          <td class="font-mono">${nc.issueDate}</td>
          <td>
            <div style="font-weight: 600;">${nc.providerName}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${nc.concept}</div>
          </td>
          <td>${originBadge}</td>
          <td class="font-mono" style="text-align: right; font-weight: 700;">
            ${nc.currency} ${Number(nc.totalAmount).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
          </td>
          <td class="font-mono" style="text-align: right; color: #15803d; font-weight: 600;">
            ${nc.currency} ${Number(nc.paidAmount).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
          </td>
          <td class="font-mono" style="text-align: right; color: #b91c1c; font-weight: 700;">
            ${nc.currency} ${Number(nc.balance).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
          </td>
          <td>${window.cashRegisterModule ? window.cashRegisterModule.renderStatusBadge(nc.status, nc.paidAmount, nc.balance) : `<span class="badge ${statusBadge}">${nc.status}</span>`}</td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; align-items: center;">
              ${nc.status !== 'ANULADA' ? `
                <button type="button" class="btn ${Number(nc.balance || 0) > 0.01 ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window.cashRegisterModule.openPaymentModal('NC', '${nc.id}')" title="Pagar / Amortizar a Proveedor" style="padding: 4px 8px; font-weight: 700; ${Number(nc.balance || 0) > 0.01 ? 'background: #0284c7; border-color: #0369a1; color: #fff;' : ''} display: inline-flex; align-items: center; gap: 4px;">
                  <i data-lucide="wallet" style="width: 14px; height: 14px;"></i> Pagar
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-sm" onclick="window.reportsModule.openCorrectionModal('NC', '${nc.id}')" title="Corrección Contable">
                <i data-lucide="edit-3"></i>
              </button>
              ${nc.status !== 'ANULADA' ? `
                <button class="btn btn-danger btn-sm" onclick="window.reportsModule.openVoidModal('NC', '${nc.id}')" title="Anular NC">
                  <i data-lucide="x-circle"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tableBodies.forEach(tb => {
      tb.innerHTML = rowsHtml;
    });

    if (window.lucide) window.lucide.createIcons();
  },

  openManualNcModal() {
    const form = document.getElementById('nc-manual-form');
    if (form) form.reset();

    const data = window.db.get();
    const providers = data.accounts.filter(a => a.relationType === 'PROVEEDOR' || a.relationType === 'AMBOS');
    const select = document.getElementById('nc-provider-select');
    if (select) {
      select.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>' +
        providers.map(p => `<option value="${p.id}">${p.name} (${p.code})</option>`).join('');
    }

    const actCat = window.state?.servicioActivo || window.currentServiceCategory || window.operationsHubModule?.filterService || 'BOLETO_AEREO';
    const srvCat = actCat === 'PAQUETES' ? 'PAQUETE_TURISTICO' : (actCat === 'HOTEL' ? 'HOTEL_HOSPEDAJE' : (actCat === 'RENT_A_CAR' ? 'TRASLADO' : actCat));
    document.getElementById('nc-number-display').textContent = window.maretravelCodes.nextFor(data.creditNotes, 'NC', srvCat);
    document.getElementById('nc-issue-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('nc-currency').value = 'BOB';

    window.app.openModal('modal-nc-manual');
  },

  handleSaveManualNc(e) {
    e.preventDefault();
    const data = window.db.get();
    const providerId = document.getElementById('nc-provider-select').value;
    const provider = data.accounts.find(a => a.id === providerId);
    if (!provider) {
      window.app.showToast('Selecciona un proveedor válido', 'warning');
      return;
    }

    const total = parseFloat(document.getElementById('nc-total-amount').value) || 0;
    if (total <= 0) {
      window.app.showToast('El importe debe ser mayor a cero', 'warning');
      return;
    }

    const nextNc = (data.creditNotes.length > 0) ? Math.max(...data.creditNotes.map(c => c.ncNumber)) + 1 : 501;
    const activeCat = window.state?.servicioActivo || window.currentServiceCategory || window.operationsHubModule?.filterService || 'BOLETO_AEREO';
    const srvCat = activeCat === 'PAQUETES' ? 'PAQUETE_TURISTICO' : (activeCat === 'HOTEL' ? 'HOTEL_HOSPEDAJE' : (activeCat === 'RENT_A_CAR' ? 'TRASLADO' : activeCat));
    const ncCode = window.maretravelCodes.nextFor(data.creditNotes, 'NC', srvCat);
    const newNc = {
      id: 'NC-' + Date.now(),
      ncNumber: nextNc,
      ncCode: ncCode,
      providerId: provider.id,
      providerName: provider.name,
      providerNit: provider.nit || '',
      originDebitNoteId: null,
      originDebitNoteNumber: null,
      issueDate: document.getElementById('nc-issue-date').value,
      concept: document.getElementById('nc-concept').value.trim(),
      currency: document.getElementById('nc-currency').value,
      totalAmount: total,
      paidAmount: 0.00,
      balance: total,
      status: 'IMPAGA',
      estado: 'IMPAGA',
      isAutoGenerated: false,
      serviceCategory: activeCat,
      serviceType: activeCat,
      servicio_tipo: activeCat,
      createdById: data.currentUser.id,
      createdAt: new Date().toLocaleString()
    };

    data.creditNotes.unshift(newNc);
    window.db.save(data);
    window.app.closeModal('modal-nc-manual');
    window.app.showToast(`Nota de Crédito ${newNc.ncCode || ('NC #' + newNc.ncNumber)} registrada correctamente`, 'success');
    this.render();
    if (window.operationsHubModule) window.operationsHubModule.render();
    if (window.app && window.app.updateDashboardKpis) window.app.updateDashboardKpis();
  },

  /**
   * Vista previa y emisión oficial para NC
   */
  printPreview(ncId) {
    if (window.debitNotesModule && typeof window.debitNotesModule.printPreview === 'function') {
      window.debitNotesModule.printPreview(ncId, 'long', 'NC');
    }
  },

  /**
   * Alias de impresión de voucher NC
   */
  printVoucher(ncId) {
    this.printPreview(ncId);
  },

  /**
   * Impresión directa sin modal de NC
   */
  directPrint(ncId, transactionContext = null) {
    if (window.debitNotesModule && typeof window.debitNotesModule.directPrint === 'function') {
      window.debitNotesModule.directPrint(ncId, 'NC', transactionContext);
    }
  }
};
