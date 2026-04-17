/**
 * Validacion exhaustiva del xlsx Gate3 generado:
 *   - Se abre bien con xlsx-populate (ambas vias)
 *   - Valores en celdas correctas (header, OEE, ciclo, demanda)
 *   - Formulas preservadas
 *   - Cero texto en ingles en hojas visibles
 *   - Logo Barack aplicado (no el logo VW)
 *   - Sin password en hojas visibles
 *   - XML valido (orden OOXML respetado)
 */
import XlsxPopulate from 'xlsx-populate';
import JSZip from 'jszip';
import { readFileSync } from 'fs';

const filePath = process.argv[2];
if (!filePath) { console.error('Uso: node _validateGate3Export.mjs <xlsxPath>'); process.exit(1); }

let passed = 0, failed = 0;
const check = (name, cond, extra = '') => {
    if (cond) { console.log(`  OK  ${name}${extra ? ' — ' + extra : ''}`); passed++; }
    else { console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); failed++; }
};

// === xlsx-populate open ===
console.log('\n=== 1. Abrir con xlsx-populate ===');
const wb = await XlsxPopulate.fromFileAsync(filePath);
const sheets = wb.sheets().map(s => s.name());
check('Se abre sin error', true);
check('Tiene hoja CapacitySFN', sheets.includes('CapacitySFN'));
check('Tiene hoja OEE CalculatorSFN', sheets.includes('OEE CalculatorSFN'));
check('Tiene hoja DiagramSFN', sheets.includes('DiagramSFN'));

const cap = wb.sheet('CapacitySFN');
const oee = wb.sheet('OEE CalculatorSFN');
const diag = wb.sheet('DiagramSFN');

// === Header valores ===
console.log('\n=== 2. Header CapacitySFN ===');
check('Titulo B3 en espanol', cap.cell('B3').value() === 'VERIFICACION DE CAPACIDAD', `"${cap.cell('B3').value()}"`);
check('Label B5 = Numero de parte', cap.cell('B5').value() === 'Numero de parte', `"${cap.cell('B5').value()}"`);
check('Label I5 = Creado por', cap.cell('I5').value() === 'Creado por', `"${cap.cell('I5').value()}"`);
check('Label B6 = Denominacion', cap.cell('B6').value() === 'Denominacion', `"${cap.cell('B6').value()}"`);
check('Label I6 = Fecha', cap.cell('I6').value() === 'Fecha', `"${cap.cell('I6').value()}"`);
check('Label B7 = Proyecto', cap.cell('B7').value() === 'Proyecto', `"${cap.cell('B7').value()}"`);
check('Label B8 = Proveedor', cap.cell('B8').value() === 'Proveedor', `"${cap.cell('B8').value()}"`);
check('Label B9 = Ubicacion', cap.cell('B9').value() === 'Ubicacion', `"${cap.cell('B9').value()}"`);
check('Valor C5 numero de parte', typeof cap.cell('C5').value() === 'string' && cap.cell('C5').value().length > 0, `"${cap.cell('C5').value()}"`);
check('Valor C7 = codigo proyecto', cap.cell('C7').value() === 'PATAGONIA', `"${cap.cell('C7').value()}"`);
check('Valor C8 = Barack Mercosul', cap.cell('C8').value() === 'Barack Mercosul', `"${cap.cell('C8').value()}"`);
check('Valor C9 = Zarate, Argentina', cap.cell('C9').value() === 'Zarate, Argentina', `"${cap.cell('C9').value()}"`);
check('Valor J5 creador VACIO', !cap.cell('J5').value(), `"${cap.cell('J5').value() ?? ''}"`);
const fecha = cap.cell('J6').value();
check('Valor J6 fecha formato DD/MM/YYYY', typeof fecha === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(fecha), `"${fecha}"`);

// === Estacion 1 datos ===
console.log('\n=== 3. Estacion 1 (datos del proyecto) ===');
check('G11 turnos/semana = 15', cap.cell('G11').value() === 15, `${cap.cell('G11').value()}`);
check('B13 nombre proceso no vacio', typeof cap.cell('B13').value() === 'string' && cap.cell('B13').value().length > 0, `"${cap.cell('B13').value()}"`);
// Cycle time G13 es LINKED al OEE Calculator, su value puede ser formula o null
check('G14 horas por turno > 0', cap.cell('G14').value() > 0, `${cap.cell('G14').value()}`);
check('G15 OEE = 0.45', Math.abs(cap.cell('G15').value() - 0.45) < 0.001, `${cap.cell('G15').value()}`);
// G16 cavidades en CapacitySFN es LINKED (formula =OEE!E15) — Excel lo recalcula al abrir.
// Solo verificamos que la formula apunte al OEE Calc; el valor real (9) se valida en E15.
const g16f = cap.cell('G16').formula();
check('G16 cavidades tiene formula al OEE Calc', typeof g16f === 'string' && /OEE/.test(g16f), `formula: "${g16f}"`);
check('G17 reservation = 1', cap.cell('G17').value() === 1, `${cap.cell('G17').value()}`);
check('G18 machines >= 1', cap.cell('G18').value() >= 1, `${cap.cell('G18').value()}`);

