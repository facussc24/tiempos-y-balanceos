/**
 * APQP Package Export
 *
 * Generates a single Excel file with PFD + AMFE + CP + HO sheets.
 * Reuses buildControlPlanWorkbook() and buildAmfeCompletoWorkbook().
 *
 * Company standard: all sheets start at B2 (1 empty row + 1 empty column).
 * Uses xlsx-js-style only — no ExcelJS mixing (causes XML corruption).
 * HO images use placeholder text; full images available in standalone HO export.
 */

import XLSX from 'xlsx-js-style';
import type { PfdDocument, PfdStepType } from '../pfd/pfdTypes';
import { PFD_STEP_TYPES } from '../pfd/pfdTypes';
import type { AmfeDocument } from '../amfe/amfeTypes';
import { buildAmfeCompletoWorkbook } from '../amfe/amfeExcelExport';
import type { ControlPlanDocument } from '../controlPlan/controlPlanTypes';
import { buildControlPlanWorkbook } from '../controlPlan/controlPlanExcelExport';
import type { HoDocument } from '../hojaOperaciones/hojaOperacionesTypes';
import { PPE_CATALOG } from '../hojaOperaciones/hojaOperacionesTypes';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { downloadWorkbook } from '../../utils/excel';

// ============================================================================
// TYPES
// ============================================================================

export interface ApqpPackageData {
    familyName: string;
    partNumbers: string[];
    client: string;
    revision: string;
    team: string;
    date: string;
    pfd: PfdDocument | null;
    amfe: AmfeDocument | null;
    cp: ControlPlanDocument | null;
    ho: HoDocument | null;
}

export interface ApqpExportOptions {
    includePortada: boolean;
    includeFlujograma: boolean;
    includeAmfe: boolean;
    includeCp: boolean;
    includeHo: boolean;
    revision: string;
}

// ============================================================================
// XLSX-JS-STYLE STYLES
// ============================================================================

const BORDER = {
    top: { style: 'thin' as const, color: { rgb: '000000' } },
    bottom: { style: 'thin' as const, color: { rgb: '000000' } },
    left: { style: 'thin' as const, color: { rgb: '000000' } },
    right: { style: 'thin' as const, color: { rgb: '000000' } },
};

