/**
 * Exporta un proyecto de balanceo al formato Gate 3 Capacity Check,
 * customizado para Barack Mercosul:
 *   - Textos del template traducidos a espanol
 *   - Logo Barack reemplazando el logo VW
 *   - Fecha tomada del proyecto (meta.date o updated_at), no del dia de hoy
 *   - Proyecto = codigo del proyecto (PATAGONIA), no el nombre de la pieza
 *   - Campo "Creado por" vacio (Fak no quiere atribucion)
 *   - Hojas protegidas (sin password, solo proteccion de formulas)
 *
 * Flujo:
 *   1. Lee el proyecto de Supabase
 *   2. Replica el adapter buildGate3FromProjectData
 *   3. Abre el template VW oficial con xlsx-populate (preserva formulas)
 *   4. Inyecta valores + traduce textos + aplica protecciones
 *   5. Guarda el xlsx intermedio
 *   6. Reabre como zip (JSZip) y swap xl/media/image1.jpeg por logo Barack (JPEG)
 *   7. Reempaqueta y guarda en ~/Documents
 *
 * Uso: node scripts/_exportProjectGate3VW.mjs <projectId> [outputDir]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import XlsxPopulate from 'xlsx-populate';
import JSZip from 'jszip';

const projectId = process.argv[2];
if (!projectId) {
    console.error('Uso: node scripts/_exportProjectGate3VW.mjs <projectId> [outputDir]');
    process.exit(1);
}

// ==============================
// CONSTANTES — cell maps del template VW
// ==============================
const GATE3_MAX_STATIONS = 12;

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
// Header: las etiquetas viven en B5-B9 / I5-I8; los VALORES del header en C5-C9 / J5-J8
const CAP_HEADER_CELLS = {
    partNumber: 'C5', partDesignation: 'C6', project: 'C7', supplier: 'C8',
    location: 'C9', creator: 'J5', date: 'J6', department: 'J7', gsisNr: 'J8',
};
const DIAGRAM_NORMAL_DEMAND_CELL = 'F7';

// ==============================
// TRADUCCIONES EN -> ES
// ==============================
// Mapa de celdas de label a traducir. Fuente: inspeccion del template.
const TRANSLATIONS = {
    CapacitySFN: {
        B3: 'VERIFICACION DE CAPACIDAD',
        B5: 'Numero de parte',
        I5: 'Creado por',
        B6: 'Denominacion',
        I6: 'Fecha',
        B7: 'Proyecto',
        I7: 'Departamento',
        B8: 'Proveedor',
        // I8 'GSIS-Nr.' lo sacamos (no aplica a Barack)
        I8: 'N° de documento',
        B9: 'Ubicacion',
        C47: '- campos de entrada',
        C48: '- resultado, formulas protegidas',
        C49: '- valores calculados desde la hoja "Calculador OEE"',
        // Sacar atribucion VW del template
        B51: '',
    },
    'OEE CalculatorSFN': {
        C3: 'CALCULADOR OEE',
        // Labels de header en OEE Calc estan en columnas D/K (no B/I como CapacitySFN)
        D5: 'Numero de parte',
        K5: 'Creado por',
        D6: 'Denominacion',
        K6: 'Fecha',
        D7: 'Proyecto',
        K7: 'Departamento',
        D8: 'Proveedor',
        K8: 'N° de documento',
        D9: 'Ubicacion',
        B12: 'Variable',
        C12: 'Formula de calculo',
        // Atribucion original VW: "created: R. Hartel K-BN-KA/1 Tel. Nr.: 05361-9-45487"
        B26: '',
        D13: 'Tiempo de observacion (min)',
        D14: 'Tiempo de ciclo (seg)',
        D15: 'Cavidades (cantidad)',
        D16: 'Meta a 100% OEE',
        D17: 'Tiempo muerto registrado en A (min)',
        D18: 'Piezas OK totales en A (pzs)',
        D19: 'Piezas NO OK totales en A (pzs)',
        D20: 'Disponibilidad',
        D21: 'Rendimiento',
        D22: 'Calidad',
        D23: 'OEE',
        F25: '- campos de entrada',
    },
    DiagramSFN: {
        B3: 'DIAGRAMA DE CAPACIDAD TOTAL POR ESTACION',
        B5: 'Demanda maxima',
        G5: 'pzs/semana',
        B7: 'Demanda normal',
        G7: 'pzs/semana',
        J5: 'Creado por',
        J6: 'Fecha',
        J7: 'Departamento',
        J8: 'N° de documento',
        H43: '- campos de entrada',
    },
};

// Labels por-estacion (Shifts/week, Hours/shift, etc.) en CapacitySFN.
// Para cada estacion 1..12 hay labels en columnas E (block1), L (block2), S (block3)
// (una columna antes de valueCol). Los offsets desde topRow replican los de CAP_ROW_OFFSETS.
function stationLabels(n) {
    const m = capStationMap(n);
    const labelCol = String.fromCharCode(m.valueCol.charCodeAt(0) - 1); // F / M / T
    const t = m.topRow;
    return {
        // Titulo de la estacion — "Station N" del template pasa a "Estacion N"
        [`${m.nameCol}${t}`]: `Estacion ${n}`,
        [`${m.nameCol}${t + CAP_ROW_OFFSETS.processName - 1}`]: 'Proceso:',
        [`${labelCol}${t + CAP_ROW_OFFSETS.shiftsPerWeek}`]: 'Turnos/semana',
        [`${labelCol}${t + CAP_ROW_OFFSETS.pcsWeek}`]: 'Pzs/semana',
        [`${labelCol}${t + CAP_ROW_OFFSETS.cycleTime}`]: 'Tiempo de ciclo (seg)',
        [`${labelCol}${t + CAP_ROW_OFFSETS.hoursPerShift}`]: 'Horas por turno',
        [`${labelCol}${t + CAP_ROW_OFFSETS.oee}`]: 'OEE',
        // Labels por defecto para cavidades + maquinas (applyStation puede sobreescribir
        // segun tipo de proceso, pero estas mismas celdas quedan con texto en espanol
        // aunque la estacion este vacia)
        [`${labelCol}${t + CAP_ROW_OFFSETS.cavities}`]: 'Cavidades',
        [`${labelCol}${t + CAP_ROW_OFFSETS.machines}`]: 'Maquinas paralelas',
        [`${String.fromCharCode(labelCol.charCodeAt(0) - 1)}${t + CAP_ROW_OFFSETS.reservation}`]: 'Reserva para proyecto',
    };
}

// Labels de estacion en OEE CalculatorSFN — fila 11, columnas E..P
function oeeCalcStationLabels() {
    const labels = {};
    for (let n = 1; n <= GATE3_MAX_STATIONS; n++) {
        labels[`${oeeStationCol(n)}11`] = `Estacion ${n}`;
    }
    return labels;
}

// ==============================
// PROCESS TYPE INFERENCE
// ==============================
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
// HELPERS
// ==============================
const safeNum = (v, fb = 0) => (typeof v === 'number' && Number.isFinite(v)) ? v : fb;
const sanitize = (s) => (s || '').replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 60) || 'Gate3';

function setIfDefined(sheet, address, value) {
    if (value === undefined || value === null) return;
    if (typeof value === 'number' && !Number.isFinite(value)) return;
    sheet.cell(address).value(value);
}

// Formatea fecha ISO -> DD/MM/YYYY (formato estandar Barack).
// Fix 2026-04-17: "2026-03-20" construido con new Date() se parsea como UTC
// medianoche y al formatear en local (UTC-3) queda 2026-03-19. Parseamos
// el patron YYYY-MM-DD directamente sin pasar por Date para evitar el offset.
function formatDate(iso) {
    if (!iso) return '';
    const ymd = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ==============================
// ADAPTER: ProjectData -> Gate3Project
// ==============================
function buildGate3FromProjectData(data, row) {
    const assignments = data.assignments ?? [];
    const tasks = data.tasks ?? [];
    const stationConfigs = data.stationConfigs ?? [];
    const shifts = data.shifts ?? [];

    const activeShifts = Math.max(1, safeNum(data.meta?.activeShifts, 1));
    const dailyDemand = Math.max(0, safeNum(data.meta?.dailyDemand, 0));
    const globalOee = data.meta?.useSectorOEE ? 1 : safeNum(data.meta?.manualOEE, 0.85);
    const setupLossPct = safeNum(data.meta?.setupLossPercent, 0);

    let totalAvailMin = 0;
    for (let i = 0; i < activeShifts; i++) {
        const s = shifts[i] || {};
        const len = Number(s.length) || 480;
        const breaks = (s.breaks || []).reduce((a, b) => a + (Number(b.duration) || 0), 0);
        totalAvailMin += Math.max(0, len - breaks);
    }
    if (totalAvailMin === 0) totalAvailMin = 480 * activeShifts;
    const effectiveTotalMin = totalAvailMin * (1 - setupLossPct);
    const hoursPerShift = Math.max(1, (effectiveTotalMin / activeShifts) / 60);

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
        // Fix Gate3 2026-04-17 (corregido): la formula Gate 3 VW asume
        // cycleTime = tiempo de UN ciclo COMPLETO del molde (cuando salen
        // todas las cavidades juntas), NO el tiempo por pieza individual.
        //   pzs/hora = 3600/cycleTime × cavidades × OEE × ...
        // realCycle ya esta dividido por cavidades (=tiempo por pieza), asi
        // que multiplicamos por cavidades para obtener el tiempo de molde.
        // Para estaciones no-inyeccion: suma de standardTime (comportamiento legacy).
        const injTask = stationTasks.find(
            (t) => t.executionMode === 'injection' && t.injectionParams?.realCycle,
        );
        const effective = injTask
            ? safeNum(injTask.injectionParams.realCycle) *
                Math.max(1, safeNum(injTask.injectionParams.optimalCavities, 1))
            : stationTasks.reduce(
                (acc, t) => acc + safeNum(t.standardTime || t.averageTime),
                0,
            );
        const cycleTime = replicas > 0 ? effective / replicas : 0;
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
            oeeOverride: Math.min(1, Math.max(0, globalOee)),
        });
    }

    // Fecha: priorizar la declarada en el proyecto (meta.date), luego updated_at, ultimo fallback = hoy
    const projDate = data.meta?.date || row.updated_at || new Date().toISOString();

    return {
        // partNumber/partDesignation = nombre de la pieza/proyecto
        partNumber: data.meta?.name || '',
        partDesignation: data.meta?.name || '',
        // "Proyecto" = codigo del proyecto (PATAGONIA, P703, etc.)
        project: data.meta?.project || row.project_code || '',
        supplier: 'Barack Mercosul',
        location: 'Hurlingham, Buenos Aires, Argentina',
        // Creator vacio — Fak no quiere atribucion
        creator: '',
        date: formatDate(projDate),
        department: 'Ingenieria',
        // Numero interno de documento
        gsisNr: `BRK-G3-${row.id}-${(data.meta?.version || 'A').replace(/\s+/g, '')}`,
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
// APLICAR DATOS AL TEMPLATE
// ==============================
function applyTranslations(wb) {
    for (const [sheetName, cells] of Object.entries(TRANSLATIONS)) {
        const sheet = wb.sheet(sheetName);
        if (!sheet) continue;
        for (const [addr, val] of Object.entries(cells)) {
            try { sheet.cell(addr).value(val); } catch (e) { /* skip */ }
        }
    }
}

