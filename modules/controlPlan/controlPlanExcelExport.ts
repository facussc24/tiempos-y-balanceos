/**
 * Control Plan Excel Export — I-AC-005.2
 *
 * Exports the Control Plan matching the company reference format exactly.
 * Column names, order, and styling replicate the official template.
 *
 * Features:
 *  - Compact 3-pair metadata with merged label cells (never truncated)
 *  - Phase checkboxes (☒/☐) per AIAG template
 *  - Vertical merging for same-process groups (cols 0, 2, 3) and componentMaterial (col 1)
 *  - componentMaterial text rotated 90° vertical, narrow column
 *  - Explicit row heights for professional appearance
 */

import XLSX from 'xlsx-js-style';
import { ControlPlanDocument, ControlPlanItem, CONTROL_PLAN_PHASES } from './controlPlanTypes';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';
import { downloadWorkbook, generateWorkbookBuffer } from '../../utils/excel';
import { truncateApplicableParts as truncateParts } from '../../utils/productFamilyAutoFill';

// ============================================================================
// CONSTANTS
// ============================================================================

const SGC_FORM_NUMBER = 'I-AC-005.2';

/**
 * Export column definition — labels match the company reference template exactly.
 * Order: N° Pieza/Proceso, Componente/Material (rotated), Nombre Proceso, Maquina, ...
 * Excludes controlProcedure (IT column not in export per rule).
 */
interface ExportColumnDef {
    key: keyof ControlPlanItem;
    label: string;
}

const EXPORT_COLUMNS: ExportColumnDef[] = [
    { key: 'processStepNumber',     label: 'N° PIEZA / PROCESO' },
    { key: 'componentMaterial',     label: 'COMPONENTE / MATERIAL' },
    { key: 'processDescription',    label: 'NOMBRE DEL PROCESO / DESCRIPCION DE LA OPERACIÓN' },
    { key: 'machineDeviceTool',     label: 'MAQUINA EQUIPAMIENTO HERRAMIENTA' },
    { key: 'characteristicNumber',  label: 'N°' },
    { key: 'productCharacteristic', label: 'PRODUCTO' },
    { key: 'processCharacteristic', label: 'PROCESO' },
    { key: 'specialCharClass',      label: 'CLASIF. CARAC. ESPEC.' },
    { key: 'specification',         label: 'ESPECIFICACIONES / TOLERANCIAS DE PRODUCTO / PROCESO' },
    { key: 'evaluationTechnique',   label: 'CALIBRES O TECNICAS DE EVALUACION' },
    { key: 'sampleSize',            label: 'TAM' },
    { key: 'sampleFrequency',       label: 'FREC' },
    { key: 'controlMethod',         label: 'METODOS DE CONTROL Y REGISTROS' },
    { key: 'reactionPlanOwner',     label: 'RESPONSABLES' },
    { key: 'reactionPlan',          label: 'PLAN DE REACCION ANTE DESCONTROL' },
];

/** Column groups for export — Proceso 4, Características 4, Métodos 7. */
const EXPORT_COLUMN_GROUPS: { label: string; colSpan: number }[] = [
    { label: 'Proceso',          colSpan: 4 },
    { label: 'Características',  colSpan: 4 },
    { label: 'Métodos',          colSpan: 7 },
];

/**
 * Dedicated column widths (wch) — 15 columns matching EXPORT_COLUMNS order.
 * Col 1 (Componente/Material) is narrow because text is rotated 90°.
 */
const CP_COL_WIDTHS: number[] = [
    10,   // 0:  N° PIEZA / PROCESO
     5,   // 1:  COMPONENTE / MATERIAL (narrow — text rotated 90°)
    28,   // 2:  NOMBRE DEL PROCESO / DESCRIPCION DE LA OPERACIÓN
    20,   // 3:  MAQUINA EQUIPAMIENTO HERRAMIENTA
     8,   // 4:  N°
    22,   // 5:  PRODUCTO
    22,   // 6:  PROCESO
    10,   // 7:  CLASIF. CARAC. ESPEC.
    23,   // 8:  ESPECIFICACIONES / TOLERANCIAS
    20,   // 9:  CALIBRES O TECNICAS DE EVALUACION
     6,   // 10: TAM
     6,   // 11: FREC
    20,   // 12: METODOS DE CONTROL Y REGISTROS
    15,   // 13: RESPONSABLES
    23,   // 14: PLAN DE REACCION ANTE DESCONTROL
];

