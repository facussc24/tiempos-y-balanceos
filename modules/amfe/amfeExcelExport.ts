/**
 * AMFE Excel Export
 *
 * Two export options:
 * 1. Resumen AP: Summary of High/Medium AP causes
 * 2. Plan de Acciones: Open action items for tracking meetings
 *
 * Uses xlsx-js-style for styled Excel output (same pattern as utils/excel.ts).
 *
 * Data model: rows are per-CAUSE (not per-failure).
 * Each cause row carries its parent failure context (FM, effects, S).
 */

import XLSX from 'xlsx-js-style';
import { AmfeDocument, AmfeFailure, AmfeCause, AmfeOperation, ActionPriority } from './amfeTypes';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';
import { logger } from '../../utils/logger';

// Re-export for backward compatibility (other modules may import from here)
export { sanitizeCellValue } from '../../utils/sanitizeCellValue';

// --- STYLES ---
const styles = {
    title: { font: { bold: true, sz: 14, color: { rgb: "1E3A8A" } } },
    headerH: {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Arial" },
        fill: { fgColor: { rgb: "DC2626" } },
        alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
        border: { top: { style: "thin" as const }, bottom: { style: "thin" as const }, left: { style: "thin" as const }, right: { style: "thin" as const } }
    },
    headerM: {
        font: { bold: true, color: { rgb: "000000" }, sz: 10, name: "Arial" },
        fill: { fgColor: { rgb: "FACC15" } },
        alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
        border: { top: { style: "thin" as const }, bottom: { style: "thin" as const }, left: { style: "thin" as const }, right: { style: "thin" as const } }
    },
    headerBlue: {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Arial" },
        fill: { fgColor: { rgb: "2563EB" } },
        alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
        border: { top: { style: "thin" as const }, bottom: { style: "thin" as const }, left: { style: "thin" as const }, right: { style: "thin" as const } }
    },
    cell: {
        font: { name: "Arial", sz: 9 },
        alignment: { vertical: "center" as const, wrapText: true },
        border: { top: { style: "thin" as const }, bottom: { style: "thin" as const }, left: { style: "thin" as const }, right: { style: "thin" as const } }
    },
    cellCenter: {
        font: { name: "Arial", sz: 9 },
        alignment: { horizontal: "center" as const, vertical: "center" as const },
        border: { top: { style: "thin" as const }, bottom: { style: "thin" as const }, left: { style: "thin" as const }, right: { style: "thin" as const } }
    },
    apH: {
        font: { bold: true, color: { rgb: "FFFFFF" }, name: "Arial", sz: 10 },
        fill: { fgColor: { rgb: "DC2626" } },
        alignment: { horizontal: "center" as const, vertical: "center" as const },
        border: { top: { style: "thin" as const }, bottom: { style: "thin" as const }, left: { style: "thin" as const }, right: { style: "thin" as const } }
    },
    apM: {
        font: { bold: true, color: { rgb: "000000" }, name: "Arial", sz: 10 },
        fill: { fgColor: { rgb: "FACC15" } },
        alignment: { horizontal: "center" as const, vertical: "center" as const },
        border: { top: { style: "thin" as const }, bottom: { style: "thin" as const }, left: { style: "thin" as const }, right: { style: "thin" as const } }
    },
    apL: {
        font: { bold: true, color: { rgb: "FFFFFF" }, name: "Arial", sz: 10 },
        fill: { fgColor: { rgb: "16A34A" } },
        alignment: { horizontal: "center" as const, vertical: "center" as const },
        border: { top: { style: "thin" as const }, bottom: { style: "thin" as const }, left: { style: "thin" as const }, right: { style: "thin" as const } }
    },
};

const getApStyle = (ap: string) => {
    switch (ap) {
        case ActionPriority.HIGH: return styles.apH;
        case ActionPriority.MEDIUM: return styles.apM;
        case ActionPriority.LOW: return styles.apL;
        default: return styles.cellCenter;
    }
};

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

/** Download workbook as .xlsx file (browser-safe, same as utils/excel.ts) */
function downloadWorkbook(wb: any, fileName: string): void {
    try {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
        logger.error('Error exporting AMFE Excel:', err);
        alert('Error al exportar Excel. Intente nuevamente.');
    }
}

