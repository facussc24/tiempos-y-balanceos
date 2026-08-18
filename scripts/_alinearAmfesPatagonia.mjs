/**
 * _alinearAmfesPatagonia.mjs — los AMFE adoptan la numeracion de su flujograma Rev. B.
 *
 * EL CRITERIO (opcion C, elegida por Fak el 18/08/2026)
 * El flujograma DESGLOSA lo que el AMFE AGRUPA: donde el flujograma abre ocho pasos de
 * corte (20 a 27), el AMFE tiene una sola fila. Las dos formas son validas — agrupar
 * mantiene el AMFE manejable, desglosar da trazabilidad fina — y lo que rompe la
 * trazabilidad es que cada documento haga una cosa distinta sin decirlo.
 *
 * Asi que el AMFE conserva su nivel de agregacion y **declara el rango en el nombre**,
 * que es lo que el AMFE 151 ya venia haciendo solo: `"OP 20-26 CORTE DE VINILO"`. Queda
 * explicito que una fila del AMFE cubre varias del flujograma, y el numero de arranque
 * coincide.
 *
 * NO SE INVENTA NINGUNA OPERACION. Las que el flujograma declara y el AMFE no analiza
 * (controles de pieza inyectada, reprocesos nuevos) quedan como hueco reportado: abrirlas
 * pide modos de falla reales, y esos no salen de otro documento.
 *
 * ⚠️ Se renumera de MAYOR a MENOR: al reves, mover 50->40 pisa al 40 que todavia no salio.
 * ⚠️ Cada operacion se ubica por NOMBRE, nunca por posicion (`renumerar_sin_leer_contenido`).
 *
 * Uso:  node scripts/_alinearAmfesPatagonia.mjs           (dry-run)
 *       node scripts/_alinearAmfesPatagonia.mjs --apply
 */

import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import { connectSupabase, parseData, saveAmfe, syncFieldAliases } from './_lib/amfeIo.mjs';

/**
 * Por AMFE: cada fila es [regex del nombre actual, numero actual, numero nuevo, nombre nuevo].
 * El nombre nuevo va solo cuando hay que declarar el rango; si es null, no se toca.
 */
