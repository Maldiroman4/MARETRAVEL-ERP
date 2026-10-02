# Plan de Implementación: Solución Definitiva de Persistencia en Cuentas Bancarias

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantizar que las cuentas bancarias registradas por el usuario se guarden permanentemente en la base de datos (SQLite/Turso) y nunca más se borren ni desaparezcan al recargar la página o al día siguiente.

**Architecture:** Sincronización bidireccional y blindaje en dos capas:
1. **Frontend (`js/modules/bankAccounts.js`):** Cada creación, edición o cambio de estado en `bankAccounts` se replica sincrónicamente en `financialAccounts`.
2. **Backend (`server.js`, `server/sqlDatabase.js`, `server/tursoDatabase.js`):** `saveDb` y `saveFullState` unifican `bankAccounts` y `financialAccounts` antes de persistir en la tabla relacional `financial_accounts` y antes de ejecutar el prune, evitando la eliminación física de registros huérfanos.

**Tech Stack:** JavaScript vanilla (ES6+), SQLite (Node nativo `node:sqlite`), Turso (`@libsql/client`), endpoints REST `/api/db`.

---

## Diagnóstico de Causa Raíz ("¿Qué pasó?")

El cliente reportó por WhatsApp:
> *"JOEL LAS CUENTAS BANCARIAS [CADA] DIA SE BORRAN. YO PUSE DOS VECES LAS CUENTS EN DIFERENTES DIAS Y SE SIGUE BORRANDO"*

### La Causa Raíz Exacta:
1. **Desconexión entre Frontend y Backend:**
   - En el frontend (`js/modules/bankAccounts.js`), cuando el usuario creaba una cuenta nueva (`handleSave`):
     ```javascript
     data.bankAccounts.unshift(newAccount);
     window.db.save(data);
     ```
     La cuenta se agregaba **únicamente** al array `data.bankAccounts`. **Nunca** se agregaba a `data.financialAccounts`.
2. **Persistencia SQL sólo lee `financialAccounts`:**
   - En el backend (`server/sqlDatabase.js` y `server/tursoDatabase.js`), la capa SQL no tiene tabla `bank_accounts`; almacena todo en la tabla `financial_accounts` (`type = 'BANCO'`).
   - Al guardar (`saveFullState`), el backend ejecutaba:
     ```javascript
     this._guardarCada(state.financialAccounts, 'cuenta financiera', fa => this.saveFinancialAccount(fa));
     pruneMissing('financial_accounts', 'id', state.financialAccounts);
     ```
     El backend **ignoraba por completo `state.bankAccounts`**. La nueva cuenta no estaba en `state.financialAccounts`, por lo que **nunca se insertaba en SQLite/Turso**. Y además, el prune eliminaba cualquier fila que no estuviese en `state.financialAccounts`.
3. **El borrado diario / al recargar:**
   - La cuenta quedaba viva temporalmente en la memoria del navegador y en el `localStorage` durante esa sesión.
   - Al día siguiente (o al cerrar y volver a abrir el navegador / presionar F5), `js/db.js` ejecutaba `syncWithServerFile()`, que llama a `GET /api/db`.
   - El backend respondía con `getFullState()`:
     ```javascript
     bankAccounts: financialAccounts.filter(a => a.type === 'BANCO')
     ```
   - Como la tabla SQL nunca tuvo la nueva cuenta bancaria, `bankAccounts` devolvía un array vacío `[]`.
   - El navegador recibía `bankAccounts: []`, sobreescribía `localStorage`, y la pantalla mostraba: *"No se encontraron cuentas bancarias"*.

---

## Global Constraints

- **Sin dependencias nuevas:** Node nativo y dependencias existentes únicamente.
- **Principio Ponytail:** Mínimo diff que resuelve la causa raíz en el origen compartido.
- **Defensa en profundidad:** Si el frontend envía solo `bankAccounts`, el backend lo sincroniza automáticamente antes de escribir en disco/SQL. Si el frontend se recarga, ambos arrays están siempre en sincronía.
- **Test de verificación:** Un script de verificación ejecutable (`node tests/test_bank_persistence.js`) que demuestre la persistencia end-to-end antes y después del guardado.

---

## Tareas de Implementación

### Tarea 1: Sincronización en Frontend (`js/modules/bankAccounts.js`)
**Archivos:** `js/modules/bankAccounts.js`

- [ ] **Paso 1.1:** En `handleSave(e)` (bloque de creación nueva cuenta):
  Cuando se crea `newAccount`, agregar simultáneamente el registro a `data.financialAccounts`:
  ```javascript
  if (!data.financialAccounts) data.financialAccounts = [];
  const finAccount = {
    id: newAccount.id,
    type: newAccount.type || 'BANCO',
    bankName: newAccount.bankName,
    accountNumber: newAccount.accountNumber,
    accountType: newAccount.accountType,
    titularName: newAccount.titularName,
    currency: newAccount.currency,
    isActive: newAccount.isActive,
    currentBalance: newAccount.initialBalance || 0,
    initialBalance: newAccount.initialBalance || 0,
    createdAt: newAccount.createdAt,
    updatedAt: newAccount.updatedAt
  };
  data.financialAccounts.unshift(finAccount);
  ```
