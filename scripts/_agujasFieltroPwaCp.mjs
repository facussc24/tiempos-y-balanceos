/**
 * _agujasFieltroPwaCp.mjs — agrega al Plan de Control de las telas Hilux de PWA (planas 21-9463 y
 * termoformadas 582D, los dos de la app) las filas del control tactil de agujas en el fieltro:
 * una en recepcion y una en troquelado. Compañero de `_agujasFieltroPwa.mjs` (los AMFE).
 *
 *   node scripts/_agujasFieltroPwaCp.mjs            # dry-run: muestra las filas
 *   node scripts/_agujasFieltroPwaCp.mjs --apply    # escribe
 *
 * POR QUE: el mismo pedido de Manuel Meszaros (08/10/2026) — AMFE y plan de control actualizados
 * con el control tactil en recepcion y en troquelado, por el reclamo PWA del 20/08/2026.
 * Estos dos planes son los unicos de 581D/582D: las carpetas "Plan de Control" de sus legajos en
 * PPAP CLIENTES\PWA estan vacias (relevado el 09/10/2026).
 *
 * DE DONDE SALE CADA CELDA
 *   - Caracteristica, tecnica y operaciones: el mensaje de Manuel.
 *   - CC: la S=10 de la causa en el AMFE (misma corrida).
 *   - Tamaño de muestra: TBD hasta que Manuel diga si el control es a cada plancha/rollo.
 *   - Metodo, plan de reaccion y responsable: los que el mismo plan ya usa en esas operaciones.
 *
 * ALINEACION CON EL AMFE (Fak, 09/10/2026: "asegurate de que queden bien, no somos muy buenos
 * haciendolos"). Solo lo que el AMFE de la misma pieza ya dice; nada copiado de otro producto:
 *   - planas: flamabilidad SC -> CC (AMFE: S10 CC); OP 70 "PEGADO DE DOTS" -> "PEGADO DE APLIX" y
 *     sus caracteristicas dots/clips -> aplix (AMFE OP 70); SC en OP 60 dimension del aplix y OP 70
 *     posicion/cantidad (AMFE: S6 O4 SC, dentro de la regla S 5-8 y O >= 4).
 *   - termoformadas: N° de parte TBD -> el del AMFE; embalaje OP 120 -> OP 110 (AMFE: 110 EMBALAJE,
 *     120 ALMACENAMIENTO).
 *   Las CC del AMFE con S8 (carga hierro, +/-3 mm) y las SC con O < 4 NO se pasan: estan fuera de la
 *   regla de caracteristicas especiales y las tiene que decidir Fak.
 *
 * No duplica: si el plan ya tiene una fila de "agujas", no se vuelve a agregar.
 */
import { randomUUID } from 'crypto';
import { connectSupabase, saveCp, parseData } from './_lib/amfeIo.mjs';
import { parseSafeArgs, finish } from './_lib/dryRunGuard.mjs';

const PLANES = [
    { id: '332bcdda-a7d8-4d28-a41d-3961472ccb0e', nombre: 'PWA/HILUX/TELAS_PLANAS', troquelado: 'OP 50',
      material: 'Fieltro punzonado 250 g/m2 y 1000 g/m2 (refuerzos)' },
    { id: '85fd046d-a3bd-4de1-a9f9-d2fd51466999', nombre: 'PWA/HILUX/TELAS_TERMOFORMADAS', troquelado: 'OP 60',
      material: 'Fieltro de refuerzos' },
];

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

