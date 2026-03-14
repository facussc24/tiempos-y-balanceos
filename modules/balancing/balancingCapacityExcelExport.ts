/**
 * Balancing Capacity Excel Export — "Capacidad de Producción por Proceso"
 *
 * ExcelJS-based export matching Barack's real production capacity template.
 * Features:
 *   - One sheet per sector (or single "General" sheet)
 *   - Header with logo, company info, project data
 *   - Production params (vehicle volume, pcs/vehicle, demand, shifts)
 *   - Process table with LIVE FORMULAS (Cap/hora, Prod Diaria, Capacidad%, Dotación)
 *   - Blue font = editable inputs (Ciclo, OEE)
 *   - Summary: total operators/day, operators/turno
 */

import ExcelJS from 'exceljs';
import { ProjectData, Task, Sector } from '../../types';
import { getLogoBase64 } from '../../src/assets/ppe/ppeBase64';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { downloadExcelJSWorkbook } from '../../utils/excel';
import {
    calculateTaktTime,
    calculateShiftNetMinutes,
    calculateEffectiveStationTime,
    calculateStationOEE,
    calculateSectorTaktTime,
} from '../../core/balancing/simulation';
import { renderCapacityBarChart, CapacityBarData } from './capacityBarChart';

// ============================================================================
// TYPES
// ============================================================================

interface StationRow {
    id: number;
    description: string;
    sectorName: string;
    tipo: string;
    cycleTimeSeconds: number;
    oee: number;
    requiredDaily: number;
    machineTime: number;
    replicas: number;
    isInjection: boolean;
    injectionNote?: string;
    // FIX: Per-station available time (respects sector shift overrides)
    totalAvailableSeconds: number;
    shiftNetMinutes: number;
}

// ============================================================================
// COLORS
// ============================================================================

const C = {
    HEADER_BG: 'FF1E3A5F',
    HEADER_FG: 'FFFFFFFF',
    PARAM_LABEL: 'FF475569',
    PARAM_VALUE: 'FF1E3A5F',
    PARAM_BG: 'FFF1F5F9',
    INPUT_FG: 'FF0000FF',     // Blue = editable
    OK_BG: 'FFDCFCE7',
    OK_FG: 'FF166534',
    DEFICIT_BG: 'FFFECACA',
    DEFICIT_FG: 'FF991B1B',
    ROW_EVEN: 'FFFFFFFF',
    ROW_ODD: 'FFF8FAFC',
    BORDER: 'FFE2E8F0',
    INJ_BG: 'FFFEF3C7',
    INJ_FG: 'FF92400E',
    SUMMARY_BG: 'FF1E3A5F',
    WHITE: 'FFFFFFFF',
    BLACK: 'FF000000',
};

// ============================================================================
// STYLE HELPERS
// ============================================================================

const FN = 'Calibri';
const THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: C.BORDER } };
const B_ALL: Partial<ExcelJS.Borders> = { top: THIN, bottom: THIN, left: THIN, right: THIN };

function fl(argb: string): ExcelJS.Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}
function ft(sz: number, bold = false, color?: string): Partial<ExcelJS.Font> {
    const f: Partial<ExcelJS.Font> = { name: FN, size: sz, bold };
    if (color) f.color = { argb: color };
    return f;
}
const AC: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };
const AL: Partial<ExcelJS.Alignment> = { vertical: 'middle' };
const AR: Partial<ExcelJS.Alignment> = { horizontal: 'right', vertical: 'middle' };

function sc(ws: ExcelJS.Worksheet, r: number, c: number, v: string | number | null, s?: Partial<ExcelJS.Style>) {
    const cell = ws.getCell(r, c);
    if (v === null || v === undefined) cell.value = '';
    else if (typeof v === 'string') cell.value = sanitizeCellValue(v) as string;
    else cell.value = v;
    if (s) Object.assign(cell.style, s);
    return cell;
}

function sf(ws: ExcelJS.Worksheet, r: number, c: number, formula: string, s?: Partial<ExcelJS.Style>) {
    const cell = ws.getCell(r, c);
    cell.value = { formula };
    if (s) Object.assign(cell.style, s);
    return cell;
}

function colL(col: number): string {
    let result = ''; let n = col - 1;
    while (n >= 0) { result = String.fromCharCode((n % 26) + 65) + result; n = Math.floor(n / 26) - 1; }
    return result;
}

