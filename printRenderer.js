/**
 * MARETRAVEL ERP - Renderizador Oficial de Plantillas de Impresión en Servidor
 * Inyecta dinámicamente el logotipo en Base64 para garantizar persistencia y visualización
 * perfecta en impresión nativa, iframes y conversión a PDF.
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
  if (!dateStr) return '17/09/2026';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function renderOfficialPrintDocument(doc, docType = 'ND', logoBase64 = '') {
  const isNc = docType === 'NC' || String(doc.id || '').startsWith('NC') || Boolean(doc.creditNoteId || doc.creditNoteNumber);
  const isTransaction = Boolean(doc.receiptNumber || doc.receiptCode || doc.isReceipt);
  const docTitle = isTransaction ? (isNc ? 'PAGO A PROVEEDOR' : 'RECIBO DE PAGO') : (isNc ? 'NOTA DE CRÉDITO' : 'NOTA DE DÉBITO');
  const docNumber = escapeHtml(doc.ndNumber || doc.ncNumber || doc.number || doc.id || '4001');
  const emissionDate = formatDate(doc.issueDate);
  const emissionTime = doc.issueTime || '10:30';
  const solicitante = escapeHtml(doc.solicitante || doc.requestedBy || 'GERENCIA GENERAL').toUpperCase();
  const entityCode = escapeHtml(doc.accountCode || doc.clientCode || doc.providerCode || (isNc ? 'PRV-001' : 'CLI-001'));
  const entityName = escapeHtml(doc.accountName || doc.clientName || doc.providerName || 'CLIENTE / PROVEEDOR').toUpperCase();

  const tcUsed = doc.frozenExchangeRate || doc.exchangeRateUsed || 6.96;
  const amountVal = Number(doc.totalAmountBob != null ? doc.totalAmountBob : (doc.totalAmount || 0));
  const currencyStr = doc.currency || 'BOB';

  let totalUsd = '0.00';
  let totalBob = '0.00';
  if (currencyStr === 'USD') {
    totalUsd = (Number(doc.totalAmountUsd || (amountVal / tcUsed) || doc.totalAmount || 0)).toFixed(2);
    totalBob = (amountVal * (amountVal === (doc.totalAmountUsd || doc.totalAmount) ? tcUsed : 1)).toFixed(2);
  } else {
    totalUsd = (amountVal / tcUsed).toFixed(2);
    totalBob = amountVal.toFixed(2);
  }

  // Items
  const items = doc.items && Array.isArray(doc.items) && doc.items.length > 0 ? doc.items : [
    {
      serviceType: 'BOLETO_AEREO',
      description: doc.concept || doc.observations || 'SERVICIO REGISTRADO',
      providerName: isNc ? entityName : 'BOLIVIANA DE AVIACION (BoA)',
      providerCode: 'PRV-001',
      subtotal: amountVal,
      currency: currencyStr,
      serviceDetails: {}
    }
  ];

  const itemsHtml = items.map((it, idx) => {
    const srvType = it.serviceType || 'BOLETO_AEREO';
    const desc = escapeHtml(it.description || 'SERVICIO REGISTRADO').toUpperCase();
    const provName = escapeHtml(it.providerName || 'OPERADOR REGISTRADO').toUpperCase();
    const itemSubtotal = Number(it.subtotal || it.total || 0).toFixed(2);
    const itemCurrency = it.currency || currencyStr;
    const sd = it.serviceDetails || {};

    return `
      <div class="nd-item-block" ${idx > 0 ? 'style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1;"' : ''}>
        <div class="nd-item-col nd-col-left">
          <div class="nd-kv-row"><span class="nd-k">Tipo Servicio:</span><span class="nd-v font-bold" style="color: #00a884;">${srvType}</span></div>
          <div class="nd-kv-row"><span class="nd-k">Proveedor:</span><span class="nd-v font-bold">${provName}</span></div>
          <div class="nd-kv-row"><span class="nd-k">Descripción:</span><span class="nd-v">${desc}</span></div>
        </div>
        <div class="nd-item-col nd-col-center">
          <div class="nd-kv-row"><span class="nd-k">Moneda:</span><span class="nd-v font-bold">${itemCurrency}</span></div>
          <div class="nd-kv-row"><span class="nd-k">Subtotal:</span><span class="nd-v font-mono font-bold">${itemSubtotal} ${itemCurrency}</span></div>
          <div class="nd-kv-row"><span class="nd-k">Titular:</span><span class="nd-v font-bold">${solicitante}</span></div>
        </div>
        <div class="nd-item-col nd-col-right">
          <div class="nd-kv-row"><span class="nd-k">Fecha Servicio:</span><span class="nd-v font-mono">${sd.travelDates || emissionDate}</span></div>
          <div class="nd-kv-row"><span class="nd-k">Reserva/Doc:</span><span class="nd-v font-mono font-bold">${sd.pnrCode || sd.ticketNumber || 'CONFIRMADO'}</span></div>
          <div class="nd-kv-row"><span class="nd-k">Estado:</span><span class="nd-v font-bold" style="color: #059669;">CONFIRMADO</span></div>
        </div>
      </div>
    `;
  }).join('');

  const obsText = escapeHtml(doc.observations || doc.concept || 'OPERACIÓN OFICIAL REGISTRADA EN ERP').toUpperCase();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${docTitle} ${docNumber} - MARETRAVEL SRL</title>
  <style>
    @page { size: letter portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
      font-size: 11px;
      line-height: 1.35;
    }
    .nd-official-container { width: 100%; max-width: 800px; margin: 0 auto; padding: 10px; }
    .nd-official-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 10px; }
    .nd-header-brand { width: 27%; text-align: left; }
    .nd-official-logo { max-width: 195px !important; height: auto !important; max-height: 62px !important; object-fit: contain !important; display: block !important; }
    .nd-header-title-box { width: 46%; text-align: center; }
    .nd-title-main { font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0 0 2px 0; }
    .nd-number-line { font-size: 0.95rem; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
    .nd-meta-table { margin: 0 auto; border-collapse: collapse; text-align: left; font-size: 0.76rem; width: 100%; }
    .nd-meta-table td { padding: 1.5px 4px; }
    .nd-lbl-cell { font-weight: 700; color: #475569; width: 120px; }
    .nd-val-cell { color: #0f172a; }
    .nd-header-agency-info { width: 27%; text-align: right; font-size: 0.72rem; color: #334155; line-height: 1.25; }
    .nd-agency-bold { font-weight: 800; color: #0f172a; font-size: 0.8rem; margin-bottom: 2px; }
    
    .nd-detail-section { margin-top: 10px; }
    .nd-green-badge {
      display: inline-block;
      background-color: #00a884 !important;
      color: #ffffff !important;
      font-weight: 800;
      font-size: 0.72rem;
      padding: 2px 14px;
      border-radius: 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .nd-green-line { height: 2px; background-color: #00a884 !important; margin-top: 1px; margin-bottom: 10px; }
    
    .nd-item-block { display: flex; justify-content: space-between; gap: 10px; font-size: 0.75rem; background: #fafafa; padding: 6px 8px; border-radius: 4px; border: 1px solid #f1f5f9; }
    .nd-item-col { flex: 1; }
    .nd-kv-row { display: flex; margin-bottom: 2px; }
    .nd-k { width: 95px; font-weight: 700; color: #64748b; font-size: 0.72rem; }
    .nd-v { flex: 1; color: #0f172a; }
    .font-bold { font-weight: 700; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, monospace; }
    
    .nd-totals-section { display: flex; justify-content: flex-end; margin-top: 14px; }
    .nd-totals-table { border-collapse: collapse; width: 260px; font-size: 0.8rem; }
    .nd-totals-table th { background-color: #00a884 !important; color: #ffffff !important; padding: 4px 8px; text-align: center; font-weight: 800; }
    .nd-totals-table td { padding: 4px 8px; border: 1px solid #e2e8f0; }
    
    .nd-obs-badge { display: inline-block; background-color: #00a884 !important; color: #ffffff !important; font-weight: 800; font-size: 0.68rem; padding: 1.5px 8px; border-radius: 2px; margin-top: 10px; }
    .nd-obs-box { border: 1px solid #cbd5e1; background-color: #f8fafc; padding: 6px 8px; font-size: 0.72rem; margin-top: 2px; font-weight: 600; min-height: 28px; }
    
    .nd-signatures-container { display: flex; justify-content: space-between; margin-top: 36px; padding: 0 10px; gap: 20px; }
    .nd-signature-box { flex: 1; text-align: center; font-size: 0.7rem; }
    .nd-sig-line { border-top: 1px solid #0f172a; margin-bottom: 4px; }
    .nd-sig-title { font-weight: 700; color: #0f172a; }
    .nd-sig-sub { color: #64748b; font-size: 0.66rem; }
  </style>
</head>
<body>
  <div class="nd-official-container">
    <div class="nd-official-header">
      <div class="nd-header-brand">
        <img src="${logoBase64 || 'assets/logo.png'}" class="nd-official-logo" alt="MARETRAVEL">
      </div>
      <div class="nd-header-title-box">
        <h1 class="nd-title-main">${docTitle}</h1>
        <div class="nd-number-line">Nro.: ${docNumber}</div>
        <table class="nd-meta-table">
          <tr><td class="nd-lbl-cell">Fecha de Emisión :</td><td class="nd-val-cell">${emissionDate} ${emissionTime}</td></tr>
          <tr><td class="nd-lbl-cell">Solicitado Por :</td><td class="nd-val-cell font-bold">${solicitante}</td></tr>
          <tr><td class="nd-lbl-cell">${isNc ? 'Código Proveedor :' : 'Código Cliente :'}</td><td class="nd-val-cell font-mono font-bold">${entityCode}</td></tr>
          <tr><td class="nd-lbl-cell">${isNc ? 'Proveedor/Benef. :' : 'Empresa/Cliente :'}</td><td class="nd-val-cell font-bold">${entityName}</td></tr>
        </table>
      </div>
      <div class="nd-header-agency-info">
        <div class="nd-agency-bold">MARETRAVEL SRL</div>
        <div>Barrio Petrolero Norte,</div>
        <div>Calle Los Tajibos #2123</div>
        <div>Tel: 3443322 – 75540100</div>
        <div>info@maretravel.com.bo</div>
        <div style="font-weight: 700;">Santa Cruz - Bolivia</div>
      </div>
    </div>

    <div class="nd-detail-section">
      <div class="nd-green-badge">Detalle</div>
      <div class="nd-green-line"></div>
      <div class="nd-items-wrapper">
        ${itemsHtml}
      </div>
    </div>

    <div class="nd-totals-section">
      <table class="nd-totals-table">
        <thead>
          <tr><th style="width: 50%;">TOTAL (USD)</th><th style="width: 50%;">TOTAL (BOB)</th></tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align: right; font-weight: 800; font-family: monospace;">$ ${totalUsd}</td>
            <td style="text-align: right; font-weight: 800; font-family: monospace;">Bs ${totalBob}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div>
      <div class="nd-obs-badge">Observaciones:</div>
      <div class="nd-obs-box">${obsText}</div>
    </div>

    <div class="nd-signatures-container">
      <div class="nd-signature-box">
        <div class="nd-sig-line"></div>
        <div class="nd-sig-title">Emitido Por</div>
        <div class="nd-sig-sub">MARETRAVEL SRL</div>
      </div>
      <div class="nd-signature-box">
        <div class="nd-sig-line"></div>
        <div class="nd-sig-title">Revisado / Contabilidad</div>
        <div class="nd-sig-sub">Control Interno</div>
      </div>
      <div class="nd-signature-box">
        <div class="nd-sig-line"></div>
        <div class="nd-sig-title">Firma y Sello Cliente</div>
        <div class="nd-sig-sub">Conformidad de Recepción</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  renderOfficialPrintDocument
};
