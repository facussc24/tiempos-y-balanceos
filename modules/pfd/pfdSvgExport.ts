/**
 * PFD SVG Export — Editable vector flowchart (centered layout + logo)
 *
 * Generates a standalone .svg file with the process flow diagram
 * using native SVG elements. The output can be opened and edited
 * in Visio, Inkscape, Illustrator, or any SVG editor.
 *
 * Two-pass layout: first pass computes widths, second pass renders
 * centered within the computed canvas width.
 */

import type { PfdDocument, PfdStep, PfdStepType } from './pfdTypes';
import { PFD_STEP_TYPES, SGC_FORM_NUMBER } from './pfdTypes';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { getLogoBase64 } from '../../src/assets/ppe/ppeBase64';

// ============================================================================
// Layout constants
// ============================================================================

const NODE_W = 440;
const NODE_H = 62;
const NODE_H_DECISION = 70;
const SYMBOL_SIZE = 32;
const ARROW_GAP = 44;
const PARALLEL_GAP = 32;
const LANE_PAD = 20;
const HEADER_H = 190;
const CANVAS_PAD = 48;
const TOP_MARGIN = HEADER_H + 32;

/** Legend layout */
const LEGEND_ITEM_W = 135;
const LEGEND_PREFIX_W = 75;

const FONT = 'Inter,Arial,Helvetica,sans-serif';
const DARK = '#374151';
const BLACK = '#111827';

/** Node colors — monochrome professional (B/W printable, PPAP-ready) */
const MONO = { border: DARK, bg: '#FFFFFF', bgDark: '#F3F4F6', text: BLACK };
const NODE_COLORS: Record<PfdStepType, { border: string; bg: string; bgDark: string; text: string }> = {
    operation:  MONO,
    transport:  MONO,
    inspection: MONO,
    storage:    MONO,
    delay:      MONO,
    decision:   MONO,
    combined:   MONO,
};

/** Get effective node height — accounts for characteristics content and disposition */
function getNodeHeight(step: PfdStep): number {
    let h = step.stepType === 'decision' ? NODE_H_DECISION : NODE_H;
    if (step.productCharacteristic) h += 16;
    if (step.processCharacteristic) h += 12;
    if (step.rejectDisposition !== 'none' && (step.stepType === 'inspection' || step.stepType === 'combined' || step.stepType === 'decision')) h += 18;
    return h;
}

// ============================================================================
// SVG <defs> — filters, gradients, markers, patterns
// ============================================================================

function buildDefs(): string {
    // Minimal shadow — subtle separation only
    let defs = `<defs>
    <filter id="dropShadow" x="-4%" y="-4%" width="108%" height="112%">
        <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000000" flood-opacity="0.08"/>
    </filter>`;

    // Arrow marker — black
    defs += `
    <marker id="arrowMarker" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
        <path d="M 0 0.5 L 10 5 L 0 9.5 z" fill="${DARK}"/>
    </marker>`;

    // Rework arrow marker — black
    defs += `
    <marker id="reworkArrowMarker" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M 0 0.5 L 10 5 L 0 9.5 z" fill="${BLACK}"/>
    </marker>`;

    defs += `
    </defs>`;
    return defs;
}

// ============================================================================
// SVG symbol shapes (native SVG, editable)
// ============================================================================

function svgSymbol(type: PfdStepType, cx: number, cy: number, size = SYMBOL_SIZE): string {
    const r = size / 2;
    const S = '#1F2937'; // stroke color (dark gray)
    const W = 'white';   // fill color
    switch (type) {
        case 'operation':
            return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${W}" stroke="${S}" stroke-width="2"/>`;
        case 'transport':
            return `<g>
                <line x1="${cx - r}" y1="${cy}" x2="${cx + r - 4}" y2="${cy}" stroke="${S}" stroke-width="2.5" stroke-linecap="round"/>
                <polygon points="${cx + r - 6},${cy - 5} ${cx + r},${cy} ${cx + r - 6},${cy + 5}" fill="${S}"/>
            </g>`;
        case 'inspection':
            return `<rect x="${cx - r}" y="${cy - r}" width="${size}" height="${size}" rx="2" fill="${W}" stroke="${S}" stroke-width="2"/>`;
        case 'storage':
            return `<polygon points="${cx},${cy + r} ${cx - r},${cy - r + 4} ${cx + r},${cy - r + 4}" fill="${W}" stroke="${S}" stroke-width="2" stroke-linejoin="round"/>`;
        case 'delay':
            return `<path d="M${cx - r},${cy - r} h${r} a${r},${r} 0 0,1 0,${size} h-${r} z" fill="${W}" stroke="${S}" stroke-width="2"/>`;
        case 'decision':
            return `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}" fill="${W}" stroke="${S}" stroke-width="2" stroke-linejoin="round"/>`;
        case 'combined':
            return `<g>
                <rect x="${cx - r}" y="${cy - r}" width="${size}" height="${size}" rx="2" fill="${W}" stroke="${S}" stroke-width="2"/>
                <circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="none" stroke="${S}" stroke-width="2"/>
            </g>`;
    }
}

// ============================================================================
// SVG text helper (escape + truncate)
// ============================================================================

function esc(s: string | undefined | null): string {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(s: string, maxLen: number): string {
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen - 1) + '\u2026';
}

// ============================================================================
// Flow grouping
// ============================================================================

interface FlowGroup {
    type: 'main' | 'parallel';
    steps: PfdStep[];
    branches?: { branchId: string; label: string; steps: PfdStep[] }[];
}