function applyBorders(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            ws.getCell(r, c).border = B_ALL;
        }
    }
}

function sanitizeSheetName(name: string): string {
    return name.replace(/[[\]:*?/\\]/g, '').substring(0, 31) || 'Hoja';
}

function stripDataUri(d: string): string { const i = d.indexOf(','); return i >= 0 ? d.substring(i + 1) : d; }
function getExt(d: string): 'png' | 'jpeg' { return d.includes('image/jpeg') ? 'jpeg' : 'png'; }

// ============================================================================
// STATION ROWS BUILDER
// ============================================================================

function buildStationRows(data: ProjectData, sectorFilter?: string): StationRow[] {
    // FIX: Filter out NaN stationIds to prevent Math.max from returning NaN
    const validStationIds = data.assignments.map(a => a.stationId).filter(Number.isFinite);
    const maxA = validStationIds.length > 0 ? Math.max(...validStationIds) : 0;
    const count = Math.max(maxA, data.meta.configuredStations || 1);
    const cfgMap = new Map(data.stationConfigs?.map(c => [c.id, c]) ?? []);
    const tMap = new Map(data.tasks.map(t => [t.id, t]));

    // Global available time (default for stations without sector shift override)
    const globalOee = data.meta.useSectorOEE ? 1 : data.meta.manualOEE;
    const globalTakt = calculateTaktTime(
        data.shifts, data.meta.activeShifts, data.meta.dailyDemand || 0, globalOee,
        data.meta.setupLossPercent || 0
    );
    const globalAvailSeconds = globalTakt.totalAvailableMinutes * 60;
    const globalShiftNetMin = data.shifts
        .filter((_, i) => i < data.meta.activeShifts)
        .reduce((sum, s) => sum + calculateShiftNetMinutes(s), 0);

    const rows: StationRow[] = [];

    for (let i = 1; i <= count; i++) {
        const tasks = data.assignments
            .filter(a => a.stationId === i)
            .map(a => tMap.get(a.taskId))
            .filter(Boolean) as Task[];

        if (tasks.length === 0) continue;

        const sectorId = tasks[0]?.sectorId;

        // Filter by sector if specified
        if (sectorFilter) {
            if (sectorFilter === 'general') {
                if (sectorId) continue;
            } else {
                if (sectorId !== sectorFilter) continue;
            }
        }

        const cfg = cfgMap.get(i);
        const replicas = cfg?.replicas && cfg.replicas > 0 ? cfg.replicas : 1;
        let effectiveTime = calculateEffectiveStationTime(tasks);
        // B2: Guard effectiveTime NaN/negative — clamp to 0 (keep station visible)
        if (!Number.isFinite(effectiveTime) || effectiveTime < 0) effectiveTime = 0;
        const cycleTime = replicas > 0 ? effectiveTime / replicas : 0;
        // B3: Clamp OEE to [0, 1] range
        const rawOee = calculateStationOEE(data, i, sectorId);
        const oee = Math.max(0, Math.min(1, Number.isFinite(rawOee) ? rawOee : 0.85));

        const sector = sectorId ? data.sectors?.find(s => s.id === sectorId) : undefined;
        const sectorName = sector?.name || 'General';

        const taskDescs = tasks.slice(0, 3).map(t => t.description || t.id);
        const description = taskDescs.join(', ') + (tasks.length > 3 ? '...' : '');

        const injTask = tasks.find(t => t.executionMode === 'injection');
        const isInjection = !!injTask;
        let injectionNote: string | undefined;
        if (injTask?.injectionParams) {
            const ip = injTask.injectionParams;
            injectionNote = `Inyección PU: t_iny=${(ip.pInyectionTime || 0).toFixed(1)}s, t_cur=${(ip.pCuringTime || 0).toFixed(1)}s`;
        }

        const machineTime = tasks
            .filter(t => t.executionMode === 'machine' || t.executionMode === 'injection')
            .reduce((sum, t) => sum + (t.standardTime || t.averageTime || 0), 0);

        // FIX: Per-station available time (respects sector shift overrides)
        let stationAvailSeconds = globalAvailSeconds;
        let stationShiftNetMin = globalShiftNetMin;
        if (sector?.shiftOverride) {
            const sectorOee = (data.meta.useSectorOEE && sector.targetOee && sector.targetOee > 0)
                ? sector.targetOee : globalOee;
            const sectorTakt = calculateSectorTaktTime(
                sector, data.shifts, Math.min(data.meta.activeShifts, data.shifts.length),
                data.meta.dailyDemand || 0, sectorOee, data.meta.setupLossPercent || 0
            );
            stationAvailSeconds = sectorTakt.totalAvailableMinutes * 60;
            stationShiftNetMin = sectorTakt.totalAvailableMinutes;
        }

        rows.push({
            id: i,
            description,
            sectorName,
            tipo: 'Interno',
            cycleTimeSeconds: cycleTime,
            oee,
            requiredDaily: data.meta.dailyDemand || 0,
            machineTime,
            replicas,
            isInjection,
            injectionNote,
            totalAvailableSeconds: stationAvailSeconds,
            shiftNetMinutes: stationShiftNetMin,
        });
    }

    return rows;
}

