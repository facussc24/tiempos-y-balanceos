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
};

function ccStyle(v: string) { const u = (v || '').toUpperCase().trim(); return u === 'CC' ? st.ccBadge : u === 'SC' ? st.scBadge : st.cc; }
function ngStyle(d: string) { return d === 'scrap' ? st.ngScrap : d === 'rework' ? st.ngRework : d === 'sort' ? st.ngSort : st.cc; }

// ============================================================================
// HELPERS
// ============================================================================

const STEP_LABELS: Record<PfdStepType, string> = {} as any;
for (const t of PFD_STEP_TYPES) STEP_LABELS[t.value] = t.label;
const NG_LABELS: Record<string, string> = { none: '', rework: 'Retrabajo', scrap: 'Descarte', sort: 'Seleccion' };

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
    const hdrs = ['Nro. Op.', 'Simbolo', 'Descripcion', 'Maquina / Dispositivo', 'Caract. Producto', 'CC/SC Prod.', 'Caract. Proceso', 'CC/SC Proc.', 'Disp. NG'];
    const cw = [10, 16, 35, 22, 22, 10, 22, 10, 14]; const TC = hdrs.length;

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
    for (const s of pfd.steps) {
        // Branch label row when entering a new parallel flow
        if (s.branchId && s.branchId !== lastBranch) {
            const brLabel = s.branchLabel || `RAMA ${s.branchId}`;
            const brIdx = rows.length;
            const brRow: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.branchLbl }));
            brRow[0] = { v: brLabel, s: st.branchLbl };
            rows.push(brRow); merges.push({ s: { r: brIdx, c: 0 }, e: { r: brIdx, c: TC - 1 } });
        }
        lastBranch = s.branchId || '';

        const sym = STEP_LABELS[s.stepType] || s.stepType;
        const ng = NG_LABELS[s.rejectDisposition] || '';
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
            { v: sanitizeCellValue(s.machineDeviceTool), s: cellS },
            { v: sanitizeCellValue(s.productCharacteristic), s: cellS },
            { v: sanitizeCellValue(pCC), s: pCC ? ccStyle(pCC) : ccS },
            { v: sanitizeCellValue(s.processCharacteristic), s: cellS },
            { v: sanitizeCellValue(prCC), s: prCC ? ccStyle(prCC) : ccS },
            { v: sanitizeCellValue(ng), s: s.rejectDisposition !== 'none' ? ngStyle(s.rejectDisposition) : ccS },
        ]);
    }
    const rh = rows.map((row, i) => { if (i === 0) return 30; if (i >= dsr && Array.isArray(row)) { const l = String(row[2]?.v || '').length; return Math.min(60, Math.max(15, Math.max(1, Math.ceil(l / 30)) * 13)); } return 18; });
    const { rows: oR, merges: oM, cw: oC } = applyB2(rows, merges, cw);
    const ws = XLSX.utils.aoa_to_sheet(oR); ws['!cols'] = oC.map(w => ({ wch: w })); ws['!merges'] = oM;
    ws['!rows'] = [{ hpt: OFF_R }, ...rh.map(h => ({ hpt: h }))];
    ws['!freeze'] = { xSplit: 0, ySplit: dsr + 1, topLeftCell: `A${dsr + 2}` };
    XLSX.utils.book_append_sheet(wb, ws, 'Flujograma');
}

// ============================================================================
// HO SUMMARY SHEETS (xlsx-js-style, B2 offset, EPP text, image placeholders)
// ============================================================================

