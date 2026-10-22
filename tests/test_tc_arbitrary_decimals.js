/**
 * test_tc_arbitrary_decimals.js
 * Verificación automatizada de soporte para Tipo de Cambio con múltiples decimales arbitrarios
 * (ej: 12.2046511627907 para liquidar exactamente BOB 1.574,40 por USD 129.00).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Simular entorno global de navegador mínimo
global.window = {
  db: {
    get: () => ({
      debitNotes: [],
      creditNotes: [],
      bankAccounts: [],
      cashReceipts: [],
      providerPayments: [],
      systemSettings: { activeExchangeBuy: 12.20, activeExchangeSell: 12.2046511627907 }
    })
  },
  financialGuard: {
    getExchangeRates: () => ({ buyRate: 12.20, sellRate: 12.2046511627907 })
  },
  app: {
    showToast: () => {},
    openModal: () => {},
    closeModal: () => {}
  }
};

const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'cashRegister.js'), 'utf-8');
eval(code);

const mod = window.cashRegisterModule;
assert(mod, 'El módulo cashRegisterModule debe existir');

console.log('>>> [TEST] Iniciando verificación de soporte para T/C con decimales de alta precisión...');

// 1. Caso real reportado por el operador:
// Cobro de Seguro: USD 129.00, pago del cliente en Bolivianos: BOB 1.574,40.
// T/C exacto = 1574.40 / 129 = 12.204651162790697...
const preciseTc = 1574.40 / 129; // 12.204651162790697
console.log(`[TEST 1] Tasa precisa calculada: ${preciseTc}`);

const ndSeguro = {
  id: 'ndSV007',
  ndCode: '#ndSV007',
  currency: 'USD',
  totalAmountUsd: 129.00,
  balanceUsd: 129.00,
  paidAmount: 0
};

const balances = mod.getDocumentNormalizedBalances(ndSeguro, true, preciseTc);

assert.strictEqual(balances.totalUsd, 129.00, 'Total USD debe ser 129.00');
assert.strictEqual(balances.balanceUsd, 129.00, 'Saldo USD debe ser 129.00');
assert.strictEqual(balances.totalBob, 1574.40, 'Total BOB debe coincidir exactamente con 1.574,40');
assert.strictEqual(balances.balanceBob, 1574.40, 'Saldo BOB debe coincidir exactamente con 1.574,40');
console.log(' -> OK: Saldo convertido a BOB es exactamente 1.574,40 BOB sin errores de redondeo.');

// 2. Simulación en DOM de evento onModalExchangeRateChange con T/C de alta precisión
console.log('\n[TEST 2] Verificando evento onModalExchangeRateChange con T/C de múltiples decimales...');
const domElements = {
  'pay-doc-type': { value: 'ND' },
  'pay-doc-id': { value: 'ndSV007' },
  'pay-currency': { value: 'BOB' },
  'pay-exchange-rate': { value: '12.2046511627907' },
  'pay-amount-input': { value: '0' },
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

mod.onModalExchangeRateChange();

assert.strictEqual(domElements['pay-amount-input'].value, '1574.40', 'El monto a amortizar debe sugerir exactamente 1574.40');
assert(domElements['pay-doc-total'].textContent.includes('1.574,40'), 'Cabecera Total debe mostrar BOB 1.574,40');
assert(domElements['pay-doc-balance'].textContent.includes('1.574,40'), 'Cabecera Saldo debe mostrar BOB 1.574,40');
assert(domElements['pay-countervalue-preview'].textContent.includes('12,204651') || domElements['pay-countervalue-preview'].textContent.includes('12.204651'), 'El contravalor debe mostrar el T/C con alta precisión');
console.log(' -> OK: Input de amortización y cabecera actualizados a 1.574,40 BOB.');

// 3. Verificación de step="any" en index.html
console.log('\n[TEST 3] Verificando presencia de step="any" en index.html...');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');

assert(indexHtml.includes('step="any" id="pay-exchange-rate"'), 'pay-exchange-rate debe tener step="any"');
assert(indexHtml.includes('step="any" id="quick-tc-buy"'), 'quick-tc-buy debe tener step="any"');
assert(indexHtml.includes('step="any" id="quick-tc-sell"'), 'quick-tc-sell debe tener step="any"');
assert(indexHtml.includes('step="any" id="tc-buy-rate"'), 'tc-buy-rate debe tener step="any"');
assert(indexHtml.includes('step="any" id="tc-sell-rate"'), 'tc-sell-rate debe tener step="any"');
console.log(' -> OK: Todos los inputs de T/C en index.html tienen step="any".');

console.log('\n================================================================');
console.log('>>> [PASS] TODOS LOS CHECKS DE T/C MULTI-DECIMAL PASARON CON ÉXITO.');
console.log('================================================================\n');
