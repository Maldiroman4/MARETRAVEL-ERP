/**
 * Test unitario para verificar:
 * 1. Campos específicos de captura para PAQUETE_CRUCERO, PAQUETE_TURISTICO y PAQUETE_CONCIERTO en operationsHub.js
 * 2. Plantilla de impresión de Notas de Débito (debitNotes.js) sin datos inventados (no más 'BALCÓN' ni 'PENSIÓN COMPLETA')
 * 3. Retrocompatibilidad para notas existentes como #ndPQ002 (fallback de tourEndDate a desembarque sin guion '-')
 */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const opHubCode = fs.readFileSync('js/modules/operationsHub.js', 'utf8');
const debitNotesCode = fs.readFileSync('js/modules/debitNotes.js', 'utf8');

// Configurar sandbox
const sandbox = {
  window: {
    db: {
      get: () => ({
        serviceTypes: [],
        accounts: [{ id: 'ACC-1', code: 'CRU-01', name: 'ROYAL CARIBBEAN' }],
        debitNotes: [],
        creditNotes: [],
        companyContacts: []
      }),
      save: () => {}
    },
    maretravelCodes: {
      conceptoConCodigo: (c) => c || '',
      showDoc: (doc, type) => `${type} #${doc.ndNumber || doc.id}`,
      refNd: () => ''
    }
  },
  document: {
    getElementById: () => null
  },
  console: console,
  parseFloat: parseFloat,
  Number: Number,
  Boolean: Boolean
};
vm.createContext(sandbox);

// 1. Cargar OperationsHubModule
vm.runInContext(opHubCode, sandbox);
const opHub = sandbox.window.operationsHubModule;
assert(opHub, 'window.operationsHubModule debe estar definido');

console.log('>>> [TEST 1] Verificando renderItemSpecificFieldsHtml para PAQUETE_CRUCERO...');
const cruiseItem = {
  serviceType: 'PAQUETE_CRUCERO',
  serviceDetails: {
    cruiseShip: 'Royal Caribbean / Wonder of the Seas',
    cruiseItinerary: 'Caribe Occidental 7 Noches',
    departurePort: 'Miami, Florida',
    cabinType: 'Suite Junior',
    cruiseBoard: 'Todo Incluido',
    embarkDate: '2026-11-01',
    disembarkDate: '2026-11-08'
  }
};
const cruiseHtml = opHub.renderItemSpecificFieldsHtml(0, cruiseItem);
assert(cruiseHtml.includes('Naviera / Barco:'), 'Debe incluir campo Naviera / Barco');
assert(cruiseHtml.includes('Itinerario / Ruta:'), 'Debe incluir campo Itinerario / Ruta');
assert(cruiseHtml.includes('Puerto de Salida:'), 'Debe incluir campo Puerto de Salida');
assert(cruiseHtml.includes('Tipo de Cabina:'), 'Debe incluir campo Tipo de Cabina');
assert(cruiseHtml.includes('Régimen a Bordo:'), 'Debe incluir campo Régimen a Bordo');
assert(cruiseHtml.includes('Fecha Embarque:'), 'Debe incluir campo Fecha Embarque');
assert(cruiseHtml.includes('Fecha Desembarque:'), 'Debe incluir campo Fecha Desembarque');
assert(cruiseHtml.includes('Wonder of the Seas'), 'Debe enlazar el valor de barco');
assert(cruiseHtml.includes('2026-11-01'), 'Debe enlazar fecha de embarque');
assert(cruiseHtml.includes('2026-11-08'), 'Debe enlazar fecha de desembarque');
console.log(' -> OK: Formulario PAQUETE_CRUCERO renderiza todos los campos solicitados.');

console.log('>>> [TEST 2] Verificando renderItemSpecificFieldsHtml para PAQUETE_TURISTICO y PAQUETE_CONCIERTO...');
const tourHtml = opHub.renderItemSpecificFieldsHtml(0, {
  serviceType: 'PAQUETE_TURISTICO',
  serviceDetails: { tourDestination: 'Cancún 5D/4N', includes: 'Vuelo + Hotel' }
});
assert(tourHtml.includes('Destino / Nombre Paquete:'), 'Debe incluir nombre de paquete');
assert(tourHtml.includes('Qué Incluye:'), 'Debe incluir campo Qué Incluye');