function groupStepsByFlow(steps: PfdStep[]): FlowGroup[] {
    const groups: FlowGroup[] = [];
    let i = 0;
    while (i < steps.length) {
        if (!steps[i].branchId) {
            const mainSteps: PfdStep[] = [];
            while (i < steps.length && !steps[i].branchId) {
                mainSteps.push(steps[i]);
                i++;
            }
            groups.push({ type: 'main', steps: mainSteps });
        } else {
            const branchMap: Record<string, PfdStep[]> = {};
            const branchOrder: string[] = [];
            while (i < steps.length && steps[i].branchId) {
                const bid = steps[i].branchId;
                if (!branchMap[bid]) {
                    branchMap[bid] = [];
                    branchOrder.push(bid);
                }
                branchMap[bid].push(steps[i]);
                i++;
            }
            const branches = branchOrder.map(bid => ({
                branchId: bid,
                label: branchMap[bid][0].branchLabel || `Línea ${bid}`,
                steps: branchMap[bid],
            }));
            groups.push({ type: 'parallel', steps: [], branches });
        }
    }
    return groups;
}

// ============================================================================
// Width calculation (first pass — determines canvas width for centering)
// ============================================================================

function computeMaxContentWidth(groups: FlowGroup[]): number {
    let maxW = NODE_W;
    for (const group of groups) {
        if (group.type === 'parallel' && group.branches) {
            const numLanes = group.branches.length;
            const laneW = NODE_W + LANE_PAD * 2;
            const totalW = numLanes * laneW + (numLanes - 1) * PARALLEL_GAP;
            if (totalW > maxW) maxW = totalW;
        }
    }
    return maxW;
}

// ============================================================================
// Node rendering
// ============================================================================

