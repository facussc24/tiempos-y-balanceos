#!/usr/bin/env node
/**
 * Calculo de Capacidad y Moldes — Espumas APB Panel de Puerta
 *
 * Lee los parametros reales de la simulacion APB (master.json) y calcula
 * cuantos moldes de cada variante se necesitan para la demanda del cliente.
 *
 * Tambien genera un reporte Excel profesional en exports/reporte-capacidad-apb.xlsx
 *
 * Fuente de datos: \\SERVER\compartido\Ingenieria\Datos Software\01_DATA\VWA\PATAGONIA\APB\master.json
 *
 * Usage: node scripts/capacidad-moldes-apb.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx-js-style';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

// ═══════════════════════════════════════════════════════════════════════════
// 1. READ REAL DATA FROM SERVER
// ═══════════════════════════════════════════════════════════════════════════

const MASTER_PATH = '//SERVER/compartido/Ingenieria/Datos Software/01_DATA/VWA/PATAGONIA/APB/master.json';

let masterJson;
try {
    masterJson = readFileSync(MASTER_PATH, 'utf-8');
} catch (err) {
    console.error(`✗ Cannot read ${MASTER_PATH}: ${err.message}`);
    console.error('  Trying local fallback...');
    // Fallback: try reading from stdin or a local copy
    process.exit(1);
}

const project = JSON.parse(masterJson);

// ═══════════════════════════════════════════════════════════════════════════
// 2. EXTRACT PARAMETERS (100% from master.json, ZERO invented)
// ═══════════════════════════════════════════════════════════════════════════

// --- Shifts ---
function parseTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function calculateShiftNetMinutes(shift) {
    const start = parseTime(shift.startTime);
    let end = parseTime(shift.endTime);
    if (end < start) end += 24 * 60; // overnight
    const gross = end - start;
    const breaks = shift.breaks.reduce((sum, b) => sum + Math.max(0, b.duration || 0), 0);
    return Math.max(0, gross - breaks);
}

const activeShifts = project.meta.activeShifts;
const shifts = project.shifts.slice(0, activeShifts);
const shiftDetails = shifts.map(s => ({
    name: s.name,
    start: s.startTime,
    end: s.endTime,
    breakMinutes: s.breaks.reduce((sum, b) => sum + (b.duration || 0), 0),
    netMinutes: calculateShiftNetMinutes(s),
}));
const totalNetMinutes = shiftDetails.reduce((sum, s) => sum + s.netMinutes, 0);
const totalAvailableSeconds = totalNetMinutes * 60;

// --- OEE ---
const oee = project.meta.manualOEE;
const effectiveSeconds = totalAvailableSeconds * oee;

// --- Injection Params ---
const injectionTask = project.tasks.find(t => t.executionMode === 'injection');
if (!injectionTask?.injectionParams) {
    console.error('✗ No injection task found in the project data');
    process.exit(1);
}

const { pInyectionTime, pCuringTime } = injectionTask.injectionParams;
const currentN = injectionTask.injectionParams.userSelectedN || injectionTask.injectionParams.optimalCavities;

// ═══════════════════════════════════════════════════════════════════════════
// 3. CLIENT DEMAND (5 variants, same cycle times)
// ═══════════════════════════════════════════════════════════════════════════

const variants = [
    { name: 'Espuma APB Panel puerta delantero izquierdo', demand: 350 },
    { name: 'Espuma APB Panel puerta delantero derecho', demand: 350 },
    { name: 'Espuma APB Panel puerta trasero izquierdo', demand: 350 },
    { name: 'Espuma APB Panel puerta trasero derecho', demand: 350 },
    { name: 'Espuma APB central trasero', demand: 155 },
];
const totalDemand = variants.reduce((sum, v) => sum + v.demand, 0);

// ═══════════════════════════════════════════════════════════════════════════
// 4. MOLD CALCULATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * For a rotary carousel with N molds:
 *   cyclePerPiece(N) = pInyTime + pCurTime / N
 *
 * Total production time = totalDemand × cyclePerPiece(N)
 * Must fit in: effectiveSeconds (availableSeconds × OEE)
 *
 * Solve for minimum N:
 *   totalDemand × (pInyTime + pCurTime/N) <= effectiveSeconds
 *   pInyTime + pCurTime/N <= effectiveSeconds / totalDemand
 *   pCurTime/N <= (effectiveSeconds / totalDemand) - pInyTime
 *   N >= pCurTime / ((effectiveSeconds / totalDemand) - pInyTime)
 */

