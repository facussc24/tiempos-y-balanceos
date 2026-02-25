/**
 * AMFE PDF Export
 *
 * Generates high-quality PDF documents from AMFE data using html2pdf.js.
 * Three export templates:
 * 1. Full VDA Table — complete sabana with all columns (landscape A3)
 * 2. Resumen AP — high/medium priority causes summary
 * 3. Plan de Acciones — open actions for tracking meetings
 *
 * Design: Build styled HTML tables → convert to PDF via html2pdf.js
 * Inline styles are required because html2pdf.js does not inherit external CSS.
 */

import { AmfeDocument, AmfeCause, AmfeFailure, ActionPriority } from './amfeTypes';
import { WORK_ELEMENT_LABELS, WorkElementType } from './amfeTypes';
import { sanitizeFilename } from '../../utils/filenameSanitization';

// --- COLOR CONSTANTS (matching Excel export) ---
const AP_COLORS: Record<string, { bg: string; text: string }> = {
    [ActionPriority.HIGH]: { bg: '#DC2626', text: '#FFFFFF' },
    [ActionPriority.MEDIUM]: { bg: '#FACC15', text: '#000000' },
    [ActionPriority.LOW]: { bg: '#16A34A', text: '#FFFFFF' },
};

const BLUE_HEADER = '#2563EB';

// --- SHARED HTML HELPERS ---

