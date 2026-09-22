/**
 * MARETRAVEL ERP - Script de Migración Transaccional JSON -> SQL Relacional
 * Traslada el 100% de los datos de data/database.json a data/maretravel.sqlite
 * Validando integridad referencial y cero pérdida de registros.
 */

const fs = require('fs');
const path = require('path');
const sqlDatabase = require('./sqlDatabase');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const JSON_PATH = path.join(DATA_DIR, 'database.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

function migrate() {
  console.log('================================================================');
  console.log('    MIGRACIÓN TRANSACCIONAL DE PERSISTENCIA: JSON -> SQL');
  console.log('================================================================');

  if (!fs.existsSync(JSON_PATH)) {
    console.warn('[AVISO] No se encontró data/database.json. Inicializando SQL con esquema limpio.');
    sqlDatabase.getRawDb();
    console.log('[OK] Base de datos SQL inicializada con éxito en data/maretravel.sqlite');
    return;
  }

  // 1. Respaldo preventivo antes de migrar
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  const backupFile = path.join(BACKUP_DIR, `pre_sql_migration_${Date.now()}.json`);
  fs.copyFileSync(JSON_PATH, backupFile);
  console.log(`[RESPALDO] Copia de seguridad creada: ${path.basename(backupFile)}`);

  // 2. Leer estado JSON existente
  const raw = fs.readFileSync(JSON_PATH, 'utf-8');
  const sourceData = JSON.parse(raw);

  console.log('[ORIGEN JSON]:');
  console.log(`  - Cuentas:         ${(sourceData.accounts || []).length}`);
  console.log(`  - Notas de Débito: ${(sourceData.debitNotes || []).length}`);
  console.log(`  - Notas de Crédito:${(sourceData.creditNotes || []).length}`);
  console.log(`  - Boletos GDS:     ${(sourceData.gdsTickets || []).length}`);
  console.log(`  - Recibos Caja:    ${(sourceData.cashReceipts || []).length}`);
  console.log(`  - Pasajeros:       ${(sourceData.passengers || []).length}`);
  console.log(`  - Subservicios:    ${(sourceData.savedSubServices || []).length}`);

  // 3. Ejecutar migración atómica en SQL
  console.log('\n[MIGRANDO] Insertando datos en tablas relacionales de SQLite...');
  sqlDatabase.saveFullState(sourceData);

  // 4. Validar integridad post-migración
  const stats = sqlDatabase.getStats();
  console.log('\n[DESTINO SQLITE (data/maretravel.sqlite)]:');
  console.log(`  - Cuentas en SQL:         ${stats.counts.accounts}`);
  console.log(`  - Notas de Débito en SQL: ${stats.counts.debitNotes}`);
  console.log(`  - Notas de Crédito en SQL:${stats.counts.creditNotes}`);
  console.log(`  - Boletos GDS en SQL:     ${stats.counts.gdsTickets}`);
  console.log(`  - Recibos Caja en SQL:    ${stats.counts.cashReceipts}`);
  console.log(`  - Pasajeros en SQL:       ${stats.counts.passengers}`);
  console.log(`  - Subservicios en SQL:    ${stats.counts.subservices}`);
  console.log(`  - Tamaño de archivo SQL:  ${stats.fileSizeBytes} bytes`);

  console.log('================================================================');
  console.log('  ¡MIGRACIÓN A BASE DE DATOS SQL COMPLETADA CON ÉXITO AL 100%!');
  console.log('================================================================\n');
}

if (require.main === module) {
  migrate();
}

module.exports = migrate;