const st = {
    title:     { font: { bold: true, sz: 18, name: 'Arial', color: { rgb: '1E3A5F' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const } },
    subtitle:  { font: { bold: true, sz: 12, name: 'Arial', color: { rgb: '4472C4' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const } },
    metaLabel: { font: { bold: true, sz: 10, name: 'Arial' }, fill: { fgColor: { rgb: 'F2F2F2' } }, border: BORDER, alignment: { vertical: 'center' as const } },
    metaValue: { font: { sz: 10, name: 'Arial' }, border: BORDER, alignment: { vertical: 'center' as const } },
    section:   { font: { bold: true, sz: 10, name: 'Arial', color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E3A5F' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: BORDER },
    colHdr:    { font: { bold: true, sz: 9, name: 'Arial' }, fill: { fgColor: { rgb: 'D9E2F3' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true }, border: BORDER },
    cell:      { font: { sz: 9, name: 'Arial' }, alignment: { vertical: 'top' as const, wrapText: true }, border: BORDER },
    cc:        { font: { sz: 9, name: 'Arial' }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: BORDER },
    tocItem:   { font: { sz: 10, name: 'Arial' }, border: BORDER, alignment: { vertical: 'center' as const } },
    tocNum:    { font: { bold: true, sz: 10, name: 'Arial', color: { rgb: '4472C4' } }, border: BORDER, alignment: { horizontal: 'center' as const, vertical: 'center' as const } },
    ccBadge:   { font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C0006' } }, fill: { fgColor: { rgb: 'FFC7CE' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: BORDER },
    scBadge:   { font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C6500' } }, fill: { fgColor: { rgb: 'FFEB9C' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: BORDER },
    ngScrap:   { font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C0006' } }, fill: { fgColor: { rgb: 'FFC7CE' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: BORDER },
    ngRework:  { font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C6500' } }, fill: { fgColor: { rgb: 'FFEB9C' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: BORDER },
    ngSort:    { font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '1D4ED8' } }, fill: { fgColor: { rgb: 'DBEAFE' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: BORDER },
    subStep:   { font: { sz: 9, name: 'Arial', color: { rgb: '555555' } }, fill: { fgColor: { rgb: 'F5F5F5' } }, alignment: { vertical: 'top' as const, wrapText: true }, border: BORDER },
    subCC:     { font: { sz: 9, name: 'Arial', color: { rgb: '555555' } }, fill: { fgColor: { rgb: 'F5F5F5' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: BORDER },
    branchLbl: { font: { bold: true, sz: 9, name: 'Arial', color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '7B61FF' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: BORDER },
    keyPt:     { font: { bold: true, sz: 9, name: 'Arial' }, fill: { fgColor: { rgb: 'FFEB9C' } }, alignment: { vertical: 'top' as const, wrapText: true }, border: BORDER },
    imgRef:    { font: { sz: 9, name: 'Arial', color: { rgb: '4472C4' } }, alignment: { vertical: 'center' as const, wrapText: true }, border: BORDER },
    greenSec:  { font: { bold: true, sz: 10, name: 'Arial', color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '4CAF50' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: BORDER },
    // HO-matching styles (individual export parity)
    redSec:    { font: { bold: true, sz: 10, name: 'Arial', color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: 'E53935' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: BORDER },
    redCell:   { font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C0006' } }, fill: { fgColor: { rgb: 'FFC7CE' } }, alignment: { vertical: 'top' as const, wrapText: true }, border: BORDER },
    greenHdr:  { font: { bold: true, sz: 8, name: 'Arial' }, fill: { fgColor: { rgb: 'E2EFDA' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true }, border: BORDER },
    navyLight: { font: { bold: true, sz: 8, name: 'Arial' }, fill: { fgColor: { rgb: 'D6E4F0' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true }, border: BORDER },
    grayLabel: { font: { bold: true, sz: 7, name: 'Arial', color: { rgb: '808080' } }, alignment: { vertical: 'top' as const, wrapText: true }, border: BORDER },
    // Flujograma decision-row style
    decisionRow: { font: { sz: 9, name: 'Arial', color: { rgb: '6B21A8' } }, fill: { fgColor: { rgb: 'F3E8FF' } }, alignment: { vertical: 'top' as const, wrapText: true }, border: BORDER },
    decisionCC:  { font: { sz: 9, name: 'Arial', color: { rgb: '6B21A8' } }, fill: { fgColor: { rgb: 'F3E8FF' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: BORDER },
};

function ccStyle(v: string) { const u = (v || '').toUpperCase().trim(); return u === 'CC' ? st.ccBadge : u === 'SC' ? st.scBadge : st.cc; }
function ngStyle(d: string) { return d === 'scrap' ? st.ngScrap : d === 'rework' ? st.ngRework : d === 'sort' ? st.ngSort : st.cc; }

// ============================================================================
// HELPERS
// ============================================================================

const STEP_LABELS: Record<PfdStepType, string> = {} as any;
for (const t of PFD_STEP_TYPES) STEP_LABELS[t.value] = t.label;
const NG_LABELS: Record<string, string> = { none: '', rework: 'Retrabajo', scrap: 'Descarte', sort: 'Seleccion' };

const ASME_SYMBOLS: Record<string, string> = {
    operation: '\u25EF', transport: '\u21E8', inspection: '\u25FB', storage: '\u25BD',
    delay: 'D', decision: '\u25C7', combined: '\u25EF\u25FB',
};

const OFF_C = 2;
const OFF_R = 8;

/** Apply B2 offset to aoa data: prepend 1 empty row and 1 empty column. */
function applyB2(rows: any[][], merges: XLSX.Range[], cw: number[]) {
    const mc = rows.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0) + 1;
    return {
        rows: [Array(mc).fill(''), ...rows.map(r => ['', ...(Array.isArray(r) ? r : [])])],
        merges: merges.map(m => ({ s: { r: m.s.r + 1, c: m.s.c + 1 }, e: { r: m.e.r + 1, c: m.e.c + 1 } })),
        cw: [OFF_C, ...cw],
    };
}

/** Shift existing xlsx-js-style worksheet by +1 row/col for B2 offset. */
export function shiftWorksheet(ws: XLSX.WorkSheet): XLSX.WorkSheet {
    const n: any = {};
    for (const k in ws) {
        if (k.startsWith('!')) continue;
        const c = XLSX.utils.decode_cell(k);
        c.r++; c.c++;
        n[XLSX.utils.encode_cell(c)] = ws[k];
    }
    if (ws['!ref']) { const r = XLSX.utils.decode_range(ws['!ref']); n['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r.e.r + 1, c: r.e.c + 1 } }); }
    if (ws['!merges']) n['!merges'] = ws['!merges'].map((m: XLSX.Range) => ({ s: { r: m.s.r + 1, c: m.s.c + 1 }, e: { r: m.e.r + 1, c: m.e.c + 1 } }));
    if (ws['!cols']) n['!cols'] = [{ wch: OFF_C }, ...ws['!cols']];
    if (ws['!rows']) n['!rows'] = [{ hpt: OFF_R }, ...ws['!rows']];
    if (ws['!freeze']) { const y = (ws['!freeze'] as any).ySplit || 0; n['!freeze'] = { xSplit: 0, ySplit: y + 1, topLeftCell: `A${y + 2}` }; }
    if (ws['!autofilter']) { const ref = (ws['!autofilter'] as any).ref; if (ref) { const rng = XLSX.utils.decode_range(ref); rng.s.r++; rng.s.c++; rng.e.r++; rng.e.c++; n['!autofilter'] = { ref: XLSX.utils.encode_range(rng) }; } }
    return n;
}

function hoSheetNames(ho: HoDocument): string[] {
    const u = new Set<string>();
    return ho.sheets.map(s => {
        let b = `HO ${s.operationNumber || s.hoNumber}`.substring(0, 28), nm = b, c = 1;
        while (u.has(nm)) nm = `${b} (${c++})`;
        u.add(nm); return nm;
    });
}

// ============================================================================
// PORTADA (with B2 offset)
// ============================================================================

export function buildPortadaSheet(wb: XLSX.WorkBook, data: ApqpPackageData, opts: ApqpExportOptions, tocNames: string[]): void {
    const rows: any[][] = [], merges: XLSX.Range[] = [], TC = 6, er = () => Array(TC).fill('');
    rows.push(er(), er());
    const tR: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.title }));
    tR[0] = { v: 'PAQUETE APQP', s: st.title }; rows.push(tR); merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: TC - 1 } });
    const fR: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.subtitle }));
    fR[0] = { v: data.familyName, s: st.subtitle }; rows.push(fR); merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: TC - 1 } });
    rows.push(er());
    for (const [l, v] of [['Familia de Producto', data.familyName], ['Numeros de Parte', data.partNumbers.join(', ') || '\u2014'], ['Cliente', data.client || '\u2014'], ['Fecha', data.date], ['Revision', opts.revision || data.revision || 'A'], ['Equipo', data.team || '\u2014']] as [string, string][]) {
        const ri = rows.length, row: any[] = Array(TC).fill(null).map(() => ({ v: '', s: { border: BORDER } }));
        row[0] = { v: l, s: st.metaLabel }; row[1] = { v: '', s: st.metaLabel }; row[2] = { v: sanitizeCellValue(v), s: st.metaValue };
        for (let c = 3; c < TC; c++) row[c] = { v: '', s: st.metaValue };
        merges.push({ s: { r: ri, c: 0 }, e: { r: ri, c: 1 } }, { s: { r: ri, c: 2 }, e: { r: ri, c: TC - 1 } }); rows.push(row);
    }
    rows.push(er(), er());
    const ti = rows.length, tH: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.section }));
    tH[0] = { v: 'CONTENIDO DEL PAQUETE', s: st.section }; rows.push(tH); merges.push({ s: { r: ti, c: 0 }, e: { r: ti, c: TC - 1 } });
    for (let i = 0; i < tocNames.length; i++) {
        const ri = rows.length, row: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.tocItem }));
        row[0] = { v: i + 1, s: st.tocNum }; row[1] = { v: tocNames[i], s: st.tocItem };
        for (let c = 2; c < TC; c++) row[c] = { v: '', s: st.tocItem };
        merges.push({ s: { r: ri, c: 1 }, e: { r: ri, c: TC - 1 } }); rows.push(row);
    }
    const rh = rows.map((_, i) => (i === 2 ? 40 : i === 3 ? 28 : 20));
    const { rows: oR, merges: oM, cw: oC } = applyB2(rows, merges, [18, 18, 20, 20, 20, 20]);
    const ws = XLSX.utils.aoa_to_sheet(oR); ws['!cols'] = oC.map(w => ({ wch: w })); ws['!merges'] = oM;
    ws['!rows'] = [{ hpt: OFF_R }, ...rh.map(h => ({ hpt: h }))];
    XLSX.utils.book_append_sheet(wb, ws, 'Portada');
}

// ============================================================================
// FLUJOGRAMA — CC/SC red/yellow badges, NG disposition, all steps
// ============================================================================

export function buildFlujogramaSheet(wb: XLSX.WorkBook, pfd: PfdDocument): void {
    const rows: any[][] = [], merges: XLSX.Range[] = [];
    const hdrs = ['Nro. Op.', 'S\u00EDmbolo', 'Descripci\u00F3n', 'Elementos de Trabajo (4M)', 'Caract. Producto', 'CC/SC Prod.', 'Caract. Proceso', 'CC/SC Proc.', 'Ruteo / Disposici\u00F3n NG'];
    const cw = [10, 16, 35, 26, 22, 10, 22, 10, 28]; const TC = hdrs.length;

    const tR: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.title }));
    tR[0] = { v: 'DIAGRAMA DE FLUJO DEL PROCESO', s: { ...st.title, font: { ...st.title.font, sz: 14 } } };
    rows.push(tR); merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: TC - 1 } });
    for (const [l, v] of [['Nro. Pieza', pfd.header.partNumber], ['Pieza', pfd.header.partName], ['Revision', pfd.header.revisionLevel]] as [string, string][]) {
        const ri = rows.length, row: any[] = Array(TC).fill(null).map(() => ({ v: '', s: { border: BORDER } }));
        row[0] = { v: l, s: st.metaLabel }; row[1] = { v: '', s: st.metaLabel }; row[2] = { v: sanitizeCellValue(v), s: st.metaValue };
        for (let c = 3; c < TC; c++) row[c] = { v: '', s: st.metaValue };
        merges.push({ s: { r: ri, c: 0 }, e: { r: ri, c: 1 } }, { s: { r: ri, c: 2 }, e: { r: ri, c: TC - 1 } }); rows.push(row);
    }
    rows.push(Array(TC).fill(''));
    rows.push(hdrs.map(h => ({ v: h, s: st.colHdr }))); const dsr = rows.length;

    let lastBranch = '';
    for (let si = 0; si < pfd.steps.length; si++) {
        const s = pfd.steps[si];
        // Branch label row when entering a new parallel flow
        if (s.branchId && s.branchId !== lastBranch) {
            const brLabel = s.branchLabel || `RAMA ${s.branchId}`;
            const brIdx = rows.length;
            const brRow: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.branchLbl }));
            brRow[0] = { v: brLabel, s: st.branchLbl };
            rows.push(brRow); merges.push({ s: { r: brIdx, c: 0 }, e: { r: brIdx, c: TC - 1 } });
        }
        lastBranch = s.branchId || '';

        // ASME Unicode symbol + label
        const symUnicode = ASME_SYMBOLS[s.stepType] || '';
        const symLabel = STEP_LABELS[s.stepType] || s.stepType;
        const sym = symUnicode ? `${symUnicode} ${symLabel}` : symLabel;

        // Descriptive NG disposition text
        const ngText = buildNgDescription(s);

        // 4M column: Machine, Mano de obra, Material, Medio ambiente
        const fourM = build4MText(s);

        const pCC = s.productSpecialChar !== 'none' ? s.productSpecialChar : '';
        const prCC = s.processSpecialChar !== 'none' ? s.processSpecialChar : '';
        // Sub-steps (transport, storage, delay) get gray background + indented description
        const isSub = s.stepType === 'transport' || s.stepType === 'storage' || s.stepType === 'delay';
        const cellS = isSub ? st.subStep : st.cell;
        const ccS = isSub ? st.subCC : st.cc;
        const desc = isSub ? `  ${String(s.description)}` : String(s.description);
        rows.push([
            { v: sanitizeCellValue(s.stepNumber), s: ccS },
            { v: sanitizeCellValue(sym), s: ccS },
            { v: sanitizeCellValue(desc), s: cellS },
            { v: sanitizeCellValue(fourM), s: { ...cellS, alignment: { vertical: 'top' as const, wrapText: true } } },
            { v: sanitizeCellValue(s.productCharacteristic), s: cellS },
            { v: sanitizeCellValue(pCC), s: pCC ? ccStyle(pCC) : ccS },
            { v: sanitizeCellValue(s.processCharacteristic), s: cellS },
            { v: sanitizeCellValue(prCC), s: prCC ? ccStyle(prCC) : ccS },
            { v: sanitizeCellValue(ngText), s: s.rejectDisposition !== 'none' ? ngStyle(s.rejectDisposition) : ccS },
        ]);

        // Auto-insert decision row after inspection/combined with NG disposition
        if ((s.stepType === 'inspection' || s.stepType === 'combined') && s.rejectDisposition !== 'none') {
            // Skip if next step is already a decision
            const nextStep = si + 1 < pfd.steps.length ? pfd.steps[si + 1] : null;
            if (!nextStep || nextStep.stepType !== 'decision') {
                const decDesc = `OK \u2192 contin\u00FAa | NG \u2192 ${ngText}`;
                rows.push([
                    { v: '', s: st.decisionCC },
                    { v: '\u25C7 Decisi\u00F3n', s: st.decisionCC },
                    { v: sanitizeCellValue(decDesc), s: st.decisionRow },
                    { v: '', s: st.decisionRow },
                    { v: '', s: st.decisionRow },
                    { v: '', s: st.decisionCC },
                    { v: '', s: st.decisionRow },
                    { v: '', s: st.decisionCC },
                    { v: '', s: st.decisionCC },
                ]);
            }
        }
    }
    const rh = rows.map((row, i) => { if (i === 0) return 30; if (i >= dsr && Array.isArray(row)) { const l = Math.max(String(row[2]?.v || '').length, String(row[3]?.v || '').length); return Math.min(60, Math.max(15, Math.max(1, Math.ceil(l / 30)) * 13)); } return 18; });
    const { rows: oR, merges: oM, cw: oC } = applyB2(rows, merges, cw);
    const ws = XLSX.utils.aoa_to_sheet(oR); ws['!cols'] = oC.map(w => ({ wch: w })); ws['!merges'] = oM;
    ws['!rows'] = [{ hpt: OFF_R }, ...rh.map(h => ({ hpt: h }))];
    ws['!freeze'] = { xSplit: 0, ySplit: dsr + 1, topLeftCell: `A${dsr + 2}` };
    XLSX.utils.book_append_sheet(wb, ws, 'Flujograma');
}

