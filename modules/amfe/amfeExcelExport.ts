/**
 * AMFE Excel Export — I-AC-005.3
 *
 * Three export modes:
 * 1. Completo: Full AIAG-VDA AMFE form with hierarchical cell merging
 * 2. Resumen AP: Summary of High/Medium AP causes
 * 3. Plan de Acciones: Open action items for tracking meetings
 *
 * Styling matches manually-created Excel templates (standard Excel palette,
 * Arial font, thin borders, conditional-format AP colors).
 */

import XLSX from 'xlsx-js-style';
import {
    AmfeDocument, AmfeFailure, AmfeCause, AmfeOperation,
    AmfeWorkElement, AmfeFunction, ActionPriority, WORK_ELEMENT_LABELS,
} from './amfeTypes';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';
import { downloadWorkbook, generateWorkbookBuffer } from '../../utils/excel';
import { truncateApplicableParts as truncateParts } from '../../utils/productFamilyAutoFill';

export { sanitizeCellValue } from '../../utils/sanitizeCellValue';

// ============================================================================
// CONSTANTS
// ============================================================================

const SGC_FORM_NUMBER = 'I-AC-005.3';

// ============================================================================
// STYLES — Standard Excel palette (looks hand-made, not software-generated)
// ============================================================================

const BORDER = {
    top: { style: 'thin' as const, color: { rgb: '000000' } },
    bottom: { style: 'thin' as const, color: { rgb: '000000' } },
    left: { style: 'thin' as const, color: { rgb: '000000' } },
    right: { style: 'thin' as const, color: { rgb: '000000' } },
};

