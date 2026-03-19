/**
 * APQP Package Export
 *
 * Generates a single Excel file with PFD + AMFE + CP + HO sheets for
 * delivering the complete APQP package to customers.
 *
 * Reuses existing workbook builders:
 * - buildControlPlanWorkbook() from controlPlanExcelExport
 * - buildAmfeCompletoWorkbook() from amfeExcelExport
 *
 * PFD and HO sheets are built directly here as summary tables (xlsx-js-style).
 */

import XLSX from 'xlsx-js-style';
import type { PfdDocument, PfdStep, PfdStepType } from '../pfd/pfdTypes';
import { PFD_STEP_TYPES } from '../pfd/pfdTypes';
import type { AmfeDocument } from '../amfe/amfeTypes';
import { buildAmfeCompletoWorkbook } from '../amfe/amfeExcelExport';
import type { ControlPlanDocument } from '../controlPlan/controlPlanTypes';
import { buildControlPlanWorkbook } from '../controlPlan/controlPlanExcelExport';
import type { HoDocument, HojaOperacion, PPE_CATALOG as PPECatalogType } from '../hojaOperaciones/hojaOperacionesTypes';
import { PPE_CATALOG } from '../hojaOperaciones/hojaOperacionesTypes';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { downloadWorkbook } from '../../utils/excel';

// ============================================================================
// TYPES
// ============================================================================

export interface ApqpPackageData {
    familyName: string;
    partNumbers: string[];
    client: string;
    revision: string;
    team: string;
    date: string;
    pfd: PfdDocument | null;
    amfe: AmfeDocument | null;
    cp: ControlPlanDocument | null;
    ho: HoDocument | null;
}

export interface ApqpExportOptions {
    includePortada: boolean;
    includeFlujograma: boolean;
    includeAmfe: boolean;
    includeCp: boolean;
    includeHo: boolean;
    revision: string;
}

// ============================================================================
// STYLES
// ============================================================================

const BORDER = {
    top: { style: 'thin' as const, color: { rgb: '000000' } },
    bottom: { style: 'thin' as const, color: { rgb: '000000' } },
    left: { style: 'thin' as const, color: { rgb: '000000' } },
    right: { style: 'thin' as const, color: { rgb: '000000' } },
};

