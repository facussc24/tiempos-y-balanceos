/**
 * _importListadoMaestro.mjs — Importa el Listado Maestro al catalogo amfe_registry
 *
 * Fase 2 del plan de gestion de ciclo de vida de AMFEs. Construye las filas de
 * amfe_registry a partir de reports/inventario_amfe.json (generado por
 * _inventarioAmfeServidor.mjs) aplicando las decisiones tomadas por Fak
 * (2026-07-03): mapeo listado→documento Supabase, fusion de headrests 152/154/156,
 * numeros nuevos 161-171, maestros con codigo propio, unificacion de filas
 * duplicadas 101/130.
 *
 * NO toca amfe_documents (la renumeracion de amfe_number es un paso posterior
 * separado). Por eso NO usa runWithValidation(): esta tabla es solo metadata.
 *
 * Modos:
 *   node scripts/_importListadoMaestro.mjs              dry-run: tabla resumen +
 *                                                       reports/import_registry_plan.json
 *   node scripts/_importListadoMaestro.mjs --emit-sql   ademas emite
 *                                                       reports/import_registry.sql
 *                                                       (INSERT ... ON CONFLICT idempotente,
 *                                                       para ejecutar via MCP Supabase)
 *   node scripts/_importListadoMaestro.mjs --apply      escribe directo via supabase-js
 *                                                       (requiere .env.local; si no hay,
 *                                                       aborta y sugiere --emit-sql)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { randomUUID } from 'node:crypto';
import { parseSafeArgs } from './_lib/dryRunGuard.mjs';
import { connectSupabase } from './_lib/amfeIo.mjs';

// ─── CLI ─────────────────────────────────────────────────────────────────────

const { apply } = parseSafeArgs();
const emitSql = process.argv.includes('--emit-sql');

const RUTA_INVENTARIO = 'reports/inventario_amfe.json';
const RUTA_PLAN = 'reports/import_registry_plan.json';
const RUTA_SQL = 'reports/import_registry.sql';
const UPDATED_BY = 'script:_importListadoMaestro';

if (!existsSync(RUTA_INVENTARIO)) {
    console.error(`Falta ${RUTA_INVENTARIO} — correr primero scripts/_inventarioAmfeServidor.mjs`);
    process.exit(1);
}
const inv = JSON.parse(readFileSync(RUTA_INVENTARIO, 'utf8'));

// ─── Decisiones tomadas por Fak (2026-07-03) — NO cambiar sin su OK ─────────

/** Punto 1 y 3: numero de listado → amfe_number del documento en Supabase. */
const MAPEO_DOC = {
    '128': '128', '129': '129', '150': '150', '159': '159', '160': '160',
    '149': 'VWA-PAT-IPPADS-001',
    '157': 'AMFE-1',
    '158': 'AMFE-INS-PAT',
    '151': 'AMFE-HF-PAT',
    '153': 'AMFE-HRC-PAT',
    '155': 'AMFE-HRO-PAT',
    '161': 'AMFE-ARM-PAT',
    '162': 'AMFE-TR-PAT',
    '163': 'AMFE-2',
};

/** Punto 2: headrests fusionados — quedan Obsoleto apuntando al AMFE unificado. */
const FUSIONADOS = { '152': '151', '154': '153', '156': '155' };

/** Punto 5: IDs duplicados del listado → una sola fila con producto combinado. */
const PRODUCTO_UNIFICADO = {
    '101': 'APC AMAROK LATERAL (VINILO + TELA)',
    '130': 'APC AMAROK CENTRAL (VINILO + TELA)',
};

/**
 * Punto 3: numeros nuevos 161-171 (ya asignados por Fak).
 * `carpeta` localiza el archivo vigente en el inventario; `doc` (si hay) es el
 * amfe_number en Supabase. cliente para file-only sale de la carpeta; para los
 * que tienen doc sale del campo client del dump (dato real, no inventado).
 */