/** Build header info rows for the first section */
function buildHeaderRows(doc: AmfeDocument): any[][] {
    const h = doc.header;
    return [
        [{ v: `AMFE VDA - ${h.subject || 'Sin Título'}`, s: styles.title }],
        [],
        [{ v: "AMFE No.:", s: { font: { bold: true } } }, sanitizeCellValue(h.amfeNumber), "", { v: "Confidencialidad:", s: { font: { bold: true } } }, sanitizeCellValue(h.confidentiality)],
        [{ v: "Organización:", s: { font: { bold: true } } }, sanitizeCellValue(h.organization), "", { v: "Cliente:", s: { font: { bold: true } } }, sanitizeCellValue(h.client)],
        [{ v: "Ubicación:", s: { font: { bold: true } } }, sanitizeCellValue(h.location), "", { v: "Nro. Pieza:", s: { font: { bold: true } } }, sanitizeCellValue(h.partNumber)],
        [{ v: "Responsable:", s: { font: { bold: true } } }, sanitizeCellValue(h.responsible), "", { v: "Resp. Proceso:", s: { font: { bold: true } } }, sanitizeCellValue(h.processResponsible)],
        [{ v: "Equipo:", s: { font: { bold: true } } }, sanitizeCellValue(h.team), "", { v: "Modelo/Año:", s: { font: { bold: true } } }, sanitizeCellValue(h.modelYear)],
        [{ v: "Fecha Inicio:", s: { font: { bold: true } } }, sanitizeCellValue(h.startDate), "", { v: "Fecha Rev.:", s: { font: { bold: true } } }, sanitizeCellValue(h.revDate)],
        [{ v: "Revision:", s: { font: { bold: true } } }, sanitizeCellValue(h.revision), "", { v: "Aprobado por:", s: { font: { bold: true } } }, sanitizeCellValue(h.approvedBy)],
        [{ v: "Alcance:", s: { font: { bold: true } } }, sanitizeCellValue(h.scope)],
        [],
    ];
}

/**
 * Export AMFE as Excel - Resumen AP (High/Medium priority causes summary)
 */