const st = {
    title: {
        font: { bold: true, sz: 18, name: 'Arial', color: { rgb: '1E3A5F' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    },
    subtitle: {
        font: { bold: true, sz: 12, name: 'Arial', color: { rgb: '4472C4' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    },
    metaLabel: {
        font: { bold: true, sz: 10, name: 'Arial' },
        fill: { fgColor: { rgb: 'F2F2F2' } },
        border: BORDER,
        alignment: { vertical: 'center' as const },
    },
    metaValue: {
        font: { sz: 10, name: 'Arial' },
        border: BORDER,
        alignment: { vertical: 'center' as const },
    },
    sectionHeader: {
        font: { bold: true, sz: 10, name: 'Arial', color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1E3A5F' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    colHeader: {
        font: { bold: true, sz: 9, name: 'Arial' },
        fill: { fgColor: { rgb: 'D9E2F3' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
        border: BORDER,
    },
    cell: {
        font: { sz: 9, name: 'Arial' },
        alignment: { vertical: 'top' as const, wrapText: true },
        border: BORDER,
    },
    cellCenter: {
        font: { sz: 9, name: 'Arial' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    tocItem: {
        font: { sz: 10, name: 'Arial' },
        border: BORDER,
        alignment: { vertical: 'center' as const },
    },
    tocNumber: {
        font: { bold: true, sz: 10, name: 'Arial', color: { rgb: '4472C4' } },
        border: BORDER,
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    },
    // NG disposition colors
    ngScrap: {
        font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C0006' } },
        fill: { fgColor: { rgb: 'FFC7CE' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    ngRework: {
        font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C6500' } },
        fill: { fgColor: { rgb: 'FFEB9C' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    ngSort: {
        font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '1D4ED8' } },
        fill: { fgColor: { rgb: 'DBEAFE' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    keyPoint: {
        font: { bold: true, sz: 9, name: 'Arial' },
        fill: { fgColor: { rgb: 'FFEB9C' } },
        alignment: { vertical: 'top' as const, wrapText: true },
        border: BORDER,
    },
};

// ============================================================================
// HELPERS
// ============================================================================

const STEP_TYPE_LABELS: Record<PfdStepType, string> = {} as Record<PfdStepType, string>;
for (const t of PFD_STEP_TYPES) {
    STEP_TYPE_LABELS[t.value] = t.label;
}

const NG_LABELS: Record<string, string> = {
    none: '',
    rework: 'Retrabajo',
    scrap: 'Descarte',
    sort: 'Selección',
};

function getNgStyle(disposition: string) {
    switch (disposition) {
        case 'scrap': return st.ngScrap;
        case 'rework': return st.ngRework;
        case 'sort': return st.ngSort;
        default: return st.cellCenter;
    }
}

// ============================================================================
// SHEET BUILDERS
// ============================================================================

/**
 * Build the Portada (cover page) sheet.
 */
export function buildPortadaSheet(
    wb: XLSX.WorkBook,
    data: ApqpPackageData,
    options: ApqpExportOptions,
    sheetNames: string[],
): void {
    const rows: any[][] = [];
    const merges: XLSX.Range[] = [];
    const totalCols = 6;

    // Title rows
    const emptyRow = () => Array(totalCols).fill('');

    rows.push(emptyRow()); // Row 0: spacer
    rows.push(emptyRow()); // Row 1: spacer

    // Row 2: Title
    const titleRow: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: st.title }));
    titleRow[0] = { v: 'PAQUETE APQP', s: st.title };
    rows.push(titleRow);
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: totalCols - 1 } });

    // Row 3: Family name
    const familyRow: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: st.subtitle }));
    familyRow[0] = { v: data.familyName, s: st.subtitle };
    rows.push(familyRow);
    merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: totalCols - 1 } });

    rows.push(emptyRow()); // Row 4: spacer

    // Metadata rows
    const metaPairs: [string, string][] = [
        ['Familia de Producto', data.familyName],
        ['Números de Parte', data.partNumbers.join(', ') || '—'],
        ['Cliente', data.client || '—'],
        ['Fecha', data.date],
        ['Revisión', options.revision || data.revision || 'A'],
        ['Equipo', data.team || '—'],
    ];

    for (const [label, value] of metaPairs) {
        const rowIdx = rows.length;
        const row: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: { border: BORDER } }));
        row[0] = { v: label, s: st.metaLabel };
        row[1] = { v: '', s: st.metaLabel };
        row[2] = { v: sanitizeCellValue(value), s: st.metaValue };
        for (let c = 3; c < totalCols; c++) row[c] = { v: '', s: st.metaValue };
        merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: 1 } });
        merges.push({ s: { r: rowIdx, c: 2 }, e: { r: rowIdx, c: totalCols - 1 } });
        rows.push(row);
    }

    rows.push(emptyRow()); // spacer
    rows.push(emptyRow()); // spacer

    // Table of contents header
    const tocHeaderIdx = rows.length;
    const tocHeaderRow: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: st.sectionHeader }));
    tocHeaderRow[0] = { v: 'CONTENIDO DEL PAQUETE', s: st.sectionHeader };
    rows.push(tocHeaderRow);
    merges.push({ s: { r: tocHeaderIdx, c: 0 }, e: { r: tocHeaderIdx, c: totalCols - 1 } });

    // TOC items
    for (let i = 0; i < sheetNames.length; i++) {
        const rowIdx = rows.length;
        const row: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: st.tocItem }));
        row[0] = { v: i + 1, s: st.tocNumber };
        row[1] = { v: sheetNames[i], s: st.tocItem };
        for (let c = 2; c < totalCols; c++) row[c] = { v: '', s: st.tocItem };
        merges.push({ s: { r: rowIdx, c: 1 }, e: { r: rowIdx, c: totalCols - 1 } });
        rows.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
    ws['!merges'] = merges;
    ws['!rows'] = rows.map((_, idx) => {
        if (idx === 2) return { hpt: 40 };  // title
        if (idx === 3) return { hpt: 28 };  // family name
        return { hpt: 20 };
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Portada');
}

/**
 * Build the Flujograma (PFD) sheet — PFD steps as a table.
 */
export function buildFlujogramaSheet(wb: XLSX.WorkBook, pfd: PfdDocument): void {
    const rows: any[][] = [];
    const merges: XLSX.Range[] = [];
    const colHeaders = ['Nro. Op.', 'Símbolo', 'Descripción', 'Máquina / Dispositivo', 'Caract. Producto', 'CC/SC Prod.', 'Caract. Proceso', 'CC/SC Proc.', 'Disp. NG'];
    const colWidths = [10, 16, 35, 22, 22, 10, 22, 10, 14];
    const totalCols = colHeaders.length;

    // Title
    const titleRow: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: st.title }));
    titleRow[0] = { v: 'DIAGRAMA DE FLUJO DEL PROCESO', s: { ...st.title, font: { ...st.title.font, sz: 14 } } };
    rows.push(titleRow);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

    // Metadata
    const metaPairs: [string, string][] = [
        ['Nro. Pieza', pfd.header.partNumber],
        ['Pieza', pfd.header.partName],
        ['Revisión', pfd.header.revisionLevel],
    ];

    for (const [label, value] of metaPairs) {
        const rowIdx = rows.length;
        const row: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: { border: BORDER } }));
        row[0] = { v: label, s: st.metaLabel };
        row[1] = { v: '', s: st.metaLabel };
        row[2] = { v: sanitizeCellValue(value), s: st.metaValue };
        for (let c = 3; c < totalCols; c++) row[c] = { v: '', s: st.metaValue };
        merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: 1 } });
        merges.push({ s: { r: rowIdx, c: 2 }, e: { r: rowIdx, c: totalCols - 1 } });
        rows.push(row);
    }

    // Separator
    rows.push(Array(totalCols).fill(''));

    // Column headers
    rows.push(colHeaders.map(h => ({ v: h, s: st.colHeader })));
    const dataStartRow = rows.length;

    // Data rows
    for (const step of pfd.steps) {
        const symbolLabel = STEP_TYPE_LABELS[step.stepType] || step.stepType;
        const ngLabel = NG_LABELS[step.rejectDisposition] || '';
        const ngCellStyle = step.rejectDisposition !== 'none' ? getNgStyle(step.rejectDisposition) : st.cellCenter;

        const prodCC = step.productSpecialChar !== 'none' ? step.productSpecialChar : '';
        const procCC = step.processSpecialChar !== 'none' ? step.processSpecialChar : '';

        rows.push([
            { v: sanitizeCellValue(step.stepNumber), s: st.cellCenter },
            { v: sanitizeCellValue(symbolLabel), s: st.cellCenter },
            { v: sanitizeCellValue(step.description), s: st.cell },
            { v: sanitizeCellValue(step.machineDeviceTool), s: st.cell },
            { v: sanitizeCellValue(step.productCharacteristic), s: st.cell },
            { v: sanitizeCellValue(prodCC), s: st.cellCenter },
            { v: sanitizeCellValue(step.processCharacteristic), s: st.cell },
            { v: sanitizeCellValue(procCC), s: st.cellCenter },
            { v: sanitizeCellValue(ngLabel), s: ngCellStyle },
        ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = colWidths.map(w => ({ wch: w }));
    ws['!merges'] = merges;
    ws['!rows'] = rows.map((row, idx) => {
        if (idx === 0) return { hpt: 30 };
        if (idx >= dataStartRow && Array.isArray(row)) {
            const descLen = String(row[2]?.v || '').length;
            const lines = Math.ceil(descLen / 30);
            return { hpt: Math.min(60, Math.max(15, lines * 13)) };
        }
        return { hpt: 18 };
    });

    // Freeze panes at data start
    ws['!freeze'] = { xSplit: 0, ySplit: dataStartRow, topLeftCell: `A${dataStartRow + 1}` };

    XLSX.utils.book_append_sheet(wb, ws, 'Flujograma');
}

/**
 * Build HO summary sheets — one per HojaOperacion, simplified table format.
 */
export function buildHoSummarySheets(wb: XLSX.WorkBook, ho: HoDocument): void {
    const usedNames = new Set<string>();

    for (const sheet of ho.sheets) {
        // Generate unique sheet name (Excel limit: 31 chars)
        let baseName = `HO ${sheet.operationNumber || sheet.hoNumber}`.substring(0, 28);
        let sheetName = baseName;
        let counter = 1;
        while (usedNames.has(sheetName)) {
            sheetName = `${baseName} (${counter++})`;
        }
        usedNames.add(sheetName);

        const rows: any[][] = [];
        const merges: XLSX.Range[] = [];
        const totalCols = 8;

        // Title
        const titleRow: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: st.sectionHeader }));
        titleRow[0] = { v: `HOJA DE OPERACIONES — ${sheet.operationName}`, s: st.sectionHeader };
        rows.push(titleRow);
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

        // Metadata
        const metaInfo: [string, string][] = [
            ['Operación', `${sheet.operationNumber} — ${sheet.operationName}`],
            ['HO Nro.', sheet.hoNumber],
            ['Sector', sheet.sector],
            ['Puesto', sheet.puestoNumber],
            ['Modelo', sheet.vehicleModel],
            ['Revisión', sheet.revision],
        ];

        for (const [label, value] of metaInfo) {
            const rowIdx = rows.length;
            const row: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: { border: BORDER } }));
            row[0] = { v: label, s: st.metaLabel };
            row[1] = { v: '', s: st.metaLabel };
            row[2] = { v: sanitizeCellValue(value), s: st.metaValue };
            for (let c = 3; c < totalCols; c++) row[c] = { v: '', s: st.metaValue };
            merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: 1 } });
            merges.push({ s: { r: rowIdx, c: 2 }, e: { r: rowIdx, c: totalCols - 1 } });
            rows.push(row);
        }

        rows.push(Array(totalCols).fill(''));

        // PPE section
        if (sheet.safetyElements.length > 0) {
            const ppeIdx = rows.length;
            const ppeRow: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: st.sectionHeader }));
            ppeRow[0] = { v: 'ELEMENTOS DE SEGURIDAD (EPP)', s: st.sectionHeader };
            rows.push(ppeRow);
            merges.push({ s: { r: ppeIdx, c: 0 }, e: { r: ppeIdx, c: totalCols - 1 } });

            const ppeLabels = sheet.safetyElements.map(id => {
                const item = PPE_CATALOG.find(p => p.id === id);
                return item ? item.label : id;
            });
            const ppeListIdx = rows.length;
            const ppeListRow: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: st.cell }));
            ppeListRow[0] = { v: ppeLabels.join('  •  '), s: st.cell };
            rows.push(ppeListRow);
            merges.push({ s: { r: ppeListIdx, c: 0 }, e: { r: ppeListIdx, c: totalCols - 1 } });

            rows.push(Array(totalCols).fill(''));
        }

        // Steps section
        if (sheet.steps.length > 0) {
            const stepsHeaderIdx = rows.length;
            const stepsHeaderRow: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: st.sectionHeader }));
            stepsHeaderRow[0] = { v: 'DESCRIPCIÓN DE LA OPERACIÓN', s: st.sectionHeader };
            rows.push(stepsHeaderRow);
            merges.push({ s: { r: stepsHeaderIdx, c: 0 }, e: { r: stepsHeaderIdx, c: totalCols - 1 } });

            // Step column headers
            const stepHeaders = ['Nro', 'Descripción', '', '', 'Punto Clave', '', 'Razón', ''];
            rows.push(stepHeaders.map(h => ({ v: h, s: st.colHeader })));
            const stepColHeaderIdx = rows.length - 1;
            merges.push({ s: { r: stepColHeaderIdx, c: 1 }, e: { r: stepColHeaderIdx, c: 3 } });
            merges.push({ s: { r: stepColHeaderIdx, c: 4 }, e: { r: stepColHeaderIdx, c: 5 } });
            merges.push({ s: { r: stepColHeaderIdx, c: 6 }, e: { r: stepColHeaderIdx, c: 7 } });

            for (const step of sheet.steps) {
                const rowIdx = rows.length;
                const cellStyle = step.isKeyPoint ? st.keyPoint : st.cell;
                rows.push([
                    { v: step.stepNumber, s: st.cellCenter },
                    { v: sanitizeCellValue(step.description), s: cellStyle },
                    { v: '', s: cellStyle },
                    { v: '', s: cellStyle },
                    { v: step.isKeyPoint ? '★' : '', s: st.cellCenter },
                    { v: '', s: st.cellCenter },
                    { v: sanitizeCellValue(step.keyPointReason), s: cellStyle },
                    { v: '', s: cellStyle },
                ]);
                merges.push({ s: { r: rowIdx, c: 1 }, e: { r: rowIdx, c: 3 } });
                merges.push({ s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 5 } });
                merges.push({ s: { r: rowIdx, c: 6 }, e: { r: rowIdx, c: 7 } });
            }

            rows.push(Array(totalCols).fill(''));
        }

        // Quality checks section
        if (sheet.qualityChecks.length > 0) {
            const qcHeaderIdx = rows.length;
            const qcHeaderRow: any[] = Array(totalCols).fill(null).map(() => ({ v: '', s: { ...st.sectionHeader, fill: { fgColor: { rgb: '2E7D32' } } } }));
            qcHeaderRow[0] = { v: 'CICLO DE CONTROL', s: { ...st.sectionHeader, fill: { fgColor: { rgb: '2E7D32' } } } };
            rows.push(qcHeaderRow);
            merges.push({ s: { r: qcHeaderIdx, c: 0 }, e: { r: qcHeaderIdx, c: totalCols - 1 } });

            const qcHeaders = ['Nro', 'Característica', 'Especificación', 'Método', 'Frecuencia', 'CC/SC', 'Reacción', 'Registro'];
            rows.push(qcHeaders.map(h => ({ v: h, s: st.colHeader })));

            for (const qc of sheet.qualityChecks) {
                rows.push([
                    { v: sanitizeCellValue(qc.characteristic), s: st.cell },
                    { v: sanitizeCellValue(qc.characteristic), s: st.cell },
                    { v: sanitizeCellValue(qc.specification), s: st.cell },
                    { v: sanitizeCellValue(qc.controlMethod), s: st.cell },
                    { v: sanitizeCellValue(qc.frequency), s: st.cellCenter },
                    { v: sanitizeCellValue(qc.specialCharSymbol), s: st.cellCenter },
                    { v: sanitizeCellValue(qc.reactionAction), s: st.cell },
                    { v: sanitizeCellValue(qc.registro), s: st.cell },
                ]);
            }
        }

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            { wch: 8 }, { wch: 22 }, { wch: 14 }, { wch: 14 },
            { wch: 12 }, { wch: 8 }, { wch: 18 }, { wch: 14 },
        ];
        ws['!merges'] = merges;

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Build the combined APQP package workbook.
 */