const NUEVOS = [
    { code: '161', producto: 'ARMREST DOOR PANEL', proyecto: 'PATAGONIA', carpeta: 'NOVAX\\PATAGONIA\\ARMREST DOOR PANEL' },
    { code: '162', producto: 'TOP ROLL', proyecto: 'PATAGONIA', carpeta: 'NOVAX\\PATAGONIA\\TOP ROLL' },
    { code: '163', producto: 'TELAS TERMOFORMADAS 582D', proyecto: '', carpeta: 'PWA\\TOYOTA_TELAS_TERMOFORMADAS_582D' },
    { code: '164', producto: 'FOLIO PROTECTOR', proyecto: 'AMAROK PA2', cliente: 'VWA', carpeta: 'VWA\\AMAROK PA2\\FOLIO PROTECTOR' },
    { code: '165', producto: 'COFIA TASA', cliente: 'VUTEQ', carpeta: 'VUTEQ\\COFIAS' },
    { code: '166', producto: 'JOTA 20013801', cliente: 'PO', carpeta: 'PO\\JOTA' },
    { code: '167', producto: 'INSONORIZANTES', cliente: 'COZZUOL', carpeta: 'COZZUOL\\Insonos 400900' },
    { code: '168', producto: 'MP4790', cliente: 'COZZUOL', carpeta: 'COZZUOL\\MP4790' },
    { code: '169', producto: 'MP5159-60-61-62', cliente: 'COZZUOL', carpeta: 'COZZUOL\\MP5159-60-61-62' },
    { code: '170', producto: 'MP5346', cliente: 'COZZUOL', carpeta: 'COZZUOL\\MP5346' },
    { code: '171', producto: 'DUAL LOCK MP6040-41', cliente: 'COZZUOL', carpeta: 'COZZUOL\\MP6040-41' },
];

/** Punto 4: maestros con codigo propio (datos desde supabase[] del inventario). */
const MAESTROS = ['AMFE-MAESTRO-INY-001', 'AMFE-MAESTRO-PU-001', 'AMFE-MAESTRO-LOG-REC-001'];

/**
 * INFERENCIA (no es decision explicita de Fak — revisar en el dry-run):
 * numeros del listado cuyo archivo vigente NO tiene el numero en el nombre,
 * pero la subcarpeta OBSOLETO de la MISMA carpeta contiene revisiones viejas
 * numeradas (convencion del arbol: vigente en la raiz, viejas en OBSOLETO),
 * o el archivo es el export del documento ya vinculado por el punto 1.
 * Si Fak no lo valida, borrar la entrada y la fila cae al caso
 * "Sin archivo vigente; ultimo conocido: ...".
 */
