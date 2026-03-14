/**
 * Solicitud de Generacion de Codigo — Excel Export (ExcelJS Edition)
 *
 * Professional corporate template with:
 *   - Barack logo embedded in header
 *   - Blue/white/gray corporate color scheme
 *   - 1 blank row + 1 blank column offset (company standard)
 *   - Editable value cells for standard form usage
 *   - A4 portrait print setup
 *
 * Uses ExcelJS for image embedding support (same as HO module).
 */

import ExcelJS from 'exceljs';
import type { SolicitudDocument } from './solicitudTypes';
import { SGC_FORM_NUMBER } from './solicitudTypes';
import { getLogoBase64 } from '../../src/assets/ppe/ppeBase64';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { logger } from '../../utils/logger';
import { downloadExcelJSWorkbook } from '../../utils/excel';

// ============================================================================
// CONSTANTS
// ============================================================================

const NAVY = '1E3A5F';
const NAVY_LIGHT = 'D6E4F0';
const BLUE_MEDIUM = '4472C4';
const LIGHT_GRAY = 'F2F2F2';
const LABEL_GRAY = '808080';
const WHITE = 'FFFFFF';
const DARK_TEXT = '333333';
const AMBER_NOTICE = 'FFF3CD';
const AMBER_TEXT = '856404';
const AMBER_BORDER = 'FFECB5';

/** Offset: data starts at column B (index 2) and row 2 */
const COL_OFFSET = 1;
const ROW_OFFSET = 1;
/** Data columns: B through H = 7 */
const DATA_COLS = 7;
const FIRST_COL = COL_OFFSET + 1; // B = col 2
const LAST_COL = COL_OFFSET + DATA_COLS; // H = col 8

/** Approximate pixels per Excel character width unit (96 DPI, Arial) */
const CHARS_TO_PX = 7.5;
const PX_TO_EMU = 9525;
const PT_TO_EMU = 12700;

// ============================================================================
// STYLE HELPERS
// ============================================================================

const thinBorder: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFD1D5DB' } };
const mediumBorder: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: 'FF000000' } };
const BORDER_ALL: Partial<ExcelJS.Borders> = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const BORDER_NONE: Partial<ExcelJS.Borders> = {};

function applyStyle(cell: ExcelJS.Cell, opts: {
    font?: Partial<ExcelJS.Font>;
    fill?: string;
    alignment?: Partial<ExcelJS.Alignment>;
    border?: Partial<ExcelJS.Borders>;
}) {
    if (opts.font) cell.font = { name: 'Arial', size: 9, ...opts.font } as ExcelJS.Font;
    if (opts.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${opts.fill}` } };
    if (opts.alignment) cell.alignment = { vertical: 'middle', ...opts.alignment } as ExcelJS.Alignment;
    if (opts.border) cell.border = opts.border as ExcelJS.Borders;
}

function setVal(ws: ExcelJS.Worksheet, row: number, col: number, value: string | number, opts: {
    font?: Partial<ExcelJS.Font>;
    fill?: string;
    alignment?: Partial<ExcelJS.Alignment>;
    border?: Partial<ExcelJS.Borders>;
} = {}) {
    const cell = ws.getCell(row, col);
    cell.value = typeof value === 'string' ? sanitizeCellValue(value) : value;
    applyStyle(cell, {
        font: { size: 9, color: { argb: `FF${DARK_TEXT}` }, ...opts.font },
        fill: opts.fill,
        alignment: { vertical: 'middle', ...opts.alignment },
        border: opts.border || BORDER_ALL,
    });
    return cell;
}

/** Apply borders + optional fill to a range (for merged areas) */
function fillBorders(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, border = BORDER_ALL, fill?: string) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            const cell = ws.getCell(r, c);
            cell.border = border as ExcelJS.Borders;
            if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fill}` } };
        }
    }
}

/** Section header: navy background, white text, merged B:H */
function addSectionHeader(ws: ExcelJS.Worksheet, row: number, title: string) {
    ws.mergeCells(row, FIRST_COL, row, LAST_COL);
    setVal(ws, row, FIRST_COL, title, {
        font: { bold: true, size: 10, color: { argb: `FF${WHITE}` } },
        fill: BLUE_MEDIUM,
        alignment: { horizontal: 'center', vertical: 'middle' },
    });
    fillBorders(ws, row, FIRST_COL, row, LAST_COL, BORDER_ALL, BLUE_MEDIUM);
    ws.getRow(row).height = 22;
}

