/**
 * 8D Field Data Collection Sheet PDF Export ("Hoja de Campo")
 *
 * Generates a printable A4 PDF with blank/lined spaces for manually writing
 * 8D analysis data at the production line. Based on:
 * - Genchi Genbutsu (Toyota) — go and see
 * - QRQC (Nissan) — Quick Response Quality Control
 * - ASQ Check Sheet principles
 *
 * Multi-page layout:
 *   Page 1: Header + D0 + D1 + D2
 *   Page 2: D3 + D4 (Ishikawa + 5 Why)
 *   Page 3: D5 + D6 + D7 + D8
 *   Page 4: Hoja de Datos de Campo (Gemba)
 *
 * Uses renderHtmlToPdf (iframe-based) from utils/pdfRenderer.ts.
 * Inline styles required — html2pdf.js does not inherit external CSS.
 */

import { renderHtmlToPdf } from '../../utils/pdfRenderer';

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const NAVY = '#1e3a5f';
const GRAY_BORDER = '#cccccc';
const FONT = 'Arial, Helvetica, sans-serif';
const LINE_HEIGHT = '25px';

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function esc(value: string | undefined): string {
    if (value == null || value === '') return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Section header — dark blue bar with white text */
function sectionHeader(text: string): string {
    return `<div style="background:${NAVY}; color:#ffffff; font-weight:bold; font-size:11pt; font-family:${FONT}; padding:5px 8px; margin-top:10px; margin-bottom:6px; width:100%; box-sizing:border-box;">
        ${esc(text)}
    </div>`;
}

/** Ruled blank lines for handwriting */
function blankLines(count: number): string {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `<div style="border-bottom:1px solid ${GRAY_BORDER}; height:${LINE_HEIGHT}; width:100%;"></div>`;
    }
    return html;
}

/** Label + underline blank field inline */
function field(label: string, width = '200px'): string {
    return `<span style="font-size:10pt; font-family:${FONT};">${esc(label)}</span><span style="display:inline-block; border-bottom:1px solid ${GRAY_BORDER}; width:${width}; margin-left:4px; margin-right:16px;">&nbsp;</span>`;
}

/** Label + pre-filled value or blank */
function fieldValue(label: string, value: string | undefined, width = '200px'): string {
    const display = value ? esc(value) : '&nbsp;';
    return `<span style="font-size:10pt; font-family:${FONT};">${esc(label)}</span><span style="display:inline-block; border-bottom:1px solid ${GRAY_BORDER}; width:${width}; margin-left:4px; margin-right:16px;">${display}</span>`;
}

/** Checkbox character */
const CHK = '\u2610'; // ☐

/** Label text at 10pt */
function label(text: string): string {
    return `<div style="font-size:10pt; font-family:${FONT}; margin-top:6px; margin-bottom:2px;">${text}</div>`;
}

/** Page footer */
function footer(pageNum: number): string {
    return `<div style="display:flex; justify-content:space-between; font-size:8pt; font-family:${FONT}; color:#666666; border-top:1px solid ${GRAY_BORDER}; padding-top:4px; margin-top:12px;">
        <span>BARACK MERCOSUL - 8D G8D - Hoja de Campo</span>
        <span>Pagina ${pageNum}</span>
    </div>`;
}

/** CSS page break */
function pageBreak(): string {
    return '<div style="page-break-before:always;"></div>';
}

// ---------------------------------------------------------------------------
// Page builders
// ---------------------------------------------------------------------------

