/**
 * MARETRAVEL ERP - Servidor de Persistencia Transaccional en Disco y Endpoints REST
 * Garantiza guardado atómico y sincrónico en data/database.json.
 * Prohibido responder 200 OK si no se confirma la escritura física en almacenamiento persistente.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const sqlDatabase = require('./server/sqlDatabase');
const tursoDatabase = require('./server/tursoDatabase');

// Carga .env si existe (credenciales Turso). API nativa de Node (>=21.7), sin dependencias externas.
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch (_) {}

// Capa de persistencia activa: Turso (nube) si hay credenciales, si no SQLite local.
// Un solo punto de decisión: todas las rutas pasan por readDbSync/saveDbSync.
const persistence = tursoDatabase.isAvailable() ? tursoDatabase : sqlDatabase;

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'database.json');
const SQLITE_PATH = path.join(DATA_DIR, 'maretravel.sqlite');
const SEED_PATH = path.join(DATA_DIR, 'seedData.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// Asegurar directorios de persistencia física
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const INITIAL_SEED_DATABASE = {
  systemSettings: {
    agencyName: 'MARETRAVEL',
    agencyCommercialName: 'MARETRAVEL - Agencia de Viajes y Turismo',
    agencyNit: '1028374021',
    agencyAddress: 'Av. 16 de Julio #1440, Edif. San Pablo Piso 4, Of. 402, La Paz - Bolivia',
    agencyPhone: '+591 (2) 244-1234 / Cel: 772-98765',
    agencyEmail: 'administracion@maretravel.bo',
    vatRate: 14.94,
    gdsLookbackDays: 30,
    activeExchangeBuy: 6.86,
    activeExchangeSell: 6.96
  },
  currentUser: {
    id: 'USR-001',
    name: 'Luis',
    username: 'luis',
    role: 'ADMIN',
    email: 'luis@maretravel.bo'
  },
  exchangeRates: [
    {
      id: 'TC-001',
      date: new Date().toISOString().split('T')[0],
      buyRate: 6.86,
      sellRate: 6.96,
      createdById: 'USR-001',
      createdByName: 'Luis',
      createdAt: new Date().toLocaleString()
    }
  ],
  paymentMethods: [
    { id: 'PM-01', code: 'BS-01', name: 'Efectivo Moneda Nacional (BOB)', currency: 'BOB', type: 'COBRANZAS', bankAccount: '-', status: 'ACTIVO' },
    { id: 'PM-02', code: 'US-01', name: 'Efectivo Dólares Americanos (USD)', currency: 'USD', type: 'COBRANZAS', bankAccount: '-', status: 'ACTIVO' },
    { id: 'PM-03', code: 'BS-02', name: 'Banco Nacional de Bolivia BNB BOB', currency: 'BOB', type: 'AMBOS', bankAccount: 'Cta. Cte. 100-29384-2', status: 'ACTIVO' },
    { id: 'PM-04', code: 'BS-03', name: 'Banco Mercantil Santa Cruz BMSC BOB', currency: 'BOB', type: 'AMBOS', bankAccount: 'Cta. Cte. 401-09823-1', status: 'ACTIVO' },
    { id: 'PM-05', code: 'US-02', name: 'Banco Bisa USD', currency: 'USD', type: 'AMBOS', bankAccount: 'Cta. Dólares 029-91823-7', status: 'ACTIVO' },
    { id: 'PM-06', code: 'BS-04', name: 'Cobro Simple QR BNB BOB', currency: 'BOB', type: 'COBRANZAS', bankAccount: 'Cta. Cte. 100-29384-2', status: 'ACTIVO' },
    { id: 'PM-07', code: 'BS-05', name: 'Cheque de Gerencia BOB', currency: 'BOB', type: 'COBRANZAS', bankAccount: '-', status: 'ACTIVO' },
    { id: 'PM-08', code: 'BS-06', name: 'Banco Ganadero S.A. BOB', currency: 'BOB', type: 'AMBOS', bankAccount: 'Cta. Cte. 1051-20948-3', status: 'ACTIVO' },
    { id: 'PM-09', code: 'US-03', name: 'Binance P2P (USDT / Cripto)', currency: 'USD', type: 'AMBOS', bankAccount: 'Wallet ID: 89410293 (Pay)', status: 'ACTIVO' }
  ],
  financialAccounts: [
    { id: 'ACC-BNK-BMSC-01', type: 'BANCO', bankName: 'Banco Mercantil Santa Cruz BMSC', accountNumber: '401-09823-1', accountType: 'CORRIENTE', titularName: 'MARETRAVEL S.R.L.', currency: 'BOB', isActive: true, currentBalance: 45200.00, createdAt: '16/9/2026, 10:00:00' },
    { id: 'ACC-BNK-GANADERO-02', type: 'BANCO', bankName: 'Banco Ganadero S.A.', accountNumber: '1051-20948-3', accountType: 'CORRIENTE', titularName: 'MARETRAVEL S.R.L.', currency: 'BOB', isActive: true, currentBalance: 32850.50, createdAt: '16/9/2026, 10:00:00' },
    { id: 'ACC-BNK-BISA-USD-03', type: 'BANCO', bankName: 'Banco Bisa S.A.', accountNumber: '029-91823-7', accountType: 'CORRIENTE', titularName: 'MARETRAVEL S.R.L.', currency: 'USD', isActive: true, currentBalance: 12400.00, createdAt: '16/9/2026, 10:00:00' },
    { id: 'ACC-DIG-BINANCE-04', type: 'BINANCE', bankName: 'Binance Pay / P2P', accountNumber: '89410293', binanceId: '89410293', walletAddress: '0x89410293MareTravelPayWallet', titularName: 'MARETRAVEL CRYPTO SRL', currency: 'USDT', isActive: true, currentBalance: 8500.00, createdAt: '16/9/2026, 10:00:00' },
    { id: 'ACC-CSH-CENTRAL-BOB-05', type: 'EFECTIVO', bankName: 'Caja Central Oficina General', cashDeskName: 'Caja General Oficina Central BOB', accountNumber: 'CAJA-BOB-01', custodianName: 'Luis (Cajero Principal)', titularName: 'MARETRAVEL S.R.L. (Custodio: Luis)', currency: 'BOB', isActive: true, currentBalance: 5000.00, createdAt: '16/9/2026, 10:00:00' },
    { id: 'ACC-CSH-CENTRAL-USD-06', type: 'EFECTIVO', bankName: 'Caja Central Oficina Dólares', cashDeskName: 'Caja General Oficina Central USD', accountNumber: 'CAJA-USD-01', custodianName: 'Luis (Cajero Principal)', titularName: 'MARETRAVEL S.R.L. (Custodio: Luis)', currency: 'USD', isActive: true, currentBalance: 2100.00, createdAt: '16/9/2026, 10:00:00' }
  ],
  bankAccounts: [
    { id: 'ACC-BNK-GANADERO-02', bankName: 'Banco Ganadero S.A.', accountNumber: '1051-20948-3', accountType: 'CORRIENTE', currency: 'BOB', titularName: 'MARETRAVEL S.R.L.', isActive: true, createdAt: '16/9/2026, 12:00:00', updatedAt: '16/9/2026, 12:00:00' },
    { id: 'ACC-BNK-BMSC-01', bankName: 'Banco Mercantil Santa Cruz BMSC', accountNumber: '401-09823-1', accountType: 'CORRIENTE', currency: 'BOB', titularName: 'MARETRAVEL S.R.L.', isActive: true, createdAt: '16/9/2026, 12:00:00', updatedAt: '16/9/2026, 12:00:00' },
    { id: 'ACC-BNK-BISA-USD-03', bankName: 'Banco Bisa S.A.', accountNumber: '029-91823-7', accountType: 'CORRIENTE', currency: 'USD', titularName: 'MARETRAVEL S.R.L.', isActive: true, createdAt: '16/9/2026, 12:00:00', updatedAt: '16/9/2026, 12:00:00' }
  ],
  accounts: [],
  accountHistory: [],
  companyContacts: [],
  gdsTickets: [],
  debitNotes: [],
  creditNotes: [],
  cashReceipts: [],
  cashTransactions: [],
  expenses: [],
  travelReminders: [],
  auditLog: [],
  accountingModifications: [],
  otherIncomes: [],
  providerPayments: [],
  serviceTypes: [
    { id: 'SRV-BOLETO', code: 'BOLETO_AEREO', name: 'BOLETO AÉREO / GDS', category: 'AÉREO' },
    { id: 'SRV-HOTEL', code: 'HOTEL', name: 'HOTEL / HOSPEDAJE', category: 'HOSPEDAJE' },
    { id: 'SRV-PAQ-TUR', code: 'PAQUETE_TURISTICO', name: 'PAQUETE TURÍSTICO', category: 'PAQUETES' },
    { id: 'SRV-PAQ-CRU', code: 'PAQUETE_CRUCERO', name: 'PAQUETE CRUCERO', category: 'PAQUETES' },
    { id: 'SRV-PAQ-CON', code: 'PAQUETE_CONCIERTO', name: 'PAQUETE CONCIERTO', category: 'PAQUETES' },
    { id: 'SRV-VISA', code: 'ASESORAMIENTO_VISAS', name: 'ASESORAMIENTO DE VISAS', category: 'VISAS' },
    { id: 'SRV-FA', code: 'CERTIFICACION_FA', name: 'CERTIFICACIÓN INTERNACIONAL FA', category: 'CERTIFICACIONES' },
    { id: 'SRV-AUTO', code: 'RENT_A_CAR', name: 'RENT A CAR', category: 'VEHÍCULOS' },
    { id: 'SRV-SEG', code: 'SEGURO_VIAJE', name: 'SEGURO DE VIAJE', category: 'SEGUROS' },
    { id: 'SRV-OTRO', code: 'OTRO', name: 'OTRO SERVICIO', category: 'VARIOS' }
  ]
};

// ============================================================================
// GESTOR DE PERSISTENCIA TRANSACCIONAL EN DISCO
/**
 * Lectura y Conversión en Backend del Logo Oficial a Base64.
 * Previene que las rutas relativas fallen en diálogos de impresión nativos, iframes o generadores PDF.
 */