const st = {
    title: {
        font: { bold: true, sz: 12, name: 'Arial' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    },
    formRef: {
        font: { sz: 8, color: { rgb: '808080' }, name: 'Arial' },
        alignment: { horizontal: 'right' as const },
    },
    metaLabel: {
        font: { bold: true, sz: 9, name: 'Arial' },
        fill: { fgColor: { rgb: 'F2F2F2' } },
        border: BORDER,
    },
    metaValue: {
        font: { sz: 9, name: 'Arial' },
        border: BORDER,
    },
    groupHeader: {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9, name: 'Arial' },
        fill: { fgColor: { rgb: '4472C4' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
        border: BORDER,
    },
    colHeader: {
        font: { bold: true, sz: 8, name: 'Arial' },
        fill: { fgColor: { rgb: 'D9E2F3' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
        border: BORDER,
    },
    cell: {
        font: { sz: 8, name: 'Arial' },
        alignment: { vertical: 'top' as const, wrapText: true },
        border: BORDER,
    },
    cellCenter: {
        font: { sz: 8, name: 'Arial' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    cellMerged: {
        font: { sz: 8, name: 'Arial' },
        alignment: { vertical: 'center' as const, wrapText: true },
        border: BORDER,
    },
    // AP colors: Excel built-in conditional formatting palette (looks native)
    apH: {
        font: { bold: true, sz: 8, name: 'Arial', color: { rgb: '9C0006' } },
        fill: { fgColor: { rgb: 'FFC7CE' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    apM: {
        font: { bold: true, sz: 8, name: 'Arial', color: { rgb: '9C6500' } },
        fill: { fgColor: { rgb: 'FFEB9C' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    apL: {
        font: { sz: 8, name: 'Arial', color: { rgb: '006100' } },
        fill: { fgColor: { rgb: 'C6EFCE' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    // Empty merged cell (keeps borders visible)
    emptyBorder: {
        border: BORDER,
    },
};

function getApStyle(ap: string) {
    switch (ap) {
        case ActionPriority.HIGH: case 'H': return st.apH;
        case ActionPriority.MEDIUM: case 'M': return st.apM;
        case ActionPriority.LOW: case 'L': return st.apL;
        default: return st.cellCenter;
    }
}

// ============================================================================
// FULL AMFE FORM — Column definitions (29 columns, AIAG-VDA standard)
// ============================================================================

const AMFE_COL_GROUPS = [
    { label: 'Análisis de Estructura', colSpan: 3 },
    { label: 'Análisis de Fallas', colSpan: 5 },
    { label: 'Análisis de Causas', colSpan: 6 },
    { label: 'Clasificación', colSpan: 3 },
    { label: 'Optimización (Paso 6)', colSpan: 12 },
];

const AMFE_COL_HEADERS = [
    'Paso Proceso', 'Elemento 6M', 'Funcion / Requisito',
    'Modo de Falla', 'Efecto Interno', 'Efecto Planta Cliente', 'Efecto Usuario Final', 'S',
    'Causa Raiz', 'Control Prevencion', 'Control Deteccion', 'O', 'D', 'AP',
    'Nro. Car.', 'CC/SC', 'Filtro',
    'Accion Preventiva', 'Accion Detectiva', 'Responsable', 'Fecha Obj.',
    'Estado', 'Accion Tomada', 'Fecha Real', "S'", "O'", "D'", "AP'", 'Observaciones',
];

const AMFE_COL_WIDTHS = [
    20, 18, 22,
    22, 18, 18, 18, 5,
    22, 20, 20, 4, 4, 5,
    8, 7, 7,
    22, 22, 14, 11, 11, 22, 11, 4, 4, 4, 5, 18,
];

const RESUMEN_AP_COL_WIDTHS = [
    8, 22, 18, 22, 25, 25, 25, 4, 4, 4, 5, 8, 7, 7, 12, 16,
];

const PLAN_ACCIONES_COL_WIDTHS = [
    22, 25, 25, 5, 30, 30, 16, 11, 12, 30, 11,
];

// ============================================================================
// HELPERS
// ============================================================================

/** One row per cause, carrying its parent failure and hierarchy context */
interface FlatCauseRow {
    opNumber: string;
    opName: string;
    weType: string;
    weName: string;
    funcDescription: string;
    failure: AmfeFailure;
    cause: AmfeCause;
}

/** Flatten the AMFE hierarchy to a list of cause rows with their parent context */
function flattenCauseRows(doc: AmfeDocument): FlatCauseRow[] {
    const result: FlatCauseRow[] = [];
    for (const op of doc.operations) {
        for (const we of op.workElements) {
            for (const func of we.functions) {
                for (const fail of func.failures) {
                    for (const cause of fail.causes) {
                        result.push({
                            opNumber: op.opNumber,
                            opName: op.name,
                            weType: we.type,
                            weName: we.name,
                            funcDescription: func.description,
                            failure: fail,
                            cause,
                        });
                    }
                }
            }
        }
    }
    return result;
}

/**
 * Build header metadata rows (shared across all export modes).
 * Uses only the first ~8 columns for a compact layout — like a real
 * hand-made Excel where metadata doesn't stretch across the full data table.
 */
function buildMetadataRows(doc: AmfeDocument, colWidths: number[]): { rows: any[][]; merges: XLSX.Range[] } {
    const h = doc.header;
    const totalCols = colWidths.length;
    const merges: XLSX.Range[] = [];
    const MIN_LBL = 16;

    // Compact metadata: use only first ~8 columns (not the full table width)
    const metaEnd = Math.min(7, totalCols - 1);
    const splitCol = Math.min(4, Math.floor((metaEnd + 1) / 2));

    // Left label: merge from col 0 until width >= MIN_LBL
    let leftLabelEnd = 0;
    { let w = colWidths[0]; while (w < MIN_LBL && leftLabelEnd < splitCol - 2) { leftLabelEnd++; w += colWidths[leftLabelEnd]; } }

    // Right label: merge from splitCol until width >= MIN_LBL
    let rightLabelEnd = splitCol;
    { let w = colWidths[splitCol]; while (w < MIN_LBL && rightLabelEnd < metaEnd - 1) { rightLabelEnd++; w += colWidths[rightLabelEnd]; } }

    const leftValueStart = leftLabelEnd + 1;
    const leftValueEnd = splitCol - 1;
    const rightValueStart = rightLabelEnd + 1;
    const rightValueEnd = metaEnd;

    // Row 0: Title (merged across metadata columns only)
    const titleRow: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: {} }));
    titleRow[0] = { v: 'AMFE DE PROCESO', s: st.title };
    for (let i = 1; i <= metaEnd; i++) titleRow[i] = { v: '', s: st.title };
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: metaEnd } });

    // Row 1: Form reference (right-aligned within metadata columns)
    const formRow: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: {} }));
    formRow[0] = { v: `Formulario ${SGC_FORM_NUMBER}`, s: st.formRef };
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: metaEnd } });

    // Metadata pairs (rows 2-9)
    const metaPairs: [string, string, string, string][] = [
        ['AMFE Nro.', h.amfeNumber, 'Confidencialidad', h.confidentiality],
        ['Organizacion', h.organization, 'Cliente', h.client],
        ['Ubicacion', h.location, 'Nro. Pieza', h.partNumber],
        ['Responsable', h.responsible, 'Resp. Proceso', h.processResponsible],
        ['Equipo', h.team, 'Modelo / Año', h.modelYear],
        ['Fecha Inicio', h.startDate, 'Fecha Rev.', h.revDate],
        ['Revision', h.revision, 'Aprobado por', h.approvedBy],
        ['Alcance', h.scope, 'Asunto', h.subject],
        ...(h.applicableParts?.trim() ? [['Piezas Aplicables', truncateParts(h.applicableParts).replace(/\n/g, ' · '), '', ''] as [string, string, string, string]] : []),
    ];

    const metaRowsArr: any[][] = [];
    for (let i = 0; i < metaPairs.length; i++) {
        const [lbl1, val1, lbl2, val2] = metaPairs[i];
        const rowIdx = 2 + i;
        const row: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: {} }));

        // Left label
        row[0] = { v: lbl1, s: st.metaLabel };
        for (let c = 1; c <= leftLabelEnd; c++) row[c] = { v: '', s: st.metaLabel };
        if (leftLabelEnd > 0) {
            merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: leftLabelEnd } });
        }

        // Left value
        row[leftValueStart] = { v: sanitizeCellValue(val1), s: st.metaValue };
        for (let c = leftValueStart + 1; c <= leftValueEnd; c++) row[c] = { v: '', s: st.metaValue };
        if (leftValueEnd > leftValueStart) {
            merges.push({ s: { r: rowIdx, c: leftValueStart }, e: { r: rowIdx, c: leftValueEnd } });
        }

        // Right label
        row[splitCol] = { v: lbl2, s: st.metaLabel };
        for (let c = splitCol + 1; c <= rightLabelEnd; c++) row[c] = { v: '', s: st.metaLabel };
        if (rightLabelEnd > splitCol) {
            merges.push({ s: { r: rowIdx, c: splitCol }, e: { r: rowIdx, c: rightLabelEnd } });
        }

        // Right value
        if (rightValueStart <= rightValueEnd) {
            row[rightValueStart] = { v: sanitizeCellValue(val2), s: st.metaValue };
            for (let c = rightValueStart + 1; c <= rightValueEnd; c++) row[c] = { v: '', s: st.metaValue };
            if (rightValueEnd > rightValueStart) {
                merges.push({ s: { r: rowIdx, c: rightValueStart }, e: { r: rowIdx, c: rightValueEnd } });
            }
        }

        metaRowsArr.push(row);
    }

    // Empty separator
    const emptyRow: any[] = Array(totalCols).fill('');

    return {
        rows: [titleRow, formRow, ...metaRowsArr, emptyRow],
        merges,
    };
}

