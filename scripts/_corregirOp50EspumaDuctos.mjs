/**
 * _corregirOp50EspumaDuctos.mjs — le devuelve la ESPUMA a la OP50 del AMFE 172 (AMFE-DUC-PAT).
 *
 * Que paso: al rederivar el AMFE el 24/08/2026, la OP50 quedo como "PREARMADO Y REMACHADO DE
 * BRAQUETS" y se perdio la colocacion de las tiras de espuma troqueladas. El AMFE anterior
 * (REVA-4) numeraba esa misma operacion "Prearmado de Espuma + Remachado" y su celda F251 dice
 * textual: "Indexa componentes (visagra, remaches, tiras de espuma) a la pieza". La OP40 del
 * propio AMFE 172 dice que troquela "las tiras que se aplican en las bocas del defroster", y
 * hasta esta correccion ninguna operacion las aplicaba.
 *
 * Fuentes de lo que se escribe (nada inventado):
 *   - AMFE REVA-4, OP50 y celdas D260/F251/G256 -> la espuma es parte del prearmado.
 *   - HO 988 (MP8147 CENTRAL) hoja 50.1 "PEGADO DE ESPUMA", textual: "tomamos 2 tiras de
 *     espuma de 670 mm" y "Colocar tiras de espuma en las zonas indicadas en la figura".
 *   - BOM del arb (RELACIONES.TXT 21/08/2026): 427ESP003TRO01 ESPUMA (FOAM) 7MM 60 KG/M^3.
 *
 * NO agrega modos de falla. El REVA-4 tenia uno ("5 - Mal posicionado de espuma troquelada en
 * pieza plastica") pero su causa era "Error fuera de estandar", que es el tipo de causa generica
 * que esta rederivacion saco a proposito. Una causa concreta la tiene que dar la planta: se
 * reporta como abierto en vez de inventarla (core-prohibiciones §1).
 *
 *   node scripts/_corregirOp50EspumaDuctos.mjs            # dry-run
 *   node scripts/_corregirOp50EspumaDuctos.mjs --apply
 */
import { randomUUID } from 'node:crypto';
import { connectSupabase, readAmfe, saveAmfe, findOperation } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const CLAVE = 'AMFE-DUC-PAT';

const NOMBRE_NUEVO = 'PREARMADO DE ESPUMA Y REMACHADO DE BRAQUETS (Aplica solo a MP8147)';
const FUNCION_NUEVA =
    'Colocar las tiras de espuma troqueladas en las bocas del defroster y remachar los ocho '
    + 'braquets al sustrato en las posiciones definidas';
const FOCO_NUEVO =
    'Tiras de espuma aplicadas en las zonas definidas y braquets remachados segun la hoja de '
    + 'operaciones';

// El nombre evita la palabra "troqueladas": el validador matchea "troquel" por substring y
// clasifica el WE como Machine (herramienta cortante). Son las tiras, no el troquel.
const WE_ESPUMA = {
    name: 'Tiras de espuma 427ESP003TRO01 (2 tiras de 670 mm)',
    type: 'Material',
    fn: 'Aplicar el aislamiento en las bocas del defroster central',
    req: 'Dos tiras de 670 mm colocadas en las zonas definidas en la hoja de operaciones',
};

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const { data: filas, error } = await sb
    .from('amfe_documents').select('id').eq('amfe_number', CLAVE);
if (error) throw error;
if (filas.length !== 1) throw new Error(`esperaba 1 doc ${CLAVE}, hay ${filas.length}`);
const id = filas[0].id;

const { doc: before, amfe_number } = await readAmfe(sb, id);
const after = structuredClone(before);

const op = findOperation(after, '50');
if (!op) throw new Error('no encontre la OP50 en el AMFE 172');
if (!/BRAQUETS/i.test(op.name)) {
    throw new Error(`la OP50 no es la que espero: name=${op.name}`);
}
if (op.workElements.some(we => /espuma/i.test(we.name))) {
    console.log('La OP50 ya nombra la espuma. Nada que hacer.');
    process.exit(0);
}

op.name = NOMBRE_NUEVO;
op.operationName = NOMBRE_NUEVO;
op.operationFunction = FUNCION_NUEVA;
op.focusElementFunction = FOCO_NUEVO;

// el WE de espuma va PRIMERO: en el puesto la espuma se aplica antes de remachar los braquets
op.workElements.unshift({
    id: randomUUID(),
    name: WE_ESPUMA.name,
    type: WE_ESPUMA.type,
    functions: [{
        id: randomUUID(),
        description: WE_ESPUMA.fn,
        functionDescription: WE_ESPUMA.fn,
        requirements: WE_ESPUMA.req,
        failures: [],
    }],
});

console.log(`\nOP50 de ${amfe_number}:`);
console.log(`  nombre : ${before.operations.find(o => String(o.opNumber) === '50').name}`);
console.log(`        -> ${op.name}`);
console.log(`  WE nuevo: [${WE_ESPUMA.type}] ${WE_ESPUMA.name}`);
console.log(`  workElements: ${before.operations.find(o => String(o.opNumber) === '50').workElements.length}`
    + ` -> ${op.workElements.length}\n`);

await runWithValidation(
    [{ id, amfeNumber: amfe_number, productName: 'INSONOS / DUCTOS DE CALEFACCION', before, after }],
    apply,
    async () => { await saveAmfe(sb, id, after, { expectedAmfeNumber: CLAVE }); },
);

finish(apply);
