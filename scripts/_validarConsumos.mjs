/**
 * _validarConsumos.mjs — Validador de tablas de consumo contra las reglas
 * canonicas (scripts/_lib/consumosCanon.data.json).
 *
 * Enforcement de las lecciones 2026-07-14/16: la regla canonica le gana al dato
 * puntual; el chequeo corre sobre la TABLA FINAL antes de entregarla a Fak.
 * READ-ONLY: no modifica nada, solo reporta.
 *
 * Uso:
 *   node scripts/_validarConsumos.mjs <tabla.xlsx|.csv> [opciones]
 *
 * Opciones:
 *   --sheet <nombre|indice>   hoja del xlsx (default: primera)
 *   --producto <clave>        aplica invariantes de esa clave del canon (ej P703-EFG)
 *   --pzas-caja <n>           valida etiqueta 100x60 == 1/n
 *   --insumos <archivo>       maestro codigo→unidad pasado a mano (INSUMOS.TXT TABULADO o
 *                             csv codigo,desc,unidad). Desde el 05/09/2026 NO hace falta: el
 *                             maestro se busca solo en C:\tmp (INSUMOS/RELACIONES) y .arb-cache
 *   --arb-dir <carpeta>       donde estan los exports del arb (default C:\tmp)
 *   --arb-cache <carpeta>     donde esta el cache del arb (default .arb-cache del repo)
 *   --compare <colA> <colB>   compara 2 columnas numericas (por header) con
 *                             tolerancia 0,1% — para "doc vs actual en arb"
 *   --col-codigo <header>     override de autodeteccion de columnas
 *   --col-desc <header>
 *   --col-valor <header>
 *   --col-unidad <header>
 *
 * Salida: tabla de hallazgos + exit 1 si hay FAIL, 0 si todo PASS.
 * Checklist completo (pasos manuales incluidos): skill verificacion-consumos.
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { cargarMaestroUnidades, compararUnidad, normalizarUnidad, claveCodigo, fechaCorta, TMP_ARB, CACHE_ARB } from './_lib/unidadesArb.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const CANON = JSON.parse(readFileSync(join(__dir, '_lib', 'consumosCanon.data.json'), 'utf8'));
const TOL = CANON.tolerancia_relativa;

// ─── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const file = argv.find(a => !a.startsWith('--'));
function opt(name, n = 1) {
    const i = argv.indexOf(`--${name}`);
    if (i < 0) return null;
    return n === 1 ? argv[i + 1] : argv.slice(i + 1, i + 1 + n);
}
if (!file || !existsSync(file)) {
    console.error('Uso: node scripts/_validarConsumos.mjs <tabla.xlsx|.csv> [--producto P703-EFG] [--pzas-caja N] [--arb-dir C:\\tmp] [--insumos maestro] [--compare colA colB]');
    process.exit(2);
}

// ─── carga de la tabla → rows: array de objetos {header: valor} ─────────────
async function loadRows(path) {
    const ext = extname(path).toLowerCase();
    if (ext === '.csv' || ext === '.txt') {
        const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
        const headers = lines[0].split(sep).map(h => h.trim());
        return lines.slice(1).map(l => {
            const cells = l.split(sep);
            return Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()]));
        });
    }
    // xlsx via ExcelJS (ya en package.json)
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path);
    const sheetOpt = opt('sheet');
    const ws = sheetOpt
        ? (wb.getWorksheet(isNaN(+sheetOpt) ? sheetOpt : +sheetOpt))
        : wb.worksheets[0];
    if (!ws) { console.error(`Hoja no encontrada: ${sheetOpt}`); process.exit(2); }
    const rows = [];
    let headers = null;
    ws.eachRow(row => {
        const vals = row.values.slice(1).map(v => {
            if (v == null) return '';
            if (typeof v === 'object') return String(v.result ?? v.text ?? v.richText?.map(r => r.text).join('') ?? '');
            return String(v);
        });
        if (!headers) {
            if (vals.filter(Boolean).length >= 2) headers = vals.map(v => v.trim());
            return;
        }
        rows.push(Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()])));
    });
    return rows;
}

// ─── deteccion de columnas ──────────────────────────────────────────────────
function detectCol(headers, override, patterns) {
    if (override) {
        const h = headers.find(x => x.toLowerCase() === override.toLowerCase());
        if (!h) { console.error(`Columna "${override}" no existe. Headers: ${headers.join(' | ')}`); process.exit(2); }
        return h;
    }
    return headers.find(h => patterns.some(p => new RegExp(p, 'i').test(h))) ?? null;
}

function toNum(v) {
    if (v == null || v === '') return null;
    const n = parseFloat(String(v).replace(/\./g, m => m).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

// ─── checks ─────────────────────────────────────────────────────────────────
const findings = [];
function flag(nivel, check, detalle) { findings.push({ nivel, check, detalle }); }

const rows = await loadRows(file);
if (!rows.length) { console.error('Tabla vacia o sin headers detectables.'); process.exit(2); }
const headers = Object.keys(rows[0]);

const cCod = detectCol(headers, opt('col-codigo'), ['c[oó]digo', '^cod', 'code', 'articulo']);
const cDesc = detectCol(headers, opt('col-desc'), ['desc', 'art[ií]culo', 'material', 'insumo', 'denominac']);
const cVal = detectCol(headers, opt('col-valor'), ['consumo', 'cant', 'valor', 'qty', 'ml\\b']);
const cUni = detectCol(headers, opt('col-unidad'), ['unidad', '^um$', 'u\\.m', 'medida']);

console.log(`Tabla: ${file} — ${rows.length} filas`);
console.log(`Columnas detectadas → codigo: ${cCod ?? '-'} | desc: ${cDesc ?? '-'} | valor: ${cVal ?? '-'} | unidad: ${cUni ?? '-'}\n`);
if (!cDesc || !cVal) {
    console.error('No pude detectar columnas desc/valor. Usa --col-desc y --col-valor.');
    process.exit(2);
}

const desc = r => String(r[cDesc] ?? '');
const val = r => toNum(r[cVal]);

// 1. Codigos duplicados
if (cCod) {
    const seen = new Map();
    for (const r of rows) {
        const c = String(r[cCod] ?? '').trim();
        if (!c) continue;
        if (seen.has(c) && seen.get(c) !== val(r)) {
            flag('FAIL', 'CODIGO_DUPLICADO', `${c} aparece con valores distintos: ${seen.get(c)} vs ${val(r)}`);
        }
        seen.set(c, val(r));
    }
}

// 2. Quimicos con valor identico (fraccion-de-envase 1:1 sospechosa)
const quimicoRe = new RegExp(CANON.quimicos_regex, 'i');
const quimicos = rows.filter(r => quimicoRe.test(desc(r)) && val(r) != null);
for (let i = 0; i < quimicos.length; i++) {
    for (let j = i + 1; j < quimicos.length; j++) {
        const a = quimicos[i], b = quimicos[j];
        if (val(a) === val(b) && desc(a) !== desc(b)) {
            flag('FAIL', 'QUIMICO_VALOR_IDENTICO',
                `"${desc(a)}" y "${desc(b)}" tienen el MISMO valor (${val(a)}). ${CANON.quimicos_regla}`);
        }
    }
}

// 3. Etiquetas
const pzasCaja = toNum(opt('pzas-caja'));
for (const r of rows) {
    const d = desc(r); const v = val(r);
    if (v == null) continue;
    if (new RegExp(CANON.etiquetas['100x60'].regex, 'i').test(d)) {
        if (pzasCaja) {
            const esperado = 1 / pzasCaja;
            if (Math.abs(v - esperado) / esperado > TOL) {
                flag('FAIL', 'ETIQUETA_100X60', `"${d}" = ${v}, esperado 1/${pzasCaja} = ${esperado.toFixed(6)}. ${CANON.etiquetas['100x60'].regla}`);
            }
        } else if (v >= 0.5) {
            flag('WARN', 'ETIQUETA_100X60', `"${d}" = ${v} parece POR PIEZA. ${CANON.etiquetas['100x60'].regla}. Pasa --pzas-caja N para chequeo exacto.`);
        }
    }
    if (new RegExp(CANON.etiquetas['50x20'].regex, 'i').test(d)) {
        if (!CANON.etiquetas['50x20'].valores_validos.includes(v)) {
            flag('WARN', 'ETIQUETA_50X20', `"${d}" = ${v}. ${CANON.etiquetas['50x20'].regla}`);
        }
    }
}

// 4. Unidades: la de la tabla tiene que ser la del MAESTRO del arb (BOM = maestro = factura).
//    Hasta el 05/09/2026 esto solo corria si alguien pasaba --insumos a mano, y desde el 28/08 el
//    INSUMOS.TXT exportado era el listado impreso (sin unidad): 4 de las 7 correcciones que
//    llegaron de afuera entre julio y septiembre fueron de unidad. Ahora el maestro se busca solo
//    (scripts/_lib/unidadesArb.mjs) y el reporte dice de que fuente y de que fecha salio cada unidad.
const insumosPath = opt('insumos');
if (insumosPath && !existsSync(insumosPath)) { console.error(`--insumos: no existe ${insumosPath}`); process.exit(2); }
if (!cUni) {
    flag('WARN', 'TABLA_SIN_UNIDAD', `La tabla no tiene columna de unidad (o no la detecte: --col-unidad), asi que no se en que unidad esta cada consumo. ${CANON.unidades_tres_fuentes.regla_corta}`);
} else if (!cCod) {
    flag('INFO', 'UNIDAD_SIN_CODIGO', `Sin columna de codigo no puedo cruzar unidades con el maestro (--col-codigo). ${CANON.unidades_tres_fuentes.regla_corta}`);
} else {
    const maestro = cargarMaestroUnidades({ tmpDir: opt('arb-dir') ?? TMP_ARB, cacheDir: opt('arb-cache') ?? CACHE_ARB, extra: insumosPath });
    console.log('Maestro de unidades: ' + (maestro.fuentes.length
        ? maestro.fuentes.map(f => `${f.nombre} (${fechaCorta(f.fecha)}, ${f.codigos} codigos)`).join(' · ')
        : 'NINGUNA FUENTE') + '\n');
    for (const a of maestro.avisos) flag('WARN', 'UNIDAD_FUENTE', a);
    if (!maestro.mapa.size) {
        flag('WARN', 'UNIDAD_SIN_MAESTRO', 'No encontre ningun maestro de unidades (ni INSUMOS.TXT tabulado, ni RELACIONES.TXT, ni .arb-cache): no puedo validar unidades. Exportar del arb a C:\\tmp o pasar --insumos.');
    }
    const cambios = new Map(maestro.cambios.map(x => [x.clave, x]));
    // Se valida CADA par codigo+unidad distinto: la misma fila repetida no se reporta dos veces,
    // pero una segunda fila del mismo codigo con OTRA unidad si (auditor Ola 4: con un Set por
    // codigo, el typo de la segunda fila pasaba sin FAIL).
    const paresVistos = new Set();
    const cambioAvisado = new Set();
    for (const r of rows) {
        const c = String(r[cCod] ?? '').trim();
        const u = String(r[cUni] ?? '').trim();
        if (!c) continue;
        const k = claveCodigo(c);
        const par = `${k}|${normalizarUnidad(u).crudo}`;
        if (paresVistos.has(par)) continue;
        paresVistos.add(par);
        const m = maestro.mapa.get(k);
        if (!m) {
            if (maestro.mapa.size) flag('WARN', 'UNIDAD_CODIGO_SIN_MAESTRO', `${c}: no esta en ninguna fuente del maestro. ¿Codigo nuevo o mal tipeado? Si es nuevo, la unidad la fija la FACTURA del proveedor, no la tabla.`);
            continue;
        }
        const origen = `${m.fuente} ${fechaCorta(m.fecha)}`;
        switch (compararUnidad(u, m.unidad)) {
            case 'distinta':
                flag('FAIL', 'UNIDAD_VS_MAESTRO', `${c}: tabla dice "${u}", maestro dice "${m.unidad}" (${origen}). ${CANON.unidades_tres_fuentes.regla_corta}`);
                break;
            case 'grafia':
                flag('INFO', 'UNIDAD_GRAFIA', `${c}: "${u}" y "${m.unidad}" (${origen}) son la misma unidad escrita distinto; el arb la va a mostrar como "${m.unidad}".`);
                break;
            case 'sin-dato':
                if (!u && m.unidad) flag('WARN', 'UNIDAD_VACIA_EN_TABLA', `${c}: la tabla no trae unidad; el maestro dice "${m.unidad}" (${origen}).`);
                else if (u && !m.unidad) flag('WARN', 'UNIDAD_MAESTRO_VACIA', `${c}: el maestro no tiene unidad cargada (${origen}) y la tabla dice "${u}". La unidad se carga en el MAESTRO antes que la BOM, con la factura del proveedor a la vista.`);
                break;
        }
        const cambio = cambios.get(k);
        if (cambio && !cambioAvisado.has(k)) {
            cambioAvisado.add(k);
            flag('WARN', 'UNIDAD_CAMBIO_ETIQUETA', `${c}: era "${cambio.antes.unidad}" (${cambio.antes.fuente} ${fechaCorta(cambio.antes.fecha)}) y hoy es "${cambio.ahora.unidad}" (${cambio.ahora.fuente} ${fechaCorta(cambio.ahora.fecha)}). Si cantidad y precio de las OC no se movieron fue un cambio de ETIQUETA: el consumo se reconvierte con el factor fisico, no se copia.`);
        }
    }
}

// 5. Invariantes por producto
const producto = opt('producto');
if (producto && CANON.invariantes[producto]) {
    for (const inv of CANON.invariantes[producto]) {
        if (!inv.auto) continue;
        const sum = inv.terminos.reduce((acc, t) => {
            const re = new RegExp(t, 'i');
            return acc + rows.filter(r => re.test(desc(r))).reduce((s, r) => s + (val(r) ?? 0), 0);
        }, 0);
        if (Math.abs(sum - inv.target) / inv.target > TOL) {
            flag('FAIL', 'INVARIANTE', `${inv.desc}: suma=${sum.toFixed(6)}, target=${inv.target} (fuente: ${inv.fuente})`);
        } else {
            console.log(`  OK invariante: ${inv.desc} (${sum.toFixed(6)})`);
        }
    }
}
for (const m of CANON.invariantes._manuales) flag('INFO', 'INVARIANTE_MANUAL', m);

// 6. Comparacion de columnas (doc vs "actual en arb") con tolerancia 0,1%
const cmp = opt('compare', 2);
if (cmp) {
    const [ca, cb] = cmp.map(c => headers.find(h => h.toLowerCase() === c.toLowerCase()));
    if (!ca || !cb) { console.error(`--compare: columnas no encontradas. Headers: ${headers.join(' | ')}`); process.exit(2); }
    for (const r of rows) {
        const a = toNum(r[ca]); const b = toNum(r[cb]);
        if (a == null || b == null) continue;
        const base = Math.max(Math.abs(a), Math.abs(b));
        if (base > 0 && Math.abs(a - b) / base > TOL) {
            flag('FAIL', 'DIFF_SOBRE_TOLERANCIA', `"${desc(r)}": ${ca}=${a} vs ${cb}=${b} (diff ${(Math.abs(a - b) / base * 100).toFixed(2)}% > 0,1%)`);
        }
    }
}

// ─── reporte ────────────────────────────────────────────────────────────────
const fails = findings.filter(f => f.nivel === 'FAIL');
const warns = findings.filter(f => f.nivel === 'WARN');
for (const f of findings) console.log(`  [${f.nivel}] ${f.check}: ${f.detalle}`);
console.log(`\nResultado: ${fails.length} FAIL, ${warns.length} WARN, ${findings.filter(f => f.nivel === 'INFO').length} INFO`);
console.log('Recorda (no automatizable): rev MAYOR de BOM con listado pegado + agente independiente + before→after crudo a Fak + abrir el archivo. Ver skill verificacion-consumos.');
process.exit(fails.length ? 1 : 0);