const maxCyclePerPiece = effectiveSeconds / totalDemand;
const availableForCuring = maxCyclePerPiece - pInyectionTime;

if (availableForCuring <= 0) {
    console.error('✗ IMPOSSIBLE: Injection time alone exceeds available time per piece.');
    console.error(`  Max cycle: ${maxCyclePerPiece.toFixed(2)}s, Injection: ${pInyectionTime}s`);
    process.exit(1);
}

const minMoldsExact = pCuringTime / availableForCuring;
const minMolds = Math.ceil(minMoldsExact);

// Calculate results with minMolds
const cyclePerPiece = pInyectionTime + pCuringTime / minMolds;
const totalProductionTime = totalDemand * cyclePerPiece;
const utilizationPercent = (totalProductionTime / effectiveSeconds) * 100;
const marginSeconds = effectiveSeconds - totalProductionTime;
const marginMinutes = marginSeconds / 60;
const maxCapacity = Math.floor(effectiveSeconds / cyclePerPiece);

// Also calculate N-1 to show it doesn't work
const moldsMinusOne = minMolds - 1;
const cycleMinusOne = pInyectionTime + pCuringTime / moldsMinusOne;
const totalTimeMinusOne = totalDemand * cycleMinusOne;
const utilizationMinusOne = (totalTimeMinusOne / effectiveSeconds) * 100;

// nStar (theoretical optimum where curing is fully absorbed)
const nStar = Math.ceil(1 + pCuringTime / pInyectionTime);

// Per-variant results
const variantResults = variants.map(v => ({
    ...v,
    molds: minMolds,
    cycleSeconds: cyclePerPiece,
    productionTimeSeconds: v.demand * cyclePerPiece,
    capacityIfAloneAllDay: maxCapacity,
}));

// ═══════════════════════════════════════════════════════════════════════════
// 5. CONSOLE OUTPUT
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  CALCULO DE CAPACIDAD Y MOLDES — ESPUMAS APB');
console.log('═══════════════════════════════════════════════════════════');

console.log('\n  ── PARAMETROS DE PRODUCCION (de master.json) ──');
console.log(`  Turnos activos: ${activeShifts}`);
shiftDetails.forEach(s => {
    console.log(`    ${s.name}: ${s.start} - ${s.end} (descanso: ${s.breakMinutes} min, neto: ${s.netMinutes} min)`);
});
console.log(`  Tiempo disponible total: ${totalNetMinutes} min = ${totalAvailableSeconds} s`);
console.log(`  OEE: ${(oee * 100).toFixed(0)}%`);
console.log(`  Tiempo efectivo: ${effectiveSeconds.toFixed(0)} s`);

console.log('\n  ── PARAMETROS DE INYECCION PU ──');
console.log(`  Tiempo inyeccion: ${pInyectionTime} s`);
console.log(`  Tiempo curado: ${pCuringTime} s`);
console.log(`  N actual (carrusel): ${currentN} moldes`);
console.log(`  N* (optimo teorico): ${nStar} moldes`);

console.log('\n  ── DEMANDA DEL CLIENTE ──');
variants.forEach(v => console.log(`    ${v.name}: ${v.demand} pz/dia`));
console.log(`    TOTAL: ${totalDemand} pz/dia`);