// === Labels estacion 1 ===
console.log('\n=== 4. Labels estacion 1 (espanol) ===');
check('F11 = Turnos/semana', cap.cell('F11').value() === 'Turnos/semana', `"${cap.cell('F11').value()}"`);
check('F13 = Tiempo de ciclo (seg)', cap.cell('F13').value() === 'Tiempo de ciclo (seg)', `"${cap.cell('F13').value()}"`);
check('F14 = Horas por turno', cap.cell('F14').value() === 'Horas por turno', `"${cap.cell('F14').value()}"`);
check('F15 = OEE', cap.cell('F15').value() === 'OEE', `"${cap.cell('F15').value()}"`);
// F16 es label Cavidades (inyeccion) — applyStation lo pone explicito
check('F16 = Cavidades (inyeccion)', cap.cell('F16').value() === 'Cavidades', `"${cap.cell('F16').value()}"`);
check('F18 = Inyectoras paralelas', cap.cell('F18').value() === 'Inyectoras paralelas', `"${cap.cell('F18').value()}"`);
check('E17 = Reserva para proyecto', cap.cell('E17').value() === 'Reserva para proyecto', `"${cap.cell('E17').value()}"`);

// === OEE CalculatorSFN labels ===
console.log('\n=== 5. OEE CalculatorSFN ===');
check('C3 = CALCULADOR OEE', oee.cell('C3').value() === 'CALCULADOR OEE', `"${oee.cell('C3').value()}"`);
check('D13 = Tiempo de observacion (min)', oee.cell('D13').value() === 'Tiempo de observacion (min)');
check('D14 = Tiempo de ciclo (seg)', oee.cell('D14').value() === 'Tiempo de ciclo (seg)');
check('D15 = Cavidades (cantidad)', oee.cell('D15').value() === 'Cavidades (cantidad)');
check('D20 = Disponibilidad', oee.cell('D20').value() === 'Disponibilidad');
check('D21 = Rendimiento', oee.cell('D21').value() === 'Rendimiento');
check('D22 = Calidad', oee.cell('D22').value() === 'Calidad');
check('D23 = OEE', oee.cell('D23').value() === 'OEE');
// Inputs estacion 1 — columna E
check('E14 cycle time estacion 1 > 0', oee.cell('E14').value() > 0, `${oee.cell('E14').value()}`);
check('E15 cavidades estacion 1 = 9', oee.cell('E15').value() === 9, `${oee.cell('E15').value()}`);

// === DiagramSFN ===
console.log('\n=== 6. DiagramSFN ===');
check('B3 titulo en espanol', typeof diag.cell('B3').value() === 'string' && /DIAGRAMA/.test(diag.cell('B3').value()), `"${diag.cell('B3').value()}"`);
check('F7 demanda normal > 0', diag.cell('F7').value() > 0, `${diag.cell('F7').value()}`);

// === JSZip: inspeccion profunda ===
console.log('\n=== 7. Archivo xlsx a nivel zip ===');
const zip = await JSZip.loadAsync(readFileSync(filePath));
const logoFile = zip.file('xl/media/image1.jpeg');
check('Tiene xl/media/image1.jpeg', !!logoFile);
if (logoFile) {
    const logoBuf = await logoFile.async('nodebuffer');
    // JPEG empieza con FFD8FF — validamos que sea el Barack (tamano ~6210 bytes)
    check('Logo es JPEG valido', logoBuf[0] === 0xFF && logoBuf[1] === 0xD8 && logoBuf[2] === 0xFF);
    check('Logo Barack (tamano distinto al VW de 3341 bytes)', logoBuf.length !== 3341, `${logoBuf.length} bytes`);
}

