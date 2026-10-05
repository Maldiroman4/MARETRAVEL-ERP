/**
 * El item de Seguro guarda un "costo de proveedor" coherente con el precio de la poliza.
 *
 * El modulo de Seguro no tiene input de "costo de proveedor": el unico precio es el de la
 * poliza (`fareAmount`). Pero el generico de items si lo tiene, y `calculateConsolidatedTotals`
 * calcula `netCostToProvider = grossCost - comision` sobre `grossCost`. Con `grossCost` en 0
 * (que es como nace el item) lo que se guarda es 0 mientras la pantalla muestra
 * "Neto a proveedor: 35". Ademas `grossCost` queda en 0 en la base, que es un dato falso.
 *
 * Rompe si: alguien saca la sincronizacion, o vuelve a mandarlo a 0.
 *
 * Ejecutar:  node tests/test_seguro_grosscost.js
 */
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const fail = [];
const check = (cond, msg) => { console.log((cond ? 'OK   - ' : 'FALLA- ') + msg); if (!cond) fail.push(msg); };

const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
const elements = {};
const mkElem = id => elements[id] || (elements[id] = {
  tagName: 'INPUT', innerHTML: '', value: '', textContent: '', style: {},
  classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
  addEventListener() {}, focus() {}, appendChild() {}, reset() {}, setAttribute() {}, remove() {},
  querySelector: () => null, querySelectorAll: () => [], dataset: {}, getAttribute: () => null
});
global.document = { getElementById: mkElem, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, dispatchEvent() {} };
global.navigator = {};
global.location = { origin: 'http://localhost:0', href: 'http://localhost:0/index.html' };
global.fetch = async () => ({ ok: false, json: async () => ({}) });
global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.window = {
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, open: () => {}, alert: () => {},
  app: { showToast() {}, openModal() {}, closeModal() {}, updateDashboardKpis() {} },
  lucide: null, state: { servicioActivo: 'SEGURO_VIAJE' },
  financialGuard: { getExchangeRates: () => ({ sellRate: 6.96 }) }
};
global.window.window = global.window;

require(path.join(RAIZ, 'js', 'db.js'));
global.window.db = {
  get: () => ({ accounts: [{ id: 'PRV-SEG', name: 'ASSISTENCIA UNIVERSAL' }], creditNotes: [], debitNotes: [] }),
  getRaw: () => ({ accounts: [], creditNotes: [], debitNotes: [] }),
  save: () => {}, numeroSiguiente: async (t, d) => d
};
require(path.join(RAIZ, 'js', 'modules', 'operationsHub.js'));
const hub = global.window.operationsHubModule;

(async () => {
  check(!!hub && typeof hub.onInsuranceFieldChange === 'function', 'operationsHub expone onInsuranceFieldChange');
  if (!hub || typeof hub.onInsuranceFieldChange !== 'function') { console.log('\n' + fail.length + ' FALLA(S)'); process.exit(1); }

  const item = {
    id: 'NDI-1', serviceType: 'SEGURO_VIAJE', providerId: 'PRV-SEG', providerName: 'ASSISTENCIA UNIVERSAL',
    currency: 'BOB', fareAmount: 0, fareAmountBob: 0,
    grossCost: 0, grossCostBob: 0,
    feeAmount: 0, feeAmountBob: 0, totalAmount: 0, totalAmountBob: 0,
    settlementModel: 'DEDUCCION_DIRECTA',
    providerCommissionRate: 0, providerCommissionAmount: 0, netCostToProvider: 0
  };
  hub.activeNdItems = [item];

  // El operador escribe el precio de la poliza: 50.
  hub.onInsuranceFieldChange(0, 'fareAmount', '50');
  check(item.grossCost === 50, 'al escribir el precio, grossCost sigue al precio -> ' + item.grossCost);

  // Y la comision: 30.0000%. Cuatro decimales, no se redondea.
  hub.onInsuranceFieldChange(0, 'providerCommissionRate', '30.0000');
  check(item.providerCommissionRate === 30, 'el % se guarda tal cual, sin redondear -> ' + item.providerCommissionRate);

  hub.onInsuranceFieldChange(0, 'providerCommissionRate', '12.375');
  check(item.providerCommissionRate === 12.375, 'un % de 4 decimales sobrevive intacto -> ' + item.providerCommissionRate);
  check(item.providerCommissionAmount === 6.1875, 'comision = 50 * 12.3750% = 6.1875 (sin redondear a 2) -> ' + item.providerCommissionAmount);
  check(item.netCostToProvider === 43.8125, 'neto a proveedor = 50 - 6.1875 = 43.8125 -> ' + item.netCostToProvider);

  // El fee de agencia solo va al total del cliente.
  hub.onInsuranceFieldChange(0, 'feeAmount', '5');
  check(item.totalAmount === 55, 'el total al cliente = precio + fee = 55 -> ' + item.totalAmount);
  check(item.netCostToProvider === 43.8125, 'el fee NO entra al neto a proveedor -> ' + item.netCostToProvider);

  console.log(fail.length ? '\n' + fail.length + ' FALLA(S)' : '\nTODO OK');
  process.exit(fail.length ? 1 : 0);
})();