/** Build descriptive NG disposition text from step data. */
function buildNgDescription(s: { rejectDisposition: string; scrapDescription?: string; reworkReturnStep?: string }): string {
    if (s.rejectDisposition === 'none' || !s.rejectDisposition) return '';
    if (s.rejectDisposition === 'scrap') {
        const reason = s.scrapDescription?.trim();
        return reason ? `Scrap \u2014 segregar en \u00E1rea de rechazo (${reason})` : 'Scrap \u2014 segregar en \u00E1rea de rechazo';
    }
    if (s.rejectDisposition === 'rework') {
        const target = s.reworkReturnStep?.trim();
        return target ? `Retrabajo \u2014 retorna a ${target} para re-inspecci\u00F3n` : 'Retrabajo \u2014 retorna a operaci\u00F3n anterior';
    }
    if (s.rejectDisposition === 'sort') {
        const reason = s.scrapDescription?.trim();
        return reason ? `Selecci\u00F3n \u2014 ${reason}` : 'Selecci\u00F3n 100%';
    }
    return s.rejectDisposition;
}

/** Build 4M (Man, Machine, Material, Method/Environment) text for a PFD step. */
function build4MText(s: { machineDeviceTool?: string; isExternalProcess?: boolean }): string {
    const parts: string[] = [];
    const machine = s.machineDeviceTool?.trim();
    parts.push(`M: ${machine || '\u2014'}`);
    parts.push(`MO: ${s.isExternalProcess ? 'Proveedor externo' : 'Operador'}`);
    parts.push('Mat: \u2014');
    parts.push('MA: \u2014');
    return parts.join('\n');
}