function buildPage1(report?: Partial<{ title: string; d2: { partNumber: string }; reportNumber: string }>): string {
    const reportNumber = report?.reportNumber || '';
    const partNumber = report?.d2?.partNumber || '';
    const title = report?.title || '';

    return `
    <!-- PAGE 1: Header + D0 + D1 + D2 -->
    <div style="font-family:${FONT}; font-size:10pt;">

        <!-- HEADER -->
        <div style="text-align:center; margin-bottom:4px;">
            <div style="font-size:16pt; font-weight:bold; font-family:${FONT};">BARACK MERCOSUL</div>
            <div style="font-size:12pt; font-family:${FONT}; margin-top:2px;">HOJA DE CAMPO - REPORTE 8D (G8D)</div>
            ${title ? `<div style="font-size:10pt; font-family:${FONT}; margin-top:2px; font-style:italic;">${esc(title)}</div>` : ''}
        </div>

        <div style="margin-bottom:6px;">
            <div style="margin-bottom:4px;">
                ${fieldValue('N\u00B0 Reporte:', reportNumber, '160px')}
                ${field('Fecha:', '140px')}
                ${field('Turno:', '80px')}
            </div>
            <div>
                ${field('Linea/Estacion:', '200px')}
                ${fieldValue('N\u00B0 Pieza:', partNumber, '160px')}
                ${field('Relevado por:', '180px')}
            </div>
        </div>

        <!-- D0 -->
        ${sectionHeader('D0 - Preparacion y ERA')}
        ${label('Sintoma / Problema observado:')}
        ${blankLines(4)}
        ${label(`Urgencia: ${CHK} Baja &nbsp;&nbsp; ${CHK} Media &nbsp;&nbsp; ${CHK} Alta &nbsp;&nbsp; ${CHK} Critica`)}
        <div style="margin-top:4px;">${field('Cliente afectado:', '300px')}</div>
        ${label('ERA (accion de emergencia ejecutada):')}
        ${blankLines(3)}
        <div style="margin-top:4px;">
            ${field('Resp. ERA:', '200px')}
            ${field('Fecha:', '140px')}
        </div>

        <!-- D1 -->
        ${sectionHeader('D1 - Equipo')}
        <div style="margin-bottom:4px;">
            ${field('Lider:', '220px')}
            ${field('Champion:', '220px')}
        </div>
        ${label('Miembros (nombre - area):')}
        ${blankLines(3)}

        <!-- D2 -->
        ${sectionHeader('D2 - Descripcion del Problema (5W2H + Es/No Es)')}
        <table style="width:100%; border-collapse:collapse; margin-bottom:8px; font-size:10pt; font-family:${FONT};">
            <thead>
                <tr>
                    <th style="border:1px solid ${GRAY_BORDER}; padding:4px 8px; background:#f0f4f8; text-align:left; width:20%;">Pregunta</th>
                    <th style="border:1px solid ${GRAY_BORDER}; padding:4px 8px; background:#f0f4f8; text-align:center; width:40%;">ES</th>
                    <th style="border:1px solid ${GRAY_BORDER}; padding:4px 8px; background:#f0f4f8; text-align:center; width:40%;">NO ES</th>
                </tr>
            </thead>
            <tbody>
                ${['Que?', 'Donde?', 'Cuando?', 'Cuantos?'].map(q => `
                <tr>
                    <td style="border:1px solid ${GRAY_BORDER}; padding:4px 8px; font-weight:bold;">${q}</td>
                    <td style="border:1px solid ${GRAY_BORDER}; padding:4px 8px; height:${LINE_HEIGHT};">&nbsp;</td>
                    <td style="border:1px solid ${GRAY_BORDER}; padding:4px 8px; height:${LINE_HEIGHT};">&nbsp;</td>
                </tr>`).join('')}
            </tbody>
        </table>
        <div style="margin-bottom:4px;">${field('Quien detecto:', '300px')}</div>
        ${label('Como se detecto:')}
        ${blankLines(2)}
        <div style="margin-top:4px;">${field('N\u00B0 Pieza / P.N.:', '300px')}</div>

        ${footer(1)}
    </div>`;
}

