# MARETRAVEL - Sistema ERP Comercial, Contable y GDS

Sistema web integral de gestión administrativa, comercial y contable desarrollado a medida para la agencia de viajes y turismo **"MARETRAVEL"**, basado en las reglas operativas y contables de las agencias de viajes (ingeniería inversa del ERP SACS).

Desarrollado en **HTML5, CSS3 y JavaScript moderno**, listo para ejecutarse de forma inmediata en cualquier navegador sin necesidad de servidores adicionales o configuraciones complejas.

---

## 🚀 Cómo Iniciar la Aplicación y Persistencia en Carpeta

El sistema está completamente limpio (iniciando desde 0) para que registres tus propias cuentas, boletos, notas de débito y movimientos.

### Opción 1 (Recomendada - Con Guardado Físico Automático en la Carpeta):
1. Ve a la carpeta del sistema: `C:\Users\ACER\Desktop\MARETRAVEL-ERP`
2. Haz **doble clic en `INICIAR_SISTEMA.bat`**.
3. Se abrirá automáticamente el sistema en `http://localhost:3000`.
4. **Todos los registros se guardan en tiempo real tanto en el navegador como en el archivo físico `data/database.json`** de la carpeta.

### Opción 2 (Apertura Directa):
- Haz doble clic directamente en `index.html`. El sistema guardará todo en la memoria de tu navegador y podrás descargar o sincronizar tu archivo `data/database.json` con el botón superior **"Guardado en Carpeta"**.

### 🔑 Credenciales de Acceso Oficiales:
- **Usuario:** `luis`
- **Contraseña:** `585858`

---

## 🎨 Identidad Visual y Logotipo Corporativo

- **Logotipo Oficial Integrado:** Utiliza el logotipo corporativo de **Maretravel** ubicado en `assets/logo.jpg`.
- **Paleta de Colores de Marca:**
  - Azul Cyan: `#00aeef`
  - Amarillo Sol: `#ffd200`
  - Azul Marino Ejecutivo: `#0f2742`
- **Diseño Ergonómico Contable:** Tablas de alta densidad de información, fuentes monoespaciadas para importes y boletos, badges de estado y atajos de teclado rápidos.

---

## 📌 Módulos Implementados y Lógica de Negocio

### 1. Panel de Control Ejecutivo (Dashboard)
- Indicadores Clave en Tiempo Real:
  - **Total Ventas Facturadas (NDs).**
  - **Cuentas por Cobrar (Clientes):** Saldo exigible acumulado.
  - **Cuentas por Pagar (Proveedores):** Saldo adeudado a aerolíneas y operadores.
  - **Recaudación en Caja Hoy:** En Moneda Nacional (BOB) y su equivalente en Dólares (USD).
- **Widget de Tipo de Cambio en Vivo:** Visualización y ajuste inmediato de las tasas de compra y venta (ej: 6.86 / 6.96).
- Grilla de últimas Notas de Débito emitidas y accesos directos rápidos.

### 2. Gestión de Cuentas (Clientes y Proveedores)
- Directorio unificado con búsqueda predictiva por Código, Nombre, Razón Social o NIT.
- Filtro por relación: `CLIENTE`, `PROVEEDOR` o `AMBOS`.
- Clasificación por tipo de cuenta (`EMPRESA`, `PERSONA`, `AEROLINEA`, `HOTEL`, etc.) y calificativo (`VIP`, `IMPORTANTE`, `NORMAL`, `CRITICA`).
- **Prestadores de Servicios del Operador:** Para cuentas proveedoras/aerolíneas, permite parametrizar códigos IATA (ej: `OB` para Boliviana de Aviación, `Z8` para Amaszonas) y asociar la tasa de comisión estándar (%) que otorga.
- **Auditoría de Modificaciones:** Cada cambio en el nombre, NIT, dirección o calificación registra en una bitácora inmutable qué usuario lo modificó, valor previo, valor nuevo y fecha/hora.

### 3. Ingesta y Pool de Boletos GDS (Amadeus / Sabre)
- Grilla de boletos leídos del GDS con filtros por Counter, Emisión, Pasajero, Aerolínea y Estado (`DISPONIBLE`, `ASIGNADO`, `ANULADO`).
- **Simulador de Emisión GDS:** Permite generar boletos de prueba con rutas nacionales/internacionales, tarifas netas, impuestos, comisiones calculadas y fees de emisión listos para ser asignados.

