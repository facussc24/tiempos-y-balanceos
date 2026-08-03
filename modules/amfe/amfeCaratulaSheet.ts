/**
 * amfeCaratulaSheet.ts — Hoja "Caratula" del AMFE oficial (formulario I-AC-005.3)
 *
 * Replica el formato de la caratula del AMFE 150 Patagonia (primera hoja del
 * formato oficial de Barack): bloque de identificacion, tabla de REVISIONES y
 * firmas de aprobacion. Cumple el I-IN-002: nivel de revision vigente EN ROJO,
 * y toda modificacion registrada en la primera hoja del formato.
 *
 * La hoja se antepone al workbook del AMFE (queda como primera hoja) — ver
 * buildAmfeOficialWorkbook en amfeExcelExport.ts.
 *
 * Un solo punto de lectura tolerante para el historial de revisiones
 * (normalizeRevisions): la data live convive con varios shapes historicos.
 */

import XLSX from 'xlsx-js-style';
import type { AmfeDocument } from './amfeTypes';
import { sanitizeCellValue } from '../../utils/sanitizeCellValue';
import { formatDateAR } from '../../utils/formatting';

// ============================================================================
// Tipos
// ============================================================================

/** Estado de ciclo de vida del documento (espejo de amfe_documents.status). */
export type AmfeLifecycleStatus = 'draft' | 'inReview' | 'approved' | 'archived';

/** Entrada de revision normalizada para la tabla REVISIONES de la caratula. */
export interface AmfeOfficialRevision {
    rev: string;
    date: string;
    /** Item/OP cambiado (columna ITEM CAMBIADO). Opcional. */
    item?: string;
    details: string;
    /** Fecha PSW (Part Submission Warrant). Opcional. */
    pswDate?: string;
    modifiedBy?: string;
}

// ============================================================================
// Estilos (paleta estandar, aspecto hecho a mano — coherente con amfeExcelExport)
// ============================================================================

const BORDER = {
    top: { style: 'thin' as const, color: { rgb: '000000' } },
    bottom: { style: 'thin' as const, color: { rgb: '000000' } },
    left: { style: 'thin' as const, color: { rgb: '000000' } },
    right: { style: 'thin' as const, color: { rgb: '000000' } },
};

