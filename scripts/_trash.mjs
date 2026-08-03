/**
 * _trash.mjs — papelera de documentos APQP: VER y RESTAURAR lo borrado.
 *
 * POR QUE EXISTE (2026-07-30)
 *
 * `utils/repositories/trash.ts` archiva la fila ORIGINAL COMPLETA en
 * `deleted_documents.row_json` antes de borrar un documento. Sin este CLI esa tabla
 * es un pozo: guarda filas que nadie puede leer ni devolver a su lugar, o sea no
 * sirve para nada. Aca esta la otra mitad del ciclo.
 *
 * Guarda la fila completa (y no 4 campos) porque `amfe_documents` tiene columnas
 * NOT NULL sin default (amfe_number, project_name, data): un restore armado desde
 * 4 campos falla siempre.
 *
 * USO:
 *   node scripts/_trash.mjs --list                      # todo lo archivado
 *   node scripts/_trash.mjs --list --tipo amfe          # filtrado por tipo
 *   node scripts/_trash.mjs --show <id>                 # detalle de una fila (read-only)
 *   node scripts/_trash.mjs --restore <id>              # DRY-RUN: dice que haria
 *   node scripts/_trash.mjs --restore <id> --apply      # ejecuta el restore
 *   node scripts/_trash.mjs --selftest                  # prueba la logica pura, sin red
 *
 * SEGURIDAD (por que esta escrito asi):
 *   - `--restore` es DRY-RUN por default, como todo script del proyecto que escribe.
 *   - NUNCA pisa un documento existente: chequea el destino antes Y usa `.insert()`
 *     (no upsert), asi la primary key aborta el write aunque el chequeo previo
 *     hubiera leido mal.
 *   - Primero inserta y CONFIRMA leyendo de vuelta; solo despues borra la fila de la
 *     papelera. Si la confirmacion falla, la copia de la papelera queda intacta.
 *   - Sin `VITE_AUTO_LOGIN_PASSWORD` sale con exit != 0 y NO imprime una lista vacia:
 *     las tablas tienen RLS para `authenticated`, y sin login devuelven 0 filas SIN
 *     error. Ese patron dejo 19 dias de backups vacios (8/7 al 27/7) sin que nadie se
 *     entere. Una lista vacia solo puede significar "la papelera esta vacia".
 */

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadEnv, connectSupabase } from './_lib/amfeIo.mjs';

// ─── Constantes de dominio ──────────────────────────────────────────────────

/** Los 4 tipos que acepta la tabla (CHECK constraint). Lista canonica. */
export const TIPOS_VALIDOS = ['amfe', 'cp', 'ho', 'pfd'];

/** doc_type → tabla de origen. No derivar por string: es una lista cerrada. */
export const TABLA_POR_TIPO = {
    amfe: 'amfe_documents',
    cp: 'cp_documents',
    ho: 'ho_documents',
    pfd: 'pfd_documents',
};

/**
 * Columnas NOT NULL SIN default de cada tabla destino (Supabase live, 2026-07-30).
 * Si una de estas falta en row_json, el INSERT falla seguro: mejor decirlo antes.
 */
const COLUMNAS_REQUERIDAS = {
    amfe_documents: ['id', 'amfe_number', 'project_name', 'data'],
    cp_documents: ['id', 'data'],
    ho_documents: ['id', 'data'],
    pfd_documents: ['id', 'data'],
};

/**
 * Columnas conocidas de cada tabla destino (Supabase live, 2026-07-30).
 * Se usan SOLO para advertir: una clave que no es columna hace fallar el INSERT, y
 * una columna NOT NULL-con-default que falta se rellena con el default (pierde el
 * valor original en silencio). El schema real siempre manda sobre esta lista.
 */
const COLUMNAS_CONOCIDAS = {
    amfe_documents: [
        'id', 'amfe_number', 'project_name', 'subject', 'client', 'part_number',
        'responsible', 'organization', 'status', 'operation_count', 'cause_count',
        'ap_h_count', 'ap_m_count', 'coverage_percent', 'start_date',
        'last_revision_date', 'revision_level', 'created_at', 'updated_at', 'data',
        'revisions', 'checksum',
    ],
    cp_documents: [
        'id', 'project_name', 'control_plan_number', 'phase', 'part_number',
        'part_name', 'organization', 'client', 'responsible', 'revision',
        'revision_level', 'last_revision_at', 'linked_amfe_project', 'linked_amfe_id',
        'item_count', 'created_at', 'updated_at', 'data', 'checksum',
    ],
    ho_documents: [
        'id', 'form_number', 'organization', 'client', 'part_number',
        'part_description', 'linked_amfe_project', 'linked_cp_project',
        'linked_amfe_id', 'linked_cp_id', 'revision_level', 'last_revision_at',
        'sheet_count', 'created_at', 'updated_at', 'data', 'checksum',
    ],
    pfd_documents: [
        'id', 'part_number', 'part_name', 'document_number', 'revision_level',
        'revision_date', 'customer_name', 'step_count', 'data', 'checksum',
        'last_revision_at', 'created_at', 'updated_at',
    ],
};

/**
 * Columnas con UNIQUE ademas del id (Supabase live, 2026-07-30).
 *
 * `amfe_documents.amfe_number` es UNIQUE. Caso real: borras un AMFE, lo rehaces en la
 * app con el MISMO numero (id nuevo) y despues queres restaurar el viejo. El chequeo
 * por id pasa (los ids son distintos) y el DRY-RUN te dice que va a andar, pero el
 * INSERT muere con unique violation. Se chequea antes para que el dry-run no prometa
 * algo que no puede cumplir.
 */
const UNICOS_POR_TABLA = {
    amfe_documents: ['amfe_number'],
};

