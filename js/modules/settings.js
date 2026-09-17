/**
 * MARETRAVEL ERP - Módulo 7: Configuración del Sistema
 * Incluye: Medios de pago, Tipo de cambio diario, Parámetros fiscales y Backup/Restore.
 */

window.settingsModule = {
  editingPmId: null,

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // Formulario de Tipo de Cambio
    const formTc = document.getElementById('tc-update-form');
    if (formTc) {
      formTc.addEventListener('submit', (e) => this.handleSaveExchangeRate(e));
    }

    // Formulario de Datos Generales
    const formGen = document.getElementById('general-settings-form');
    if (formGen) {
      formGen.addEventListener('submit', (e) => this.handleSaveGeneralSettings(e));
    }

    // Botón Nuevo Medio de Pago
    const btnNewPm = document.getElementById('btn-new-payment-method');
    if (btnNewPm) {
      btnNewPm.addEventListener('click', () => this.openPaymentMethodModal());
    }

    // Formulario Medio de Pago
    const formPm = document.getElementById('payment-method-form');
    if (formPm) {
      formPm.addEventListener('submit', (e) => this.handleSavePaymentMethod(e));
    }

    // Backup y Restaurar
    const btnExport = document.getElementById('btn-export-backup');
    if (btnExport) {
      btnExport.addEventListener('click', () => window.db.exportBackup());
    }

    const inputImport = document.getElementById('input-import-backup');
    if (inputImport) {
      inputImport.addEventListener('change', (e) => this.handleImportBackup(e));
    }

    const btnReset = document.getElementById('btn-reset-database');
    if (btnReset) {
      btnReset.addEventListener('click', () => this.handleResetDatabase());
    }
  },

  render() {
    const data = window.db.get();
    const settings = data.systemSettings;

    // Cargar formulario general
    if (document.getElementById('set-agency-name')) {
      document.getElementById('set-agency-name').value = settings.agencyName;
      document.getElementById('set-commercial-name').value = settings.agencyCommercialName;
      document.getElementById('set-nit').value = settings.agencyNit;
      document.getElementById('set-address').value = settings.agencyAddress;
      document.getElementById('set-phone').value = settings.agencyPhone;
      document.getElementById('set-vat-rate').value = settings.vatRate;
      document.getElementById('set-gds-days').value = settings.gdsLookbackDays;
    }

    // Cargar inputs del Tipo de Cambio actual
    if (document.getElementById('tc-buy-rate')) {
      document.getElementById('tc-buy-rate').value = settings.activeExchangeBuy || 6.86;
      document.getElementById('tc-sell-rate').value = settings.activeExchangeSell || 6.96;
    }

    // Renderizar tabla de Medios de Pago
    const pmTbody = document.getElementById('payment-methods-table-body');
    if (pmTbody) {
      pmTbody.innerHTML = (data.paymentMethods || []).map(m => `
        <tr>
          <td class="font-mono" style="font-weight: 700; color: var(--navy);">${m.code}</td>
          <td><strong>${m.name}</strong></td>
          <td><span class="badge ${m.currency === 'BOB' ? 'badge-blue' : 'badge-emerald'}">${m.currency}</span></td>
          <td><span class="badge badge-slate">${m.type}</span></td>
          <td class="font-mono" style="font-size: 0.78rem;">${m.bankAccount || '-'}</td>
          <td><span class="badge badge-emerald">${m.status}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="window.settingsModule.openPaymentMethodModal('${m.id}')">
              <i data-lucide="edit"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }

    // Renderizar histórico de Tipos de Cambio
    const tcTbody = document.getElementById('tc-history-table-body');
    if (tcTbody) {
      tcTbody.innerHTML = (data.exchangeRates || []).map(tc => `
        <tr>
          <td class="font-mono">${tc.date}</td>
          <td class="font-mono" style="font-weight: 700; color: #15803d;">BOB ${Number(tc.buyRate).toFixed(4)}</td>
          <td class="font-mono" style="font-weight: 700; color: #0369a1;">BOB ${Number(tc.sellRate).toFixed(4)}</td>
          <td style="font-size: 0.75rem;">${tc.createdByName || 'Admin'}</td>
          <td class="font-mono" style="font-size: 0.75rem;">${tc.createdAt}</td>
        </tr>
      `).join('');
    }

    if (window.lucide) window.lucide.createIcons();
  },

  handleSaveExchangeRate(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const data = window.db.get();
    
    const buyInp = document.getElementById('tc-buy-rate');
    const sellInp = document.getElementById('tc-sell-rate');

    const buyVal = buyInp ? buyInp.value.toString().replace(',', '.') : '6.86';
    const sellVal = sellInp ? sellInp.value.toString().replace(',', '.') : '6.96';

    const buy = parseFloat(buyVal) || 6.86;
    const sell = parseFloat(sellVal) || 6.96;

    if (!data.systemSettings) data.systemSettings = {};
    data.systemSettings.activeExchangeBuy = buy;
    data.systemSettings.activeExchangeSell = sell;

    const newRate = {
      id: 'TC-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      buyRate: buy,
      sellRate: sell,
      createdById: data.currentUser?.id || 'USR-001',
      createdByName: data.currentUser?.name || 'Luis',
      createdAt: new Date().toLocaleString()
    };

    if (!data.exchangeRates) data.exchangeRates = [];
    data.exchangeRates.unshift(newRate);

    window.db.save(data);
    window.app.updateExchangeRateWidget();
    window.app.showToast(`¡Tipo de Cambio actualizado exitosamente! Compra: ${buy.toFixed(2)} | Venta: ${sell.toFixed(2)}`, 'success');
    this.render();
    return false;
  },

  handleSaveGeneralSettings(e) {
    e.preventDefault();
    const data = window.db.get();

    data.systemSettings.agencyName = document.getElementById('set-agency-name').value.trim();
    data.systemSettings.agencyCommercialName = document.getElementById('set-commercial-name').value.trim();
    data.systemSettings.agencyNit = document.getElementById('set-nit').value.trim();
    data.systemSettings.agencyAddress = document.getElementById('set-address').value.trim();
    data.systemSettings.agencyPhone = document.getElementById('set-phone').value.trim();
    data.systemSettings.vatRate = parseFloat(document.getElementById('set-vat-rate').value) || 14.94;
    data.systemSettings.gdsLookbackDays = parseInt(document.getElementById('set-gds-days').value) || 30;

    window.db.save(data);
    window.app.showToast('Configuración general guardada', 'success');
  },

  openPaymentMethodModal(pmId = null) {
    this.editingPmId = pmId;
    const form = document.getElementById('payment-method-form');
    if (form) form.reset();

    if (pmId) {
      const data = window.db.get();
      const m = data.paymentMethods.find(x => x.id === pmId);
      if (m) {
        document.getElementById('pm-code').value = m.code;
        document.getElementById('pm-name').value = m.name;
        document.getElementById('pm-currency').value = m.currency;
        document.getElementById('pm-type').value = m.type;
        document.getElementById('pm-bank-account').value = m.bankAccount || '';
      }
    } else {
      document.getElementById('pm-currency').value = 'BOB';
      document.getElementById('pm-type').value = 'COBRANZAS';
    }

    window.app.openModal('modal-payment-method');
  },

  handleSavePaymentMethod(e) {
    e.preventDefault();
    const data = window.db.get();

    const pmData = {
      code: document.getElementById('pm-code').value.trim().toUpperCase(),
      name: document.getElementById('pm-name').value.trim(),
      currency: document.getElementById('pm-currency').value,
      type: document.getElementById('pm-type').value,
      bankAccount: document.getElementById('pm-bank-account').value.trim(),
      status: 'ACTIVO'
    };

    if (this.editingPmId) {
      const idx = data.paymentMethods.findIndex(x => x.id === this.editingPmId);
      if (idx !== -1) {
        data.paymentMethods[idx] = { ...data.paymentMethods[idx], ...pmData };
        window.app.showToast('Medio de pago actualizado', 'success');
      }
    } else {
      data.paymentMethods.push({
        id: 'PM-' + Date.now(),
        ...pmData
      });
      window.app.showToast('Nuevo medio de pago registrado', 'success');
    }

    window.db.save(data);
    window.app.closeModal('modal-payment-method');
    this.render();
  },

  handleImportBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const success = window.db.importBackup(event.target.result);
      if (success) {
        window.app.showToast('Copia de seguridad restaurada correctamente', 'success');
        setTimeout(() => location.reload(), 800);
      } else {
        window.app.showToast('Archivo de copia de seguridad inválido', 'error');
      }
    };
    reader.readAsText(file);
  },

  handleResetDatabase() {
    if (confirm('¿ATENCIÓN: Está seguro de limpiar y reiniciar toda la base de datos a 0?\n\nSe vaciarán todas las cuentas, boletos, notas de débito y movimientos, dejando el sistema completamente limpio para registrar todo desde cero.')) {
      window.db.reset();
      window.app.showToast('Sistema reiniciado a 0 exitosamente', 'info');
      setTimeout(() => location.reload(), 600);
    }
  }
};