const S = {
    title: {
        font: { bold: true, sz: 14, name: 'Arial' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    },
    formRef: {
        font: { sz: 8, color: { rgb: '808080' }, name: 'Arial' },
        alignment: { horizontal: 'right' as const },
    },
    band: {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Arial' },
        fill: { fgColor: { rgb: '1F3864' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    label: {
        font: { bold: true, sz: 9, name: 'Arial' },
        fill: { fgColor: { rgb: 'F2F2F2' } },
        alignment: { vertical: 'center' as const, wrapText: true },
        border: BORDER,
    },
    value: {
        font: { sz: 9, name: 'Arial' },
        alignment: { vertical: 'center' as const, wrapText: true },
        border: BORDER,
    },
    /** Valor destacado en ROJO (nivel de revision vigente — I-IN-002). */
    valueRed: {
        font: { bold: true, sz: 11, name: 'Arial', color: { rgb: 'FF0000' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    colHeader: {
        font: { bold: true, sz: 9, name: 'Arial' },
        fill: { fgColor: { rgb: 'D9E2F3' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
        border: BORDER,
    },
    cell: {
        font: { sz: 9, name: 'Arial' },
        alignment: { vertical: 'top' as const, wrapText: true },
        border: BORDER,
    },
    cellCenter: {
        font: { sz: 9, name: 'Arial' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    /** Rev vigente EN ROJO dentro de la tabla de revisiones. */
    cellRevRed: {
        font: { bold: true, sz: 9, name: 'Arial', color: { rgb: 'FF0000' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: BORDER,
    },
    empty: { border: BORDER },
    signSpace: {
        border: { bottom: { style: 'thin' as const, color: { rgb: '000000' } } },
    },
    signLabel: {
        font: { bold: true, sz: 9, name: 'Arial' },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    },
};

// 12 columnas: 3 pares (label 2 cols + valor 2 cols) por fila.
const COLS = 12;
const COL_WIDTHS = [9, 9, 11, 11, 9, 9, 11, 11, 9, 9, 11, 13];
/** Minimo de filas de la tabla de revisiones (aspecto de formulario). */
const MIN_REV_ROWS = 15;

// ============================================================================
// Lectura tolerante de header (la data live tiene aliases historicos)
// ============================================================================

type HeaderLike = Record<string, unknown>;

/**
 * Alias historicos por campo. La data live nunca uso un solo nombre: los AMFE
 * importados de Excel guardaron `amfeDate` / `revisionDate` / `coreTeam`, y los
 * creados desde la app usan `startDate` / `revDate` / `team`. Leer solo el nombre
 * canonico deja el campo VACIO en el export aunque el dato este cargado.
 * (Incidente 2026-08-03: 9 caratulas salieron sin fecha de inicio teniendo el
 * dato en `amfeDate`, y la hoja AMFE sin equipo teniendolo en `coreTeam`.)
 * UNICA fuente de verdad: la usan la Caratula y la hoja AMFE.
 */
export const HEADER_ALIASES = {
    startDate: ['startDate', 'amfeDate'],
    revDate: ['revDate', 'revisionDate', 'lastRevisionDate'],
    revision: ['revision', 'revisionLevel', 'rev'],
    responsible: ['responsible', 'responsibleEngineer', 'processResponsible'],
    processResponsible: ['processResponsible', 'responsible'],
    approvedBy: ['approvedBy', 'plantApproval'],
    organization: ['organization', 'companyName'],
    client: ['client', 'customerName'],
} as const;

export function readField(h: HeaderLike, ...keys: string[]): string {
    for (const k of keys) {
        const v = h[k];
        if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
}

/** Lee un campo del header por su nombre canonico, probando todos sus alias. */
export function readAliased(h: HeaderLike, field: keyof typeof HEADER_ALIASES): string {
    return readField(h, ...HEADER_ALIASES[field]);
}

// ============================================================================
// Alto de fila por contenido — compartido por la Caratula y la hoja AMFE
// ============================================================================

/** Alto de UNA linea de texto, en puntos. Coincide con el autoajuste de Excel. */
const LINE_PT = 10.2;

interface MergeRange { s: { r: number; c: number }; e: { r: number; c: number } }

/**
 * Calcula el alto de cada fila segun cuanto texto entra en el ancho de sus
 * columnas. Sin esto Excel deja todas las filas en el alto por defecto (15pt) y
 * el texto con wrap sale CORTADO: en la hoja AMFE hay celdas de 200+ caracteres
 * en columnas de 20 de ancho. Fak lo venia arreglando a mano con "autoajustar
 * alto de fila" en cada archivo entregado (2026-08-03).
 *
 * Reglas: se ignoran las celdas tapadas por un merge (no tienen texto propio) y
 * las de merge VERTICAL (su texto se reparte entre varias filas, no estira una).
 * Un merge HORIZONTAL suma el ancho de las columnas que abarca.
 */
export function computeRowHeights(
    rows: ReadonlyArray<ReadonlyArray<{ v?: unknown } | null | undefined>>,
    colWidths: readonly number[],
    merges: readonly MergeRange[] = [],
    opts: { minPt?: number; maxPt?: number; extraPt?: number } = {},
): Array<{ hpt: number }> {
    const { minPt = 15, maxPt = 130, extraPt = 0 } = opts;

    // Indice de merges: por celda ancla -> ancho de columnas; celdas tapadas -> skip.
    const spanByAnchor = new Map<string, number>();
    const covered = new Set<string>();
    const verticalAnchor = new Set<string>();
    for (const m of merges) {
        const anchor = `${m.s.r}:${m.s.c}`;
        spanByAnchor.set(anchor, m.e.c - m.s.c + 1);
        if (m.e.r > m.s.r) verticalAnchor.add(anchor);
        for (let r = m.s.r; r <= m.e.r; r++) {
            for (let c = m.s.c; c <= m.e.c; c++) {
                if (r !== m.s.r || c !== m.s.c) covered.add(`${r}:${c}`);
            }
        }
    }

    return rows.map((row, r) => {
        let maxLines = 1;
        for (let c = 0; c < row.length; c++) {
            const key = `${r}:${c}`;
            if (covered.has(key) || verticalAnchor.has(key)) continue;
            const raw = row[c]?.v;
            if (raw == null || raw === '') continue;

            const span = spanByAnchor.get(key) ?? 1;
            let width = 0;
            for (let k = 0; k < span; k++) width += colWidths[c + k] ?? 9;
            // Margen interno de la celda: ~1 caracter por lado.
            const chars = Math.max(4, Math.floor(width) - 2);

            let lines = 0;
            for (const segment of String(raw).split('\n')) {
                lines += Math.max(1, Math.ceil(segment.length / chars));
            }
            if (lines > maxLines) maxLines = lines;
        }
        const hpt = Math.min(maxPt, Math.max(minPt, maxLines * LINE_PT + extraPt));
        return { hpt: Math.round(hpt * 10) / 10 };
    });
}

/**
 * Devuelve el equipo multifuncional como lista "Nombre — Area".
 * Tolera header.coreTeam (array) o header.team (string separado por coma/nueva linea).
 */
export function readTeam(h: HeaderLike): string[] {
    const core = h.coreTeam;
    if (Array.isArray(core)) {
        return core.map(x => String(x).trim()).filter(Boolean);
    }
    const team = readField(h, 'team');
    if (!team) return [];
    return team.split(/[\n;]|(?:,(?=\s*[A-ZÁÉÍÓÚ]))/).map(s => s.trim()).filter(Boolean);
}

// ============================================================================
// normalizeRevisions — UNICO punto de lectura del historial de revisiones
// ============================================================================

/**
 * Normaliza el historial de revisiones desde cualquiera de los shapes que
 * conviven en la data live:
 *   - script/registry: { rev, date, description, modifiedBy?/responsible?, item?, pswDate? }
 *   - legacy TS AmfeRevisionEntry: { date, reason, revisedBy, description }
 *   - registry historial: { rev, date, description, solicitante, aprobador, vinculo }
 * Acepta un array, un JSON string de array, o null/undefined.
 */
export function normalizeRevisions(raw: unknown): AmfeOfficialRevision[] {
    let arr: unknown = raw;
    if (typeof raw === 'string') {
        try { arr = JSON.parse(raw); } catch { return []; }
    }
    if (!Array.isArray(arr)) return [];

    return arr
        .filter((e): e is Record<string, unknown> => e != null && typeof e === 'object')
        .map(e => {
            const get = (...keys: string[]): string => {
                for (const k of keys) {
                    const v = e[k];
                    if (v != null && String(v).trim() !== '') return String(v).trim();
                }
                return '';
            };
            return {
                rev: get('rev', 'revision', 'revisionLevel', 'level'),
                date: get('date', 'fecha'),
                item: get('item', 'itemChanged', 'changedItem'),
                details: get('description', 'details', 'reason', 'descripcion', 'detalle'),
                pswDate: get('pswDate', 'fechaPsw'),
                modifiedBy: get('modifiedBy', 'responsible', 'revisedBy', 'solicitante', 'modifico'),
            };
        });
}

// ============================================================================
// buildCaratulaSheet
// ============================================================================

interface Cell { v: string; s: object; }
const cell = (v: string, s: object): Cell => ({ v: String(sanitizeCellValue(v)), s });
const blank = (s: object = S.empty): Cell => ({ v: '', s });

/** Emite una fila de 3 pares label/valor (cada uno mergeado en 2 columnas). */
function pairRow(
    rowIdx: number,
    pairs: Array<[label: string, value: string, valueStyle?: object]>,
    merges: XLSX.Range[],
): Cell[] {
    const row: Cell[] = Array.from({ length: COLS }, () => blank());
    pairs.forEach(([label, value, valueStyle], i) => {
        const base = i * 4;
        if (base + 3 >= COLS) return;
        row[base] = cell(label, S.label);
        row[base + 1] = blank(S.label);
        row[base + 2] = cell(value, valueStyle ?? S.value);
        row[base + 3] = blank(valueStyle ?? S.value);
        merges.push({ s: { r: rowIdx, c: base }, e: { r: rowIdx, c: base + 1 } });
        merges.push({ s: { r: rowIdx, c: base + 2 }, e: { r: rowIdx, c: base + 3 } });
    });
    return row;
}

function bandRow(rowIdx: number, text: string, merges: XLSX.Range[]): Cell[] {
    const row: Cell[] = Array.from({ length: COLS }, () => blank(S.band));
    row[0] = cell(text, S.band);
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: COLS - 1 } });
    return row;
}

/**
 * Construye la hoja "Caratula" del AMFE oficial.
 * @param doc documento AMFE (header con aliases tolerados)
 * @param opts revisiones normalizadas + estado de ciclo de vida (PRELIMINAR si != approved)
 */
export function buildCaratulaSheet(
    doc: AmfeDocument,
    opts: { revisions: AmfeOfficialRevision[]; status: AmfeLifecycleStatus },
): XLSX.WorkSheet {
    const h = doc.header as unknown as HeaderLike;
    const merges: XLSX.Range[] = [];
    const rows: Cell[][] = [];
    const push = (r: Cell[]) => rows.push(r);
    const rowIdx = () => rows.length;

    const org = readAliased(h, 'organization') || 'BARACK MERCOSUL';
    const subject = readField(h, 'subject');
    const amfeNumber = readField(h, 'amfeNumber');
    const location = readField(h, 'location');
    // Formato AR en las dos hojas: la data live mezcla ISO (2025-04-07) y
    // DD/MM/YYYY, y la caratula imprimia el crudo mientras la hoja AMFE lo
    // convertia — el mismo AMFE mostraba la fecha de dos formas distintas.
    const startDate = formatDateAR(readAliased(h, 'startDate'));
    const processResp = readAliased(h, 'processResponsible');
    const client = readAliased(h, 'client');
    const revDate = formatDateAR(readAliased(h, 'revDate'));
    const confidentiality = readField(h, 'confidentiality') || '-';
    const modelYear = readField(h, 'modelYear');
    const rev = readAliased(h, 'revision') || 'A';
    const isPreliminar = opts.status !== 'approved';

    // --- Titulo + referencia de formulario ---
    const titleText = `A.M.F.E. DE PROCESO${isPreliminar ? ' PRELIMINAR' : ''}`;
    const titleRow: Cell[] = Array.from({ length: COLS }, () => blank(S.title));
    titleRow[0] = cell(titleText, S.title);
    merges.push({ s: { r: rowIdx(), c: 0 }, e: { r: rowIdx(), c: COLS - 1 } });
    push(titleRow);

    const formRow: Cell[] = Array.from({ length: COLS }, () => ({ v: '', s: {} }));
    formRow[0] = { v: 'Formulario I-AC-005.3', s: S.formRef };
    merges.push({ s: { r: rowIdx(), c: 0 }, e: { r: rowIdx(), c: COLS - 1 } });
    push(formRow);

    push(Array.from({ length: COLS }, () => ({ v: '', s: {} }))); // spacer

    // --- Bloque de identificacion ---
    push(pairRow(rowIdx(), [
        ['NOMBRE DE LA ORGANIZACION', org],
        ['TEMA', subject],
        ['N° DE AMFE', amfeNumber],
    ], merges));
    push(pairRow(rowIdx(), [
        ['LOCACION DE LA PLANTA', location],
        ['FECHA DE INICIO', startDate],
        ['RESPONSABLE DEL PROCESO', processResp],
    ], merges));
    push(pairRow(rowIdx(), [
        ['NOMBRE DEL CLIENTE', client],
        ['FECHA DE REVISION', revDate],
        ['NIVEL DE CONFIDENCIALIDAD', confidentiality],
    ], merges));
    push(pairRow(rowIdx(), [
        ['MODELO-AÑO PLATAFORMA', modelYear],
        ['NIVEL DE REVISION', rev, S.valueRed],   // rev vigente EN ROJO (I-IN-002)
        ['', ''],
    ], merges));

    // --- Equipo multifuncional ---
    push(bandRow(rowIdx(), 'EQUIPO MULTIFUNCIONAL', merges));
    const team = readTeam(h);
    const PER_ROW = 3;                       // 3 miembros por fila (4 cols c/u)
    const teamRowCount = Math.max(1, Math.ceil(team.length / PER_ROW));
    for (let r = 0; r < teamRowCount; r++) {
        const ri = rowIdx();
        const row: Cell[] = Array.from({ length: COLS }, () => blank());
        for (let c = 0; c < PER_ROW; c++) {
            const member = team[r * PER_ROW + c] || '';
            const base = c * 4;
            row[base] = cell(member, S.value);
            for (let k = 1; k < 4; k++) row[base + k] = blank(S.value);
            merges.push({ s: { r: ri, c: base }, e: { r: ri, c: base + 3 } });
        }
        push(row);
    }

    push(Array.from({ length: COLS }, () => ({ v: '', s: {} }))); // spacer

    // --- Tabla de REVISIONES ---
    push(bandRow(rowIdx(), 'REVISIONES', merges));

    // Encabezado: REV | FECHA | ITEM CAMBIADO | DETALLES | FECHA PSW | MODIFICO
    const headerIdx = rowIdx();
    const revHeaders: Array<[string, number]> = [
        ['REV', 1], ['FECHA', 2], ['ITEM CAMBIADO', 2], ['DETALLES', 4], ['FECHA PSW', 1], ['MODIFICO', 2],
    ];
    {
        const row: Cell[] = Array.from({ length: COLS }, () => blank(S.colHeader));
        let c = 0;
        for (const [label, span] of revHeaders) {
            row[c] = cell(label, S.colHeader);
            for (let k = 1; k < span; k++) row[c + k] = blank(S.colHeader);
            if (span > 1) merges.push({ s: { r: headerIdx, c }, e: { r: headerIdx, c: c + span - 1 } });
            c += span;
        }
        push(row);
    }

    // Filas de datos (rev vigente en rojo). Relleno hasta MIN_REV_ROWS.
    const revs = opts.revisions;
    const dataRowCount = Math.max(revs.length, MIN_REV_ROWS);
    for (let i = 0; i < dataRowCount; i++) {
        const ri = rowIdx();
        const rv = revs[i];
        const isCurrent = !!rv && rv.rev !== '' && rv.rev === rev;
        const revStyle = isCurrent ? S.cellRevRed : S.cellCenter;
        const cols: Array<[value: string, span: number, style: object]> = [
            [rv?.rev ?? '', 1, revStyle],
            [rv?.date ?? '', 2, S.cellCenter],
            [rv?.item ?? '', 2, S.cellCenter],
            [rv?.details ?? '', 4, S.cell],
            [rv?.pswDate ?? '', 1, S.cellCenter],
            [rv?.modifiedBy ?? '', 2, S.cellCenter],
        ];
        const row: Cell[] = Array.from({ length: COLS }, () => blank());
        let c = 0;
        for (const [value, span, style] of cols) {
            row[c] = cell(value, style);
            for (let k = 1; k < span; k++) row[c + k] = blank(style);
            if (span > 1) merges.push({ s: { r: ri, c }, e: { r: ri, c: c + span - 1 } });
            c += span;
        }
        push(row);
    }

    push(Array.from({ length: COLS }, () => ({ v: '', s: {} }))); // spacer

    // --- Firmas de aprobacion ---
    push(bandRow(rowIdx(), 'FIRMAS DE APROBACION', merges));
    // Espacio para firma (fila alta con borde inferior)
    const signSpaceIdx = rowIdx();
    {
        const row: Cell[] = Array.from({ length: COLS }, () => blank(S.signSpace));
        // 3 bloques de 4 columnas
        for (let b = 0; b < 3; b++) merges.push({ s: { r: signSpaceIdx, c: b * 4 }, e: { r: signSpaceIdx, c: b * 4 + 3 } });
        push(row);
    }
    // Etiquetas de firma: SOLO el rol, sin nombre impreso.
    // El formulario I-AC-005.3 real deja los casilleros en blanco para firma
    // manuscrita (ver AMFE 131 y 144 en el servidor). Los nombres pertenecen al
    // bloque EQUIPO MULTIFUNCIONAL, de arriba. Imprimir `approvedBy` aca hacia
    // figurar a Gonzalo Cal (que firma HO/Planta) como firmante de CALIDAD en 11
    // documentos — error reportado por Fak el 2026-08-03.
    {
        const ri = rowIdx();
        const blocks: Array<[string, string]> = [
            ['INGENIERIA', ''],
            ['CALIDAD', ''],
            ['CLIENTE', ''],
        ];
        const row: Cell[] = Array.from({ length: COLS }, () => blank({}));
        blocks.forEach(([role, name], b) => {
            const base = b * 4;
            row[base] = cell(name ? `${role}\n${name}` : role, S.signLabel);
            for (let k = 1; k < 4; k++) row[base + k] = blank({});
            merges.push({ s: { r: ri, c: base }, e: { r: ri, c: base + 3 } });
        });
        push(row);
    }

    // --- Materializar hoja ---
    const ws = XLSX.utils.aoa_to_sheet(rows.map(r => r.map(c => ({ v: c.v, t: 's', s: c.s }))));
    ws['!cols'] = COL_WIDTHS.map(w => ({ wch: w }));
    ws['!merges'] = merges;
    // Alto por contenido; el bloque de identificacion y el encabezado de
    // REVISIONES van con aire extra (asi los dejaba Fak a mano).
    const heights = computeRowHeights(rows, COL_WIDTHS, merges, { minPt: 18, maxPt: 90, extraPt: 6 });
    heights[signSpaceIdx] = { hpt: 42 };   // espacio para la firma manuscrita
    ws['!rows'] = heights;
    ws['!margins'] = { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };
    return ws;
}