function applyStationLabels(wb) {
    const cap = wb.sheet('CapacitySFN');
    for (let n = 1; n <= GATE3_MAX_STATIONS; n++) {
        const labels = stationLabels(n);
        for (const [addr, val] of Object.entries(labels)) {
            try { cap.cell(addr).value(val); } catch (e) { /* skip */ }
        }
    }
    // OEE CalculatorSFN tambien tiene "Station N" en fila 11
    const oee = wb.sheet('OEE CalculatorSFN');
    const oeeLabels = oeeCalcStationLabels();
    for (const [addr, val] of Object.entries(oeeLabels)) {
        try { oee.cell(addr).value(val); } catch (e) { /* skip */ }
    }
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

    // Labels adaptativos por tipo de proceso (cavidades y maquinas)
    if (ptKey !== 'inyeccion') {
        cap.cell(labels.cavitiesLabel).value(pt.multiplierLabel);
    } else {
        cap.cell(labels.cavitiesLabel).value('Cavidades');
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
// POSTPROCESS via JSZip: SOLO swap del logo
// (la proteccion se maneja antes con xlsx-populate para no tocar el XML)
// ==============================
async function finalizeXlsx(xlsxPath, jpegBuffer) {
    const buf = readFileSync(xlsxPath);
    const zip = await JSZip.loadAsync(buf);

    // 1. Swap logo Barack (los 3 drawings comparten xl/media/image1.jpeg)
    zip.file('xl/media/image1.jpeg', jpegBuffer);

    // 2. Borrar <sheetProtection> de todas las hojas — Fak quiere poder editar
    //    sin password. Solo borramos el tag, NO insertamos nada nuevo (evitamos
    //    alterar el orden OOXML que causaba "Archivo reparado").
    //    Nota: el hashValue base64 del template VW contiene '/', asi que el regex
    //    excluye solo '>' (no '/').
    const sheetFiles = Object.keys(zip.files).filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f));
    for (const f of sheetFiles) {
        const xml = await zip.file(f).async('string');
        const cleaned = xml.replace(/<sheetProtection\s[^>]*?\/>/g, '')
                           .replace(/<sheetProtection\s[^>]*>[\s\S]*?<\/sheetProtection>/g, '');
        if (cleaned !== xml) zip.file(f, cleaned);
    }

    // 3. Reemplazar el corporate header VW en aleman en los drawings
    //    "M-BN-L Beschaffung Neue Produktanläufe Lieferantenmanagement" -> Barack
    //    Los drawings son xl/drawings/drawing1.xml (Tabelle1),
    //    drawing2.xml (CapacitySFN) y drawing3.xml (DiagramSFN).
    const drawingFiles = Object.keys(zip.files).filter(f => /^xl\/drawings\/drawing\d+\.xml$/.test(f));
    const BARACK_HEADER = 'Barack Mercosul     Verificacion de Capacidad Gate 3';
    for (const f of drawingFiles) {
        const xml = await zip.file(f).async('string');
        const cleaned = xml.replace(/M-BN-L\s*Beschaffung Neue Produktanläufe Lieferantenmanagement\s*/g, BARACK_HEADER);
        if (cleaned !== xml) zip.file(f, cleaned);
    }

    // 3b. Ajustar ext del pic al aspect ratio real del logo Barack (2:1 ancho).
    //     El canvas del JPEG se genera con el mismo aspect (y sin padding arriba/abajo),
    //     asi el logo llena el espacio sin deformarse ni quedar flotando en blanco.
    //     cx=380000 cy=190000 (aspect 2:1) = ~1.05cm × 0.53cm, logo visible sin
    //     invadir el texto al lado.
    for (const f of drawingFiles) {
        let xml = await zip.file(f).async('string');
        let changed = false;
        xml = xml.replace(
            /(<xdr:pic>[\s\S]*?<a:xfrm>[\s\S]*?<a:ext\s+cx=")(\d+)("\s+cy=")(\d+)("\s*\/>)/g,
            (match, p1, cx, p3, cy, p5) => {
                changed = true;
                return `${p1}380000${p3}190000${p5}`;
            }
        );
        if (changed) zip.file(f, xml);
    }

    // 4. Traducir textos del chart (DiagramSFN): titulo + ejes
    //    Los textos viven en xl/charts/chart1.xml dentro de <a:t>...</a:t>.
    //    El titulo viene partido: "Overview capacity individual" + " stations".
    //    Lo unificamos en un solo chunk en espanol.
    const chartReplacements = [
        // Titulo del chart (viene en 2 segments contiguos)
        { from: /<a:t>Overview capacity individual<\/a:t>([\s\S]*?)<a:t>\s*stations<\/a:t>/g,
          to: '<a:t>Capacidad total por estacion</a:t>$1<a:t></a:t>' },
        // Label del eje Y
        { from: /<a:t>Capacity psc\/week<\/a:t>/g,
          to: '<a:t>Capacidad pzs/semana</a:t>' },
        // Label eje categoria (por si acaso aparece)
        { from: /<a:t>individual stations<\/a:t>/g,
          to: '<a:t>Estaciones individuales</a:t>' },
        // Labels de ejes numericos (el "Capacity psc/week" del eje vertical)
        { from: /<c:v>Capacity psc\/week<\/c:v>/g,
          to: '<c:v>Capacidad pzs/semana</c:v>' },
        { from: /<c:v>individual stations<\/c:v>/g,
          to: '<c:v>Estaciones individuales</c:v>' },
    ];
    const chartFiles = Object.keys(zip.files).filter(f => /^xl\/charts\/chart\d+\.xml$/.test(f));
    for (const f of chartFiles) {
        let xml = await zip.file(f).async('string');
        let changed = false;
        for (const r of chartReplacements) {
            const next = xml.replace(r.from, r.to);
            if (next !== xml) { xml = next; changed = true; }
        }
        if (changed) zip.file(f, xml);
    }

    const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    writeFileSync(xlsxPath, out);
}