const ARCHIVO_INFERIDO_POR_CARPETA = {
    '149': 'VW427-1LA_K-PATAGONIA\\IP PAD',
    '151': 'APOYACABEZAS\\APC DELANTERO',
    '153': 'APOYACABEZAS\\APC TRASERO CENTRAL',
    '155': 'APOYACABEZAS\\APC TRASERO LATERAL',
    '157': 'PWA\\HILUX_TELAS_581D',
    '158': 'NOVAX\\PATAGONIA\\INSERT',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const advertencias = [];
function warn(msg) {
    advertencias.push(msg);
    console.warn(`  [WARN] ${msg}`);
}

function sinAcentos(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const ESTADOS_VALIDOS = ['Borrador', 'En revision', 'Liberado', 'Obsoleto'];

/** Punto 6: 'En revisión' → 'En revision' (el CHECK de la tabla no lleva acento). */
function mapEstado(raw) {
    const limpio = sinAcentos(raw).trim();
    const hit = ESTADOS_VALIDOS.find(v => v.toLowerCase() === limpio.toLowerCase());
    if (!hit) throw new Error(`Estado desconocido en el listado: "${raw}" (validos: ${ESTADOS_VALIDOS.join(', ')})`);
    return hit;
}

/** status de amfe_documents → estado del catalogo. */
function estadoDesdeStatus(status) {
    const mapa = { draft: 'Borrador', in_review: 'En revision', approved: 'Liberado', obsolete: 'Obsoleto' };
    return mapa[String(status || '').toLowerCase()] || 'Borrador';
}

/**
 * Normaliza fechas a YYYY-MM-DD. Filtra basura de Excel (serial 0 = 1900-12-30).
 * Formatos raros se dejan tal cual (no inventar).
 */
function limpiarFecha(v) {
    const s = String(v || '').trim();
    if (!s) return '';
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return Number(m[1]) < 1990 ? '' : s;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return Number(m[3]) < 1990 ? '' : `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return s;
}

/** Regla semestral I-AC-005: fecha ISO + 6 meses. */
function mas6Meses(iso) {
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + 6, Number(m[3])));
    return d.toISOString().slice(0, 10);
}

/**
 * Punto 9: proxima_revision = la del listado si existe; si esta vacia,
 * estado='Liberado' y hay fecha de ultima rev → +6 meses; sino ''.
 */
function calcProximaRevision(delListado, estado, fechaUltimaRev) {
    const v = limpiarFecha(delListado);
    if (v) return v;
    if (estado === 'Liberado' && fechaUltimaRev) return mas6Meses(fechaUltimaRev);
    return '';
}

/** Codigos numericos primero (orden numerico), despues alfanumericos (maestros). */
function compareAmfeCodes(a, b) {
    const na = Number(a), nb = Number(b);
    const aNum = Number.isFinite(na) && a.trim() !== '';
    const bNum = Number.isFinite(nb) && b.trim() !== '';
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b);
}

// ─── Indices sobre el inventario ─────────────────────────────────────────────

const docPorAmfeNumber = new Map(inv.supabase.map(s => [s.amfe_number, s]));

const excelVigentes = inv.archivos.filter(a => a.esExcel && !a.obsoleto && !a.enQuilombo);
const excelArchivados = inv.archivos.filter(a => a.esExcel && (a.obsoleto || a.enQuilombo));

const vigentePorNumero = new Map();
for (const a of excelVigentes.filter(a => a.numero)) {
    if (!vigentePorNumero.has(a.numero)) vigentePorNumero.set(a.numero, []);
    vigentePorNumero.get(a.numero).push(a);
}
const archivadoPorNumero = new Map();
for (const a of excelArchivados.filter(a => a.numero)) {
    if (!archivadoPorNumero.has(a.numero)) archivadoPorNumero.set(a.numero, []);
    archivadoPorNumero.get(a.numero).push(a);
}

const historialPorId = new Map();
for (const h of inv.historial) {
    if (!historialPorId.has(h.id)) historialPorId.set(h.id, []);
    historialPorId.get(h.id).push({
        rev: h.rev,
        date: h.fecha,
        description: h.descripcion,
        solicitante: h.solicitante,
        aprobador: h.aprobador,
        vinculo: h.vinculo,
    });
}

/** Busca el archivo Excel vigente cuya carpeta contiene la clave dada. */
function archivoPorCarpeta(clave) {
    const hits = excelVigentes.filter(a => a.carpeta.toUpperCase().includes(clave.toUpperCase()));
    if (hits.length === 0) return null;
    if (hits.length > 1) warn(`Carpeta "${clave}": ${hits.length} archivos vigentes, se toma el primero (${hits[0].rel})`);
    return hits[0];
}

/** Elige el archivado mas nuevo para la nota "ultimo conocido" (rev numerica > letra > sin rev). */
function ultimoConocido(numero) {
    const cands = archivadoPorNumero.get(numero) || [];
    if (!cands.length) return null;
    const score = a => {
        if (a.rev == null) return -1;
        const n = Number(a.rev);
        if (Number.isFinite(n)) return 100 + n;
        return a.rev.toUpperCase().charCodeAt(0) - 64;
    };
    return [...cands].sort((x, y) => score(y) - score(x))[0];
}

/** Resuelve el documento Supabase para un numero segun MAPEO_DOC (o null). */
function docParaNumero(numero) {
    const target = MAPEO_DOC[numero];
    if (!target) return null;
    const doc = docPorAmfeNumber.get(target);
    if (!doc) throw new Error(`MAPEO_DOC ${numero} → "${target}" no existe en supabase[] del inventario. Regenerar el inventario o corregir el mapeo.`);
    return doc;
}

// ─── Construccion del plan ───────────────────────────────────────────────────

/** Punto 7: server_path + nota de archivo para un numero del listado. */
function resolverServerPath(numero) {
    const vigs = vigentePorNumero.get(numero) || [];
    if (vigs.length > 1) warn(`Numero ${numero}: ${vigs.length} archivos vigentes con el mismo numero, se toma ${vigs[0].rel}`);
    if (vigs.length > 0) return { serverPath: vigs[0].rel, nota: '', inferido: false };

    const claveInferida = ARCHIVO_INFERIDO_POR_CARPETA[numero];
    if (claveInferida) {
        const a = archivoPorCarpeta(claveInferida);
        if (a) return { serverPath: a.rel, nota: 'Archivo vinculado por carpeta (el nombre no tiene numero de AMFE)', inferido: true };
        warn(`Numero ${numero}: no se encontro archivo vigente en carpeta inferida "${claveInferida}"`);
    }

    const ult = ultimoConocido(numero);
    if (ult) return { serverPath: '', nota: `Sin archivo vigente; ultimo conocido: ${ult.rel}`, inferido: false };
    return { serverPath: '', nota: '', inferido: false };
}

function construirPlan() {
    const plan = [];

    // 1) Filas del Listado Maestro (agrupadas por numero: punto 5 unifica 101/130)
    const listadoPorNumero = new Map();
    for (const e of inv.listado) {
        if (!listadoPorNumero.has(e.id)) listadoPorNumero.set(e.id, []);
        listadoPorNumero.get(e.id).push(e);
    }

    for (const [numero, filas] of listadoPorNumero) {
        const base = filas[0];
        const notas = [];
        // El listado viejo arrastra prefijos "AMFE-3 · " en Producto (etiqueta de agente, no producto)
        let producto = base.producto.replace(/^AMFE-\d+\s*[·:-]\s*/i, '').trim();
        let partNumber = base.pn;

        if (filas.length > 1) {
            if (!PRODUCTO_UNIFICADO[numero]) {
                warn(`Numero ${numero} tiene ${filas.length} filas en el listado y no esta en PRODUCTO_UNIFICADO — se usa la primera`);
            } else {
                producto = PRODUCTO_UNIFICADO[numero];
                partNumber = filas.map(f => f.pn).filter(Boolean).join(' // ');
                notas.push('Fila unificada: el listado original tenia 2 filas (vinilo y tela)');
            }
        }

        let estado = mapEstado(base.estado);
        let documentId = null;
        let docAmfeNumber = '';
        const fusionadoEn = FUSIONADOS[numero];

        if (fusionadoEn) {
            // Punto 2: fusion headrests con/sin costura vista
            estado = 'Obsoleto';
            notas.push(`Fusionado en ${fusionadoEn} (variantes con/sin costura vista en un solo AMFE)`);
        } else {
            const doc = docParaNumero(numero);
            if (doc) { documentId = doc.id; docAmfeNumber = doc.amfe_number; }
        }

        const fechaUltimaRev = limpiarFecha(base.fechaUltimaRev);
        const { serverPath, nota: notaArchivo, inferido } = fusionadoEn
            ? { serverPath: '', nota: '', inferido: false }
            : resolverServerPath(numero);
        if (notaArchivo) notas.push(notaArchivo);

        plan.push({
            amfe_code: numero,
            tipo: 'proceso',
            producto,
            part_number: partNumber,
            cliente: base.cliente,          // punto 6: SAS queda SAS
            proyecto: base.proyecto,
            planta: base.planta,
            estado,
            propietario: base.propietario,
            equipo: base.equipo,
            fecha_creacion: limpiarFecha(base.fechaCreacion),
            rev_actual: base.revActual,
            fecha_ultima_rev: fechaUltimaRev,
            // Fusionados quedan sin proxima revision (un AMFE obsoleto no se revisa)
            proxima_revision: fusionadoEn ? '' : calcProximaRevision(base.proximaRevision, estado, fechaUltimaRev),
            server_path: serverPath,
            document_id: documentId,
            historial: historialPorId.get(numero) || [],
            notas: notas.join(' | '),
            _origen: 'listado',
            _docAmfeNumber: docAmfeNumber,
            _serverPathInferido: inferido,
        });
    }

    // 2) Numeros nuevos 161-171 (punto 3)
    for (const n of NUEVOS) {
        const doc = docParaNumero(n.code);
        const archivo = archivoPorCarpeta(n.carpeta);
        if (!archivo) warn(`Nuevo ${n.code} (${n.producto}): sin archivo vigente en carpeta "${n.carpeta}"`);

        plan.push({
            amfe_code: n.code,
            tipo: 'proceso',
            producto: n.producto,
            part_number: doc ? (doc.part_number || '') : '',
            cliente: doc ? (doc.client || n.cliente || '') : (n.cliente || ''),
            proyecto: n.proyecto || '',
            planta: '',
            estado: doc ? estadoDesdeStatus(doc.status) : 'Borrador',
            propietario: '',
            equipo: '',
            fecha_creacion: '',
            rev_actual: archivo?.rev || (doc ? (doc.revision_level || '') : ''),
            fecha_ultima_rev: doc ? limpiarFecha(doc.last_revision_date) : '',
            proxima_revision: '',
            server_path: archivo ? archivo.rel : '',
            document_id: doc ? doc.id : null,
            historial: [],
            notas: 'Numero nuevo asignado en la reorganizacion del catalogo (no estaba en el Listado Maestro)',
            _origen: 'nuevo',
            _docAmfeNumber: doc ? doc.amfe_number : '',
            _serverPathInferido: false,
        });
    }

    // 3) Maestros (punto 4) — codigo propio, sin numero correlativo
    for (const code of MAESTROS) {
        const doc = docPorAmfeNumber.get(code);
        if (!doc) throw new Error(`Maestro ${code} no existe en supabase[] del inventario.`);
        plan.push({
            amfe_code: code,
            tipo: 'maestro',
            producto: doc.subject || doc.project_name || '',
            part_number: doc.part_number || '',
            cliente: doc.client || '',
            proyecto: '',
            planta: '',
            estado: estadoDesdeStatus(doc.status),
            propietario: '',
            equipo: '',
            fecha_creacion: '',
            rev_actual: doc.revision_level || '',
            fecha_ultima_rev: limpiarFecha(doc.last_revision_date),
            proxima_revision: '',
            server_path: '',
            document_id: doc.id,
            historial: [],
            notas: '',
            _origen: 'maestro',
            _docAmfeNumber: doc.amfe_number,
            _serverPathInferido: false,
        });
    }

    plan.sort((a, b) => compareAmfeCodes(a.amfe_code, b.amfe_code));

    // Validaciones finales
    const codigos = new Set();
    for (const f of plan) {
        if (codigos.has(f.amfe_code)) throw new Error(`amfe_code duplicado en el plan: ${f.amfe_code}`);
        codigos.add(f.amfe_code);
        if (!ESTADOS_VALIDOS.includes(f.estado)) throw new Error(`Estado invalido en ${f.amfe_code}: "${f.estado}"`);
        if (!['proceso', 'maestro', 'diseno'].includes(f.tipo)) throw new Error(`Tipo invalido en ${f.amfe_code}: "${f.tipo}"`);
    }
    const docsUsados = new Map();
    for (const f of plan.filter(f => f.document_id)) {
        if (docsUsados.has(f.document_id)) {
            throw new Error(`document_id ${f.document_id} asignado a ${docsUsados.get(f.document_id)} y a ${f.amfe_code}`);
        }
        docsUsados.set(f.document_id, f.amfe_code);
    }
    return plan;
}

// ─── Salidas ─────────────────────────────────────────────────────────────────

function truncar(s, n) {
    const t = String(s ?? '');
    return t.length > n ? t.slice(0, n - 3) + '...' : t;
}

function imprimirTabla(plan) {
    const cab = ['CODIGO', 'PRODUCTO', 'CLIENTE', 'ESTADO', 'REV', 'DOC', 'SERVER_PATH / NOTA'];
    const anchos = [22, 40, 9, 11, 4, 20, 70];
    const linea = fila => fila.map((c, i) => truncar(c, anchos[i]).padEnd(anchos[i])).join(' | ');
    console.log('\n' + linea(cab));
    console.log(anchos.map(a => '-'.repeat(a)).join('-|-'));
    for (const f of plan) {
        const pathONota = f.server_path
            ? f.server_path + (f._serverPathInferido ? '  [INFERIDO]' : '')
            : (f.notas || '—');
        console.log(linea([f.amfe_code, f.producto, f.cliente, f.estado, f.rev_actual || '—', f._docAmfeNumber || '—', pathONota]));
    }
}

const COLUMNAS_SQL = [
    'id', 'amfe_code', 'tipo', 'producto', 'part_number', 'cliente', 'proyecto', 'planta',
    'estado', 'propietario', 'equipo', 'fecha_creacion', 'rev_actual', 'fecha_ultima_rev',
    'proxima_revision', 'server_path', 'document_id', 'historial', 'notas',
    'created_by', 'updated_by',
];
/** Columnas actualizables en ON CONFLICT (nunca pisar id/created_at/created_by). */
const COLUMNAS_UPDATE = COLUMNAS_SQL.filter(c => !['id', 'amfe_code', 'created_by'].includes(c));

function emitirSql(plan) {
    const q = s => `'${String(s).replace(/'/g, "''")}'`;
    const lineas = [
        '-- import_registry.sql — generado por scripts/_importListadoMaestro.mjs',
        `-- Fecha: ${new Date().toISOString()} · Fuente: ${RUTA_INVENTARIO}`,
        '-- Idempotente: INSERT ... ON CONFLICT (amfe_code) DO UPDATE (no pisa id/created_at/created_by).',
        '-- Ejecutar via MCP Supabase (execute_sql) o psql. Cada lote (multi-row INSERT) es atomico.',
        '',
    ];
    // Multi-row INSERT en lotes: una sola lista de columnas y un solo ON CONFLICT por lote
    // (formato compacto para poder ejecutarlo via MCP execute_sql sin exceder el tamano de query).
    const FILAS_POR_LOTE = 17;
    const sets = COLUMNAS_UPDATE.map(c => `${c} = EXCLUDED.${c}`).join(', ');
    for (let i = 0; i < plan.length; i += FILAS_POR_LOTE) {
        const lote = plan.slice(i, i + FILAS_POR_LOTE);
        lineas.push(
            `-- Lote ${Math.floor(i / FILAS_POR_LOTE) + 1}: ${lote[0].amfe_code} .. ${lote[lote.length - 1].amfe_code}`,
            `INSERT INTO amfe_registry (${COLUMNAS_SQL.join(', ')})`,
            'VALUES',
        );
        lote.forEach((f, j) => {
            const valores = {
                id: 'gen_random_uuid()::text',
                amfe_code: q(f.amfe_code),
                tipo: q(f.tipo),
                producto: q(f.producto),
                part_number: q(f.part_number),
                cliente: q(f.cliente),
                proyecto: q(f.proyecto),
                planta: q(f.planta),
                estado: q(f.estado),
                propietario: q(f.propietario),
                equipo: q(f.equipo),
                fecha_creacion: q(f.fecha_creacion),
                rev_actual: q(f.rev_actual),
                fecha_ultima_rev: q(f.fecha_ultima_rev),
                proxima_revision: q(f.proxima_revision),
                server_path: q(f.server_path),
                document_id: f.document_id ? q(f.document_id) : 'NULL',
                historial: q(JSON.stringify(f.historial)),
                notas: q(f.notas),
                created_by: q(UPDATED_BY),
                updated_by: q(UPDATED_BY),
            };
            const coma = j < lote.length - 1 ? ',' : '';
            lineas.push(`(${COLUMNAS_SQL.map(c => valores[c]).join(', ')})${coma}`);
        });
        lineas.push(`ON CONFLICT (amfe_code) DO UPDATE SET ${sets}, updated_at = NOW();`, '');
    }
    writeFileSync(RUTA_SQL, lineas.join('\n'), 'utf8');
    console.log(`\nSQL emitido → ${RUTA_SQL} (${plan.length} upserts)`);
}

