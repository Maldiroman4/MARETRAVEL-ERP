/**
 * Liquidacion del SEGURO: la comision debe llegar a la Cuenta por Pagar y el fee de agencia NO.
 *
 * Corre el generarCuentasPorPagar() REAL, sin DOM ni red.
 *
 * El bug: la Cuenta por Pagar del seguro se armaba con `grossCost`, un campo fantasma que el
 * modulo de seguro nunca llena (no hay input de "costo del proveedor" en la plantilla de seguro).
 * Quedaba en 0, el generador caia al `fallback` de `fareAmount` y debaba al proveedor el precio
 * COMPLETO de la poliza. En produccion #ncSV001 debia 475.17 en vez de 308.91.
 *
 * Rompe si: alguien vuelve a usar `grossCost` para el seguro, o si el fee de agencia se suma,
 * o si la comision deja de descontarse.
 *
 * Ejecutar:  node tests/test_seguro_liquidacion.js
 */
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const fail = [];
const check = (cond, msg) => { console.log((cond ? 'OK   - ' : 'FALLA- ') + msg); if (!cond) fail.push(msg); };

global.window = { location: { origin: 'http://localhost:0' }, addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, state: {} };
global.window.window = global.window;
global.location = global.window.location;
global.fetch = async () => ({ ok: false, json: async () => ({}) });
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
require(path.join(RAIZ, 'js', 'db.js'));

let datos = { debitNotes: [], creditNotes: [], accounts: [] };
global.window.db = { getRaw: () => datos, numeroSiguiente: async (t, d) => d, get: () => datos, save: () => {} };
global.window.state = { servicioActivo: 'SEGURO_VIAJE' };
const toasts = [];
global.window.app = { showToast: (m, t) => toasts.push(m + '|' + t) };
require(path.join(RAIZ, 'js', 'modules', 'creditNotes.js'));
const cc = global.window.creditNotesModule;

const TASA = 6.96;
const nd = { id: 'ND-SEG', ndNumber: 3001, ndCode: '#ndSV001', issueDate: '2026-10-05', serviceType: 'SEGURO_VIAJE', items: [] };

// Un item de seguro tal como queda guardado. `grossCost` en 0 es lo que pasa hoy y lo que paso
// con las NCs ya emitidas: el modulo de seguro no tiene input de costo de proveedor, asi que
// ese campo nunca se llena.
const itemSeguro = (precio, pct, fee, extra) => Object.assign({
  id: 'NDI-1', serviceType: 'SEGURO_VIAJE', operatorId: 'PRV-SEG', operatorName: 'ASSISTENCIA UNIVERSAL',
  currency: 'BOB',
  fareAmount: precio, fareAmountBob: precio,
  grossCost: 0, grossCostBob: 0,
  feeAmount: fee, feeAmountBob: fee,
  totalAmount: precio + fee, totalAmountBob: precio + fee,
  settlementModel: 'DEDUCCION_DIRECTA',
  providerCommissionRate: pct,
  netCostToProvider: 0
}, extra);

const correr = async (items, serviceType) => {
  const nota = Object.assign({}, nd, { serviceType: serviceType || nd.serviceType });
  datos = { debitNotes: [nota], creditNotes: [], accounts: [{ id: 'PRV-SEG', name: 'ASSISTENCIA UNIVERSAL' }] };
  toasts.length = 0;
  await cc.generarCuentasPorPagar(datos, nota, items, TASA);
  return datos.creditNotes;
};

(async () => {
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('── la regla del enunciado: precio 50, 30.0000%, fee 5 ──');
  let ncs = await correr([itemSeguro(50, 30, 5)]);
  check(ncs.length === 1, 'crea 1 Nota de Credito  -> ' + ncs.length);
  check(ncs[0] && ncs[0].totalAmount === 35, 'pago_proveedor = 50 - 15 = 35  -> ' + (ncs[0] && ncs[0].totalAmount));
  check(ncs[0] && ncs[0].totalAmount !== 55, 'NO es 55 (precio + fee): el fee no llega al proveedor');
  check(ncs[0] && ncs[0].totalAmount !== 50, 'NO es 50: la comision se le descuenta al proveedor');
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────────
  console.log('── 4 decimales de verdad: un porcentaje redondeado cambia el resultado ──');
  // 1000 * 12.3750% = 123.75  -> CxP 876.25
  // 1000 * 12.38%   = 123.80  -> 876.20   <- lo daria si el % se redondeara a 2 decimales
  ncs = await correr([itemSeguro(1000, 12.375, 0)]);
  check(ncs[0] && ncs[0].totalAmount === 876.25, 'precio 1000 + 12.3750% -> CxP 876.25  -> ' + (ncs[0] && ncs[0].totalAmount));
  check(ncs[0] && ncs[0].totalAmount !== 876.20, 'NO es 876.20: el porcentaje no se redondeo a 2 decimales');
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────────
  console.log('── el fee de agencia NUNCA llega a la Cuenta por Pagar ──');
  ncs = await correr([itemSeguro(50, 0, 500)]);
  check(ncs[0] && ncs[0].totalAmount === 50, 'precio 50, sin comision, fee 500 -> CxP 50  -> ' + (ncs[0] && ncs[0].totalAmount));
  check(ncs[0] && ncs[0].totalAmount !== 550, 'NO es 550: un fee enorme no infla la deuda del proveedor');
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────────
  console.log('── 100% de comision: no hay nada que pagarle al proveedor ──');
  ncs = await correr([itemSeguro(50, 100, 5)]);
  check(ncs.length === 0, 'no crea Nota de Credito  -> ' + ncs.length);
  check(toasts.some(t => t.indexOf('warning') > -1), 'avisa por toast que el proveedor quedo sin Cuenta por Pagar');
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────────
  console.log('── una NC de seguro ya emitida (netCostToProvider en 0) se liquida igual ──');
  // Las NCs de seguro que ya existen en produccion (#ncSV001) tienen los dos campos en 0. Si el
  // generador se apoyara en netCostToProvider no les pagaria nada al proveedor.
  ncs = await correr([itemSeguro(475.17, 34.99, 0, { id: 'NDI-VIEJO' })]);
  // 475.17 - (475.17 * 34.99%) = 475.17 - 166.2620... = 308.91
  check(ncs[0] && ncs[0].totalAmount === 308.91, '#ncSV001 debe 308.91, no 475.17  -> ' + (ncs[0] && ncs[0].totalAmount));
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────────
  console.log('── sin regresion: el boleto se sigue liquidando como hasta ahora ──');
  // Decidido explicitamente: este arreglo es solo para SEGURO_VIAJE.
  const boleto = { id: 'NDI-B', serviceType: 'BOLETO_AEREO', operatorId: 'PRV-SEG', operatorName: 'BOLIVIANA DE AVIACION',
    currency: 'BOB', fareAmount: 895, fareAmountBob: 895, grossCost: 1059, grossCostBob: 1059,
    feeAmount: 100, feeAmountBob: 100, totalAmount: 1159, totalAmountBob: 1159,
    settlementModel: 'DEDUCCION_DIRECTA', providerCommissionRate: 5, netCostToProvider: 1014.25 };
  ncs = await correr([boleto], 'BOLETO_AEREO');
  check(ncs[0] && ncs[0].totalAmount === 1059, 'boleto sigue en 1059 (grossCost), sin cambios  -> ' + (ncs[0] && ncs[0].totalAmount));
  console.log('');

  console.log(fail.length ? '\n' + fail.length + ' FALLA(S)' : '\nTODO OK');
  process.exit(fail.length ? 1 : 0);
})();