/** Columnas que muestra --list. Se piden solo estas: `select('*')` bajaria el `data`
 *  completo de CADA documento archivado (cientos de KB por AMFE) para imprimir 5. */
const COLUMNAS_LISTADO = 'id, doc_type, project_name, deleted_at, deleted_by';

/** Variables que hacen falta para leer la papelera. Sin una sola, no se lee nada. */
export const VARS_REQUERIDAS = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_AUTO_LOGIN_EMAIL',
    'VITE_AUTO_LOGIN_PASSWORD',
];

const FLAGS_CONOCIDAS = ['--list', '--show', '--restore', '--tipo', '--apply', '--selftest', '--help'];

/**
 * Flags que NO llevan valor. Si vienen con `=algo` es error, NO se ignora el valor.
 *
 * Por que es error y no un warning: `--apply=false` es una forma habitual de
 * DESACTIVAR una flag en otros CLIs. Si aca se aceptara y se descartara el valor,
 * `--restore <id> --apply=false` escribiria en la base justo cuando el usuario
 * escribio que no queria escribir. En la unica flag destructiva del script eso no
 * puede quedar a interpretacion.
 */
const FLAGS_BOOLEANAS = ['--list', '--selftest', '--help', '--apply'];

// ─── Logica pura (testeada por --selftest, sin red) ─────────────────────────

/**
 * doc_type → tabla destino. Tira si el tipo no es uno de los 4.
 * Usa hasOwnProperty para que 'constructor' o '__proto__' no devuelvan basura.
 * @param {string} docType
 * @returns {string}
 */
export function tablaDestino(docType) {
    if (typeof docType !== 'string' || !Object.prototype.hasOwnProperty.call(TABLA_POR_TIPO, docType)) {
        throw new Error(`doc_type invalido "${docType}" (validos: ${TIPOS_VALIDOS.join(', ')})`);
    }
    return TABLA_POR_TIPO[docType];
}

/**
 * Parsea los argumentos del CLI. Devuelve `{ modo, id, tipo, apply, error }`.
 * `error` != null significa que no hay que hacer nada: el llamador imprime y sale != 0.
 *
 * Reglas: un solo modo por corrida; `--tipo` solo con `--list`; `--apply` solo con
 * `--restore`; flag desconocida = error (nunca ignorar en silencio una flag que el
 * usuario creyo que hacia algo).
 *
 * @param {string[]} argv — process.argv.slice(2)
 */
export function parsearArgs(argv) {
    const res = { modo: null, id: null, tipo: null, apply: false, error: null };
    const modos = [];

    for (let i = 0; i < argv.length; i++) {
        const bruto = argv[i];

        if (!bruto.startsWith('--')) {
            res.error = `argumento suelto "${bruto}": el id va despues de su modo (--show <id> / --restore <id>)`;
            return res;
        }

        const corte = bruto.indexOf('=');
        const nombre = corte === -1 ? bruto : bruto.slice(0, corte);
        const valorInline = corte === -1 ? null : bruto.slice(corte + 1);

        if (!FLAGS_CONOCIDAS.includes(nombre)) {
            res.error = `flag desconocida "${nombre}". Validas: ${FLAGS_CONOCIDAS.join(' ')}`;
            return res;
        }

        // Flag booleana con valor pegado: error. Ver el comentario de FLAGS_BOOLEANAS —
        // `--apply=false` NO desactiva nada, asi que aceptarlo seria escribir en contra
        // de lo que el usuario pidio.
        if (FLAGS_BOOLEANAS.includes(nombre) && valorInline !== null) {
            res.error = nombre === '--apply'
                ? `"${bruto}" no es valido: --apply se escribe solo, sin valor. OJO: "--apply=false" NO desactiva la escritura. Para NO escribir, corre --restore <id> sin --apply (es dry-run por default).`
                : `"${bruto}" no es valido: ${nombre} se escribe solo, sin valor.`;
            return res;
        }

        // Flags que necesitan valor: lo toman inline (--tipo=amfe) o del siguiente arg.
        if (nombre === '--show' || nombre === '--restore' || nombre === '--tipo') {
            let valor = valorInline;
            if (valor === null) {
                const siguiente = argv[i + 1];
                if (siguiente === undefined || siguiente.startsWith('--')) {
                    res.error = `${nombre} necesita un valor (ej: ${nombre === '--tipo' ? '--tipo amfe' : nombre + ' <id>'})`;
                    return res;
                }
                valor = siguiente;
                i++;
            }
            if (valor.trim() === '') {
                res.error = `${nombre} necesita un valor no vacio`;
                return res;
            }
            if (nombre === '--tipo') {
                if (!TIPOS_VALIDOS.includes(valor)) {
                    res.error = `--tipo "${valor}" invalido (validos: ${TIPOS_VALIDOS.join(', ')})`;
                    return res;
                }
                // Repetido: error. Quedarse callado con el ultimo hace creer que se
                // filtro por el primero y que ese tipo no tiene nada archivado.
                if (res.tipo !== null) {
                    res.error = `--tipo repetido ("${res.tipo}" y "${valor}"): se filtra por un tipo a la vez`;
                    return res;
                }
                res.tipo = valor;
            } else {
                modos.push(nombre === '--show' ? 'show' : 'restore');
                res.id = valor.trim();
            }
            continue;
        }

        if (nombre === '--apply') { res.apply = true; continue; }
        if (nombre === '--list') { modos.push('list'); continue; }
        if (nombre === '--selftest') { modos.push('selftest'); continue; }
        if (nombre === '--help') { modos.push('help'); continue; }
    }

    if (modos.length === 0) {
        res.error = 'falta el modo: --list, --show <id>, --restore <id> o --selftest';
        return res;
    }
    if (modos.length > 1) {
        res.error = `modos mutuamente excluyentes en la misma corrida: ${modos.join(', ')}`;
        return res;
    }
    res.modo = modos[0];

    if (res.tipo !== null && res.modo !== 'list') {
        res.error = '--tipo solo aplica a --list';
        return res;
    }
    if (res.apply && res.modo !== 'restore') {
        res.error = '--apply solo aplica a --restore';
        return res;
    }
    return res;
}

