# MARETRAVEL ERP — Bitácora y saldo derivado de Cuentas Bancarias

**Fecha:** 2026-09-22
**Rama de trabajo:** `feat/bank-account-ledger`
**Estado:** Diseño aprobado por el usuario (secciones validadas)

---

## 1. Objetivo

Unificar las cuentas financieras del sistema en una sola fuente (`bankAccounts`, la sección
Cuentas Bancarias) para que todos los dropdowns de selección de cuenta usen lo registrado allí,
y registrar automáticamente cada transacción que use una cuenta (cobranzas, pagos a proveedores,
otros ingresos/depósitos) para poder mostrar, en un modal por cuenta, su **saldo derivado** y el
historial de transacciones con el detalle del medio de pago (efectivo, QR, transferencia, etc.).

## 2. Contexto actual (estado en `main`)

- **`bankAccounts`**: cuentas administradas en la sección Cuentas Bancarias (hoy solo bancarias).
- **`financialAccounts`**: lista separada (BANCO / BINANCE / EFECTIVO) que hoy puebla los
  dropdowns de cuenta financiera vía `financialGuard`. **No coincide** necesariamente con lo
  registrado en Cuentas Bancarias.
- El frontend en `main` **no usa SQL**: la app corre sobre `window.db` (`localStorage` +
  `data/database.json` vía `server.js`). El backend NestJS/PostgreSQL existe pero **no está
  conectado** al frontend de `main`.
- Los dropdowns de cuenta aparecen casi exclusivamente en **Caja/Cobranzas** (cobranzas y pagos a
  proveedores) y en **Otros Ingresos** (cuenta de depósito), vía `financialGuard.populateSelect`.

## 3. Decisiones acordadas

| Tema | Decisión |
|------|----------|
| Fuente de cuentas | **Una sola lista**: `bankAccounts` (Cuentas Bancarias). `financialAccounts` queda deprecada. |
| Tipos de cuenta | `bankAccounts` soporta `BANCO`, `BINANCE`, `EFECTIVO` (para registrar cajas y Binance). |
| Almacenamiento | En **localStorage** (`window.db`), coherente con la arquitectura actual de `main`. |
| Saldo / ajuste | **Derivado**: `saldo = saldoInicial + Σ ingresos − Σ egresos`. |
| Saldo inicial | Campo nuevo **`initialBalance`** al crear la cuenta. |
| Bitácora | Array nuevo **`bankTransactions`** en `window.db`. |
| Registro | Helper central `financialGuard.recordTransaction()` llamado desde cobranzas, pagos y otros ingresos. |
| Modal | Click en el card de una cuenta → modal con saldo derivado + listado de transacciones (con `medio`). |

## 4. Modelo de datos

### `bankAccounts` (unificado)
Cada cuenta puede tener:
- `id`, `name`/`bankName`, `accountNumber`, `accountType` (CORRIENTE/AHORROS/FONDO_ROTATORIO),
  `type` (`BANCO` | `BINANCE` | `EFECTIVO`), `currency` (BOB/USD/USDT), `titularName`,
  `initialBalance` (nuevo, número, default 0), `isActive`, `createdAt`, `updatedAt`, y campos
  específicos de tipo (ej. `binanceId`/`walletAddress` para BINANCE, `custodianName` para EFECTIVO).

### `bankTransactions` (nuevo array en `window.db`)
Cada entrada:
- `id`
- `accountId` (referencia a `bankAccounts`)
- `type`: `INGRESO` | `EGRESO`
- `amount` (número)
- `medio`: `EFECTIVO` | `QR` | `TRANSFERENCIA` | `CHEQUE` | `CRIPTO` (default `TRANSFERENCIA`)
- `date` (fecha de la operación)
- `reference` (nº de recibo / ND / NC)
- `description` (glosa)
- `createdAt`

## 5. Registro de transacciones (puntos de intercepción)

Helper central:
```
financialGuard.recordTransaction(accountId, { type, amount, medio, date, reference, description })
```
Agrega la entrada a `bankTransactions` y guarda `window.db`.

Se invoca cuando una operación usa una cuenta como destino/origen:
- **Cobranzas** (`cashRegister`): cuenta destino → `INGRESO`.
- **Pagos a proveedores** (`cashRegister`): cuenta origen → `EGRESO`.
- **Otros ingresos / depósitos** (`otherIncomes`): cuenta de depósito, al marcar PAGADO → `INGRESO`.

El `medio` se toma del método de pago usado en la operación.

## 6. Saldo derivado

```
saldo = initialBalance + Σ(INGRESO) − Σ(EGRESO)
```
- Saldo `>= 0` → verde. Saldo `< 0` → rojo (ajuste negativo).
- Cuenta sin transacciones → saldo = `initialBalance`.

## 7. Unificación de dropdowns (cambios en `financialGuard` y módulos)

- `financialGuard.getActiveAccounts()`, `getAccountById()` y `populateSelect()` leen **solo**
  `bankAccounts` (se elimina la referencia a `financialAccounts`).
- `populateSelect` sigue agrupando por `type` (BANCO/BINANCE/EFECTIVO).
- `cashRegister` (y demás) dejan de leer `financialAccounts` y usan `bankAccounts`.
- Sección **Cuentas Bancarias** (`bankAccounts.js`): se extiende para crear cuentas
  BANCO/BINANCE/EFECTIVO y capturar `initialBalance`.

## 8. Modal de cuenta (Cuentas Bancarias)

- Cada card de cuenta es clicable.
- Modal con:
  - Cabecera (banco/nombre, número, tipo, moneda, estado).
  - **Saldo / ajuste derivado** (positivo/negativo).
  - **Listado de transacciones**: fecha, tipo, monto, `medio`, referencia.

## 9. Reglas de borde

- Cuenta inactiva → bloqueada para operaciones (no transactable).
- `medio` default `TRANSFERENCIA` si la operación no lo especifica.
- Saldo inicial opcional (default 0).

## 10. Fuera de alcance

- Migración del ledger a PostgreSQL (se haría al migrar `main` al backend).
- Ajuste manual de saldo (el saldo es derivado, no se edita a mano).