function renderNode(step: PfdStep, x: number, y: number): string {
    const colors = NODE_COLORS[step.stepType];
    const nodeH = getNodeHeight(step);
    const baseH = step.stepType === 'decision' ? NODE_H_DECISION : NODE_H;
    const symX = x + LANE_PAD + SYMBOL_SIZE / 2;
    const symY = y + baseH / 2;
    const textX = x + LANE_PAD + SYMBOL_SIZE + 12;
    const textY = y + baseH / 2;

    const isDecision = step.stepType === 'decision';
    const strokeW = isDecision ? 2.5 : 2;
    const shadow = 'url(#dropShadow)';

    // Badges
    const hasCC = step.productSpecialChar === 'CC' || step.processSpecialChar === 'CC';
    const hasSC = !hasCC && (step.productSpecialChar === 'SC' || step.processSpecialChar === 'SC');
    const isExt = step.isExternalProcess;

    let badges = '';
    let badgeX = x + NODE_W - LANE_PAD;
    if (hasCC) {
        badgeX -= 28;
        badges += `<rect x="${badgeX}" y="${y + 10}" width="24" height="16" rx="8" fill="white" stroke="${DARK}" stroke-width="1.5"/>
            <text x="${badgeX + 12}" y="${y + 22}" font-size="8" font-weight="bold" fill="${BLACK}" text-anchor="middle" font-family="${FONT}" letter-spacing="0.3">CC</text>`;
    }
    if (hasSC) {
        badgeX -= 28;
        badges += `<rect x="${badgeX}" y="${y + 10}" width="24" height="16" rx="8" fill="white" stroke="${DARK}" stroke-width="1"/>
            <text x="${badgeX + 12}" y="${y + 22}" font-size="8" font-weight="bold" fill="${BLACK}" text-anchor="middle" font-family="${FONT}" letter-spacing="0.3">SC</text>`;
    }
    if (isExt) {
        badgeX -= 30;
        badges += `<rect x="${badgeX}" y="${y + 10}" width="26" height="16" rx="8" fill="white" stroke="${DARK}" stroke-width="1"/>
            <text x="${badgeX + 13}" y="${y + 22}" font-size="8" font-weight="bold" fill="${BLACK}" text-anchor="middle" font-family="${FONT}" letter-spacing="0.3">EXT</text>`;
    }
    if (step.cycleTimeMinutes != null && step.cycleTimeMinutes > 0) {
        const ctLabel = `${step.cycleTimeMinutes}min`;
        const ctW = ctLabel.length * 6 + 8;
        badgeX -= ctW + 4;
        badges += `<rect x="${badgeX}" y="${y + 10}" width="${ctW}" height="16" rx="8" fill="#F9FAFB" stroke="#D1D5DB" stroke-width="1"/>
            <text x="${badgeX + ctW / 2}" y="${y + 22}" font-size="8" font-weight="bold" fill="${DARK}" text-anchor="middle" font-family="${FONT}" letter-spacing="0.3">${ctLabel}</text>`;
    }

    // Sub-info line
    const subParts: string[] = [];
    if (step.machineDeviceTool) subParts.push(step.machineDeviceTool);
    if (step.department) subParts.push(step.department);
    const subLine = subParts.length > 0
        ? `<text x="${textX}" y="${textY + 15}" font-size="9" fill="#9CA3AF" font-family="${FONT}">${esc(truncate(subParts.join(' \u00B7 '), 50))}</text>`
        : '';

    // Characteristics lines (AIAG APQP: product/process characteristics)
    let charLines = '';
    const charStartY = subParts.length > 0 ? textY + 28 : textY + 16;
    let charY = charStartY;
    if (step.productCharacteristic) {
        charLines += `<text x="${textX}" y="${charY}" font-size="8" fill="#6B7280" font-family="${FONT}"><tspan font-weight="600">Prod:</tspan> ${esc(truncate(step.productCharacteristic, 42))}</text>`;
        charY += 12;
    }
    if (step.processCharacteristic) {
        charLines += `<text x="${textX}" y="${charY}" font-size="8" fill="#6B7280" font-family="${FONT}"><tspan font-weight="600">Proc:</tspan> ${esc(truncate(step.processCharacteristic, 42))}</text>`;
    }

    // Cross-reference badges (bottom-right: AMFE ↔ CP traceability)
    let xrefBadges = '';
    if (step.linkedAmfeOperationId || (step.linkedCpItemIds && step.linkedCpItemIds.length > 0)) {
        let xrefX = x + NODE_W - LANE_PAD;
        const xrefY = y + nodeH - 18;
        if (step.linkedCpItemIds && step.linkedCpItemIds.length > 0) {
            xrefX -= 30;
            xrefBadges += `<rect x="${xrefX}" y="${xrefY}" width="26" height="14" rx="7" fill="#F3F4F6" stroke="#9CA3AF" stroke-width="0.75"/>
                <text x="${xrefX + 13}" y="${xrefY + 10}" font-size="7" font-weight="600" fill="${DARK}" text-anchor="middle" font-family="${FONT}">CP</text>`;
        }
        if (step.linkedAmfeOperationId) {
            xrefX -= 40;
            xrefBadges += `<rect x="${xrefX}" y="${xrefY}" width="36" height="14" rx="7" fill="#F3F4F6" stroke="#9CA3AF" stroke-width="0.75"/>
                <text x="${xrefX + 18}" y="${xrefY + 10}" font-size="7" font-weight="600" fill="${DARK}" text-anchor="middle" font-family="${FONT}">AMFE</text>`;
        }
    }

    // Notes asterisk marker
    const notesMarker = step.notes
        ? `<text x="${x + NODE_W - 8}" y="${y + 14}" font-size="12" font-weight="bold" fill="${DARK}" text-anchor="end" font-family="${FONT}">*</text>`
        : '';

    const maxDescLen = hasCC || hasSC || isExt ? 40 : 52;

    // CC accent bar (black left stripe for critical characteristics)
    const ccAccent = hasCC
        ? `<rect x="${x}" y="${y + 2}" width="3" height="${nodeH - 4}" rx="1.5" fill="${BLACK}"/>`
        : '';

    // NG disposition indicator (inside node, bottom area)
    let dispIndicator = '';
    if (step.rejectDisposition !== 'none' && (step.stepType === 'inspection' || step.stepType === 'combined' || step.stepType === 'decision')) {
        const dispY = y + nodeH - 16;
        const dispLabelX = x + LANE_PAD + SYMBOL_SIZE + 12;
        // For decision diamonds, prefix with "NOK →" and add "OK ↓" to clarify flow
        const nokPrefix = isDecision ? 'NOK → ' : '';
        const okLabel = isDecision
            ? `<text x="${x + NODE_W - LANE_PAD - 4}" y="${dispY}" font-size="8" font-weight="700" fill="#16A34A" font-family="${FONT}" text-anchor="end">OK ↓</text>`
            : '';
        if (step.rejectDisposition === 'rework') {
            dispIndicator = `<g class="pfd-disp-rework">
                <text x="${dispLabelX}" y="${dispY}" font-size="8" font-weight="600" fill="#DC2626" font-family="${FONT}">${nokPrefix}↻ Retrabajo</text>
                ${okLabel}
            </g>`;
        } else if (step.rejectDisposition === 'scrap') {
            dispIndicator = `<g class="pfd-disp-scrap">
                <text x="${dispLabelX}" y="${dispY}" font-size="8" font-weight="600" fill="#DC2626" font-family="${FONT}">${nokPrefix}✕ Descarte</text>
                ${okLabel}
            </g>`;
        } else if (step.rejectDisposition === 'sort') {
            dispIndicator = `<g class="pfd-disp-sort">
                <text x="${dispLabelX}" y="${dispY}" font-size="8" font-weight="600" fill="#DC2626" font-family="${FONT}">${nokPrefix}⊘ Selección</text>
                ${okLabel}
            </g>`;
        }
    }

    // Tooltip for browser viewing
    const tooltipParts = [`${step.stepNumber} — ${step.description}`];
    if (step.machineDeviceTool) tooltipParts.push(`Equipo: ${step.machineDeviceTool}`);
    if (step.department) tooltipParts.push(`Área: ${step.department}`);
    if (step.productCharacteristic) tooltipParts.push(`Caract. Producto: ${step.productCharacteristic}`);
    if (step.processCharacteristic) tooltipParts.push(`Caract. Proceso: ${step.processCharacteristic}`);
    if (step.rejectDisposition !== 'none') tooltipParts.push(`Disposición: ${step.rejectDisposition}`);
    if (step.notes) tooltipParts.push(`Nota: ${step.notes}`);
    const tooltip = `<title>${esc(tooltipParts.join('\n'))}</title>`;

    return `<g class="pfd-node" data-step-id="${esc(step.id)}" data-step-number="${esc(step.stepNumber)}">
        ${tooltip}
        <rect x="${x}" y="${y}" width="${NODE_W}" height="${nodeH}" rx="6" fill="white" stroke="${colors.border}" stroke-width="${strokeW}" filter="${shadow}"/>
        ${ccAccent}
        ${svgSymbol(step.stepType, symX, symY)}
        <text x="${textX}" y="${textY - 4}" font-size="14" font-weight="700" fill="${colors.text}" font-family="${FONT}">${esc(step.stepNumber)}</text>
        <text x="${textX + (step.stepNumber.length * 9) + 6}" y="${textY - 4}" font-size="11.5" font-weight="500" fill="#1E293B" font-family="${FONT}">${esc(truncate(step.description, maxDescLen))}</text>
        ${subLine}
        ${charLines}
        ${badges}
        ${xrefBadges}
        ${notesMarker}
        ${dispIndicator}
    </g>`;
}

