/**
 * APQP Package Export
 *
 * Generates a single Excel file with PFD + AMFE + CP + HO sheets.
 * Reuses buildControlPlanWorkbook() and buildAmfeCompletoWorkbook().
 *
 * Company standard: all sheets start at B2 (1 empty row + 1 empty column).
 * HO sheets use ExcelJS (dynamic import) for visual-aid image embedding.
 */

import XLSX from 'xlsx-js-style';
import type { PfdDocument, PfdStepType } from '../pfd/pfdTypes';
import { PFD_STEP_TYPES } from '../pfd/pfdTypes';
import type { AmfeDocument } from '../amfe/amfeTypes';
import { buildAmfeCompletoWorkbook } from '../amfe/amfeExcelExport';
import type { ControlPlanDocument } from '../controlPlan/controlPlanTypes';
import { buildControlPlanWorkbook } from '../controlPlan/controlPlanExcelExport';
import type { HoDocument, HojaOperacion } from '../hojaOperaciones/hojaOperacionesTypes';
import { PPE_CATALOG } from '../hojaOperaciones/hojaOperacionesTypes';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';
import { sanitizeFilename } from '../../utils/filenameSanitization';
import { downloadWorkbook, downloadExcelJSWorkbook } from '../../utils/excel';

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

    for (const s of pfd.steps) {
        const sym = STEP_LABELS[s.stepType] || s.stepType;
        const ng = NG_LABELS[s.rejectDisposition] || '';
        const pCC = s.productSpecialChar !== 'none' ? s.productSpecialChar : '';
        const prCC = s.processSpecialChar !== 'none' ? s.processSpecialChar : '';
        rows.push([
            { v: sanitizeCellValue(s.stepNumber), s: st.cc },
            { v: sanitizeCellValue(sym), s: st.cc },
            { v: sanitizeCellValue(s.description), s: st.cell },
            { v: sanitizeCellValue(s.machineDeviceTool), s: st.cell },
            { v: sanitizeCellValue(s.productCharacteristic), s: st.cell },
            { v: sanitizeCellValue(pCC), s: ccStyle(pCC) },
            { v: sanitizeCellValue(s.processCharacteristic), s: st.cell },
            { v: sanitizeCellValue(prCC), s: ccStyle(prCC) },
            { v: sanitizeCellValue(ng), s: s.rejectDisposition !== 'none' ? ngStyle(s.rejectDisposition) : st.cc },
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
// ExcelJS HO SHEET (images + B2 offset + EPP ISO names)
// ============================================================================

const EJB = { top: { style: 'thin' as const, color: { argb: 'FF000000' } }, bottom: { style: 'thin' as const, color: { argb: 'FF000000' } }, left: { style: 'thin' as const, color: { argb: 'FF000000' } }, right: { style: 'thin' as const, color: { argb: 'FF000000' } } };
const ej = {
    sec: { font: { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1E3A5F' } }, alignment: { horizontal: 'center' as const, vertical: 'middle' as const }, border: EJB },
    mL:  { font: { bold: true, size: 10, name: 'Arial' }, fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF2F2F2' } }, border: EJB },
    mV:  { font: { size: 10, name: 'Arial' }, border: EJB },
    cH:  { font: { bold: true, size: 9, name: 'Arial' }, fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9E2F3' } }, alignment: { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true }, border: EJB },
    cl:  { font: { size: 9, name: 'Arial' }, alignment: { vertical: 'top' as const, wrapText: true }, border: EJB },
    cC:  { font: { size: 9, name: 'Arial' }, alignment: { horizontal: 'center' as const, vertical: 'middle' as const }, border: EJB },
    kp:  { font: { bold: true, size: 9, name: 'Arial' }, fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFEB9C' } }, alignment: { vertical: 'top' as const, wrapText: true }, border: EJB },
    gH:  { font: { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF2E7D32' } }, alignment: { horizontal: 'center' as const, vertical: 'middle' as const }, border: EJB },
};

type EjsWb = import('exceljs').Workbook;
function eS(ws: any, r: number, c: number, v: any, s: any) { const cell = ws.getCell(r, c); cell.value = v; if (s.font) cell.font = s.font; if (s.fill) cell.fill = s.fill; if (s.alignment) cell.alignment = s.alignment; if (s.border) cell.border = s.border; }
function eM(ws: any, r: number, c1: number, c2: number, v: any, s: any) { ws.mergeCells(r, c1, r, c2); eS(ws, r, c1, v, s); }

function addHoSheet(wb: EjsWb, ho: HojaOperacion, name: string): void {
    const ws = wb.addWorksheet(name);
    const B = 2, C = 8;
    ws.columns = [{ width: 3 }, { width: 10 }, { width: 24 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 10 }, { width: 20 }, { width: 16 }];
    let r = 2;
    eM(ws, r, B, B + C - 1, `HOJA DE OPERACIONES \u2014 ${ho.operationName}`, ej.sec); r++;
    for (const [l, v] of [['Operacion', `${ho.operationNumber} \u2014 ${ho.operationName}`], ['HO Nro.', ho.hoNumber], ['Sector', ho.sector], ['Puesto', ho.puestoNumber], ['Modelo', ho.vehicleModel], ['Revision', ho.revision]] as [string, string][]) {
        ws.mergeCells(r, B, r, B + 1); eS(ws, r, B, l, ej.mL);
        ws.mergeCells(r, B + 2, r, B + C - 1); eS(ws, r, B + 2, String(sanitizeCellValue(v)), ej.mV); r++;
    }
    r++;
    if (ho.safetyElements.length > 0) {
        eM(ws, r, B, B + C - 1, 'ELEMENTOS DE SEGURIDAD (EPP)', ej.sec); r++;
        const labels = ho.safetyElements.map(id => { const p = PPE_CATALOG.find(x => x.id === id); return p ? p.label : id; });
        eM(ws, r, B, B + C - 1, labels.join('\n'), ej.cl);
        ws.getRow(r).height = Math.max(18, labels.length * 14); r++; r++;
    }
    if (ho.steps.length > 0) {
        eM(ws, r, B, B + C - 1, 'DESCRIPCION DE LA OPERACION', ej.sec); r++;
        eS(ws, r, B, 'Nro', ej.cH);
        ws.mergeCells(r, B + 1, r, B + 3); eS(ws, r, B + 1, 'Descripcion', ej.cH);
        ws.mergeCells(r, B + 4, r, B + 5); eS(ws, r, B + 4, 'Punto Clave', ej.cH);
        ws.mergeCells(r, B + 6, r, B + 7); eS(ws, r, B + 6, 'Razon', ej.cH); r++;
        for (const step of ho.steps) {
            const ss = step.isKeyPoint ? ej.kp : ej.cl;
            eS(ws, r, B, step.stepNumber, ej.cC);
            ws.mergeCells(r, B + 1, r, B + 3); eS(ws, r, B + 1, String(sanitizeCellValue(step.description)), ss);
            ws.mergeCells(r, B + 4, r, B + 5); eS(ws, r, B + 4, step.isKeyPoint ? '\u2605' : '', ej.cC);
            ws.mergeCells(r, B + 6, r, B + 7); eS(ws, r, B + 6, String(sanitizeCellValue(step.keyPointReason)), ss);
            if (step.visualAidId) {
                const va = ho.visualAids.find(v => v.id === step.visualAidId);
                if (va?.imageData) {
                    try {
                        const b64 = va.imageData.replace(/^data:image\/\w+;base64,/, '');
                        const ext = va.imageData.startsWith('data:image/jpeg') ? 'jpeg' as const : 'png' as const;
                        const imgId = wb.addImage({ base64: b64, extension: ext });
                        ws.addImage(imgId, { tl: { col: B + C - 0.5, row: r - 1 } as any, ext: { width: 180, height: 120 } });
                        ws.getRow(r).height = Math.max(ws.getRow(r).height || 18, 95);
                    } catch { /* skip */ }
                }
            }
            r++;
        }
        r++;
    }
    const unlinked = ho.visualAids.filter(va => va.imageData && !ho.steps.some(s => s.visualAidId === va.id));
    if (unlinked.length > 0) {
        eM(ws, r, B, B + C - 1, 'AYUDAS VISUALES', ej.sec); r++;
        for (const va of unlinked) {
            try {
                const b64 = va.imageData.replace(/^data:image\/\w+;base64,/, '');
                const ext = va.imageData.startsWith('data:image/jpeg') ? 'jpeg' as const : 'png' as const;
                const imgId = wb.addImage({ base64: b64, extension: ext });
                ws.addImage(imgId, { tl: { col: B - 1, row: r - 1 } as any, ext: { width: 300, height: 200 } });
                ws.getRow(r).height = 160; r++;
                if (va.caption) { eM(ws, r, B, B + C - 1, va.caption, { font: { size: 8, name: 'Arial', italic: true, color: { argb: 'FF808080' } } }); r++; }
            } catch { /* skip */ }
        }
        r++;
    }
    if (ho.qualityChecks.length > 0) {
        eM(ws, r, B, B + C - 1, 'CICLO DE CONTROL', ej.gH); r++;
        for (const [i, h] of ['Nro', 'Caracteristica', 'Especificacion', 'Metodo', 'Frecuencia', 'CC/SC', 'Reaccion', 'Registro'].entries()) eS(ws, r, B + i, h, ej.cH);
        r++;
        for (let i = 0; i < ho.qualityChecks.length; i++) {
            const q = ho.qualityChecks[i];
            eS(ws, r, B, i + 1, ej.cC); eS(ws, r, B + 1, String(sanitizeCellValue(q.characteristic)), ej.cl);
            eS(ws, r, B + 2, String(sanitizeCellValue(q.specification)), ej.cl); eS(ws, r, B + 3, String(sanitizeCellValue(q.controlMethod)), ej.cl);
            eS(ws, r, B + 4, String(sanitizeCellValue(q.frequency)), ej.cC); eS(ws, r, B + 5, String(sanitizeCellValue(q.specialCharSymbol)), ej.cC);
            eS(ws, r, B + 6, String(sanitizeCellValue(q.reactionAction)), ej.cl); eS(ws, r, B + 7, String(sanitizeCellValue(q.registro)), ej.cl);
            r++;
        }
    }
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/** Build xlsx-js-style portion (Portada + Flujograma + AMFE + CP) with B2 offset. */
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
    return wb;
}

/** Export APQP package — async hybrid (xlsx-js-style + ExcelJS for HO with images). */
export async function exportApqpPackage(data: ApqpPackageData, options: ApqpExportOptions): Promise<void> {
    const safeName = sanitizeFilename(data.familyName || 'Paquete_APQP', { allowSpaces: true });
    const fileName = `Paquete APQP - ${safeName}.xlsx`;
    const wb = buildApqpPackageWorkbook(data, options);
    const needsHo = options.includeHo && data.ho && data.ho.sheets.length > 0;

    if (needsHo) {
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
        const ExcelJS = (await import('exceljs')).default;
        const ejsWb = new ExcelJS.Workbook();
        await ejsWb.xlsx.load(buf);
        const names = hoSheetNames(data.ho!);
        for (let i = 0; i < data.ho!.sheets.length; i++) addHoSheet(ejsWb, data.ho!.sheets[i], names[i]);
        await downloadExcelJSWorkbook(ejsWb, fileName);
    } else {
        downloadWorkbook(wb, fileName);
    }
}