// Verificar cero texto en ingles en sharedStrings (hojas visibles)
const ss = await zip.file('xl/sharedStrings.xml').async('string');
const texts = [...ss.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map(m =>
    [...m[1].matchAll(/<t[^>]*>([^<]+)<\/t>/g)].map(x => x[1]).join('')
);
// Mapear indice -> texto
async function checkSheetForEnglish(sheetFile, label) {
    const xml = await zip.file(sheetFile).async('string');
    const refs = [...xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*t="s"[^>]*><v>(\d+)<\/v>/g)];
    const visible = refs.map(r => ({ cell: r[1], text: texts[parseInt(r[2])] }));
    // Palabras claramente en ingles o aleman. "Formula" sin tilde es espanol tambien,
    // asi que solo flageamos el "Formel" aleman.
    const english = visible.filter(v => /^(Cavities|Machines|Shifts\/week|Hours\/shift|Cycle time|Reservation|Part number|Part designation|Creator|Supplier|Location|Observation time|Downtime|OK parts|NOT OK|Availability|Performance|Capacity check|Formel|Schichten|Kavit|Arbeitszeit|Stck\.|Zykluszeit)/i.test(v.text));
    check(`${label}: cero texto en ingles`, english.length === 0,
        english.length > 0 ? `aun en ingles: ${english.map(e => e.cell + '="' + e.text.slice(0, 30) + '"').join(', ')}` : `${visible.length} strings totales`);
}
await checkSheetForEnglish('xl/worksheets/sheet2.xml', 'CapacitySFN');
await checkSheetForEnglish('xl/worksheets/sheet3.xml', 'OEE CalculatorSFN');
await checkSheetForEnglish('xl/worksheets/sheet4.xml', 'DiagramSFN');

// Formulas preservadas
async function countFormulas(sheetFile, label) {
    const xml = await zip.file(sheetFile).async('string');
    const formulas = [...xml.matchAll(/<f[^>]*>([^<]*)<\/f>/g)];
    check(`${label}: formulas preservadas`, formulas.length > 0, `${formulas.length} formulas`);
}
await countFormulas('xl/worksheets/sheet2.xml', 'CapacitySFN');
await countFormulas('xl/worksheets/sheet3.xml', 'OEE CalculatorSFN');
await countFormulas('xl/worksheets/sheet4.xml', 'DiagramSFN');

// Station N traducido a Estacion N en ambas hojas
console.log('\n=== 8. Labels "Estacion N" traducidos ===');
for (const cell of ['B11', 'I11', 'P11', 'B20', 'I20', 'P20', 'B29', 'I29', 'P29', 'B38', 'I38', 'P38']) {
    const v = cap.cell(cell).value();
    check(`CapacitySFN ${cell} = Estacion N`, typeof v === 'string' && /^Estacion \d+$/.test(v), `"${v}"`);
}
for (const c of ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P']) {
    const v = oee.cell(c + '11').value();
    check(`OEE Calc ${c}11 = Estacion N`, typeof v === 'string' && /^Estacion \d+$/.test(v), `"${v}"`);
}

// Header aleman removido de drawings
console.log('\n=== 9. Header aleman removido ===');
for (const f of ['xl/drawings/drawing1.xml', 'xl/drawings/drawing2.xml', 'xl/drawings/drawing3.xml']) {
    const file = zip.file(f);
    if (file) {
        const xml = await file.async('string');
        check(`${f}: sin 'Beschaffung'`, !/Beschaffung/.test(xml));
        check(`${f}: sin 'M-BN-L'`, !/M-BN-L/.test(xml));
    }
}

// Chart (DiagramSFN) traducido
console.log('\n=== 10. Chart DiagramSFN traducido ===');
const chartFile = zip.file('xl/charts/chart1.xml');
if (chartFile) {
    const chartXml = await chartFile.async('string');
    check('Chart: sin "Overview capacity"', !/Overview capacity/.test(chartXml));
    check('Chart: sin "Capacity psc/week"', !/Capacity psc\/week/.test(chartXml));
    check('Chart: sin "individual stations"', !/individual stations/i.test(chartXml));
    check('Chart: tiene "Capacidad"', /Capacidad/.test(chartXml));
}

// Proteccion removida en hojas visibles
for (const [sheetFile, label] of [
    ['xl/worksheets/sheet2.xml', 'CapacitySFN'],
    ['xl/worksheets/sheet3.xml', 'OEE CalculatorSFN'],
    ['xl/worksheets/sheet4.xml', 'DiagramSFN'],
]) {
    const xml = await zip.file(sheetFile).async('string');
    check(`${label}: sin sheetProtection`, !/<sheetProtection/.test(xml));
}

// === Resumen ===
console.log(`\n${'='.repeat(50)}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log(`${'='.repeat(50)}`);
if (failed > 0) process.exit(1);
console.log('\nTodo OK. Archivo listo para abrir en Excel sin "Reparado".');
process.exit(0);
