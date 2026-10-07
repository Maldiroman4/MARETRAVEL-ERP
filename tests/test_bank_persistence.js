/**
 * Test de persistencia y no-borrado de cuentas bancarias (MARETRAVEL ERP)
 * Regla Ponytail: Un único check ejecutable basado en asserts nativos, sin frameworks.
 *
 * Ejecución: node tests/test_bank_persistence.js
 */

const assert = require('assert');
const sqlDatabase = require('../server/sqlDatabase');

async function runTest() {
  console.log('>>> [TEST] Iniciando verificación de persistencia de Cuentas Bancarias...');

  // 1. Obtener estado actual
  const state = sqlDatabase.getFullState();
  assert(Array.isArray(state.financialAccounts), 'state.financialAccounts debe ser un array');
  assert(Array.isArray(state.bankAccounts), 'state.bankAccounts debe ser un array');

  const testId = 'BNK-TEST-' + Date.now().toString(36).toUpperCase();
  const testAccount = {
    id: testId,
    type: 'BANCO',
    bankName: 'Banco Unión S.A.',
    accountNumber: '10000098765432',
    accountType: 'CORRIENTE',
    currency: 'BOB',
    titularName: 'MARETRAVEL SRL TEST',
    initialBalance: 25000,
    isActive: true,
    createdAt: new Date().toLocaleString(),
    updatedAt: new Date().toLocaleString()
  };

  // 2. Simular caso crítico: El frontend registra en bankAccounts
  state.bankAccounts.unshift(testAccount);

  console.log(`[TEST 1] Guardando cuenta de prueba ${testId} en base de datos física...`);
  sqlDatabase.saveFullState(state);

  // 3. Simular recarga limpia (al día siguiente / F5): getFullState directo desde SQLite
  console.log('[TEST 2] Simulando recarga limpia (GET /api/db) desde SQLite...');
  const reloaded = sqlDatabase.getFullState();

  const foundInBank = (reloaded.bankAccounts || []).find(a => a.id === testId);
  const foundInFin = (reloaded.financialAccounts || []).find(a => a.id === testId);

  assert(foundInBank, `ERROR CRÍTICO: La cuenta ${testId} DESAPARECIÓ de bankAccounts tras la recarga!`);
  assert(foundInFin, `ERROR CRÍTICO: La cuenta ${testId} no se persistió en financial_accounts table!`);
  assert.strictEqual(foundInBank.bankName, 'Banco Unión S.A.', 'Nombre de banco no coincide');
  assert.strictEqual(foundInBank.accountNumber, '10000098765432', 'Número de cuenta no coincide');
  assert.strictEqual(foundInBank.currency, 'BOB', 'Moneda no coincide');
  assert.strictEqual(foundInBank.isActive, true, 'Estado isActive debe ser true');

  console.log(' -> Cuenta persistida correctamente en SQLite y visible en bankAccounts.');

  // 4. Probar edición y alternancia de estado
  console.log('[TEST 3] Probando alternancia de estado a inactiva y actualización...');
  foundInBank.isActive = false;
  foundInBank.accountNumber = '10000098769999';
  sqlDatabase.saveFullState(reloaded);

  const reloaded2 = sqlDatabase.getFullState();
  const foundEdited = (reloaded2.bankAccounts || []).find(a => a.id === testId);
  assert(foundEdited, 'La cuenta debe existir tras edición');
  assert.strictEqual(foundEdited.isActive, false, 'El estado inactivo debe persistir');
  assert.strictEqual(foundEdited.accountNumber, '10000098769999', 'El número editado debe persistir');

  console.log(' -> Edición y cambio de estado persistidos correctamente.');

  // 5. Test de persistencia de Cajas de Efectivo (type: 'EFECTIVO')
  console.log('[TEST 4] Probando persistencia y proyección de Caja Efectivo (type: EFECTIVO)...');
  const cashTestId = 'CSH-TEST-' + Date.now().toString(36).toUpperCase();
  const testCashAccount = {
    id: cashTestId,
    type: 'EFECTIVO',
    bankName: 'Caja Efectivo BOB',
    accountNumber: 'CAJA-BOB',
    accountType: 'EFECTIVO',
    currency: 'BOB',
    titularName: 'Cajero Principal',
    initialBalance: 5000,
    isActive: true,
    createdAt: new Date().toLocaleString(),
    updatedAt: new Date().toLocaleString()
  };

  reloaded2.bankAccounts.unshift(testCashAccount);
  sqlDatabase.saveFullState(reloaded2);

  const reloadedWithCash = sqlDatabase.getFullState();
  const foundCashInBank = (reloadedWithCash.bankAccounts || []).find(a => a.id === cashTestId);
  const foundCashInFin = (reloadedWithCash.financialAccounts || []).find(a => a.id === cashTestId);

  assert(foundCashInFin, `ERROR: La caja ${cashTestId} no se guardó en financialAccounts!`);
  assert(foundCashInBank, `ERROR: La caja ${cashTestId} (type EFECTIVO) no se proyectó en bankAccounts tras recarga!`);
  assert.strictEqual(foundCashInBank.bankName, 'Caja Efectivo BOB');
  assert.strictEqual(foundCashInBank.accountNumber, 'CAJA-BOB');
  assert.strictEqual(foundCashInBank.type, 'EFECTIVO');
  console.log(' -> Caja de efectivo persistida y proyectada en bankAccounts correctamente.');

  // 6. Limpieza de registros de prueba
  console.log('[TEST 5] Limpiando registros de prueba...');
  reloadedWithCash.bankAccounts = reloadedWithCash.bankAccounts.filter(a => a.id !== testId && a.id !== cashTestId);
  reloadedWithCash.financialAccounts = reloadedWithCash.financialAccounts.filter(a => a.id !== testId && a.id !== cashTestId);
  sqlDatabase.saveFullState(reloadedWithCash);

  const finalCheck = sqlDatabase.getFullState();
  assert(!finalCheck.bankAccounts.some(a => a.id === testId || a.id === cashTestId), 'Los registros de prueba deben haber sido limpiados');

  console.log('================================================================');
  console.log('>>> [PASS] TODOS LOS CHECKS DE PERSISTENCIA PASARON CON ÉXITO.');
  console.log('    Tanto cuentas bancarias como cajas de efectivo se persisten y proyectan.');
  console.log('================================================================');
}

runTest().catch(err => {
  console.error('>>> [FAIL] Fallo en test de persistencia:', err);
  process.exit(1);
});