/**
 * Variables de .env.local que faltan (ausentes o vacias).
 * @param {Record<string,string>} env
 * @returns {string[]}
 */
export function faltantesEnEnv(env) {
    return VARS_REQUERIDAS.filter((k) => {
        const v = env?.[k];
        return v === undefined || v === null || String(v).trim() === '';
    });
}

/**
 * Valida que una fila de la papelera alcance para reinsertar el documento.
 *
 * @param {object} fila — fila cruda de deleted_documents
 * @returns {{ok:boolean, errores:string[], advertencias:string[], tabla:string|null, filaOriginal:object|null}}
 */
export function validarFilaParaRestore(fila) {
    const errores = [];
    const advertencias = [];
    const vacio = { ok: false, errores, advertencias, tabla: null, filaOriginal: null };

    if (!fila || typeof fila !== 'object' || Array.isArray(fila)) {
        errores.push('la fila de la papelera es null o no es un objeto');
        return vacio;
    }

    if (typeof fila.id !== 'string' || fila.id.trim() === '') {
        errores.push('la fila de la papelera no tiene id');
    }

    let tabla = null;
    try {
        tabla = tablaDestino(fila.doc_type);
    } catch (e) {
        errores.push(e.message);
    }

    // row_json deberia venir como objeto (columna jsonb). Si vino texto, alguien la
    // cargo a mano: se parsea pero se avisa, porque es sintoma de otro problema.
    let original = fila.row_json;
    if (typeof original === 'string') {
        try {
            original = JSON.parse(original);
            advertencias.push('row_json vino como texto y no como jsonb (se parseo, pero revisar quien la escribio)');
        } catch {
            errores.push('row_json es texto y no es JSON valido: la fila no se puede restaurar');
            return { ...vacio, tabla };
        }
    }
    if (original === null || original === undefined || typeof original !== 'object' || Array.isArray(original)) {
        errores.push('row_json no es un objeto: no hay fila original para reinsertar');
        return { ...vacio, tabla };
    }

    if (!tabla) return { ok: false, errores, advertencias, tabla: null, filaOriginal: original };

    // Columnas NOT NULL sin default: sin estas el INSERT falla seguro.
    for (const col of COLUMNAS_REQUERIDAS[tabla]) {
        const v = original[col];
        if (v === undefined || v === null) {
            errores.push(`row_json no trae la columna "${col}" (NOT NULL sin default en ${tabla})`);
        }
    }

    if (original.id !== undefined && typeof fila.id === 'string' && original.id !== fila.id) {
        errores.push(`el id de row_json ("${original.id}") no coincide con el de la papelera ("${fila.id}"): fila inconsistente`);
    }

    // `data` es TEXT en las 4 tablas: tiene que viajar como string tal cual salio.
    // Si es un objeto, la fila esta corrupta — no lo arreglamos por las nuestras.
    if (original.data !== undefined && original.data !== null) {
        if (typeof original.data !== 'string') {
            errores.push(`row_json.data es ${Array.isArray(original.data) ? 'array' : typeof original.data} y la columna es TEXT: fila corrupta, no se restaura sola`);
        } else if (original.data.trim() === '') {
            errores.push('row_json.data esta vacio: el documento no tendria contenido');
        }
    }

    const conocidas = COLUMNAS_CONOCIDAS[tabla];
    const desconocidas = Object.keys(original).filter((k) => !conocidas.includes(k));
    if (desconocidas.length > 0) {
        advertencias.push(`row_json trae claves que no son columnas conocidas de ${tabla}: ${desconocidas.join(', ')} (el INSERT las va a rechazar si tampoco existen en el schema real)`);
    }

    const faltantesConDefault = conocidas.filter((c) => !(c in original) && !COLUMNAS_REQUERIDAS[tabla].includes(c));
    if (faltantesConDefault.length > 0) {
        advertencias.push(`faltan columnas que Postgres va a rellenar con su default (se pierde el valor original): ${faltantesConDefault.join(', ')}`);
    }

    return { ok: errores.length === 0, errores, advertencias, tabla, filaOriginal: original };
}

/** Recorta un texto para que entre en la tabla. */
function truncar(valor, max) {
    const t = valor === null || valor === undefined || valor === '' ? '-' : String(valor);
    return t.length <= max ? t : t.slice(0, max - 3) + '...';
}

/** `2026-07-30T12:34:56.789Z` → `2026-07-30 12:34:56`. */
function fechaCorta(valor) {
    if (typeof valor !== 'string' || valor === '') return '-';
    return valor.replace('T', ' ').slice(0, 19);
}

/**
 * Arma la tabla de texto de --list. Pura (sin console) para poder testearla.
 * @param {Array<object>} filas
 * @returns {string[]} lineas
 */
export function formatearTabla(filas) {
    const cols = [
        { k: 'id', h: 'ID', max: 38 },
        { k: 'doc_type', h: 'TIPO', max: 6 },
        { k: 'project_name', h: 'PROYECTO', max: 34 },
        { k: 'deleted_at', h: 'BORRADO', max: 19 },
        { k: 'deleted_by', h: 'POR', max: 32 },
    ];
    const celdas = filas.map((f) => cols.map((c) => (
        c.k === 'deleted_at' ? fechaCorta(f[c.k]) : truncar(f[c.k], c.max)
    )));
    const anchos = cols.map((c, i) => Math.max(c.h.length, ...celdas.map((r) => r[i].length), 0));
    const linea = (celdasFila) => celdasFila.map((v, i) => v.padEnd(anchos[i])).join('  ').trimEnd();
    return [
        linea(cols.map((c) => c.h)),
        anchos.map((a) => '-'.repeat(a)).join('  '),
        ...celdas.map(linea),
    ];
}

