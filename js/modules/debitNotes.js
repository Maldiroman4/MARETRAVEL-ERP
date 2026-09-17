/**
 * MARETRAVEL ERP - Módulo 3: Notas de Débito (ND) - Facturación y Ventas
 * Incluye: Adición de boletos GDS, cálculo de comisiones, Cierre de ND con
 * generación automática de NCs a proveedores, y plantillas de impresión oficial.
 */

window.debitNotesModule = {
  currentStatusFilter: 'TODOS',
  currentEditingNdId: null,
  activeItems: [], // Items temporales en creación/edición de ND

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    const statusFilter = document.getElementById('nd-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentStatusFilter = e.target.value;
        this.render();
      });
    }

    const searchInput = document.getElementById('nd-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.render());
    }

    const btnNew = document.getElementById('btn-new-nd');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.openNewModal());
    }

    const btnAddGds = document.getElementById('btn-add-gds-to-nd');
    if (btnAddGds) {
      btnAddGds.addEventListener('click', () => this.openGdsPickerModal());
    }

    const btnAddManual = document.getElementById('btn-add-manual-item');
    if (btnAddManual) {
      btnAddManual.addEventListener('click', () => this.openManualItemModal());
    }

    const formNd = document.getElementById('nd-form');
    if (formNd) {
      formNd.addEventListener('submit', (e) => this.handleSaveNd(e));
    }

    const formManual = document.getElementById('manual-item-form');
    if (formManual) {
      formManual.addEventListener('submit', (e) => this.handleSaveManualItem(e));
    }

    // Listeners para selección dinámica de servicios del operador
    const selectManProvider = document.getElementById('man-provider-select');
    if (selectManProvider) {
      selectManProvider.addEventListener('change', (e) => this.onManualProviderChange(e.target.value));
    }

    const selectManService = document.getElementById('man-provider-service-select');
    if (selectManService) {
      selectManService.addEventListener('change', (e) => {
        const opt = e.target.options[e.target.selectedIndex];
        if (opt && opt.value) {
          const sName = opt.getAttribute('data-name');
          const sCode = opt.getAttribute('data-code');
          const sRate = parseFloat(opt.getAttribute('data-rate')) || 0;
          this.applySelectedProviderService({ id: opt.value, serviceName: sName, serviceCode: sCode, defaultCommissionRate: sRate });
        }
      });
    }

    const inputManDesc = document.getElementById('man-description');
    if (inputManDesc) {
      inputManDesc.addEventListener('input', (e) => {
        const val = e.target.value.trim().toUpperCase();
        const data = window.db.get();
        const provId = document.getElementById('man-provider-select')?.value;
        const provider = data.accounts.find(a => a.id === provId);
        if (provider && provider.providerServices) {
          const match = provider.providerServices.find(s => (s.serviceName && s.serviceName.toUpperCase() === val) || (s.serviceCode && s.serviceCode.toUpperCase() === val));
          if (match) {
            this.applySelectedProviderService(match);
          }
        }
      });
    }

    // Listener para cambio de cliente dependiente (carga contactos de empresa)
    const selectClient = document.getElementById('nd-client-select');
    if (selectClient) {
      selectClient.addEventListener('change', (e) => this.onClientChange(e.target.value));
    }

    // Listener para botón de creación de contacto al vuelo (Quick Contact)
    const btnQuickContact = document.getElementById('btn-quick-new-contact');
    if (btnQuickContact) {
      btnQuickContact.addEventListener('click', () => this.openQuickContactModal());
    }

    // Listener para formulario express de contacto
    const formQuick = document.getElementById('quick-contact-form');
    if (formQuick) {
      formQuick.addEventListener('submit', (e) => this.handleSaveQuickContact(e));
    }

    // Listener para cambio en el selector de solicitante
    const selectSolicitante = document.getElementById('nd-solicitante-select');
    if (selectSolicitante) {
      selectSolicitante.addEventListener('change', (e) => {
        const manualWrap = document.getElementById('nd-solicitante-manual-wrap');
        if (manualWrap) {
          manualWrap.style.display = e.target.value === 'OTRO_MANUAL' ? 'block' : 'none';
        }
      });
    }
  },

  render() {
    const data = window.db.get();
    const notes = data.debitNotes || [];
    const search = (document.getElementById('nd-search-input')?.value || '').toLowerCase();
    const tableBody = document.getElementById('nd-table-body');
    if (!tableBody) return;

    let filtered = notes.filter(nd => {
      const matchStatus = this.currentStatusFilter === 'TODOS' || nd.status === this.currentStatusFilter;
      const matchSearch = String(nd.ndNumber).includes(search) ||
                          nd.accountName.toLowerCase().includes(search) ||
                          (nd.solicitante && nd.solicitante.toLowerCase().includes(search));
      return matchStatus && matchSearch;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 24px; color: var(--text-muted);">
            No se encontraron Notas de Débito registradas.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = filtered.map(nd => {
      const statusBadge = nd.status === 'PAGADA' ? 'badge-emerald' :
                          nd.status === 'PARCIAL' ? 'badge-blue' :
                          nd.status === 'IMPAGA' ? 'badge-amber' :
                          nd.status === 'CERRADA' ? 'badge-indigo' :
                          nd.status === 'BORRADOR' ? 'badge-slate' : 'badge-rose';

      const isLocked = nd.status !== 'BORRADOR';

      return `
        <tr>
          <td class="font-mono" style="font-weight: 700; color: var(--navy);">ND #${nd.ndNumber}</td>
          <td class="font-mono">${nd.issueDate}</td>
          <td>
            <div style="font-weight: 600;">${nd.accountName}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">Sol: ${nd.solicitante || 'General'}</div>
          </td>
          <td><span class="badge badge-slate">${nd.paymentTerm.replace(/_/g, ' ')}</span></td>
          <td class="font-mono" style="text-align: right; font-weight: 700;">
            ${nd.currency} ${Number(nd.totalAmountBob).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
          </td>
          <td class="font-mono" style="text-align: right; color: #b91c1c; font-weight: 600;">
            ${nd.currency} ${Number(nd.balanceBob).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
          </td>
          <td><span class="badge ${statusBadge}">${nd.status}</span></td>
          <td style="font-size: 0.78rem;">${(nd.isCommissionNd || nd.serviceType === 'COMISION_PLATAFORMA') ? '<span class="badge badge-emerald">Comisión</span>' : ((nd.items?.length || 0) + ' serv.')}</td>
          <td>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              ${!isLocked ? `
                <button class="btn btn-primary btn-sm" onclick="window.debitNotesModule.closeNd('${nd.id}')" title="Cerrar ND y generar NCs a proveedores">
                  <i data-lucide="lock"></i> Cerrar
                </button>
                <button class="btn btn-secondary btn-sm" onclick="window.debitNotesModule.openEditModal('${nd.id}')" title="Editar">
                  <i data-lucide="edit"></i>
                </button>
              ` : `
                <button class="btn btn-secondary btn-sm" onclick="window.debitNotesModule.reopenNd('${nd.id}')" title="Reabrir ND">
                  <i data-lucide="unlock"></i> Reabrir
                </button>
              `}
              <button class="btn btn-secondary btn-sm" onclick="window.reportsModule.openCorrectionModal('ND', '${nd.id}')" title="Corrección Contable (NIT, Razón Social, Fecha)">
                <i data-lucide="edit-3"></i>
              </button>
              ${nd.status !== 'ANULADA' ? `
                <button class="btn btn-danger btn-sm" onclick="window.reportsModule.openVoidModal('ND', '${nd.id}')" title="Anular comprobante con auditoría">
                  <i data-lucide="x-circle"></i>
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-sm" onclick="window.debitNotesModule.directPrint('${nd.id}')" title="Impresión Directa (Oficial)">
                <i data-lucide="printer"></i>
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.debitNotesModule.printPreview('${nd.id}', 'long')" title="Vista Previa y Emisión Oficial">
                <i data-lucide="file-text"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  openNewModal() {
    this.currentEditingNdId = null;
    this.activeItems = [];
    const form = document.getElementById('nd-form');
    if (form) form.reset();

    const data = window.db.get();
    const clients = data.accounts;
    const selectClient = document.getElementById('nd-client-select');
    if (selectClient) {
      selectClient.innerHTML = '<option value="">-- Seleccionar Cliente / Entidad --</option>' +
        clients.map(c => `<option value="${c.id}">${c.name} (${c.code} - NIT: ${c.nit || 'S/N'}) [${c.relationType || c.accountType}]</option>`).join('');
    }

    // Resetear solicitante dependiente y pasajero
    this.onClientChange('');
    const passInput = document.getElementById('nd-passenger-name');
    if (passInput) passInput.value = '';

    // Siguiente número de ND correlativo
    const nextNd = (data.debitNotes.length > 0) ? Math.max(...data.debitNotes.map(n => n.ndNumber)) + 1 : 1001;
    document.getElementById('nd-number-display').textContent = `ND #${nextNd}`;
    document.getElementById('nd-issue-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('nd-currency').value = 'BOB';

    this.renderItemsTable();
    window.app.openModal('modal-nd');
  },

  openEditModal(ndId) {
    this.currentEditingNdId = ndId;
    const data = window.db.get();
    const nd = data.debitNotes.find(n => n.id === ndId);
    if (!nd) return;

    if (nd.status !== 'BORRADOR') {
      window.app.showToast('Esta Nota de Débito está cerrada o tiene cobros. Debe reabrirla para editar.', 'warning');
      return;
    }

    const clients = data.accounts;
    const selectClient = document.getElementById('nd-client-select');
    if (selectClient) {
      selectClient.innerHTML = '<option value="">-- Seleccionar Cliente / Entidad --</option>' +
        clients.map(c => `<option value="${c.id}" ${c.id === nd.accountId ? 'selected' : ''}>${c.name} (${c.code}) [${c.relationType || c.accountType}]</option>`).join('');
    }

    document.getElementById('nd-number-display').textContent = `ND #${nd.ndNumber}`;
    document.getElementById('nd-issue-date').value = nd.issueDate;
    document.getElementById('nd-payment-term').value = nd.paymentTerm;
    document.getElementById('nd-currency').value = nd.currency;
    document.getElementById('nd-observations').value = nd.observations || '';

    // Cargar solicitante dependiente
    this.onClientChange(nd.accountId, nd.solicitante, nd.requesterId);

    // Cargar pasajero
    const passInput = document.getElementById('nd-passenger-name');
    if (passInput) passInput.value = nd.passengerName || '';

    this.activeItems = JSON.parse(JSON.stringify(nd.items || []));
    this.renderItemsTable();
    window.app.openModal('modal-nd');
  },

  /**
   * Carga dinámica de Solicitantes / Contactos Autorizados al seleccionar una Empresa
   */
  onClientChange(clientId, preselectVal = '', preselectReqId = '') {
    const data = window.db.get();
    const selectSol = document.getElementById('nd-solicitante-select');
    const manualWrap = document.getElementById('nd-solicitante-manual-wrap');
    const manualInput = document.getElementById('nd-solicitante-manual');
    const btnQuick = document.getElementById('btn-quick-new-contact');

    if (!selectSol) return;

    if (!clientId) {
      selectSol.innerHTML = '<option value="">-- Primero seleccione una Cuenta / Empresa --</option>';
      if (manualWrap) manualWrap.style.display = 'none';
      if (btnQuick) btnQuick.style.display = 'none';
      return;
    }

    const company = (data.accounts || []).find(a => a.id === clientId);
    const contacts = (data.companyContacts || []).filter(c => c.companyId === clientId && c.isActive);

    if (btnQuick) btnQuick.style.display = 'inline-flex';

    if (contacts.length > 0) {
      let optionsHtml = '<option value="">-- Seleccione Solicitante Autorizado --</option>';
      contacts.forEach(c => {
        const fullDesc = `${c.fullName} (${c.department || 'Logística'})`;
        const isSelected = (preselectReqId && c.id === preselectReqId) || 
                           (preselectVal && (preselectVal.includes(c.fullName) || preselectVal === fullDesc));
        optionsHtml += `<option value="${c.id}" data-name="${c.fullName}" data-desc="${fullDesc}" ${isSelected ? 'selected' : ''}>${fullDesc}</option>`;
      });
      optionsHtml += `<option value="OTRO_MANUAL" ${preselectVal && !contacts.some(c => preselectVal.includes(c.fullName)) ? 'selected' : ''}>Otro / Escribir manualmente...</option>`;
      selectSol.innerHTML = optionsHtml;

      const isManual = selectSol.value === 'OTRO_MANUAL' || (preselectVal && !contacts.some(c => preselectVal.includes(c.fullName)));
      if (manualWrap) {
        manualWrap.style.display = isManual ? 'block' : 'none';
        if (isManual && manualInput && preselectVal) manualInput.value = preselectVal;
      }
    } else {
      const defaultName = company ? (company.name || '') : '';
      selectSol.innerHTML = `
        <option value="DEFAULT" data-name="${defaultName}">${defaultName} (Contacto Principal)</option>
        <option value="OTRO_MANUAL" ${preselectVal ? 'selected' : ''}>Otro / Escribir Solicitante...</option>
      `;
      if (manualWrap) {
        manualWrap.style.display = (preselectVal || selectSol.value === 'OTRO_MANUAL') ? 'block' : 'none';
        if (manualInput && preselectVal) manualInput.value = preselectVal;
      }
    }
  },

  /**
   * Registro Express de Solicitante al vuelo (sin salir del modal de ND)
   */
  openQuickContactModal() {
    const clientSelect = document.getElementById('nd-client-select');
    const clientId = clientSelect ? clientSelect.value : null;
    if (!clientId) {
      window.app.showToast('Seleccione primero el cliente para registrar su contacto.', 'warning');
      return;
    }

    const data = window.db.get();
    const client = data.accounts.find(a => a.id === clientId);
    const modalSubtitle = document.getElementById('quick-contact-company-name');
    if (modalSubtitle) modalSubtitle.textContent = client ? (client.legalName || client.name) : 'Empresa';

    const form = document.getElementById('quick-contact-form');
    if (form) form.reset();

    window.app.openModal('modal-quick-contact');
  },

  handleSaveQuickContact(e) {
    e.preventDefault();
    const clientSelect = document.getElementById('nd-client-select');
    const clientId = clientSelect ? clientSelect.value : null;
    if (!clientId) return;

    const fullName = document.getElementById('quick-contact-name').value.trim();
    const department = document.getElementById('quick-contact-dept').value.trim();
    const phone = document.getElementById('quick-contact-phone').value.trim();
    const email = document.getElementById('quick-contact-email').value.trim();

    if (!fullName) {
      window.app.showToast('Debe ingresar el nombre del solicitante.', 'error');
      return;
    }

    const data = window.db.get();
    if (!data.companyContacts) data.companyContacts = [];

    const newContact = {
      id: 'CNT-' + Date.now().toString(36).toUpperCase(),
      companyId: clientId,
      fullName,
      department: department || 'Logística / Compras',
      phone: phone || '',
      email: email || '',
      isActive: true,
      createdAt: new Date().toLocaleString(),
      updatedAt: new Date().toLocaleString()
    };

    data.companyContacts.push(newContact);
    window.db.save(data);

    window.app.closeModal('modal-quick-contact');
    window.app.showToast(`Solicitante ${fullName} registrado y vinculado a la ND`, 'success');

    // Recargar desplegable y seleccionarlo
    this.onClientChange(clientId, '', newContact.id);
  },

  renderItemsTable() {
    const tbody = document.getElementById('nd-items-table-body');
    if (!tbody) return;

    if (this.activeItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 18px;">
            Aún no se han agregado boletos ni servicios a esta Nota de Débito.
          </td>
        </tr>
      `;
      this.updateTotals();
      return;
    }

    tbody.innerHTML = this.activeItems.map((item, index) => {
      const netToClient = (item.totalAmount - (item.clientCommissionAmount || 0)) + (item.feeAmount || 0);

      const typeLabels = {
        'BOLETO_GDS': 'BOLETO AÉREO',
        'BOLETO_AEREO': 'BOLETO AÉREO',
        'HOTEL': 'HOTEL',
        'PAQUETE': 'PAQUETE TURÍSTICO',
        'PAQUETE_CRUCERO': 'PAQUETE CRUCERO',
        'PAQUETE_CONCIERTO': 'PAQUETE CONCIERTO',
        'ASESORAMIENTO_VISAS': 'ASESORAMIENTO DE VISAS',
        'CERTIFICACION_FA': 'CERTIFICACIÓN INTERNACIONAL FA',
        'RENT_A_CAR': 'RENT A CAR',
        'SEGURO': 'SEGURO DE VIAJE',
        'OTRO': 'OTRO SERVICIO'
      };
      const displayType = typeLabels[item.serviceType] || item.serviceType || 'SERVICIO';

      return `
        <tr>
          <td><span class="badge ${item.serviceType === 'BOLETO_GDS' || item.serviceType === 'BOLETO_AEREO' ? 'badge-blue' : 'badge-slate'}">${displayType}</span></td>
          <td>
            <strong>${item.passengerName}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${item.description}</div>
          </td>
          <td class="font-mono">${item.ticketNumber || '-'}</td>
          <td>${item.operatorName || '-'}</td>
          <td class="font-mono" style="text-align: right;">${item.currency} ${Number(item.totalAmount).toFixed(2)}</td>
          <td class="font-mono" style="text-align: right; font-weight: 700; color: #0369a1;">
            ${item.currency} ${Number(netToClient).toFixed(2)}
          </td>
          <td style="text-align: center;">
            <button type="button" class="btn btn-danger btn-sm" onclick="window.debitNotesModule.removeItem(${index})" title="Eliminar ítem">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
    this.updateTotals();
  },

  removeItem(index) {
    this.activeItems.splice(index, 1);
    this.renderItemsTable();
  },

  updateTotals() {
    let totalBob = 0;
    let totalUsd = 0;
    const dbData = window.db.get();
    const sellRate = dbData.systemSettings.activeExchangeSell || 6.96;

    this.activeItems.forEach(item => {
      const net = (item.totalAmount - (item.clientCommissionAmount || 0)) + (item.feeAmount || 0);
      if (item.currency === 'BOB') {
        totalBob += net;
        totalUsd += (net / sellRate);
      } else {
        totalUsd += net;
        totalBob += (net * sellRate);
      }
    });

    const displayBob = document.getElementById('nd-total-bob-display');
    const displayUsd = document.getElementById('nd-total-usd-display');
    if (displayBob) displayBob.textContent = `BOB ${totalBob.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (displayUsd) displayUsd.textContent = `USD ${totalUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  openGdsPickerModal() {
    const data = window.db.get();
    const availableTickets = data.gdsTickets.filter(t => t.status === 'DISPONIBLE');
    const tbody = document.getElementById('gds-picker-table-body');
    if (!tbody) return;

    if (availableTickets.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 20px; color: var(--text-muted);">
            No hay boletos aéreos disponibles. Puedes registrar uno nuevo en el módulo de Boletos Aéreos.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = availableTickets.map(tkt => `
        <tr>
          <td style="text-align: center;">
            <input type="checkbox" class="gds-ticket-select" value="${tkt.id}" style="width: 16px; height: 16px; cursor: pointer;">
          </td>
          <td class="font-mono" style="font-weight: 700;">${tkt.ticketNumber}</td>
          <td><strong>${tkt.passengerName}</strong></td>
          <td class="font-mono">${tkt.route} (${tkt.airlineCode})</td>
          <td class="font-mono" style="text-align: right;">
            ${tkt.currency} ${Number(tkt.totalAmount).toFixed(2)}
            ${tkt.feeAmount > 0 ? `<div style="font-size:0.75rem; color:#059669; font-weight:600;">+ Fee: ${tkt.currency} ${Number(tkt.feeAmount).toFixed(2)}</div>` : ''}
          </td>
          <td style="font-size: 0.78rem;">
            ${tkt.commissionRate}% (${tkt.currency} ${Number(tkt.commissionAmount).toFixed(2)})
            ${tkt.fareAmount && tkt.fareAmount !== tkt.totalAmount ? `<div style="font-size:0.72rem; color:#64748b;">(s/ Air Fare ${tkt.currency} ${Number(tkt.fareAmount).toFixed(2)})</div>` : ''}
          </td>
          <td class="font-mono">${tkt.issueDate}</td>
        </tr>
      `).join('');
    }

    window.app.openModal('modal-gds-picker');
  },

  confirmAddSelectedGds() {
    const checkboxes = document.querySelectorAll('.gds-ticket-select:checked');
    if (checkboxes.length === 0) {
      window.app.showToast('Por favor selecciona al menos un boleto aéreo', 'warning');
      return;
    }

    const data = window.db.get();
    checkboxes.forEach(cb => {
      const ticketId = cb.value;
      const tkt = data.gdsTickets.find(t => t.id === ticketId);
      if (tkt) {
        // Obtener nombre del operador
        const op = data.accounts.find(a => a.id === tkt.operatorId);
        const opName = op ? op.name : (tkt.airlineCode === 'OB' ? 'Boliviana de Aviación' : 'Amaszonas');

        // Al proveedor de la plataforma se le paga el Precio de Boleto Aéreo completo (tkt.totalAmount),
        // ya que el proveedor liquida/paga la comisión de plataforma después.
        const costToProvider = tkt.totalAmount;

        this.activeItems.push({
          id: 'NDI-' + Date.now() + Math.random().toString(36).substr(2, 4),
          serviceType: 'BOLETO_GDS',
          gdsTicketId: tkt.id,
          ticketNumber: tkt.ticketNumber,
          passengerName: tkt.passengerName,
          passengerDocId: tkt.passengerDocId || '',
          operatorId: tkt.operatorId || 'ACC-004',
          operatorName: opName,
          providerServiceId: tkt.providerServiceId || null,
          description: `Boleto Aéreo ${tkt.route} (${tkt.airlineCode})`,
          currency: tkt.currency,
          fareAmount: tkt.fareAmount || tkt.totalAmount,
          totalAmount: tkt.totalAmount,
          feeAmount: tkt.feeAmount || 0,
          providerCommissionRate: tkt.commissionRate || 0,
          providerCommissionAmount: tkt.commissionAmount || 0,
          clientCommissionRate: 0.00,
          clientCommissionAmount: 0.00,
          counterCommissionAmount: 0.00,
          netCostToProvider: costToProvider
        });
      }
    });

    window.app.closeModal('modal-gds-picker');
    this.renderItemsTable();
    window.app.showToast(`${checkboxes.length} boletos adicionados a la ND`, 'success');
  },

  openManualItemModal() {
    const form = document.getElementById('manual-item-form');
    if (form) form.reset();

    document.getElementById('man-commission-rate').value = '10.00';
    document.getElementById('man-client-comm-rate').value = '0.00';
    document.getElementById('man-fee-amount').value = '0.00';

    const data = window.db.get();
    const providers = data.accounts.filter(a => a.relationType === 'PROVEEDOR' || a.relationType === 'AMBOS');
    const selectProvider = document.getElementById('man-provider-select');
    if (selectProvider) {
      selectProvider.innerHTML = providers.map(p => `<option value="${p.id}">${p.name} (${p.code})</option>`).join('');
      if (providers.length > 0) {
        this.onManualProviderChange(providers[0].id);
      }
    }

    window.app.openModal('modal-manual-item');
  },

  onManualProviderChange(providerId) {
    const data = window.db.get();
    const provider = data.accounts.find(a => a.id === providerId);
    const serviceSelect = document.getElementById('man-provider-service-select');
    const datalist = document.getElementById('man-services-datalist');
    const badge = document.getElementById('man-service-badge');

    if (!serviceSelect) return;

    const services = (provider && provider.providerServices) ? provider.providerServices : [];

    if (badge) {
      if (services.length > 0) {
        badge.textContent = `${services.length} catálogo`;
        badge.className = 'badge badge-emerald';
      } else {
        badge.textContent = 'Sin catálogo';
        badge.className = 'badge badge-slate';
      }
    }

    // Llenar datalist para autocompletado en el input de descripción
    if (datalist) {
      datalist.innerHTML = services.map(s => `<option value="${s.serviceName}">[${s.serviceCode}] ${s.serviceName} (${s.defaultCommissionRate}% Comis.)</option>`).join('');
    }

    // Llenar select de catálogo
    if (services.length > 0) {
      serviceSelect.innerHTML = `
        <option value="">-- Seleccionar servicio predefinido (${services.length}) --</option>
        ${services.map((s, idx) => `
          <option value="${s.id || idx}" data-name="${s.serviceName}" data-code="${s.serviceCode}" data-rate="${s.defaultCommissionRate}">
            [${s.serviceCode}] ${s.serviceName} (${s.defaultCommissionRate}% Comis.)
          </option>
        `).join('')}
      `;

      // Si sólo tiene 1 servicio (como Embajada con VISA AMERICANA), seleccionarlo automáticamente
      if (services.length === 1) {
        serviceSelect.selectedIndex = 1;
        this.applySelectedProviderService(services[0]);
      }
    } else {
      // Recopilar servicios de otros operadores en caso de conveniencia
      const otherServices = [];
      data.accounts.forEach(acc => {
        if (acc.providerServices && acc.providerServices.length > 0 && acc.id !== providerId) {
          acc.providerServices.forEach(s => otherServices.push({ ...s, providerName: acc.name }));
        }
      });

      if (otherServices.length > 0) {
        serviceSelect.innerHTML = `
          <option value="">-- Sin catálogo en este operador (o elija uno abajo) --</option>
          <optgroup label="Servicios registrados en otros operadores">
            ${otherServices.map((s, idx) => `
              <option value="other_${idx}" data-name="${s.serviceName}" data-code="${s.serviceCode}" data-rate="${s.defaultCommissionRate}">
                [${s.serviceCode}] ${s.serviceName} (${s.providerName})
              </option>
            `).join('')}
          </optgroup>
        `;
      } else {
        serviceSelect.innerHTML = `<option value="">-- Sin servicios registrados (escribir descripción al lado) --</option>`;
      }
    }
  },

  applySelectedProviderService(service) {
    if (!service) return;

    const descInput = document.getElementById('man-description');
    if (descInput && service.serviceName) {
      descInput.value = service.serviceName;
    }

    const rateInput = document.getElementById('man-commission-rate');
    if (rateInput && service.defaultCommissionRate !== undefined) {
      rateInput.value = parseFloat(service.defaultCommissionRate).toFixed(2);
    }

    // Auto-detectar Tipo de Servicio en base a las palabras clave del servicio
    const sName = (service.serviceName || '').toUpperCase();
    const sCode = (service.serviceCode || '').toUpperCase();
    const typeSelect = document.getElementById('man-service-type');
    if (typeSelect) {
      if (sName.includes('VISA') || sCode.includes('VA') || sName.includes('CONSULAR')) {
        typeSelect.value = 'ASESORAMIENTO_VISAS';
      } else if (sName.includes('CONCIERTO')) {
        typeSelect.value = 'PAQUETE_CONCIERTO';
      } else if (sName.includes('CRUCERO')) {
        typeSelect.value = 'PAQUETE_CRUCERO';
      } else if (sName.includes('CERTIFICACION') || sName.includes('FA')) {
        typeSelect.value = 'CERTIFICACION_FA';
      } else if (sName.includes('HOTEL') || sName.includes('ALOJAMIENTO')) {
        typeSelect.value = 'HOTEL';
      } else if (sName.includes('SEGURO')) {
        typeSelect.value = 'SEGURO';
      } else if (sName.includes('AUTO') || sName.includes('RENT')) {
        typeSelect.value = 'RENT_A_CAR';
      } else if (sName.includes('PAQUETE')) {
        typeSelect.value = 'PAQUETE';
      }
    }
  },

  handleSaveManualItem(e) {
    e.preventDefault();
    const data = window.db.get();
    const providerId = document.getElementById('man-provider-select').value;
    const provider = data.accounts.find(a => a.id === providerId);

    const total = parseFloat(document.getElementById('man-total-amount').value) || 0;
    const provRate = parseFloat(document.getElementById('man-commission-rate').value) || 0;
    const clientRate = parseFloat(document.getElementById('man-client-comm-rate').value) || 0;
    const fee = parseFloat(document.getElementById('man-fee-amount').value) || 0;
    const currency = document.getElementById('man-currency').value;

    const provComm = total * (provRate / 100);
    const clientComm = total * (clientRate / 100);
    const netCost = total - provComm;

    const serviceSelect = document.getElementById('man-provider-service-select');
    const selectedOpt = serviceSelect ? serviceSelect.options[serviceSelect.selectedIndex] : null;
    const sCode = selectedOpt ? selectedOpt.getAttribute('data-code') : null;
    const sId = selectedOpt && selectedOpt.value && !selectedOpt.value.startsWith('other_') ? selectedOpt.value : null;

    let opCode = sCode;
    if (!opCode && provider) {
      if (provider.providerServices && provider.providerServices.length > 0) {
        opCode = provider.providerServices[0].serviceCode;
      } else {
        opCode = (provider.code || 'PROV').substring(0, 4);
      }
    }

    this.activeItems.push({
      id: 'NDI-' + Date.now() + Math.random().toString(36).substr(2, 4),
      serviceType: document.getElementById('man-service-type').value,
      ticketNumber: document.getElementById('man-voucher-number').value.trim() || 'VOUCH-' + Math.floor(1000 + Math.random()*9000),
      passengerName: document.getElementById('man-passenger-name').value.trim().toUpperCase(),
      passengerDocId: document.getElementById('man-passenger-doc').value.trim().toUpperCase(),
      operatorId: providerId,
      operatorCode: opCode || 'VA',
      operatorName: provider ? provider.name : 'Proveedor de Servicio',
      providerServiceId: sId,
      description: document.getElementById('man-description').value.trim(),
      currency: currency,
      totalAmount: total,
      feeAmount: fee,
      providerCommissionRate: provRate,
      providerCommissionAmount: parseFloat(provComm.toFixed(2)),
      clientCommissionRate: clientRate,
      clientCommissionAmount: parseFloat(clientComm.toFixed(2)),
      counterCommissionAmount: 0.00,
      netCostToProvider: parseFloat(netCost.toFixed(2))
    });

    window.app.closeModal('modal-manual-item');
    this.renderItemsTable();
    window.app.showToast('Servicio manual agregado a la ND', 'success');
  },

  handleSaveNd(e) {
    e.preventDefault();
    if (this.activeItems.length === 0) {
      window.app.showToast('Debes agregar al menos un boleto o servicio a la Nota de Débito', 'warning');
      return;
    }

    const data = window.db.get();
    const clientId = document.getElementById('nd-client-select').value;
    const client = data.accounts.find(a => a.id === clientId);
    if (!client) {
      window.app.showToast('Por favor selecciona un cliente válido', 'warning');
      return;
    }

    const sellRate = data.systemSettings.activeExchangeSell || 6.96;
    let totalBob = 0;
    let totalUsd = 0;

    this.activeItems.forEach(item => {
      const net = (item.totalAmount - (item.clientCommissionAmount || 0)) + (item.feeAmount || 0);
      if (item.currency === 'BOB') {
        totalBob += net;
        totalUsd += (net / sellRate);
      } else {
        totalUsd += net;
        totalBob += (net * sellRate);
      }
    });

    totalBob = parseFloat(totalBob.toFixed(2));
    totalUsd = parseFloat(totalUsd.toFixed(2));

    const solSelect = document.getElementById('nd-solicitante-select');
    let solicitanteStr = '';
    let requesterId = null;

    if (solSelect) {
      if (solSelect.value === 'OTRO_MANUAL') {
        solicitanteStr = document.getElementById('nd-solicitante-manual')?.value.trim() || 'General';
      } else if (solSelect.value === 'DEFAULT') {
        solicitanteStr = client.name;
      } else if (solSelect.value) {
        requesterId = solSelect.value;
        const opt = solSelect.options[solSelect.selectedIndex];
        solicitanteStr = opt ? (opt.getAttribute('data-desc') || opt.getAttribute('data-name') || opt.textContent) : 'General';
      }
    }

    const passengerName = document.getElementById('nd-passenger-name')?.value.trim() || '';

    if (this.currentEditingNdId) {
      const index = data.debitNotes.findIndex(n => n.id === this.currentEditingNdId);
      if (index !== -1) {
        data.debitNotes[index] = {
          ...data.debitNotes[index],
          accountId: client.id,
          accountName: client.name,
          accountNit: client.nit,
          requesterId: requesterId,
          solicitante: solicitanteStr || 'Oficina Central',
          passengerName: passengerName,
          issueDate: document.getElementById('nd-issue-date').value,
          paymentTerm: document.getElementById('nd-payment-term').value,
          currency: document.getElementById('nd-currency').value,
          totalAmountBob: totalBob,
          totalAmountUsd: totalUsd,
          balanceBob: totalBob,
          balanceUsd: totalUsd,
          observations: document.getElementById('nd-observations').value.trim(),
          items: this.activeItems,
          updatedAt: new Date().toLocaleString()
        };
        window.app.showToast('Nota de Débito actualizada', 'success');
      }
    } else {
      const nextNd = (data.debitNotes.length > 0) ? Math.max(...data.debitNotes.map(n => n.ndNumber)) + 1 : 1001;
      const newNd = {
        id: 'ND-' + Date.now(),
        ndNumber: nextNd,
        accountId: client.id,
        accountName: client.name,
        accountNit: client.nit,
        requesterId: requesterId,
        solicitante: solicitanteStr || 'Oficina Central',
        passengerName: passengerName,
        issueDate: document.getElementById('nd-issue-date').value,
        paymentTerm: document.getElementById('nd-payment-term').value,
        currency: document.getElementById('nd-currency').value,
        totalAmountBob: totalBob,
        totalAmountUsd: totalUsd,
        paidAmountBob: 0.00,
        paidAmountUsd: 0.00,
        balanceBob: totalBob,
        balanceUsd: totalUsd,
        status: 'BORRADOR',
        observations: document.getElementById('nd-observations').value.trim(),
        createdById: data.currentUser.id,
        createdByName: data.currentUser.name,
        items: this.activeItems,
        createdAt: new Date().toLocaleString()
      };
      data.debitNotes.unshift(newNd);
      window.app.showToast(`Nota de Débito ND #${newNd.ndNumber} guardada en Borrador`, 'success');
    }

    window.db.save(data);
    window.app.closeModal('modal-nd');
    this.render();
    if (window.operationsHubModule) window.operationsHubModule.render();
    if (window.app && window.app.updateDashboardKpis) window.app.updateDashboardKpis();
  },

  /**
   * CIERRE DE NOTA DE DÉBITO (ACCIÓN CRÍTICA)
   * 1. Bloquea la ND (Pasa a IMPAGA).
   * 2. Marca los boletos GDS como ASIGNADOS.
   * 3. Genera automáticamente las Notas de Crédito (NC) a favor de cada proveedor involucrado.
   */
  closeNd(ndId) {
    if (!confirm('¿Confirma el CIERRE DEFINITIVO de esta Nota de Débito?\n\nAl cerrar, la ND quedará bloqueada y se GENERARÁN AUTOMÁTICAMENTE las Notas de Crédito a favor de los proveedores por el costo neto.')) {
      return;
    }

    const data = window.db.get();
    const nd = data.debitNotes.find(n => n.id === ndId);
    if (!nd) return;

    // 1. Cambiar estado de la ND
    nd.status = 'IMPAGA';
    nd.closedAt = new Date().toLocaleString();

    // 2. Marcar boletos GDS como ASIGNADO
    nd.items.forEach(item => {
      if (item.gdsTicketId) {
        const ticket = data.gdsTickets.find(t => t.id === item.gdsTicketId);
        if (ticket) ticket.status = 'ASIGNADO';
      }
    });

    // 3. Agrupar costos netos por proveedor y generar NC
    const providerCosts = {};
    nd.items.forEach(item => {
      const pId = item.operatorId || 'ACC-004';
      if (!providerCosts[pId]) {
        providerCosts[pId] = {
          providerId: pId,
          providerName: item.operatorName || 'Proveedor',
          currency: item.currency,
          totalNetCost: 0,
          ticketNumbers: []
        };
      }
      providerCosts[pId].totalNetCost += (item.netCostToProvider || item.totalAmount);
      if (item.ticketNumber) providerCosts[pId].ticketNumbers.push(item.ticketNumber);
    });

    let ncGeneratedCount = 0;
    const nextNcBase = (data.creditNotes.length > 0) ? Math.max(...data.creditNotes.map(c => c.ncNumber)) + 1 : 501;

    Object.values(providerCosts).forEach((group, idx) => {
      const ncNumber = nextNcBase + idx;
      const netAmount = parseFloat(group.totalNetCost.toFixed(2));
      const prov = data.accounts.find(a => a.id === group.providerId);

      const newNc = {
        id: 'NC-' + Date.now() + '-' + idx,
        ncNumber: ncNumber,
        providerId: group.providerId,
        providerName: prov ? prov.name : group.providerName,
        providerNit: prov ? prov.nit : '',
        originDebitNoteId: nd.id,
        originDebitNoteNumber: nd.ndNumber,
        issueDate: nd.issueDate,
        concept: `Liquidación automática por Cierre de ND #${nd.ndNumber} (Servicios/Boletos: ${group.ticketNumbers.join(', ')})`,
        currency: group.currency,
        totalAmount: netAmount,
        paidAmount: 0.00,
        balance: netAmount,
        status: 'IMPAGA',
        isAutoGenerated: true,
        createdById: data.currentUser.id,
        createdAt: new Date().toLocaleString()
      };

      data.creditNotes.unshift(newNc);
      ncGeneratedCount++;
    });

    window.db.save(data);
    this.render();
    if (window.creditNotesModule) window.creditNotesModule.render();
    if (window.operationsHubModule) window.operationsHubModule.render();
    if (window.app && window.app.updateDashboardKpis) window.app.updateDashboardKpis();

    window.app.showToast(`ND #${nd.ndNumber} CERRADA. Se generaron ${ncGeneratedCount} Nota(s) de Crédito a proveedores`, 'success');
  },

  reopenNd(ndId) {
    const data = window.db.get();
    const nd = data.debitNotes.find(n => n.id === ndId);
    if (!nd) return;

    if (nd.paidAmountBob > 0 || nd.paidAmountUsd > 0) {
      alert('ATENCIÓN: No es posible reabrir esta Nota de Débito porque ya registra pagos en caja. Debe revertir los recibos de caja asociados primero.');
      return;
    }

    if (!confirm(`¿Desea REABRIR la Nota de Débito ND #${nd.ndNumber}?\n\nAl reabrir, se anularán las Notas de Crédito generadas automáticamente para los proveedores y volverá al estado BORRADOR.`)) {
      return;
    }

    nd.status = 'BORRADOR';

    // Eliminar NC automáticas originadas en esta ND
    data.creditNotes = data.creditNotes.filter(nc => nc.originDebitNoteId !== nd.id);

    // Revertir estado de boletos GDS a DISPONIBLE
    nd.items.forEach(item => {
      if (item.gdsTicketId) {
        const ticket = data.gdsTickets.find(t => t.id === item.gdsTicketId);
        if (ticket) ticket.status = 'DISPONIBLE';
      }
    });

    window.db.save(data);
    this.render();
    if (window.creditNotesModule) window.creditNotesModule.render();
    if (window.operationsHubModule) window.operationsHubModule.render();
    if (window.app && window.app.updateDashboardKpis) window.app.updateDashboardKpis();
    window.app.showToast(`ND #${nd.ndNumber} reabierta exitosamente en estado BORRADOR`, 'info');
  },

  /**
   * Conversor de importes numéricos a texto legal formal en español
   * Ejemplo: 3600.00 -> "Son: TRES MIL SEISCIENTOS 00/100 BOLIVIANOS"
   */
  numeroALetras(monto, moneda = 'BOB') {
    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const especiales = {
      10: 'DIEZ', 11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
      16: 'DIECISÉIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE', 20: 'VEINTE',
      21: 'VEINTIÚN', 22: 'VEINTIDÓS', 23: 'VEINTITRÉS', 24: 'VEINTICUATRO', 25: 'VEINTICINCO',
      26: 'VEINTISÉIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE'
    };
    const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    function convertirCentenas(n) {
      if (n === 0) return '';
      if (n === 100) return 'CIEN';
      const c = Math.floor(n / 100);
      const r = n % 100;
      const strC = centenas[c];
      if (r === 0) return strC;
      if (especiales[r]) return (strC ? strC + ' ' : '') + especiales[r];
      const d = Math.floor(r / 10);
      const u = r % 10;
      const strD = decenas[d];
      if (d > 2 && u > 0) return (strC ? strC + ' ' : '') + strD + ' Y ' + unidades[u];
      if (d > 0 && u === 0) return (strC ? strC + ' ' : '') + strD;
      return (strC ? strC + ' ' : '') + unidades[u];
    }

    function convertirMiles(n) {
      if (n === 0) return 'CERO';
      const m = Math.floor(n / 1000);
      const r = n % 1000;
      let strM = '';
      if (m === 1) strM = 'MIL';
      else if (m > 1) strM = convertirCentenas(m) + ' MIL';
      const strR = convertirCentenas(r);
      return [strM, strR].filter(Boolean).join(' ');
    }

    const partes = Number(monto || 0).toFixed(2).split('.');
    const entero = parseInt(partes[0], 10);
    const centavos = partes[1] || '00';

    let texto = '';
    if (entero === 0) {
      texto = 'CERO';
    } else if (entero < 1000000) {
      texto = convertirMiles(entero);
    } else {
      const mill = Math.floor(entero / 1000000);
      const resto = entero % 1000000;
      const strMill = mill === 1 ? 'UN MILLÓN' : convertirMiles(mill) + ' MILLONES';
      const strResto = resto > 0 ? convertirMiles(resto) : '';
      texto = [strMill, strResto].filter(Boolean).join(' ');
    }

    const sufijoMoneda = moneda === 'USD' ? 'DÓLARES AMERICANOS' : 'BOLIVIANOS';
    return `Son: ${texto} ${centavos}/100 ${sufijoMoneda}`;
  },

  formatEmissionDate(dateStr, timeStr) {
    if (!dateStr) return '17/07/2026 10:41';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]} ${timeStr || '10:41'}`;
      }
    } catch(e) {}
    return dateStr + ' ' + (timeStr || '10:41');
  },

  formatServiceDate(dateStr) {
    if (!dateStr) return '16Jul2026';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const day = parts[2];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const year = parts[0];
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${day}${months[monthIdx] || 'Jul'}${year}`;
      }
    } catch(e) {}
    return dateStr;
  },

  formatSlashDate(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    } catch(e) {}
    return dateStr;
  },

  /**
   * Genera el HTML del formato oficial de comprobante (ND y NC)
   * Respeta estrictamente el diseño corporativo original:
   * Cabecera de 3 columnas con logo, franjas verdes #00a884, grilla de 3 columnas
   * por servicio con switch (item.tipo_servicio) para los 10 servicios,
   * tabla de totales en verde #00a884, observaciones y firmas inferiores.
   */
  generateOfficialVoucherHtml(doc, customEmissionDate, customEmissionTime, explicitDocType = null) {
    if (!doc) return '';

    const isNc = explicitDocType === 'NC' || doc.ncNumber !== undefined || doc.docType === 'NC' || doc.type === 'NC';
    const docType = isNc ? 'NC' : 'ND';
    const docTitle = isNc ? 'Nota de Crédito' : 'Nota de Débito';
    const docNumber = isNc 
      ? (doc.ncNumber != null ? doc.ncNumber : doc.id)
      : (doc.ndNumber != null ? doc.ndNumber : doc.id);

    const data = window.db.get();
    
    // Cuenta asociada (Cliente para ND, Proveedor/Cliente para NC)
    let account = null;
    if (isNc) {
      account = (data.accounts || []).find(a => a.id === doc.providerId || a.id === doc.accountId);
    } else {
      account = (data.accounts || []).find(a => a.id === doc.accountId);
    }

    // Solicitante
    let solicitanteUpper = (doc.solicitante || doc.requestedBy || 'MARCO ANTONIO GARCIA').toUpperCase();
    if (doc.requesterId) {
      const req = (data.companyContacts || []).find(c => c.id === doc.requesterId);
      if (req) solicitanteUpper = req.fullName.toUpperCase();
    }

    // Código y Razón Social de la Cuenta
    const entityCode = (account && account.code) ? account.code : (doc.accountCode || doc.providerCode || (isNc ? 'PRV' : '2079'));
    const entityNameUpper = (
      doc.providerName || 
      doc.accountName || 
      (account ? (account.name || account.legalName) : '') || 
      (isNc ? 'PROVEEDOR' : 'CLIENTE')
    ).toUpperCase();

    // Fecha y hora de emisión (permite personalización antes de imprimir)
    const effectiveDate = customEmissionDate || doc.issueDate || new Date().toISOString().split('T')[0];
    const effectiveTime = customEmissionTime || doc.issueTime || '10:41';
    const emissionDateFormatted = this.formatEmissionDate(effectiveDate, effectiveTime);

    // Detección si es Nota de Débito por comisiones de plataforma
    const isCommissionNd = !isNc && Boolean(
      doc.isCommissionNd === true ||
      doc.serviceType === 'COMISION_PLATAFORMA' ||
      (doc.solicitante && doc.solicitante.toLowerCase().includes('comisi')) ||
      (doc.observations && doc.observations.toLowerCase().includes('comisi')) ||
      (doc.items && doc.items.some(it => it.serviceType === 'COMISION_PLATAFORMA' || it.isCommissionItem || (it.description && it.description.toLowerCase().includes('comisi'))))
    );

    // Obtención de ítems del comprobante
    let items = (doc.items && doc.items.length > 0) ? doc.items : null;
    if (!items && isNc) {
      if (doc.originDebitNoteId) {
        const originNd = (data.debitNotes || []).find(n => n.id === doc.originDebitNoteId || String(n.ndNumber) === String(doc.originDebitNoteNumber));
        if (originNd && originNd.items && originNd.items.length > 0) {
          items = originNd.items;
        }
      }
      if (!items) {
        items = [{
          tipo_servicio: doc.tipo_servicio || doc.serviceType || 'OTRO',
          operatorCode: (account && account.code) ? account.code : 'PRV',
          operatorName: entityNameUpper,
          description: doc.concept || 'ACREDITACIÓN DE SALDO A FAVOR',
          currency: doc.currency || 'BOB',
          totalAmount: doc.totalAmount || 0,
          passengerName: doc.beneficiaryName || doc.passengerName || entityNameUpper,
          serviceDate: effectiveDate,
          ticketNumber: doc.ticketNumber || (doc.originDebitNoteNumber ? `ND #${doc.originDebitNoteNumber}` : `NC #${doc.ncNumber || doc.id}`)
        }];
      }
    } else if (!items) {
      items = [
        {
          tipo_servicio: 'BOLETO_AEREO',
          operatorCode: 'OB',
          operatorName: 'BOLIVIANA DE AVIACIÓN NAL',
          description: 'BOLETO AEREO NAL',
          route: 'VVI-LPB-VVI',
          travelDates: 'DEL 27/07/2026 AL 28/07/2026',
          pnr: 'AZ44SK',
          currency: 'Bs',
          totalAmount: 1666.00,
          passengerName: doc.passengerName || 'SOSSA LINO JOSE LUIS',
          serviceDate: doc.issueDate || '2026-07-16',
          ticketNumber: '930 9496370496'
        }
      ];
    }

    // Rango de Fechas para ND de comisiones
    let dateRange = doc.dateRange || '';
    if (!dateRange && doc.dateFrom && doc.dateTo) {
      dateRange = `DEL ${this.formatSlashDate(doc.dateFrom)} AL ${this.formatSlashDate(doc.dateTo)}`;
    } else if (!dateRange && doc.observations) {
      const match = doc.observations.match(/del\s+(\d{4}-\d{2}-\d{2})\s+al\s+(\d{4}-\d{2}-\d{2})/i);
      if (match) {
        dateRange = `DEL ${this.formatSlashDate(match[1])} AL ${this.formatSlashDate(match[2])}`;
      }
    }
    if (!dateRange) {
      dateRange = 'PERIODO COMPLETO';
    }

    let itemsHtml = '';

    if (isCommissionNd) {
      const opName = (doc.operatorName || (items[0] && items[0].operatorName) || doc.accountName || (account ? (account.name || account.legalName) : '')).toUpperCase();
      const currSymbol = (doc.currency === 'USD') ? '$us' : 'Bs';
      const totalAmountNum = Number(doc.totalAmountBob != null ? doc.totalAmountBob : (doc.totalAmount || 0));
      const totalFormatted = totalAmountNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      itemsHtml = `
        <div class="nd-commission-block" style="padding: 16px 8px; font-size: 0.88rem;">
          <div class="nd-kv-row" style="margin-bottom: 12px; align-items: baseline;">
            <span class="nd-k" style="width: 150px; font-weight: 800; font-size: 0.85rem; color: #0f172a;">Operador :</span>
            <span class="nd-v font-bold" style="font-size: 1rem; color: #0f172a; letter-spacing: 0.3px;">${opName}</span>
          </div>
          <div class="nd-kv-row" style="margin-bottom: 12px; align-items: baseline;">
            <span class="nd-k" style="width: 150px; font-weight: 800; font-size: 0.85rem; color: #0f172a;">Rango de Fechas :</span>
            <span class="nd-v font-bold font-mono" style="font-size: 0.95rem; color: #0f172a;">${dateRange}</span>
          </div>
          <div class="nd-kv-row" style="align-items: baseline;">
            <span class="nd-k" style="width: 150px; font-weight: 800; font-size: 0.85rem; color: #0f172a;">Total a Facturar :</span>
            <span class="nd-v font-mono font-bold" style="font-size: 1.12rem; color: #0f172a;">${currSymbol} ${totalFormatted}</span>
          </div>
        </div>
      `;
    } else {
      itemsHtml = items.map((it, idx) => {
        const sd = it.serviceDetails || {};
        const srvType = (it.tipo_servicio || it.serviceType || (it.description && it.description.toLowerCase().includes('hotel') ? 'HOTEL' : 'BOLETO_AEREO')).toUpperCase();
        
        let opCode = it.operatorCode;
        if (!opCode) {
          const opLower = ((it.operatorName || '') + ' ' + (sd.airlineFlight || '') + ' ' + (sd.hotelName || '')).toLowerCase();
          if (opLower.includes('boa') || opLower.includes('boliviana')) opCode = 'OB';
          else if (opLower.includes('amaszonas') || opLower.includes('z8')) opCode = 'Z8';
          else if (opLower.includes('latam')) opCode = 'LA';
          else if (opLower.includes('avianca')) opCode = 'AV';
          else if (opLower.includes('copa')) opCode = 'CM';
          else if (srvType === 'HOTEL' || srvType === 'HOTEL_HOSPEDAJE') opCode = 'HTL';
          else if (srvType === 'PAQUETE_TURISTICO') opCode = 'PAQ';
          else if (srvType === 'PAQUETE_CRUCERO') opCode = 'CRU';
          else if (srvType === 'PAQUETE_CONCIERTO') opCode = 'CCT';
          else if (srvType === 'ASESORAMIENTO_VISAS') opCode = 'VISA';
          else if (srvType === 'CERTIFICACION_FA') opCode = 'IFA';
          else if (srvType === 'RENT_A_CAR') opCode = 'CAR';
          else if (srvType === 'SEGURO_VIAJE') opCode = 'SEG';
          else opCode = 'SRV';
        }

        const opName = (it.operatorName || sd.hotelName || sd.cruiseShip || sd.tourName || entityNameUpper || 'OPERADOR').toUpperCase();
        const currSymbol = (it.currency === 'USD' || doc.currency === 'USD') ? '$us' : 'Bs';
        const totalSrvFormatted = Number(it.totalAmount != null ? it.totalAmount : (it.total || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const passName = (it.passengerName || doc.passengerName || doc.beneficiaryName || '-').toUpperCase();
        const passDoc = (it.passengerDocId || it.passportNumber || it.documentId || '').toUpperCase();
        const ticketDate = this.formatServiceDate(it.serviceDate || it.issueDate || doc.issueDate);
        const ticketNum = it.ticketNumber || it.voucherNumber || it.bookingCode || it.confirmationNumber || '-';

        switch (srvType) {
          // 1. BOLETO_AEREO (o BOLETO_GDS)
          case 'BOLETO_AEREO':
          case 'BOLETO_GDS': {
            const srvRoute = (sd.flightRoute || it.route || it.description || 'VVI-LPB-VVI').toUpperCase();
            let srvDates = sd.travelDates || '';
            if (!srvDates && sd.flightDepDate) {
              srvDates = `DEL ${this.formatSlashDate(sd.flightDepDate)} AL ${this.formatSlashDate(sd.flightRetDate || sd.flightDepDate)}`;
            } else if (!srvDates && it.departureDate) {
              srvDates = `DEL ${this.formatSlashDate(it.departureDate)} AL ${this.formatSlashDate(it.returnDate || it.departureDate)}`;
            } else if (!srvDates) {
              srvDates = '-';
            }
            const pnrCode = (sd.pnrCode || it.pnr || it.locator || it.ticketCode || 'AZ44SK').toUpperCase();
            const cabinClass = (sd.cabinClass || it.cabin || 'ECONÓMICA').toUpperCase();
            const flightNum = (sd.flightNumber || it.flightNumber || '').toUpperCase();

            return `
              <div class="nd-item-block" ${idx > 0 ? 'style="margin-top: 10px;"' : ''}>
                <div class="nd-item-col nd-col-left">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 100px;">Cod. Operador:</span>
                    <span class="nd-v font-mono font-bold">${opCode}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 100px;">Operador :</span>
                    <span class="nd-v font-bold">${opName}</span>
                  </div>
                  <div class="nd-kv-row nd-service-row" style="margin-top: 6px; align-items: flex-start;">
                    <span class="nd-k" style="width: 100px;">Servicio :</span>
                    <div class="nd-v nd-service-details font-bold">
                      <div class="nd-srv-line" style="color: #0284c7;">BOLETO AÉREO / GDS</div>
                      <div class="nd-srv-line">RUTA: ${srvRoute}</div>
                      ${srvDates !== '-' ? `<div class="nd-srv-line">FECHAS: ${srvDates}</div>` : ''}
                      <div class="nd-srv-line">LOCALIZADOR: ${pnrCode} | CABINA: ${cabinClass}</div>
                    </div>
                  </div>
                </div>
                <div class="nd-item-col nd-col-center">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 105px;">Moneda :</span>
                    <span class="nd-v">${currSymbol}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 105px;">Total Servicio :</span>
                    <span class="nd-v font-mono font-bold">${totalSrvFormatted}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 6px;">
                    <span class="nd-k" style="width: 105px;">Pasajero :</span>
                    <span class="nd-v font-bold">${passName}</span>
                  </div>
                  ${passDoc ? `
                  <div class="nd-kv-row" style="margin-top: 2px;">
                    <span class="nd-k" style="width: 105px;">Doc. Identidad:</span>
                    <span class="nd-v font-mono">${passDoc}</span>
                  </div>` : ''}
                </div>
                <div class="nd-item-col nd-col-right">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 120px;">Fec. Emisión :</span>
                    <span class="nd-v font-bold">${ticketDate}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">No. Boleto :</span>
                    <span class="nd-v font-mono font-bold">${ticketNum}</span>
                  </div>
                  ${flightNum ? `
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">Nro Vuelo :</span>
                    <span class="nd-v font-mono">${flightNum}</span>
                  </div>` : ''}
                </div>
              </div>
            `;
          }

          // 2. HOTEL (o HOTEL_HOSPEDAJE)
          case 'HOTEL':
          case 'HOTEL_HOSPEDAJE': {
            const hotelName = (sd.hotelName || opName).toUpperCase();
            const hotelCity = (sd.hotelCity || it.city || '').toUpperCase();
            const checkIn = sd.checkIn ? this.formatSlashDate(sd.checkIn) : (it.checkIn ? this.formatSlashDate(it.checkIn) : ticketDate);
            const checkOut = sd.checkOut ? this.formatSlashDate(sd.checkOut) : (it.checkOut ? this.formatSlashDate(it.checkOut) : '-');
            const nights = sd.nights || it.nights || '1';
            const roomType = (sd.roomType || it.roomType || 'DOBLE ESTÁNDAR').toUpperCase();
            const boardBasis = (sd.boardBasis || it.boardBasis || 'DESAYUNO INCLUIDO').toUpperCase();
            const guests = (sd.guestsCount || it.guests || '1 HUÉSPED').toUpperCase();

            return `
              <div class="nd-item-block" ${idx > 0 ? 'style="margin-top: 10px;"' : ''}>
                <div class="nd-item-col nd-col-left">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 100px;">Cod. Operador:</span>
                    <span class="nd-v font-mono font-bold">${opCode}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 100px;">Hotel / Cadena:</span>
                    <span class="nd-v font-bold">${hotelName}</span>
                  </div>
                  <div class="nd-kv-row nd-service-row" style="margin-top: 6px; align-items: flex-start;">
                    <span class="nd-k" style="width: 100px;">Servicio :</span>
                    <div class="nd-v nd-service-details font-bold">
                      <div class="nd-srv-line" style="color: #059669;">HOSPEDAJE EN HOTEL ${hotelCity ? `(${hotelCity})` : ''}</div>
                      <div class="nd-srv-line">HABITACIÓN: ${roomType}</div>
                      <div class="nd-srv-line">RÉGIMEN: ${boardBasis}</div>
                    </div>
                  </div>
                </div>
                <div class="nd-item-col nd-col-center">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 105px;">Moneda :</span>
                    <span class="nd-v">${currSymbol}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 105px;">Total Hospedaje:</span>
                    <span class="nd-v font-mono font-bold">${totalSrvFormatted}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 6px;">
                    <span class="nd-k" style="width: 105px;">Huésped Titular:</span>
                    <span class="nd-v font-bold">${passName}</span>
                  </div>
                  ${passDoc ? `
                  <div class="nd-kv-row" style="margin-top: 2px;">
                    <span class="nd-k" style="width: 105px;">Doc. Identidad:</span>
                    <span class="nd-v font-mono">${passDoc}</span>
                  </div>` : ''}
                  <div class="nd-kv-row" style="margin-top: 2px;">
                    <span class="nd-k" style="width: 105px;">Huéspedes :</span>
                    <span class="nd-v">${guests}</span>
                  </div>
                </div>
                <div class="nd-item-col nd-col-right">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 120px;">Check-In :</span>
                    <span class="nd-v font-bold font-mono">${checkIn}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">Check-Out :</span>
                    <span class="nd-v font-bold font-mono">${checkOut}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">Estadía :</span>
                    <span class="nd-v font-bold" style="color: #059669;">${nights} NOCHES</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">No. Confirmación:</span>
                    <span class="nd-v font-mono font-bold">${ticketNum}</span>
                  </div>
                </div>
              </div>
            `;
          }

          // 3. PAQUETE_TURISTICO
          case 'PAQUETE_TURISTICO': {
            const tourName = (sd.tourName || it.tourName || it.description || 'PAQUETE TURÍSTICO').toUpperCase();
            const destination = (sd.destination || it.destination || '-').toUpperCase();
            const tourStart = sd.tourStartDate ? this.formatSlashDate(sd.tourStartDate) : (it.startDate ? this.formatSlashDate(it.startDate) : ticketDate);
            const tourEnd = sd.tourEndDate ? this.formatSlashDate(sd.tourEndDate) : (it.endDate ? this.formatSlashDate(it.endDate) : '-');
            const tourIncludes = (sd.includes || it.includes || 'VUELOS + HOTEL + TRASLADOS').toUpperCase();
            const paxCount = (sd.paxCount || it.paxCount || '1 PAX').toUpperCase();

            return `
              <div class="nd-item-block" ${idx > 0 ? 'style="margin-top: 10px;"' : ''}>
                <div class="nd-item-col nd-col-left">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 100px;">Cod. Operador:</span>
                    <span class="nd-v font-mono font-bold">${opCode}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 100px;">Operador Mayor.:</span>
                    <span class="nd-v font-bold">${opName}</span>
                  </div>
                  <div class="nd-kv-row nd-service-row" style="margin-top: 6px; align-items: flex-start;">
                    <span class="nd-k" style="width: 100px;">Servicio :</span>
                    <div class="nd-v nd-service-details font-bold">
                      <div class="nd-srv-line" style="color: #d97706;">PAQUETE TURÍSTICO: ${tourName}</div>
                      <div class="nd-srv-line">DESTINO: ${destination}</div>
                      <div class="nd-srv-line">INCLUYE: ${tourIncludes}</div>
                    </div>
                  </div>
                </div>
                <div class="nd-item-col nd-col-center">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 105px;">Moneda :</span>
                    <span class="nd-v">${currSymbol}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 105px;">Total Paquete :</span>
                    <span class="nd-v font-mono font-bold">${totalSrvFormatted}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 6px;">
                    <span class="nd-k" style="width: 105px;">Titular Grupo :</span>
                    <span class="nd-v font-bold">${passName}</span>
                  </div>
                  ${passDoc ? `
                  <div class="nd-kv-row" style="margin-top: 2px;">
                    <span class="nd-k" style="width: 105px;">Doc. Identidad:</span>
                    <span class="nd-v font-mono">${passDoc}</span>
                  </div>` : ''}
                  <div class="nd-kv-row" style="margin-top: 2px;">
                    <span class="nd-k" style="width: 105px;">Cantidad Pax :</span>
                    <span class="nd-v">${paxCount}</span>
                  </div>
                </div>
                <div class="nd-item-col nd-col-right">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 120px;">Fecha Inicio :</span>
                    <span class="nd-v font-bold font-mono">${tourStart}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">Fecha Fin :</span>
                    <span class="nd-v font-bold font-mono">${tourEnd}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">No. Reserva :</span>
                    <span class="nd-v font-mono font-bold">${ticketNum}</span>
                  </div>
                </div>
              </div>
            `;
          }

          // 4. PAQUETE_CRUCERO
          case 'PAQUETE_CRUCERO': {
            const cruiseShip = (sd.cruiseShip || it.cruiseShip || opName).toUpperCase();
            const cruiseItinerary = (sd.cruiseItinerary || it.cruiseItinerary || it.description || '-').toUpperCase();
            const cruisePort = (sd.departurePort || it.departurePort || '-').toUpperCase();
            const cruiseCabin = (sd.cabinType || it.cabinType || 'BALCÓN').toUpperCase();
            const embark = sd.embarkDate ? this.formatSlashDate(sd.embarkDate) : (it.embarkDate ? this.formatSlashDate(it.embarkDate) : ticketDate);
            const disembark = sd.disembarkDate ? this.formatSlashDate(sd.disembarkDate) : (it.disembarkDate ? this.formatSlashDate(it.disembarkDate) : '-');
            const board = (sd.cruiseBoard || it.cruiseBoard || 'PENSIÓN COMPLETA').toUpperCase();

            return `
              <div class="nd-item-block" ${idx > 0 ? 'style="margin-top: 10px;"' : ''}>
                <div class="nd-item-col nd-col-left">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 100px;">Cod. Operador:</span>
                    <span class="nd-v font-mono font-bold">${opCode}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 100px;">Naviera / Barco:</span>
                    <span class="nd-v font-bold">${cruiseShip}</span>
                  </div>
                  <div class="nd-kv-row nd-service-row" style="margin-top: 6px; align-items: flex-start;">
                    <span class="nd-k" style="width: 100px;">Servicio :</span>
                    <div class="nd-v nd-service-details font-bold">
                      <div class="nd-srv-line" style="color: #0284c7;">CRUCERO: ${cruiseItinerary}</div>
                      <div class="nd-srv-line">CABINA: ${cruiseCabin}</div>
                      <div class="nd-srv-line">RÉGIMEN: ${board}</div>
                    </div>
                  </div>
                </div>
                <div class="nd-item-col nd-col-center">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 105px;">Moneda :</span>
                    <span class="nd-v">${currSymbol}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 105px;">Total Crucero :</span>
                    <span class="nd-v font-mono font-bold">${totalSrvFormatted}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 6px;">
                    <span class="nd-k" style="width: 105px;">Huésped Princ.:</span>
                    <span class="nd-v font-bold">${passName}</span>
                  </div>
                  ${passDoc ? `
                  <div class="nd-kv-row" style="margin-top: 2px;">
                    <span class="nd-k" style="width: 105px;">Nro Pasaporte:</span>
                    <span class="nd-v font-mono">${passDoc}</span>
                  </div>` : ''}
                </div>
                <div class="nd-item-col nd-col-right">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 120px;">Embarque :</span>
                    <span class="nd-v font-bold font-mono">${embark}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">Puerto Salida :</span>
                    <span class="nd-v">${cruisePort}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">Desembarque :</span>
                    <span class="nd-v font-bold font-mono">${disembark}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">Booking Naviera:</span>
                    <span class="nd-v font-mono font-bold">${ticketNum}</span>
                  </div>
                </div>
              </div>
            `;
          }

          // 5. PAQUETE_CONCIERTO
          case 'PAQUETE_CONCIERTO': {
            const artist = (sd.concertArtist || it.concertArtist || it.description || 'CONCIERTO').toUpperCase();
            const venue = (sd.concertVenue || it.concertVenue || '-').toUpperCase();
            const showDate = sd.concertDate ? this.formatSlashDate(sd.concertDate) : (it.concertDate ? this.formatSlashDate(it.concertDate) : ticketDate);
            const sector = (sd.ticketSector || it.ticketSector || 'SECTOR GENERAL').toUpperCase();
            const qty = sd.concertQty || it.concertQty || '1';
            const includes = (sd.concertIncludes || it.concertIncludes || 'ENTRADA OFICIAL').toUpperCase();

            return `
              <div class="nd-item-block" ${idx > 0 ? 'style="margin-top: 10px;"' : ''}>
                <div class="nd-item-col nd-col-left">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 100px;">Cod. Operador:</span>
                    <span class="nd-v font-mono font-bold">${opCode}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 100px;">Productora :</span>
                    <span class="nd-v font-bold">${opName}</span>
                  </div>
                  <div class="nd-kv-row nd-service-row" style="margin-top: 6px; align-items: flex-start;">
                    <span class="nd-k" style="width: 100px;">Servicio :</span>
                    <div class="nd-v nd-service-details font-bold">
                      <div class="nd-srv-line" style="color: #8b5cf6;">CONCIERTO: ${artist}</div>
                      <div class="nd-srv-line">RECINTO: ${venue}</div>
                      <div class="nd-srv-line">SECTOR: ${sector}</div>
                    </div>
                  </div>
                </div>
                <div class="nd-item-col nd-col-center">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 105px;">Moneda :</span>
                    <span class="nd-v">${currSymbol}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 105px;">Total Evento :</span>
                    <span class="nd-v font-mono font-bold">${totalSrvFormatted}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 6px;">
                    <span class="nd-k" style="width: 105px;">Asistente :</span>
                    <span class="nd-v font-bold">${passName}</span>
                  </div>
                  ${passDoc ? `
                  <div class="nd-kv-row" style="margin-top: 2px;">
                    <span class="nd-k" style="width: 105px;">Doc. Identidad:</span>
                    <span class="nd-v font-mono">${passDoc}</span>
                  </div>` : ''}
                  <div class="nd-kv-row" style="margin-top: 2px;">
                    <span class="nd-k" style="width: 105px;">Cantidad :</span>
                    <span class="nd-v">${qty} ENTRADA(S)</span>
                  </div>
                </div>
                <div class="nd-item-col nd-col-right">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 120px;">Fecha Show :</span>
                    <span class="nd-v font-bold font-mono">${showDate}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">No. Ticket :</span>
                    <span class="nd-v font-mono font-bold">${ticketNum}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">Adicionales :</span>
                    <span class="nd-v">${includes}</span>
                  </div>
                </div>
              </div>
            `;
          }

          // 6. ASESORAMIENTO_VISAS
          case 'ASESORAMIENTO_VISAS': {
            const country = (sd.visaCountry || it.visaCountry || 'ESTADOS UNIDOS').toUpperCase();
            const visaType = (sd.visaType || it.visaType || 'B1/B2 TURISMO').toUpperCase();
            const consulate = (sd.consulate || it.consulate || 'SECCIÓN CONSULAR LA PAZ').toUpperCase();
            const appDate = sd.appointmentDate ? this.formatSlashDate(sd.appointmentDate) : (it.appointmentDate ? this.formatSlashDate(it.appointmentDate) : '-');
            const appTime = sd.appointmentTime || it.appointmentTime || '';
            const visaStatus = (sd.visaStatus || it.visaStatus || 'CITA AGENDADA').toUpperCase();

            return `
              <div class="nd-item-block" ${idx > 0 ? 'style="margin-top: 10px;"' : ''}>
                <div class="nd-item-col nd-col-left">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 100px;">Cod. Operador:</span>
                    <span class="nd-v font-mono font-bold">${opCode}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 100px;">Entidad :</span>
                    <span class="nd-v font-bold">ASESORÍA CONSULAR & MIGRATORIA</span>
                  </div>
                  <div class="nd-kv-row nd-service-row" style="margin-top: 6px; align-items: flex-start;">
                    <span class="nd-k" style="width: 100px;">Servicio :</span>
                    <div class="nd-v nd-service-details font-bold">
                      <div class="nd-srv-line" style="color: #dc2626;">TRÁMITE DE VISA: ${country}</div>
                      <div class="nd-srv-line">TIPO VISA: ${visaType}</div>
                      <div class="nd-srv-line">CONSULADO: ${consulate}</div>
                      <div class="nd-srv-line">ESTADO: ${visaStatus}</div>
                    </div>
                  </div>
                </div>
                <div class="nd-item-col nd-col-center">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 105px;">Moneda :</span>
                    <span class="nd-v">${currSymbol}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 105px;">Total Asesoría:</span>
                    <span class="nd-v font-mono font-bold">${totalSrvFormatted}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 6px;">
                    <span class="nd-k" style="width: 105px;">Solicitante :</span>
                    <span class="nd-v font-bold">${passName}</span>
                  </div>
                  ${passDoc ? `
                  <div class="nd-kv-row" style="margin-top: 2px;">
                    <span class="nd-k" style="width: 105px;">Nro Pasaporte:</span>
                    <span class="nd-v font-mono">${passDoc}</span>
                  </div>` : ''}
                </div>
                <div class="nd-item-col nd-col-right">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 120px;">Fec. Trámite :</span>
                    <span class="nd-v font-bold">${ticketDate}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">Cita Consular :</span>
                    <span class="nd-v font-bold font-mono" style="color: #dc2626;">${appDate} ${appTime}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">No. Formulario:</span>
                    <span class="nd-v font-mono font-bold">${ticketNum}</span>
                  </div>
                </div>
              </div>
            `;
          }

          // 7. CERTIFICACION_FA (Fiebre Amarilla)
          case 'CERTIFICACION_FA': {
            const certName = (sd.certCourse || it.certCourse || it.description || 'CERTIFICACIÓN INTERNACIONAL FA').toUpperCase();
            const entity = (sd.certInstitution || it.certInstitution || opName).toUpperCase();
            const certDate = sd.certDate ? this.formatSlashDate(sd.certDate) : (it.certDate ? this.formatSlashDate(it.certDate) : ticketDate);
            const hours = (sd.certHours || it.certHours || '120 HORAS ACADÉMICAS').toUpperCase();
            const validity = (sd.certValidity || it.certValidity || 'VIGENCIA 2 AÑOS').toUpperCase();

            return `
              <div class="nd-item-block" ${idx > 0 ? 'style="margin-top: 10px;"' : ''}>
                <div class="nd-item-col nd-col-left">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 100px;">Cod. Operador:</span>
                    <span class="nd-v font-mono font-bold">${opCode}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 100px;">Entidad Emisora:</span>
                    <span class="nd-v font-bold">${entity}</span>
                  </div>
                  <div class="nd-kv-row nd-service-row" style="margin-top: 6px; align-items: flex-start;">
                    <span class="nd-k" style="width: 100px;">Servicio :</span>
                    <div class="nd-v nd-service-details font-bold">
                      <div class="nd-srv-line" style="color: #4338ca;">CERTIFICACIÓN: ${certName}</div>
                      <div class="nd-srv-line">CARGA HORARIA: ${hours}</div>
                      <div class="nd-srv-line">VIGENCIA: ${validity}</div>
                    </div>
                  </div>
                </div>
                <div class="nd-item-col nd-col-center">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 105px;">Moneda :</span>
                    <span class="nd-v">${currSymbol}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 105px;">Total Matrícula:</span>
                    <span class="nd-v font-mono font-bold">${totalSrvFormatted}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 6px;">
                    <span class="nd-k" style="width: 105px;">Postulante :</span>
                    <span class="nd-v font-bold">${passName}</span>
                  </div>
                  ${passDoc ? `
                  <div class="nd-kv-row" style="margin-top: 2px;">
                    <span class="nd-k" style="width: 105px;">Doc. Identidad:</span>
                    <span class="nd-v font-mono">${passDoc}</span>
                  </div>` : ''}
                </div>
                <div class="nd-item-col nd-col-right">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 120px;">Fec. Certif. :</span>
                    <span class="nd-v font-bold font-mono">${certDate}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">No. Certificado:</span>
                    <span class="nd-v font-mono font-bold">${ticketNum}</span>
                  </div>
                </div>
              </div>
            `;
          }

          // 8. RENT_A_CAR
          case 'RENT_A_CAR': {
            const comp = (sd.rentalCompany || it.rentalCompany || opName).toUpperCase();
            const category = (sd.carCategory || it.carCategory || 'AUTO COMPACTO').toUpperCase();
            const pickup = `${sd.pickUpLocation || it.pickUpLocation || '-'} ${sd.pickUpDate ? `(${sd.pickUpDate})` : ''}`.trim().toUpperCase();
            const dropoff = `${sd.dropOffLocation || it.dropOffLocation || '-'} ${sd.dropOffDate ? `(${sd.dropOffDate})` : ''}`.trim().toUpperCase();
            const days = sd.rentalDays || it.rentalDays || '1';
            const insurance = (sd.rentalInsurance || it.rentalInsurance || 'CDW COBERTURA TOTAL').toUpperCase();

            return `
              <div class="nd-item-block" ${idx > 0 ? 'style="margin-top: 10px;"' : ''}>
                <div class="nd-item-col nd-col-left">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 100px;">Cod. Operador:</span>
                    <span class="nd-v font-mono font-bold">${opCode}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 100px;">Arrendadora :</span>
                    <span class="nd-v font-bold">${comp}</span>
                  </div>
                  <div class="nd-kv-row nd-service-row" style="margin-top: 6px; align-items: flex-start;">
                    <span class="nd-k" style="width: 100px;">Servicio :</span>
                    <div class="nd-v nd-service-details font-bold">
                      <div class="nd-srv-line" style="color: #0284c7;">ALQUILER VEHÍCULO: ${category}</div>
                      <div class="nd-srv-line">RETIRO: ${pickup}</div>
                      <div class="nd-srv-line">DEVOLUCIÓN: ${dropoff}</div>
                    </div>
                  </div>
                </div>
                <div class="nd-item-col nd-col-center">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 105px;">Moneda :</span>
                    <span class="nd-v">${currSymbol}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 105px;">Total Alquiler :</span>
                    <span class="nd-v font-mono font-bold">${totalSrvFormatted}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 6px;">
                    <span class="nd-k" style="width: 105px;">Conductor :</span>
                    <span class="nd-v font-bold">${passName}</span>
                  </div>
                  ${passDoc ? `
                  <div class="nd-kv-row" style="margin-top: 2px;">
                    <span class="nd-k" style="width: 105px;">Licencia/Doc :</span>
                    <span class="nd-v font-mono">${passDoc}</span>
                  </div>` : ''}
                  <div class="nd-kv-row" style="margin-top: 2px;">
                    <span class="nd-k" style="width: 105px;">Días Renta :</span>
                    <span class="nd-v font-bold">${days} DÍAS</span>
                  </div>
                </div>
                <div class="nd-item-col nd-col-right">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 120px;">Fec. Voucher :</span>
                    <span class="nd-v font-bold">${ticketDate}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">No. Confirmación:</span>
                    <span class="nd-v font-mono font-bold">${ticketNum}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">Seguros :</span>
                    <span class="nd-v">${insurance}</span>
                  </div>
                </div>
              </div>
            `;
          }

          // 9. SEGURO_VIAJE
          case 'SEGURO_VIAJE': {
            const comp = (sd.insuranceCompany || it.insuranceCompany || opName).toUpperCase();
            const plan = (sd.insurancePlan || it.insurancePlan || 'COBERTURA INTERNACIONAL').toUpperCase();
            const dest = (sd.insuranceDestination || it.insuranceDestination || 'MUNDIAL').toUpperCase();
            const start = sd.coverageStartDate ? this.formatSlashDate(sd.coverageStartDate) : (it.startDate ? this.formatSlashDate(it.startDate) : ticketDate);
            const end = sd.coverageEndDate ? this.formatSlashDate(sd.coverageEndDate) : (it.endDate ? this.formatSlashDate(it.endDate) : '-');
            const days = sd.coverageDays || it.coverageDays || '15';
            const emergency = (sd.insuranceEmergency || it.insuranceEmergency || '').toUpperCase();

            return `
              <div class="nd-item-block" ${idx > 0 ? 'style="margin-top: 10px;"' : ''}>
                <div class="nd-item-col nd-col-left">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 100px;">Cod. Operador:</span>
                    <span class="nd-v font-mono font-bold">${opCode}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 100px;">Aseguradora :</span>
                    <span class="nd-v font-bold">${comp}</span>
                  </div>
                  <div class="nd-kv-row nd-service-row" style="margin-top: 6px; align-items: flex-start;">
                    <span class="nd-k" style="width: 100px;">Servicio :</span>
                    <div class="nd-v nd-service-details font-bold">
                      <div class="nd-srv-line" style="color: #059669;">SEGURO DE VIAJE & ASISTENCIA</div>
                      <div class="nd-srv-line">PLAN: ${plan}</div>
                      <div class="nd-srv-line">DESTINO: ${dest}</div>
                      ${emergency ? `<div class="nd-srv-line">EMERGENCIA 24H: ${emergency}</div>` : ''}
                    </div>
                  </div>
                </div>
                <div class="nd-item-col nd-col-center">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 105px;">Moneda :</span>
                    <span class="nd-v">${currSymbol}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 105px;">Total Prima :</span>
                    <span class="nd-v font-mono font-bold">${totalSrvFormatted}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 6px;">
                    <span class="nd-k" style="width: 105px;">Asegurado :</span>
                    <span class="nd-v font-bold">${passName}</span>
                  </div>
                  ${passDoc ? `
                  <div class="nd-kv-row" style="margin-top: 2px;">
                    <span class="nd-k" style="width: 105px;">Pasaporte/Doc :</span>
                    <span class="nd-v font-mono">${passDoc}</span>
                  </div>` : ''}
                </div>
                <div class="nd-item-col nd-col-right">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 120px;">Vigencia :</span>
                    <span class="nd-v font-bold font-mono">${start} AL ${end}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">Total Días :</span>
                    <span class="nd-v font-bold" style="color: #059669;">${days} DÍAS</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">No. Póliza :</span>
                    <span class="nd-v font-mono font-bold">${ticketNum}</span>
                  </div>
                </div>
              </div>
            `;
          }

          // 10. OTRO (o servicio general personalizado)
          case 'OTRO':
          default: {
            const concept = (sd.customDetails || it.customDetails || it.description || 'SERVICIO ESPECIALIZADO').toUpperCase();
            const location = (sd.customLocation || it.customLocation || it.location || '').toUpperCase();
            const srvDate = sd.customDates ? this.formatSlashDate(sd.customDates) : (it.customDates ? this.formatSlashDate(it.customDates) : (it.serviceDate ? this.formatSlashDate(it.serviceDate) : ticketDate));
            const notes = (sd.customNotes || it.customNotes || it.notes || '').toUpperCase();

            return `
              <div class="nd-item-block" ${idx > 0 ? 'style="margin-top: 10px;"' : ''}>
                <div class="nd-item-col nd-col-left">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 100px;">Cod. Operador:</span>
                    <span class="nd-v font-mono font-bold">${opCode}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 100px;">Operador/Prov.:</span>
                    <span class="nd-v font-bold">${opName}</span>
                  </div>
                  <div class="nd-kv-row nd-service-row" style="margin-top: 6px; align-items: flex-start;">
                    <span class="nd-k" style="width: 100px;">Servicio :</span>
                    <div class="nd-v nd-service-details font-bold">
                      <div class="nd-srv-line" style="color: #00a884;">${concept}</div>
                      ${location ? `<div class="nd-srv-line">UBICACIÓN: ${location}</div>` : ''}
                      ${notes ? `<div class="nd-srv-line">DETALLES: ${notes}</div>` : ''}
                    </div>
                  </div>
                </div>
                <div class="nd-item-col nd-col-center">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 105px;">Moneda :</span>
                    <span class="nd-v">${currSymbol}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 105px;">Total Servicio :</span>
                    <span class="nd-v font-mono font-bold">${totalSrvFormatted}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 6px;">
                    <span class="nd-k" style="width: 105px;">Beneficiario :</span>
                    <span class="nd-v font-bold">${passName}</span>
                  </div>
                  ${passDoc ? `
                  <div class="nd-kv-row" style="margin-top: 2px;">
                    <span class="nd-k" style="width: 105px;">Doc. Identidad:</span>
                    <span class="nd-v font-mono">${passDoc}</span>
                  </div>` : ''}
                </div>
                <div class="nd-item-col nd-col-right">
                  <div class="nd-kv-row">
                    <span class="nd-k" style="width: 120px;">Fec. Servicio :</span>
                    <span class="nd-v font-bold font-mono">${srvDate}</span>
                  </div>
                  <div class="nd-kv-row" style="margin-top: 3px;">
                    <span class="nd-k" style="width: 120px;">No. Comprobante:</span>
                    <span class="nd-v font-mono font-bold">${ticketNum}</span>
                  </div>
                </div>
              </div>
            `;
          }
        }
      }).join('<div class="nd-item-subdivider"></div>');
    }

    // Tipo de cambio congelado al emitir
    const tcUsed = doc.frozenExchangeRate || doc.exchangeRateUsed || (data.systemSettings ? data.systemSettings.activeExchangeSell : 6.96) || 6.96;

    // Totales
    const currencyStr = doc.currency || 'BOB';
    const amountVal = Number(doc.totalAmountBob != null ? doc.totalAmountBob : (doc.totalAmount || 0));
    let totalUsdFormatted = '0.00';
    let totalBobFormatted = '0.00';

    if (currencyStr === 'USD') {
      totalUsdFormatted = Number(doc.totalAmountUsd || (amountVal / tcUsed) || doc.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      totalBobFormatted = Number(amountVal * (amountVal === (doc.totalAmountUsd || doc.totalAmount) ? tcUsed : 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      totalUsdFormatted = Number(amountVal / tcUsed).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      totalBobFormatted = Number(amountVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Observaciones
    let obsText = '';
    if (isCommissionNd) {
      obsText = (doc.manualObservations || (doc.observations && !doc.observations.includes('Boletos incluidos:') ? doc.observations : `LIQUIDACIÓN OFICIAL DE COMISIONES DE PLATAFORMA - ${dateRange}`)).toUpperCase();
    } else {
      obsText = (doc.observations || doc.concept || (doc.items && doc.items[0] && doc.items[0].description) || 'OPERACIÓN REGISTRADA').toUpperCase();
    }

    return `
      <div class="nd-official-container">
        <!-- 1. ENCABEZADO DE 3 COLUMNAS -->
        <div class="nd-official-header">
          <div class="nd-header-brand">
            <img src="assets/logo.jpg" class="nd-official-logo" alt="MARETRAVEL" onerror="this.style.display='none'">
          </div>

          <div class="nd-header-title-box">
            <h1 class="nd-title-main">${docTitle}</h1>
            <div class="nd-number-line">Nro.: ${docNumber}</div>
            
            <table class="nd-meta-table">
              <tr>
                <td class="nd-lbl-cell">Fecha de Emisión :</td>
                <td class="nd-val-cell">${emissionDateFormatted}</td>
              </tr>
              <tr>
                <td class="nd-lbl-cell">Solicitado Por :</td>
                <td class="nd-val-cell font-bold">${solicitanteUpper}</td>
              </tr>
              <tr>
                <td class="nd-lbl-cell">${isNc ? 'Código Proveedor :' : 'Código Cliente :'}</td>
                <td class="nd-val-cell font-mono font-bold">${entityCode}</td>
              </tr>
              <tr>
                <td class="nd-lbl-cell">${isNc ? 'Proveedor/Benef. :' : 'Empresa/Cliente :'}</td>
                <td class="nd-val-cell font-bold">${entityNameUpper}</td>
              </tr>
            </table>
          </div>

          <div class="nd-header-agency-info">
            <div class="nd-agency-bold">MARETRAVEL SRL</div>
            <div class="nd-agency-line">Dirección: Barrio Petrolero Norte,</div>
            <div class="nd-agency-line">Calle Los Tajibos #2123</div>
            <div class="nd-agency-line">Teléfonos: 3443322 – 75540100</div>
            <div class="nd-agency-line">Correo: info@maretravel.com.bo</div>
            <div class="nd-agency-line" style="font-weight: 700;">Santa Cruz - Bolivia</div>
          </div>
        </div>

        <!-- 2. SECCIÓN DETALLE CON FRANJA VERDE #00a884 -->
        <div class="nd-detail-section">
          <div class="nd-green-badge">Detalle</div>
          <div class="nd-green-line"></div>

          <div class="nd-items-wrapper">
            ${itemsHtml}
          </div>

          <div class="nd-green-line" style="margin-top: 18px; margin-bottom: 12px;"></div>
        </div>

        <!-- 3. SECCIÓN TOTALES & OBSERVACIONES CON ENCABEZADO EN VERDE -->
        <div class="nd-footer-section">
          <div class="nd-totals-outer">
            <table class="nd-totals-grid">
              <thead>
                <tr>
                  <th style="background: transparent; border: none;"></th>
                  <th class="nd-th-currency">${currencyStr === 'USD' ? 'USD' : 'BOB'}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="nd-td-total-label">Importe Total ${docType}:</td>
                  <td class="nd-td-total-val font-mono">${currencyStr === 'USD' ? '$us ' + totalUsdFormatted : 'BOB ' + totalBobFormatted}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="nd-obs-row">
            <span class="nd-obs-badge">Observaciones ${docType}:</span>
            <span class="nd-obs-content font-bold">${obsText}</span>
          </div>
        </div>

        <!-- 4. FIRMAS INFERIORES -->
        <div class="nd-signatures-container">
          <div class="nd-signature-box">
            <div class="nd-signature-line"></div>
            <div class="nd-signature-text">Sello Agencia</div>
          </div>

          <div class="nd-signature-box">
            <div class="nd-signature-line"></div>
            <div class="nd-signature-text">${isNc ? 'Sello/Firma del Proveedor' : 'Sello/Firma del Cliente'}</div>
          </div>
        </div>

        <!-- 5. CLÁUSULA LEGAL -->
        <div class="nd-legal-text">
          ${isNc 
            ? 'Este documento certifica la acreditación de saldo o anulación/devolución a favor del beneficiario conforme a las políticas vigentes de MARETRAVEL SRL.'
            : 'Este documento constituye un reconocimiento de deuda - que en su caso podrá ser elevado a instrumento público con el sólo reconocimiento de sello, firma o rúbrica.'
          }
        </div>
      </div>
    `;
  },

  /**
   * Ejecución de impresión infalible mediante iframe aislado (evita páginas en blanco en Chrome)
   */
  executePrint(voucherHtml, docType = 'ND') {
    const isNc = docType === 'NC';
    const docTitle = isNc ? 'Nota de Crédito' : 'Nota de Débito';

    // 1. Inyectar en #print-area para soporte nativo
    const printArea = document.getElementById('print-area');
    if (printArea) {
      printArea.innerHTML = voucherHtml;
    }

    try {
      let printFrame = document.getElementById('maretravel-print-frame');
      if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'maretravel-print-frame';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        printFrame.style.opacity = '0';
        printFrame.style.pointerEvents = 'none';
        document.body.appendChild(printFrame);
      }

      const frameDoc = printFrame.contentWindow.document;
      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>${docTitle} - MARETRAVEL SRL</title>
          <link rel="stylesheet" href="css/style.css">
          <style>
            @page {
              size: letter portrait;
              margin: 8mm 10mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #1e293b !important;
              display: block !important;
              height: auto !important;
              overflow: visible !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
            }
            .nd-official-container {
              width: 100% !important;
              max-width: 100% !important;
              padding: 5px 10px !important;
              margin: 0 auto !important;
            }
            .nd-green-badge {
              background-color: #00a884 !important;
              color: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .nd-green-line {
              background-color: #00a884 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .nd-th-currency {
              background-color: #00a884 !important;
              color: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .nd-obs-badge {
              background-color: #00a884 !important;
              color: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          </style>
        </head>
        <body>
          ${voucherHtml}
        </body>
        </html>
      `);
      frameDoc.close();

      // Esperar a que cargue el CSS e imágenes antes de invocar print()
      setTimeout(() => {
        try {
          printFrame.contentWindow.focus();
          printFrame.contentWindow.print();
        } catch(frameErr) {
          console.warn('Iframe print error, fallback a window.print():', frameErr);
          window.print();
        }
      }, 350);
    } catch (e) {
      console.warn('Fallback a window.print():', e);
      window.print();
    }
  },

  /**
   * Vista previa y emisión oficial para ND y NC
   */
  printPreview(docId, format = 'long', docType = 'ND') {
    const data = window.db.get();
    let doc = null;
    if (docType === 'NC' || String(docId).startsWith('NC')) {
      doc = (data.creditNotes || []).find(n => n.id === docId);
      docType = 'NC';
    } else {
      doc = (data.debitNotes || []).find(n => n.id === docId);
      if (!doc) {
        doc = (data.creditNotes || []).find(n => n.id === docId);
        if (doc) docType = 'NC';
      }
    }
    if (!doc) return;

    // Obtener campos de edición de fecha/hora de emisión
    const dateInput = document.getElementById('nd-edit-emission-date');
    const timeInput = document.getElementById('nd-edit-emission-time');

    if (dateInput) {
      dateInput.value = doc.issueDate || new Date().toISOString().split('T')[0];
    }
    if (timeInput) {
      timeInput.value = doc.issueTime || '10:41';
    }

    const refreshVoucher = () => {
      const selectedDate = dateInput && dateInput.value ? dateInput.value : doc.issueDate;
      const selectedTime = timeInput && timeInput.value ? timeInput.value : (doc.issueTime || '10:41');

      // Actualizar en el objeto doc y guardar en la base de datos para persistencia
      doc.issueDate = selectedDate;
      doc.issueTime = selectedTime;
      window.db.save();

      const html = this.generateOfficialVoucherHtml(doc, selectedDate, selectedTime, docType);

      const printArea = document.getElementById('print-area');
      if (printArea) {
        printArea.innerHTML = html;
      }

      const previewBody = document.getElementById('nd-modal-preview-body');
      if (previewBody) {
        previewBody.innerHTML = html;
      }

      return html;
    };

    if (dateInput) {
      dateInput.onchange = refreshVoucher;
      dateInput.oninput = refreshVoucher;
    }
    if (timeInput) {
      timeInput.onchange = refreshVoucher;
      timeInput.oninput = refreshVoucher;
    }

    const currentVoucherHtml = refreshVoucher();

    const btnModalPrint = document.getElementById('btn-print-from-modal');
    if (btnModalPrint) {
      btnModalPrint.onclick = () => {
        const latestHtml = refreshVoucher();
        this.executePrint(latestHtml, docType);
      };
    }

    // Abrir modal de vista previa
    window.app.openModal('modal-nd-voucher-preview');

    try {
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    } catch(e) {}
  },

  /**
   * Alias para imprimir voucher desde el Hub Unificado o módulos externos
   */
  printVoucher(docId, docType = 'ND') {
    this.printPreview(docId, 'long', docType);
  },

  /**
   * Impresión directa sin modal
   */
  directPrint(docId, docType = 'ND') {
    const data = window.db.get();
    let doc = (docType === 'NC' || String(docId).startsWith('NC'))
      ? (data.creditNotes || []).find(n => n.id === docId)
      : (data.debitNotes || []).find(n => n.id === docId);
    if (!doc) {
      doc = (data.creditNotes || []).find(n => n.id === docId);
      if (doc) docType = 'NC';
    }
    if (!doc) return;
    const voucherHtml = this.generateOfficialVoucherHtml(doc, null, null, docType);
    this.executePrint(voucherHtml, docType);
  }
};
