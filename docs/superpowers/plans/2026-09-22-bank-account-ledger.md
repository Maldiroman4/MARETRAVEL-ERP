# Bitácora y saldo derivado de Cuentas Bancarias — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar las cuentas financieras en `bankAccounts` (Cuentas Bancarias), registrar cada transacción que use una cuenta (cobranzas, pagos, otros ingresos) y mostrar un modal por cuenta con su saldo derivado y su historial de transacciones (con el medio: efectivo/QR/transferencia).

**Architecture:** Frontend vanilla JS sobre `window.db` (`localStorage` + `data/database.json`). Se agrega un array `bankTransactions` (bitácora), un campo `initialBalance` en las cuentas, un helper central `financialGuard.recordTransaction()`, se depreca `financialAccounts` y se extiende la sección Cuentas Bancarias (tipos BANCO/BINANCE/EFECTIVO + saldo inicial + modal por cuenta).

**Tech Stack:** JavaScript vanilla (sin build), `window.db`, `financialGuard`, módulos `bankAccounts`, `cashRegister`, `otherIncomes`. Verificación con `node --check` y Playwright.

## Global Constraints

- **Rama:** `feat/bank-account-ledger` (basada en `main`). No tocar `main`.
- **No hay SQL en `main`:** todo vive en `window.db` (localStorage + `data/database.json`).
- **Una sola fuente de cuentas:** los dropdowns usan `bankAccounts`; `financialAccounts` se depreca (se deja de leer, sin borrar el seed).
- **Campos de transacción:** `{ id, accountId, type: 'INGRESO'|'EGRESO', amount, medio: 'EFECTIVO'|'QR'|'TRANSFERENCIA'|'CHEQUE'|'CRIPTO', date, reference, description, createdAt }`.
- **Saldo derivado:** `saldo = initialBalance + Σ(INGRESO) − Σ(EGRESO)`.
- `medio` por defecto: `TRANSFERENCIA` si la operación no lo especifica.
- **Cuenta inactiva** → bloqueada para operaciones.
- Sintaxis JS verificada con `node --check` en cada archivo modificado.

---

### Task 1: Modelo de datos y seed unificado

**Files:**
- Modify: `js/db.js` (seed: `bankAccounts` con tipos + `initialBalance`, nuevo array `bankTransactions`, mantener `financialAccounts` deprecado)

**Interfaces:**
- Produces: `data.bankAccounts` con soporte `type` (BANCO/BINANCE/EFECTIVO) e `initialBalance`; `data.bankTransactions` (array vacío). Consumido por `financialGuard` (Task 2) y `bankAccounts` (Tasks 3-4).

- [ ] **Step 1: En `js/db.js`, enriquecer el seed de `bankAccounts`** con `type` e `initialBalance`, y añadir los tipos BINANCE y EFECTIVO:

```js
bankAccounts: [
  { id: 'ACC-BNK-GANADERO-02', type: 'BANCO', bankName: 'Banco Ganadero S.A.', accountNumber: '1051-20948-3', accountType: 'CORRIENTE', currency: 'BOB', titularName: 'MARETRAVEL S.R.L.', initialBalance: 0, isActive: true, createdAt: '16/9/2026, 12:00:00', updatedAt: '16/9/2026, 12:00:00' },
  { id: 'ACC-BNK-BMSC-01', type: 'BANCO', bankName: 'Banco Mercantil Santa Cruz BMSC', accountNumber: '401-09823-1', accountType: 'CORRIENTE', currency: 'BOB', titularName: 'MARETRAVEL S.R.L.', initialBalance: 0, isActive: true, createdAt: '16/9/2026, 12:00:00', updatedAt: '16/9/2026, 12:00:00' },
  { id: 'ACC-BNK-BISA-USD-03', type: 'BANCO', bankName: 'Banco Bisa S.A.', accountNumber: '029-91823-7', accountType: 'CORRIENTE', currency: 'USD', titularName: 'MARETRAVEL S.R.L.', initialBalance: 0, isActive: true, createdAt: '16/9/2026, 12:00:00', updatedAt: '16/9/2026, 12:00:00' },
  { id: 'ACC-DIG-BINANCE-04', type: 'BINANCE', bankName: 'Binance Pay / P2P', accountNumber: '89410293', binanceId: '89410293', walletAddress: '0x89410293MareTravelPayWallet', titularName: 'MARETRAVEL CRYPTO SRL', currency: 'USDT', initialBalance: 0, isActive: true, createdAt: '16/9/2026, 12:00:00', updatedAt: '16/9/2026, 12:00:00' },
  { id: 'ACC-CSH-CENTRAL-BOB-05', type: 'EFECTIVO', bankName: 'Caja Central Oficina General', cashDeskName: 'Caja General Oficina Central BOB', accountNumber: 'CAJA-BOB-01', custodianName: 'Luis (Cajero Principal)', titularName: 'MARETRAVEL S.R.L.', currency: 'BOB', initialBalance: 0, isActive: true, createdAt: '16/9/2026, 12:00:00', updatedAt: '16/9/2026, 12:00:00' },
  { id: 'ACC-CSH-CENTRAL-USD-06', type: 'EFECTIVO', bankName: 'Caja Central Oficina Dólares', cashDeskName: 'Caja General Oficina Central USD', accountNumber: 'CAJA-USD-01', custodianName: 'Luis (Cajero Principal)', titularName: 'MARETRAVEL S.R.L.', currency: 'USD', initialBalance: 0, isActive: true, createdAt: '16/9/2026, 12:00:00', updatedAt: '16/9/2026, 12:00:00' }
],
```

- [ ] **Step 2: Añadir el array `bankTransactions: []`** junto a los demás arrays del seed (tras `bankAccounts`).

- [ ] **Step 3: Verificar sintaxis** — `node --check js/db.js` → OK.

- [ ] **Step 4: Commit**

```bash
git add js/db.js
git commit -m "feat: seed unificado de cuentas (tipos + initialBalance) y array bankTransactions"
```

---

### Task 2: `financialGuard` — fuente única + registro + saldo derivado

**Files:**
- Modify: `js/modules/financialGuard.js`

**Interfaces:**
- Produces: `getActiveAccounts()`/`getAccountById()` leen **solo `bankAccounts`**; `recordTransaction(accountId, datos)`; `getAccountBalance(accountId)` → `{ saldo, ingresos, egresos, transactions }`. Consumido por `cashRegister`/`otherIncomes` (Tasks 5-6) y `bankAccounts` (Task 4).

- [ ] **Step 1: Cambiar `getActiveAccounts` para leer solo `bankAccounts`**

```js
getActiveAccounts(currencyFilter = null) {
  const data = window.db ? window.db.get() : null;
  if (!data) return [];
  const list = data.bankAccounts || [];
  return list.filter(acc => {
    const isAct = acc.isActive !== false && acc.status !== 'INACTIVO';
    const currMatch = !currencyFilter || currencyFilter === 'TODOS' || acc.currency === currencyFilter;
    const check = this.validateAccount(acc);
    return isAct && currMatch && check.valid;
  });
}
```

- [ ] **Step 2: Cambiar `getAccountById` para leer solo `bankAccounts`**

```js
getAccountById(id) {
  if (!id) return null;
  const data = window.db ? window.db.get() : null;
  if (!data) return null;
  return (data.bankAccounts || []).find(a => a.id === id) || null;
}
```

- [ ] **Step 3: Añadir `recordTransaction(accountId, datos)`**

```js
recordTransaction(accountId, datos) {
  const data = window.db ? window.db.get() : null;
  if (!data || !accountId) return null;
  const acc = (data.bankAccounts || []).find(a => a.id === accountId);
  if (!acc || acc.isActive === false) return null; // cuenta inactiva: no transactable
  if (!data.bankTransactions) data.bankTransactions = [];
  const tx = {
    id: 'BTX-' + Date.now() + Math.random().toString(36).substr(2, 6),
    accountId: accountId,
    type: datos.type === 'EGRESO' ? 'EGRESO' : 'INGRESO',
    amount: Number(datos.amount) || 0,
    medio: datos.medio || 'TRANSFERENCIA',
    date: datos.date || new Date().toISOString().split('T')[0],
    reference: datos.reference || '',
    description: datos.description || '',
    createdAt: new Date().toLocaleString()
  };
  data.bankTransactions.unshift(tx);
  if (window.db && typeof window.db.save === 'function') window.db.save(data);
  return tx;
}
```