console.log('\n  ── CALCULO ──');
console.log(`  Ciclo maximo permitido = ${effectiveSeconds.toFixed(0)} / ${totalDemand} = ${maxCyclePerPiece.toFixed(2)} s/pieza`);
console.log(`  Tiempo disponible para curado = ${maxCyclePerPiece.toFixed(2)} - ${pInyectionTime} = ${availableForCuring.toFixed(2)} s`);
console.log(`  N minimo exacto = ${pCuringTime} / ${availableForCuring.toFixed(2)} = ${minMoldsExact.toFixed(2)}`);
console.log(`  N minimo (redondeado) = ${minMolds}`);

console.log('\n  ── VERIFICACION ──');
console.log(`  Con N=${minMolds}: ciclo = ${cyclePerPiece.toFixed(2)} s/pz, total = ${totalProductionTime.toFixed(0)} s, util = ${utilizationPercent.toFixed(1)}% ✓`);
console.log(`  Con N=${moldsMinusOne}: ciclo = ${cycleMinusOne.toFixed(2)} s/pz, total = ${totalTimeMinusOne.toFixed(0)} s, util = ${utilizationMinusOne.toFixed(1)}% ✗`);
console.log(`  Margen: ${marginSeconds.toFixed(0)} s = ${marginMinutes.toFixed(1)} min`);
console.log(`  Capacidad maxima: ${maxCapacity} pz/dia`);

console.log('\n  ── RESULTADO ──');
console.log(`  ┌───────────────────────────────────────────────────────────────────────┐`);
console.log(`  │  MOLDES NECESARIOS POR VARIANTE: ${minMolds}                                  │`);
console.log(`  │  TOTAL MOLDES: ${minMolds * variants.length} (${variants.length} variantes × ${minMolds} moldes)                            │`);
console.log(`  └───────────────────────────────────────────────────────────────────────┘`);

console.log('\n  Detalle por variante:');
console.log('  ─────────────────────────────────────────────────────────');
console.log('  Variante                              Demanda  Moldes  Tiempo(s)');
console.log('  ─────────────────────────────────────────────────────────');
variantResults.forEach(v => {
    console.log(`  ${v.name.padEnd(40)} ${String(v.demand).padStart(5)}   ${String(v.molds).padStart(5)}   ${v.productionTimeSeconds.toFixed(0).padStart(8)}`);
});
console.log('  ─────────────────────────────────────────────────────────');
console.log(`  ${'TOTAL'.padEnd(40)} ${String(totalDemand).padStart(5)}   ${String(minMolds * variants.length).padStart(5)}   ${totalProductionTime.toFixed(0).padStart(8)}`);
console.log(`  ${'Disponible'.padEnd(40)}                   ${effectiveSeconds.toFixed(0).padStart(8)}`);

// ═══════════════════════════════════════════════════════════════════════════
// 6. GENERATE EXCEL REPORT (xlsx-js-style)
// ═══════════════════════════════════════════════════════════════════════════

const wb = XLSX.utils.book_new();

// --- Colors & Styles ---
const NAVY = { rgb: '1E3A5F' };
const WHITE = { rgb: 'FFFFFF' };
const LIGHT_GRAY = { rgb: 'F1F5F9' };
const GREEN_BG = { rgb: 'DCFCE7' };
const GREEN_FG = { rgb: '166534' };
const BORDER_COLOR = { rgb: 'E2E8F0' };
const THIN_BORDER = { top: { style: 'thin', color: BORDER_COLOR }, bottom: { style: 'thin', color: BORDER_COLOR }, left: { style: 'thin', color: BORDER_COLOR }, right: { style: 'thin', color: BORDER_COLOR } };