function obtenerLogoBase64() {
  try {
    // Busca la imagen dentro de la carpeta assets (logo.png o logo.jpg)
    const rutaLogoPng = path.join(__dirname, 'assets', 'logo.png');
    if (fs.existsSync(rutaLogoPng)) {
      const buffer = fs.readFileSync(rutaLogoPng);
      return `data:image/png;base64,${buffer.toString('base64')}`;
    }
    const rutaLogoJpg = path.join(__dirname, 'assets', 'logo.jpg');
    if (fs.existsSync(rutaLogoJpg)) {
      const buffer = fs.readFileSync(rutaLogoJpg);
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    }
  } catch (err) {
    console.error('Error al cargar logo:', err);
  }
  return ''; // Fallback si no existe
}

/**
 * Obtiene la plantilla semilla de datos de prueba desde seedData.json o la constante inicial.
 */
function getSeedData() {
  if (fs.existsSync(SEED_PATH)) {
    try {
      const raw = fs.readFileSync(SEED_PATH, 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[SEED] Error leyendo data/seedData.json:', e.message);
    }
  }
  return INITIAL_SEED_DATABASE;
}

/**
 * Lee la base de datos completa directamente desde la base de datos SQL (Turso o SQLite).
 */
async function readDb() {
  try {
    return await persistence.getFullState();
  } catch (err) {
    console.error('[DB READ ERROR]:', err);
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
    return getSeedData();
  }
}

/**
 * Guarda sincrónica y atómicamente la base de datos en la base de datos SQL (Turso o SQLite).
 */
async function saveDb(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Datos inválidos para persistencia en base de datos.');
  }
  // 1. Persistencia transaccional (Turso nube o SQLite local según capa activa)
  await persistence.saveFullState(data);

  // 2. Respaldo snapshot en JSON para redundancia
  try {
    const tempPath = DB_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_PATH);
  } catch (e) {
    console.warn('[AVISO] No se pudo escribir snapshot JSON de respaldo:', e.message);
  }
  return true;
}