// ============================================================================
// EXPORT 1: AMFE COMPLETO — Full AIAG-VDA form with hierarchical merging
// ============================================================================

/**
 * Export the full AMFE form with all 29 columns and hierarchical cell merging.
 * This is the main export that replicates the official I-AC-005.3 template.
 */
/**
 * Build the full AMFE workbook (no download). Used by both export and buffer generation.
 */
export function buildAmfeCompletoWorkbook(doc: AmfeDocument): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();
    const totalCols = AMFE_COL_HEADERS.length; // 29

    // --- Header section ---
    const { rows: metaRows, merges } = buildMetadataRows(doc, AMFE_COL_WIDTHS);
    const rows: any[][] = [...metaRows];

    // --- Column group header row ---
    const groupRow: any[] = [];
    for (const group of AMFE_COL_GROUPS) {
        groupRow.push({ v: group.label, s: st.groupHeader });
        for (let i = 1; i < group.colSpan; i++) {
            groupRow.push({ v: '', s: st.groupHeader });
        }
    }
    rows.push(groupRow);
    const groupRowIdx = rows.length - 1;

    // Group header merges
    let colOffset = 0;
    for (const group of AMFE_COL_GROUPS) {
        if (group.colSpan > 1) {
            merges.push({
                s: { r: groupRowIdx, c: colOffset },
                e: { r: groupRowIdx, c: colOffset + group.colSpan - 1 },
            });
        }
        colOffset += group.colSpan;
    }

    // --- Column header row ---
    rows.push(AMFE_COL_HEADERS.map(label => ({ v: label, s: st.colHeader })));
    const dataStartRow = rows.length;

    // --- Data rows with merge tracking ---
    const dataRows: any[][] = [];
    const dataMerges: { col: number; startRow: number; rowSpan: number }[] = [];

    for (const op of doc.operations) {
        const opStartRow = dataRows.length;
        let opRowCount = 0;

        const weList = op.workElements.length > 0 ? op.workElements : ([null] as (AmfeWorkElement | null)[]);
        for (const we of weList) {
            const weStartRow = dataRows.length;
            let weRowCount = 0;

            const funcList = we && we.functions.length > 0 ? we.functions : ([null] as (AmfeFunction | null)[]);
            for (const func of funcList) {
                const funcStartRow = dataRows.length;
                let funcRowCount = 0;

                const failList = func && func.failures.length > 0 ? func.failures : ([null] as (AmfeFailure | null)[]);
                for (const fail of failList) {
                    const failStartRow = dataRows.length;
                    let failRowCount = 0;

                    const causeList = fail && fail.causes.length > 0 ? fail.causes : ([null] as (AmfeCause | null)[]);
                    for (const cause of causeList) {
                        const c = cause || ({} as Partial<AmfeCause>);

                        dataRows.push([
                            // Structure (3) — merged per level
                            { v: sanitizeCellValue(`${op.opNumber} ${op.name}`), s: st.cellMerged },
                            { v: sanitizeCellValue(we ? `${WORK_ELEMENT_LABELS[we.type] || we.type}: ${we.name}` : ''), s: st.cellMerged },
                            { v: sanitizeCellValue(func ? `${func.description}${func.requirements ? '\n' + func.requirements : ''}` : ''), s: st.cellMerged },
                            // Failure (5) — merged per failure
                            { v: sanitizeCellValue(fail?.description || ''), s: st.cell },
                            { v: sanitizeCellValue(fail?.effectLocal || ''), s: st.cell },
                            { v: sanitizeCellValue(fail?.effectNextLevel || ''), s: st.cell },
                            { v: sanitizeCellValue(fail?.effectEndUser || ''), s: st.cell },
                            { v: fail?.severity ?? '', s: st.cellCenter },
                            // Cause (6) — one per row
                            { v: sanitizeCellValue(c.cause || ''), s: st.cell },
                            { v: sanitizeCellValue(c.preventionControl || ''), s: st.cell },
                            { v: sanitizeCellValue(c.detectionControl || ''), s: st.cell },
                            { v: c.occurrence ?? '', s: st.cellCenter },
                            { v: c.detection ?? '', s: st.cellCenter },
                            { v: c.ap ?? '', s: getApStyle(String(c.ap || '')) },
                            // Classification (3)
                            { v: sanitizeCellValue(c.characteristicNumber || ''), s: st.cellCenter },
                            { v: sanitizeCellValue(c.specialChar || ''), s: st.cellCenter },
                            { v: sanitizeCellValue(c.filterCode || ''), s: st.cellCenter },
                            // Optimization (12)
                            { v: sanitizeCellValue(c.preventionAction || ''), s: st.cell },
                            { v: sanitizeCellValue(c.detectionAction || ''), s: st.cell },
                            { v: sanitizeCellValue(c.responsible || ''), s: st.cell },
                            { v: sanitizeCellValue(c.targetDate || ''), s: st.cellCenter },
                            { v: sanitizeCellValue(c.status || ''), s: st.cellCenter },
                            { v: sanitizeCellValue(c.actionTaken || ''), s: st.cell },
                            { v: sanitizeCellValue(c.completionDate || ''), s: st.cellCenter },
                            { v: c.severityNew ?? '', s: st.cellCenter },
                            { v: c.occurrenceNew ?? '', s: st.cellCenter },
                            { v: c.detectionNew ?? '', s: st.cellCenter },
                            { v: c.apNew ?? '', s: getApStyle(String(c.apNew || '')) },
                            { v: sanitizeCellValue(c.observations || ''), s: st.cell },
                        ]);

                        failRowCount++;
                        funcRowCount++;
                        weRowCount++;
                        opRowCount++;
                    }

                    // Failure merge: cols 3-7 (FM, 3 effects, S)
                    if (failRowCount > 1) {
                        for (const col of [3, 4, 5, 6, 7]) {
                            dataMerges.push({ col, startRow: failStartRow, rowSpan: failRowCount });
                        }
                    }
                }

                // Function merge: col 2
                if (funcRowCount > 1) {
                    dataMerges.push({ col: 2, startRow: funcStartRow, rowSpan: funcRowCount });
                }
            }

            // Work element merge: col 1
            if (weRowCount > 1) {
                dataMerges.push({ col: 1, startRow: weStartRow, rowSpan: weRowCount });
            }
        }

        // Operation merge: col 0
        if (opRowCount > 1) {
            dataMerges.push({ col: 0, startRow: opStartRow, rowSpan: opRowCount });
        }
    }

    // Add data rows
    rows.push(...dataRows);

    // Convert data merges to absolute sheet coordinates
    for (const dm of dataMerges) {
        merges.push({
            s: { r: dataStartRow + dm.startRow, c: dm.col },
            e: { r: dataStartRow + dm.startRow + dm.rowSpan - 1, c: dm.col },
        });
    }

    // Clear duplicate values in merged cells (keep only first row)
    for (const dm of dataMerges) {
        for (let r = dm.startRow + 1; r < dm.startRow + dm.rowSpan; r++) {
            if (dataRows[r] && dataRows[r][dm.col]) {
                dataRows[r][dm.col] = { v: '', s: st.emptyBorder };
            }
        }
    }

    // --- Create sheet ---
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = AMFE_COL_WIDTHS.map(w => ({ wch: w }));
    ws['!merges'] = merges;

    // Freeze panes: freeze header + column headers
    ws['!freeze'] = { xSplit: 0, ySplit: dataStartRow, topLeftCell: `A${dataStartRow + 1}` };

    XLSX.utils.book_append_sheet(wb, ws, 'AMFE');

    return wb;
}

