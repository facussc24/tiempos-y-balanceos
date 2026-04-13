/**
 * 8D Report Excel Export — Barack Mercosul official format
 *
 * Replicates the exact company template: 19 columns (A-S), 2 sheets.
 * Sheet 1: "8D" with all D1-D8 sections in fixed cell positions.
 * Sheet 2: "Evidencias de Acciones" (blank evidence sheet).
 */

import XLSX from 'xlsx-js-style';
import { downloadWorkbook } from '../../utils/excel';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';
import type { EightDReport } from './eightDTypes';
import { logger } from '../../utils/logger';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Total columns A-S = 19 */
const NUM_COLS = 19;

/** Column indices */
const COL = {
    A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8,
    J: 9, K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18,
};

// ============================================================================
// STYLES
// ============================================================================

const THIN_BORDER = {
    top: { style: 'thin' as const, color: { rgb: '000000' } },
    bottom: { style: 'thin' as const, color: { rgb: '000000' } },
    left: { style: 'thin' as const, color: { rgb: '000000' } },
    right: { style: 'thin' as const, color: { rgb: '000000' } },
};

const BLUE_HEADER_BG = { rgb: '4472C4' };
const WHITE_FONT_RGB = 'FFFFFF';

const S = {
    /** Blue section header: white bold text on blue */
    sectionHeader: {
        font: { bold: true, sz: 11, name: 'Calibri', color: { rgb: WHITE_FONT_RGB } },
        fill: { fgColor: BLUE_HEADER_BG, patternType: 'solid' as const },
        alignment: { horizontal: 'left' as const, vertical: 'center' as const, wrapText: true },
        border: THIN_BORDER,
    },
    /** Blue section header centered */
    sectionHeaderCenter: {
        font: { bold: true, sz: 11, name: 'Calibri', color: { rgb: WHITE_FONT_RGB } },
        fill: { fgColor: BLUE_HEADER_BG, patternType: 'solid' as const },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
        border: THIN_BORDER,
    },
    /** Logo area placeholder */
    logo: {
        font: { bold: true, sz: 14, name: 'Calibri' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
        border: THIN_BORDER,
    },
    /** Big centered title "Reporte 8.D" */
    bigTitle: {
        font: { bold: true, sz: 18, name: 'Calibri' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
        border: THIN_BORDER,
    },
    /** Small label (bold, left aligned) */
    label: {
        font: { bold: true, sz: 10, name: 'Calibri' },
        alignment: { horizontal: 'left' as const, vertical: 'center' as const, wrapText: true },
        border: THIN_BORDER,
    },
    /** Regular value cell */
    value: {
        font: { sz: 10, name: 'Calibri' },
        alignment: { horizontal: 'left' as const, vertical: 'center' as const, wrapText: true },
        border: THIN_BORDER,
    },
    /** Regular value cell, centered */
    valueCenter: {
        font: { sz: 10, name: 'Calibri' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
        border: THIN_BORDER,
    },
    /** Bold value */
    boldValue: {
        font: { bold: true, sz: 10, name: 'Calibri' },
        alignment: { horizontal: 'left' as const, vertical: 'center' as const, wrapText: true },
        border: THIN_BORDER,
    },
    /** Table column header (bold, centered, light blue fill) */
    tableHeader: {
        font: { bold: true, sz: 10, name: 'Calibri' },
        fill: { fgColor: { rgb: 'D6E4F0' }, patternType: 'solid' as const },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
        border: THIN_BORDER,
    },
    /** Empty cell with border */
    empty: {
        font: { sz: 10, name: 'Calibri' },
        border: THIN_BORDER,
    },
    /** Empty cell no border */
    emptyNoBorder: {
        font: { sz: 10, name: 'Calibri' },
    },
    /** Header info label (right-side Para/Fax/De/Tel) */
    headerLabel: {
        font: { bold: true, sz: 9, name: 'Calibri' },
        alignment: { horizontal: 'right' as const, vertical: 'center' as const },
        border: THIN_BORDER,
    },
    /** Header info value */
    headerValue: {
        font: { sz: 9, name: 'Calibri' },
        alignment: { horizontal: 'left' as const, vertical: 'center' as const },
        border: THIN_BORDER,
    },
    /** Por que label */
    whyLabel: {
        font: { bold: true, sz: 10, name: 'Calibri' },
        alignment: { horizontal: 'left' as const, vertical: 'center' as const, wrapText: true },
        border: THIN_BORDER,
    },
    /** Checkbox-style text */
    checkbox: {
        font: { sz: 10, name: 'Calibri' },
        alignment: { horizontal: 'left' as const, vertical: 'center' as const, wrapText: true },
        border: THIN_BORDER,
    },
};

// ============================================================================
// HELPERS
// ============================================================================

function sv(val: string | number | undefined | null): string | number {
    return sanitizeCellValue(val);
}

function mkCell(v: string | number | undefined | null, style: Record<string, unknown>) {
    return { v: sv(v), s: style };
}

function formatDate(iso: string): string {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return iso;
    }
}

/**
 * Build a blank row of NUM_COLS cells with a given style.
 */
function blankRow(style: Record<string, unknown> = S.empty): Record<string, unknown>[] {
    return Array.from({ length: NUM_COLS }, () => mkCell('', style));
}

/**
 * Set a cell value+style in a row array.
 */
function setCell(
    row: Record<string, unknown>[],
    col: number,
    value: string | number | undefined | null,
    style: Record<string, unknown> = S.value,
): void {
    row[col] = mkCell(value, style);
}

/**
 * Fill a range of cells in a row with the same style (useful after merges).
 */
function fillRange(
    row: Record<string, unknown>[],
    startCol: number,
    endCol: number,
    style: Record<string, unknown>,
): void {
    for (let c = startCol; c <= endCol; c++) {
        if (!row[c] || (row[c] as { v: unknown }).v === '') {
            row[c] = mkCell('', style);
        }
    }
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function exportEightDToExcel(report: EightDReport): Promise<void> {
    logger.info('8D Export', 'Starting Barack format Excel export', { reportNumber: report.reportNumber });

    const rows: Record<string, unknown>[][] = [];
    const merges: XLSX.Range[] = [];

    function addMerge(r1: number, c1: number, r2: number, c2: number): void {
        merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
    }

    // ========================================================================
    // ROWS 0-3: COMPANY HEADER (4 rows)
    // ========================================================================

    // Row 0
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, 'BARACK MERCOSUL', S.logo);
        fillRange(row, COL.A, COL.E, S.logo);
        setCell(row, COL.F, 'Reporte 8.D', S.bigTitle);
        fillRange(row, COL.F, COL.N, S.bigTitle);
        setCell(row, COL.O, 'Para:', S.headerLabel);
        setCell(row, COL.P, sv(report.d0.client || 'VW') as string, S.headerValue);
        fillRange(row, COL.P, COL.S, S.headerValue);
        rows.push(row);
    }
    addMerge(0, COL.A, 3, COL.E); // Logo area A1:E4
    addMerge(0, COL.F, 3, COL.N); // "Reporte 8.D" F1:N4
    addMerge(0, COL.P, 0, COL.S); // Client value

    // Row 1
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, '', S.logo);
        setCell(row, COL.F, '', S.bigTitle);
        setCell(row, COL.O, 'Fax:', S.headerLabel);
        setCell(row, COL.P, '', S.headerValue);
        fillRange(row, COL.P, COL.S, S.headerValue);
        rows.push(row);
    }
    addMerge(1, COL.P, 1, COL.S);

    // Row 2
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, '', S.logo);
        setCell(row, COL.F, '', S.bigTitle);
        setCell(row, COL.O, 'De:', S.headerLabel);
        setCell(row, COL.P, 'BARACK', S.headerValue);
        fillRange(row, COL.P, COL.S, S.headerValue);
        rows.push(row);
    }
    addMerge(2, COL.P, 2, COL.S);

    // Row 3
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, '', S.logo);
        setCell(row, COL.F, '', S.bigTitle);
        setCell(row, COL.O, 'Tel/Fax:', S.headerLabel);
        setCell(row, COL.P, '', S.headerValue);
        fillRange(row, COL.P, COL.S, S.headerValue);
        rows.push(row);
    }
    addMerge(3, COL.P, 3, COL.S);

    // ========================================================================
    // ROWS 4-6: REPORT INFO
    // ========================================================================

    // Row 4: Labels
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, 'Titulo del Pendiente:', S.label);
        fillRange(row, COL.A, COL.I, S.label);
        setCell(row, COL.J, 'N\u00B0 de Ref:', S.label);
        fillRange(row, COL.J, COL.M, S.label);
        setCell(row, COL.N, 'Fecha de Apertura:', S.label);
        fillRange(row, COL.N, COL.S, S.label);
        rows.push(row);
    }
    addMerge(4, COL.A, 4, COL.I);
    addMerge(4, COL.J, 4, COL.M);
    addMerge(4, COL.N, 4, COL.S);

    // Row 5: Values (title, ref, date)
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, report.title, S.value);
        fillRange(row, COL.A, COL.I, S.value);
        setCell(row, COL.J, report.reportNumber, S.value);
        fillRange(row, COL.J, COL.M, S.value);
        setCell(row, COL.N, formatDate(report.createdAt), S.value);
        fillRange(row, COL.N, COL.S, S.value);
        rows.push(row);
    }
    addMerge(5, COL.A, 6, COL.I); // Title merged 2 rows
    addMerge(5, COL.J, 5, COL.M);
    addMerge(5, COL.N, 6, COL.S); // Date merged 2 rows

    // Row 6: continuation of merged title/date
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, '', S.value);
        setCell(row, COL.J, '', S.value);
        setCell(row, COL.N, '', S.value);
        rows.push(row);
    }

    // ========================================================================
    // ROWS 7-9: VEHICLE / PART INFO
    // ========================================================================

    // Row 7: Vehiculo + Nombre de la Parte
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, 'Vehiculo:', S.label);
        fillRange(row, COL.A, COL.D, S.label);
        setCell(row, COL.E, report.d2.where || '', S.value);
        fillRange(row, COL.E, COL.I, S.value);
        setCell(row, COL.J, `Nombre de la Parte:          ${sv(report.d2.what || '')}`, S.value);
        fillRange(row, COL.J, COL.S, S.value);
        rows.push(row);
    }
    addMerge(7, COL.A, 7, COL.D);
    addMerge(7, COL.E, 7, COL.I);
    addMerge(7, COL.J, 8, COL.S); // Part name area merged 2 rows

    // Row 8: Modelo
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, 'Modelo:', S.label);
        fillRange(row, COL.A, COL.D, S.label);
        setCell(row, COL.E, '', S.value);
        fillRange(row, COL.E, COL.I, S.value);
        setCell(row, COL.J, '', S.value); // merged from above
        rows.push(row);
    }
    addMerge(8, COL.A, 8, COL.D);
    addMerge(8, COL.E, 8, COL.I);

    // Row 9: Planta + N de la Parte
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, 'Planta:', S.label);
        fillRange(row, COL.A, COL.D, S.label);
        setCell(row, COL.E, '', S.value);
        fillRange(row, COL.E, COL.I, S.value);
        setCell(row, COL.J, 'N\u00B0 de la Parte:', S.label);
        fillRange(row, COL.J, COL.N, S.label);
        setCell(row, COL.O, report.d2.partNumber, S.value);
        fillRange(row, COL.O, COL.S, S.value);
        rows.push(row);
    }
    addMerge(9, COL.A, 9, COL.D);
    addMerge(9, COL.E, 9, COL.I);
    addMerge(9, COL.J, 9, COL.N);
    addMerge(9, COL.O, 9, COL.S);

    // Row 10: spacer
    rows.push(blankRow(S.empty));

    // ========================================================================
    // ROWS 11-19: D1 + D2 (side by side)
    // ========================================================================

    // Row 11: Section headers D1 + D2
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, '1 - Miembros del Equipo', S.sectionHeader);
        fillRange(row, COL.A, COL.E, S.sectionHeader);
        setCell(row, COL.F, '2 - Descripcion del Problema', S.sectionHeader);
        fillRange(row, COL.F, COL.S, S.sectionHeader);
        rows.push(row);
    }
    addMerge(11, COL.A, 11, COL.E);
    addMerge(11, COL.F, 11, COL.S);

    // Rows 12-16: Team members (left) + Problem description (right)
    const memberLines = (report.d1.members || '').split(/[,;\n]/).map(m => m.trim()).filter(Boolean);
    for (let i = 0; i < 5; i++) {
        const row = blankRow(S.empty);
        setCell(row, COL.A, memberLines[i] || '', S.value);
        fillRange(row, COL.A, COL.E, S.value);
        if (i === 0) {
            setCell(row, COL.F, report.d2.what || '', S.value);
        } else {
            setCell(row, COL.F, '', S.value);
        }
        fillRange(row, COL.F, COL.L, S.value);
        setCell(row, COL.M, '', S.empty);
        fillRange(row, COL.M, COL.S, S.empty);
        rows.push(row);
    }
    addMerge(12, COL.A, 12, COL.E);
    addMerge(13, COL.A, 13, COL.E);
    addMerge(14, COL.A, 14, COL.E);
    addMerge(15, COL.A, 15, COL.E);
    addMerge(16, COL.A, 16, COL.E);
    addMerge(12, COL.F, 16, COL.L); // Problem description area
    addMerge(12, COL.M, 16, COL.S); // Right area (figure / image)

    // Row 17: FIGURA MODO DE FALLA EN AMFE? + SI/NO
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, '', S.empty);
        fillRange(row, COL.A, COL.E, S.empty);
        setCell(row, COL.F, '', S.empty);
        fillRange(row, COL.F, COL.L, S.empty);
        setCell(row, COL.M, 'FIGURA MODO DE FALLA EN AMFE?', S.label);
        fillRange(row, COL.M, COL.Q, S.label);
        setCell(row, COL.R, 'SI', S.valueCenter);
        setCell(row, COL.S, 'NO', S.valueCenter);
        rows.push(row);
    }
    addMerge(17, COL.A, 17, COL.E);
    addMerge(17, COL.F, 17, COL.L);
    addMerge(17, COL.M, 17, COL.Q);

    // Row 18: Lider del Equipo
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, 'Lider del Equipo:', S.label);
        fillRange(row, COL.A, COL.C, S.label);
        setCell(row, COL.D, report.d1.leader || '', S.value);
        fillRange(row, COL.D, COL.I, S.value);
        setCell(row, COL.J, '', S.empty);
        fillRange(row, COL.J, COL.S, S.empty);
        rows.push(row);
    }
    addMerge(18, COL.A, 18, COL.C);
    addMerge(18, COL.D, 18, COL.I);
    addMerge(18, COL.J, 18, COL.S);

    // Row 19: spacer
    rows.push(blankRow(S.empty));

    // ========================================================================
    // ROWS 20-27: D3 - Contencion. Ubicacion de piezas revisadas.
    // ========================================================================

    // Row 20: Section header
    {
        const row = blankRow(S.sectionHeader);
        setCell(row, COL.A, '3. Contencion. Ubicacion de las piezas revisadas.', S.sectionHeader);
        rows.push(row);
    }
    addMerge(20, COL.A, 20, COL.S);

    // Row 21: Table headers for containment locations
    {
        const row = blankRow(S.tableHeader);
        setCell(row, COL.A, '', S.tableHeader);
        fillRange(row, COL.A, COL.B, S.tableHeader);
        setCell(row, COL.C, 'AREA STOCK', S.tableHeader);
        fillRange(row, COL.C, COL.E, S.tableHeader);
        setCell(row, COL.F, 'AREA RETRABAJO', S.tableHeader);
        fillRange(row, COL.F, COL.H, S.tableHeader);
        setCell(row, COL.I, 'AREA SCRAP', S.tableHeader);
        fillRange(row, COL.I, COL.K, S.tableHeader);
        setCell(row, COL.L, 'EXPEDICION', S.tableHeader);
        fillRange(row, COL.L, COL.N, S.tableHeader);
        setCell(row, COL.O, 'EN TRANSITO', S.tableHeader);
        fillRange(row, COL.O, COL.Q, S.tableHeader);
        setCell(row, COL.R, 'CLIENTE', S.tableHeader);
        fillRange(row, COL.R, COL.S, S.tableHeader);
        rows.push(row);
    }
    addMerge(21, COL.A, 21, COL.B);
    addMerge(21, COL.C, 21, COL.E);
    addMerge(21, COL.F, 21, COL.H);
    addMerge(21, COL.I, 21, COL.K);
    addMerge(21, COL.L, 21, COL.N);
    addMerge(21, COL.O, 21, COL.Q);
    addMerge(21, COL.R, 21, COL.S);

    // Row 22: "Potencial"
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, 'Potencial', S.label);
        fillRange(row, COL.A, COL.B, S.label);
        fillRange(row, COL.C, COL.S, S.value);
        rows.push(row);
    }
    addMerge(22, COL.A, 22, COL.B);
    addMerge(22, COL.C, 22, COL.E);
    addMerge(22, COL.F, 22, COL.H);
    addMerge(22, COL.I, 22, COL.K);
    addMerge(22, COL.L, 22, COL.N);
    addMerge(22, COL.O, 22, COL.Q);
    addMerge(22, COL.R, 22, COL.S);

    // Row 23: "Encontrado"
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, 'Encontrado', S.label);
        fillRange(row, COL.A, COL.B, S.label);
        fillRange(row, COL.C, COL.S, S.value);
        rows.push(row);
    }
    addMerge(23, COL.A, 23, COL.B);
    addMerge(23, COL.C, 23, COL.E);
    addMerge(23, COL.F, 23, COL.H);
    addMerge(23, COL.I, 23, COL.K);
    addMerge(23, COL.L, 23, COL.N);
    addMerge(23, COL.O, 23, COL.Q);
    addMerge(23, COL.R, 23, COL.S);

    // Rows 24-25: blank containment data rows
    rows.push(blankRow(S.empty));
    rows.push(blankRow(S.empty));

    // Row 26: Responsable de la Verificacion
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, 'Responsable de la Verificacion:', S.label);
        fillRange(row, COL.A, COL.F, S.label);
        setCell(row, COL.G, report.d3.responsible || '', S.value);
        fillRange(row, COL.G, COL.S, S.value);
        rows.push(row);
    }
    addMerge(26, COL.A, 26, COL.F);
    addMerge(26, COL.G, 26, COL.S);

    // Row 27: spacer
    rows.push(blankRow(S.empty));

    // ========================================================================
    // ROWS 28-33: D3 - Acciones de Contencion (table)
    // ========================================================================

    // Row 28: Section header row
    {
        const row = blankRow(S.sectionHeader);
        setCell(row, COL.A, '3 - Acciones de Contencion', S.sectionHeader);
        fillRange(row, COL.A, COL.I, S.sectionHeader);
        setCell(row, COL.J, 'Responsable', S.sectionHeaderCenter);
        fillRange(row, COL.J, COL.L, S.sectionHeaderCenter);
        setCell(row, COL.M, '% de Efecto', S.sectionHeaderCenter);
        fillRange(row, COL.M, COL.O, S.sectionHeaderCenter);
        setCell(row, COL.P, 'Fecha Implementacion', S.sectionHeaderCenter);
        fillRange(row, COL.P, COL.S, S.sectionHeaderCenter);
        rows.push(row);
    }
    addMerge(28, COL.A, 28, COL.I);
    addMerge(28, COL.J, 28, COL.L);
    addMerge(28, COL.M, 28, COL.O);
    addMerge(28, COL.P, 28, COL.S);

    // Rows 29-33: 5 action rows (fill first with D3 data)
    const d3ActionLines = (report.d3.actions || '').split(/\n/).filter(Boolean);
    for (let i = 0; i < 5; i++) {
        const row = blankRow(S.empty);
        setCell(row, COL.A, d3ActionLines[i] || '', S.value);
        fillRange(row, COL.A, COL.I, S.value);
        setCell(row, COL.J, i === 0 ? (report.d3.responsible || '') : '', S.value);
        fillRange(row, COL.J, COL.L, S.value);
        setCell(row, COL.M, '', S.valueCenter);
        fillRange(row, COL.M, COL.O, S.valueCenter);
        setCell(row, COL.P, i === 0 ? formatDate(report.d3.date) : '', S.value);
        fillRange(row, COL.P, COL.S, S.value);
        rows.push(row);
    }
    for (let i = 0; i < 5; i++) {
        addMerge(29 + i, COL.A, 29 + i, COL.I);
        addMerge(29 + i, COL.J, 29 + i, COL.L);
        addMerge(29 + i, COL.M, 29 + i, COL.O);
        addMerge(29 + i, COL.P, 29 + i, COL.S);
    }

    // ========================================================================
    // ROWS 34-40: D4 - Causa Raiz (Ocurrencia left + No Deteccion right)
    // ========================================================================

    // Row 34: Section headers side by side
    {
        const row = blankRow(S.sectionHeader);
        setCell(row, COL.A, '4 - Causa Raiz de la Ocurrencia :', S.sectionHeader);
        fillRange(row, COL.A, COL.L, S.sectionHeader);
        setCell(row, COL.M, '4.1 - Causa Raiz de la No Deteccion:', S.sectionHeader);
        fillRange(row, COL.M, COL.S, S.sectionHeader);
        rows.push(row);
    }
    addMerge(34, COL.A, 34, COL.L);
    addMerge(34, COL.M, 34, COL.S);

    // Rows 35-39: 5 Por Que rows
    const whys = report.d4.fiveWhy || [];
    // For escape / no-detection side, we use escapeWhy split or escapePoint
    const escapeWhyText = report.d4.escapeWhy || '';
    const escapeLines = escapeWhyText.split(/\n/).filter(Boolean);

    for (let i = 0; i < 5; i++) {
        const row = blankRow(S.empty);
        setCell(row, COL.A, `Por que ${i + 1}?`, S.whyLabel);
        fillRange(row, COL.A, COL.C, S.whyLabel);
        setCell(row, COL.D, whys[i] || '', S.value);
        fillRange(row, COL.D, COL.L, S.value);
        setCell(row, COL.M, `Por que ${i + 1}?`, S.whyLabel);
        fillRange(row, COL.M, COL.O, S.whyLabel);
        setCell(row, COL.P, escapeLines[i] || '', S.value);
        fillRange(row, COL.P, COL.S, S.value);
        rows.push(row);
    }
    for (let i = 0; i < 5; i++) {
        addMerge(35 + i, COL.A, 35 + i, COL.C);
        addMerge(35 + i, COL.D, 35 + i, COL.L);
        addMerge(35 + i, COL.M, 35 + i, COL.O);
        addMerge(35 + i, COL.P, 35 + i, COL.S);
    }

    // Row 40: Root cause summary
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, 'Causa Raiz:', S.label);
        fillRange(row, COL.A, COL.C, S.label);
        setCell(row, COL.D, report.d4.rootCause || '', S.boldValue);
        fillRange(row, COL.D, COL.L, S.boldValue);
        setCell(row, COL.M, 'Punto de Escape:', S.label);
        fillRange(row, COL.M, COL.O, S.label);
        setCell(row, COL.P, report.d4.escapePoint || '', S.boldValue);
        fillRange(row, COL.P, COL.S, S.boldValue);
        rows.push(row);
    }
    addMerge(40, COL.A, 40, COL.C);
    addMerge(40, COL.D, 40, COL.L);
    addMerge(40, COL.M, 40, COL.O);
    addMerge(40, COL.P, 40, COL.S);

    // ========================================================================
    // ROWS 41-47: D5 - Accion Correctiva Permanente
    // ========================================================================

    // Row 41: Section header
    {
        const row = blankRow(S.sectionHeader);
        setCell(row, COL.A, '5 - Accion Correctiva Permanente Elegida', S.sectionHeader);
        fillRange(row, COL.A, COL.J, S.sectionHeader);
        setCell(row, COL.K, 'Verificacion', S.sectionHeaderCenter);
        fillRange(row, COL.K, COL.P, S.sectionHeaderCenter);
        setCell(row, COL.Q, '% de Efecto', S.sectionHeaderCenter);
        fillRange(row, COL.Q, COL.S, S.sectionHeaderCenter);
        rows.push(row);
    }
    addMerge(41, COL.A, 41, COL.J);
    addMerge(41, COL.K, 41, COL.P);
    addMerge(41, COL.Q, 41, COL.S);

    // Rows 42-46: 5 action rows
    const pcaActions = report.d5.actions || [];
    for (let i = 0; i < 5; i++) {
        const pca = pcaActions[i];
        const row = blankRow(S.empty);
        setCell(row, COL.A, pca?.action || '', S.value);
        fillRange(row, COL.A, COL.J, S.value);
        setCell(row, COL.K, i === 0 ? (report.d5.verificationMethod || '') : '', S.value);
        fillRange(row, COL.K, COL.P, S.value);
        setCell(row, COL.Q, '', S.valueCenter);
        fillRange(row, COL.Q, COL.S, S.valueCenter);
        rows.push(row);
    }
    for (let i = 0; i < 5; i++) {
        addMerge(42 + i, COL.A, 42 + i, COL.J);
        addMerge(42 + i, COL.K, 42 + i, COL.P);
        addMerge(42 + i, COL.Q, 42 + i, COL.S);
    }

    // Row 47: spacer
    rows.push(blankRow(S.empty));

    // ========================================================================
    // ROWS 48-55: D6 - Accion Permanente Implementada
    // ========================================================================

    // Row 48: Section header
    {
        const row = blankRow(S.sectionHeader);
        setCell(row, COL.A, '6 - Accion Permanente Implementada', S.sectionHeader);
        fillRange(row, COL.A, COL.L, S.sectionHeader);
        setCell(row, COL.M, 'Responsable', S.sectionHeaderCenter);
        fillRange(row, COL.M, COL.O, S.sectionHeaderCenter);
        setCell(row, COL.P, 'Fecha Implementacion', S.sectionHeaderCenter);
        fillRange(row, COL.P, COL.S, S.sectionHeaderCenter);
        rows.push(row);
    }
    addMerge(48, COL.A, 48, COL.L);
    addMerge(48, COL.M, 48, COL.O);
    addMerge(48, COL.P, 48, COL.S);

    // Rows 49-53: 5 action rows
    const d6Lines = (report.d6.validation || '').split(/\n/).filter(Boolean);
    for (let i = 0; i < 5; i++) {
        const row = blankRow(S.empty);
        setCell(row, COL.A, d6Lines[i] || '', S.value);
        fillRange(row, COL.A, COL.L, S.value);
        setCell(row, COL.M, '', S.value);
        fillRange(row, COL.M, COL.O, S.value);
        setCell(row, COL.P, '', S.value);
        fillRange(row, COL.P, COL.S, S.value);
        rows.push(row);
    }
    for (let i = 0; i < 5; i++) {
        addMerge(49 + i, COL.A, 49 + i, COL.L);
        addMerge(49 + i, COL.M, 49 + i, COL.O);
        addMerge(49 + i, COL.P, 49 + i, COL.S);
    }

    // Row 54: spacer
    rows.push(blankRow(S.empty));
    // Row 55: spacer
    rows.push(blankRow(S.empty));

    // ========================================================================
    // ROWS 56-61: D7.1 - Documentacion afectada
    // ========================================================================

    // Row 56: Section header
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, '7.1. La accion tomada afecta a la siguiente documentacion:', S.label);
        fillRange(row, COL.A, COL.S, S.label);
        rows.push(row);
    }
    addMerge(56, COL.A, 56, COL.S);

    // Helper: checkbox rendering
    const chk = (val: string | undefined): string => {
        if (!val) return '[ ]';
        const lower = val.toLowerCase().trim();
        return (lower === 'si' || lower === 'yes' || lower === 'true' || lower === '1') ? '[X]' : '[ ]';
    };

    // Row 57: Checkboxes row 1
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, `${chk(report.d7.fmeaUpdated)} AMFE's`, S.checkbox);
        fillRange(row, COL.A, COL.D, S.checkbox);
        setCell(row, COL.E, `${chk(report.d7.controlPlanUpdated)} Plan de Control`, S.checkbox);
        fillRange(row, COL.E, COL.I, S.checkbox);
        setCell(row, COL.J, `${chk(report.d7.workInstructions)} Hojas Proceso`, S.checkbox);
        fillRange(row, COL.J, COL.N, S.checkbox);
        setCell(row, COL.O, '[ ] Ayudas visuales', S.checkbox);
        fillRange(row, COL.O, COL.S, S.checkbox);
        rows.push(row);
    }
    addMerge(57, COL.A, 57, COL.D);
    addMerge(57, COL.E, 57, COL.I);
    addMerge(57, COL.J, 57, COL.N);
    addMerge(57, COL.O, 57, COL.S);

    // Row 58: Checkboxes row 2
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, '[ ] Id. de material', S.checkbox);
        fillRange(row, COL.A, COL.D, S.checkbox);
        setCell(row, COL.E, '[ ] Estructura', S.checkbox);
        fillRange(row, COL.E, COL.I, S.checkbox);
        setCell(row, COL.J, '[ ] PAPP', S.checkbox);
        fillRange(row, COL.J, COL.N, S.checkbox);
        setCell(row, COL.O, `${chk(report.d7.otherDocs)} Procedimientos/Instructivos`, S.checkbox);
        fillRange(row, COL.O, COL.S, S.checkbox);
        rows.push(row);
    }
    addMerge(58, COL.A, 58, COL.D);
    addMerge(58, COL.E, 58, COL.I);
    addMerge(58, COL.J, 58, COL.N);
    addMerge(58, COL.O, 58, COL.S);

    // Rows 59-61: spacer
    rows.push(blankRow(S.empty));
    rows.push(blankRow(S.empty));
    rows.push(blankRow(S.empty));

    // ========================================================================
    // ROWS 62-67: D7 - Accion para Evitar la Reincidencia
    // ========================================================================

    // Row 62: Section header
    {
        const row = blankRow(S.sectionHeader);
        setCell(row, COL.A, '7 - Accion para Evitar la Reincidencia', S.sectionHeader);
        fillRange(row, COL.A, COL.L, S.sectionHeader);
        setCell(row, COL.M, 'Responsable', S.sectionHeaderCenter);
        fillRange(row, COL.M, COL.O, S.sectionHeaderCenter);
        setCell(row, COL.P, 'Fecha Implementacion', S.sectionHeaderCenter);
        fillRange(row, COL.P, COL.S, S.sectionHeaderCenter);
        rows.push(row);
    }
    addMerge(62, COL.A, 62, COL.L);
    addMerge(62, COL.M, 62, COL.O);
    addMerge(62, COL.P, 62, COL.S);

    // Rows 63-66: 4 action rows
    const d7Lines = (report.d7.prevention || '').split(/\n/).filter(Boolean);
    for (let i = 0; i < 4; i++) {
        const row = blankRow(S.empty);
        setCell(row, COL.A, d7Lines[i] || '', S.value);
        fillRange(row, COL.A, COL.L, S.value);
        setCell(row, COL.M, '', S.value);
        fillRange(row, COL.M, COL.O, S.value);
        setCell(row, COL.P, '', S.value);
        fillRange(row, COL.P, COL.S, S.value);
        rows.push(row);
    }
    for (let i = 0; i < 4; i++) {
        addMerge(63 + i, COL.A, 63 + i, COL.L);
        addMerge(63 + i, COL.M, 63 + i, COL.O);
        addMerge(63 + i, COL.P, 63 + i, COL.S);
    }

    // Row 67: spacer
    rows.push(blankRow(S.empty));

    // ========================================================================
    // ROWS 68-72: D8 - Verificacion y Cierre
    // ========================================================================

    // Row 68: Section header — Verificacion de la eficacia
    {
        const row = blankRow(S.sectionHeader);
        setCell(row, COL.A, '8 - Verificacion de la eficacia', S.sectionHeader);
        fillRange(row, COL.A, COL.I, S.sectionHeader);
        setCell(row, COL.J, 'Fecha de verificacion', S.sectionHeaderCenter);
        fillRange(row, COL.J, COL.O, S.sectionHeaderCenter);
        setCell(row, COL.P, 'Verificado por', S.sectionHeaderCenter);
        fillRange(row, COL.P, COL.S, S.sectionHeaderCenter);
        rows.push(row);
    }
    addMerge(68, COL.A, 68, COL.I);
    addMerge(68, COL.J, 68, COL.O);
    addMerge(68, COL.P, 68, COL.S);

    // Row 69: Verification data
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, report.d8.lessons || '', S.value);
        fillRange(row, COL.A, COL.I, S.value);
        setCell(row, COL.J, formatDate(report.d8.effectivenessCheckDate || ''), S.value);
        fillRange(row, COL.J, COL.O, S.value);
        setCell(row, COL.P, report.d8.customerApproval || '', S.value);
        fillRange(row, COL.P, COL.S, S.value);
        rows.push(row);
    }
    addMerge(69, COL.A, 69, COL.I);
    addMerge(69, COL.J, 69, COL.O);
    addMerge(69, COL.P, 69, COL.S);

    // Row 70: blank verification row
    {
        const row = blankRow(S.empty);
        fillRange(row, COL.A, COL.I, S.value);
        fillRange(row, COL.J, COL.O, S.value);
        fillRange(row, COL.P, COL.S, S.value);
        rows.push(row);
    }
    addMerge(70, COL.A, 70, COL.I);
    addMerge(70, COL.J, 70, COL.O);
    addMerge(70, COL.P, 70, COL.S);

    // Row 71: Felicite a su Equipo
    {
        const row = blankRow(S.sectionHeader);
        setCell(row, COL.A, 'Felicite a su Equipo', S.sectionHeader);
        fillRange(row, COL.A, COL.I, S.sectionHeader);
        setCell(row, COL.J, 'Fecha de Cierre', S.sectionHeaderCenter);
        fillRange(row, COL.J, COL.O, S.sectionHeaderCenter);
        setCell(row, COL.P, 'Elaborado por', S.sectionHeaderCenter);
        fillRange(row, COL.P, COL.S, S.sectionHeaderCenter);
        rows.push(row);
    }
    addMerge(71, COL.A, 71, COL.I);
    addMerge(71, COL.J, 71, COL.O);
    addMerge(71, COL.P, 71, COL.S);

    // Row 72: Closure data
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, report.d8.recognition || '', S.value);
        fillRange(row, COL.A, COL.I, S.value);
        setCell(row, COL.J, formatDate(report.d8.closedDate || ''), S.value);
        fillRange(row, COL.J, COL.O, S.value);
        setCell(row, COL.P, report.createdBy || '', S.value);
        fillRange(row, COL.P, COL.S, S.value);
        rows.push(row);
    }
    addMerge(72, COL.A, 72, COL.I);
    addMerge(72, COL.J, 72, COL.O);
    addMerge(72, COL.P, 72, COL.S);

    // ========================================================================
    // BUILD SHEET 1: "8D"
    // ========================================================================

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths (19 columns A-S)
    ws['!cols'] = [
        { wch: 6 },   // A
        { wch: 6 },   // B
        { wch: 6 },   // C
        { wch: 8 },   // D
        { wch: 8 },   // E
        { wch: 6 },   // F
        { wch: 6 },   // G
        { wch: 6 },   // H
        { wch: 6 },   // I
        { wch: 8 },   // J
        { wch: 6 },   // K
        { wch: 6 },   // L
        { wch: 8 },   // M
        { wch: 8 },   // N
        { wch: 8 },   // O
        { wch: 10 },  // P
        { wch: 6 },   // Q
        { wch: 6 },   // R
        { wch: 6 },   // S
    ];

    // Row heights
    const rowHeights: { hpx: number }[] = [];
    for (let i = 0; i < rows.length; i++) {
        if (i <= 3) {
            rowHeights.push({ hpx: 30 }); // Header rows
        } else if (
            i === 11 || i === 20 || i === 28 || i === 34 ||
            i === 41 || i === 48 || i === 62 || i === 68 || i === 71
        ) {
            rowHeights.push({ hpx: 26 }); // Section headers
        } else {
            rowHeights.push({ hpx: 20 }); // Default
        }
    }
    ws['!rows'] = rowHeights;
    ws['!merges'] = merges;

    // ========================================================================
    // BUILD SHEET 2: "Evidencias de Acciones"
    // ========================================================================

    const evidenceRows: Record<string, unknown>[][] = [];

    // Row 0: Title
    {
        const row = blankRow(S.sectionHeader);
        setCell(row, COL.A, 'Evidencias de Acciones', S.sectionHeader);
        evidenceRows.push(row);
    }

    // Row 1: Report reference
    {
        const row = blankRow(S.empty);
        setCell(row, COL.A, 'N\u00B0 de Ref:', S.label);
        setCell(row, COL.B, report.reportNumber, S.value);
        setCell(row, COL.D, 'Titulo:', S.label);
        setCell(row, COL.E, report.title, S.value);
        evidenceRows.push(row);
    }

    // Rows 2-3: blank
    evidenceRows.push(blankRow(S.empty));
    evidenceRows.push(blankRow(S.empty));

    // Row 4: Column headers for evidence table
    {
        const row = blankRow(S.tableHeader);
        setCell(row, COL.A, 'N\u00B0', S.tableHeader);
        setCell(row, COL.B, 'Disciplina', S.tableHeader);
        setCell(row, COL.E, 'Accion', S.tableHeader);
        setCell(row, COL.J, 'Evidencia / Foto', S.tableHeader);
        setCell(row, COL.P, 'Fecha', S.tableHeader);
        evidenceRows.push(row);
    }

    // Rows 5-14: 10 blank evidence rows
    for (let i = 0; i < 10; i++) {
        evidenceRows.push(blankRow(S.empty));
    }

    const evMerges: XLSX.Range[] = [
        { s: { r: 0, c: COL.A }, e: { r: 0, c: COL.S } },
        { s: { r: 1, c: COL.B }, e: { r: 1, c: COL.C } },
        { s: { r: 1, c: COL.E }, e: { r: 1, c: COL.S } },
        { s: { r: 4, c: COL.B }, e: { r: 4, c: COL.D } },
        { s: { r: 4, c: COL.E }, e: { r: 4, c: COL.I } },
        { s: { r: 4, c: COL.J }, e: { r: 4, c: COL.O } },
        { s: { r: 4, c: COL.P }, e: { r: 4, c: COL.S } },
    ];

    // Evidence data rows merges
    for (let i = 0; i < 10; i++) {
        evMerges.push({ s: { r: 5 + i, c: COL.B }, e: { r: 5 + i, c: COL.D } });
        evMerges.push({ s: { r: 5 + i, c: COL.E }, e: { r: 5 + i, c: COL.I } });
        evMerges.push({ s: { r: 5 + i, c: COL.J }, e: { r: 5 + i, c: COL.O } });
        evMerges.push({ s: { r: 5 + i, c: COL.P }, e: { r: 5 + i, c: COL.S } });
    }

    const ws2 = XLSX.utils.aoa_to_sheet(evidenceRows);
    ws2['!cols'] = ws['!cols'];
    ws2['!merges'] = evMerges;

    const evRowHeights: { hpx: number }[] = [];
    for (let i = 0; i < evidenceRows.length; i++) {
        evRowHeights.push({ hpx: i === 0 ? 26 : 20 });
    }
    ws2['!rows'] = evRowHeights;

    // ========================================================================
    // BUILD WORKBOOK & DOWNLOAD
    // ========================================================================

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '8D');
    XLSX.utils.book_append_sheet(wb, ws2, 'Evidencias de Acciones');

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `8D_${report.reportNumber || 'draft'}_${dateStr}.xlsx`;

    await downloadWorkbook(wb, filename);

    logger.info('8D Export', 'Excel export completed (Barack format)', { filename });
}