export function exportAmfeResumenAP(doc: AmfeDocument): void {
    const wb = XLSX.utils.book_new();
    const allCauseRows = flattenCauseRows(doc);
    const priorityCauseRows = allCauseRows.filter(r =>
        r.cause.ap === ActionPriority.HIGH || r.cause.ap === ActionPriority.MEDIUM
    );

    // --- Sheet 1: Resumen AP ---
    const rows: any[][] = [
        ...buildHeaderRows(doc),
        [{ v: `RESUMEN DE PRIORIDADES (${priorityCauseRows.length} items)`, s: { font: { bold: true, sz: 12 } } }],
        [],
    ];

    // Table header
    const headers = ["Op", "Paso", "Elemento 6M", "Función", "Modo de Falla", "Efecto Usr. Final", "Causa Raíz", "S", "O", "D", "AP", "No.Car.", "Car. Esp.", "Filtro", "Estado", "Responsable"];
    rows.push(headers.map(h => ({ v: h, s: styles.headerBlue })));

    // Sort: H first, then M
    const sorted = [...priorityCauseRows].sort((a, b) => {
        if (a.cause.ap === ActionPriority.HIGH && b.cause.ap !== ActionPriority.HIGH) return -1;
        if (a.cause.ap !== ActionPriority.HIGH && b.cause.ap === ActionPriority.HIGH) return 1;
        return Number(b.failure.severity) - Number(a.failure.severity);
    });

    for (const item of sorted) {
        const f = item.failure;
        const c = item.cause;
        rows.push([
            { v: sanitizeCellValue(item.opNumber), s: styles.cellCenter },
            { v: sanitizeCellValue(item.opName), s: styles.cell },
            { v: sanitizeCellValue(`${item.weType}: ${item.weName}`), s: styles.cell },
            { v: sanitizeCellValue(item.funcDescription), s: styles.cell },
            { v: sanitizeCellValue(f.description), s: styles.cell },
            { v: sanitizeCellValue(f.effectEndUser), s: styles.cell },
            { v: sanitizeCellValue(c.cause), s: styles.cell },
            { v: f.severity, s: styles.cellCenter },
            { v: c.occurrence, s: styles.cellCenter },
            { v: c.detection, s: styles.cellCenter },
            { v: c.ap, s: getApStyle(c.ap as string) },
            { v: sanitizeCellValue(c.characteristicNumber || '-'), s: styles.cellCenter },
            { v: sanitizeCellValue(c.specialChar || '-'), s: styles.cellCenter },
            { v: sanitizeCellValue(c.filterCode || '-'), s: styles.cellCenter },
            { v: sanitizeCellValue(c.status || '-'), s: styles.cellCenter },
            { v: sanitizeCellValue(c.responsible || '-'), s: styles.cell },
        ]);
    }

    // Summary counts (by cause)
    const hCount = allCauseRows.filter(r => r.cause.ap === ActionPriority.HIGH).length;
    const mCount = allCauseRows.filter(r => r.cause.ap === ActionPriority.MEDIUM).length;
    const lCount = allCauseRows.filter(r => r.cause.ap === ActionPriority.LOW).length;
    rows.push([]);
    rows.push([{ v: "Resumen:", s: { font: { bold: true } } }]);
    rows.push([{ v: "AP Alto (H):", s: { font: { bold: true } } }, { v: hCount, s: styles.apH }]);
    rows.push([{ v: "AP Medio (M):", s: { font: { bold: true } } }, { v: mCount, s: styles.apM }]);
    rows.push([{ v: "AP Bajo (L):", s: { font: { bold: true } } }, { v: lCount, s: styles.apL }]);
    rows.push([{ v: "Total Causas:", s: { font: { bold: true } } }, allCauseRows.length]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
        { wch: 8 }, { wch: 25 }, { wch: 20 }, { wch: 25 },
        { wch: 30 }, { wch: 30 }, { wch: 30 },
        { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 6 },
        { wch: 10 }, { wch: 8 }, { wch: 8 },
        { wch: 14 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Resumen AP");

    const safeName = sanitizeFilename(doc.header.subject || 'Export', { allowSpaces: true });
    downloadWorkbook(wb, `AMFE_Resumen_${safeName}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Export AMFE as Excel - Plan de Acciones (open actions for tracking)
 */
export function exportAmfePlanAcciones(doc: AmfeDocument): void {
    const wb = XLSX.utils.book_new();
    const allCauseRows = flattenCauseRows(doc);
    const actionItems = allCauseRows.filter(r =>
        r.cause.status !== 'Completado' && r.cause.status !== 'Cancelado' &&
        (r.cause.preventionAction || r.cause.detectionAction)
    );

    const rows: any[][] = [
        ...buildHeaderRows(doc),
        [{ v: `PLAN DE ACCIONES ABIERTAS (${actionItems.length} items)`, s: { font: { bold: true, sz: 12 } } }],
        [],
    ];

    const headers = ["Op", "Modo de Falla", "Causa Raíz", "AP", "Acción Preventiva", "Acción Detectiva", "Responsable", "Fecha Obj.", "Estado", "Acción Tomada", "Fecha Real"];
    rows.push(headers.map(h => ({ v: h, s: styles.headerBlue })));

    // Sort by status: Pendiente first, then En Proceso
    const sorted = [...actionItems].sort((a, b) => {
        const order: Record<string, number> = { 'Pendiente': 0, 'En Proceso': 1 };
        return (order[a.cause.status] ?? 2) - (order[b.cause.status] ?? 2);
    });

    for (const item of sorted) {
        const f = item.failure;
        const c = item.cause;
        rows.push([
            { v: sanitizeCellValue(`${item.opNumber} - ${item.opName}`), s: styles.cell },
            { v: sanitizeCellValue(f.description), s: styles.cell },
            { v: sanitizeCellValue(c.cause), s: styles.cell },
            { v: c.ap, s: getApStyle(c.ap as string) },
            { v: sanitizeCellValue(c.preventionAction), s: styles.cell },
            { v: sanitizeCellValue(c.detectionAction), s: styles.cell },
            { v: sanitizeCellValue(c.responsible), s: styles.cell },
            { v: sanitizeCellValue(c.targetDate), s: styles.cellCenter },
            { v: sanitizeCellValue(c.status), s: styles.cellCenter },
            { v: sanitizeCellValue(c.actionTaken), s: styles.cell },
            { v: sanitizeCellValue(c.completionDate), s: styles.cellCenter },
        ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
        { wch: 25 }, { wch: 30 }, { wch: 30 }, { wch: 6 },
        { wch: 35 }, { wch: 35 }, { wch: 18 },
        { wch: 12 }, { wch: 14 }, { wch: 35 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Plan de Acciones");

    const safeNameA = sanitizeFilename(doc.header.subject || 'Export', { allowSpaces: true });
    downloadWorkbook(wb, `AMFE_Acciones_${safeNameA}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