/** Sanitize text for HTML output (prevent XSS in generated HTML) */
function esc(value: string | number | undefined): string {
    if (value == null || value === '') return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function apCell(ap: string): string {
    const color = AP_COLORS[ap];
    if (!color) return `<td style="${cellStyle('center')}">${esc(ap)}</td>`;
    return `<td style="${cellStyle('center')} background:${color.bg}; color:${color.text}; font-weight:bold;">${esc(ap)}</td>`;
}

function cellStyle(align: 'left' | 'center' = 'left'): string {
    return `border:1px solid #d1d5db; padding:4px 6px; font-size:8px; font-family:Arial,sans-serif; vertical-align:top; text-align:${align}; word-wrap:break-word;`;
}

function headerCellStyle(bg: string = BLUE_HEADER): string {
    return `border:1px solid #93a3b8; padding:4px 6px; font-size:8px; font-family:Arial,sans-serif; font-weight:bold; color:#fff; background:${bg}; text-align:center; vertical-align:middle;`;
}

/** Flatten hierarchy to one row per cause with parent context */
interface FlatRow {
    opNumber: string;
    opName: string;
    weType: string;
    weName: string;
    funcDescription: string;
    funcRequirements: string;
    failure: AmfeFailure;
    cause: AmfeCause;
}

function flattenCauseRows(doc: AmfeDocument): FlatRow[] {
    const rows: FlatRow[] = [];
    for (const op of doc.operations) {
        for (const we of op.workElements) {
            for (const func of we.functions) {
                for (const fail of func.failures) {
                    for (const cause of fail.causes) {
                        rows.push({
                            opNumber: op.opNumber,
                            opName: op.name,
                            weType: we.type,
                            weName: we.name,
                            funcDescription: func.description,
                            funcRequirements: func.requirements,
                            failure: fail,
                            cause,
                        });
                    }
                }
            }
        }
    }
    return rows;
}

/** Build the PDF header section with project metadata */
function buildHeaderHtml(doc: AmfeDocument, title: string): string {
    const h = doc.header;
    const today = new Date().toLocaleDateString('es-AR');
    return `
        <div style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <div>
                    <h1 style="font-family:Arial,sans-serif; font-size:16px; color:#1E3A8A; margin:0 0 4px 0;">
                        AMFE VDA — ${esc(h.subject || 'Sin Título')}
                    </h1>
                    <p style="font-family:Arial,sans-serif; font-size:10px; color:#6B7280; margin:0;">
                        ${esc(title)}
                    </p>
                </div>
                <div style="text-align:right; font-family:Arial,sans-serif; font-size:8px; color:#9CA3AF;">
                    <div>AMFE No.: ${esc(h.amfeNumber || '-')}</div>
                    <div>Rev.: ${esc(h.revision || '-')}</div>
                    <div>Fecha Rev.: ${esc(h.revDate || today)}</div>
                    <div>Conf.: ${esc(h.confidentiality || '-')}</div>
                </div>
            </div>
            <table style="border-collapse:collapse; width:100%; margin-bottom:8px;">
                <tr>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold; width:100px;">Organización</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(h.organization)}</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold; width:100px;">Ubicación</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(h.location)}</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold; width:100px;">Cliente</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(h.client)}</td>
                </tr>
                <tr>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold;">Nro. Pieza</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(h.partNumber)}</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold;">Modelo/Año</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(h.modelYear)}</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold;">Fecha Inicio</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(h.startDate)}</td>
                </tr>
                <tr>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold;">Responsable</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(h.responsible)}</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold;">Resp. Proceso</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(h.processResponsible)}</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold;">Equipo</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(h.team)}</td>
                </tr>
                <tr>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold;">Aprobado por</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(h.approvedBy)}</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold;">Alcance</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;" colspan="3">${esc(h.scope)}</td>
                </tr>
            </table>
            <hr style="border:none; border-top:2px solid ${BLUE_HEADER}; margin:0;" />
        </div>
    `;
}

// ============================================================================
// TEMPLATE 1: FULL VDA TABLE
// ============================================================================

function buildFullTableHtml(doc: AmfeDocument): string {
    const header = buildHeaderHtml(doc, 'Tabla VDA Completa');

    let tableRows = '';
    for (const op of doc.operations) {
        // Count total cause rows for this operation (for rowspan)
        let opCauseCount = 0;
        for (const we of op.workElements)
            for (const func of we.functions)
                for (const fail of func.failures)
                    opCauseCount += Math.max(fail.causes.length, 1);

        if (opCauseCount === 0) opCauseCount = 1;

        let isFirstOpRow = true;

        for (const we of op.workElements) {
            let weCauseCount = 0;
            for (const func of we.functions)
                for (const fail of func.failures)
                    weCauseCount += Math.max(fail.causes.length, 1);

            if (weCauseCount === 0) weCauseCount = 1;

            let isFirstWeRow = true;

            for (const func of we.functions) {
                let funcCauseCount = 0;
                for (const fail of func.failures)
                    funcCauseCount += Math.max(fail.causes.length, 1);

                if (funcCauseCount === 0) funcCauseCount = 1;

                let isFirstFuncRow = true;

                for (const fail of func.failures) {
                    const causeCount = Math.max(fail.causes.length, 1);
                    let isFirstFailRow = true;

                    const causes = fail.causes.length > 0 ? fail.causes : [null];

                    for (const cause of causes) {
                        tableRows += '<tr>';

                        // Operation cells (merged)
                        if (isFirstOpRow) {
                            tableRows += `<td rowspan="${opCauseCount}" style="${cellStyle('center')} font-weight:bold; background:#EFF6FF;">${esc(op.opNumber)}</td>`;
                            tableRows += `<td rowspan="${opCauseCount}" style="${cellStyle()} font-weight:bold; background:#EFF6FF;">${esc(op.name)}</td>`;
                            isFirstOpRow = false;
                        }

                        // WE cells (merged)
                        if (isFirstWeRow) {
                            const weLabel = WORK_ELEMENT_LABELS[we.type as WorkElementType] || we.type;
                            tableRows += `<td rowspan="${weCauseCount}" style="${cellStyle('center')} background:#F5F3FF; font-size:7px;">${esc(weLabel)}</td>`;
                            tableRows += `<td rowspan="${weCauseCount}" style="${cellStyle()} background:#F5F3FF;">${esc(we.name)}</td>`;
                            isFirstWeRow = false;
                        }

                        // Function cells (merged)
                        if (isFirstFuncRow) {
                            tableRows += `<td rowspan="${funcCauseCount}" style="${cellStyle()}">${esc(func.description)}</td>`;
                            tableRows += `<td rowspan="${funcCauseCount}" style="${cellStyle()}">${esc(func.requirements)}</td>`;
                            isFirstFuncRow = false;
                        }

                        // Failure cells (merged across causes)
                        if (isFirstFailRow) {
                            tableRows += `<td rowspan="${causeCount}" style="${cellStyle()}">${esc(fail.description)}</td>`;
                            tableRows += `<td rowspan="${causeCount}" style="${cellStyle()} font-size:7px;">${esc(fail.effectLocal)}</td>`;
                            tableRows += `<td rowspan="${causeCount}" style="${cellStyle()} font-size:7px;">${esc(fail.effectNextLevel)}</td>`;
                            tableRows += `<td rowspan="${causeCount}" style="${cellStyle()} font-size:7px;">${esc(fail.effectEndUser)}</td>`;
                            tableRows += `<td rowspan="${causeCount}" style="${cellStyle('center')} font-weight:bold;">${esc(fail.severity)}</td>`;
                            isFirstFailRow = false;
                        }

                        // Cause cells (one per row)
                        if (cause) {
                            tableRows += `<td style="${cellStyle()}">${esc(cause.cause)}</td>`;
                            tableRows += `<td style="${cellStyle()}">${esc(cause.preventionControl)}</td>`;
                            tableRows += `<td style="${cellStyle('center')}">${esc(cause.occurrence)}</td>`;
                            tableRows += `<td style="${cellStyle()}">${esc(cause.detectionControl)}</td>`;
                            tableRows += `<td style="${cellStyle('center')}">${esc(cause.detection)}</td>`;
                            tableRows += apCell(String(cause.ap));
                            // Step 5 extras
                            tableRows += `<td style="${cellStyle('center')}">${esc(cause.characteristicNumber)}</td>`;
                            tableRows += `<td style="${cellStyle('center')}">${esc(cause.specialChar)}</td>`;
                            tableRows += `<td style="${cellStyle('center')}">${esc(cause.filterCode)}</td>`;
                            // Step 6 columns
                            tableRows += `<td style="${cellStyle()}">${esc(cause.preventionAction)}</td>`;
                            tableRows += `<td style="${cellStyle()}">${esc(cause.detectionAction)}</td>`;
                            tableRows += `<td style="${cellStyle()}">${esc(cause.responsible)}</td>`;
                            tableRows += `<td style="${cellStyle('center')}">${esc(cause.targetDate)}</td>`;
                            tableRows += `<td style="${cellStyle('center')}">${esc(cause.status)}</td>`;
                            // Step 6 results
                            tableRows += `<td style="${cellStyle()}">${esc(cause.actionTaken)}</td>`;
                            tableRows += `<td style="${cellStyle('center')}">${esc(cause.completionDate)}</td>`;
                            tableRows += `<td style="${cellStyle('center')}">${esc(cause.severityNew)}</td>`;
                            tableRows += `<td style="${cellStyle('center')}">${esc(cause.occurrenceNew)}</td>`;
                            tableRows += `<td style="${cellStyle('center')}">${esc(cause.detectionNew)}</td>`;
                            tableRows += apCell(String(cause.apNew || ''));
                            // Observations
                            tableRows += `<td style="${cellStyle()}">${esc(cause.observations)}</td>`;
                        } else {
                            // Empty cause placeholder — merged cell (21 cause-level columns)
                            tableRows += `<td colspan="21" style="${cellStyle('center')} color:#9CA3AF; font-style:italic;">Sin causas definidas</td>`;
                        }

                        tableRows += '</tr>';
                    }
                }
            }
        }
    }

    const headers = [
        'Op', 'Paso del Proceso', '6M', 'Elemento', 'Función', 'Requisito',
        'Modo de Falla', 'Efecto Local', 'Efecto Cliente', 'Efecto Usr. Final', 'S',
        'Causa', 'Control Prev.', 'O', 'Control Det.', 'D', 'AP',
        'No.Car', 'Car.', 'Filtro',
        'Acción Prev.', 'Acción Det.', 'Responsable', 'Fecha Obj.', 'Estado',
        'Acción Tomada', 'Fecha Real', 'S*', 'O*', 'D*', 'AP*',
        'Obs.',
    ];

    return `
        <div>
            ${header}
            <table style="border-collapse:collapse; width:100%; table-layout:fixed; page-break-inside:auto;">
                <thead style="display:table-header-group;">
                    <tr>${headers.map(h => `<th style="${headerCellStyle()}">${esc(h)}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
}

// ============================================================================
// TEMPLATE 2: RESUMEN AP (High/Medium priority causes)
// ============================================================================

function buildSummaryHtml(doc: AmfeDocument): string {
    const header = buildHeaderHtml(doc, 'Resumen de Prioridades AP');
    const allRows = flattenCauseRows(doc);
    const priority = allRows.filter(r =>
        r.cause.ap === ActionPriority.HIGH || r.cause.ap === ActionPriority.MEDIUM
    );

    // Sort: H first, then M; within same AP, by severity desc
    priority.sort((a, b) => {
        if (a.cause.ap === ActionPriority.HIGH && b.cause.ap !== ActionPriority.HIGH) return -1;
        if (a.cause.ap !== ActionPriority.HIGH && b.cause.ap === ActionPriority.HIGH) return 1;
        return Number(b.failure.severity) - Number(a.failure.severity);
    });

    const hCount = allRows.filter(r => r.cause.ap === ActionPriority.HIGH).length;
    const mCount = allRows.filter(r => r.cause.ap === ActionPriority.MEDIUM).length;
    const lCount = allRows.filter(r => r.cause.ap === ActionPriority.LOW).length;

    const summaryHtml = `
        <div style="display:flex; gap:16px; margin-bottom:10px; font-family:Arial,sans-serif; font-size:9px;">
            <div style="background:#FEF2F2; border:1px solid #FCA5A5; border-radius:4px; padding:6px 12px;">
                <strong style="color:#DC2626;">AP Alto (H):</strong> ${hCount}
            </div>
            <div style="background:#FEFCE8; border:1px solid #FDE047; border-radius:4px; padding:6px 12px;">
                <strong style="color:#CA8A04;">AP Medio (M):</strong> ${mCount}
            </div>
            <div style="background:#F0FDF4; border:1px solid #86EFAC; border-radius:4px; padding:6px 12px;">
                <strong style="color:#16A34A;">AP Bajo (L):</strong> ${lCount}
            </div>
            <div style="background:#F3F4F6; border:1px solid #D1D5DB; border-radius:4px; padding:6px 12px;">
                <strong>Total Causas:</strong> ${allRows.length}
            </div>
        </div>
    `;

    const headers = ['Op', 'Paso', 'Elemento 6M', 'Función', 'Modo de Falla', 'Efecto Usr. Final', 'Causa Raíz', 'S', 'O', 'D', 'AP', 'Estado', 'Responsable'];

    let tableRows = '';
    for (const item of priority) {
        const f = item.failure;
        const c = item.cause;
        tableRows += `<tr>
            <td style="${cellStyle('center')}">${esc(item.opNumber)}</td>
            <td style="${cellStyle()}">${esc(item.opName)}</td>
            <td style="${cellStyle()}">${esc(item.weType)}: ${esc(item.weName)}</td>
            <td style="${cellStyle()}">${esc(item.funcDescription)}</td>
            <td style="${cellStyle()}">${esc(f.description)}</td>
            <td style="${cellStyle()}">${esc(f.effectEndUser)}</td>
            <td style="${cellStyle()}">${esc(c.cause)}</td>
            <td style="${cellStyle('center')} font-weight:bold;">${esc(f.severity)}</td>
            <td style="${cellStyle('center')}">${esc(c.occurrence)}</td>
            <td style="${cellStyle('center')}">${esc(c.detection)}</td>
            ${apCell(String(c.ap))}
            <td style="${cellStyle('center')}">${esc(c.status || '-')}</td>
            <td style="${cellStyle()}">${esc(c.responsible || '-')}</td>
        </tr>`;
    }

    if (priority.length === 0) {
        tableRows = `<tr><td colspan="13" style="${cellStyle('center')} color:#9CA3AF; padding:20px;">No hay causas con AP Alto o Medio</td></tr>`;
    }

    return `
        <div>
            ${header}
            ${summaryHtml}
            <table style="border-collapse:collapse; width:100%;">
                <thead>
                    <tr>${headers.map(h => `<th style="${headerCellStyle()}">${esc(h)}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
}

// ============================================================================
// TEMPLATE 3: PLAN DE ACCIONES (open action items)
// ============================================================================

function buildActionPlanHtml(doc: AmfeDocument): string {
    const header = buildHeaderHtml(doc, 'Plan de Acciones Abiertas');
    const allRows = flattenCauseRows(doc);
    const actionItems = allRows.filter(r =>
        r.cause.status !== 'Completado' && r.cause.status !== 'Cancelado' &&
        (r.cause.preventionAction || r.cause.detectionAction)
    );

    // Sort: Pendiente first, then En Proceso
    actionItems.sort((a, b) => {
        const order: Record<string, number> = { 'Pendiente': 0, 'En Proceso': 1 };
        return (order[a.cause.status] ?? 2) - (order[b.cause.status] ?? 2);
    });

    const headers = ['Operación', 'Modo de Falla', 'Causa Raíz', 'AP', 'Acción Preventiva', 'Acción Detectiva', 'Responsable', 'Fecha Obj.', 'Estado', 'Acción Tomada', 'Fecha Real'];

    let tableRows = '';
    for (const item of actionItems) {
        const f = item.failure;
        const c = item.cause;
        const statusColor = c.status === 'Pendiente' ? 'color:#DC2626; font-weight:bold;' :
            c.status === 'En Proceso' ? 'color:#CA8A04; font-weight:bold;' : '';
        tableRows += `<tr>
            <td style="${cellStyle()}">${esc(item.opNumber)} - ${esc(item.opName)}</td>
            <td style="${cellStyle()}">${esc(f.description)}</td>
            <td style="${cellStyle()}">${esc(c.cause)}</td>
            ${apCell(String(c.ap))}
            <td style="${cellStyle()}">${esc(c.preventionAction)}</td>
            <td style="${cellStyle()}">${esc(c.detectionAction)}</td>
            <td style="${cellStyle()}">${esc(c.responsible)}</td>
            <td style="${cellStyle('center')}">${esc(c.targetDate)}</td>
            <td style="${cellStyle('center')} ${statusColor}">${esc(c.status)}</td>
            <td style="${cellStyle()}">${esc(c.actionTaken)}</td>
            <td style="${cellStyle('center')}">${esc(c.completionDate)}</td>
        </tr>`;
    }

    if (actionItems.length === 0) {
        tableRows = `<tr><td colspan="11" style="${cellStyle('center')} color:#9CA3AF; padding:20px;">No hay acciones abiertas</td></tr>`;
    }

    return `
        <div>
            ${header}
            <p style="font-family:Arial,sans-serif; font-size:10px; color:#4B5563; margin-bottom:8px;">
                ${actionItems.length} accion(es) abierta(s)
            </p>
            <table style="border-collapse:collapse; width:100%;">
                <thead>
                    <tr>${headers.map(h => `<th style="${headerCellStyle()}">${esc(h)}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export type PdfTemplate = 'full' | 'summary' | 'actionPlan';

export interface PdfExportOptions {
    paperSize?: 'A3' | 'A4';
    orientation?: 'landscape' | 'portrait';
}

const TEMPLATE_BUILDERS: Record<PdfTemplate, (doc: AmfeDocument) => string> = {
    full: buildFullTableHtml,
    summary: buildSummaryHtml,
    actionPlan: buildActionPlanHtml,
};

const TEMPLATE_NAMES: Record<PdfTemplate, string> = {
    full: 'Tabla_VDA',
    summary: 'Resumen_AP',
    actionPlan: 'Plan_Acciones',
};

/**
 * Get the HTML preview string for a given template (for showing a preview modal)
 */
export function getAmfePdfPreviewHtml(doc: AmfeDocument, template: PdfTemplate): string {
    const builder = TEMPLATE_BUILDERS[template];
    return builder(doc);
}

/**
 * Export an AMFE document to PDF.
 * Creates a temporary off-screen element, renders styled HTML, and converts to PDF.
 */
export async function exportAmfePdf(
    doc: AmfeDocument,
    template: PdfTemplate,
    options?: PdfExportOptions,
): Promise<void> {
    const html2pdf = (await import('html2pdf.js')).default;

    const paperSize = options?.paperSize || (template === 'full' ? 'A3' : 'A4');
    const orientation = options?.orientation || 'landscape';

    const htmlContent = TEMPLATE_BUILDERS[template](doc);

    // Create off-screen container
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = paperSize === 'A3' ? '420mm' : '297mm';
    document.body.appendChild(container);

    const safeName = sanitizeFilename(doc.header.subject || 'Export', { allowSpaces: true });
    const date = new Date().toISOString().split('T')[0];
    const filename = `AMFE_${TEMPLATE_NAMES[template]}_${safeName}_${date}.pdf`;

    try {
        await html2pdf()
            .from(container)
            .set({
                margin: [8, 6, 8, 6],
                filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                },
                jsPDF: {
                    unit: 'mm',
                    format: paperSize.toLowerCase(),
                    orientation,
                },
                pagebreak: { mode: ['avoid-all', 'css'] },
            })
            .save();
    } finally {
        document.body.removeChild(container);
    }
}