// ============================================================================
// BUILD SHEET
// ============================================================================

async function buildSheet(
    wb: ExcelJS.Workbook,
    ws: ExcelJS.Worksheet,
    data: ProjectData,
    stationRows: StationRow[],
    sheetTitle: string,
    logoId?: number,
    sectorOverride?: Sector,
): Promise<void> {
    // B4: Clamp piecesPerVehicle ≥ 1 to prevent division by zero.
    // FIX: Use Number.isFinite instead of ?? — nullish coalescing does NOT catch NaN,
    // so Math.max(1, NaN) would still return NaN and corrupt all capacity calculations.
    const rawPpv = data.meta.piecesPerVehicle;
    const ppv = Math.max(1, Number.isFinite(rawPpv) && rawPpv > 0 ? rawPpv : 1);
    const dailyDemand = data.meta.dailyDemand || 0;
    const vehicleDemand = ppv > 0 ? Math.round(dailyDemand / ppv) : dailyDemand;
    const weeklyDemand = dailyDemand * 5;

    const oee = data.meta.useSectorOEE ? 1 : data.meta.manualOEE;

    // FIX: Use sector-specific shift count and available time when sector has shift override
    let displayShifts = data.meta.activeShifts;
    let totalAvailableMinutes: number;

    if (sectorOverride?.shiftOverride) {
        displayShifts = sectorOverride.shiftOverride.activeShifts;
        const sectorOee = (data.meta.useSectorOEE && sectorOverride.targetOee && sectorOverride.targetOee > 0)
            ? sectorOverride.targetOee : oee;
        const sectorTakt = calculateSectorTaktTime(
            sectorOverride, data.shifts, Math.min(data.meta.activeShifts, data.shifts.length),
            dailyDemand, sectorOee, data.meta.setupLossPercent || 0
        );
        totalAvailableMinutes = sectorTakt.totalAvailableMinutes;
    } else {
        const globalTakt = calculateTaktTime(
            data.shifts, data.meta.activeShifts, dailyDemand, oee,
            data.meta.setupLossPercent || 0
        );
        totalAvailableMinutes = globalTakt.totalAvailableMinutes;
    }

    const totalAvailableSeconds = totalAvailableMinutes * 60;
    const shiftNetMinutes = data.shifts
        .filter((_, i) => i < displayShifts)
        .reduce((sum, s) => sum + calculateShiftNetMinutes(s), 0);

    // Layout: Column A and Row 1 are empty padding for a clean Excel look
    const CO = 1; // Column offset — all data starts at column B (index 2)

    // Column widths: A=pad(2), B=Nro(6), C=Desc(35), D=Sector(14), E=Tipo(9),
    //   F=Ciclo(11), G=Cap/h(10), H=OEE(9), I=Estado(10), J=PzsReq(13),
    //   K=ProdDia(13), L=Cap%(11), M=Dotación(11), N=Ops(7), O=TMaq(10)
    ws.columns = [
        { width: 2 },  // A: empty padding
        { width: 6 },  // B: Nro
        { width: 35 }, // C: Descripción
        { width: 14 }, // D: Sector
        { width: 9 },  // E: Int/Ext
        { width: 11 }, // F: Ciclo (s) — editable
        { width: 10 }, // G: Cap/hora (formula)
        { width: 9 },  // H: OEE % — editable
        { width: 10 }, // I: Estado
        { width: 13 }, // J: Pzs Req/Día
        { width: 13 }, // K: Prod Diaria (formula)
        { width: 11 }, // L: Capacidad% (formula)
        { width: 11 }, // M: Dotación (formula)
        { width: 7 },  // N: Operadores
        { width: 10 }, // O: T.Máquina
    ];

    let row = 2; // Row 1 is empty padding

    // ---- HEADER ----
    // Logo area (white background) — first 2 data columns
    sc(ws, row, 1 + CO, '', { fill: fl(C.WHITE) });
    sc(ws, row, 2 + CO, '', { fill: fl(C.WHITE) });
    // Title area (navy background)
    ws.mergeCells(row, 3 + CO, row, 14 + CO);
    sc(ws, row, 3 + CO, 'CAPACIDAD DE PRODUCCIÓN POR PROCESO', {
        font: ft(14, true, C.HEADER_FG),
        fill: fl(C.HEADER_BG),
        alignment: AC,
    });
    ws.getRow(row).height = 30;

    // Logo — placed on white background area
    if (logoId !== undefined) {
        ws.addImage(logoId, {
            tl: { col: CO, row: row - 1 },
            ext: { width: 100, height: 28 },
        });
    }

    row++;
    ws.mergeCells(row, 1 + CO, row, 14 + CO);
    sc(ws, row, 1 + CO, `${data.meta.name || ''} — ${data.meta.client || ''}`, {
        font: ft(10, false, C.PARAM_LABEL),
        alignment: AC,
    });

    row++;
    // Date + Rev
    ws.mergeCells(row, 1 + CO, row, 7 + CO);
    sc(ws, row, 1 + CO, `Fecha: ${data.meta.date}`, { font: ft(9, false, C.PARAM_LABEL), alignment: AL });
    ws.mergeCells(row, 8 + CO, row, 14 + CO);
    sc(ws, row, 8 + CO, `Rev: ${data.meta.version}`, { font: ft(9, false, C.PARAM_LABEL), alignment: AR });

    row += 2; // Skip a row before params

    // ---- PRODUCTION PARAMS ----
    const paramStyle = { font: ft(9, true, C.PARAM_LABEL), fill: fl(C.PARAM_BG), border: B_ALL, alignment: AL };
    const paramValueStyle = { font: ft(9, true, C.PARAM_VALUE), border: B_ALL, alignment: AC as Partial<ExcelJS.Alignment> };

    ws.mergeCells(row, 1 + CO, row, 3 + CO);
    sc(ws, row, 1 + CO, 'Volumen vehículos diario', paramStyle);
    sc(ws, row, 4 + CO, vehicleDemand, paramValueStyle);
    ws.mergeCells(row, 5 + CO, row, 7 + CO);
    sc(ws, row, 5 + CO, 'Cantidad de turnos', paramStyle);
    sc(ws, row, 8 + CO, displayShifts, paramValueStyle);

    row++;
    ws.mergeCells(row, 1 + CO, row, 3 + CO);
    sc(ws, row, 1 + CO, 'Piezas necesarias por vehículo', paramStyle);
    sc(ws, row, 4 + CO, ppv, paramValueStyle);
    ws.mergeCells(row, 5 + CO, row, 7 + CO);
    sc(ws, row, 5 + CO, 'Minutos netos disp./día', paramStyle);
    sc(ws, row, 8 + CO, Math.round(totalAvailableMinutes), paramValueStyle);

    row++;
    ws.mergeCells(row, 1 + CO, row, 3 + CO);
    sc(ws, row, 1 + CO, 'Piezas necesarias para producción', paramStyle);
    sc(ws, row, 4 + CO, dailyDemand, paramValueStyle);
    ws.mergeCells(row, 5 + CO, row, 7 + CO);
    sc(ws, row, 5 + CO, 'OEE Global', paramStyle);
    // B1: Guard manualOEE undefined/NaN
    sc(ws, row, 8 + CO, data.meta.manualOEE ?? 0.85, { ...paramValueStyle, numFmt: '0.0%' });

    row++;
    ws.mergeCells(row, 1 + CO, row, 3 + CO);
    sc(ws, row, 1 + CO, 'Demanda semanal (Pcs)', paramStyle);
    sc(ws, row, 4 + CO, weeklyDemand, paramValueStyle);

    row += 2; // Skip a row before table

    // ---- TABLE HEADER ----
    const headerRow = row;
    const headers = ['Nro', 'Descripción del Proceso', 'Sector', 'Int/Ext', 'Ciclo (s)', 'Cap/hora', 'OEE %', 'Estado', 'Pzs Req/Día', 'Prod Diaria', 'Capacidad %', 'Dotación', 'Ops', 'T.Máq (s)'];
    headers.forEach((h, i) => {
        sc(ws, row, i + 1 + CO, h, {
            font: ft(9, true, C.HEADER_FG),
            fill: fl(C.HEADER_BG),
            alignment: AC,
            border: B_ALL,
        });
    });
    ws.getRow(row).height = 22;

    row++;

    // ---- DATA ROWS WITH FORMULAS ----
    const dataStartRow = row;

    stationRows.forEach((st, idx) => {
        const bgColor = idx % 2 === 0 ? C.ROW_EVEN : C.ROW_ODD;
        const baseStyle: Partial<ExcelJS.Style> = { font: ft(9), fill: fl(bgColor), border: B_ALL, alignment: AC };
        const leftStyle: Partial<ExcelJS.Style> = { font: ft(9), fill: fl(bgColor), border: B_ALL, alignment: AL };
        const editStyle: Partial<ExcelJS.Style> = { font: ft(9, true, C.INPUT_FG), fill: fl(bgColor), border: B_ALL, alignment: AC };

        const r = row;
        // FIX: Per-station available seconds and shift net minutes (respects sector shift overrides)
        const availSecondsStr = st.totalAvailableSeconds.toString();
        const shiftNetMinStr = st.shiftNetMinutes.toString();
        // Column letters (with offset): F=Ciclo, H=OEE, J=PzsReq, K=ProdDiaria, M=Dotación
        const eCol = colL(5 + CO); // F = Ciclo
        const gCol = colL(7 + CO); // H = OEE
        const iCol = colL(9 + CO); // J = Pzs Req
        const jCol = colL(10 + CO); // K = Prod Diaria

        // B: Nro
        sc(ws, r, 1 + CO, st.id, { ...baseStyle, font: ft(9, true) });
        // C: Descripción
        sc(ws, r, 2 + CO, st.description, leftStyle);
        // D: Sector
        sc(ws, r, 3 + CO, st.sectorName, baseStyle);
        // E: Int/Ext
        sc(ws, r, 4 + CO, st.tipo, baseStyle);
        // F: Ciclo (s) — EDITABLE (blue)
        sc(ws, r, 5 + CO, Math.round(st.cycleTimeSeconds * 100) / 100, editStyle);
        // G: Cap/hora = 3600 / F{r}
        sf(ws, r, 6 + CO, `IF(${eCol}${r}>0,3600/${eCol}${r},0)`, { ...baseStyle, numFmt: '#,##0' });
        // H: OEE % — EDITABLE (blue)
        sc(ws, r, 7 + CO, st.oee, { ...editStyle, numFmt: '0.0%' });
        // I: Estado (conditional — done via value)
        const prodDaily = st.cycleTimeSeconds > 0 ? st.totalAvailableSeconds / st.cycleTimeSeconds : 0;
        const isOk = prodDaily >= dailyDemand;
        sc(ws, r, 8 + CO, isOk ? 'OK' : 'DEFICIT', {
            font: ft(9, true, isOk ? C.OK_FG : C.DEFICIT_FG),
            fill: fl(isOk ? C.OK_BG : C.DEFICIT_BG),
            border: B_ALL,
            alignment: AC,
        });
        // J: Pzs Requeridas/Día
        sc(ws, r, 9 + CO, dailyDemand, baseStyle);
        // K: Producción Diaria = availSeconds / Ciclo (per-station available seconds)
        sf(ws, r, 10 + CO, `IF(${eCol}${r}>0,${availSecondsStr}/${eCol}${r},0)`, { ...baseStyle, numFmt: '#,##0', font: ft(9, true) });
        // L: Capacidad% = Prod Diaria / Pzs Req
        sf(ws, r, 11 + CO, `IF(${iCol}${r}>0,${jCol}${r}/${iCol}${r},0)`, { ...baseStyle, numFmt: '0.0%', font: ft(9, true) });
        // M: Dotación = (Ciclo_min × Demand) / shiftNetMinutes (per-station)
        sf(ws, r, 12 + CO, `IF(${shiftNetMinStr}>0,(${eCol}${r}/60)*${iCol}${r}/${shiftNetMinStr},0)`, { ...baseStyle, numFmt: '0.00' });
        // N: Operadores = ROUNDUP(Dotación)
        sf(ws, r, 13 + CO, `ROUNDUP(${colL(12 + CO)}${r},0)`, { ...baseStyle, font: ft(9, true) });
        // O: T.Máquina
        sc(ws, r, 14 + CO, st.machineTime > 0 ? Math.round(st.machineTime * 100) / 100 : '', baseStyle);

        row++;

        // Injection note row
        if (st.injectionNote) {
            sc(ws, row, 1 + CO, '', { fill: fl(C.INJ_BG), border: B_ALL });
            ws.mergeCells(row, 2 + CO, row, 14 + CO);
            sc(ws, row, 2 + CO, st.injectionNote, {
                font: ft(8, false, C.INJ_FG),
                fill: fl(C.INJ_BG),
                border: B_ALL,
                alignment: AL,
            });
            row++;
        }
    });

    const dataEndRow = row - 1;
    // FIX: Guard against empty data producing invalid range (dataStartRow > dataEndRow)
    const hasDataRows = dataEndRow >= dataStartRow;

    // ---- SUMMARY ----
    row += 1;
    ws.mergeCells(row, 1 + CO, row, 3 + CO);
    sc(ws, row, 1 + CO, 'RESUMEN', {
        font: ft(10, true, C.HEADER_FG),
        fill: fl(C.SUMMARY_BG),
        alignment: AC,
        border: B_ALL,
    });
    ws.getRow(row).height = 22;

    row++;
    ws.mergeCells(row, 1 + CO, row, 2 + CO);
    sc(ws, row, 1 + CO, 'Total Dotación (operadores/día)', { font: ft(9, true, C.PARAM_LABEL), fill: fl(C.PARAM_BG), border: B_ALL, alignment: AL });
    // Sum of Dotación column (col M = 12 + CO = 13)
    sf(ws, row, 3 + CO, hasDataRows ? `ROUNDUP(SUM(${colL(12 + CO)}${dataStartRow}:${colL(12 + CO)}${dataEndRow}),0)` : '0', {
        font: ft(10, true, C.PARAM_VALUE),
        border: B_ALL,
        alignment: AC,
    });

    row++;
    ws.mergeCells(row, 1 + CO, row, 2 + CO);
    sc(ws, row, 1 + CO, 'Operadores por turno', { font: ft(9, true, C.PARAM_LABEL), fill: fl(C.PARAM_BG), border: B_ALL, alignment: AL });
    // B6: Guard activeShifts — prevent division by zero in ROUNDUP formula
    const safeShifts = Math.max(1, displayShifts || 1);
    sf(ws, row, 3 + CO, `ROUNDUP(${colL(3 + CO)}${row - 1}/${safeShifts},0)`, {
        font: ft(10, true, C.PARAM_VALUE),
        border: B_ALL,
        alignment: AC,
    });

    row++;
    ws.mergeCells(row, 1 + CO, row, 2 + CO);
    sc(ws, row, 1 + CO, 'Procesos analizados', { font: ft(9, true, C.PARAM_LABEL), fill: fl(C.PARAM_BG), border: B_ALL, alignment: AL });
    sc(ws, row, 3 + CO, stationRows.length, { font: ft(10, true, C.PARAM_VALUE), border: B_ALL, alignment: AC });

    // ---- BAR CHART IMAGE ----
    // Chart is optional — if Canvas API is unavailable (e.g. Node without canvas), skip
    try {
        const chartData: CapacityBarData[] = stationRows.map(st => ({
            label: String(st.id),
            required: st.requiredDaily,
            production: st.cycleTimeSeconds > 0 ? st.totalAvailableSeconds / st.cycleTimeSeconds : 0,
        }));
        if (chartData.length > 0) {
            const chartBase64 = await renderCapacityBarChart(chartData, { width: 900, height: 320 });
            if (chartBase64) {
                row += 2;
                const imgId = wb.addImage({ base64: chartBase64, extension: 'png' });
                ws.addImage(imgId, {
                    tl: { col: CO, row: row - 1 },
                    ext: { width: 900, height: 320 },
                });
                row += 17; // Reserve ~17 rows for the chart image
            }
        }
    } catch { /* Chart is optional — if Canvas not available, skip silently */ }

    // Print settings
    ws.pageSetup = {
        orientation: 'landscape',
        paperSize: 9, // A4
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
    };
}