/**
 * Crea una copia de respaldo fechada en data/backups/
 */
async function createBackupCopy(prefix = 'backup') {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `${prefix}_${ts}.json`;
  const targetPath = path.join(BACKUP_DIR, backupFilename);
  try {
    const full = await persistence.getFullState();
    fs.writeFileSync(targetPath, JSON.stringify(full, null, 2), 'utf-8');
    return targetPath;
  } catch (_) {
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, targetPath);
      return targetPath;
    }
  }
  return null;
}

// Carga y validación inicial de persistencia al levantar el servidor
(async () => {
  try {
    if (persistence === tursoDatabase) {
      // Modo nube (Turso): garantizar esquema + migración única local→nube
      const ok = await tursoDatabase.init();
      if (ok) {
        const cloudStats = await tursoDatabase.getStats();
        if (cloudStats.counts.accounts === 0 && fs.existsSync(SQLITE_PATH)) {
          console.log('[TURSO CLOUD] Nube vacía. Sembrando desde SQLite local (data/maretravel.sqlite)...');
          await tursoDatabase.saveFullState(sqlDatabase.getFullState());
          console.log('[TURSO CLOUD] Datos locales sembrados en la nube. Cero pérdida de datos.');
        } else {
          console.log(`[TURSO CLOUD] Activa: ${process.env.TURSO_DATABASE_URL} (${cloudStats.counts.accounts} cuentas, ${cloudStats.counts.debitNotes} NDs).`);
        }
      }
    } else {
      const stats = sqlDatabase.getStats();
      if (stats.counts.accounts === 0 && fs.existsSync(DB_PATH)) {
        console.log('[INICIO] Base de datos SQL vacía. Migrando automáticamente desde data/database.json...');
        require('./server/migrateJsonToSql')();
      } else {
        console.log(`[INICIO SQL] Base de datos relacional SQLite activa: ${stats.file} (${stats.counts.accounts} cuentas, ${stats.counts.debitNotes} NDs).`);
      }
    }
  } catch (err) {
    console.error('[ERROR CRÍTICO] Error al inicializar almacenamiento:', err);
  }
})();

// ============================================================================
// REGLAS Y VALIDACIONES DE SEGURIDAD (GUARDRAILS)
// ============================================================================