// ============================================================================
// HO SHEETS — matching individual export layout (hoExcelExport.ts)
// xlsx-js-style reimplementation: same sections, columns, order, styles.
// Images use text placeholders (xlsx-js-style limitation).
// ============================================================================

export function buildHoSummarySheets(wb: XLSX.WorkBook, ho: HoDocument): void {
    const usedNames = new Set<string>();
    for (const sheet of ho.sheets) {
        let baseName = `HO ${sheet.operationNumber || sheet.hoNumber}`.substring(0, 28);
        let sheetName = baseName; let counter = 1;
        while (usedNames.has(sheetName)) sheetName = `${baseName} (${counter++})`;
        usedNames.add(sheetName);

        const rows: any[][] = [], merges: XLSX.Range[] = [], TC = 8;

        // ── Header rows 0-1: Org text | "HOJA DE OPERACIONES" | HO Number ──
        // Row 0: [Org (cols 0-1)] [Title (cols 2-4)] [Form (cols 5-6)] [Status (col 7)]
        const r0: any[] = Array(TC).fill(null).map(() => ({ v: '', s: { border: BORDER } }));
        r0[0] = { v: ho.header?.organization || 'BARACK MERCOSUL', s: { font: { bold: true, sz: 11, name: 'Arial', color: { rgb: '1E3A5F' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: BORDER } };
        r0[2] = { v: 'HOJA DE OPERACIONES', s: { font: { bold: true, sz: 14, name: 'Arial', color: { rgb: '1E3A5F' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: BORDER } };
        r0[5] = { v: `Form: ${ho.header?.formNumber || ''}`, s: { font: { sz: 7, name: 'Arial', color: { rgb: '808080' } }, alignment: { horizontal: 'right' as const, vertical: 'bottom' as const }, border: BORDER } };
        const statusLabel = sheet.status === 'aprobado' ? 'APROBADO' : sheet.status === 'pendienteRevision' ? 'PEND. REV.' : 'BORRADOR';
        const statusFill = sheet.status === 'aprobado' ? '22C55E' : sheet.status === 'pendienteRevision' ? 'FACC15' : 'E5E7EB';
        const statusTxt = sheet.status === 'aprobado' ? 'FFFFFF' : sheet.status === 'pendienteRevision' ? '854D0E' : '4B5563';
        r0[7] = { v: statusLabel, s: { font: { bold: true, sz: 8, name: 'Arial', color: { rgb: statusTxt } }, fill: { fgColor: { rgb: statusFill } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: BORDER } };
        rows.push(r0);
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, { s: { r: 0, c: 2 }, e: { r: 0, c: 4 } }, { s: { r: 0, c: 5 }, e: { r: 0, c: 6 } });

        // Row 1: [Org cont.] [Title cont.] [HO Number (cols 5-7)]
        const r1: any[] = Array(TC).fill(null).map(() => ({ v: '', s: { border: BORDER } }));
        r1[5] = { v: sheet.hoNumber, s: { font: { bold: true, sz: 18, name: 'Arial', color: { rgb: '1E3A5F' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: BORDER } };
        rows.push(r1);
        merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }, { s: { r: 1, c: 2 }, e: { r: 1, c: 4 } }, { s: { r: 1, c: 5 }, e: { r: 1, c: 7 } });
        // Merge rows 0-1 for org and title
        merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 1 } }, { s: { r: 0, c: 2 }, e: { r: 1, c: 4 } });

        // ── Row 2: N° Operación | Denominación | Modelo ──
        const r2: any[] = Array(TC).fill(null).map(() => ({ v: '', s: { border: BORDER } }));
        r2[0] = { v: 'N\u00B0 DE OPERACI\u00D3N', s: st.grayLabel }; r2[1] = { v: sheet.operationNumber, s: { font: { sz: 10, bold: true, name: 'Arial' }, border: BORDER } };
        r2[2] = { v: 'DENOMINACI\u00D3N DE LA OPERACI\u00D3N', s: st.grayLabel };
        r2[3] = { v: sanitizeCellValue(sheet.operationName), s: { font: { sz: 10, bold: true, name: 'Arial' }, border: BORDER } };
        r2[6] = { v: 'MODELO O VEH\u00CDCULO', s: st.grayLabel }; r2[7] = { v: sanitizeCellValue(sheet.vehicleModel), s: st.metaValue };
        rows.push(r2);
        merges.push({ s: { r: 2, c: 3 }, e: { r: 2, c: 5 } });

        // ── Row 3: Realizó | Aprobó | Fecha | Rev ──
        const r3: any[] = Array(TC).fill(null).map(() => ({ v: '', s: { border: BORDER } }));
        r3[0] = { v: 'REALIZ\u00D3', s: st.grayLabel }; r3[1] = { v: sanitizeCellValue(sheet.preparedBy), s: st.metaValue };
        r3[2] = { v: 'APROB\u00D3', s: st.grayLabel }; r3[3] = { v: sanitizeCellValue(sheet.approvedBy), s: st.metaValue };
        r3[4] = { v: 'FECHA', s: st.grayLabel }; r3[5] = { v: sanitizeCellValue(sheet.date), s: st.metaValue };
        r3[6] = { v: 'REV.', s: st.grayLabel }; r3[7] = { v: sanitizeCellValue(sheet.revision), s: st.metaValue };
        rows.push(r3);

        // ── Row 4: Sector | Cod. Pieza | Cliente | N° Puesto ──
        const r4: any[] = Array(TC).fill(null).map(() => ({ v: '', s: { border: BORDER } }));
        r4[0] = { v: 'SECTOR', s: st.grayLabel }; r4[1] = { v: sanitizeCellValue(sheet.sector), s: st.metaValue };
        r4[2] = { v: 'COD. PIEZA', s: st.grayLabel }; r4[3] = { v: sanitizeCellValue(sheet.partCodeDescription), s: { ...st.metaValue, alignment: { vertical: 'center' as const, wrapText: true } } };
        r4[4] = { v: 'CLIENTE', s: st.grayLabel }; r4[5] = { v: sanitizeCellValue(ho.header?.client || ''), s: st.metaValue };
        r4[6] = { v: 'N\u00B0 PUESTO', s: st.grayLabel }; r4[7] = { v: sanitizeCellValue(sheet.puestoNumber), s: st.metaValue };
        rows.push(r4);

        // ── Optional: Piezas Aplicables ──
        if (ho.header.applicableParts?.trim()) {
            const apIdx = rows.length;
            const apRow: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.metaValue }));
            apRow[0] = { v: 'PIEZAS APLICABLES', s: st.grayLabel };
            apRow[1] = { v: sanitizeCellValue(ho.header.applicableParts.replace(/\n/g, ' \u00B7 ')), s: st.metaValue };
            rows.push(apRow); merges.push({ s: { r: apIdx, c: 1 }, e: { r: apIdx, c: TC - 1 } });
        }

        rows.push(Array(TC).fill('')); // separator

        // ── AYUDAS VISUALES (text placeholders — xlsx-js-style cannot embed images) ──
        if ((sheet.visualAids || []).length > 0) {
            const vaIdx = rows.length;
            const vaHdr: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.section }));
            vaHdr[0] = { v: 'AYUDAS VISUALES', s: st.section };
            rows.push(vaHdr); merges.push({ s: { r: vaIdx, c: 0 }, e: { r: vaIdx, c: TC - 1 } });
            for (const va of (sheet.visualAids || [])) {
                const linkedStep = sheet.steps.find(s => s.visualAidId === va.id);
                const caption = va.caption || 'Ayuda visual';
                const stepRef = linkedStep ? `Paso ${linkedStep.stepNumber}` : '';
                const ri = rows.length;
                const row: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.imgRef }));
                row[0] = { v: `${stepRef ? stepRef + ': ' : ''}${caption} [Ver imagen en sistema]`, s: st.imgRef };
                rows.push(row); merges.push({ s: { r: ri, c: 0 }, e: { r: ri, c: TC - 1 } });
            }
            rows.push(Array(TC).fill(''));
        }

        // ── DESCRIPCIÓN DE LA OPERACIÓN (Steps) ──
        {
            const stHdrIdx = rows.length;
            const stHdr: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.section }));
            stHdr[0] = { v: 'DESCRIPCI\u00D3N DE LA OPERACI\u00D3N', s: st.section };
            rows.push(stHdr); merges.push({ s: { r: stHdrIdx, c: 0 }, e: { r: stHdrIdx, c: TC - 1 } });

            // Column headers matching individual: Nro | Descripción del Paso (5 cols) | Punto Clave | Razón
            const chIdx = rows.length;
            rows.push([
                { v: 'Nro', s: st.navyLight },
                { v: 'Descripci\u00F3n del Paso', s: st.navyLight }, { v: '', s: st.navyLight }, { v: '', s: st.navyLight }, { v: '', s: st.navyLight },
                { v: 'Punto Clave', s: st.navyLight },
                { v: 'Raz\u00F3n', s: st.navyLight }, { v: '', s: st.navyLight },
            ]);
            merges.push({ s: { r: chIdx, c: 1 }, e: { r: chIdx, c: 4 } }, { s: { r: chIdx, c: 6 }, e: { r: chIdx, c: 7 } });

            const steps = sheet.steps || [];
            if (steps.length === 0) {
                const emIdx = rows.length;
                const emRow: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.cell }));
                emRow[0] = { v: 'Sin pasos definidos', s: { ...st.cell, font: { ...st.cell.font, italic: true, color: { rgb: '808080' } }, alignment: { horizontal: 'center' as const } } };
                rows.push(emRow); merges.push({ s: { r: emIdx, c: 0 }, e: { r: emIdx, c: TC - 1 } });
            } else {
                for (const step of steps) {
                    const rowIdx = rows.length;
                    const isKP = step.isKeyPoint;
                    const cs = isKP ? st.keyPt : st.cell;
                    rows.push([
                        { v: step.stepNumber, s: isKP ? { ...st.cc, fill: { fgColor: { rgb: 'FFEB9C' } }, font: { ...st.cc.font, bold: true } } : st.cc },
                        { v: sanitizeCellValue(step.description), s: cs }, { v: '', s: cs }, { v: '', s: cs }, { v: '', s: cs },
                        { v: isKP ? 'SI' : '', s: isKP ? { ...st.cc, fill: { fgColor: { rgb: 'FFEB9C' } }, font: { ...st.cc.font, bold: true } } : st.cc },
                        { v: sanitizeCellValue(step.keyPointReason || ''), s: cs }, { v: '', s: cs },
                    ]);
                    merges.push({ s: { r: rowIdx, c: 1 }, e: { r: rowIdx, c: 4 } }, { s: { r: rowIdx, c: 6 }, e: { r: rowIdx, c: 7 } });
                }
            }
            rows.push(Array(TC).fill(''));
        }

        // ── ELEMENTOS DE SEGURIDAD (PPE) ──
        {
            const ppeIdx = rows.length;
            const ppeHdr: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.section }));
            ppeHdr[0] = { v: 'ELEMENTOS DE SEGURIDAD', s: st.section };
            rows.push(ppeHdr); merges.push({ s: { r: ppeIdx, c: 0 }, e: { r: ppeIdx, c: TC - 1 } });

            const safetyItems = sheet.safetyElements || [];
            if (safetyItems.length === 0) {
                const emIdx = rows.length;
                const emRow: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.cell }));
                emRow[0] = { v: 'Ninguno', s: { ...st.cell, font: { ...st.cell.font, italic: true, color: { rgb: '808080' } }, alignment: { horizontal: 'center' as const } } };
                rows.push(emRow); merges.push({ s: { r: emIdx, c: 0 }, e: { r: emIdx, c: TC - 1 } });
            } else {
                const labels = safetyItems.map(id => { const p = PPE_CATALOG.find(x => x.id === id); return p ? p.label : id; });
                const ppeListIdx = rows.length;
                const ppeRow: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.cell }));
                ppeRow[0] = { v: labels.join('  \u2022  '), s: { ...st.cell, alignment: { vertical: 'center' as const, wrapText: true } } };
                rows.push(ppeRow); merges.push({ s: { r: ppeListIdx, c: 0 }, e: { r: ppeListIdx, c: TC - 1 } });
            }
            rows.push(Array(TC).fill(''));
        }

        // ── CICLO DE CONTROL (Quality Checks) — 8 cols matching individual ──
        {
            const qcIdx = rows.length;
            const qcHdr: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.greenSec }));
            qcHdr[0] = { v: 'CICLO DE CONTROL', s: st.greenSec };
            rows.push(qcHdr); merges.push({ s: { r: qcIdx, c: 0 }, e: { r: qcIdx, c: TC - 1 } });

            // Reference line
            const refIdx = rows.length;
            const refRow: any[] = Array(TC).fill(null).map(() => ({ v: '', s: { border: {} } }));
            refRow[0] = { v: 'Referencia: OP - Operador de Producci\u00F3n', s: { font: { sz: 7, italic: true, name: 'Arial', color: { rgb: '808080' } }, alignment: { horizontal: 'left' as const }, border: {} } };
            rows.push(refRow); merges.push({ s: { r: refIdx, c: 0 }, e: { r: refIdx, c: TC - 1 } });

            // Column headers: Nro, Característica, Especificación, Método Control, Resp., Frecuencia, CC/SC, Registro
            rows.push(['Nro', 'Caracter\u00EDstica', 'Especificaci\u00F3n', 'M\u00E9todo Control', 'Resp.', 'Frecuencia', 'CC/SC', 'Registro'].map(h => ({ v: h, s: st.greenHdr })));

            const qualityChecks = sheet.qualityChecks || [];
            if (qualityChecks.length === 0) {
                const emIdx = rows.length;
                const emRow: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.cell }));
                emRow[0] = { v: 'Sin verificaciones de calidad. Genere primero el Plan de Control.', s: { ...st.cell, font: { ...st.cell.font, italic: true, color: { rgb: '808080' } }, alignment: { horizontal: 'center' as const } } };
                rows.push(emRow); merges.push({ s: { r: emIdx, c: 0 }, e: { r: emIdx, c: TC - 1 } });
            } else {
                for (let i = 0; i < qualityChecks.length; i++) {
                    const qc = qualityChecks[i];
                    const scUp = (qc.specialCharSymbol || '').toUpperCase().trim();
                    rows.push([
                        { v: i + 1, s: st.cc },
                        { v: sanitizeCellValue(qc.characteristic), s: st.cell },
                        { v: sanitizeCellValue(qc.specification), s: st.cell },
                        { v: sanitizeCellValue(qc.controlMethod || qc.evaluationTechnique || ''), s: st.cell },
                        { v: sanitizeCellValue(qc.reactionContact || ''), s: st.cc },
                        { v: sanitizeCellValue(qc.frequency), s: st.cc },
                        { v: sanitizeCellValue(qc.specialCharSymbol), s: ccStyle(qc.specialCharSymbol) },
                        { v: sanitizeCellValue(qc.registro), s: st.cell },
                    ]);
                }
            }
            rows.push(Array(TC).fill(''));
        }

        // ── PLAN DE REACCIÓN ANTE NO CONFORME ──
        {
            const rpIdx = rows.length;
            const rpHdr: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.redSec }));
            rpHdr[0] = { v: 'PLAN DE REACCI\u00D3N ANTE NO CONFORME', s: st.redSec };
            rows.push(rpHdr); merges.push({ s: { r: rpIdx, c: 0 }, e: { r: rpIdx, c: TC - 1 } });

            const reactionText = sheet.reactionPlanText || '';
            const rtIdx = rows.length;
            const rtRow: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.redCell }));
            rtRow[0] = { v: sanitizeCellValue(reactionText), s: st.redCell };
            rows.push(rtRow); merges.push({ s: { r: rtIdx, c: 0 }, e: { r: rtIdx, c: TC - 1 } });
            // Extra rows for reaction plan (matching 3-row block in individual)
            rows.push(Array(TC).fill(null).map(() => ({ v: '', s: st.redCell })));
            merges.push({ s: { r: rtIdx, c: 0 }, e: { r: rtIdx + 1, c: TC - 1 } });

            if (sheet.reactionContact) {
                const rcIdx = rows.length;
                const rcRow: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.redCell }));
                rcRow[0] = { v: `CONTACTO: ${sanitizeCellValue(sheet.reactionContact)}`, s: st.redCell };
                rows.push(rcRow); merges.push({ s: { r: rcIdx, c: 0 }, e: { r: rcIdx, c: TC - 1 } });
            }
        }

        // Column widths matching individual: B(14) C(16) D(20) E(28) F(18) G(16) H(12) I(20)
        const rawCw = [14, 16, 20, 28, 18, 16, 12, 20];
        const rh = rows.map((_, i) => {
            if (i <= 1) return 24; // header rows
            if (i <= 4) return 28; // metadata rows
            return 20; // default
        });
        const { rows: oR, merges: oM, cw: oC } = applyB2(rows, merges, rawCw);
        const wsOut = XLSX.utils.aoa_to_sheet(oR);
        wsOut['!cols'] = oC.map(w => ({ wch: w }));
        wsOut['!merges'] = oM;
        wsOut['!rows'] = [{ hpt: OFF_R }, ...rh.map(h => ({ hpt: h }))];
        XLSX.utils.book_append_sheet(wb, wsOut, sheetName);
    }
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/** Build the complete APQP package workbook (xlsx-js-style only, B2 offset). */
export function buildApqpPackageWorkbook(data: ApqpPackageData, options: ApqpExportOptions): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();
    const planned: string[] = [];
    if (options.includePortada) planned.push('Portada');
    if (options.includeFlujograma && data.pfd) planned.push('Flujograma');
    if (options.includeAmfe && data.amfe) planned.push('AMFE VDA');
    if (options.includeCp && data.cp) planned.push('Plan de Control');
    if (options.includeHo && data.ho && data.ho.sheets.length > 0) planned.push(...hoSheetNames(data.ho));

    if (options.includePortada) buildPortadaSheet(wb, data, options, planned.filter(n => n !== 'Portada'));
    if (options.includeFlujograma && data.pfd) buildFlujogramaSheet(wb, data.pfd);
    if (options.includeAmfe && data.amfe) { const w = buildAmfeCompletoWorkbook(data.amfe); const s = w.SheetNames[0]; if (s) XLSX.utils.book_append_sheet(wb, shiftWorksheet(w.Sheets[s]), 'AMFE VDA'); }
    if (options.includeCp && data.cp) { const w = buildControlPlanWorkbook(data.cp); const s = w.SheetNames[0]; if (s) XLSX.utils.book_append_sheet(wb, shiftWorksheet(w.Sheets[s]), 'Plan de Control'); }
    if (options.includeHo && data.ho && data.ho.sheets.length > 0) buildHoSummarySheets(wb, data.ho);

    return wb;
}

/** Export APQP package — builds workbook and triggers download. */
export function exportApqpPackage(data: ApqpPackageData, options: ApqpExportOptions): void {
    const wb = buildApqpPackageWorkbook(data, options);
    const safeName = sanitizeFilename(data.familyName || 'Paquete_APQP', { allowSpaces: true });
    downloadWorkbook(wb, `Paquete APQP - ${safeName}.xlsx`);
}

/** Generate APQP package as Uint8Array buffer (for auto-export / testing). */
export function generateApqpPackageBuffer(data: ApqpPackageData, options: ApqpExportOptions): Uint8Array {
    const wb = buildApqpPackageWorkbook(data, options);
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    return new Uint8Array(wbout);
}
