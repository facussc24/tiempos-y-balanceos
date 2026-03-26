/**
 * Generate individual XLSX exports for the "Insert Patagonia" product family.
 *
 * Connects to Supabase, loads AMFE/CP/HO documents, builds Excel files
 * using xlsx-js-style (AMFE, CP) and exceljs (HO), saves to exports/.
 *
 * Run: node exports/generate-insert-exports.mjs
 */

import { initSupabase, selectSql, close } from '../scripts/supabaseHelper.mjs';
import XLSX from 'xlsx-js-style';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ============================================================================
// STEP 1: Find Insert Patagonia family
// ============================================================================

async function findInsertPatagoniaFamily() {
    const rows = await selectSql(`SELECT * FROM product_families WHERE name LIKE '%Insert Patagonia%' AND active = 1`);
    if (rows.length === 0) throw new Error('Insert Patagonia family not found');
    console.log(`  Family: "${rows[0].name}" (id=${rows[0].id})`);
    return rows[0];
}

// ============================================================================
// STEP 2: Find linked documents
// ============================================================================

async function findFamilyDocuments(familyId) {
    const rows = await selectSql(
        `SELECT * FROM family_documents WHERE family_id = ${familyId} AND is_master = 1 ORDER BY module`
    );
    console.log(`  Found ${rows.length} master documents:`);
    for (const r of rows) {
        console.log(`    - ${r.module}: document_id=${r.document_id}`);
    }
    return rows;
}

// ============================================================================
// STEP 3: Load documents
// ============================================================================

async function loadAmfeDocument(docId) {
    const rows = await selectSql(`SELECT id, data FROM amfe_documents WHERE id = '${docId}'`);
    if (rows.length === 0) throw new Error(`AMFE document ${docId} not found`);
    const doc = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    console.log(`  AMFE loaded: ${doc.operations?.length || 0} operations, subject="${doc.header?.subject || ''}"`);
    return doc;
}

async function loadCpDocument(docId) {
    const rows = await selectSql(`SELECT id, data FROM cp_documents WHERE id = '${docId}'`);
    if (rows.length === 0) throw new Error(`CP document ${docId} not found`);
    const raw = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    // Normalize
    const doc = {
        header: { ...raw.header },
        items: (raw.items || []).map(item => ({
            id: item.id || '',
            processStepNumber: item.processStepNumber || '',
            processDescription: item.processDescription || '',
            machineDeviceTool: item.machineDeviceTool || '',
            characteristicNumber: item.characteristicNumber || '',
            productCharacteristic: item.productCharacteristic || '',
            processCharacteristic: item.processCharacteristic || '',
            specialCharClass: item.specialCharClass || '',
            specification: item.specification || '',
            evaluationTechnique: item.evaluationTechnique || '',
            sampleSize: item.sampleSize || '',
            sampleFrequency: item.sampleFrequency || '',
            controlMethod: item.controlMethod || '',
            reactionPlan: item.reactionPlan || '',
            reactionPlanOwner: item.reactionPlanOwner || '',
            controlProcedure: item.controlProcedure || '',
        })),
    };
    console.log(`  CP loaded: ${doc.items.length} items, partNumber="${doc.header?.partNumber || ''}"`);
    return doc;
}

async function loadHoDocument(docId) {
    const rows = await selectSql(`SELECT id, data FROM ho_documents WHERE id = '${docId}'`);
    if (rows.length === 0) throw new Error(`HO document ${docId} not found`);
    const raw = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    const doc = {
        header: {
            formNumber: raw.header?.formNumber || 'I-IN-002.4-R01',
            organization: raw.header?.organization || '',
            client: raw.header?.client || '',
            partNumber: raw.header?.partNumber || '',
            partDescription: raw.header?.partDescription || '',
            applicableParts: raw.header?.applicableParts || '',
            linkedAmfeProject: raw.header?.linkedAmfeProject || '',
            linkedCpProject: raw.header?.linkedCpProject || '',
        },
        sheets: (raw.sheets || []).map(s => ({
            ...s,
            steps: (s.steps || []),
            qualityChecks: (s.qualityChecks || []),
            safetyElements: (s.safetyElements || []),
            visualAids: (s.visualAids || []),
        })),
    };
    console.log(`  HO loaded: ${doc.sheets.length} sheets, partNumber="${doc.header?.partNumber || ''}"`);
    return doc;
}

// ============================================================================
// SANITIZE CELL VALUE (replicated from utils/sanitizeCellValue.ts)
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
// AMFE EXPORT (replicated from amfeExcelExport.ts)
// ============================================================================

const AMFE_BORDER = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
};