// ─── Selftest (offline) ─────────────────────────────────────────────────────

/**
 * Prueba la logica pura sin tocar la red. Si un fixture conocido-malo PASA, el
 * selftest sale ROJO: un validador ciego es peor que no tener validador.
 * Los fixtures son inventados a proposito — cero datos de la empresa.
 */
function selftest() {
    const casos = [];
    const ok = (nombre, condicion) => casos.push({ nombre, ok: condicion === true });

    // --- mapeo doc_type → tabla
    ok('mapeo amfe → amfe_documents', tablaDestino('amfe') === 'amfe_documents');
    ok('mapeo cp → cp_documents', tablaDestino('cp') === 'cp_documents');
    ok('mapeo ho → ho_documents', tablaDestino('ho') === 'ho_documents');
    ok('mapeo pfd → pfd_documents', tablaDestino('pfd') === 'pfd_documents');
    const tira = (v) => { try { tablaDestino(v); return false; } catch { return true; } };
    ok('mapeo rechaza "AMFE" (el CHECK es minusculas)', tira('AMFE'));
    ok('mapeo rechaza "constructor" (no lee el prototipo)', tira('constructor'));
    ok('mapeo rechaza "__proto__"', tira('__proto__'));
    ok('mapeo rechaza undefined', tira(undefined));
    ok('mapeo rechaza un tipo inventado', tira('balanceo'));

    // --- parseo de argumentos
    const p = (arr) => parsearArgs(arr);
    ok('--list solo', p(['--list']).modo === 'list' && p(['--list']).error === null);
    ok('--list --tipo amfe', p(['--list', '--tipo', 'amfe']).tipo === 'amfe');
    ok('--list --tipo=cp (forma inline)', p(['--list', '--tipo=cp']).tipo === 'cp');
    ok('--tipo invalido es error', p(['--list', '--tipo', 'xxx']).error !== null);
    ok('--tipo sin --list es error', p(['--tipo', 'amfe']).error !== null);
    ok('--show <id> toma el id', p(['--show', 'abc-123']).modo === 'show' && p(['--show', 'abc-123']).id === 'abc-123');
    ok('--show sin id es error', p(['--show']).error !== null);
    ok('--restore es DRY-RUN por default', p(['--restore', 'abc']).apply === false && p(['--restore', 'abc']).modo === 'restore');
    ok('--restore --apply activa la escritura', p(['--restore', 'abc', '--apply']).apply === true);
    ok('--restore sin id (le sigue una flag) es error', p(['--restore', '--apply']).error !== null);
    ok('--apply suelto es error', p(['--apply']).error !== null);
    ok('dos modos juntos es error', p(['--list', '--restore', 'abc']).error !== null);
    ok('sin argumentos es error', p([]).error !== null);
    ok('flag desconocida es error (no se ignora)', p(['--borrar-todo']).error !== null);
    ok('argumento suelto es error', p(['abc-123']).error !== null);
    ok('--selftest es un modo', p(['--selftest']).modo === 'selftest');

    // --- flags booleanas con valor pegado (el agujero de 2026-07-30)
    // `--apply=false` ponia apply=true: el usuario escribia que NO queria escribir y
    // el script escribia. Ahora es error, y se verifica que NO quede apply activo.
    for (const v of ['false', '0', 'no', 'true', '']) {
        const r = p(['--restore', 'abc', `--apply=${v}`]);
        ok(`--apply=${v || '<vacio>'} es error y NO activa la escritura`, r.error !== null && r.apply === false);
    }
    ok('--list=basura es error (no se descarta el valor)', p(['--list=basura']).error !== null);
    ok('--selftest=x es error', p(['--selftest=x']).error !== null);
    ok('--help=x es error', p(['--help=x']).error !== null);
    ok('--apply sin valor sigue funcionando', p(['--restore', 'abc', '--apply']).apply === true);
    ok('--tipo=cp sigue aceptando el valor pegado', p(['--list', '--tipo=cp']).tipo === 'cp');
    ok('--tipo repetido es error (no se queda con el ultimo)', p(['--list', '--tipo', 'amfe', '--tipo', 'cp']).error !== null);

    // --- guard de entry-point: si fallara, el selftest no correria y --selftest
    // saldria 0 sin imprimir nada (falso verde). Que este caso se evalue lo prueba.
    ok('el guard de entry-point detecto la ejecucion directa', esEjecucionDirecta() === true);

    // --- chequeo de credenciales (el incidente de los backups vacios)
    const envCompleto = {
        VITE_SUPABASE_URL: 'https://ejemplo.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon-de-prueba',
        VITE_AUTO_LOGIN_EMAIL: 'dev@ejemplo.test',
        VITE_AUTO_LOGIN_PASSWORD: 'no-es-real',
    };
    ok('env completo → no falta nada', faltantesEnEnv(envCompleto).length === 0);
    const { VITE_AUTO_LOGIN_PASSWORD: _sinPass, ...envSinPass } = envCompleto;
    ok('env sin password → la detecta', faltantesEnEnv(envSinPass).join() === 'VITE_AUTO_LOGIN_PASSWORD');
    ok('password vacia cuenta como faltante', faltantesEnEnv({ ...envCompleto, VITE_AUTO_LOGIN_PASSWORD: '   ' }).length === 1);
    ok('env vacio → faltan las 4', faltantesEnEnv({}).length === 4);
    ok('env null no explota', faltantesEnEnv(null).length === 4);

    // --- validacion de row_json
    const amfeBueno = {
        id: 'fixture-amfe-1',
        doc_type: 'amfe',
        project_name: 'PROYECTO DE PRUEBA',
        deleted_at: '2026-07-30T10:00:00Z',
        deleted_by: 'dev@ejemplo.test',
        row_json: {
            id: 'fixture-amfe-1',
            amfe_number: 'AMFE-FIXTURE',
            project_name: 'PROYECTO DE PRUEBA',
            subject: '', client: '', part_number: '', responsible: '', organization: '',
            status: 'draft', operation_count: 0, cause_count: 0, ap_h_count: 0,
            ap_m_count: 0, coverage_percent: 0, start_date: '', last_revision_date: '',
            revision_level: 'A', created_at: '2026-07-01T00:00:00Z',
            updated_at: '2026-07-02T00:00:00Z', data: '{"operations":[]}',
            revisions: '[]', checksum: null,
        },
    };
    const clonar = (o) => JSON.parse(JSON.stringify(o));

    const vBueno = validarFilaParaRestore(amfeBueno);
    ok('fila amfe completa: valida y sin advertencias',
        vBueno.ok === true && vBueno.tabla === 'amfe_documents' && vBueno.advertencias.length === 0);

    const sinNumber = clonar(amfeBueno); delete sinNumber.row_json.amfe_number;
    ok('KNOWN-BAD: sin amfe_number (NOT NULL sin default) → rechazada', validarFilaParaRestore(sinNumber).ok === false);

    const sinData = clonar(amfeBueno); delete sinData.row_json.data;
    ok('KNOWN-BAD: sin data → rechazada', validarFilaParaRestore(sinData).ok === false);

    const dataVacia = clonar(amfeBueno); dataVacia.row_json.data = '   ';
    ok('KNOWN-BAD: data vacia → rechazada', validarFilaParaRestore(dataVacia).ok === false);

    const dataObjeto = clonar(amfeBueno); dataObjeto.row_json.data = { operations: [] };
    ok('KNOWN-BAD: data como objeto (la columna es TEXT) → rechazada', validarFilaParaRestore(dataObjeto).ok === false);

    const idCruzado = clonar(amfeBueno); idCruzado.row_json.id = 'otro-id';
    ok('KNOWN-BAD: id de row_json != id de la papelera → rechazada', validarFilaParaRestore(idCruzado).ok === false);

    const tipoRaro = clonar(amfeBueno); tipoRaro.doc_type = 'balanceo';
    ok('KNOWN-BAD: doc_type fuera de los 4 → rechazada', validarFilaParaRestore(tipoRaro).ok === false);

    const sinRowJson = clonar(amfeBueno); sinRowJson.row_json = null;
    ok('KNOWN-BAD: row_json null → rechazada', validarFilaParaRestore(sinRowJson).ok === false);

    const rowJsonArray = clonar(amfeBueno); rowJsonArray.row_json = [{ id: 'fixture-amfe-1' }];
    ok('KNOWN-BAD: row_json array → rechazada', validarFilaParaRestore(rowJsonArray).ok === false);

    ok('KNOWN-BAD: fila null → rechazada', validarFilaParaRestore(null).ok === false);

    const sinId = clonar(amfeBueno); sinId.id = '';
    ok('KNOWN-BAD: papelera sin id → rechazada', validarFilaParaRestore(sinId).ok === false);

    const textoRoto = clonar(amfeBueno); textoRoto.row_json = '{no es json';
    ok('KNOWN-BAD: row_json texto invalido → rechazada', validarFilaParaRestore(textoRoto).ok === false);

    const comoTexto = { ...clonar(amfeBueno) };
    comoTexto.row_json = JSON.stringify(amfeBueno.row_json);
    const vTexto = validarFilaParaRestore(comoTexto);
    ok('row_json como texto JSON valido: pasa pero avisa', vTexto.ok === true && vTexto.advertencias.length >= 1);

    const cpMinimo = {
        id: 'fixture-cp-1', doc_type: 'cp', project_name: null,
        deleted_at: '2026-07-30T11:00:00Z', deleted_by: null,
        row_json: { id: 'fixture-cp-1', data: '{"items":[]}' },
    };
    const vCp = validarFilaParaRestore(cpMinimo);
    ok('cp con solo las requeridas: valida y avisa de los defaults',
        vCp.ok === true && vCp.tabla === 'cp_documents' && vCp.advertencias.length >= 1);

    const conBasura = clonar(amfeBueno); conBasura.row_json.columna_inventada = 'x';
    const vBasura = validarFilaParaRestore(conBasura);
    ok('columna desconocida: pasa pero avisa', vBasura.ok === true && vBasura.advertencias.length >= 1);

    // --- render de la tabla
    const lineas = formatearTabla([{ id: 'fixture-amfe-1', doc_type: 'amfe', project_name: null, deleted_at: '2026-07-30T10:00:00.000Z', deleted_by: null }]);
    ok('tabla: encabezado + separador + 1 fila', lineas.length === 3);
    ok('tabla: muestra el id y la fecha recortada', lineas[2].includes('fixture-amfe-1') && lineas[2].includes('2026-07-30 10:00:00'));
    ok('tabla: los nulos salen como "-"', lineas[2].includes('-'));
    ok('tabla vacia: solo encabezado + separador', formatearTabla([]).length === 2);

    let fallados = 0;
    for (const c of casos) {
        console.log((c.ok ? '  OK   ' : '  FALLA') + ' ' + c.nombre);
        if (!c.ok) fallados++;
    }
    if (fallados > 0) {
        console.error(`\n✗ SELFTEST ROJO: ${fallados} de ${casos.length} casos. No confies en este script hasta arreglarlo.`);
        process.exit(1);
    }
    console.log(`\n✓ SELFTEST VERDE: ${casos.length} casos, sin tocar la red.`);
    process.exit(0);
}