// ============================================================================
// Arrow rendering (bezier curve with marker)
// ============================================================================

function renderArrow(x: number, y1: number, y2: number): string {
    const len = y2 - y1;
    const cp = len * 0.35;
    return `<g class="pfd-arrow">
        <path d="M ${x},${y1} C ${x},${y1 + cp} ${x},${y2 - cp} ${x},${y2 - 8}" stroke="${DARK}" stroke-width="2" fill="none" stroke-linecap="round" marker-end="url(#arrowMarker)"/>
    </g>`;
}

// ============================================================================
// Header rendering (3-column: Logo | Title | Form)
// ============================================================================

function renderHeader(doc: PfdDocument, totalWidth: number, logoBase64: string): string {
    const h = doc.header;

    // 3-column layout: Logo (18%) | Title (55%) | Form (27%)
    const logoW = Math.floor(totalWidth * 0.18);
    const titleW = Math.floor(totalWidth * 0.55);
    const formX = logoW + titleW;
    const formW = totalWidth - formX;

    // Top section height (logo/title/form) — compact to leave more room for metadata
    const topH = 68;

    // Logo column
    const logoContent = logoBase64
        ? `<image x="8" y="6" width="${logoW - 16}" height="${topH - 12}" href="${logoBase64}" preserveAspectRatio="xMidYMid meet"/>`
        : `<text x="${logoW / 2}" y="30" font-size="16" font-weight="bold" fill="${BLACK}" text-anchor="middle" font-family="${FONT}">BARACK</text>
           <text x="${logoW / 2}" y="48" font-size="10" fill="${DARK}" text-anchor="middle" font-family="${FONT}">MERCOSUL</text>`;

    // Revision badge
    const revLevel = h.revisionLevel || '-';
    const revBadge = `<rect x="${formX + formW / 2 - 16}" y="46" width="32" height="20" rx="10" fill="#F3F4F6" stroke="${DARK}" stroke-width="1"/>
        <text x="${formX + formW / 2}" y="60" font-size="12" font-weight="700" fill="${BLACK}" text-anchor="middle" font-family="${FONT}">${esc(revLevel)}</text>`;

    // Extract first line of applicableParts for header display
    const apFirstLine = h.applicableParts ? h.applicableParts.split('\n')[0] : '';
    const apLineCount = h.applicableParts ? h.applicableParts.split('\n').length : 0;
    const apSuffix = apLineCount > 1 ? ` (+${apLineCount - 1} más)` : '';

    // Metadata starts right after top section
    const metaY = topH + 6;
    const rowH = 20; // generous row spacing for readability
    const fontSize = '11.5';

    return `<g class="pfd-header">
        <!-- Header background -->
        <rect x="0" y="0" width="${totalWidth}" height="${HEADER_H}" fill="white" stroke="${DARK}" stroke-width="1.5" rx="4"/>
        <!-- Bottom accent line -->
        <line x1="0" y1="${HEADER_H}" x2="${totalWidth}" y2="${HEADER_H}" stroke="${BLACK}" stroke-width="2"/>

        <!-- Column dividers -->
        <line x1="${logoW}" y1="4" x2="${logoW}" y2="${topH}" stroke="#D1D5DB" stroke-width="1"/>
        <line x1="${formX}" y1="4" x2="${formX}" y2="${topH}" stroke="#D1D5DB" stroke-width="1"/>

        <!-- Logo column -->
        ${logoContent}

        <!-- Title column -->
        <text x="${logoW + titleW / 2}" y="26" font-size="18" font-weight="700" fill="${BLACK}" text-anchor="middle" font-family="${FONT}" letter-spacing="1">DIAGRAMA DE FLUJO DEL PROCESO</text>
        <text x="${logoW + titleW / 2}" y="44" font-size="12" fill="${DARK}" text-anchor="middle" font-family="${FONT}" font-weight="500">${esc(h.partName || 'Sin título')} — ${esc(h.partNumber || '')}</text>
        ${h.processPhase ? `<text x="${logoW + titleW / 2}" y="58" font-size="10" fill="${DARK}" text-anchor="middle" font-family="${FONT}" font-weight="600">Fase: ${h.processPhase === 'prototype' ? 'PROTOTIPO' : h.processPhase === 'pre-launch' ? 'PRE-LANZAMIENTO' : 'PRODUCCIÓN'}</text>` : ''}

        <!-- Form number column -->
        <text x="${formX + formW / 2}" y="20" font-size="9" fill="#6B7280" text-anchor="middle" font-family="${FONT}" font-weight="600">Formulario</text>
        <text x="${formX + formW / 2}" y="38" font-size="14" font-weight="700" fill="${BLACK}" text-anchor="middle" font-family="${FONT}">${SGC_FORM_NUMBER}</text>
        ${revBadge}

        <!-- Metadata separator -->
        <line x1="4" y1="${topH}" x2="${totalWidth - 4}" y2="${topH}" stroke="#D1D5DB" stroke-width="1"/>

        <!-- Row 1: Empresa | Planta | Cliente | Modelo -->
        <text x="16" y="${metaY + 12}" font-size="${fontSize}" fill="${BLACK}" font-family="${FONT}">
            <tspan font-weight="700">Empresa:</tspan> ${esc(h.companyName)}  |  <tspan font-weight="700">Planta:</tspan> ${esc(h.plantLocation)}  |  <tspan font-weight="700">Cliente:</tspan> ${esc(h.customerName)}  |  <tspan font-weight="700">Modelo:</tspan> ${esc(h.modelYear)}
        </text>
        <!-- Row 2: Elaboró | Aprobó | Equipo -->
        <text x="16" y="${metaY + 12 + rowH}" font-size="${fontSize}" fill="${BLACK}" font-family="${FONT}">
            <tspan font-weight="700">Elaboró:</tspan> ${esc(h.preparedBy)}${h.preparedDate ? ` (${esc(h.preparedDate)})` : ''}  |  <tspan font-weight="700">Aprobó:</tspan> ${esc(h.approvedBy)}${h.approvedDate ? ` (${esc(h.approvedDate)})` : ''}  |  <tspan font-weight="700">Cód. Prov.:</tspan> ${esc(h.supplierCode)}  |  <tspan font-weight="700">Equipo:</tspan> ${esc(truncate(h.coreTeam, 200))}
        </text>
        <!-- Row 3: Fecha Rev. | Cambio Ing. | Contacto -->
        ${(h.engineeringChangeLevel || h.revisionDate || h.keyContact) ? `<text x="16" y="${metaY + 12 + rowH * 2}" font-size="${fontSize}" fill="${BLACK}" font-family="${FONT}">
            ${h.revisionDate ? `<tspan font-weight="700">Fecha Rev.:</tspan> ${esc(h.revisionDate)}  |  ` : ''}${h.engineeringChangeLevel ? `<tspan font-weight="700">Niv. Cambio Ing.:</tspan> ${esc(truncate(h.engineeringChangeLevel, 40))}  |  ` : ''}${h.keyContact ? `<tspan font-weight="700">Contacto:</tspan> ${esc(truncate(h.keyContact, 40))}` : ''}
        </text>` : ''}
        <!-- Row 4: Partes aplicables -->
        ${apFirstLine ? `<text x="16" y="${metaY + 12 + rowH * 3}" font-size="${fontSize}" fill="${BLACK}" font-family="${FONT}">
            <tspan font-weight="700">Partes Aplic.:</tspan> ${esc(truncate(apFirstLine, 100))}${apSuffix ? esc(apSuffix) : ''}
        </text>` : ''}
        <!-- Exportado -->
        <text x="${totalWidth - 16}" y="${HEADER_H - 6}" font-size="9.5" fill="#6B7280" text-anchor="end" font-family="${FONT}">Exportado: ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</text>
    </g>`;
}

