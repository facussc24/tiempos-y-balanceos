/**
 * _corregirAmfesPuertasPatagonia.mjs — correcciones puntuales y documentadas en los AMFE de las
 * tapizadas de puerta Patagonia (Insert 158, APB de puerta 161, Top Roll 162).
 *
 *   node scripts/_corregirAmfesPuertasPatagonia.mjs            # dry-run: muestra cada cambio
 *   node scripts/_corregirAmfesPuertasPatagonia.mjs --apply    # escribe (pasa por runWithValidation)
 *
 * POR QUE (Fak, 01/10/2026, despues del cruce contra los planes de control de Calidad:
 * "podes avanzar con algunas cosas... que son simples o que ya estas 100% que estan mal")
 *
 * QUE CAMBIA Y DE DONDE SALE (nada es criterio nuevo: son textos que quedaron viejos)
 *   AMFE-INS-PAT (158)
 *     - Recepcion: la grampa figura con el codigo DK/1840400 (4 mm). La BOM del arb del
 *       28/09/2026 del Insert dice DK/1840600, GRAMPA DORKING 84/06 (6 mm).
 *     - Operacion 70-71: dos textos nombran una "OP 30" de control dimensional. En el flujograma
 *       154 Rev.C las decenas 30 y 40 estan libres y el control de pieza inyectada es la 71.
 *   AMFE-ARM-PAT (161)
 *     - Recepcion: una causa repetida (autoelevador) y una falla repetida con sus tres causas
 *       (trazabilidad). Se deja una de cada una.
 *     - Operacion 41: la funcion dice "costura decorativa doble" y la operacion es
 *       COSTURA VISTA (1 SOLA LINEA) en el flujograma 153 Rev.C y en la HO 971.
 *     - Operacion 50: la misma "OP 30"; el control de pieza inyectada es la 51.
 *   AMFE-TR-PAT (162)
 *     - Operacion 10: la misma "OP 30" para el control final, que en el flujograma 155 Rev.C es
 *       la 80.
 *
 * No toca S, O, D, AP ni caracteristicas especiales. La letra de revision no cambia (los tres
 * siguen en A hasta la proxima emision, amfe.md 4bis); se suma una fila al historial y la fecha
 * de revision del encabezado sigue a esa fila.
 *
 * No duplica: cada cambio se hace solo si el texto viejo sigue ahi.
 */
import {
    connectSupabase, listAmfes, readAmfe, saveAmfe, findOperation, syncLegacyFmFields, syncFieldAliases,
} from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const FECHA = '01/10/2026';

/** Reemplaza `viejo` por `nuevo` en todos los textos que cuelgan de `nodo`. Devuelve cuantos. */
function reemplazar(nodo, viejo, nuevo) {
    let n = 0;
    const andar = (o) => {
        if (Array.isArray(o)) { o.forEach(andar); return; }
        if (!o || typeof o !== 'object') return;
        for (const k of Object.keys(o)) {
            if (typeof o[k] === 'string' && o[k].includes(viejo)) {
                o[k] = o[k].split(viejo).join(nuevo);
                n++;
            } else if (o[k] && typeof o[k] === 'object') andar(o[k]);
        }
    };
    andar(nodo);
    return n;
}

/** Igualdad de contenido sin mirar los ids. */
const huella = (o) => JSON.stringify(o, (k, v) => (k === 'id' ? undefined : v));

/** Saca de `lista` los elementos cuyo contenido repite a uno anterior. Devuelve los sacados. */
function sacarRepetidos(lista) {
    const vistos = new Set();
    const sacados = [];
    for (let i = 0; i < lista.length; i++) {
        const h = huella(lista[i]);
        if (vistos.has(h)) { sacados.push(lista.splice(i, 1)[0]); i--; } else vistos.add(h);
    }
    return sacados;
}

