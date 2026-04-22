/**
 * Generador del workbook Gate 3 VW Capacity Check.
 *
 * Approach: clonado del template oficial VW (`src/assets/templates/gate3_template.xlsx`)
 * + inyeccion de valores en celdas de input + adaptacion de labels segun tipo de proceso.
 *
 * Cambios clave vs primera version:
 *   - LABELS ADAPTATIVOS: si una estacion no es de inyeccion, se sobreescribe el label
 *     "Cavities" -> "Maquinas" y se fija cavidades=1 (no aplica al proceso).
 *   - OEE GLOBAL: si la estacion tiene `oeeOverride`, se escribe ese valor directo en
 *     CapacitySFN (rompe el link a la formula del OEE Calculator). Asi el usuario puede
 *     usar el OEE global de su proyecto sin tener que hacer un estudio OEE completo.
 *   - LIMPIEZA: las estaciones que el usuario no carga se "vacian" para no mostrar los
 *     datos demo del template VW (Mesa de corte, Costura, etc.).
 *   - GUARDS: helper safeNum() filtra NaN/Infinity antes de escribir.
 *   - CACHE: el template (130 KB) se baja UNA sola vez por sesion.
 */

// xlsx-populate trae types via package — el subpath /browser/xlsx-populate
// reusa la misma definicion exportada por defecto.
import XlsxPopulate from 'xlsx-populate/browser/xlsx-populate';
import templateUrl from '../../src/assets/templates/gate3_template.xlsx?url';
import { GATE3_MAX_STATIONS } from '../../core/gate3/constants';
import { PROCESS_TYPE_LABELS } from '../../core/gate3/processType';
import type { Gate3Project, Gate3Station, ProtocolSFN1 } from '../../core/gate3/types';
import {
    CAP_HEADER_CELLS,
    CAP_ROW_OFFSETS,
    DIAGRAM_NORMAL_DEMAND_CELL,
    OEE_INPUT_ROWS,
    PCA1_INPUT_CELLS,
    PROTOCOL_INPUT_CELLS,
    capStationMap,
    oeeStationCol,
    stationLabelCells,
} from './gate3CellMap';

// ============================================================================
// HELPERS
// ============================================================================

const sanitize = (s: string): string =>
    (s || '').replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 60) || 'Gate3';

/** Filtra NaN/Infinity/undefined; default 0. Numeros validos pasan tal cual. */
function safeNum(v: unknown, fallback = 0): number {
    if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
    return v;
}

/** Cache module-level del template (se baja 1 sola vez por sesion). */
let templateCache: ArrayBuffer | null = null;

async function loadTemplateBuffer(): Promise<ArrayBuffer> {
    if (templateCache) return templateCache;
    const res = await fetch(templateUrl);
    if (!res.ok) throw new Error(`No se pudo cargar el template VW (${res.status})`);
    templateCache = await res.arrayBuffer();
    return templateCache;
}

/** Setea solo si el valor es definido y no es NaN. Permite escribir 0 explicito. */
function setIfDefined(sheet: any, address: string, value: unknown): void {
    if (value === undefined || value === null) return;
    if (typeof value === 'number' && !Number.isFinite(value)) return;
    sheet.cell(address).value(value as never);
}

// ============================================================================
// INYECCION DE DATOS POR SECCION
// ============================================================================

function applyHeader(wb: any, p: Gate3Project): void {
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
    cap.cell(CAP_HEADER_CELLS.partNumber); // no-op para evitar tree-shake si fuera
    wb.sheet('DiagramSFN').cell(DIAGRAM_NORMAL_DEMAND_CELL).value(safeNum(p.normalDemandWeek));
}