/**
 * Metadata pair layout: 3 label-value pairs across 15 columns.
 *
 *   Pair 0: cols 0-4  (5 cols) → label 0-2, value 3-4
 *   Pair 1: cols 5-9  (5 cols) → label 5-6, value 7-9
 *   Pair 2: cols 10-14 (5 cols) → label 10-11, value 12-14
 */
const META_PAIRS = [
    { lStart: 0, lEnd: 2, vStart: 3, vEnd: 4 },
    { lStart: 5, lEnd: 6, vStart: 7, vEnd: 9 },
    { lStart: 10, lEnd: 11, vStart: 12, vEnd: 14 },
];

// ============================================================================
// STYLES — Standard Excel palette (looks hand-made)
// ============================================================================

const BORDER = {
    top: { style: 'thin' as const, color: { rgb: '000000' } },
    bottom: { style: 'thin' as const, color: { rgb: '000000' } },
    left: { style: 'thin' as const, color: { rgb: '000000' } },
    right: { style: 'thin' as const, color: { rgb: '000000' } },
};

const st = {
    title: {
        font: { bold: true, sz: 14, name: 'Arial' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    formRef: {
        font: { sz: 8, color: { rgb: '808080' }, name: 'Arial' },
        alignment: { horizontal: 'left' as const },
        border: BORDER,
    },
    phaseText: {
        font: { sz: 9, name: 'Arial' },
        alignment: { horizontal: 'right' as const },
        border: BORDER,
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
    /** Column header with 90° text rotation (for narrow Componente/Material column). */
    colHeaderRotated: {
        font: { bold: true, sz: 7, name: 'Arial' },
        fill: { fgColor: { rgb: 'D9E2F3' } },
        alignment: { textRotation: 90, horizontal: 'center' as const, vertical: 'center' as const, wrapText: false },
        border: BORDER,
    },
    cell: {
        font: { sz: 9, name: 'Arial' },
        alignment: { vertical: 'top' as const, wrapText: true },
        border: BORDER,
    },
    cellCenter: {
        font: { sz: 9, name: 'Arial' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
        border: BORDER,
    },
    /** Vertically-merged group leader cell (centered vertically). */
    cellMerged: {
        font: { sz: 9, name: 'Arial' },
        alignment: { vertical: 'center' as const, wrapText: true },
        border: BORDER,
    },
    /** Data cell with 90° text rotation for componentMaterial column. */
    cellMaterialRotated: {
        font: { sz: 8, name: 'Arial' },
        alignment: { textRotation: 90, vertical: 'center' as const, horizontal: 'center' as const, wrapText: false },
        border: BORDER,
    },
    /** Merged leader cell with 90° rotation for componentMaterial. */
    cellMaterialMerged: {
        font: { sz: 8, name: 'Arial' },
        alignment: { textRotation: 90, vertical: 'center' as const, horizontal: 'center' as const, wrapText: false },
        border: BORDER,
    },
    ccBadge: {
        font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C0006' } },
        fill: { fgColor: { rgb: 'FFC7CE' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    scBadge: {
        font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C6500' } },
        fill: { fgColor: { rgb: 'FFEB9C' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    ptcBadge: {
        font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '1D4ED8' } },
        fill: { fgColor: { rgb: 'DBEAFE' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
};

function getSpecialCharStyle(value: string) {
    const upper = (value || '').toUpperCase().trim();
    if (upper === 'CC') return st.ccBadge;
    if (upper === 'SC') return st.scBadge;
    if (upper === 'PTC') return st.ptcBadge;
    return st.cellCenter;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a metadata row with 3 label-value pairs using META_PAIRS layout.
 * Every cell gets an explicit style with borders — no bare `{}` cells.
 */
function buildMetaRow(
    info: [string, string, string, string, string, string],
    totalCols: number,
    rowIdx: number,
    merges: XLSX.Range[],
): any[] {
    // Initialize ALL cells with border (ensures consistent rendering in merges)
    const row: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: { border: BORDER } }));

    for (let p = 0; p < 3; p++) {
        const label = info[p * 2];
        const value = info[p * 2 + 1];
        const { lStart, lEnd, vStart, vEnd } = META_PAIRS[p];

        if (label) {
            // Label cells — gray background
            row[lStart] = { v: label, s: st.metaLabel };
            for (let c = lStart + 1; c <= lEnd; c++) row[c] = { v: '', s: st.metaLabel };

            // Value cells
            row[vStart] = { v: sanitizeCellValue(value), s: st.metaValue };
            for (let c = vStart + 1; c <= vEnd; c++) row[c] = { v: '', s: st.metaValue };
        }

        // Merge label cells (always, even for empty pairs — ensures clean borders)
        if (lEnd > lStart) {
            merges.push({ s: { r: rowIdx, c: lStart }, e: { r: rowIdx, c: lEnd } });
        }
        // Merge value cells
        if (vEnd > vStart) {
            merges.push({ s: { r: rowIdx, c: vStart }, e: { r: rowIdx, c: vEnd } });
        }
    }

    return row;
}

/**
 * Compute process row groups for vertical merging.
 * Consecutive items with the same non-empty processStepNumber are grouped.
 * Returns array of { startIdx, span } entries.
 */
function computeProcessGroups(items: ControlPlanItem[]): { startIdx: number; span: number }[] {
    const groups: { startIdx: number; span: number }[] = [];
    let i = 0;
    while (i < items.length) {
        const psn = (items[i].processStepNumber || '').trim();
        if (!psn) { i++; continue; }
        let j = i + 1;
        while (j < items.length && (items[j].processStepNumber || '').trim() === psn) {
            j++;
        }
        const span = j - i;
        if (span > 1) {
            groups.push({ startIdx: i, span });
        }
        i = j;
    }
    return groups;
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Build the Control Plan workbook (no download).
 */
export function buildControlPlanWorkbook(doc: ControlPlanDocument): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();
    const rows: any[][] = [];
    const h = doc.header;
    const totalCols = EXPORT_COLUMNS.length; // 15
    const merges: XLSX.Range[] = [];

    // ── Row 0: Title ──────────────────────────────────────────────
    const titleRow: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: st.title }));
    titleRow[0] = { v: 'PLAN DE CONTROL', s: st.title };
    rows.push(titleRow);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

    // ── Row 1: Form reference (left) + Phase checkboxes (right) ──
    const phaseStr = CONTROL_PLAN_PHASES
        .map(p => `${p.value === h.phase ? '☒' : '☐'} ${p.label}`)
        .join('    ');

    const formPhaseRow: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: { border: BORDER } }));
    formPhaseRow[0] = { v: `Formulario ${SGC_FORM_NUMBER}`, s: st.formRef };
    for (let c = 1; c <= 4; c++) formPhaseRow[c] = { v: '', s: st.formRef };
    formPhaseRow[5] = { v: phaseStr, s: st.phaseText };
    for (let c = 6; c < totalCols; c++) formPhaseRow[c] = { v: '', s: st.phaseText };
    rows.push(formPhaseRow);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 4 } });
    merges.push({ s: { r: 1, c: 5 }, e: { r: 1, c: totalCols - 1 } });

    // ── Rows 2-7: Header metadata (3 label-value pairs per row) ──
    const headerInfo: [string, string, string, string, string, string][] = [
        ['Nro. Plan de Control', h.controlPlanNumber, 'Nro. Pieza',            h.partNumber,             'Fecha',              h.date],
        ['Pieza',                h.partName,           'Nivel de Cambio',       h.latestChangeLevel,      'Revision',           h.revision],
        ['Organizacion / Planta', h.organization,      'Proveedor',             h.supplier,               'Cod. Proveedor',     h.supplierCode],
        ['Contacto / Telefono', h.keyContactPhone,     'Cliente',               h.client,                 'Responsable',        h.responsible],
        ['Equipo',              h.coreTeam,             'AMFE Vinculado',        h.linkedAmfeProject,      '',                   ''],
        ['Aprob. Ingenieria',   h.approvedBy,           'Aprob. Planta',          h.plantApproval,          'Aprob. Cliente/Fecha', h.customerApproval],
        ...(h.applicableParts?.trim() ? [['Piezas Aplicables', truncateParts(h.applicableParts).replace(/\n/g, ' · '), '', '', '', ''] as [string, string, string, string, string, string]] : []),
    ];

    for (const info of headerInfo) {
        const rowIdx = rows.length;
        rows.push(buildMetaRow(info, totalCols, rowIdx, merges));
    }

    // ── Empty row separator ──
    rows.push(Array(totalCols).fill(''));
    const separatorIdx = rows.length - 1;

    // ── Group header row (Proceso / Características / Métodos) ──
    const groupRow: any[] = [];
    for (const group of EXPORT_COLUMN_GROUPS) {
        groupRow.push({ v: group.label, s: st.groupHeader });
        for (let i = 1; i < group.colSpan; i++) {
            groupRow.push({ v: '', s: st.groupHeader });
        }
    }
    rows.push(groupRow);
    const groupRowIdx = rows.length - 1;

    let colOff = 0;
    for (const group of EXPORT_COLUMN_GROUPS) {
        if (group.colSpan > 1) {
            merges.push({
                s: { r: groupRowIdx, c: colOff },
                e: { r: groupRowIdx, c: colOff + group.colSpan - 1 },
            });
        }
        colOff += group.colSpan;
    }

    // ── Column headers — col 1 (material) uses rotated style ──
    rows.push(EXPORT_COLUMNS.map((col, idx) => {
        if (idx === 1) return { v: col.label, s: st.colHeaderRotated };
        return { v: col.label, s: st.colHeader };
    }));
    const colHeaderIdx = rows.length - 1;

    // ── Data rows (sorted numerically by operation, then grouped by material) ──
    const sortedItems = [...doc.items].sort((a, b) => {
        const numA = parseInt(a.processStepNumber) || 0;
        const numB = parseInt(b.processStepNumber) || 0;
        if (numA !== numB) return numA - numB;
        // Sub-sort: items with material first, grouped by material name
        const matA = a.componentMaterial || '';
        const matB = b.componentMaterial || '';
        return matA.localeCompare(matB);
    });
    const dataStartIdx = rows.length;
    for (const item of sortedItems) {
        rows.push(EXPORT_COLUMNS.map(col => {
            const value = (item[col.key] as string) || '';
            if (col.key === 'specialCharClass') {
                return { v: sanitizeCellValue(value), s: getSpecialCharStyle(value) };
            }
            if (col.key === 'componentMaterial') {
                return { v: sanitizeCellValue(value), s: st.cellMaterialRotated };
            }
            return { v: sanitizeCellValue(value), s: st.cell };
        }));
    }

    // ── Vertical merging for same-process groups (cols 0, 2, 3) ──
    // Col 0 = N° Pieza/Proceso, Col 2 = Nombre Proceso, Col 3 = Maquina
    // Col 1 (Componente/Material) has its own sub-merge logic below.
    const processGroups = computeProcessGroups(sortedItems);
    for (const group of processGroups) {
        for (const col of [0, 2, 3]) {
            // Merge from first row to last row of the group
            merges.push({
                s: { r: dataStartIdx + group.startIdx, c: col },
                e: { r: dataStartIdx + group.startIdx + group.span - 1, c: col },
            });

            // Apply vertical-center style to the leader cell
            const leaderRow = rows[dataStartIdx + group.startIdx];
            leaderRow[col] = { ...leaderRow[col], s: st.cellMerged };

            // Clear duplicate text in follower cells
            for (let r = 1; r < group.span; r++) {
                const rowIdx = dataStartIdx + group.startIdx + r;
                if (rowIdx >= rows.length) break;
                const followerRow = rows[rowIdx];
                followerRow[col] = { v: '', s: st.cellMerged };
            }
        }

        // ── Col 1 (Componente/Material): sub-merge within process group ──
        const materialColIdx = 1;
        let subStart = group.startIdx;
        while (subStart < group.startIdx + group.span) {
            const mat = (sortedItems[subStart].componentMaterial || '').trim();
            if (!mat) { subStart++; continue; } // skip empty material cells
            let subEnd = subStart + 1;
            while (subEnd < group.startIdx + group.span &&
                   (sortedItems[subEnd].componentMaterial || '').trim() === mat) {
                subEnd++;
            }
            const subSpan = subEnd - subStart;
            if (subSpan > 1) {
                merges.push({
                    s: { r: dataStartIdx + subStart, c: materialColIdx },
                    e: { r: dataStartIdx + subEnd - 1, c: materialColIdx },
                });
                const leader = rows[dataStartIdx + subStart];
                leader[materialColIdx] = { ...leader[materialColIdx], s: st.cellMaterialMerged };
                for (let r = subStart + 1; r < subEnd; r++) {
                    const rowIdx = dataStartIdx + r;
                    if (rowIdx >= rows.length) break;
                    rows[rowIdx][materialColIdx] = { v: '', s: st.cellMaterialMerged };
                }
            }
            subStart = subEnd;
        }
    }

    // ── Sheet assembly ──
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = CP_COL_WIDTHS.map(w => ({ wch: w }));
    ws['!merges'] = merges;

    // ── Row heights — dynamic for data rows based on content length ──
    ws['!rows'] = rows.map((row, idx) => {
        if (idx === 0) return { hpt: 30 };            // Title
        if (idx === 1) return { hpt: 18 };             // Form ref + phase
        if (idx >= 2 && idx < separatorIdx) return { hpt: 18 };  // Metadata (dynamic)
        if (idx === separatorIdx) return { hpt: 6 };    // Thin separator
        if (idx === groupRowIdx) return { hpt: 28 };    // Group headers
        if (idx === colHeaderIdx) return { hpt: 60 };   // Column headers (taller for rotated text)
        // Data rows: calculate height from longest cell text vs its column width
        if (idx >= dataStartIdx && Array.isArray(row)) {
            let maxLines = 1;
            for (let c = 0; c < row.length; c++) {
                if (c === 1) continue; // skip material col (rotated text doesn't affect row height)
                const text = String(row[c]?.v || '');
                if (!text) continue;
                const colW = CP_COL_WIDTHS[c] || 15;
                // ~1.2 chars/unit with Arial 9pt; account for word wrapping
                const charsPerLine = Math.max(8, Math.floor(colW * 1.2));
                const lines = Math.ceil(text.length / charsPerLine);
                maxLines = Math.max(maxLines, lines);
            }
            return { hpt: Math.min(80, Math.max(15, maxLines * 13)) };
        }
        return { hpt: 15 };
    });

    // Auto-filter on column header row for easy navigation
    // 15 columns (A-O), totalCols-1 = 14 → 'O'
    const lastColLetter = String.fromCharCode(65 + totalCols - 1);
    ws['!autofilter'] = { ref: `A${colHeaderIdx + 1}:${lastColLetter}${colHeaderIdx + 1}` };

    // Freeze panes at data start (headers stay visible while scrolling)
    ws['!freeze'] = { xSplit: 0, ySplit: dataStartIdx, topLeftCell: `A${dataStartIdx + 1}` };

    XLSX.utils.book_append_sheet(wb, ws, 'Plan de Control');

    return wb;
}

/**
 * Export Control Plan — builds workbook and triggers download dialog.
 */
export function exportControlPlan(doc: ControlPlanDocument): void {
    const wb = buildControlPlanWorkbook(doc);
    const safeName = sanitizeFilename(doc.header.partName || doc.header.partNumber || 'Documento', { allowSpaces: true });
    downloadWorkbook(wb, `Plan de Control - ${safeName}.xlsx`);
}

/**
 * Generate Control Plan Excel as Uint8Array buffer (for auto-export).
 */
export function generateCpExcelBuffer(doc: ControlPlanDocument): Uint8Array {
    return generateWorkbookBuffer(buildControlPlanWorkbook(doc));
}