### 4. Notas de Débito (ND) - Facturación y Ventas
- Emisión de comprobantes de cobro con selección de Cliente, Solicitante, Moneda y Plazos de Pago (`AL CONTADO`, `CRÉDITO 7/15/30 DÍAS`).
- **Adición de Boletos GDS:** Modal de búsqueda e incorporación de boletos del pool disponible.
- **Servicios Manuales y Terrestres:** Hoteles, paquetes turísticos, rent-a-car y seguros con cálculo de:
  - Comisión del Proveedor (ganancia de la agencia).
  - Comisión Cedida a la Agencia Cliente (para clientes sub-agencias, con descuento automático del neto).
- **Cierre Definitivo de ND (Acción Crítica):**
  - Bloquea la ND para prevenir modificaciones.
  - Cambia los boletos asociados a estado `ASIGNADO`.
  - **Genera automáticamente las Notas de Crédito (NC)** a favor de cada proveedor/aerolínea por el costo neto del servicio.
- **Reapertura de ND:** Permite volver al borrador revirtiendo o anulando las NCs automáticas siempre que la ND no tenga pagos ya registrados en caja.
- **Formatos de Impresión Oficiales:**
  - **Formato Corto (Media Página):** Resumen para entrega de boletos en counter.
  - **Formato Largo (Hoja Carta):** Documento formal con membrete MARETRAVEL, observaciones legales y cajas de firma ("Entregado por" y "Recibido Conforme").

### 5. Notas de Crédito a Proveedores (NC - Cuentas por Pagar)
- Visualización diferenciada entre:
  - **NC Automáticas:** Generadas al cerrar una Nota de Débito, con referencia explícita al número de ND de origen.
  - **NC Manuales:** Registro directo de ajustes, comisiones de terceros o notas de cargo.
- Control de saldos pendientes y pagos realizados a cada proveedor.

### 6. Caja, Cobranzas y Pagos Multimoneda
- **Cobranzas a Clientes:**
  - Búsqueda de cliente y listado de sus NDs pendientes de amortización.
  - Soporte de pagos totales o parciales por documento.
  - **Cobro Multimoneda Mixto:** Permite desglosar el pago combinando diferentes monedas y medios (ej: parte en USD Efectivo y el saldo en BOB Transferencia Bancaria BNB), realizando el cuadre automático según el T/C del día.
  - Emisión inmediata del **Recibo Oficial de Caja de MARETRAVEL** con numeración correlativa, membrete, desglose de NDs amortizadas, saldos restantes y formas de pago utilizadas.
- **Liquidación a Proveedores:**
  - Pago de NCs pendientes utilizando cuentas bancarias de la agencia.
- **Historial y Reversión de Comprobantes:**
  - Reversión obligatoria con ingreso de motivo justificado para auditoría.
  - Al revertir un recibo, se restauran automáticamente los saldos pendientes originales de las Notas de Débito afectadas.

### 7. Reportes y Módulo Contable para el Contador General
- **Filtro de Período Flexible:** Selección de fechas **"Desde"** y **"Hasta"** para auditorías mensuales, quincenales o personalizadas.
- **Filtro por Estado Fiscal:** Permite visualizar todos los comprobantes, solo válidos o solo anulados.
- **Submódulos Especializados del Contador:**
  1. **Arqueo y Cierre Diario de Caja:** Recaudación consolidada por moneda y medio de pago, y detalle cronológico de cobros.
  2. **Libro Contable de Ventas (Notas de Débito):**
     - Detalle de correlativo fiscal, fecha, NIT/CI del cliente, razón social, monto bruto facturado en BOB, comisión de agencia ganada, alícuota estimada de débito fiscal IVA/IT (14.94%) y estado.
  3. **Libro Contable de Compras y Proveedores (Notas de Crédito):**
     - Liquidación por proveedor/aerolínea (BoA, Amaszonas, Hoteles), origen de ND, montos liquidados, pagos amortizados y saldos por pagar.
  4. **Estado de Comisiones y Utilidad Fiscal de la Agencia:**
     - Análisis de rentabilidad: Venta bruta, costo neto de operadores aéreos/terrestres, comisiones de agencia, comisiones cedidas a clientes sub-agencia y utilidad neta final.
