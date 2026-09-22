/**
 * MARETRAVEL ERP - Módulo 2: Ingesta y Gestión de Boletos GDS (Amadeus / Sabre)
 * Incluye: Simulador de emisión, pool de boletos disponibles y filtros por Counter.
 */

window.gdsModule = {
  currentStatusFilter: 'TODOS',
  editingTicketId: null,

  async init() {
    this.bindEvents();
    await this.loadFromApi();
  },

  async loadFromApi() {
    try {
      if (GdsAdapter && typeof GdsAdapter.syncMirror === 'function') {
        await GdsAdapter.syncMirror();
      }
    } catch (e) {
      console.warn('No se pudo sincronizar boletos con el backend:', e);
    }
    this.render();
  },

  bindEvents() {
    const statusFilter = document.getElementById('gds-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentStatusFilter = e.target.value;
        this.render();
      });
    }

    const searchInput = document.getElementById('gds-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.render());
    }

    const btnSimulate = document.getElementById('btn-simulate-gds');
    if (btnSimulate) {
      btnSimulate.addEventListener('click', () => this.openSimulateModal());
    }

    const formSim = document.getElementById('gds-simulate-form');
    if (formSim) {
      formSim.addEventListener('submit', (e) => this.handleSimulateTicket(e));
    }
  },

  render() {
    const data = window.db.get();
    const tickets = data.gdsTickets || [];
    const search = (document.getElementById('gds-search-input')?.value || '').toLowerCase();
    const tableBody = document.getElementById('gds-table-body');
    if (!tableBody) return;

    let filtered = tickets.filter(tkt => {
      const matchStatus = this.currentStatusFilter === 'TODOS' || tkt.status === this.currentStatusFilter;
      const matchSearch = tkt.ticketNumber.toLowerCase().includes(search) ||
                          tkt.passengerName.toLowerCase().includes(search) ||
                          tkt.route.toLowerCase().includes(search) ||
                          (tkt.counter && tkt.counter.toLowerCase().includes(search));
      return matchStatus && matchSearch;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 24px; color: var(--text-muted);">
            No se encontraron boletos aéreos con los criterios de búsqueda.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = filtered.map(tkt => {
      const statusBadge = tkt.status === 'DISPONIBLE' ? 'badge-emerald' :
                          tkt.status === 'ASIGNADO' ? 'badge-blue' : 'badge-rose';

      return `
        <tr>
          <td class="font-mono" style="font-weight: 700; color: var(--navy);">${tkt.ticketNumber}</td>
          <td><span class="badge badge-blue">${tkt.airlineCode || 'AÉREO'}</span></td>
          <td class="font-mono">${tkt.issueDate}</td>
          <td>
            <div style="font-weight: 600;">${tkt.passengerName}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${tkt.passengerDocId || 'Sin Doc'}</div>
          </td>
          <td class="font-mono"><strong>${tkt.route}</strong> (${tkt.airlineCode})</td>
          <td class="font-mono" style="text-align: right; font-weight: 700;">
            ${tkt.currency} ${Number(tkt.totalAmount || tkt.ticketPrice || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            ${tkt.fareAmount ? `<div style="font-size: 0.72rem; color: #64748b; font-weight: 400;">Air Fare: ${tkt.currency} ${Number(tkt.fareAmount).toFixed(2)}</div>` : ''}
          </td>
          <td style="text-align: right; font-size: 0.78rem;">
            <strong>${tkt.commissionRate}%</strong> (${tkt.currency} ${Number(tkt.commissionAmount).toFixed(2)})
            ${tkt.feeAmount > 0 ? `<div style="font-size: 0.72rem; color: #0284c7; font-weight: 600;">+ Fee: ${tkt.currency} ${Number(tkt.feeAmount).toFixed(2)}</div>` : ''}
          </td>
          <td><span class="badge ${statusBadge}">${tkt.status}</span></td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 4px; justify-content: center;">
              <button class="btn btn-secondary btn-sm" onclick="window.gdsModule.openSimulateModal('${tkt.id}')" title="Editar boleto">
                <i data-lucide="edit-3"></i> Editar
              </button>
              ${tkt.status === 'DISPONIBLE' ? `
                <button class="btn btn-danger btn-sm" onclick="window.gdsModule.deleteTicket('${tkt.id}')" title="Eliminar boleto" style="background: #fee2e2; color: #dc2626; border-color: #fca5a5; padding: 4px 8px;">
                  <i data-lucide="trash-2"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  recalcSimulateTotals() {
    const currency = document.getElementById('sim-currency')?.value || 'BOB';
    const fare = parseFloat(document.getElementById('sim-fare-amount')?.value) || 0;
    const price = parseFloat(document.getElementById('sim-net-amount')?.value) || 0;
    const commRate = parseFloat(document.getElementById('sim-commission-rate')?.value) || 0;
    const fee = parseFloat(document.getElementById('sim-fee-amount')?.value) || 0;

    // Comisión de la plataforma calculada en base a la TARIFA DE BOLETO AÉREO
    const commBase = fare > 0 ? fare : price;
    const commAmount = commBase * (commRate / 100);

    const commDisplay = document.getElementById('sim-commission-display');
    if (commDisplay) {
      commDisplay.value = `${currency} ${commAmount.toFixed(2)}`;
    }

    const bannerProv = document.getElementById('banner-provider-cost');
    if (bannerProv) {
      bannerProv.textContent = `${currency} ${price.toFixed(2)}`;
    }

    const bannerComm = document.getElementById('banner-comm-amount');
    if (bannerComm) {
      bannerComm.textContent = `${currency} ${commAmount.toFixed(2)} (${commRate}%)`;
    }

    // Precio Boleto Aéreo + Fee MARETRAVEL
    const totalToClient = price + fee;
    const bannerTotal = document.getElementById('banner-total-to-client');
    if (bannerTotal) {
      bannerTotal.textContent = `${currency} ${totalToClient.toFixed(2)}`;
    }
  },

  openSimulateModal(ticketId = null) {
    this.editingTicketId = ticketId;
    const data = window.db.get();
    const form = document.getElementById('gds-simulate-form');
    if (form) form.reset();

    const airlines = data.accounts.filter(a => a.relationType === 'PROVEEDOR' || a.relationType === 'AMBOS');
    const selectAirline = document.getElementById('sim-airline-select');
    if (selectAirline) {
      selectAirline.innerHTML = airlines.map(a => `<option value="${a.id}">${a.name} (${a.code})</option>`).join('');
    }

    const modalTitle = document.getElementById('gds-modal-title');
    const btnSubmit = document.getElementById('btn-submit-gds');

    if (ticketId) {
      const tkt = (data.gdsTickets || []).find(t => t.id === ticketId);
      if (tkt) {
        if (modalTitle) modalTitle.innerHTML = `<i data-lucide="edit-3"></i> Editar Boleto Aéreo`;
        if (btnSubmit) btnSubmit.innerHTML = `<i data-lucide="check-circle"></i> Guardar Cambios`;

        const tktInput = document.getElementById('sim-ticket-number');
        if (tktInput) tktInput.value = tkt.ticketNumber || '';

        const dateInput = document.getElementById('sim-issue-date');
        if (dateInput) dateInput.value = tkt.issueDate || '';

        const passInput = document.getElementById('sim-passenger-name');
        if (passInput) passInput.value = tkt.passengerName || '';

        const docInput = document.getElementById('sim-passenger-doc');
        if (docInput) docInput.value = tkt.passengerDocId || '';

        const routeInput = document.getElementById('sim-route');
        if (routeInput) routeInput.value = tkt.route || '';

        if (selectAirline && tkt.operatorId) {
          selectAirline.value = tkt.operatorId;
        }

        const currSelect = document.getElementById('sim-currency');
        if (currSelect) currSelect.value = tkt.currency || 'BOB';

        const fareInput = document.getElementById('sim-fare-amount');
        if (fareInput) fareInput.value = tkt.fareAmount !== undefined ? tkt.fareAmount : (tkt.totalAmount || 0);

        const netInput = document.getElementById('sim-net-amount');
        if (netInput) netInput.value = tkt.totalAmount !== undefined ? tkt.totalAmount : (tkt.netAmount || 0);

        const commInput = document.getElementById('sim-commission-rate');
        if (commInput) commInput.value = tkt.commissionRate !== undefined ? tkt.commissionRate : 5.00;

        const feeInput = document.getElementById('sim-fee-amount');
        if (feeInput) feeInput.value = tkt.feeAmount !== undefined ? tkt.feeAmount : 100.00;
      }
    } else {
      if (modalTitle) modalTitle.innerHTML = `<i data-lucide="plane"></i> Registro y Emisión de Boletos Aéreos`;
      if (btnSubmit) btnSubmit.innerHTML = `<i data-lucide="check-circle"></i> Registrar Boleto Aéreo`;

      const tktInput = document.getElementById('sim-ticket-number');
      if (tktInput) {
        tktInput.value = '930-' + Math.floor(1000000000 + Math.random() * 9000000000);
      }

      const dateInput = document.getElementById('sim-issue-date');
      if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
      }

      const fareInput = document.getElementById('sim-fare-amount');
      if (fareInput) fareInput.value = '';

      const netInput = document.getElementById('sim-net-amount');
      if (netInput) netInput.value = '';

      const commInput = document.getElementById('sim-commission-rate');
      if (commInput) commInput.value = '5.00';

      const feeInput = document.getElementById('sim-fee-amount');
      if (feeInput) feeInput.value = '100.00';
    }

    this.recalcSimulateTotals();
    if (window.lucide) window.lucide.createIcons();
    window.app.openModal('modal-simulate-gds');
  },

  async handleSaveSimulate(e) {
    e.preventDefault();
    const data = window.db.get();
    const isEdit = !!this.editingTicketId;
    let savedTicket = null;
    let savedBackendId = null;

    const currency = document.getElementById('sim-currency').value;
    const fare = parseFloat(document.getElementById('sim-fare-amount').value) || 0;
    const price = parseFloat(document.getElementById('sim-net-amount').value) || 0;
    const commRate = parseFloat(document.getElementById('sim-commission-rate').value) || 0;
    // Comisión de la plataforma calculada en base a la Tarifa de Boleto Aéreo:
    const commBase = fare > 0 ? fare : price;
    const commAmount = parseFloat((commBase * (commRate / 100)).toFixed(2));
    const fee = parseFloat(document.getElementById('sim-fee-amount').value) || 0;
    const airlineId = document.getElementById('sim-airline-select').value;
    const airline = data.accounts.find(a => a.id === airlineId);
    const airlineBackendId = airline ? (airline.backendId || null) : null;
    const gdsSelect = document.getElementById('sim-gds-source');

    if (this.editingTicketId) {
      const idx = data.gdsTickets.findIndex(t => t.id === this.editingTicketId);
      if (idx !== -1) {
        const existing = data.gdsTickets[idx];
        data.gdsTickets[idx] = {
          ...existing,
          ticketNumber: document.getElementById('sim-ticket-number').value.trim(),
          gdsSource: gdsSelect ? gdsSelect.value : (existing.gdsSource || 'BOLETO_AEREO'),
          issueDate: document.getElementById('sim-issue-date').value,
          passengerName: document.getElementById('sim-passenger-name').value.trim().toUpperCase(),
          passengerDocId: document.getElementById('sim-passenger-doc').value.trim().toUpperCase(),
          route: document.getElementById('sim-route').value.trim().toUpperCase(),
          airlineCode: airline?.providerServices?.[0]?.serviceCode || airline?.code || 'OB',
          operatorId: airlineId,
          providerServiceId: airline?.providerServices?.[0]?.id || null,
          fareAmount: fare,
          ticketPrice: price,
          netAmount: price,
          taxAmount: 0,
          totalAmount: price,
          currency: currency,
          commissionRate: commRate,
          commissionAmount: commAmount,
          feeAmount: fee,
          totalWithFee: parseFloat((price + fee).toFixed(2)),
          updatedAt: new Date().toLocaleString()
        };

        savedTicket = data.gdsTickets[idx];
        savedBackendId = data.gdsTickets[idx].backendId || null;

        // Sincronizar en Otros Ingresos Operativos
        data.otherIncomes = data.otherIncomes || [];
        const incIdx = data.otherIncomes.findIndex(i => i.ticketId === this.editingTicketId);
        const opName = airline ? airline.name : (data.gdsTickets[idx].airlineCode === 'OB' ? 'Boliviana de Aviación' : 'Amaszonas');
        const desc = `Comisión Plataforma por Boleto ${data.gdsTickets[idx].ticketNumber} | Aerolínea/Operador: ${opName} | Pasajero: ${data.gdsTickets[idx].passengerName} (${data.gdsTickets[idx].route}) | Fecha Emisión: ${data.gdsTickets[idx].issueDate}`;

        if (incIdx !== -1) {
          data.otherIncomes[incIdx] = {
            ...data.otherIncomes[incIdx],
            ticketNumber: data.gdsTickets[idx].ticketNumber,
            operatorId: airlineId,
            operatorName: opName,
            issueDate: data.gdsTickets[idx].issueDate,
            passengerName: data.gdsTickets[idx].passengerName,
            route: data.gdsTickets[idx].route,
            amount: commAmount,
            currency: currency,
            description: desc,
            updatedAt: new Date().toLocaleString()
          };
        } else if (commAmount > 0) {
          data.otherIncomes.unshift({
            id: 'INC-' + Date.now(),
            originType: 'COMISION_PLATAFORMA',
            ticketId: this.editingTicketId,
            ticketNumber: data.gdsTickets[idx].ticketNumber,
            operatorId: airlineId,
            operatorName: opName,
            issueDate: data.gdsTickets[idx].issueDate,
            passengerName: data.gdsTickets[idx].passengerName,
            route: data.gdsTickets[idx].route,
            amount: commAmount,
            currency: currency,
            description: desc,
            status: 'IMPAGA',
            paidAt: null,
            paymentNotes: '',
            createdAt: new Date().toLocaleString()
          });
        }

        window.db.save(data);
        window.app.showToast(`Boleto ${data.gdsTickets[idx].ticketNumber} actualizado correctamente`, 'success');
      }
      this.editingTicketId = null;
    } else {
      const newTicket = {
        id: 'TKT-' + Date.now(),
        ticketNumber: document.getElementById('sim-ticket-number').value.trim(),
        gdsSource: gdsSelect ? gdsSelect.value : 'BOLETO_AEREO',
        counter: '',
        issueDate: document.getElementById('sim-issue-date').value,
        passengerName: document.getElementById('sim-passenger-name').value.trim().toUpperCase(),
        passengerDocId: document.getElementById('sim-passenger-doc').value.trim().toUpperCase(),
        route: document.getElementById('sim-route').value.trim().toUpperCase(),
        airlineCode: airline?.providerServices?.[0]?.serviceCode || airline?.code || 'OB',
        operatorId: airlineId,
        providerServiceId: airline?.providerServices?.[0]?.id || null,
        fareAmount: fare,
        ticketPrice: price,
        netAmount: price,
        taxAmount: 0,
        totalAmount: price,
        currency: currency,
        commissionRate: commRate,
        commissionAmount: commAmount,
        feeAmount: fee,
        totalWithFee: parseFloat((price + fee).toFixed(2)),
        status: 'DISPONIBLE',
        createdAt: new Date().toLocaleString()
      };

      savedTicket = newTicket;

      data.gdsTickets.unshift(newTicket);

      // Generar automáticamente el registro en Otros Ingresos Operativos (inicia IMPAGA)
      const opName = airline ? airline.name : (newTicket.airlineCode === 'OB' ? 'Boliviana de Aviación' : 'Amaszonas');
      const newIncome = {
        id: 'INC-' + Date.now(),
        originType: 'COMISION_PLATAFORMA',
        ticketId: newTicket.id,
        ticketNumber: newTicket.ticketNumber,
        operatorId: airlineId,
        operatorName: opName,
        issueDate: newTicket.issueDate,
        passengerName: newTicket.passengerName,
        route: newTicket.route,
        amount: commAmount,
        currency: currency,
        description: `Comisión Plataforma por Boleto ${newTicket.ticketNumber} | Aerolínea/Operador: ${opName} | Pasajero: ${newTicket.passengerName} (${newTicket.route}) | Fecha Emisión: ${newTicket.issueDate}`,
        status: 'IMPAGA',
        paidAt: null,
        paymentNotes: '',
        createdAt: new Date().toLocaleString()
      };
      data.otherIncomes = data.otherIncomes || [];
      data.otherIncomes.unshift(newIncome);

      window.db.save(data);
      window.app.showToast(`Boleto ${newTicket.ticketNumber} registrado correctamente (Comisión agregada a Otros Ingresos)`, 'success');
    }

    // Persistir en el backend (dual-source) y refrescar el espejo local
    if (savedTicket) {
      try {
        if (GdsAdapter && typeof GdsAdapter.create === 'function') {
          const apiPayload = {
            ticketNumber: savedTicket.ticketNumber,
            gdsSource: savedTicket.gdsSource || 'AMADEUS',
            issueDate: savedTicket.issueDate,
            passengerName: savedTicket.passengerName,
            route: savedTicket.route,
            airlineCode: savedTicket.airlineCode,
            operatorId: airlineBackendId || savedTicket.operatorBackendId,
            netAmount: savedTicket.netAmount,
            taxAmount: savedTicket.taxAmount || 0,
            totalAmount: savedTicket.totalAmount,
            currency: savedTicket.currency,
            commissionRate: savedTicket.commissionRate || 0,
            commissionAmount: savedTicket.commissionAmount || 0,
            feeAmount: savedTicket.feeAmount || 0,
            status: savedTicket.status || 'DISPONIBLE'
          };
          if (savedBackendId) {
            await GdsAdapter.update(savedBackendId, apiPayload);
          } else {
            await GdsAdapter.create(apiPayload);
          }
          if (typeof GdsAdapter.syncMirror === 'function') {
            await GdsAdapter.syncMirror();
          }
        }
      } catch (err) {
        window.app.showToast('Boleto guardado localmente, pero hubo un error en el servidor: ' + err.message, 'error');
      }
    }

    window.app.closeModal('modal-simulate-gds');
    this.render();
    if (window.operationsHubModule) window.operationsHubModule.render();
    if (window.otherIncomesModule) window.otherIncomesModule.render();
    if (window.app && window.app.updateDashboardKpis) window.app.updateDashboardKpis();
  },

  openEditModal(ticketId) {
    return this.openSimulateModal(ticketId);
  },

  async deleteTicket(ticketId) {
    const data = window.db.get();
    const tkt = (data.gdsTickets || []).find(t => t.id === ticketId);
    if (!tkt) return;

    if (tkt.status === 'ASIGNADO') {
      window.app.showToast('No se puede eliminar un boleto ya asignado a una Nota de Débito', 'danger');
      return;
    }

    if (confirm(`¿Estás seguro de eliminar el boleto ${tkt.ticketNumber} de ${tkt.passengerName}?`)) {
      data.gdsTickets = data.gdsTickets.filter(t => t.id !== ticketId);
      data.otherIncomes = (data.otherIncomes || []).filter(i => i.ticketId !== ticketId);
      window.db.save(data);

      // Persistir el borrado en el backend (dual-source)
      try {
        if (GdsAdapter && tkt.backendId && typeof GdsAdapter.remove === 'function') {
          await GdsAdapter.remove(tkt.backendId);
          if (typeof GdsAdapter.syncMirror === 'function') {
            await GdsAdapter.syncMirror();
          }
        }
      } catch (err) {
        window.app.showToast('El boleto se eliminó localmente, pero hubo un error en el servidor: ' + err.message, 'error');
      }

      window.app.showToast(`Boleto ${tkt.ticketNumber} eliminado correctamente`, 'success');
      this.render();
      if (window.operationsHubModule) window.operationsHubModule.render();
      if (window.otherIncomesModule) window.otherIncomesModule.render();
      if (window.app && window.app.updateDashboardKpis) window.app.updateDashboardKpis();
    }
  },

  handleSimulateTicket(e) {
    return this.handleSaveSimulate(e);
  }
};