- [ ] **Step 4: Añadir `getAccountBalance(accountId)` (saldo derivado)**

```js
getAccountBalance(accountId) {
  const data = window.db ? window.db.get() : null;
  const acc = (data && data.bankAccounts || []).find(a => a.id === accountId);
  const initial = acc ? Number(acc.initialBalance) || 0 : 0;
  const txs = (data && data.bankTransactions || []).filter(t => t.accountId === accountId);
  let ingresos = 0, egresos = 0;
  txs.forEach(t => {
    if (t.type === 'EGRESO') egresos += Number(t.amount) || 0;
    else ingresos += Number(t.amount) || 0;
  });
  return { saldo: +(initial + ingresos - egresos).toFixed(2), ingresos: +ingresos.toFixed(2), egresos: +egresos.toFixed(2), transactions: txs };
}
```

- [ ] **Step 5: Verificar sintaxis** — `node --check js/modules/financialGuard.js` → OK.

- [ ] **Step 6: Commit**

```bash
git add js/modules/financialGuard.js
git commit -m "feat: financialGuard usa bankAccounts como fuente única + recordTransaction + saldo derivado"
```

---

### Task 3: Sección Cuentas Bancarias — crear BANCO/BINANCE/EFECTIVO + saldo inicial

**Files:**
- Modify: `js/modules/bankAccounts.js`
- Modify: `index.html` (modal de cuenta bancaria: campo `type` y `initialBalance`)

**Interfaces:**
- Produces: la creación/edición de cuentas captura `type` (BANCO/BINANCE/EFECTIVO) e `initialBalance`. Consumido por el modal de Task 4.

- [ ] **Step 1: En `index.html`, añadir al modal de cuenta** un select `acc-type` (BANCO/BINANCE/EFECTIVO) y un input `acc-initial-balance` (número, placeholder "Saldo inicial (opcional)").

- [ ] **Step 2: En `js/modules/bankAccounts.js`, leer esos campos** al guardar:

```js
const accountData = {
  type: document.getElementById('acc-type').value || 'BANCO',
  bankName: document.getElementById('acc-bank-name').value.trim(),
  accountNumber: document.getElementById('acc-account-number').value.trim(),
  accountType: document.getElementById('acc-account-type').value || 'CORRIENTE',
  currency: document.getElementById('acc-currency').value,
  titularName: document.getElementById('acc-titular').value.trim(),
  initialBalance: parseFloat(document.getElementById('acc-initial-balance').value) || 0,
  isActive: true
};
```
(Adapta los ids a los reales del modal; conserva los campos existentes que ya usa el módulo.)

- [ ] **Step 3: En la edición**, al abrir el modal, precargar `type` e `initialBalance` desde la cuenta existente.

- [ ] **Step 4: Verificar sintaxis** — `node --check js/modules/bankAccounts.js` → OK.

- [ ] **Step 5: Commit**

```bash
git add js/modules/bankAccounts.js index.html
git commit -m "feat: crear cuentas BANCO/BINANCE/EFECTIVO con saldo inicial en Cuentas Bancarias"
```

---

### Task 4: Modal de cuenta — saldo derivado + listado de transacciones

**Files:**
- Modify: `js/modules/bankAccounts.js`
- Modify: `index.html` (modal `modal-account-ledger`)

**Interfaces:**
- Consumes: `financialGuard.getAccountBalance(accountId)` (Task 2).
- Produces: al hacer clic en el card de una cuenta se abre `modal-account-ledger` con cabecera, saldo (positivo/negativo) y tabla de transacciones (fecha, tipo, monto, medio, referencia).

- [ ] **Step 1: En `index.html`, añadir `modal-account-ledger`** con un contenedor `#acc-ledger-body`.

- [ ] **Step 2: En `bankAccounts.js`, añadir `openLedgerModal(accountId)`**:

