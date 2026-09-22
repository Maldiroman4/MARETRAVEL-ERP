# MARETRAVEL ERP — Migración a Backend NestJS + Prisma + PostgreSQL

**Fecha:** 2026-09-18
**Rama de trabajo:** `feat/nestjs-backend`
**Estado:** Aprobado por el usuario (diseño validado por secciones)

---

## 1. Objetivo

Reemplazar la persistencia actual (frontend vanilla sobre `localStorage` + un único
`data/database.json` reescrito entero por el `server.js` de HTTP puro) por un **backend
monolítico NestJS** con **Prisma ORM** sobre **PostgreSQL 14**. El objetivo de fondo es
resolver el problema de **integridad de datos multi-usuario** (2-10 usuarios internos que
se pisan los datos al guardar) y que el código se sienta **escalable y mantenible**.

## 2. Decisiones clave (acordadas con el usuario)

| Tema | Decisión |
|------|----------|
| Frontend | **Opción A**: se mantiene vanilla (HTML/CSS/JS). Solo cambia su origen de datos a la API REST. No se migra a NextJS/React. |
| Estrategia | **Incremental**: Fase 1 = núcleo financiero (cuentas, NDs, NCs, caja, boletos). Resto en fases posteriores. |
| Estructura | **Monorepo**: carpeta `backend/` dentro del mismo proyecto. |
| Autenticación | **JWT + bcrypt** (NestJS), token firmado validado por guard. |
| Datos iniciales | **Sembrar desde cero** con datos de demostración (seed). No se migran datos reales. |
| API | **REST por recursos** con buenas prácticas (DTOs, validación, guards, errores unificados). |
| Moneda | **BOB/USD por separado** (como ya lo hace el sistema actual). |
| Control de cambios | Trabajo en **rama separada** `feat/nestjs-backend`. |

## 3. Arquitectura y estructura del monorepo

```
MARETRAVEL-ERP/
├── index.html          # Frontend vanilla (se queda)
├── js/  css/  assets/  # Frontend (se queda)
├── data/               # Solo respaldos/export del server legacy (temporal)
├── backend/            # NUEVO: Aplicación NestJS
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma      # PostgreSQL 14
│   ├── src/
│   │   ├── main.ts            # Bootstrap (validación global, prefijo /api, CORS)
│   │   ├── app.module.ts
│   │   ├── prisma/            # PrismaService (módulo global)
│   │   ├── auth/              # Login + JWT + bcrypt
│   │   ├── common/            # Guards JWT, decoradores, filtro de excepciones, DTO base
│   │   └── modules/           # Por dominio (Fase 1)
│   │       ├── accounts/
│   │       ├── debit-notes/
│   │       ├── credit-notes/
│   │       ├── cash-receipts/
│   │       └── gds-tickets/
│   └── test/                  # e2e (Supertest)
└── server.js            # Legacy temporal; se retira al completar la migración
```

- NestJS sirve la API bajo `/api/*`. El frontend vanilla consume la API con `fetch`.
- Fase 1: **cuentas, notas de débito, notas de crédito, caja/recibos y boletos GDS**.
- `server.js` permanece como *legacy temporal* durante la transición incremental; no se
  borra hasta que todos los módulos estén migrados.

## 4. Modelo de datos (Prisma + PostgreSQL)

Reutiliza y revisa el blueprint de `docs/schema.prisma`. Modelos de la Fase 1:

- **User** (nuevo, para JWT): id, username, passwordHash (bcrypt), name, role, email, activo.
- **Account** (clientes/proveedores): code, name, legalName, nit, relationType,
  accountType, rating, contactos, estado, auditoría de cambios.
- **CompanyContact** (solicitantes autorizados).
- **DebitNote** + **DebitNoteItem**: ventas con items, comisiones de proveedor/cliente,
  saldos BOB/USD, estado.
- **CreditNote**: NC automáticas (al cerrar ND) y manuales a proveedores.
- **Ticket** (boletos GDS): ruta, aerolínea, neto, impuestos, comisión, estado.
- **CashReceipt** (recibos de caja) + **PaymentLine** (desglose multimoneda).
- **FinancialAccount / BankAccount**: cajas, bancos, Binance.
- Tablas de soporte: **ServiceType**, **PaymentMethod**, **ExchangeRate**.

### Convenciones monetarias

- Montos en `Decimal(14,2)`.
- BOB y USD se almacenan **por separado** (campos `*AmountBob` y `*AmountUsd`), como ya lo
  hace el sistema actual. El T/C del día se registra en `ExchangeRate` y se usa para cuadre.

## 5. API REST por recursos (Fase 1)

Endpoints RESTful de NestJS con validación de DTOs (class-validator + class-transformer),
guards JWT y manejo de errores unificado.

**Auth**
- `POST /auth/login` → emite JWT.
- `GET /auth/me` → perfil del usuario autenticado.

**Accounts**
- `GET /accounts` (filtros: relationType, rating, búsqueda).
- `GET /accounts/:id`, `POST /accounts`, `PATCH /accounts/:id`.
- `POST /accounts/:id/contacts`.

**Debit Notes**
- `GET /debit-notes`, `POST /debit-notes`, `GET /debit-notes/:id`, `PATCH /debit-notes/:id`.
- `POST /debit-notes/:id/close` (cierre: bloquea ND, asigna boletos, genera NCs).
- `POST /debit-notes/:id/reopen`, `POST /debit-notes/:id/void` (anulación con motivo).
- `POST /debit-notes/:id/correct` (corrección contable con auditoría).