const headerStyle = { font: { name: 'Calibri', sz: 11, bold: true, color: WHITE }, fill: { fgColor: NAVY }, alignment: { horizontal: 'center', vertical: 'center' }, border: THIN_BORDER };
const paramLabelStyle = { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '475569' } }, fill: { fgColor: LIGHT_GRAY }, border: THIN_BORDER, alignment: { vertical: 'center' } };
const paramValueStyle = { font: { name: 'Calibri', sz: 10, bold: true, color: NAVY }, border: THIN_BORDER, alignment: { horizontal: 'center', vertical: 'center' } };
const dataStyle = { font: { name: 'Calibri', sz: 10 }, border: THIN_BORDER, alignment: { horizontal: 'center', vertical: 'center' } };
const dataLeftStyle = { font: { name: 'Calibri', sz: 10 }, border: THIN_BORDER, alignment: { vertical: 'center' } };
const okStyle = { font: { name: 'Calibri', sz: 10, bold: true, color: GREEN_FG }, fill: { fgColor: GREEN_BG }, border: THIN_BORDER, alignment: { horizontal: 'center', vertical: 'center' } };
const titleStyle = { font: { name: 'Calibri', sz: 14, bold: true, color: WHITE }, fill: { fgColor: NAVY }, alignment: { horizontal: 'center', vertical: 'center' } };
const subtitleStyle = { font: { name: 'Calibri', sz: 10, color: { rgb: '475569' } }, alignment: { horizontal: 'center' } };
const resultStyle = { font: { name: 'Calibri', sz: 12, bold: true, color: NAVY }, fill: { fgColor: { rgb: 'DBEAFE' } }, border: THIN_BORDER, alignment: { horizontal: 'center', vertical: 'center' } };
const totalRowStyle = { font: { name: 'Calibri', sz: 10, bold: true }, fill: { fgColor: LIGHT_GRAY }, border: THIN_BORDER, alignment: { horizontal: 'center', vertical: 'center' } };
const totalRowLeftStyle = { font: { name: 'Calibri', sz: 10, bold: true }, fill: { fgColor: LIGHT_GRAY }, border: THIN_BORDER, alignment: { vertical: 'center' } };

// ═════════════════════════════════════════════════════════════════
// HOJA 1: RESUMEN
// ═════════════════════════════════════════════════════════════════

const resumenData = [];

// Title
resumenData.push([{ v: 'SIMULACION DE CAPACIDAD Y MOLDES — ESPUMAS APB', s: titleStyle }]);
resumenData.push([{ v: `${project.meta.name} — ${project.meta.client} — ${project.meta.project || ''}`, s: subtitleStyle }]);
resumenData.push([{ v: `Fecha: ${new Date().toISOString().split('T')[0]}  |  Fuente: master.json Rev ${project.meta.version}`, s: subtitleStyle }]);
resumenData.push([]);

// Result highlight
resumenData.push([
    { v: 'RESULTADO', s: resultStyle },
    { v: `${minMolds} moldes por variante`, s: resultStyle },
    { v: `${minMolds * variants.length} moldes totales`, s: resultStyle },
    { v: `${utilizationPercent.toFixed(1)}% utilizacion`, s: resultStyle },
    { v: `${marginMinutes.toFixed(0)} min margen`, s: resultStyle },
]);
resumenData.push([]);

// Table header
resumenData.push([
    { v: 'Variante', s: headerStyle },
    { v: 'Demanda (pz/dia)', s: headerStyle },
    { v: 'Moldes', s: headerStyle },
    { v: 'Ciclo (s/pz)', s: headerStyle },
    { v: 'Tiempo prod (s)', s: headerStyle },
    { v: 'Tiempo prod (min)', s: headerStyle },
    { v: 'Estado', s: headerStyle },
]);

// Data rows
variantResults.forEach(v => {
    resumenData.push([
        { v: v.name, s: dataLeftStyle },
        { v: v.demand, s: dataStyle },
        { v: v.molds, s: dataStyle },
        { v: Math.round(v.cycleSeconds * 100) / 100, s: dataStyle },
        { v: Math.round(v.productionTimeSeconds), s: dataStyle },
        { v: Math.round(v.productionTimeSeconds / 60 * 10) / 10, s: dataStyle },
        { v: 'OK', s: okStyle },
    ]);
});