```js
openLedgerModal(accountId) {
  const data = window.db.get();
  const acc = (data.bankAccounts || []).find(a => a.id === accountId);
  if (!acc) return;
  const bal = window.financialGuard.getAccountBalance(accountId);
  const neg = bal.saldo < 0;
  document.getElementById('acc-ledger-title').textContent = `${acc.bankName || acc.name || 'Cuenta'} ${acc.accountNumber ? '- Cta. ' + acc.accountNumber : ''}`;
  document.getElementById('acc-ledger-balance').textContent = `Saldo: BOB ${bal.saldo.toFixed(2)}`;
  document.getElementById('acc-ledger-balance').className = 'font-bold ' + (neg ? 'text-danger' : 'text-success');
  document.getElementById('acc-ledger-balance').style.color = neg ? '#dc2626' : '#00a884';
  const tbody = document.getElementById('acc-ledger-body');
  tbody.innerHTML = bal.transactions.length === 0
    ? '<tr><td colspan="5" style="text-align:center;padding:16px;color:#64748b;">Sin transacciones (saldo inicial: BOB ' + bal.saldo.toFixed(2) + ')</td></tr>'
    : bal.transactions.map(t => `
      <tr>
        <td>${t.date}</td>
        <td><span class="badge ${t.type === 'EGRESO' ? 'badge-danger' : 'badge-success'}">${t.type === 'EGRESO' ? 'EGRESO' : 'INGRESO'}</span></td>
        <td class="font-mono">${t.amount.toFixed(2)}</td>
        <td>${t.medio}</td>
        <td>${t.reference || '-'}</td>
      </tr>`).join('');
  window.app.openModal('modal-account-ledger');
}
```

- [ ] **Step 3: Hacer cada card clicable** — en `render()`, envolver el card (o añadir un botón "Ver movimientos") que llame `window.bankAccountsModule.openLedgerModal('${acc.id}')`.

- [ ] **Step 4: Verificar sintaxis** — `node --check js/modules/bankAccounts.js` → OK.

- [ ] **Step 5: Commit**

```bash
git add js/modules/bankAccounts.js index.html
git commit -m "feat: modal de cuenta con saldo derivado y listado de transacciones"
```

---

### Task 5: Registrar transacciones en Cobranzas y Pagos a Proveedores

**Files:**
- Modify: `js/modules/cashRegister.js`

**Interfaces:**
- Consumes: `financialGuard.recordTransaction(accountId, datos)` (Task 2).
- Produces: al crear una cobranza con cuenta destino → `INGRESO`; al pagar a proveedor con cuenta origen → `EGRESO`.

- [ ] **Step 1: En la función de cobranza (`processCollection`)** — localizar dónde se crea el recibo con `financialAccountId`. Tras guardar, registrar el ingreso:

```js
if (window.financialGuard && typeof window.financialGuard.recordTransaction === 'function') {
  const accId = newReceipt.financialAccountId || newReceipt.paymentMethodId || (newReceipt.details && newReceipt.details[0] && newReceipt.details[0].debitNoteId);
  if (accId && (data.bankAccounts || []).some(a => a.id === accId)) {
    window.financialGuard.recordTransaction(accId, {
      type: 'INGRESO', amount: newReceipt.totalPaidBob, medio: newReceipt.medio || 'TRANSFERENCIA',
      reference: newReceipt.receiptCode, description: 'Cobranza a cliente'
    });
  }
}
```
(Adapta el acceso a la cuenta destino según el objeto `newReceipt` real del módulo.)

- [ ] **Step 2: En la función de pago a proveedor (flujo `prov-payment`/`handleProviderPayment`)** — tras registrar el pago, registrar el egreso con la cuenta origen (`prov-payment-method-select` / `account.id`):

```js
if (window.financialGuard && typeof window.financialGuard.recordTransaction === 'function') {
  const accId = <cuentaOrigenId>; // id de la cuenta financiera origen del pago
  if (accId) {
    window.financialGuard.recordTransaction(accId, {
      type: 'EGRESO', amount: <montoPago>, medio: <medioPago> || 'TRANSFERENCIA',
      reference: <nroComprobante>, description: 'Pago a proveedor'
    });
  }
}
```

- [ ] **Step 3: Verificar sintaxis** — `node --check js/modules/cashRegister.js` → OK.

- [ ] **Step 4: Commit**

