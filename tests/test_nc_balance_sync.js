/**
 * Test de Reconciliación y Sincronización de Saldos en Notas de Crédito (MARETRAVEL ERP)
 * Regla Ponytail: Un único check ejecutable basado en asserts nativos, sin frameworks.
 *
 * Ejecución: node tests/test_nc_balance_sync.js
 */

const assert = require('assert');

// Mock mínimo del entorno global del navegador para probar los módulos
global.location = { origin: 'http://localhost:3000' };
global.window = {
  addEventListener: () => {},
  db: {
    numeroSiguiente: async () => 2099
  },
  maretravelCodes: {
    nextForServidor: async () => '#ncTEST001',
    showDoc: (doc, type) => doc.ncCode || doc.ndCode || `${type} #${doc.ncNumber || doc.ndNumber}`
  },
  app: {
    showToast: () => {}
  }
};

// Cargar módulos
require('../js/modules/creditNotes.js');
require('../js/modules/cashRegister.js');
const dbCode = require('fs').readFileSync('./js/db.js', 'utf8');
eval(dbCode); // Evalúa la clase Database y helper de db.js en contexto

async function runTests() {
  console.log('>>> [TEST] Iniciando verificación de reconciliación de saldos en NCs...');

  const creditNotesModule = window.creditNotesModule;
  const cashRegisterModule = window.cashRegisterModule;
  const dbModule = window.db;

  // --------------------------------------------------------------------------
  // TEST 1: Boleto Aéreo - ND editada que pasa de 981 BOB a 1.962 BOB (sin pagos)
  // --------------------------------------------------------------------------
  console.log('[TEST 1] Boleto Aéreo: Actualización de ND con 2 boletos (1.962 BOB)...');
  const dataBob = {
    accounts: [{ id: 'PROV-01', name: 'AGENTE5', nit: '1013389020' }],
    creditNotes: [
      {
        id: 'NC-TEST-BOB-01',
        ncNumber: 2030,
        ncCode: '#ncBA017',
        providerId: 'PROV-01',
        originDebitNoteId: 'ND-BOB-01',
        originDebitNoteCode: '#ndBA017',
        currency: 'BOB',
        totalAmount: 981,
        totalAmountBob: 981,
        totalAmountUsd: 81.75,
        paidAmount: 0,
        balance: 981,
        balanceBob: 981, // Valor viejo con 1 boleto
        balanceUsd: 81.75,
        saldo_pendiente: 981,
        status: 'IMPAGA',
        items: []
      }
    ]
  };

  const ndBob = {
    id: 'ND-BOB-01',
    ndCode: '#ndBA017',
    ndNumber: 1017,
    issueDate: '2026-10-07',
    serviceType: 'BOLETO_AEREO'
  };

  const itemsBob = [
    {
      operatorId: 'PROV-01',
      operatorName: 'AGENTE5',
      serviceType: 'BOLETO_AEREO',
      currency: 'BOB',
      grossCost: 981,
      grossCostBob: 981,
      totalAmount: 1081,
      totalAmountBob: 1081
    },
    {
      operatorId: 'PROV-01',
      operatorName: 'AGENTE5',
      serviceType: 'BOLETO_AEREO',
      currency: 'BOB',
      grossCost: 981,
      grossCostBob: 981,
      totalAmount: 1081,
      totalAmountBob: 1081
    }
  ];

  await creditNotesModule.generarCuentasPorPagar(dataBob, ndBob, itemsBob, 12.0);

  const ncBobActualizada = dataBob.creditNotes.find(c => c.id === 'NC-TEST-BOB-01');
  assert(ncBobActualizada, 'La NC debe existir');
  assert.strictEqual(ncBobActualizada.totalAmount, 1962, 'Total NC debe ser 1962');
  assert.strictEqual(ncBobActualizada.balance, 1962, 'Balance nativo debe ser 1962');
  assert.strictEqual(ncBobActualizada.balanceBob, 1962, 'Balance BOB debe ser 1962 (NO quedarse en 981)');
  assert.strictEqual(ncBobActualizada.balanceUsd, 163.5, 'Balance USD debe ser 163.5 (1962 / 12)');
  assert.strictEqual(ncBobActualizada.status, 'IMPAGA');
  console.log(' -> OK: NC Boleto Aéreo actualizada con balanceBob y balanceUsd íntegros.');

  // --------------------------------------------------------------------------
  // TEST 2: Seguro de Viaje - ND editada en USD (43 USD, 40% com = 25.80 USD netos)
  // --------------------------------------------------------------------------
  console.log('[TEST 2] Seguro de Viaje: Actualización de ND con 40% de comisión (25.80 USD)...');
  const dataUsd = {
    accounts: [{ id: 'PROV-SEG', name: 'BARRY TOP SERVICES SRL', nit: '998877' }],
    creditNotes: [
      {
        id: 'NC-TEST-USD-01',
        ncNumber: 2035,
        ncCode: '#ncSV007',
        providerId: 'PROV-SEG',
        originDebitNoteId: 'ND-SEG-01',
        originDebitNoteCode: '#ndSV007',
        currency: 'USD',
        frozenExchangeRate: 12.0,
        totalAmount: 4.3, // Valor viejo
        totalAmountBob: 51.6,
        totalAmountUsd: 4.3,
        paidAmount: 0,
        balance: 4.3,
        balanceBob: 51.6, // Valor viejo
        balanceUsd: 4.3,  // Valor viejo
        saldo_pendiente: 4.3,
        status: 'IMPAGA',
        items: []
      }
    ]
  };

  const ndUsd = {
    id: 'ND-SEG-01',
    ndCode: '#ndSV007',
    ndNumber: 1031,
    issueDate: '2026-10-07',
    serviceType: 'SEGURO_VIAJE'
  };

  const itemsUsd = [
    {
      operatorId: 'PROV-SEG',
      operatorName: 'BARRY TOP SERVICES SRL',
      serviceType: 'SEGURO_VIAJE',
      currency: 'USD',
      fareAmount: 43,
      providerCommissionRate: 40,
      feeAmount: 0,
      totalAmount: 43
    }
  ];

  await creditNotesModule.generarCuentasPorPagar(dataUsd, ndUsd, itemsUsd, 12.0);

  const ncUsdActualizada = dataUsd.creditNotes.find(c => c.id === 'NC-TEST-USD-01');
  assert(ncUsdActualizada, 'La NC de seguro debe existir');
  assert.strictEqual(ncUsdActualizada.totalAmount, 25.8, 'Total NC debe ser 25.80');
  assert.strictEqual(ncUsdActualizada.balance, 25.8, 'Balance nativo debe ser 25.80');
  assert.strictEqual(ncUsdActualizada.balanceUsd, 25.8, 'Balance USD debe ser 25.80 (NO quedarse en 4.30)');
  assert.strictEqual(ncUsdActualizada.balanceBob, 309.6, 'Balance BOB debe ser 309.60 (25.80 * 12, NO quedarse en 51.60)');
  assert.strictEqual(ncUsdActualizada.status, 'IMPAGA');
  console.log(' -> OK: NC Seguro de Viaje actualizada con balanceUsd y balanceBob íntegros.');

  // --------------------------------------------------------------------------
  // TEST 3: Modal de Caja (getDocumentNormalizedBalances) protegido contra datos desfasados
  // --------------------------------------------------------------------------
  console.log('[TEST 3] Blindaje de getDocumentNormalizedBalances ante comprobantes impagos...');
  // Simular una NC que tuviera un remanente corrupto
  const ncCorruptaUsd = {
    currency: 'USD',
    totalAmount: 25.8,
    totalAmountBob: 309.6,
    totalAmountUsd: 25.8,
    paidAmount: 0,
    balance: 25.8,
    balanceUsd: 4.3, // Corrupto / viejo
    balanceBob: 51.6, // Corrupto / viejo
    frozenExchangeRate: 12.0
  };

  const balancesUsd = cashRegisterModule.getDocumentNormalizedBalances(ncCorruptaUsd, false, 12.0);
  assert.strictEqual(balancesUsd.balanceUsd, 25.8, 'Modal debe resolver saldo en USD de 25.80, NUNCA 4.30');
  assert.strictEqual(balancesUsd.balanceBob, 309.6, 'Modal debe resolver saldo en BOB de 309.60, NUNCA 51.60');

  const ncCorruptaBob = {
    currency: 'BOB',
    totalAmount: 1962,
    totalAmountBob: 1962,
    totalAmountUsd: 163.5,
    paidAmount: 0,
    balance: 1962,
    balanceBob: 981, // Corrupto / viejo
    balanceUsd: 81.75, // Corrupto / viejo
    frozenExchangeRate: 12.0
  };

  const balancesBob = cashRegisterModule.getDocumentNormalizedBalances(ncCorruptaBob, false, 12.0);
  assert.strictEqual(balancesBob.balanceBob, 1962, 'Modal debe resolver saldo en BOB de 1962, NUNCA 981');
  assert.strictEqual(balancesBob.balanceUsd, 163.5, 'Modal debe resolver saldo en USD de 163.50, NUNCA 81.75');
  console.log(' -> OK: getDocumentNormalizedBalances entrega el saldo íntegro de la deuda.');

  // --------------------------------------------------------------------------
  // TEST 4: Autoreparación de base de datos en arranque (healCreditNoteBalances)
  // --------------------------------------------------------------------------
  console.log('[TEST 4] Autoreparación de base de datos en arranque (healCreditNoteBalances)...');
  const baseCorrupta = {
    creditNotes: [
      {
        id: 'NC-OLD-01',
        currency: 'USD',
        totalAmount: 25.8,
        totalAmountBob: 309.6,
        totalAmountUsd: 25.8,
        paidAmount: 0,
        balance: 25.8,
        balanceUsd: 4.3, // Mal
        balanceBob: 51.6, // Mal
        status: 'IMPAGA'
      },
      {
        id: 'NC-OLD-02',
        currency: 'BOB',
        totalAmount: 1962,
        totalAmountBob: 1962,
        totalAmountUsd: 163.5,
        paidAmount: 0,
        balance: 1962,
        balanceBob: 981, // Mal
        status: 'IMPAGA'
      }
    ]
  };

  const changed = dbModule.healCreditNoteBalances(baseCorrupta);
  assert.strictEqual(changed, true, 'Debe detectar y reparar los registros corruptos');
  assert.strictEqual(baseCorrupta.creditNotes[0].balanceUsd, 25.8, 'NC-OLD-01 balanceUsd reparado a 25.80');
  assert.strictEqual(baseCorrupta.creditNotes[0].balanceBob, 309.6, 'NC-OLD-01 balanceBob reparado a 309.60');
  assert.strictEqual(baseCorrupta.creditNotes[1].balanceBob, 1962, 'NC-OLD-02 balanceBob reparado a 1962');
  console.log(' -> OK: healCreditNoteBalances reparó todos los comprobantes desfasados.');

  console.log('================================================================');
  console.log('>>> [PASS] TODOS LOS CHECKS DE RECONCILIACIÓN PASARON CON ÉXITO.');
  console.log('    Aplica para Boleto Aéreo, Seguro de Viaje y todos los servicios.');
  console.log('================================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('>>> [FAIL] Fallo en test de reconciliación:', err);
  process.exit(1);
});
