/**
 * PFD Excel Export
 *
 * Styled Excel export for Process Flow Diagram documents.
 * Uses xlsx-js-style for formatting.
 *
 * C3-N2: Disposition column (rework/scrap/sort) replacing old Retrabajo.
 */

import XLSX from 'xlsx-js-style';
import type { PfdDocument, RejectDisposition } from './pfdTypes';
import { PFD_STEP_TYPES } from './pfdTypes';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';
import { logger } from '../../utils/logger';

const styles = {
    title: { font: { bold: true, sz: 14, color: { rgb: '0E7490' } } },
    header: {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Arial' },
        fill: { fgColor: { rgb: '0891B2' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
        border: { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } },
    },
    cell: {
        font: { name: 'Arial', sz: 9 },
        alignment: { vertical: 'center' as const, wrapText: true },
        border: { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } },
    },
    cellCenter: {
        font: { name: 'Arial', sz: 9 },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } },
    },
    ccBadge: {
        font: { bold: true, color: { rgb: 'B91C1C' }, name: 'Arial', sz: 9 },
        fill: { fgColor: { rgb: 'FEE2E2' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } },
    },
    scBadge: {
        font: { bold: true, color: { rgb: '92400E' }, name: 'Arial', sz: 9 },
        fill: { fgColor: { rgb: 'FEF3C7' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } },
    },
    reworkBg: {
        font: { name: 'Arial', sz: 9 },
        fill: { fgColor: { rgb: 'FEF2F2' } },
        alignment: { vertical: 'center' as const, wrapText: true },
        border: { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } },
    },
    scrapBg: {
        font: { name: 'Arial', sz: 9 },
        fill: { fgColor: { rgb: 'FFF7ED' } },
        alignment: { vertical: 'center' as const, wrapText: true },
        border: { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } },
    },
    sortBg: {
        font: { name: 'Arial', sz: 9 },
        fill: { fgColor: { rgb: 'FEFCE8' } },
        alignment: { vertical: 'center' as const, wrapText: true },
        border: { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } },
    },
    externalBg: {
        font: { name: 'Arial', sz: 9 },
        fill: { fgColor: { rgb: 'EFF6FF' } },
        alignment: { vertical: 'center' as const, wrapText: true },
        border: { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } },
    },
};

function getSpecialCharStyle(value: string) {
    if (value === 'CC') return styles.ccBadge;
    if (value === 'SC') return styles.scBadge;
    return styles.cellCenter;
}

function getRowStyle(disposition: RejectDisposition, isExternal: boolean) {
    if (disposition === 'rework') return styles.reworkBg;
    if (disposition === 'scrap') return styles.scrapBg;
    if (disposition === 'sort') return styles.sortBg;
    if (isExternal) return styles.externalBg;
    return styles.cell;
}

/** Unicode approximations for ASME/AIAG PFD symbols */
const SYMBOL_UNICODE: Record<string, string> = {
    operation: '○',
    transport: '→',
    inspection: '□',
    storage: '▽',
    delay: 'D',
    decision: '◇',
    combined: '⊕',
};

/** C5-E2: Text-only label without unicode (better for Excel filters/sorts) */
function getStepTypeLabel(type: string): string {
    return PFD_STEP_TYPES.find(t => t.value === type)?.label || type;
}

/** C7-N1: Process phase labels */
const PHASE_LABELS = {
    'prototype': 'Prototipo',
    'pre-launch': 'Pre-serie',
    'production': 'Producción',
    '': 'Sin definir',
} as const;

/** C3-N2: Disposition label for Excel */
const DISPOSITION_LABEL: Record<RejectDisposition, string> = {
    none: '',
    rework: 'Retrabajo',
    scrap: 'Descarte',
    sort: 'Selección',
};

function downloadWorkbook(wb: XLSX.WorkBook, fileName: string): void {
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
        logger.error('PfdExcel', 'Export failed', {}, err instanceof Error ? err : undefined);
        alert('Error al exportar Excel. Intente nuevamente.');
    }
}

/**
 * Export PFD document to Excel.
 */
