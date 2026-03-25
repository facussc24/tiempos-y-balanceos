/**
 * Hoja de Operaciones Excel Export — ExcelJS Edition
 *
 * Full-fidelity export matching the UI layout:
 *   - Barack logo embedded in header
 *   - Navy-themed section headers
 *   - PPE safety pictogram images
 *   - User-uploaded visual aid photos
 *   - Quality check table with CC/SC color coding
 *   - Reaction plan in red
 *   - 1 blank row + 1 blank column offset (company standard)
 *   - Page Break Preview with A4 landscape print setup
 *
 * Uses ExcelJS for image embedding support.
 */

import ExcelJS from 'exceljs';
import {
    HoDocument,
    HojaOperacion,
    PPE_CATALOG,
} from './hojaOperacionesTypes';
import { getLogoBase64, getPpeBase64Map } from '../../src/assets/ppe/ppeBase64';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { logger } from '../../utils/logger';
import { toast } from '../../components/ui/Toast';
import { downloadExcelJSWorkbook as downloadExcelJSWb } from '../../utils/excel';
import { truncateApplicableParts as truncateParts } from '../../utils/productFamilyAutoFill';

// ============================================================================
// CONSTANTS
// ============================================================================

const NAVY = '1E3A5F';
const NAVY_LIGHT = 'D6E4F0';
const GREEN_HEADER = 'E2EFDA';
const GREEN_TEXT = '166534';
const RED_HEADER = 'FFC7CE';
const RED_TEXT = '9C0006';
const YELLOW_HIGHLIGHT = 'FFEB9C';
const CC_RED = 'DC2626';
const SC_AMBER = 'F59E0B';
const WHITE = 'FFFFFF';
const GRAY_LABEL = '808080';

/** Offset: data starts at column B (index 2) and row 2 */
const COL_OFFSET = 1; // Column A is blank
const ROW_OFFSET = 1; // Row 1 is blank
/** Total data columns: B through I = 8 */
const DATA_COLS = 8;
const FIRST_COL = COL_OFFSET + 1; // B = col 2
const LAST_COL = COL_OFFSET + DATA_COLS; // I = col 9

/**
 * Column widths in Excel character units (index 0=A, 1=B, ..., 8=I).
 * Must match the ws.columns array in buildHoSheet.
 * Used for dynamic centering of images within columns.
 */
const COL_WIDTHS = [2, 14, 16, 20, 28, 18, 16, 12, 20];

/** Approximate pixels per Excel character width unit (96 DPI, Arial default) */
const CHARS_TO_PX = 7.5;

/** Points to pixels conversion at 96 DPI */
const PT_TO_PX = 1.333;

/** Pixel to EMU conversion (1 pixel ≈ 9525 EMU at 96 DPI) */
const PX_TO_EMU = 9525;

/** Point to EMU conversion (1 point = 12700 EMU) */
const PT_TO_EMU = 12700;

// ============================================================================
// STYLE HELPERS
// ============================================================================

const thinBorder: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FF000000' } };
const mediumBorder: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: 'FF000000' } };
const BORDER_ALL: Partial<ExcelJS.Borders> = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

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
        font: { size: 9, ...opts.font },
        fill: opts.fill,
        alignment: { vertical: 'middle', ...opts.alignment },
        border: opts.border || BORDER_ALL,
    });
    return cell;
}