function buildPage2(): string {
    return `
    <!-- PAGE 2: D3 + D4 -->
    <div style="font-family:${FONT}; font-size:10pt;">

        <!-- D3 -->
        ${sectionHeader('D3 - Contencion Interina (ICA)')}
        ${label('Acciones de contencion:')}
        ${blankLines(4)}
        ${label('Verificacion de efectividad ICA:')}
        ${blankLines(3)}
        <div style="margin-top:4px;">
            ${field('Responsable:', '180px')}
            ${field('Fecha:', '120px')}
            <span style="font-size:10pt; font-family:${FONT};">Estado: ${CHK} Pend &nbsp; ${CHK} Proceso &nbsp; ${CHK} Cerrado</span>
        </div>

        <!-- D4 -->
        ${sectionHeader('D4 - Causa Raiz y Punto de Escape')}

        <!-- Ishikawa 6M as table -->
        <div style="font-size:10pt; font-weight:bold; margin-bottom:4px;">Diagrama Ishikawa (6M):</div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:8px; font-size:10pt; font-family:${FONT};">
            <tr>
                <td style="border:1px solid ${GRAY_BORDER}; padding:4px 8px; width:33%; vertical-align:top;">
                    <div style="font-weight:bold; margin-bottom:4px;">Mano de Obra</div>
                    ${blankLines(3)}
                </td>
                <td style="border:1px solid ${GRAY_BORDER}; padding:4px 8px; width:33%; vertical-align:top;">
                    <div style="font-weight:bold; margin-bottom:4px;">Maquina</div>
                    ${blankLines(3)}
                </td>
                <td style="border:1px solid ${GRAY_BORDER}; padding:4px 8px; width:34%; vertical-align:top;">
                    <div style="font-weight:bold; margin-bottom:4px;">Material</div>
                    ${blankLines(3)}
                </td>
            </tr>
            <tr>
                <td style="border:1px solid ${GRAY_BORDER}; padding:4px 8px; vertical-align:top;">
                    <div style="font-weight:bold; margin-bottom:4px;">Metodo</div>
                    ${blankLines(3)}
                </td>
                <td style="border:1px solid ${GRAY_BORDER}; padding:4px 8px; vertical-align:top;">
                    <div style="font-weight:bold; margin-bottom:4px;">Medio Ambiente</div>
                    ${blankLines(3)}
                </td>
                <td style="border:1px solid ${GRAY_BORDER}; padding:4px 8px; vertical-align:top;">
                    <div style="font-weight:bold; margin-bottom:4px;">Medicion</div>
                    ${blankLines(3)}
                </td>
            </tr>
        </table>

        <!-- 5 Why -->
        <div style="font-size:10pt; font-weight:bold; margin-bottom:4px;">5 Por Que:</div>
        ${[1, 2, 3, 4, 5].map(n =>
        `<div style="margin-bottom:2px;">${n}. Por que? <span style="display:inline-block; border-bottom:1px solid ${GRAY_BORDER}; width:85%; margin-left:4px;">&nbsp;</span></div>`
    ).join('')}

        <!-- Root cause box -->
        <div style="border:3px solid #333333; padding:6px 8px; margin-top:10px; margin-bottom:6px;">
            <div style="font-weight:bold; font-size:10pt;">CAUSA RAIZ:</div>
            ${blankLines(3)}
        </div>
        ${label('Verificacion de la causa raiz:')}
        ${blankLines(2)}

        <div style="border:3px solid #333333; padding:6px 8px; margin-top:6px; margin-bottom:6px;">
            <div style="font-weight:bold; font-size:10pt;">PUNTO DE ESCAPE:</div>
            ${blankLines(2)}
        </div>
        ${label('Por que no se detecto:')}
        ${blankLines(2)}

        ${footer(2)}
    </div>`;
}

function buildPage3(): string {
    return `
    <!-- PAGE 3: D5 + D6 + D7 + D8 -->
    <div style="font-family:${FONT}; font-size:10pt;">

        <!-- D5 -->
        ${sectionHeader('D5 - Acciones Correctivas Permanentes (PCAs)')}
        <table style="width:100%; border-collapse:collapse; margin-bottom:6px; font-size:10pt; font-family:${FONT};">
            <thead>
                <tr>
                    <th style="border:1px solid ${GRAY_BORDER}; padding:4px 6px; background:#f0f4f8; width:5%; text-align:center;">#</th>
                    <th style="border:1px solid ${GRAY_BORDER}; padding:4px 6px; background:#f0f4f8; width:40%; text-align:left;">Accion</th>
                    <th style="border:1px solid ${GRAY_BORDER}; padding:4px 6px; background:#f0f4f8; width:20%; text-align:left;">Responsable</th>
                    <th style="border:1px solid ${GRAY_BORDER}; padding:4px 6px; background:#f0f4f8; width:15%; text-align:center;">Plazo</th>
                    <th style="border:1px solid ${GRAY_BORDER}; padding:4px 6px; background:#f0f4f8; width:20%; text-align:center;">Estado</th>
                </tr>
            </thead>
            <tbody>
                ${[1, 2, 3, 4, 5].map(n => `
                <tr>
                    <td style="border:1px solid ${GRAY_BORDER}; padding:4px 6px; text-align:center;">${n}</td>
                    <td style="border:1px solid ${GRAY_BORDER}; padding:4px 6px; height:${LINE_HEIGHT};">&nbsp;</td>
                    <td style="border:1px solid ${GRAY_BORDER}; padding:4px 6px;">&nbsp;</td>
                    <td style="border:1px solid ${GRAY_BORDER}; padding:4px 6px;">&nbsp;</td>
                    <td style="border:1px solid ${GRAY_BORDER}; padding:4px 6px;">&nbsp;</td>
                </tr>`).join('')}
            </tbody>
        </table>
        ${label('PCA Punto de Escape:')}
        ${blankLines(2)}
        <div style="margin-top:4px;">${field('Resp.:', '200px')}</div>
        ${label('Evaluacion de riesgo:')}
        ${blankLines(2)}
        ${label('Metodo de verificacion:')}
        ${blankLines(2)}

        <!-- D6 -->
        ${sectionHeader('D6 - Implementacion y Validacion')}
        ${label('Validacion de efectividad:')}
        ${blankLines(2)}
        ${label('Evidencia:')}
        ${blankLines(2)}
        <div style="margin-top:4px;">
            ${field('Periodo de validacion:', '180px')}
            <span style="font-size:10pt; font-family:${FONT};">ICA retirada: ${CHK} Si &nbsp; ${CHK} No</span>
            ${field(' Fecha:', '120px')}
        </div>
        <div style="margin-top:6px;">
            <span style="font-size:10pt; font-family:${FONT};">Efectiva: ${CHK} Si &nbsp;&nbsp; ${CHK} Parcial &nbsp;&nbsp; ${CHK} No (volver a D4)</span>
        </div>

        <!-- D7 -->
        ${sectionHeader('D7 - Prevencion de Recurrencia')}
        ${label('Acciones preventivas:')}
        ${blankLines(2)}
        <div style="margin-top:4px;">
            <span style="font-size:10pt; font-family:${FONT};">FMEA actualizado: ${CHK} Si &nbsp; ${CHK} No &nbsp;&nbsp;&nbsp;&nbsp; Plan de Control: ${CHK} Si &nbsp; ${CHK} No</span>
        </div>
        ${label('Instrucciones de trabajo:')}
        ${blankLines(1)}
        ${label('Despliegue horizontal (yokoten):')}
        ${blankLines(2)}

        <!-- D8 -->
        ${sectionHeader('D8 - Cierre')}
        ${label('Lecciones aprendidas:')}
        ${blankLines(2)}
        ${label('Reconocimiento al equipo:')}
        ${blankLines(1)}
        <div style="margin-top:4px;">
            ${field('Fecha cierre:', '160px')}
            ${field('Aprobacion cliente:', '200px')}
        </div>
        <div style="margin-top:4px;">
            ${field('Verificacion efectividad (30-90 dias):', '300px')}
        </div>

        ${footer(3)}
    </div>`;
}