// ─── Conexion (con el guard de credenciales) ────────────────────────────────

function abortarSinCredenciales(faltan) {
    console.error(`\n✗ ABORTADO — faltan variables en .env.local: ${faltan.join(', ')}`);
    console.error('  Las tablas tienen RLS para `authenticated`: sin login, la papelera devuelve');
    console.error('  0 filas SIN error, y una lista vacia se leeria como "no hay nada borrado".');
    console.error('  Eso es exactamente lo que dejo 19 dias de backups vacios (8/7 al 27/7).');
    console.error('\n  QUE HACER: agregar en C:\\Dev\\BarackMercosul\\.env.local la linea');
    for (const v of faltan) console.error(`     ${v}=<valor>`);
    console.error('  y volver a correr. La contrasena es la de la cuenta de VITE_AUTO_LOGIN_EMAIL.');
    console.error('  (No commitear .env.local: el repo es publico.)\n');
    process.exit(1);
}

async function conectar() {
    let env;
    try {
        env = loadEnv();
    } catch (e) {
        console.error(`\n✗ ABORTADO — no pude leer .env.local: ${e.message}`);
        console.error('  Sin ese archivo no hay forma de autenticarse contra Supabase.\n');
        process.exit(1);
    }

    const faltan = faltantesEnEnv(env);
    if (faltan.length > 0) abortarSinCredenciales(faltan);

    let sb;
    try {
        sb = await connectSupabase();
    } catch (e) {
        console.error(`\n✗ ABORTADO — no se pudo autenticar: ${e.message}`);
        console.error('  Revisar VITE_AUTO_LOGIN_EMAIL / VITE_AUTO_LOGIN_PASSWORD en .env.local.\n');
        process.exit(1);
    }

    // Guard extra: sesion presente. Sin sesion, RLS devuelve 0 filas sin error.
    const { data: ses } = await sb.auth.getSession();
    if (!ses?.session?.user) {
        console.error('\n✗ ABORTADO — el login no dejo sesion activa. Con RLS eso significa 0 filas sin error.\n');
        process.exit(1);
    }
    console.log(`  auth OK: ${ses.session.user.email}`);
    return sb;
}

