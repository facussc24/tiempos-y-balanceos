/**
 * _agujasFieltroPwa.mjs — agrega a los 2 AMFE de telas Hilux de PWA (157 planas y 163 termoformadas) la falla "agujas rotas en el
 * fieltro" (reclamo PWA del 20/08/2026, fieltro 1000 g/m2) con el control tactil de recepcion
 * y el de troquelado, y lo deja en el historial de revisiones.
 *
 *   node scripts/_agujasFieltroPwa.mjs            # dry-run: muestra lo que agrega
 *   node scripts/_agujasFieltroPwa.mjs --apply    # escribe (pasa por runWithValidation)
 *
 * POR QUE (Manuel Meszaros, Calidad, WhatsApp a Fak 08/10/2026 20:01): *"necesito mostrar que
 * actualizamos el AMFE y plan de control de todas las telas planas o conformadas de PWA, para
 * justificar que hacemos un control tactil de presencia de agujas en la materia prima fieltros
 * cuando hacemos el control de recepcion en Barack y despues en nuestro proceso de troquelado"*.
 * Fak, 09/10/2026: *"si hay que tocarlo"* (los de proyecto tambien) y *"pensalo vos eso de la aguja"*.
 *
 * DE DONDE SALE CADA TEXTO
 *   - Falla y controles de deteccion: el mensaje de Manuel (control tactil en recepcion y en
 *     troquelado). Las agujas son las de punzonado (foto del 8D: agujas de fieltrar con codo).
 *   - Accion de optimizacion: la D7 del 8D (diapositiva "Tratamiento reclamos PWA 20/8"):
 *     "Actualizacion FMEA en Proveedor y en Barack", 15/10/2026, F. Santoro.
 *   - Material de cada AMFE: el que el propio AMFE ya nombra (159: Tela Punzonado Blanco;
 *     160 / AMFE-1: refuerzos 250 y 1000 g/m2 de su OP 50; AMFE-2: Fieltro Prensado 1500 g/m2).
 *   - S=10: el efecto es una aguja dentro del asiento, riesgo de lesion para el ocupante y para
 *     el operario (Tabla P1 SETEC pag. 101-103: salud del ocupante / riesgo agudo del operario).
 *     CC por criterio (S 9-10, regla caracteristicas-especiales.md), decidido con Fak.
 *   - O=10 en recepcion: no hay control PREVENTIVO en Barack (el control tactil es deteccion);
 *     P2 SETEC pag. 104-105, sin control preventivo = 10. Baja cuando el proveedor cierre su D7.
 *   - O=8 en troquelado: la prevencion es el control de recepcion (P2: prevencion poco efectiva).
 *   - D=9 en recepcion y en troquelado: la cobertura del control tactil no esta escrita (pregunta a
 *     Manuel); P3 SETEC pag. 109-111, sin 100 % = 9 (amfe.md §13).
 *   - AP por calculateAP.
 *
 * REVISION: AMFE-1 (157) y AMFE-2 (163) salen
 * titulados PRELIMINAR -> siguen A, con la fila en el historial (amfe.md §4bis y memoria
 * revision_no_sube_si_no_entro_en_serie).
 * NUMERO: el Excel emitido del 163 imprime "N° DE AMFE: AMFE-2" (el id interno de la app); el listado
 * maestro los tiene como 157 y 163 (_importListadoMaestro.mjs, decision de Fak 03/07/2026). Se corrige
 * header.amfeNumber para que el export imprima el numero del listado.
 *
 * No duplica: si la operacion ya nombra "aguja" + "fieltro/punzonado", no se vuelve a agregar.
 */
import { randomUUID } from 'crypto';
import {
    connectSupabase, readAmfe, saveAmfe, findOperation, calculateAP, syncLegacyFmFields, syncFieldAliases,
} from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const FECHA = '09/10/2026';
const RECLAMO = 'reclamo PWA 20/08/2026';

const DOCS = [
    // 159 y 160 (serie) quedan afuera: no llevan fieltro, solo tela punzonada, y el reclamo es del
    // fieltro de 1000 g/m2 de las Hilux de proyecto (Fak, 09/10/2026: "lo que pidio no es solo de proyecto?").
    { id: '57011560-d4c1-4a8a-83f0-ed37a2bab1d5', numero: 'AMFE-1', producto: 'PWA Hilux telas planas',
      revNueva: null, numeroListado: '157', recepcion: { weNuevo: 'Fieltro punzonado 250 g/m2 y 1000 g/m2 (refuerzos)', material: 'el fieltro' },
      troquelado: '50' },
    { id: 'c5201ba9-1225-4663-b7a1-5430f9ee8912', numero: 'AMFE-2', producto: 'PWA Hilux telas termoformadas',
      revNueva: null, numeroListado: '163', recepcion: { weExistente: 'Fieltro Prensado BSDL2603-3N (1500 g/m2)', material: 'el fieltro' },
      troquelado: '60' },
];

