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
        C12: 'Formula',
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
        [`${m.nameCol}${t - 1}`]: `Estacion ${n}`,
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

// Formatea fecha ISO -> DD/MM/YYYY (formato estandar Barack)
function formatDate(iso) {
    if (!iso) return '';
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
        const effective = stationTasks.reduce((acc, t) => {
            if (t.executionMode === 'injection' && t.injectionParams?.realCycle) {
                return acc + safeNum(t.injectionParams.realCycle);
            }
            return acc + safeNum(t.standardTime || t.averageTime);
        }, 0);
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
        location: 'Zarate, Argentina',
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
// POSTPROCESS via JSZip: swap logo + proteger hojas via XML
// ==============================
async function postprocessXlsx(xlsxPath, jpegBuffer, sheetsToProtect) {
    const buf = readFileSync(xlsxPath);
    const zip = await JSZip.loadAsync(buf);

    // 1. Swap logo Barack (los 3 drawings comparten xl/media/image1.jpeg)
    zip.file('xl/media/image1.jpeg', jpegBuffer);

    // 2. Proteger hojas visibles insertando <sheetProtection/> en el XML.
    //    xlsx-populate no persiste proteccion sin password — lo hacemos nosotros.
    //    workbook.xml tiene el mapeo sheet name -> sheetId. Los sheetN.xml no tienen
    //    nombre asociado, asi que buscamos por match del contenido.
    const workbookXml = await zip.file('xl/workbook.xml').async('string');
    const sheetMap = new Map(); // sheet name -> sheet number (sheetN.xml)
    const sheetRels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
    // relId -> target
    const relsById = new Map();
    for (const m of sheetRels.matchAll(/<Relationship\s+Id="(rId\d+)"[^>]*Target="(worksheets\/sheet\d+\.xml)"/g)) {
        relsById.set(m[1], m[2]);
    }
    // name -> target
    for (const m of workbookXml.matchAll(/<sheet\s+name="([^"]+)"[^>]*r:id="(rId\d+)"/g)) {
        const target = relsById.get(m[2]);
        if (target) sheetMap.set(m[1], 'xl/' + target);
    }

    const PROTECTION_TAG = '<sheetProtection sheet="1" objects="1" scenarios="1" formatCells="0" selectLockedCells="0" selectUnlockedCells="0"/>';
    for (const name of sheetsToProtect) {
        const path = sheetMap.get(name);
        if (!path || !zip.file(path)) { console.log(`  (proteccion: no se encontro hoja ${name})`); continue; }
        let xml = await zip.file(path).async('string');
        // Quitar cualquier proteccion pre-existente
        xml = xml.replace(/<sheetProtection\s[^/]*\/>/g, '');
        // Insertar despues del cierre de </sheetData>
        xml = xml.replace('</sheetData>', '</sheetData>' + PROTECTION_TAG);
        zip.file(path, xml);
    }

    const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    writeFileSync(xlsxPath, out);
}

// Convierte PNG -> JPEG usando PowerShell + .NET System.Drawing
function convertPngToJpegWhiteBg(pngPath, jpegPath) {
    const ps = `
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('${pngPath.replace(/'/g, "''")}')
$bmp = New-Object System.Drawing.Bitmap $img.Width, $img.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$g.DrawImage($img, 0, 0, $img.Width, $img.Height)
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

// 1. Desproteger las hojas del template VW (para poder escribir)
['CapacitySFN', 'OEE CalculatorSFN', 'DiagramSFN', 'Protocolo_SFN1'].forEach(name => {
    const sheet = wb.sheet(name);
    if (sheet && typeof sheet.protected === 'function') {
        try { sheet.protected(false); } catch (e) { /* ok */ }
    }
});

// 2. Aplicar traducciones
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

// 5. Guardar xlsx intermedio (la proteccion se aplica post-procesado con JSZip)
const defaultOutDir = process.argv[3] || join(homedir(), 'Documents');
mkdirSync(defaultOutDir, { recursive: true });
const oeePct = Math.round((pdata.meta?.manualOEE || 0.85) * 100);
const versionSlug = sanitize(pdata.meta?.version || 'RevA');
const fileName = `CapacityCheck_${sanitize(project.partDesignation)}_${versionSlug}_OEE${oeePct}pct.xlsx`;
const outputPath = join(defaultOutDir, fileName);
await wb.toFileAsync(outputPath);

// 6. Postprocess con JSZip: swap logo + proteger hojas visibles
const logoPngPath = new URL('../src/assets/barack_logo.png', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const tempJpegPath = join(tmpdir(), `barack_logo_${Date.now()}.jpg`);
try {
    convertPngToJpegWhiteBg(logoPngPath, tempJpegPath);
    const jpegBuf = readFileSync(tempJpegPath);
    await postprocessXlsx(outputPath, jpegBuf, ['CapacitySFN', 'OEE CalculatorSFN', 'DiagramSFN']);
    console.log(`  Logo Barack aplicado (${jpegBuf.length} bytes) + proteccion de hojas visibles`);
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
console.log(`Hojas protegidas (sin password, solo formulas locked)`);
process.exit(0);