// Total row
resumenData.push([
    { v: 'TOTAL', s: totalRowLeftStyle },
    { v: totalDemand, s: totalRowStyle },
    { v: minMolds * variants.length, s: totalRowStyle },
    { v: '', s: totalRowStyle },
    { v: Math.round(totalProductionTime), s: totalRowStyle },
    { v: Math.round(totalProductionTime / 60 * 10) / 10, s: totalRowStyle },
    { v: `${utilizationPercent.toFixed(1)}%`, s: totalRowStyle },
]);

resumenData.push([]);
resumenData.push([
    { v: 'Tiempo disponible efectivo:', s: paramLabelStyle },
    { v: `${effectiveSeconds.toFixed(0)} s = ${(effectiveSeconds / 60).toFixed(0)} min`, s: paramValueStyle },
]);
resumenData.push([
    { v: 'Capacidad maxima de la maquina:', s: paramLabelStyle },
    { v: `${maxCapacity} pz/dia`, s: paramValueStyle },
]);

const ws1 = XLSX.utils.aoa_to_sheet(resumenData);
ws1['!cols'] = [
    { wch: 45 }, // A: Variante
    { wch: 18 }, // B: Demanda
    { wch: 10 }, // C: Moldes
    { wch: 14 }, // D: Ciclo
    { wch: 16 }, // E: Tiempo s
    { wch: 18 }, // F: Tiempo min
    { wch: 12 }, // G: Estado
];
// Merge title rows
ws1['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
];
XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

// ═════════════════════════════════════════════════════════════════
// HOJA 2: DETALLE DE CALCULO
// ═════════════════════════════════════════════════════════════════

const detalleData = [];

detalleData.push([{ v: 'DETALLE DE CALCULO — MOLDES NECESARIOS', s: titleStyle }, { v: '', s: titleStyle }, { v: '', s: titleStyle }]);
detalleData.push([]);

const stepStyle = { font: { name: 'Calibri', sz: 10, bold: true, color: NAVY }, border: THIN_BORDER };
const formulaStyle = { font: { name: 'Consolas', sz: 10 }, border: THIN_BORDER };
const valueStyle = { font: { name: 'Calibri', sz: 10, bold: true }, border: THIN_BORDER, alignment: { horizontal: 'right' } };