export function buildApqpPackageWorkbook(
    data: ApqpPackageData,
    options: ApqpExportOptions,
): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();

    // Collect sheet names for TOC (before building, to populate Portada)
    const plannedSheets: string[] = [];
    if (options.includePortada) plannedSheets.push('Portada');
    if (options.includeFlujograma && data.pfd) plannedSheets.push('Flujograma');
    if (options.includeAmfe && data.amfe) plannedSheets.push('AMFE VDA');
    if (options.includeCp && data.cp) plannedSheets.push('Plan de Control');
    if (options.includeHo && data.ho && data.ho.sheets.length > 0) {
        for (const sheet of data.ho.sheets) {
            plannedSheets.push(`HO ${sheet.operationNumber || sheet.hoNumber}`.substring(0, 31));
        }
    }

    // 1. Portada
    if (options.includePortada) {
        buildPortadaSheet(wb, data, options, plannedSheets.filter(n => n !== 'Portada'));
    }

    // 2. Flujograma (PFD)
    if (options.includeFlujograma && data.pfd) {
        buildFlujogramaSheet(wb, data.pfd);
    }

    // 3. AMFE VDA — reuse existing builder
    if (options.includeAmfe && data.amfe) {
        const amfeWb = buildAmfeCompletoWorkbook(data.amfe);
        const amfeSheetName = amfeWb.SheetNames[0];
        if (amfeSheetName) {
            const amfeWs = amfeWb.Sheets[amfeSheetName];
            XLSX.utils.book_append_sheet(wb, amfeWs, 'AMFE VDA');
        }
    }

    // 4. Plan de Control — reuse existing builder
    if (options.includeCp && data.cp) {
        const cpWb = buildControlPlanWorkbook(data.cp);
        const cpSheetName = cpWb.SheetNames[0];
        if (cpSheetName) {
            const cpWs = cpWb.Sheets[cpSheetName];
            XLSX.utils.book_append_sheet(wb, cpWs, 'Plan de Control');
        }
    }

    // 5. Hojas de Operaciones (summary tables)
    if (options.includeHo && data.ho && data.ho.sheets.length > 0) {
        buildHoSummarySheets(wb, data.ho);
    }

    return wb;
}

/**
 * Export the APQP package — builds workbook and triggers download.
 */
export function exportApqpPackage(
    data: ApqpPackageData,
    options: ApqpExportOptions,
): void {
    const wb = buildApqpPackageWorkbook(data, options);
    const safeName = sanitizeFilename(data.familyName || 'Paquete_APQP', { allowSpaces: true });
    downloadWorkbook(wb, `Paquete APQP - ${safeName}.xlsx`);
}