// ============================================================================
// EXPORT FUNCTION
// ============================================================================

export async function exportBalancingCapacityExcel(data: ProjectData): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Barack Mercosul';
    wb.created = new Date();

    // Load logo
    let logoId: number | undefined;
    try {
        const logoBase64 = await getLogoBase64();
        if (logoBase64) {
            logoId = wb.addImage({
                base64: stripDataUri(logoBase64),
                extension: getExt(logoBase64),
            });
        }
    } catch { /* logo optional */ }

    // Determine sectors with stations
    const sectorIds = new Set<string>();
    const tMap = new Map(data.tasks.map(t => [t.id, t]));
    data.assignments.forEach(a => {
        const task = tMap.get(a.taskId);
        if (task?.sectorId) sectorIds.add(task.sectorId);
    });
    // Check for tasks without sector
    const hasGeneral = data.assignments.some(a => {
        const task = tMap.get(a.taskId);
        return !task?.sectorId;
    });

    const sectors = (data.sectors || []).filter(s => sectorIds.has(s.id));
    const useSingleSheet = sectors.length <= 1 && !hasGeneral;

    if (useSingleSheet || sectors.length === 0) {
        // Single sheet — pass sector override if exactly one sector with shift override
        const allRows = buildStationRows(data);
        const sheetName = sectors.length === 1 ? sanitizeSheetName(sectors[0].name) : 'General';
        const ws = wb.addWorksheet(sheetName);
        const singleSector = sectors.length === 1 ? sectors[0] : undefined;
        await buildSheet(wb, ws, data, allRows, sheetName, logoId, singleSector);
    } else {
        // Multi-sheet: one per sector + optional General
        for (const sector of sectors) {
            const rows = buildStationRows(data, sector.id);
            if (rows.length === 0) continue;
            const ws = wb.addWorksheet(sanitizeSheetName(sector.name));
            await buildSheet(wb, ws, data, rows, sector.name, logoId, sector);
        }
        if (hasGeneral) {
            const rows = buildStationRows(data, 'general');
            if (rows.length > 0) {
                const ws = wb.addWorksheet('General');
                await buildSheet(wb, ws, data, rows, 'General', logoId);
            }
        }
    }

    // B5: Sanitize filename to prevent filesystem issues
    const fileName = `${sanitizeFilename(data.meta.name || 'Capacidad')}_Capacidad_Proceso.xlsx`;
    await downloadExcelJSWorkbook(wb, fileName);
}

