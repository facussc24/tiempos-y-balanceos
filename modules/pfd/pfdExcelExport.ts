/**
 * PFD Excel Export — I-AC-005.1
 *
 * Styled Excel export for Process Flow Diagram documents.
 * Styling matches manually-created Excel templates (standard Excel palette).
 *
 * C3-N2: Disposition column (rework/scrap/sort).
 */

import XLSX from 'xlsx-js-style';
import type { PfdDocument, PfdStep, RejectDisposition } from './pfdTypes';
import { PFD_STEP_TYPES, SGC_FORM_NUMBER } from './pfdTypes';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';
import { downloadWorkbook } from '../../utils/excel';
import { truncateApplicableParts as truncateParts } from '../../utils/productFamilyAutoFill';

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
    colHeader: {
        font: { bold: true, sz: 8, name: 'Arial' },
        fill: { fgColor: { rgb: 'D9E2F3' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
        border: BORDER,
    },
    cell: {
        font: { name: 'Arial', sz: 9 },
        alignment: { vertical: 'top' as const, wrapText: true },
        border: BORDER,
    },
    cellCenter: {
        font: { name: 'Arial', sz: 9 },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    ccBadge: {
        font: { bold: true, name: 'Arial', sz: 9, color: { rgb: '9C0006' } },
        fill: { fgColor: { rgb: 'FFC7CE' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    scBadge: {
        font: { bold: true, name: 'Arial', sz: 9, color: { rgb: '9C6500' } },
        fill: { fgColor: { rgb: 'FFEB9C' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    separator: {
        font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '333333' } },
        fill: { fgColor: { rgb: 'F2F2F2' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    reworkRow: {
        font: { name: 'Arial', sz: 9 },
        fill: { fgColor: { rgb: 'FFF2CC' } },
        alignment: { vertical: 'top' as const, wrapText: true },
        border: BORDER,
    },
};

// ============================================================================
// HELPERS
// ============================================================================

function getSpecialCharStyle(value: string) {
    if (value === 'CC') return st.ccBadge;
    if (value === 'SC') return st.scBadge;
    return st.cellCenter;
}

function getStepTypeLabel(type: string): string {
    return PFD_STEP_TYPES.find(t => t.value === type)?.label || type;
}

const PHASE_LABELS: Record<string, string> = {
    'prototype': 'Prototipo',
    'pre-launch': 'Pre-serie',
    'production': 'Produccion',
    '': '',
};

const DISPOSITION_LABEL: Record<RejectDisposition, string> = {
    none: '',
    rework: 'Retrabajo',
    scrap: 'Descarte',
    sort: 'Seleccion',
};

/** Unicode symbols for ASME/AIAG PFD step types */
const SYMBOL_MAP: Record<string, string> = {
    operation: 'O',
    transport: 'T',
    inspection: 'I',
    storage: 'A',
    delay: 'D',
    decision: 'X',
    combined: 'O+I',
};

// ============================================================================
// EXPORT
// ============================================================================

export function exportPfdExcel(doc: PfdDocument): void {
    const wb = XLSX.utils.book_new();
    const h = doc.header;

    // Column headers
    const headers = [
        'Nro Op.', 'Tipo', 'Descripción', 'Línea', 'Máquina / Dispositivo',
        'Caract. Producto', 'CC/SC Prod.', 'Caract. Proceso', 'CC/SC Proc.',
        'Referencia', 'Área', 'Notas', 'Disposición', 'Detalle', 'Externo',
    ];
    const totalCols = headers.length;
    const merges: XLSX.Range[] = [];

    // --- Header section ---
    const rows: any[][] = [];

    // Row 0: Title (compact — within metadata columns, not full table width)
    const pfdMetaEnd = Math.min(7, totalCols - 1);
    const titleRow: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: {} }));
    titleRow[0] = { v: 'DIAGRAMA DE FLUJO DEL PROCESO', s: st.title };
    for (let i = 1; i <= pfdMetaEnd; i++) titleRow[i] = { v: '', s: st.title };
    rows.push(titleRow);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: pfdMetaEnd } });

    // Row 1: Form reference (compact)
    const formRow: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: {} }));
    formRow[0] = { v: `Formulario ${SGC_FORM_NUMBER}`, s: st.formRef };
    rows.push(formRow);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: pfdMetaEnd } });

    // Metadata rows — compact layout using first ~8 columns
    const metaPairs: [string, string, string, string][] = [
        ['Nro. Pieza', h.partNumber, 'Nombre', h.partName],
        ['Documento', h.documentNumber, 'Revision', h.revisionLevel],
        ['Cliente', h.customerName, 'Planta', h.plantLocation],
        ['Elaboro', h.preparedBy, 'Aprobo', h.approvedBy],
        ['Fecha', h.revisionDate, 'Modelo / Año', h.modelYear],
        ['Cod. Proveedor', h.supplierCode, 'Nivel Ing.', h.engineeringChangeLevel],
        ['Equipo', h.coreTeam, 'Contacto', h.keyContact],
        ['Fase', PHASE_LABELS[h.processPhase] || '', '', ''],
        ...(h.applicableParts?.trim() ? [['Piezas Aplicables', truncateParts(h.applicableParts).replace(/\n/g, ' · '), '', ''] as [string, string, string, string]] : []),
    ];

    const pfdColWidths = [8, 16, 30, 12, 22, 22, 8, 22, 8, 14, 10, 18, 10, 18, 8];
    const MIN_LBL = 16;

    // Compact: use only first ~8 columns for metadata
    const metaEnd = Math.min(7, totalCols - 1);
    const splitCol = Math.min(4, Math.floor((metaEnd + 1) / 2));

    // Left label: merge from col 0 until width >= MIN_LBL
    let leftLabelEnd = 0;
    { let w = pfdColWidths[0]; while (w < MIN_LBL && leftLabelEnd < splitCol - 2) { leftLabelEnd++; w += pfdColWidths[leftLabelEnd]; } }

    // Right label: merge from splitCol until width >= MIN_LBL
    let rightLabelEnd = splitCol;
    { let w = pfdColWidths[splitCol]; while (w < MIN_LBL && rightLabelEnd < metaEnd - 1) { rightLabelEnd++; w += pfdColWidths[rightLabelEnd]; } }

    const leftValueStart = leftLabelEnd + 1;
    const leftValueEnd = splitCol - 1;
    const rightValueStart = rightLabelEnd + 1;
    const rightValueEnd = metaEnd;

    for (let i = 0; i < metaPairs.length; i++) {
        const [lbl1, val1, lbl2, val2] = metaPairs[i];
        const rowIdx = rows.length;
        const row: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: {} }));

        // Left label
        row[0] = { v: lbl1, s: st.metaLabel };
        for (let c = 1; c <= leftLabelEnd; c++) row[c] = { v: '', s: st.metaLabel };
        if (leftLabelEnd > 0) merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: leftLabelEnd } });

        // Left value
        row[leftValueStart] = { v: sanitizeCellValue(val1), s: st.metaValue };
        for (let c = leftValueStart + 1; c <= leftValueEnd; c++) row[c] = { v: '', s: st.metaValue };
        if (leftValueEnd > leftValueStart) merges.push({ s: { r: rowIdx, c: leftValueStart }, e: { r: rowIdx, c: leftValueEnd } });

        // Right label + value
        if (lbl2) {
            row[splitCol] = { v: lbl2, s: st.metaLabel };
            for (let c = splitCol + 1; c <= rightLabelEnd; c++) row[c] = { v: '', s: st.metaLabel };
            if (rightLabelEnd > splitCol) merges.push({ s: { r: rowIdx, c: splitCol }, e: { r: rowIdx, c: rightLabelEnd } });

            if (rightValueStart <= rightValueEnd) {
                row[rightValueStart] = { v: sanitizeCellValue(val2), s: st.metaValue };
                for (let c = rightValueStart + 1; c <= rightValueEnd; c++) row[c] = { v: '', s: st.metaValue };
                if (rightValueEnd > rightValueStart) merges.push({ s: { r: rowIdx, c: rightValueStart }, e: { r: rowIdx, c: rightValueEnd } });
            }
        }

        rows.push(row);
    }

    // Empty separator
    rows.push(Array(totalCols).fill(''));

    // Column headers
    rows.push(headers.map(label => ({ v: label, s: st.colHeader })));
    const dataStartRow = rows.length;

    // --- Data rows ---
    for (let i = 0; i < doc.steps.length; i++) {
        const step = doc.steps[i];
        const prev = i > 0 ? doc.steps[i - 1] : null;

        const disposition: RejectDisposition = step.rejectDisposition || 'none';

        // Parallel flow separator: entering
        const enteringParallel = step.branchId && (!prev || !prev.branchId);
        if (enteringParallel) {
            const branchNames: string[] = [];
            const seen = new Set<string>();
            for (let j = i; j < doc.steps.length && doc.steps[j].branchId; j++) {
                const bid = doc.steps[j].branchId;
                if (bid && !seen.has(bid)) {
                    seen.add(bid);
                    branchNames.push(doc.steps[j].branchLabel || `Linea ${bid}`);
                }
            }
            const sepRow: any[] = [{ v: `INICIO FLUJO PARALELO - ${branchNames.join(' | ')}`, s: st.separator }];
            for (let c = 1; c < totalCols; c++) sepRow.push({ v: '', s: st.separator });
            rows.push(sepRow);
            merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: totalCols - 1 } });
        }

        // Parallel flow separator: exiting
        const exitingParallel = !step.branchId && prev?.branchId;
        if (exitingParallel) {
            const sepRow: any[] = [{ v: 'CONVERGENCIA - Retorno a flujo principal', s: st.separator }];
            for (let c = 1; c < totalCols; c++) sepRow.push({ v: '', s: st.separator });
            rows.push(sepRow);
            merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: totalCols - 1 } });
        }

        // Disposition detail
        const dispLabel = DISPOSITION_LABEL[disposition];
        let dispDetail = '';
        if (disposition === 'rework' && step.reworkReturnStep) {
            dispDetail = `Retorno a: ${step.reworkReturnStep}`;
        } else if ((disposition === 'scrap' || disposition === 'sort') && step.scrapDescription) {
            dispDetail = step.scrapDescription;
        }

        // Branch label
        const branchLabel = step.branchId
            ? (step.branchLabel || `Linea ${step.branchId}`)
            : '';

        // Row base style (subtle tint for rework/scrap rows)
        const baseStyle = disposition !== 'none' ? st.reworkRow : st.cell;

        rows.push([
            { v: sanitizeCellValue(step.stepNumber), s: { ...baseStyle, alignment: { horizontal: 'center' as const, vertical: 'center' as const } } },
            { v: sanitizeCellValue(`${SYMBOL_MAP[step.stepType] || ''} ${getStepTypeLabel(step.stepType)}`), s: { ...baseStyle, alignment: { horizontal: 'center' as const, vertical: 'center' as const } } },
            { v: sanitizeCellValue(step.description), s: baseStyle },
            { v: sanitizeCellValue(branchLabel), s: st.cellCenter },
            { v: sanitizeCellValue(step.machineDeviceTool), s: baseStyle },
            { v: sanitizeCellValue(step.productCharacteristic), s: baseStyle },
            { v: sanitizeCellValue(step.productSpecialChar === 'none' ? '' : step.productSpecialChar), s: getSpecialCharStyle(step.productSpecialChar) },
            { v: sanitizeCellValue(step.processCharacteristic), s: baseStyle },
            { v: sanitizeCellValue(step.processSpecialChar === 'none' ? '' : step.processSpecialChar), s: getSpecialCharStyle(step.processSpecialChar) },
            { v: sanitizeCellValue(step.reference), s: baseStyle },
            { v: sanitizeCellValue(step.department), s: baseStyle },
            { v: sanitizeCellValue(step.notes), s: baseStyle },
            { v: sanitizeCellValue(dispLabel), s: st.cellCenter },
            { v: sanitizeCellValue(dispDetail), s: baseStyle },
            { v: step.isExternalProcess ? 'Si' : '', s: st.cellCenter },
        ]);

        // NG path annotation after inspection steps
        const isInspection = step.stepType === 'inspection' || step.stepType === 'combined';
        const hasDisposition = disposition !== 'none';
        const next = i < doc.steps.length - 1 ? doc.steps[i + 1] : null;

        if (isInspection && hasDisposition && next) {
            const okLabel = `OK: ${next.stepNumber || 'siguiente'}`;
            const nokLabel = disposition === 'rework'
                ? `NOK: Retrabajo -> ${step.reworkReturnStep || '?'}`
                : disposition === 'scrap'
                // FIX: Defensive String() cast — scrapDescription could be non-string from corrupted JSON
                ? `NOK: Descarte${step.scrapDescription ? ' - ' + String(step.scrapDescription).slice(0, 40) : ''}`
                : `NOK: Seleccion${step.scrapDescription ? ' - ' + String(step.scrapDescription).slice(0, 40) : ''}`;
            const ngRow: any[] = [{ v: `${okLabel}  |  ${nokLabel}`, s: st.separator }];
            for (let c = 1; c < totalCols; c++) ngRow.push({ v: '', s: st.separator });
            rows.push(ngRow);
            merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: totalCols - 1 } });
        }
    }

    // Summary
    rows.push(Array(totalCols).fill(''));
    const summaryRow: any[] = [{ v: `Total: ${doc.steps.length} paso${doc.steps.length !== 1 ? 's' : ''}`, s: { font: { bold: true, sz: 9, name: 'Arial' } } }];
    for (let c = 1; c < totalCols; c++) summaryRow.push('');
    rows.push(summaryRow);

    // Symbol legend
    rows.push(Array(totalCols).fill(''));
    rows.push([{ v: 'LEYENDA:', s: { font: { bold: true, sz: 8, name: 'Arial', color: { rgb: '808080' } } } }]);
    for (const stype of PFD_STEP_TYPES) {
        const sym = SYMBOL_MAP[stype.value] || '';
        rows.push([
            { v: sym, s: { font: { name: 'Arial', sz: 9, bold: true }, alignment: { horizontal: 'center' as const } } },
            { v: stype.label, s: { font: { name: 'Arial', sz: 8 } } },
        ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
        { wch: 8 }, { wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 22 },
        { wch: 22 }, { wch: 8 }, { wch: 22 }, { wch: 8 },
        { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 8 },
    ];
    ws['!merges'] = merges;

    // Freeze panes
    ws['!freeze'] = { xSplit: 0, ySplit: dataStartRow, topLeftCell: `A${dataStartRow + 1}` };

    XLSX.utils.book_append_sheet(wb, ws, 'Diagrama de Flujo');

    const safeName = sanitizeFilename(h.partName || h.partNumber || h.documentNumber || 'Documento', { allowSpaces: true });
    downloadWorkbook(wb, `Diagrama de Flujo - ${safeName}.xlsx`);
}