/**
 * Lee la papelera. Un error de lectura SIEMPRE sale != 0: nunca se confunde
 * "no pude leer" con "no hay nada".
 */
async function leerPapelera(sb, tipo = null) {
    // `count: 'exact'` para poder comparar cuantas filas HAY contra cuantas VINIERON:
    // si PostgREST tiene un tope de filas, el listado saldria cortado sin decirlo y
    // creerias que lo que falta nunca se archivo.
    let q = sb.from('deleted_documents')
        .select(COLUMNAS_LISTADO, { count: 'exact' })
        .order('deleted_at', { ascending: false });
    if (tipo) q = q.eq('doc_type', tipo);
    const { data, error, count } = await q;
    if (error) {
        console.error(`\n✗ no pude leer deleted_documents: ${error.message}`);
        console.error('  Si dice que la relacion no existe, la tabla todavia no esta creada en este proyecto.');
        console.error('  Ojo: esto NO significa que la papelera este vacia.\n');
        process.exit(1);
    }
    if (!Array.isArray(data)) {
        console.error('\n✗ deleted_documents devolvio algo que no es una lista. Abortado por las dudas.\n');
        process.exit(1);
    }
    // Vinieron menos filas de las que hay: listado incompleto. Se avisa fuerte, porque
    // "no lo veo en la lista" se lee como "no se archivo" y esa confusion es la que
    // hace que alguien de por perdido un documento que en realidad esta guardado.
    if (typeof count === 'number' && count > data.length) {
        console.error(`\n✗ ABORTADO — la papelera tiene ${count} fila(s) pero la consulta devolvio ${data.length}.`);
        console.error('  El listado saldria cortado y lo que falte pareceria no archivado.');
        console.error('  Filtra por tipo (--tipo amfe) o revisa el tope de filas de PostgREST.\n');
        process.exit(1);
    }
    return data;
}

/** Trae UNA fila de la papelera por id. Sale != 0 si no existe o si la lectura falla. */
async function leerFila(sb, id) {
    const { data, error } = await sb.from('deleted_documents').select('*').eq('id', id);
    if (error) {
        console.error(`\n✗ no pude leer deleted_documents (id=${id}): ${error.message}\n`);
        process.exit(1);
    }
    if (!Array.isArray(data) || data.length === 0) {
        console.error(`\n✗ no hay ningun documento en la papelera con id "${id}".`);
        console.error('  Corre `node scripts/_trash.mjs --list` para ver los ids archivados.\n');
        process.exit(1);
    }
    return data[0];
}

// ─── Modos ──────────────────────────────────────────────────────────────────

const USO = `
Papelera de documentos APQP — ver y restaurar lo borrado.

  node scripts/_trash.mjs --list                    todo lo archivado (mas nuevo arriba)
  node scripts/_trash.mjs --list --tipo amfe        filtrado (amfe | cp | ho | pfd)
  node scripts/_trash.mjs --show <id>               detalle de una fila (read-only)
  node scripts/_trash.mjs --restore <id>            DRY-RUN: dice que haria
  node scripts/_trash.mjs --restore <id> --apply    ejecuta el restore
  node scripts/_trash.mjs --selftest                prueba la logica pura, sin red

El restore reinserta la fila original completa desde row_json y despues saca la fila
de la papelera. Nunca pisa un documento existente: si el id ya esta en la tabla
destino, aborta.
`;