export function exportPfdExcel(doc: PfdDocument): void {
    const wb = XLSX.utils.book_new();
    const h = doc.header;

    const rows: unknown[][] = [
        [{ v: 'DIAGRAMA DE FLUJO DEL PROCESO', s: styles.title }],
        [{ v: 'Formulario: I-AC-005.1', s: { font: { sz: 8, color: { rgb: '6B7280' } } } }],
        [{ v: 'Nro. Pieza:', s: { font: { bold: true } } }, sanitizeCellValue(h.partNumber), '', { v: 'Nombre:', s: { font: { bold: true } } }, sanitizeCellValue(h.partName)],
        [{ v: 'Documento:', s: { font: { bold: true } } }, sanitizeCellValue(h.documentNumber), '', { v: 'Revisión:', s: { font: { bold: true } } }, sanitizeCellValue(h.revisionLevel)],
        [{ v: 'Cliente:', s: { font: { bold: true } } }, sanitizeCellValue(h.customerName), '', { v: 'Planta:', s: { font: { bold: true } } }, sanitizeCellValue(h.plantLocation)],
        [{ v: 'Elaboró:', s: { font: { bold: true } } }, sanitizeCellValue(h.preparedBy), '', { v: 'Aprobó:', s: { font: { bold: true } } }, sanitizeCellValue(h.approvedBy)],
        [{ v: 'Fecha:', s: { font: { bold: true } } }, sanitizeCellValue(h.revisionDate), '', { v: 'Modelo/Año:', s: { font: { bold: true } } }, sanitizeCellValue(h.modelYear)],
        [{ v: 'Cód. Proveedor:', s: { font: { bold: true } } }, sanitizeCellValue(h.supplierCode), '', { v: 'Nivel Ing.:', s: { font: { bold: true } } }, sanitizeCellValue(h.engineeringChangeLevel)],
        [{ v: 'Equipo:', s: { font: { bold: true } } }, sanitizeCellValue(h.coreTeam), '', { v: 'Contacto:', s: { font: { bold: true } } }, sanitizeCellValue(h.keyContact)],
        [{ v: 'Fase:', s: { font: { bold: true } } }, sanitizeCellValue(PHASE_LABELS[h.processPhase] || 'Sin definir'), '', { v: 'Exportado:', s: { font: { bold: true } } }, new Date().toLocaleDateString('es-AR')],
        [],
    ];

    // C9-N1: Updated headers — added "Línea" column for parallel flow branch info
    const headers = ['Nº Op.', 'Símbolo', 'Descripción', 'Línea', 'Máquina/Dispositivo', 'Caract. Producto', 'CC/SC Prod.', 'Caract. Proceso', 'CC/SC Proc.', 'Referencia', 'Área', 'Notas', 'Disposición', 'Detalle', 'Externo'];
    rows.push(headers.map(label => ({ v: label, s: styles.header })));

    // Data rows
    for (const step of doc.steps) {
        const rowS = getRowStyle(step.rejectDisposition, step.isExternalProcess);
        // E3: CC/SC visual — thick left border on first cell
        const hasCC = step.productSpecialChar === 'CC' || step.processSpecialChar === 'CC';
        const hasSC = !hasCC && (step.productSpecialChar === 'SC' || step.processSpecialChar === 'SC');
        const ccScLeftBorder = hasCC
            ? { left: { style: 'thick' as const, color: { rgb: 'EF4444' } } }
            : hasSC
            ? { left: { style: 'thick' as const, color: { rgb: 'F59E0B' } } }
            : {};
        const firstCellBorder = { ...rowS.border, ...ccScLeftBorder };

        // C3-N2: disposition detail
        const dispLabel = DISPOSITION_LABEL[step.rejectDisposition];
        let dispDetail = '';
        if (step.rejectDisposition === 'rework' && step.reworkReturnStep) {
            dispDetail = `Retorno a: ${step.reworkReturnStep}`;
        } else if ((step.rejectDisposition === 'scrap' || step.rejectDisposition === 'sort') && step.scrapDescription) {
            dispDetail = step.scrapDescription;
        }

        // C9-N1: Branch label for parallel flow
        const branchLabel = step.branchId
            ? (step.branchLabel || `Línea ${step.branchId}`)
            : '';

        rows.push([
            { v: sanitizeCellValue(step.stepNumber), s: { ...rowS, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: firstCellBorder } },
            { v: sanitizeCellValue(getStepTypeLabel(step.stepType)), s: { ...rowS, alignment: { horizontal: 'center' as const, vertical: 'center' as const } } },
            { v: sanitizeCellValue(step.description), s: rowS },
            { v: sanitizeCellValue(branchLabel), s: styles.cellCenter },
            { v: sanitizeCellValue(step.machineDeviceTool), s: rowS },
            { v: sanitizeCellValue(step.productCharacteristic), s: rowS },
            { v: sanitizeCellValue(step.productSpecialChar === 'none' ? '' : step.productSpecialChar), s: getSpecialCharStyle(step.productSpecialChar) },
            { v: sanitizeCellValue(step.processCharacteristic), s: rowS },
            { v: sanitizeCellValue(step.processSpecialChar === 'none' ? '' : step.processSpecialChar), s: getSpecialCharStyle(step.processSpecialChar) },
            { v: sanitizeCellValue(step.reference), s: rowS },
            { v: sanitizeCellValue(step.department), s: rowS },
            { v: sanitizeCellValue(step.notes), s: rowS },
            { v: sanitizeCellValue(dispLabel), s: styles.cellCenter },
            { v: sanitizeCellValue(dispDetail), s: rowS },
            { v: step.isExternalProcess ? 'Sí' : '', s: styles.cellCenter },
        ]);
    }

    // Summary
    rows.push([]);
    rows.push([{ v: `Total: ${doc.steps.length} ${doc.steps.length === 1 ? 'paso' : 'pasos'}`, s: { font: { bold: true } } }]);

    // Symbol legend
    rows.push([]);
    rows.push([{ v: 'LEYENDA DE SÍMBOLOS:', s: { font: { bold: true, sz: 9, color: { rgb: '6B7280' } } } }]);
    for (const st of PFD_STEP_TYPES) {
        const sym = SYMBOL_UNICODE[st.value] || '';
        rows.push([
            { v: sym, s: { font: { name: 'Segoe UI Symbol', sz: 12 }, alignment: { horizontal: 'center' as const, vertical: 'center' as const } } },
            { v: st.label, s: { font: { name: 'Arial', sz: 9 }, alignment: { vertical: 'center' as const } } },
        ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    // C9-N1: Updated widths with Línea column
    ws['!cols'] = [
        { wch: 10 }, { wch: 16 }, { wch: 35 }, { wch: 14 }, { wch: 25 },
        { wch: 25 }, { wch: 10 }, { wch: 25 }, { wch: 10 },
        { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 10 },
    ];

    // C4-E1: Freeze panes — header row stays visible when scrolling
    // Rows 0-10 = metadata (title, form#, 8 metadata rows, blank), row 11 = column headers
    ws['!freeze'] = { xSplit: 0, ySplit: 12, topLeftCell: 'A13' };

    XLSX.utils.book_append_sheet(wb, ws, 'Diagrama de Flujo');

    const safeName = sanitizeFilename(h.partName || h.partNumber || h.documentNumber || 'Documento', { allowSpaces: true });
    downloadWorkbook(wb, `PFD_${safeName}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
