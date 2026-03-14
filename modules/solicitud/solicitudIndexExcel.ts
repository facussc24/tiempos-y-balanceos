/**
 * Solicitud Index — Master Registry Excel Generator
 *
 * Builds and maintains `Indice_Solicitudes.xlsx` on the server.
 * Uses ExcelJS with the same blue/white/gray corporate color scheme
 * as the individual solicitud Excel export.
 *
 * Features:
 *   - Barack logo in header
 *   - Auto-filter on column headers
 *   - Frozen header row
 *   - Status color coding
 *   - Atomic write (temp + rename) with retry on lock
 */

import ExcelJS from 'exceljs';
import type { SolicitudListItem } from './solicitudTypes';
import { getLogoBase64 } from '../../src/assets/ppe/ppeBase64';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';
import { logger } from '../../utils/logger';
import { listSolicitudes, loadSolicitud } from '../../utils/repositories/solicitudRepository';

// ============================================================================
// CONSTANTS
// ============================================================================

const NAVY = '1E3A5F';
const BLUE_MEDIUM = '4472C4';
const LIGHT_GRAY = 'F2F2F2';
const WHITE = 'FFFFFF';
const DARK_TEXT = '333333';

/** Status fill colors (ARGB without the FF prefix) */
const STATUS_FILLS: Record<string, string | null> = {
    aprobada: 'C6EFCE',   // green
    enviada: 'BDD7EE',    // blue
    rechazada: 'FFC7CE',  // red
    obsoleta: 'D9D9D9',   // gray
    borrador: null,        // no fill
};

/** Status font colors (ARGB without the FF prefix) */
const STATUS_FONTS: Record<string, string> = {
    aprobada: '006100',
    enviada: '1F4E79',
    rechazada: '9C0006',
    obsoleta: '595959',
    borrador: DARK_TEXT,
};

const INDEX_FILENAME = 'Indice_Solicitudes.xlsx';
const TEMP_FILENAME = 'Indice_Solicitudes.tmp.xlsx';

/** Offset: data starts at column B (index 2) and row 2 */
const COL_OFFSET = 1;
const ROW_OFFSET = 1;

/** Data columns: B through L = 11 columns */
const DATA_COLS = 11;
const FIRST_COL = COL_OFFSET + 1; // B = col 2
const LAST_COL = COL_OFFSET + DATA_COLS; // L = col 12

/** Logo image dimensions */
const LOGO_WIDTH_PX = 140;
const LOGO_HEIGHT_PX = 42;
const CHARS_TO_PX = 7.5;
const PX_TO_EMU = 9525;
const PT_TO_EMU = 12700;

// ============================================================================
// STYLE HELPERS
// ============================================================================

const thinBorder: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFD1D5DB' } };
const mediumBorder: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: 'FF000000' } };
const BORDER_ALL: Partial<ExcelJS.Borders> = {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: thinBorder,
};

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

