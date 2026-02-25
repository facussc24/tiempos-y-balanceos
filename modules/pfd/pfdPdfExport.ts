/**
 * PFD PDF Export
 *
 * Generates PDF from PFD data using html2pdf.js.
 * Styled HTML tables with inline SVG symbols.
 *
 * C3-N2: Disposition column (rework/scrap/sort) replacing old Retrabajo.
 * C3-E1: Legend font 7px → 9px, SVG 16→20.
 */

import type { PfdDocument, PfdStepType, RejectDisposition } from './pfdTypes';
import { PFD_STEP_TYPES } from './pfdTypes';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { getLogoBase64 } from '../../src/assets/ppe/ppeBase64';

const CYAN_HEADER = '#0891B2';
const SGC_FORM_NUMBER = 'I-AC-005.1';

function esc(value: string | number | undefined | null): string {
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

function headerCellStyle(): string {
    return `border:1px solid #0E7490; padding:4px 6px; font-size:8px; font-family:Arial,sans-serif; font-weight:bold; color:#fff; background:${CYAN_HEADER}; text-align:center; vertical-align:middle;`;
}

/** SVG inline strings for each symbol type — outlined style */
const SYMBOL_SVGS: Record<PfdStepType, string> = {
    operation: '<svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#EFF6FF" stroke="#3B82F6" stroke-width="2"/></svg>',
    transport: '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M4 12h14M14 6l6 6-6 6" fill="none" stroke="#64748B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    inspection: '<svg width="16" height="16" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="1" fill="#ECFDF5" stroke="#10B981" stroke-width="2"/></svg>',
    storage: '<svg width="16" height="16" viewBox="0 0 24 24"><polygon points="12,22 2,4 22,4" fill="#FFFBEB" stroke="#F59E0B" stroke-width="2" stroke-linejoin="round"/></svg>',
    delay: '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M4 2h8a10 10 0 0 1 0 20H4V2z" fill="#FEF2F2" stroke="#EF4444" stroke-width="2"/></svg>',
    decision: '<svg width="16" height="16" viewBox="0 0 24 24"><polygon points="12,1 23,12 12,23 1,12" fill="#FAF5FF" stroke="#A855F7" stroke-width="2" stroke-linejoin="round"/></svg>',
    combined: '<svg width="16" height="16" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="1" fill="#EFF6FF" stroke="#3B82F6" stroke-width="2"/><circle cx="12" cy="12" r="6" fill="none" stroke="#10B981" stroke-width="2"/></svg>',
};

/** C3-E1: Larger SVGs for the legend */
const SYMBOL_SVGS_LEGEND: Record<PfdStepType, string> = {
    operation: '<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#EFF6FF" stroke="#3B82F6" stroke-width="2"/></svg>',
    transport: '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M4 12h14M14 6l6 6-6 6" fill="none" stroke="#64748B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    inspection: '<svg width="20" height="20" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="1" fill="#ECFDF5" stroke="#10B981" stroke-width="2"/></svg>',
    storage: '<svg width="20" height="20" viewBox="0 0 24 24"><polygon points="12,22 2,4 22,4" fill="#FFFBEB" stroke="#F59E0B" stroke-width="2" stroke-linejoin="round"/></svg>',
    delay: '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M4 2h8a10 10 0 0 1 0 20H4V2z" fill="#FEF2F2" stroke="#EF4444" stroke-width="2"/></svg>',
    decision: '<svg width="20" height="20" viewBox="0 0 24 24"><polygon points="12,1 23,12 12,23 1,12" fill="#FAF5FF" stroke="#A855F7" stroke-width="2" stroke-linejoin="round"/></svg>',
    combined: '<svg width="20" height="20" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="1" fill="#EFF6FF" stroke="#3B82F6" stroke-width="2"/><circle cx="12" cy="12" r="6" fill="none" stroke="#10B981" stroke-width="2"/></svg>',
};

function symbolCell(type: PfdStepType): string {
    const svg = SYMBOL_SVGS[type] || '';
    const label = PFD_STEP_TYPES.find(t => t.value === type)?.label || type;
    return `<td style="${cellStyle('center')}" title="${esc(label)}">${svg}</td>`;
}

function specialCharBadge(value: string): string {
    if (value === 'CC') return '<span style="background:#FEE2E2;color:#B91C1C;border:1px solid #FCA5A5;padding:1px 4px;border-radius:3px;font-size:7px;font-weight:bold;">CC</span>';
    if (value === 'SC') return '<span style="background:#FEF3C7;color:#92400E;border:1px solid #FCD34D;padding:1px 4px;border-radius:3px;font-size:7px;font-weight:bold;">SC</span>';
    return '';
}

/** C3-N2: Disposition label for PDF */
const DISPOSITION_LABEL: Record<RejectDisposition, string> = {
    none: '',
    rework: 'Retrabajo',
    scrap: 'Descarte',
    sort: 'Selección',
};
const DISPOSITION_COLOR: Record<RejectDisposition, string> = {
    none: '',
    rework: '#B91C1C',
    scrap: '#C2410C',
    sort: '#A16207',
};
const DISPOSITION_BG: Record<RejectDisposition, string> = {
    none: '',
    rework: '#FEF2F2',
    scrap: '#FFF7ED',
    sort: '#FEFCE8',
};

function dispositionCell(disp: RejectDisposition, scrapDesc: string, reworkReturn: string): string {
    if (disp === 'none') return `<td style="${cellStyle('center')}"></td><td style="${cellStyle()}"></td>`;
    const label = DISPOSITION_LABEL[disp];
    const color = DISPOSITION_COLOR[disp];
    const bg = DISPOSITION_BG[disp];
    const badge = `<span style="background:${bg};color:${color};border:1px solid ${color};padding:1px 4px;border-radius:3px;font-size:7px;font-weight:bold;">${label}</span>`;
    let detail = '';
    if (disp === 'rework' && reworkReturn) detail = `Retorno a: ${esc(reworkReturn)}`;
    if (disp === 'scrap' && scrapDesc) detail = esc(scrapDesc);
    if (disp === 'sort' && scrapDesc) detail = esc(scrapDesc);
    return `<td style="${cellStyle('center')}">${badge}</td><td style="${cellStyle()}">${detail}</td>`;
}

/** C4-E2: Step type summary — breakdown by type like the UI footer */
function buildStepSummaryHtml(doc: PfdDocument): string {
    if (doc.steps.length === 0) return '';
    const counts: Record<string, number> = {};
    for (const step of doc.steps) {
        counts[step.stepType] = (counts[step.stepType] || 0) + 1;
    }
    const parts = PFD_STEP_TYPES
        .filter(st => counts[st.value])
        .map(st => `${counts[st.value]} ${st.label}${counts[st.value]! > 1 ? 's' : ''}`);
    const ccCount = doc.steps.filter(s => s.productSpecialChar === 'CC' || s.processSpecialChar === 'CC').length;
    const scCount = doc.steps.filter(s => s.productSpecialChar === 'SC' || s.processSpecialChar === 'SC').length;
    const extCount = doc.steps.filter(s => s.isExternalProcess).length;
    const extras: string[] = [];
    if (ccCount) extras.push(`${ccCount} CC`);
    if (scCount) extras.push(`${scCount} SC`);
    if (extCount) extras.push(`${extCount} Ext.`);
    const summary = parts.join(' · ') + (extras.length ? ` — ${extras.join(' · ')}` : '');
    return `<div style="margin-top:6px;font-family:Arial,sans-serif;font-size:9px;color:#374151;"><strong>Resumen:</strong> ${doc.steps.length} ${doc.steps.length === 1 ? 'paso' : 'pasos'} — ${summary}</div>`;
}

function buildSymbolLegendHtml(): string {
    const items = PFD_STEP_TYPES.map(st =>
        `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:14px;">${SYMBOL_SVGS_LEGEND[st.value]}<span style="font-size:9px;">${esc(st.label)}</span></span>`
    ).join('');
    return `<div style="margin-top:8px;font-family:Arial,sans-serif;"><span style="font-size:9px;font-weight:bold;color:#6B7280;">LEYENDA: </span>${items}</div>`;
}

function buildHeaderHtml(doc: PfdDocument, logoBase64: string): string {
    const h = doc.header;
    const today = new Date().toLocaleDateString('es-AR');
    const metaCell = `font-family:Arial,sans-serif; font-size:8px; padding:3px 6px; border:1px solid #d1d5db;`;
    const metaLabel = `${metaCell} font-weight:bold; background:#f3f4f6; width:90px;`;
    const logoHtml = logoBase64
        ? `<img src="${logoBase64}" style="height:36px; object-fit:contain;" />`
        : `<div style="font-size:12px; font-weight:bold; color:${CYAN_HEADER}; font-family:Arial,sans-serif;">BARACK MERCOSUL</div>`;

    return `
        <div style="margin-bottom:10px;">
            <!-- Row 0: Logo | Title | Form number -->
            <table style="border-collapse:collapse; width:100%; margin-bottom:0;">
                <tr>
                    <td style="border:2px solid ${CYAN_HEADER}; padding:6px 10px; width:20%; vertical-align:middle; text-align:center;">
                        ${logoHtml}
                    </td>
                    <td style="border:2px solid ${CYAN_HEADER}; padding:6px 10px; width:55%; text-align:center; vertical-align:middle;">
                        <div style="font-family:Arial,sans-serif; font-size:14px; font-weight:bold; color:${CYAN_HEADER};">DIAGRAMA DE FLUJO DEL PROCESO</div>
                        <div style="font-family:Arial,sans-serif; font-size:9px; color:#6B7280; margin-top:2px;">${esc(h.partName || 'Sin título')} — ${esc(h.partNumber || '')}</div>
                    </td>
                    <td style="border:2px solid ${CYAN_HEADER}; padding:6px 10px; width:25%; vertical-align:middle; text-align:center;">
                        <div style="font-family:Arial,sans-serif; font-size:8px; color:#6B7280;">Formulario</div>
                        <div style="font-family:Arial,sans-serif; font-size:11px; font-weight:bold; color:${CYAN_HEADER};">${SGC_FORM_NUMBER}</div>
                        <div style="font-family:Arial,sans-serif; font-size:8px; color:#6B7280; margin-top:2px;">Doc: ${esc(h.documentNumber || '-')} · Rev: ${esc(h.revisionLevel || '-')}</div>
                    </td>
                </tr>
            </table>
            <!-- Metadata rows -->
            <table style="border-collapse:collapse; width:100%; margin-bottom:8px;">
                <tr>
                    <td style="${metaLabel}">Empresa</td>
                    <td style="${metaCell}">${esc(h.companyName)}</td>
                    <td style="${metaLabel}">Planta</td>
                    <td style="${metaCell}">${esc(h.plantLocation)}</td>
                    <td style="${metaLabel}">Cliente</td>
                    <td style="${metaCell}">${esc(h.customerName)}</td>
                </tr>
                <tr>
                    <td style="${metaLabel}">Nro. Pieza</td>
                    <td style="${metaCell}">${esc(h.partNumber)}</td>
                    <td style="${metaLabel}">Modelo/Año</td>
                    <td style="${metaCell}">${esc(h.modelYear)}</td>
                    <td style="${metaLabel}">Nivel Ing.</td>
                    <td style="${metaCell}">${esc(h.engineeringChangeLevel)}</td>
                </tr>
                <tr>
                    <td style="${metaLabel}">Elaboró</td>
                    <td style="${metaCell}">${esc(h.preparedBy)}</td>
                    <td style="${metaLabel}">Aprobó</td>
                    <td style="${metaCell}">${esc(h.approvedBy)}</td>
                    <td style="${metaLabel}">Fecha Rev.</td>
                    <td style="${metaCell}">${esc(h.revisionDate || today)}</td>
                </tr>
                <tr>
                    <td style="${metaLabel}">Cód. Proveedor</td>
                    <td style="${metaCell}">${esc(h.supplierCode)}</td>
                    <td style="${metaLabel}">Equipo</td>
                    <td style="${metaCell}">${esc(h.coreTeam)}</td>
                    <td style="${metaLabel}">Contacto</td>
                    <td style="${metaCell}">${esc(h.keyContact)}</td>
                </tr>
            </table>
        </div>
    `;
}

function buildTableHtml(doc: PfdDocument): string {
    // C3-N2: Updated columns — replaced Retrabajo with Disposición + Detalle
    const headers = ['Nº Op.', 'Símbolo', 'Descripción', 'Máquina/Dispositivo', 'Caract. Producto', 'CC/SC Prod.', 'Caract. Proceso', 'CC/SC Proc.', 'Referencia', 'Área', 'Notas', 'Disposición', 'Detalle', 'Externo'];
    const colCount = headers.length;

    let rows = '';
    for (let i = 0; i < doc.steps.length; i++) {
        const step = doc.steps[i];
        const dispBg = step.rejectDisposition !== 'none' ? `background:${DISPOSITION_BG[step.rejectDisposition]};` : '';
        const rowBg = dispBg || (step.isExternalProcess ? 'background:#EFF6FF;' : '');
        const hasCC = step.productSpecialChar === 'CC' || step.processSpecialChar === 'CC';
        const hasSC = !hasCC && (step.productSpecialChar === 'SC' || step.processSpecialChar === 'SC');
        const leftBorderStyle = hasCC ? 'border-left:4px solid #EF4444;' : hasSC ? 'border-left:4px solid #F59E0B;' : '';
        rows += `<tr>
            <td style="${cellStyle('center')} font-weight:bold; ${rowBg} ${leftBorderStyle}">${esc(step.stepNumber)}</td>
            ${symbolCell(step.stepType)}
            <td style="${cellStyle()} ${rowBg}">${esc(step.description)}</td>
            <td style="${cellStyle()} ${rowBg}">${esc(step.machineDeviceTool)}</td>
            <td style="${cellStyle()} ${rowBg}">${esc(step.productCharacteristic)}</td>
            <td style="${cellStyle('center')} ${rowBg}">${specialCharBadge(step.productSpecialChar)}</td>
            <td style="${cellStyle()} ${rowBg}">${esc(step.processCharacteristic)}</td>
            <td style="${cellStyle('center')} ${rowBg}">${specialCharBadge(step.processSpecialChar)}</td>
            <td style="${cellStyle()} ${rowBg}">${esc(step.reference)}</td>
            <td style="${cellStyle()} ${rowBg}">${esc(step.department)}</td>
            <td style="${cellStyle()} ${rowBg}">${esc(step.notes)}</td>
            ${dispositionCell(step.rejectDisposition, step.scrapDescription, step.reworkReturnStep)}
            <td style="${cellStyle('center')} ${rowBg}">${step.isExternalProcess ? 'Sí' : ''}</td>
        </tr>`;
        // C4-V1: Flow arrow between rows — SVG instead of text character
        if (i < doc.steps.length - 1) {
            rows += `<tr><td colspan="${colCount}" style="border:none;padding:1px 0;text-align:center;"><svg width="16" height="18" viewBox="0 0 16 18" style="display:inline-block;vertical-align:middle;"><path d="M8 0v12M3 9l5 7 5-7" stroke="#0891B2" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></td></tr>`;
        }
    }

    if (doc.steps.length === 0) {
        rows = `<tr><td colspan="${colCount}" style="${cellStyle('center')} color:#9CA3AF; padding:20px;">Sin pasos definidos</td></tr>`;
    }

    // C5-V1/E1: Explicit column widths for consistent PDF layout
    // C6-E1: Rebalanced — more space for Descripción, Notas, Disposición, Detalle, Externo
    const colWidths = ['5%', '4%', '20%', '11%', '9%', '3%', '9%', '3%', '6%', '5%', '10%', '6%', '6%', '3%'];
    const colgroup = `<colgroup>${colWidths.map(w => `<col style="width:${w}"/>`).join('')}</colgroup>`;

    return `
        <table style="border-collapse:collapse; width:100%; table-layout:fixed; page-break-inside:auto;">
            ${colgroup}
            <thead style="display:table-header-group;">
                <tr>${headers.map(h => `<th style="${headerCellStyle()}">${esc(h)}</th>`).join('')}</tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

/**
 * Get HTML preview for the PFD document.
 */
export function getPfdPdfPreviewHtml(doc: PfdDocument, logoBase64 = ''): string {
    return buildHeaderHtml(doc, logoBase64) + buildTableHtml(doc) + buildStepSummaryHtml(doc) + buildSymbolLegendHtml();
}

/**
 * Export PFD document to PDF via html2pdf.js.
 */
export async function exportPfdPdf(doc: PfdDocument): Promise<void> {
    const [html2pdf, logoBase64] = await Promise.all([
        import('html2pdf.js').then(m => m.default),
        getLogoBase64(),
    ]);

    const htmlContent = buildHeaderHtml(doc, logoBase64) + buildTableHtml(doc) + buildStepSummaryHtml(doc) + buildSymbolLegendHtml();

    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '297mm';
    document.body.appendChild(container);

    const safeName = sanitizeFilename(doc.header.partName || 'PFD', { allowSpaces: true });
    const date = new Date().toISOString().split('T')[0];
    const filename = `PFD_${safeName}_${date}.pdf`;

    try {
        const worker = html2pdf()
            .from(container)
            .set({
                margin: [8, 6, 12, 6], // extra bottom margin for page numbers
                filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, letterRendering: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
                pagebreak: { mode: ['avoid-all', 'css'] },
            });

        // Generate PDF, add page numbers, then save
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdf = await (worker as any).toPdf().get('pdf');
        const totalPages = pdf.internal.getNumberOfPages();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        // C4-N3: Footer with part identification per IATF 16949 cl. 7.5.3
        const partId = [doc.header.partNumber, doc.header.partName].filter(Boolean).join(' — ') || 'Sin identificación';
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(7);
            pdf.setTextColor(150, 150, 150);
            pdf.text(partId, 6, pageHeight - 4, { align: 'left' });
            pdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 4, { align: 'center' });
            pdf.text(SGC_FORM_NUMBER, pageWidth - 6, pageHeight - 4, { align: 'right' });
        }
        pdf.save(filename);
    } finally {
        document.body.removeChild(container);
    }
}