/**
 * Export the full AMFE form — builds workbook and triggers download dialog.
 */
export function exportAmfeCompleto(doc: AmfeDocument): void {
    const wb = buildAmfeCompletoWorkbook(doc);
    const safeName = sanitizeFilename(doc.header.subject || doc.header.partNumber || 'Documento', { allowSpaces: true });
    downloadWorkbook(wb, `AMFE de Proceso - ${safeName}.xlsx`);
}

/**
 * Generate the full AMFE Excel as a Uint8Array buffer (for auto-export to Y: drive).
 */
export function generateAmfeCompletoBuffer(doc: AmfeDocument): Uint8Array {
    return generateWorkbookBuffer(buildAmfeCompletoWorkbook(doc));
}

// ============================================================================
// EXPORT 2: RESUMEN AP — Priority causes summary
// ============================================================================

export function exportAmfeResumenAP(doc: AmfeDocument): void {
    const wb = XLSX.utils.book_new();
    const allCauseRows = flattenCauseRows(doc);
    const priorityCauseRows = allCauseRows.filter(r =>
        r.cause.ap === ActionPriority.HIGH || r.cause.ap === ActionPriority.MEDIUM
    );

    const headers = [
        'Op', 'Paso', 'Elemento 6M', 'Funcion', 'Modo de Falla',
        'Efecto Usr. Final', 'Causa Raiz', 'S', 'O', 'D', 'AP',
        'Nro.Car.', 'Car.Esp.', 'Filtro', 'Estado', 'Responsable',
    ];
    const { rows: metaRows, merges } = buildMetadataRows(doc, RESUMEN_AP_COL_WIDTHS);
    const rows: any[][] = [...metaRows];
    const totalCols = RESUMEN_AP_COL_WIDTHS.length;

    // Subtitle (merged across first 4 cols so it doesn't get truncated by narrow col A)
    const subtitleRow: any[] = [{ v: 'Prioridades del AMFE', s: { font: { bold: true, sz: 11, name: 'Arial' } } }];
    for (let i = 1; i < totalCols; i++) subtitleRow.push('');
    rows.push(subtitleRow);
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 3 } });
    rows.push(Array(totalCols).fill(''));

    // Table header
    rows.push(headers.map(h => ({ v: h, s: st.colHeader })));

    // Sort: H first, then M, then by severity desc
    // FIX: Guard against NaN from undefined/non-numeric severity fields.
    // Number(undefined) = NaN, and NaN-NaN = NaN violates Array.sort() contract,
    // producing non-deterministic ordering.
    const sorted = [...priorityCauseRows].sort((a, b) => {
        if (a.cause.ap === ActionPriority.HIGH && b.cause.ap !== ActionPriority.HIGH) return -1;
        if (a.cause.ap !== ActionPriority.HIGH && b.cause.ap === ActionPriority.HIGH) return 1;
        return (Number(b.failure.severity) || 0) - (Number(a.failure.severity) || 0);
    });

    for (const item of sorted) {
        const f = item.failure;
        const c = item.cause;
        rows.push([
            { v: sanitizeCellValue(item.opNumber), s: st.cellCenter },
            { v: sanitizeCellValue(item.opName), s: st.cell },
            { v: sanitizeCellValue(`${item.weType}: ${item.weName}`), s: st.cell },
            { v: sanitizeCellValue(item.funcDescription), s: st.cell },
            { v: sanitizeCellValue(f.description), s: st.cell },
            { v: sanitizeCellValue(f.effectEndUser), s: st.cell },
            { v: sanitizeCellValue(c.cause), s: st.cell },
            { v: f.severity ?? '', s: st.cellCenter },
            { v: c.occurrence ?? '', s: st.cellCenter },
            { v: c.detection ?? '', s: st.cellCenter },
            { v: c.ap ?? '', s: getApStyle(String(c.ap || '')) },
            { v: sanitizeCellValue(c.characteristicNumber || ''), s: st.cellCenter },
            { v: sanitizeCellValue(c.specialChar || ''), s: st.cellCenter },
            { v: sanitizeCellValue(c.filterCode || ''), s: st.cellCenter },
            { v: sanitizeCellValue(c.status || ''), s: st.cellCenter },
            { v: sanitizeCellValue(c.responsible || ''), s: st.cell },
        ]);
    }

    // Summary counts (merge label across cols 0-1 so text fits: 8+22=30 chars)
    const summaryLabelStyle = { font: { bold: true, sz: 9, name: 'Arial' } };
    const hCount = allCauseRows.filter(r => r.cause.ap === ActionPriority.HIGH).length;
    const mCount = allCauseRows.filter(r => r.cause.ap === ActionPriority.MEDIUM).length;
    const lCount = allCauseRows.filter(r => r.cause.ap === ActionPriority.LOW).length;
    rows.push(Array(totalCols).fill(''));
    const summaryItems: [string, number, any][] = [
        ['AP Alto (H):', hCount, st.apH],
        ['AP Medio (M):', mCount, st.apM],
        ['AP Bajo (L):', lCount, st.apL],
        ['Total Causas:', allCauseRows.length, st.cellCenter],
    ];
    for (const [label, count, countStyle] of summaryItems) {
        rows.push([{ v: label, s: summaryLabelStyle }, { v: '', s: summaryLabelStyle }, { v: count, s: countStyle }]);
        merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 1 } });
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = RESUMEN_AP_COL_WIDTHS.map(w => ({ wch: w }));
    ws['!merges'] = merges;

    XLSX.utils.book_append_sheet(wb, ws, 'Resumen AP');

    const safeName = sanitizeFilename(doc.header.subject || doc.header.partNumber || 'Documento', { allowSpaces: true });
    downloadWorkbook(wb, `AMFE Resumen - ${safeName}.xlsx`);
}

