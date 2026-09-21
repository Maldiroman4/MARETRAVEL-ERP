/**
 * MARETRAVEL ERP - Módulo 1: Gestión de Cuentas (Clientes y Proveedores)
 * Incluye: Prestadores de servicios, comisiones estándar y auditoría de cambios.
 */

window.accountsModule = {
  currentFilterRelation: 'TODOS',
  editingAccountId: null,

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    const filterSelect = document.getElementById('account-relation-filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        this.currentFilterRelation = e.target.value;
        this.render();
      });
    }

    const searchInput = document.getElementById('account-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.render());
    }

    const btnNew = document.getElementById('btn-new-account');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.openModal());
    }

    const form = document.getElementById('account-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSave(e));
    }

    // Toggle de prestadores de servicio según relación
    const relSelect = document.getElementById('acc-relation-type');
    if (relSelect) {
      relSelect.addEventListener('change', () => this.toggleProviderServicesSection());
    }

    const btnAddService = document.getElementById('btn-add-provider-service');
    if (btnAddService) {
      btnAddService.addEventListener('click', () => this.addServiceRow());
    }

    // Formulario de Contacto Autorizado de Empresa
    const formContact = document.getElementById('company-contact-form');
    if (formContact) {
      formContact.addEventListener('submit', (e) => this.handleSaveCompanyContact(e));
    }

    // Filtro por Solicitante en Historial ND
    const historyReqFilter = document.getElementById('company-history-requester-filter');
    if (historyReqFilter) {
      historyReqFilter.addEventListener('change', (e) => {
        this.activeHistoryFilterRequester = e.target.value;
        this.renderCompanyHistory();
      });
    }

    // Búsqueda por Pasajero en Historial ND
    const historyPassSearch = document.getElementById('company-history-passenger-search');
    if (historyPassSearch) {
      historyPassSearch.addEventListener('input', () => this.renderCompanyHistory());
    }
  },

  render() {
    const data = window.db.get();
    const accounts = data.accounts || [];
    const search = (document.getElementById('account-search-input')?.value || '').toLowerCase();
    const tableBody = document.getElementById('accounts-table-body');
    if (!tableBody) return;

    let filtered = accounts.filter(acc => {
      const matchRelation = this.currentFilterRelation === 'TODOS' || 
                            acc.relationType === this.currentFilterRelation ||
                            acc.relationType === 'AMBOS';
      const matchSearch = acc.name.toLowerCase().includes(search) ||
                          acc.code.toLowerCase().includes(search) ||
                          (acc.nit && acc.nit.toLowerCase().includes(search)) ||
                          (acc.legalName && acc.legalName.toLowerCase().includes(search));
      return matchRelation && matchSearch;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 24px; color: var(--text-muted);">
            No se encontraron cuentas con los filtros seleccionados.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = filtered.map(acc => {
      const isProvider = acc.relationType === 'PROVEEDOR' || acc.relationType === 'AMBOS';
      const servicesCount = acc.providerServices?.length || 0;
      
      const relationBadge = acc.relationType === 'CLIENTE' ? 'badge-blue' :
                            acc.relationType === 'PROVEEDOR' ? 'badge-amber' : 'badge-emerald';

      const ratingBadge = acc.rating === 'VIP' ? 'badge-emerald' :
                          acc.rating === 'CRITICA' ? 'badge-rose' :
                          acc.rating === 'IMPORTANTE' ? 'badge-blue' : 'badge-slate';

      const isCorporate = acc.accountType === 'EMPRESA' || acc.relationType === 'CLIENTE' || acc.relationType === 'AMBOS';
      const contacts = (data.companyContacts || []).filter(c => c.companyId === acc.id);
      const contactCount = contacts.length;

      return `
        <tr>
          <td class="font-mono" style="font-weight: 700; color: var(--navy);">${acc.code}</td>
          <td>
            <div style="font-weight: 600;">${acc.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${acc.legalName || 'Sin Razón Social'}</div>
          </td>
          <td class="font-mono">${acc.nit || '-'}</td>
          <td><span class="badge ${relationBadge}">${acc.relationType}</span></td>
          <td><span class="badge ${ratingBadge}">${acc.rating}</span></td>
          <td>${acc.city || acc.department || '-'}</td>
          <td>
            ${isProvider ? `<span class="badge badge-slate">${servicesCount} serv.</span>` : (isCorporate ? `<span class="badge ${contactCount > 0 ? 'badge-blue' : 'badge-slate'}"><i data-lucide="users" style="width:11px;height:11px;display:inline-block;vertical-align:middle;"></i> ${contactCount} cont.</span>` : '<span style="color:#94a3b8;">-</span>')}
          </td>
          <td>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" onclick="window.accountsModule.openModal('${acc.id}')" title="Editar cuenta">
                <i data-lucide="edit-3"></i> Editar
              </button>
              ${isCorporate ? `
                <button class="btn btn-primary btn-sm" onclick="window.accountsModule.openCompanyContactsModal('${acc.id}')" title="Administrar Contactos / Solicitantes">
                  <i data-lucide="users"></i> Contactos
                </button>
                <button class="btn btn-secondary btn-sm" onclick="window.accountsModule.openCompanyHistoryModal('${acc.id}')" title="Historial de Emisiones de Boletos y ND">
                  <i data-lucide="file-text"></i> Historial ND
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-sm" onclick="window.accountsModule.showAuditHistory('${acc.id}')" title="Auditoría de cambios">
                <i data-lucide="history"></i>
              </button>
              <button class="btn btn-danger btn-sm" onclick="window.accountsModule.deleteAccount('${acc.id}')" title="Eliminar cuenta">
                <i data-lucide="trash-2"></i> Eliminar
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  toggleProviderServicesSection() {
    const rel = document.getElementById('acc-relation-type')?.value;
    const section = document.getElementById('provider-services-section');
    if (section) {
      if (rel === 'PROVEEDOR' || rel === 'AMBOS') {
        section.style.display = 'block';
      } else {
        section.style.display = 'none';
      }
    }
  },

  openModal(accountId = null) {
    this.editingAccountId = accountId;
    const form = document.getElementById('account-form');
    const modalTitle = document.getElementById('account-modal-title');
    const servicesContainer = document.getElementById('provider-services-list');
    if (servicesContainer) servicesContainer.innerHTML = '';

    const btnDelete = document.getElementById('btn-delete-account');
    if (btnDelete) {
      btnDelete.style.display = accountId ? 'inline-flex' : 'none';
    }

    if (accountId) {
      modalTitle.textContent = 'Editar Cuenta';
      const data = window.db.get();
      const acc = data.accounts.find(a => a.id === accountId);
      if (acc) {
        document.getElementById('acc-code').value = acc.code;
        document.getElementById('acc-name').value = acc.name;
        document.getElementById('acc-legal-name').value = acc.legalName || '';
        document.getElementById('acc-nit').value = acc.nit || '';
        document.getElementById('acc-relation-type').value = acc.relationType;
        document.getElementById('acc-type').value = acc.accountType;
        document.getElementById('acc-rating').value = acc.rating;
        document.getElementById('acc-department').value = acc.department || 'La Paz';
        document.getElementById('acc-city').value = acc.city || 'La Paz';
        document.getElementById('acc-address').value = acc.address || '';
        document.getElementById('acc-phone').value = acc.phone || '';
        document.getElementById('acc-cellphone').value = acc.cellphone || '';
        document.getElementById('acc-email').value = acc.email || '';
        document.getElementById('acc-web').value = acc.webPage || '';

        // Cargar prestadores de servicios si aplica
        if (acc.providerServices && acc.providerServices.length > 0) {
          acc.providerServices.forEach(srv => this.addServiceRow(srv.serviceCode, srv.serviceName, srv.defaultCommissionRate));
        }
      }
    } else {
      modalTitle.textContent = 'Nueva Cuenta (Cliente / Proveedor)';
      form.reset();
      // Generar código sugerido
      const data = window.db.get();
      const nextNum = (data.accounts.length + 1).toString().padStart(4, '0');
      document.getElementById('acc-code').value = `CTA-${nextNum}`;
      document.getElementById('acc-relation-type').value = 'CLIENTE';
      document.getElementById('acc-type').value = 'EMPRESA';
      document.getElementById('acc-rating').value = 'NORMAL';
    }

    this.toggleProviderServicesSection();
    window.app.openModal('modal-account');
  },

  openNewAccountModal() {
    this.openModal(null);
  },

  addServiceRow(code = '', name = '', rate = 0.00) {
    const container = document.getElementById('provider-services-list');
    if (!container) return;

    const rowId = 'srv_' + Math.random().toString(36).substr(2, 9);
    const div = document.createElement('div');
    div.className = 'service-row form-row';
    div.id = rowId;
    div.style.marginBottom = '8px';
    div.style.alignItems = 'center';
    div.innerHTML = `
      <div>
        <input type="text" class="form-control srv-code" placeholder="Código (ej: OB, Z8)" value="${code}" required>
      </div>
      <div style="grid-column: span 2;">
        <input type="text" class="form-control srv-name" placeholder="Descripción del Servicio" value="${name}" required>
      </div>
      <div>
        <input type="number" step="0.01" class="form-control srv-rate" placeholder="% Comis." value="${rate}" title="% Comisión Estándar">
      </div>
      <div style="flex-shrink: 0; width: 40px;">
        <button type="button" class="btn btn-danger btn-sm" onclick="document.getElementById('${rowId}').remove()">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;
    container.appendChild(div);
    if (window.lucide) window.lucide.createIcons();
  },

  handleSave(e) {
    e.preventDefault();
    const data = window.db.get();
    const isEdit = !!this.editingAccountId;

    // Extraer servicios de proveedor
    const services = [];
    const serviceRows = document.querySelectorAll('#provider-services-list .service-row');
    serviceRows.forEach(row => {
      const code = row.querySelector('.srv-code').value.trim();
      const name = row.querySelector('.srv-name').value.trim();
      const rate = parseFloat(row.querySelector('.srv-rate').value) || 0;
      if (code && name) {
        services.push({
          id: 'PS-' + Math.random().toString(36).substr(2, 6),
          serviceCode: code,
          serviceName: name,
          defaultCommissionRate: rate,
          status: 'ACTIVO'
        });
      }
    });

    const accountData = {
      code: document.getElementById('acc-code').value.trim(),
      name: document.getElementById('acc-name').value.trim(),
      legalName: document.getElementById('acc-legal-name').value.trim(),
      nit: document.getElementById('acc-nit').value.trim(),
      relationType: document.getElementById('acc-relation-type').value,
      accountType: document.getElementById('acc-type').value,
      rating: document.getElementById('acc-rating').value,
      department: document.getElementById('acc-department').value.trim(),
      city: document.getElementById('acc-city').value.trim(),
      address: document.getElementById('acc-address').value.trim(),
      phone: document.getElementById('acc-phone').value.trim(),
      cellphone: document.getElementById('acc-cellphone').value.trim(),
      email: document.getElementById('acc-email').value.trim(),
      webPage: document.getElementById('acc-web').value.trim(),
      providerServices: services,
      status: 'ACTIVO'
    };

    if (isEdit) {
      const index = data.accounts.findIndex(a => a.id === this.editingAccountId);
      if (index !== -1) {
        const old = data.accounts[index];
        // Registrar cambios en AccountHistory
        const fieldsToCheck = ['name', 'legalName', 'nit', 'relationType', 'rating', 'address', 'phone'];
        fieldsToCheck.forEach(field => {
          if (old[field] !== accountData[field]) {
            data.accountHistory.unshift({
              id: 'AH-' + Date.now() + Math.random().toString(36).substr(2, 4),
              accountId: old.id,
              accountName: accountData.name,
              changeType: 'UPDATE',
              fieldChanged: field,
              oldValue: String(old[field] || '-'),
              newValue: String(accountData[field] || '-'),
              userId: data.currentUser.id,
              userName: data.currentUser.name,
              createdAt: new Date().toLocaleString()
            });
          }
        });

        data.accounts[index] = { ...old, ...accountData, updatedAt: new Date().toLocaleString() };
        window.app.showToast('Cuenta actualizada exitosamente', 'success');
      }
    } else {
      const newId = 'ACC-' + Date.now();
      const newAccount = {
        id: newId,
        ...accountData,
        accountManager: data.currentUser.name,
        createdAt: new Date().toLocaleString()
      };
      data.accounts.unshift(newAccount);

      // Log de creación
      data.accountHistory.unshift({
        id: 'AH-' + Date.now(),
        accountId: newId,
        accountName: newAccount.name,
        changeType: 'CREATE',
        fieldChanged: 'Creación de Cuenta',
        oldValue: '-',
        newValue: `${newAccount.relationType} / ${newAccount.accountType}`,
        userId: data.currentUser.id,
        userName: data.currentUser.name,
        createdAt: new Date().toLocaleString()
      });

      window.app.showToast('Cuenta creada exitosamente', 'success');
    }

    window.db.save(data);
    window.app.closeModal('modal-account');
    this.render();
    if (window.operationsHubModule) {
      window.operationsHubModule.render();
    }
    if (window.app && window.app.updateDashboardKpis) {
      window.app.updateDashboardKpis();
    }
  },

  deleteAccount(accountId) {
    if (!accountId) return;
    const data = window.db.get();
    const acc = (data.accounts || []).find(a => a.id === accountId);
    if (!acc) {
      window.app.showToast('Cuenta no encontrada.', 'error');
      return;
    }

    // 1. Detección de documentos y operaciones comerciales vinculadas
    const linkedNds = (data.debitNotes || []).filter(nd => nd.accountId === accountId || nd.accountName === acc.name);
    const linkedNcs = (data.creditNotes || []).filter(nc => nc.providerId === accountId || nc.accountId === accountId || nc.providerName === acc.name || nc.accountName === acc.name);
    const linkedReceipts = (data.cashReceipts || []).filter(r => r.accountId === accountId || r.accountName === acc.name);
    const linkedPayments = (data.providerPayments || []).filter(p => p.providerId === accountId || p.providerName === acc.name);
    const linkedTickets = (data.gdsTickets || []).filter(t => t.operatorId === accountId);

    const totalMovements = linkedNds.length + linkedNcs.length + linkedReceipts.length + linkedPayments.length + linkedTickets.length;

    // 2. Diálogo de confirmación seguro
    if (totalMovements > 0) {
      const details = [];
      if (linkedNds.length > 0) details.push(`${linkedNds.length} Nota(s) de Débito`);
      if (linkedNcs.length > 0) details.push(`${linkedNcs.length} Nota(s) de Crédito / Liquidación`);
      if (linkedReceipts.length > 0) details.push(`${linkedReceipts.length} Recibo(s) de Caja`);
      if (linkedPayments.length > 0) details.push(`${linkedPayments.length} Comprobante(s) de Pago`);
      if (linkedTickets.length > 0) details.push(`${linkedTickets.length} Boleto(s) GDS`);

      const msg = `⚠️ ADVERTENCIA CONTABLE Y OPERATIVA:\n\n` +
        `La cuenta "${acc.name}" (${acc.code}) tiene ${totalMovements} registro(s) vinculado(s):\n` +
        `• ${details.join('\n• ')}\n\n` +
        `Si elimina esta cuenta, sus documentos históricos conservarán el nombre pero la cuenta desaparecerá del directorio comercial.\n\n` +
        `¿Está absolutamente seguro de ELIMINAR definitivamente la cuenta "${acc.name}"?`;

      if (!confirm(msg)) {
        return;
      }
    } else {
      const msg = `¿Confirma que desea eliminar la cuenta "${acc.name}" (${acc.code}) del directorio?`;
      if (!confirm(msg)) {
        return;
      }
    }

    // 3. Auditoría de eliminación
    if (!data.accountHistory) data.accountHistory = [];
    data.accountHistory.unshift({
      id: 'AH-' + Date.now(),
      accountId: acc.id,
      accountName: acc.name,
      changeType: 'DELETE',
      fieldChanged: 'Eliminación de Cuenta',
      oldValue: `${acc.code} - ${acc.name} (${acc.relationType || 'CUENTA'})`,
      newValue: 'ELIMINADA',
      userId: data.currentUser ? data.currentUser.id : 'USR-001',
      userName: data.currentUser ? data.currentUser.name : 'Administrador',
      createdAt: new Date().toLocaleString()
    });

    // 4. Limpiar contactos de empresa asociados
    if (data.companyContacts && Array.isArray(data.companyContacts)) {
      data.companyContacts = data.companyContacts.filter(c => c.companyId !== accountId);
    }

    // 5. Eliminar la cuenta del arreglo principal
    data.accounts = (data.accounts || []).filter(a => a.id !== accountId);

    // 6. Guardar cambios en la base de datos física / localStorage
    window.db.save(data);

    // Cerrar modal si estaba abierto
    window.app.closeModal('modal-account');
    window.app.showToast(`Cuenta "${acc.name}" eliminada exitosamente.`, 'success');

    // 7. Refrescar vistas reactivamente
    this.render();
    if (window.operationsHubModule && typeof window.operationsHubModule.render === 'function') {
      window.operationsHubModule.render();
    }
    if (window.debitNotesModule && typeof window.debitNotesModule.render === 'function') {
      window.debitNotesModule.render();
    }
    if (window.creditNotesModule && typeof window.creditNotesModule.render === 'function') {
      window.creditNotesModule.render();
    }
    if (window.cashRegisterModule && typeof window.cashRegisterModule.render === 'function') {
      window.cashRegisterModule.render();
    }
    if (window.gdsModule && typeof window.gdsModule.render === 'function') {
      window.gdsModule.render();
    }
    if (window.otherIncomesModule && typeof window.otherIncomesModule.render === 'function') {
      window.otherIncomesModule.render();
    }
    if (window.app && typeof window.app.updateDashboardKpis === 'function') {
      window.app.updateDashboardKpis();
    }
  },

  showAuditHistory(accountId) {
    const data = window.db.get();
    const acc = data.accounts.find(a => a.id === accountId);
    const history = (data.accountHistory || []).filter(h => h.accountId === accountId);
    const container = document.getElementById('audit-history-content');
    const title = document.getElementById('audit-modal-title');

    if (title) title.textContent = `Historial de Auditoría: ${acc ? acc.name : 'Cuenta'}`;

    if (!history || history.length === 0) {
      container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 20px;">Sin historial de modificaciones registrado.</p>`;
    } else {
      container.innerHTML = `
        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Campo</th>
                <th>Valor Anterior</th>
                <th>Valor Nuevo</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(h => `
                <tr>
                  <td class="font-mono">${h.createdAt}</td>
                  <td><strong>${h.userName}</strong></td>
                  <td><span class="badge ${h.changeType === 'CREATE' ? 'badge-emerald' : 'badge-blue'}">${h.changeType}</span></td>
                  <td><code>${h.fieldChanged}</code></td>
                  <td style="color: #64748b;">${h.oldValue}</td>
                  <td style="color: #0369a1; font-weight: 600;">${h.newValue}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    window.app.openModal('modal-audit');
  },

  /**
   * =========================================================================
   * GESTIÓN DE CONTACTOS AUTORIZADOS DE EMPRESAS (JERARQUÍA CORPORATIVA)
   * =========================================================================
   */
  activeCompanyId: null,
  editingContactId: null,
  activeHistoryFilterRequester: 'TODOS',

  openCompanyContactsModal(companyId) {
    this.activeCompanyId = companyId;
    this.editingContactId = null;
    const data = window.db.get();
    const company = (data.accounts || []).find(a => a.id === companyId);
    if (!company) return;

    // Actualizar títulos
    const titleEl = document.getElementById('company-contacts-modal-title');
    const subEl = document.getElementById('company-contacts-modal-sub');
    if (titleEl) titleEl.textContent = `Contactos Autorizados: ${company.name}`;
    if (subEl) subEl.textContent = `${company.legalName || company.name} • NIT: ${company.nit || 'S/N'} • Código: ${company.code}`;

    // Resetear formulario
    const form = document.getElementById('company-contact-form');
    if (form) form.reset();
    const btnSubmit = document.getElementById('btn-save-contact-submit');
    if (btnSubmit) btnSubmit.innerHTML = '<i data-lucide="plus"></i> Agregar Solicitante';

    this.renderCompanyContacts(companyId);
    window.app.openModal('modal-company-contacts');
  },

  renderCompanyContacts(companyId) {
    const data = window.db.get();
    const contacts = (data.companyContacts || []).filter(c => c.companyId === companyId);
    const tbody = document.getElementById('company-contacts-table-body');
    if (!tbody) return;

    if (contacts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">
            No hay contactos autorizados registrados para esta empresa. Ingrese el primer solicitante en el formulario inferior.
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = contacts.map(c => `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--navy);">${c.fullName}</div>
          <div style="font-size: 0.72rem; color: #64748b;">ID: ${c.id}</div>
        </td>
        <td>
          <span class="badge badge-slate">${c.department || 'Sin cargo'}</span>
        </td>
        <td style="font-size: 0.82rem;">${c.email || '-'}</td>
        <td class="font-mono" style="font-size: 0.82rem;">${c.phone || '-'}</td>
        <td>
          <span class="badge ${c.isActive ? 'badge-emerald' : 'badge-slate'}" style="cursor: pointer;" onclick="window.accountsModule.toggleContactStatus('${c.id}')" title="Clic para alternar estado">
            ${c.isActive ? 'ACTIVO' : 'INACTIVO'}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.accountsModule.openEditContact('${c.id}')" title="Editar contacto">
              <i data-lucide="edit-2"></i>
            </button>
            <button type="button" class="btn btn-danger btn-sm" onclick="window.accountsModule.deleteCompanyContact('${c.id}')" title="Eliminar contacto">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  openEditContact(contactId) {
    const data = window.db.get();
    const contact = (data.companyContacts || []).find(c => c.id === contactId);
    if (!contact) return;

    this.editingContactId = contactId;
    document.getElementById('contact-fullname').value = contact.fullName;
    document.getElementById('contact-department').value = contact.department || '';
    document.getElementById('contact-email').value = contact.email || '';
    document.getElementById('contact-phone').value = contact.phone || '';
    document.getElementById('contact-is-active').checked = !!contact.isActive;

    const btnSubmit = document.getElementById('btn-save-contact-submit');
    if (btnSubmit) btnSubmit.innerHTML = '<i data-lucide="save"></i> Actualizar Solicitante';
    document.getElementById('contact-fullname').focus();
  },

  handleSaveCompanyContact(e) {
    e.preventDefault();
    if (!this.activeCompanyId) return;

    const fullName = document.getElementById('contact-fullname').value.trim();
    const department = document.getElementById('contact-department').value.trim();
    const email = document.getElementById('contact-email').value.trim();
    const phone = document.getElementById('contact-phone').value.trim();
    const isActive = document.getElementById('contact-is-active').checked;

    if (!fullName) {
      window.app.showToast('Debe ingresar el nombre completo del contacto.', 'error');
      return;
    }

    const data = window.db.get();
    if (!data.companyContacts) data.companyContacts = [];
    const now = new Date().toLocaleString();

    if (this.editingContactId) {
      const idx = data.companyContacts.findIndex(c => c.id === this.editingContactId);
      if (idx !== -1) {
        data.companyContacts[idx] = {
          ...data.companyContacts[idx],
          fullName,
          department,
          email,
          phone,
          isActive,
          updatedAt: now
        };
        window.app.showToast(`Contacto ${fullName} actualizado exitosamente.`, 'success');
      }
    } else {
      const newContact = {
        id: 'CNT-' + Date.now().toString(36).toUpperCase(),
        companyId: this.activeCompanyId,
        fullName,
        department,
        email,
        phone,
        isActive,
        createdAt: now,
        updatedAt: now
      };
      data.companyContacts.push(newContact);
      window.app.showToast(`Contacto ${fullName} registrado como solicitante autorizado.`, 'success');
    }

    window.db.save(data);
    this.editingContactId = null;
    document.getElementById('company-contact-form').reset();
    const btnSubmit = document.getElementById('btn-save-contact-submit');
    if (btnSubmit) btnSubmit.innerHTML = '<i data-lucide="plus"></i> Agregar Solicitante';

    this.renderCompanyContacts(this.activeCompanyId);
    this.render(); // Actualiza badge en tabla de cuentas
  },

  toggleContactStatus(contactId) {
    const data = window.db.get();
    const contact = (data.companyContacts || []).find(c => c.id === contactId);
    if (!contact) return;

    contact.isActive = !contact.isActive;
    contact.updatedAt = new Date().toLocaleString();
    window.db.save(data);
    window.app.showToast(`Estado de ${contact.fullName} actualizado a ${contact.isActive ? 'ACTIVO' : 'INACTIVO'}`, 'info');
    this.renderCompanyContacts(this.activeCompanyId);
    this.render();
  },

  deleteCompanyContact(contactId) {
    const data = window.db.get();
    const contact = (data.companyContacts || []).find(c => c.id === contactId);
    if (!contact) return;

    // Verificar si tiene NDs emitidas a su nombre
    const hasNds = (data.debitNotes || []).some(nd => 
      nd.requesterId === contactId || (nd.solicitante && nd.solicitante.includes(contact.fullName))
    );

    if (hasNds) {
      if (confirm(`El contacto "${contact.fullName}" tiene Notas de Débito vinculadas en el historial comercial.\n\nPor seguridad contable se recomienda DESACTIVARLO en lugar de eliminarlo.\n\n¿Desea marcarlo como INACTIVO ahora?`)) {
        contact.isActive = false;
        window.db.save(data);
        window.app.showToast(`Contacto ${contact.fullName} desactivado.`, 'info');
        this.renderCompanyContacts(this.activeCompanyId);
        this.render();
      }
      return;
    }

    if (!confirm(`¿Confirma eliminar a "${contact.fullName}" de los contactos autorizados?`)) return;

    data.companyContacts = data.companyContacts.filter(c => c.id !== contactId);
    window.db.save(data);
    window.app.showToast('Contacto eliminado.', 'info');
    this.renderCompanyContacts(this.activeCompanyId);
    this.render();
  },

  /**
   * =========================================================================
   * HISTORIAL DE EMISIONES Y BOLETOS DE LA EMPRESA (FILTRO POR SOLICITANTE / PASAJERO)
   * =========================================================================
   */
  openCompanyHistoryModal(companyId) {
    this.activeCompanyId = companyId;
    this.activeHistoryFilterRequester = 'TODOS';
    const data = window.db.get();
    const company = (data.accounts || []).find(a => a.id === companyId);
    if (!company) return;

    const titleEl = document.getElementById('company-history-modal-title');
    const subEl = document.getElementById('company-history-modal-sub');
    if (titleEl) titleEl.textContent = `Historial de Emisiones: ${company.name}`;
    if (subEl) subEl.textContent = `${company.legalName || company.name} • NIT: ${company.nit || 'S/N'}`;

    // Llenar selector de solicitantes
    const reqSelect = document.getElementById('company-history-requester-filter');
    if (reqSelect) {
      const contacts = (data.companyContacts || []).filter(c => c.companyId === companyId);
      reqSelect.innerHTML = '<option value="TODOS">-- Todos los Solicitantes --</option>' +
        contacts.map(c => `<option value="${c.fullName}">${c.fullName} (${c.department || 'General'})</option>`).join('');
    }

    const passInput = document.getElementById('company-history-passenger-search');
    if (passInput) passInput.value = '';

    this.renderCompanyHistory();
    window.app.openModal('modal-company-history');
  },

  renderCompanyHistory() {
    if (!this.activeCompanyId) return;
    const data = window.db.get();
    const allNds = (data.debitNotes || []).filter(nd => nd.accountId === this.activeCompanyId);

    const reqFilter = this.activeHistoryFilterRequester;
    const passSearch = (document.getElementById('company-history-passenger-search')?.value || '').toLowerCase().trim();

    const filtered = allNds.filter(nd => {
      // Filtro por solicitante
      const matchReq = reqFilter === 'TODOS' || (nd.solicitante && nd.solicitante.includes(reqFilter));
      
      // Filtro por pasajero
      let matchPass = true;
      if (passSearch) {
        const inMain = nd.passengerName && nd.passengerName.toLowerCase().includes(passSearch);
        const inItems = nd.items && nd.items.some(it => it.passengerName && it.passengerName.toLowerCase().includes(passSearch));
        matchPass = inMain || inItems;
      }

      return matchReq && matchPass;
    });

    // Totales calculados
    let totalFacturado = 0;
    let totalSaldo = 0;
    filtered.forEach(nd => {
      if (nd.status !== 'ANULADA') {
        totalFacturado += (nd.totalAmountBob || 0);
        totalSaldo += (nd.balanceBob || 0);
      }
    });

    const elTotal = document.getElementById('hist-company-total-facturado');
    const elSaldo = document.getElementById('hist-company-saldo-pendiente');
    const elCount = document.getElementById('hist-company-nds-count');
    if (elTotal) elTotal.textContent = `BOB ${totalFacturado.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
    if (elSaldo) elSaldo.textContent = `BOB ${totalSaldo.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
    if (elCount) elCount.textContent = `${filtered.length} NDs`;

    const tbody = document.getElementById('company-history-table-body');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 28px; color: var(--text-muted);">
            No se encontraron emisiones que coincidan con los filtros de Solicitante y Pasajero.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(nd => {
      const passengersList = nd.items ? nd.items.map(it => it.passengerName).filter(Boolean).join(', ') : (nd.passengerName || '-');
      const statusBadge = nd.status === 'PAGADA' ? 'badge-emerald' :
                          nd.status === 'PARCIAL' ? 'badge-blue' :
                          nd.status === 'IMPAGA' ? 'badge-amber' :
                          nd.status === 'BORRADOR' ? 'badge-slate' : 'badge-rose';

      return `
        <tr>
          <td class="font-mono" style="font-weight: 700; color: var(--navy);">ND #${nd.ndNumber}</td>
          <td class="font-mono">${nd.issueDate}</td>
          <td>
            <div style="font-weight: 600; color: #0369a1;">${nd.solicitante || 'General'}</div>
          </td>
          <td>
            <div style="font-weight: 600; font-size: 0.82rem;">${passengersList}</div>
            <div style="font-size: 0.72rem; color: #64748b;">${nd.items?.length || 0} servicio(s)</div>
          </td>
          <td><span class="badge badge-slate">${nd.paymentTerm.replace(/_/g, ' ')}</span></td>
          <td class="font-mono" style="text-align: right; font-weight: 700;">
            ${nd.currency} ${Number(nd.totalAmountBob).toFixed(2)}
          </td>
          <td class="font-mono" style="text-align: right; font-weight: 700; color: #b91c1c;">
            ${nd.currency} ${Number(nd.balanceBob).toFixed(2)}
          </td>
          <td><span class="badge ${statusBadge}">${nd.status}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="window.debitNotesModule.printPreview('${nd.id}', 'long')" title="Imprimir Nota de Débito Ejecutiva">
              <i data-lucide="printer"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }
};

