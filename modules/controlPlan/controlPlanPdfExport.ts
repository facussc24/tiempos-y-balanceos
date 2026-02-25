/**
 * Control Plan PDF Export
 *
 * Two templates:
 * 1. Full AIAG Table (landscape A3) — complete CP with all 14 columns, rowspan grouping
 * 2. Items Criticos (landscape A4) — CC/SC and AP=H items only, compact
 *
 * Uses html2pdf.js (already in package.json as ^0.10.2).
 * Teal color scheme to match CP module (vs blue for AMFE).
 *
 * Architecture ported from modules/amfe/amfePdfExport.ts:
 * - Inline styles (html2pdf.js does not inherit external CSS)
 * - esc() for XSS prevention in generated HTML
 * - Off-screen rendering pattern
 * - Rowspan grouping for processStepNumber
 */

import {
    ControlPlanDocument,
    ControlPlanItem,
    ControlPlanHeader,
    CP_COLUMNS,
    CP_COLUMN_GROUPS,
    CONTROL_PLAN_PHASES,
} from './controlPlanTypes';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { getRequiredKeysForItem } from './controlPlanValidation';

// --- COLOR CONSTANTS (teal theme for CP) ---
const TEAL_HEADER = '#0D9488';
const TEAL_LIGHT = '#CCFBF1';
const AP_COLORS: Record<string, { bg: string; text: string }> = {
    'H': { bg: '#DC2626', text: '#FFFFFF' },
    'M': { bg: '#FACC15', text: '#000000' },
    'L': { bg: '#16A34A', text: '#FFFFFF' },
};

// --- SHARED HTML HELPERS ---