async function modoList(tipo) {
    const sb = await conectar();
    const filas = await leerPapelera(sb, tipo);
    const filtro = tipo ? ` (tipo=${tipo})` : '';

    if (filas.length === 0) {
        console.log(`\nLa papelera esta vacia${filtro}: 0 documentos archivados.`);
        console.log('(La lectura funciono: esto es un vacio real, no un error tapado.)\n');
        process.exit(0);
    }

    console.log(`\nPapelera${filtro}: ${filas.length} documento(s) archivado(s)\n`);
    for (const l of formatearTabla(filas)) console.log(l);

    const porTipo = {};
    for (const f of filas) porTipo[f.doc_type] = (porTipo[f.doc_type] || 0) + 1;
    console.log(`\nPor tipo: ${Object.entries(porTipo).map(([t, n]) => `${t}=${n}`).join('  ')}`);
    console.log('Detalle: node scripts/_trash.mjs --show <id>   |   Restaurar: --restore <id>\n');
    process.exit(0);
}

async function modoShow(id) {
    const sb = await conectar();
    const fila = await leerFila(sb, id);
    const v = validarFilaParaRestore(fila);

    console.log(`\nPapelera — detalle de ${fila.id}\n`);
    console.log(`  doc_type      : ${fila.doc_type}`);
    console.log(`  tabla destino : ${v.tabla || '(desconocida: doc_type invalido)'}`);
    console.log(`  project_name  : ${fila.project_name ?? '-'}`);
    console.log(`  deleted_at    : ${fechaCorta(fila.deleted_at)}`);
    console.log(`  deleted_by    : ${fila.deleted_by ?? '-'}`);

    const original = v.filaOriginal;
    if (!original) {
        console.log('\n  row_json: NO se pudo leer como objeto (ver errores abajo).');
    } else {
        const claves = Object.keys(original);
        console.log(`\n  row_json: ${claves.length} columna(s) guardada(s)\n`);
        const ancho = Math.max(...claves.map((k) => k.length), 8);
        for (const k of claves) {
            const val = original[k];
            let desc;
            if (val === null) desc = 'null';
            else if (typeof val === 'string') desc = `string, ${val.length} char${val.length === 1 ? '' : 's'}${val.length <= 40 ? ` = "${val}"` : ''}`;
            else if (typeof val === 'number') desc = `number = ${val}`;
            else if (typeof val === 'boolean') desc = `boolean = ${val}`;
            else desc = `${Array.isArray(val) ? 'array' : typeof val}, ${JSON.stringify(val).length} chars de JSON`;
            console.log(`    ${k.padEnd(ancho)}  ${desc}`);
        }
        if (typeof original.data === 'string') {
            console.log(`\n  data: ${original.data.length} caracteres de JSON serializado (columna TEXT).`);
        }
    }

    if (v.advertencias.length > 0) {
        console.log('\n  Advertencias:');
        for (const a of v.advertencias) console.log(`    ! ${a}`);
    }
    if (v.errores.length > 0) {
        console.log('\n  Errores que impiden restaurarla:');
        for (const e of v.errores) console.log(`    X ${e}`);
        console.log('\n✗ Esta fila NO se puede restaurar tal como esta.\n');
        process.exit(1);
    }
    console.log('\n✓ La fila tiene todo lo necesario para restaurarse.');
    console.log(`  Simular: node scripts/_trash.mjs --restore ${fila.id}\n`);
    process.exit(0);
}

