/**
 * Hoja de Operaciones PDF Export
 *
 * Generates PDF replicating the company paper format "HO 952 REV.06" (A4 portrait).
 * Uses html2pdf.js (already in package.json).
 *
 * Layout per page:
 *   HEADER (3-row table: Logo | Title | HO number; metadata rows)
 *   VISUAL AIDS + PROCESS STEPS (two columns: 40% / 60%)
 *   PPE (circular ISO pictogram images)
 *   CICLO DE CONTROL (quality checks table)
 *   PLAN DE REACCION (red box)
 *
 * Modes:
 * 1. Single sheet (one operation)
 * 2. All sheets (multi-page PDF)
 *
 * Architecture follows controlPlanPdfExport.ts:
 * - Inline styles (html2pdf.js doesn't inherit external CSS)
 * - esc() for XSS prevention
 * - Off-screen rendering pattern
 * - Async for base64 asset loading
 */

import {
    HoDocument,
    HojaOperacion,
    HoStep,
    HoQualityCheck,
    HoVisualAid,
    PPE_CATALOG,
} from './hojaOperacionesTypes';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { getPpeBase64Map, getLogoBase64 } from '../../src/assets/ppe/ppeBase64';
import { renderHtmlToPdf } from '../../utils/pdfRenderer';
import { truncateApplicableParts as truncateParts } from '../../utils/productFamilyAutoFill';

// ============================================================================
// CONSTANTS
// ============================================================================

const NAVY = '#1e3a5f';
const NAVY_LIGHT = '#f0f4f8';
const RED_REACTION = '#dc2626';

// ============================================================================
// TYPES
// ============================================================================