function buildPage4(): string {
    return `
    <!-- PAGE 4: Hoja de Datos de Campo (Gemba) -->
    <div style="font-family:${FONT}; font-size:10pt;">

        ${sectionHeader('RELEVAMIENTO DE CAMPO (Gemba)')}

        <div style="margin-bottom:4px;">
            ${field('Fecha/Hora:', '160px')}
            ${field('Turno:', '80px')}
            ${field('Relevado por:', '200px')}
        </div>
        <div style="margin-bottom:6px;">
            ${field('Linea/Estacion:', '200px')}
            ${field('N\u00B0 Pieza:', '200px')}
        </div>

        ${label('Problema observado (HECHOS, no interpretaciones):')}
        ${blankLines(5)}

        <div style="margin-top:4px; margin-bottom:4px;">
            ${field('Cantidad defectos:', '120px')}
            ${field('Tamano muestra:', '120px')}
        </div>

        ${label('Personas entrevistadas (nombre, rol, declaracion):')}
        ${blankLines(4)}

        ${label('Mediciones tomadas (dimension, instrumento, valores):')}
        ${blankLines(4)}

        ${label('Condiciones ambientales:')}
        ${blankLines(2)}

        ${label('Cronologia de eventos:')}
        ${blankLines(4)}

        ${label('Acciones inmediatas tomadas:')}
        ${blankLines(2)}

        ${label('Material/Equipo (lotes, IDs maquina):')}
        ${blankLines(2)}

        ${label('Fotos/Evidencia (referencias):')}
        ${blankLines(2)}

        ${label('Notas adicionales:')}
        ${blankLines(3)}

        ${footer(4)}
    </div>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Export the 8D Field Data Collection Sheet as a printable PDF.
 *
 * If `report` is provided, pre-fills header info (title, part number, report number).
 * All body fields remain blank with ruled lines for manual completion.
 */
export async function exportFieldSheetPdf(
    report?: Partial<{ title: string; d2: { partNumber: string }; reportNumber: string }>,
): Promise<void> {
    const reportNumber = report?.reportNumber || 'blank';

    const htmlContent = [
        buildPage1(report),
        pageBreak(),
        buildPage2(),
        pageBreak(),
        buildPage3(),
        pageBreak(),
        buildPage4(),
    ].join('\n');

    await renderHtmlToPdf(htmlContent, {
        filename: `8D_HojaCampo_${reportNumber}.pdf`,
        paperSize: 'a4',
        orientation: 'portrait',
        margin: [15, 15, 15, 15],
    });
}
