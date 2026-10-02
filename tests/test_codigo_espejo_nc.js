/**
 * Que el codigo ESPEJO de una NC no pise el codigo de otra.
 *
 * Corre el generarCuentasPorPagar() REAL sobre el caso exacto que hay en produccion:
 * la NC de 90 BOB de BOLIVIA BOOKING se creo el 29/9 (sin espejo) y le toco #ncBA007 por
 * correlativo. El 30/9 la ND #ndBA007 genero su NC, el espejo le devolvio #ncBA007 y no miro
 * que ya estaba ocupado. Resultado: dos Cuentas por Pagar distintas con el mismo codigo.
 *
 * El guard de colision existia, pero solo en el camino de ACTUALIZAR. Este test corre el camino
 * de CREAR, que es donde faltaba.
 *
 * Ejecutar:  node tests/test_codigo_espejo_nc.js
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
global.window.state = { servicioActivo: 'BOLETO_AEREO' };
global.window.app = { showToast() {} };
require(path.join(RAIZ, 'js', 'modules', 'creditNotes.js'));
const cc = global.window.creditNotesModule;

const TASA = 6.96;
const nd = { id: 'ND-7', ndNumber: 2007, ndCode: '#ndBA007', issueDate: '2026-09-22', serviceType: 'BOLETO_AEREO', items: [] };

const item = { id: 'NDI-1', operatorId: 'PRV-A', operatorName: 'BOLIVIANA DE AVIACION', serviceType: 'BOLETO_AEREO',
  currency: 'BOB', fareAmount: 0, fareAmountBob: 0,
  grossCost: 1135, grossCostBob: 1135, feeAmount: 0, feeAmountBob: 0,
  totalAmount: 1135, totalAmountBob: 1135, settlementModel: 'DEDUCCION_DIRECTA' };

// La NC que ya ocupa #ncBA007 en produccion: otra ND, otro proveedor, otro monto.
const NC_QUE_OCUPA = { id: 'NC-1790691794552-0', ncNumber: 2011, ncCode: '#ncBA007', originDebitNoteId: 'ND-4',
  originDebitNoteCode: 'ND #1008', providerId: 'PRV-B', providerName: 'BOLIVIA BOOKING',
  totalAmount: 90, balance: 90, paidAmount: 0, status: 'IMPAGA', estado: 'IMPAGA', deleted: false, items: [] };

const correr = async (creditNotes) => {
  datos = { debitNotes: [nd], creditNotes, accounts: [
    { id: 'PRV-A', name: 'BOLIVIANA DE AVIACION' },
    { id: 'PRV-B', name: 'BOLIVIA BOOKING' }
  ] };
  await cc.generarCuentasPorPagar(datos, nd, [item], TASA);
  return datos.creditNotes;
};

(async () => {
  // 1. Camino normal: el espejo esta libre -> la NC lo toma.
  let ncs = await correr([]);
  check(ncs.length === 1, 'ND #ndBA007 crea 1 NC  -> ' + ncs.length);
  check(ncs[0] && ncs[0].ncCode === '#ncBA007', 'con el espejo libre toma #ncBA007  -> ' + (ncs[0] && ncs[0].ncCode));

  // 2. EL BUG: el espejo ya esta ocupado por otra NC -> NO puede tomarlo.
  ncs = await correr([JSON.parse(JSON.stringify(NC_QUE_OCUPA))]);
  check(ncs.length === 2, 'la NC nueva se crea igual (no se pierde la deuda)  -> ' + ncs.length);
  const nueva = ncs.find(n => n.originDebitNoteId === 'ND-7');
  check(nueva && nueva.ncCode !== '#ncBA007', 'la NC nueva NO repite #ncBA007  -> ' + (nueva && nueva.ncCode));
  check(nueva && /^#ncBA\d{3}$/.test(nueva.ncCode), 'la NC nueva cae al correlativo  -> ' + (nueva && nueva.ncCode));
  check(nueva && nueva.ncCode === '#ncBA008', 'el correlativo es el siguiente libre (#ncBA008)  -> ' + (nueva && nueva.ncCode));

  // 3. Las dos siguen vivas: esto no es borrar nada, es dejar de pisar la etiqueta.
  check(ncs.filter(n => !n.deleted).length === 2, 'quedan 2 NCs vivas (la vieja y la nueva)  -> ' + ncs.filter(n => !n.deleted).length);
  check(ncs.find(n => n.id === NC_QUE_OCUPA.id).totalAmount === 90, 'la NC vieja conserva su monto de 90');
  check(nueva && nueva.totalAmount === 1135, 'la NC nueva conserva su monto de 1135  -> ' + (nueva && nueva.totalAmount));

  // 4. Sin regresion: una NC BORRADA no bloquea el espejo (esta liberada).
  ncs = await correr([Object.assign(JSON.parse(JSON.stringify(NC_QUE_OCUPA)), { deleted: true })]);
  check(ncs[0] && ncs[0].ncCode === '#ncBA007', 'una NC borrada NO bloquea el espejo  -> ' + (ncs[0] && ncs[0].ncCode));

  // 5. Sin regresion: al ACTUALIZAR se conserva el codigo propio aunque el espejo choca.
  const propia = { id: 'NC-PROPIA', ncNumber: 2015, ncCode: '#ncBA007', originDebitNoteId: 'ND-7',
    originDebitNoteCode: '#ndBA007', providerId: 'PRV-A', providerName: 'BOLIVIANA DE AVIACION',
    totalAmount: 1000, balance: 1000, paidAmount: 0, status: 'IMPAGA', estado: 'IMPAGA', deleted: false, items: [] };
  ncs = await correr([JSON.parse(JSON.stringify(propia))]);
  check(ncs.length === 1, 'actualizar no crea una NC nueva  -> ' + ncs.length);
  check(ncs[0] && ncs[0].ncCode === '#ncBA007', 'actualizar CONSERVA su propio #ncBA007  -> ' + (ncs[0] && ncs[0].ncCode));
  check(ncs[0] && ncs[0].balance === 1135, 'y le actualiza el saldo a 1135  -> ' + (ncs[0] && ncs[0].balance));

  console.log(fail.length ? '\n' + fail.length + ' FALLA(S)' : '\nTODO OK');
  process.exit(fail.length ? 1 : 0);
})();
