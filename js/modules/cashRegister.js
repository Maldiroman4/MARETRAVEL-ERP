/**
 * MARETRAVEL ERP - Módulo 5: Caja, Cobranzas y Pagos Multimoneda
 * Incluye: Cobranza mixta multimoneda (BOB/USD), Recibo Oficial de Caja con logo,
 * Pago a NCs de proveedores, y reversión de pagos con auditoría y restauración de saldos.
 */

window.cashRegisterModule = {
  currentTab: 'historial',
  printablesFilter: 'ALL',
  selectedClientNds: [],
  selectedProviderNcs: [],
  activePaymentRows: [],

  setPrintablesFilter(filter) {
    this.printablesFilter = filter;
    document.querySelectorAll('.cash-filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    this.renderReceiptsHistory();
  },

  init() {
    if (!this._eventsBound) {
      this.bindEvents();
      this._eventsBound = true;
    }
    this.render();
  },

  // =========================================================================
  // SEMÁFORO VISUAL DE ESTADOS POR BORDES (ND Y NC)
  // - saldo_pendiente === 0 -> PAGADA (fondo suave, borde verde #00a884)
  // - monto_abonado > 0 && saldo_pendiente > 0 -> PENDIENTE (fondo suave, borde amarillo #eab308)
  // - monto_abonado === 0 -> IMPAGA (fondo suave, borde gris #94a3b8)
  // =========================================================================
  renderStatusBadge(status, montoAbonado = 0, saldoPendiente = 0) {
    const bal = parseFloat(saldoPendiente) || 0;
    const paid = parseFloat(montoAbonado) || 0;
    const st = String(status || '').toUpperCase();

    if (st === 'ANULADA') {
      return `<span class="badge badge-rose" style="border: 2px solid #f43f5e; font-weight: 700;">ANULADA</span>`;
    }

    // Regla matemática estricta: Si tiene saldo pendiente mayor a 0, NUNCA puede ser PAGADA
    if (bal <= 0.005 && (st === 'PAGADA' || paid > 0)) {
      return `<span class="badge border-success badge-status-pagada" style="background: #ecfdf5; color: #047857; border: 2px solid #00a884; font-weight: 700; padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px;">
        <i data-lucide="check-circle" style="width: 12px; height: 12px;"></i> PAGADA
      </span>`;
    }

    if (paid > 0 && bal > 0.005) {
      return `<span class="badge border-warning badge-status-pendiente" style="background: #fefce8; color: #b45309; border: 2px solid #eab308; font-weight: 700; padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px;">
        <i data-lucide="clock" style="width: 12px; height: 12px;"></i> PENDIENTE
      </span>`;
    }

    return `<span class="badge border-secondary badge-status-impaga" style="background: #f1f5f9; color: #475569; border: 2px solid #94a3b8; font-weight: 700; padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px;">
      <i data-lucide="alert-circle" style="width: 12px; height: 12px;"></i> IMPAGA
    </span>`;
  },

  // =========================================================================
  // HELPER: OBTENCIÓN NORMALIZADA DE SALDOS EN BOB Y USD (ND Y NC)
  // =========================================================================
  getDocumentNormalizedBalances(doc, isNd, tc = 6.96) {
    let totalBob = 0;
    let totalUsd = 0;
    let balanceBob = 0;
    let balanceUsd = 0;

    const rate = tc > 0 ? tc : 6.96;
    const isDocUsd = (doc.currency === 'USD');

    if (isNd) {
      if (isDocUsd) {
        totalUsd = Number(doc.totalAmountUsd !== undefined && doc.totalAmountUsd !== null ? doc.totalAmountUsd : (doc.total_documento || (Number(doc.totalAmountBob || 0) / rate)));
        totalBob = Number(doc.totalAmountBob !== undefined && doc.totalAmountBob !== null ? doc.totalAmountBob : (totalUsd * rate));
        balanceUsd = Number(doc.balanceUsd !== undefined && doc.balanceUsd !== null ? doc.balanceUsd : (doc.saldo_pendiente !== undefined ? doc.saldo_pendiente : (Number(doc.balanceBob || 0) / rate)));
        balanceBob = Number(doc.balanceBob !== undefined && doc.balanceBob !== null ? doc.balanceBob : (balanceUsd * rate));
      } else {
        totalBob = Number(doc.totalAmountBob !== undefined && doc.totalAmountBob !== null ? doc.totalAmountBob : (doc.total_documento || 0));
        totalUsd = Number(doc.totalAmountUsd !== undefined && doc.totalAmountUsd !== null ? doc.totalAmountUsd : (totalBob / rate));
        balanceBob = Number(doc.balanceBob !== undefined && doc.balanceBob !== null ? doc.balanceBob : (doc.saldo_pendiente !== undefined ? doc.saldo_pendiente : 0));
        balanceUsd = Number(doc.balanceUsd !== undefined && doc.balanceUsd !== null ? doc.balanceUsd : (balanceBob / rate));
      }
    } else {
      // NC Proveedor
      if (isDocUsd) {
        totalUsd = Number(doc.totalAmountUsd !== undefined && doc.totalAmountUsd !== null ? doc.totalAmountUsd : (doc.totalAmount !== undefined ? doc.totalAmount : (doc.total_documento || 0)));
        totalBob = Number(doc.totalAmountBob !== undefined && doc.totalAmountBob !== null ? doc.totalAmountBob : (totalUsd * rate));
        balanceUsd = Number(doc.balanceUsd !== undefined && doc.balanceUsd !== null ? doc.balanceUsd : (doc.balance !== undefined ? doc.balance : (doc.saldo_pendiente || 0)));
        balanceBob = Number(doc.balanceBob !== undefined && doc.balanceBob !== null ? doc.balanceBob : (balanceUsd * rate));
      } else {
        totalBob = Number(doc.totalAmountBob !== undefined && doc.totalAmountBob !== null ? doc.totalAmountBob : (doc.totalAmount !== undefined ? doc.totalAmount : (doc.total_documento || 0)));
        totalUsd = Number(doc.totalAmountUsd !== undefined && doc.totalAmountUsd !== null ? doc.totalAmountUsd : (totalBob / rate));
        balanceBob = Number(doc.balanceBob !== undefined && doc.balanceBob !== null ? doc.balanceBob : (doc.balance !== undefined ? doc.balance : (doc.saldo_pendiente || 0)));
        balanceUsd = Number(doc.balanceUsd !== undefined && doc.balanceUsd !== null ? doc.balanceUsd : (balanceBob / rate));
      }
    }

    return {
      totalBob: Math.max(0, totalBob),
      totalUsd: Math.max(0, totalUsd),
      balanceBob: Math.max(0, balanceBob),
      balanceUsd: Math.max(0, balanceUsd)
    };
  },

  // =========================================================================
  // MODAL TRANSACCIONAL: REGISTRO DE PAGO / AMORTIZACIÓN
  // =========================================================================
  openPaymentModal(docType, docId) {
    const data = window.db.get();
    const isNd = (docType === 'ND');
    const doc = isNd
      ? (data.debitNotes || []).find(n => n.id === docId || String(n.ndNumber) === String(docId))
      : (data.creditNotes || []).find(c => c.id === docId || String(c.ncNumber) === String(docId));

    if (!doc) {
      window.app.showToast('No se encontró el comprobante para procesar pago.', 'warning');
      return;
    }

    const modal = document.getElementById('modal-payment-transaction');
    if (!modal) return;

    document.getElementById('pay-doc-type').value = isNd ? 'ND' : 'NC';
    document.getElementById('pay-doc-id').value = doc.id;

    const rates = window.financialGuard ? window.financialGuard.getExchangeRates() : { sellRate: 6.96 };
    const sellRate = doc.frozenExchangeRate || rates.sellRate || 6.96;
    const tcInput = document.getElementById('pay-exchange-rate');
    if (tcInput) tcInput.value = sellRate.toFixed(2);

    const docNumLabel = isNd ? `ND #${doc.ndNumber}` : `NC #${doc.ncNumber}`;
    const entityName = isNd ? (doc.accountName || 'Cliente General') : (doc.providerName || 'Proveedor');

    document.getElementById('pay-doc-label').textContent = docNumLabel;
    document.getElementById('pay-entity-name').textContent = entityName;

    const titleEl = document.getElementById('modal-pay-title');
    const subEl = document.getElementById('modal-pay-subtitle');
    const iconContainer = document.getElementById('modal-pay-icon-container');
    const submitBtn = document.getElementById('btn-confirm-payment-transaction');

    if (isNd) {
      if (titleEl) titleEl.textContent = 'Cobranza a Cliente / Amortización ND';
      if (subEl) subEl.textContent = `Cobro a favor de MARETRAVEL por ${docNumLabel}`;
      if (iconContainer) {
        iconContainer.style.background = '#00a884';
        iconContainer.innerHTML = '<i data-lucide="hand-coins" style="width: 20px; height: 20px;"></i>';
      }
      if (submitBtn) {
        submitBtn.style.background = '#00a884';
        submitBtn.style.borderColor = '#008f70';
        submitBtn.innerHTML = '<i data-lucide="check-circle"></i> Confirmar y Procesar Cobro';
      }
    } else {
      if (titleEl) titleEl.textContent = 'Pago a Proveedor / Amortización NC';
      if (subEl) subEl.textContent = `Desembolso a proveedor por ${docNumLabel}`;
      if (iconContainer) {
        iconContainer.style.background = '#d97706';
        iconContainer.innerHTML = '<i data-lucide="banknote" style="width: 20px; height: 20px;"></i>';
      }
      if (submitBtn) {
        submitBtn.style.background = '#d97706';
        submitBtn.style.borderColor = '#b45309';
        submitBtn.innerHTML = '<i data-lucide="check-circle"></i> Confirmar y Procesar Pago';
      }
    }

    const defaultCurr = doc.currency || 'BOB';
    this.onPaymentCurrencyChange(defaultCurr);

    const { balanceBob, balanceUsd } = this.getDocumentNormalizedBalances(doc, isNd, sellRate);
    const hasBalance = (balanceBob > 0.01 || balanceUsd > 0.01);

    const notesInput = document.getElementById('pay-notes-input');
    if (notesInput) {
      notesInput.value = hasBalance
        ? `Abono a ${docNumLabel} - ${entityName}`
        : `Liquidación total de ${docNumLabel}`;
    }

    const accSelect = document.getElementById('pay-account-select');
    if (accSelect) {
      const finAccounts = data.financialAccounts || data.bankAccounts || [];
      if (finAccounts.length > 0) {
        accSelect.innerHTML = finAccounts.map(a => 
          `<option value="${a.id}">${a.name || a.bankName} (${a.currency || 'BOB'}) - ${a.accountNumber || ''}</option>`
        ).join('');
      } else {
        accSelect.innerHTML = '<option value="CAJA_GENERAL">Caja General Central (BOB)</option><option value="BNB_MN">Banco BNB M/N (BOB)</option><option value="BCP_MN">Banco BCP M/N (BOB)</option>';
      }
    }

    this.onModalPaymentAmountChange();
    window.app.openModal('modal-payment-transaction');
    if (window.lucide) window.lucide.createIcons();

    const amtInput = document.getElementById('pay-amount-input');
    setTimeout(() => {
      if (amtInput) {
        amtInput.focus();
        amtInput.select();
      }
    }, 120);
  },

  onPaymentCurrencyChange(curr) {
    const hidden = document.getElementById('pay-currency');
    if (hidden) hidden.value = curr;
    const btnBob = document.getElementById('pay-curr-btn-bob');
    const btnUsd = document.getElementById('pay-curr-btn-usd');
    const label = document.getElementById('pay-amount-curr-label');

    if (curr === 'BOB') {
      if (btnBob) btnBob.className = 'btn btn-xs btn-primary font-bold';
      if (btnUsd) btnUsd.className = 'btn btn-xs btn-secondary';
      if (label) label.textContent = 'BOB';
    } else {
      if (btnBob) btnBob.className = 'btn btn-xs btn-secondary';
      if (btnUsd) btnUsd.className = 'btn btn-xs btn-primary font-bold';
      if (label) label.textContent = 'USD';
    }

    this.updatePaymentSummaryDisplay(curr);
    this.setFullPaymentAmount();
  },

  updatePaymentSummaryDisplay(curr) {
    const data = window.db.get();
    const docType = document.getElementById('pay-doc-type')?.value;
    const docId = document.getElementById('pay-doc-id')?.value;
    const isNd = (docType === 'ND');
    const doc = isNd
      ? (data.debitNotes || []).find(n => n.id === docId)
      : (data.creditNotes || []).find(c => c.id === docId);
    if (!doc) return;

    const tc = parseFloat(document.getElementById('pay-exchange-rate')?.value) || doc.frozenExchangeRate || 6.96;
    const { totalBob, totalUsd, balanceBob, balanceUsd } = this.getDocumentNormalizedBalances(doc, isNd, tc);

    const totalEl = document.getElementById('pay-doc-total');
    const balEl = document.getElementById('pay-doc-balance');

    if (curr === 'USD') {
      if (totalEl) totalEl.textContent = `USD ${totalUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (balEl) balEl.textContent = `USD ${balanceUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      if (totalEl) totalEl.textContent = `BOB ${totalBob.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (balEl) balEl.textContent = `BOB ${balanceBob.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  },

  setFullPaymentAmount() {
    const data = window.db.get();
    const docType = document.getElementById('pay-doc-type').value;
    const docId = document.getElementById('pay-doc-id').value;
    const isNd = (docType === 'ND');
    const doc = isNd
      ? (data.debitNotes || []).find(n => n.id === docId)
      : (data.creditNotes || []).find(c => c.id === docId);
    if (!doc) return;

    const curr = document.getElementById('pay-currency')?.value || doc.currency || 'BOB';
    const tc = parseFloat(document.getElementById('pay-exchange-rate')?.value) || doc.frozenExchangeRate || 6.96;
    const { balanceBob, balanceUsd } = this.getDocumentNormalizedBalances(doc, isNd, tc);

    const amtInput = document.getElementById('pay-amount-input');
    if (amtInput) {
      if (curr === 'USD') {
        amtInput.value = balanceUsd.toFixed(2);
      } else {
        amtInput.value = balanceBob.toFixed(2);
      }
    }
    this.onModalPaymentAmountChange();
  },

  onModalPaymentAmountChange() {
    const data = window.db.get();
    const docType = document.getElementById('pay-doc-type')?.value;
    const docId = document.getElementById('pay-doc-id')?.value;
    const isNd = (docType === 'ND');
    const doc = isNd
      ? (data.debitNotes || []).find(n => n.id === docId)
      : (data.creditNotes || []).find(c => c.id === docId);
    if (!doc) return;

    const curr = document.getElementById('pay-currency')?.value || 'BOB';
    const tc = parseFloat(document.getElementById('pay-exchange-rate')?.value) || doc.frozenExchangeRate || 6.96;
    const { balanceBob, balanceUsd } = this.getDocumentNormalizedBalances(doc, isNd, tc);

    const amtVal = parseFloat(document.getElementById('pay-amount-input')?.value) || 0;

    let amtBob = 0;
    let amtUsd = 0;
    let counterPreview = '';

    if (curr === 'BOB') {
      amtBob = amtVal;
      amtUsd = tc > 0 ? (amtVal / tc) : 0;
      counterPreview = `≈ USD ${amtUsd.toFixed(2)} (T/C: ${tc.toFixed(2)})`;
    } else {
      amtUsd = amtVal;
      amtBob = amtVal * tc;
      counterPreview = `≈ BOB ${amtBob.toFixed(2)} (T/C: ${tc.toFixed(2)})`;
    }

    const counterEl = document.getElementById('pay-countervalue-preview');
    if (counterEl) counterEl.textContent = counterPreview;

    const remainingBob = Math.max(0, balanceBob - amtBob);
    const remainingUsd = Math.max(0, balanceUsd - amtUsd);
    const remEl = document.getElementById('pay-remaining-balance-preview');
    if (remEl) {
      if (remainingBob <= 0.01 || remainingUsd <= 0.01) {
        remEl.innerHTML = `<span style="color:#047857; font-weight:800;">${curr} 0.00 — LIQUIDACIÓN TOTAL (PAGADA)</span>`;
      } else {
        remEl.style.color = '#dc2626';
        if (curr === 'USD') {
          remEl.textContent = `USD ${remainingUsd.toFixed(2)} (≈ BOB ${remainingBob.toFixed(2)})`;
        } else {
          remEl.textContent = `BOB ${remainingBob.toFixed(2)} (≈ USD ${remainingUsd.toFixed(2)})`;
        }
      }
    }
  },

  processPaymentTransaction(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const data = window.db.get();
    const docType = document.getElementById('pay-doc-type').value;
    const docId = document.getElementById('pay-doc-id').value;
    const isNd = (docType === 'ND');

    const doc = isNd
      ? (data.debitNotes || []).find(n => n.id === docId)
      : (data.creditNotes || []).find(c => c.id === docId);

    if (!doc) {
      window.app.showToast('No se encontró el documento a procesar.', 'error');
      return;
    }

    const inputAmount = parseFloat(document.getElementById('pay-amount-input').value) || 0;
    if (inputAmount <= 0) {
      window.app.showToast('Ingrese un monto mayor a cero para amortizar.', 'warning');
      return;
    }

    const curr = document.getElementById('pay-currency').value || 'BOB';
    const tc = parseFloat(document.getElementById('pay-exchange-rate').value) || doc.frozenExchangeRate || 6.96;
    const payMethod = document.getElementById('pay-method-select').value || 'TRANSFERENCIA';
    const finAccountId = document.getElementById('pay-account-select').value || 'CAJA_GENERAL';
    const userNotes = (document.getElementById('pay-notes-input').value || '').trim();

    const { totalBob, totalUsd, balanceBob, balanceUsd } = this.getDocumentNormalizedBalances(doc, isNd, tc);

    let montoAbonadoBob = 0;
    let montoAbonadoUsd = 0;

    if (curr === 'BOB') {
      montoAbonadoBob = inputAmount;
      montoAbonadoUsd = tc > 0 ? (inputAmount / tc) : 0;
    } else {
      montoAbonadoUsd = inputAmount;
      montoAbonadoBob = inputAmount * tc;
    }

    // Validación según moneda de pago
    if (curr === 'USD') {
      if (inputAmount > (balanceUsd + 0.05)) {
        window.app.showToast(`El monto abonado (USD ${inputAmount.toFixed(2)}) no puede exceder el saldo pendiente (USD ${balanceUsd.toFixed(2)}).`, 'warning');
        return;
      }
    } else {
      if (inputAmount > (balanceBob + 0.05)) {
        window.app.showToast(`El monto abonado (BOB ${inputAmount.toFixed(2)}) no puede exceder el saldo pendiente (BOB ${balanceBob.toFixed(2)}).`, 'warning');
        return;
      }
    }

    // 1. CÁLCULO DE SALDOS Y AMORTIZACIONES
    const nuevoSaldoBob = Math.max(0, parseFloat((balanceBob - montoAbonadoBob).toFixed(2)));
    const nuevoSaldoUsd = Math.max(0, parseFloat((balanceUsd - montoAbonadoUsd).toFixed(2)));
    const isFullyPaid = (nuevoSaldoBob <= 0.01 || nuevoSaldoUsd <= 0.01);

    const prevPaidBob = Number(doc.paidAmountBob ?? (isNd ? (totalBob - balanceBob) : (doc.currency === 'USD' ? (doc.paidAmount * tc) : doc.paidAmount)) ?? 0);
    const prevPaidUsd = Number(doc.paidAmountUsd ?? (isNd ? (totalUsd - balanceUsd) : (doc.currency === 'USD' ? doc.paidAmount : (doc.paidAmount / tc))) ?? 0);

    const nuevoAcumuladoBob = parseFloat((prevPaidBob + montoAbonadoBob).toFixed(2));
    const nuevoAcumuladoUsd = parseFloat((prevPaidUsd + montoAbonadoUsd).toFixed(2));

    // ACTUALIZACIÓN DE SALDOS EN EL DOCUMENTO
    doc.balanceBob = isFullyPaid ? 0 : nuevoSaldoBob;
    doc.balanceUsd = isFullyPaid ? 0 : nuevoSaldoUsd;
    doc.paidAmountBob = isFullyPaid ? totalBob : nuevoAcumuladoBob;
    doc.paidAmountUsd = isFullyPaid ? totalUsd : nuevoAcumuladoUsd;

    const isDocUsd = (doc.currency === 'USD');
    doc.total_documento = isDocUsd ? totalUsd : totalBob;
    doc.saldo_pendiente = isDocUsd ? doc.balanceUsd : doc.balanceBob;
    doc.monto_acumulado_pagado = isDocUsd ? doc.paidAmountUsd : doc.paidAmountBob;

    if (!isNd) {
      doc.totalAmount = isDocUsd ? totalUsd : totalBob;
      doc.totalAmountBob = totalBob;
      doc.totalAmountUsd = totalUsd;
      doc.balance = isDocUsd ? doc.balanceUsd : doc.balanceBob;
      doc.paidAmount = isDocUsd ? doc.paidAmountUsd : doc.paidAmountBob;
    }

    // CONDICIÓN MATEMÁTICA ESTRICTA DE CANCELACIÓN Y GLOSA
    let nuevoEstado = 'IMPAGA';
    let reciboGlosa = '';

    if (isFullyPaid) {
      nuevoEstado = 'PAGADA';
      reciboGlosa = isNd ? 'Cobro total ND' : 'Pago total NC';
    } else if (nuevoAcumuladoBob > 0) {
      nuevoEstado = 'PENDIENTE';
      const saldoRemanenteMsg = curr === 'USD' ? `USD ${doc.balanceUsd.toFixed(2)}` : `BOB ${doc.balanceBob.toFixed(2)}`;
      reciboGlosa = isNd
        ? `Abono parcial ND (Saldo pendiente: ${saldoRemanenteMsg})`
        : `Abono parcial NC (Saldo pendiente: ${saldoRemanenteMsg})`;
    } else {
      nuevoEstado = 'IMPAGA';
      reciboGlosa = isNd ? 'Cobro ND' : 'Pago NC';
    }

    doc.estado = nuevoEstado;
    doc.status = nuevoEstado;

    // 2. GENERAR NÚMERO DE RECIBO CONSECUTIVO RCP-XXXXX
    let maxRcp = 2000;
    (data.cashReceipts || []).forEach(r => {
      const num = parseInt(r.receiptNumber || (r.receiptCode ? r.receiptCode.replace(/\D/g, '') : 0), 10);
      if (num > maxRcp) maxRcp = num;
    });
    (data.providerPayments || []).forEach(p => {
      const num = parseInt(p.receiptNumber || (p.receiptCode ? p.receiptCode.replace(/\D/g, '') : 0), 10);
      if (num > maxRcp) maxRcp = num;
    });
    const nextReceiptNum = maxRcp + 1;
    const receiptCode = `RCP-${String(nextReceiptNum).padStart(5, '0')}`;

    // 3. DETERMINAR SERVICIO ACTIVO Y GLOSA FINAL
    const rawActive = window.state?.servicioActivo || window.currentServiceCategory || window.operationsHubModule?.filterService || 'ALL';
    let serviceCategory = rawActive;
    if (serviceCategory === 'ALL' && doc.items && doc.items.length > 0) {
      serviceCategory = doc.items[0].serviceType || 'BOLETO_AEREO';
    } else if (serviceCategory === 'ALL' && doc.serviceType) {
      serviceCategory = doc.serviceType;
    }

    const docNumLabel = isNd ? `ND #${doc.ndNumber}` : `NC #${doc.ncNumber}`;
    const glosaFinal = userNotes ? `${userNotes} - ${reciboGlosa}` : reciboGlosa;

    const saldoPendiente = doc.saldo_pendiente;
    const totalDocumento = doc.total_documento;
    const montoAcumuladoPagado = doc.monto_acumulado_pagado;
    const saldoActualBob = balanceBob;

    // 4. INSERTAR RECIBO INDEPENDIENTE EN CAJA
    if (isNd) {
      const newReceipt = {
        id: 'RCP-' + Date.now(),
        receiptNumber: nextReceiptNum,
        receiptCode: receiptCode,
        receiptDate: new Date().toISOString().split('T')[0],
        tipo: 'ND',
        tipoTransaccion: 'RECIBO DE PAGO',
        subTipoTransaccion: isFullyPaid ? 'COBRO TOTAL ND' : 'ABONO PARCIAL ND',
        documentoOrigen: docNumLabel,
        debitNoteId: doc.id,
        debitNoteNumber: doc.ndNumber,
        accountId: doc.accountId,
        accountName: doc.accountName,
        serviceCategory: serviceCategory,
        serviceType: serviceCategory,
        monto_transaccion: parseFloat(montoAbonadoBob.toFixed(2)),
        monto_transaccion_usd: parseFloat(montoAbonadoUsd.toFixed(2)),
        totalPaidBob: parseFloat(montoAbonadoBob.toFixed(2)),
        totalPaidUsd: parseFloat(montoAbonadoUsd.toFixed(2)),
        total_documento: totalDocumento,
        saldo_pendiente: saldoPendiente,
        monto_acumulado_pagado: montoAcumuladoPagado,
        isPartial: (saldoPendiente > 0.005),
        exchangeRateUsed: tc,
        status: 'VALIDO',
        estado: nuevoEstado,
        glosa: glosaFinal,
        concept: glosaFinal,
        paymentMethod: payMethod,
        financialAccountId: finAccountId,
        cajero: data.currentUser?.name || 'Luis (Admin)',
        createdByName: data.currentUser?.name || 'Luis (Admin)',
        createdAt: new Date().toLocaleString(),
        details: [{
          debitNoteId: doc.id,
          ndNumber: doc.ndNumber,
          serviceType: serviceCategory,
          totalDocumento: totalDocumento,
          amountPaidBob: parseFloat(montoAbonadoBob.toFixed(2)),
          amountPaidUsd: parseFloat(montoAbonadoUsd.toFixed(2)),
          previousBalanceBob: saldoActualBob,
          remainingBalanceBob: saldoPendiente
        }],
        payments: [{
          paymentMethodName: payMethod,
          financialAccountId: finAccountId,
          financialAccountName: finAccountId,
          titularName: 'MARETRAVEL SRL',
          reference: userNotes || 'Pago en Caja',
          currency: curr,
          amount: inputAmount
        }]
      };
      if (!data.cashReceipts) data.cashReceipts = [];
      data.cashReceipts.unshift(newReceipt);
    } else {
      const newPayment = {
        id: 'PAY-' + Date.now(),
        receiptNumber: nextReceiptNum,
        receiptCode: receiptCode,
        paymentDate: new Date().toISOString().split('T')[0],
        tipo: 'NC',
        tipoTransaccion: 'PAGO A PROVEEDOR',
        subTipoTransaccion: isFullyPaid ? 'PAGO TOTAL NC' : 'ABONO PARCIAL NC',
        documentoOrigen: docNumLabel,
        creditNoteId: doc.id,
        creditNoteNumber: doc.ncNumber,
        providerId: doc.providerId,
        providerName: doc.providerName,
        serviceCategory: serviceCategory,
        serviceType: serviceCategory,
        monto_transaccion: parseFloat(montoAbonadoBob.toFixed(2)),
        monto_transaccion_usd: parseFloat(montoAbonadoUsd.toFixed(2)),
        totalPaid: parseFloat(montoAbonadoBob.toFixed(2)),
        totalPaidBob: parseFloat(montoAbonadoBob.toFixed(2)),
        totalPaidUsd: parseFloat(montoAbonadoUsd.toFixed(2)),
        total_documento: totalDocumento,
        saldo_pendiente: saldoPendiente,
        monto_acumulado_pagado: montoAcumuladoPagado,
        isPartial: !isFullyPaid,
        exchangeRateUsed: tc,
        status: 'VALIDO',
        estado: nuevoEstado,
        glosa: glosaFinal,
        concept: glosaFinal,
        paymentMethod: payMethod,
        financialAccountId: finAccountId,
        cajero: data.currentUser?.name || 'Luis (Admin)',
        createdByName: data.currentUser?.name || 'Luis (Admin)',
        createdAt: new Date().toLocaleString(),
        details: [{
          creditNoteId: doc.id,
          ncNumber: doc.ncNumber,
          serviceType: serviceCategory,
          totalDocumento: totalDocumento,
          amountPaid: parseFloat(montoAbonadoBob.toFixed(2)),
          amountPaidBob: parseFloat(montoAbonadoBob.toFixed(2)),
          amountPaidUsd: parseFloat(montoAbonadoUsd.toFixed(2)),
          previousBalanceBob: saldoActualBob,
          remainingBalanceBob: saldoPendiente
        }]
      };
      if (!data.providerPayments) data.providerPayments = [];
      data.providerPayments.unshift(newPayment);
    }

    window.db.save(data);
    window.app.closeModal('modal-payment-transaction');
    const remToastMsg = curr === 'USD' ? `USD ${nuevoSaldoUsd.toFixed(2)}` : `BOB ${nuevoSaldoBob.toFixed(2)}`;
    window.app.showToast(`¡Transacción ${receiptCode} registrada con éxito! Monto: ${curr} ${inputAmount.toFixed(2)}. Saldo restante: ${remToastMsg} (${doc.status})`, 'success');

    // 5. ACTUALIZAR VISTAS REACTIVAMENTE
    if (window.operationsHubModule) window.operationsHubModule.render();
    if (window.debitNotesModule) window.debitNotesModule.render();
    if (window.creditNotesModule) window.creditNotesModule.render();
    this.renderReceiptsHistory();
    if (window.app && window.app.updateDashboardKpis) window.app.updateDashboardKpis();
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

    // Listener delegado y reactivo del botón Imprimir en Caja
    this.bindPrintButtonListeners();
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
            ${nd.currency === 'USD'
              ? `USD ${Number(nd.totalAmountUsd !== undefined && nd.totalAmountUsd !== null ? nd.totalAmountUsd : ((nd.totalAmountBob || 0) / (nd.frozenExchangeRate || 6.96))).toFixed(2)}`
              : `BOB ${Number(nd.totalAmountBob || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`}
          </td>
          <td class="font-mono" style="text-align: right; color: #b91c1c; font-weight: 700;">
            ${nd.currency === 'USD'
              ? `USD ${Number(nd.balanceUsd !== undefined && nd.balanceUsd !== null ? nd.balanceUsd : ((nd.balanceBob || 0) / (nd.frozenExchangeRate || 6.96))).toFixed(2)}`
              : `BOB ${Number(nd.balanceBob || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`}
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
    const pendingNds = data.debitNotes.filter(n => n.accountId === clientId && (n.status === 'PENDIENTE' || n.status === 'IMPAGA' || n.status === 'PARCIAL' || n.status === 'CERRADA') && (Number(n.balanceBob || 0) > 0.01 || Number(n.balanceUsd || 0) > 0.01));

    if (pendingNds.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: #15803d; font-weight: 600;">Este cliente no tiene Notas de Débito pendientes de pago. ¡Al día!</td></tr>`;
      this.updateCobranzaSummary();
      return;
    }

    tbody.innerHTML = pendingNds.map(nd => {
      const isUsd = (nd.currency === 'USD');
      const totalDisplay = isUsd
        ? `USD ${Number(nd.totalAmountUsd !== undefined && nd.totalAmountUsd !== null ? nd.totalAmountUsd : ((nd.totalAmountBob || 0) / (nd.frozenExchangeRate || 6.96))).toFixed(2)}`
        : `BOB ${Number(nd.totalAmountBob || 0).toFixed(2)}`;
      const balNum = isUsd
        ? Number(nd.balanceUsd !== undefined && nd.balanceUsd !== null ? nd.balanceUsd : ((nd.balanceBob || 0) / (nd.frozenExchangeRate || 6.96)))
        : Number(nd.balanceBob || 0);
      const balDisplay = `${nd.currency || 'BOB'} ${balNum.toFixed(2)}`;

      return `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" class="nd-collect-check" value="${nd.id}" onchange="window.cashRegisterModule.onPaymentAmountChange()" checked style="width: 16px; height: 16px; cursor: pointer;">
        </td>
        <td class="font-mono" style="font-weight: 700; color: var(--navy);">ND #${nd.ndNumber}</td>
        <td class="font-mono">${nd.issueDate}</td>
        <td class="font-mono" style="text-align: right;">${totalDisplay}</td>
        <td class="font-mono" style="text-align: right; color: #b91c1c; font-weight: 700;" id="nd-bal-${nd.id}">
          ${balDisplay}
        </td>
        <td>
          <input type="number" step="0.01" min="0" max="${balNum.toFixed(2)}" class="form-control nd-amount-to-pay" data-nd-id="${nd.id}" data-max-balance="${balNum.toFixed(2)}" value="${balNum.toFixed(2)}" oninput="window.cashRegisterModule.onNdAmountChange(this)" style="width: 130px; text-align: right; font-weight: 700;">
        </td>
        <td><span class="badge ${nd.status === 'PARCIAL' ? 'badge-blue' : 'badge-amber'}">${nd.status}</span></td>
      </tr>
      `;
    }).join('');

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
      const totalDocBob = Number(item.nd.total_documento ?? item.nd.totalAmountBob ?? 0);
      const prevPaidBob = Number(item.nd.monto_acumulado_pagado ?? item.nd.paidAmountBob ?? 0);
      const newPaidBob = parseFloat((prevPaidBob + item.amountPaidBob).toFixed(2));
      const newSaldoBob = parseFloat(Math.max(0, totalDocBob - newPaidBob).toFixed(2));

      // Control transaccional de estados y saldos requerido
      item.nd.total_documento = totalDocBob;
      item.nd.monto_acumulado_pagado = newPaidBob;
      item.nd.saldo_pendiente = newSaldoBob;

      // Retrocompatibilidad con campos base
      item.nd.paidAmountBob = newPaidBob;
      item.nd.balanceBob = newSaldoBob;
      item.nd.paidAmountUsd = parseFloat(((item.nd.paidAmountUsd || 0) + item.amountPaidUsd).toFixed(2));
      item.nd.balanceUsd = parseFloat(Math.max(0, (item.nd.totalAmountUsd || 0) - item.nd.paidAmountUsd).toFixed(2));

      // Regla estricta de transición de estados:
      // 1. monto_acumulado_pagado === 0 => 'IMPAGA'
      // 2. monto_acumulado_pagado > 0 pero saldo_pendiente > 0 => 'PENDIENTE'
      // 3. saldo_pendiente === 0 => 'PAGADA'
      if (newPaidBob === 0) {
        item.nd.status = 'IMPAGA';
      } else if (newSaldoBob > 0.01) {
        item.nd.status = 'PENDIENTE';
      } else {
        item.nd.status = 'PAGADA';
        item.nd.saldo_pendiente = 0;
        item.nd.balanceBob = 0;
        item.nd.balanceUsd = 0;
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
      tipo: 'ND',
      tipoTransaccion: 'RECIBO DE PAGO',
      subTipoTransaccion: isPartial ? 'ABONO PARCIAL ND' : 'COBRO TOTAL ND',
      monto_transaccion: parseFloat(totalAmortizedBob.toFixed(2)),
      monto_transaccion_usd: parseFloat((totalAmortizedBob / sellRate).toFixed(2)),
      total_documento: parseFloat(totalSelectedBalanceBob.toFixed(2)),
      saldo_pendiente: parseFloat(remainingTotalBalance.toFixed(2)),
      estado: isPartial ? 'PENDIENTE' : 'PAGADA',
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

    // Registrar transacción INGRESO en la cuenta bancaria destino de cada forma de pago
    if (window.financialGuard && typeof window.financialGuard.recordTransaction === 'function') {
      try {
        (newReceipt.payments || []).forEach(p => {
          const accId = p.financialAccountId;
          if (accId && (data.bankAccounts || []).some(a => a.id === accId)) {
            window.financialGuard.recordTransaction(accId, {
              type: 'INGRESO',
              amount: p.amount || p.amountBob || 0,
              medio: p.paymentMethodCode || p.paymentMethodName || 'TRANSFERENCIA',
              reference: newReceipt.receiptCode,
              description: 'Cobranza a cliente'
            });
          }
        });
      } catch (err) {
        console.warn('financialGuard.recordTransaction (cobranza) falló:', err);
      }
    }

    if (isPartial) {
      window.app.showToast(`Recibo ${receiptCode} emitido con éxito. ¡Abono Parcial registrado! Saldo restante: BOB ${remainingTotalBalance.toFixed(2)}`, 'success');
    } else {
      window.app.showToast(`Recibo ${receiptCode} emitido con éxito. ¡Liquidación total al 100%!`, 'success');
    }

    // Recargar vista y abrir impresión del Recibo Oficial
    this.loadClientPendingNds(clientId);
    if (window.debitNotesModule) window.debitNotesModule.render();
    if (window.operationsHubModule) window.operationsHubModule.render();
    if (window.app && window.app.updateDashboardKpis) window.app.updateDashboardKpis();
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

      const totalDoc = Number(nc.total_documento ?? nc.totalAmount ?? 0);
      const prevPaid = Number(nc.monto_acumulado_pagado ?? nc.paidAmount ?? 0);
      const newPaid = parseFloat((prevPaid + amount).toFixed(2));
      const newSaldo = parseFloat(Math.max(0, totalDoc - newPaid).toFixed(2));

      // Control transaccional de estados y saldos requerido
      nc.total_documento = totalDoc;
      nc.monto_acumulado_pagado = newPaid;
      nc.saldo_pendiente = newSaldo;

      // Retrocompatibilidad con campos base
      nc.paidAmount = newPaid;
      nc.balance = newSaldo;

      // Regla estricta de transición de estados:
      // 1. monto_acumulado_pagado === 0 => 'IMPAGA'
      // 2. monto_acumulado_pagado > 0 pero saldo_pendiente > 0 => 'PENDIENTE'
      // 3. saldo_pendiente === 0 => 'PAGADA'
      if (newPaid === 0) {
        nc.status = 'IMPAGA';
      } else if (newSaldo > 0.01) {
        nc.status = 'PENDIENTE';
      } else {
        nc.status = 'PAGADA';
        nc.saldo_pendiente = 0;
        nc.balance = 0;
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

    // Registrar transacción EGRESO en la cuenta bancaria origen del pago
    if (window.financialGuard && typeof window.financialGuard.recordTransaction === 'function') {
      try {
        if (account.id && (data.bankAccounts || []).some(a => a.id === account.id)) {
          window.financialGuard.recordTransaction(account.id, {
            type: 'EGRESO',
            amount: receipt.totalPaid,
            medio: account.bankName || account.code || 'TRANSFERENCIA',
            reference: receipt.receiptCode,
            description: 'Pago a proveedor'
          });
        }
      } catch (err) {
        console.warn('financialGuard.recordTransaction (pago a proveedor) falló:', err);
      }
    }

    window.app.showToast(`Comprobante de Pago a Proveedor ${receiptCode} emitido exitosamente`, 'success');
    this.loadProviderPendingNcs(provId);
    if (window.creditNotesModule) window.creditNotesModule.render();
    if (window.operationsHubModule) window.operationsHubModule.render();
    if (window.app && window.app.updateDashboardKpis) window.app.updateDashboardKpis();
  },

  // ==========================================
  // SUB-MÓDULO: HISTORIAL DE RECIBOS Y REVERSIÓN
  // ==========================================

  // Helper para verificación y enlace contextual por servicio activo
  matchesServiceCategory(item, targetService) {
    if (!targetService || targetService === 'ALL') return true;
    const fs = String(targetService).toUpperCase();
    const data = window.db.get();

    const typeMatches = (str, customTarget = fs) => {
      if (!str) return false;
      const s = String(str).toUpperCase();
      const target = String(customTarget).toUpperCase();
      if (target === 'BOLETO_AEREO') {
        return s.includes('BOLETO') || s.includes('AEREO') || s.includes('AÉREO') || s.includes('GDS') || s.includes('VUELO') || s.includes('AVIACION') || s.includes('AVIACIÓN');
      }
      if (target === 'SEGURO_VIAJE') {
        return s.includes('SEGURO') || s.includes('ASISTENCIA');
      }
      if (target === 'CERTIFICACION_FA') {
        return s.includes('CERTIFIC') || s.includes('IFA') || /\bFA\b/.test(s);
      }
      if (target === 'ASESORAMIENTO_VISAS') {
        return s.includes('VISA');
      }
      if (target === 'PAQUETES' || target === 'PAQUETE_TURISTICO') {
        return s.includes('PAQUETE') || s.includes('CRUCERO') || s.includes('CONCIERTO');
      }
      if (target === 'HOTEL' || target === 'HOSPEDAJE') {
        return s.includes('HOTEL') || s.includes('HOSPEDAJE');
      }
      if (target === 'RENT_A_CAR' || target === 'TRASLADO') {
        return s.includes('RENT_A_CAR') || s.includes('RENT A CAR') || s.includes('RENTACAR') || s.includes('TRASLADO') || s.includes('TRANSFER') || s.includes('VEHICUL') || /\bAUTO\b/.test(s) || /\bAUTOS\b/.test(s) || /\bCAR\b/.test(s);
      }
      return s === target || s.includes(target);
    };

    const raw = item.raw || {};
    const linked = item.linkedDoc || raw;

    if (item.tipo === 'NC') {
      if (typeMatches(linked.serviceType) || typeMatches(linked.concept) || typeMatches(linked.providerName)) {
        return true;
      }
      const allKnown = ['BOLETO_AEREO', 'HOTEL', 'SEGURO_VIAJE', 'CERTIFICACION_FA', 'ASESORAMIENTO_VISAS', 'PAQUETES', 'RENT_A_CAR'];
      const otherMatched = allKnown.find(t => t !== fs && (typeMatches(linked.concept, t) || typeMatches(linked.providerName, t)));
      if (otherMatched) return false;

      if (linked.originDebitNoteId) {
        const originNd = (data.debitNotes || []).find(n => n.id === linked.originDebitNoteId || String(n.ndNumber) === String(linked.originDebitNoteNumber));
        if (originNd && originNd.items && originNd.items.some(it => typeMatches(it.serviceType) || typeMatches(it.tipo_servicio) || typeMatches(it.description))) {
          return true;
        }
      }
      return false;
    }

    // Para ND: Validar contra los ítems de la Nota de Débito vinculada real
    if (linked.items && linked.items.length > 0) {
      return linked.items.some(it => typeMatches(it.serviceType) || typeMatches(it.tipo_servicio) || typeMatches(it.description));
    }
    if (typeMatches(linked.serviceType) || typeMatches(linked.concept)) {
      return true;
    }

    if (raw.details && raw.details.length > 0) {
      return raw.details.some(d => {
        const nd = (data.debitNotes || []).find(n => n.id === d.debitNoteId || n.ndNumber === d.ndNumber);
        return nd && nd.items && nd.items.some(it => typeMatches(it.serviceType) || typeMatches(it.tipo_servicio) || typeMatches(it.description));
      });
    }

    return false;
  },

  // Vinculación reactiva y delegada del listener de impresión
  bindPrintButtonListeners() {
    if (this._printDelegationBound) return;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-imprimir, .btn-imprimir-recibo');
      if (!btn) return;
      const tableBody = btn.closest('#receipts-history-table-body');
      if (!tableBody) return;

      e.preventDefault();
      e.stopPropagation();
      const docId = btn.getAttribute('data-id') || btn.dataset.id;
      const docType = btn.getAttribute('data-type') || btn.dataset.type || 'ND';
      this.handlePrintOfficial(docId, docType);
    });
    this._printDelegationBound = true;
  },

  renderReceiptsHistory() {
    const data = window.db.get();
    const search = (document.getElementById('cash-receipts-search')?.value || '').toLowerCase().trim();
    const filter = this.printablesFilter || 'ALL';
    const activeService = window.state?.servicioActivo || window.currentServiceCategory || window.operationsHubModule?.filterService || 'ALL';

    const transaccionesCaja = [];

    // =========================================================================
    // 1. RECIBOS DE COBRANZA (ND)
    // REGLA DE INTEGRIDAD CONTABLE ESTRICTA: Un recibo de caja de ND ÚNICAMENTE
    // puede existir y mostrarse si corresponde a una Nota de Débito REAL que:
    // a) Exista activamente en data.debitNotes (no haya sido borrada ni sea huérfana).
    // b) No esté anulada (status !== 'ANULADA').
    // c) Esté pagada (status === 'PAGADA' o saldo_pendiente <= 0.01).
    // d) Pertenezca al servicio activo seleccionado.
    // =========================================================================
    (data.cashReceipts || []).forEach(r => {
      if (r.status === 'REVERTIDO' || r.status === 'ANULADO') return;

      // Localizar la ND vinculada
      let linkedNd = null;
      if (r.details && r.details.length > 0) {
        for (const d of r.details) {
          linkedNd = (data.debitNotes || []).find(n => n.id === d.debitNoteId || n.ndNumber === d.ndNumber);
          if (linkedNd) break;
        }
      }
      if (!linkedNd && (r.debitNoteId || r.debitNoteNumber)) {
        linkedNd = (data.debitNotes || []).find(n => n.id === r.debitNoteId || n.ndNumber === r.debitNoteNumber);
      }

      // SI NO EXISTE LA NOTA DE DÉBITO EN EL SISTEMA, EL RECIBO ES HUÉRFANO Y SE EXCLUYE
      if (!linkedNd) {
        return;
      }

      // Si la ND de origen fue anulada, invalidar recibo en la vista
      if (linkedNd.status === 'ANULADA' || linkedNd.estado === 'ANULADA') {
        return;
      }

      // Aislamiento contextual por servicio activo de la ND
      if (!this.matchesServiceCategory({ raw: r, linkedDoc: linkedNd, tipo: 'ND' }, activeService)) {
        return;
      }

      const isPartial = r.isPartial || (Number(r.saldo_pendiente ?? linkedNd.saldo_pendiente ?? linkedNd.balanceBob ?? 0) > 0.005);
      const saldoPend = Number(r.saldo_pendiente ?? linkedNd.saldo_pendiente ?? linkedNd.balanceBob ?? 0);
      const amtBob = Number(r.monto_transaccion ?? r.totalPaidBob ?? 0);
      const tc = Number(r.exchangeRateUsed || linkedNd.frozenExchangeRate || 6.96);

      transaccionesCaja.push({
        tipo: 'ND',
        id: r.id,
        number: r.receiptCode || ('RCP-' + String(r.receiptNumber).padStart(5, '0')),
        date: r.receiptDate || r.date || (r.createdAt ? r.createdAt.split(',')[0] : '-'),
        party: linkedNd.accountName || r.accountName || 'Cliente General',
        documentoOrigen: r.documentoOrigen || (linkedNd ? `ND #${linkedNd.ndNumber}` : ''),
        tipoTransaccion: 'RECIBO DE PAGO',
        isInitialDocument: false,
        servicio: r.serviceCategory || (linkedNd.items && linkedNd.items[0]?.serviceType) || 'GENERAL',
        serviceCategory: r.serviceCategory || (linkedNd.items && linkedNd.items[0]?.serviceType) || 'GENERAL',
        glosa: r.glosa || r.concept || '',
        amountBob: amtBob,
        amountUsd: Number(r.monto_transaccion_usd ?? r.totalPaidUsd ?? (tc > 0 ? amtBob / tc : 0)),
        estado: isPartial ? 'PENDIENTE' : 'PAGADA',
        status: 'VALIDO',
        saldo_pendiente: saldoPend,
        total_documento: Number(r.total_documento ?? linkedNd.total_documento ?? linkedNd.totalAmountBob ?? 0),
        isPartial: isPartial,
        user: r.createdByName || r.cajero || 'Luis (Admin)',
        reversalReason: r.reversalReason,
        raw: r,
        linkedDoc: linkedNd
      });
    });

    // =========================================================================
    // 2. DOCUMENTOS INICIALES: NOTAS DE DÉBITO (Todas las emisiones de servicios)
    // Aparecen de inmediato al emitir la ND, independientemente de si están impagas,
    // pendientes o pagadas.
    // =========================================================================
    (data.debitNotes || []).forEach(nd => {
      if (nd.status === 'ANULADA' || nd.estado === 'ANULADA') return;

      // Aislamiento contextual por servicio activo
      if (!this.matchesServiceCategory({ raw: nd, linkedDoc: nd, tipo: 'ND' }, activeService)) {
        return;
      }

      const balBob = Number(nd.saldo_pendiente ?? nd.balanceBob ?? nd.balance ?? 0);
      const paidBob = Number(nd.monto_acumulado_pagado ?? nd.paidAmountBob ?? 0);
      const totalBob = Number(nd.total_documento ?? nd.totalAmountBob ?? 0);
      const tc = Number(nd.frozenExchangeRate || nd.exchangeRateUsed || 6.96);
      const totalUsd = Number(nd.totalAmountUsd || (tc > 0 ? totalBob / tc : 0));

      const isFullyPaid = (balBob <= 0.01 && (paidBob > 0 || nd.status === 'PAGADA' || nd.estado === 'PAGADA'));
      const isPartial = !isFullyPaid && (paidBob > 0.01);
      const estadoDoc = isFullyPaid ? 'PAGADA' : (isPartial ? 'PENDIENTE' : 'IMPAGA');

      transaccionesCaja.push({
        tipo: 'ND',
        id: nd.id,
        number: 'ND #' + (nd.ndNumber || nd.id),
        date: nd.issueDate || (nd.createdAt ? nd.createdAt.split(',')[0] : '-'),
        party: nd.accountName || 'Cliente General',
        documentoOrigen: `ND #${nd.ndNumber || nd.id}`,
        tipoTransaccion: 'NOTA DE DÉBITO',
        isInitialDocument: true,
        servicio: (nd.items && nd.items[0]?.serviceType) || nd.serviceType || 'GENERAL',
        serviceCategory: (nd.items && nd.items[0]?.serviceType) || nd.serviceType || 'GENERAL',
        glosa: nd.observations || 'Emisión inicial del servicio',
        amountBob: totalBob,
        amountUsd: totalUsd,
        estado: estadoDoc,
        status: 'VALIDO',
        saldo_pendiente: balBob,
        total_documento: totalBob,
        isPartial: isPartial,
        user: nd.solicitante || nd.createdByName || 'Administrador',
        raw: nd,
        linkedDoc: nd
      });
    });

    // =========================================================================
    // 3. COMPROBANTES DE PAGO A PROVEEDORES (NC) - AMORTIZACIONES INDEPENDIENTES
    // =========================================================================
    (data.providerPayments || []).forEach(p => {
      if (p.status === 'REVERTIDO' || p.status === 'ANULADO') return;

      let linkedNc = null;
      if (p.details && p.details.length > 0) {
        for (const d of p.details) {
          linkedNc = (data.creditNotes || []).find(c => c.id === d.creditNoteId || c.ncNumber === d.ncNumber);
          if (linkedNc) break;
        }
      }
      if (!linkedNc && p.creditNoteId) {
        linkedNc = (data.creditNotes || []).find(c => c.id === p.creditNoteId || c.ncNumber === p.ncNumber);
      }
      if (!linkedNc && p.ncIds && p.ncIds.length > 0) {
        linkedNc = (data.creditNotes || []).find(c => p.ncIds.includes(c.id));
      }

      // Si no existe la NC en el sistema o está anulada, excluir
      if (!linkedNc || linkedNc.status === 'ANULADA' || linkedNc.estado === 'ANULADA') return;

      if (!this.matchesServiceCategory({ raw: p, linkedDoc: linkedNc, tipo: 'NC' }, activeService)) {
        return;
      }

      const isPartial = p.isPartial || (Number(p.saldo_pendiente ?? linkedNc.saldo_pendiente ?? linkedNc.balance ?? 0) > 0.005);
      const saldoPend = Number(p.saldo_pendiente ?? linkedNc.saldo_pendiente ?? linkedNc.balance ?? 0);
      const amtBob = Number(p.monto_transaccion ?? p.totalPaid ?? p.totalPaidBob ?? 0);
      const tc = Number(p.exchangeRateUsed || linkedNc.frozenExchangeRate || 6.96);

      transaccionesCaja.push({
        tipo: 'NC',
        id: p.id,
        number: p.receiptCode || ('RCP-' + String(p.receiptNumber).padStart(5, '0')),
        date: p.paymentDate || (p.createdAt ? p.createdAt.split(',')[0] : '-'),
        party: linkedNc.providerName || p.providerName || 'Proveedor',
        documentoOrigen: p.documentoOrigen || (linkedNc ? `NC #${linkedNc.ncNumber}` : ''),
        tipoTransaccion: 'PAGO A PROVEEDOR',
        isInitialDocument: false,
        servicio: p.serviceCategory || linkedNc.serviceCategory || 'GENERAL',
        serviceCategory: p.serviceCategory || linkedNc.serviceCategory || 'GENERAL',
        glosa: p.glosa || p.concept || '',
        amountBob: amtBob,
        amountUsd: Number(p.monto_transaccion_usd ?? p.totalPaidUsd ?? (tc > 0 ? amtBob / tc : 0)),
        estado: isPartial ? 'PENDIENTE' : 'PAGADA',
        status: 'VALIDO',
        saldo_pendiente: saldoPend,
        total_documento: Number(p.total_documento ?? linkedNc.total_documento ?? linkedNc.totalAmount ?? 0),
        isPartial: isPartial,
        user: p.createdByName || 'Administrador',
        reversalReason: p.reversalReason,
        raw: p,
        linkedDoc: linkedNc
      });
    });

    // =========================================================================
    // 4. DOCUMENTOS INICIALES: NOTAS DE CRÉDITO (Cuentas por Pagar iniciales)
    // =========================================================================
    (data.creditNotes || []).forEach(nc => {
      if (nc.status === 'ANULADA' || nc.estado === 'ANULADA') return;

      if (!this.matchesServiceCategory({ raw: nc, linkedDoc: nc, tipo: 'NC' }, activeService)) {
        return;
      }

      const bal = Number(nc.saldo_pendiente ?? nc.balance ?? nc.balanceBob ?? 0);
      const paid = Number(nc.monto_acumulado_pagado ?? nc.paidAmount ?? nc.paidAmountBob ?? 0);
      const tc = Number(nc.frozenExchangeRate || 6.96);
      const isDocUsd = (nc.currency === 'USD');
      const amtBob = Number(nc.totalAmountBob ?? nc.total_documento ?? (isDocUsd ? (nc.totalAmount * tc) : (nc.totalAmount || 0)));
      const amtUsd = Number(nc.totalAmountUsd ?? (tc > 0 ? amtBob / tc : 0));

      const isFullyPaid = (bal <= 0.01 && (paid > 0 || nc.status === 'PAGADA' || nc.estado === 'PAGADA'));
      const isPartial = !isFullyPaid && (paid > 0.01);
      const estadoDoc = isFullyPaid ? 'PAGADA' : (isPartial ? 'PENDIENTE' : 'IMPAGA');

      transaccionesCaja.push({
        tipo: 'NC',
        id: nc.id,
        number: 'NC #' + (nc.ncNumber || nc.id),
        date: nc.issueDate || (nc.createdAt ? nc.createdAt.split(',')[0] : '-'),
        party: nc.providerName || 'Proveedor',
        documentoOrigen: `NC #${nc.ncNumber || nc.id}`,
        tipoTransaccion: 'NOTA DE CRÉDITO',
        isInitialDocument: true,
        servicio: nc.serviceCategory || 'GENERAL',
        serviceCategory: nc.serviceCategory || 'GENERAL',
        glosa: nc.concept || 'Registro inicial a proveedor',
        amountBob: amtBob,
        amountUsd: amtUsd,
        estado: estadoDoc,
        status: 'VALIDO',
        saldo_pendiente: bal,
        total_documento: amtBob,
        isPartial: isPartial,
        user: nc.createdByName || 'Administrador',
        raw: nc,
        linkedDoc: nc
      });
    });

    // =========================================================================
    // FILTRADO ESTRICTO EN CAJA - COBRANZAS:
    // 1. Aislamiento contextual por Servicio Activo.
    // 2. Criterio de Inclusión: Comprobantes de caja emitidos y documentos iniciales.
    // 3. Exclusión automática de transacciones anuladas o revertidas.
    // 4. Sub-filtro horizontal: "Todos", "Recibos (ND)", "Pagos (NC)".
    // =========================================================================
    const imprimiblesCaja = transaccionesCaja.filter(item => {
      // A. Aislamiento estricto por Servicio Activo en foco
      if (!this.matchesServiceCategory(item, activeService)) {
        return false;
      }

      // B. Sub-pestañas: Todos, Recibos (ND), Pagos (NC)
      if (filter === 'ND' && item.tipo !== 'ND') return false;
      if (filter === 'NC' && item.tipo !== 'NC') return false;

      // C. Exclusión de transacciones anuladas o revertidas
      if (item.reversalReason || item.status === 'REVERTIDO' || item.status === 'ANULADA' || item.estado === 'ANULADA') {
        return false;
      }

      return true;
    });

    // Filtrar por búsqueda
    let filtered = imprimiblesCaja;
    if (search) {
      filtered = filtered.filter(it =>
        it.number.toLowerCase().includes(search) ||
        it.party.toLowerCase().includes(search) ||
        (it.documentoOrigen && it.documentoOrigen.toLowerCase().includes(search)) ||
        (it.glosa && it.glosa.toLowerCase().includes(search)) ||
        (it.user && it.user.toLowerCase().includes(search))
      );
    }

    // Ordenar cronológicamente descendente
    filtered.sort((a, b) => (b.raw.createdAt || b.raw.issueDate || b.raw.date || b.raw.id || '').localeCompare(a.raw.createdAt || a.raw.issueDate || a.raw.date || a.raw.id || ''));

    const tbody = document.getElementById('receipts-history-table-body');
    if (!tbody) return;

    if (filtered.length === 0) {
      const srvName = (window.operationsHubModule && typeof window.operationsHubModule.formatServiceName === 'function' && activeService !== 'ALL')
        ? window.operationsHubModule.formatServiceName(activeService)
        : (activeService !== 'ALL' ? activeService : 'este servicio');

      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; padding: 36px 20px; color: #64748b;">
            <i data-lucide="inbox" style="width: 36px; height: 36px; display: block; margin: 0 auto 8px; color: #94a3b8;"></i>
            Sin comprobantes de caja para el servicio <strong>${srvName}</strong>.
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = filtered.map(it => {
      const isNd = it.tipo === 'ND';
      const isInitial = Boolean(it.isInitialDocument);

      const typeBadge = isInitial
        ? (isNd 
            ? `<span class="badge badge-emerald" style="font-weight:700;"><i data-lucide="file-text" style="width:13px;height:13px;"></i> NOTA DE DÉBITO</span>`
            : `<span class="badge badge-amber" style="font-weight:700; color:#78350f; background:#fef08a; border-color:#fde047;"><i data-lucide="file-text" style="width:13px;height:13px;"></i> NOTA DE CRÉDITO</span>`)
        : (isNd
            ? `<span class="badge" style="font-weight:700; background:#e0f2fe; color:#0369a1; border-color:#bae6fd;"><i data-lucide="receipt" style="width:13px;height:13px;"></i> RECIBO DE PAGO</span>`
            : `<span class="badge" style="font-weight:700; background:#fef3c7; color:#92400e; border-color:#fcd34d;"><i data-lucide="arrow-up-right" style="width:13px;height:13px;"></i> PAGO A PROVEEDOR</span>`);

      const statusBadge = window.cashRegisterModule.renderStatusBadge(
        it.estado,
        isInitial ? (it.total_documento - it.saldo_pendiente) : it.amountBob,
        it.saldo_pendiente
      );

      return `
        <tr>
          <td>${typeBadge}</td>
          <td>
            <div class="font-mono" style="font-weight: 700; color: #0f172a;">${it.number}</div>
            ${it.documentoOrigen ? `<div class="font-mono" style="font-size: 0.72rem; color: #0284c7; font-weight: 600;">${it.documentoOrigen}</div>` : ''}
          </td>
          <td class="font-mono" style="font-size: 0.82rem;">${it.date}</td>
          <td>
            <div style="font-weight: 600; color: #1e293b;">${it.party}</div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px; flex-wrap: wrap;">
              <span class="badge badge-slate" style="font-size: 0.7rem;">${window.operationsHubModule && typeof window.operationsHubModule.formatServiceName === 'function' ? window.operationsHubModule.formatServiceName(it.servicio || it.serviceCategory || '') : (it.servicio || 'Servicio')}</span>
              ${it.glosa ? `<span style="font-size: 0.74rem; color: #64748b; font-style: italic;">${it.glosa}</span>` : ''}
            </div>
          </td>
          <td class="font-mono" style="text-align: right; font-weight: 700; color: ${isNd ? '#15803d' : '#b45309'};">
            BOB ${it.amountBob.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td class="font-mono" style="text-align: right; color: #0369a1;">
            USD ${it.amountUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td style="text-align: center;">${statusBadge}</td>
          <td style="font-size: 0.8rem; color: #475569;">${it.user}</td>
          <td style="text-align: center;">
            <div style="display: inline-flex; align-items: center; gap: 6px; justify-content: center;">
              <button type="button" class="btn btn-secondary btn-sm btn-imprimir btn-imprimir-recibo" data-id="${it.id}" data-type="${it.tipo}" onclick="window.cashRegisterModule.handlePrintOfficial('${it.id}', '${it.tipo}')" title="Imprimir Comprobante Oficial" style="padding: 4px 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                <i data-lucide="printer" style="width:14px;height:14px;"></i> Imprimir
              </button>
              ${(isNd && it.raw && it.raw.receiptNumber && it.raw.status === 'VALIDO') ? `
                <button type="button" class="btn btn-danger btn-sm" onclick="window.cashRegisterModule.openReversalModal('${it.id}')" title="Revertir Recibo" style="padding: 4px 8px;">
                  <i data-lucide="rotate-ccw" style="width:14px;height:14px;"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
    this.bindPrintButtonListeners();
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
        const totalDocBob = Number(nd.total_documento ?? nd.totalAmountBob ?? 0);
        const prevPaidBob = Number(nd.monto_acumulado_pagado ?? nd.paidAmountBob ?? 0);
        const newPaidBob = Math.max(0, prevPaidBob - item.amountPaidBob);
        const newSaldoBob = Math.max(0, totalDocBob - newPaidBob);

        nd.total_documento = totalDocBob;
        nd.monto_acumulado_pagado = parseFloat(newPaidBob.toFixed(2));
        nd.saldo_pendiente = parseFloat(newSaldoBob.toFixed(2));

        nd.paidAmountBob = parseFloat(newPaidBob.toFixed(2));
        nd.paidAmountUsd = Math.max(0, (nd.paidAmountUsd || 0) - item.amountPaidUsd);
        nd.balanceBob = item.previousBalanceBob;
        nd.balanceUsd = item.previousBalanceUsd;

        if (newPaidBob === 0) {
          nd.status = 'IMPAGA';
        } else if (newSaldoBob > 0.01) {
          nd.status = 'PENDIENTE';
        } else {
          nd.status = 'PAGADA';
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
    if (window.operationsHubModule) window.operationsHubModule.render();
    if (window.app && window.app.updateDashboardKpis) window.app.updateDashboardKpis();
  },

  /**
   * Manejador centralizado y reactivo de impresión de comprobantes oficiales desde Caja
   */
  handlePrintOfficial(docId, docType = 'ND') {
    const data = window.db.get();

    // 1. Obtención sincronizada en tiempo real para reflejar cualquier edición previa
    let nd = (data.debitNotes || []).find(n => n.id === docId || ('ND #' + n.ndNumber) === docId || n.ndNumber == docId);
    let nc = (data.creditNotes || []).find(c => c.id === docId || ('NC #' + c.ncNumber) === docId || c.ncNumber == docId);
    let receipt = (data.cashReceipts || []).find(r => r.id === docId || r.receiptCode === docId);
    let payment = (data.providerPayments || []).find(p => p.id === docId || p.receiptCode === docId);

    // Si es recibo de caja, vincular a la ND originaria para renderizar la plantilla corporativa oficial completa
    if (receipt && !nd) {
      if (receipt.details && receipt.details.length > 0) {
        const d = receipt.details[0];
        nd = (data.debitNotes || []).find(n => n.id === d.debitNoteId || n.ndNumber === d.ndNumber);
      }
      if (!nd && (receipt.debitNoteId || receipt.debitNoteNumber)) {
        nd = (data.debitNotes || []).find(n => n.id === receipt.debitNoteId || n.ndNumber === receipt.debitNoteNumber);
      }
      if (!nd && receipt.accountId) {
        nd = (data.debitNotes || []).find(n => n.accountId === receipt.accountId);
      }
    }

    // Si es pago a proveedor, vincular a la NC originaria
    if (payment && !nc) {
      if (payment.details && payment.details.length > 0) {
        const d = payment.details[0];
        nc = (data.creditNotes || []).find(c => c.id === d.creditNoteId || c.ncNumber === d.ncNumber);
      }
      if (!nc && (payment.creditNoteId || payment.creditNoteNumber)) {
        nc = (data.creditNotes || []).find(c => c.id === payment.creditNoteId || c.ncNumber === payment.creditNoteNumber);
      }
      if (!nc && payment.providerId) {
        nc = (data.creditNotes || []).find(c => c.providerId === payment.providerId);
      }
    }

    // 2. Impresión Oficial con la plantilla corporativa MARETRAVEL SRL
    if (nd) {
      if (window.debitNotesModule && typeof window.debitNotesModule.directPrint === 'function') {
        window.debitNotesModule.directPrint(nd.id, 'ND', receipt);
        return;
      }
    }

    if (nc) {
      if (window.debitNotesModule && typeof window.debitNotesModule.directPrint === 'function') {
        window.debitNotesModule.directPrint(nc.id, 'NC', payment);
        return;
      }
      if (window.creditNotesModule && typeof window.creditNotesModule.directPrint === 'function') {
        window.creditNotesModule.directPrint(nc.id, payment);
        return;
      }
    }

    // 3. Fallbacks de impresión
    if (receipt) {
      this.printReceipt(receipt.id);
      return;
    }
    if (payment) {
      this.printProviderPayment(payment.id);
      return;
    }
  },

  printVoucherND(docOrReceiptId) {
    return this.handlePrintOfficial(docOrReceiptId, 'ND');
  },

  printVoucherNC(docOrPaymentId) {
    return this.handlePrintOfficial(docOrPaymentId, 'NC');
  },

  /**
   * Impresión del Recibo Oficial de Caja con Logotipo y Membrete MARETRAVEL
   */
  printReceipt(receiptId) {
    const data = window.db.get();
    let r = (data.cashReceipts || []).find(x => x.id === receiptId || x.receiptCode === receiptId);
    if (!r) {
      const nd = (data.debitNotes || []).find(x => x.id === receiptId || ('ND #' + x.ndNumber) === receiptId);
      if (nd) {
        const linkedReceipt = (data.cashReceipts || []).find(rc => rc.accountId === nd.accountId && rc.status === 'VALIDO');
        if (linkedReceipt) {
          r = linkedReceipt;
        } else if (window.debitNotesModule && typeof window.debitNotesModule.printVoucher === 'function') {
          return window.debitNotesModule.printVoucher(nd.id, 'ND');
        }
      }
    }
    if (!r) return;

    const settings = data.systemSettings;
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    printArea.innerHTML = `
      <div class="print-page short-format" style="max-width: 170mm;">
        <!-- Membrete Oficial MARETRAVEL -->
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
          <h2>RECIBO DE PAGO</h2>
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

  /**
   * Impresión Oficial de Comprobante de Pago / Liquidación a Proveedor (NC)
   */
  printProviderPayment(paymentId) {
    const data = window.db.get();
    let p = (data.providerPayments || []).find(x => x.id === paymentId || x.receiptCode === paymentId);
    if (!p) {
      const nc = (data.creditNotes || []).find(x => x.id === paymentId || ('NC #' + x.ncNumber) === paymentId);
      if (nc) {
        if (window.creditNotesModule && typeof window.creditNotesModule.printVoucher === 'function') {
          return window.creditNotesModule.printVoucher(nc.id);
        }
      }
      return;
    }

    const settings = data.systemSettings || {};
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    const tc = Number(p.exchangeRateUsed || 6.96);
    const totalUsd = Number(p.totalPaid) / tc;

    printArea.innerHTML = `
      <div class="print-page short-format" style="max-width: 170mm;">
        <!-- Membrete Oficial MARETRAVEL -->
        <div class="print-header">
          <img src="${window.maretravelLogoBase64 || (settings && settings.logoBase64) || 'assets/logo.png'}" class="print-logo" alt="MARETRAVEL Logo">
          <div class="print-agency-info">
            <div class="print-agency-title">${settings.agencyCommercialName || 'MARETRAVEL S.R.L.'}</div>
            <div>NIT: ${settings.agencyNit || '1028374021'}</div>
            <div>${settings.agencyAddress || 'La Paz - Bolivia'}</div>
            <div>Telf: ${settings.agencyPhone || '+591 2 244-1234'}</div>
          </div>
        </div>

        <div class="print-doc-title">
          <h2>PAGO A PROVEEDOR</h2>
          <div class="print-doc-number">${p.receiptCode || ('OP-' + String(p.receiptNumber).padStart(5, '0'))}</div>
          ${p.status === 'REVERTIDO' ? '<div style="color:red; font-weight:800; font-size:12pt; margin-top:4px;">*** ANULADO / REVERTIDO ***</div>' : ''}
        </div>

        <!-- Datos del Proveedor y Liquidación -->
        <div class="print-meta-grid">
          <div><strong>Proveedor / Beneficiario:</strong> ${p.providerName}</div>
          <div><strong>Fecha / Hora:</strong> ${p.paymentDate}</div>
          <div><strong>Cuenta Financiera:</strong> ${p.financialAccountName || 'Caja Central'}</div>
          <div><strong>Cajero / Emisor:</strong> ${p.createdByName || 'Administrador'}</div>
          <div><strong>T/C Aplicado:</strong> 1 USD = ${tc.toFixed(2)} BOB</div>
          <div><strong>Referencia Operativa:</strong> ${p.reference || '-'}</div>
        </div>

        <!-- Detalle de Notas de Crédito Liquidadas -->
        <div style="font-size: 8.5pt; font-weight: 700; margin-bottom: 4px; text-transform: uppercase; color: #0f2742;">
          Notas de Crédito (NC) Liquidadas:
        </div>
        <table class="print-table">
          <thead>
            <tr>
              <th>Documento</th>
              <th style="text-align: right;">Saldo Ant. (BOB)</th>
              <th style="text-align: right;">Monto Liquidado (BOB)</th>
              <th style="text-align: right;">Saldo Rest. (BOB)</th>
            </tr>
          </thead>
          <tbody>
            ${(p.details || []).map(d => `
              <tr>
                <td class="font-mono"><strong>NC #${d.ncNumber || d.creditNoteId}</strong></td>
                <td class="font-mono" style="text-align: right;">${Number(d.previousBalance || 0).toFixed(2)}</td>
                <td class="font-mono" style="text-align: right; font-weight: 700; color: #b45309;">${Number(d.amountPaid || 0).toFixed(2)}</td>
                <td class="font-mono" style="text-align: right; color: #059669;">${Number(d.remainingBalance || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Totales -->
        <table class="print-totals" style="width: 100%; margin-top: 8px;">
          <tr class="total-row">
            <td style="font-size: 11pt;">TOTAL LIQUIDADO / EGRESO (BOB):</td>
            <td class="font-mono" style="text-align: right; font-size: 12pt; font-weight: 800; color: #b45309;">
              BOB ${Number(p.totalPaid).toFixed(2)}
            </td>
          </tr>
          <tr>
            <td style="font-size: 9.5pt; color: #475569;">Equivalente en Dólares (USD):</td>
            <td class="font-mono" style="text-align: right; font-size: 10pt; font-weight: 700; color: #0369a1;">
              USD ${totalUsd.toFixed(2)}
            </td>
          </tr>
        </table>

        <div class="print-signatures" style="margin-top: 25px;">
          <div class="signature-box">
            <strong>CAJERO / RESPONSABLE</strong><br>
            ${p.createdByName || 'Administrador'}<br>
            MARETRAVEL
          </div>
          <div class="signature-box">
            <strong>PROVEEDOR / BENEFICIARIO</strong><br>
            ${p.providerName}<br>
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
        <div class="print-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #00aeef; padding-bottom: 12px; margin-bottom: 16px;">
          <img src="${window.maretravelLogoBase64 || (settings && settings.logoBase64) || 'assets/logo.png'}" class="print-logo" alt="MARETRAVEL Logo">
          <div style="text-align: right;">
            <div class="print-agency-title" style="font-size: 1.05rem; font-weight: 800; color: #0f2742;">${settings.agencyCommercialName || settings.agencyName || 'MARETRAVEL S.R.L.'}</div>
            <div style="font-size: 0.8rem; color: #334155;">NIT: ${settings.agencyNit || '1028374021'} | Telf: ${settings.agencyPhone || '+591 2 244-1234'}</div>
            <div style="font-size: 0.78rem; color: #475569;">${settings.agencyAddress || 'La Paz - Bolivia'}</div>
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