// ============================================================================
// EXPORT 3: PLAN DE ACCIONES — Open actions for tracking
// ============================================================================

export function exportAmfePlanAcciones(doc: AmfeDocument): void {
    const wb = XLSX.utils.book_new();
    const allCauseRows = flattenCauseRows(doc);
    const actionItems = allCauseRows.filter(r =>
        r.cause.status !== 'Completado' && r.cause.status !== 'Cancelado' &&
        (r.cause.preventionAction || r.cause.detectionAction)
    );

    const headers = [
        'Operacion', 'Modo de Falla', 'Causa Raiz', 'AP',
        'Accion Preventiva', 'Accion Detectiva', 'Responsable',
        'Fecha Obj.', 'Estado', 'Accion Tomada', 'Fecha Real',
    ];
    const { rows: metaRows, merges } = buildMetadataRows(doc, PLAN_ACCIONES_COL_WIDTHS);
    const rows: any[][] = [...metaRows];
    const totalCols = PLAN_ACCIONES_COL_WIDTHS.length;

    // Subtitle (merged so it doesn't get truncated)
    const subtitleRow: any[] = [{ v: 'Seguimiento de Acciones', s: { font: { bold: true, sz: 11, name: 'Arial' } } }];
    for (let i = 1; i < totalCols; i++) subtitleRow.push('');
    rows.push(subtitleRow);
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 3 } });
    rows.push(Array(totalCols).fill(''));

    // Table header
    rows.push(headers.map(h => ({ v: h, s: st.colHeader })));

    // Sort by status: Pendiente first, then En Proceso
    const sorted = [...actionItems].sort((a, b) => {
        const order: Record<string, number> = { 'Pendiente': 0, 'En Proceso': 1 };
        return (order[a.cause.status] ?? 2) - (order[b.cause.status] ?? 2);
    });

    for (const item of sorted) {
        const f = item.failure;
        const c = item.cause;
        rows.push([
            { v: sanitizeCellValue(`${item.opNumber} - ${item.opName}`), s: st.cell },
            { v: sanitizeCellValue(f.description), s: st.cell },
            { v: sanitizeCellValue(c.cause), s: st.cell },
            { v: c.ap ?? '', s: getApStyle(String(c.ap || '')) },
            { v: sanitizeCellValue(c.preventionAction), s: st.cell },
            { v: sanitizeCellValue(c.detectionAction), s: st.cell },
            { v: sanitizeCellValue(c.responsible), s: st.cell },
            { v: sanitizeCellValue(c.targetDate), s: st.cellCenter },
            { v: sanitizeCellValue(c.status), s: st.cellCenter },
            { v: sanitizeCellValue(c.actionTaken), s: st.cell },
            { v: sanitizeCellValue(c.completionDate), s: st.cellCenter },
        ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = PLAN_ACCIONES_COL_WIDTHS.map(w => ({ wch: w }));
    ws['!merges'] = merges;

    XLSX.utils.book_append_sheet(wb, ws, 'Plan de Acciones');

    const safeName = sanitizeFilename(doc.header.subject || doc.header.partNumber || 'Documento', { allowSpaces: true });
    downloadWorkbook(wb, `AMFE Acciones - ${safeName}.xlsx`);
}