const concertHtml = opHub.renderItemSpecificFieldsHtml(0, {
  serviceType: 'PAQUETE_CONCIERTO',
  serviceDetails: { concertArtist: 'Coldplay', concertVenue: 'Estadio Nacional' }
});
assert(concertHtml.includes('Artista / Evento:'), 'Debe incluir Artista / Evento');
assert(concertHtml.includes('Recinto / Estadio / Ciudad:'), 'Debe incluir Recinto / Estadio');
console.log(' -> OK: Formularios PAQUETE_TURISTICO y PAQUETE_CONCIERTO renderizan correctamente.');

// 2. Cargar DebitNotesModule
vm.runInContext(debitNotesCode, sandbox);
const debitNotes = sandbox.window.debitNotesModule;
assert(debitNotes, 'window.debitNotesModule debe estar definido');

console.log('>>> [TEST 3] Verificando impresión de ND con crucero completo...');
const dummyDoc = {
  id: 'ndPQ003',
  issueDate: '2026-10-22',
  currency: 'USD',
  passengerName: 'JUAN PEREZ'
};
const dummyItemCompleto = {
  id: 'NDI-1',
  serviceType: 'PAQUETE_CRUCERO',
  operatorName: 'ROYAL CARIBBEAN',
  operatorCode: 'CRU',
  currency: 'USD',
  totalAmount: 1850.00,
  passengerName: 'JUAN PEREZ',
  passengerDocId: 'P1234567',
  ticketNumber: 'RC-998877',
  serviceDetails: {
    cruiseShip: 'WONDER OF THE SEAS',
    cruiseItinerary: 'CARIBE OCCIDENTAL',
    departurePort: 'MIAMI, FLORIDA',
    cabinType: 'SUITE JUNIOR',
    cruiseBoard: 'TODO INCLUIDO',
    embarkDate: '2026-11-01',
    disembarkDate: '2026-11-08'
  }
};
const printHtmlCompleto = debitNotes.generateOfficialVoucherHtml({ ...dummyDoc, items: [dummyItemCompleto] });
assert(printHtmlCompleto.includes('CRUCERO: CARIBE OCCIDENTAL'), 'Debe imprimir el itinerario real');
assert(printHtmlCompleto.includes('CABINA: SUITE JUNIOR'), 'Debe imprimir la cabina ingresada');
assert(printHtmlCompleto.includes('RÉGIMEN: TODO INCLUIDO'), 'Debe imprimir el régimen ingresado');
assert(printHtmlCompleto.includes('01/11/2026'), 'Debe formatear fecha de embarque a DD/MM/AAAA');
assert(printHtmlCompleto.includes('08/11/2026'), 'Debe formatear fecha de desembarque a DD/MM/AAAA');
assert(printHtmlCompleto.includes('MIAMI, FLORIDA'), 'Debe imprimir el puerto de salida');
console.log(' -> OK: Impresión de crucero completo contiene todos los datos reales.');

console.log('>>> [TEST 4] Verificando que NO se inventen datos cuando cabina y régimen están vacíos...');
const dummyItemSinDatosExtra = {
  id: 'NDI-2',
  serviceType: 'PAQUETE_CRUCERO',
  operatorName: 'ROYAL CARIBBEAN',
  operatorCode: 'CRU',
  currency: 'USD',
  totalAmount: 1200.00,
  passengerName: 'MARIA LOPEZ',
  serviceDetails: {
    cruiseShip: 'ICON OF THE SEAS',
    cruiseItinerary: 'CARIBE SUR',
    departurePort: 'FORT LAUDERDALE'
  }
};
const printHtmlVacio = debitNotes.generateOfficialVoucherHtml({ ...dummyDoc, items: [dummyItemSinDatosExtra] });
assert(!printHtmlVacio.includes('BALCÓN'), 'NO debe inventar cabina BALCÓN si no fue especificada');
assert(!printHtmlVacio.includes('PENSIÓN COMPLETA'), 'NO debe inventar régimen PENSIÓN COMPLETA si no fue especificado');
assert(!printHtmlVacio.includes('CABINA:'), 'NO debe renderizar bloque CABINA si está vacío');
assert(!printHtmlVacio.includes('RÉGIMEN:'), 'NO debe renderizar bloque RÉGIMEN si está vacío');
console.log(' -> OK: No se inventan valores por defecto fantasmas cuando están vacíos.');