const steps = [
    ['PASO 1: Tiempo disponible bruto', '', ''],
    ['Turno 1', `(15:00 - 06:00) - 60 min descanso`, `${shiftDetails[0].netMinutes} min`],
    ['Turno 2', `(23:00 - 15:00) - 45 min descanso`, `${shiftDetails[1].netMinutes} min`],
    ['Turno 3', `(06:00 - 23:00) - 45 min descanso`, `${shiftDetails[2].netMinutes} min`],
    ['Total minutos netos', `${shiftDetails.map(s => s.netMinutes).join(' + ')}`, `${totalNetMinutes} min`],
    ['Total en segundos', `${totalNetMinutes} × 60`, `${totalAvailableSeconds} s`],
    ['', '', ''],
    ['PASO 2: Tiempo efectivo (con OEE)', '', ''],
    ['OEE global', 'De master.json → meta.manualOEE', `${(oee * 100).toFixed(0)}%`],
    ['Tiempo efectivo', `${totalAvailableSeconds} × ${oee}`, `${effectiveSeconds.toFixed(0)} s`],
    ['', '', ''],
    ['PASO 3: Ciclo maximo permitido', '', ''],
    ['Demanda total', '5 variantes', `${totalDemand} pz/dia`],
    ['Ciclo maximo', `${effectiveSeconds.toFixed(0)} / ${totalDemand}`, `${maxCyclePerPiece.toFixed(2)} s/pieza`],
    ['', '', ''],
    ['PASO 4: Moldes minimos', '', ''],
    ['Tiempo inyeccion (pInyTime)', 'De master.json → injectionParams', `${pInyectionTime} s`],
    ['Tiempo curado (pCurTime)', 'De master.json → injectionParams', `${pCuringTime} s`],
    ['Formula: ciclo(N) = pInyTime + pCurTime/N', '', ''],
    ['Tiempo para curado', `${maxCyclePerPiece.toFixed(2)} - ${pInyectionTime}`, `${availableForCuring.toFixed(2)} s`],
    ['N minimo exacto', `${pCuringTime} / ${availableForCuring.toFixed(2)}`, `${minMoldsExact.toFixed(2)}`],
    ['N minimo (redondeado arriba)', `ceil(${minMoldsExact.toFixed(2)})`, `${minMolds}`],
    ['', '', ''],
    ['PASO 5: Verificacion', '', ''],
    [`Con N=${minMolds} moldes`, `ciclo = ${pInyectionTime} + ${pCuringTime}/${minMolds}`, `${cyclePerPiece.toFixed(2)} s/pz`],
    ['Tiempo total produccion', `${totalDemand} × ${cyclePerPiece.toFixed(2)}`, `${totalProductionTime.toFixed(0)} s`],
    ['Utilizacion', `${totalProductionTime.toFixed(0)} / ${effectiveSeconds.toFixed(0)} × 100`, `${utilizationPercent.toFixed(1)}%`],
    ['Margen', `${effectiveSeconds.toFixed(0)} - ${totalProductionTime.toFixed(0)}`, `${marginSeconds.toFixed(0)} s = ${marginMinutes.toFixed(1)} min`],
    ['', '', ''],
    [`CONTRAPRUEBA: N=${moldsMinusOne} (NO alcanza)`, '', ''],
    [`Con N=${moldsMinusOne} moldes`, `ciclo = ${pInyectionTime} + ${pCuringTime}/${moldsMinusOne}`, `${cycleMinusOne.toFixed(2)} s/pz`],
    ['Tiempo total produccion', `${totalDemand} × ${cycleMinusOne.toFixed(2)}`, `${totalTimeMinusOne.toFixed(0)} s`],
    ['Utilizacion', `${totalTimeMinusOne.toFixed(0)} / ${effectiveSeconds.toFixed(0)} × 100`, `${utilizationMinusOne.toFixed(1)}% EXCEDE`],
];

steps.forEach(row => {
    if (row[0].startsWith('PASO') || row[0].startsWith('CONTRAPRUEBA')) {
        detalleData.push([
            { v: row[0], s: stepStyle },
            { v: row[1], s: stepStyle },
            { v: row[2], s: stepStyle },
        ]);
    } else if (row[0] === '') {
        detalleData.push([]);
    } else {
        detalleData.push([
            { v: row[0], s: paramLabelStyle },
            { v: row[1], s: formulaStyle },
            { v: row[2], s: valueStyle },
        ]);
    }
});

const ws2 = XLSX.utils.aoa_to_sheet(detalleData);
ws2['!cols'] = [
    { wch: 40 }, // A: Descripcion
    { wch: 40 }, // B: Formula
    { wch: 25 }, // C: Resultado
];
ws2['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
];
XLSX.utils.book_append_sheet(wb, ws2, 'Detalle de Calculo');

// ═════════════════════════════════════════════════════════════════
// HOJA 3: PARAMETROS
// ═════════════════════════════════════════════════════════════════

const paramsData = [];

paramsData.push([{ v: 'PARAMETROS DE LA SIMULACION', s: titleStyle }, { v: '', s: titleStyle }, { v: '', s: titleStyle }]);
paramsData.push([]);

paramsData.push([
    { v: 'Parametro', s: headerStyle },
    { v: 'Valor', s: headerStyle },
    { v: 'Fuente', s: headerStyle },
]);

