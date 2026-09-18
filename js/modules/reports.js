/**
 * MARETRAVEL ERP - Módulo 6: Reportes y Módulo Contable
 * Diseñado específicamente para el Contador General de la empresa.
 * Incluye:
 *  1. Arqueo y Cierre Diario de Caja
 *  2. Libro Contable de Ventas (Notas de Débito / Facturación)
 *  3. Libro Contable de Compras y Proveedores (Notas de Crédito)
 *  4. Resumen de Comisiones y Utilidad Fiscal de la Agencia (IVA/IT)
 *  5. Funciones de Anulación con motivo justificado y Corrección Contable de comprobantes.
 *  6. Exportación a Excel (.CSV) e Impresión Oficial con membrete.
 */

window.reportsModule = {
  currentTab: 'arqueo',
  currentEditingDoc: null,

  init() {
    this.setDefaultDates();
    this.bindEvents();
    this.render();
  },

  setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    // Por defecto, inicio del mes actual hasta hoy
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const fromInput = document.getElementById('rep-date-from');
    const toInput = document.getElementById('rep-date-to');
    if (fromInput && !fromInput.value) fromInput.value = firstDayOfMonth;
    if (toInput && !toInput.value) toInput.value = today;
  },

  bindEvents() {
    // Sub-tabs de Reportes
    const tabs = document.querySelectorAll('.report-tab-btn');
    tabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        tabs.forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentTab = e.currentTarget.dataset.tab;
        this.showTabContent(this.currentTab);
      });
    });

    const btnFilter = document.getElementById('btn-filter-reports');
    if (btnFilter) {
      btnFilter.addEventListener('click', () => this.render());
    }

    const btnExportCsv = document.getElementById('btn-export-reports-csv');
    if (btnExportCsv) {
      btnExportCsv.addEventListener('click', () => this.exportCurrentReportToCsv());
    }

    const btnPrint = document.getElementById('btn-print-active-report');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => this.printActiveReport());
    }

    // Formularios de Corrección y Anulación Contable
    const formCorrect = document.getElementById('accounting-correct-form');
    if (formCorrect) {
      formCorrect.addEventListener('submit', (e) => this.handleSaveCorrection(e));
    }

    const formVoid = document.getElementById('accounting-void-form');
    if (formVoid) {
      formVoid.addEventListener('submit', (e) => this.handleConfirmVoid(e));
    }
  },

  showTabContent(tab) {
    document.querySelectorAll('.report-subview').forEach(v => v.style.display = 'none');
    const target = document.getElementById(`rep-view-${tab}`);
    if (target) target.style.display = 'block';
    this.render();
  },

  render() {
    if (this.currentTab === 'arqueo') this.renderArqueo();
    if (this.currentTab === 'libro-ventas') this.renderLibroVentas();
    if (this.currentTab === 'libro-compras') this.renderLibroCompras();
    if (this.currentTab === 'utilidad-comisiones') this.renderComisionesUtilidad();
    if (window.lucide) window.lucide.createIcons();
  },

  // ==========================================================================
  // 1. ARQUEO DE CAJA
  // ==========================================================================
  renderArqueo() {
    const data = window.db.get();
    const fromDate = document.getElementById('rep-date-from')?.value;
    const toDate = document.getElementById('rep-date-to')?.value;

    const receipts = (data.cashReceipts || []).filter(r => r.status === 'VALIDO');

    const summaryByMethod = {};
    let grandTotalBob = 0;
    let grandTotalUsd = 0;

    receipts.forEach(r => {
      const recDate = r.receiptDate.split(' ')[0];
      if (fromDate && recDate < fromDate) return;
      if (toDate && recDate > toDate) return;

      r.payments.forEach(p => {
        const key = `${p.paymentMethodName} (${p.currency})`;
        if (!summaryByMethod[key]) {
          summaryByMethod[key] = {
            name: p.paymentMethodName,
            currency: p.currency,
            total: 0,
            count: 0
          };
        }
        summaryByMethod[key].total += p.amount;
        summaryByMethod[key].count += 1;

        if (p.currency === 'BOB') grandTotalBob += p.amount;
        else grandTotalUsd += p.amount;
      });
    });

    const summaryTbody = document.getElementById('report-summary-table-body');
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

    const detailTbody = document.getElementById('report-details-table-body');
    if (detailTbody) {
      const movements = [];
      receipts.forEach(r => {
        const recDate = r.receiptDate.split(' ')[0];
        if (fromDate && recDate < fromDate) return;
        if (toDate && recDate > toDate) return;

        r.details.forEach(d => {
          const pmNames = r.payments.map(p => p.paymentMethodName).join(' + ');
          const isTotal = d.remainingBalanceBob <= 0.05;
          movements.push({
            receiptNumber: r.receiptNumber,
            ndNumber: d.ndNumber,
            date: r.receiptDate,
            client: r.accountName,
            solicitante: r.solicitante,
            amountPaidBob: d.amountPaidBob,
            remainingBalanceBob: d.remainingBalanceBob,
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
            <td class="font-mono" style="font-weight: 700;">REC #${m.receiptNumber}</td>
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
  },

  // ==========================================================================
  // 2. LIBRO CONTABLE DE VENTAS (NOTAS DE DÉBITO / FACTURACIÓN)
  // ==========================================================================
  renderLibroVentas() {
    const data = window.db.get();
    const fromDate = document.getElementById('rep-date-from')?.value;
    const toDate = document.getElementById('rep-date-to')?.value;
    const statusFilter = document.getElementById('rep-status-filter')?.value || 'TODOS';
    const vatRate = data.systemSettings.vatRate || 14.94; // 13% IVA + 3% IT aproximado o legal

    const tbody = document.getElementById('sales-book-table-body');
    if (!tbody) return;

    let notes = (data.debitNotes || []).filter(nd => {
      const matchDate = (!fromDate || nd.issueDate >= fromDate) && (!toDate || nd.issueDate <= toDate);
      const isVoid = nd.status === 'ANULADA';
      const matchStatus = statusFilter === 'TODOS' ||
                          (statusFilter === 'VALIDOS' && !isVoid) ||
                          (statusFilter === 'ANULADOS' && isVoid);
      return matchDate && matchStatus;
    });

    let totalVentasBob = 0;
    let totalComisionesBob = 0;
    let totalIvaEstimado = 0;

    if (notes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 24px; color: var(--text-muted);">No se registraron Notas de Débito en este período contable.</td></tr>`;
      this.updateAccountingTotals(0, 0, 0);
      return;
    }

    tbody.innerHTML = notes.map((nd, index) => {
      const isVoid = nd.status === 'ANULADA';

      // Calcular comisiones de la agencia en esta ND
      let commBob = 0;
      if (!isVoid && nd.items) {
        nd.items.forEach(it => {
          const c = it.providerCommissionAmount || 0;
          commBob += (it.currency === 'USD' ? c * (data.systemSettings.activeExchangeSell || 6.96) : c);
        });
      }

      // Impuesto estimado sobre la comisión y fee
      const ivaIt = isVoid ? 0 : commBob * (vatRate / 100);

      if (!isVoid) {
        totalVentasBob += nd.totalAmountBob;
        totalComisionesBob += commBob;
        totalIvaEstimado += ivaIt;
      }

      const statusBadge = isVoid ? 'badge-rose' :
                          nd.status === 'PAGADA' ? 'badge-emerald' :
                          nd.status === 'PARCIAL' ? 'badge-blue' : 'badge-amber';

      return `
        <tr style="${isVoid ? 'background: #fff1f2; text-decoration: line-through; opacity: 0.7;' : ''}">
          <td class="font-mono" style="text-align: center;">${index + 1}</td>
          <td class="font-mono" style="font-weight: 700; color: var(--navy);">ND #${nd.ndNumber}</td>
          <td class="font-mono">${nd.issueDate}</td>
          <td class="font-mono"><strong>${nd.accountNit || 'S/N'}</strong></td>
          <td>
            <strong>${nd.accountName}</strong>
            ${nd.correctionNote ? `<div style="font-size:0.7rem; color:#0284c7;">✎ Corregido: ${nd.correctionNote}</div>` : ''}
            ${nd.voidReason ? `<div style="font-size:0.7rem; color:#b91c1c; font-weight:700;">⚠ Anulado: ${nd.voidReason}</div>` : ''}
          </td>
          <td class="font-mono" style="text-align: right; font-weight: 700;">
            ${isVoid ? '0.00' : 'BOB ' + Number(nd.totalAmountBob).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
          </td>
          <td class="font-mono" style="text-align: right; color: #15803d; font-weight: 600;">
            ${isVoid ? '0.00' : 'BOB ' + Number(commBob).toFixed(2)}
          </td>
          <td class="font-mono" style="text-align: right; color: #0369a1;">
            ${isVoid ? '0.00' : 'BOB ' + Number(ivaIt).toFixed(2)}
          </td>
          <td><span class="badge ${statusBadge}">${nd.status}</span></td>
          <td style="text-align: center; text-decoration: none;">
            <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" onclick="window.reportsModule.openCorrectionModal('ND', '${nd.id}')" title="Corregir datos contables (NIT, Razón Social, Fecha, Glosa)">
                <i data-lucide="edit-3"></i>
              </button>
              ${!isVoid ? `
                <button class="btn btn-danger btn-sm" onclick="window.reportsModule.openVoidModal('ND', '${nd.id}')" title="Anular comprobante contable">
                  <i data-lucide="x-circle"></i>
                </button>
              ` : `
                <span class="badge badge-rose" style="font-size:0.68rem;">ANULADO</span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.updateAccountingTotals(totalVentasBob, totalComisionesBob, totalIvaEstimado);
  },

  updateAccountingTotals(ventas, comisiones, iva) {
    const elVentas = document.getElementById('sum-libro-ventas');
    const elComm = document.getElementById('sum-libro-comisiones');
    const elIva = document.getElementById('sum-libro-iva');
    if (elVentas) elVentas.textContent = `BOB ${ventas.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
    if (elComm) elComm.textContent = `BOB ${comisiones.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
    if (elIva) elIva.textContent = `BOB ${iva.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
  },

  // ==========================================================================
  // 3. LIBRO CONTABLE DE COMPRAS Y PROVEEDORES (NOTAS DE CRÉDITO)
  // ==========================================================================
  renderLibroCompras() {
    const data = window.db.get();
    const fromDate = document.getElementById('rep-date-from')?.value;
    const toDate = document.getElementById('rep-date-to')?.value;
    const statusFilter = document.getElementById('rep-status-filter')?.value || 'TODOS';

    const tbody = document.getElementById('purchases-book-table-body');
    if (!tbody) return;

    let notes = (data.creditNotes || []).filter(nc => {
      const matchDate = (!fromDate || nc.issueDate >= fromDate) && (!toDate || nc.issueDate <= toDate);
      const isVoid = nc.status === 'ANULADA';
      const matchStatus = statusFilter === 'TODOS' ||
                          (statusFilter === 'VALIDOS' && !isVoid) ||
                          (statusFilter === 'ANULADOS' && isVoid);
      return matchDate && matchStatus;
    });

    let totalComprasBob = 0;
    let totalPagadoBob = 0;
    let totalSaldoBob = 0;

    if (notes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: var(--text-muted);">No se registraron Notas de Crédito / Liquidaciones a Proveedores en este período.</td></tr>`;
      return;
    }

    tbody.innerHTML = notes.map((nc, index) => {
      const isVoid = nc.status === 'ANULADA';
      const totalInBob = nc.currency === 'USD' ? nc.totalAmount * 6.96 : nc.totalAmount;
      const paidInBob = nc.currency === 'USD' ? nc.paidAmount * 6.96 : nc.paidAmount;
      const balInBob = nc.currency === 'USD' ? nc.balance * 6.96 : nc.balance;

      if (!isVoid) {
        totalComprasBob += totalInBob;
        totalPagadoBob += paidInBob;
        totalSaldoBob += balInBob;
      }

      const statusBadge = isVoid ? 'badge-rose' :
                          nc.status === 'PAGADA' ? 'badge-emerald' :
                          nc.status === 'PARCIAL' ? 'badge-blue' : 'badge-amber';

      return `
        <tr style="${isVoid ? 'background: #fff1f2; text-decoration: line-through; opacity: 0.7;' : ''}">
          <td class="font-mono" style="text-align: center;">${index + 1}</td>
          <td class="font-mono" style="font-weight: 700; color: var(--navy);">NC #${nc.ncNumber}</td>
          <td class="font-mono">${nc.issueDate}</td>
          <td>
            <strong>${nc.providerName}</strong>
            <div style="font-size:0.72rem; color:var(--text-muted);">${nc.concept}</div>
            ${nc.correctionNote ? `<div style="font-size:0.7rem; color:#0284c7;">✎ Corregido: ${nc.correctionNote}</div>` : ''}
            ${nc.voidReason ? `<div style="font-size:0.7rem; color:#b91c1c; font-weight:700;">⚠ Anulado: ${nc.voidReason}</div>` : ''}
          </td>
          <td class="font-mono">${nc.originDebitNoteNumber ? `ND #${nc.originDebitNoteNumber}` : 'Manual'}</td>
          <td class="font-mono" style="text-align: right; font-weight: 700;">
            ${nc.currency} ${Number(nc.totalAmount).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
          </td>
          <td class="font-mono" style="text-align: right; color: #15803d;">
            ${nc.currency} ${Number(nc.paidAmount).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
          </td>
          <td class="font-mono" style="text-align: right; color: #b91c1c; font-weight: 700;">
            ${nc.currency} ${Number(nc.balance).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
          </td>
          <td style="text-align: center; text-decoration: none;">
            <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" onclick="window.reportsModule.openCorrectionModal('NC', '${nc.id}')" title="Corregir datos contables">
                <i data-lucide="edit-3"></i>
              </button>
              ${!isVoid ? `
                <button class="btn btn-danger btn-sm" onclick="window.reportsModule.openVoidModal('NC', '${nc.id}')" title="Anular comprobante">
                  <i data-lucide="x-circle"></i>
                </button>
              ` : `
                <span class="badge badge-rose" style="font-size:0.68rem;">ANULADA</span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ==========================================================================
  // 4. RESUMEN DE COMISIONES Y UTILIDAD FISCAL
  // ==========================================================================
  renderComisionesUtilidad() {
    const data = window.db.get();
    const fromDate = document.getElementById('rep-date-from')?.value;
    const toDate = document.getElementById('rep-date-to')?.value;
    const vatRate = data.systemSettings.vatRate || 14.94;
    const sellRate = data.systemSettings.activeExchangeSell || 6.96;

    const tbody = document.getElementById('commissions-profit-table-body');
    if (!tbody) return;

    let totalVentasBrutas = 0;
    let totalCostoProveedores = 0;
    let totalComisionAgencia = 0;
    let totalComisionCedidaClientes = 0;
    let totalUtilidadNeta = 0;

    const rows = [];

    (data.debitNotes || []).forEach(nd => {
      if (nd.status === 'ANULADA') return;
      if (fromDate && nd.issueDate < fromDate) return;
      if (toDate && nd.issueDate > toDate) return;

      (nd.items || []).forEach(item => {
        const rate = item.currency === 'USD' ? sellRate : 1.0;
        const bruto = ((item.totalAmount - (item.clientCommissionAmount || 0)) + (item.feeAmount || 0)) * rate;
        const comAgencia = (item.providerCommissionAmount || 0) * rate;
        const comCedida = (item.clientCommissionAmount || 0) * rate;
        const costoProv = (item.netCostToProvider !== undefined ? item.netCostToProvider : item.totalAmount) * rate;
        const gananciaNeta = (comAgencia - comCedida) + ((item.feeAmount || 0) * rate);

        totalVentasBrutas += bruto;
        totalCostoProveedores += costoProv;
        totalComisionAgencia += comAgencia;
        totalComisionCedidaClientes += comCedida;
        totalUtilidadNeta += gananciaNeta;

        rows.push({
          ndNumber: nd.ndNumber,
          date: nd.issueDate,
          client: nd.accountName,
          service: `${item.serviceType} - ${item.passengerName}`,
          brutoBob: bruto,
          costoProvBob: costoProv,
          comAgenciaBob: comAgencia,
          comCedidaBob: comCedida,
          utilidadBob: gananciaNeta
        });
      });
    });

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: var(--text-muted);">Sin datos de servicios para el rango de fechas seleccionado.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td class="font-mono" style="font-weight: 700;">ND #${r.ndNumber}</td>
        <td class="font-mono">${r.date}</td>
        <td><strong>${r.client}</strong></td>
        <td><span style="font-size: 0.78rem;">${r.service}</span></td>
        <td class="font-mono" style="text-align: right;">BOB ${Number(r.brutoBob).toFixed(2)}</td>
        <td class="font-mono" style="text-align: right; color: #b91c1c;">BOB ${Number(r.costoProvBob).toFixed(2)}</td>
        <td class="font-mono" style="text-align: right; color: #15803d; font-weight: 600;">BOB ${Number(r.comAgenciaBob).toFixed(2)}</td>
        <td class="font-mono" style="text-align: right; color: #d97706;">BOB ${Number(r.comCedidaBob).toFixed(2)}</td>
        <td class="font-mono" style="text-align: right; font-weight: 800; color: #0369a1;">BOB ${Number(r.utilidadBob).toFixed(2)}</td>
      </tr>
    `).join('') + `
      <tr style="background: #f0f9ff; font-weight: 800; border-top: 2px solid #00aeef;">
        <td colspan="4">TOTALES DEL PERÍODO CONTABLE:</td>
        <td class="font-mono" style="text-align: right;">BOB ${totalVentasBrutas.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</td>
        <td class="font-mono" style="text-align: right; color: #b91c1c;">BOB ${totalCostoProveedores.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</td>
        <td class="font-mono" style="text-align: right; color: #15803d;">BOB ${totalComisionAgencia.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</td>
        <td class="font-mono" style="text-align: right; color: #d97706;">BOB ${totalComisionCedidaClientes.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</td>
        <td class="font-mono" style="text-align: right; color: #0369a1; font-size: 1.05rem;">BOB ${totalUtilidadNeta.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</td>
      </tr>
    `;

    // Actualizar tarjetas de resumen fiscal
    const elVentasB = document.getElementById('kpi-rep-ventas-brutas');
    const elCostos = document.getElementById('kpi-rep-costo-operadores');
    const elUtilidad = document.getElementById('kpi-rep-utilidad-neta');
    if (elVentasB) elVentasB.textContent = `BOB ${totalVentasBrutas.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
    if (elCostos) elCostos.textContent = `BOB ${totalCostoProveedores.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
    if (elUtilidad) elUtilidad.textContent = `BOB ${totalUtilidadNeta.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
  },

  // ==========================================================================
  // 5. ACCIÓN: CORRECCIÓN CONTABLE DE COMPROBANTES (NIT, Razón Social, Fecha, Glosa)
  // ==========================================================================
  openCorrectionModal(type, docId) {
    this.currentEditingDoc = { type, docId };
    const data = window.db.get();
    const modalTitle = document.getElementById('accounting-correct-title');

    if (type === 'ND') {
      const doc = data.debitNotes.find(n => n.id === docId);
      if (!doc) return;
      modalTitle.textContent = `Corrección Contable: Nota de Débito ND #${doc.ndNumber}`;
      document.getElementById('corr-nit').value = doc.accountNit || '';
      document.getElementById('corr-name').value = doc.accountName || '';
      document.getElementById('corr-date').value = doc.issueDate;
      document.getElementById('corr-solicitante').value = doc.solicitante || '';
      document.getElementById('corr-observations').value = doc.observations || '';
    } else {
      const doc = data.creditNotes.find(n => n.id === docId);
      if (!doc) return;
      modalTitle.textContent = `Corrección Contable: Nota de Crédito NC #${doc.ncNumber}`;
      document.getElementById('corr-nit').value = doc.providerNit || '';
      document.getElementById('corr-name').value = doc.providerName || '';
      document.getElementById('corr-date').value = doc.issueDate;
      document.getElementById('corr-solicitante').value = '-';
      document.getElementById('corr-observations').value = doc.concept || '';
    }

    document.getElementById('corr-reason').value = '';
    window.app.openModal('modal-accounting-correct');
  },

  handleSaveCorrection(e) {
    e.preventDefault();
    if (!this.currentEditingDoc) return;

    const reason = document.getElementById('corr-reason').value.trim();
    if (!reason || reason.length < 5) {
      window.app.showToast('Debes ingresar la justificación de la corrección para auditoría', 'warning');
      return;
    }

    const data = window.db.get();
    const { type, docId } = this.currentEditingDoc;
    const newNit = document.getElementById('corr-nit').value.trim();
    const newName = document.getElementById('corr-name').value.trim();
    const newDate = document.getElementById('corr-date').value;
    const newSol = document.getElementById('corr-solicitante').value.trim();
    const newObs = document.getElementById('corr-observations').value.trim();

    if (type === 'ND') {
      const doc = data.debitNotes.find(n => n.id === docId);
      if (doc) {
        doc.accountNit = newNit;
        doc.accountName = newName;
        doc.issueDate = newDate;
        doc.solicitante = newSol;
        doc.observations = newObs;
        doc.correctionNote = `${reason} (por Contador el ${new Date().toLocaleString()})`;

        // Registrar auditoría
        data.accountHistory.unshift({
          id: 'AH-' + Date.now(),
          accountId: doc.accountId,
          accountName: doc.accountName,
          changeType: 'UPDATE',
          fieldChanged: `Corrección Contable ND #${doc.ndNumber}`,
          oldValue: `Fecha: ${doc.issueDate}, NIT: ${doc.accountNit}`,
          newValue: `Fecha: ${newDate}, NIT: ${newNit}. Motivo: ${reason}`,
          userId: data.currentUser.id,
          userName: data.currentUser.name,
          createdAt: new Date().toLocaleString()
        });
      }
    } else {
      const doc = data.creditNotes.find(n => n.id === docId);
      if (doc) {
        doc.providerNit = newNit;
        doc.providerName = newName;
        doc.issueDate = newDate;
        doc.concept = newObs;
        doc.correctionNote = `${reason} (por Contador el ${new Date().toLocaleString()})`;
      }
    }

    window.db.save(data);
    window.app.closeModal('modal-accounting-correct');
    window.app.showToast('Comprobante corregido y registrado en la bitácora contable', 'success');
    this.render();
  },

  // ==========================================================================
  // 6. ACCIÓN: ANULACIÓN DE COMPROBANTES CON MOTIVO OBLIGATORIO
  // ==========================================================================
  openVoidModal(type, docId) {
    this.currentEditingDoc = { type, docId };
    const data = window.db.get();
    const title = document.getElementById('accounting-void-title');
    const info = document.getElementById('accounting-void-info');

    if (type === 'ND') {
      const doc = data.debitNotes.find(n => n.id === docId);
      if (!doc) return;
      title.textContent = `Anular Nota de Débito ND #${doc.ndNumber}`;
      info.innerHTML = `
        <strong>Documento a Anular:</strong> ND #${doc.ndNumber} - ${doc.accountName}<br>
        <strong>Monto:</strong> ${doc.currency} ${Number(doc.totalAmountBob).toFixed(2)}<br>
        <strong>Saldo actual:</strong> ${doc.currency} ${Number(doc.balanceBob).toFixed(2)}
      `;
    } else {
      const doc = data.creditNotes.find(n => n.id === docId);
      if (!doc) return;
      title.textContent = `Anular Nota de Crédito NC #${doc.ncNumber}`;
      info.innerHTML = `
        <strong>Documento a Anular:</strong> NC #${doc.ncNumber} - ${doc.providerName}<br>
        <strong>Monto:</strong> ${doc.currency} ${Number(doc.totalAmount).toFixed(2)}
      `;
    }

    document.getElementById('void-reason').value = '';
    window.app.openModal('modal-accounting-void');
  },

  handleConfirmVoid(e) {
    e.preventDefault();
    if (!this.currentEditingDoc) return;

    const reason = document.getElementById('void-reason').value.trim();
    if (!reason || reason.length < 5) {
      window.app.showToast('Debes justificar el motivo de la anulación fiscal (mínimo 5 caracteres)', 'warning');
      return;
    }

    const data = window.db.get();
    const { type, docId } = this.currentEditingDoc;

    if (type === 'ND') {
      const doc = data.debitNotes.find(n => n.id === docId);
      if (!doc) return;

      if (doc.paidAmountBob > 0 || doc.paidAmountUsd > 0) {
        alert('ERROR CONTABLE: No se puede anular esta Nota de Débito porque tiene cobros registrados en caja. Debe revertir los recibos de caja primero.');
        return;
      }

      doc.status = 'ANULADA';
      doc.balanceBob = 0.00;
      doc.balanceUsd = 0.00;
      doc.voidReason = reason;
      doc.voidedAt = new Date().toLocaleString();
      doc.voidedBy = data.currentUser.name;

      // Liberar boletos GDS asociados
      (doc.items || []).forEach(it => {
        if (it.gdsTicketId) {
          const t = data.gdsTickets.find(x => x.id === it.gdsTicketId);
          if (t) t.status = 'DISPONIBLE';
        }
      });

      // Anular NCs automáticas originadas por esta ND
      (data.creditNotes || []).forEach(nc => {
        if (nc.originDebitNoteId === doc.id) {
          nc.status = 'ANULADA';
          nc.balance = 0.00;
          nc.voidReason = `Anulada automáticamente por anulación de ND #${doc.ndNumber}`;
        }
      });

      // Registrar en auditoría
      data.accountHistory.unshift({
        id: 'AH-' + Date.now(),
        accountId: doc.accountId,
        accountName: doc.accountName,
        changeType: 'DELETE',
        fieldChanged: `ANULACIÓN ND #${doc.ndNumber}`,
        oldValue: `Venta activa BOB ${doc.totalAmountBob}`,
        newValue: `ANULADA. Motivo: ${reason}`,
        userId: data.currentUser.id,
        userName: data.currentUser.name,
        createdAt: new Date().toLocaleString()
      });

      window.app.showToast(`Nota de Débito ND #${doc.ndNumber} ANULADA correctamente`, 'info');
    } else {
      const doc = data.creditNotes.find(n => n.id === docId);
      if (!doc) return;

      if (doc.paidAmount > 0) {
        alert('ERROR CONTABLE: No se puede anular esta Nota de Crédito porque registra pagos a favor del proveedor.');
        return;
      }

      doc.status = 'ANULADA';
      doc.balance = 0.00;
      doc.voidReason = reason;
      doc.voidedAt = new Date().toLocaleString();
      doc.voidedBy = data.currentUser.name;

      window.app.showToast(`Nota de Crédito NC #${doc.ncNumber} ANULADA`, 'info');
    }

    window.db.save(data);
    window.app.closeModal('modal-accounting-void');
    this.render();
    if (window.debitNotesModule) window.debitNotesModule.render();
    if (window.creditNotesModule) window.creditNotesModule.render();
  },

  // ==========================================================================
  // 7. EXPORTACIÓN A EXCEL (.CSV) PARA EL CONTADOR
  // ==========================================================================
  exportCurrentReportToCsv() {
    const data = window.db.get();
    const fromDate = document.getElementById('rep-date-from')?.value || 'Inicio';
    const toDate = document.getElementById('rep-date-to')?.value || 'Hoy';

    let csvContent = '\uFEFF'; // BOM para soportar tildes en Excel
    let filename = `MARETRAVEL_REPORTE_${this.currentTab.toUpperCase()}_${fromDate}_${toDate}.csv`;

    if (this.currentTab === 'libro-ventas') {
      csvContent += 'NRO_CORRELATIVO;TIPO_DOC;NUMERO_ND;FECHA_EMISION;NIT_CI_CLIENTE;RAZON_SOCIAL_CLIENTE;TOTAL_FACTURADO_BOB;COMISION_AGENCIA_BOB;IVA_IT_ESTIMADO;ESTADO;OBSERVACIONES\n';
      (data.debitNotes || []).forEach((nd, idx) => {
        if (fromDate && nd.issueDate < fromDate) return;
        if (toDate && nd.issueDate > toDate) return;

        let comm = 0;
        if (nd.status !== 'ANULADA' && nd.items) {
          nd.items.forEach(it => comm += (it.providerCommissionAmount || 0));
        }

        csvContent += `${idx + 1};NOTA_DEBITO;${nd.ndNumber};${nd.issueDate};"${nd.accountNit || '0'}";"${nd.accountName.replace(/"/g, '""')}";${nd.totalAmountBob.toFixed(2)};${comm.toFixed(2)};${(comm * 0.1494).toFixed(2)};${nd.status};"${(nd.voidReason || nd.correctionNote || nd.observations || '').replace(/"/g, '""')}"\n`;
      });
    } else if (this.currentTab === 'libro-compras') {
      csvContent += 'NRO_CORRELATIVO;TIPO_DOC;NUMERO_NC;FECHA_EMISION;ORIGEN_ND;NIT_PROVEEDOR;PROVEEDOR;TOTAL_NC;PAGADO;SALDO_PENDIENTE;ESTADO;CONCEPTO\n';
      (data.creditNotes || []).forEach((nc, idx) => {
        if (fromDate && nc.issueDate < fromDate) return;
        if (toDate && nc.issueDate > toDate) return;

        csvContent += `${idx + 1};NOTA_CREDITO;${nc.ncNumber};${nc.issueDate};${nc.originDebitNoteNumber || 'MANUAL'};"${nc.providerNit || '0'}";"${nc.providerName.replace(/"/g, '""')}";${nc.totalAmount.toFixed(2)};${nc.paidAmount.toFixed(2)};${nc.balance.toFixed(2)};${nc.status};"${(nc.concept || '').replace(/"/g, '""')}"\n`;
      });
    } else {
      // Arqueo y Movimientos
      csvContent += 'NRO_RECIBO;FECHA_HORA;CLIENTE;SOLICITANTE;MONEDA;TOTAL_PAGADO_BOB;TOTAL_PAGADO_USD;ESTADO;CAJERO\n';
      (data.cashReceipts || []).forEach(r => {
        const recDate = r.receiptDate.split(' ')[0];
        if (fromDate && recDate < fromDate) return;
        if (toDate && recDate > toDate) return;

        csvContent += `${r.receiptNumber};${r.receiptDate};"${r.accountName.replace(/"/g, '""')}";"${(r.solicitante || '').replace(/"/g, '""')}";BOB;${r.totalPaidBob.toFixed(2)};${r.totalPaidUsd.toFixed(2)};${r.status};"${r.createdByName}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    window.app.showToast(`Archivo Excel (.CSV) descargado para el Contador`, 'success');
  },

  // ==========================================================================
  // 8. IMPRESIÓN OFICIAL DEL REPORTE CONTABLE ACTIVO
  // ==========================================================================
  printActiveReport() {
    const data = window.db.get();
    const settings = data.systemSettings;
    const fromDate = document.getElementById('rep-date-from')?.value || 'Inicio';
    const toDate = document.getElementById('rep-date-to')?.value || 'Hoy';
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    let reportTitle = 'REPORTE CONTABLE OFICIAL';
    let tableHtml = '';

    if (this.currentTab === 'libro-ventas') {
      reportTitle = 'LIBRO DE VENTAS CONTABLE (NOTAS DE DÉBITO)';
      const table = document.getElementById('sales-book-table');
      tableHtml = table ? table.outerHTML : '';
    } else if (this.currentTab === 'libro-compras') {
      reportTitle = 'LIBRO DE COMPRAS Y PROVEEDORES (NOTAS DE CRÉDITO)';
      const table = document.getElementById('purchases-book-table');
      tableHtml = table ? table.outerHTML : '';
    } else if (this.currentTab === 'utilidad-comisiones') {
      reportTitle = 'ESTADO DE COMISIONES Y UTILIDAD BRUTA DE AGENCIA';
      const table = document.getElementById('commissions-profit-table');
      tableHtml = table ? table.outerHTML : '';
    } else {
      this.printCashClosingReport();
      return;
    }

    printArea.innerHTML = `
      <div class="print-page" style="max-width: 270mm;"> <!-- Formato Horizontal -->
        <div class="print-header">
          <img src="${window.maretravelLogoBase64 || (settings && settings.logoBase64) || 'assets/logo.png'}" class="print-logo" alt="MARETRAVEL Logo">
          <div class="print-agency-info">
            <div class="print-agency-title">${settings.agencyCommercialName}</div>
            <div>NIT: ${settings.agencyNit}</div>
            <div>${settings.agencyAddress}</div>
            <div>Telf: ${settings.agencyPhone}</div>
          </div>
        </div>

        <div class="print-doc-title">
          <h2>${reportTitle}</h2>
          <div style="font-size: 9pt; color: #475569;">
            Período: Del <strong>${fromDate}</strong> al <strong>${toDate}</strong> | Generado por Auditoría Contable el ${new Date().toLocaleString()}
          </div>
        </div>

        <div style="margin-top: 16px;">
          ${tableHtml}
        </div>

        <div class="print-signatures" style="margin-top: 50px;">
          <div class="signature-box">
            <strong>CONTADOR GENERAL</strong><br>
            Firma y Matrícula Profesional CAUB<br>
            MARETRAVEL
          </div>
          <div class="signature-box">
            <strong>GERENCIA GENERAL</strong><br>
            Representante Legal<br>
            Aprobado Conforme
          </div>
        </div>
      </div>
    `;

    window.print();
  },

  // ==========================================================================
  // 9. IMPRESIÓN OFICIAL DEL ARQUEO Y CIERRE DIARIO DE CAJA
  // ==========================================================================
  printCashClosingReport() {
    const data = window.db.get();
    const settings = data.systemSettings;
    const fromDate = document.getElementById('rep-date-from')?.value || new Date().toISOString().split('T')[0];
    const toDate = document.getElementById('rep-date-to')?.value || new Date().toISOString().split('T')[0];
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    const receipts = (data.cashReceipts || []).filter(r => r.status === 'VALIDO');
    const summaryByMethod = {};
    let grandTotalBob = 0;
    let grandTotalUsd = 0;

    receipts.forEach(r => {
      const recDate = r.receiptDate.split(' ')[0];
      if (fromDate && recDate < fromDate) return;
      if (toDate && recDate > toDate) return;

      r.payments.forEach(p => {
        const key = `${p.paymentMethodName} (${p.currency})`;
        if (!summaryByMethod[key]) {
          summaryByMethod[key] = {
            name: p.paymentMethodName,
            currency: p.currency,
            total: 0,
            count: 0
          };
        }
        summaryByMethod[key].total += p.amount;
        summaryByMethod[key].count += 1;

        if (p.currency === 'BOB') grandTotalBob += p.amount;
        else grandTotalUsd += p.amount;
      });
    });

    const summaryEntries = Object.values(summaryByMethod);

    const movements = [];
    receipts.forEach(r => {
      const recDate = r.receiptDate.split(' ')[0];
      if (fromDate && recDate < fromDate) return;
      if (toDate && recDate > toDate) return;

      r.details.forEach(d => {
        const pmNames = r.payments.map(p => `${p.paymentMethodName} (${p.currency} ${Number(p.amount).toFixed(2)})`).join(' + ');
        movements.push({
          receiptNumber: r.receiptNumber,
          ndNumber: d.ndNumber,
          date: r.receiptDate,
          client: r.accountName,
          solicitante: r.solicitante || '-',
          amountPaidBob: d.amountPaidBob,
          paymentMethod: pmNames
        });
      });
    });

    printArea.innerHTML = `
      <div class="print-page" style="max-width: 270mm;">
        <div class="print-header">
          <img src="${window.maretravelLogoBase64 || (settings && settings.logoBase64) || 'assets/logo.png'}" class="print-logo" alt="MARETRAVEL Logo" onerror="this.src='assets/logo.png'">
          <div class="print-agency-info">
            <div class="print-agency-title">${settings.agencyCommercialName || 'MARETRAVEL S.R.L.'}</div>
            <div>NIT: ${settings.agencyNit || '1028374021'}</div>
            <div>${settings.agencyAddress || 'Av. Arce Edif. Illimani'}</div>
            <div>Telf: ${settings.agencyPhone || '+591 2 2441234'}</div>
          </div>
        </div>

        <div class="print-doc-title">
          <h2>ARQUEO Y CIERRE DIARIO DE CAJA OFICIAL</h2>
          <div style="font-size: 9pt; color: #475569;">
            Período: Del <strong>${fromDate}</strong> al <strong>${toDate}</strong> | Generado el ${new Date().toLocaleString()}
          </div>
        </div>

        <div style="margin-top: 14px;">
          <h4 style="font-size: 0.88rem; font-weight: 700; color: #0f2742; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
            1. RESUMEN CONSOLIDADO POR MEDIO DE COBRO
          </h4>
          <table class="erp-table" style="width: 100%; font-size: 8.5pt;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th>Medio de Pago</th>
                <th>Moneda</th>
                <th style="text-align: center;">Operaciones</th>
                <th style="text-align: right;">Total Recaudado</th>
              </tr>
            </thead>
            <tbody>
              ${summaryEntries.length > 0 ? summaryEntries.map(e => `
                <tr>
                  <td><strong>${e.name}</strong></td>
                  <td>${e.currency}</td>
                  <td style="text-align: center;">${e.count}</td>
                  <td class="font-mono" style="text-align: right; font-weight: 700;">${e.currency} ${Number(e.total).toLocaleString('es-BO', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('') : '<tr><td colspan="4" style="text-align:center; padding: 10px;">Sin recaudaciones registradas</td></tr>'}
              <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #0f2742;">
                <td colspan="3">TOTAL EFECTIVO / BANCOS BOLIVIANOS (BOB):</td>
                <td class="font-mono" style="text-align: right; color: #15803d; font-size: 10pt;">
                  BOB ${grandTotalBob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                </td>
              </tr>
              <tr style="background: #f8fafc; font-weight: 800;">
                <td colspan="3">TOTAL EFECTIVO / BANCOS DÓLARES (USD):</td>
                <td class="font-mono" style="text-align: right; color: #0369a1; font-size: 10pt;">
                  USD ${grandTotalUsd.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-top: 18px;">
          <h4 style="font-size: 0.88rem; font-weight: 700; color: #0f2742; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
            2. DETALLE CRONOLÓGICO DE RECIBOS DE COBRO
          </h4>
          <table class="erp-table" style="width: 100%; font-size: 8pt;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th>Recibo</th>
                <th>ND Cobrada</th>
                <th>Fecha/Hora</th>
                <th>Cliente</th>
                <th>Solicitante</th>
                <th>Medio de Pago / Detalle</th>
                <th style="text-align: right;">Importe Cobrado</th>
              </tr>
            </thead>
            <tbody>
              ${movements.length > 0 ? movements.map(m => `
                <tr>
                  <td class="font-mono" style="font-weight: 700;">REC #${m.receiptNumber}</td>
                  <td class="font-mono" style="color: #0369a1; font-weight: 600;">ND #${m.ndNumber}</td>
                  <td class="font-mono">${m.date}</td>
                  <td><strong>${m.client}</strong></td>
                  <td>${m.solicitante}</td>
                  <td style="font-size: 7.5pt;">${m.paymentMethod}</td>
                  <td class="font-mono" style="text-align: right; font-weight: 700; color: #15803d;">
                    BOB ${Number(m.amountPaidBob).toFixed(2)}
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="7" style="text-align:center; padding: 10px;">Sin movimientos registrados</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="print-signatures" style="margin-top: 40px;">
          <div class="signature-box">
            <strong>RESPONSABLE DE CAJA / COBRANZAS</strong><br>
            Carlos Mendoza • Caja General<br>
            Entregué Conforme
          </div>
          <div class="signature-box">
            <strong>CONTADOR GENERAL / AUDITORÍA</strong><br>
            Lic. Auditoría y Finanzas CAUB<br>
            Revisado y Aprobado Conforme
          </div>
        </div>
      </div>
    `;

    window.print();
  }
};
