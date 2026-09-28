/**
 * MARETRAVEL ERP - Módulo de Reportes y Exportación Excel
 * Genera reportes consolidados unificados (ND, NC, RCP, PGP) en formato exacto Bloque C.
 * Ordenados cronológicamente por fecha, respetando moneda original (BOB en BS, USD en $).
 */

window.excelReportsModule = {
  filterService: 'TODOS',
  startDate: '',
  endDate: '',
  cachedRows: [],

  init() {
    this.setDefaultDates();
    this.bindEvents();
    this.render();
  },

  setDefaultDates() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // Por defecto: Primer día del mes actual hasta hoy
    this.startDate = `${year}-${month}-01`;
    this.endDate = `${year}-${month}-${day}`;

    const startInput = document.getElementById('report-start-date');
    const endInput = document.getElementById('report-end-date');
    if (startInput) startInput.value = this.startDate;
    if (endInput) endInput.value = this.endDate;
  },

  bindEvents() {
    const srvSelect = document.getElementById('report-service-filter');
    if (srvSelect) {
      srvSelect.addEventListener('change', (e) => {
        this.filterService = e.target.value;
        this.renderPreview();
      });
    }

    const startInput = document.getElementById('report-start-date');
    if (startInput) {
      startInput.addEventListener('change', (e) => {
        this.startDate = e.target.value;
        this.renderPreview();
      });
    }

    const endInput = document.getElementById('report-end-date');
    if (endInput) {
      endInput.addEventListener('change', (e) => {
        this.endDate = e.target.value;
        this.renderPreview();
      });
    }

    // Botones de rangos rápidos
    document.querySelectorAll('[data-quick-range]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const range = btn.dataset.quickRange;
        this.setQuickRange(range);
      });
    });

    const btnExcel = document.getElementById('btn-export-excel-report');
    if (btnExcel) {
      btnExcel.addEventListener('click', () => this.exportExcel());
    }

    const btnCsv = document.getElementById('btn-export-csv-report');
    if (btnCsv) {
      btnCsv.addEventListener('click', () => this.exportCsv());
    }
  },

  setQuickRange(range) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const pad = (n) => String(n).padStart(2, '0');
    const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let start = new Date();
    let end = new Date();

    if (range === 'hoy') {
      start = now;
      end = now;
    } else if (range === 'semana') {
      const day = now.getDay() || 7;
      start = new Date(now);
      start.setDate(now.getDate() - day + 1);
      end = now;
    } else if (range === 'mes') {
      start = new Date(y, m, 1);
      end = now;
    } else if (range === 'mes_anterior') {
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 0);
    } else if (range === 'anio') {
      start = new Date(y, 0, 1);
      end = now;
    }

    this.startDate = toIso(start);
    this.endDate = toIso(end);

    const startInput = document.getElementById('report-start-date');
    const endInput = document.getElementById('report-end-date');
    if (startInput) startInput.value = this.startDate;
    if (endInput) endInput.value = this.endDate;

    document.querySelectorAll('[data-quick-range]').forEach(b => {
      b.classList.toggle('active', b.dataset.quickRange === range);
    });

    this.renderPreview();
  },

  matchService(serviceVal) {
    if (!this.filterService || this.filterService === 'TODOS') return true;
    if (!serviceVal) return false;
    const fs = this.filterService.toUpperCase();
    const v = String(serviceVal).toUpperCase();
    if (v === fs) return true;
    if (fs === 'BOLETO_AEREO' && (v.includes('BOLETO') || v.includes('AEREO') || v.includes('GDS'))) return true;
    if (fs === 'PAQUETES' && (v.includes('PAQUETE') || v.includes('CRUCERO') || v.includes('CONCIERTO'))) return true;
    if (fs === 'HOTEL' && (v.includes('HOTEL') || v.includes('HOSPEDAJE'))) return true;
    if (fs === 'SEGURO_VIAJE' && v.includes('SEGURO')) return true;
    if (fs === 'RENT_A_CAR' && (v.includes('AUTO') || v.includes('RENT') || v.includes('CAR') || v.includes('TRASLADO'))) return true;
    if (fs === 'ASESORAMIENTO_VISAS' && (v.includes('VISA') || v.includes('ASESORAMIENTO'))) return true;
    if (fs === 'CERTIFICACION_FA' && (v.includes('FA') || v.includes('CERTIFIC'))) return true;
    return false;
  },

  formatServiceName(srv) {
    if (window.operationsHubModule && typeof window.operationsHubModule.formatServiceName === 'function') {
      return window.operationsHubModule.formatServiceName(srv);
    }
    const map = {
      'BOLETO_AEREO': 'BOLETO AEREO',
      'PAQUETE_TURISTICO': 'PAQUETE TURISTICO',
      'PAQUETES': 'PAQUETES',
      'HOTEL': 'HOTEL',
      'HOTEL_HOSPEDAJE': 'HOSPEDAJE',
      'SEGURO_VIAJE': 'SEGURO DE VIAJE',
      'RENT_A_CAR': 'RENT A CAR',
      'TRASLADO': 'TRASLADO',
      'ASESORAMIENTO_VISAS': 'ASESORAMIENTO VISAS',
      'CERTIFICACION_FA': 'CERTIFICACION FA'
    };
    return map[srv] || srv || 'OTRO';
  },

  /**
   * Recopila y estructura los datos del Bloque C:
   * ND (Notas de Débito), NC (Notas de Crédito), RCP (Recibos de Pago) y PGP (Pagos a Proveedor)
   */
  getConsolidatedData() {
    const data = window.db ? window.db.get() : {};
    const rows = [];
    const fromDate = this.startDate || '1900-01-01';
    const toDate = this.endDate || '2099-12-31';

    // -------------------------------------------------------------------------
    // 1. NOTAS DE DÉBITO (nd) -> Facturación a Clientes
    // -------------------------------------------------------------------------
    (data.debitNotes || []).forEach(nd => {
      if (nd.deleted === true) return;
      const date = nd.issueDate || (nd.createdAt ? nd.createdAt.split('T')[0] : '');
      if (date < fromDate || date > toDate) return;

      const primaryItem = (nd.items && nd.items[0]) || {};
      const srvType = primaryItem.serviceType || nd.serviceCategory || nd.serviceType || 'BOLETO_AEREO';
      if (!this.matchService(srvType) && !this.matchService(nd.serviceCategory)) return;

      const isUsd = (nd.currency === 'USD');
      const totalAmount = Number(nd.totalAmount !== undefined ? nd.totalAmount : (isUsd ? (nd.totalAmountUsd || 0) : (nd.totalAmountBob || 0)));
      const balance = Number(isUsd ? (nd.balanceUsd !== undefined ? nd.balanceUsd : (nd.balance || 0)) : (nd.balanceBob !== undefined ? nd.balanceBob : (nd.balance || 0)));

      // Regla usuario: en nota de debito no tendra "pago parcial" porque no es recibo de pago, entonces se deja en blanco.
      rows.push({
        tipo: 'Nota de Débito',
        codigo: nd.ndCode || (window.maretravelCodes && window.maretravelCodes.showDoc ? window.maretravelCodes.showDoc(nd, 'ND') : ('ND #' + nd.ndNumber)),
        fecha: date,
        tipoServicio: this.formatServiceName(srvType),
        empresaCliente: nd.accountName || nd.passengerName || '-',
        rol: 'cliente',
        deudaBob: isUsd ? '' : totalAmount,
        pagoBob: '', // en blanco
        pendienteBob: isUsd ? '' : balance,
        deudaUsd: isUsd ? totalAmount : '',
        pagoUsd: '', // en blanco
        pendienteUsd: isUsd ? balance : '',
        rawDate: date,
        status: nd.status || 'IMPAGA'
      });
    });

    // -------------------------------------------------------------------------
    // 2. NOTAS DE CRÉDITO (nc) -> Cuentas por Pagar a Proveedores
    // -------------------------------------------------------------------------
    (data.creditNotes || []).forEach(nc => {
      if (nc.deleted === true) return;
      const date = nc.issueDate || (nc.createdAt ? nc.createdAt.split('T')[0] : '');
      if (date < fromDate || date > toDate) return;

      const srvType = nc.serviceCategory || nc.serviceType || nc.servicio_tipo || 'BOLETO_AEREO';
      if (!this.matchService(srvType)) return;

      const isUsd = (nc.currency === 'USD');
      const totalAmount = Number(nc.totalAmount !== undefined ? nc.totalAmount : (isUsd ? (nc.totalAmountUsd || 0) : (nc.totalAmountBob || 0)));
      const balance = Number(isUsd ? (nc.balanceUsd !== undefined ? nc.balanceUsd : (nc.balance || 0)) : (nc.balanceBob !== undefined ? nc.balanceBob : (nc.balance || 0)));

      rows.push({
        tipo: 'Nota de Crédito',
        codigo: nc.ncCode || (window.maretravelCodes && window.maretravelCodes.showDoc ? window.maretravelCodes.showDoc(nc, 'NC') : ('NC #' + nc.ncNumber)),
        fecha: date,
        tipoServicio: this.formatServiceName(srvType),
        empresaCliente: nc.providerName || '-',
        rol: 'proveedor',
        deudaBob: isUsd ? '' : totalAmount,
        pagoBob: '', // el pago parcial va en su fila de Pago a Proveedor
        pendienteBob: isUsd ? '' : balance,
        deudaUsd: isUsd ? totalAmount : '',
        pagoUsd: '',
        pendienteUsd: isUsd ? balance : '',
        rawDate: date,
        status: nc.status || 'IMPAGA'
      });
    });

    // -------------------------------------------------------------------------
    // 3. RECIBOS DE PAGO (rcp) -> Cobranzas a Clientes
    // -------------------------------------------------------------------------
    (data.cashReceipts || []).forEach(r => {
      if (r.status === 'ANULADO' || r.deleted === true) return;
      const date = r.receiptDate ? r.receiptDate.split(' ')[0] : (r.createdAt ? r.createdAt.split(',')[0].trim() : '');
      if (date < fromDate || date > toDate) return;

      const srvType = r.serviceCategory || r.serviceType || 'BOLETO_AEREO';
      if (!this.matchService(srvType)) return;

      const isUsd = (r.currency === 'USD') || (Number(r.totalPaidUsd || 0) > 0 && Number(r.totalPaidBob || 0) === 0);
      const paidAmount = Number(isUsd ? (r.totalPaidUsd || r.monto_transaccion_usd || 0) : (r.totalPaidBob || r.monto_transaccion || 0));
      const pendingBalance = Number(isUsd ? (r.saldo_pendiente_usd !== undefined ? r.saldo_pendiente_usd : (r.saldo_pendiente || 0)) : (r.saldo_pendiente || 0));

      rows.push({
        tipo: 'Recibo de Pago',
        codigo: r.receiptCode || ('RCP-' + String(r.receiptNumber || 0).padStart(5, '0')),
        fecha: date,
        tipoServicio: this.formatServiceName(srvType),
        empresaCliente: r.accountName || r.clientName || '-',
        rol: 'cliente',
        deudaBob: '', // el recibo no genera deuda, es abono
        pagoBob: isUsd ? '' : paidAmount,
        pendienteBob: isUsd ? '' : pendingBalance,
        deudaUsd: '',
        pagoUsd: isUsd ? paidAmount : '',
        pendienteUsd: isUsd ? pendingBalance : '',
        rawDate: date,
        status: r.status || 'VALIDO'
      });
    });

    // -------------------------------------------------------------------------
    // 4. PAGOS A PROVEEDOR (pgp) -> Desembolsos a Cuentas por Pagar (NC)
    // -------------------------------------------------------------------------
    (data.providerPayments || []).forEach(p => {
      if (p.status === 'ANULADO' || p.deleted === true) return;
      const date = p.paymentDate || (p.receiptDate ? p.receiptDate.split(' ')[0] : (p.createdAt ? p.createdAt.split(',')[0].trim() : ''));
      if (date < fromDate || date > toDate) return;

      const srvType = p.serviceCategory || p.serviceType || 'BOLETO_AEREO';
      if (!this.matchService(srvType)) return;

      const isUsd = (p.currency === 'USD') || (Number(p.totalPaidUsd || 0) > 0 && Number(p.totalPaidBob || 0) === 0);
      const paidAmount = Number(isUsd ? (p.totalPaidUsd || p.monto_transaccion_usd || 0) : (p.totalPaidBob || p.monto_transaccion || p.totalPaid || 0));
      const pendingBalance = Number(p.saldo_pendiente !== undefined ? p.saldo_pendiente : 0);

      rows.push({
        tipo: 'Pago a Proveedor',
        codigo: p.receiptCode || ('PGO-' + String(p.receiptNumber || p.id || 0).padStart(5, '0')),
        fecha: date,
        tipoServicio: this.formatServiceName(srvType),
        empresaCliente: p.providerName || '-',
        rol: 'proveedor',
        deudaBob: '', // es desembolso, no genera deuda nueva
        pagoBob: isUsd ? '' : paidAmount,
        pendienteBob: isUsd ? '' : pendingBalance,
        deudaUsd: '',
        pagoUsd: isUsd ? paidAmount : '',
        pendienteUsd: isUsd ? pendingBalance : '',
        rawDate: date,
        status: p.status || 'VALIDO'
      });
    });

    // ORDEN CRONOLÓGICO ESTRICTO POR FECHA
    rows.sort((a, b) => {
      const da = a.rawDate || '';
      const db = b.rawDate || '';
      return da.localeCompare(db);
    });

    this.cachedRows = rows;
    return rows;
  },

  render() {
    this.renderPreview();
  },

  renderPreview() {
    const tbody = document.getElementById('report-preview-tbody');
    if (!tbody) return;

    const rows = this.getConsolidatedData();

    // Actualizar contadores KPI
    let countTotal = rows.length;
    let sumDeudaBob = 0;
    let sumPagoBob = 0;
    let sumPendienteBob = 0;
    let sumDeudaUsd = 0;
    let sumPagoUsd = 0;
    let sumPendienteUsd = 0;

    rows.forEach(r => {
      if (typeof r.deudaBob === 'number') sumDeudaBob += r.deudaBob;
      if (typeof r.pagoBob === 'number') sumPagoBob += r.pagoBob;
      if (typeof r.pendienteBob === 'number') sumPendienteBob += r.pendienteBob;
      if (typeof r.deudaUsd === 'number') sumDeudaUsd += r.deudaUsd;
      if (typeof r.pagoUsd === 'number') sumPagoUsd += r.pagoUsd;
      if (typeof r.pendienteUsd === 'number') sumPendienteUsd += r.pendienteUsd;
    });

    const elCount = document.getElementById('kpi-rep-count');
    const elDeudaBob = document.getElementById('kpi-rep-deuda-bob');
    const elPagoBob = document.getElementById('kpi-rep-pago-bob');
    const elPendBob = document.getElementById('kpi-rep-pend-bob');
    const elDeudaUsd = document.getElementById('kpi-rep-deuda-usd');
    const elPagoUsd = document.getElementById('kpi-rep-pago-usd');
    const elPendUsd = document.getElementById('kpi-rep-pend-usd');

    if (elCount) elCount.textContent = countTotal;
    if (elDeudaBob) elDeudaBob.textContent = 'BOB ' + sumDeudaBob.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (elPagoBob) elPagoBob.textContent = 'BOB ' + sumPagoBob.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (elPendBob) elPendBob.textContent = 'BOB ' + sumPendienteBob.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (elDeudaUsd) elDeudaUsd.textContent = 'USD ' + sumDeudaUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (elPagoUsd) elPagoUsd.textContent = 'USD ' + sumPagoUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (elPendUsd) elPendUsd.textContent = 'USD ' + sumPendienteUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="12" style="text-align: center; padding: 36px; color: #64748b;">
            <i data-lucide="inbox" style="width: 38px; height: 38px; color: #94a3b8; display: block; margin: 0 auto 8px;"></i>
            <strong>No se encontraron comprobantes para el rango de fechas y servicio seleccionado.</strong>
            <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 4px;">Modifique las fechas o seleccione 'TODOS LOS SERVICIOS'.</div>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const fmtNum = (val) => (typeof val === 'number') ? val.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

    tbody.innerHTML = rows.map((r, i) => {
      let badgeTipo = 'badge-slate';
      if (r.tipo === 'Nota de Débito') badgeTipo = 'badge-sky';
      else if (r.tipo === 'Nota de Crédito') badgeTipo = 'badge-indigo';
      else if (r.tipo === 'Recibo de Pago') badgeTipo = 'badge-emerald';
      else if (r.tipo === 'Pago a Proveedor') badgeTipo = 'badge-amber';

      const rolBadge = r.rol === 'cliente' ? '<span class="badge badge-emerald">cliente</span>' : '<span class="badge badge-blue">proveedor</span>';

      return `
        <tr>
          <td><span class="badge ${badgeTipo}">${r.tipo}</span></td>
          <td class="font-mono" style="font-weight: 700; color: #0f172a;">${r.codigo}</td>
          <td class="font-mono">${r.fecha || '-'}</td>
          <td><span class="badge badge-slate" style="font-size: 0.72rem;">${r.tipoServicio}</span></td>
          <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.empresaCliente}">
            <strong>${r.empresaCliente}</strong>
          </td>
          <td style="text-align: center;">${rolBadge}</td>
          <td class="font-mono" style="text-align: right; font-weight: 600; color: #0f172a;">${fmtNum(r.deudaBob)}</td>
          <td class="font-mono" style="text-align: right; color: #15803d; font-weight: 600;">${fmtNum(r.pagoBob)}</td>
          <td class="font-mono" style="text-align: right; color: #b91c1c; font-weight: 700;">${fmtNum(r.pendienteBob)}</td>
          <td class="font-mono" style="text-align: right; font-weight: 600; color: #0284c7;">${fmtNum(r.deudaUsd)}</td>
          <td class="font-mono" style="text-align: right; color: #15803d; font-weight: 600;">${fmtNum(r.pagoUsd)}</td>
          <td class="font-mono" style="text-align: right; color: #b91c1c; font-weight: 700;">${fmtNum(r.pendienteUsd)}</td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  /**
   * Exporta a formato nativo Excel (.xlsx) usando SheetJS exactamente con el formato Bloque C
   */
  exportExcel() {
    const rows = this.getConsolidatedData();
    if (!rows || rows.length === 0) {
      window.app.showToast('No hay registros para exportar en el rango seleccionado.', 'warning');
      return;
    }

    if (typeof window.XLSX === 'undefined') {
      window.app.showToast('Cargando motor de Excel... intente en unos segundos.', 'info');
      this.exportCsv();
      return;
    }

    // Encabezados exactos Bloque C
    const headers = [
      'TIPO',
      'CODIGO',
      'FECHA',
      'TIPO DE SERVICIO',
      'EMPRESA/CLIENTE',
      'CLIENTE O PROVEEDOR',
      'TOTAL DEUDA BS',
      'PAGO PARCIAL BS',
      'PENDIENTE PAGO BS',
      'TOTAL DEUDA $',
      'PAGO PARCIAL $',
      'PENDIENTE PAGO $'
    ];

    const dataMatrix = [headers];

    rows.forEach(r => {
      dataMatrix.push([
        r.tipo,
        r.codigo,
        r.fecha,
        r.tipoServicio,
        r.empresaCliente,
        r.rol,
        (typeof r.deudaBob === 'number') ? r.deudaBob : '',
        (typeof r.pagoBob === 'number') ? r.pagoBob : '',
        (typeof r.pendienteBob === 'number') ? r.pendienteBob : '',
        (typeof r.deudaUsd === 'number') ? r.deudaUsd : '',
        (typeof r.pagoUsd === 'number') ? r.pagoUsd : '',
        (typeof r.pendienteUsd === 'number') ? r.pendienteUsd : ''
      ]);
    });

    const wsCtasCobrar = window.XLSX.utils.aoa_to_sheet(dataMatrix);

    // Configurar anchos de columna automáticos
    wsCtasCobrar['!cols'] = [
      { wch: 18 }, // TIPO
      { wch: 14 }, // CODIGO
      { wch: 12 }, // FECHA
      { wch: 22 }, // TIPO DE SERVICIO
      { wch: 32 }, // EMPRESA/CLIENTE
      { wch: 20 }, // CLIENTE O PROVEEDOR
      { wch: 16 }, // TOTAL DEUDA BS
      { wch: 16 }, // PAGO PARCIAL BS
      { wch: 18 }, // PENDIENTE PAGO BS
      { wch: 16 }, // TOTAL DEUDA $
      { wch: 16 }, // PAGO PARCIAL $
      { wch: 18 }  // PENDIENTE PAGO $
    ];

    const wb = window.XLSX.utils.book_new();

    // 1. Hoja: CTAS POR COBRAR (Bloque C consolidado con ND, NC, RCP, PGP)
    window.XLSX.utils.book_append_sheet(wb, wsCtasCobrar, 'CTAS POR COBRAR');

    // 2. Hoja: CUENTAS POR PAGAR (NC Proveedores)
    const wsCuentasPagar = this.buildCuentasPorPagarSheet();
    window.XLSX.utils.book_append_sheet(wb, wsCuentasPagar, 'CUENTAS POR PAGAR');

    // 3. Hoja: REPORTE INGRESOS Y PAGOS (Detalle por servicio/emisión/boleto)
    const wsIngresosPagos = this.buildIngresosPagosSheet();
    window.XLSX.utils.book_append_sheet(wb, wsIngresosPagos, 'REPORTE INGRESOS Y PAGOS');

    // 4. Hoja: REPORTE EGRESOS (Gastos administrativos)
    const wsEgresos = this.buildEgresosSheet();
    window.XLSX.utils.book_append_sheet(wb, wsEgresos, 'REPORTE EGRESOS');

    // 5. Hoja: GASTOS (Gastos personales)
    const wsGastos = this.buildGastosSheet();
    window.XLSX.utils.book_append_sheet(wb, wsGastos, 'GASTOS ');

    const srvTag = (this.filterService || 'TODOS').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Reporte_Consolidado_${srvTag}_${this.startDate}_a_${this.endDate}.xlsx`;
    window.XLSX.writeFile(wb, filename);

    window.app.showToast(`Reporte Excel descargado con 5 hojas: ${filename}`, 'success');
  },

  buildCuentasPorPagarSheet() {
    const data = window.db ? window.db.get() : {};
    const fromDate = this.startDate || '1900-01-01';
    const toDate = this.endDate || '2099-12-31';

    const headers = [
      'NC',
      'FECHA',
      'TIPO DE SERVICIO',
      'OPERADOR',
      'TOTAL DEUDA BS',
      'PAGO PARCIAL BS',
      'PENDIENTE PAGO BS',
      'TOTAL DEUDA $',
      'PAGO PARCIAL $',
      'PENDIENTE PAGO $'
    ];

    const matrix = [headers];
    const ncs = (data.creditNotes || []).filter(nc => {
      if (nc.deleted === true) return false;
      const date = nc.issueDate || (nc.createdAt ? nc.createdAt.split('T')[0] : '');
      if (date < fromDate || date > toDate) return false;
      const srv = nc.serviceCategory || nc.serviceType || 'BOLETO_AEREO';
      return this.matchService(srv);
    });

    ncs.sort((a, b) => (a.issueDate || '').localeCompare(b.issueDate || ''));

    ncs.forEach(nc => {
      const isUsd = (nc.currency === 'USD');
      const totalAmount = Number(nc.totalAmount !== undefined ? nc.totalAmount : (isUsd ? (nc.totalAmountUsd || 0) : (nc.totalAmountBob || 0)));
      const paid = Number(nc.paidAmount !== undefined ? nc.paidAmount : (isUsd ? (nc.paidAmountUsd || 0) : (nc.paidAmountBob || 0)));
      const balance = Number(isUsd ? (nc.balanceUsd !== undefined ? nc.balanceUsd : (nc.balance || 0)) : (nc.balanceBob !== undefined ? nc.balanceBob : (nc.balance || 0)));

      matrix.push([
        nc.ncCode || (window.maretravelCodes && window.maretravelCodes.showDoc ? window.maretravelCodes.showDoc(nc, 'NC') : ('NC #' + nc.ncNumber)),
        nc.issueDate || (nc.createdAt ? nc.createdAt.split('T')[0] : ''),
        this.formatServiceName(nc.serviceCategory || nc.serviceType),
        nc.providerName || '-',
        isUsd ? '' : totalAmount,
        isUsd ? '' : paid,
        isUsd ? '' : balance,
        isUsd ? totalAmount : '',
        isUsd ? paid : '',
        isUsd ? balance : ''
      ]);
    });

    const ws = window.XLSX.utils.aoa_to_sheet(matrix);
    ws['!cols'] = [
      { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 28 },
      { wch: 16 }, { wch: 16 }, { wch: 18 },
      { wch: 16 }, { wch: 16 }, { wch: 18 }
    ];
    return ws;
  },

  buildIngresosPagosSheet() {
    const data = window.db ? window.db.get() : {};
    const fromDate = this.startDate || '1900-01-01';
    const toDate = this.endDate || '2099-12-31';

    const headers = [
      'TIPO DE SERVICIO',
      'NOTA DEBITO',
      'CODIDO DE RESERVA',
      'TRAMO',
      'OPERADOR',
      'PASAJERO',
      'EMPRESA/CLIENTE',
      'FECHA DE COMPRA',
      'FECHA DE SALIDA',
      'FECHA DE RETORNO',
      '',
      'PRECIO BS',
      'PRECIO $',
      'FEE BS',
      'FEE $',
      'COMISION BS',
      'COMISION $',
      'FECHA DE PAGO',
      'QR BS',
      'EFECTIVO BS',
      'QR $ ',
      'EFECTIVO $'
    ];

    const matrix = [headers];

    (data.debitNotes || []).forEach(nd => {
      if (nd.deleted === true) return;
      const date = nd.issueDate || (nd.createdAt ? nd.createdAt.split('T')[0] : '');
      if (date < fromDate || date > toDate) return;

      const items = (nd.items && nd.items.length > 0) ? nd.items : [{}];
      items.forEach(item => {
        const srvType = item.serviceType || nd.serviceCategory || nd.serviceType || 'BOLETO_AEREO';
        if (!this.matchService(srvType) && !this.matchService(nd.serviceCategory)) return;

        const isUsd = (nd.currency === 'USD') || (item.currency === 'USD');
        const fare = Number(item.fareAmount !== undefined ? item.fareAmount : (item.fareAmountBob || 0));
        const fee = Number(item.feeAmount !== undefined ? item.feeAmount : (item.feeAmountBob || 0));
        const comm = Number(item.providerCommissionAmount !== undefined ? item.providerCommissionAmount : (item.providerCommissionAmountBob || 0));

        const receipts = (data.cashReceipts || []).filter(r => r.debitNoteId === nd.id || r.debitNoteNumber === nd.ndNumber);
        let fechaPago = '';
        let qrBs = 0, efBs = 0, qrUsd = 0, efUsd = 0;
        receipts.forEach(r => {
          if (r.receiptDate) fechaPago = r.receiptDate.split(' ')[0];
          const m = (r.paymentMethod || '').toUpperCase();
          const paidB = Number(r.totalPaidBob || 0);
          const paidU = Number(r.totalPaidUsd || 0);
          if (m.includes('QR') || m.includes('TRANS')) {
            qrBs += paidB;
            qrUsd += paidU;
          } else {
            efBs += paidB;
            efUsd += paidU;
          }
        });

        const sDetails = item.serviceDetails || {};

        matrix.push([
          this.formatServiceName(srvType),
          nd.ndCode || (window.maretravelCodes && window.maretravelCodes.showDoc ? window.maretravelCodes.showDoc(nd, 'ND') : ('ND #' + nd.ndNumber)),
          item.pnr || item.ticketNumber || sDetails.pnr || sDetails.ticketNumber || '-',
          sDetails.route || item.route || item.description || '-',
          item.operatorName || sDetails.airline || '-',
          item.passengerName || nd.passengerName || '-',
          nd.accountName || '-',
          date,
          sDetails.departureDate || item.departureDate || '',
          sDetails.returnDate || item.returnDate || '',
          '',
          isUsd ? '' : fare,
          isUsd ? fare : '',
          isUsd ? '' : fee,
          isUsd ? fee : '',
          isUsd ? '' : comm,
          isUsd ? comm : '',
          fechaPago || '',
          qrBs > 0 ? qrBs : '',
          efBs > 0 ? efBs : '',
          qrUsd > 0 ? qrUsd : '',
          efUsd > 0 ? efUsd : ''
        ]);
      });
    });

    const ws = window.XLSX.utils.aoa_to_sheet(matrix);
    return ws;
  },

  buildEgresosSheet() {
    const data = window.db ? window.db.get() : {};
    const fromDate = this.startDate || '1900-01-01';
    const toDate = this.endDate || '2099-12-31';

    const matrix = [
      ['', '', 'GASTOS ADMINISTRATIVO (FIJOS, VARIABLES)'],
      [],
      ['FECHA', 'DETALLE GASTO', 'PROVEEDOR', 'MONTO BS', 'MONTO $']
    ];

    (data.expenses || []).filter(e => e.type !== 'PERSONAL').forEach(e => {
      const d = e.date || (e.createdAt ? e.createdAt.split('T')[0] : '');
      if (d < fromDate || d > toDate) return;
      const isUsd = (e.currency === 'USD');
      const amt = Number(e.amount || 0);
      matrix.push([
        d,
        e.concept || e.description || '-',
        e.providerName || e.beneficiary || '-',
        isUsd ? '' : amt,
        isUsd ? amt : ''
      ]);
    });

    const ws = window.XLSX.utils.aoa_to_sheet(matrix);
    return ws;
  },

  buildGastosSheet() {
    const data = window.db ? window.db.get() : {};
    const fromDate = this.startDate || '1900-01-01';
    const toDate = this.endDate || '2099-12-31';

    const matrix = [
      ['', 'GASTOS PERSONALES'],
      ['FECHA', 'DETALLE DE GASTO', 'MONTO QR BS']
    ];

    (data.expenses || []).filter(e => e.type === 'PERSONAL').forEach(e => {
      const d = e.date || (e.createdAt ? e.createdAt.split('T')[0] : '');
      if (d < fromDate || d > toDate) return;
      matrix.push([
        d,
        e.concept || e.description || '-',
        Number(e.amount || 0)
      ]);
    });

    const ws = window.XLSX.utils.aoa_to_sheet(matrix);
    return ws;
  },

  /**
   * Exporta a CSV con UTF-8 BOM como respaldo inmediato
   */
  exportCsv() {
    const rows = this.getConsolidatedData();
    if (!rows || rows.length === 0) {
      window.app.showToast('No hay registros para exportar.', 'warning');
      return;
    }

    const headers = [
      'TIPO',
      'CODIGO',
      'FECHA',
      'TIPO DE SERVICIO',
      'EMPRESA/CLIENTE',
      'CLIENTE O PROVEEDOR',
      'TOTAL DEUDA BS',
      'PAGO PARCIAL BS',
      'PENDIENTE PAGO BS',
      'TOTAL DEUDA $',
      'PAGO PARCIAL $',
      'PENDIENTE PAGO $'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (s.includes(';') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    let csv = '\uFEFF' + headers.join(';') + '\n';

    rows.forEach(r => {
      const line = [
        escapeCsv(r.tipo),
        escapeCsv(r.codigo),
        escapeCsv(r.fecha),
        escapeCsv(r.tipoServicio),
        escapeCsv(r.empresaCliente),
        escapeCsv(r.rol),
        (typeof r.deudaBob === 'number') ? r.deudaBob.toFixed(2) : '',
        (typeof r.pagoBob === 'number') ? r.pagoBob.toFixed(2) : '',
        (typeof r.pendienteBob === 'number') ? r.pendienteBob.toFixed(2) : '',
        (typeof r.deudaUsd === 'number') ? r.deudaUsd.toFixed(2) : '',
        (typeof r.pagoUsd === 'number') ? r.pagoUsd.toFixed(2) : '',
        (typeof r.pendienteUsd === 'number') ? r.pendienteUsd.toFixed(2) : ''
      ];
      csv += line.join(';') + '\n';
    });

    const srvTag = (this.filterService || 'TODOS').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Reporte_Consolidado_${srvTag}_${this.startDate}_a_${this.endDate}.csv`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.app.showToast(`Reporte CSV descargado: ${filename}`, 'success');
  }
};