/** Label cell: bold gray text, light gray background */
function addLabel(ws: ExcelJS.Worksheet, row: number, col: number, label: string, colSpan = 1) {
    if (colSpan > 1) {
        ws.mergeCells(row, col, row, col + colSpan - 1);
    }
    setVal(ws, row, col, label, {
        font: { size: 9, bold: true, color: { argb: `FF${LABEL_GRAY}` } },
        fill: LIGHT_GRAY,
        alignment: { vertical: 'middle', wrapText: true },
    });
    if (colSpan > 1) {
        fillBorders(ws, row, col, row, col + colSpan - 1, BORDER_ALL, LIGHT_GRAY);
    }
}

/** Editable value cell: white background, normal font */
function addValue(ws: ExcelJS.Worksheet, row: number, col: number, value: string, colSpan = 1) {
    if (colSpan > 1) {
        ws.mergeCells(row, col, row, col + colSpan - 1);
    }
    setVal(ws, row, col, value, {
        font: { size: 10, color: { argb: `FF${DARK_TEXT}` } },
        fill: WHITE,
        alignment: { vertical: 'middle', wrapText: true },
    });
    if (colSpan > 1) {
        fillBorders(ws, row, col, row, col + colSpan - 1, BORDER_ALL, WHITE);
    }
}

// ============================================================================
// IMAGE HELPERS
// ============================================================================

function stripDataUri(dataUri: string): string {
    const idx = dataUri.indexOf(',');
    return idx >= 0 ? dataUri.substring(idx + 1) : dataUri;
}

function getExtension(dataUri: string): 'png' | 'jpeg' {
    if (dataUri.includes('image/jpeg') || dataUri.includes('image/jpg')) return 'jpeg';
    return 'png';
}

function centerHorizEmu(totalWidthChars: number, imagePx: number): number {
    const totalPx = totalWidthChars * CHARS_TO_PX;
    return Math.round(Math.max(0, (totalPx - imagePx) / 2) * PX_TO_EMU);
}

function centerVertEmu(totalHeightPt: number, imagePx: number): number {
    const totalEmu = totalHeightPt * PT_TO_EMU;
    const imageEmu = imagePx * PX_TO_EMU;
    return Math.round(Math.max(0, (totalEmu - imageEmu) / 2));
}

// ============================================================================
// DATE HELPER
// ============================================================================

function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ============================================================================
// SHEET BUILDER
// ============================================================================