- **Operaciones Críticas del Contador:**
  - **Anulación de Comprobantes (ND / NC):**
    - Exige ingresar obligatoriamente el **motivo justificado de anulación** para trazabilidad tributaria.
    - El correlativo numérico **se mantiene visible en los libros contables** con estado `ANULADA` e importe `0.00` para garantizar la continuidad secuencial sin saltos fiscales.
    - Libera los boletos GDS asociados devolviéndolos al pool `DISPONIBLE` y anula las NCs automáticas relacionadas.
  - **Corrección Contable de Comprobantes:**
    - Permite al contador rectificar errores tipográficos en **NIT/CI, Razón Social, Fecha Contable, Solicitante o Glosa** sin alterar los importes base ya cuadrados.
    - Registra el historial de auditoría con fecha, usuario y justificación.
- **Exportación e Impresión:**
  - **Descargar Excel (.CSV):** Genera archivos compatibles con Microsoft Excel respetando codificación UTF-8 BOM para caracteres especiales y tildes.
  - **Imprimir Reporte Oficial:** Formato membretado en hoja apaisada/carta con casillas de firma para el **Contador General (Matrícula CAUB)** y **Gerencia General**.

### 8. Calendario de Itinerarios y Monitor de Vuelos (Ventana Aparte)
- **Vista en Ventana Independiente (Pop-Out):**
  - Puede abrirse haciendo doble clic en `calendario.html` o pulsando el botón **"Monitor de Vuelos"** en la barra superior del ERP.
  - Diseñado para que los administradores y counters lo mantengan abierto en una segunda pantalla o ventana flotante.
- **Grilla Interactiva del Calendario Mensual:**
  - Código cromático de vuelos:
    - 🛫 **Vuelos de Salida (Ida):** Etiquetas cyan con horario, nombre del pasajero y ruta.
    - 🛬 **Vuelos de Retorno (Vuelta):** Etiquetas doradas con horario de llegada.
  - Resaltado con borde animado del día actual (**HOY**).
- **Centro de Notificaciones y Alertas Automáticas:**
  - Campana de notificación en la barra superior con contador en vivo de alertas.
  - Clasificación automática de urgencia:
    - 🚨 **SALIDA HOY / RETORNA HOY** (Alerta roja/verde prioritaria)
    - ⚠️ **VIAJA MAÑANA (En 24 horas)** (Alerta ámbar)
- **Acciones Rápidas para el Administrador:**
  - **Notificar por WhatsApp:** Genera un mensaje prediseñado profesional con ruta, fechas, horas, nro de boleto y recomendaciones de presentación para enviarlo con 1 clic al celular del pasajero.
  - **Imprimir Itinerario Oficial:** Emisión de confirmación de vuelo membretada con el logotipo de MARETRAVEL, desglose de tramos de ida/vuelta y firmas de entrega.
  - **Registrar Nuevo Itinerario:** Modal para dar de alta vuelos con o sin retorno, asociándolos a cualquier cliente registrado.

### 9. Configuración y Copias de Seguridad
- Actualización del Tipo de Cambio Oficial (Compra / Venta).
- Parametrización de Medios de Pago (`BS-01` Efectivo, `US-01` Efectivo USD, Cuentas Bancarias BNB, BMSC, QR).
- Parámetros fiscales: Razón social, NIT de MARETRAVEL, dirección, teléfonos y tasa IVA/IT (14.94%).
- **Respaldo y Mantenimiento:**
  - Exportar base de datos en formato `.JSON`.
  - Restaurar copia de seguridad.
  - Botón de restablecimiento a valores iniciales de demostración.

---

## ⌨️ Atajos de Teclado del Sistema (ERP Shortcuts)

- `Alt + 1` o `Alt + D` : Ir al **Dashboard**
- `Alt + 2` o `Alt + C` : Ir a **Cuentas**
- `Alt + 3` o `Alt + G` : Ir a **Boletos GDS**
- `Alt + 4` o `Alt + N` : Ir a **Notas de Débito**
- `Alt + 5` o `Alt + P` : Ir a **Notas de Crédito**
- `Alt + 6` o `Alt + J` : Ir a **Caja y Cobranzas**
- `Alt + 7` o `Alt + R` : Ir a **Reportes y Contabilidad**
- `Alt + 8` o `Alt + V` : Ir al **Calendario de Viajes**
- `ESC` : Cerrar cualquier ventana modal activa
