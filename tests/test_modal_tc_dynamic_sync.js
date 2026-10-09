/**
 * test_modal_tc_dynamic_sync.js
 * Verificación automatizada de actualización dinámica de saldos por Tipo de Cambio (T/C)
 * en el modal transaccional de Pagos y Cobranzas para todos los servicios del ERP.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Simular entorno global de navegador mínimo para cashRegister.js
global.window = {
  db: {
    get: () => ({
      debitNotes: [],
      creditNotes: [],
      bankAccounts: [],
      cashReceipts: [],
      providerPayments: []
    })
  },
  financialGuard: {
    getExchangeRates: () => ({ buyRate: 12.00, sellRate: 12.00 })
  },
  app: {
    showToast: () => {},
    openModal: () => {},
    closeModal: () => {}
  }
};

// Cargar cashRegister.js en el entorno global
const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'cashRegister.js'), 'utf-8');
eval(code);

const mod = window.cashRegisterModule;
assert(mod, 'El módulo cashRegisterModule debe existir');
assert(typeof mod.getDocumentNormalizedBalances === 'function', 'getDocumentNormalizedBalances debe ser una función');
assert(typeof mod.onModalExchangeRateChange === 'function', 'onModalExchangeRateChange debe ser una función');

console.log('>>> [TEST] Iniciando verificación de dinamismo de Tipo de Cambio en Modal...');

// =========================================================================
// CASO 1: ND Seguro de Viaje emitida en USD (ej: #ndSV007, 129 USD)
// =========================================================================
console.log('\n[TEST 1] ND Seguro de Viaje (USD 129.00) cobrada en BOB con cambio de T/C...');
const ndSeguro = {
  id: 'ndSV007',
  ndCode: '#ndSV007',
  currency: 'USD',
  totalAmountUsd: 129.00,
  balanceUsd: 129.00,
  totalAmountBob: 1548.00, // Histórico guardado a T/C 12.00
  balanceBob: 1548.00,      // Histórico guardado a T/C 12.00
  frozenExchangeRate: 12.00,
  paidAmount: 0,
  paidAmountBob: 0,
  paidAmountUsd: 0
};

// 1.1 Con T/C = 12.00
const r12 = mod.getDocumentNormalizedBalances(ndSeguro, true, 12.00);
assert.strictEqual(r12.totalUsd, 129.00, 'Total USD a T/C 12.00 debe ser 129.00');
assert.strictEqual(r12.balanceUsd, 129.00, 'Saldo USD a T/C 12.00 debe ser 129.00');
assert.strictEqual(r12.totalBob, 1548.00, 'Total BOB a T/C 12.00 debe ser 1548.00');
assert.strictEqual(r12.balanceBob, 1548.00, 'Saldo BOB a T/C 12.00 debe ser 1548.00');

// 1.2 Con T/C cambiado en pantalla a 12.20 (Problema exacto reportado por el usuario)
const r1220 = mod.getDocumentNormalizedBalances(ndSeguro, true, 12.20);
assert.strictEqual(r1220.totalUsd, 129.00, 'Total USD a T/C 12.20 debe ser 129.00');
assert.strictEqual(r1220.balanceUsd, 129.00, 'Saldo USD a T/C 12.20 debe ser 129.00');
assert.strictEqual(r1220.totalBob, 1573.80, 'Total BOB a T/C 12.20 debe ser exactamente 1573.80 (129 * 12.20)');
assert.strictEqual(r1220.balanceBob, 1573.80, 'Saldo BOB a T/C 12.20 debe ser exactamente 1573.80 (129 * 12.20)');
console.log(' -> OK: Saldo en BOB se actualizó dinámicamente de 1.548,00 a 1.573,80 BOB.');

// =========================================================================
// CASO 2: NC Proveedor de Seguro en USD (Neto a pagar en BOB)
// =========================================================================
console.log('\n[TEST 2] NC Proveedor Seguro (USD 77.40) pagada en BOB con cambio de T/C...');
const ncSeguro = {
  id: 'ncSV007',
  ncCode: '#ncSV007',
  currency: 'USD',
  totalAmount: 77.40,
  balance: 77.40,
  totalAmountUsd: 77.40,
  balanceUsd: 77.40,
  totalAmountBob: 928.80, // Histórico guardado a T/C 12.00
  balanceBob: 928.80,     // Histórico guardado a T/C 12.00
  frozenExchangeRate: 12.00,
  paidAmount: 0
};

const rNc12 = mod.getDocumentNormalizedBalances(ncSeguro, false, 12.00);
assert.strictEqual(rNc12.balanceBob, 928.80, 'Saldo BOB NC a T/C 12.00 debe ser 928.80');

const rNc1220 = mod.getDocumentNormalizedBalances(ncSeguro, false, 12.20);
assert.strictEqual(rNc1220.balanceBob, 944.28, 'Saldo BOB NC a T/C 12.20 debe ser 944.28 (77.40 * 12.20)');
console.log(' -> OK: Saldo de Cuenta por Pagar a proveedor se recalculó dinámicamente a 944.28 BOB.');

// =========================================================================
// CASO 3: ND Boleto Aéreo en BOB cobrado en USD (Conversión inversa)
// =========================================================================
console.log('\n[TEST 3] ND Boleto Aéreo (BOB 1.220,00) cobrado en USD...');
const ndBoleto = {
  id: 'ndBA001',
  ndCode: '#ndBA001',
  currency: 'BOB',
  totalAmountBob: 1220.00,
  balanceBob: 1220.00,
  totalAmountUsd: 175.29, // Histórico viejo a 6.96
  balanceUsd: 175.29,
  paidAmount: 0
};

const rBa12 = mod.getDocumentNormalizedBalances(ndBoleto, true, 12.00);
assert.strictEqual(rBa12.balanceUsd, 101.67, 'Saldo USD a T/C 12.00 debe ser 101.67 (1220 / 12.00)');

const rBa1220 = mod.getDocumentNormalizedBalances(ndBoleto, true, 12.20);
assert.strictEqual(rBa1220.balanceUsd, 100.00, 'Saldo USD a T/C 12.20 debe ser 100.00 (1220 / 12.20)');
console.log(' -> OK: Saldo en USD se actualizó dinámicamente de 101.67 a 100.00 USD.');

// =========================================================================
// CASO 4: Abono Parcial Multimoneda
// =========================================================================
console.log('\n[TEST 4] Abono parcial en documento USD (deuda inicial 129 USD, pagado 29 USD)...');
const ndParcial = {
  id: 'ndParcial',
  currency: 'USD',
  totalAmountUsd: 129.00,
  paidAmountUsd: 29.00,
  balanceUsd: 100.00,
  paidAmount: 29.00
};

const rParcial = mod.getDocumentNormalizedBalances(ndParcial, true, 12.20);
assert.strictEqual(rParcial.totalBob, 1573.80, 'Total BOB debe ser 1573.80');
assert.strictEqual(rParcial.balanceUsd, 100.00, 'Saldo remanente USD debe ser 100.00');
assert.strictEqual(rParcial.balanceBob, 1220.00, 'Saldo remanente en BOB debe ser 1220.00 (100 * 12.20)');
console.log(' -> OK: Saldo remanente en BOB refleja exactamente 1.220,00 BOB.');

// =========================================================================
// CASO 5: Simulación de Evento onModalExchangeRateChange en Pantalla
// =========================================================================
console.log('\n[TEST 5] Simulación del evento onModalExchangeRateChange en el DOM del modal...');
const domElements = {
  'pay-doc-type': { value: 'ND' },
  'pay-doc-id': { value: 'ndSV007' },
  'pay-currency': { value: 'BOB' },
  'pay-exchange-rate': { value: '12.20' },
  'pay-amount-input': { value: '1548.00' }, // Valor viejo a T/C 12
  'pay-doc-total': { textContent: '' },
  'pay-doc-balance': { textContent: '' },
  'pay-countervalue-preview': { textContent: '' },
  'pay-remaining-balance-preview': { innerHTML: '', style: {} }
};

global.document = {
  getElementById: (id) => domElements[id] || null
};

window.db.get = () => ({
  debitNotes: [ndSeguro],
  creditNotes: []
});

// Ejecutar el evento que se dispara cuando el usuario tipea 12.20
mod.onModalExchangeRateChange();

assert.strictEqual(domElements['pay-amount-input'].value, '1573.80', 'El monto a amortizar debe actualizarse automáticamente a 1573.80');
assert(domElements['pay-doc-total'].textContent.includes('1.573,80'), 'La cabecera Total debe mostrar BOB 1.573,80');
assert(domElements['pay-doc-balance'].textContent.includes('1.573,80'), 'La cabecera Saldo debe mostrar BOB 1.573,80');
assert(domElements['pay-countervalue-preview'].textContent.includes('USD 129.00'), 'El contravalor debe mostrar USD 129.00');
console.log(' -> OK: Evento onModalExchangeRateChange actualizó inputs, cabeceras y contravalores en el modal.');

console.log('\n================================================================');
console.log('>>> [PASS] TODOS LOS TESTS DE SINCRONIZACIÓN DINÁMICA DE T/C PASARON CON ÉXITO.');
console.log('================================================================\n');