// ============================================================================
// Legend rendering
// ============================================================================

function renderLegend(centerX: number, y: number): string {
    const items = PFD_STEP_TYPES;
    const itemW = LEGEND_ITEM_W;
    const prefixW = LEGEND_PREFIX_W;
    const totalLegendW = prefixW + items.length * itemW;
    const startX = centerX - totalLegendW / 2;
    const boxH = 42;
    const boxY = y - 24;

    let svg = `<g class="pfd-legend">
        <rect x="${startX - 14}" y="${boxY}" width="${totalLegendW + 28}" height="${boxH}" rx="4" fill="white" stroke="#D1D5DB" stroke-width="1"/>
        <text x="${startX + 4}" y="${y + 1}" font-size="10" font-weight="700" fill="#475569" font-family="${FONT}" letter-spacing="0.5">LEYENDA:</text>`;

    let offsetX = startX + prefixW;
    for (let i = 0; i < items.length; i++) {
        const st = items[i];
        svg += svgSymbol(st.value, offsetX + 12, y - 3, 22);
        svg += `<text x="${offsetX + 30}" y="${y + 1}" font-size="10" fill="#1E293B" font-family="${FONT}" font-weight="500">${esc(st.label)}</text>`;
        // Separator dot (not on last)
        if (i < items.length - 1) {
            svg += `<circle cx="${offsetX + itemW - 8}" cy="${y - 2}" r="2" fill="#94A3B8"/>`;
        }
        offsetX += itemW;
    }

    svg += '</g>';
    return svg;
}

// ============================================================================
// Fork/Join rendering for parallel branches
// ============================================================================

function renderForkLines(centerX: number, y: number, lanes: { cx: number }[]): string {
    if (lanes.length < 2) return '';
    const leftX = lanes[0].cx;
    const rightX = lanes[lanes.length - 1].cx;
    const lineY = y + 6;

    let svg = `<g class="pfd-fork">
        <!-- Vertical stem -->
        <line x1="${centerX}" y1="${y - 4}" x2="${centerX}" y2="${lineY}" stroke="${DARK}" stroke-width="2" stroke-linecap="round"/>
        <!-- Horizontal connector -->
        <line x1="${leftX}" y1="${lineY}" x2="${rightX}" y2="${lineY}" stroke="${DARK}" stroke-width="2" stroke-linecap="round"/>`;

    // Vertical drops into each lane
    for (const lane of lanes) {
        svg += `<line x1="${lane.cx}" y1="${lineY}" x2="${lane.cx}" y2="${lineY + 10}" stroke="${DARK}" stroke-width="2" stroke-linecap="round"/>
        <polygon points="${lane.cx - 4},${lineY + 8} ${lane.cx},${lineY + 14} ${lane.cx + 4},${lineY + 8}" fill="${DARK}"/>`;
    }

    svg += '</g>';
    return svg;
}

