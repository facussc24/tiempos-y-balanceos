/**
 * Exporta un proyecto de balanceo a Excel (ExcelJS) con todos los resultados
 * aplicando el OEE actual del proyecto (meta.manualOEE).
 *
 * Genera 3 hojas:
 *   1. Resumen: header del proyecto, demanda, OEE, takt, capacidad.
 *   2. Tareas: cada task con sus tiempos (ciclo, estandar, operadores, sector).
 *   3. Balanceo: por estacion, efectivo, OEE aplicado, capacidad diaria.
 *
 * Uso: node scripts/_exportProjectBalanceExcel.mjs <projectId> [outputPath]
 *   Ej: node scripts/_exportProjectBalanceExcel.mjs 16
 *       (guarda en C:/Users/FacundoS-PC/Documents/<nombre>.xlsx)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import ExcelJS from 'exceljs';

const projectId = process.argv[2];
if (!projectId) {
    console.error('Uso: node scripts/_exportProjectBalanceExcel.mjs <projectId> [outputPath]');
    process.exit(1);
}

// --- Conexion Supabase ---
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data: p, error } = await sb.from('projects').select('*').eq('id', projectId).single();
if (error) { console.error('Error:', error.message); process.exit(1); }

let d = p.data;
if (typeof d === 'string') d = JSON.parse(d);

const meta = d.meta || {};
const tasks = d.tasks || [];
const shifts = d.shifts || [];
const sectors = d.sectors || [];
const assignments = d.assignments || [];
const stationConfigs = d.stationConfigs || [];
const activeShifts = Math.max(1, meta.activeShifts || 1);
const dailyDemand = meta.dailyDemand || p.daily_demand || 0;
const oee = meta.manualOEE || 0.85;
const setupLossPct = meta.setupLossPercent || 0;

// --- Calculo de minutos disponibles ---
let totalAvailMin = 0;
const shiftBreakdown = [];
for (let i = 0; i < activeShifts; i++) {
    const s = shifts[i] || {};
    const len = Number(s.length) || 480;
    const breaks = (s.breaks || []).reduce((acc, b) => acc + (Number(b.duration) || 0), 0);
    const net = Math.max(0, len - breaks);
    totalAvailMin += net;
    shiftBreakdown.push({ idx: i + 1, len, breaks, net });
}
if (totalAvailMin === 0) totalAvailMin = 480 * activeShifts;
const effectiveAvailMin = totalAvailMin * (1 - setupLossPct);
const taktSec = dailyDemand > 0 ? (effectiveAvailMin * 60) / dailyDemand : 0;
const effectiveTaktSec = taktSec * oee;

// --- Agrupar tasks por estacion (assignments) ---
const stationMap = new Map();
for (const a of assignments) {
    if (!stationMap.has(a.stationId)) stationMap.set(a.stationId, []);
    const t = tasks.find(x => x.id === a.taskId);
    if (t) stationMap.get(a.stationId).push(t);
}

// --- ExcelJS Workbook ---
const wb = new ExcelJS.Workbook();
wb.creator = 'Barack Mercosul';
wb.created = new Date();

const theme = {
    header: { bold: true, color: { argb: 'FFFFFFFF' } },
    headerFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } },
    subheaderFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } },
    alert: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } },
    good: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } },
    border: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};
const boxed = { top: theme.border, left: theme.border, bottom: theme.border, right: theme.border };

// ===== HOJA 1: RESUMEN =====
const s1 = wb.addWorksheet('Resumen');
s1.columns = [{ width: 38 }, { width: 32 }];

const title1 = s1.addRow(['BALANCEO DE LINEA - RESUMEN EJECUTIVO']);
title1.font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };
s1.mergeCells('A1:B1');
s1.addRow([]);

const rows1 = [
    ['Proyecto', meta.name || '(sin nombre)'],
    ['Cliente', meta.client || p.client || ''],
    ['Codigo', meta.project || p.project_code || ''],
    ['Version', meta.version || ''],
    ['Fecha', meta.date || new Date().toISOString().slice(0, 10)],
    ['Ingeniero', meta.engineer || ''],
    [null, null],
    ['DEMANDA Y TURNOS', ''],
    ['Demanda diaria (piezas)', dailyDemand],
    ['Turnos activos', activeShifts],
    ['Minutos disponibles/dia (bruto)', totalAvailMin],
    ['Setup Loss (%)', (setupLossPct * 100).toFixed(1) + '%'],
    ['Minutos efectivos/dia', effectiveAvailMin.toFixed(1)],
    [null, null],
    ['OEE', ''],
    ['OEE global aplicado', (oee * 100).toFixed(1) + '%'],
    ['Modo OEE', meta.useSectorOEE ? 'Por sector' : meta.useManualOEE ? 'Manual global' : 'No definido'],
    [null, null],
    ['TAKT TIME', ''],
    ['Takt teorico (seg/pieza)', taktSec.toFixed(2)],
    ['Takt efectivo c/OEE (seg/pieza)', effectiveTaktSec.toFixed(2)],
    ['Piezas/hora teorico', taktSec > 0 ? (3600 / taktSec).toFixed(1) : '0'],
    ['Piezas/hora efectivo', effectiveTaktSec > 0 ? (3600 / effectiveTaktSec).toFixed(1) : '0'],
    [null, null],
    ['PROCESO', ''],
    ['Total de tareas', tasks.length],
    ['Total de estaciones asignadas', stationMap.size],
    ['Total de sectores', sectors.length],
    ['Modelos activos (piezas)', (meta.activeModels || []).length],
];
for (const r of rows1) {
    if (r[0] === null) { s1.addRow([]); continue; }
    const row = s1.addRow(r);
    const labelCell = row.getCell(1);
    const valCell = row.getCell(2);
    labelCell.font = { bold: true };
    if (['DEMANDA Y TURNOS', 'OEE', 'TAKT TIME', 'PROCESO'].includes(r[0])) {
        labelCell.fill = theme.headerFill;
        labelCell.font = theme.header;
        valCell.fill = theme.headerFill;
    } else {
        labelCell.fill = theme.subheaderFill;
    }
    labelCell.border = boxed;
    valCell.border = boxed;
    if (r[0] === 'OEE global aplicado') {
        valCell.fill = oee < 0.6 ? theme.alert : theme.good;
        valCell.font = { bold: true };
    }
}

// ===== HOJA 2: TAREAS =====
const s2 = wb.addWorksheet('Tareas');
s2.columns = [
    { header: 'ID', width: 8 },
    { header: 'Descripcion', width: 40 },
    { header: 'Sector', width: 16 },
    { header: 'Modo', width: 12 },
    { header: 'Tiempo promedio (s)', width: 18 },
    { header: 'Rating (%)', width: 12 },
    { header: 'Fatiga', width: 10 },
    { header: 'Tiempo estandar (s)', width: 18 },
    { header: 'Cant. ciclo', width: 12 },
    { header: 'Cavidades', width: 12 },
    { header: 'Ciclo real inyeccion (s)', width: 22 },
    { header: 'Predecesores', width: 18 },
];
s2.getRow(1).font = theme.header;
s2.getRow(1).fill = theme.headerFill;
s2.getRow(1).border = boxed;
for (const t of tasks) {
    const inj = t.injectionParams || {};
    s2.addRow([
        t.id,
        t.description || '',
        t.sectorId || '',
        t.executionMode || 'manual',
        Number(t.averageTime) || 0,
        Number(t.ratingFactor) || 100,
        t.fatigueCategory || 'none',
        Number(t.standardTime) || 0,
        Number(t.cycleQuantity) || 1,
        Number(inj.optimalCavities) || (t.executionMode === 'injection' ? 1 : ''),
        Number(inj.realCycle) || '',
        (t.predecessors || []).join(', '),
    ]);
}
s2.eachRow((row, n) => { if (n > 1) row.eachCell((c) => { c.border = boxed; }); });

// ===== HOJA 3: BALANCEO POR ESTACION =====
const s3 = wb.addWorksheet('Balanceo');
s3.columns = [
    { header: 'Estacion', width: 12 },
    { header: 'Tareas', width: 50 },
    { header: 'Sector', width: 16 },
    { header: 'Tiempo efectivo (s)', width: 18 },
    { header: 'Ciclo x replicas (s)', width: 20 },
    { header: 'Replicas', width: 10 },
    { header: 'Utilizacion vs Takt', width: 22 },
    { header: 'Piezas/hora (efectivo c/OEE)', width: 28 },
    { header: 'Capacidad dia', width: 16 },
    { header: 'Cubre demanda?', width: 16 },
];
s3.getRow(1).font = theme.header;
s3.getRow(1).fill = theme.headerFill;
s3.getRow(1).border = boxed;

const stationIds = [...stationMap.keys()].sort((a, b) => a - b);
for (const sid of stationIds) {
    const sTasks = stationMap.get(sid) || [];
    const effective = sTasks.reduce((acc, t) => {
        if (t.executionMode === 'injection' && t.injectionParams?.realCycle) {
            return acc + (Number(t.injectionParams.realCycle) || 0);
        }
        return acc + (Number(t.standardTime || t.averageTime) || 0);
    }, 0);
    const cfg = stationConfigs.find(c => c.id === sid);
    const replicas = Math.max(1, cfg?.replicas || 1);
    const cyclePerReplica = effective / replicas;
    const utilPct = effectiveTaktSec > 0 ? (cyclePerReplica / effectiveTaktSec) * 100 : 0;
    const piecesPerHourEff = cyclePerReplica > 0 ? (3600 / cyclePerReplica) * oee : 0;
    const capDia = piecesPerHourEff * (effectiveAvailMin / 60);
    const cubre = capDia >= dailyDemand;

    const taskNames = sTasks.map(t => `${t.id}: ${t.description || ''}`).join(' + ');
    const sector = sTasks[0]?.sectorId || '';

    const row = s3.addRow([
        sid,
        taskNames,
        sector,
        effective.toFixed(2),
        cyclePerReplica.toFixed(2),
        replicas,
        utilPct.toFixed(1) + '%',
        piecesPerHourEff.toFixed(1),
        Math.round(capDia),
        cubre ? 'SI' : 'NO',
    ]);
    row.eachCell(c => { c.border = boxed; });
    const utilCell = row.getCell(7);
    if (utilPct > 100) utilCell.fill = theme.alert;
    else if (utilPct > 85) utilCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    else utilCell.fill = theme.good;
    const cubreCell = row.getCell(10);
    cubreCell.fill = cubre ? theme.good : theme.alert;
    cubreCell.font = { bold: true };
}

// Fila totales
if (stationIds.length > 0) {
    const totalEff = stationIds.reduce((acc, sid) => {
        const sTasks = stationMap.get(sid) || [];
        return acc + sTasks.reduce((a, t) => a + (t.executionMode === 'injection' && t.injectionParams?.realCycle
            ? Number(t.injectionParams.realCycle) || 0
            : Number(t.standardTime || t.averageTime) || 0), 0);
    }, 0);
    const totalRow = s3.addRow(['TOTAL', '', '', totalEff.toFixed(2), '', '', '', '', '', '']);
    totalRow.font = { bold: true };
    totalRow.eachCell(c => { c.border = boxed; c.fill = theme.subheaderFill; });
}

// ===== HOJA 4: SECTORES =====
if (sectors.length > 0) {
    const s4 = wb.addWorksheet('Sectores');
    s4.columns = [
        { header: 'ID', width: 16 },
        { header: 'Nombre', width: 24 },
        { header: 'OEE Target', width: 14 },
        { header: 'Secuencia', width: 12 },
    ];
    s4.getRow(1).font = theme.header;
    s4.getRow(1).fill = theme.headerFill;
    for (const sec of sectors) {
        const row = s4.addRow([sec.id, sec.name, sec.targetOee ?? '', sec.sequence ?? '']);
        row.eachCell(c => { c.border = boxed; });
    }
}

// --- Save ---
const safeName = (meta.name || `Proyecto_${projectId}`).replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 60);
const oeePct = Math.round(oee * 100);
const date = new Date().toISOString().slice(0, 10);
const defaultOutDir = process.argv[3] || join(homedir(), 'Documents');
mkdirSync(defaultOutDir, { recursive: true });
const fileName = `Balanceo_${safeName}_OEE${oeePct}pct_${date}.xlsx`;
const outputPath = join(defaultOutDir, fileName);

await wb.xlsx.writeFile(outputPath);

console.log(`\nExcel generado exitosamente:`);
console.log(`  ${outputPath}`);
console.log(`\nResumen:`);
console.log(`  Proyecto:       ${meta.name}`);
console.log(`  OEE aplicado:   ${oeePct}%`);
console.log(`  Demanda diaria: ${dailyDemand} piezas`);
console.log(`  Takt efectivo:  ${effectiveTaktSec.toFixed(2)} s/pieza`);
console.log(`  Estaciones:     ${stationMap.size}`);
console.log(`  Tareas:         ${tasks.length}`);
process.exit(0);
