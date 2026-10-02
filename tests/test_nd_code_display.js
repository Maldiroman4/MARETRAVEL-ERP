/**
 * Test unitario para verificar la visualización consistente del código amigable
 * (#ndVI..., #ndBA..., #ndHO..., #nc...) en recibos de pago, amortización y glosas.
 */
const assert = require('assert');
const fs = require('fs');

// Cargar definición de maretravelCodes desde js/db.js
const dbJsContent = fs.readFileSync('js/db.js', 'utf8');
const vm = require('vm');
const sandbox = { window: {}, console: console };
vm.createContext(sandbox);

// Extraer el objeto window.maretravelCodes
const codesBlock = dbJsContent.match(/window\.maretravelCodes\s*=\s*\{[\s\S]*?\n\};/);
assert(codesBlock, 'window.maretravelCodes debe existir en js/db.js');
vm.runInContext(codesBlock[0], sandbox);

const maretravelCodes = sandbox.window.maretravelCodes;
assert(maretravelCodes, 'maretravelCodes debe estar definido');

console.log('>>> [TEST 1] Verificando reemplazo de códigos en glosa con conceptoConCodigo...');
// Caso 1: ND en glosa de recibo
const glosaNd = 'Abono a ND #1008 - ADALID MORALES BARDALES - Cobro total ND';
const resultNd = maretravelCodes.conceptoConCodigo(glosaNd, '#ndVI003');
assert.strictEqual(
  resultNd,
  'Abono a #ndVI003 - ADALID MORALES BARDALES - Cobro total ND',
  'Debe reemplazar "ND #1008" por "#ndVI003" sin alterar el resto de la glosa'
);
console.log(' -> OK: Glosa ND reemplazada correctamente:', resultNd);

// Caso 2: NC en concepto
const glosaNc = 'Liquidación automática por NC #2006';
const resultNc = maretravelCodes.conceptoConCodigo(glosaNc, '#ncHO001');
assert.strictEqual(
  resultNc,
  'Liquidación automática por #ncHO001',
  'Debe reemplazar "NC #2006" por "#ncHO001"'
);
console.log(' -> OK: Glosa NC reemplazada correctamente:', resultNc);

// Caso 3: Boleto Aéreo (#ndBA001)
const glosaBa = 'Abono a ND #1001 - CARLOS';
const resultBa = maretravelCodes.conceptoConCodigo(glosaBa, '#ndBA001');
assert.strictEqual(resultBa, 'Abono a #ndBA001 - CARLOS');
console.log(' -> OK: Boleto aéreo reemplazado correctamente:', resultBa);

// Caso 4: Hotel (#ndHO001)
const glosaHo = 'Liquidación total de ND #1005';
const resultHo = maretravelCodes.conceptoConCodigo(glosaHo, '#ndHO001');
assert.strictEqual(resultHo, 'Liquidación total de #ndHO001');
console.log(' -> OK: Hotel reemplazado correctamente:', resultHo);

// Caso 5: Documento sin código amigable (fallback al formato por defecto)
const glosaSinCodigo = 'Abono a ND #9999';
const resultSinCodigo = maretravelCodes.conceptoConCodigo(glosaSinCodigo, '');
assert.strictEqual(resultSinCodigo, 'Abono a ND #9999');
console.log(' -> OK: Fallback sin código preserva el texto original');

console.log('================================================================');
console.log('>>> [PASS] TODOS LOS CHECKS DE CÓDIGOS AMIGABLES PASARON CON ÉXITO.');
console.log('================================================================');