/**
 * Generate balancing capacity Excel as Uint8Array buffer (for auto-export).
 * Builds the same workbook as exportBalancingCapacityExcel but returns buffer.
 */
export async function generateBalancingBuffer(data: ProjectData): Promise<Uint8Array> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Barack Mercosul';
    wb.created = new Date();

    let logoId: number | undefined;
    try {
        const logoBase64 = await getLogoBase64();
        if (logoBase64) {
            logoId = wb.addImage({
                base64: stripDataUri(logoBase64),
                extension: getExt(logoBase64),
            });
        }
    } catch { /* logo optional */ }

    const sectorIds = new Set<string>();
    const tMap = new Map(data.tasks.map(t => [t.id, t]));
    data.assignments.forEach(a => {
        const task = tMap.get(a.taskId);
        if (task?.sectorId) sectorIds.add(task.sectorId);
    });
    const hasGeneral = data.assignments.some(a => {
        const task = tMap.get(a.taskId);
        return !task?.sectorId;
    });

    const sectors = (data.sectors || []).filter(s => sectorIds.has(s.id));
    const useSingleSheet = sectors.length <= 1 && !hasGeneral;

    if (useSingleSheet || sectors.length === 0) {
        const allRows = buildStationRows(data);
        const sheetName = sectors.length === 1 ? sanitizeSheetName(sectors[0].name) : 'General';
        const ws = wb.addWorksheet(sheetName);
        const singleSector = sectors.length === 1 ? sectors[0] : undefined;
        await buildSheet(wb, ws, data, allRows, sheetName, logoId, singleSector);
    } else {
        for (const sector of sectors) {
            const rows = buildStationRows(data, sector.id);
            if (rows.length === 0) continue;
            const ws = wb.addWorksheet(sanitizeSheetName(sector.name));
            await buildSheet(wb, ws, data, rows, sector.name, logoId, sector);
        }
        if (hasGeneral) {
            const rows = buildStationRows(data, 'general');
            if (rows.length > 0) {
                const ws = wb.addWorksheet('General');
                await buildSheet(wb, ws, data, rows, 'General', logoId);
            }
        }
    }

    const buffer = await wb.xlsx.writeBuffer();
    return new Uint8Array(buffer as ArrayBuffer);
}