async function aplicarDirecto(plan) {
    let sb;
    try {
        sb = await connectSupabase();
    } catch (err) {
        console.error(`\nNo se pudo conectar a Supabase: ${err.message}`);
        console.error('Esta PC probablemente no tiene .env.local. Alternativa: correr con --emit-sql');
        console.error(`y ejecutar ${RUTA_SQL} via MCP Supabase (execute_sql).`);
        process.exit(1);
    }

    let insertados = 0, actualizados = 0;
    for (const f of plan) {
        const payload = {
            tipo: f.tipo,
            producto: f.producto,
            part_number: f.part_number,
            cliente: f.cliente,
            proyecto: f.proyecto,
            planta: f.planta,
            estado: f.estado,
            propietario: f.propietario,
            equipo: f.equipo,
            fecha_creacion: f.fecha_creacion,
            rev_actual: f.rev_actual,
            fecha_ultima_rev: f.fecha_ultima_rev,
            proxima_revision: f.proxima_revision,
            server_path: f.server_path,
            document_id: f.document_id,
            historial: JSON.stringify(f.historial),
            notas: f.notas,
            updated_by: UPDATED_BY,
        };
        const { data: existente, error: selErr } = await sb.from('amfe_registry')
            .select('id').eq('amfe_code', f.amfe_code).maybeSingle();
        if (selErr) throw new Error(`SELECT amfe_registry/${f.amfe_code}: ${selErr.message}`);

        if (existente) {
            // Nunca pisar id/created_at/created_by de la fila existente
            const { error } = await sb.from('amfe_registry')
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq('amfe_code', f.amfe_code);
            if (error) throw new Error(`UPDATE amfe_registry/${f.amfe_code}: ${error.message}`);
            actualizados++;
        } else {
            const { error } = await sb.from('amfe_registry')
                .insert({ id: randomUUID(), amfe_code: f.amfe_code, created_by: UPDATED_BY, ...payload });
            if (error) throw new Error(`INSERT amfe_registry/${f.amfe_code}: ${error.message}`);
            insertados++;
        }
        console.log(`  [APPLY] ${f.amfe_code} ${existente ? 'actualizado' : 'insertado'} — ${f.producto}`);
    }

    // Verificacion post-escritura
    const { count, error: cntErr } = await sb.from('amfe_registry')
        .select('id', { count: 'exact', head: true });
    if (cntErr) throw new Error(`VERIFY count amfe_registry: ${cntErr.message}`);
    console.log(`\nAplicado: ${insertados} insertados + ${actualizados} actualizados. Total filas en amfe_registry: ${count}.`);
    if (count < plan.length) {
        console.error(`VERIFY: la tabla tiene ${count} filas pero el plan trajo ${plan.length} — revisar.`);
        process.exit(1);
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────

const plan = construirPlan();
imprimirTabla(plan);

const resumen = {
    total: plan.length,
    listado: plan.filter(f => f._origen === 'listado').length,
    nuevos: plan.filter(f => f._origen === 'nuevo').length,
    maestros: plan.filter(f => f._origen === 'maestro').length,
    conDocumento: plan.filter(f => f.document_id).length,
    conArchivoVigente: plan.filter(f => f.server_path).length,
    serverPathInferido: plan.filter(f => f._serverPathInferido).map(f => f.amfe_code),
    obsoletosPorFusion: plan.filter(f => FUSIONADOS[f.amfe_code]).map(f => f.amfe_code),
};
console.log(`\nResumen: ${resumen.total} filas (${resumen.listado} del listado + ${resumen.nuevos} nuevas + ${resumen.maestros} maestros) · ` +
    `${resumen.conDocumento} con documento Supabase · ${resumen.conArchivoVigente} con archivo vigente`);
if (resumen.serverPathInferido.length) {
    console.log(`server_path INFERIDO por carpeta (validar con Fak): ${resumen.serverPathInferido.join(', ')}`);
}
if (advertencias.length) console.log(`Advertencias: ${advertencias.length} (ver [WARN] arriba)`);

mkdirSync('reports', { recursive: true });
writeFileSync(RUTA_PLAN, JSON.stringify({
    generado: new Date().toISOString(),
    fuente: RUTA_INVENTARIO,
    resumen,
    advertencias,
    filas: plan,
}, null, 2));
console.log(`Plan escrito → ${RUTA_PLAN}`);

if (emitSql) emitirSql(plan);

if (apply) {
    await aplicarDirecto(plan);
} else {
    console.log('\nDry-run: no se escribio a Supabase. Opciones: --emit-sql (SQL para MCP) o --apply (requiere .env.local).');
}
