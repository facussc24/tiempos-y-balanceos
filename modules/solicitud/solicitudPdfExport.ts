/**
 * Solicitud de Generacion de Codigo — PDF Export
 *
 * Generates PDF from SolicitudDocument data using html2pdf.js.
 * Styled HTML with inline styles for reliable rendering.
 * Amber-600 (#D97706) theme matching the Solicitud module UI.
 */

import type { SolicitudDocument } from './solicitudTypes';
import { SGC_FORM_NUMBER } from './solicitudTypes';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { getLogoBase64 } from '../../src/assets/ppe/ppeBase64';
import { renderHtmlToPdf, renderHtmlToPdfBuffer } from '../../utils/pdfRenderer';

const AMBER = '#D97706';
const AMBER_DARK = '#92400E';

/** HTML-escape a string value for safe embedding in HTML */
function esc(value: string | number | undefined | null): string {
    if (value == null || value === '') return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Format a YYYY-MM-DD date string to DD/MM/YYYY for display */
function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** Build a label-value row for the data table */
function fieldRow(label: string, value: string): string {
    return `
        <tr>
            <td style="border:1px solid #d1d5db; padding:6px 10px; font-size:11px; font-weight:bold; color:#374151; background:#F9FAFB; width:35%;">${esc(label)}</td>
            <td style="border:1px solid #d1d5db; padding:6px 10px; font-size:11px;">${esc(value) || '<span style="color:#9CA3AF;">—</span>'}</td>
        </tr>`;
}

/**
 * Build the full HTML for the Solicitud PDF.
 */
function buildSolicitudHtml(doc: SolicitudDocument, logoBase64: string): string {
    const h = doc.header;
    const isProducto = doc.tipo === 'producto';
    const tipoLabel = isProducto ? 'PRODUCTO' : 'INSUMO';

    // Logo HTML with fallback
    const logoHtml = logoBase64
        ? `<img src="${logoBase64}" style="max-width:100px; max-height:60px;" />`
        : `<div style="font-size:12px; font-weight:bold; color:${AMBER}; font-family:Arial,sans-serif;">BARACK MERCOSUL</div>`;

    // Header table
    const headerHtml = `
        <table style="width:100%; border-collapse:collapse; border:2px solid ${AMBER}; margin-bottom:20px;">
            <tr>
                <td style="width:120px; padding:10px; border-right:1px solid ${AMBER}; vertical-align:middle; text-align:center;">
                    ${logoHtml}
                </td>
                <td style="text-align:center; padding:10px; font-size:16px; font-weight:bold; color:${AMBER_DARK};">
                    SOLICITUD DE GENERACIÓN<br/>DE CÓDIGO
                </td>
                <td style="width:120px; padding:10px; border-left:1px solid ${AMBER}; text-align:center; font-size:10px;">
                    <div style="font-weight:bold;">${esc(h.formNumber || SGC_FORM_NUMBER)}</div>
                    <div>Rev. ${esc(h.revision || 'A')}</div>
                    <div style="margin-top:4px; font-size:9px; color:#666;">DOCUMENTO INTERNO</div>
                </td>
            </tr>
        </table>`;

    // Metadata row
    const metadataHtml = `
        <table style="width:100%; border-collapse:collapse; border:1px solid #d1d5db; margin-bottom:15px;">
            <tr>
                <td style="border:1px solid #d1d5db; padding:6px 8px; font-size:10px; width:25%;"><b>Nro Solicitud:</b> ${esc(h.solicitudNumber || '—')}</td>
                <td style="border:1px solid #d1d5db; padding:6px 8px; font-size:10px; width:25%;"><b>Fecha:</b> ${esc(formatDate(h.fechaSolicitud))}</td>
                <td style="border:1px solid #d1d5db; padding:6px 8px; font-size:10px; width:25%;"><b>Solicitante:</b> ${esc(h.solicitante)}</td>
                <td style="border:1px solid #d1d5db; padding:6px 8px; font-size:10px; width:25%;"><b>Area:</b> ${esc(h.areaDepartamento)}</td>
            </tr>
        </table>`;

    // Type indicator
    const tipoHtml = `
        <div style="background:#FFFBEB; border:1px solid #F59E0B; border-radius:4px; padding:8px 12px; margin-bottom:15px; font-size:11px;">
            <b>Tipo de solicitud:</b> &#10003; ${tipoLabel}
        </div>`;

    // Data table (producto or insumo fields)
    let dataRowsHtml = '';
    if (isProducto && doc.producto) {
        dataRowsHtml = fieldRow('Codigo', doc.producto.codigo)
            + fieldRow('Descripción', doc.producto.descripcion)
            + fieldRow('Cliente', doc.producto.cliente);
    } else if (!isProducto && doc.insumo) {
        const unidadLabel = doc.insumo.unidadMedida || 'un';
        dataRowsHtml = fieldRow('Codigo', doc.insumo.codigo)
            + fieldRow('Descripción', doc.insumo.descripcion)
            + fieldRow('Unidad de Medida', unidadLabel)
            + fieldRow('Requiere generacion interna', doc.insumo.requiereGeneracionInterna ? 'Si' : 'No');
    }

    const sectionTitle = isProducto ? 'DATOS DEL PRODUCTO' : 'DATOS DEL INSUMO';
    const dataTableHtml = `
        <table style="width:100%; border-collapse:collapse; border:1px solid #d1d5db; margin-bottom:15px;">
            <tr style="background:#FEF3C7;">
                <td colspan="2" style="border:1px solid #d1d5db; padding:6px 8px; font-size:11px; font-weight:bold; color:${AMBER_DARK};">
                    ${sectionTitle}
                </td>
            </tr>
            ${dataRowsHtml}
        </table>`;

    // PPAP notice (only for insumos)
    const ppapHtml = !isProducto
        ? `<div style="background:#FEF2F2; border:1px solid #FCA5A5; border-radius:4px; padding:10px; margin-bottom:15px; font-size:10px;">
            <b>&#9888; AVISO CALIDAD:</b> Notificar al departamento de Calidad para aprobacion de PPAP antes de activar el codigo del insumo en el sistema.
        </div>`
        : '';

    // Observaciones
    const obsHtml = doc.observaciones
        ? `<table style="width:100%; border-collapse:collapse; border:1px solid #d1d5db; margin-bottom:15px;">
            <tr style="background:#FEF3C7;">
                <td style="border:1px solid #d1d5db; padding:6px 8px; font-size:11px; font-weight:bold; color:${AMBER_DARK};">
                    OBSERVACIONES
                </td>
            </tr>
            <tr>
                <td style="border:1px solid #d1d5db; padding:8px 10px; font-size:11px; white-space:pre-wrap;">${esc(doc.observaciones)}</td>
            </tr>
        </table>`
        : '';

    // Footer
    const footerHtml = `
        <div style="text-align:center; margin-top:20px; padding-top:10px; border-top:2px solid ${AMBER}; font-size:9px; color:#666;">
            DOCUMENTO INTERNO &mdash; BARACK MERCOSUL &mdash; No reproducir sin autorizacion
        </div>`;

    // Full page
    return `
        <div style="font-family:Arial,sans-serif; max-width:700px; margin:0 auto; padding:20px;">
            ${headerHtml}
            ${metadataHtml}
            ${tipoHtml}
            ${dataTableHtml}
            ${ppapHtml}
            ${obsHtml}
            ${footerHtml}
        </div>`;
}

/**
 * Get HTML preview for the Solicitud document (for preview modal).
 */
export async function getSolicitudPdfPreviewHtml(doc: SolicitudDocument): Promise<string> {
    const logoBase64 = await getLogoBase64();
    return buildSolicitudHtml(doc, logoBase64);
}

/**
 * Generate PDF buffer for auto-export to Y: drive.
 * Returns Uint8Array instead of triggering browser download.
 */
export async function generateSolicitudPdfBuffer(doc: SolicitudDocument): Promise<Uint8Array> {
    const logoBase64 = await getLogoBase64();
    const html = buildSolicitudHtml(doc, logoBase64);
    return renderHtmlToPdfBuffer(html, {
        paperSize: 'a4',
        orientation: 'portrait',
        margin: [15, 15, 15, 15],
    });
}

/**
 * Export Solicitud document to PDF.
 * Uses iframe-based rendering for reliable html2canvas capture.
 */
export async function exportSolicitudPdf(doc: SolicitudDocument): Promise<void> {
    const logoBase64 = await getLogoBase64();
    const html = buildSolicitudHtml(doc, logoBase64);

    const nameSource = doc.header.solicitudNumber
        || doc.producto?.codigo
        || doc.insumo?.codigo
        || 'Solicitud';
    const safeName = sanitizeFilename(nameSource, { allowSpaces: true });
    const date = new Date().toISOString().split('T')[0];
    const filename = `Solicitud_${safeName}_${date}.pdf`;

    await renderHtmlToPdf(html, {
        filename,
        paperSize: 'a4',
        orientation: 'portrait',
        margin: [15, 15, 15, 15],
    });
}
