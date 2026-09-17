/**
 * MARETRAVEL ERP - Capa de Base de Datos y Persistencia
 * Sincronización dual: Navegador (localStorage) y Archivo Físico (data/database.json)
 */

const DB_KEY = 'MARETRAVEL_ERP_DB_V2';

const initialDatabase = {
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
    activeExchangeSell: 6.96,
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
  serviceTypes: [
    { id: 'SRV-BOLETO', code: 'BOLETO_AEREO', name: 'BOLETO AÉREO / GDS', category: 'AÉREO' },
    { id: 'SRV-HOTEL', code: 'HOTEL', name: 'HOTEL', category: 'HOSPEDAJE' },
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

class LocalDatabase {
  constructor() {
    this.serverOnline = false;
    this.cachedData = null;
    this.initPromise = this.init();
  }

  async init() {
    // 1. Limpiar versiones obsoletas
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('MARETRAVEL_ERP_DB_V1');
        localStorage.removeItem('maretravel_erp_db_v1');
      }
    } catch(e) {}

    // 2. Cargar inmediatamente desde el servidor permanente en disco (data/database.json)
    const serverData = await this.syncWithServerFile();
    if (serverData) {
      this.cachedData = serverData;
      return serverData;
    }

    // 3. Fallback solo si el servidor no está en línea y no hay datos en localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const local = localStorage.getItem(DB_KEY);
        if (local) {
          this.cachedData = JSON.parse(local);
        } else {
          this.cachedData = JSON.parse(JSON.stringify(initialDatabase));
          localStorage.setItem(DB_KEY, JSON.stringify(this.cachedData));
        }
      }
    } catch(e) {
      this.cachedData = JSON.parse(JSON.stringify(initialDatabase));
    }
    return this.cachedData;
  }

  async syncWithServerFile() {
    const endpoints = ['/api/db', 'http://localhost:3000/api/db', 'http://localhost:3001/api/db'];
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, { method: 'GET', cache: 'no-store' });
        if (res.ok) {
          const fileData = await res.json();
          if (fileData && fileData.systemSettings) {
            this.serverOnline = true;
            this.cachedData = fileData;
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(DB_KEY, JSON.stringify(fileData));
            }
            this.updateStoragePill(true);
            return fileData;
          }
        }
      } catch (err) {
        // Servidor no disponible en este endpoint
      }
    }
    this.updateStoragePill(false);
    return null;
  }

  get() {
    try {
      if (this.cachedData) {
        return this.cachedData;
      }

      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(DB_KEY);
        if (data) {
          this.cachedData = JSON.parse(data);
          return this.cachedData;
        }
      }

      this.cachedData = JSON.parse(JSON.stringify(initialDatabase));
      return this.cachedData;
    } catch (e) {
      console.error('Error leyendo base de datos:', e);
      return JSON.parse(JSON.stringify(initialDatabase));
    }
  }

  save(data) {
    try {
      this.cachedData = data;

      // 1. Persistencia síncrona en el navegador (localStorage)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DB_KEY, JSON.stringify(data));
      }

      // 2. Persistencia real obligatoria en el archivo físico en disco (data/database.json)
      this.persistToFileServer(data);

      // 3. Disparar evento de actualización reactiva en toda la app
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('maretravel_db_updated'));
      }
    } catch (e) {
      console.error('Error guardando en base de datos:', e);
    }
  }

  async persistToFileServer(data) {
    const endpoints = ['/api/db', 'http://localhost:3000/api/db', 'http://localhost:3001/api/db'];
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          this.serverOnline = true;
          this.updateStoragePill(true);
          return true;
        } else {
          const errData = await res.json().catch(() => ({}));
          console.error('Servidor rechazó guardado en disco:', errData);
        }
      } catch (err) {
        // Continuar al siguiente endpoint
      }
    }
    this.updateStoragePill(false);
    return false;
  }

  updateStoragePill(isServerConnected) {
    if (typeof document === 'undefined') return;
    const pill = document.getElementById('storage-status-pill');
    if (pill) {
      if (isServerConnected) {
        pill.className = 'badge badge-emerald';
        pill.innerHTML = '<i data-lucide="hard-drive" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"></i> Guardado en Disco: Activo';
        pill.title = 'Base de datos sincronizada y confirmada en disco en data/database.json';
      } else {
        pill.className = 'badge badge-blue';
        pill.innerHTML = '<i data-lucide="database" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"></i> Guardado Local (Offline)';
        pill.title = 'Guardado en navegador. Inicia el servidor para sincronizar en disco.';
      }
      if (typeof window !== 'undefined' && window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  }

  async reset() {
    try {
      let res = await fetch('/api/admin/reset-datos-prueba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true })
      });
      if (!res.ok) {
        res = await fetch('/api/db/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: true })
        });
      }
      if (res.ok) {
        const fresh = await res.json();
        this.cachedData = fresh.data || null;
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(DB_KEY);
        }
        await this.syncWithServerFile();
        return true;
      }
    } catch (e) {
      console.error('Error reseteando DB en servidor:', e);
    }
    return false;
  }

  exportBackup() {
    // Descarga directa del volcado real y actual guardado en disco
    window.location.href = '/api/backup/download';
  }

  async importBackup(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.systemSettings || !Array.isArray(parsed.accounts)) {
        throw new Error('Estructura de base de datos inválida.');
      }
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonString
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error del servidor' }));
        throw new Error(err.error || 'Fallo al restaurar en disco');
      }
      this.cachedData = parsed;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DB_KEY, JSON.stringify(parsed));
      }
      this.save(parsed);
      return true;
    } catch (e) {
      console.error('Error importando backup:', e);
      return false;
    }
  }
}

if (typeof window !== 'undefined') {
  window.db = new LocalDatabase();
}