async function buildSolicitudSheet(
    workbook: ExcelJS.Workbook,
    doc: SolicitudDocument,
    logoBase64: string,
): Promise<void> {
    const ws = workbook.addWorksheet('Solicitud', {
        views: [{ state: 'normal', showGridLines: false }],
        pageSetup: {
            paperSize: 9, // A4
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.5, right: 0.5, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
        },
    });

    // Column widths: A(blank) B C D E F G H
    ws.columns = [
        { width: 2 },    // A: blank offset
        { width: 16 },   // B: labels
        { width: 18 },   // C: values
        { width: 16 },   // D: labels
        { width: 20 },   // E: values
        { width: 16 },   // F: labels
        { width: 14 },   // G: values
        { width: 18 },   // H: values
    ];

    const h = doc.header;
    const isProducto = doc.tipo === 'producto';
    let r = ROW_OFFSET + 1; // Start at row 2

    // ─────────────────────────────────────────────────────────────
    // HEADER — Logo | Title | Form Number
    // ─────────────────────────────────────────────────────────────

    const headerStartRow = r;

    // Logo area (B2:C3)
    ws.mergeCells(r, FIRST_COL, r + 1, FIRST_COL + 1);
    if (logoBase64) {
        try {
            const logoId = workbook.addImage({
                base64: stripDataUri(logoBase64),
                extension: getExtension(logoBase64),
            });
            // Center logo: B(16)+C(18)=34 chars wide, rows 26+26=52pt tall
            ws.addImage(logoId, {
                tl: { nativeCol: 1, nativeColOff: centerHorizEmu(16 + 18, 140), nativeRow: 1, nativeRowOff: centerVertEmu(52, 42) },
                ext: { width: 140, height: 42 },
                editAs: 'oneCell',
            } as unknown as ExcelJS.ImageRange);
        } catch {
            setVal(ws, r, FIRST_COL, 'BARACK MERCOSUL', {
                font: { bold: true, size: 12, color: { argb: `FF${NAVY}` } },
                alignment: { horizontal: 'center', vertical: 'middle' },
            });
        }
    } else {
        setVal(ws, r, FIRST_COL, 'BARACK MERCOSUL', {
            font: { bold: true, size: 12, color: { argb: `FF${NAVY}` } },
            alignment: { horizontal: 'center', vertical: 'middle' },
        });
    }
    fillBorders(ws, r, FIRST_COL, r + 1, FIRST_COL + 1);

    // Title: "SOLICITUD DE GENERACIÓN DE CÓDIGO" (D2:G3)
    ws.mergeCells(r, FIRST_COL + 2, r + 1, FIRST_COL + 5);
    setVal(ws, r, FIRST_COL + 2, 'SOLICITUD DE GENERACIÓN DE CÓDIGO', {
        font: { bold: true, size: 13, color: { argb: `FF${NAVY}` } },
        alignment: { horizontal: 'center', vertical: 'middle' },
    });
    fillBorders(ws, r, FIRST_COL + 2, r + 1, FIRST_COL + 5);

    // Form number + Revision (H2:H3)
    setVal(ws, r, LAST_COL, h.formNumber || SGC_FORM_NUMBER, {
        font: { size: 8, color: { argb: `FF${LABEL_GRAY}` } },
        alignment: { horizontal: 'center', vertical: 'bottom' },
    });
    setVal(ws, r + 1, LAST_COL, `Rev. ${h.revision || 'A'}`, {
        font: { size: 8, color: { argb: `FF${LABEL_GRAY}` } },
        alignment: { horizontal: 'center', vertical: 'top' },
    });

    ws.getRow(r).height = 26;
    ws.getRow(r + 1).height = 26;
    r += 2;

    // Thick bottom border on header
    for (let c = FIRST_COL; c <= LAST_COL; c++) {
        const cell = ws.getCell(r - 1, c);
        cell.border = { ...BORDER_ALL, bottom: mediumBorder } as ExcelJS.Borders;
    }

    r++; // blank separator row (row 4)
    ws.getRow(r - 1).height = 6;

    // ─────────────────────────────────────────────────────────────
    // METADATA — Nro, Fecha, Solicitante, Area
    // ─────────────────────────────────────────────────────────────

    // Row: Nro Solicitud | Fecha | Area/Departamento
    addLabel(ws, r, FIRST_COL, 'Nro. Solicitud');
    addValue(ws, r, FIRST_COL + 1, h.solicitudNumber || '(auto)');
    addLabel(ws, r, FIRST_COL + 2, 'Fecha');
    addValue(ws, r, FIRST_COL + 3, formatDate(h.fechaSolicitud));
    addLabel(ws, r, FIRST_COL + 4, 'Area / Departamento');
    addValue(ws, r, FIRST_COL + 5, h.areaDepartamento, 2);
    ws.getRow(r).height = 22;
    r++;

    // Row: Solicitante (full width value)
    addLabel(ws, r, FIRST_COL, 'Solicitante');
    addValue(ws, r, FIRST_COL + 1, h.solicitante, 6);
    ws.getRow(r).height = 22;
    r++;

    r++; // blank separator
    ws.getRow(r - 1).height = 6;

    // ─────────────────────────────────────────────────────────────
    // TIPO DE SOLICITUD
    // ─────────────────────────────────────────────────────────────

    const tipoLabel = isProducto ? 'PRODUCTO' : 'INSUMO';
    addLabel(ws, r, FIRST_COL, 'Tipo de Solicitud', 2);
    ws.mergeCells(r, FIRST_COL + 2, r, LAST_COL);
    setVal(ws, r, FIRST_COL + 2, tipoLabel, {
        font: { bold: true, size: 11, color: { argb: `FF${NAVY}` } },
        fill: NAVY_LIGHT,
        alignment: { horizontal: 'center', vertical: 'middle' },
    });
    fillBorders(ws, r, FIRST_COL + 2, r, LAST_COL, BORDER_ALL, NAVY_LIGHT);
    ws.getRow(r).height = 24;
    r++;

    r++; // blank separator
    ws.getRow(r - 1).height = 6;

    // ─────────────────────────────────────────────────────────────
    // DATA SECTION — Producto or Insumo fields
    // ─────────────────────────────────────────────────────────────

    const sectionTitle = isProducto ? 'DATOS DEL PRODUCTO' : 'DATOS DEL INSUMO';
    addSectionHeader(ws, r, sectionTitle);
    r++;

    if (isProducto && doc.producto) {
        addLabel(ws, r, FIRST_COL, 'Codigo', 2);
        addValue(ws, r, FIRST_COL + 2, doc.producto.codigo, 5);
        ws.getRow(r).height = 24;
        r++;

        addLabel(ws, r, FIRST_COL, 'Descripción', 2);
        addValue(ws, r, FIRST_COL + 2, doc.producto.descripcion, 5);
        ws.getRow(r).height = 24;
        r++;

        addLabel(ws, r, FIRST_COL, 'Cliente', 2);
        addValue(ws, r, FIRST_COL + 2, doc.producto.cliente, 5);
        ws.getRow(r).height = 24;
        r++;
    } else if (!isProducto && doc.insumo) {
        addLabel(ws, r, FIRST_COL, 'Codigo', 2);
        addValue(ws, r, FIRST_COL + 2, doc.insumo.codigo, 5);
        ws.getRow(r).height = 24;
        r++;

        addLabel(ws, r, FIRST_COL, 'Descripción', 2);
        addValue(ws, r, FIRST_COL + 2, doc.insumo.descripcion, 5);
        ws.getRow(r).height = 24;
        r++;

        addLabel(ws, r, FIRST_COL, 'Unidad de Medida', 2);
        addValue(ws, r, FIRST_COL + 2, doc.insumo.unidadMedida || 'un', 5);
        ws.getRow(r).height = 24;
        r++;

        addLabel(ws, r, FIRST_COL, 'Requiere gen. interna', 2);
        addValue(ws, r, FIRST_COL + 2, doc.insumo.requiereGeneracionInterna ? 'SI' : 'NO', 5);
        ws.getRow(r).height = 24;
        r++;
    }

    r++; // blank separator
    ws.getRow(r - 1).height = 6;

    // ─────────────────────────────────────────────────────────────
    // OBSERVACIONES
    // ─────────────────────────────────────────────────────────────

    // Label: merge B:C across 3 rows vertically (do NOT call addLabel which merges only 1 row)
    ws.mergeCells(r, FIRST_COL, r + 2, FIRST_COL + 1);
    setVal(ws, r, FIRST_COL, 'Observaciones', {
        font: { size: 9, bold: true, color: { argb: `FF${LABEL_GRAY}` } },
        fill: LIGHT_GRAY,
        alignment: { vertical: 'middle', wrapText: true },
    });
    fillBorders(ws, r, FIRST_COL, r + 2, FIRST_COL + 1, BORDER_ALL, LIGHT_GRAY);
    // Value: 3-row tall editable cell D:H
    ws.mergeCells(r, FIRST_COL + 2, r + 2, LAST_COL);
    setVal(ws, r, FIRST_COL + 2, doc.observaciones || '', {
        font: { size: 9, color: { argb: `FF${DARK_TEXT}` } },
        fill: WHITE,
        alignment: { vertical: 'top', wrapText: true },
    });
    fillBorders(ws, r, FIRST_COL + 2, r + 2, LAST_COL, BORDER_ALL, WHITE);
    ws.getRow(r).height = 20;
    ws.getRow(r + 1).height = 20;
    ws.getRow(r + 2).height = 20;
    r += 3;

    r++; // blank separator
    ws.getRow(r - 1).height = 6;

    // ─────────────────────────────────────────────────────────────
    // PPAP NOTICE (Insumos only)
    // ─────────────────────────────────────────────────────────────

    if (!isProducto) {
        ws.mergeCells(r, FIRST_COL, r, LAST_COL);
        setVal(ws, r, FIRST_COL, 'AVISO PPAP - INSUMOS', {
            font: { bold: true, size: 9, color: { argb: `FF${AMBER_TEXT}` } },
            fill: AMBER_NOTICE,
            alignment: { horizontal: 'center', vertical: 'middle' },
        });
        fillBorders(ws, r, FIRST_COL, r, LAST_COL, {
            top: { style: 'thin', color: { argb: `FF${AMBER_BORDER}` } },
            bottom: { style: 'thin', color: { argb: `FF${AMBER_BORDER}` } },
            left: { style: 'thin', color: { argb: `FF${AMBER_BORDER}` } },
            right: { style: 'thin', color: { argb: `FF${AMBER_BORDER}` } },
        }, AMBER_NOTICE);
        ws.getRow(r).height = 20;
        r++;

        ws.mergeCells(r, FIRST_COL, r + 1, LAST_COL);
        setVal(ws, r, FIRST_COL,
            'Para insumos nuevos que afecten la calidad del producto, se requiere aprobacion de partes de produccion (PPAP) segun procedimiento P-09.1. Consulte con Calidad antes de solicitar la generacion del codigo si el insumo sera utilizado en procesos productivos.',
            {
                font: { size: 8, color: { argb: `FF${AMBER_TEXT}` } },
                fill: AMBER_NOTICE,
                alignment: { vertical: 'top', wrapText: true, horizontal: 'left' },
            });
        fillBorders(ws, r, FIRST_COL, r + 1, LAST_COL, {
            top: { style: 'thin', color: { argb: `FF${AMBER_BORDER}` } },
            bottom: { style: 'thin', color: { argb: `FF${AMBER_BORDER}` } },
            left: { style: 'thin', color: { argb: `FF${AMBER_BORDER}` } },
            right: { style: 'thin', color: { argb: `FF${AMBER_BORDER}` } },
        }, AMBER_NOTICE);
        ws.getRow(r).height = 20;
        ws.getRow(r + 1).height = 20;
        r += 2;

        r++; // separator
        ws.getRow(r - 1).height = 6;
    }

    // ─────────────────────────────────────────────────────────────
    // SIGNATURES ROW
    // ─────────────────────────────────────────────────────────────

    addLabel(ws, r, FIRST_COL, 'Firma Solicitante', 2);
    addValue(ws, r, FIRST_COL + 2, '', 2);
    addLabel(ws, r, FIRST_COL + 4, 'Firma Aprobacion', 2);
    addValue(ws, r, FIRST_COL + 6, '', 1);
    ws.getRow(r).height = 36;
    r++;

    r++; // separator
    ws.getRow(r - 1).height = 10;

    // ─────────────────────────────────────────────────────────────
    // FOOTER
    // ─────────────────────────────────────────────────────────────

    ws.mergeCells(r, FIRST_COL, r, LAST_COL);
    setVal(ws, r, FIRST_COL, 'DOCUMENTO INTERNO - BARACK MERCOSUL', {
        font: { size: 8, italic: true, color: { argb: `FF${LABEL_GRAY}` } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: BORDER_NONE,
    });
    ws.getRow(r).height = 16;

    // ─────────────────────────────────────────────────────────────
    // PRINT SETUP
    // ─────────────────────────────────────────────────────────────

    const printArea = `B2:H${r}`;
    ws.pageSetup.printArea = printArea;
    ws.headerFooter = {
        oddHeader: `&L&8BARACK MERCOSUL&C&8SOLICITUD DE GENERACIÓN DE CÓDIGO&R&8${h.formNumber || SGC_FORM_NUMBER}`,
        oddFooter: `&C&8Pagina &P de &N`,
    };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate Excel buffer for auto-export to Y: drive.
 * Returns Uint8Array instead of triggering browser download.
 */
export async function generateSolicitudExcelBuffer(doc: SolicitudDocument): Promise<Uint8Array> {
    let logoBase64 = '';
    try {
        logoBase64 = await getLogoBase64();
    } catch {
        logger.warn('SolicitudExcel', 'Could not load logo for buffer export');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Barack Mercosul';
    workbook.created = new Date();

    await buildSolicitudSheet(workbook, doc, logoBase64);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer as ArrayBuffer);
}

/**
 * Export Solicitud document to a styled Excel (.xlsx) file.
 * Uses ExcelJS for logo embedding and corporate blue/white/gray theme.
 */
export async function exportSolicitudExcel(doc: SolicitudDocument): Promise<void> {
    try {
        let logoBase64 = '';
        try {
            logoBase64 = await getLogoBase64();
        } catch {
            logger.warn('SolicitudExcel', 'Could not load logo, continuing without it');
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Barack Mercosul';
        workbook.created = new Date();

        await buildSolicitudSheet(workbook, doc, logoBase64);

        const nameSource = doc.header.solicitudNumber
            || doc.producto?.codigo
            || doc.insumo?.codigo
            || 'Solicitud';
        const safeName = sanitizeFilename(nameSource, { allowSpaces: true });
        const date = new Date().toISOString().split('T')[0];
        const filename = `Solicitud_${safeName}_${date}.xlsx`;

        await downloadExcelJSWorkbook(workbook, filename);
    } catch (err) {
        logger.error('SolicitudExcel', 'Error exporting', { error: err instanceof Error ? err.message : String(err) });
        throw new Error('Error al exportar Excel: ' + (err instanceof Error ? err.message : String(err)));
    }
}