const EFECTOS = {
    effectLocal: 'Riesgo de lesion del operario al manipular el material',
    effectNextLevel: 'Riesgo de lesion del operario de PWA en el ensamble; reclamo de cliente',
    effectEndUser: 'Aguja dentro del asiento: riesgo de lesion al ocupante',
};
const ACCION = {
    preventionAction: `Actualizacion del AMFE del proveedor del fieltro por el ${RECLAMO}`,
    responsible: 'F. Santoro',
    targetDate: '15/10/2026',
};

const yaTieneAgujas = (op) => {
    const t = JSON.stringify(op).toLowerCase();
    return t.includes('presencia de agujas');
};

function causaNueva(molde, { texto, S, O, D, prev, det, conAccion }) {
    const vacia = Object.fromEntries(Object.keys(molde || {}).map(k => [k, '']));
    const ap = calculateAP(S, O, D);
    return {
        ...vacia,
        id: randomUUID(),
        cause: texto,
        description: texto,
        severity: S, occurrence: O, detection: D,
        ap, actionPriority: ap,
        specialChar: 'CC',
        preventionControl: prev,
        detectionControl: det,
        ...(conAccion ? ACCION : {}),
    };
}

function moldeDe(op) {
    return op.workElements.flatMap(w => w.functions || []).flatMap(f => f.failures || [])
        .flatMap(f => f.causes || []).find(c => 'preventionAction' in c);
}

function imprimir(numero, op, we, fn, falla) {
    const c = falla.causes[0];
    console.log(`\n${numero} · OP ${op.opNumber} ${op.name || op.operationName}`);
    console.log(`  WE [${we.type}] ${we.name}${we._nuevo ? '   (elemento NUEVO)' : '   (elemento existente)'}`);
    console.log(`    Funcion   : ${fn.description}`);
    console.log(`    Falla     : ${falla.description}`);
    console.log(`    Efectos   : local = ${falla.effectLocal}`);
    console.log(`                siguiente = ${falla.effectNextLevel}`);
    console.log(`                usuario = ${falla.effectEndUser}`);
    console.log(`    Causa     : ${c.cause}`);
    console.log(`                S${c.severity} O${c.occurrence} D${c.detection} AP=${c.ap}  sigla=${c.specialChar}`);
    console.log(`    Prevencion: ${c.preventionControl}`);
    console.log(`    Deteccion : ${c.detectionControl}`);
    if (c.preventionAction) console.log(`    Accion    : ${c.preventionAction} · ${c.responsible} · ${c.targetDate}`);
}

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const plan = [];
const extras = {};

