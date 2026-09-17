/**
 * MARETRAVEL ERP - Módulo Unificado de Operaciones & Ventas (Todo en Uno)
 * Unifica: Boletos Aéreos, Notas de Débito, Notas de Crédito, Caja y Cuentas.
 * Permite añadir nuevos tipos de servicio dinámicamente y realizar
 * operaciones 100% Editables, Borrables y Anulables.
 */

class OperationsHubModule {
  constructor() {
    this.currentTab = 'all'; // 'all', 'tickets', 'nds', 'ncs', 'accounts', 'cash'
    this.editingOperationId = null;
    this.editingServiceTypeId = null;
    this.searchQuery = '';
    this.filterService = 'ALL';
    this.filterStatus = 'ALL';
    this.init();
  }

  init() {
    this.ensureServiceTypes();
  }

  ensureServiceTypes() {
    const data = window.db ? window.db.get() : null;
    if (!data) return;

    if (!data.serviceTypes || data.serviceTypes.length === 0) {
      data.serviceTypes = [
        { id: 'SRV-BOLETO', code: 'BOLETO_AEREO', name: 'BOLETO AÉREO / GDS', category: 'AÉREO' },
        { id: 'SRV-HOTEL', code: 'HOTEL', name: 'HOTEL / HOSPEDAJE', category: 'HOSPEDAJE' },
        { id: 'SRV-PAQ-TUR', code: 'PAQUETE_TURISTICO', name: 'PAQUETE TURÍSTICO', category: 'PAQUETES' },
        { id: 'SRV-PAQ-CRU', code: 'PAQUETE_CRUCERO', name: 'PAQUETE CRUCERO', category: 'PAQUETES' },
        { id: 'SRV-PAQ-CON', code: 'PAQUETE_CONCIERTO', name: 'PAQUETE CONCIERTO', category: 'PAQUETES' },
        { id: 'SRV-VISA', code: 'ASESORAMIENTO_VISAS', name: 'ASESORAMIENTO DE VISAS', category: 'VISAS' },
        { id: 'SRV-FA', code: 'CERTIFICACION_FA', name: 'CERTIFICACIÓN INTERNACIONAL FA', category: 'CERTIFICACIONES' },
        { id: 'SRV-AUTO', code: 'RENT_A_CAR', name: 'RENT A CAR', category: 'VEHÍCULOS' },
        { id: 'SRV-SEG', code: 'SEGURO_VIAJE', name: 'SEGURO DE VIAJE', category: 'SEGUROS' },
        { id: 'SRV-OTRO', code: 'OTRO', name: 'OTRO SERVICIO', category: 'VARIOS' }
      ];
      window.db.save(data);
    }
  }

  getServiceTypes() {
    this.ensureServiceTypes();
    const data = window.db.get();
    return data.serviceTypes || [];
  }

  render() {
    this.ensureServiceTypes();
    this.bindEvents();
    this.updateHubKpis();
    this.populateServiceTypeSelects();
    this.renderActiveTabContent();
    if (window.lucide) window.lucide.createIcons();
  }

