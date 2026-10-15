/**
 * AMFE de los apoyacabezas (151, 153, 155) alineados al flujograma 152 Rev.A con el REFILADO:
 * 30 REFILADO DE COMPONENTES CORTADOS · 31 COSTURA UNION (antes 30) · 32 COSTURA VISTA (antes 31).
 *
 * Fuentes:
 *   - Fak, 15/10/2026: "el refilado en APC se continua haciendo, se hace en el sector costura"; sobre cuando
 *     sumarlo, "hay que ponerlo... decidilo vos". La Rev.A del 152 todavia no salio a VW: entra en la misma letra.
 *   - Posicion y controles: Rev 0 del plan de control de Calidad (N. Perez, 04/06/2026), fila "Operacion de
 *     Refilado de Cortes de APC Vinilos Laterales", maquina refiladora BM 001 / BM 003: forma con regla metalica
 *     MC 310 y aspecto contra patron "sin dañar vinilo", 1 pieza al inicio y fin de turno, set up.
 *   - Hilo vista negro del L0 (FX483TK-E0PTO, plan de recepcion 1062 de LINHANYL): mail de L. Lattanzi del
 *     05/08/2026, punto 4 ("Incorporar Hilo decorativo Negro para todos los APC L0"), cargado en el arb.
 *     Se agrega a la OP 10 con la misma cadena que los otros dos hilos vista.
 *
 * Las causas nuevas van sin sigla: con S 7 y O 4 quedan dentro del criterio de SC, y asignarla es de Fak
 * (caracteristicas-especiales.md). El script las lista al final como candidatas.
 *
 * Uso:  node scripts/_amfeRefilado152.mjs            (dry-run)
 *       node scripts/_amfeRefilado152.mjs --apply
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectSupabase, readAmfe, saveAmfe, calculateAP, syncFieldAliases, syncLegacyFmFields } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, logChange, finish } from './_lib/dryRunGuard.mjs';

const AMFES = ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const FLUJO = path.resolve(fileURLToPath(import.meta.url), '../../tools/flowchart/data/152-APOYACABEZAS.json');
const REFILADO = 'REFILADO DE COMPONENTES CORTADOS';
const HILO_NEGRO = 'Hilo vista 20/3 Jet Black (Linhanyl) (codigo FX483TK-E0PTO)';

const { apply } = parseSafeArgs();
const banderas = process.argv.slice(2).filter((a) => a.startsWith('-') && !['--apply', '--verbose', '-v'].includes(a));
if (banderas.length) throw new Error(`Argumento que este script no conoce: ${banderas.join(', ')}`);

// El flujograma manda: sin el 30/31/32 emitido en el 152, no se toca nada.
const flujo = JSON.parse(fs.readFileSync(FLUJO, 'utf8'));
const paso = (id) => flujo.flow.find((x) => x.stepId === id)?.description;
if (flujo.header.revision !== 'A' || paso('30') !== REFILADO || paso('31') !== 'COSTURA UNIÓN' || paso('32') !== 'COSTURA VISTA') {
    throw new Error('El flujograma 152 no tiene 30 refilado / 31 costura union / 32 costura vista en Rev.A: primero el flujograma');
}

const id = () => crypto.randomUUID();
const causa = (texto, s, o, d, prevencion, deteccion) => ({
    id: id(), cause: texto, description: texto, severity: s, occurrence: o, detection: d,
    ap: calculateAP(s, o, d), actionPriority: calculateAP(s, o, d),
    preventionControl: prevencion, detectionControl: deteccion,
    specialChar: '', characteristicNumber: '', filterCode: '', preventionAction: '', detectionAction: '',
    responsible: '', targetDate: '', status: '', _autoFilled: true,
});
const falla = (texto, local, siguiente, usuario, causas) => ({
    id: id(), description: texto, effectLocal: local, effectNextLevel: siguiente, effectEndUser: usuario, causes: causas,
});

function opRefilado(focusElementFunction) {
    const funcion = 'Refilar el borde de los componentes de vinilo segun especificacion';
    return {
        id: id(), opNumber: '30', operationNumber: '30', name: REFILADO, operationName: REFILADO,
        focusElementFunction,
        operationFunction: 'Refilar el borde de los componentes de vinilo cortados dentro de especificacion, sin dañar el vinilo',
        workElements: [{
            id: id(), name: 'Maquina refiladora', type: 'Machine',
            functions: [{
                id: id(), description: funcion, functionDescription: funcion, requirements: '',
                failures: [
                    falla('Ancho de refilado fuera de especificacion',
                        'Componente que se vuelve a refilar o se descarta en el puesto',
                        'Toma de costura irregular en la costura union',
                        'Costura con defecto estetico visible en el apoyacabezas',
                        [causa('Refiladora mal regulada', 7, 4, 9,
                            'Regulacion de la refiladora en el set up de inicio de turno',
                            'Regla metalica MC 310, 1 pieza al inicio y fin de turno')]),
                    falla('Vinilo dañado en el refilado',
                        'Scrap del componente dañado',
                        'Reposicion del componente para la costura',
                        'Defecto visible en la funda si el componente dañado pasa',
                        [causa('Cuchilla de la refiladora gastada', 7, 4, 9,
                            'Verificacion de la refiladora en el set up de inicio de turno',
                            'Visual contra patron, 1 pieza al inicio y fin de turno')]),
                ],
            }],
        }],
    };
}

/** Copia profunda con ids nuevos (el hilo negro toma la cadena de los otros hilos vista). */
function conIdsNuevos(o) {
    if (Array.isArray(o)) return o.map(conIdsNuevos);
    if (o && typeof o === 'object') {
        const r = {};
        for (const [k, v] of Object.entries(o)) r[k] = k === 'id' ? id() : conIdsNuevos(v);
        return r;
    }
    return o;
}