function validateFinancialAccount(account) {
  if (!account || typeof account !== 'object') {
    return { valid: false, errors: ['La cuenta financiera no es válida o no fue proporcionada.'] };
  }
  const errors = [];
  const type = account.type || 'BANCO';

  if (account.isActive === false) {
    errors.push('La cuenta financiera se encuentra INACTIVA. Solo se permiten cuentas con estado ACTIVA.');
  }

  if (type === 'BANCO') {
    if (!account.bankName || account.bankName.trim().length < 3) {
      errors.push('La cuenta bancaria debe especificar la entidad bancaria.');
    }
    if (!account.accountNumber || account.accountNumber.trim().length < 5) {
      errors.push('El número de cuenta bancaria debe contener al menos 5 caracteres.');
    }
    if (!account.titularName || account.titularName.trim().length < 3) {
      errors.push('Debe registrarse el titular oficial de la cuenta bancaria.');
    }
    if (!['BOB', 'USD'].includes(account.currency)) {
      errors.push('La moneda de la cuenta bancaria debe ser BOB o USD.');
    }
  } else if (type === 'BINANCE') {
    const hasBinanceId = account.binanceId && account.binanceId.trim().length >= 5;
    const hasWallet = account.walletAddress && account.walletAddress.trim().length >= 5;
    const hasAccNum = account.accountNumber && account.accountNumber.trim().length >= 5;
    if (!hasBinanceId && !hasWallet && !hasAccNum) {
      errors.push('La cuenta Binance/Cripto debe registrar Binance ID o Wallet Address válida (mín. 5 caracteres).');
    }
    if (!['USDT', 'USD'].includes(account.currency)) {
      errors.push('La moneda de la cuenta digital debe ser USDT o USD.');
    }
  } else if (type === 'EFECTIVO') {
    const name = account.cashDeskName || account.bankName || account.name;
    if (!name || name.trim().length < 3) {
      errors.push('La caja física debe tener un nombre asignado (ej. Caja Central o Caja Chica).');
    }
    if (!account.custodianName || account.custodianName.trim().length < 3) {
      errors.push('La caja física debe tener asignado un responsable o custodio activo.');
    }
    if (!['BOB', 'USD'].includes(account.currency)) {
      errors.push('La moneda de la caja física debe ser BOB o USD.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Helper para parsear cuerpo de petición HTTP (Promesa)
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body || !body.trim()) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (err) {
        reject(new Error('JSON malformado en el cuerpo de la petición: ' + err.message));
      }
    });
    req.on('error', reject);
  });
}

// ============================================================================
// SERVIDOR HTTP CON ENDPOINTS REST TRANSACCIONALES
// ============================================================================

// ----------------------------------------------------------------------------
// SÚPER USUARIO Y PAPELERA (borrado suave + restauración + purga definitiva)
// ----------------------------------------------------------------------------
// El acceso a la papelera se autentica contra SUPER_ADMIN_USERNAME / SUPER_ADMIN_PASSWORD
// del entorno; si no están configurados, la papelera queda deshabilitada (403).
const superTokens = new Set();

function isSuperAuthorized(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return superTokens.has(token);
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const DELETE_FIELDS = ['deleted', 'deletedAt', 'deletedBy'];

// Marca un registro como eliminado (soft delete → papelera). Devuelve true si lo marcó.
function softDeleteRecord(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.deleted === true) return false;
  record.deleted = true;
  record.deletedAt = record.deletedAt || new Date().toLocaleString();
  record.deletedBy = record.deletedBy || 'Usuario';
  return true;
}

// Extrae los registros con flag soft-delete del estado crudo, agrupados por tipo.
function collectTrash(state) {
  const items = [];
  for (const [type, arr] of Object.entries(state)) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (item && item.deleted === true) {
        items.push({
          type,
          id: item.id,
          label: item.name || item.ndNumber || item.ticketNumber || item.accountName || item.passengerName || item.id,
          deletedAt: item.deletedAt || null,
          deletedBy: item.deletedBy || null
        });
      }
    }
  }
  return items;
}