```bash
git add js/modules/cashRegister.js
git commit -m "feat: registrar transacciones de cobranzas (ingreso) y pagos a proveedores (egreso)"
```

---

### Task 6: Registrar transacciones en Otros Ingresos (depósitos)

**Files:**
- Modify: `js/modules/otherIncomes.js`

**Interfaces:**
- Consumes: `financialGuard.recordTransaction(accountId, datos)` (Task 2).
- Produces: al marcar un otro ingreso como `PAGADO` con cuenta de depósito → `INGRESO`.

- [ ] **Step 1: Localizar donde se marca un ingreso como `PAGADO` con `depositAccountId`** y, tras guardar, registrar:

```js
if (window.financialGuard && typeof window.financialGuard.recordTransaction === 'function' && depositAccountId) {
  window.financialGuard.recordTransaction(depositAccountId, {
    type: 'INGRESO', amount: <monto>, medio: <medio> || 'TRANSFERENCIA',
    reference: <nroIngreso>, description: 'Otro ingreso / depósito'
  });
}
```

- [ ] **Step 2: Verificar sintaxis** — `node --check js/modules/otherIncomes.js` → OK.

- [ ] **Step 3: Commit**

```bash
git add js/modules/otherIncomes.js
git commit -m "feat: registrar transacciones de otros ingresos (depósito) por cuenta"
```

---

### Task 7: Deprecar `financialAccounts` en `cashRegister` y verificación e2e

**Files:**
- Modify: `js/modules/cashRegister.js`

**Interfaces:**
- Produces: `cashRegister` lee `bankAccounts` (no `financialAccounts`). Conjunto de cambios listo para verificación Playwright.

- [ ] **Step 1: En `cashRegister.js:188`**, cambiar `data.financialAccounts || data.bankAccounts` por `data.bankAccounts`:

```js
const finAccounts = data.bankAccounts || [];
```

- [ ] **Step 2: Verificar que no queden lecturas de `financialAccounts`** en `cashRegister.js` ni `financialGuard.js` (grep). Si alguna queda, reemplazarla por `bankAccounts`.

- [ ] **Step 3: Verificación e2e con Playwright (Chromium)**:
  - Servir la app (`node server.js`), login `luis/585858`.
  - Crear una cuenta (tipo BANCO, con saldo inicial 1000) en Cuentas Bancarias → el card muestra saldo 1000.
  - Click en el card → se abre el modal con saldo 1000 y "Sin transacciones".
  - Simular una cobranza/pago que use esa cuenta → verificar que el modal ahora lista una transacción `INGRESO`/`EGRESO` y el saldo se actualiza.
  - Verificar que los dropdowns de cuenta (caja/pagos) listan las cuentas de `bankAccounts`.

- [ ] **Step 4: Commit**

```bash
git add js/modules/cashRegister.js
git commit -m "feat: deprecar financialAccounts en cashRegister (usa bankAccounts)"
```

---

## Self-Review

**1. Cobertura del spec:**
- Fuente única `bankAccounts` → Tasks 1, 2, 7 ✓
- `initialBalance` al crear → Task 1 (seed) + Task 3 (UI) ✓
- Bitácora `bankTransactions` → Task 1 + Task 2 (recordTransaction) ✓
- Registro en cobranzas/pagos/otros ingresos → Tasks 5, 6 ✓
- Saldo derivado → Task 2 (getAccountBalance) ✓
- Modal con saldo + transacciones + medio → Task 4 ✓
- Deprecar `financialAccounts` → Task 7 ✓
- Reglas de borde (inactiva bloqueada, medio default, negativo rojo) → Task 2 (recordTransaction guard) + Task 4 (color) ✓

**2. Placeholder scan:** Sin TBD/TODO. Las tareas 5-6 usan variables marcadas como `<...>` porque el nombre exacto del objeto depende del código real del módulo; cada tarea indica que se adapte al objeto existente. Se puede precisar al ejecutar.

**3. Consistencia de tipos:** `recordTransaction(accountId, datos)` y `getAccountBalance(accountId)` definidos en Task 2 → usados consistentemente en Tasks 4-6. Campos de transacción coinciden con el spec (type/amount/medio/date/reference/description/createdAt).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-22-bank-account-ledger.md`.**