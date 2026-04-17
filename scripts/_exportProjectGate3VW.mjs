/**
 * Exporta un proyecto de balanceo al FORMATO VW OFICIAL Gate 3 Capacity Check.
 *
 * Replica 1:1 el flujo de la app:
 *   ProjectData (Supabase) -> buildGate3FromProjectData -> gate3ExcelExport
 *   (modulos en modules/gate3/)
 *
 * Clona el template oficial VW (src/assets/templates/gate3_template.xlsx) y
 * solo INYECTA los valores del proyecto en las celdas de input. Todas las
 * formulas, formatos, labels, hojas Protocolo_SFN1, PCA1, etc. quedan
 * exactamente como estan en el template.
 *
 * Uso: node scripts/_exportProjectGate3VW.mjs <projectId> [outputDir]
 *   Ej: node scripts/_exportProjectGate3VW.mjs 16
 *       (guarda en ~/Documents/Gate3_VW_<nombre>.xlsx)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import XlsxPopulate from 'xlsx-populate';

const projectId = process.argv[2];
if (!projectId) {
    console.error('Uso: node scripts/_exportProjectGate3VW.mjs <projectId> [outputDir]');
    process.exit(1);
}

// ==============================
// HELPERS (copia de gate3ExcelExport.ts + gate3CellMap.ts + processType.ts)
// ==============================
const safeNum = (v, fb = 0) => (typeof v === 'number' && Number.isFinite(v)) ? v : fb;
const sanitize = (s) => (s || '').replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 60) || 'Gate3';

const GATE3_MAX_STATIONS = 12;

// --- gate3CellMap ---
const oeeStationCol = (n) => String.fromCharCode('E'.charCodeAt(0) + (n - 1));
function capStationMap(n) {
    const block = Math.ceil(n / 4);
    const inBlock = ((n - 1) % 4) + 1;
    const topRow = 11 + (inBlock - 1) * 9;
    if (block === 1) return { nameCol: 'B', valueCol: 'G', topRow };
    if (block === 2) return { nameCol: 'I', valueCol: 'N', topRow };
    return { nameCol: 'P', valueCol: 'U', topRow };
}
function stationLabelCells(n) {
    const m = capStationMap(n);
    const labelCol = String.fromCharCode(m.valueCol.charCodeAt(0) - 1);
    return {
        cavitiesLabel: `${labelCol}${m.topRow + 5}`,
        machinesLabel: `${labelCol}${m.topRow + 7}`,
    };
}
const CAP_ROW_OFFSETS = {
    shiftsPerWeek: 0, pcsWeek: 1, processName: 2, cycleTime: 2,
    hoursPerShift: 3, oee: 4, cavities: 5, reservation: 6, machines: 7,
};
const OEE_INPUT_ROWS = {
    observationTime: 13, cycleTime: 14, cavities: 15,
    downtime: 17, okParts: 18, nokParts: 19,
};
const CAP_HEADER_CELLS = {
    partNumber: 'C5', partDesignation: 'C6', project: 'C7', supplier: 'C8',
    location: 'C9', creator: 'J5', date: 'J6', department: 'J7', gsisNr: 'J8',
};
const DIAGRAM_NORMAL_DEMAND_CELL = 'F7';

// --- processType (solo lo que necesito: clasificar segun nombre) ---
function inferProcessType(name) {
    if (!name) return 'general';
    const n = name.toLowerCase();
    if (/inyec|inject/.test(n)) return 'inyeccion';
    if (/tapizad|tapice/.test(n)) return 'tapizado';
    if (/refilad/.test(n)) return 'refilado';
    if (/troquel|estampad|embutid/.test(n)) return 'troquelado';
    if (/costur/.test(n)) return 'costura';
    if (/cort/.test(n)) return 'corte';
    if (/soldad/.test(n)) return 'soldadura';
    if (/ensambl|armad|montaj/.test(n)) return 'ensamble';
    if (/inspecc|control|verific/.test(n)) return 'inspeccion';
    if (/embalaj|pack/.test(n)) return 'embalaje';
    if (/pintur/.test(n)) return 'pintura';
    if (/recubrimient|galvani/.test(n)) return 'recubrimiento';
    if (/mecaniz|cnc|tornead|fresa/.test(n)) return 'mecanizado';
    return 'general';
}
const PROCESS_TYPE_LABELS = {
    inyeccion: { multiplierLabel: 'Cavidades del molde', machinesLabel: 'Inyectoras paralelas', cavitiesApplies: true },
    costura: { multiplierLabel: 'No aplica', machinesLabel: 'Maquinas de costura', cavitiesApplies: false },
    tapizado: { multiplierLabel: 'No aplica', machinesLabel: 'Puestos de tapizado', cavitiesApplies: false },
    refilado: { multiplierLabel: 'No aplica', machinesLabel: 'Puestos de refilado', cavitiesApplies: false },
    corte: { multiplierLabel: 'Capas por corte', machinesLabel: 'Mesas / cizallas', cavitiesApplies: true },
    troquelado: { multiplierLabel: 'Cavidades del troquel', machinesLabel: 'Prensas / troqueladoras', cavitiesApplies: true },
    pintura: { multiplierLabel: 'Piezas por jig', machinesLabel: 'Cabinas', cavitiesApplies: true },
    recubrimiento: { multiplierLabel: 'Piezas por bastidor', machinesLabel: 'Cubas / lineas', cavitiesApplies: true },
    mecanizado: { multiplierLabel: 'Piezas por pallet', machinesLabel: 'Centros de mecanizado', cavitiesApplies: true },
    soldadura: { multiplierLabel: 'No aplica', machinesLabel: 'Estaciones de soldadura', cavitiesApplies: false },
    ensamble: { multiplierLabel: 'No aplica', machinesLabel: 'Estaciones de ensamble', cavitiesApplies: false },
    inspeccion: { multiplierLabel: 'No aplica', machinesLabel: 'Puestos de inspeccion', cavitiesApplies: false },
    embalaje: { multiplierLabel: 'Piezas por bulto', machinesLabel: 'Estaciones de embalaje', cavitiesApplies: true },
    general: { multiplierLabel: 'No aplica', machinesLabel: 'Puestos paralelos', cavitiesApplies: false },
};

// ==============================
// ADAPTER: ProjectData -> Gate3Project (replica gate3FromBalancing.ts)
// ==============================
function buildGate3FromProjectData(data) {
    const assignments = data.assignments ?? [];
    const tasks = data.tasks ?? [];
    const stationConfigs = data.stationConfigs ?? [];
    const shifts = data.shifts ?? [];

    const activeShifts = Math.max(1, safeNum(data.meta?.activeShifts, 1));
    const dailyDemand = Math.max(0, safeNum(data.meta?.dailyDemand, 0));
    const globalOee = data.meta?.useSectorOEE ? 1 : safeNum(data.meta?.manualOEE, 0.85);
    const setupLossPct = safeNum(data.meta?.setupLossPercent, 0);

    // Minutos disponibles — replica calculateTaktTime
    let totalAvailMin = 0;
    for (let i = 0; i < activeShifts; i++) {
        const s = shifts[i] || {};
        const len = Number(s.length) || 480;
        const breaks = (s.breaks || []).reduce((a, b) => a + (Number(b.duration) || 0), 0);
        totalAvailMin += Math.max(0, len - breaks);
    }
    if (totalAvailMin === 0) totalAvailMin = 480 * activeShifts;
    const effectiveTotalMin = totalAvailMin * (1 - setupLossPct);
    const minPerShiftAvg = effectiveTotalMin / activeShifts;
    const hoursPerShift = Math.max(1, minPerShiftAvg / 60);

    // Construir stations desde assignments
    const tMap = new Map(tasks.map((t) => [t.id, t]));
    const cfgMap = new Map(stationConfigs.map((c) => [c.id, c]));
    const validIds = assignments.map((a) => a.stationId).filter(Number.isFinite);
    const maxId = validIds.length > 0 ? Math.max(...validIds) : 0;
    const total = Math.max(maxId, safeNum(data.meta?.configuredStations, 1));

    const stations = [];
    for (let i = 1; i <= total && stations.length < GATE3_MAX_STATIONS; i++) {
        const stationTasks = assignments
            .filter((a) => a.stationId === i)
            .map((a) => tMap.get(a.taskId))
            .filter(Boolean);
        if (stationTasks.length === 0) continue;

        const cfg = cfgMap.get(i);
        const replicas = cfg?.replicas && cfg.replicas > 0 ? cfg.replicas : 1;
        // Tiempo efectivo: suma de standardTime, reemplazando injection con realCycle
        const effective = stationTasks.reduce((acc, t) => {
            if (t.executionMode === 'injection' && t.injectionParams?.realCycle) {
                return acc + safeNum(t.injectionParams.realCycle);
            }
            return acc + safeNum(t.standardTime || t.averageTime);
        }, 0);
        const cycleTime = replicas > 0 ? effective / replicas : 0;

        // Station OEE: si useManualOEE, cae a global (calculateStationOEE logica)
        const stationOee = Math.min(1, Math.max(0, globalOee));

        const description = (stationTasks[0]?.description || `Estacion ${i}`).slice(0, 50);
        const processType = inferProcessType(description);

        const cavities = processType === 'inyeccion'
            ? Math.max(1, safeNum(stationTasks[0]?.injectionParams?.optimalCavities, 1))
            : 1;

        stations.push({
            name: description,
            processType,
            observationTimeMin: 0,
            cycleTimeSec: Number(cycleTime.toFixed(2)),
            cavities,
            downtimeMin: 0,
            okParts: 0,
            nokParts: 0,
            shiftsPerWeek: activeShifts * 5,
            hoursPerShift: Number(hoursPerShift.toFixed(2)) || 8,
            reservationPct: 1,
            machines: replicas,
            oeeOverride: stationOee,
        });
    }

    const today = (() => {
        const d = new Date();
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    })();

    return {
        partNumber: data.meta?.name || '',
        partDesignation: data.meta?.name || '',
        project: data.meta?.name || '',
        supplier: 'Barack Mercosul',
        location: 'Zarate, Argentina',
        creator: data.meta?.engineer || '',
        date: data.meta?.date || today,
        department: 'Ingenieria',
        gsisNr: '',
        normalDemandWeek: dailyDemand * 5,
        stations: stations.length > 0 ? stations : [{
            name: 'Estacion 1', processType: 'general', observationTimeMin: 0,
            cycleTimeSec: 0, cavities: 1, downtimeMin: 0, okParts: 0, nokParts: 0,
            shiftsPerWeek: 15, hoursPerShift: 8, reservationPct: 1, machines: 1,
            oeeOverride: globalOee,
        }],
    };
}

// ==============================
// INYECTAR VALORES EN TEMPLATE (replica gate3ExcelExport.ts)
// ==============================
function setIfDefined(sheet, address, value) {
    if (value === undefined || value === null) return;
    if (typeof value === 'number' && !Number.isFinite(value)) return;
    sheet.cell(address).value(value);
}

function applyHeader(wb, p) {
    const cap = wb.sheet('CapacitySFN');
    cap.cell(CAP_HEADER_CELLS.partNumber).value(p.partNumber || '');
    cap.cell(CAP_HEADER_CELLS.partDesignation).value(p.partDesignation || '');
    cap.cell(CAP_HEADER_CELLS.project).value(p.project || '');
    cap.cell(CAP_HEADER_CELLS.supplier).value(p.supplier || '');
    cap.cell(CAP_HEADER_CELLS.location).value(p.location || '');
    cap.cell(CAP_HEADER_CELLS.creator).value(p.creator || '');
    cap.cell(CAP_HEADER_CELLS.date).value(p.date || '');
    cap.cell(CAP_HEADER_CELLS.department).value(p.department || '');
    cap.cell(CAP_HEADER_CELLS.gsisNr).value(p.gsisNr || '');
    wb.sheet('DiagramSFN').cell(DIAGRAM_NORMAL_DEMAND_CELL).value(safeNum(p.normalDemandWeek));
}

function applyStation(oee, cap, n, s) {
    const col = oeeStationCol(n);
    const m = capStationMap(n);
    const labels = stationLabelCells(n);
    const ptKey = s.processType ?? 'general';
    const pt = PROCESS_TYPE_LABELS[ptKey] ?? PROCESS_TYPE_LABELS.general;

    oee.cell(`${col}${OEE_INPUT_ROWS.observationTime}`).value(safeNum(s.observationTimeMin));
    oee.cell(`${col}${OEE_INPUT_ROWS.cycleTime}`).value(safeNum(s.cycleTimeSec));
    const effectiveCavities = pt.cavitiesApplies ? Math.max(1, safeNum(s.cavities, 1)) : 1;
    oee.cell(`${col}${OEE_INPUT_ROWS.cavities}`).value(effectiveCavities);
    oee.cell(`${col}${OEE_INPUT_ROWS.downtime}`).value(safeNum(s.downtimeMin));
    oee.cell(`${col}${OEE_INPUT_ROWS.okParts}`).value(safeNum(s.okParts));
    oee.cell(`${col}${OEE_INPUT_ROWS.nokParts}`).value(safeNum(s.nokParts));

    cap.cell(`${m.nameCol}${m.topRow + CAP_ROW_OFFSETS.processName}`).value(s.name || `Estacion ${n}`);
    cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.shiftsPerWeek}`).value(safeNum(s.shiftsPerWeek, 15));
    cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.hoursPerShift}`).value(safeNum(s.hoursPerShift, 8));
    cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.reservation}`).value(Math.min(1, Math.max(0, safeNum(s.reservationPct, 1))));
    cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.machines}`).value(safeNum(s.machines, 1));

    if (s.oeeOverride !== undefined && Number.isFinite(s.oeeOverride)) {
        cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.oee}`).value(Math.min(1, Math.max(0, s.oeeOverride)));
    }
    if (!pt.cavitiesApplies) {
        cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.cavities}`).value(1);
    }

    if (ptKey !== 'inyeccion') {
        cap.cell(labels.cavitiesLabel).value(`${pt.multiplierLabel}`);
    }
    cap.cell(labels.machinesLabel).value(pt.machinesLabel);
}

function clearStation(oee, cap, n) {
    const col = oeeStationCol(n);
    const m = capStationMap(n);
    [OEE_INPUT_ROWS.observationTime, OEE_INPUT_ROWS.cycleTime, OEE_INPUT_ROWS.cavities,
     OEE_INPUT_ROWS.downtime, OEE_INPUT_ROWS.okParts, OEE_INPUT_ROWS.nokParts].forEach((row) => {
        oee.cell(`${col}${row}`).value(0);
    });
    cap.cell(`${m.nameCol}${m.topRow + CAP_ROW_OFFSETS.processName}`).value('');
    cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.shiftsPerWeek}`).value(0);
    cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.hoursPerShift}`).value(0);
    cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.reservation}`).value(0);
    cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.machines}`).value(0);
}

// ==============================
// MAIN
// ==============================
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data: p, error } = await sb.from('projects').select('*').eq('id', projectId).single();
if (error) { console.error('Error:', error.message); process.exit(1); }
let pdata = p.data;
if (typeof pdata === 'string') pdata = JSON.parse(pdata);

// Construir Gate3Project desde el ProjectData
const project = buildGate3FromProjectData(pdata);

// Cargar template oficial VW
const templatePath = new URL('../src/assets/templates/gate3_template.xlsx', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const wb = await XlsxPopulate.fromFileAsync(templatePath);

// Aplicar datos
applyHeader(wb, project);
const oee = wb.sheet('OEE CalculatorSFN');
const cap = wb.sheet('CapacitySFN');
const stationsToUse = project.stations.slice(0, GATE3_MAX_STATIONS);
stationsToUse.forEach((s, idx) => applyStation(oee, cap, idx + 1, s));
for (let n = stationsToUse.length + 1; n <= GATE3_MAX_STATIONS; n++) {
    clearStation(oee, cap, n);
}

// Guardar
const defaultOutDir = process.argv[3] || join(homedir(), 'Documents');
mkdirSync(defaultOutDir, { recursive: true });
const oeePct = Math.round((pdata.meta?.manualOEE || 0.85) * 100);
const fileName = `Gate3_VW_${sanitize(project.partNumber)}_OEE${oeePct}pct.xlsx`;
const outputPath = join(defaultOutDir, fileName);
await wb.toFileAsync(outputPath);

console.log(`\nExcel VW oficial generado:`);
console.log(`  ${outputPath}`);
console.log(`\nDatos inyectados:`);
console.log(`  Proyecto:       ${project.partNumber}`);
console.log(`  OEE aplicado:   ${oeePct}% (en cada estacion, fila OEE de CapacitySFN)`);
console.log(`  Demanda/semana: ${project.normalDemandWeek} piezas`);
console.log(`  Estaciones:     ${stationsToUse.length}`);
for (const [i, s] of stationsToUse.entries()) {
    console.log(`    ${i + 1}. ${s.name} | ciclo=${s.cycleTimeSec}s | cavidades=${s.cavities} | oee=${(s.oeeOverride * 100).toFixed(0)}%`);
}
process.exit(0);
