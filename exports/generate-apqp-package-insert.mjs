/**
 * Generate APQP Package XLSX for "Insert Patagonia" product family.
 *
 * Connects to Supabase, loads PFD/AMFE/CP master documents,
 * builds a single multi-sheet workbook reusing the same logic as
 * apqpPackageExport.ts (Portada + Flujograma + AMFE VDA + Plan de Control).
 *
 * Run: node exports/generate-apqp-package-insert.mjs
 */

import { initSupabase, selectSql, close } from '../scripts/supabaseHelper.mjs';
import XLSX from 'xlsx-js-style';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ============================================================================
// DATA LOADERS
// ============================================================================

async function findInsertFamily() {
    const rows = await selectSql(`SELECT * FROM product_families WHERE name LIKE '%Insert Patagonia%' AND active = 1`);
    if (rows.length === 0) throw new Error('Insert Patagonia family not found');
    console.log(`  Family: "${rows[0].name}" (id=${rows[0].id})`);
    return rows[0];
}

async function findMasterDocs(familyId) {
    const rows = await selectSql(`SELECT * FROM family_documents WHERE family_id = ${familyId} AND is_master = 1 ORDER BY module`);
    console.log(`  Found ${rows.length} master documents:`);
    for (const r of rows) console.log(`    - ${r.module}: document_id=${r.document_id}`);
    return rows;
}

async function findFamilyMembers(familyId) {
    return selectSql(`SELECT * FROM product_family_members WHERE family_id = ${familyId} ORDER BY is_primary DESC`);
}

async function loadDoc(table, docId, label) {
    const rows = await selectSql(`SELECT id, data FROM ${table} WHERE id = '${docId}'`);
    if (rows.length === 0) throw new Error(`${label} document ${docId} not found`);
    return typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
}

// ============================================================================
// SANITIZE (replicated from utils/sanitizeCellValue.ts)
// ============================================================================

function sanitizeCellValue(value) {
    if (value == null) return '';
    if (typeof value === 'number') return value;
    let s = String(value);
    if (s.length > 0 && '=@+-\t\r\n'.includes(s[0])) s = "'" + s;
    if (s.length > 32767) s = s.substring(0, 32767);
    return s;
}

// ============================================================================
// XLSX-JS-STYLE STYLES (matching apqpPackageExport.ts)
// ============================================================================

const BORDER = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
};