function renderJoinLines(centerX: number, y: number, lanes: { cx: number }[]): string {
    if (lanes.length < 2) return '';
    const leftX = lanes[0].cx;
    const rightX = lanes[lanes.length - 1].cx;
    const lineY = y;

    let svg = `<g class="pfd-join">`;

    // Vertical risers from each lane
    for (const lane of lanes) {
        svg += `<line x1="${lane.cx}" y1="${lineY - 10}" x2="${lane.cx}" y2="${lineY}" stroke="${DARK}" stroke-width="2" stroke-linecap="round"/>`;
    }

    // Horizontal connector
    svg += `<line x1="${leftX}" y1="${lineY}" x2="${rightX}" y2="${lineY}" stroke="${DARK}" stroke-width="2" stroke-linecap="round"/>`;
    // Vertical stem down
    svg += `<line x1="${centerX}" y1="${lineY}" x2="${centerX}" y2="${lineY + 6}" stroke="${DARK}" stroke-width="2" stroke-linecap="round"/>
        <polygon points="${centerX - 4},${lineY + 4} ${centerX},${lineY + 10} ${centerX + 4},${lineY + 4}" fill="${DARK}"/>`;

    svg += '</g>';
    return svg;
}

// ============================================================================
// Rework return arrows (curved bezier path from inspection back to target step)
// ============================================================================

/** Tracked step position for rework arrow rendering */
interface StepPosition {
    stepNumber: string;
    x: number;
    y: number;
    h: number;
    nodeX: number;
}

function renderReworkArrows(
    steps: PfdStep[],
    positions: Map<string, StepPosition>,
    canvasWidth: number,
): string {
    let svg = '';
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        // Case 1: Decision/inspection with rework disposition and a specific return step
        // Case 2: Rework step (isRework) with reworkReturnStep → loop-back arrow
        const hasReworkDisp = step.rejectDisposition === 'rework' && !!step.reworkReturnStep;
        const hasReworkReturn = !!step.isRework && !!step.reworkReturnStep;
        if (!hasReworkDisp && !hasReworkReturn) continue;

        // Use stepNumber if available, otherwise fall back to index-based key
        const fromKey = step.stepNumber.trim() || `__idx_${i}`;
        const fromPos = positions.get(fromKey);
        const toPos = positions.get(step.reworkReturnStep!.trim());
        if (!fromPos || !toPos) continue;

        // Arrow exits right side of source node, curves right and goes up/down to target
        const fromX = fromPos.nodeX + NODE_W + 4;
        const fromY = fromPos.y + fromPos.h / 2;
        const toX = toPos.nodeX + NODE_W + 4;
        const toY = toPos.y + toPos.h / 2;

        // Offset right of the flowchart for the curve
        const curveOffset = Math.min(80, canvasWidth * 0.08);
        const midX = Math.max(fromX, toX) + curveOffset;

        svg += `<g class="pfd-rework-arrow">
            <path d="M ${fromX},${fromY} C ${midX},${fromY} ${midX},${toY} ${toX + 8},${toY}"
                  stroke="${BLACK}" stroke-width="1.5" fill="none" stroke-dasharray="6,4"
                  stroke-linecap="round" marker-end="url(#reworkArrowMarker)"/>
            <text x="${midX + 4}" y="${(fromY + toY) / 2 + 4}" font-size="8" font-weight="700" fill="${BLACK}" text-anchor="start" font-family="${FONT}">RETRABAJO</text>
        </g>`;
    }
    return svg;
}

// ============================================================================
// Traceability block (linked AMFE / Control Plan)
// ============================================================================

function renderTraceabilityBlock(centerX: number, y: number, totalWidth: number, doc: PfdDocument): string {
    const h = doc.header;
    const parts: string[] = [];
    if (h.linkedAmfeId) parts.push(`AMFE de Proceso: ${h.linkedAmfeId}`);
    if (h.linkedCpId) parts.push(`Plan de Control: ${h.linkedCpId}`);
    if (parts.length === 0) return '';

    const boxW = Math.min(totalWidth - 48, 600);
    const boxX = centerX - boxW / 2;
    const boxH = 28;

    return `<g class="pfd-traceability">
        <rect x="${boxX}" y="${y}" width="${boxW}" height="${boxH}" rx="4" fill="#F9FAFB" stroke="#D1D5DB" stroke-width="1"/>
        <text x="${centerX}" y="${y + 11}" font-size="8" font-weight="700" fill="#6B7280" text-anchor="middle" font-family="${FONT}" letter-spacing="0.5">TRAZABILIDAD DOCUMENTAL</text>
        <text x="${centerX}" y="${y + 22}" font-size="9" fill="${BLACK}" text-anchor="middle" font-family="${FONT}">${esc(parts.join('  |  '))}</text>
    </g>`;
}

// ============================================================================
// Notes section (step notes with numbered references)
// ============================================================================

function renderNotesSection(centerX: number, y: number, totalWidth: number, stepsWithNotes: PfdStep[]): { svg: string; height: number } {
    if (stepsWithNotes.length === 0) return { svg: '', height: 0 };

    const lineH = 14;
    const headerH = 20;
    const paddingBottom = 10;
    const totalH = headerH + stepsWithNotes.length * lineH + paddingBottom;
    const boxW = Math.min(totalWidth - 48, 700);
    const boxX = centerX - boxW / 2;

    let svg = `<g class="pfd-notes">
        <rect x="${boxX}" y="${y}" width="${boxW}" height="${totalH}" rx="4" fill="#FAFAFA" stroke="#E5E7EB" stroke-width="1"/>
        <text x="${boxX + 12}" y="${y + 15}" font-size="9" font-weight="700" fill="#475569" font-family="${FONT}" letter-spacing="0.3">NOTAS</text>`;

    for (let i = 0; i < stepsWithNotes.length; i++) {
        const s = stepsWithNotes[i];
        const noteY = y + headerH + 4 + i * lineH;
        svg += `<text x="${boxX + 12}" y="${noteY}" font-size="8" fill="#4B5563" font-family="${FONT}">
            <tspan font-weight="600">* ${esc(s.stepNumber || '?')}:</tspan> ${esc(truncate(s.notes, 90))}
        </text>`;
    }

    svg += '</g>';
    return { svg, height: totalH };
}