const TAREAS = {
    'AMFE-INS-PAT': {
        nombre: 'INSERT Patagonia',
        item: '10, 70-71',
        detalle: 'SE CORRIGE EL CODIGO DE LA GRAMPA DE FIJACION EN LA RECEPCION (DK/1840600). EN LA OPERACION 70-71 '
            + 'SE ACTUALIZA LA REFERENCIA AL CONTROL DE PIEZA INYECTADA (OP. 71).',
        hacer(doc, log) {
            const op10 = findOperation(doc, '10');
            log('OP 10 · codigo de grampa DK/1840400 -> DK/1840600', reemplazar(op10, 'DK/1840400', 'DK/1840600'));
            const op70 = findOperation(doc, '70-71');
            if (!op70) throw new Error('AMFE-INS-PAT: no encuentro la OP 70-71');
            log('OP 70-71 · efecto: "llega a OP 30 control dimensional" -> "llega al control de pieza inyectada (OP 71)"',
                reemplazar(op70, 'llega a OP 30 control dimensional', 'llega al control de pieza inyectada (OP 71)'));
            log('OP 70-71 · deteccion: "Control final en OP 30" -> "Control de pieza inyectada en OP 71"',
                reemplazar(op70, 'Control final en OP 30', 'Control de pieza inyectada en OP 71'));
        },
    },
    'AMFE-ARM-PAT': {
        nombre: 'ARMREST DOOR PANEL Patagonia',
        item: '10, 41, 50',
        detalle: 'SE QUITAN UNA CAUSA Y UNA FALLA REPETIDAS EN LA RECEPCION (OP. 10). SE CORRIGE LA FUNCION DE LA COSTURA '
            + 'VISTA, QUE ES DE UNA SOLA LINEA (OP. 41). EN LA OPERACION 50 SE ACTUALIZA LA REFERENCIA AL CONTROL DE '
            + 'PIEZA INYECTADA (OP. 51).',
        hacer(doc, log) {
            const op10 = findOperation(doc, '10');
            let causas = 0, fallas = 0;
            for (const we of op10.workElements || []) {
                for (const fn of we.functions || []) {
                    fallas += sacarRepetidos(fn.failures || []).length;
                    for (const fm of fn.failures || []) causas += sacarRepetidos(fm.causes || []).length;
                }
            }
            log('OP 10 · fallas repetidas que se quitan (con sus causas)', fallas);
            log('OP 10 · causas repetidas que se quitan', causas);
            const op41 = findOperation(doc, '41');
            log('OP 41 · funcion: "costura decorativa doble" -> "costura vista de 1 sola linea"',
                reemplazar(op41, 'Ejecutar costura decorativa doble conforme a especificacion',
                    'Ejecutar costura vista de 1 sola linea conforme a especificacion'));
            const op50 = findOperation(doc, '50');
            log('OP 50 · efecto: "llega a OP 30 control dimensional" -> "llega al control de pieza inyectada (OP 51)"',
                reemplazar(op50, 'llega a OP 30 control dimensional', 'llega al control de pieza inyectada (OP 51)'));
            log('OP 50 · deteccion: "Control final en OP 30" -> "Control de pieza inyectada en OP 51"',
                reemplazar(op50, 'Control final en OP 30', 'Control de pieza inyectada en OP 51'));
        },
    },
    'AMFE-TR-PAT': {
        nombre: 'TOP ROLL Patagonia',
        item: '10',
        detalle: 'EN LA OPERACION 10 SE ACTUALIZA LA REFERENCIA AL CONTROL FINAL (OP. 80).',
        hacer(doc, log) {
            const op10 = findOperation(doc, '10');
            log('OP 10 · efecto: "llega a OP 30 control dimensional" -> "llega al control final (OP 80)"',
                reemplazar(op10, 'llega a OP 30 control dimensional', 'llega al control final (OP 80)'));
            log('OP 10 · deteccion: "Control final en OP 30" -> "Control final en OP 80"',
                reemplazar(op10, 'Control final en OP 30', 'Control final en OP 80'));
        },
    },
};

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const todos = await listAmfes(sb);
const plan = [];
const guardar = [];

for (const [numero, tarea] of Object.entries(TAREAS)) {
    const fila = todos.filter(a => a.amfe_number === numero);
    if (fila.length !== 1) throw new Error(`${numero}: esperaba 1 documento y hay ${fila.length}`);
    const { doc: before, amfe_number } = await readAmfe(sb, fila[0].id);
    if (amfe_number !== numero) throw new Error(`esperaba ${numero} y lei ${amfe_number}`);
    const after = structuredClone(before);
    let cambios = 0;
    console.log(`\n── ${numero} · ${tarea.nombre}`);
    tarea.hacer(after, (que, n) => { console.log(`   ${n > 0 ? '✔' : '·'} ${que}: ${n}`); cambios += n; });
    if (cambios === 0) { console.log('   nada para hacer (ya estaba corregido)'); continue; }

    after.revisions = Array.isArray(after.revisions) ? after.revisions : [];
    const ya = after.revisions.some(r => r.date === FECHA && String(r.details || r.description || '') === tarea.detalle);
    if (!ya) {
        after.revisions.push({ rev: 'A', date: FECHA, item: tarea.item, details: tarea.detalle, pswDate: '', modifiedBy: 'FS' });
        after.header = after.header || {};
        console.log(`   historial: A · ${FECHA} · item ${tarea.item}`);
        console.log(`   fecha de revision del encabezado: ${before.header?.revDate} -> ${FECHA}`);
        after.header.revDate = FECHA;
    }
    syncLegacyFmFields(after);
    syncFieldAliases(after);
    plan.push({ id: fila[0].id, amfeNumber: numero, productName: tarea.nombre, before, after });
    guardar.push({ id: fila[0].id, numero, after });
}

if (plan.length === 0) { console.log('\nNada para hacer.'); process.exit(0); }

await runWithValidation(plan, apply, async () => {
    for (const g of guardar) await saveAmfe(sb, g.id, g.after, { expectedAmfeNumber: g.numero });
});
finish(apply);