const server = http.createServer(async (req, res) => {
  // CORS universal
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost:3000'));
  const pathname = parsedUrl.pathname;

  // --------------------------------------------------------------------------
  // 0. SÚPER USUARIO Y PAPELERA (solo con token de súper usuario)
  // --------------------------------------------------------------------------

  // Login del súper usuario: POST /api/super/login { username, password } → { token }
  if (pathname === '/api/super/login' && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const envUser = process.env.SUPER_ADMIN_USERNAME;
      const envPass = process.env.SUPER_ADMIN_PASSWORD;
      if (envUser && envPass && body.username === envUser && body.password === envPass) {
        const token = crypto.randomUUID();
        superTokens.add(token);
        sendJson(res, 200, { success: true, token });
      } else {
        sendJson(res, 401, { error: 'Credenciales de súper usuario inválidas.' });
      }
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // Listar papelera: GET /api/papelera
  if (pathname === '/api/papelera' && req.method === 'GET') {
    if (!isSuperAuthorized(req)) {
      sendJson(res, 401, { error: 'Acceso denegado: se requiere súper usuario.' });
      return;
    }
    try {
      const items = collectTrash(await persistence.getFullState());
      sendJson(res, 200, { success: true, items });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // Restaurar: POST /api/papelera/restore { type, id } → limpia el flag, vuelve a ser visible
  if (pathname === '/api/papelera/restore' && req.method === 'POST') {
    if (!isSuperAuthorized(req)) {
      sendJson(res, 401, { error: 'Acceso denegado: se requiere súper usuario.' });
      return;
    }
    try {
      const body = await parseRequestBody(req);
      const state = await persistence.getFullState();
      const arr = Array.isArray(state[body.type]) ? state[body.type] : null;
      const rec = arr ? arr.find(x => x && x.id === body.id) : null;
      if (!rec) {
        sendJson(res, 404, { error: `Registro ${body.type}/${body.id} no encontrado en la papelera.` });
        return;
      }
      DELETE_FIELDS.forEach(f => delete rec[f]);
      await saveDb(state);
      sendJson(res, 200, { success: true, record: rec, type: body.type });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // Purga definitiva: POST /api/papelera/purge { type, id } → borra de DB SQL, snapshot JSON y todo
  if (pathname === '/api/papelera/purge' && req.method === 'POST') {
    if (!isSuperAuthorized(req)) {
      sendJson(res, 401, { error: 'Acceso denegado: se requiere súper usuario.' });
      return;
    }
    try {
      // Allowlist de tipos → tablas (nunca se interpolan valores del usuario en SQL)
      const TABLE_BY_TYPE = {
        accounts: 'accounts',
        debitNotes: 'debit_notes',
        creditNotes: 'credit_notes',
        gdsTickets: 'gds_tickets',
        cashReceipts: 'cash_receipts',
        financialAccounts: 'financial_accounts',
        passengers: 'passengers'
      };
      const body = await parseRequestBody(req);
      const state = await persistence.getFullState();
      const arr = Array.isArray(state[body.type]) ? state[body.type] : null;
      if (!arr) {
        sendJson(res, 404, { error: `Tipo ${body.type} inválido.` });
        return;
      }
      state[body.type] = arr.filter(x => x && x.id !== body.id);
      // Cascada: purgar una ND también purga sus NCs vinculadas
      if (body.type === 'debitNotes') {
        state.creditNotes = (state.creditNotes || []).filter(nc => nc.originDebitNoteId !== body.id);
      }
      await saveDb(state); // snapshot JSON + upserts (el prune conserva filas con flag soft-delete)

      // Borrado físico real: el prune respeta el flag deleted:true de la papelera,
      // así que la fila se elimina directamente de SQLite/Turso.
      const table = TABLE_BY_TYPE[body.type];
      if (table) {
        await persistence.deleteRow(table, 'id', body.id);
        if (body.type === 'debitNotes') {
          await persistence.deleteRow('credit_notes', 'origin_debit_note_id', body.id);
        }
      }
      sendJson(res, 200, { success: true, purgedId: body.id });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // --------------------------------------------------------------------------
  // 1. ENDPOINT PRINCIPAL DE BASE DE DATOS: /api/db (GET / POST)
  // --------------------------------------------------------------------------

  // GET /api/db: Retorna el contenido real y actualizado desde disco
  if (pathname === '/api/db' && req.method === 'GET') {
    try {
      const dbData = await readDb();
      if (dbData && dbData.systemSettings) {
        dbData.systemSettings.logoBase64 = obtenerLogoBase64();
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(dbData));
    } catch (err) {
      console.error('[ERROR] Fallo al leer base de datos:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Error al leer base de datos: ' + err.message }));
    }
    return;
  }

  // POST /api/db: Guarda atómicamente el estado completo en disco
  if (pathname === '/api/db' && req.method === 'POST') {
    try {
      const parsed = await parseRequestBody(req);

      // Guardrail financiero
      const financialAccounts = parsed.financialAccounts || [];
      const bankAccounts = parsed.bankAccounts || [];
      const allAccounts = [...financialAccounts, ...bankAccounts];

      if (Array.isArray(parsed.cashReceipts)) {
        for (const rcp of parsed.cashReceipts) {
          if (rcp.status === 'VALIDO' && rcp.totalPaidBob > 0) {
            const accId = rcp.bankAccountId || rcp.depositAccountId || rcp.financialAccountId;
            if (accId && accId !== 'CAJA_EFECTIVO') {
              const targetAcc = allAccounts.find(a => a.id === accId);
              if (targetAcc) {
                const check = validateFinancialAccount(targetAcc);
                if (!check.valid) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    error: 'Bloqueo de Seguridad Guardrail: La cuenta financiera destino no es válida o está incompleta.',
                    details: check.errors
                  }));
                  return;
                }
              }
            }
          }
        }
      }

      // PERSISTENCIA FÍSICA OBLIGATORIA
      await saveDb(parsed);

      console.log(`[${new Date().toLocaleTimeString()}] Base de datos confirmada y persistida exitosamente.`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        persisted: true,
        timestamp: new Date().toISOString(),
        summary: {
          debitNotes: (parsed.debitNotes || []).length,
          creditNotes: (parsed.creditNotes || []).length,
          tickets: (parsed.gdsTickets || []).length,
          accounts: (parsed.accounts || []).length,
          receipts: (parsed.cashReceipts || []).length
        }
      }));
    } catch (err) {
      console.error('[ERROR] Error crítico al persistir base de datos:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Fallo al guardar base de datos: ' + err.message }));
    }
    return;
  }

  // --------------------------------------------------------------------------
  // 2. ENDPOINTS REST GRANULARES (Persistencia Directa)
  // --------------------------------------------------------------------------

  // OPERACIONES / NOTAS DE DÉBITO: /api/operaciones
  if (pathname === '/api/operaciones') {
    const db = await readDb();
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(db.debitNotes || []));
      return;
    }
    if (req.method === 'POST') {
      try {
        const item = await parseRequestBody(req);
        db.debitNotes = db.debitNotes || [];
        const existingIdx = db.debitNotes.findIndex(n => n.id === item.id);
        if (existingIdx !== -1) {
          db.debitNotes[existingIdx] = { ...db.debitNotes[existingIdx], ...item, updatedAt: new Date().toLocaleString() };
        } else {
          db.debitNotes.unshift({ ...item, createdAt: new Date().toLocaleString() });
        }
        await saveDb(db);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, item }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  if (pathname.startsWith('/api/operaciones/') && req.method === 'DELETE') {
    const id = pathname.replace('/api/operaciones/', '').trim();
    try {
      const db = await readDb();
      const nd = (db.debitNotes || []).find(n => n.id === id);
      if (nd) softDeleteRecord(nd);
      (db.creditNotes || []).forEach(nc => {
        if (nc.originDebitNoteId === id) softDeleteRecord(nc);
      });
      await saveDb(db);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, deletedId: id }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // BOLETOS GDS: /api/boletos
  if (pathname === '/api/boletos') {
    const db = await readDb();
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(db.gdsTickets || []));
      return;
    }
    if (req.method === 'POST') {
      try {
        const tkt = await parseRequestBody(req);
        db.gdsTickets = db.gdsTickets || [];
        const idx = db.gdsTickets.findIndex(t => t.id === tkt.id);
        if (idx !== -1) {
          db.gdsTickets[idx] = { ...db.gdsTickets[idx], ...tkt, updatedAt: new Date().toLocaleString() };
        } else {
          db.gdsTickets.unshift({ ...tkt, createdAt: new Date().toLocaleString() });
        }
        await saveDb(db);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ticket: tkt }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  if (pathname.startsWith('/api/boletos/') && req.method === 'DELETE') {
    const id = pathname.replace('/api/boletos/', '').trim();
    try {
      const db = await readDb();
      const tkt = (db.gdsTickets || []).find(t => t.id === id);
      if (tkt) softDeleteRecord(tkt);
      (db.otherIncomes || []).forEach(i => {
        if (i.ticketId === id) softDeleteRecord(i);
      });
      await saveDb(db);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, deletedId: id }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // CUENTAS (CLIENTES Y PROVEEDORES): /api/cuentas
  if (pathname === '/api/cuentas') {
    const db = await readDb();
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(db.accounts || []));
      return;
    }
    if (req.method === 'POST') {
      try {
        const acc = await parseRequestBody(req);
        db.accounts = db.accounts || [];
        const idx = db.accounts.findIndex(a => a.id === acc.id);
        if (idx !== -1) {
          db.accounts[idx] = { ...db.accounts[idx], ...acc, updatedAt: new Date().toLocaleString() };
        } else {
          db.accounts.unshift({ ...acc, createdAt: new Date().toLocaleString() });
        }
        await saveDb(db);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, account: acc }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  if (pathname.startsWith('/api/cuentas/') && req.method === 'DELETE') {
    const id = pathname.replace('/api/cuentas/', '').trim();
    try {
      const db = await readDb();
      const acc = (db.accounts || []).find(a => a.id === id);
      if (acc) softDeleteRecord(acc);
      await saveDb(db);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, deletedId: id }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // CONFIGURACIÓN GENERAL: /api/config
  if (pathname === '/api/config') {
    const db = await readDb();
    if (req.method === 'GET') {
      const settings = { ...(db.systemSettings || {}) };
      settings.logoBase64 = obtenerLogoBase64();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(settings));
      return;
    }
    if (req.method === 'POST') {
      try {
        const config = await parseRequestBody(req);
        db.systemSettings = { ...db.systemSettings, ...config };
        await saveDb(db);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, systemSettings: db.systemSettings }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  // CARGA DINÁMICA DEL LOGO EN BASE64: /api/logo-base64
  if ((pathname === '/api/logo-base64' || pathname === '/api/logo' || pathname === '/api/print/logo') && req.method === 'GET') {
    const logoBase64 = obtenerLogoBase64();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, logoBase64 }));
    return;
  }

  // INYECCIÓN O RENDERIZACIÓN DE IMPRESIÓN CON LOGO BASE64 EN SERVIDOR: /api/print/nd/:id, /api/print/nc/:id, /api/print/:id
  if (pathname.startsWith('/api/print/')) {
    const parts = pathname.split('/').filter(Boolean);
    const subRoute = parts[2];
    const docId = parts[3] || parts[2];
    if (docId && docId !== 'logo') {
      const db = await readDb();
      const isNc = (subRoute && subRoute.toLowerCase() === 'nc') || String(docId).startsWith('NC');
      let doc = isNc 
        ? (db.creditNotes || []).find(n => n.id === docId)
        : (db.debitNotes || []).find(n => n.id === docId);

      if (!doc) {
        doc = (db.creditNotes || []).find(n => n.id === docId) || (db.debitNotes || []).find(n => n.id === docId);
      }

      if (doc) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, doc, logoBase64: obtenerLogoBase64() }));
        return;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Documento no encontrado para impresión: ' + docId);
        return;
      }
    }
  }

  // TIPO DE CAMBIO GLOBAL: /api/exchange-rate
  if (pathname === '/api/exchange-rate') {
    const db = await readDb();
    if (req.method === 'GET') {
      const settings = db.systemSettings || {};
      const rates = db.exchangeRates || [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        activeExchangeBuy: settings.activeExchangeBuy || 6.86,
        activeExchangeSell: settings.activeExchangeSell || 6.96,
        lastUpdate: rates[0] ? rates[0].createdAt : 'Inicial',
        updatedBy: rates[0] ? rates[0].createdByName : 'Sistema',
        history: rates.slice(0, 15)
      }));
      return;
    }
    if (req.method === 'POST') {
      try {
        const payload = await parseRequestBody(req);
        const buy = parseFloat(payload.buyRate);
        const sell = parseFloat(payload.sellRate);
        const updatedBy = payload.updatedBy || 'Luis (Admin)';

        if (isNaN(buy) || buy <= 0 || isNaN(sell) || sell <= 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Los valores de compra y venta deben ser números positivos válidos.' }));
          return;
        }

        if (!db.systemSettings) db.systemSettings = {};
        db.systemSettings.activeExchangeBuy = buy;
        db.systemSettings.activeExchangeSell = sell;

        const newEntry = {
          id: 'TC-' + Date.now(),
          date: new Date().toISOString().split('T')[0],
          buyRate: buy,
          sellRate: sell,
          createdById: 'USR-001',
          createdByName: updatedBy,
          createdAt: new Date().toLocaleString()
        };

        if (!db.exchangeRates) db.exchangeRates = [];
        db.exchangeRates.unshift(newEntry);

        await saveDb(db);
        console.log(`[T/C PERSISTIDO] Compra: ${buy} | Venta: ${sell} por ${updatedBy}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, activeExchangeBuy: buy, activeExchangeSell: sell, entry: newEntry }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  // --------------------------------------------------------------------------
  // 3. RESPALDO, RESTAURACIÓN Y REINICIO A VALORES INICIALES
  // --------------------------------------------------------------------------

  // DESCARGAR COPIA DE SEGURIDAD (.JSON): /api/backup/download o /api/db/export
  if ((pathname === '/api/backup/download' || pathname === '/api/db/export') && req.method === 'GET') {
    try {
      if (!fs.existsSync(DB_PATH)) {
        await saveDb(INITIAL_SEED_DATABASE);
      }
      const fileData = fs.readFileSync(DB_PATH, 'utf-8');
      const dateStr = new Date().toISOString().split('T')[0];
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="maretravel_backup_${dateStr}.json"`,
        'Cache-Control': 'no-store'
      });
      res.end(fileData);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Fallo al exportar copia de seguridad: ' + err.message }));
    }
    return;
  }

  // RESTAURAR COPIA DE SEGURIDAD (.JSON): /api/backup/restore o /api/db/import
  if ((pathname === '/api/backup/restore' || pathname === '/api/db/import') && req.method === 'POST') {
    try {
      const backupData = await parseRequestBody(req);

      if (!backupData || !backupData.systemSettings || !Array.isArray(backupData.accounts)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'El archivo no tiene la estructura válida de MARETRAVEL ERP (falta systemSettings o accounts).' }));
        return;
      }

      // Guardar respaldo de seguridad previo antes de sobreescribir
      await createBackupCopy('pre_restore');

      // Sobreescribir archivo permanente en disco
      await saveDb(backupData);

      console.log(`[RESTORE] Base de datos restaurada exitosamente desde archivo JSON.`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Base de datos restaurada y guardada en disco exitosamente.',
        timestamp: new Date().toISOString()
      }));
    } catch (err) {
      console.error('[RESTORE ERROR]:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Error al restaurar copia en disco: ' + err.message }));
    }
    return;
  }

  // RESTABLECER A DATOS DE PRUEBA INICIALES: /api/admin/reset-datos-prueba (y alias /api/db/reset)
  if ((pathname === '/api/admin/reset-datos-prueba' || pathname === '/api/db/reset') && req.method === 'POST') {
    try {
      // 1. Crear copia de seguridad preventiva antes del reseteo
      await createBackupCopy('pre_reset');

      // 2. Obtener estructura semilla de prueba inicial
      const seedData = getSeedData();

      // 3. Sobrescribir atómica y sincrónicamente el archivo central data/database.json
      await saveDb(seedData);

      // 4. Asegurar archivo semilla
      await fs.promises.writeFile(path.join(DATA_DIR, 'seedData.json'), JSON.stringify(seedData, null, 2), 'utf-8');

      console.log(`[RESET] Sistema restablecido a datos de prueba iniciales con persistencia en disco.`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        success: true,
        mensaje: 'Sistema restablecido a datos de prueba con éxito',
        data: seedData
      }));
    } catch (err) {
      console.error('[RESET ERROR]:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: false,
        error: 'Error al restablecer sistema a datos de prueba en disco: ' + err.message
      }));
    }
    return;
  }

  // --------------------------------------------------------------------------
  // 4. CONSULTA Y VALIDACIÓN DE CUENTAS FINANCIERAS
  // --------------------------------------------------------------------------

  if (pathname === '/api/financial-accounts' && req.method === 'GET') {
    try {
      const db = await readDb();
      const accounts = (db ? db.financialAccounts || db.bankAccounts : []) || [];
      const onlyActive = parsedUrl.searchParams.get('active') === 'true';
      const filtered = onlyActive ? accounts.filter(a => a.isActive) : accounts;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        total: filtered.length,
        accounts: filtered.map(acc => ({
          ...acc,
          validation: validateFinancialAccount(acc)
        }))
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === '/api/financial-accounts/validate' && req.method === 'POST') {
    try {
      const payload = await parseRequestBody(req);
      const db = await readDb();
      let targetAccount = payload.account;
      if (!targetAccount && payload.accountId) {
        const list = (db ? db.financialAccounts || db.bankAccounts : []) || [];
        targetAccount = list.find(a => a.id === payload.accountId);
      }

      const result = validateFinancialAccount(targetAccount);
      res.writeHead(result.valid ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // STATUS DE PERSISTENCIA Y SERVIDOR: /api/status
  if (pathname === '/api/status') {
    try {
      const isCloud = persistence === tursoDatabase;
      const sqlStats = await persistence.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ONLINE',
        system: 'MARETRAVEL ERP',
        folder: ROOT_DIR,
        databaseType: isCloud ? 'TURSO_CLOUD' : 'RELATIONAL_SQL',
        engine: sqlStats.engine,
        ...(isCloud
          ? { databaseUrl: sqlStats.url }
          : {
              sqlFile: sqlStats.file,
              fileSizeBytes: sqlStats.fileSizeBytes,
              lastModified: sqlStats.lastModified
            }),
        counts: sqlStats.counts,
        persistenceType: isCloud ? 'LIBSQL_CLOUD_ACID' : 'SQLITE_WAL_ACID_TRANSACTIONS'
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // --------------------------------------------------------------------------
  // 5. SERVIR ARCHIVOS ESTÁTICOS DE LA APLICACIÓN WEB
  // --------------------------------------------------------------------------
  let safePath = path.normalize(pathname).replace(/^(\.+|[\\/])+/, '');
  if (safePath === '' || safePath === '.') safePath = 'index.html';

  const filePath = path.join(ROOT_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Recurso no encontrado: ' + pathname);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[AVISO] Puerto ${PORT} ocupado. Reintentando en ${Number(PORT) + 1}...`);
    setTimeout(() => {
      server.listen(Number(PORT) + 1, '0.0.0.0');
    }, 500);
  } else {
    console.error('Error en el servidor:', err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const activePort = server.address().port;
  const cloud = persistence === tursoDatabase;
  console.log('================================================================');
  console.log(`   MARETRAVEL ERP - SERVIDOR DE PERSISTENCIA ${cloud ? 'CLOUD (TURSO)' : 'SQL RELACIONAL (SQLITE)'}`);
  console.log('================================================================');
  console.log(`  Servidor corriendo en:    http://localhost:${activePort}`);
  if (cloud) {
    console.log(`  Base de Datos Cloud:       ${process.env.TURSO_DATABASE_URL} (libSQL ACID)`);
  } else {
    console.log(`  Base de Datos SQL:        ${SQLITE_PATH} (SQLite WAL)`);
    console.log(`  Directorio de Respaldos:  ${BACKUP_DIR}`);
  }
  console.log(`  Persistencia:             ${cloud ? 'LIBSQL CLOUD ACID (datos en la nube)' : 'TRANSACCIONES SQL ATÓMICAS (ACID)'}`);
  console.log('================================================================');
});