function applyStation(oee: any, cap: any, n: number, s: Gate3Station): void {
    const col = oeeStationCol(n);
    const m = capStationMap(n);
    const labels = stationLabelCells(n);
    const ptKey = s.processType ?? 'general';
    const pt = PROCESS_TYPE_LABELS[ptKey] ?? PROCESS_TYPE_LABELS.general;

    // === OEE CalculatorSFN — inputs ===
    // Solo escribimos si el usuario realmente cargo datos. Si todo es 0 (caso normal
    // sin estudio OEE), dejamos las celdas en 0 y el OEE Calculator dara 0%.
    // Lo importante es la celda OEE de CapacitySFN (ver mas abajo).
    oee.cell(`${col}${OEE_INPUT_ROWS.observationTime}`).value(safeNum(s.observationTimeMin));
    oee.cell(`${col}${OEE_INPUT_ROWS.cycleTime}`).value(safeNum(s.cycleTimeSec));
    // Cavidades: 1 si el proceso no las tiene; sino el valor que cargo el usuario.
    const effectiveCavities = pt.cavitiesApplies ? Math.max(1, safeNum(s.cavities, 1)) : 1;
    oee.cell(`${col}${OEE_INPUT_ROWS.cavities}`).value(effectiveCavities);
    oee.cell(`${col}${OEE_INPUT_ROWS.downtime}`).value(safeNum(s.downtimeMin));
    oee.cell(`${col}${OEE_INPUT_ROWS.okParts}`).value(safeNum(s.okParts));
    oee.cell(`${col}${OEE_INPUT_ROWS.nokParts}`).value(safeNum(s.nokParts));

    // === CapacitySFN — inputs y overrides ===
    cap.cell(`${m.nameCol}${m.topRow + CAP_ROW_OFFSETS.processName}`).value(s.name || `Estacion ${n}`);
    cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.shiftsPerWeek}`).value(safeNum(s.shiftsPerWeek, 15));
    cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.hoursPerShift}`).value(safeNum(s.hoursPerShift, 8));
    cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.reservation}`).value(
        Math.min(1, Math.max(0, safeNum(s.reservationPct, 1))),
    );
    cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.machines}`).value(safeNum(s.machines, 1));

    // OEE: si el usuario tiene un OEE manual, se escribe directo aca (rompe el link
    // al OEE Calculator pero mantiene la formula de capacidad funcionando).
    if (s.oeeOverride !== undefined && Number.isFinite(s.oeeOverride)) {
        cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.oee}`).value(
            Math.min(1, Math.max(0, s.oeeOverride)),
        );
    }
    // Cavidades en CapacitySFN: forzar 1 si el proceso no las tiene
    if (!pt.cavitiesApplies) {
        cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.cavities}`).value(1);
    }

    // === LABELS ADAPTATIVOS ===
    // Para procesos no-inyeccion, sobreescribir los labels "Cavities" y "Machines"
    // para que el operario entienda que NO son cavidades de molde.
    if (ptKey !== 'inyeccion') {
        cap.cell(labels.cavitiesLabel).value(`${pt.multiplierLabel}`);
    }
    cap.cell(labels.machinesLabel).value(pt.machinesLabel);
}