/** Apply borders to a range of empty cells (for merged areas) */
function fillBorders(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number, border = BORDER_ALL, fill?: string) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            const cell = ws.getCell(r, c);
            cell.border = border as ExcelJS.Borders;
            if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fill}` } };
        }
    }
}

/** Write a section header row (navy background, white text, merged B:I) */
function addSectionHeader(ws: ExcelJS.Worksheet, row: number, title: string, color: 'navy' | 'green' | 'red' = 'navy') {
    const bgColor = color === 'navy' ? NAVY : color === 'green' ? '4CAF50' : 'E53935';
    ws.mergeCells(row, FIRST_COL, row, LAST_COL);
    setVal(ws, row, FIRST_COL, title, {
        font: { bold: true, size: 9, color: { argb: `FF${WHITE}` } },
        fill: bgColor,
        alignment: { horizontal: 'center', vertical: 'middle' },
    });
    fillBorders(ws, row, FIRST_COL, row, LAST_COL, BORDER_ALL, bgColor);
    ws.getRow(row).height = 20;
}

/** Write a label cell (small gray uppercase) */
function addLabel(ws: ExcelJS.Worksheet, row: number, col: number, label: string) {
    setVal(ws, row, col, label, {
        font: { size: 7, bold: true, color: { argb: `FF${GRAY_LABEL}` } },
        alignment: { vertical: 'top', wrapText: true },
    });
}

// ============================================================================
// IMAGE HELPERS
// ============================================================================

interface ExcelAssets {
    logoBase64: string;
    ppeBase64Map: Record<string, string>;
}

/** Strip data URI prefix to get raw base64 for ExcelJS */
function stripDataUri(dataUri: string): string {
    const idx = dataUri.indexOf(',');
    return idx >= 0 ? dataUri.substring(idx + 1) : dataUri;
}

/**
 * @deprecated Use imgPos() instead — imgRange stretches images ignoring aspect ratio.
 * Create image range for ws.addImage() with tl+br (stretches to fill rectangle).
 */
function imgRange(tl: { col: number; row: number }, br: { col: number; row: number }) {
    return { tl, br } as unknown as ExcelJS.ImageRange;
}

/**
 * Create image position with explicit pixel dimensions (preserves aspect ratio).
 * Uses tl + ext instead of tl + br, so the image keeps its exact size.
 * NOTE: ExcelJS ext-xform.js multiplies by 9525 internally (EMU conversion),
 * so we pass raw pixel values here — NOT EMUs.
 */
function imgPos(tl: { col: number; row: number }, widthPx: number, heightPx: number) {
    return {
        tl,
        ext: { width: widthPx, height: heightPx },
        editAs: 'oneCell',
    } as unknown as ExcelJS.ImageRange;
}

/**
 * Create image position using native EMU offsets for precise centering.
 * Bypasses ExcelJS's broken fractional column→EMU conversion in anchor.js
 * (uses `width * 10000` instead of actual EMU, making fractional centering
 * impossible for custom-width columns).
 *
 * When tl has `nativeCol` defined, ExcelJS uses values DIRECTLY without
 * going through the broken `col` setter — see anchor.js line 20-24.
 *
 * @param nativeCol  0-based column index (0=A, 1=B, 2=C, ...)
 * @param nativeRow  0-based row index (0=row1, 1=row2, ...)
 * @param colOffEmu  Horizontal offset from left edge of column, in EMU
 * @param rowOffEmu  Vertical offset from top edge of row, in EMU
 * @param widthPx    Image width in pixels (ExcelJS ext-xform.js multiplies by 9525 internally)
 * @param heightPx   Image height in pixels
 */
function imgPosNative(
    nativeCol: number,
    nativeRow: number,
    colOffEmu: number,
    rowOffEmu: number,
    widthPx: number,
    heightPx: number,
) {
    return {
        tl: { nativeCol, nativeColOff: colOffEmu, nativeRow, nativeRowOff: rowOffEmu },
        ext: { width: widthPx, height: heightPx },
        editAs: 'oneCell',
    } as unknown as ExcelJS.ImageRange;
}

/**
 * Calculate EMU offset to horizontally center an image within a span of columns.
 * @param totalWidthChars  Total width in Excel character units (sum of column widths)
 * @param imagePx          Image width in pixels
 */
function centerHorizEmu(totalWidthChars: number, imagePx: number): number {
    const totalPx = totalWidthChars * CHARS_TO_PX;
    return Math.round(Math.max(0, (totalPx - imagePx) / 2) * PX_TO_EMU);
}

/**
 * Calculate EMU offset to vertically center an image within a height span.
 * @param totalHeightPt  Total height in points (sum of row heights)
 * @param imagePx        Image height in pixels
 */
function centerVertEmu(totalHeightPt: number, imagePx: number): number {
    const totalEmu = totalHeightPt * PT_TO_EMU;
    const imageEmu = imagePx * PX_TO_EMU;
    return Math.round(Math.max(0, (totalEmu - imageEmu) / 2));
}

/**
 * Get natural dimensions of an image from its data URI.
 * Falls back to 300×200 on error or timeout (e.g. in test environments where
 * jsdom's Image never fires onload/onerror for data URIs).
 * In real browsers, data URIs load in <1ms so the 500ms timeout is generous.
 */
async function getImageDimensions(dataUri: string): Promise<{ w: number; h: number }> {
    const FALLBACK = { w: 300, h: 200 };
    return new Promise((resolve) => {
        try {
            const img = new Image();
            const timeout = setTimeout(() => resolve(FALLBACK), 500);
            img.onload = () => { clearTimeout(timeout); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
            img.onerror = () => { clearTimeout(timeout); resolve(FALLBACK); };
            img.src = dataUri;
        } catch {
            resolve(FALLBACK);
        }
    });
}

/** Detect image extension from data URI */
function getExtension(dataUri: string): 'png' | 'jpeg' {
    if (dataUri.includes('image/jpeg') || dataUri.includes('image/jpg')) return 'jpeg';
    return 'png';
}

/** Load logo + PPE images as base64 (cached after first call) */
async function loadExcelAssets(): Promise<ExcelAssets> {
    const [logoBase64, ppeBase64Map] = await Promise.all([
        getLogoBase64(),
        getPpeBase64Map(),
    ]);
    return { logoBase64, ppeBase64Map };
}

// ============================================================================
// SHEET BUILDER
// ============================================================================

async function buildHoSheet(
    workbook: ExcelJS.Workbook,
    sheet: HojaOperacion,
    doc: HoDocument,
    assets: ExcelAssets,
): Promise<void> {
    let sheetName = `HO ${sheet.operationNumber}`.slice(0, 31);
    // Deduplicate worksheet names — Excel crashes on duplicates
    const existingNames = new Set(workbook.worksheets.map(w => w.name));
    if (existingNames.has(sheetName)) {
        let suffix = 2;
        while (existingNames.has(`${sheetName.slice(0, 28)}_${suffix}`)) suffix++;
        sheetName = `${sheetName.slice(0, 28)}_${suffix}`;
    }
    const ws = workbook.addWorksheet(sheetName, {
        views: [{ state: 'normal', showGridLines: false }],
        pageSetup: {
            paperSize: 9, // A4
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
        },
    });

    // Column widths: A(offset) B C D E F G H I — optimized for A4 landscape
    ws.columns = [
        { width: 2 },   // A: blank offset
        { width: 14 },  // B: labels (fits "N° DE OPERACIÓN")
        { width: 16 },  // C: values
        { width: 20 },  // D: labels/values (fits "DENOMINACIÓN..." with wrap)
        { width: 28 },  // E: descriptions (wide for operation names)
        { width: 18 },  // F: values (client, model)
        { width: 16 },  // G: values (revision, status)
        { width: 12 },  // H: CC/SC badge
        { width: 20 },  // I: registro/values
    ];

    let r = ROW_OFFSET + 1; // Start at row 2

    // ─────────────────────────────────────────────────────────────
    // HEADER SECTION — Row 2-6 (matching paper format HO 952)
    // ─────────────────────────────────────────────────────────────

    const headerStartRow = r;

    // Row 2-3: Logo | HOJA DE OPERACIONES | HO Number
    // Logo (B2:C3)
    ws.mergeCells(r, FIRST_COL, r + 1, FIRST_COL + 1);
    if (assets.logoBase64) {
        try {
            const logoId = workbook.addImage({
                base64: stripDataUri(assets.logoBase64),
                extension: getExtension(assets.logoBase64),
            });
            // Center logo in B2:C3: B(14)+C(16)=30 chars, rows 24+28=52pt
            ws.addImage(logoId, imgPosNative(
                1, 1,  // column B (0-based), row 2 (0-based)
                centerHorizEmu(14 + 16, 140),  // center 140px across 30 chars
                centerVertEmu(24 + 28, 42),    // center 42px across 52pt
                140, 42,
            ));
        } catch (err) {
            // Fallback: text
            setVal(ws, r, FIRST_COL, doc.header.organization || 'BARACK MERCOSUL', {
                font: { bold: true, size: 11, color: { argb: `FF${NAVY}` } },
                alignment: { horizontal: 'center', vertical: 'middle' },
            });
        }
    } else {
        setVal(ws, r, FIRST_COL, doc.header.organization || 'BARACK MERCOSUL', {
            font: { bold: true, size: 11, color: { argb: `FF${NAVY}` } },
            alignment: { horizontal: 'center', vertical: 'middle' },
        });
    }
    fillBorders(ws, r, FIRST_COL, r + 1, FIRST_COL + 1);

    // Title: "HOJA DE OPERACIONES" (D2:F3) — 46% width matching UI
    ws.mergeCells(r, FIRST_COL + 2, r + 1, FIRST_COL + 4);
    setVal(ws, r, FIRST_COL + 2, 'HOJA DE OPERACIONES', {
        font: { bold: true, size: 14, color: { argb: `FF${NAVY}` } },
        alignment: { horizontal: 'center', vertical: 'middle' },
    });
    fillBorders(ws, r, FIRST_COL + 2, r + 1, FIRST_COL + 4);

    // HO Number + Form + Status (G2:H2 form, I2 status, G3:I3 number) — 33% width
    ws.mergeCells(r, FIRST_COL + 5, r, LAST_COL - 1); // G2:H2
    setVal(ws, r, FIRST_COL + 5, `Form: ${doc.header?.formNumber || ''}`, {
        font: { size: 7, color: { argb: `FF${GRAY_LABEL}` } },
        alignment: { horizontal: 'right', vertical: 'bottom' },
    });
    fillBorders(ws, r, FIRST_COL + 5, r, LAST_COL - 1);

    // Status badge in I2
    const statusLabel = sheet.status === 'aprobado' ? 'APROBADO'
        : sheet.status === 'pendienteRevision' ? 'PEND. REV.'
        : 'BORRADOR';
    const statusFill = sheet.status === 'aprobado' ? '22C55E'
        : sheet.status === 'pendienteRevision' ? 'FACC15'
        : 'E5E7EB';
    const statusTextColor = sheet.status === 'aprobado' ? WHITE
        : sheet.status === 'pendienteRevision' ? '854D0E'
        : '4B5563';
    setVal(ws, r, LAST_COL, statusLabel, {
        font: { bold: true, size: 8, color: { argb: `FF${statusTextColor}` } },
        fill: statusFill,
        alignment: { horizontal: 'center', vertical: 'middle' },
    });

    ws.mergeCells(r + 1, FIRST_COL + 5, r + 1, LAST_COL);
    setVal(ws, r + 1, FIRST_COL + 5, sheet.hoNumber, {
        font: { bold: true, size: 18, color: { argb: `FF${NAVY}` } },
        alignment: { horizontal: 'center', vertical: 'middle' },
    });
    fillBorders(ws, r + 1, FIRST_COL + 5, r + 1, LAST_COL);

    ws.getRow(r).height = 24;
    ws.getRow(r + 1).height = 28;
    r += 2;

    // Row 4: N° Operación | Denominación | Modelo
    addLabel(ws, r, FIRST_COL, 'N° DE OPERACIÓN');
    setVal(ws, r, FIRST_COL + 1, sheet.operationNumber, { font: { size: 10, bold: true } });

    addLabel(ws, r, FIRST_COL + 2, 'DENOMINACIÓN DE LA OPERACIÓN');
    ws.mergeCells(r, FIRST_COL + 3, r, FIRST_COL + 5);
    setVal(ws, r, FIRST_COL + 3, sheet.operationName, { font: { size: 10, bold: true } });
    fillBorders(ws, r, FIRST_COL + 3, r, FIRST_COL + 5);

    addLabel(ws, r, FIRST_COL + 6, 'MODELO O VEHICULO');
    ws.mergeCells(r, FIRST_COL + 7, r, LAST_COL);
    setVal(ws, r, FIRST_COL + 7, sheet.vehicleModel);
    fillBorders(ws, r, FIRST_COL + 7, r, LAST_COL);
    ws.getRow(r).height = 28;
    r++;

    // Row 5: Realizó | Aprobó | Fecha | Rev
    addLabel(ws, r, FIRST_COL, 'REALIZÓ');
    setVal(ws, r, FIRST_COL + 1, sheet.preparedBy);
    addLabel(ws, r, FIRST_COL + 2, 'APROBÓ');
    setVal(ws, r, FIRST_COL + 3, sheet.approvedBy);
    addLabel(ws, r, FIRST_COL + 4, 'FECHA');
    setVal(ws, r, FIRST_COL + 5, sheet.date);
    addLabel(ws, r, FIRST_COL + 6, 'REV.');
    setVal(ws, r, LAST_COL, sheet.revision);
    ws.getRow(r).height = 24;
    r++;

    // Row 6: Sector | Cod Pieza | Cliente | N° Puesto
    addLabel(ws, r, FIRST_COL, 'SECTOR');
    setVal(ws, r, FIRST_COL + 1, sheet.sector);
    addLabel(ws, r, FIRST_COL + 2, 'COD. PIEZA');
    setVal(ws, r, FIRST_COL + 3, sheet.partCodeDescription, {
        alignment: { vertical: 'middle', wrapText: true },
    });
    addLabel(ws, r, FIRST_COL + 4, 'CLIENTE');
    setVal(ws, r, FIRST_COL + 5, doc.header?.client || '');
    addLabel(ws, r, FIRST_COL + 6, 'N° PUESTO');
    setVal(ws, r, LAST_COL, sheet.puestoNumber);
    ws.getRow(r).height = 28;
    r++;

    // Optional: Piezas Aplicables row
    if (doc.header.applicableParts?.trim()) {
        addLabel(ws, r, FIRST_COL, 'PIEZAS APLICABLES');
        ws.mergeCells(r, FIRST_COL + 1, r, LAST_COL);
        setVal(ws, r, FIRST_COL + 1, truncateParts(doc.header.applicableParts).replace(/\n/g, ' · '));
        fillBorders(ws, r, FIRST_COL + 1, r, LAST_COL);
        ws.getRow(r).height = 18;
        r++;
    }

    // Add thick bottom border to last header row
    for (let c = FIRST_COL; c <= LAST_COL; c++) {
        const cell = ws.getCell(r - 1, c);
        cell.border = { ...BORDER_ALL, bottom: mediumBorder } as ExcelJS.Borders;
    }

    r++; // blank separator row

    // ─────────────────────────────────────────────────────────────
    // AYUDAS VISUALES (if any)
    // ─────────────────────────────────────────────────────────────

    if ((sheet.visualAids || []).length > 0) {
        addSectionHeader(ws, r, 'AYUDAS VISUALES');
        r++;

        const sortedAids = [...sheet.visualAids].sort((a, b) => a.order - b.order);
        const aidsWithImages = sortedAids.filter(a => a.imageData);

        // Grid layout: 2 images per row (matches UI grid-cols-2 pattern)
        // Left half: columns B-E, Right half: columns F-I
        const GRID_MAX_W = 340;
        const GRID_MAX_H = 200;
        const RIGHT_COL_START = COL_OFFSET + 4; // column F (0-based = 5)

        for (let i = 0; i < aidsWithImages.length; i += 2) {
            const leftAid = aidsWithImages[i];
            const rightAid = i + 1 < aidsWithImages.length ? aidsWithImages[i + 1] : null;

            let leftH = 0;
            let rightH = 0;

            // ── Left image ──
            try {
                const imgId = workbook.addImage({
                    base64: stripDataUri(leftAid.imageData!),
                    extension: getExtension(leftAid.imageData!),
                });
                const dims = await getImageDimensions(leftAid.imageData!);
                const scale = Math.min(GRID_MAX_W / dims.w, GRID_MAX_H / dims.h, 1);
                const w = Math.round(dims.w * scale);
                leftH = Math.round(dims.h * scale);

                ws.addImage(imgId, imgPosNative(
                    COL_OFFSET, r - 1,
                    Math.round(10 * PX_TO_EMU),
                    Math.round(5 * PX_TO_EMU),
                    w, leftH,
                ));
            } catch {
                ws.mergeCells(r, FIRST_COL, r, FIRST_COL + 3);
                setVal(ws, r, FIRST_COL, `[Imagen: ${leftAid.caption || 'sin título'}]`, {
                    font: { italic: true, color: { argb: `FF${GRAY_LABEL}` } },
                    alignment: { horizontal: 'center' },
                    border: BORDER_ALL,
                });
                leftH = 27;
            }

            // ── Right image (if pair exists) ──
            if (rightAid) {
                try {
                    const imgId = workbook.addImage({
                        base64: stripDataUri(rightAid.imageData!),
                        extension: getExtension(rightAid.imageData!),
                    });
                    const dims = await getImageDimensions(rightAid.imageData!);
                    const scale = Math.min(GRID_MAX_W / dims.w, GRID_MAX_H / dims.h, 1);
                    const w = Math.round(dims.w * scale);
                    rightH = Math.round(dims.h * scale);

                    ws.addImage(imgId, imgPosNative(
                        RIGHT_COL_START, r - 1,
                        Math.round(10 * PX_TO_EMU),
                        Math.round(5 * PX_TO_EMU),
                        w, rightH,
                    ));
                } catch {
                    ws.mergeCells(r, FIRST_COL + 4, r, LAST_COL);
                    setVal(ws, r, FIRST_COL + 4, `[Imagen: ${rightAid.caption || 'sin título'}]`, {
                        font: { italic: true, color: { argb: `FF${GRAY_LABEL}` } },
                        alignment: { horizontal: 'center' },
                        border: BORDER_ALL,
                    });
                    rightH = 27;
                }
            }

            // Row heights based on tallest image in the pair
            const maxH = Math.max(leftH, rightH);
            const imgRows = Math.max(3, Math.ceil(maxH / 27));
            for (let imgRow = r; imgRow < r + imgRows; imgRow++) {
                ws.getRow(imgRow).height = 20;
            }
            r += imgRows;

            // Caption row (shared between left and right)
            const hasLeftCaption = leftAid.caption?.trim();
            const hasRightCaption = rightAid?.caption?.trim();
            if (hasLeftCaption || hasRightCaption) {
                if (hasLeftCaption) {
                    ws.mergeCells(r, FIRST_COL, r, FIRST_COL + 3);
                    setVal(ws, r, FIRST_COL, leftAid.caption!, {
                        font: { size: 7, italic: true, color: { argb: `FF${GRAY_LABEL}` } },
                        alignment: { horizontal: 'center' },
                        border: {},
                    });
                }
                if (hasRightCaption) {
                    ws.mergeCells(r, FIRST_COL + 4, r, LAST_COL);
                    setVal(ws, r, FIRST_COL + 4, rightAid!.caption!, {
                        font: { size: 7, italic: true, color: { argb: `FF${GRAY_LABEL}` } },
                        alignment: { horizontal: 'center' },
                        border: {},
                    });
                }
                ws.getRow(r).height = 14;
                r++;
            }

            r++; // gap row between pairs
        }
        r++; // separator after section
    }

    // ─────────────────────────────────────────────────────────────
    // DESCRIPCIÓN DE LA OPERACIÓN (Steps) — before PPE, matching UI order
    // ─────────────────────────────────────────────────────────────

    addSectionHeader(ws, r, 'DESCRIPCIÓN DE LA OPERACIÓN');
    r++;

    // Column headers
    setVal(ws, r, FIRST_COL, 'Nro', {
        font: { bold: true, size: 8 },
        fill: NAVY_LIGHT,
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    });
    ws.mergeCells(r, FIRST_COL + 1, r, FIRST_COL + 5);
    setVal(ws, r, FIRST_COL + 1, 'Descripción del Paso', {
        font: { bold: true, size: 8 },
        fill: NAVY_LIGHT,
        alignment: { horizontal: 'center', vertical: 'middle' },
    });
    fillBorders(ws, r, FIRST_COL + 1, r, FIRST_COL + 5, BORDER_ALL, NAVY_LIGHT);
    setVal(ws, r, FIRST_COL + 6, 'Punto Clave', {
        font: { bold: true, size: 8 },
        fill: NAVY_LIGHT,
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    });
    setVal(ws, r, LAST_COL, 'Razón', {
        font: { bold: true, size: 8 },
        fill: NAVY_LIGHT,
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    });
    ws.getRow(r).height = 20;
    r++;

    const steps = sheet.steps || [];
    if (steps.length === 0) {
        ws.mergeCells(r, FIRST_COL, r, LAST_COL);
        setVal(ws, r, FIRST_COL, 'Sin pasos definidos', {
            font: { italic: true, color: { argb: `FF${GRAY_LABEL}` } },
            alignment: { horizontal: 'center' },
        });
        fillBorders(ws, r, FIRST_COL, r, LAST_COL);
        r++;
    } else {
        for (const step of steps) {
            const isKP = step.isKeyPoint;
            const bgFill = isKP ? YELLOW_HIGHLIGHT : undefined;
            const fontOpts: Partial<ExcelJS.Font> = isKP ? { bold: true } : {};

            setVal(ws, r, FIRST_COL, step.stepNumber, {
                font: { bold: true, size: 10, ...fontOpts },
                fill: bgFill,
                alignment: { horizontal: 'center' },
            });
            ws.mergeCells(r, FIRST_COL + 1, r, FIRST_COL + 5);
            setVal(ws, r, FIRST_COL + 1, step.description, {
                font: fontOpts,
                fill: bgFill,
                alignment: { vertical: 'top', wrapText: true },
            });
            fillBorders(ws, r, FIRST_COL + 1, r, FIRST_COL + 5, BORDER_ALL, bgFill);
            setVal(ws, r, FIRST_COL + 6, isKP ? 'SI' : '', {
                font: { bold: isKP, ...fontOpts },
                fill: bgFill,
                alignment: { horizontal: 'center' },
            });
            setVal(ws, r, LAST_COL, step.keyPointReason || '', {
                font: fontOpts,
                fill: bgFill,
                alignment: { vertical: 'top', wrapText: true },
            });
            // FIX: String() cast prevents NaN when description is non-string (corrupted data).
            // Math.max(18, NaN) returns NaN, corrupting Excel row height.
            ws.getRow(r).height = Math.max(18, Math.ceil(String(step.description || '').length / 50) * 14);
            r++;
        }
    }

    r++; // separator

    // ─────────────────────────────────────────────────────────────
    // ELEMENTOS DE SEGURIDAD (PPE)
    // ─────────────────────────────────────────────────────────────

    addSectionHeader(ws, r, 'ELEMENTOS DE SEGURIDAD');
    r++;

    const safetyItems = sheet.safetyElements || [];
    if (safetyItems.length === 0) {
        ws.mergeCells(r, FIRST_COL, r, LAST_COL);
        setVal(ws, r, FIRST_COL, 'Ninguno', {
            font: { italic: true, color: { argb: `FF${GRAY_LABEL}` } },
            alignment: { horizontal: 'center' },
        });
        fillBorders(ws, r, FIRST_COL, r, LAST_COL);
        r++;
    } else {
        // Center N icons within 8 data columns (B-I)
        // e.g. 6 icons → start at col C (offset 1), leaving B and I as margins
        const PPE_ICON_PX = 55;
        const PPE_ROW_HEIGHT_PT = 22;
        const PPE_ROWS = 3;
        const ppeCount = safetyItems.length;
        const ppeStartCol = Math.max(0, Math.floor((DATA_COLS - ppeCount) / 2));
        let ppeCol = COL_OFFSET + ppeStartCol; // 0-based for image anchors
        let hasAnyImage = false;

        // Vertical centering via native EMU (bypasses ExcelJS anchor fraction bug)
        // 3 rows × 22pt = 66pt total. Icon 55px. Offset = (66pt*12700 - 55px*9525)/2 EMU
        const vOffEmu = centerVertEmu(PPE_ROWS * PPE_ROW_HEIGHT_PT, PPE_ICON_PX);

        for (const ppeId of safetyItems) {
            const ppeDataUri = assets.ppeBase64Map[ppeId];
            if (ppeDataUri && ppeCol < LAST_COL) {
                try {
                    const imgId = workbook.addImage({
                        base64: stripDataUri(ppeDataUri),
                        extension: getExtension(ppeDataUri),
                    });

                    // Center icon using native EMU offsets (bypasses ExcelJS anchor bug
                    // where col setter uses width*10000 instead of actual EMU values)
                    const colWidthChars = COL_WIDTHS[ppeCol] || 12;
                    const hOffEmu = centerHorizEmu(colWidthChars, PPE_ICON_PX);

                    ws.addImage(imgId, imgPosNative(
                        ppeCol, r - 1,  // 0-based col, 0-based row (r is 1-based)
                        hOffEmu, vOffEmu,
                        PPE_ICON_PX, PPE_ICON_PX,
                    ));
                    hasAnyImage = true;
                } catch {
                    // Just show label below
                }
            }
            ppeCol++;
        }

        if (hasAnyImage) {
            for (let pr = r; pr < r + PPE_ROWS; pr++) {
                ws.getRow(pr).height = PPE_ROW_HEIGHT_PT;
            }
            r += PPE_ROWS;
        }

        // Labels row under icons — same centering as icons
        let labelCol = FIRST_COL + ppeStartCol; // 1-based for cells
        for (const ppeId of safetyItems) {
            const ppeCatalog = PPE_CATALOG.find(p => p.id === ppeId);
            if (labelCol <= LAST_COL && ppeCatalog) {
                setVal(ws, r, labelCol, ppeCatalog.label, {
                    font: { size: 7, color: { argb: `FF${GRAY_LABEL}` } },
                    alignment: { horizontal: 'center', wrapText: true },
                    border: {},
                });
            }
            labelCol++;
        }
        ws.getRow(r).height = 22;
        r++;
    }

    r++; // separator

    // ─────────────────────────────────────────────────────────────
    // CICLO DE CONTROL (Quality Checks)
    // ─────────────────────────────────────────────────────────────

    addSectionHeader(ws, r, 'CICLO DE CONTROL', 'green');
    r++;

    // Reference line
    ws.mergeCells(r, FIRST_COL, r, LAST_COL);
    setVal(ws, r, FIRST_COL, 'Referencia: OP - Operador de Producción', {
        font: { size: 7, italic: true, color: { argb: `FF${GRAY_LABEL}` } },
        alignment: { horizontal: 'left' },
        border: {},
    });
    r++;

    // Column headers
    const qcHeaders = ['Nro', 'Característica', 'Especificación', 'Método Control', 'Resp.', 'Frecuencia', 'CC/SC', 'Registro'];
    for (let i = 0; i < qcHeaders.length; i++) {
        setVal(ws, r, FIRST_COL + i, qcHeaders[i], {
            font: { bold: true, size: 8 },
            fill: GREEN_HEADER,
            alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        });
    }
    ws.getRow(r).height = 22;
    r++;

    const qualityChecks = sheet.qualityChecks || [];
    if (qualityChecks.length === 0) {
        ws.mergeCells(r, FIRST_COL, r, LAST_COL);
        setVal(ws, r, FIRST_COL, 'Sin verificaciones de calidad. Genere primero el Plan de Control.', {
            font: { italic: true, color: { argb: `FF${GRAY_LABEL}` } },
            alignment: { horizontal: 'center' },
        });
        fillBorders(ws, r, FIRST_COL, r, LAST_COL);
        r++;
    } else {
        qualityChecks.forEach((qc, i) => {
            setVal(ws, r, FIRST_COL, i + 1, {
                alignment: { horizontal: 'center' },
            });
            setVal(ws, r, FIRST_COL + 1, qc.characteristic, {
                alignment: { vertical: 'top', wrapText: true },
            });
            setVal(ws, r, FIRST_COL + 2, qc.specification, {
                alignment: { vertical: 'top', wrapText: true },
            });
            setVal(ws, r, FIRST_COL + 3, qc.controlMethod || qc.evaluationTechnique || '', {
                alignment: { vertical: 'top', wrapText: true },
            });
            setVal(ws, r, FIRST_COL + 4, qc.reactionContact, {
                alignment: { horizontal: 'center' },
            });
            setVal(ws, r, FIRST_COL + 5, qc.frequency, {
                alignment: { horizontal: 'center' },
            });

            // CC/SC badge with color
            const scUp = (qc.specialCharSymbol || '').toUpperCase().trim();
            const scFill = scUp === 'CC' ? CC_RED : scUp === 'SC' ? SC_AMBER : undefined;
            const scTextColor = (scUp === 'CC' || scUp === 'SC') ? WHITE : undefined;
            setVal(ws, r, FIRST_COL + 6, qc.specialCharSymbol, {
                font: { bold: scUp === 'CC' || scUp === 'SC', color: scTextColor ? { argb: `FF${scTextColor}` } : undefined },
                fill: scFill,
                alignment: { horizontal: 'center' },
            });

            setVal(ws, r, LAST_COL, qc.registro, {
                alignment: { vertical: 'top', wrapText: true },
            });

            // FIX: String() cast prevents NaN from non-string types in corrupted data
            ws.getRow(r).height = Math.max(18, Math.ceil(Math.max(String(qc.characteristic || '').length, String(qc.specification || '').length) / 30) * 14);
            r++;
        });
    }

    r++; // separator

    // ─────────────────────────────────────────────────────────────
    // PLAN DE REACCIÓN ANTE NO CONFORME
    // ─────────────────────────────────────────────────────────────

    addSectionHeader(ws, r, 'PLAN DE REACCIÓN ANTE NO CONFORME', 'red');
    r++;

    const reactionText = sheet.reactionPlanText || '';
    ws.mergeCells(r, FIRST_COL, r + 2, LAST_COL);
    setVal(ws, r, FIRST_COL, reactionText, {
        font: { bold: true, size: 9, color: { argb: `FF${RED_TEXT}` } },
        fill: RED_HEADER,
        alignment: { vertical: 'top', wrapText: true },
    });
    fillBorders(ws, r, FIRST_COL, r + 2, LAST_COL, BORDER_ALL, RED_HEADER);
    ws.getRow(r).height = 20;
    ws.getRow(r + 1).height = 20;
    ws.getRow(r + 2).height = 20;
    r += 3;

    if (sheet.reactionContact) {
        ws.mergeCells(r, FIRST_COL, r, LAST_COL);
        setVal(ws, r, FIRST_COL, `CONTACTO: ${sheet.reactionContact}`, {
            font: { bold: true, size: 9, color: { argb: `FF${RED_TEXT}` } },
            fill: RED_HEADER,
        });
        fillBorders(ws, r, FIRST_COL, r, LAST_COL, BORDER_ALL, RED_HEADER);
        r++;
    }

    // ─────────────────────────────────────────────────────────────
    // PRINT SETUP
    // ─────────────────────────────────────────────────────────────

    // Set print area
    const printArea = `B2:I${r}`;
    ws.pageSetup.printArea = printArea;

    // Header/footer for printed pages
    ws.headerFooter = {
        oddHeader: `&L&8${doc.header.organization || 'BARACK MERCOSUL'}&C&8HOJA DE OPERACIONES&R&8${sheet.hoNumber}`,
        oddFooter: `&L&8${doc.header.formNumber}&C&8Página &P de &N&R&8Rev. ${sheet.revision}`,
    };
}

// ============================================================================
// DOWNLOAD HELPER
// ============================================================================

async function downloadExcelJSWorkbook(wb: ExcelJS.Workbook, fileName: string): Promise<void> {
    await downloadExcelJSWb(wb, fileName);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Export a single HO sheet to Excel with full visual fidelity.
 * Includes logo, PPE icons, visual aids, and navy styling.
 */
export async function exportHoSheetExcel(sheet: HojaOperacion, doc: HoDocument): Promise<void> {
    try {
        const assets = await loadExcelAssets();
        const workbook = new ExcelJS.Workbook();
        workbook.creator = doc.header?.organization || 'Barack Mercosul';
        workbook.created = new Date();

        await buildHoSheet(workbook, sheet, doc, assets);

        const safeName = sanitizeFilename(sheet.operationName || sheet.hoNumber || 'Documento', { allowSpaces: true });
        await downloadExcelJSWorkbook(workbook, `Hoja de Operaciones - ${safeName}.xlsx`);
    } catch (err) {
        logger.error('ExcelExport', 'Error exporting single sheet', { error: err instanceof Error ? err.message : String(err) });
        toast.error('Error de exportación', 'No se pudo exportar Excel. Intente nuevamente.');
    }
}

/**
 * Export all HO sheets as a multi-sheet Excel workbook.
 * Each operation gets its own worksheet with full formatting.
 */
export async function exportAllHoSheetsExcel(doc: HoDocument): Promise<void> {
    try {
        const assets = await loadExcelAssets();
        const workbook = new ExcelJS.Workbook();
        workbook.creator = doc.header?.organization || 'Barack Mercosul';
        workbook.created = new Date();

        if ((doc.sheets || []).length === 0) {
            const ws = workbook.addWorksheet('Vacío');
            ws.getCell('B2').value = 'Sin hojas de operaciones definidas';
        } else {
            for (const sheet of doc.sheets) {
                await buildHoSheet(workbook, sheet, doc, assets);
            }
        }

        const safeName = sanitizeFilename(
            doc.header?.partDescription || doc.header?.linkedAmfeProject || 'Documento',
            { allowSpaces: true },
        );
        await downloadExcelJSWorkbook(workbook, `Hojas de Operaciones - ${safeName}.xlsx`);
    } catch (err) {
        logger.error('ExcelExport', 'Error exporting all sheets', { error: err instanceof Error ? err.message : String(err) });
        toast.error('Error de exportación', 'No se pudo exportar Excel. Intente nuevamente.');
    }
}

/**
 * Generate all HO sheets as a Uint8Array Excel buffer (for auto-export).
 */
export async function generateHoExcelBuffer(doc: HoDocument): Promise<Uint8Array> {
    const assets = await loadExcelAssets();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = doc.header?.organization || 'Barack Mercosul';
    workbook.created = new Date();

    if ((doc.sheets || []).length === 0) {
        const ws = workbook.addWorksheet('Vacío');
        ws.getCell('B2').value = 'Sin hojas de operaciones definidas';
    } else {
        for (const sheet of doc.sheets) {
            await buildHoSheet(workbook, sheet, doc, assets);
        }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer as ArrayBuffer);
}
