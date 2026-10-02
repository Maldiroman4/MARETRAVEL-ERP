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

  // 5. Limpieza del registro de prueba
  console.log('[TEST 4] Limpiando registro de prueba...');
  reloaded2.bankAccounts = reloaded2.bankAccounts.filter(a => a.id !== testId);
  reloaded2.financialAccounts = reloaded2.financialAccounts.filter(a => a.id !== testId);
  sqlDatabase.saveFullState(reloaded2);

  const finalCheck = sqlDatabase.getFullState();
  assert(!finalCheck.bankAccounts.some(a => a.id === testId), 'El registro de prueba debe haber sido limpiado');

  console.log('================================================================');
  console.log('>>> [PASS] TODOS LOS CHECKS DE PERSISTENCIA PASARON CON ÉXITO.');
  console.log('    Las cuentas bancarias se persisten físicamente y no se borran.');
  console.log('================================================================');
}

runTest().catch(err => {
  console.error('>>> [FAIL] Fallo en test de persistencia:', err);
  process.exit(1);
});