/** Sanitize text for HTML output (prevent XSS in generated HTML). */
export function esc(value: string | number | undefined): string {
    if (value == null || value === '') return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function cellStyle(align: 'left' | 'center' = 'left'): string {
    return `border:1px solid #d1d5db; padding:4px 6px; font-size:8px; font-family:Arial,sans-serif; vertical-align:top; text-align:${align}; word-wrap:break-word;`;
}

function headerCellStyle(bg: string = TEAL_HEADER): string {
    return `border:1px solid #5eead4; padding:4px 6px; font-size:8px; font-family:Arial,sans-serif; font-weight:bold; color:#fff; background:${bg}; text-align:center; vertical-align:middle;`;
}

function apRowBg(ap?: string): string {
    if (ap === 'H') return 'background:#FEF2F2;';
    if (ap === 'M') return 'background:#FEFCE8;';
    if (ap === 'L') return 'background:#F0FDF4;';
    return '';
}

function specialCharBadge(sc: string): string {
    const up = (sc || '').toUpperCase().trim();
    if (up === 'CC') return `<span style="background:#DC2626; color:#fff; padding:1px 4px; border-radius:3px; font-size:7px; font-weight:bold;">CC</span>`;
    if (up === 'SC') return `<span style="background:#F59E0B; color:#fff; padding:1px 4px; border-radius:3px; font-size:7px; font-weight:bold;">SC</span>`;
    return esc(sc);
}

function apBadge(ap?: string): string {
    const color = AP_COLORS[ap || ''];
    if (!color) return esc(ap);
    return `<span style="background:${color.bg}; color:${color.text}; padding:1px 6px; border-radius:3px; font-size:7px; font-weight:bold;">${esc(ap)}</span>`;
}

// --- PROCESS STEP GROUPING ---

interface ProcessStepGroup {
    processStepNumber: string;
    processDescription: string;
    items: ControlPlanItem[];
}

/** Group items by processStepNumber for rowspan merging. */
export function groupByProcessStep(items: ControlPlanItem[]): ProcessStepGroup[] {
    const groups: ProcessStepGroup[] = [];
    let current: ProcessStepGroup | null = null;
    for (const item of items) {
        if (!current || current.processStepNumber !== item.processStepNumber) {
            current = {
                processStepNumber: item.processStepNumber,
                processDescription: item.processDescription,
                items: [],
            };
            groups.push(current);
        }
        current.items.push(item);
    }
    return groups;
}

// --- HEADER HTML ---

function buildHeaderHtml(header: ControlPlanHeader, title: string): string {
    const phaseName = CONTROL_PLAN_PHASES.find(p => p.value === header.phase)?.label || header.phase;
    const today = new Date().toLocaleDateString('es-AR');
    return `
        <div style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <div>
                    <h1 style="font-family:Arial,sans-serif; font-size:16px; color:#115E59; margin:0 0 4px 0;">
                        PLAN DE CONTROL \u2014 ${esc(header.partName || 'Sin Titulo')}
                    </h1>
                    <p style="font-family:Arial,sans-serif; font-size:10px; color:#6B7280; margin:0;">
                        ${esc(title)}
                    </p>
                </div>
                <div style="text-align:right; font-family:Arial,sans-serif; font-size:8px; color:#9CA3AF;">
                    <div>Plan No.: ${esc(header.controlPlanNumber || '-')}</div>
                    <div>Fase: <strong style="color:#0D9488;">${esc(phaseName)}</strong></div>
                    <div>Rev.: ${esc(header.revision || '-')}</div>
                    <div>Fecha: ${today}</div>
                </div>
            </div>
            <table style="border-collapse:collapse; width:100%; margin-bottom:8px;">
                <tr>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold; width:110px; background:${TEAL_LIGHT};">Nro. Pieza</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(header.partNumber)}</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold; width:110px; background:${TEAL_LIGHT};">Organizacion</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(header.organization)}</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold; width:110px; background:${TEAL_LIGHT};">Cliente</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(header.client)}</td>
                </tr>
                <tr>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold; background:${TEAL_LIGHT};">Responsable</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(header.responsible)}</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold; background:${TEAL_LIGHT};">Equipo</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(header.coreTeam)}</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold; background:${TEAL_LIGHT};">AMFE Vinculado</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(header.linkedAmfeProject)}</td>
                </tr>
                <tr>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold; background:${TEAL_LIGHT};">Aprobado por</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(header.approvedBy)}</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold; background:${TEAL_LIGHT};">Nivel Cambio</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(header.latestChangeLevel)}</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px; font-weight:bold; background:${TEAL_LIGHT};">Proveedor</td>
                    <td style="font-family:Arial,sans-serif; font-size:8px; padding:2px 4px;">${esc(header.supplier)}</td>
                </tr>
            </table>
            <hr style="border:none; border-top:2px solid ${TEAL_HEADER}; margin:0;" />
        </div>
    `;
}

// ============================================================================
// TEMPLATE 1: FULL AIAG TABLE (Landscape A3)
// ============================================================================

function buildFullTableHtml(doc: ControlPlanDocument): string {
    const header = buildHeaderHtml(doc.header, 'Plan de Control Completo (AIAG)');
    const groups = groupByProcessStep(doc.items);

    // Column keys in order (matches CP_COLUMNS, minus first 2 which get rowspan)
    const remainingCols = CP_COLUMNS.slice(2); // skip processStepNumber & processDescription

    let tableRows = '';
    for (const group of groups) {
        let isFirst = true;
        for (const item of group.items) {
            const bgStyle = apRowBg(item.amfeAp);
            tableRows += `<tr style="${bgStyle}">`;

            // Rowspan merged columns: processStepNumber + processDescription
            if (isFirst) {
                tableRows += `<td rowspan="${group.items.length}" style="${cellStyle('center')} font-weight:bold; background:#F0FDFA;">${esc(group.processStepNumber)}</td>`;
                tableRows += `<td rowspan="${group.items.length}" style="${cellStyle()} font-weight:bold; background:#F0FDFA;">${esc(group.processDescription)}</td>`;
                isFirst = false;
            }

            // Remaining columns
            for (const col of remainingCols) {
                if (col.key === 'specialCharClass') {
                    tableRows += `<td style="${cellStyle('center')}">${specialCharBadge(item.specialCharClass)}</td>`;
                } else {
                    const value = (item[col.key] as string) || '';
                    tableRows += `<td style="${cellStyle(col.key === 'characteristicNumber' ? 'center' : 'left')}">${esc(value)}</td>`;
                }
            }

            tableRows += '</tr>';
        }
    }

    if (doc.items.length === 0) {
        tableRows = `<tr><td colspan="${CP_COLUMNS.length}" style="${cellStyle('center')} color:#9CA3AF; padding:20px; font-style:italic;">Sin items en el Plan de Control</td></tr>`;
    }

    // Column group headers
    let groupHeaderRow = '';
    for (const group of CP_COLUMN_GROUPS) {
        groupHeaderRow += `<th colspan="${group.colSpan}" style="${headerCellStyle()}">${esc(group.label)}</th>`;
    }

    // Column sub-headers
    const colHeaderRow = CP_COLUMNS.map(col =>
        `<th style="${headerCellStyle()}">${esc(col.label)}</th>`
    ).join('');

    return `
        <div>
            ${header}
            <table style="border-collapse:collapse; width:100%; table-layout:fixed; page-break-inside:auto;">
                <thead style="display:table-header-group;">
                    <tr>${groupHeaderRow}</tr>
                    <tr>${colHeaderRow}</tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
}

// ============================================================================
// TEMPLATE 2: ITEMS CRITICOS (Landscape A4)
// ============================================================================

function buildCriticalItemsHtml(doc: ControlPlanDocument): string {
    const header = buildHeaderHtml(doc.header, 'Items Criticos (CC/SC + AP=H)');

    const critical = doc.items.filter(i => {
        const sc = (i.specialCharClass || '').toUpperCase().trim();
        return sc === 'CC' || sc === 'SC' || i.amfeAp === 'H';
    });

    // Sort: CC first, then SC, then AP=H only
    critical.sort((a, b) => {
        const order = (item: ControlPlanItem) => {
            const sc = (item.specialCharClass || '').toUpperCase().trim();
            if (sc === 'CC') return 0;
            if (sc === 'SC') return 1;
            return 2;
        };
        return order(a) - order(b);
    });

    // Context-aware required keys per row type (CP 2024)

    const headers = [
        'Paso', 'Descripcion', 'Caract. Producto', 'Clasif.',
        'AP', 'Metodo Control', 'Plan Reaccion', 'Responsable', 'Campos Faltantes',
    ];

    let tableRows = '';
    for (const item of critical) {
        const bgStyle = apRowBg(item.amfeAp);
        const itemRequiredKeys = getRequiredKeysForItem(item);
        const missing = itemRequiredKeys.filter(k => !((item[k] as string) || '').trim());
        const missingLabels = missing.map(k => {
            const col = CP_COLUMNS.find(c => c.key === k);
            return col?.label || k;
        });
        const missingHtml = missingLabels.length > 0
            ? `<span style="color:#DC2626; font-weight:bold;">${esc(missingLabels.join(', '))}</span>`
            : `<span style="color:#16A34A;">\u2714</span>`;

        const ownerStyle = !(item.reactionPlanOwner || '').trim()
            ? 'color:#DC2626; font-weight:bold;'
            : '';

        tableRows += `<tr style="${bgStyle}">
            <td style="${cellStyle('center')} font-weight:bold;">${esc(item.processStepNumber || '\u2014')}</td>
            <td style="${cellStyle()}">${esc(item.processDescription || item.productCharacteristic || '(sin descripcion)')}</td>
            <td style="${cellStyle()}">${esc(item.productCharacteristic)}</td>
            <td style="${cellStyle('center')}">${specialCharBadge(item.specialCharClass)}</td>
            <td style="${cellStyle('center')}">${apBadge(item.amfeAp)}</td>
            <td style="${cellStyle()}">${esc(item.controlMethod || '-')}</td>
            <td style="${cellStyle()}">${esc(item.reactionPlan || '-')}</td>
            <td style="${cellStyle()} ${ownerStyle}">${esc(item.reactionPlanOwner || '(sin asignar)')}</td>
            <td style="${cellStyle()}">${missingHtml}</td>
        </tr>`;
    }

    if (critical.length === 0) {
        if (doc.items.length === 0) {
            tableRows = `<tr><td colspan="9" style="${cellStyle('center')} color:#9CA3AF; padding:20px; font-style:italic;">Sin items en el Plan de Control</td></tr>`;
        } else {
            tableRows = `<tr><td colspan="9" style="${cellStyle('center')} padding:20px;">
                <span style="color:#16A34A; font-weight:bold;">\u2714 Todos los items son no-criticos o estan completos</span>
            </td></tr>`;
        }
    }

    const summaryHtml = `
        <div style="display:flex; gap:16px; margin-bottom:10px; font-family:Arial,sans-serif; font-size:9px;">
            <div style="background:#FEF2F2; border:1px solid #FCA5A5; border-radius:4px; padding:6px 12px;">
                <strong style="color:#DC2626;">CC:</strong> ${doc.items.filter(i => (i.specialCharClass || '').toUpperCase().trim() === 'CC').length}
            </div>
            <div style="background:#FEFCE8; border:1px solid #FDE047; border-radius:4px; padding:6px 12px;">
                <strong style="color:#CA8A04;">SC:</strong> ${doc.items.filter(i => (i.specialCharClass || '').toUpperCase().trim() === 'SC').length}
            </div>
            <div style="background:#FEF2F2; border:1px solid #FCA5A5; border-radius:4px; padding:6px 12px;">
                <strong style="color:#DC2626;">AP=H:</strong> ${doc.items.filter(i => i.amfeAp === 'H').length}
            </div>
            <div style="background:#F3F4F6; border:1px solid #D1D5DB; border-radius:4px; padding:6px 12px;">
                <strong>Total Items:</strong> ${doc.items.length}
            </div>
        </div>
    `;

    return `
        <div>
            ${header}
            ${summaryHtml}
            <table style="border-collapse:collapse; width:100%; page-break-inside:auto;">
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
// PUBLIC API
// ============================================================================

export type CpPdfTemplate = 'full' | 'critical';

export interface CpPdfExportOptions {
    paperSize?: 'A3' | 'A4';
    orientation?: 'landscape' | 'portrait';
}

const TEMPLATE_BUILDERS: Record<CpPdfTemplate, (doc: ControlPlanDocument) => string> = {
    full: buildFullTableHtml,
    critical: buildCriticalItemsHtml,
};

const TEMPLATE_NAMES: Record<CpPdfTemplate, string> = {
    full: 'AIAG_Completo',
    critical: 'Items_Criticos',
};

/**
 * Get the HTML preview string for a given template (for tests and preview modals).
 */
export function getCpPdfPreviewHtml(doc: ControlPlanDocument, template: CpPdfTemplate): string {
    const builder = TEMPLATE_BUILDERS[template];
    return builder(doc);
}

/**
 * Export a Control Plan document to PDF.
 * Creates a temporary off-screen element, renders styled HTML, and converts to PDF.
 */
export async function exportCpPdf(
    doc: ControlPlanDocument,
    template: CpPdfTemplate,
    options?: CpPdfExportOptions,
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

    const safeName = sanitizeFilename(doc.header.partName || 'Export', { allowSpaces: true });
    const date = new Date().toISOString().split('T')[0];
    const filename = `PlanDeControl_${TEMPLATE_NAMES[template]}_${safeName}_${date}.pdf`;

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