const st = {
    title:     { font: { bold: true, sz: 18, name: 'Arial', color: { rgb: '1E3A5F' } }, alignment: { horizontal: 'center', vertical: 'center' } },
    subtitle:  { font: { bold: true, sz: 12, name: 'Arial', color: { rgb: '4472C4' } }, alignment: { horizontal: 'center', vertical: 'center' } },
    metaLabel: { font: { bold: true, sz: 10, name: 'Arial' }, fill: { fgColor: { rgb: 'F2F2F2' } }, border: BORDER, alignment: { vertical: 'center' } },
    metaValue: { font: { sz: 10, name: 'Arial' }, border: BORDER, alignment: { vertical: 'center' } },
    section:   { font: { bold: true, sz: 10, name: 'Arial', color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E3A5F' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: BORDER },
    colHdr:    { font: { bold: true, sz: 9, name: 'Arial' }, fill: { fgColor: { rgb: 'D9E2F3' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: BORDER },
    cell:      { font: { sz: 9, name: 'Arial' }, alignment: { vertical: 'top', wrapText: true }, border: BORDER },
    cc:        { font: { sz: 9, name: 'Arial' }, alignment: { horizontal: 'center', vertical: 'center' }, border: BORDER },
    tocItem:   { font: { sz: 10, name: 'Arial' }, border: BORDER, alignment: { vertical: 'center' } },
    tocNum:    { font: { bold: true, sz: 10, name: 'Arial', color: { rgb: '4472C4' } }, border: BORDER, alignment: { horizontal: 'center', vertical: 'center' } },
    ccBadge:   { font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C0006' } }, fill: { fgColor: { rgb: 'FFC7CE' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: BORDER },
    scBadge:   { font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C6500' } }, fill: { fgColor: { rgb: 'FFEB9C' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: BORDER },
    ngScrap:   { font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C0006' } }, fill: { fgColor: { rgb: 'FFC7CE' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: BORDER },
    ngRework:  { font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C6500' } }, fill: { fgColor: { rgb: 'FFEB9C' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: BORDER },
    ngSort:    { font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '1D4ED8' } }, fill: { fgColor: { rgb: 'DBEAFE' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: BORDER },
    subStep:   { font: { sz: 9, name: 'Arial', color: { rgb: '555555' } }, fill: { fgColor: { rgb: 'F5F5F5' } }, alignment: { vertical: 'top', wrapText: true }, border: BORDER },
    subCC:     { font: { sz: 9, name: 'Arial', color: { rgb: '555555' } }, fill: { fgColor: { rgb: 'F5F5F5' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: BORDER },
    branchLbl: { font: { bold: true, sz: 9, name: 'Arial', color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '7B61FF' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: BORDER },
    // Flujograma decision-row style
    decisionRow: { font: { sz: 9, name: 'Arial', color: { rgb: '6B21A8' } }, fill: { fgColor: { rgb: 'F3E8FF' } }, alignment: { vertical: 'top', wrapText: true }, border: BORDER },
    decisionCC:  { font: { sz: 9, name: 'Arial', color: { rgb: '6B21A8' } }, fill: { fgColor: { rgb: 'F3E8FF' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: BORDER },
};

function ccStyle(v) { const u = (v || '').toUpperCase().trim(); return u === 'CC' ? st.ccBadge : u === 'SC' ? st.scBadge : st.cc; }
function ngStyle(d) { return d === 'scrap' ? st.ngScrap : d === 'rework' ? st.ngRework : d === 'sort' ? st.ngSort : st.cc; }

// ============================================================================
// CONSTANTS
// ============================================================================

const PFD_STEP_TYPES = [
    { value: 'operation',  label: 'Operación' },
    { value: 'transport',  label: 'Transporte' },
    { value: 'inspection', label: 'Inspección' },
    { value: 'storage',    label: 'Almacenamiento' },
    { value: 'delay',      label: 'Demora / Espera' },
    { value: 'decision',   label: 'Decisión' },
    { value: 'combined',   label: 'Op. + Inspección' },
];
const STEP_LABELS = {};
for (const t of PFD_STEP_TYPES) STEP_LABELS[t.value] = t.label;
const NG_LABELS = { none: '', rework: 'Retrabajo', scrap: 'Descarte', sort: 'Seleccion' };

const ASME_SYMBOLS = {
    operation: '\u25EF', transport: '\u21E8', inspection: '\u25FB', storage: '\u25BD',
    delay: 'D', decision: '\u25C7', combined: '\u25EF\u25FB',
};

function buildNgDescription(s) {
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

function build4MText(s) {
    const machine = s.machineDeviceTool?.trim();
    return `M: ${machine || '\u2014'}\nMO: ${s.isExternalProcess ? 'Proveedor externo' : 'Operador'}\nMat: \u2014\nMA: \u2014`;
}

const OFF_C = 2;
const OFF_R = 8;

// ============================================================================
// HELPERS (matching apqpPackageExport.ts)
// ============================================================================

function applyB2(rows, merges, cw) {
    const mc = rows.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0) + 1;
    return {
        rows: [Array(mc).fill(''), ...rows.map(r => ['', ...(Array.isArray(r) ? r : [])])],
        merges: merges.map(m => ({ s: { r: m.s.r + 1, c: m.s.c + 1 }, e: { r: m.e.r + 1, c: m.e.c + 1 } })),
        cw: [OFF_C, ...cw],
    };
}

function shiftWorksheet(ws) {
    const n = {};
    for (const k in ws) {
        if (k.startsWith('!')) continue;
        const c = XLSX.utils.decode_cell(k);
        c.r++; c.c++;
        n[XLSX.utils.encode_cell(c)] = ws[k];
    }
    if (ws['!ref']) { const r = XLSX.utils.decode_range(ws['!ref']); n['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r.e.r + 1, c: r.e.c + 1 } }); }
    if (ws['!merges']) n['!merges'] = ws['!merges'].map(m => ({ s: { r: m.s.r + 1, c: m.s.c + 1 }, e: { r: m.e.r + 1, c: m.e.c + 1 } }));
    if (ws['!cols']) n['!cols'] = [{ wch: OFF_C }, ...ws['!cols']];
    if (ws['!rows']) n['!rows'] = [{ hpt: OFF_R }, ...ws['!rows']];
    if (ws['!freeze']) { const y = ws['!freeze'].ySplit || 0; n['!freeze'] = { xSplit: 0, ySplit: y + 1, topLeftCell: `A${y + 2}` }; }
    if (ws['!autofilter']) { const ref = ws['!autofilter'].ref; if (ref) { const rng = XLSX.utils.decode_range(ref); rng.s.r++; rng.s.c++; rng.e.r++; rng.e.c++; n['!autofilter'] = { ref: XLSX.utils.encode_range(rng) }; } }
    return n;
}

// ============================================================================
// PORTADA (matching apqpPackageExport.ts buildPortadaSheet)
// ============================================================================

function buildPortadaSheet(wb, data, opts, tocNames) {
    const rows = [], merges = [], TC = 6, er = () => Array(TC).fill('');
    rows.push(er(), er());
    const tR = Array(TC).fill(null).map(() => ({ v: '', s: st.title }));
    tR[0] = { v: 'PAQUETE APQP', s: st.title }; rows.push(tR); merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: TC - 1 } });
    const fR = Array(TC).fill(null).map(() => ({ v: '', s: st.subtitle }));
    fR[0] = { v: data.familyName, s: st.subtitle }; rows.push(fR); merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: TC - 1 } });
    rows.push(er());
    for (const [l, v] of [['Familia de Producto', data.familyName], ['Numeros de Parte', data.partNumbers.join(', ') || '\u2014'], ['Cliente', data.client || '\u2014'], ['Fecha', data.date], ['Revision', opts.revision || data.revision || 'A'], ['Equipo', data.team || '\u2014']]) {
        const ri = rows.length, row = Array(TC).fill(null).map(() => ({ v: '', s: { border: BORDER } }));
        row[0] = { v: l, s: st.metaLabel }; row[1] = { v: '', s: st.metaLabel }; row[2] = { v: sanitizeCellValue(v), s: st.metaValue };
        for (let c = 3; c < TC; c++) row[c] = { v: '', s: st.metaValue };
        merges.push({ s: { r: ri, c: 0 }, e: { r: ri, c: 1 } }, { s: { r: ri, c: 2 }, e: { r: ri, c: TC - 1 } }); rows.push(row);
    }
    rows.push(er(), er());
    const ti = rows.length, tH = Array(TC).fill(null).map(() => ({ v: '', s: st.section }));
    tH[0] = { v: 'CONTENIDO DEL PAQUETE', s: st.section }; rows.push(tH); merges.push({ s: { r: ti, c: 0 }, e: { r: ti, c: TC - 1 } });
    for (let i = 0; i < tocNames.length; i++) {
        const ri = rows.length, row = Array(TC).fill(null).map(() => ({ v: '', s: st.tocItem }));
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
// FLUJOGRAMA (matching apqpPackageExport.ts buildFlujogramaSheet)
// ============================================================================

function buildFlujogramaSheet(wb, pfd) {
    const rows = [], merges = [];
    const hdrs = ['Nro. Op.', 'S\u00EDmbolo', 'Descripci\u00F3n', 'Elementos de Trabajo (4M)', 'Caract. Producto', 'CC/SC Prod.', 'Caract. Proceso', 'CC/SC Proc.', 'Ruteo / Disposici\u00F3n NG'];
    const cw = [10, 16, 35, 30, 22, 10, 22, 10, 45]; const TC = hdrs.length;

    const tR = Array(TC).fill(null).map(() => ({ v: '', s: st.title }));
    tR[0] = { v: 'DIAGRAMA DE FLUJO DEL PROCESO', s: { ...st.title, font: { ...st.title.font, sz: 14 } } };
    rows.push(tR); merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: TC - 1 } });
    for (const [l, v] of [['Nro. Pieza', pfd.header.partNumber], ['Pieza', pfd.header.partName], ['Revision', pfd.header.revisionLevel]]) {
        const ri = rows.length, row = Array(TC).fill(null).map(() => ({ v: '', s: { border: BORDER } }));
        row[0] = { v: l, s: st.metaLabel }; row[1] = { v: '', s: st.metaLabel }; row[2] = { v: sanitizeCellValue(v), s: st.metaValue };
        for (let c = 3; c < TC; c++) row[c] = { v: '', s: st.metaValue };
        merges.push({ s: { r: ri, c: 0 }, e: { r: ri, c: 1 } }, { s: { r: ri, c: 2 }, e: { r: ri, c: TC - 1 } }); rows.push(row);
    }
    rows.push(Array(TC).fill(''));
    rows.push(hdrs.map(h => ({ v: h, s: st.colHdr }))); const dsr = rows.length;

    let lastBranch = '';
    for (let si = 0; si < pfd.steps.length; si++) {
        const s = pfd.steps[si];
        if (s.branchId && s.branchId !== lastBranch) {
            const brLabel = s.branchLabel || `RAMA ${s.branchId}`;
            const brIdx = rows.length;
            const brRow = Array(TC).fill(null).map(() => ({ v: '', s: st.branchLbl }));
            brRow[0] = { v: brLabel, s: st.branchLbl };
            rows.push(brRow); merges.push({ s: { r: brIdx, c: 0 }, e: { r: brIdx, c: TC - 1 } });
        }
        lastBranch = s.branchId || '';

        const symUnicode = ASME_SYMBOLS[s.stepType] || '';
        const symLabel = STEP_LABELS[s.stepType] || s.stepType;
        const sym = symUnicode ? `${symUnicode} ${symLabel}` : symLabel;
        const ngText = buildNgDescription(s);
        const fourM = build4MText(s);

        const pCC = s.productSpecialChar !== 'none' ? s.productSpecialChar : '';
        const prCC = s.processSpecialChar !== 'none' ? s.processSpecialChar : '';
        const isSub = s.stepType === 'transport' || s.stepType === 'storage' || s.stepType === 'delay';
        const cellS = isSub ? st.subStep : st.cell;
        const ccS = isSub ? st.subCC : st.cc;
        const desc = isSub ? `  ${String(s.description)}` : String(s.description);
        rows.push([
            { v: sanitizeCellValue(s.stepNumber), s: ccS },
            { v: sanitizeCellValue(sym), s: ccS },
            { v: sanitizeCellValue(desc), s: cellS },
            { v: sanitizeCellValue(fourM), s: { ...cellS, alignment: { vertical: 'top', wrapText: true } } },
            { v: sanitizeCellValue(s.productCharacteristic), s: cellS },
            { v: sanitizeCellValue(pCC), s: pCC ? ccStyle(pCC) : ccS },
            { v: sanitizeCellValue(s.processCharacteristic), s: cellS },
            { v: sanitizeCellValue(prCC), s: prCC ? ccStyle(prCC) : ccS },
            { v: sanitizeCellValue(ngText), s: s.rejectDisposition !== 'none' ? ngStyle(s.rejectDisposition) : ccS },
        ]);

        // Auto-insert decision row after inspection/combined with NG disposition
        if ((s.stepType === 'inspection' || s.stepType === 'combined') && s.rejectDisposition !== 'none') {
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
    const rh = rows.map((row, i) => {
        if (i === 0) return 30;
        if (i >= dsr && Array.isArray(row)) {
            const descLen = String(row[2]?.v || '').length;
            const fourMStr = String(row[3]?.v || '');
            const fourMLines = fourMStr.split('\n').length;
            const fourMLen = Math.max(fourMStr.length, fourMLines * 30);
            const ngLen = String(row[8]?.v || '').length;
            const maxLen = Math.max(descLen, fourMLen, Math.ceil(ngLen * 30 / 45));
            return Math.min(80, Math.max(15, Math.max(1, Math.ceil(maxLen / 30)) * 13));
        }
        return 18;
    });
    const { rows: oR, merges: oM, cw: oC } = applyB2(rows, merges, cw);
    const ws = XLSX.utils.aoa_to_sheet(oR); ws['!cols'] = oC.map(w => ({ wch: w })); ws['!merges'] = oM;
    ws['!rows'] = [{ hpt: OFF_R }, ...rh.map(h => ({ hpt: h }))];
    ws['!freeze'] = { xSplit: 0, ySplit: dsr + 1, topLeftCell: `A${dsr + 2}` };
    XLSX.utils.book_append_sheet(wb, ws, 'Flujograma');
}

// ============================================================================
// AMFE BUILDER (reused from generate-insert-exports.mjs — buildAmfeWorkbook)
// ============================================================================

const amfeSt = {
    title: { font: { bold: true, sz: 12, name: 'Arial' }, alignment: { horizontal: 'center', vertical: 'center' } },
    formRef: { font: { sz: 8, color: { rgb: '808080' }, name: 'Arial' }, alignment: { horizontal: 'right' } },
    metaLabel: { font: { bold: true, sz: 9, name: 'Arial' }, fill: { fgColor: { rgb: 'F2F2F2' } }, border: BORDER },
    metaValue: { font: { sz: 9, name: 'Arial' }, border: BORDER },
    groupHeader: { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9, name: 'Arial' }, fill: { fgColor: { rgb: '4472C4' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: BORDER },
    colHeader: { font: { bold: true, sz: 8, name: 'Arial' }, fill: { fgColor: { rgb: 'D9E2F3' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: BORDER },
    cell: { font: { sz: 8, name: 'Arial' }, alignment: { vertical: 'top', wrapText: true }, border: BORDER },
    cellCenter: { font: { sz: 8, name: 'Arial' }, alignment: { horizontal: 'center', vertical: 'center' }, border: BORDER },
    cellMerged: { font: { sz: 8, name: 'Arial' }, alignment: { vertical: 'center', wrapText: true }, border: BORDER },
    apH: { font: { bold: true, sz: 8, name: 'Arial', color: { rgb: '9C0006' } }, fill: { fgColor: { rgb: 'FFC7CE' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: BORDER },
    apM: { font: { bold: true, sz: 8, name: 'Arial', color: { rgb: '9C6500' } }, fill: { fgColor: { rgb: 'FFEB9C' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: BORDER },
    apL: { font: { sz: 8, name: 'Arial', color: { rgb: '006100' } }, fill: { fgColor: { rgb: 'C6EFCE' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: BORDER },
    emptyBorder: { border: BORDER },
};

const WORK_ELEMENT_LABELS = { Machine: 'Maquina', Man: 'Mano de Obra', Material: 'Material', Method: 'Metodo', Environment: 'Medio Ambiente', Measurement: 'Medicion' };
function getApStyle(ap) { return ap === 'H' ? amfeSt.apH : ap === 'M' ? amfeSt.apM : ap === 'L' ? amfeSt.apL : amfeSt.cellCenter; }

const AMFE_COL_GROUPS = [
    { label: 'Analisis de Estructura (Paso 2)', colSpan: 3 },
    { label: 'Analisis Funcional (Paso 3)', colSpan: 3 },
    { label: 'Analisis de Fallas (Paso 4)', colSpan: 3 },
    { label: 'Analisis de Riesgo (Paso 5)', colSpan: 7 },
    { label: 'Optimizacion (Paso 6)', colSpan: 11 },
    { label: '', colSpan: 1 },
];
const AMFE_COL_HEADERS = [
    'Nro. Op.', 'Paso del Proceso', 'Elemento 6M',
    'Func. Item', 'Func. Paso', 'Func. Elem. Trabajo',
    'Efecto de Falla (FE)', 'Modo de Falla (FM)', 'Causa de Falla (FC)',
    'S', 'Control Prevencion (PC)', 'O', 'Control Deteccion (DC)', 'D', 'AP', 'Car. Especiales',
    'Acc. Preventiva', 'Acc. Detectiva', 'Responsable', 'Fecha Obj.',
    'Estado', 'Accion Tomada', 'Fecha Cierre', "S'", "O'", "D'", "AP'",
    'Observaciones',
];
const AMFE_COL_WIDTHS = [8, 20, 18, 22, 22, 22, 25, 22, 22, 5, 20, 4, 20, 4, 5, 10, 22, 22, 14, 11, 11, 22, 11, 4, 4, 4, 5, 18];

function buildFEText(fail) {
    if (!fail) return '';
    const parts = [];
    if (fail.effectLocal) parts.push(`Interno: ${fail.effectLocal}`);
    if (fail.effectNextLevel) parts.push(`Cliente: ${fail.effectNextLevel}`);
    if (fail.effectEndUser) parts.push(`Usr.Final: ${fail.effectEndUser}`);
    return parts.join('\n');
}
function buildCarEspText(c) { const p = []; if (c.specialChar) p.push(c.specialChar); if (c.characteristicNumber) p.push(`#${c.characteristicNumber}`); return p.join(' '); }

function buildAmfeCompletoWorkbook(doc) {
    const wb = XLSX.utils.book_new();
    const totalCols = AMFE_COL_HEADERS.length;
    const h = doc.header;
    const merges = [];
    const metaEnd = Math.min(7, totalCols - 1);
    const splitCol = Math.min(4, Math.floor((metaEnd + 1) / 2));
    let leftLabelEnd = 0;
    { let w = AMFE_COL_WIDTHS[0]; while (w < 16 && leftLabelEnd < splitCol - 2) { leftLabelEnd++; w += AMFE_COL_WIDTHS[leftLabelEnd]; } }
    let rightLabelEnd = splitCol;
    { let w = AMFE_COL_WIDTHS[splitCol]; while (w < 16 && rightLabelEnd < metaEnd - 1) { rightLabelEnd++; w += AMFE_COL_WIDTHS[rightLabelEnd]; } }
    const leftValueStart = leftLabelEnd + 1, leftValueEnd = splitCol - 1;
    const rightValueStart = rightLabelEnd + 1, rightValueEnd = metaEnd;

    const titleRow = Array(totalCols).fill(null).map(() => ({ v: '', s: {} }));
    titleRow[0] = { v: 'AMFE DE PROCESO', s: amfeSt.title };
    for (let i = 1; i <= metaEnd; i++) titleRow[i] = { v: '', s: amfeSt.title };
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: metaEnd } });

    const formRow = Array(totalCols).fill(null).map(() => ({ v: '', s: {} }));
    formRow[0] = { v: 'Formulario I-AC-005.3', s: amfeSt.formRef };
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: metaEnd } });

    const metaPairs = [
        ['AMFE Nro.', h.amfeNumber || '', 'Confidencialidad', h.confidentiality || ''],
        ['Organizacion', h.organization || '', 'Cliente', h.client || ''],
        ['Ubicacion', h.location || '', 'Nro. Pieza', h.partNumber || ''],
        ['Responsable', h.responsible || '', 'Resp. Proceso', h.processResponsible || ''],
        ['Equipo', h.team || '', 'Modelo / Ano', h.modelYear || ''],
        ['Fecha Inicio', h.startDate || '', 'Fecha Rev.', h.revDate || ''],
        ['Revision', h.revision || '', 'Aprobado por', h.approvedBy || ''],
        ['Alcance', h.scope || '', 'Asunto', h.subject || ''],
    ];
    const metaRowsArr = [];
    for (let i = 0; i < metaPairs.length; i++) {
        const [lbl1, val1, lbl2, val2] = metaPairs[i];
        const rowIdx = 2 + i;
        const row = Array(totalCols).fill(null).map(() => ({ v: '', s: {} }));
        row[0] = { v: lbl1, s: amfeSt.metaLabel }; for (let c = 1; c <= leftLabelEnd; c++) row[c] = { v: '', s: amfeSt.metaLabel };
        if (leftLabelEnd > 0) merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: leftLabelEnd } });
        row[leftValueStart] = { v: sanitizeCellValue(val1), s: amfeSt.metaValue }; for (let c = leftValueStart + 1; c <= leftValueEnd; c++) row[c] = { v: '', s: amfeSt.metaValue };
        if (leftValueEnd > leftValueStart) merges.push({ s: { r: rowIdx, c: leftValueStart }, e: { r: rowIdx, c: leftValueEnd } });
        row[splitCol] = { v: lbl2, s: amfeSt.metaLabel }; for (let c = splitCol + 1; c <= rightLabelEnd; c++) row[c] = { v: '', s: amfeSt.metaLabel };
        if (rightLabelEnd > splitCol) merges.push({ s: { r: rowIdx, c: splitCol }, e: { r: rowIdx, c: rightLabelEnd } });
        if (rightValueStart <= rightValueEnd) {
            row[rightValueStart] = { v: sanitizeCellValue(val2), s: amfeSt.metaValue }; for (let c = rightValueStart + 1; c <= rightValueEnd; c++) row[c] = { v: '', s: amfeSt.metaValue };
            if (rightValueEnd > rightValueStart) merges.push({ s: { r: rowIdx, c: rightValueStart }, e: { r: rowIdx, c: rightValueEnd } });
        }
        metaRowsArr.push(row);
    }
    const emptyRow = Array(totalCols).fill('');
    const rows = [titleRow, formRow, ...metaRowsArr, emptyRow];

    const groupRow = [];
    for (const group of AMFE_COL_GROUPS) { groupRow.push({ v: group.label, s: amfeSt.groupHeader }); for (let i = 1; i < group.colSpan; i++) groupRow.push({ v: '', s: amfeSt.groupHeader }); }
    rows.push(groupRow); const groupRowIdx = rows.length - 1;
    let colOffset = 0;
    for (const group of AMFE_COL_GROUPS) { if (group.colSpan > 1) merges.push({ s: { r: groupRowIdx, c: colOffset }, e: { r: groupRowIdx, c: colOffset + group.colSpan - 1 } }); colOffset += group.colSpan; }
    rows.push(AMFE_COL_HEADERS.map(label => ({ v: label, s: amfeSt.colHeader })));
    const dataStartRow = rows.length;

    const dataRows = [], dataMerges = [];
    for (const op of doc.operations) {
        const opStartRow = dataRows.length; let opRowCount = 0;
        const weList = op.workElements.length > 0 ? op.workElements : [null];
        for (const we of weList) {
            const weStartRow = dataRows.length; let weRowCount = 0;
            const funcList = we && we.functions.length > 0 ? we.functions : [null];
            for (const func of funcList) {
                const funcStartRow = dataRows.length; let funcRowCount = 0;
                const failList = func && func.failures.length > 0 ? func.failures : [null];
                for (const fail of failList) {
                    const failStartRow = dataRows.length; let failRowCount = 0;
                    const causeList = fail && fail.causes.length > 0 ? fail.causes : [null];
                    for (const cause of causeList) {
                        const c = cause || {};
                        dataRows.push([
                            { v: sanitizeCellValue(op.opNumber), s: amfeSt.cellMerged },
                            { v: sanitizeCellValue(op.name), s: amfeSt.cellMerged },
                            { v: sanitizeCellValue(we ? `${WORK_ELEMENT_LABELS[we.type] || we.type}: ${we.name}` : ''), s: amfeSt.cellMerged },
                            { v: sanitizeCellValue(op.focusElementFunction || ''), s: amfeSt.cellMerged },
                            { v: sanitizeCellValue(op.operationFunction || ''), s: amfeSt.cellMerged },
                            { v: sanitizeCellValue(func ? func.description : ''), s: amfeSt.cellMerged },
                            { v: sanitizeCellValue(buildFEText(fail)), s: amfeSt.cell },
                            { v: sanitizeCellValue(fail?.description || ''), s: amfeSt.cell },
                            { v: sanitizeCellValue(c.cause || ''), s: amfeSt.cell },
                            { v: fail?.severity ?? '', s: amfeSt.cellCenter },
                            { v: sanitizeCellValue(c.preventionControl || ''), s: amfeSt.cell },
                            { v: c.occurrence ?? '', s: amfeSt.cellCenter },
                            { v: sanitizeCellValue(c.detectionControl || ''), s: amfeSt.cell },
                            { v: c.detection ?? '', s: amfeSt.cellCenter },
                            { v: c.ap ?? '', s: getApStyle(String(c.ap || '')) },
                            { v: sanitizeCellValue(buildCarEspText(c)), s: amfeSt.cellCenter },
                            { v: sanitizeCellValue(c.preventionAction || ''), s: amfeSt.cell },
                            { v: sanitizeCellValue(c.detectionAction || ''), s: amfeSt.cell },
                            { v: sanitizeCellValue(c.responsible || ''), s: amfeSt.cell },
                            { v: sanitizeCellValue(c.targetDate || ''), s: amfeSt.cellCenter },
                            { v: sanitizeCellValue(c.status || ''), s: amfeSt.cellCenter },
                            { v: sanitizeCellValue(c.actionTaken || ''), s: amfeSt.cell },
                            { v: sanitizeCellValue(c.completionDate || ''), s: amfeSt.cellCenter },
                            { v: c.severityNew ?? '', s: amfeSt.cellCenter },
                            { v: c.occurrenceNew ?? '', s: amfeSt.cellCenter },
                            { v: c.detectionNew ?? '', s: amfeSt.cellCenter },
                            { v: c.apNew ?? '', s: getApStyle(String(c.apNew || '')) },
                            { v: sanitizeCellValue(c.observations || ''), s: amfeSt.cell },
                        ]);
                        failRowCount++; funcRowCount++; weRowCount++; opRowCount++;
                    }
                    if (failRowCount > 1) { for (const col of [6, 7, 9]) dataMerges.push({ col, startRow: failStartRow, rowSpan: failRowCount }); }
                }
                if (funcRowCount > 1) dataMerges.push({ col: 5, startRow: funcStartRow, rowSpan: funcRowCount });
            }
            if (weRowCount > 1) dataMerges.push({ col: 2, startRow: weStartRow, rowSpan: weRowCount });
        }
        if (opRowCount > 1) { for (const col of [0, 1, 3, 4]) dataMerges.push({ col, startRow: opStartRow, rowSpan: opRowCount }); }
    }
    rows.push(...dataRows);
    for (const dm of dataMerges) merges.push({ s: { r: dataStartRow + dm.startRow, c: dm.col }, e: { r: dataStartRow + dm.startRow + dm.rowSpan - 1, c: dm.col } });
    for (const dm of dataMerges) { for (let r = dm.startRow + 1; r < dm.startRow + dm.rowSpan; r++) { if (dataRows[r] && dataRows[r][dm.col]) dataRows[r][dm.col] = { v: '', s: amfeSt.emptyBorder }; } }
    const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = AMFE_COL_WIDTHS.map(w => ({ wch: w })); ws['!merges'] = merges;
    XLSX.utils.book_append_sheet(wb, ws, 'AMFE');
    return wb;
}

// ============================================================================
// CP BUILDER (reused from generate-insert-exports.mjs — buildCpWorkbook)
// ============================================================================

const cpSt = {
    title: { font: { bold: true, sz: 14, name: 'Arial' }, alignment: { horizontal: 'center', vertical: 'center' }, border: BORDER },
    formRef: { font: { sz: 8, color: { rgb: '808080' }, name: 'Arial' }, alignment: { horizontal: 'left' }, border: BORDER },
    phaseText: { font: { sz: 9, name: 'Arial' }, alignment: { horizontal: 'right' }, border: BORDER },
    metaLabel: { font: { bold: true, sz: 9, name: 'Arial' }, fill: { fgColor: { rgb: 'F2F2F2' } }, border: BORDER },
    metaValue: { font: { sz: 9, name: 'Arial' }, border: BORDER },
    groupHeader: { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9, name: 'Arial' }, fill: { fgColor: { rgb: '4472C4' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: BORDER },
    colHeader: { font: { bold: true, sz: 8, name: 'Arial' }, fill: { fgColor: { rgb: 'D9E2F3' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: BORDER },
    cell: { font: { sz: 9, name: 'Arial' }, alignment: { vertical: 'top', wrapText: true }, border: BORDER },
    cellCenter: { font: { sz: 9, name: 'Arial' }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: BORDER },
    cellMerged: { font: { sz: 9, name: 'Arial' }, alignment: { vertical: 'center', wrapText: true }, border: BORDER },
    ccBadge: { font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C0006' } }, fill: { fgColor: { rgb: 'FFC7CE' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: BORDER },
    scBadge: { font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C6500' } }, fill: { fgColor: { rgb: 'FFEB9C' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: BORDER },
};
const CP_COL_WIDTHS = [12, 25, 20, 10, 22, 22, 12, 23, 20, 13, 13, 20, 23, 17, 16];
const CP_COLUMNS = [
    { key: 'processStepNumber', label: 'Nro. Parte/Proceso' }, { key: 'processDescription', label: 'Descripcion Proceso/Operacion' },
    { key: 'machineDeviceTool', label: 'Maquina/Dispositivo/Herram.' }, { key: 'characteristicNumber', label: 'Nro.' },
    { key: 'productCharacteristic', label: 'Producto' }, { key: 'processCharacteristic', label: 'Proceso' },
    { key: 'specialCharClass', label: 'Clasif. Caract. Esp.' }, { key: 'specification', label: 'Espec./Tolerancia' },
    { key: 'evaluationTechnique', label: 'Tecnica Evaluacion/Medicion' }, { key: 'sampleSize', label: 'Tamano Muestra' },
    { key: 'sampleFrequency', label: 'Frecuencia' }, { key: 'controlMethod', label: 'Metodo Control' },
    { key: 'reactionPlan', label: 'Plan Reaccion' }, { key: 'reactionPlanOwner', label: 'Responsable Reaccion' },
    { key: 'controlProcedure', label: 'Procedimiento/IT' },
];
const CP_COLUMN_GROUPS = [{ label: 'Proceso', colSpan: 3 }, { label: 'Caracteristicas', colSpan: 4 }, { label: 'Metodos', colSpan: 8 }];
const CP_META_PAIRS = [{ lStart: 0, lEnd: 2, vStart: 3, vEnd: 4 }, { lStart: 5, lEnd: 6, vStart: 7, vEnd: 9 }, { lStart: 10, lEnd: 11, vStart: 12, vEnd: 14 }];

function buildCpMetaRow(info, totalCols, rowIdx, merges) {
    const row = Array(totalCols).fill(null).map(() => ({ v: '', s: { border: BORDER } }));
    for (let p = 0; p < 3; p++) {
        const label = info[p * 2], value = info[p * 2 + 1];
        const { lStart, lEnd, vStart, vEnd } = CP_META_PAIRS[p];
        if (label) {
            row[lStart] = { v: label, s: cpSt.metaLabel }; for (let c = lStart + 1; c <= lEnd; c++) row[c] = { v: '', s: cpSt.metaLabel };
            row[vStart] = { v: sanitizeCellValue(value), s: cpSt.metaValue }; for (let c = vStart + 1; c <= vEnd; c++) row[c] = { v: '', s: cpSt.metaValue };
        }
        if (lEnd > lStart) merges.push({ s: { r: rowIdx, c: lStart }, e: { r: rowIdx, c: lEnd } });
        if (vEnd > vStart) merges.push({ s: { r: rowIdx, c: vStart }, e: { r: rowIdx, c: vEnd } });
    }
    return row;
}
function getCpSpecialCharStyle(value) { const u = (value || '').toUpperCase().trim(); return u === 'CC' ? cpSt.ccBadge : u === 'SC' ? cpSt.scBadge : cpSt.cellCenter; }

function buildControlPlanWorkbook(doc) {
    const wb = XLSX.utils.book_new();
    const rows = [], h = doc.header, totalCols = CP_COLUMNS.length, merges = [];
    const titleRow = Array(totalCols).fill(null).map(() => ({ v: '', s: cpSt.title }));
    titleRow[0] = { v: 'PLAN DE CONTROL', s: cpSt.title }; rows.push(titleRow); merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });
    const PHASES = [{ value: 'preLaunch', label: 'Pre-Lanzamiento' }, { value: 'production', label: 'Produccion' }];
    const phaseStr = PHASES.map(p => `${p.value === h.phase ? '☒' : '☐'} ${p.label}`).join('    ');
    const formPhaseRow = Array(totalCols).fill(null).map(() => ({ v: '', s: { border: BORDER } }));
    formPhaseRow[0] = { v: 'Formulario I-AC-005.2', s: cpSt.formRef }; for (let c = 1; c <= 4; c++) formPhaseRow[c] = { v: '', s: cpSt.formRef };
    formPhaseRow[5] = { v: phaseStr, s: cpSt.phaseText }; for (let c = 6; c < totalCols; c++) formPhaseRow[c] = { v: '', s: cpSt.phaseText };
    rows.push(formPhaseRow); merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, { s: { r: 1, c: 5 }, e: { r: 1, c: totalCols - 1 } });
    const headerInfo = [
        ['Nro. Plan de Control', h.controlPlanNumber || '', 'Nro. Pieza', h.partNumber || '', 'Fecha', h.date || ''],
        ['Pieza', h.partName || '', 'Nivel de Cambio', h.latestChangeLevel || '', 'Revision', h.revision || ''],
        ['Organizacion / Planta', h.organization || '', 'Proveedor', h.supplier || '', 'Cod. Proveedor', h.supplierCode || ''],
        ['Contacto / Telefono', h.keyContactPhone || '', 'Cliente', h.client || '', 'Responsable', h.responsible || ''],
        ['Equipo', h.coreTeam || '', 'AMFE Vinculado', h.linkedAmfeProject || '', '', ''],
        ['Aprob. Planta', h.approvedBy || '', 'Aprob. Cliente / Fecha', h.customerApproval || '', 'Otra Aprobacion', h.otherApproval || ''],
    ];
    for (const info of headerInfo) { const ri = rows.length; rows.push(buildCpMetaRow(info, totalCols, ri, merges)); }
    rows.push(Array(totalCols).fill(''));
    const groupRow = [];
    for (const group of CP_COLUMN_GROUPS) { groupRow.push({ v: group.label, s: cpSt.groupHeader }); for (let i = 1; i < group.colSpan; i++) groupRow.push({ v: '', s: cpSt.groupHeader }); }
    rows.push(groupRow); const groupRowIdx = rows.length - 1;
    let colOff = 0;
    for (const group of CP_COLUMN_GROUPS) { if (group.colSpan > 1) merges.push({ s: { r: groupRowIdx, c: colOff }, e: { r: groupRowIdx, c: colOff + group.colSpan - 1 } }); colOff += group.colSpan; }
    rows.push(CP_COLUMNS.map(col => ({ v: col.label, s: cpSt.colHeader })));
    const dataStartIdx = rows.length;
    for (const item of doc.items) {
        rows.push(CP_COLUMNS.map(col => {
            const value = (item[col.key]) || '';
            return col.key === 'specialCharClass' ? { v: sanitizeCellValue(value), s: getCpSpecialCharStyle(value) } : { v: sanitizeCellValue(value), s: cpSt.cell };
        }));
    }
    let i = 0;
    while (i < doc.items.length) {
        const psn = (doc.items[i].processStepNumber || '').trim();
        if (!psn) { i++; continue; }
        let j = i + 1;
        while (j < doc.items.length && (doc.items[j].processStepNumber || '').trim() === psn) j++;
        const span = j - i;
        if (span > 1) {
            for (const col of [0, 1, 2]) {
                merges.push({ s: { r: dataStartIdx + i, c: col }, e: { r: dataStartIdx + j - 1, c: col } });
                rows[dataStartIdx + i][col] = { ...rows[dataStartIdx + i][col], s: cpSt.cellMerged };
                for (let r = 1; r < span; r++) { const ri = dataStartIdx + i + r; if (ri < rows.length) rows[ri][col] = { v: '', s: cpSt.cellMerged }; }
            }
        }
        i = j;
    }
    const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = CP_COL_WIDTHS.map(w => ({ wch: w })); ws['!merges'] = merges;
    XLSX.utils.book_append_sheet(wb, ws, 'Plan de Control');
    return wb;
}

// ============================================================================
// (HO sheets removed — exported individually with ExcelJS for image support)
// ============================================================================

// MAIN PACKAGE BUILDER (matching apqpPackageExport.ts buildApqpPackageWorkbook)
// ============================================================================

function buildApqpPackageWorkbook(data, options) {
    const wb = XLSX.utils.book_new();
    const planned = [];
    if (options.includePortada) planned.push('Portada');
    if (options.includeFlujograma && data.pfd) planned.push('Flujograma');
    if (options.includeAmfe && data.amfe) planned.push('AMFE VDA');
    if (options.includeCp && data.cp) planned.push('Plan de Control');

    if (options.includePortada) buildPortadaSheet(wb, data, options, planned.filter(n => n !== 'Portada'));
    if (options.includeFlujograma && data.pfd) buildFlujogramaSheet(wb, data.pfd);
    if (options.includeAmfe && data.amfe) { const w = buildAmfeCompletoWorkbook(data.amfe); const s = w.SheetNames[0]; if (s) XLSX.utils.book_append_sheet(wb, shiftWorksheet(w.Sheets[s]), 'AMFE VDA'); }
    if (options.includeCp && data.cp) { const w = buildControlPlanWorkbook(data.cp); const s = w.SheetNames[0]; if (s) XLSX.utils.book_append_sheet(wb, shiftWorksheet(w.Sheets[s]), 'Plan de Control'); }
    return wb;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('=== APQP Package Export — Insert Patagonia ===\n');

    console.log('[1] Authenticating...');
    await initSupabase();

    console.log('\n[2] Finding Insert Patagonia family...');
    const family = await findInsertFamily();

    console.log('\n[3] Finding family documents & members...');
    const [familyDocs, members] = await Promise.all([findMasterDocs(family.id), findFamilyMembers(family.id)]);
    const partNumbers = members.map(m => m.codigo || '').filter(Boolean);
    console.log(`  Part numbers: ${partNumbers.join(', ') || '(none)'}`);

    const pfdRef = familyDocs.find(d => d.module === 'pfd');
    const amfeRef = familyDocs.find(d => d.module === 'amfe');
    const cpRef = familyDocs.find(d => d.module === 'cp');

    console.log('\n[4] Loading documents...');
    const [pfdData, amfeData, cpData] = await Promise.all([
        pfdRef ? loadDoc('pfd_documents', pfdRef.document_id, 'PFD') : null,
        amfeRef ? loadDoc('amfe_documents', amfeRef.document_id, 'AMFE') : null,
        cpRef ? loadDoc('cp_documents', cpRef.document_id, 'CP') : null,
    ]);

    if (pfdData) console.log(`  PFD: ${pfdData.steps?.length || 0} steps`);
    if (amfeData) console.log(`  AMFE: ${amfeData.operations?.length || 0} operations`);
    if (cpData) console.log(`  CP: ${(cpData.items || []).length} items`);

    console.log('\n[5] Building APQP package workbook...');
    const packageData = {
        familyName: family.name,
        partNumbers,
        client: family.linea_name || 'VWA',
        revision: 'A',
        team: amfeData?.header?.team || cpData?.header?.coreTeam || '',
        date: new Date().toISOString().split('T')[0],
        pfd: pfdData,
        amfe: amfeData,
        cp: cpData,
    };
    const options = {
        includePortada: true,
        includeFlujograma: pfdData !== null,
        includeAmfe: amfeData !== null,
        includeCp: cpData !== null,
        revision: 'A',
    };

    const wb = buildApqpPackageWorkbook(packageData, options);

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    const outputPath = path.join(PROJECT_ROOT, 'exports', 'test-paquete-apqp-v5.xlsx');
    fs.writeFileSync(outputPath, buffer);
    const stats = fs.statSync(outputPath);

    // Report
    console.log('\n========================================');
    console.log('  REPORTE PAQUETE APQP');
    console.log('========================================');
    console.log(`  Archivo : ${outputPath}`);
    console.log(`  Tamano  : ${(stats.size / 1024).toFixed(1)} KB`);
    console.log(`  Hojas   : ${wb.SheetNames.length}`);
    console.log('  ----------------------------------------');
    for (let i = 0; i < wb.SheetNames.length; i++) {
        console.log(`    ${String(i + 1).padStart(2)}.  ${wb.SheetNames[i]}`);
    }
    console.log('  ----------------------------------------');
    if (amfeData) {
        let totalCauses = 0;
        for (const op of amfeData.operations || []) for (const we of op.workElements || []) for (const func of we.functions || []) for (const fail of func.failures || []) totalCauses += (fail.causes || []).length;
        console.log(`  AMFE    : ${amfeData.operations?.length} ops, ${totalCauses} causas`);
    }
    if (cpData) {
        const withCM = (cpData.items || []).filter(i => i.controlMethod?.trim()).length;
        console.log(`  CP      : ${(cpData.items || []).length} items, ${withCM} con controlMethod`);
    }
    if (pfdData) {
        const ngSteps = (pfdData.steps || []).filter(s => s.rejectDisposition && s.rejectDisposition !== 'none').length;
        console.log(`  PFD     : ${(pfdData.steps || []).length} pasos, ${ngSteps} con NG disposition`);
    }
    console.log('========================================');
    console.log('  Datos reales: SI');
    console.log('  Abre sin errores: verificar abriendo el archivo');
    console.log('========================================\n');

    close();
}

main().catch(err => { console.error('\nFATAL:', err.message || err); process.exit(1); });