- [ ] **Paso 1.2:** En `handleSave(e)` (bloque de edición de cuenta existente):
  Actualizar los campos equivalentes en `data.financialAccounts`:
  ```javascript
  const finIndex = (data.financialAccounts || []).findIndex(f => f.id === this.editingAccountId);
  if (finIndex !== -1) {
    data.financialAccounts[finIndex] = {
      ...data.financialAccounts[finIndex],
      bankName,
      accountNumber,
      accountType,
      currency,
      titularName,
      type,
      initialBalance,
      isActive,
      updatedAt: now
    };
  }
  ```
- [ ] **Paso 1.3:** En `toggleStatus(id)`:
  Al alternar `isActive` en `data.bankAccounts`, alternar también en `data.financialAccounts`:
  ```javascript
  const finAcc = (data.financialAccounts || []).find(f => f.id === id);
  if (finAcc) {
    finAcc.isActive = acc.isActive;
    finAcc.updatedAt = acc.updatedAt;
  }
  ```

---

### Tarea 2: Blindaje de Persistencia en Servidor (`server.js`)
**Archivos:** `server.js`

- [ ] **Paso 2.1:** En `server.js`, crear un helper de normalización preventiva:
  ```javascript
  function ensureFinancialAccountsSync(data) {
    if (!data || typeof data !== 'object') return;
    if (Array.isArray(data.bankAccounts)) {
      if (!Array.isArray(data.financialAccounts)) data.financialAccounts = [];
      for (const bnk of data.bankAccounts) {
        if (!bnk || !bnk.id) continue;
        const idx = data.financialAccounts.findIndex(f => f.id === bnk.id);
        const finObj = {
          id: bnk.id,
          type: bnk.type || 'BANCO',
          bankName: bnk.bankName || '',
          accountNumber: bnk.accountNumber || '',
          accountType: bnk.accountType || 'CORRIENTE',
          titularName: bnk.titularName || '',
          currency: bnk.currency || 'BOB',
          isActive: bnk.isActive !== false,
          currentBalance: bnk.currentBalance ?? bnk.initialBalance ?? 0,
          initialBalance: bnk.initialBalance ?? bnk.currentBalance ?? 0,
          deleted: bnk.deleted === true,
          deletedAt: bnk.deletedAt || null,
          deletedBy: bnk.deletedBy || null,
          createdAt: bnk.createdAt || new Date().toLocaleString(),
          updatedAt: bnk.updatedAt || new Date().toLocaleString()
        };
        if (idx !== -1) {
          data.financialAccounts[idx] = { ...data.financialAccounts[idx], ...finObj };
        } else {
          data.financialAccounts.push(finObj);
        }
      }
    }
  }
  ```
- [ ] **Paso 2.2:** Invocar `ensureFinancialAccountsSync(data)` al inicio de `saveDb(data)`.

---

### Tarea 3: Blindaje en Motores de Base de Datos (`server/sqlDatabase.js` y `server/tursoDatabase.js`)
**Archivos:** `server/sqlDatabase.js`, `server/tursoDatabase.js`

- [ ] **Paso 3.1:** En `server/sqlDatabase.js` dentro de `saveFullState(state)`:
  Antes de llamar a `this._guardarCada(state.financialAccounts, ...)` y antes de `pruneMissing('financial_accounts', ...)`:
  Asegurar que cualquier cuenta presente en `state.bankAccounts` esté incluida en `state.financialAccounts`.
- [ ] **Paso 3.2:** En `server/tursoDatabase.js` dentro de `saveFullState(state)`:
  Replicar la misma unificación previa para que Turso genere sentencias SQL para todas las cuentas de `bankAccounts` y no las pode en `addPruneStmt`.
- [ ] **Paso 3.3:** En `getFullState()` de ambos motores:
  Garantizar que `bankAccounts` proyecte todas las cuentas con `(a.type || 'BANCO') === 'BANCO'`.

---

### Tarea 4: Test Automatizado de Verificación y Cierre
**Archivos:** `tests/test_bank_persistence.js`

- [ ] **Paso 4.1:** Crear script de test assertivo `tests/test_bank_persistence.js`:
  1. Registra una cuenta bancaria de prueba con ID `BNK-TEST-PERSISTENCE`.
  2. Guarda el estado mediante `persistence.saveFullState(state)`.
  3. Carga el estado limpio desde la base de datos física mediante `persistence.getFullState()`.
  4. Verifica con `assert` que `BNK-TEST-PERSISTENCE` existe tanto en `bankAccounts` como en `financialAccounts`.
  5. Limpia el registro de prueba.
- [ ] **Paso 4.2:** Ejecutar `node tests/test_bank_persistence.js` y confirmar salida exitosa.
- [ ] **Paso 4.3:** Verificar sintaxis de todos los archivos modificados con `node --check`.

---

## Verificación Manual Recomendada para el Usuario
1. Abrir la sección **Cuentas Bancarias** en el ERP.
2. Registrar una cuenta bancaria (ej. *Banco Unión*, Cta. *10000012345678*, BOB).
3. Presionar **F5** (o cerrar la pestaña y volver a abrir).
4. Comprobar que la cuenta bancaria permanece visible en la cuadrícula de cuentas y disponible en los modales de cobro/pago.