**Credit Notes**
- `GET /credit-notes`, `POST /credit-notes` (manual), `GET /credit-notes/:id`.

**Cash Receipts**
- `GET /cash-receipts`, `POST /cash-receipts`.
- `POST /cash-receipts/:id/void` (reversión con motivo).
- `POST /cash-receipts/:id/pay`.

**GDS Tickets**
- `GET /gds-tickets`, `POST /gds-tickets`, `PATCH /gds-tickets/:id`, filtros estado/aerolínea.

**Soporte**
- `GET /service-types`, `GET /payment-methods`, `GET /exchange-rate`, `PATCH /settings`.

**Impresión**
- `GET /print/:docType/:id` → HTML membretado (reusa lógica de `printRenderer.js`).

**Regla transversal:** toda mutación sensible (cerrar ND, anular, corregir, revertir caja)
exige un **`motivo` obligatorio** y escribe en el `auditLog`.

## 6. Integración del frontend vanilla

Sin reescribir la UI:

- **`js/api.js`**: cliente HTTP con `fetch` que guarda el JWT, lo adjunta como
  `Authorization: Bearer <token>` y maneja errores/expiración (redirige a login).
- **Adaptadores `js/adapters/`**: pequeñas capas que convierten la forma de datos que el
  frontend usa hoy a lo que la API espera y viceversa. `js/modules/*.js` se mantienen igual
  pero cambian su origen de datos.
- **Migración del frontend por módulo**: en cada fase, un módulo deja `localStorage` y pasa
  a `api.js`. Los no migrados siguen en `localStorage` hasta su fase.
- **Login**: valida contra `POST /auth/login` y guarda el token; la contraseña no se compara
  en el cliente.
- **Riesgo gestionado**: doble fuente de datos durante la transición. Se resuelve migrando
  módulo a módulo y haciendo que la UI siempre hable con `api.js` (que decide la fuente
  según la fase).

## 7. Testing, seed y despliegue

- **Seed** (`prisma/seed.ts`): crea BD vacía y la llena con datos de demostración
  (usuario `luis`, métodos de pago, cuentas bancarias/cajas, tipos de servicio, T/C inicial).
- **Unit (Jest):** lógica de negocio pura — saldos, comisiones, cierre de ND, cuadre de caja.
- **e2e (Supertest):** flujos completos contra BD de prueba — login, crear cuenta, emitir ND,
  cerrar ND y verificar NCs, cobrar y cuadrar.
- **Config:** `.env` con `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`; validada al arrancar.
- **Despliegue:** NestJS sirve también los estáticos del frontend cuando se retire `server.js`;
  un solo proceso en el puerto 3000 sirve UI + API. `INICIAR_SISTEMA.bat` se actualiza para
  levantar el backend NestJS.

## 8. Secuencia de fases de implementación

1. Scaffold NestJS + Prisma + PostgreSQL + JWT + seed.
2. Cuentas (Accounts) de punta a punta (API + adaptador frontend).
3. Boletos GDS.
4. Notas de Débito + Cierre (generación de NCs).
5. Notas de Crédito.
6. Caja/Recibos + cuadre multimoneda.
7. Retiro del `server.js` legacy y servir estáticos desde NestJS.

## 8bis. Estado transicional y desviaciones registradas en ejecución

Documenta las desviaciones del diseño acordadas durante la implementación de la Fase 1:

- **Retiro del `server.js` legacy:** El spec original (§3/§7) decía conservarlo "hasta que todos los
  módulos estén migrados". Se decidió retirarlo (renombrado a `server.legacy.js`): NestJS sirve la UI y
  la API en un solo proceso. Los módulos del frontend aún no migrados (NDs, NCs, caja, boletos, reportes)
  operan hoy en modo `localStorage`-solo (memoria del navegador) hasta que las fases siguientes los
  conecten a la API. El login ya valida contra `POST /api/auth/login` con JWT.
- **Endpoint de contactos (`POST /accounts/:id/contacts`) diferido:** El `CompanyContact` está en el
  esquema y `findOne` incluye `contacts`, pero el endpoint de creación no se implementó en la Fase 1.
  Se descopa explícitamente y se migrará en una fase posterior junto con la UI de cuentas.
- **Numeración secuencial por secuencia diferida:** Los correlativos (`ndNumber`, `ncNumber`,
  `receiptNumber`) se generan hoy con `max+1` acotado por `@unique` (una colisión concurrente falla con
  P2002 sin corromper datos). Para el objetivo multi-usuario de la migración, en una fase posterior se
  reemplazará por un esquema de secuencia atómica (tabla `Sequence`).
- **Integración del frontend:** Solo el login y el adaptador `js/adapters/accounts.js` (aún no conectado
  a la UI) consumen la API. El resto del frontend sigue sobre `js/db.js` + `localStorage`.

## 9. Fuera de alcance (Fase 1)

- Migración del resto de módulos (reportes contables avanzados, otros ingresos, recordatorios
  de viaje, monitor de vuelos) — se migran en fases posteriores.
- Migración de datos reales desde `data/database.json`.
- Migración del frontend a un framework (React/Next).