function fillBorders(
    ws: ExcelJS.Worksheet,
    r1: number,
    c1: number,
    r2: number,
    c2: number,
    border = BORDER_ALL,
    fill?: string,
) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            const cell = ws.getCell(r, c);
            cell.border = border as ExcelJS.Borders;
            if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fill}` } };
        }
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
// DATE HELPERS
// ============================================================================

/**
 * Format an ISO date string to DD/MM/YYYY.
 * Handles both YYYY-MM-DD and full ISO datetime strings.
 */
function formatDateShort(isoStr: string): string {
    if (!isoStr) return '';
    const dateOnly = isoStr.split('T')[0];
    const parts = dateOnly.split('-');
    if (parts.length !== 3) return isoStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Format an ISO datetime string to DD/MM/YYYY HH:MM.
 * If no time component, returns DD/MM/YYYY only.
 */
export function formatDateForIndex(isoStr: string): string {
    if (!isoStr) return '';

    // Handle SQLite datetime format: "YYYY-MM-DD HH:MM:SS" or ISO "YYYY-MM-DDTHH:MM:SS"
    const normalized = isoStr.replace(' ', 'T');
    const datePart = normalized.split('T')[0];
    const timePart = normalized.split('T')[1];

    const dateParts = datePart.split('-');
    if (dateParts.length !== 3) return isoStr;

    const dateFormatted = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

    if (!timePart) return dateFormatted;

    const timeSegments = timePart.split(':');
    const hh = timeSegments[0] || '00';
    const mm = timeSegments[1] || '00';

    return `${dateFormatted} ${hh}:${mm}`;
}

// ============================================================================
// COLUMN DEFINITIONS
// ============================================================================

interface ColumnDef {
    header: string;
    width: number;
    key: string;
}

const COLUMNS: ColumnDef[] = [
    { header: 'Nro Solicitud',        width: 14, key: 'solicitud_number' },
    { header: 'Fecha',                 width: 12, key: 'fecha_solicitud' },
    { header: 'Tipo',                  width: 10, key: 'tipo' },
    { header: 'Código',               width: 16, key: 'codigo' },
    { header: 'Descripción',          width: 30, key: 'descripcion' },
    { header: 'Cliente / UM',         width: 16, key: 'clienteUM' },
    { header: 'Solicitante',          width: 16, key: 'solicitante' },
    { header: 'Departamento',         width: 14, key: 'area_departamento' },
    { header: 'Estado',               width: 12, key: 'status' },
    { header: 'Última Actualización', width: 18, key: 'updated_at' },
    { header: 'Carpeta Servidor',     width: 40, key: 'server_folder_path' },
];

// ============================================================================
// WORKBOOK BUILDER
// ============================================================================

/**
 * Internal enriched item with the Cliente/UM field that is not in SolicitudListItem.
 */
interface IndexRow extends SolicitudListItem {
    clienteUM: string;
}

/**
 * Build the complete Index workbook from a list of solicitudes.
 *
 * @param items - List items from the repository (may be enriched with clienteUM)
 * @param logoBase64 - Base64 data URI of the Barack logo
 * @returns Complete ExcelJS workbook ready for export
 */
export async function buildIndexWorkbook(
    items: SolicitudListItem[],
    logoBase64: string,
): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Barack Mercosul';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Indice', {
        views: [{
            state: 'frozen',
            ySplit: ROW_OFFSET + 4, // Freeze after header row (row 5)
            showGridLines: false,
        }],
        pageSetup: {
            paperSize: 9, // A4
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
        },
    });

    // ─────────────────────────────────────────────────────────────
    // COLUMN WIDTHS: A(blank) B C D E F G H I J K L
    // ─────────────────────────────────────────────────────────────

    const colWidths: { width: number }[] = [{ width: 2 }]; // A: blank offset
    for (const col of COLUMNS) {
        colWidths.push({ width: col.width });
    }
    ws.columns = colWidths;

    let r = ROW_OFFSET + 1; // Start at row 2

    // ─────────────────────────────────────────────────────────────
    // HEADER — Logo | Title | Generated date
    // ─────────────────────────────────────────────────────────────

    // Logo area (B2:C3)
    ws.mergeCells(r, FIRST_COL, r + 1, FIRST_COL + 1);
    if (logoBase64) {
        try {
            const logoId = workbook.addImage({
                base64: stripDataUri(logoBase64),
                extension: getExtension(logoBase64),
            });
            // B(14) + C(12) = 26 chars wide, rows 26+26=52pt tall
            ws.addImage(logoId, {
                tl: {
                    nativeCol: 1,
                    nativeColOff: centerHorizEmu(14 + 12, LOGO_WIDTH_PX),
                    nativeRow: 1,
                    nativeRowOff: centerVertEmu(52, LOGO_HEIGHT_PX),
                },
                ext: { width: LOGO_WIDTH_PX, height: LOGO_HEIGHT_PX },
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

    // Title: "ÍNDICE DE SOLICITUDES DE GENERACIÓN DE CÓDIGO" (D2:J3)
    ws.mergeCells(r, FIRST_COL + 2, r + 1, FIRST_COL + 8);
    setVal(ws, r, FIRST_COL + 2, 'ÍNDICE DE SOLICITUDES DE GENERACIÓN DE CÓDIGO', {
        font: { bold: true, size: 13, color: { argb: `FF${NAVY}` } },
        alignment: { horizontal: 'center', vertical: 'middle' },
    });
    fillBorders(ws, r, FIRST_COL + 2, r + 1, FIRST_COL + 8);

    // Generation timestamp (K2:L3)
    ws.mergeCells(r, FIRST_COL + 9, r + 1, LAST_COL);
    const now = new Date();
    const genTimestamp = `Generado: ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setVal(ws, r, FIRST_COL + 9, genTimestamp, {
        font: { size: 8, italic: true, color: { argb: 'FF808080' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
    });
    fillBorders(ws, r, FIRST_COL + 9, r + 1, LAST_COL);

    ws.getRow(r).height = 26;
    ws.getRow(r + 1).height = 26;
    r += 2;

    // Thick bottom border on header
    for (let c = FIRST_COL; c <= LAST_COL; c++) {
        const cell = ws.getCell(r - 1, c);
        cell.border = { ...BORDER_ALL, bottom: mediumBorder } as ExcelJS.Borders;
    }

    r++; // blank separator row
    ws.getRow(r - 1).height = 4;

    // ─────────────────────────────────────────────────────────────
    // COLUMN HEADERS (row 5)
    // ─────────────────────────────────────────────────────────────

    const headerRow = r;
    for (let i = 0; i < COLUMNS.length; i++) {
        const col = FIRST_COL + i;
        setVal(ws, r, col, COLUMNS[i].header, {
            font: { bold: true, size: 9, color: { argb: `FF${WHITE}` } },
            fill: BLUE_MEDIUM,
            alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        });
    }
    ws.getRow(r).height = 24;

    // Auto-filter on header row
    ws.autoFilter = {
        from: { row: headerRow, column: FIRST_COL },
        to: { row: headerRow, column: LAST_COL },
    };

    r++;

    // ─────────────────────────────────────────────────────────────
    // DATA ROWS
    // ─────────────────────────────────────────────────────────────

    for (const item of items) {
        const rowItem = item as IndexRow;
        const isEven = (r % 2) === 0;
        const rowFill = isEven ? LIGHT_GRAY : WHITE;

        for (let i = 0; i < COLUMNS.length; i++) {
            const col = FIRST_COL + i;
            const key = COLUMNS[i].key;
            let value = '';

            switch (key) {
                case 'solicitud_number':
                    value = item.solicitud_number || '';
                    break;
                case 'fecha_solicitud':
                    value = formatDateShort(item.fecha_solicitud);
                    break;
                case 'tipo':
                    value = (item.tipo || '').toUpperCase();
                    break;
                case 'codigo':
                    value = item.codigo || '';
                    break;
                case 'descripcion':
                    value = item.descripcion || '';
                    break;
                case 'clienteUM':
                    value = rowItem.clienteUM || '';
                    break;
                case 'solicitante':
                    value = item.solicitante || '';
                    break;
                case 'area_departamento':
                    value = item.area_departamento || '';
                    break;
                case 'status': {
                    const status = item.status || 'borrador';
                    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
                    const statusFill = STATUS_FILLS[status] ?? null;
                    const statusFont = STATUS_FONTS[status] ?? DARK_TEXT;
                    setVal(ws, r, col, statusLabel, {
                        font: { bold: true, size: 9, color: { argb: `FF${statusFont}` } },
                        fill: statusFill || rowFill,
                        alignment: { horizontal: 'center', vertical: 'middle' },
                    });
                    continue; // skip the generic setVal below
                }
                case 'updated_at':
                    value = formatDateForIndex(item.updated_at);
                    break;
                case 'server_folder_path':
                    value = item.server_folder_path || '';
                    break;
                default:
                    value = '';
            }

            setVal(ws, r, col, value, {
                fill: rowFill,
                alignment: key === 'descripcion' || key === 'server_folder_path'
                    ? { wrapText: true, vertical: 'middle' }
                    : { vertical: 'middle' },
            });
        }

        ws.getRow(r).height = 18;
        r++;
    }

    // ─────────────────────────────────────────────────────────────
    // FOOTER: item count
    // ─────────────────────────────────────────────────────────────

    r++; // blank separator
    ws.mergeCells(r, FIRST_COL, r, LAST_COL);
    setVal(ws, r, FIRST_COL, `Total: ${items.length} solicitud(es)  —  DOCUMENTO INTERNO - BARACK MERCOSUL`, {
        font: { size: 8, italic: true, color: { argb: 'FF808080' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {},
    });
    ws.getRow(r).height = 16;

    // ─────────────────────────────────────────────────────────────
    // PRINT SETUP
    // ─────────────────────────────────────────────────────────────

    ws.pageSetup.printArea = `B2:L${r}`;
    ws.headerFooter = {
        oddHeader: '&L&8BARACK MERCOSUL&C&8INDICE DE SOLICITUDES&R&8Pagina &P de &N',
        oddFooter: '',
    };

    return workbook;
}

// ============================================================================
// BROWSER DOWNLOAD
// ============================================================================

/**
 * Load all solicitudes from the database, build the index workbook,
 * and trigger a browser download of `Indice_Solicitudes.xlsx`.
 *
 * The `basePath` parameter is accepted for API compatibility but is unused
 * in web mode — the file is delivered directly to the browser instead of
 * being written to the server filesystem.
 *
 * TODO: Implement server-side write via backend API when running in Tauri mode
 *
 * @param _basePath - Ignored in web mode (kept for API compatibility)
 * @returns true if the workbook was built and the download was triggered
 */
export async function updateSolicitudIndex(_basePath: string): Promise<boolean> {
    const logTag = 'SolicitudIndex';

    try {
        // 1. Load all solicitudes from the repository
        const items = await listSolicitudes();
        logger.info(logTag, `Loaded ${items.length} solicitudes for index`);

        // 2. Enrich items with cliente/UM from full documents (best-effort)
        const enrichedItems: IndexRow[] = [];
        for (const item of items) {
            let clienteUM = '';
            try {
                const doc = await loadSolicitud(item.id);
                if (doc) {
                    if (doc.tipo === 'producto' && doc.producto) {
                        clienteUM = doc.producto.cliente || '';
                    } else if (doc.tipo === 'insumo' && doc.insumo) {
                        clienteUM = doc.insumo.unidadMedida || '';
                    }
                }
            } catch {
                // Enrichment failure is not critical
            }
            enrichedItems.push({ ...item, clienteUM });
        }

        // 3. Get logo
        let logoBase64 = '';
        try {
            logoBase64 = await getLogoBase64();
        } catch {
            logger.warn(logTag, 'Could not load logo, continuing without it');
        }

        // 4. Build workbook
        const workbook = await buildIndexWorkbook(enrichedItems, logoBase64);

        // 5. Write to buffer
        const buffer = await workbook.xlsx.writeBuffer();
        const data = new Uint8Array(buffer as ArrayBuffer);

        // 6. Trigger browser download via a temporary object URL
        const blob = new Blob([data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = INDEX_FILENAME;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        logger.info(logTag, 'Index download triggered', { filename: INDEX_FILENAME, count: items.length });
        return true;
    } catch (err) {
        logger.error(logTag, 'Error generating index', {
            error: err instanceof Error ? err.message : String(err),
        });
        return false;
    }
}