// ============================================================================
// Footer rendering
// ============================================================================

function renderFooter(centerX: number, y: number, totalWidth: number, _doc: PfdDocument): string {
    return `<g class="pfd-footer">
        <line x1="24" y1="${y}" x2="${totalWidth - 24}" y2="${y}" stroke="#D1D5DB" stroke-width="1"/>
        <text x="${centerX}" y="${y + 16}" font-size="9" fill="#94A3B8" text-anchor="middle" font-family="${FONT}">
            BARACK MERCOSUL
        </text>
    </g>`;
}

// ============================================================================
// Watermark rendering
// ============================================================================

function renderWatermark(centerX: number, centerY: number): string {
    return `<g class="pfd-watermark" opacity="0.018">
        <text x="${centerX}" y="${centerY}" font-size="120" font-weight="900" fill="#9CA3AF" text-anchor="middle" font-family="${FONT}" letter-spacing="12" transform="rotate(-35, ${centerX}, ${centerY})">BARACK MERCOSUL</text>
    </g>`;
}

// ============================================================================
// Main SVG builder
// ============================================================================

export interface BuildPfdSvgOptions {
    /** Skip the notes section at the bottom (used in PDF export) */
    skipNotes?: boolean;
}

export function buildPfdSvg(doc: PfdDocument, logoBase64 = '', options?: BuildPfdSvgOptions): string {
    if (doc.steps.length === 0) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
            <rect width="400" height="200" fill="white"/>
            <text x="200" y="100" font-size="12" fill="#9CA3AF" text-anchor="middle" font-family="${FONT}">Sin pasos definidos</text>
        </svg>`;
    }

    const groups = groupStepsByFlow(doc.steps);

    // First pass: compute max content width for centering
    const legendTotalW = LEGEND_PREFIX_W + PFD_STEP_TYPES.length * LEGEND_ITEM_W;
    const contentWidth = Math.max(computeMaxContentWidth(groups), legendTotalW);
    const canvasWidth = contentWidth + CANVAS_PAD * 2;

    // Center offset for main-flow nodes
    const centerX = canvasWidth / 2;
    const mainNodeX = centerX - NODE_W / 2;

    const elements: string[] = [];
    let curY = TOP_MARGIN;

    // Traceability block (linked AMFE / Control Plan)
    if (doc.header.linkedAmfeId || doc.header.linkedCpId) {
        const traceBlock = renderTraceabilityBlock(centerX, curY, canvasWidth, doc);
        if (traceBlock) {
            elements.push(traceBlock);
            curY += 36;
        }
    }

    // Track step positions for rework arrows
    const stepPositions = new Map<string, StepPosition>();
    // Build step → index map so unnamed steps (empty stepNumber) can also be tracked
    const stepIdxMap = new Map<PfdStep, number>();
    doc.steps.forEach((s, idx) => stepIdxMap.set(s, idx));

    for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi];

        // Inter-group arrow
        if (gi > 0) {
            elements.push(renderArrow(centerX, curY, curY + ARROW_GAP));
            curY += ARROW_GAP;
        }

        if (group.type === 'main') {
            for (let si = 0; si < group.steps.length; si++) {
                if (si > 0) {
                    elements.push(renderArrow(centerX, curY, curY + ARROW_GAP));
                    curY += ARROW_GAP;
                }
                const step = group.steps[si];
                elements.push(renderNode(step, mainNodeX, curY));
                // Track position (use index fallback for unnamed steps)
                const mainKey = step.stepNumber.trim() || `__idx_${stepIdxMap.get(step)}`;
                stepPositions.set(mainKey, {
                    stepNumber: step.stepNumber,
                    x: centerX,
                    y: curY,
                    h: getNodeHeight(step),
                    nodeX: mainNodeX,
                });
                curY += getNodeHeight(step);
            }
        } else if (group.type === 'parallel' && group.branches) {
            const branches = group.branches;
            const numLanes = branches.length;
            const laneW = NODE_W + LANE_PAD * 2;
            const totalW = numLanes * laneW + (numLanes - 1) * PARALLEL_GAP;
            const startX = centerX - totalW / 2;

            // "FLUJO PARALELO" label
            elements.push(`<text x="${centerX}" y="${curY + 12}" font-size="10" font-weight="700" fill="${DARK}" text-anchor="middle" font-family="${FONT}">FLUJO PARALELO</text>`);
            curY += 20;

            // Lane center X positions (for fork/join lines)
            const laneCenters: { cx: number }[] = [];
            for (let li = 0; li < numLanes; li++) {
                const laneX = startX + li * (laneW + PARALLEL_GAP);
                laneCenters.push({ cx: laneX + laneW / 2 });
            }

            // Fork lines
            elements.push(renderForkLines(centerX, curY, laneCenters));
            curY += 20;

            // Compute max lane height
            let maxLaneH = 0;
            for (const branch of branches) {
                let laneH = 30; // label + padding
                for (const step of branch.steps) {
                    laneH += getNodeHeight(step);
                }
                laneH += (branch.steps.length - 1) * ARROW_GAP;
                if (laneH > maxLaneH) maxLaneH = laneH;
            }

            // Render each lane
            for (let li = 0; li < branches.length; li++) {
                const branch = branches[li];
                const laneX = startX + li * (laneW + PARALLEL_GAP);

                // Lane background
                elements.push(`<rect x="${laneX}" y="${curY}" width="${laneW}" height="${maxLaneH}" rx="4" fill="#F9FAFB" stroke="#D1D5DB" stroke-width="1"/>`);

                // Lane label
                const labelText = esc(branch.label);
                const pillW = labelText.length * 7 + 20;
                const pillX = laneX + laneW / 2 - pillW / 2;
                elements.push(`<rect x="${pillX}" y="${curY + 6}" width="${pillW}" height="18" rx="9" fill="white" stroke="#9CA3AF" stroke-width="1"/>
                    <text x="${laneX + laneW / 2}" y="${curY + 19}" font-size="10" font-weight="700" fill="${BLACK}" text-anchor="middle" font-family="${FONT}">${labelText}</text>`);

                // Steps inside lane
                let laneY = curY + 30;
                for (let si = 0; si < branch.steps.length; si++) {
                    if (si > 0) {
                        const arrowX = laneX + laneW / 2;
                        elements.push(renderArrow(arrowX, laneY, laneY + ARROW_GAP));
                        laneY += ARROW_GAP;
                    }
                    const bStep = branch.steps[si];
                    elements.push(renderNode(bStep, laneX + LANE_PAD, laneY));
                    // Track position for branch steps too (index fallback for unnamed)
                    const brKey = bStep.stepNumber.trim() || `__idx_${stepIdxMap.get(bStep)}`;
                    stepPositions.set(brKey, {
                        stepNumber: bStep.stepNumber,
                        x: laneX + laneW / 2,
                        y: laneY,
                        h: getNodeHeight(bStep),
                        nodeX: laneX + LANE_PAD,
                    });
                    laneY += getNodeHeight(bStep);
                }
            }

            curY += maxLaneH;

            // Join lines
            elements.push(renderJoinLines(centerX, curY + 4, laneCenters));
            curY += 18;

            // "CONVERGENCIA" label
            elements.push(`<text x="${centerX}" y="${curY + 14}" font-size="10" font-weight="700" fill="${DARK}" text-anchor="middle" font-family="${FONT}">CONVERGENCIA</text>`);
            curY += 22;
        }
    }

    // Rework return arrows (rendered after all nodes so they overlay)
    const reworkSvg = renderReworkArrows(doc.steps, stepPositions, canvasWidth);
    if (reworkSvg) elements.push(reworkSvg);

    // Notes section (if any step has notes) — skippable via options
    if (!options?.skipNotes) {
        const stepsWithNotes = doc.steps.filter(s => s.notes);
        if (stepsWithNotes.length > 0) {
            curY += 32;
            const notesResult = renderNotesSection(centerX, curY, canvasWidth, stepsWithNotes);
            if (notesResult.svg) {
                elements.push(notesResult.svg);
                curY += notesResult.height;
            }
        }
    }

    // Legend (centered) — extra gap to prevent overlap with last node
    curY += 48;
    elements.push(renderLegend(centerX, curY));
    curY += 36;

    // Footer
    curY += 16;
    elements.push(renderFooter(centerX, curY, canvasWidth, doc));
    curY += 50;

    // Total dimensions
    const totalHeight = curY + 20;

    // Header (full canvas width, with logo)
    const headerSvg = renderHeader(doc, canvasWidth, logoBase64);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" height="${totalHeight}" viewBox="0 0 ${canvasWidth} ${totalHeight}" preserveAspectRatio="xMidYMin meet">
    <style>
        .pfd-node rect:first-child { cursor: pointer; }
        .pfd-node:hover rect:first-child { filter: brightness(0.96); }
        .pfd-arrow path { stroke-dasharray: 200; stroke-dashoffset: 200; animation: dashDraw 0.5s ease forwards; }
        @keyframes dashDraw { to { stroke-dashoffset: 0; } }
    </style>
    ${buildDefs()}
    <!-- Background -->
    <rect width="100%" height="100%" fill="white"/>
    ${renderWatermark(centerX, totalHeight / 2)}
    ${headerSvg}
    ${elements.join('\n    ')}
</svg>`;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Export PFD document as a downloadable SVG file.
 * The SVG is fully editable in Visio, Inkscape, Illustrator, etc.
 * Includes the Barack logo embedded as base64 in the header.
 */
export async function exportPfdSvg(doc: PfdDocument): Promise<void> {
    const logoBase64 = await getLogoBase64();
    const svgContent = buildPfdSvg(doc, logoBase64);

    const nameSource = doc.header.partName || doc.header.partNumber || doc.header.documentNumber || 'Documento';
    const safeName = sanitizeFilename(nameSource, { allowSpaces: true });
    const date = new Date().toISOString().split('T')[0];
    const filename = `PFD_${safeName}_${date}.svg`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Generate PFD SVG as a Uint8Array buffer (for auto-export to filesystem).
 */
export async function generatePfdSvgBuffer(doc: PfdDocument): Promise<Uint8Array> {
    const logoBase64 = await getLogoBase64();
    const svgContent = buildPfdSvg(doc, logoBase64);
    return new TextEncoder().encode(svgContent);
}
