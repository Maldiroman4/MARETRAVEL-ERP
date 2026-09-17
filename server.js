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

  // 2. API: Guardar base de datos persistentemente en la carpeta
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
        const tempPath = DB_PATH + '.tmp';
        const formattedJson = JSON.stringify(parsed, null, 2);
        
        fs.writeFileSync(tempPath, formattedJson, 'utf-8');
        fs.renameSync(tempPath, DB_PATH);

        console.log(`[${new Date().toLocaleTimeString()}] Base de datos guardada en data/database.json`);
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

  // 3. API: Status del servidor
  if (pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ONLINE',
      system: 'MARETRAVEL ERP',
      folder: ROOT_DIR,
      dbFile: 'data/database.json'
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
      server.listen(Number(PORT) + 1);
    }, 500);
  } else {
    console.error('Error en el servidor:', err);
  }
});

server.listen(PORT, () => {
  const activePort = server.address().port;
  console.log('================================================================');
  console.log('       MARETRAVEL ERP - SERVIDOR LOCAL CON PERSISTENCIA');
  console.log('================================================================');
  console.log(`  Servidor corriendo en:    http://localhost:${activePort}`);
  console.log(`  Base de datos vinculada: ${DB_PATH}`);
  console.log('  Cualquier cambio se guarda automáticamente en la carpeta.');
  console.log('================================================================');
});
