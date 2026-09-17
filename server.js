/**
 * MARETRAVEL ERP - Servidor Local de Sincronización y Persistencia en Carpeta
 * Ejecuta la aplicación web y guarda automáticamente cualquier cambio
 * directamente en el archivo físico: data/database.json
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DB_PATH = path.join(ROOT_DIR, 'data', 'database.json');
const BACKUP_DIR = path.join(ROOT_DIR, 'data', 'backups');

if (!fs.existsSync(path.join(ROOT_DIR, 'data'))) {
  fs.mkdirSync(path.join(ROOT_DIR, 'data'), { recursive: true });
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
  } else {
    errors.push(`Tipo de cuenta financiera desconocido: ${type}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

const server = http.createServer((req, res) => {
  // CORS para máxima compatibilidad
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const requestUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost:3000'));
  const pathname = requestUrl.pathname;

  // Helper para leer base de datos sincrónicamente
  const readDb = () => {
    if (!fs.existsSync(DB_PATH)) return null;
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  };

  // 1. API: Leer base de datos desde la carpeta
  if (pathname === '/api/db' && req.method === 'GET') {
    try {
      if (fs.existsSync(DB_PATH)) {
        const content = fs.readFileSync(DB_PATH, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(content);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'data/database.json no encontrado' }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 2. API: Guardar base de datos persistentemente con Guardrails Financieros
  if (pathname === '/api/db' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        if (!body || !body.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Cuerpo vacío' }));
          return;
        }
        const parsed = JSON.parse(body);

        // Guardrail: Validación estricta de Cuentas Financieras en movimientos de fondos
        const financialAccounts = parsed.financialAccounts || [];
        const bankAccounts = parsed.bankAccounts || [];
        const allAccounts = [...financialAccounts, ...bankAccounts];

        // Validar que no existan recibos de caja sin cuenta financiera válida
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

        const tempPath = DB_PATH + '.tmp';
        const formattedJson = JSON.stringify(parsed, null, 2);
        
        fs.writeFileSync(tempPath, formattedJson, 'utf-8');
        fs.renameSync(tempPath, DB_PATH);

        console.log(`[${new Date().toLocaleTimeString()}] Base de datos guardada con integridad financiera en data/database.json`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, timestamp: new Date().toISOString() }));
      } catch (err) {
        console.error('Error guardando en archivo:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 3. API: Consultar Tipo de Cambio Oficial Centralizado
  if (pathname === '/api/exchange-rate' && req.method === 'GET') {
    try {
      const db = readDb();
      if (!db) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Base de datos no encontrada' }));
        return;
      }
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
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 4. API: Actualizar Tipo de Cambio Oficial (Único Punto de Verdad)
  if (pathname === '/api/exchange-rate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const buy = parseFloat(payload.buyRate);
        const sell = parseFloat(payload.sellRate);
        const updatedBy = payload.updatedBy || 'Luis (Admin)';

        if (isNaN(buy) || buy <= 0 || isNaN(sell) || sell <= 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Los valores de compra y venta del Tipo de Cambio deben ser números positivos válidos.' }));
          return;
        }

        const db = readDb();
        if (!db) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No se pudo leer la base de datos' }));
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

        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
        console.log(`[T/C ACTUALIZADO] Compra: ${buy} | Venta: ${sell} por ${updatedBy}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, activeExchangeBuy: buy, activeExchangeSell: sell, entry: newEntry }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 5. API: Consultar Cuentas Financieras Válidas
  if (pathname === '/api/financial-accounts' && req.method === 'GET') {
    try {
      const db = readDb();
      const accounts = (db ? db.financialAccounts || db.bankAccounts : []) || [];
      const onlyActive = requestUrl.searchParams.get('active') === 'true';
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

  // 6. API: Validar Cuenta Financiera (Guardrail Endpoint)
  if (pathname === '/api/financial-accounts/validate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const db = readDb();
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
    });
    return;
  }

  // 7. API: Status del servidor
  if (pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ONLINE',
      system: 'MARETRAVEL ERP',
      folder: ROOT_DIR,
      dbFile: 'data/database.json',
      guardrails: 'STRICT_ACTIVE'
    }));
    return;
  }

  // 4. Servir archivos estáticos del ERP
  let safePath = path.normalize(pathname).replace(/^(\.+|[\\/])+/, '');
  if (safePath === '' || safePath === '.') safePath = 'index.html';

  const filePath = path.join(ROOT_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Archivo no encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[AVISO] El puerto ${PORT} está en uso. Intentando en ${Number(PORT) + 1}...`);
    setTimeout(() => {
      server.listen(Number(PORT) + 1, '0.0.0.0');
    }, 500);
  } else {
    console.error('Error en el servidor:', err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const activePort = server.address().port;
  console.log('================================================================');
  console.log('       MARETRAVEL ERP - SERVIDOR LOCAL CON PERSISTENCIA');
  console.log('================================================================');
  console.log(`  Servidor corriendo en:    http://0.0.0.0:${activePort}`);
  console.log(`  Base de datos vinculada: ${DB_PATH}`);
  console.log('  Cualquier cambio se guarda automáticamente en la carpeta.');
  console.log('================================================================');
});