  bindEvents() {
    if (this.eventsBound) return;
    this.eventsBound = true;

    const searchInp = document.getElementById('hub-search-input');
    if (searchInp && typeof searchInp.addEventListener === 'function') {
      searchInp.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderActiveTabContent();
      });
    }

    const filterSrv = document.getElementById('hub-filter-service');
    if (filterSrv && typeof filterSrv.addEventListener === 'function') {
      filterSrv.addEventListener('change', (e) => {
        this.filterService = e.target.value;
        this.renderActiveTabContent();
      });
    }

    const filterStatus = document.getElementById('hub-filter-status');
    if (filterStatus && typeof filterStatus.addEventListener === 'function') {
      filterStatus.addEventListener('change', (e) => {
        this.filterStatus = e.target.value;
        this.renderActiveTabContent();
      });
    }

    ['uni-fare-amount', 'uni-fee-amount', 'uni-prov-comm-rate'].forEach(id => {
      const el = document.getElementById(id);
      if (el && typeof el.addEventListener === 'function') {
        el.addEventListener('input', () => this.calculateUnifiedTotals());
      }
    });

    const uniSrvSelect = document.getElementById('uni-service-type');
    if (uniSrvSelect && typeof uniSrvSelect.addEventListener === 'function') {
      uniSrvSelect.addEventListener('change', (e) => {
        if (e.target.value === '__NEW_SERVICE__') {
          this.openNewServiceTypeModal();
        } else {
          this.renderDynamicServiceFields(e.target.value);
        }
      });
    }

    const manSrvSelect = document.getElementById('man-service-type');
    if (manSrvSelect && typeof manSrvSelect.addEventListener === 'function') {
      manSrvSelect.addEventListener('change', (e) => {
        if (e.target.value === '__NEW_SERVICE__') {
          this.openNewServiceTypeModal();
        }
      });
    }

    const uniCliSelect = document.getElementById('uni-client-select');
    if (uniCliSelect && typeof uniCliSelect.addEventListener === 'function') {
      uniCliSelect.addEventListener('change', (e) => {
        if (e.target.value === '__NEW_CLIENT__') {
          if (window.accountsModule) window.accountsModule.openNewAccountModal();
        }
      });
    }

    const uniProvSelect = document.getElementById('uni-provider-select');
    if (uniProvSelect && typeof uniProvSelect.addEventListener === 'function') {
      uniProvSelect.addEventListener('change', (e) => {
        if (e.target.value === '__NEW_PROV__') {
          if (window.accountsModule) window.accountsModule.openNewAccountModal();
        }
      });
    }
  }

  updateHubKpis() {
    const data = window.db.get();
    
    let totalOps = (data.debitNotes || []).filter(n => n.status !== 'ANULADA').length;
    let totalSalesBob = 0;
    let totalReceivableBob = 0;
    let totalPayableBob = 0;

    (data.debitNotes || []).forEach(nd => {
      if (nd.status !== 'ANULADA') {
        totalSalesBob += Number(nd.totalAmountBob || 0);
        if (nd.status !== 'BORRADOR') {
          totalReceivableBob += Number(nd.balanceBob || 0);
        }
      }
    });

    (data.creditNotes || []).forEach(nc => {
      if (nc.status !== 'ANULADA') {
        totalPayableBob += Number(nc.balance || 0);
      }
    });

    const elTotalOps = document.getElementById('hub-kpi-total-ops');
    const elTotalSales = document.getElementById('hub-kpi-total-sales');
    const elTotalRec = document.getElementById('hub-kpi-total-receivable');
    const elTotalPay = document.getElementById('hub-kpi-total-payable');

    if (elTotalOps) elTotalOps.textContent = totalOps;
    if (elTotalSales) elTotalSales.textContent = `BOB ${totalSalesBob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
    if (elTotalRec) elTotalRec.textContent = `BOB ${totalReceivableBob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
    if (elTotalPay) elTotalPay.textContent = `BOB ${totalPayableBob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
  }

  switchTab(tabName) {
    if (tabName === 'nds') {
      this.switchTab('cash');
      if (window.cashRegisterModule) {
        window.cashRegisterModule.showTabContent('cobranzas');
        window.cashRegisterModule.switchNdSubView('history');
      }
      return;
    }
    if (tabName === 'ncs') {
      this.switchTab('cash');
      if (window.cashRegisterModule) {
        window.cashRegisterModule.showTabContent('pagos');
        window.cashRegisterModule.switchNcSubView('history');
      }
      return;
    }

    this.currentTab = tabName;
    document.querySelectorAll('.hub-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.hubTab === tabName);
    });

    // Control de barra de filtros (se oculta en Caja para que coincida exactamente con la Imagen 1)
    const filterRow = document.getElementById('hub-filters-row');
    if (filterRow) {
      filterRow.style.display = (tabName === 'cash') ? 'none' : 'flex';
    }

    // Toggle de paneles dedicados
    document.querySelectorAll('.hub-tab-panel').forEach(panel => {
      panel.style.display = 'none';
    });
    const activePanel = document.getElementById(`hub-panel-${tabName}`);
    if (activePanel) {
      activePanel.style.display = 'block';
    }

    this.renderActiveTabContent();
    if (window.lucide) window.lucide.createIcons();
  }

  renderActiveTabContent() {
    if (this.currentTab === 'all') {
      const container = document.getElementById('hub-panel-all');
      if (container) this.renderAllOperations(container);
    } else if (this.currentTab === 'tickets') {
      const container = document.getElementById('hub-panel-tickets');
      if (container) this.renderTicketsSubView(container);
    } else if (this.currentTab === 'nds') {
      const container = document.getElementById('hub-panel-nds');
      if (container) this.renderNdsSubView(container);
    } else if (this.currentTab === 'ncs') {
      const container = document.getElementById('hub-panel-ncs');
      if (container) this.renderNcsSubView(container);
    } else if (this.currentTab === 'accounts') {
      const container = document.getElementById('hub-panel-accounts');
      if (container) this.renderAccountsSubView(container);
    } else if (this.currentTab === 'cash') {
      this.renderCashSubView();
    }
  }

  // --------------------------------------------------------------------------
  // VISTA 1: TODAS LAS OPERACIONES (TABLA MAESTRA UNIFICADA)
  // --------------------------------------------------------------------------
  renderAllOperations(container) {
    const data = window.db.get();
    let nds = data.debitNotes || [];

    // Filtros
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      nds = nds.filter(n => 
        (n.ndNumber && String(n.ndNumber).includes(q)) ||
        (n.accountName && n.accountName.toLowerCase().includes(q)) ||
        (n.items && n.items.some(it => 
          (it.passengerName && it.passengerName.toLowerCase().includes(q)) ||
          (it.ticketNumber && it.ticketNumber.toLowerCase().includes(q)) ||
          (it.description && it.description.toLowerCase().includes(q)) ||
          (it.operatorName && it.operatorName.toLowerCase().includes(q))
        ))
      );
    }

    if (this.filterStatus !== 'ALL') {
      nds = nds.filter(n => n.status === this.filterStatus);
    }

    if (this.filterService !== 'ALL') {
      nds = nds.filter(n => n.items && n.items.some(it => it.serviceType === this.filterService));
    }

    let rowsHtml = '';
    if (nds.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 40px 20px; color: #64748b;">
            <i data-lucide="inbox" style="width: 42px; height: 42px; margin-bottom: 8px; display: inline-block; color: #94a3b8;"></i>
            <div style="font-size: 1rem; font-weight: 600;">No se encontraron operaciones registradas</div>
            <p style="font-size: 0.82rem; color: #94a3b8; margin-top: 4px;">Utilice el botón "Nueva Venta / Emisión Integral" para registrar una operación completa.</p>
          </td>
        </tr>
      `;
    } else {
      rowsHtml = nds.map(nd => {
        const firstItem = (nd.items && nd.items[0]) || {};
        const serviceName = this.formatServiceName(firstItem.serviceType || 'BOLETO_AEREO');
        const passName = firstItem.passengerName || nd.passengerName || '-';
        const operatorName = firstItem.operatorName || '-';
        const totalItemsCount = nd.items ? nd.items.length : 1;

        let badgeClass = 'badge-slate';
        if (nd.status === 'PAGADA') badgeClass = 'badge-emerald';
        else if (nd.status === 'PARCIAL') badgeClass = 'badge-blue';
        else if (nd.status === 'IMPAGA' || nd.status === 'EMITIDA') badgeClass = 'badge-amber';
        else if (nd.status === 'ANULADA') badgeClass = 'badge-danger';

        return `
          <tr>
            <td class="font-mono" style="font-weight: 800; color: #0284c7;">
              ND #${nd.ndNumber}
            </td>
            <td class="font-mono">${nd.issueDate || '-'}</td>
            <td>
              <span class="badge ${this.getServiceBadgeClass(firstItem.serviceType)}">
                ${serviceName} ${totalItemsCount > 1 ? `(+${totalItemsCount - 1})` : ''}
              </span>
            </td>
            <td>
              <strong>${passName}</strong>
              <div style="font-size: 0.75rem; color: #64748b;">${firstItem.description || '-'}</div>
            </td>
            <td>
              <span style="font-weight: 600; color: #1e293b;">${nd.accountName || '-'}</span>
            </td>
            <td>
              <span style="font-size: 0.82rem; color: #475569;">${operatorName}</span>
            </td>
            <td class="font-mono" style="text-align: right; font-weight: 800; color: #0f172a;">
              BOB ${Number(nd.totalAmountBob || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
            </td>
            <td class="font-mono" style="text-align: right; font-weight: 700; color: ${nd.balanceBob > 0 ? '#dc2626' : '#059669'};">
              BOB ${Number(nd.balanceBob || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
            </td>
            <td>
              <span class="badge ${badgeClass}">${nd.status}</span>
            </td>
            <td style="text-align: center; white-space: nowrap;">
              <div class="table-actions-inline" style="display: inline-flex; gap: 4px;">
                <button type="button" class="btn btn-secondary btn-xs" onclick="window.operationsHubModule.openEditOperationModal('${nd.id}')" title="Editar Operación Integral">
                  <i data-lucide="edit-3"></i> Editar
                </button>
                <button type="button" class="btn btn-secondary btn-xs" onclick="window.debitNotesModule.printVoucher('${nd.id}')" title="Imprimir Nota / Voucher">
                  <i data-lucide="printer"></i>
                </button>
                ${nd.status !== 'ANULADA' ? `
                  <button type="button" class="btn btn-warning btn-xs" onclick="window.operationsHubModule.voidOperation('${nd.id}')" title="Anular Operación">
                    <i data-lucide="ban"></i>
                  </button>
                ` : ''}
                <button type="button" class="btn btn-danger btn-xs" onclick="window.operationsHubModule.deleteOperation('${nd.id}')" title="Borrar Definitivamente del Sistema">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    container.innerHTML = `
      <div class="table-container" style="background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
        <table class="erp-table">
          <thead>
            <tr>
              <th>Nro ND / Ref</th>
              <th>Fecha</th>
              <th>Tipo Servicio</th>
              <th>Pasajero / Detalle</th>
              <th>Cliente Facturado</th>
              <th>Operador / Prov.</th>
              <th style="text-align: right;">Total Venta</th>
              <th style="text-align: right;">Saldo Pendiente</th>
              <th>Estado</th>
              <th style="text-align: center; min-width: 220px;">Acciones Operativas</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // SUB-VISTAS INTEGRADAS (Boletos, NDs, NCs, Cuentas, Caja)
  // --------------------------------------------------------------------------
  renderTicketsSubView(container) {
    container.innerHTML = `<div id="hub-tickets-subview"></div>`;
    const sub = document.getElementById('hub-tickets-subview');
    const data = window.db.get();
    const tkts = data.gdsTickets || [];
    sub.innerHTML = `
      <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <h4 style="margin: 0; color: #0f172a; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="plane-takeoff" style="color: #0284c7;"></i> Registro y Emisiones de Boletos Aéreos (GDS)
        </h4>
        <button class="btn btn-primary btn-sm" onclick="window.gdsModule.openSimulateModal()">
          <i data-lucide="plus"></i> Emitir Boleto Aéreo
        </button>
      </div>
      <div class="table-container" style="background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden;">
        <table class="erp-table">
          <thead>
            <tr>
              <th>Nro Boleto</th>
              <th>Fecha Emisión</th>
              <th>Pasajero</th>
              <th>Ruta</th>
              <th>Línea Aérea / Operador</th>
              <th style="text-align: right;">Precio Boleto</th>
              <th style="text-align: right;">Fee Agencia</th>
              <th>Estado</th>
              <th style="text-align: center;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${tkts.length === 0 ? `<tr><td colspan="9" style="text-align:center; padding: 24px; color: #64748b;">No hay boletos aéreos registrados.</td></tr>` : 
              tkts.map(t => `
                <tr>
                  <td class="font-mono" style="font-weight: 700; color: #0284c7;">${t.ticketNumber}</td>
                  <td class="font-mono">${t.issueDate}</td>
                  <td><strong>${t.passengerName}</strong></td>
                  <td class="font-mono">${t.route || '-'}</td>
                  <td>${t.airlineCode || '-'}</td>
                  <td class="font-mono" style="text-align: right; font-weight: 700;">BOB ${Number(t.ticketPrice || t.totalAmount || 0).toFixed(2)}</td>
                  <td class="font-mono" style="text-align: right; color: #059669;">BOB ${Number(t.feeAmount || 0).toFixed(2)}</td>
                  <td><span class="badge ${t.status === 'FACTURADO' ? 'badge-emerald' : t.status === 'ANULADO' ? 'badge-danger' : 'badge-blue'}">${t.status}</span></td>
                  <td style="text-align: center; white-space: nowrap;">
                    <button class="btn btn-secondary btn-xs" onclick="window.gdsModule.openEditModal('${t.id}')"><i data-lucide="edit-3"></i> Editar</button>
                    <button class="btn btn-danger btn-xs" onclick="window.operationsHubModule.deleteTicket('${t.id}')"><i data-lucide="trash-2"></i> Borrar</button>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    `;
  }

  renderNdsSubView(container) {
    container.innerHTML = `<div id="hub-nds-subview"></div>`;
    if (window.debitNotesModule) {
      window.debitNotesModule.render();
      const originTable = document.querySelector('#view-notas-debito .table-container');
      if (originTable) {
        document.getElementById('hub-nds-subview').innerHTML = `
          <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0; color: #0f172a; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="file-spreadsheet" style="color: #0284c7;"></i> Notas de Débito Facturadas (Cuentas por Cobrar)
            </h4>
            <button class="btn btn-primary btn-sm" onclick="window.debitNotesModule.openNewModal()">
              <i data-lucide="plus"></i> Nueva Nota de Débito
            </button>
          </div>
          ${originTable.outerHTML}
        `;
      }
    }
  }

  renderNcsSubView(container) {
    container.innerHTML = `<div id="hub-ncs-subview"></div>`;
    if (window.creditNotesModule) {
      window.creditNotesModule.render();
      const originTable = document.querySelector('#view-notas-credito .table-container');
      if (originTable) {
        document.getElementById('hub-ncs-subview').innerHTML = `
          <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0; color: #0f172a; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="file-minus-2" style="color: #d97706;"></i> Notas de Crédito a Proveedores (Cuentas por Pagar)
            </h4>
            <button class="btn btn-primary btn-sm" onclick="window.creditNotesModule.openNewModal()">
              <i data-lucide="plus"></i> Registrar NC Manual
            </button>
          </div>
          ${originTable.outerHTML}
        `;
      }
    }
  }

  renderAccountsSubView(container) {
    container.innerHTML = `<div id="hub-accounts-subview"></div>`;
    if (window.accountsModule) {
      window.accountsModule.render();
      const originTable = document.querySelector('#view-cuentas .table-container');
      if (originTable) {
        document.getElementById('hub-accounts-subview').innerHTML = `
          <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0; color: #0f172a; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="users" style="color: #059669;"></i> Directorio de Cuentas (Clientes y Proveedores)
            </h4>
            <button class="btn btn-primary btn-sm" onclick="window.accountsModule.openNewAccountModal()">
              <i data-lucide="plus"></i> Nueva Cuenta
            </button>
          </div>
          ${originTable.outerHTML}
        `;
      }
    }
  }

  renderCashSubView() {
    if (window.cashRegisterModule) {
      window.cashRegisterModule.init();
      window.cashRegisterModule.render();
    }
  }

  // --------------------------------------------------------------------------
  // MODAL UNIFICADO: NUEVA VENTA / EMISIÓN INTEGRAL
  // --------------------------------------------------------------------------
  openNewUnifiedModal() {
    this.editingOperationId = null;
    const modalTitle = document.getElementById('unified-modal-title');
    if (modalTitle) modalTitle.innerHTML = `<i data-lucide="plus-circle"></i> Registrar Nueva Venta / Emisión Integral`;

    const form = document.getElementById('unified-operation-form');
    if (form) form.reset();

    const dateInput = document.getElementById('uni-issue-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    this.populateServiceTypeSelects();
    this.populateAccountsSelects();

    const initialSrv = document.getElementById('uni-service-type')?.value || 'BOLETO_AEREO';
    this.renderDynamicServiceFields(initialSrv, {});

    this.calculateUnifiedTotals();

    window.app.openModal('modal-unified-operation');
    if (window.lucide) window.lucide.createIcons();
  }

  populateAccountsSelects() {
    const data = window.db.get();
    const clients = (data.accounts || []).filter(a => a.type === 'CLIENTE' || a.type === 'AGENCIA' || a.type === 'CORPORATIVO');
    const providers = (data.accounts || []).filter(a => a.type === 'PROVEEDOR' || a.type === 'AEROLINEA' || a.type === 'HOTEL' || a.type === 'OPERADOR');

    const clientSelect = document.getElementById('uni-client-select');
    if (clientSelect) {
      clientSelect.innerHTML = `<option value="">-- Seleccionar Cliente --</option>` +
        clients.map(c => `<option value="${c.id}">${c.name} (${c.docNumber || c.code})</option>`).join('') +
        `<option value="__NEW_CLIENT__">➕ + Registrar Nuevo Cliente...</option>`;
    }

    const provSelect = document.getElementById('uni-provider-select');
    if (provSelect) {
      provSelect.innerHTML = `<option value="">-- Seleccionar Proveedor / Operador --</option>` +
        providers.map(p => `<option value="${p.id}">${p.name} (${p.docNumber || p.code})</option>`).join('') +
        `<option value="__NEW_PROV__">➕ + Registrar Nuevo Proveedor...</option>`;
    }

    const depositSelect = document.getElementById('uni-deposit-account');
    if (depositSelect) {
      const bankAccounts = (data.bankAccounts || []).filter(b => b.isActive);
      depositSelect.innerHTML = `
        <option value="CAJA_EFECTIVO">Caja Central Efectivo (BOB / USD)</option>
        ${bankAccounts.map(b => `<option value="${b.id}">Banco: ${b.bankName} (${b.accountNumber})</option>`).join('')}
      `;
    }
  }

  populateServiceTypeSelects() {
    const services = this.getServiceTypes();
    
    // 1. Selector en modal unificado
    const uniSelect = document.getElementById('uni-service-type');
    if (uniSelect) {
      const currentVal = uniSelect.value;
      uniSelect.innerHTML = services.map(s => `
        <option value="${s.code || s.id}">${s.name}</option>
      `).join('') + `<option value="__NEW_SERVICE__">➕ + Añadir Nuevo Tipo de Servicio...</option>`;
      if (currentVal && services.some(s => (s.code || s.id) === currentVal)) {
        uniSelect.value = currentVal;
      }
    }

    // 2. Selector en modal manual de ND (modal-manual-item)
    const manSelect = document.getElementById('man-service-type');
    if (manSelect) {
      const currentVal = manSelect.value;
      manSelect.innerHTML = services.map(s => `
        <option value="${s.code || s.id}">${s.name}</option>
      `).join('') + `<option value="__NEW_SERVICE__">➕ + Añadir Nuevo Tipo de Servicio...</option>`;
      if (currentVal && services.some(s => (s.code || s.id) === currentVal)) {
        manSelect.value = currentVal;
      }
    }

    // 3. Filtro en la barra de herramientas
    const filterSelect = document.getElementById('hub-filter-service');
    if (filterSelect) {
      const currentVal = filterSelect.value;
      filterSelect.innerHTML = `<option value="ALL">Todos los Servicios</option>` +
        services.map(s => `<option value="${s.code || s.id}">${s.name}</option>`).join('');
      if (currentVal) filterSelect.value = currentVal;
    }
  }

  calculateUnifiedTotals() {
    const fare = parseFloat(document.getElementById('uni-fare-amount')?.value) || 0;
    const fee = parseFloat(document.getElementById('uni-fee-amount')?.value) || 0;
    const provCommRate = parseFloat(document.getElementById('uni-prov-comm-rate')?.value) || 0;

    const totalVenta = fare + fee;
    const provCommAmount = fare * (provCommRate / 100);

    const totalVentaEl = document.getElementById('uni-total-sale-preview');
    const provCommEl = document.getElementById('uni-prov-comm-preview');
    const utilPreviewEl = document.getElementById('uni-utility-preview');

    if (totalVentaEl) totalVentaEl.textContent = `BOB ${totalVenta.toFixed(2)}`;
    if (provCommEl) provCommEl.textContent = `BOB ${provCommAmount.toFixed(2)}`;
    
    const utilidad = fee + provCommAmount;
    if (utilPreviewEl) utilPreviewEl.textContent = `BOB ${utilidad.toFixed(2)}`;
  }

  // --------------------------------------------------------------------------
  // RENDERIZADO DINÁMICO DE CAMPOS SEGÚN TIPO DE SERVICIO (PERSONALIZADO)
  // --------------------------------------------------------------------------
  renderDynamicServiceFields(serviceType, data = {}) {
    const container = document.getElementById('uni-service-specific-container');
    if (!container) return;

    const lblVoucher = document.getElementById('lbl-uni-voucher-number');
    const inpVoucher = document.getElementById('uni-voucher-number');
    const lblPax = document.getElementById('lbl-uni-pax-name');
    const inpPax = document.getElementById('uni-pax-name');
    const lblDoc = document.getElementById('lbl-uni-pax-doc');
    const inpDoc = document.getElementById('uni-pax-doc');
    const lblFare = document.getElementById('lbl-uni-fare-amount');

    const srv = (serviceType || 'BOLETO_AEREO').toUpperCase();

    if (srv === 'BOLETO_AEREO' || srv === 'BOLETO_GDS') {
      if (lblVoucher) lblVoucher.textContent = 'Nro Boleto / E-Ticket (13 Dígitos):';
      if (inpVoucher) inpVoucher.placeholder = 'Ej: 930-4581959448';
      if (lblPax) lblPax.textContent = 'Nombre del Pasajero:';
      if (inpPax) inpPax.placeholder = 'APELLIDO / NOMBRE PASAJERO';
      if (lblDoc) lblDoc.textContent = 'Doc. Identidad / Pasaporte:';
      if (lblFare) lblFare.textContent = 'AIR FARE / Tarifa Neta Aérea:';

      container.innerHTML = `
        <div style="font-weight: 700; font-size: 0.84rem; color: #0284c7; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="plane"></i> Formato de Vuelo / Boleto Aéreo GDS</span>
          <span class="badge badge-blue">Aéreo</span>
        </div>
        <div class="form-row" style="grid-template-columns: 1.5fr 1fr 1fr; gap: 8px;">
          <div>
            <label class="form-label">Ruta Aérea (Origen - Destino):</label>
            <input type="text" id="uni-f-route" class="form-control font-mono font-bold" placeholder="Ej: LPB-VVI-LPB o VVI-MIA-VVI" value="${data.flightRoute || data.route || ''}">
          </div>
          <div>
            <label class="form-label">Código PNR / Localizador:</label>
            <input type="text" id="uni-f-pnr" class="form-control font-mono font-bold" placeholder="Ej: AZ44SK" value="${data.pnrCode || data.pnr || ''}">
          </div>
          <div>
            <label class="form-label">Cabina / Clase:</label>
            <select id="uni-f-cabin" class="form-control">
              <option value="ECONÓMICA" ${(data.cabinClass === 'ECONÓMICA') ? 'selected' : ''}>Económica</option>
              <option value="PREMIUM ECONOMY" ${(data.cabinClass === 'PREMIUM ECONOMY') ? 'selected' : ''}>Premium Economy</option>
              <option value="EJECUTIVA / BUSINESS" ${(data.cabinClass === 'EJECUTIVA / BUSINESS') ? 'selected' : ''}>Ejecutiva / Business</option>
              <option value="PRIMERA CLASE" ${(data.cabinClass === 'PRIMERA CLASE') ? 'selected' : ''}>Primera Clase</option>
            </select>
          </div>
        </div>
        <div class="form-row" style="grid-template-columns: 1fr 1fr 1.5fr; gap: 8px; margin-top: 8px;">
          <div>
            <label class="form-label">Fecha Vuelo Salida (Ida):</label>
            <input type="date" id="uni-f-flight-dep" class="form-control font-mono" value="${data.flightDepDate || data.departureDate || ''}">
          </div>
          <div>
            <label class="form-label">Fecha Vuelo Retorno:</label>
            <input type="date" id="uni-f-flight-ret" class="form-control font-mono" value="${data.flightRetDate || data.returnDate || ''}">
          </div>
          <div>
            <label class="form-label">Nro de Vuelo / Info Adicional:</label>
            <input type="text" id="uni-f-flight-num" class="form-control font-mono" placeholder="Ej: BoA OB 934 / OB 935" value="${data.flightNumber || ''}">
          </div>
        </div>
      `;
    } else if (srv === 'HOTEL' || srv === 'HOTEL_HOSPEDAJE') {
      if (lblVoucher) lblVoucher.textContent = 'Nro Confirmación / Reserva Hotel:';
      if (inpVoucher) inpVoucher.placeholder = 'Ej: HTL-984210 o CONF-7721';
      if (lblPax) lblPax.textContent = 'Nombre del Huésped Principal (Titular):';
      if (inpPax) inpPax.placeholder = 'APELLIDO / NOMBRE HUÉSPED';
      if (lblDoc) lblDoc.textContent = 'Doc. Identidad / Pasaporte:';
      if (lblFare) lblFare.textContent = 'Tarifa Total Hospedaje / Alojamiento:';

      const checkInVal = data.checkIn || data.departureDate || '';
      const checkOutVal = data.checkOut || data.returnDate || '';
      const nightsVal = data.nights || '1';

      container.innerHTML = `
        <div style="font-weight: 700; font-size: 0.84rem; color: #059669; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="building-2"></i> Formato de Hospedaje / Reserva de Hotel</span>
          <span class="badge badge-emerald">Hotel</span>
        </div>
        <div class="form-row" style="grid-template-columns: 2fr 1fr; gap: 8px;">
          <div>
            <label class="form-label">Nombre del Hotel / Resort:</label>
            <input type="text" id="uni-h-hotel-name" class="form-control font-bold" placeholder="Ej: Hotel Los Tajibos & Convention Center" value="${data.hotelName || ''}">
          </div>
          <div>
            <label class="form-label">Ciudad / Destino:</label>
            <input type="text" id="uni-h-hotel-city" class="form-control" placeholder="Ej: Santa Cruz de la Sierra" value="${data.hotelCity || ''}">
          </div>
        </div>
        <div class="form-row" style="grid-template-columns: 1fr 1fr 0.8fr; gap: 8px; margin-top: 8px;">
          <div>
            <label class="form-label">Fecha Check-In (Entrada):</label>
            <input type="date" id="uni-h-checkin" class="form-control font-mono" value="${checkInVal}">
          </div>
          <div>
            <label class="form-label">Fecha Check-Out (Salida):</label>
            <input type="date" id="uni-h-checkout" class="form-control font-mono" value="${checkOutVal}">
          </div>
          <div>
            <label class="form-label">Noches de Estadía:</label>
            <input type="number" id="uni-h-nights" class="form-control font-mono font-bold" min="1" value="${nightsVal}">
          </div>
        </div>
        <div class="form-row" style="grid-template-columns: 1.2fr 1.2fr 1fr; gap: 8px; margin-top: 8px;">
          <div>
            <label class="form-label">Tipo de Habitación:</label>
            <select id="uni-h-room-type" class="form-control">
              <option value="DOBLE ESTÁNDAR" ${(data.roomType === 'DOBLE ESTÁNDAR') ? 'selected' : ''}>Doble Estándar</option>
              <option value="MATRIMONIAL / KING" ${(data.roomType === 'MATRIMONIAL / KING') ? 'selected' : ''}>Matrimonial / King</option>
              <option value="INDIVIDUAL / SINGLE" ${(data.roomType === 'INDIVIDUAL / SINGLE') ? 'selected' : ''}>Individual / Single</option>
              <option value="TWIN (2 CAMAS)" ${(data.roomType === 'TWIN (2 CAMAS)') ? 'selected' : ''}>Twin (2 Camas Separadas)</option>
              <option value="TRIPLE" ${(data.roomType === 'TRIPLE') ? 'selected' : ''}>Triple</option>
              <option value="SUITE EJECUTIVA" ${(data.roomType === 'SUITE EJECUTIVA') ? 'selected' : ''}>Suite Ejecutiva</option>
              <option value="HABITACIÓN FAMILIAR" ${(data.roomType === 'HABITACIÓN FAMILIAR') ? 'selected' : ''}>Familiar</option>
            </select>
          </div>
          <div>
            <label class="form-label">Régimen de Alimentación:</label>
            <select id="uni-h-board" class="form-control">
              <option value="DESAYUNO INCLUIDO (BB)" ${(data.boardBasis === 'DESAYUNO INCLUIDO (BB)') ? 'selected' : ''}>Desayuno Incluido (BB)</option>
              <option value="SOLO HABITACIÓN (EP)" ${(data.boardBasis === 'SOLO HABITACIÓN (EP)') ? 'selected' : ''}>Solo Habitación (EP)</option>
              <option value="MEDIA PENSIÓN (MAP)" ${(data.boardBasis === 'MEDIA PENSIÓN (MAP)') ? 'selected' : ''}>Media Pensión (MAP)</option>
              <option value="PENSIÓN COMPLETA (FAP)" ${(data.boardBasis === 'PENSIÓN COMPLETA (FAP)') ? 'selected' : ''}>Pensión Completa (FAP)</option>
              <option value="TODO INCLUIDO (ALL INCLUSIVE)" ${(data.boardBasis === 'TODO INCLUIDO (ALL INCLUSIVE)') ? 'selected' : ''}>Todo Incluido (All Inclusive)</option>
            </select>
          </div>
          <div>
            <label class="form-label">Cantidad Huéspedes:</label>
            <input type="text" id="uni-h-guests" class="form-control" placeholder="Ej: 2 Adultos" value="${data.guestsCount || '2 Adultos'}">
          </div>
        </div>
      `;
    } else if (srv === 'PAQUETE_TURISTICO') {
      if (lblVoucher) lblVoucher.textContent = 'Nro Reserva / Voucher Paquete:';
      if (inpVoucher) inpVoucher.placeholder = 'Ej: PKG-2026-88';
      if (lblPax) lblPax.textContent = 'Titular del Paquete / Grupo:';
      if (inpPax) inpPax.placeholder = 'APELLIDO / NOMBRE TITULAR';
      if (lblDoc) lblDoc.textContent = 'Doc. Identidad / Pasaporte:';
      if (lblFare) lblFare.textContent = 'Tarifa Base Paquete Turístico:';

      container.innerHTML = `
        <div style="font-weight: 700; font-size: 0.84rem; color: #d97706; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="compass"></i> Formato de Paquete Turístico & Tours</span>
          <span class="badge badge-amber">Paquete</span>
        </div>
        <div class="form-row" style="grid-template-columns: 2fr 1fr; gap: 8px;">
          <div>
            <label class="form-label">Nombre del Paquete / Tour:</label>
            <input type="text" id="uni-pkg-name" class="form-control font-bold" placeholder="Ej: Cancún Mágico 5D/4N Todo Incluido" value="${data.tourName || ''}">
          </div>
          <div>
            <label class="form-label">Destino Principal:</label>
            <input type="text" id="uni-pkg-dest" class="form-control" placeholder="Ej: Cancún, México" value="${data.destination || ''}">
          </div>
        </div>
        <div class="form-row" style="grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 8px;">
          <div>
            <label class="form-label">Fecha Inicio del Tour:</label>
            <input type="date" id="uni-pkg-start" class="form-control font-mono" value="${data.tourStartDate || data.departureDate || ''}">
          </div>
          <div>
            <label class="form-label">Fecha Fin del Tour:</label>
            <input type="date" id="uni-pkg-end" class="form-control font-mono" value="${data.tourEndDate || data.returnDate || ''}">
          </div>
          <div>
            <label class="form-label">Cantidad Pasajeros (Pax):</label>
            <input type="text" id="uni-pkg-pax" class="form-control" placeholder="Ej: 2 Pasajeros" value="${data.paxCount || '2 Pax'}">
          </div>
        </div>
        <div class="form-group" style="margin-top: 8px;">
          <label class="form-label">Servicios Incluidos en el Paquete:</label>
          <input type="text" id="uni-pkg-includes" class="form-control" placeholder="Ej: Vuelos + Hotel 4* Todo Incluido + Traslados + Tour Chichén Itzá" value="${data.includes || ''}">
        </div>
      `;
    } else if (srv === 'PAQUETE_CRUCERO') {
      if (lblVoucher) lblVoucher.textContent = 'Booking ID / Reserva Naviera:';
      if (inpVoucher) inpVoucher.placeholder = 'Ej: RCI-884920';
      if (lblPax) lblPax.textContent = 'Huésped Principal (Cabina):';
      if (inpPax) inpPax.placeholder = 'APELLIDO / NOMBRE HUÉSPED';
      if (lblDoc) lblDoc.textContent = 'Nro Pasaporte Titular:';
      if (lblFare) lblFare.textContent = 'Tarifa Base Cabina / Crucero:';

      container.innerHTML = `
        <div style="font-weight: 700; font-size: 0.84rem; color: #0284c7; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="anchor"></i> Formato de Paquete Crucero Marítimo</span>
          <span class="badge badge-blue">Crucero</span>
        </div>
        <div class="form-row" style="grid-template-columns: 1.5fr 1fr; gap: 8px;">
          <div>
            <label class="form-label">Naviera y Barco:</label>
            <input type="text" id="uni-cru-ship" class="form-control font-bold" placeholder="Ej: Royal Caribbean - Symphony of the Seas" value="${data.cruiseShip || ''}">
          </div>
          <div>
            <label class="form-label">Puerto de Embarque:</label>
            <input type="text" id="uni-cru-port" class="form-control" placeholder="Ej: PortMiami, Florida" value="${data.departurePort || ''}">
          </div>
        </div>
        <div class="form-row" style="grid-template-columns: 2fr 1fr; gap: 8px; margin-top: 8px;">
          <div>
            <label class="form-label">Itinerario / Ruta de Navegación:</label>
            <input type="text" id="uni-cru-itin" class="form-control" placeholder="Ej: Miami - Nassau - CocoCay - Cozumel - Miami" value="${data.cruiseItinerary || ''}">
          </div>
          <div>
            <label class="form-label">Categoría y Nro Cabina:</label>
            <input type="text" id="uni-cru-cabin" class="form-control font-mono" placeholder="Ej: Balcón al Mar #8240" value="${data.cabinType || ''}">
          </div>
        </div>
        <div class="form-row" style="grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 8px;">
          <div>
            <label class="form-label">Fecha de Embarque:</label>
            <input type="date" id="uni-cru-embark" class="form-control font-mono" value="${data.embarkDate || data.departureDate || ''}">
          </div>
          <div>
            <label class="form-label">Fecha de Desembarque:</label>
            <input type="date" id="uni-cru-disembark" class="form-control font-mono" value="${data.disembarkDate || data.returnDate || ''}">
          </div>
          <div>
            <label class="form-label">Régimen a Bordo:</label>
            <select id="uni-cru-board" class="form-control">
              <option value="PENSIÓN COMPLETA" ${(data.cruiseBoard === 'PENSIÓN COMPLETA') ? 'selected' : ''}>Pensión Completa</option>
              <option value="ALL INCLUSIVE CON BEBIDAS" ${(data.cruiseBoard === 'ALL INCLUSIVE CON BEBIDAS') ? 'selected' : ''}>All Inclusive + Bebidas</option>
            </select>
          </div>
        </div>
      `;
    } else if (srv === 'PAQUETE_CONCIERTO') {
      if (lblVoucher) lblVoucher.textContent = 'Código Entrada / Voucher Concierto:';
      if (inpVoucher) inpVoucher.placeholder = 'Ej: CCT-COLDPLAY-884';
      if (lblPax) lblPax.textContent = 'Asistente / Titular de Entradas:';
      if (inpPax) inpPax.placeholder = 'APELLIDO / NOMBRE ASISTENTE';
      if (lblDoc) lblDoc.textContent = 'Doc. Identidad / CI:';
      if (lblFare) lblFare.textContent = 'Costo Total Entradas / Paquete:';

      container.innerHTML = `
        <div style="font-weight: 700; font-size: 0.84rem; color: #8b5cf6; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="music"></i> Formato de Paquete Concierto & Eventos</span>
          <span class="badge badge-purple">Concierto</span>
        </div>
        <div class="form-row" style="grid-template-columns: 1.5fr 1.5fr; gap: 8px;">
          <div>
            <label class="form-label">Artista / Concierto / Festival:</label>
            <input type="text" id="uni-cct-artist" class="form-control font-bold" placeholder="Ej: Coldplay - Music of the Spheres" value="${data.concertArtist || ''}">
          </div>
          <div>
            <label class="form-label">Ciudad y Recinto / Estadio:</label>
            <input type="text" id="uni-cct-venue" class="form-control" placeholder="Ej: Lima - Estadio Nacional" value="${data.concertVenue || ''}">
          </div>
        </div>
        <div class="form-row" style="grid-template-columns: 1fr 1.2fr 0.8fr; gap: 8px; margin-top: 8px;">
          <div>
            <label class="form-label">Fecha del Concierto:</label>
            <input type="date" id="uni-cct-date" class="form-control font-mono" value="${data.concertDate || data.departureDate || ''}">
          </div>
          <div>
            <label class="form-label">Sector / Zona de Entrada:</label>
            <input type="text" id="uni-cct-sector" class="form-control font-bold" placeholder="Ej: Campo A VIP Platino" value="${data.ticketSector || ''}">
          </div>
          <div>
            <label class="form-label">Cantidad Entradas:</label>
            <input type="number" id="uni-cct-qty" class="form-control font-mono font-bold" min="1" value="${data.concertQty || '1'}">
          </div>
        </div>
        <div class="form-group" style="margin-top: 8px;">
          <label class="form-label">Servicios Adicionales Incluidos:</label>
          <input type="text" id="uni-cct-includes" class="form-control" placeholder="Ej: Entrada oficial + Traslado hotel-estadio-hotel + Merchandising" value="${data.concertIncludes || ''}">
        </div>
      `;
    } else if (srv === 'ASESORAMIENTO_VISAS') {
      if (lblVoucher) lblVoucher.textContent = 'Nro Formulario / DS-160 / Expediente:';
      if (inpVoucher) inpVoucher.placeholder = 'Ej: AA00C1D2E3 o EXP-USA-2026';
      if (lblPax) lblPax.textContent = 'Nombre del Solicitante / Titular:';
      if (inpPax) inpPax.placeholder = 'APELLIDO / NOMBRE SOLICITANTE';
      if (lblDoc) lblDoc.textContent = 'Nro Pasaporte (Vigente):';
      if (lblFare) lblFare.textContent = 'Honorarios Asesoría / Arancel MRV:';

      container.innerHTML = `
        <div style="font-weight: 700; font-size: 0.84rem; color: #dc2626; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="file-check"></i> Formato de Asesoramiento de Visas & Trámites Consulares</span>
          <span class="badge badge-danger">Visas</span>
        </div>
        <div class="form-row" style="grid-template-columns: 1.2fr 1.2fr; gap: 8px;">
          <div>
            <label class="form-label">País de Destino:</label>
            <select id="uni-visa-country" class="form-control font-bold">
              <option value="ESTADOS UNIDOS (EE.UU.)" ${(data.visaCountry === 'ESTADOS UNIDOS (EE.UU.)') ? 'selected' : ''}>Estados Unidos (EE.UU.)</option>
              <option value="CANADÁ" ${(data.visaCountry === 'CANADÁ') ? 'selected' : ''}>Canadá</option>
              <option value="ESPACIO SCHENGEN (EUROPA)" ${(data.visaCountry === 'ESPACIO SCHENGEN (EUROPA)') ? 'selected' : ''}>Espacio Schengen (Europa)</option>
              <option value="REINO UNIDO" ${(data.visaCountry === 'REINO UNIDO') ? 'selected' : ''}>Reino Unido</option>
              <option value="AUSTRALIA" ${(data.visaCountry === 'AUSTRALIA') ? 'selected' : ''}>Australia</option>
              <option value="OTRO PAÍS" ${(data.visaCountry === 'OTRO PAÍS') ? 'selected' : ''}>Otro País</option>
            </select>
          </div>
          <div>
            <label class="form-label">Tipo de Visa Solicitada:</label>
            <input type="text" id="uni-visa-type" class="form-control" placeholder="Ej: B1/B2 Turismo y Negocios, F1 Estudiante" value="${data.visaType || 'B1/B2 TURISMO Y NEGOCIOS'}">
          </div>
        </div>
        <div class="form-row" style="grid-template-columns: 1.5fr 1fr 0.8fr; gap: 8px; margin-top: 8px;">
          <div>
            <label class="form-label">Consulado / Embajada Responsable:</label>
            <input type="text" id="uni-visa-consulate" class="form-control" placeholder="Ej: Sección Consular Embajada EE.UU. La Paz" value="${data.consulate || 'EMBAJADA DE EE.UU. EN LA PAZ'}">
          </div>
          <div>
            <label class="form-label">Fecha de Cita Consular:</label>
            <input type="date" id="uni-visa-date" class="form-control font-mono" value="${data.appointmentDate || ''}">
          </div>
          <div>
            <label class="form-label">Hora Cita:</label>
            <input type="time" id="uni-visa-time" class="form-control font-mono" value="${data.appointmentTime || '08:30'}">
          </div>
        </div>
        <div class="form-row" style="grid-template-columns: 1.2fr 2fr; gap: 8px; margin-top: 8px;">
          <div>
            <label class="form-label">Estado del Trámite:</label>
            <select id="uni-visa-status" class="form-control">
              <option value="LLENADO DE FORMULARIO" ${(data.visaStatus === 'LLENADO DE FORMULARIO') ? 'selected' : ''}>Llenado de Formulario</option>
              <option value="CITA AGENDADA" ${(data.visaStatus === 'CITA AGENDADA') ? 'selected' : ''}>Cita Agendada</option>
              <option value="EN ESPERA DE ENTREVISTA" ${(data.visaStatus === 'EN ESPERA DE ENTREVISTA') ? 'selected' : ''}>En Espera de Entrevista</option>
              <option value="VISA APROBADA" ${(data.visaStatus === 'VISA APROBADA') ? 'selected' : ''}>Visa Aprobada</option>
            </select>
          </div>
          <div>
            <label class="form-label">Servicios Incluidos en la Asesoría:</label>
            <input type="text" id="uni-visa-details" class="form-control" placeholder="Ej: Llenado DS-160, pago de arancel MRV, armado de carpeta y simulacro" value="${data.visaDetails || 'Llenado DS-160, pago arancel MRV, armado carpeta y preparación de entrevista'}">
          </div>
        </div>
      `;
    } else if (srv === 'CERTIFICACION_FA') {
      if (lblVoucher) lblVoucher.textContent = 'Nro Registro / Certificado Internacional:';
      if (inpVoucher) inpVoucher.placeholder = 'Ej: IFA-884920';
      if (lblPax) lblPax.textContent = 'Nombre del Postulante / Titular Certificado:';
      if (inpPax) inpPax.placeholder = 'APELLIDO / NOMBRE POSTULANTE';
      if (lblDoc) lblDoc.textContent = 'Doc. Identidad / Licencia Aeronáutica:';
      if (lblFare) lblFare.textContent = 'Costo Matrícula / Certificación:';

      container.innerHTML = `
        <div style="font-weight: 700; font-size: 0.84rem; color: #4338ca; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="award"></i> Formato de Certificación Internacional FA</span>
          <span class="badge badge-purple">Certificación</span>
        </div>
        <div class="form-row" style="grid-template-columns: 2fr 1fr; gap: 8px;">
          <div>
            <label class="form-label">Nombre del Curso / Certificación:</label>
            <input type="text" id="uni-fa-name" class="form-control font-bold" placeholder="Ej: Formador de Tripulantes de Cabina (FA)" value="${data.certCourse || ''}">
          </div>
          <div>
            <label class="form-label">Entidad Certificadora:</label>
            <input type="text" id="uni-fa-entity" class="form-control" placeholder="Ej: Federación Aeronáutica Internacional" value="${data.certInstitution || 'FEDERACIÓN AERONÁUTICA INTERNACIONAL'}">
          </div>
        </div>
        <div class="form-row" style="grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 8px;">
          <div>
            <label class="form-label">Fecha Acreditación / Examen:</label>
            <input type="date" id="uni-fa-date" class="form-control font-mono" value="${data.certDate || ''}">
          </div>
          <div>
            <label class="form-label">Carga Horaria Académica:</label>
            <input type="text" id="uni-fa-hours" class="form-control" placeholder="Ej: 120 Horas Académicas" value="${data.certHours || '120 Horas Académicas'}">
          </div>
          <div>
            <label class="form-label">Vigencia / Vencimiento:</label>
            <input type="text" id="uni-fa-validity" class="form-control" placeholder="Ej: Vigencia 2 Años" value="${data.certValidity || 'Vigencia 2 Años'}">
          </div>
        </div>
      `;
    } else if (srv === 'RENT_A_CAR') {
      if (lblVoucher) lblVoucher.textContent = 'Nro Confirmación / Reserva Rent a Car:';
      if (inpVoucher) inpVoucher.placeholder = 'Ej: HZ-994820';
      if (lblPax) lblPax.textContent = 'Nombre del Conductor Principal (Titular):';
      if (inpPax) inpPax.placeholder = 'APELLIDO / NOMBRE CONDUCTOR';
      if (lblDoc) lblDoc.textContent = 'Doc. Identidad / Licencia de Conducir:';
      if (lblFare) lblFare.textContent = 'Tarifa Alquiler de Vehículo:';

      container.innerHTML = `
        <div style="font-weight: 700; font-size: 0.84rem; color: #0284c7; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="car"></i> Formato de Alquiler de Vehículo (Rent a Car)</span>
          <span class="badge badge-blue">Rent a Car</span>
        </div>
        <div class="form-row" style="grid-template-columns: 1.2fr 1.8fr; gap: 8px;">
          <div>
            <label class="form-label">Empresa Arrendadora:</label>
            <input type="text" id="uni-car-comp" class="form-control font-bold" placeholder="Ej: Hertz Rent A Car / Avis / Alamo" value="${data.rentalCompany || ''}">
          </div>
          <div>
            <label class="form-label">Categoría y Modelo de Auto:</label>
            <input type="text" id="uni-car-cat" class="form-control" placeholder="Ej: SUV Compacta Automática - Toyota RAV4 o similar" value="${data.carCategory || ''}">
          </div>
        </div>
        <div class="form-row" style="grid-template-columns: 1.5fr 1fr; gap: 8px; margin-top: 8px;">
          <div>
            <label class="form-label">Lugar de Retiro (Pick-Up):</label>
            <input type="text" id="uni-car-pickup-loc" class="form-control" placeholder="Ej: Aeropuerto Internacional Miami (MIA)" value="${data.pickUpLocation || ''}">
          </div>
          <div>
            <label class="form-label">Fecha y Hora Retiro:</label>
            <input type="text" id="uni-car-pickup-date" class="form-control font-mono" placeholder="YYYY-MM-DD HH:MM" value="${data.pickUpDate || ''}">
          </div>
        </div>
        <div class="form-row" style="grid-template-columns: 1.5fr 1fr; gap: 8px; margin-top: 8px;">
          <div>
            <label class="form-label">Lugar de Devolución (Drop-Off):</label>
            <input type="text" id="uni-car-dropoff-loc" class="form-control" placeholder="Ej: Aeropuerto Orlando (MCO)" value="${data.dropOffLocation || ''}">
          </div>
          <div>
            <label class="form-label">Fecha y Hora Devolución:</label>
            <input type="text" id="uni-car-dropoff-date" class="form-control font-mono" placeholder="YYYY-MM-DD HH:MM" value="${data.dropOffDate || ''}">
          </div>
        </div>
        <div class="form-row" style="grid-template-columns: 2fr 1fr; gap: 8px; margin-top: 8px;">
          <div>
            <label class="form-label">Coberturas / Seguros Incluidos:</label>
            <input type="text" id="uni-car-ins" class="form-control" placeholder="Ej: CDW Daños/Robo + EP Responsabilidad Civil + Km Ilimitado" value="${data.rentalInsurance || 'CDW Cobertura por Colisión + EP Daños a Terceros + Km Ilimitado'}">
          </div>
          <div>
            <label class="form-label">Días de Alquiler:</label>
            <input type="number" id="uni-car-days" class="form-control font-mono font-bold" min="1" value="${data.rentalDays || '1'}">
          </div>
        </div>
      `;
    } else if (srv === 'SEGURO_VIAJE') {
      if (lblVoucher) lblVoucher.textContent = 'Nro de Póliza / Voucher Asistencia:';
      if (inpVoucher) inpVoucher.placeholder = 'Ej: AC-8849201 o TERRA-7749';
      if (lblPax) lblPax.textContent = 'Nombre del Asegurado Titular:';
      if (inpPax) inpPax.placeholder = 'APELLIDO / NOMBRE ASEGURADO';
      if (lblDoc) lblDoc.textContent = 'Nro Pasaporte / CI:';
      if (lblFare) lblFare.textContent = 'Prima / Costo Seguro de Viaje:';

      container.innerHTML = `
        <div style="font-weight: 700; font-size: 0.84rem; color: #059669; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="shield-check"></i> Formato de Seguro de Viaje & Asistencia al Viajero</span>
          <span class="badge badge-emerald">Seguro</span>
        </div>
        <div class="form-row" style="grid-template-columns: 1.2fr 1.8fr; gap: 8px;">
          <div>
            <label class="form-label">Compañía Aseguradora / Asistencia:</label>
            <input type="text" id="uni-ins-comp" class="form-control font-bold" placeholder="Ej: Assist Card / Universal Assistance / Terrawind" value="${data.insuranceCompany || 'ASSIST CARD'}">
          </div>
          <div>
            <label class="form-label">Plan y Monto Máximo Cobertura:</label>
            <input type="text" id="uni-ins-plan" class="form-control" placeholder="Ej: Plan AC 60 - Cobertura USD 60,000 / Cumple Schengen" value="${data.insurancePlan || 'Plan Cobertura USD 60,000 / Cumple Schengen'}">
          </div>
        </div>
        <div class="form-row" style="grid-template-columns: 1.2fr 1fr 1fr 0.6fr; gap: 8px; margin-top: 8px;">
          <div>
            <label class="form-label">Destino / Cobertura:</label>
            <input type="text" id="uni-ins-dest" class="form-control" placeholder="Ej: Europa Schengen / Mundial" value="${data.insuranceDestination || 'EUROPA SCHENGEN / MUNDIAL'}">
          </div>
          <div>
            <label class="form-label">Fecha Inicio Cobertura:</label>
            <input type="date" id="uni-ins-start" class="form-control font-mono" value="${data.coverageStartDate || data.departureDate || ''}">
          </div>
          <div>
            <label class="form-label">Fecha Fin Cobertura:</label>
            <input type="date" id="uni-ins-end" class="form-control font-mono" value="${data.coverageEndDate || data.returnDate || ''}">
          </div>
          <div>
            <label class="form-label">Días:</label>
            <input type="number" id="uni-ins-days" class="form-control font-mono font-bold" min="1" value="${data.coverageDays || '15'}">
          </div>
        </div>
        <div class="form-group" style="margin-top: 8px;">
          <label class="form-label">Línea de Emergencia 24 Horas / Central de Asistencia:</label>
          <input type="text" id="uni-ins-emergency" class="form-control" placeholder="Ej: +1 305 381 9999 / Whatsapp +54 911 3221 4444" value="${data.insuranceEmergency || 'Central Internacional +1 305 381 9999'}">
        </div>
      `;
    } else {
      // OTRO o Servicio Personalizado
      if (lblVoucher) lblVoucher.textContent = 'Nro Comprobante / Referencia:';
      if (inpVoucher) inpVoucher.placeholder = 'Ej: REF-99482';
      if (lblPax) lblPax.textContent = 'Nombre del Beneficiario / Titular:';
      if (inpPax) inpPax.placeholder = 'APELLIDO / NOMBRE BENEFICIARIO';
      if (lblDoc) lblDoc.textContent = 'Doc. Identidad / Pasaporte:';
      if (lblFare) lblFare.textContent = 'Tarifa Base del Servicio:';

      container.innerHTML = `
        <div style="font-weight: 700; font-size: 0.84rem; color: #475569; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="layers"></i> Formato de Servicio Personalizado</span>
          <span class="badge badge-slate">Servicio</span>
        </div>
        <div class="form-row" style="grid-template-columns: 2fr 1fr; gap: 8px;">
          <div>
            <label class="form-label">Concepto / Detalle Específico del Servicio:</label>
            <input type="text" id="uni-oth-concept" class="form-control font-bold" placeholder="Ej: Traslado Privado Aeropuerto - Hotel Viru Viru" value="${data.customDetails || data.description || ''}">
          </div>
          <div>
            <label class="form-label">Lugar / Ubicación:</label>
            <input type="text" id="uni-oth-loc" class="form-control" placeholder="Ej: Santa Cruz de la Sierra" value="${data.customLocation || ''}">
          </div>
        </div>
        <div class="form-row" style="grid-template-columns: 1fr 2fr; gap: 8px; margin-top: 8px;">
          <div>
            <label class="form-label">Fecha del Servicio:</label>
            <input type="date" id="uni-oth-date" class="form-control font-mono" value="${data.customDates || ''}">
          </div>
          <div>
            <label class="form-label">Condiciones / Observaciones Especiales:</label>
            <input type="text" id="uni-oth-notes" class="form-control" placeholder="Ej: Incluye espera con cartel y asistencia con equipaje" value="${data.customNotes || ''}">
          </div>
        </div>
      `;
    }

    if (window.lucide) window.lucide.createIcons();
    this.bindDynamicFieldEvents(srv);
  }

  bindDynamicFieldEvents(srv) {
    const container = document.getElementById('uni-service-specific-container');
    if (!container) return;

    // Calcular noches hotel automáticamente si cambian fechas
    const checkin = document.getElementById('uni-h-checkin');
    const checkout = document.getElementById('uni-h-checkout');
    const nights = document.getElementById('uni-h-nights');
    if (checkin && checkout && nights) {
      const calcNights = () => {
        if (checkin.value && checkout.value) {
          const d1 = new Date(checkin.value);
          const d2 = new Date(checkout.value);
          const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
          if (diff > 0) nights.value = diff;
        }
        this.updateServiceSummaryText(srv);
      };
      checkin.addEventListener('change', calcNights);
      checkout.addEventListener('change', calcNights);
    }

    // Calcular días seguro
    const insStart = document.getElementById('uni-ins-start');
    const insEnd = document.getElementById('uni-ins-end');
    const insDays = document.getElementById('uni-ins-days');
    if (insStart && insEnd && insDays) {
      const calcDays = () => {
        if (insStart.value && insEnd.value) {
          const d1 = new Date(insStart.value);
          const d2 = new Date(insEnd.value);
          const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
          if (diff > 0) insDays.value = diff;
        }
        this.updateServiceSummaryText(srv);
      };
      insStart.addEventListener('change', calcDays);
      insEnd.addEventListener('change', calcDays);
    }

    const allInputs = container.querySelectorAll('input, select');
    allInputs.forEach(inp => {
      inp.addEventListener('input', () => this.updateServiceSummaryText(srv));
      inp.addEventListener('change', () => this.updateServiceSummaryText(srv));
    });
  }

  updateServiceSummaryText(srv) {
    const descInput = document.getElementById('uni-description');
    if (!descInput) return;

    const currentDetails = this.getServiceSpecificValues(srv);
    const text = this.getCompiledDescription(srv, currentDetails);
    if (text) {
      descInput.value = text;
    }
  }

  getCompiledDescription(srv, sd = {}) {
    srv = (srv || document.getElementById('uni-service-type')?.value || 'BOLETO_AEREO').toUpperCase();
    if (srv === 'BOLETO_AEREO' || srv === 'BOLETO_GDS') {
      const route = sd.flightRoute || '';
      const pnr = sd.pnrCode || '';
      const cabin = sd.cabinClass || 'ECONÓMICA';
      const dep = sd.flightDepDate || '';
      const ret = sd.flightRetDate || '';
      return `Boleto Aéreo ${route ? `Ruta: ${route}` : ''} ${dep ? `Salida: ${dep}` : ''} ${ret ? `Retorno: ${ret}` : ''} [${cabin}] ${pnr ? `(PNR: ${pnr})` : ''}`.trim();
    } else if (srv === 'HOTEL' || srv === 'HOTEL_HOSPEDAJE') {
      const hotel = sd.hotelName || '';
      const city = sd.hotelCity || '';
      const inDate = sd.checkIn || '';
      const outDate = sd.checkOut || '';
      const nights = sd.nights || '1';
      const room = sd.roomType || '';
      const board = sd.boardBasis || '';
      return `Hotel ${hotel} (${city}) - In: ${inDate} Out: ${outDate} (${nights} Noches) - Hab: ${room} - ${board}`.trim();
    } else if (srv === 'PAQUETE_TURISTICO') {
      const pkg = sd.tourName || '';
      const dest = sd.destination || '';
      const start = sd.tourStartDate || '';
      const end = sd.tourEndDate || '';
      const pax = sd.paxCount || '';
      return `Paquete ${pkg} (${dest}) - Del ${start} al ${end} (${pax})`.trim();
    } else if (srv === 'PAQUETE_CRUCERO') {
      const ship = sd.cruiseShip || '';
      const itin = sd.cruiseItinerary || '';
      const cabin = sd.cabinType || '';
      const embark = sd.embarkDate || '';
      return `Crucero ${ship} - Ruta: ${itin} - Cabina: ${cabin} - Embarque: ${embark}`.trim();
    } else if (srv === 'PAQUETE_CONCIERTO') {
      const artist = sd.concertArtist || '';
      const venue = sd.concertVenue || '';
      const date = sd.concertDate || '';
      const sector = sd.ticketSector || '';
      return `Concierto ${artist} (${venue}) - Fecha: ${date} - Sector: ${sector}`.trim();
    } else if (srv === 'ASESORAMIENTO_VISAS') {
      const country = sd.visaCountry || '';
      const type = sd.visaType || '';
      const date = sd.appointmentDate || '';
      const consulate = sd.consulate || '';
      return `Asesoría Visa ${country} (${type}) - Cita: ${date} (${consulate})`.trim();
    } else if (srv === 'CERTIFICACION_FA') {
      const name = sd.certCourse || '';
      const entity = sd.certInstitution || '';
      const hours = sd.certHours || '';
      return `Certificación ${name} (${entity}) - ${hours}`.trim();
    } else if (srv === 'RENT_A_CAR') {
      const comp = sd.rentalCompany || '';
      const cat = sd.carCategory || '';
      const pick = sd.pickUpLocation || '';
      const days = sd.rentalDays || '1';
      return `Alquiler ${comp} - ${cat} - Retiro: ${pick} (${days} Días)`.trim();
    } else if (srv === 'SEGURO_VIAJE') {
      const comp = sd.insuranceCompany || '';
      const plan = sd.insurancePlan || '';
      const days = sd.coverageDays || '15';
      const dest = sd.insuranceDestination || '';
      return `Seguro ${comp} - ${plan} - Destino: ${dest} (${days} Días)`.trim();
    } else {
      const concept = sd.customDetails || '';
      const loc = sd.customLocation || '';
      const date = sd.customDates || '';
      return `Servicio: ${concept} ${loc ? `(${loc})` : ''} ${date ? `Fecha: ${date}` : ''}`.trim();
    }
  }

  getServiceSpecificValues(srv) {
    srv = (srv || document.getElementById('uni-service-type')?.value || 'BOLETO_AEREO').toUpperCase();
    if (srv === 'BOLETO_AEREO' || srv === 'BOLETO_GDS') {
      return {
        flightRoute: document.getElementById('uni-f-route')?.value || '',
        pnrCode: document.getElementById('uni-f-pnr')?.value || '',
        cabinClass: document.getElementById('uni-f-cabin')?.value || 'ECONÓMICA',
        flightDepDate: document.getElementById('uni-f-flight-dep')?.value || '',
        flightRetDate: document.getElementById('uni-f-flight-ret')?.value || '',
        flightNumber: document.getElementById('uni-f-flight-num')?.value || ''
      };
    } else if (srv === 'HOTEL' || srv === 'HOTEL_HOSPEDAJE') {
      return {
        hotelName: document.getElementById('uni-h-hotel-name')?.value || '',
        hotelCity: document.getElementById('uni-h-hotel-city')?.value || '',
        checkIn: document.getElementById('uni-h-checkin')?.value || '',
        checkOut: document.getElementById('uni-h-checkout')?.value || '',
        nights: document.getElementById('uni-h-nights')?.value || '1',
        roomType: document.getElementById('uni-h-room-type')?.value || '',
        boardBasis: document.getElementById('uni-h-board')?.value || '',
        guestsCount: document.getElementById('uni-h-guests')?.value || ''
      };
    } else if (srv === 'PAQUETE_TURISTICO') {
      return {
        tourName: document.getElementById('uni-pkg-name')?.value || '',
        destination: document.getElementById('uni-pkg-dest')?.value || '',
        tourStartDate: document.getElementById('uni-pkg-start')?.value || '',
        tourEndDate: document.getElementById('uni-pkg-end')?.value || '',
        paxCount: document.getElementById('uni-pkg-pax')?.value || '',
        includes: document.getElementById('uni-pkg-includes')?.value || ''
      };
    } else if (srv === 'PAQUETE_CRUCERO') {
      return {
        cruiseShip: document.getElementById('uni-cru-ship')?.value || '',
        departurePort: document.getElementById('uni-cru-port')?.value || '',
        cruiseItinerary: document.getElementById('uni-cru-itin')?.value || '',
        cabinType: document.getElementById('uni-cru-cabin')?.value || '',
        embarkDate: document.getElementById('uni-cru-embark')?.value || '',
        disembarkDate: document.getElementById('uni-cru-disembark')?.value || '',
        cruiseBoard: document.getElementById('uni-cru-board')?.value || ''
      };
    } else if (srv === 'PAQUETE_CONCIERTO') {
      return {
        concertArtist: document.getElementById('uni-cct-artist')?.value || '',
        concertVenue: document.getElementById('uni-cct-venue')?.value || '',
        concertDate: document.getElementById('uni-cct-date')?.value || '',
        ticketSector: document.getElementById('uni-cct-sector')?.value || '',
        concertQty: document.getElementById('uni-cct-qty')?.value || '1',
        concertIncludes: document.getElementById('uni-cct-includes')?.value || ''
      };
    } else if (srv === 'ASESORAMIENTO_VISAS') {
      return {
        visaCountry: document.getElementById('uni-visa-country')?.value || '',
        visaType: document.getElementById('uni-visa-type')?.value || '',
        consulate: document.getElementById('uni-visa-consulate')?.value || '',
        appointmentDate: document.getElementById('uni-visa-date')?.value || '',
        appointmentTime: document.getElementById('uni-visa-time')?.value || '',
        visaStatus: document.getElementById('uni-visa-status')?.value || '',
        visaDetails: document.getElementById('uni-visa-details')?.value || ''
      };
    } else if (srv === 'CERTIFICACION_FA') {
      return {
        certCourse: document.getElementById('uni-fa-name')?.value || '',
        certInstitution: document.getElementById('uni-fa-entity')?.value || '',
        certDate: document.getElementById('uni-fa-date')?.value || '',
        certHours: document.getElementById('uni-fa-hours')?.value || '',
        certValidity: document.getElementById('uni-fa-validity')?.value || ''
      };
    } else if (srv === 'RENT_A_CAR') {
      return {
        rentalCompany: document.getElementById('uni-car-comp')?.value || '',
        carCategory: document.getElementById('uni-car-cat')?.value || '',
        pickUpLocation: document.getElementById('uni-car-pickup-loc')?.value || '',
        pickUpDate: document.getElementById('uni-car-pickup-date')?.value || '',
        dropOffLocation: document.getElementById('uni-car-dropoff-loc')?.value || '',
        dropOffDate: document.getElementById('uni-car-dropoff-date')?.value || '',
        rentalInsurance: document.getElementById('uni-car-ins')?.value || '',
        rentalDays: document.getElementById('uni-car-days')?.value || '1'
      };
    } else if (srv === 'SEGURO_VIAJE') {
      return {
        insuranceCompany: document.getElementById('uni-ins-comp')?.value || '',
        insurancePlan: document.getElementById('uni-ins-plan')?.value || '',
        insuranceDestination: document.getElementById('uni-ins-dest')?.value || '',
        coverageStartDate: document.getElementById('uni-ins-start')?.value || '',
        coverageEndDate: document.getElementById('uni-ins-end')?.value || '',
        coverageDays: document.getElementById('uni-ins-days')?.value || '15',
        insuranceEmergency: document.getElementById('uni-ins-emergency')?.value || ''
      };
    } else {
      return {
        customDetails: document.getElementById('uni-oth-concept')?.value || '',
        customLocation: document.getElementById('uni-oth-loc')?.value || '',
        customDates: document.getElementById('uni-oth-date')?.value || '',
        customNotes: document.getElementById('uni-oth-notes')?.value || ''
      };
    }
  }

  saveUnifiedOperation(e) {
    if (e && e.preventDefault) e.preventDefault();

    const data = window.db.get();
    const serviceType = document.getElementById('uni-service-type').value;
    const issueDate = document.getElementById('uni-issue-date').value || new Date().toISOString().split('T')[0];
    const passengerName = (document.getElementById('uni-pax-name').value || '').trim().toUpperCase();
    const passengerDoc = (document.getElementById('uni-pax-doc').value || '').trim().toUpperCase();
    const serviceDetails = this.getServiceSpecificValues(serviceType);
    let description = (document.getElementById('uni-description').value || '').trim();
    if (!description) {
      description = this.getCompiledDescription(serviceType, serviceDetails);
    }
    const voucherNumber = (document.getElementById('uni-voucher-number').value || '').trim() || ('EM-' + Date.now().toString().slice(-6));
    
    const clientId = document.getElementById('uni-client-select').value;
    const providerId = document.getElementById('uni-provider-select').value;

    if (!passengerName) {
      window.app.showToast('Debe ingresar el nombre del pasajero o titular', 'warning');
      return;
    }
    if (!clientId || clientId === '__NEW_CLIENT__') {
      window.app.showToast('Debe seleccionar un cliente para facturar', 'warning');
      return;
    }
    if (!providerId || providerId === '__NEW_PROV__') {
      window.app.showToast('Debe seleccionar un proveedor u operador responsable', 'warning');
      return;
    }

    const fare = parseFloat(document.getElementById('uni-fare-amount').value) || 0;
    const fee = parseFloat(document.getElementById('uni-fee-amount').value) || 0;
    const provCommRate = parseFloat(document.getElementById('uni-prov-comm-rate').value) || 0;
    const provCommAmount = fare * (provCommRate / 100);
    const netCost = parseFloat(document.getElementById('uni-net-cost').value) || (fare - provCommAmount);
    const totalVenta = fare + fee;
    const paymentTerm = document.getElementById('uni-payment-term').value;
    const depositAccount = document.getElementById('uni-deposit-account').value;

    const client = (data.accounts || []).find(a => a.id === clientId) || { name: 'Cliente' };
    const provider = (data.accounts || []).find(a => a.id === providerId) || { name: 'Proveedor' };

    // Fechas normalizadas para elevación
    const depDate = serviceDetails.flightDepDate || serviceDetails.checkIn || serviceDetails.tourStartDate || serviceDetails.embarkDate || serviceDetails.concertDate || serviceDetails.appointmentDate || serviceDetails.certDate || serviceDetails.pickUpDate || serviceDetails.coverageStartDate || serviceDetails.customDates || issueDate;
    const retDate = serviceDetails.flightRetDate || serviceDetails.checkOut || serviceDetails.tourEndDate || serviceDetails.disembarkDate || serviceDetails.dropOffDate || serviceDetails.coverageEndDate || depDate;

    // EDICIÓN DE OPERACIÓN EXISTENTE
    if (this.editingOperationId) {
      const existingNd = (data.debitNotes || []).find(n => n.id === this.editingOperationId);
      if (existingNd) {
        existingNd.issueDate = issueDate;
        existingNd.accountId = clientId;
        existingNd.accountName = client.name;
        existingNd.accountNit = client.docNumber || '';
        existingNd.paymentTerm = paymentTerm;
        existingNd.totalAmountBob = totalVenta;
        existingNd.balanceBob = paymentTerm === 'AL_CONTADO' ? 0 : totalVenta;
        existingNd.status = paymentTerm === 'AL_CONTADO' ? 'PAGADA' : 'IMPAGA';
        
        if (!existingNd.items || existingNd.items.length === 0) existingNd.items = [{}];
        existingNd.items[0] = {
          ...existingNd.items[0],
          serviceType: serviceType,
          ticketNumber: voucherNumber,
          passengerName: passengerName,
          passengerDocId: passengerDoc,
          operatorId: providerId,
          operatorName: provider.name,
          description: description,
          serviceDetails: serviceDetails,
          route: serviceDetails.flightRoute || serviceDetails.destination || serviceDetails.cruiseItinerary || '',
          pnr: serviceDetails.pnrCode || '',
          departureDate: depDate,
          returnDate: retDate,
          fareAmount: fare,
          feeAmount: fee,
          totalAmount: totalVenta,
          providerCommissionRate: provCommRate,
          providerCommissionAmount: provCommAmount,
          netCostToProvider: netCost
        };

        if (existingNd.items[0].gdsTicketId) {
          const tkt = (data.gdsTickets || []).find(t => t.id === existingNd.items[0].gdsTicketId);
          if (tkt) {
            tkt.ticketNumber = voucherNumber;
            tkt.passengerName = passengerName;
            tkt.operatorId = providerId;
            tkt.fareAmount = fare;
            tkt.feeAmount = fee;
            tkt.totalAmount = totalVenta;
            tkt.ticketPrice = fare;
            tkt.route = serviceDetails.flightRoute || tkt.route;
          }
        }

        window.db.save(data);
        window.app.closeModal('modal-unified-operation');
        this.render();
        window.app.updateDashboardKpis();
        window.app.showToast(`¡Operación ND #${existingNd.ndNumber} actualizada con éxito!`, 'success');
        return;
      }
    }

    // CREACIÓN NUEVA OPERACIÓN INTEGRAL
    const nextNdNumber = (data.debitNotes || []).reduce((max, n) => Math.max(max, n.ndNumber || 0), 1000) + 1;
    const newNdId = 'ND-' + Date.now();
    const itemId = 'NDI-' + Date.now();

    let ticketId = null;
    if (serviceType === 'BOLETO_AEREO' || serviceType === 'BOLETO_GDS') {
      ticketId = 'TKT-' + Date.now();
      data.gdsTickets.push({
        id: ticketId,
        ticketNumber: voucherNumber,
        gdsSource: 'BOLETO_AEREO',
        counter: '',
        issueDate: issueDate,
        passengerName: passengerName,
        passengerDocId: passengerDoc,
        route: description || 'VVI-LPB',
        airlineCode: (provider.code || 'AEREO').substring(0, 4),
        operatorId: providerId,
        fareAmount: fare,
        ticketPrice: fare,
        netAmount: netCost,
        taxAmount: 0,
        totalAmount: fare,
        currency: 'BOB',
        commissionRate: provCommRate,
        commissionAmount: provCommAmount,
        feeAmount: fee,
        totalWithFee: totalVenta,
        status: 'FACTURADO',
        createdAt: new Date().toLocaleString()
      });
    }

    const isPaid = (paymentTerm === 'AL_CONTADO');
    const newNd = {
      id: newNdId,
      ndNumber: nextNdNumber,
      accountId: clientId,
      accountName: client.name,
      accountNit: client.docNumber || '',
      requesterId: null,
      solicitante: client.name,
      passengerName: passengerName,
      issueDate: issueDate,
      paymentTerm: paymentTerm,
      currency: 'BOB',
      totalAmountBob: totalVenta,
      totalAmountUsd: parseFloat((totalVenta / 6.96).toFixed(2)),
      paidAmountBob: isPaid ? totalVenta : 0,
      paidAmountUsd: isPaid ? parseFloat((totalVenta / 6.96).toFixed(2)) : 0,
      balanceBob: isPaid ? 0 : totalVenta,
      balanceUsd: isPaid ? 0 : parseFloat((totalVenta / 6.96).toFixed(2)),
      status: isPaid ? 'PAGADA' : 'IMPAGA',
      observations: `Operación Integral ${serviceType} | ${description}`,
      createdById: 'USR-001',
      createdByName: 'Luis',
      items: [
        {
          id: itemId,
          serviceType: serviceType,
          gdsTicketId: ticketId,
          ticketNumber: voucherNumber,
          passengerName: passengerName,
          passengerDocId: passengerDoc,
          operatorId: providerId,
          operatorName: provider.name,
          description: description,
          serviceDetails: serviceDetails,
          route: serviceDetails.flightRoute || serviceDetails.destination || serviceDetails.cruiseItinerary || '',
          pnr: serviceDetails.pnrCode || '',
          departureDate: depDate,
          returnDate: retDate,
          currency: 'BOB',
          fareAmount: fare,
          feeAmount: fee,
          totalAmount: totalVenta,
          providerCommissionRate: provCommRate,
          providerCommissionAmount: provCommAmount,
          clientCommissionRate: 0,
          clientCommissionAmount: 0,
          counterCommissionAmount: 0,
          netCostToProvider: netCost
        }
      ],
      createdAt: new Date().toLocaleString()
    };
    data.debitNotes.push(newNd);

    if (netCost > 0) {
      const nextNcNumber = (data.creditNotes || []).reduce((max, n) => Math.max(max, n.ncNumber || 0), 500) + 1;
      data.creditNotes.push({
        id: 'NC-' + Date.now(),
        ncNumber: nextNcNumber,
        providerId: providerId,
        providerName: provider.name,
        providerNit: provider.docNumber || '',
        originDebitNoteId: newNdId,
        originDebitNoteNumber: nextNdNumber,
        issueDate: issueDate,
        concept: `Costo Servicio ${serviceType} - Pax: ${passengerName} (ND #${nextNdNumber})`,
        currency: 'BOB',
        totalAmount: netCost,
        paidAmount: 0,
        balance: netCost,
        status: 'IMPAGA',
        isAutoGenerated: true,
        createdById: 'USR-001',
        createdAt: new Date().toLocaleString()
      });
    }

    if (isPaid) {
      data.cashReceipts.push({
        id: 'RCP-' + Date.now(),
        receiptNumber: (data.cashReceipts || []).length + 1,
        date: issueDate,
        receiptDate: issueDate,
        accountId: clientId,
        accountName: client.name,
        debitNoteId: newNdId,
        debitNoteNumber: nextNdNumber,
        totalPaidBob: totalVenta,
        totalPaidUsd: parseFloat((totalVenta / (data.exchangeRate?.sellRate || 6.96)).toFixed(2)),
        paymentMethod: depositAccount === 'CAJA_EFECTIVO' ? 'EFECTIVO_BOB' : 'TRANSFERENCIA_BANCO',
        bankAccountId: depositAccount !== 'CAJA_EFECTIVO' ? depositAccount : null,
        status: 'VALIDO',
        createdById: data.currentUser?.id || 'USR-001',
        createdByName: data.currentUser?.name || 'Luis (Admin)',
        notes: `Cobro al Contado Emisión ND #${nextNdNumber} (${serviceType})`,
        createdAt: new Date().toLocaleString()
      });
    }

    if (provCommAmount > 0) {
      data.otherIncomes.push({
        id: 'INC-' + Date.now(),
        originType: 'COMISION_PLATAFORMA',
        ticketId: ticketId,
        ticketNumber: voucherNumber,
        operatorId: providerId,
        operatorName: provider.name,
        issueDate: issueDate,
        passengerName: passengerName,
        route: description || '-',
        amount: provCommAmount,
        currency: 'BOB',
        description: `Comisión Plataforma por ${serviceType} ${voucherNumber} | Proveedor: ${provider.name} | Pax: ${passengerName}`,
        status: 'IMPAGA',
        depositAccountId: depositAccount,
        createdAt: new Date().toLocaleString()
      });
    }

    window.db.save(data);
    window.app.closeModal('modal-unified-operation');
    this.render();
    window.app.updateDashboardKpis();
    window.app.showToast(`¡Operación registrada con éxito! ND #${nextNdNumber} emitida.`, 'success');
  }

  openEditOperationModal(id) {
    const data = window.db.get();
    const nd = (data.debitNotes || []).find(n => n.id === id);
    if (!nd) {
      window.app.showToast('Operación no encontrada', 'error');
      return;
    }

    this.editingOperationId = id;
    const modalTitle = document.getElementById('unified-modal-title');
    if (modalTitle) modalTitle.innerHTML = `<i data-lucide="edit-3"></i> Editar Operación Integral (ND #${nd.ndNumber})`;

    this.populateServiceTypeSelects();
    this.populateAccountsSelects();

    const firstItem = (nd.items && nd.items[0]) || {};
    const srvType = firstItem.serviceType || 'BOLETO_AEREO';

    document.getElementById('uni-service-type').value = srvType;
    this.renderDynamicServiceFields(srvType, firstItem.serviceDetails || firstItem);

    document.getElementById('uni-issue-date').value = nd.issueDate || '';
    document.getElementById('uni-pax-name').value = firstItem.passengerName || nd.passengerName || '';
    document.getElementById('uni-pax-doc').value = firstItem.passengerDocId || '';
    document.getElementById('uni-description').value = firstItem.description || '';
    document.getElementById('uni-voucher-number').value = firstItem.ticketNumber || '';
    
    document.getElementById('uni-client-select').value = nd.accountId || '';
    document.getElementById('uni-provider-select').value = firstItem.operatorId || '';

    const fare = firstItem.fareAmount || (Number(nd.totalAmountBob) - (firstItem.feeAmount || 0));
    const fee = firstItem.feeAmount || 0;
    const provCommRate = firstItem.providerCommissionRate || 0;
    const netCost = firstItem.netCostToProvider || 0;

    document.getElementById('uni-fare-amount').value = fare;
    document.getElementById('uni-fee-amount').value = fee;
    document.getElementById('uni-prov-comm-rate').value = provCommRate;
    document.getElementById('uni-net-cost').value = netCost;
    document.getElementById('uni-payment-term').value = nd.paymentTerm || 'AL_CONTADO';

    this.calculateUnifiedTotals();

    window.app.openModal('modal-unified-operation');
    if (window.lucide) window.lucide.createIcons();
  }

  deleteOperation(id) {
    const data = window.db.get();
    const nd = (data.debitNotes || []).find(n => n.id === id);
    if (!nd) return;

    if (!confirm(`¿Está seguro de BORRAR DEFINITIVAMENTE la operación ND #${nd.ndNumber}?\n\nEsta acción eliminará el registro de la base de datos y revertirá saldos contables.`)) {
      return;
    }

    data.creditNotes = (data.creditNotes || []).filter(nc => nc.originDebitNoteId !== id && nc.originDebitNoteNumber !== nd.ndNumber);

    (nd.items || []).forEach(it => {
      if (it.gdsTicketId) {
        data.gdsTickets = (data.gdsTickets || []).filter(t => t.id !== it.gdsTicketId);
      }
    });

    data.cashReceipts = (data.cashReceipts || []).filter(r => r.debitNoteId !== id && r.debitNoteNumber !== nd.ndNumber);

    data.otherIncomes = (data.otherIncomes || []).filter(inc => {
      return !nd.items.some(it => it.ticketNumber && inc.ticketNumber === it.ticketNumber);
    });

    data.debitNotes = (data.debitNotes || []).filter(n => n.id !== id);

    window.db.save(data);
    this.render();
    window.app.updateDashboardKpis();
    window.app.showToast(`Operación ND #${nd.ndNumber} borrada definitivamente del sistema`, 'success');
  }

  deleteTicket(id) {
    if (!confirm('¿Desea eliminar definitivamente este boleto aéreo?')) return;
    const data = window.db.get();
    data.gdsTickets = (data.gdsTickets || []).filter(t => t.id !== id);
    window.db.save(data);
    this.render();
    window.app.updateDashboardKpis();
    window.app.showToast('Boleto eliminado del sistema', 'success');
  }

  voidOperation(id) {
    const data = window.db.get();
    const nd = (data.debitNotes || []).find(n => n.id === id);
    if (!nd) return;

    const reason = prompt(`Ingrese el motivo de anulación para la ND #${nd.ndNumber}:`, 'Error de emisión / cancelado por el cliente');
    if (reason === null) return;

    nd.status = 'ANULADA';
    nd.balanceBob = 0;
    nd.balanceUsd = 0;
    nd.voidReason = reason.trim() || 'Sin motivo especificado';
    nd.voidedAt = new Date().toLocaleString();
    nd.voidedBy = 'Luis';

    (data.creditNotes || []).forEach(nc => {
      if (nc.originDebitNoteId === id || nc.originDebitNoteNumber === nd.ndNumber) {
        nc.status = 'ANULADA';
        nc.balance = 0;
      }
    });

    (nd.items || []).forEach(it => {
      if (it.gdsTicketId) {
        const tkt = (data.gdsTickets || []).find(t => t.id === it.gdsTicketId);
        if (tkt) tkt.status = 'ANULADO';
      }
    });

    window.db.save(data);
    this.render();
    window.app.updateDashboardKpis();
    window.app.showToast(`Operación ND #${nd.ndNumber} ANULADA correctamente (Saldos en 0.00)`, 'warning');
  }

  openNewServiceTypeModal(editingServiceId = null) {
    const form = document.getElementById('form-new-service-type');
    if (form) form.reset();

    this.editingServiceTypeId = editingServiceId;
    const titleEl = document.querySelector('#modal-new-service-type .modal-title');
    const submitBtn = document.querySelector('#modal-new-service-type button[type="submit"]');
    const nameInp = document.getElementById('new-service-name');
    const catInp = document.getElementById('new-service-category');

    if (editingServiceId) {
      const data = window.db.get();
      const srv = (data.serviceTypes || []).find(s => s.id === editingServiceId);
      if (srv) {
        if (nameInp) nameInp.value = srv.name;
        if (catInp) catInp.value = srv.category || 'VARIOS';
        if (titleEl) titleEl.innerHTML = '<i data-lucide="edit"></i> Editar Tipo de Servicio';
        if (submitBtn) submitBtn.innerHTML = '<i data-lucide="save"></i> Actualizar Servicio';
      }
    } else {
      if (titleEl) titleEl.innerHTML = '<i data-lucide="tag"></i> Añadir Nuevo Tipo de Servicio';
      if (submitBtn) submitBtn.innerHTML = '<i data-lucide="save"></i> Guardar Servicio';
    }

    window.app.openModal('modal-new-service-type');
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => {
      document.getElementById('new-service-name')?.focus();
    }, 150);
  }

  saveNewServiceType(e) {
    if (e && e.preventDefault) e.preventDefault();

    const nameInp = document.getElementById('new-service-name');
    const catInp = document.getElementById('new-service-category');
    const rawName = (nameInp ? nameInp.value : '').trim().toUpperCase();
    const category = (catInp ? catInp.value : '').trim().toUpperCase() || 'VARIOS';

    if (!rawName) {
      window.app.showToast('Debe ingresar el nombre del servicio', 'warning');
      return;
    }

    const data = window.db.get();
    data.serviceTypes = data.serviceTypes || [];

    // Si estamos en modo edición
    if (this.editingServiceTypeId) {
      const srv = data.serviceTypes.find(s => s.id === this.editingServiceTypeId);
      if (srv) {
        srv.name = rawName;
        srv.category = category;
        window.db.save(data);

        this.populateServiceTypeSelects();
        this.renderManageServiceTypesList();
        this.render();

        window.app.closeModal('modal-new-service-type');
        window.app.showToast(`Tipo de servicio "${rawName}" actualizado con éxito`, 'success');
        this.editingServiceTypeId = null;
        return;
      }
    }

    if (data.serviceTypes.some(s => s.name === rawName)) {
      window.app.showToast(`El servicio "${rawName}" ya se encuentra registrado`, 'warning');
      return;
    }

    const code = rawName.replace(/[^A-Z0-9]/g, '_').slice(0, 24);
    const newService = {
      id: 'SRV-' + Date.now(),
      code: code,
      name: rawName,
      category: category,
      createdAt: new Date().toLocaleString()
    };

    data.serviceTypes.push(newService);
    window.db.save(data);

    this.populateServiceTypeSelects();

    const uniSelect = document.getElementById('uni-service-type');
    if (uniSelect) uniSelect.value = code;
    const manSelect = document.getElementById('man-service-type');
    if (manSelect) manSelect.value = code;

    window.app.closeModal('modal-new-service-type');
    
    // Si la gestión de servicios está abierta, refrescarla de inmediato sin parpadeos
    const manageModal = document.getElementById('modal-manage-service-types');
    if (manageModal && manageModal.classList.contains('active')) {
      this.renderManageServiceTypesList();
    }

    window.app.showToast(`¡Nuevo tipo de servicio "${rawName}" añadido exitosamente!`, 'success');
  }

  renderManageServiceTypesList() {
    const listContainer = document.getElementById('manage-service-types-list');
    if (!listContainer) return;

    const services = this.getServiceTypes();
    listContainer.innerHTML = services.map(s => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 8px; gap: 10px;">
        <div style="flex: 1;">
          <strong style="color: #0f172a; font-size: 0.9rem;">${s.name}</strong>
          <div style="font-size: 0.75rem; color: #64748b;">Categoría: ${s.category || 'VARIOS'} | Código: ${s.code}</div>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button type="button" class="btn btn-secondary btn-xs" onclick="window.operationsHubModule.openNewServiceTypeModal('${s.id}')" title="Editar tipo de servicio" style="padding: 4px 8px;">
            <i data-lucide="edit-3"></i>
          </button>
          <button type="button" class="btn btn-danger btn-xs" onclick="window.operationsHubModule.deleteServiceType('${s.id}')" title="Eliminar tipo de servicio" style="padding: 4px 8px;">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  openManageServiceTypesModal() {
    this.renderManageServiceTypesList();
    window.app.openModal('modal-manage-service-types');
  }

  deleteServiceType(id) {
    const data = window.db.get();
    const srv = (data.serviceTypes || []).find(s => s.id === id);
    if (!srv) return;

    if (!confirm(`¿Está seguro de eliminar el tipo de servicio "${srv.name}"?`)) return;

    data.serviceTypes = (data.serviceTypes || []).filter(s => s.id !== id);
    window.db.save(data);

    this.populateServiceTypeSelects();
    this.renderManageServiceTypesList();
    this.render();
    window.app.showToast(`Tipo de servicio "${srv.name}" eliminado`, 'success');
  }

  formatServiceName(code) {
    if (!code) return 'SERVICIO';
    const services = this.getServiceTypes();
    const found = services.find(s => s.code === code || s.id === code);
    if (found) return found.name;

    const map = {
      'BOLETO_AEREO': 'BOLETO AÉREO',
      'BOLETO_GDS': 'BOLETO AÉREO GDS',
      'HOTEL': 'HOTEL',
      'PAQUETE': 'PAQUETE TURÍSTICO',
      'PAQUETE_TURISTICO': 'PAQUETE TURÍSTICO',
      'PAQUETE_CRUCERO': 'PAQUETE CRUCERO',
      'PAQUETE_CONCIERTO': 'PAQUETE CONCIERTO',
      'ASESORAMIENTO_VISAS': 'ASESORAMIENTO VISAS',
      'CERTIFICACION_FA': 'CERTIFICACIÓN FA',
      'RENT_A_CAR': 'RENT A CAR',
      'SEGURO': 'SEGURO DE VIAJE',
      'SEGURO_VIAJE': 'SEGURO DE VIAJE',
      'COMISION_PLATAFORMA': 'COMISIÓN PLATAFORMA',
      'OTRO': 'OTRO SERVICIO'
    };
    return map[code] || code.replace(/_/g, ' ');
  }

  getServiceBadgeClass(code) {
    const c = (code || '').toUpperCase();
    if (c.includes('AEREO') || c.includes('BOLETO') || c.includes('GDS')) return 'badge-blue';
    if (c.includes('HOTEL')) return 'badge-emerald';
    if (c.includes('PAQUETE') || c.includes('TOUR') || c.includes('CRUCERO')) return 'badge-amber';
    if (c.includes('VISA') || c.includes('FA')) return 'badge-purple';
    return 'badge-slate';
  }
}

// Inicialización global del módulo
window.operationsHubModule = new OperationsHubModule();