export function buildHoSummarySheets(wb: XLSX.WorkBook, ho: HoDocument): void {
    const usedNames = new Set<string>();
    for (const sheet of ho.sheets) {
        let baseName = `HO ${sheet.operationNumber || sheet.hoNumber}`.substring(0, 28);
        let sheetName = baseName; let counter = 1;
        while (usedNames.has(sheetName)) sheetName = `${baseName} (${counter++})`;
        usedNames.add(sheetName);

        const rows: any[][] = [], merges: XLSX.Range[] = [], TC = 8;

        // Title
        const titleRow: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.section }));
        titleRow[0] = { v: `HOJA DE OPERACIONES \u2014 ${sheet.operationName}`, s: st.section };
        rows.push(titleRow); merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: TC - 1 } });

        // Metadata
        for (const [l, v] of [['Operacion', `${sheet.operationNumber} \u2014 ${sheet.operationName}`], ['HO Nro.', sheet.hoNumber], ['Sector', sheet.sector], ['Puesto', sheet.puestoNumber], ['Modelo', sheet.vehicleModel], ['Revision', sheet.revision]] as [string, string][]) {
            const ri = rows.length, row: any[] = Array(TC).fill(null).map(() => ({ v: '', s: { border: BORDER } }));
            row[0] = { v: l, s: st.metaLabel }; row[1] = { v: '', s: st.metaLabel };
            row[2] = { v: sanitizeCellValue(v), s: st.metaValue };
            for (let c = 3; c < TC; c++) row[c] = { v: '', s: st.metaValue };
            merges.push({ s: { r: ri, c: 0 }, e: { r: ri, c: 1 } }, { s: { r: ri, c: 2 }, e: { r: ri, c: TC - 1 } }); rows.push(row);
        }
        rows.push(Array(TC).fill(''));

        // EPP — ISO names from PPE_CATALOG
        if (sheet.safetyElements.length > 0) {
            const ppeIdx = rows.length;
            const ppeHdr: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.section }));
            ppeHdr[0] = { v: 'ELEMENTOS DE SEGURIDAD (EPP)', s: st.section };
            rows.push(ppeHdr); merges.push({ s: { r: ppeIdx, c: 0 }, e: { r: ppeIdx, c: TC - 1 } });
            const labels = sheet.safetyElements.map(id => { const p = PPE_CATALOG.find(x => x.id === id); return p ? p.label : id; });
            const ppeListIdx = rows.length;
            const ppeRow: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.cell }));
            ppeRow[0] = { v: labels.join('\n'), s: { ...st.cell, alignment: { vertical: 'top' as const, wrapText: true } } };
            rows.push(ppeRow); merges.push({ s: { r: ppeListIdx, c: 0 }, e: { r: ppeListIdx, c: TC - 1 } });
            rows.push(Array(TC).fill(''));
        }

        // Steps
        if (sheet.steps.length > 0) {
            const stHdrIdx = rows.length;
            const stHdr: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.section }));
            stHdr[0] = { v: 'DESCRIPCION DE LA OPERACION', s: st.section };
            rows.push(stHdr); merges.push({ s: { r: stHdrIdx, c: 0 }, e: { r: stHdrIdx, c: TC - 1 } });
            const stepHeaders = ['Nro', 'Descripcion', '', '', 'Punto Clave', '', 'Razon', ''];
            rows.push(stepHeaders.map(h => ({ v: h, s: st.colHdr })));
            const scIdx = rows.length - 1;
            merges.push({ s: { r: scIdx, c: 1 }, e: { r: scIdx, c: 3 } }, { s: { r: scIdx, c: 4 }, e: { r: scIdx, c: 5 } }, { s: { r: scIdx, c: 6 }, e: { r: scIdx, c: 7 } });

            for (const step of sheet.steps) {
                const rowIdx = rows.length; const cs = step.isKeyPoint ? st.keyPt : st.cell;
                rows.push([
                    { v: step.stepNumber, s: st.cc },
                    { v: sanitizeCellValue(step.description), s: cs }, { v: '', s: cs }, { v: '', s: cs },
                    { v: step.isKeyPoint ? '\u2605' : '', s: st.cc }, { v: '', s: st.cc },
                    { v: sanitizeCellValue(step.keyPointReason), s: cs }, { v: '', s: cs },
                ]);
                merges.push({ s: { r: rowIdx, c: 1 }, e: { r: rowIdx, c: 3 } }, { s: { r: rowIdx, c: 4 }, e: { r: rowIdx, c: 5 } }, { s: { r: rowIdx, c: 6 }, e: { r: rowIdx, c: 7 } });
            }
            rows.push(Array(TC).fill(''));
        }

        // Visual aids — text placeholders (xlsx-js-style cannot embed images)
        if (sheet.visualAids.length > 0) {
            const vaIdx = rows.length;
            const vaHdr: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.section }));
            vaHdr[0] = { v: 'AYUDAS VISUALES', s: st.section };
            rows.push(vaHdr); merges.push({ s: { r: vaIdx, c: 0 }, e: { r: vaIdx, c: TC - 1 } });
            for (const va of sheet.visualAids) {
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

        // Quality checks
        if (sheet.qualityChecks.length > 0) {
            const qcIdx = rows.length;
            const qcHdr: any[] = Array(TC).fill(null).map(() => ({ v: '', s: st.greenSec }));
            qcHdr[0] = { v: 'CICLO DE CONTROL', s: st.greenSec };
            rows.push(qcHdr); merges.push({ s: { r: qcIdx, c: 0 }, e: { r: qcIdx, c: TC - 1 } });
            rows.push(['Nro', 'Caracteristica', 'Especificacion', 'Metodo', 'Frecuencia', 'CC/SC', 'Reaccion', 'Registro'].map(h => ({ v: h, s: st.colHdr })));
            for (let i = 0; i < sheet.qualityChecks.length; i++) {
                const qc = sheet.qualityChecks[i];
                // Truncate reaction plan to 120 chars for readability
                const reaction = String(qc.reactionAction || '');
                const truncReaction = reaction.length > 120 ? reaction.substring(0, 117) + '...' : reaction;
                rows.push([
                    { v: i + 1, s: st.cc },
                    { v: sanitizeCellValue(qc.characteristic), s: st.cell },
                    { v: sanitizeCellValue(qc.specification), s: st.cell },
                    { v: sanitizeCellValue(qc.controlMethod), s: st.cell },
                    { v: sanitizeCellValue(qc.frequency), s: st.cc },
                    { v: sanitizeCellValue(qc.specialCharSymbol), s: ccStyle(qc.specialCharSymbol) },
                    { v: sanitizeCellValue(truncReaction), s: st.cell },
                    { v: sanitizeCellValue(qc.registro), s: st.cell },
                ]);
            }
        }

        const rawCw = [8, 22, 14, 14, 12, 8, 18, 14];
        const { rows: oR, merges: oM, cw: oC } = applyB2(rows, merges, rawCw);
        const wsOut = XLSX.utils.aoa_to_sheet(oR);
        wsOut['!cols'] = oC.map(w => ({ wch: w }));
        wsOut['!merges'] = oM;
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