console.log('>>> [TEST 5] Verificando retrocompatibilidad para notas existentes (#ndPQ002)...');
// En #ndPQ002 se guardó con el form anterior: tourStartDate y tourEndDate, sin disembarkDate
const dummyItemViejoNdPQ002 = {
  id: 'NDI-OLD',
  serviceType: 'PAQUETE_CRUCERO',
  operatorName: 'CRUCEROS DEL SOL',
  operatorCode: 'CRU',
  currency: 'USD',
  totalAmount: 950.00,
  passengerName: 'CARLOS GOMEZ',
  ticketNumber: 'RES-CRU-001',
  serviceDetails: {
    tourDestination: 'CRUCERO BAHAMAS 4D/3N',
    tourStartDate: '2026-10-15',
    tourEndDate: '2026-10-19'
  }
};
const printHtmlNdPQ002 = debitNotes.generateOfficialVoucherHtml({ ...dummyDoc, items: [dummyItemViejoNdPQ002] });
assert(printHtmlNdPQ002.includes('15/10/2026'), 'Embarque debe tomar tourStartDate si embarkDate no existe');
assert(printHtmlNdPQ002.includes('19/10/2026'), 'Desembarque debe tomar tourEndDate si disembarkDate no existe');
// El desembarque ya NO debe salir como '-'
const disembarkMatch = printHtmlNdPQ002.match(/Desembarque\s*:\s*<\/span>\s*<span[^>]*>(.*?)<\/span>/i);
assert(disembarkMatch && disembarkMatch[1] === '19/10/2026', `Desembarque debe ser 19/10/2026, obtenido: ${disembarkMatch ? disembarkMatch[1] : 'null'}`);
assert(!printHtmlNdPQ002.includes('BALCÓN'), '#ndPQ002 no debe mostrar BALCÓN falso');
assert(!printHtmlNdPQ002.includes('PENSIÓN COMPLETA'), '#ndPQ002 no debe mostrar PENSIÓN COMPLETA falso');
console.log(' -> OK: #ndPQ002 ahora muestra fecha de desembarque 19/10/2026 sin guion vacío ni datos inventados.');

console.log('>>> [TEST 6] Verificando PAQUETE_TURISTICO sin includes inventado...');
const dummyItemPaqTuristico = {
  id: 'NDI-TUR',
  serviceType: 'PAQUETE_TURISTICO',
  operatorName: 'SOLWAYS',
  totalAmount: 800.00,
  passengerName: 'ANA TORRES',
  serviceDetails: {
    tourDestination: 'CUSCO Y MACHU PICCHU',
    tourStartDate: '2026-11-10',
    tourEndDate: '2026-11-14'
  }
};
const printHtmlPaq = debitNotes.generateOfficialVoucherHtml({ ...dummyDoc, items: [dummyItemPaqTuristico] });
assert(!printHtmlPaq.includes('VUELOS + HOTEL + TRASLADOS'), 'No debe inventar "VUELOS + HOTEL + TRASLADOS" si includes no existe');
console.log(' -> OK: PAQUETE_TURISTICO no inventa inclusiones por defecto.');

console.log('========================================================================');
console.log('>>> [PASS] TODOS LOS CHECKS DE PAQUETES Y CRUCEROS PASARON EXITOSAMENTE.');
console.log('========================================================================');