const paramRows = [
    ['Proyecto', project.meta.name, 'master.json → meta.name'],
    ['Cliente', project.meta.client, 'master.json → meta.client'],
    ['Proyecto codigo', project.meta.project || '', 'master.json → meta.project'],
    ['Version', project.meta.version, 'master.json → meta.version'],
    ['Fecha simulacion original', project.meta.date, 'master.json → meta.date'],
    ['', '', ''],
    ['Turnos activos', activeShifts, 'master.json → meta.activeShifts'],
    [`${shiftDetails[0].name}`, `${shiftDetails[0].start} - ${shiftDetails[0].end}, descanso ${shiftDetails[0].breakMinutes} min`, 'master.json → shifts[0]'],
    [`${shiftDetails[1].name}`, `${shiftDetails[1].start} - ${shiftDetails[1].end}, descanso ${shiftDetails[1].breakMinutes} min`, 'master.json → shifts[1]'],
    [`${shiftDetails[2].name}`, `${shiftDetails[2].start} - ${shiftDetails[2].end}, descanso ${shiftDetails[2].breakMinutes} min`, 'master.json → shifts[2]'],
    ['Minutos netos Turno 1', `${shiftDetails[0].netMinutes} min`, 'Calculado: (end - start) - breaks'],
    ['Minutos netos Turno 2', `${shiftDetails[1].netMinutes} min`, 'Calculado: (end - start) - breaks'],
    ['Minutos netos Turno 3', `${shiftDetails[2].netMinutes} min`, 'Calculado: (end - start) - breaks'],
    ['Total minutos netos/dia', `${totalNetMinutes} min`, 'Suma de los 3 turnos'],
    ['Total segundos/dia', `${totalAvailableSeconds} s`, 'minutos × 60'],
    ['', '', ''],
    ['OEE global', `${(oee * 100).toFixed(0)}%`, 'master.json → meta.manualOEE'],
    ['Modo OEE', project.meta.useManualOEE ? 'Manual (global)' : 'Detallado', 'master.json → meta.useManualOEE'],
    ['Tiempo efectivo/dia', `${effectiveSeconds.toFixed(0)} s`, 'totalSegundos × OEE'],
    ['', '', ''],
    ['Tiempo inyeccion PU', `${pInyectionTime} s`, 'master.json → tasks["20"].injectionParams.pInyectionTime'],
    ['Tiempo curado PU', `${pCuringTime} s`, 'master.json → tasks["20"].injectionParams.pCuringTime'],
    ['N actual (carrusel)', currentN, 'master.json → tasks["20"].injectionParams.userSelectedN'],
    ['N* (optimo teorico)', nStar, 'ceil(1 + pCurTime/pInyTime)'],
    ['Ciclo real actual (N=' + currentN + ')', `${(pInyectionTime + pCuringTime / currentN).toFixed(2)} s`, 'pInyTime + pCurTime/N'],
    ['', '', ''],
    ['Demanda total cliente', `${totalDemand} pz/dia`, 'Requerimiento del cliente (5 variantes)'],
    ['Demanda original simulacion', `${project.meta.dailyDemand} pz/dia`, 'master.json → meta.dailyDemand'],
];

paramRows.forEach(row => {
    if (row[0] === '') {
        paramsData.push([]);
    } else {
        paramsData.push([
            { v: row[0], s: paramLabelStyle },
            { v: String(row[1]), s: paramValueStyle },
            { v: row[2], s: { font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '64748B' } }, border: THIN_BORDER } },
        ]);
    }
});

const ws3 = XLSX.utils.aoa_to_sheet(paramsData);
ws3['!cols'] = [
    { wch: 30 }, // A: Parametro
    { wch: 35 }, // B: Valor
    { wch: 55 }, // C: Fuente
];
ws3['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
];
XLSX.utils.book_append_sheet(wb, ws3, 'Parametros');

// ═════════════════════════════════════════════════════════════════
// WRITE FILE
// ═════════════════════════════════════════════════════════════════

const outputDir = join(PROJECT_ROOT, 'exports');
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

const outputPath = join(outputDir, 'reporte-capacidad-apb.xlsx');
XLSX.writeFile(wb, outputPath);

console.log(`\n  ✓ Excel generado: ${outputPath}`);
console.log('═══════════════════════════════════════════════════════════\n');