/** Limpia las celdas de input de una estacion no usada (evita datos demo del template). */
function clearStation(oee: any, cap: any, n: number): void {
    const col = oeeStationCol(n);
    const m = capStationMap(n);
    // OEE Calc: vaciar inputs y el nombre de proceso
    [OEE_INPUT_ROWS.observationTime, OEE_INPUT_ROWS.cycleTime, OEE_INPUT_ROWS.cavities,
     OEE_INPUT_ROWS.downtime, OEE_INPUT_ROWS.okParts, OEE_INPUT_ROWS.nokParts].forEach((row) => {
        oee.cell(`${col}${row}`).value(0);
    });
    // CapacitySFN: vaciar inputs (no las formulas)
    cap.cell(`${m.nameCol}${m.topRow + CAP_ROW_OFFSETS.processName}`).value('');
    cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.shiftsPerWeek}`).value(0);
    cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.hoursPerShift}`).value(0);
    cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.reservation}`).value(0);
    cap.cell(`${m.valueCol}${m.topRow + CAP_ROW_OFFSETS.machines}`).value(0);
}

function applyProtocol(wb: any, p: ProtocolSFN1 | undefined): void {
    if (!p) return;
    const sheet = wb.sheet('Protocolo_SFN1');
    setIfDefined(sheet, PROTOCOL_INPUT_CELLS.nominatedWeekly, safeNum(p.nominatedWeekly));
    setIfDefined(sheet, PROTOCOL_INPUT_CELLS.acceptanceParts, safeNum(p.acceptanceParts));
    setIfDefined(sheet, PROTOCOL_INPUT_CELLS.capacityVwGroupPct, safeNum(p.capacityVwGroupPct, 1));
    setIfDefined(sheet, PROTOCOL_INPUT_CELLS.capacityFamilyPct, safeNum(p.capacityFamilyPct));
    setIfDefined(sheet, PROTOCOL_INPUT_CELLS.plannedOEE, safeNum(p.plannedOEE, 0.85));
    setIfDefined(sheet, PROTOCOL_INPUT_CELLS.parallelLines, safeNum(p.parallelLines, 1));
    setIfDefined(sheet, PROTOCOL_INPUT_CELLS.minPerShift, safeNum(p.minPerShift));
    setIfDefined(sheet, PROTOCOL_INPUT_CELLS.cycleTimeMinPiece, safeNum(p.cycleTimeMinPiece));
    setIfDefined(sheet, PROTOCOL_INPUT_CELLS.rejectRate, safeNum(p.rejectRate));
    setIfDefined(sheet, PROTOCOL_INPUT_CELLS.shiftsPerWeek, safeNum(p.shiftsPerWeek, 15));
    setIfDefined(sheet, PROTOCOL_INPUT_CELLS.maxShiftsPerWeek, safeNum(p.maxShiftsPerWeek, 17));
    setIfDefined(sheet, PROTOCOL_INPUT_CELLS.linesInAcceptance, safeNum(p.linesInAcceptance, 1));
    setIfDefined(sheet, PROTOCOL_INPUT_CELLS.acceptanceDurationMin, safeNum(p.acceptanceDurationMin));
    setIfDefined(sheet, PROTOCOL_INPUT_CELLS.totalPartsProduced, safeNum(p.totalPartsProduced));
    setIfDefined(sheet, PROTOCOL_INPUT_CELLS.reworkParts, safeNum(p.reworkParts));
    setIfDefined(sheet, PROTOCOL_INPUT_CELLS.rejectParts, safeNum(p.rejectParts));
    sheet.cell(PROTOCOL_INPUT_CELLS.methodOneActive).value(p.includeAvailability ? 'x' : '');
    sheet.cell(PROTOCOL_INPUT_CELLS.methodTwoActive).value(p.includeAvailability ? '' : 'x');
}

function applyPCA1(wb: any, p: ProtocolSFN1 | undefined): void {
    if (!p) return;
    const sheet = wb.sheet('Acc. certificate PCA1 pre-check');
    setIfDefined(sheet, PCA1_INPUT_CELLS.nominatedWeekly, safeNum(p.nominatedWeekly));
    setIfDefined(sheet, PCA1_INPUT_CELLS.capacityVwGroupPct, safeNum(p.capacityVwGroupPct, 1));
    setIfDefined(sheet, PCA1_INPUT_CELLS.capacityFamilyPct, safeNum(p.capacityFamilyPct));
    setIfDefined(sheet, PCA1_INPUT_CELLS.plannedOEE, safeNum(p.plannedOEE, 0.85));
    setIfDefined(sheet, PCA1_INPUT_CELLS.parallelLines, safeNum(p.parallelLines, 1));
    setIfDefined(sheet, PCA1_INPUT_CELLS.minPerShift, safeNum(p.minPerShift));
    setIfDefined(sheet, PCA1_INPUT_CELLS.cycleTimeMinPiece, safeNum(p.cycleTimeMinPiece));
    setIfDefined(sheet, PCA1_INPUT_CELLS.rejectRate, safeNum(p.rejectRate));
    setIfDefined(sheet, PCA1_INPUT_CELLS.shiftsPerWeek, safeNum(p.shiftsPerWeek, 15));
    setIfDefined(sheet, PCA1_INPUT_CELLS.maxShiftsPerWeek, safeNum(p.maxShiftsPerWeek, 17));
    setIfDefined(sheet, PCA1_INPUT_CELLS.linesInAcceptance, safeNum(p.linesInAcceptance, 1));
    setIfDefined(sheet, PCA1_INPUT_CELLS.acceptanceDurationMin, safeNum(p.acceptanceDurationMin));
    setIfDefined(sheet, PCA1_INPUT_CELLS.totalPartsProduced, safeNum(p.totalPartsProduced));
    setIfDefined(sheet, PCA1_INPUT_CELLS.reworkParts, safeNum(p.reworkParts));
    setIfDefined(sheet, PCA1_INPUT_CELLS.rejectParts, safeNum(p.rejectParts));
    sheet.cell(PCA1_INPUT_CELLS.methodActive).value(p.includeAvailability ? 'x' : '');
}

// ============================================================================
// CONSTRUCCION DEL WORKBOOK
// ============================================================================

async function buildWorkbook(project: Gate3Project): Promise<any> {
    const buf = await loadTemplateBuffer();
    // Clonamos el ArrayBuffer para que el cache no se consuma destructivamente
    const cloned = buf.slice(0);
    const wb = await XlsxPopulate.fromDataAsync(cloned);

    applyHeader(wb, project);

    const oee = wb.sheet('OEE CalculatorSFN');
    const cap = wb.sheet('CapacitySFN');
    const stationsToUse = project.stations.slice(0, GATE3_MAX_STATIONS);
    stationsToUse.forEach((s, idx) => applyStation(oee, cap, idx + 1, s));
    // Limpiar las estaciones no cargadas (template trae demo: Mesa de corte, Costura, etc.)
    for (let n = stationsToUse.length + 1; n <= GATE3_MAX_STATIONS; n++) {
        clearStation(oee, cap, n);
    }

    applyProtocol(wb, project.protocol);
    applyPCA1(wb, project.pca1);
    return wb;
}

// ============================================================================
// API PUBLICA
// ============================================================================

export async function exportGate3Excel(project: Gate3Project, fileName?: string): Promise<void> {
    const wb = await buildWorkbook(project);
    const blob = await wb.outputAsync('blob');
    const name = fileName ?? `Gate3_VW_${sanitize(project.partNumber || project.partDesignation)}.xlsx`;
    triggerDownload(blob, name);
}

export async function generateGate3Buffer(project: Gate3Project): Promise<Uint8Array> {
    const wb = await buildWorkbook(project);
    const arr: ArrayBuffer = await wb.outputAsync('arraybuffer');
    return new Uint8Array(arr);
}

function triggerDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 5s en lugar de 1.5s — Safari iOS necesita mas tiempo para grandes blobs
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Crea una estacion vacia. Util para inicializar adapters/UI. */
export function createEmptyStation(id: string, name: string = ''): Gate3Station {
    return {
        id,
        name,
        processType: 'general',
        observationTimeMin: 0,
        cycleTimeSec: 0,
        cavities: 1,
        downtimeMin: 0,
        okParts: 0,
        nokParts: 0,
        shiftsPerWeek: 15,
        hoursPerShift: 8,
        reservationPct: 1,
        machines: 1,
    };
}
