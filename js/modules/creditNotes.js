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
      // Sin 'AUTO': "AUTOMATICA" (de "Liquidación automática") lo contiene, y como TODA NC
      // dice eso, la regla metía las 10 NCs en RENT_A_CAR.
      if (srv === 'RENT_A_CAR' && (v.includes('RENT') || v.includes('CAR') || v.includes('TRASLADO'))) return true;
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
    if (nc.originDebitNoteId || nc.originDebitNoteNumber || nc.originDebitNoteCode) {
      const originNd = (allDebitNotes || []).find(nd => 
        (nc.originDebitNoteId && nd.id === nc.originDebitNoteId) ||
        (nc.originDebitNoteCode && nd.ndCode === nc.originDebitNoteCode) ||
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
                          (nc.ncCode && String(nc.ncCode).toLowerCase().includes(search)) ||
                          (nc.providerName && nc.providerName.toLowerCase().includes(search)) ||
                          (nc.concept && nc.concept.toLowerCase().includes(search)) ||
                          (nc.originDebitNoteCode && nc.originDebitNoteCode.toLowerCase().includes(search)) ||
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

      // Codigo visible de la ND a la que hace referencia (#ndBA001). refNd() ignora el
      // placeholder "ND #1007" que dejaron NCs viejas y resuelve contra la ND real.
      const ref = window.maretravelCodes.refNd({ debitNotes }, nc);
      // El concepto automatico se escribio con "ND #<nro>"; se muestra con el codigo visible.
      const concepto = window.maretravelCodes.conceptoConCodigo(nc.concept, ref);
      const originBadge = (nc.originDebitNoteId || nc.originDebitNoteNumber) ?
        `<span class="badge badge-indigo" title="Generada automáticamente al emitir la ND ${ref}">Auto ND (${ref})</span>` :
        `<span class="badge badge-slate" title="Creada a mano, sin nota de débito de origen">Manual</span>`;

      return `
        <tr>
          <td class="font-mono" style="font-weight: 700; color: var(--navy);">${nc.ncCode || ('NC #' + nc.ncNumber)}</td>
          <td class="font-mono">${nc.issueDate}</td>
          <td>
            <div style="font-weight: 600;">${nc.providerName}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${concepto}</div>
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
              ${nc.status === 'ANULADA' ? `
                <button class="btn btn-secondary btn-sm" onclick="window.creditNotesModule.reabrirNc('${nc.id}')" title="Reabrir NC (revierte la anulación)">
                  <i data-lucide="unlock"></i> Reabrir
                </button>
              ` : ''}
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
    const dl = document.getElementById('datalist-acc-pagar');
    if (dl) {
      dl.innerHTML = providers.map(p => `<option value="${(p.name || '').replace(/"/g, '&quot;')}">${(p.code || '')}${p.nit ? ' · NIT ' + p.nit : ''}</option>`).join('');
    }

    const actCat = window.state?.servicioActivo || window.currentServiceCategory || window.operationsHubModule?.filterService || 'BOLETO_AEREO';
    const srvCat = actCat === 'PAQUETES' ? 'PAQUETE_TURISTICO' : (actCat === 'HOTEL' ? 'HOTEL_HOSPEDAJE' : (actCat === 'RENT_A_CAR' ? 'TRASLADO' : actCat));
    // El codigo que se muestra es el que se guardara: se pide a la base, no al navegador.
    const display = document.getElementById('nc-number-display');
    window.maretravelCodes.nextForServidor(data.creditNotes, 'NC', srvCat).then(c => { if (display) display.textContent = c; });
    document.getElementById('nc-issue-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('nc-currency').value = 'BOB';

    window.app.openModal('modal-nc-manual');
  },

  async handleSaveManualNc(e) {
    e.preventDefault();
    const data = window.db.get();
    const providerId = document.getElementById('nc-provider-id').value;
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

    const nextNc = await window.db.numeroSiguiente('NC', 2001); // lo decide la base (nc_number es UNIQUE)
    const activeCat = window.state?.servicioActivo || window.currentServiceCategory || window.operationsHubModule?.filterService || 'BOLETO_AEREO';
    const srvCat = activeCat === 'PAQUETES' ? 'PAQUETE_TURISTICO' : (activeCat === 'HOTEL' ? 'HOTEL_HOSPEDAJE' : (activeCat === 'RENT_A_CAR' ? 'TRASLADO' : activeCat));
    const ncCode = await window.maretravelCodes.nextForServidor(data.creditNotes, 'NC', srvCat);
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
   * Cuentas por Pagar (NCs) de una ND: UNA por PROVEEDOR, por el COSTO BRUTO que el proveedor
   * cobra (no el neto, no la comisión). Si la nota ya tiene una NC de ese proveedor se actualiza
   * en el sitio, conservando lo pagado; si no tiene ninguna, se emite una con el correlativo que
   * da la base. La usan el HUB (Guardar y Emitir, nueva o editada) y el Cierre de ND: por eso
   * editar o re-guardar una nota igual deja su Cuenta por Pagar. Devuelve cuántas NCs tiene la nota.
   */
  async generarCuentasPorPagar(data, nd, items, sellRate) {
    const grupos = {};
    (items || []).forEach(item => {
      const pId = item.operatorId || item.providerId;
      if (!pId) return;
      const esUsd = (item.currency === 'USD');
      if (!grupos[pId]) {
        grupos[pId] = { providerId: pId, providerName: item.operatorName || item.providerName || '', items: [], hayUsd: false, brutoBob: 0, brutoUsd: 0 };
      }
      const g = grupos[pId];
      g.hayUsd = g.hayUsd || esUsd;
      g.items.push(item);
      // Costo del proveedor cuando el servicio lo carga. Si el servicio NO lo carga (visas,
      // hotel, paquete...) se usa el total del item MENOS el fee: asi TODOS los servicios con
      // proveedor dejan su Cuenta por Pagar en vez de evaporarse en el `continue` de mas abajo,
      // pero una operacion 100% fee no inventa una deuda. El fee es margen de la agencia:
      // no se le debe a nadie, asi que nunca puede ser el monto de la Cuenta por Pagar.
      const bruto = esUsd
        ? (item.grossCost || item.fareAmount || 0)
        : (item.grossCostBob || item.grossCost || item.fareAmountBob || item.fareAmount || 0);
      if (!bruto) g.sinCostoBruto = true;
      if (esUsd) g.brutoUsd += (bruto || Math.max(0, (item.totalAmountUsd || item.totalAmount || 0) - (item.feeAmountUsd || item.feeAmount || 0)));
      else g.brutoBob += (bruto || Math.max(0, (item.totalAmountBob || item.totalAmount || 0) - (item.feeAmountBob || item.feeAmount || 0)));
    });

    let ncDeLaNota = 0;
    const sinMonto = [];
    for (const g of Object.values(grupos)) {
      // la NC va en la moneda del grupo (USD si algún servicio fue en dólares) y se trae lo
      // del otro lado al tipo de cambio congelado de la nota
      const ncCurrency = g.hayUsd ? 'USD' : 'BOB';
      const total = parseFloat((ncCurrency === 'USD'
        ? (g.brutoUsd + (g.brutoBob / sellRate))
        : (g.brutoBob + (g.brutoUsd * sellRate))).toFixed(2));
      // Nada se pierde en silencio: un proveedor al que habria que deberle y cuyo servicio no
      // trae ningun monto se avisa en vez de desaparecer.
      if (total <= 0) { sinMonto.push(g.providerName || g.providerId); continue; }
      const prov = (data.accounts || []).find(a => a.id === g.providerId) || {};
      const srv = g.items[0]?.serviceType || nd.serviceType || nd.serviceCategory || window.state?.servicioActivo || 'OTRO';

      // Codigo visible de la ND origen (ej: #ndBA001) para mostrar en la NC. showDoc devuelve
      // "ND #<nro>" cuando la ND todavia no tiene codigo, y ese placeholder quedaba guardado en
      // la NC como si fuera el codigo (era lo que salia en listados e impresiones). Sin codigo
      // real se deja null: refNd() lo resuelve contra la ND al mostrar, y la NC ya nace limpia.
      const shown = String(nd.ndCode || (window.maretravelCodes && typeof window.maretravelCodes.showDoc === 'function' ? window.maretravelCodes.showDoc(nd, 'ND') : ''));
      const originCode = shown.startsWith('#') ? shown : null;

      // Numeración espejo 1 a 1: la NC toma el mismo correlativo de la ND (#ndBA001 -> #ncBA001)
      let mirrorNcCode = null;
      if (originCode && originCode.startsWith('#')) {
        const baseMirror = originCode.replace(/^#nd/i, '#nc');
        mirrorNcCode = (ncDeLaNota === 0) ? baseMirror : `${baseMirror}-${ncDeLaNota + 1}`;
      }

      // Una NC ANULADA es historia: no se toca ni se reutiliza. Si el proveedor ya tiene una NC
      // vigente se actualiza en el sitio (conservando lo pagado); si no, se emite una nueva.
      // Asi, anular una NC y volver a guardar la ND deja la Cuenta por Pagar corregida y
      // disponible para imprimir.
      const yaExiste = (data.creditNotes || []).find(nc => !nc.deleted &&
        nc.status !== 'ANULADA' && nc.estado !== 'ANULADA' &&
        (nc.originDebitNoteId === nd.id || (originCode && nc.originDebitNoteCode === originCode) || nc.originDebitNoteNumber === nd.ndNumber) &&
        (nc.providerId || nc.accountId) === g.providerId);
      const ncId = yaExiste ? yaExiste.id : 'NC-' + Date.now() + '-' + ncDeLaNota;

      const campos = {
        providerId: g.providerId,
        providerName: g.providerName || prov.name || '',
        providerNit: prov.docNumber || prov.nit || '',
        originDebitNoteId: nd.id,
        originDebitNoteNumber: nd.ndNumber,
        originDebitNoteCode: originCode,
        issueDate: nd.issueDate,
        // El concepto se escribe con el código si ya existe; si no, con el número, que las
        // pantallas reemplazan por el código al mostrar (mismo regex que usa la lista de NCs).
        concept: `Liquidación automática por ${originCode || ('ND #' + nd.ndNumber)} (Servicios: ${g.items.map(i => i.serviceType).filter(Boolean).join(', ')}) [${g.sinCostoBruto ? 'Total del servicio: el item no trae costo de proveedor' : 'Costo bruto del proveedor'}]`,
        currency: ncCurrency,
        frozenExchangeRate: sellRate,
        settlementModel: 'CONSOLIDADOR_BRUTO',
        totalAmount: total,
        totalAmountBob: parseFloat((ncCurrency === 'USD' ? total * sellRate : total).toFixed(2)),
        totalAmountUsd: parseFloat((ncCurrency === 'USD' ? total : total / sellRate).toFixed(2)),
        total_documento: total,
        serviceCategory: srv,
        serviceType: srv,
        servicio_tipo: srv,
        // Las filas de la NC son suyas: si copiaran el id del item de la ND, una segunda NC de la
        // misma nota (al anular la primera) choca con UNIQUE(credit_note_items.id) y la base le
        // rechaza los items.
        items: g.items.map((it, i) => ({ ...it, id: ncId + '-' + i })),
        accountId: g.providerId
      };

      if (yaExiste) {
        const pagado = yaExiste.paidAmount || 0;
        const saldo = Math.max(0, parseFloat((total - pagado).toFixed(2)));
        if (mirrorNcCode) {
          const choca = (data.creditNotes || []).some(o => o.id !== yaExiste.id && !o.deleted && o.ncCode === mirrorNcCode);
          if (!choca) yaExiste.ncCode = mirrorNcCode;
        }
        Object.assign(yaExiste, campos, { paidAmount: pagado, balance: saldo, saldo_pendiente: saldo });
        if (pagado > 0) {
          yaExiste.status = saldo > 0.01 ? 'PARCIAL' : 'PAGADA';
          yaExiste.estado = yaExiste.status;
          yaExiste.balanceBob = parseFloat((ncCurrency === 'USD' ? saldo * sellRate : saldo).toFixed(2));
          yaExiste.balanceUsd = parseFloat((ncCurrency === 'USD' ? saldo : saldo / sellRate).toFixed(2));
        }
      } else {
        // El codigo espejo no puede pisar el de otra NC. En produccion hay #ncBA004 a #ncBA007
        // repetidos porque al CREAR una NC nunca se miro si el codigo ya estaba tomado (solo al
        // actualizar, unas lineas mas arriba). Si esta ocupado se cae al correlativo, que si
        // revisa los codigos en uso.
        const espejoOcupado = mirrorNcCode && (data.creditNotes || []).some(o => !o.deleted && o.ncCode === mirrorNcCode);
        const finalNcCode = (!espejoOcupado && mirrorNcCode) || (await window.maretravelCodes.nextForServidor(data.creditNotes, 'NC', srv));
        data.creditNotes.unshift({
          id: ncId,
          ncNumber: await window.db.numeroSiguiente('NC', 2001), // lo decide la base (nc_number es UNIQUE)
          ncCode: finalNcCode,
          ...campos,
          paidAmount: 0,
          paidAmountBob: 0,
          paidAmountUsd: 0,
          balance: total,
          balanceBob: campos.totalAmountBob,
          balanceUsd: campos.totalAmountUsd,
          saldo_pendiente: total,
          status: 'IMPAGA',
          estado: 'IMPAGA',
          isAutoGenerated: true,
          createdById: 'USR-001',
          createdAt: new Date().toLocaleString()
        });
      }
      ncDeLaNota++;
    }
    if (sinMonto.length) {
      window.app.showToast(`${sinMonto.length} proveedor(es) sin Cuenta por Pagar porque sus servicios no traen monto: ${sinMonto.join(', ')}`, 'warning');
    }
    return ncDeLaNota;
  },

  /**
   * Revierte la anulacion de una NC. A diferencia de reabrir una ND (que borra sus NC), esto
   * solo devuelve el documento a su estado de cobro recalculando el saldo: el total y el
   * numero no se tocan, asi que ni la correlatividad ni el historico se rompen.
   */
  reabrirNc(ncId) {
    const data = window.db.get();
    const nc = (data.creditNotes || []).find(n => n.id === ncId);
    if (!nc) return;
    if (nc.status !== 'ANULADA') {
      window.app.showToast(`La NC ${window.maretravelCodes.showDoc(nc, 'NC')} no esta anulada`, 'info');
      return;
    }
    if (!confirm(`¿Reabrir la Nota de Credito ${window.maretravelCodes.showDoc(nc, 'NC')}?\n\nVuelve a las Cuentas por Pagar con su saldo recalculado (${nc.currency} ${Number(nc.totalAmount).toLocaleString('es-BO', { minimumFractionDigits: 2 })}).`)) {
      return;
    }

    const rate = Number(nc.frozenExchangeRate || 6.96) || 6.96;
    const pagado = Number(nc.paidAmount || 0);
    const saldo = Math.max(0, parseFloat((Number(nc.totalAmount || 0) - pagado).toFixed(2)));
    nc.status = pagado > 0 ? (saldo > 0.01 ? 'PARCIAL' : 'PAGADA') : 'IMPAGA';
    nc.estado = nc.status;
    nc.balance = saldo;
    nc.balanceBob = nc.currency === 'USD' ? parseFloat((saldo * rate).toFixed(2)) : saldo;
    nc.balanceUsd = nc.currency === 'USD' ? saldo : parseFloat((saldo / rate).toFixed(2));
    nc.saldo_pendiente = saldo;
    nc.monto_acumulado_pagado = pagado;
    nc.voidReason = null;
    nc.voidedAt = null;
    nc.voidedBy = null;

    window.db.save(data);
    this.render();
    if (window.app && window.app.updateDashboardKpis) window.app.updateDashboardKpis();
    window.app.showToast(`Nota de Credito ${window.maretravelCodes.showDoc(nc, 'NC')} REABIERTA (${nc.status}, saldo ${nc.currency} ${saldo.toLocaleString('es-BO', { minimumFractionDigits: 2 })})`, 'success');
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