const PLAN = {
    // ─── IP PAD (149) contra el flujograma 157 ────────────────────────────────
    // Solo hay que declarar dos rangos. El resto ya coincide numero por numero.
    'VWA-PAT-IPPADS-001': {
        producto: 'IP PAD',
        cambios: [
            [/^INYECCION DE SUSTRATOS Y CONTROL/i, '20', '20',
                'OP 20-26 INYECCION DE SUSTRATOS Y CONTROL (INCLUYE LIBERACION DE 1A PIEZA Y CONTROL DE CALIDAD DE INYECCION)'],
            [/^CORTE \(CARGA, AJUSTE Y CORTE AUTOMATICO/i, '30', '30',
                'OP 30-37 CORTE (CARGA, AJUSTE Y CORTE AUTOMATICO DE VINILO)'],
        ],
    },

    // ─── APC DELANTERO (151) contra el flujograma 152 ─────────────────────────
    'AMFE-HF-PAT': {
        producto: 'APOYACABEZAS DELANTERO',
        cambios: [
            [/^OP 20-26 CORTE DE VINILO$/i, '20', '20', 'OP 20-27 CORTE DE VINILO'],
            [/^OP 30-33 COSTURA UNION$/i, '30', '30', 'OP 30 / 32-34 COSTURA UNION'],
            [/^COSTURA VISTA$/i, '40', '31', null],
            [/^ENFUNDADO$/i, '50', '40', null],
            [/^INSERCION DE VARILLA$/i, '51', '41', null],
            [/^COLOCACION DE PRECINTO CON PISTOLA ETIQUETADORA$/i, '60', '42', null],
            [/^COLOCACION DE BOLSA Y CARGA DEL APOYACABEZAS EN EL MOLDE$/i, '61', '50', null],
            [/^CIERRE DEL MOLDE Y COLOCACION DE BOQUILLA$/i, '62', '51', null],
            [/^INYECCION DE PU$/i, '63', '52', null],
            [/^CONTROL FINAL DE CALIDAD$/i, '70', '60', null],
            [/^REPROCESO: ELIMINACION DE HILO SOBRANTE$/i, '80', '70', null],
            [/^REPROCESO: PUNTADA FLOJA$/i, '81', '71', null],
            [/^REPROCESO: ELIMINACION DE ARRUGAS EN HORNO$/i, '82', '72', null],
            [/^EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO$/i, '90', '80', null],
        ],
    },

    // ─── APC TRASERO CENTRAL (153) y LATERAL (155) contra el flujograma 152 ───
    // Los dos tienen exactamente la misma estructura.
    'AMFE-HRC-PAT': { producto: 'APOYACABEZAS TRASERO CENTRAL', cambios: null },
    'AMFE-HRO-PAT': { producto: 'APOYACABEZAS TRASERO LATERAL', cambios: null },
};

/** Traseros: identico plan para los dos. El 11 CONTROL DE MATERIA PRIMA no se toca. */
const PLAN_TRASEROS = [
    [/^CORTE DE PANELES$/i, '20', '20', 'OP 20-27 CORTE DE PANELES'],
    [/^CONTROL CON PLANTILLA MYLAR$/i, '25', '28', null],
    [/^COSTURA UNION$/i, '30', '30', 'OP 30 / 32-34 COSTURA UNION'],
    [/^COSTURA VISTA$/i, '40', '31', null],
    [/^INSERCION DE VARILLA$/i, '50', '41', null],
    [/^ENFUNDADO$/i, '60', '40', null],
    [/^INYECCION DE PU$/i, '70', '52', null],
    [/^CONTROL FINAL DE CALIDAD$/i, '80', '60', null],
    [/^REPROCESO: ELIMINACION DE HILO SOBRANTE$/i, '90', '70', null],
    [/^REPROCESO: PUNTADA FLOJA$/i, '91', '71', null],
    [/^REPROCESO: ELIMINACION DE ARRUGAS EN HORNO$/i, '92', '72', null],
    [/^EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO$/i, '100', '80', null],
];
PLAN['AMFE-HRC-PAT'].cambios = PLAN_TRASEROS;
PLAN['AMFE-HRO-PAT'].cambios = PLAN_TRASEROS;

const num = (o) => String(o.opNumber ?? o.operationNumber ?? '').trim();
const nom = (o) => String(o.name ?? o.operationName ?? '').trim();

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const claves = Object.keys(PLAN);
const { data: rows, error } = await sb
    .from('amfe_documents').select('id, amfe_number, data').in('amfe_number', claves);
if (error) throw error;

const plan = [];
const commits = [];

for (const clave of claves) {
    const row = rows.find(r => r.amfe_number === clave);
    if (!row) throw new Error(`No encontre ${clave}.`);
    const { producto, cambios } = PLAN[clave];
    const before = parseData(row.data);
    const doc = parseData(row.data);

    console.log(`\n─── ${producto} (${clave}) ───`);

    // Ubicar todo por nombre y confirmar que esta donde el diagnostico dice, ANTES de tocar.
    const ubicadas = cambios.map(([re, de, a, nombreNuevo]) => {
        const op = (doc.operations || []).find(o => re.test(nom(o)));
        if (!op) throw new Error(`${clave}: no encontre ${re}. Se aborta para no renumerar a ciegas.`);
        const actual = num(op);
        if (actual !== de) throw new Error(`${clave}: "${nom(op)}" esta en ${actual} y esperaba ${de}. Se aborta.`);
        return { op, de, a, nombreNuevo };
    });

    // De MAYOR a MENOR para no pisar un numero que todavia no se movio.
    for (const { op, de, a, nombreNuevo } of [...ubicadas].sort((x, y) => Number(y.de) - Number(x.de))) {
        const antes = nom(op);
        if (de !== a) { op.opNumber = a; op.operationNumber = a; }
        if (nombreNuevo) { op.name = nombreNuevo; op.operationName = nombreNuevo; }
        const flecha = de === a ? `${de.padStart(4)}      ` : `${de.padStart(4)} -> ${a.padStart(3)}`;
        logChange(apply, `${flecha}  ${nombreNuevo ? `${antes}\n                  => ${nombreNuevo}` : antes}`, {});
    }

    doc.operations.sort((x, y) => Number(num(x) || 0) - Number(num(y) || 0));
    const nums = doc.operations.map(num);
    const dup = nums.filter((v, i) => nums.indexOf(v) !== i);
    if (dup.length) throw new Error(`${clave}: quedarian numeros duplicados: ${dup.join(', ')}`);
    console.log(`   queda: ${nums.join(' · ')}`);

    syncFieldAliases(doc);
    plan.push({ id: row.id, amfeNumber: clave, productName: producto, before, after: doc });
    commits.push(async () => {
        await saveAmfe(sb, row.id, doc);
        const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', row.id).single();
        const live = parseData(chk.data);
        const n = (live.operations || []).map(o => String(o.opNumber ?? o.operationNumber ?? ''));
        const d2 = n.filter((v, i) => n.indexOf(v) !== i);
        if (d2.length) throw new Error(`POST-CHECK ${clave}: duplicados ${d2.join(', ')}`);
        console.log(`POST-CHECK live ${clave}: ${n.join(' · ')}`);
    });
}

await runWithValidation(plan, apply, async () => { for (const c of commits) await c(); });
finish(apply);