const sb = await connectSupabase();
const lote = [];
const candidatasSC = [];

for (const numero of AMFES) {
    const { data: rows, error } = await sb.from('amfe_documents').select('id, amfe_number, project_name').eq('amfe_number', numero);
    if (error) throw error;
    if (rows.length !== 1) throw new Error(`Esperaba 1 ${numero}, encontre ${rows.length}`);
    const row = rows[0];
    const { doc } = await readAmfe(sb, row.id);
    const antes = JSON.parse(JSON.stringify(doc));
    const ops = doc.operations;
    const nombre = (o) => String(o.name ?? o.operationName ?? '');
    const con = (n) => ops.filter((o) => String(o.opNumber) === n);
    console.log(`\n=== ${numero} ===`);

    const hecho = con('30').length === 1 && nombre(con('30')[0]) === REFILADO;
    if (hecho) {
        console.log('   el refilado ya esta como 30: no se renumera');
    } else {
        if (ops.some((o) => /REFILADO/i.test(nombre(o)))) throw new Error(`${numero}: ya hay un refilado con otro numero`);
        const [union, vista] = [con('30'), con('31')];
        if (union.length !== 1 || !/COSTURA UNI[OÓ]N/i.test(nombre(union[0]))) throw new Error(`${numero}: la OP 30 no es la costura union`);
        if (vista.length !== 1 || !/COSTURA VISTA/i.test(nombre(vista[0]))) throw new Error(`${numero}: la OP 31 no es la costura vista`);
        if (con('32').length) throw new Error(`${numero}: la OP 32 ya esta ocupada`);
        vista[0].opNumber = '32'; vista[0].operationNumber = '32';
        union[0].opNumber = '31'; union[0].operationNumber = '31';
        logChange(apply, `${numero} OP 31 -> 32`, { antes: `31  ${nombre(vista[0])}`, despues: `32  ${nombre(vista[0])}` });
        logChange(apply, `${numero} OP 30 -> 31`, { antes: `30  ${nombre(union[0])}`, despues: `31  ${nombre(union[0])}` });
        const op22 = con('22')[0];
        if (!op22) throw new Error(`${numero}: no encontre la OP 22`);
        const nueva = opRefilado(op22.focusElementFunction ?? '');
        ops.splice(ops.indexOf(union[0]), 0, nueva);
        logChange(apply, `${numero} OP 30 nueva`, { despues: `30  ${REFILADO} (2 modos de falla, S7 O4 D9)` });
    }

    // Hilo vista negro del L0 en la recepcion, al lado de los otros dos hilos vista.
    const op10 = con('10')[0];
    if (!op10) throw new Error(`${numero}: no encontre la OP 10`);
    if (op10.workElements.some((w) => w.name === HILO_NEGRO)) {
        console.log('   el hilo negro del L0 ya esta en la OP 10');
    } else {
        const molde = op10.workElements.find((w) => /Hilo vista 20\/3 Alpe Gray/.test(w.name));
        if (!molde) throw new Error(`${numero}: no encontre el hilo vista Alpe Gray en la OP 10`);
        const negro = conIdsNuevos(molde);
        negro.name = HILO_NEGRO;
        const texto = JSON.stringify(negro);
        if (!texto.includes('plan 1063')) throw new Error(`${numero}: el hilo Alpe Gray ya no cita el plan 1063; revisar a mano`);
        const negroFinal = JSON.parse(texto.replaceAll('plan 1063', 'plan 1062'));
        op10.workElements.splice(op10.workElements.indexOf(molde) + 1, 0, negroFinal);
        logChange(apply, `${numero} OP 10 WE nuevo`, { despues: `${HILO_NEGRO} (misma cadena que Alpe Gray, plan 1062)` });
    }

    // Filas del log del 15/10 (misma letra A, todavia sin salir): quedan con la numeracion final.
    const filas = [
        [/^20-21, 22, 30$/, '20-21, 22, 30-32', null,
            'SE ALINEA CON EL FLUJOGRAMA 152 REV. A: EL CORTE PASA A NUMERARSE 20-21 (PREPARACION Y CORTE AUTOMATICO), EL CONTROL CON MYLAR PASA DE 28 A 22, EL REFILADO DE COMPONENTES CORTADOS ES LA OPERACION 30 Y LA COSTURA PASA A 31 (UNION) Y 32 (VISTA).'],
        [/^10 \/ 22 \/ 30 \/ 31 \/ 71 \/ 80$/, '10 / 22 / 31 / 32 / 71 / 80', [/EN LA OP 30 LA CAUSA/, 'EN LA OP 31 LA CAUSA'], null],
    ];
    for (const r of doc.revisions) {
        if (r.date !== '15/10/2026') continue;
        for (const [re, item, reemplazo, detalle] of filas) {
            if (!re.test(String(r.item))) continue;
            const nuevoDetalle = detalle ?? (reemplazo ? String(r.details).replace(reemplazo[0], reemplazo[1]) : r.details);
            logChange(apply, `${numero} fila de revision 15/10 "${r.item}"`, { antes: `${r.item} | ${r.details}`, despues: `${item} | ${nuevoDetalle}` });
            r.item = item;
            r.details = nuevoDetalle;
        }
    }
    const filaHilo = { rev: 'A', date: '15/10/2026', item: '10',
        details: 'SE AGREGA LA RECEPCION DEL HILO VISTA 20/3 JET BLACK (FX483TK-E0PTO): EL L0 LLEVA COSTURA VISTA COMO L1, L2 Y L3.',
        pswDate: '', modifiedBy: 'FS' };
    if (!doc.revisions.some((r) => r.details === filaHilo.details)) {
        doc.revisions.push(filaHilo);
        logChange(apply, `${numero} fila de revision nueva`, { despues: `${filaHilo.item} | ${filaHilo.details}` });
    }

    // Un texto que cite por numero la 30 o la 31 quedaria apuntando a otra operacion: se lista, no se reescribe solo.
    const re = /\b(?:OP\.?|OPERACI[OÓ]N)\s*(3[0-2])\b/gi;
    (function barrer(o, ruta, nivel) {
        if (typeof o === 'string') {
            for (const m of o.matchAll(re)) console.log(`   cita a mirar  ${ruta}: ${o.slice(0, 130)}`);
        } else if (Array.isArray(o)) {
            o.forEach((x, i) => barrer(x, `${ruta}[${i}]`, nivel + 1));
        } else if (o && typeof o === 'object') {
            for (const [k, v] of Object.entries(o)) if (!(nivel === 1 && (k === 'name' || k === 'operationName'))) barrer(v, `${ruta}.${k}`, nivel);
        }
    })(ops, 'operations', 0);

    for (const fm of ops.find((o) => String(o.opNumber) === '30').workElements.flatMap((w) => w.functions.flatMap((f) => f.failures))) {
        for (const c of fm.causes) if (c.severity >= 5 && c.severity <= 8 && c.occurrence >= 4) candidatasSC.push(`${numero} OP 30 · ${fm.description} · ${c.cause} (S${c.severity} O${c.occurrence})`);
    }
    // saveAmfe() sincroniza estos campos al guardar; la validacion corre antes, asi que se sincronizan aca.
    syncFieldAliases(doc);
    syncLegacyFmFields(doc);
    console.log(`   secuencia final: ${ops.map((o) => o.opNumber).join(' ')}`);
    if (JSON.stringify(doc) === JSON.stringify(antes)) {
        console.log('   nada que cambiar: no se reescribe');
        continue;
    }
    lote.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc });
}

if (candidatasSC.length) {
    console.log('\nCandidatas a SC por criterio (S 5-8 y O >= 4), SIN asignar — la sigla la decide Fak:');
    for (const c of candidatasSC) console.log(`   ${c}`);
}

if (lote.length) {
    await runWithValidation(lote, apply, async () => {
        for (const d of lote) {
            await saveAmfe(sb, d.id, d.after, { expectedAmfeNumber: d.amfeNumber });
            console.log(`   escrito ${d.amfeNumber}`);
        }
    });
}
finish(apply);