const amfeSt = {
    title: {
        font: { bold: true, sz: 12, name: 'Arial' },
        alignment: { horizontal: 'center', vertical: 'center' },
    },
    formRef: {
        font: { sz: 8, color: { rgb: '808080' }, name: 'Arial' },
        alignment: { horizontal: 'right' },
    },
    metaLabel: {
        font: { bold: true, sz: 9, name: 'Arial' },
        fill: { fgColor: { rgb: 'F2F2F2' } },
        border: AMFE_BORDER,
    },
    metaValue: {
        font: { sz: 9, name: 'Arial' },
        border: AMFE_BORDER,
    },
    groupHeader: {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9, name: 'Arial' },
        fill: { fgColor: { rgb: '4472C4' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: AMFE_BORDER,
    },
    colHeader: {
        font: { bold: true, sz: 8, name: 'Arial' },
        fill: { fgColor: { rgb: 'D9E2F3' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: AMFE_BORDER,
    },
    cell: {
        font: { sz: 8, name: 'Arial' },
        alignment: { vertical: 'top', wrapText: true },
        border: AMFE_BORDER,
    },
    cellCenter: {
        font: { sz: 8, name: 'Arial' },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: AMFE_BORDER,
    },
    cellMerged: {
        font: { sz: 8, name: 'Arial' },
        alignment: { vertical: 'center', wrapText: true },
        border: AMFE_BORDER,
    },
    apH: {
        font: { bold: true, sz: 8, name: 'Arial', color: { rgb: '9C0006' } },
        fill: { fgColor: { rgb: 'FFC7CE' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: AMFE_BORDER,
    },
    apM: {
        font: { bold: true, sz: 8, name: 'Arial', color: { rgb: '9C6500' } },
        fill: { fgColor: { rgb: 'FFEB9C' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: AMFE_BORDER,
    },
    apL: {
        font: { sz: 8, name: 'Arial', color: { rgb: '006100' } },
        fill: { fgColor: { rgb: 'C6EFCE' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: AMFE_BORDER,
    },
    emptyBorder: { border: AMFE_BORDER },
};

const WORK_ELEMENT_LABELS = {
    Machine: 'Maquina',
    Man: 'Mano de Obra',
    Material: 'Material',
    Method: 'Metodo',
    Environment: 'Medio Ambiente',
    Measurement: 'Medicion',
};

function getApStyle(ap) {
    switch (ap) {
        case 'H': return amfeSt.apH;
        case 'M': return amfeSt.apM;
        case 'L': return amfeSt.apL;
        default: return amfeSt.cellCenter;
    }
}

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

const AMFE_COL_WIDTHS = [
    8, 20, 18, 22, 22, 22, 25, 22, 22,
    5, 20, 4, 20, 4, 5, 10,
    22, 22, 14, 11, 11, 22, 11, 4, 4, 4, 5, 18,
];

function buildFEText(fail) {
    if (!fail) return '';
    const parts = [];
    if (fail.effectLocal) parts.push(`Interno: ${fail.effectLocal}`);
    if (fail.effectNextLevel) parts.push(`Cliente: ${fail.effectNextLevel}`);
    if (fail.effectEndUser) parts.push(`Usr.Final: ${fail.effectEndUser}`);
    return parts.join('\n');
}

function buildCarEspText(c) {
    const parts = [];
    if (c.specialChar) parts.push(c.specialChar);
    if (c.characteristicNumber) parts.push(`#${c.characteristicNumber}`);
    return parts.join(' ');
}

function buildAmfeMetadataRows(doc, colWidths) {
    const h = doc.header;
    const totalCols = colWidths.length;
    const merges = [];
    const metaEnd = Math.min(7, totalCols - 1);
    const splitCol = Math.min(4, Math.floor((metaEnd + 1) / 2));

    let leftLabelEnd = 0;
    { let w = colWidths[0]; while (w < 16 && leftLabelEnd < splitCol - 2) { leftLabelEnd++; w += colWidths[leftLabelEnd]; } }
    let rightLabelEnd = splitCol;
    { let w = colWidths[splitCol]; while (w < 16 && rightLabelEnd < metaEnd - 1) { rightLabelEnd++; w += colWidths[rightLabelEnd]; } }

    const leftValueStart = leftLabelEnd + 1;
    const leftValueEnd = splitCol - 1;
    const rightValueStart = rightLabelEnd + 1;
    const rightValueEnd = metaEnd;

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

        row[0] = { v: lbl1, s: amfeSt.metaLabel };
        for (let c = 1; c <= leftLabelEnd; c++) row[c] = { v: '', s: amfeSt.metaLabel };
        if (leftLabelEnd > 0) merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: leftLabelEnd } });

        row[leftValueStart] = { v: sanitizeCellValue(val1), s: amfeSt.metaValue };
        for (let c = leftValueStart + 1; c <= leftValueEnd; c++) row[c] = { v: '', s: amfeSt.metaValue };
        if (leftValueEnd > leftValueStart) merges.push({ s: { r: rowIdx, c: leftValueStart }, e: { r: rowIdx, c: leftValueEnd } });

        row[splitCol] = { v: lbl2, s: amfeSt.metaLabel };
        for (let c = splitCol + 1; c <= rightLabelEnd; c++) row[c] = { v: '', s: amfeSt.metaLabel };
        if (rightLabelEnd > splitCol) merges.push({ s: { r: rowIdx, c: splitCol }, e: { r: rowIdx, c: rightLabelEnd } });

        if (rightValueStart <= rightValueEnd) {
            row[rightValueStart] = { v: sanitizeCellValue(val2), s: amfeSt.metaValue };
            for (let c = rightValueStart + 1; c <= rightValueEnd; c++) row[c] = { v: '', s: amfeSt.metaValue };
            if (rightValueEnd > rightValueStart) merges.push({ s: { r: rowIdx, c: rightValueStart }, e: { r: rowIdx, c: rightValueEnd } });
        }

        metaRowsArr.push(row);
    }

    const emptyRow = Array(totalCols).fill('');
    return { rows: [titleRow, formRow, ...metaRowsArr, emptyRow], merges };
}

function buildAmfeWorkbook(doc) {
    const wb = XLSX.utils.book_new();
    const totalCols = AMFE_COL_HEADERS.length;

    const { rows: metaRows, merges } = buildAmfeMetadataRows(doc, AMFE_COL_WIDTHS);
    const rows = [...metaRows];

    // Group header row
    const groupRow = [];
    for (const group of AMFE_COL_GROUPS) {
        groupRow.push({ v: group.label, s: amfeSt.groupHeader });
        for (let i = 1; i < group.colSpan; i++) groupRow.push({ v: '', s: amfeSt.groupHeader });
    }
    rows.push(groupRow);
    const groupRowIdx = rows.length - 1;

    let colOffset = 0;
    for (const group of AMFE_COL_GROUPS) {
        if (group.colSpan > 1) {
            merges.push({ s: { r: groupRowIdx, c: colOffset }, e: { r: groupRowIdx, c: colOffset + group.colSpan - 1 } });
        }
        colOffset += group.colSpan;
    }

    rows.push(AMFE_COL_HEADERS.map(label => ({ v: label, s: amfeSt.colHeader })));
    const dataStartRow = rows.length;

    const dataRows = [];
    const dataMerges = [];

    for (const op of doc.operations) {
        const opStartRow = dataRows.length;
        let opRowCount = 0;
        const weList = op.workElements.length > 0 ? op.workElements : [null];

        for (const we of weList) {
            const weStartRow = dataRows.length;
            let weRowCount = 0;
            const funcList = we && we.functions.length > 0 ? we.functions : [null];

            for (const func of funcList) {
                const funcStartRow = dataRows.length;
                let funcRowCount = 0;
                const failList = func && func.failures.length > 0 ? func.failures : [null];

                for (const fail of failList) {
                    const failStartRow = dataRows.length;
                    let failRowCount = 0;
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
                        failRowCount++;
                        funcRowCount++;
                        weRowCount++;
                        opRowCount++;
                    }

                    if (failRowCount > 1) {
                        for (const col of [6, 7, 9]) {
                            dataMerges.push({ col, startRow: failStartRow, rowSpan: failRowCount });
                        }
                    }
                }

                if (funcRowCount > 1) {
                    dataMerges.push({ col: 5, startRow: funcStartRow, rowSpan: funcRowCount });
                }
            }

            if (weRowCount > 1) {
                dataMerges.push({ col: 2, startRow: weStartRow, rowSpan: weRowCount });
            }
        }

        if (opRowCount > 1) {
            for (const col of [0, 1, 3, 4]) {
                dataMerges.push({ col, startRow: opStartRow, rowSpan: opRowCount });
            }
        }
    }

    rows.push(...dataRows);

    for (const dm of dataMerges) {
        merges.push({
            s: { r: dataStartRow + dm.startRow, c: dm.col },
            e: { r: dataStartRow + dm.startRow + dm.rowSpan - 1, c: dm.col },
        });
    }

    for (const dm of dataMerges) {
        for (let r = dm.startRow + 1; r < dm.startRow + dm.rowSpan; r++) {
            if (dataRows[r] && dataRows[r][dm.col]) {
                dataRows[r][dm.col] = { v: '', s: amfeSt.emptyBorder };
            }
        }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = AMFE_COL_WIDTHS.map(w => ({ wch: w }));
    ws['!merges'] = merges;
    XLSX.utils.book_append_sheet(wb, ws, 'AMFE');

    return wb;
}

// ============================================================================
// CP EXPORT (replicated from controlPlanExcelExport.ts)
// ============================================================================

const CP_BORDER = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
};

const cpSt = {
    title: {
        font: { bold: true, sz: 14, name: 'Arial' },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: CP_BORDER,
    },
    formRef: {
        font: { sz: 8, color: { rgb: '808080' }, name: 'Arial' },
        alignment: { horizontal: 'left' },
        border: CP_BORDER,
    },
    phaseText: {
        font: { sz: 9, name: 'Arial' },
        alignment: { horizontal: 'right' },
        border: CP_BORDER,
    },
    metaLabel: {
        font: { bold: true, sz: 9, name: 'Arial' },
        fill: { fgColor: { rgb: 'F2F2F2' } },
        border: CP_BORDER,
    },
    metaValue: {
        font: { sz: 9, name: 'Arial' },
        border: CP_BORDER,
    },
    groupHeader: {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9, name: 'Arial' },
        fill: { fgColor: { rgb: '4472C4' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: CP_BORDER,
    },
    colHeader: {
        font: { bold: true, sz: 8, name: 'Arial' },
        fill: { fgColor: { rgb: 'D9E2F3' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: CP_BORDER,
    },
    cell: {
        font: { sz: 9, name: 'Arial' },
        alignment: { vertical: 'top', wrapText: true },
        border: CP_BORDER,
    },
    cellCenter: {
        font: { sz: 9, name: 'Arial' },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: CP_BORDER,
    },
    cellMerged: {
        font: { sz: 9, name: 'Arial' },
        alignment: { vertical: 'center', wrapText: true },
        border: CP_BORDER,
    },
    ccBadge: {
        font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C0006' } },
        fill: { fgColor: { rgb: 'FFC7CE' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: CP_BORDER,
    },
    scBadge: {
        font: { bold: true, sz: 9, name: 'Arial', color: { rgb: '9C6500' } },
        fill: { fgColor: { rgb: 'FFEB9C' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: CP_BORDER,
    },
};

const CP_COL_WIDTHS = [12, 25, 20, 10, 22, 22, 12, 23, 20, 13, 13, 20, 23, 17, 16];

const CP_COLUMNS = [
    { key: 'processStepNumber', label: 'Nro. Parte/Proceso' },
    { key: 'processDescription', label: 'Descripcion Proceso/Operacion' },
    { key: 'machineDeviceTool', label: 'Maquina/Dispositivo/Herram.' },
    { key: 'characteristicNumber', label: 'Nro.' },
    { key: 'productCharacteristic', label: 'Producto' },
    { key: 'processCharacteristic', label: 'Proceso' },
    { key: 'specialCharClass', label: 'Clasif. Caract. Esp.' },
    { key: 'specification', label: 'Espec./Tolerancia' },
    { key: 'evaluationTechnique', label: 'Tecnica Evaluacion/Medicion' },
    { key: 'sampleSize', label: 'Tamano Muestra' },
    { key: 'sampleFrequency', label: 'Frecuencia' },
    { key: 'controlMethod', label: 'Metodo Control' },
    { key: 'reactionPlan', label: 'Plan Reaccion' },
    { key: 'reactionPlanOwner', label: 'Responsable Reaccion' },
    { key: 'controlProcedure', label: 'Procedimiento/IT' },
];

const CP_COLUMN_GROUPS = [
    { label: 'Proceso', colSpan: 3 },
    { label: 'Caracteristicas', colSpan: 4 },
    { label: 'Metodos', colSpan: 8 },
];

const CONTROL_PLAN_PHASES = [
    { value: 'preLaunch', label: 'Pre-Lanzamiento' },
    { value: 'production', label: 'Produccion' },
];

const CP_META_PAIRS = [
    { lStart: 0, lEnd: 2, vStart: 3, vEnd: 4 },
    { lStart: 5, lEnd: 6, vStart: 7, vEnd: 9 },
    { lStart: 10, lEnd: 11, vStart: 12, vEnd: 14 },
];

function buildCpMetaRow(info, totalCols, rowIdx, merges) {
    const row = Array(totalCols).fill(null).map(() => ({ v: '', s: { border: CP_BORDER } }));
    for (let p = 0; p < 3; p++) {
        const label = info[p * 2];
        const value = info[p * 2 + 1];
        const { lStart, lEnd, vStart, vEnd } = CP_META_PAIRS[p];

        if (label) {
            row[lStart] = { v: label, s: cpSt.metaLabel };
            for (let c = lStart + 1; c <= lEnd; c++) row[c] = { v: '', s: cpSt.metaLabel };
            row[vStart] = { v: sanitizeCellValue(value), s: cpSt.metaValue };
            for (let c = vStart + 1; c <= vEnd; c++) row[c] = { v: '', s: cpSt.metaValue };
        }
        if (lEnd > lStart) merges.push({ s: { r: rowIdx, c: lStart }, e: { r: rowIdx, c: lEnd } });
        if (vEnd > vStart) merges.push({ s: { r: rowIdx, c: vStart }, e: { r: rowIdx, c: vEnd } });
    }
    return row;
}

function getSpecialCharStyle(value) {
    const upper = (value || '').toUpperCase().trim();
    if (upper === 'CC') return cpSt.ccBadge;
    if (upper === 'SC') return cpSt.scBadge;
    return cpSt.cellCenter;
}

function buildCpWorkbook(doc) {
    const wb = XLSX.utils.book_new();
    const rows = [];
    const h = doc.header;
    const totalCols = CP_COLUMNS.length;
    const merges = [];

    // Title
    const titleRow = Array(totalCols).fill(null).map(() => ({ v: '', s: cpSt.title }));
    titleRow[0] = { v: 'PLAN DE CONTROL', s: cpSt.title };
    rows.push(titleRow);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

    // Phase
    const phaseStr = CONTROL_PLAN_PHASES
        .map(p => `${p.value === h.phase ? '☒' : '☐'} ${p.label}`)
        .join('    ');
    const formPhaseRow = Array(totalCols).fill(null).map(() => ({ v: '', s: { border: CP_BORDER } }));
    formPhaseRow[0] = { v: 'Formulario I-AC-005.2', s: cpSt.formRef };
    for (let c = 1; c <= 4; c++) formPhaseRow[c] = { v: '', s: cpSt.formRef };
    formPhaseRow[5] = { v: phaseStr, s: cpSt.phaseText };
    for (let c = 6; c < totalCols; c++) formPhaseRow[c] = { v: '', s: cpSt.phaseText };
    rows.push(formPhaseRow);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 4 } });
    merges.push({ s: { r: 1, c: 5 }, e: { r: 1, c: totalCols - 1 } });

    // Metadata
    const headerInfo = [
        ['Nro. Plan de Control', h.controlPlanNumber || '', 'Nro. Pieza', h.partNumber || '', 'Fecha', h.date || ''],
        ['Pieza', h.partName || '', 'Nivel de Cambio', h.latestChangeLevel || '', 'Revision', h.revision || ''],
        ['Organizacion / Planta', h.organization || '', 'Proveedor', h.supplier || '', 'Cod. Proveedor', h.supplierCode || ''],
        ['Contacto / Telefono', h.keyContactPhone || '', 'Cliente', h.client || '', 'Responsable', h.responsible || ''],
        ['Equipo', h.coreTeam || '', 'AMFE Vinculado', h.linkedAmfeProject || '', '', ''],
        ['Aprob. Planta', h.approvedBy || '', 'Aprob. Cliente / Fecha', h.customerApproval || '', 'Otra Aprobacion', h.otherApproval || ''],
    ];

    for (const info of headerInfo) {
        const rowIdx = rows.length;
        rows.push(buildCpMetaRow(info, totalCols, rowIdx, merges));
    }

    rows.push(Array(totalCols).fill(''));
    const separatorIdx = rows.length - 1;

    // Group headers
    const groupRow = [];
    for (const group of CP_COLUMN_GROUPS) {
        groupRow.push({ v: group.label, s: cpSt.groupHeader });
        for (let i = 1; i < group.colSpan; i++) groupRow.push({ v: '', s: cpSt.groupHeader });
    }
    rows.push(groupRow);
    const groupRowIdx = rows.length - 1;

    let colOff = 0;
    for (const group of CP_COLUMN_GROUPS) {
        if (group.colSpan > 1) {
            merges.push({ s: { r: groupRowIdx, c: colOff }, e: { r: groupRowIdx, c: colOff + group.colSpan - 1 } });
        }
        colOff += group.colSpan;
    }

    rows.push(CP_COLUMNS.map(col => ({ v: col.label, s: cpSt.colHeader })));
    const dataStartIdx = rows.length;

    for (const item of doc.items) {
        rows.push(CP_COLUMNS.map(col => {
            const value = (item[col.key]) || '';
            if (col.key === 'specialCharClass') {
                return { v: sanitizeCellValue(value), s: getSpecialCharStyle(value) };
            }
            return { v: sanitizeCellValue(value), s: cpSt.cell };
        }));
    }

    // Vertical merging for same-process groups
    let i = 0;
    while (i < doc.items.length) {
        const psn = (doc.items[i].processStepNumber || '').trim();
        if (!psn) { i++; continue; }
        let j = i + 1;
        while (j < doc.items.length && (doc.items[j].processStepNumber || '').trim() === psn) j++;
        const span = j - i;
        if (span > 1) {
            for (const col of [0, 1, 2]) {
                merges.push({
                    s: { r: dataStartIdx + i, c: col },
                    e: { r: dataStartIdx + j - 1, c: col },
                });
                const leaderRow = rows[dataStartIdx + i];
                leaderRow[col] = { ...leaderRow[col], s: cpSt.cellMerged };
                for (let r = 1; r < span; r++) {
                    const rowIdx = dataStartIdx + i + r;
                    if (rowIdx >= rows.length) break;
                    rows[rowIdx][col] = { v: '', s: cpSt.cellMerged };
                }
            }
        }
        i = j;
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = CP_COL_WIDTHS.map(w => ({ wch: w }));
    ws['!merges'] = merges;
    XLSX.utils.book_append_sheet(wb, ws, 'Plan de Control');

    return wb;
}

// ============================================================================
// HO EXPORT (simplified for Node - no images, uses ExcelJS)
// ============================================================================

const NAVY = '1E3A5F';
const NAVY_LIGHT = 'D6E4F0';
const GREEN_HEADER = 'E2EFDA';
const RED_HEADER = 'FFC7CE';
const RED_TEXT = '9C0006';
const YELLOW_HIGHLIGHT = 'FFEB9C';
const CC_RED = 'DC2626';
const SC_AMBER = 'F59E0B';
const WHITE = 'FFFFFF';
const GRAY_LABEL = '808080';
const COL_OFFSET = 1;
const ROW_OFFSET = 1;
const DATA_COLS = 8;
const FIRST_COL = COL_OFFSET + 1;
const LAST_COL = COL_OFFSET + DATA_COLS;

const thinBorder = { style: 'thin', color: { argb: 'FF000000' } };
const mediumBorder = { style: 'medium', color: { argb: 'FF000000' } };
const BORDER_ALL = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function applyStyle(cell, opts) {
    if (opts.font) cell.font = { name: 'Arial', size: 9, ...opts.font };
    if (opts.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${opts.fill}` } };
    if (opts.alignment) cell.alignment = { vertical: 'middle', ...opts.alignment };
    if (opts.border) cell.border = opts.border;
}

function setVal(ws, row, col, value, opts = {}) {
    const cell = ws.getCell(row, col);
    cell.value = typeof value === 'string' ? sanitizeCellValue(value) : value;
    applyStyle(cell, {
        font: { size: 9, ...opts.font },
        fill: opts.fill,
        alignment: { vertical: 'middle', ...opts.alignment },
        border: opts.border || BORDER_ALL,
    });
    return cell;
}

function fillBorders(ws, r1, c1, r2, c2, border = BORDER_ALL, fill) {
    for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
            const cell = ws.getCell(r, c);
            cell.border = border;
            if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fill}` } };
        }
    }
}

function addSectionHeader(ws, row, title, color = 'navy') {
    const bgColor = color === 'navy' ? NAVY : color === 'green' ? '4CAF50' : 'E53935';
    ws.mergeCells(row, FIRST_COL, row, LAST_COL);
    setVal(ws, row, FIRST_COL, title, {
        font: { bold: true, size: 9, color: { argb: `FF${WHITE}` } },
        fill: bgColor,
        alignment: { horizontal: 'center', vertical: 'middle' },
    });
    fillBorders(ws, row, FIRST_COL, row, LAST_COL, BORDER_ALL, bgColor);
    ws.getRow(row).height = 20;
}

function addLabel(ws, row, col, label) {
    setVal(ws, row, col, label, {
        font: { size: 7, bold: true, color: { argb: `FF${GRAY_LABEL}` } },
        alignment: { vertical: 'top', wrapText: true },
    });
}

function buildHoSheet(workbook, sheet, doc) {
    let sheetName = `HO ${sheet.operationNumber}`.slice(0, 31);
    const existingNames = new Set(workbook.worksheets.map(w => w.name));
    if (existingNames.has(sheetName)) {
        let suffix = 2;
        while (existingNames.has(`${sheetName.slice(0, 28)}_${suffix}`)) suffix++;
        sheetName = `${sheetName.slice(0, 28)}_${suffix}`;
    }

    const ws = workbook.addWorksheet(sheetName, {
        views: [{ state: 'normal', showGridLines: false }],
        pageSetup: {
            paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
            margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
        },
    });

    ws.columns = [
        { width: 2 }, { width: 14 }, { width: 16 }, { width: 20 },
        { width: 28 }, { width: 18 }, { width: 16 }, { width: 12 }, { width: 20 },
    ];

    let r = ROW_OFFSET + 1;

    // Header: Logo area
    ws.mergeCells(r, FIRST_COL, r + 1, FIRST_COL + 1);
    setVal(ws, r, FIRST_COL, doc.header.organization || 'BARACK MERCOSUL', {
        font: { bold: true, size: 11, color: { argb: `FF${NAVY}` } },
        alignment: { horizontal: 'center', vertical: 'middle' },
    });
    fillBorders(ws, r, FIRST_COL, r + 1, FIRST_COL + 1);

    ws.mergeCells(r, FIRST_COL + 2, r + 1, FIRST_COL + 4);
    setVal(ws, r, FIRST_COL + 2, 'HOJA DE OPERACIONES', {
        font: { bold: true, size: 14, color: { argb: `FF${NAVY}` } },
        alignment: { horizontal: 'center', vertical: 'middle' },
    });
    fillBorders(ws, r, FIRST_COL + 2, r + 1, FIRST_COL + 4);

    ws.mergeCells(r, FIRST_COL + 5, r, LAST_COL - 1);
    setVal(ws, r, FIRST_COL + 5, `Form: ${doc.header?.formNumber || ''}`, {
        font: { size: 7, color: { argb: `FF${GRAY_LABEL}` } },
        alignment: { horizontal: 'right', vertical: 'bottom' },
    });
    fillBorders(ws, r, FIRST_COL + 5, r, LAST_COL - 1);

    const statusLabel = sheet.status === 'aprobado' ? 'APROBADO'
        : sheet.status === 'pendienteRevision' ? 'PEND. REV.' : 'BORRADOR';
    setVal(ws, r, LAST_COL, statusLabel, {
        font: { bold: true, size: 8 },
        alignment: { horizontal: 'center', vertical: 'middle' },
    });

    ws.mergeCells(r + 1, FIRST_COL + 5, r + 1, LAST_COL);
    setVal(ws, r + 1, FIRST_COL + 5, sheet.hoNumber, {
        font: { bold: true, size: 18, color: { argb: `FF${NAVY}` } },
        alignment: { horizontal: 'center', vertical: 'middle' },
    });
    fillBorders(ws, r + 1, FIRST_COL + 5, r + 1, LAST_COL);

    ws.getRow(r).height = 24;
    ws.getRow(r + 1).height = 28;
    r += 2;

    // Row 4: Operation info
    addLabel(ws, r, FIRST_COL, 'N DE OPERACION');
    setVal(ws, r, FIRST_COL + 1, sheet.operationNumber, { font: { size: 10, bold: true } });
    addLabel(ws, r, FIRST_COL + 2, 'DENOMINACION DE LA OPERACION');
    ws.mergeCells(r, FIRST_COL + 3, r, FIRST_COL + 5);
    setVal(ws, r, FIRST_COL + 3, sheet.operationName, { font: { size: 10, bold: true } });
    fillBorders(ws, r, FIRST_COL + 3, r, FIRST_COL + 5);
    addLabel(ws, r, FIRST_COL + 6, 'MODELO O VEHICULO');
    setVal(ws, r, LAST_COL, sheet.vehicleModel || '');
    ws.getRow(r).height = 28;
    r++;

    // Row 5: Prepared/Approved
    addLabel(ws, r, FIRST_COL, 'REALIZO');
    setVal(ws, r, FIRST_COL + 1, sheet.preparedBy || '');
    addLabel(ws, r, FIRST_COL + 2, 'APROBO');
    setVal(ws, r, FIRST_COL + 3, sheet.approvedBy || '');
    addLabel(ws, r, FIRST_COL + 4, 'FECHA');
    setVal(ws, r, FIRST_COL + 5, sheet.date || '');
    addLabel(ws, r, FIRST_COL + 6, 'REV.');
    setVal(ws, r, LAST_COL, sheet.revision || '');
    ws.getRow(r).height = 24;
    r++;

    // Row 6: Sector/Part/Client
    addLabel(ws, r, FIRST_COL, 'SECTOR');
    setVal(ws, r, FIRST_COL + 1, sheet.sector || '');
    addLabel(ws, r, FIRST_COL + 2, 'COD. PIEZA');
    setVal(ws, r, FIRST_COL + 3, sheet.partCodeDescription || '');
    addLabel(ws, r, FIRST_COL + 4, 'CLIENTE');
    setVal(ws, r, FIRST_COL + 5, doc.header?.client || '');
    addLabel(ws, r, FIRST_COL + 6, 'N PUESTO');
    setVal(ws, r, LAST_COL, sheet.puestoNumber || '');
    ws.getRow(r).height = 28;
    r++;

    for (let c = FIRST_COL; c <= LAST_COL; c++) {
        const cell = ws.getCell(r - 1, c);
        cell.border = { ...BORDER_ALL, bottom: mediumBorder };
    }
    r++;

    // Steps section
    addSectionHeader(ws, r, 'DESCRIPCION DE LA OPERACION');
    r++;

    setVal(ws, r, FIRST_COL, 'Nro', {
        font: { bold: true, size: 8 }, fill: NAVY_LIGHT,
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    });
    ws.mergeCells(r, FIRST_COL + 1, r, FIRST_COL + 5);
    setVal(ws, r, FIRST_COL + 1, 'Descripcion del Paso', {
        font: { bold: true, size: 8 }, fill: NAVY_LIGHT,
        alignment: { horizontal: 'center', vertical: 'middle' },
    });
    fillBorders(ws, r, FIRST_COL + 1, r, FIRST_COL + 5, BORDER_ALL, NAVY_LIGHT);
    setVal(ws, r, FIRST_COL + 6, 'Punto Clave', {
        font: { bold: true, size: 8 }, fill: NAVY_LIGHT,
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    });
    setVal(ws, r, LAST_COL, 'Razon', {
        font: { bold: true, size: 8 }, fill: NAVY_LIGHT,
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    });
    ws.getRow(r).height = 20;
    r++;

    const steps = sheet.steps || [];
    if (steps.length === 0) {
        ws.mergeCells(r, FIRST_COL, r, LAST_COL);
        setVal(ws, r, FIRST_COL, 'Sin pasos definidos', {
            font: { italic: true, color: { argb: `FF${GRAY_LABEL}` } },
            alignment: { horizontal: 'center' },
        });
        fillBorders(ws, r, FIRST_COL, r, LAST_COL);
        r++;
    } else {
        for (const step of steps) {
            const isKP = step.isKeyPoint;
            const bgFill = isKP ? YELLOW_HIGHLIGHT : undefined;

            setVal(ws, r, FIRST_COL, step.stepNumber, {
                font: { bold: true, size: 10 }, fill: bgFill,
                alignment: { horizontal: 'center' },
            });
            ws.mergeCells(r, FIRST_COL + 1, r, FIRST_COL + 5);
            setVal(ws, r, FIRST_COL + 1, step.description, {
                fill: bgFill, alignment: { vertical: 'top', wrapText: true },
            });
            fillBorders(ws, r, FIRST_COL + 1, r, FIRST_COL + 5, BORDER_ALL, bgFill);
            setVal(ws, r, FIRST_COL + 6, isKP ? 'SI' : '', {
                font: { bold: isKP }, fill: bgFill,
                alignment: { horizontal: 'center' },
            });
            setVal(ws, r, LAST_COL, step.keyPointReason || '', {
                fill: bgFill, alignment: { vertical: 'top', wrapText: true },
            });
            ws.getRow(r).height = Math.max(18, Math.ceil(String(step.description || '').length / 50) * 14);
            r++;
        }
    }
    r++;

    // Safety section
    addSectionHeader(ws, r, 'ELEMENTOS DE SEGURIDAD');
    r++;
    const safetyItems = sheet.safetyElements || [];
    if (safetyItems.length === 0) {
        ws.mergeCells(r, FIRST_COL, r, LAST_COL);
        setVal(ws, r, FIRST_COL, 'Ninguno', {
            font: { italic: true, color: { argb: `FF${GRAY_LABEL}` } },
            alignment: { horizontal: 'center' },
        });
        fillBorders(ws, r, FIRST_COL, r, LAST_COL);
        r++;
    } else {
        const PPE_LABELS = {
            anteojos: 'Anteojos de seguridad',
            guantes: 'Guantes',
            zapatos: 'Zapatos de seguridad',
            proteccionAuditiva: 'Proteccion auditiva',
            delantal: 'Ropa de proteccion',
            respirador: 'Respirador',
        };
        let labelCol = FIRST_COL;
        for (const ppeId of safetyItems) {
            if (labelCol <= LAST_COL) {
                setVal(ws, r, labelCol, PPE_LABELS[ppeId] || ppeId, {
                    font: { size: 8 },
                    alignment: { horizontal: 'center', wrapText: true },
                    border: BORDER_ALL,
                });
            }
            labelCol++;
        }
        ws.getRow(r).height = 22;
        r++;
    }
    r++;

    // Quality checks
    addSectionHeader(ws, r, 'CICLO DE CONTROL', 'green');
    r++;

    ws.mergeCells(r, FIRST_COL, r, LAST_COL);
    setVal(ws, r, FIRST_COL, 'Referencia: OP - Operador de Produccion', {
        font: { size: 7, italic: true, color: { argb: `FF${GRAY_LABEL}` } },
        alignment: { horizontal: 'left' },
        border: {},
    });
    r++;

    const qcHeaders = ['Nro', 'Caracteristica', 'Especificacion', 'Metodo Control', 'Resp.', 'Frecuencia', 'CC/SC', 'Registro'];
    for (let idx = 0; idx < qcHeaders.length; idx++) {
        setVal(ws, r, FIRST_COL + idx, qcHeaders[idx], {
            font: { bold: true, size: 8 }, fill: GREEN_HEADER,
            alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        });
    }
    ws.getRow(r).height = 22;
    r++;

    const qualityChecks = sheet.qualityChecks || [];
    if (qualityChecks.length === 0) {
        ws.mergeCells(r, FIRST_COL, r, LAST_COL);
        setVal(ws, r, FIRST_COL, 'Sin verificaciones de calidad.', {
            font: { italic: true, color: { argb: `FF${GRAY_LABEL}` } },
            alignment: { horizontal: 'center' },
        });
        fillBorders(ws, r, FIRST_COL, r, LAST_COL);
        r++;
    } else {
        qualityChecks.forEach((qc, idx) => {
            setVal(ws, r, FIRST_COL, idx + 1, { alignment: { horizontal: 'center' } });
            setVal(ws, r, FIRST_COL + 1, qc.characteristic || '', { alignment: { vertical: 'top', wrapText: true } });
            setVal(ws, r, FIRST_COL + 2, qc.specification || '', { alignment: { vertical: 'top', wrapText: true } });
            setVal(ws, r, FIRST_COL + 3, qc.controlMethod || qc.evaluationTechnique || '', { alignment: { vertical: 'top', wrapText: true } });
            setVal(ws, r, FIRST_COL + 4, qc.reactionContact || '', { alignment: { horizontal: 'center' } });
            setVal(ws, r, FIRST_COL + 5, qc.frequency || '', { alignment: { horizontal: 'center' } });

            const scUp = (qc.specialCharSymbol || '').toUpperCase().trim();
            const scFill = scUp === 'CC' ? CC_RED : scUp === 'SC' ? SC_AMBER : undefined;
            const scTextColor = (scUp === 'CC' || scUp === 'SC') ? WHITE : undefined;
            setVal(ws, r, FIRST_COL + 6, qc.specialCharSymbol || '', {
                font: { bold: scUp === 'CC' || scUp === 'SC', color: scTextColor ? { argb: `FF${scTextColor}` } : undefined },
                fill: scFill,
                alignment: { horizontal: 'center' },
            });

            setVal(ws, r, LAST_COL, qc.registro || '', { alignment: { vertical: 'top', wrapText: true } });
            ws.getRow(r).height = Math.max(18, Math.ceil(Math.max(String(qc.characteristic || '').length, String(qc.specification || '').length) / 30) * 14);
            r++;
        });
    }
    r++;

    // Reaction plan
    addSectionHeader(ws, r, 'PLAN DE REACCION ANTE NO CONFORME', 'red');
    r++;
    const reactionText = sheet.reactionPlanText || '';
    ws.mergeCells(r, FIRST_COL, r + 2, LAST_COL);
    setVal(ws, r, FIRST_COL, reactionText, {
        font: { bold: true, size: 9, color: { argb: `FF${RED_TEXT}` } },
        fill: RED_HEADER,
        alignment: { vertical: 'top', wrapText: true },
    });
    fillBorders(ws, r, FIRST_COL, r + 2, LAST_COL, BORDER_ALL, RED_HEADER);
    ws.getRow(r).height = 20;
    ws.getRow(r + 1).height = 20;
    ws.getRow(r + 2).height = 20;
    r += 3;

    if (sheet.reactionContact) {
        ws.mergeCells(r, FIRST_COL, r, LAST_COL);
        setVal(ws, r, FIRST_COL, `CONTACTO: ${sheet.reactionContact}`, {
            font: { bold: true, size: 9, color: { argb: `FF${RED_TEXT}` } },
            fill: RED_HEADER,
        });
        fillBorders(ws, r, FIRST_COL, r, LAST_COL, BORDER_ALL, RED_HEADER);
    }
}

function buildHoWorkbook(doc) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = doc.header?.organization || 'Barack Mercosul';
    workbook.created = new Date();

    if ((doc.sheets || []).length === 0) {
        const ws = workbook.addWorksheet('Vacio');
        ws.getCell('B2').value = 'Sin hojas de operaciones definidas';
    } else {
        for (const sheet of doc.sheets) {
            buildHoSheet(workbook, sheet, doc);
        }
    }

    return workbook;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('=== Insert Patagonia Export Generator ===\n');

    // Auth
    console.log('[1] Authenticating...');
    await initSupabase();

    // Step 1: Find family
    console.log('\n[2] Finding Insert Patagonia family...');
    const family = await findInsertPatagoniaFamily();

    // Step 2: Find linked documents
    console.log('\n[3] Finding family documents...');
    const familyDocs = await findFamilyDocuments(family.id);

    const amfeDoc = familyDocs.find(d => d.module === 'amfe');
    const cpDoc = familyDocs.find(d => d.module === 'cp');
    const hoDoc = familyDocs.find(d => d.module === 'ho');

    if (!amfeDoc) console.warn('  WARNING: No AMFE document found for Insert Patagonia');
    if (!cpDoc) console.warn('  WARNING: No CP document found for Insert Patagonia');
    if (!hoDoc) console.warn('  WARNING: No HO document found for Insert Patagonia');

    // Step 3: Load documents
    console.log('\n[4] Loading documents...');

    let amfeData, cpData, hoData;
    if (amfeDoc) amfeData = await loadAmfeDocument(amfeDoc.document_id);
    if (cpDoc) cpData = await loadCpDocument(cpDoc.document_id);
    if (hoDoc) hoData = await loadHoDocument(hoDoc.document_id);

    // Step 4: Generate exports
    console.log('\n[5] Generating XLSX files...');

    const outputDir = path.join(PROJECT_ROOT, 'exports');

    // --- AMFE ---
    if (amfeData) {
        try {
            console.log('\n  === AMFE Export ===');
            const wb = buildAmfeWorkbook(amfeData);
            const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
            const filePath = path.join(outputDir, 'test-amfe-insert.xlsx');
            fs.writeFileSync(filePath, buffer);
            const stats = fs.statSync(filePath);

            // Count data points
            let totalCauses = 0;
            for (const op of amfeData.operations) {
                for (const we of op.workElements) {
                    for (const func of we.functions) {
                        for (const fail of func.failures) {
                            totalCauses += fail.causes.length;
                        }
                    }
                }
            }

            console.log(`  File: ${filePath}`);
            console.log(`  Size: ${(stats.size / 1024).toFixed(1)} KB`);
            console.log(`  Generated: YES`);
            console.log(`  Operations: ${amfeData.operations.length}`);
            console.log(`  Total cause rows: ${totalCauses}`);
            console.log(`  Sheets: 1 (AMFE)`);
            console.log(`  First operation: "${amfeData.operations[0]?.opNumber} - ${amfeData.operations[0]?.name}"`);
            console.log(`  Part number: "${amfeData.header?.partNumber || ''}"`);
            console.log(`  Client: "${amfeData.header?.client || ''}"`);
            console.log(`  Subject: "${amfeData.header?.subject || ''}"`);
            console.log(`  Organization: "${amfeData.header?.organization || ''}"`);
            console.log(`  Contains real data: ${totalCauses > 0 ? 'YES' : 'NO'}`);
        } catch (err) {
            console.error(`  AMFE export FAILED: ${err.message}`);
        }
    }

    // --- CP ---
    if (cpData) {
        try {
            console.log('\n  === Control Plan Export ===');
            const wb = buildCpWorkbook(cpData);
            const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
            const filePath = path.join(outputDir, 'test-cp-insert.xlsx');
            fs.writeFileSync(filePath, buffer);
            const stats = fs.statSync(filePath);

            // Count items with controlMethod
            const withControlMethod = cpData.items.filter(i => i.controlMethod?.trim()).length;

            console.log(`  File: ${filePath}`);
            console.log(`  Size: ${(stats.size / 1024).toFixed(1)} KB`);
            console.log(`  Generated: YES`);
            console.log(`  Items: ${cpData.items.length}`);
            console.log(`  Items with controlMethod: ${withControlMethod}`);
            console.log(`  Sheets: 1 (Plan de Control)`);
            console.log(`  First item: "${cpData.items[0]?.processStepNumber} - ${cpData.items[0]?.processDescription}"`);
            console.log(`  Part number: "${cpData.header?.partNumber || ''}"`);
            console.log(`  Client: "${cpData.header?.client || ''}"`);
            console.log(`  Organization: "${cpData.header?.organization || ''}"`);
            console.log(`  Phase: "${cpData.header?.phase || ''}"`);
            console.log(`  Contains real data: ${cpData.items.length > 0 ? 'YES' : 'NO'}`);
        } catch (err) {
            console.error(`  CP export FAILED: ${err.message}`);
        }
    }

    // --- HO ---
    if (hoData) {
        try {
            console.log('\n  === Hoja de Operaciones Export ===');
            const wb = buildHoWorkbook(hoData);
            const buffer = await wb.xlsx.writeBuffer();
            const filePath = path.join(outputDir, 'test-ho-insert.xlsx');
            fs.writeFileSync(filePath, new Uint8Array(buffer));
            const stats = fs.statSync(filePath);

            let totalSteps = 0;
            let totalQCs = 0;
            for (const sheet of hoData.sheets) {
                totalSteps += (sheet.steps || []).length;
                totalQCs += (sheet.qualityChecks || []).length;
            }

            console.log(`  File: ${filePath}`);
            console.log(`  Size: ${(stats.size / 1024).toFixed(1)} KB`);
            console.log(`  Generated: YES`);
            console.log(`  Sheets: ${hoData.sheets.length}`);
            console.log(`  Total TWI steps: ${totalSteps}`);
            console.log(`  Total quality checks: ${totalQCs}`);
            console.log(`  First sheet: "${hoData.sheets[0]?.operationNumber} - ${hoData.sheets[0]?.operationName}"`);
            console.log(`  Part number: "${hoData.header?.partNumber || ''}"`);
            console.log(`  Client: "${hoData.header?.client || ''}"`);
            console.log(`  Organization: "${hoData.header?.organization || ''}"`);
            console.log(`  Contains real data: ${totalSteps > 0 ? 'YES' : 'NO'}`);
        } catch (err) {
            console.error(`  HO export FAILED: ${err.message}`);
        }
    }

    console.log('\n=== Export Complete ===');

    close();
}

main().catch(err => {
    console.error('FATAL ERROR:', err.message);
    process.exit(1);
});