export interface PdfAssets {
    logoBase64: string;
    ppeBase64Map: Record<string, string>;
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

/** Sanitize text for HTML (prevent XSS in generated HTML). */
export function esc(value: string | number | undefined): string {
    if (value == null || value === '') return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function cellStyle(align: 'left' | 'center' = 'left'): string {
    return `border:1px solid #d1d5db; padding:4px 6px; font-size:9px; font-family:Arial,sans-serif; vertical-align:top; text-align:${align}; word-wrap:break-word;`;
}

function headerCellStyle(): string {
    return `border:1px solid ${NAVY}; padding:4px 6px; font-size:8px; font-family:Arial,sans-serif; font-weight:bold; color:#fff; background:${NAVY}; text-align:center; vertical-align:middle;`;
}

function sectionTitle(title: string, color: 'navy' | 'red' | 'green' = 'navy'): string {
    const styles: Record<string, string> = {
        navy: `background:${NAVY}; color:#fff; border:1px solid ${NAVY};`,
        red: `background:#fef2f2; color:#991b1b; border:1px solid #fca5a5;`,
        green: `background:#f0fdf4; color:#166534; border:1px solid #86efac;`,
    };
    return `<div style="${styles[color]} padding:4px 8px; font-size:9px; font-family:Arial,sans-serif; font-weight:bold; margin-top:8px; margin-bottom:2px;">${esc(title)}</div>`;
}

function specialCharBadge(sc: string): string {
    const up = (sc || '').toUpperCase().trim();
    if (up === 'CC') return `<span style="background:#DC2626; color:#fff; padding:1px 4px; border-radius:3px; font-size:7px; font-weight:bold;">CC</span>`;
    if (up === 'SC') return `<span style="background:#F59E0B; color:#fff; padding:1px 4px; border-radius:3px; font-size:7px; font-weight:bold;">SC</span>`;
    return esc(sc);
}

function labelCell(label: string, value: string): string {
    return `<div style="font-size:7px; color:#6b7280; font-weight:600; text-transform:uppercase; font-family:Arial,sans-serif;">${esc(label)}</div><div style="font-size:9px; font-family:Arial,sans-serif;">${esc(value)}</div>`;
}

// ============================================================================
// HTML BUILDERS
// ============================================================================

function buildSheetHeaderHtml(sheet: HojaOperacion, doc: HoDocument, assets: PdfAssets): string {
    const logoImg = assets.logoBase64
        ? `<img src="${assets.logoBase64}" style="height:32px; object-fit:contain;" />`
        : `<div style="font-size:11px; font-weight:bold; color:${NAVY}; font-family:Arial,sans-serif;">${esc(doc.header.organization || 'BARACK MERCOSUL')}</div>`;

    const statusLabel = sheet.status === 'aprobado' ? 'APROBADO'
        : sheet.status === 'pendienteRevision' ? 'PENDIENTE REV.'
        : 'BORRADOR';

    return `
    <table style="width:100%; border-collapse:collapse; margin-bottom:0;">
        <!-- Row 0: Logo | Title | HO Number -->
        <tr>
            <td style="width:25%; border:1px solid #d1d5db; padding:6px; vertical-align:middle;">
                ${logoImg}
            </td>
            <td style="width:45%; border:1px solid #d1d5db; padding:6px; text-align:center; vertical-align:middle;">
                <div style="font-size:13px; font-weight:bold; font-family:Arial,sans-serif; color:${NAVY}; letter-spacing:1px;">HOJA DE OPERACIONES</div>
            </td>
            <td style="width:30%; border:1px solid #d1d5db; padding:6px; text-align:right; vertical-align:middle;">
                <div style="font-size:7px; color:#6b7280; font-family:Arial,sans-serif;">Form: ${esc(doc.header.formNumber)}</div>
                <div style="font-size:16px; font-weight:bold; font-family:Arial,sans-serif; color:${NAVY};">${esc(sheet.hoNumber)}</div>
            </td>
        </tr>
        <!-- Row 1: Op Number | Denomination | Model -->
        <tr>
            <td style="border:1px solid #d1d5db; padding:4px 6px;">
                ${labelCell('N\u00B0 DE OPERACION', sheet.operationNumber)}
            </td>
            <td style="border:1px solid #d1d5db; padding:4px 6px;">
                ${labelCell('DENOMINACION DE LA OPERACION', sheet.operationName)}
            </td>
            <td style="border:1px solid #d1d5db; padding:4px 6px;">
                ${labelCell('MODELO O VEHICULO', sheet.vehicleModel)}
            </td>
        </tr>
        <!-- Row 2: Realizo/Aprobo | Fecha/Rev | Status -->
        <tr>
            <td style="border:1px solid #d1d5db; padding:4px 6px;">
                <table style="width:100%; border-collapse:collapse;"><tr>
                    <td style="width:50%; padding:0 2px 0 0;">${labelCell('Realizo', sheet.preparedBy)}</td>
                    <td style="width:50%; padding:0 0 0 2px;">${labelCell('Aprobo', sheet.approvedBy)}</td>
                </tr></table>
            </td>
            <td style="border:1px solid #d1d5db; padding:4px 6px;">
                <table style="width:100%; border-collapse:collapse;"><tr>
                    <td style="width:50%; padding:0 2px 0 0;">${labelCell('Fecha', sheet.date)}</td>
                    <td style="width:50%; padding:0 0 0 2px;">${labelCell('Rev.', sheet.revision)}</td>
                </tr></table>
            </td>
            <td style="border:1px solid #d1d5db; padding:4px 6px; text-align:center; vertical-align:middle;">
                <span style="padding:2px 8px; border-radius:3px; font-size:8px; font-weight:600; font-family:Arial,sans-serif; ${
                    sheet.status === 'aprobado' ? 'background:#22c55e; color:#fff;'
                    : sheet.status === 'pendienteRevision' ? 'background:#facc15; color:#854d0e;'
                    : 'background:#e5e7eb; color:#4b5563;'
                }">${statusLabel}</span>
            </td>
        </tr>
        <!-- Row 3: Sector | Cod Pieza | Cliente + Puesto -->
        <tr>
            <td style="border:1px solid #d1d5db; padding:4px 6px;">
                ${labelCell('SECTOR', sheet.sector)}
            </td>
            <td style="border:1px solid #d1d5db; padding:4px 6px;">
                ${labelCell('COD. DE PIEZA / DESCRIPCIÓN', sheet.partCodeDescription)}
            </td>
            <td style="border:1px solid #d1d5db; padding:4px 6px;">
                <table style="width:100%; border-collapse:collapse;"><tr>
                    <td style="width:50%; padding:0 2px 0 0;">${labelCell('Cliente', doc.header.client)}</td>
                    <td style="width:50%; padding:0 0 0 2px;">${labelCell('N\u00B0 Puesto', sheet.puestoNumber)}</td>
                </tr></table>
            </td>
        </tr>
        ${doc.header.applicableParts?.trim() ? `<!-- Row 4: Piezas Aplicables -->
        <tr>
            <td style="border:1px solid #d1d5db; padding:4px 6px;" colspan="3">
                <div style="font-size:7px; color:#6b7280; font-weight:600; text-transform:uppercase; font-family:Arial,sans-serif;">${esc('PIEZAS APLICABLES')}</div><div style="font-size:9px; font-family:Arial,sans-serif;">${esc(truncateParts(doc.header.applicableParts)).replace(/\n/g, '<br/>')}</div>
            </td>
        </tr>` : ''}
    </table>`;
}

/** Maximum number of visual aid images shown in the PDF layout. */
const MAX_PDF_VISUAL_AIDS = 6;

function buildVisualAidsHtml(aids: HoVisualAid[]): string {
    if (aids.length === 0) {
        return `<div style="padding:8px; font-size:8px; color:#999; font-style:italic; font-family:Arial,sans-serif;">Sin ayudas visuales</div>`;
    }
    const shown = aids.slice(0, MAX_PDF_VISUAL_AIDS);
    const overflow = aids.length - shown.length;
    // Use 3-column grid for 5-6 images, 2-column for fewer
    const colWidth = shown.length > 4 ? '31%' : '48%';
    const images = shown.map(aid => `
        <div style="display:inline-block; width:${colWidth}; vertical-align:top; margin:1%; text-align:center;">
            ${aid.imageData?.startsWith('data:')
                ? `<img src="${aid.imageData}" style="max-width:100%; max-height:120px; border:1px solid #e5e7eb;" />`
                : `<div style="height:80px; background:#f3f4f6; border:1px solid #e5e7eb; display:flex; align-items:center; justify-content:center; font-size:8px; color:#999;">Sin imagen</div>`}
            ${aid.caption ? `<div style="font-size:7px; color:#666; margin-top:2px; font-family:Arial,sans-serif;">${esc(aid.caption)}</div>` : ''}
        </div>
    `).join('');
    const overflowNote = overflow > 0
        ? `<div style="font-size:7px; color:#b45309; font-style:italic; text-align:center; padding:2px 0; font-family:Arial,sans-serif;">${overflow} imagen${overflow > 1 ? 'es' : ''} adicional${overflow > 1 ? 'es' : ''} no mostrada${overflow > 1 ? 's' : ''}</div>`
        : '';
    return `<div style="padding:4px;">${images}${overflowNote}</div>`;
}

function buildStepsHtml(steps: HoStep[]): string {
    if (steps.length === 0) {
        return `<div style="padding:8px; font-size:8px; color:#999; font-style:italic; font-family:Arial,sans-serif;">Sin pasos definidos</div>`;
    }
    const items = steps.map(step => {
        const keyPointMarker = step.isKeyPoint
            ? `<span style="color:${NAVY}; font-weight:bold;"> \u2605</span>`
            : '';
        const keyPointReason = step.isKeyPoint && step.keyPointReason
            ? `<div style="font-size:7px; color:${NAVY}; font-style:italic; margin-top:1px;">\u2192 ${esc(step.keyPointReason)}</div>`
            : '';
        const bg = step.isKeyPoint ? `background:${NAVY_LIGHT};` : '';
        return `
        <div style="${bg} padding:3px 6px; border-bottom:1px solid #e5e7eb; font-family:Arial,sans-serif;">
            <span style="font-size:10px; font-weight:bold; color:${step.isKeyPoint ? NAVY : '#6b7280'}; margin-right:4px;">${step.stepNumber}${keyPointMarker}</span>
            <span style="font-size:9px;">${esc(step.description)}</span>
            ${keyPointReason}
        </div>`;
    }).join('');

    return `<div>${items}</div>`;
}

function buildPpeHtml(ppeItems: string[], assets: PdfAssets): string {
    if (ppeItems.length === 0) return `<span style="font-size:8px; color:#999; font-style:italic; font-family:Arial,sans-serif;">Ninguno seleccionado</span>`;
    return ppeItems.map(id => {
        const label = PPE_CATALOG.find(p => p.id === id)?.label || id;
        const b64 = assets.ppeBase64Map[id];
        if (b64) {
            return `<img src="${b64}" alt="${esc(label)}" title="${esc(label)}" style="width:36px; height:36px; border-radius:50%; border:2px solid #2563eb; margin:2px; object-fit:cover; vertical-align:middle;" />`;
        }
        return `<span style="display:inline-block; background:${NAVY_LIGHT}; border:1px solid #93c5fd; padding:2px 6px; margin:1px; border-radius:3px; font-size:8px; font-family:Arial,sans-serif; color:${NAVY}; font-weight:500;">${esc(label)}</span>`;
    }).join(' ');
}

function buildQualityChecksHtml(checks: HoQualityCheck[]): string {
    if (checks.length === 0) {
        return `<div style="padding:8px; font-size:8px; color:#999; font-style:italic; font-family:Arial,sans-serif;">Sin verificaciones de calidad (genere el Plan de Control primero)</div>`;
    }

    const rows = checks.map((qc, i) => `
        <tr style="${i % 2 === 0 ? '' : 'background:#f9fafb;'}">
            <td style="${cellStyle('center')}; width:20px;">${i + 1}</td>
            <td style="${cellStyle()}">${specialCharBadge(qc.specialCharSymbol)} ${esc(qc.characteristic)}</td>
            <td style="${cellStyle()}">${esc(qc.specification)}</td>
            <td style="${cellStyle()}">${esc(qc.controlMethod || qc.evaluationTechnique)}</td>
            <td style="${cellStyle()}">${esc(qc.reactionContact)}</td>
            <td style="${cellStyle()}">${esc(qc.frequency)}</td>
            <td style="${cellStyle()}">${esc(qc.registro)}</td>
        </tr>
    `).join('');

    return `
    <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
        <colgroup>
            <col style="width:4%"/>
            <col style="width:22%"/>
            <col style="width:20%"/>
            <col style="width:20%"/>
            <col style="width:10%"/>
            <col style="width:10%"/>
            <col style="width:14%"/>
        </colgroup>
        <thead><tr>
            <th style="${headerCellStyle()}">#</th>
            <th style="${headerCellStyle()}">Características a controlar</th>
            <th style="${headerCellStyle()}">Especificación</th>
            <th style="${headerCellStyle()}">Método de control</th>
            <th style="${headerCellStyle()}">Resp.</th>
            <th style="${headerCellStyle()}">Frec.</th>
            <th style="${headerCellStyle()}">Registro</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

function buildReactionPlanHtml(text: string, contact: string): string {
    const lines = (text || '').split(/\r?\n/).map(l => `<div>${esc(l)}</div>`).join('');
    return `
    <div style="border:2px solid ${RED_REACTION}; padding:6px; background:#FEF2F2; font-size:9px; font-family:Arial,sans-serif; color:#7f1d1d; font-weight:bold; word-wrap:break-word; overflow-wrap:break-word; max-width:100%;">
        ${lines}
        ${contact ? `<div style="margin-top:4px; font-weight:bold;">Contacto: ${esc(contact)}</div>` : ''}
    </div>`;
}

// ============================================================================
// FULL PAGE HTML
// ============================================================================

export function buildSheetHtml(sheet: HojaOperacion, doc: HoDocument, assets: PdfAssets): string {
    return `
    <div style="page-break-after:always; page-break-inside:auto; padding:8px; font-family:Arial,sans-serif;">
        ${buildSheetHeaderHtml(sheet, doc, assets)}

        <!-- Visual Aids + Steps (two column: 40% / 60%) -->
        <table style="width:100%; border-collapse:collapse; margin-top:6px; margin-bottom:4px;">
            <tr>
                <td style="width:40%; vertical-align:top; border:1px solid #e5e7eb; padding:0;">
                    ${sectionTitle('AYUDAS VISUALES')}
                    ${buildVisualAidsHtml(sheet.visualAids)}
                </td>
                <td style="width:60%; vertical-align:top; border:1px solid #e5e7eb; padding:0;">
                    ${sectionTitle('DESCRIPCION DE LA OPERACION')}
                    ${buildStepsHtml(sheet.steps)}
                    <!-- EPP inside right column -->
                    ${sectionTitle('ELEMENTOS DE SEGURIDAD')}
                    <div style="padding:4px 8px;">
                        ${buildPpeHtml(sheet.safetyElements, assets)}
                    </div>
                </td>
            </tr>
        </table>

        <!-- Quality Checks -->
        ${sectionTitle('CICLO DE CONTROL', 'green')}
        <div style="padding:0 0 2px 0; font-size:8px; color:#6b7280; font-style:italic; font-family:Arial,sans-serif; margin-left:8px;">Referencia: OP - Operador de Produccion</div>
        <div style="padding:2px;">
            ${buildQualityChecksHtml(sheet.qualityChecks)}
        </div>

        <!-- Reaction Plan -->
        ${sectionTitle('PLAN DE REACCION ANTE NO CONFORME', 'red')}
        <div style="padding:4px;">
            ${buildReactionPlanHtml(sheet.reactionPlanText, sheet.reactionContact)}
        </div>
    </div>`;
}

// ============================================================================
// PREVIEW FUNCTIONS
// ============================================================================

/**
 * Get the HTML preview string for a single HO sheet (loads assets async).
 */
export async function getHoSheetPreviewHtml(sheet: HojaOperacion, doc: HoDocument): Promise<string> {
    const assets = await loadPdfAssets();
    return buildSheetHtml(sheet, doc, assets);
}

/**
 * Get the HTML preview string for all HO sheets (loads assets async).
 */
export async function getHoAllSheetsPreviewHtml(doc: HoDocument): Promise<string> {
    const assets = await loadPdfAssets();
    return doc.sheets.map(s => buildSheetHtml(s, doc, assets)).join('');
}

// ============================================================================
// EXPORT FUNCTIONS (async for base64 asset loading)
// ============================================================================

/** Load PDF assets (logo + PPE images as base64). */
async function loadPdfAssets(): Promise<PdfAssets> {
    const [logoBase64, ppeBase64Map] = await Promise.all([
        getLogoBase64(),
        getPpeBase64Map(),
    ]);
    return { logoBase64, ppeBase64Map };
}

/**
 * Export a single HO sheet as PDF.
 */
export async function exportHoSheetPdf(sheet: HojaOperacion, doc: HoDocument): Promise<void> {
    const assets = await loadPdfAssets();
    const html = buildSheetHtml(sheet, doc, assets);
    await renderAndDownload(html, `HO_${sheet.hoNumber}_${sheet.operationName}`);
}

/**
 * Export all HO sheets as a multi-page PDF.
 */
export async function exportAllHoSheetsPdf(doc: HoDocument): Promise<void> {
    const assets = await loadPdfAssets();
    const allHtml = doc.sheets.map(s => buildSheetHtml(s, doc, assets)).join('');
    await renderAndDownload(allHtml, `HO_Completo_${doc.header.linkedAmfeProject || 'Documento'}`);
}

/**
 * Render HTML → PDF using iframe-based rendering for reliable capture.
 */
async function renderAndDownload(html: string, fileNameBase: string): Promise<void> {
    await renderHtmlToPdf(html, {
        filename: sanitizeFilename(fileNameBase) + '.pdf',
        paperSize: 'a4',
        orientation: 'portrait',
        margin: [5, 5, 5, 5],
    });
}