for (const cfg of DOCS) {
    const { doc: before, amfe_number } = await readAmfe(sb, cfg.id);
    if (amfe_number !== cfg.numero) throw new Error(`esperaba ${cfg.numero} y lei ${amfe_number}: no toco nada`);
    const after = structuredClone(before);
    let cambios = 0;
    const items = [];

    // ── 1. Recepcion (OP 10) ────────────────────────────────────────────────
    const op10 = findOperation(after, '10');
    if (!op10) throw new Error(`${cfg.numero}: no encuentro la OP 10`);
    if (yaTieneAgujas(op10)) {
        console.log(`${cfg.numero} OP 10: ya tiene la falla de agujas, no se vuelve a agregar.`);
    } else {
        const D10 = 9; // cobertura del control tactil no escrita (pregunta a Manuel): P3 sin 100% = 9
        const det10 = cfg.troquelado
            ? `Control tactil de presencia de agujas en recepcion y control tactil en troquelado`
            : 'Control tactil de presencia de agujas en recepcion';
        const causa = causaNueva(moldeDe(op10), {
            texto: 'Agujas del proceso de punzonado del proveedor que se quiebran y quedan dentro del material',
            S: 10, O: 10, D: D10,
            prev: "TBD: control de agujas en el punzonado del proveedor",
            det: det10, conAccion: true,
        });
        const falla = { id: randomUUID(), description: `Presencia de agujas rotas en ${cfg.recepcion.material} (cuerpo extrano metalico)`, ...EFECTOS, causes: [causa] };
        let we, fn;
        if (cfg.recepcion.weExistente) {
            we = op10.workElements.find(w => w.name === cfg.recepcion.weExistente);
            if (!we) throw new Error(`${cfg.numero}: no encuentro el WE "${cfg.recepcion.weExistente}" en OP 10`);
            fn = we.functions[0];
            fn.failures.push(falla);
        } else {
            const fnTxt = cfg.recepcion.fn || 'Recibir el fieltro de los refuerzos libre de cuerpos extranos, conforme a especificacion';
            fn = { id: randomUUID(), description: fnTxt, functionDescription: fnTxt, requirements: '', failures: [falla] };
            we = { id: randomUUID(), name: cfg.recepcion.weNuevo, type: 'Material', functions: [fn] };
            op10.workElements.push(we);
            we._nuevo = true;
        }
        imprimir(cfg.numero, op10, we, fn, falla);
        delete we._nuevo;
        cambios++; items.push('10');
    }

    // ── 2. Troquelado ───────────────────────────────────────────────────────
    if (cfg.troquelado) {
        const opT = findOperation(after, cfg.troquelado);
        if (!opT) throw new Error(`${cfg.numero}: no encuentro la OP ${cfg.troquelado}`);
        if (!/TROQUELADO DE REFUERZOS/i.test(opT.name || opT.operationName || '')) {
            throw new Error(`${cfg.numero}: la OP ${cfg.troquelado} no es TROQUELADO DE REFUERZOS (${opT.name}): no toco nada`);
        }
        if (yaTieneAgujas(opT)) {
            console.log(`${cfg.numero} OP ${cfg.troquelado}: ya tiene la falla de agujas, no se vuelve a agregar.`);
        } else {
            const causa = causaNueva(moldeDe(opT), {
                texto: 'Aguja retenida en el fieltro no detectada en el control de recepcion',
                S: 10, O: 8, D: 9,
                prev: 'Control tactil de presencia de agujas en recepcion',
                det: 'Control tactil de presencia de agujas en el fieltro al troquelar, segun instruccion de troquelado con foto',
                conAccion: false,
            });
            const falla = { id: randomUUID(), description: 'Refuerzo troquelado con aguja rota adentro pasa a la operacion siguiente', ...EFECTOS, causes: [causa] };
            let we = opT.workElements.find(w => w.type === 'Man');
            const fnTxt = 'Verificar al tacto cada plancha de fieltro antes de troquelar';
            const fn = { id: randomUUID(), description: fnTxt, functionDescription: fnTxt, requirements: '', failures: [falla] };
            if (we) { we.functions.push(fn); }
            else {
                we = { id: randomUUID(), name: 'Operador de produccion', type: 'Man', functions: [fn], _nuevo: true };
                opT.workElements.push(we);
            }
            imprimir(cfg.numero, opT, we, fn, falla);
            delete we._nuevo;
            cambios++; items.push(cfg.troquelado);
        }
    }

    if (cambios === 0) continue;

    // ── 3. Historial de revisiones (columna `revisions` + data.revisions) ───
    const { data: fila, error } = await sb.from('amfe_documents').select('revisions, revision_level').eq('id', cfg.id).single();
    if (error) throw new Error(`${cfg.numero}: no pude leer revisions: ${error.message}`);
    let revs = [];
    try { revs = typeof fila.revisions === 'string' ? JSON.parse(fila.revisions || '[]') : (fila.revisions || []); } catch { revs = []; }
    const letra = cfg.revNueva || String(after.header?.revisionLevel || after.header?.revision || fila.revision_level || 'A');
    const detalle = `OP ${items.join(' y OP ')}: alta de la falla presencia de agujas rotas en ${cfg.recepcion.material} con control tactil en recepcion${cfg.troquelado ? ' y en troquelado' : ''} (${RECLAMO})`;
    const filaNueva = { rev: letra, date: FECHA, item: items.join(', '), description: detalle, details: detalle, modifiedBy: 'FS' };
    revs.push(filaNueva);
    after.revisions = Array.isArray(after.revisions) ? after.revisions : [];
    after.revisions.push({ ...filaNueva, pswDate: '' });
    after.header = after.header || {};
    const revAntes = after.header.revisionLevel || after.header.revision;
    after.header.revDate = FECHA;
    if (cfg.numeroListado && after.header.amfeNumber !== cfg.numeroListado) {
        console.log(`${cfg.numero} N° de AMFE impreso: ${after.header.amfeNumber} -> ${cfg.numeroListado}`);
        after.header.amfeNumber = cfg.numeroListado;
    }
    if (cfg.revNueva) {
        for (const k of ['rev', 'revision', 'revisionLevel']) if (k in after.header) after.header[k] = cfg.revNueva;
    }
    console.log(`\n${cfg.numero} historial: + ${letra} · ${FECHA} · item ${items.join(', ')} · ${detalle}`);
    console.log(`${cfg.numero} revision: ${revAntes} -> ${cfg.revNueva || revAntes} · revDate ${before.header?.revDate} -> ${FECHA}`);
    console.log('─'.repeat(100));

    syncLegacyFmFields(after);
    syncFieldAliases(after);
    extras[cfg.id] = { revisions: JSON.stringify(revs), ...(cfg.revNueva ? { revision_level: cfg.revNueva } : {}) };
    plan.push({ id: cfg.id, amfeNumber: cfg.numero, productName: cfg.producto, before, after });
}

if (plan.length === 0) { console.log('\nNada para hacer.'); process.exit(0); }

await runWithValidation(plan, apply, async () => {
    for (const p of plan) {
        await saveAmfe(sb, p.id, p.after, { expectedAmfeNumber: p.amfeNumber, extraFields: extras[p.id] });
        console.log(`guardado ${p.amfeNumber}`);
    }
});
finish(apply);
process.exit(0);