// Convierte PNG -> JPEG usando PowerShell + .NET System.Drawing.
// Dibuja el logo sobre un canvas con aspect ratio igual al anchor del template VW
// (casi cuadrado, cx/cy ~= 0.73), centrado horizontal y verticalmente, con
// fondo blanco. Asi Excel NO estira el logo al encajarlo en el anchor.
function convertPngToJpegWhiteBg(pngPath, jpegPath) {
    // Canvas con MISMO aspect ratio que el logo Barack (151/75 ~= 2:1).
    // El logo ocupa TODO el canvas (sin padding blanco arriba/abajo).
    // El ext del drawing tambien se configura a 2:1 -> no hay deformacion.
    // Canvas 600x298 ~= 2.013 aspect (mismo que el PNG original).
    const ps = `
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('${pngPath.replace(/'/g, "''")}')
$canvasW = 600
$canvasH = [int](600 * $img.Height / $img.Width)
$bmp = New-Object System.Drawing.Bitmap $canvasW, $canvasH
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, $canvasW, $canvasH)
$bmp.Save('${jpegPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Jpeg)
$img.Dispose()
$bmp.Dispose()
`.trim();
    execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"').replace(/\n/g, '; ')}"`, { stdio: 'pipe' });
}

// ==============================
// MAIN
// ==============================
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data: row, error } = await sb.from('projects').select('*').eq('id', projectId).single();
if (error) { console.error('Error:', error.message); process.exit(1); }
let pdata = row.data;
if (typeof pdata === 'string') pdata = JSON.parse(pdata);

const project = buildGate3FromProjectData(pdata, row);

// Cargar template oficial VW
const templatePath = new URL('../src/assets/templates/gate3_template.xlsx', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const wb = await XlsxPopulate.fromFileAsync(templatePath);

// 1. Aplicar traducciones (xlsx-populate puede escribir sobre hojas protegidas —
//    la proteccion es un flag que Excel enforza al abrir, no xlsx-populate internamente)
applyTranslations(wb);
applyStationLabels(wb);

// 3. Aplicar header con datos del proyecto
applyHeader(wb, project);

// 4. Aplicar stations + clear no usadas
const oee = wb.sheet('OEE CalculatorSFN');
const cap = wb.sheet('CapacitySFN');
const stationsToUse = project.stations.slice(0, GATE3_MAX_STATIONS);
stationsToUse.forEach((s, idx) => applyStation(oee, cap, idx + 1, s));
for (let n = stationsToUse.length + 1; n <= GATE3_MAX_STATIONS; n++) {
    clearStation(oee, cap, n);
}

// 5. Las 12 estaciones SIEMPRE se muestran (aunque esten vacias). Para evitar
//    los feos "#¡DIV/0!" envolvemos las formulas de cada estacion con
//    IFERROR(formula, 0). Usamos 0 (no "") porque las celdas de CapacitySFN
//    multiplican outputs del OEE Calc — con "" darian #¡VALUE!.
const usedStations = stationsToUse.length;

// OEE CalculatorSFN: Meta a 100% OEE (fila 16) + Disponibilidad/Rendimiento/
// Calidad/OEE (filas 20-23), columnas E..P (12 estaciones)
for (let n = 1; n <= GATE3_MAX_STATIONS; n++) {
    const col = oeeStationCol(n);
    for (const row of [16, 20, 21, 22, 23]) {
        const cell = oee.cell(`${col}${row}`);
        const f = cell.formula();
        if (typeof f === 'string' && f.length > 0 && !f.startsWith('IFERROR(')) {
            cell.formula(`IFERROR(${f},0)`);
        }
    }
}

// 6. El template original venia protegido con password SHA-512. xlsx-populate
//    al escribir en las celdas NO modifica el flag de proteccion — las hojas
//    siguen protegidas con el password original del template (de VW).
//    Para que Fak pueda editar libremente al recibir, DESPROTEJEMOS las hojas
//    visibles. El archivo queda sin proteccion, 100% editable.
//    (xlsx-populate.sheet.protected(false) no funciona — hay que hacerlo a mano
//     borrando sheetProtection en el XML via JSZip, pero NO reinyectar nada).
//
// Guardar xlsx intermedio (xlsx-populate preserva las formulas y el formato)
const defaultOutDir = process.argv[3] || join(homedir(), 'Documents');
mkdirSync(defaultOutDir, { recursive: true });
const oeePct = Math.round((pdata.meta?.manualOEE || 0.85) * 100);
const versionSlug = sanitize(pdata.meta?.version || 'RevA');
const fileName = `CapacityCheck_${sanitize(project.partDesignation)}_${versionSlug}_OEE${oeePct}pct.xlsx`;
const outputPath = join(defaultOutDir, fileName);
await wb.toFileAsync(outputPath);

// 6. Postprocess con JSZip:
//    a) Remover password-protection del template VW (borrar <sheetProtection.../> de las hojas visibles)
//    b) Swap logo VW -> Barack (reemplaza xl/media/image1.jpeg)
//    NO inyectamos tags nuevos para no romper el orden OOXML.
const logoPngPath = new URL('../src/assets/barack_logo.png', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const tempJpegPath = join(tmpdir(), `barack_logo_${Date.now()}.jpg`);
try {
    convertPngToJpegWhiteBg(logoPngPath, tempJpegPath);
    const jpegBuf = readFileSync(tempJpegPath);
    await finalizeXlsx(outputPath, jpegBuf);
    console.log(`  Logo Barack aplicado (${jpegBuf.length} bytes)`);
    console.log(`  Proteccion VW removida (hojas editables sin password)`);
} finally {
    if (existsSync(tempJpegPath)) unlinkSync(tempJpegPath);
}

console.log(`\nExcel Gate 3 generado con formato Barack:`);
console.log(`  ${outputPath}`);
console.log(`\nDatos inyectados:`);
console.log(`  Numero de parte: ${project.partNumber}`);
console.log(`  Proyecto:        ${project.project}`);
console.log(`  Fecha:           ${project.date}`);
console.log(`  Doc N°:          ${project.gsisNr}`);
console.log(`  Proveedor:       ${project.supplier}`);
console.log(`  OEE aplicado:    ${oeePct}%`);
console.log(`  Demanda/semana:  ${project.normalDemandWeek} piezas`);
console.log(`  Estaciones:      ${stationsToUse.length}`);
for (const [i, s] of stationsToUse.entries()) {
    const cavLabel = PROCESS_TYPE_LABELS[s.processType]?.cavitiesApplies ? `cavidades=${s.cavities}` : `cavidades=N/A`;
    console.log(`    ${i + 1}. ${s.name} | ciclo=${s.cycleTimeSec}s | ${cavLabel} | oee=${(s.oeeOverride * 100).toFixed(0)}%`);
}
console.log(`\nTraducciones EN->ES aplicadas en: CapacitySFN, OEE CalculatorSFN, DiagramSFN`);
console.log(`Logo VW reemplazado por logo Barack en las 3 hojas visibles`);
console.log(`Hojas editables sin password (proteccion VW removida)`);
process.exit(0);