for (const p of PLANES) {
    const { data: fila, error } = await sb.from('cp_documents').select('id, project_name, data').eq('id', p.id).single();
    if (error) throw new Error(`${p.nombre}: ${error.message}`);
    if (fila.project_name !== p.nombre) throw new Error(`esperaba ${p.nombre} y lei ${fila.project_name}: no toco nada`);
    const doc = parseData(fila.data);
    if (!Array.isArray(doc.items)) throw new Error(`${p.nombre}: items no es un array`);
    if (doc.items.some(i => /aguja/i.test(JSON.stringify(i)))) { console.log(`${p.nombre}: ya tiene la fila de agujas.`); continue; }

    const base = { machineDeviceTool: '', characteristicNumber: '', processCharacteristic: '', controlProcedure: '' };
    const op10 = doc.items.filter(i => i.processStepNumber === 'OP 10');
    const opT = doc.items.filter(i => i.processStepNumber === p.troquelado);
    if (!op10.length || !opT.length) throw new Error(`${p.nombre}: no encuentro OP 10 o ${p.troquelado}`);

    const recepcion = {
        ...base, id: randomUUID(),
        processStepNumber: 'OP 10', processDescription: op10[0].processDescription,
        componentMaterial: p.material,
        productCharacteristic: 'Presencia de agujas rotas en el fieltro',
        specialCharClass: 'CC', classification: 'CC', specialChar: 'CC', amfeSeverity: 10,
        specification: 'Sin agujas ni fragmentos metalicos',
        evaluationTechnique: 'Control tactil',
        sampleSize: 'TBD', sampleFrequency: 'Cada recepcion',
        controlMethod: op10[0].controlMethod,
        reactionPlan: op10.find(i => /rechaz/i.test(i.reactionPlan || ''))?.reactionPlan || op10[0].reactionPlan,
        reactionPlanOwner: op10[0].reactionPlanOwner,
    };
    const troquelado = {
        ...base, id: randomUUID(),
        processStepNumber: p.troquelado, processDescription: opT[0].processDescription,
        machineDeviceTool: opT[0].machineDeviceTool,
        componentMaterial: '',
        productCharacteristic: 'Presencia de agujas rotas en el fieltro',
        specialCharClass: 'CC', classification: 'CC', specialChar: 'CC', amfeSeverity: 10,
        specification: 'Sin agujas ni fragmentos metalicos',
        evaluationTechnique: 'Control tactil segun instruccion de troquelado con foto',
        sampleSize: 'TBD', sampleFrequency: 'TBD',
        controlMethod: 'Autocontrol',
        reactionPlan: 'Separar NOK, notificar calidad', // el del control final del plan de termoformadas: el de troquel (cambiar troquel) no aplica a una aguja
        reactionPlanOwner: opT[0].reactionPlanOwner,
    };

    const after = structuredClone(doc);
    const arreglos = [];
    const cambiar = (it, campo, nuevo) => {
        if (it[campo] === nuevo) return;
        arreglos.push(`${it.processStepNumber} | ${it.productCharacteristic} | ${campo}: "${it[campo] ?? ''}" -> "${nuevo}"`);
        it[campo] = nuevo;
    };
    if (p.nombre === 'PWA/HILUX/TELAS_PLANAS') {
        for (const it of after.items) {
            if (it.processStepNumber === 'OP 10' && it.productCharacteristic === 'Flamabilidad') cambiar(it, 'specialCharClass', 'CC');
            if (it.processStepNumber === 'OP 60' && /Aplix troquelado/i.test(it.productCharacteristic)) { cambiar(it, 'specialCharClass', 'SC'); it.classification = 'SC'; it.specialChar = 'SC'; }
            if (it.processStepNumber === 'OP 70') {
                cambiar(it, 'processDescription', 'PEGADO DE APLIX');
                if (/dots\/clips/i.test(it.productCharacteristic)) cambiar(it, 'productCharacteristic', it.productCharacteristic.replace(/dots\/clips/i, 'aplix'));
                cambiar(it, 'specialCharClass', 'SC'); it.classification = 'SC'; it.specialChar = 'SC';
            }
        }
    }
    if (p.nombre === 'PWA/HILUX/TELAS_TERMOFORMADAS') {
        if (after.header.partNumber !== '21-9640 / 21-9641 / 21-9642 / 21-9643') {
            arreglos.push(`encabezado | N° de parte: "${after.header.partNumber}" -> "21-9640 / 21-9641 / 21-9642 / 21-9643"`);
            after.header.partNumber = '21-9640 / 21-9641 / 21-9642 / 21-9643';
        }
        for (const it of after.items) if (it.processStepNumber === 'OP 120' && /EMBALAJE/i.test(it.processDescription)) cambiar(it, 'processStepNumber', 'OP 110');
    }
    for (const a of arreglos) console.log(`  ~ ${a}`);
    const idx10 = after.items.map(i => i.processStepNumber).lastIndexOf('OP 10');
    after.items.splice(idx10 + 1, 0, recepcion);
    const idxT = after.items.map(i => i.processStepNumber).lastIndexOf(p.troquelado);
    after.items.splice(idxT + 1, 0, troquelado);

    console.log(`\n${p.nombre}  (${doc.items.length} -> ${after.items.length} filas)`);
    for (const r of [recepcion, troquelado]) {
        console.log(`  + ${r.processStepNumber} ${r.processDescription} | ${r.productCharacteristic} | ${r.specialCharClass} | ${r.specification} | ${r.evaluationTechnique} | ${r.sampleSize} / ${r.sampleFrequency} | ${r.controlMethod} | ${r.reactionPlan} | ${r.reactionPlanOwner}`);
    }
    if (apply) {
        await saveCp(sb, p.id, after, { extraFields: { item_count: after.items.length } });
        const { data: v } = await sb.from('cp_documents').select('data').eq('id', p.id).single();
        const n = parseData(v.data).items.length;
        if (n !== after.items.length) throw new Error(`${p.nombre}: releido ${n} filas, esperaba ${after.items.length}`);
        console.log(`  guardado y releido: ${n} filas`);
    }
}
finish(apply);
process.exit(0);