async function modoRestore(id, apply) {
    const sb = await conectar();
    const fila = await leerFila(sb, id);
    const v = validarFilaParaRestore(fila);

    console.log(`\n${apply ? 'RESTAURANDO' : 'DRY-RUN'} ${fila.doc_type} ${fila.id}\n`);

    if (!v.ok) {
        console.error('✗ ABORTADO — la fila de la papelera no alcanza para reinsertar el documento:');
        for (const e of v.errores) console.error(`    X ${e}`);
        console.error('\n  No se toco nada. La fila sigue en la papelera.\n');
        process.exit(1);
    }
    for (const a of v.advertencias) console.log(`  ! ${a}`);

    const tabla = v.tabla;
    const original = v.filaOriginal;

    // Guard anti-pisada #1: chequear el destino antes de escribir.
    const { data: existentes, error: errExiste } = await sb.from(tabla).select('id').eq('id', fila.id);
    if (errExiste) {
        console.error(`✗ ABORTADO — no pude chequear si ${fila.id} ya existe en ${tabla}: ${errExiste.message}`);
        console.error('  Sin ese chequeo no escribo nada.\n');
        process.exit(1);
    }
    if (Array.isArray(existentes) && existentes.length > 0) {
        console.error(`✗ ABORTADO — ya existe un documento con id "${fila.id}" en ${tabla}.`);
        console.error('  Restaurar encima lo pisaria y perderias el documento vigente.');
        console.error('  Que hacer: revisar el que esta vivo (la papelera queda intacta). Si de verdad');
        console.error('  hay que reemplazarlo, primero borralo desde la app (eso lo archiva de nuevo).\n');
        process.exit(1);
    }

    // Guard anti-pisada #1b: columnas UNIQUE distintas del id. Sin esto el DRY-RUN
    // dice "va a andar" y el --apply muere con unique violation (ver UNICOS_POR_TABLA).
    for (const col of (UNICOS_POR_TABLA[tabla] || [])) {
        const valor = original[col];
        if (valor === undefined || valor === null) continue;
        const { data: choques, error: errUnico } = await sb.from(tabla).select('id').eq(col, valor);
        if (errUnico) {
            console.error(`✗ ABORTADO — no pude chequear si ${col}="${valor}" ya esta en uso en ${tabla}: ${errUnico.message}`);
            console.error('  Sin ese chequeo no escribo nada.\n');
            process.exit(1);
        }
        if (Array.isArray(choques) && choques.length > 0) {
            console.error(`✗ ABORTADO — ${col}="${valor}" ya lo usa otro documento vivo en ${tabla} (id ${choques.map((c) => c.id).join(', ')}).`);
            console.error(`  Esa columna es UNIQUE: el INSERT seria rechazado. Pasa cuando el documento`);
            console.error('  se rehizo desde cero con el mismo numero despues de borrarlo.');
            console.error('  Que hacer: decidir cual de los dos queda. La papelera no se toco.\n');
            process.exit(1);
        }
    }

    const columnas = Object.keys(original);
    console.log(`  INSERT en ${tabla}: ${columnas.length} columnas, data = ${String(original.data).length} chars`);
    console.log(`  DELETE de deleted_documents where id = ${fila.id}`);

    if (!apply) {
        console.log('\nDRY-RUN: no se escribio nada.');
        console.log(`Si se ve bien: node scripts/_trash.mjs --restore ${fila.id} --apply\n`);
        process.exit(0);
    }

    // Guard anti-pisada #2: `.insert()` (NO upsert). Si el id existiera, la primary
    // key aborta el write aunque el chequeo de arriba hubiera leido mal.
    const { error: errInsert } = await sb.from(tabla).insert(original);
    if (errInsert) {
        console.error(`\n✗ ABORTADO — el INSERT en ${tabla} fallo: ${errInsert.message}`);
        console.error('  La fila sigue en la papelera: no se perdio nada.\n');
        process.exit(1);
    }

    // Confirmar leyendo de vuelta ANTES de borrar la copia de la papelera. No alcanza
    // con que el id aparezca: `data` es el documento entero, y si volvio con otro
    // largo (o dejo de ser texto) el restore corrompio el contenido.
    const { data: verif, error: errVerif } = await sb.from(tabla).select('id, data').eq('id', fila.id);
    if (errVerif || !Array.isArray(verif) || verif.length === 0) {
        console.error(`\n✗ el INSERT no dio error pero ${fila.id} no aparece en ${tabla}${errVerif ? ` (${errVerif.message})` : ''}.`);
        console.error('  NO borro la fila de la papelera: es la unica copia que queda.\n');
        process.exit(1);
    }
    const dataVuelta = verif[0].data;
    if (typeof dataVuelta !== 'string' || dataVuelta.length !== original.data.length) {
        console.error(`\n✗ ${fila.id} se inserto pero su data no volvio igual: guardado ${original.data.length} chars (string),`);
        console.error(`  leido ${typeof dataVuelta === 'string' ? `${dataVuelta.length} chars` : typeof dataVuelta}.`);
        console.error('  NO borro la fila de la papelera: revisar el documento restaurado antes de perder la copia.\n');
        process.exit(1);
    }
    console.log(`  OK ${fila.doc_type} ${fila.id} reinsertado en ${tabla} (data confirmada: ${dataVuelta.length} chars)`);

    const { error: errDel } = await sb.from('deleted_documents').delete().eq('id', fila.id);
    if (errDel) {
        console.error(`\n! El documento SI se restauro, pero no pude sacar la fila de la papelera: ${errDel.message}`);
        console.error('  Queda duplicado (vivo + archivado). Borra la fila de deleted_documents a mano.\n');
        process.exit(1);
    }

    console.log(`\n✓ LISTO: ${fila.doc_type} ${fila.id} restaurado en ${tabla} y sacado de la papelera.\n`);
    process.exit(0);
}

// ─── Main ───────────────────────────────────────────────────────────────────

/**
 * ¿Se ejecuto este archivo directamente (`node scripts/_trash.mjs ...`), o alguien
 * lo importo?
 *
 * Hace falta porque sin esta pregunta el CLI corria tambien al importar: un
 * `import { tablaDestino } from './_trash.mjs'` (un test de vitest, otro script)
 * imprimia "falta el modo" y mataba al importador con process.exit(1). Las funciones
 * exportadas eran una API inalcanzable.
 *
 * Compara rutas reales (realpath) sin distinguir mayusculas: en Windows el mismo
 * archivo llega como `C:\...` o `c:\...` segun quien lo invoque.
 *
 * Si la comparacion no se puede hacer, devuelve `true` = correr el CLI. La falla
 * tiene que caer para el lado ruidoso: un falso "me importaron" haria que
 * `--list` no imprima nada y salga 0, que es justo el sintoma que este script
 * existe para no repetir.
 */
function esEjecucionDirecta() {
    try {
        if (!process.argv[1]) return true;
        const propio = fileURLToPath(import.meta.url);
        const nombreArchivo = (r) => r.replace(/\\/g, '/').split('/').pop().toLowerCase();

        // Desempate por nombre de archivo ANTES del realpath: si el que arranco el
        // proceso se llama igual que este archivo, es ejecucion directa y punto. Sin
        // esto, un realpath que no matchee (junction, symlink, ruta con otra forma)
        // saltearia el CLI y `--list` saldria 0 sin imprimir nada — el sintoma exacto
        // que este script existe para no repetir.
        if (nombreArchivo(process.argv[1]) === nombreArchivo(propio)) return true;

        return realpathSync(propio).toLowerCase() === realpathSync(process.argv[1]).toLowerCase();
    } catch {
        return true;
    }
}

if (esEjecucionDirecta()) {
    const args = parsearArgs(process.argv.slice(2));

    if (args.error) {
        console.error(`\n✗ ${args.error}`);
        console.error(USO);
        process.exit(1);
    }

    if (args.modo === 'selftest') selftest();

    if (args.modo === 'help') {
        console.log(USO);
        process.exit(0);
    }

    if (args.modo === 'list') await modoList(args.tipo);
    if (args.modo === 'show') await modoShow(args.id);
    if (args.modo === 'restore') await modoRestore(args.id, args.apply);
}
