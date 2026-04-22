/**
 * _fixIpPadsOperationFunction.mjs — Reemplaza los placeholders "Pendiente
 * funcion interna / ..." en operationFunction de IP_PADS por textos reales
 * derivados de AMFEs hermanos (Insert, Armrest, Termoformadas, Maestros).
 *
 * Para las 5 ops sin match directo (WRAPPING, PRE-FIXING, SOLDADURA
 * ULTRASONIDO, TERMINACION, ENSAMBLE SUSTRATO+ESPUMA) usa textos descriptivos
 * genericos redactados segun AIAG-VDA (sin datos tecnicos inventados).
 *
 * Uso:
 *   node scripts/_fixIpPadsOperationFunction.mjs         # dry-run
 *   node scripts/_fixIpPadsOperationFunction.mjs --apply # aplicar
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const IP_PADS_ID = '3d3f5b14-a5c6-4a3d-9cc5-a41567e1c5e1'; // se resuelve dinamicamente abajo

const OPERATION_FUNCTIONS = {
    '10':  'Asegurar la conformidad de la calidad, cantidad y trazabilidad de la materia prima recibida',
    '20':  'Inyectar pieza plastica segun parametros validados del hoja de parametros, con molde en condicion y refrigeracion correcta del tornillo',
    '30':  'Cortar componentes segun programa, obteniendo piezas con forma y dimensiones conformes al plano',
    '40':  'Unir piezas segun especificacion de costura, obteniendo ensamble sin scrap ni reprocesos',
    '50':  'Proveer piezas troqueladas de espuma conformes a especificacion dimensional y geometrica, sin generar scrap',
    '60':  'Ensamblar sustrato y espuma obteniendo subconjunto conforme a especificacion dimensional',
    '70':  'Aplicar adhesivo y unir componentes sin defectos, sin reprocesos ni scrap, dentro del tiempo de ciclo',
    '80':  'Verificar la conformidad de la adhesion y caracteristicas visuales del producto segun especificacion',
    '81':  'Restaurar la conformidad del componente eliminando el defecto de adhesion detectado',
    '90':  'Alinear piezas cosidas previamente al wrapping para garantizar posicion correcta del material sobre sustrato',
    '100': 'Envolver material sobre sustrato y plegar bordes para obtener apariencia visual conforme al plano',
    '110': 'Unir componentes mediante soldadura por ultrasonido segun parametros validados, garantizando resistencia de la union',
    '120': 'Realizar acabado final de la pieza asegurando cumplimiento estetico y dimensional',
    '130': 'Verificar la conformidad del producto terminado segun el plan de control y prevenir el escape de piezas no conformes',
    '140': 'Proteger, identificar y embalar el producto terminado conforme a instrucciones del cliente, manteniendo integridad y trazabilidad',
};

const sb = await connectSupabase();
const { data: rows } = await sb.from('amfe_documents').select('id').eq('amfe_number', 'VWA-PAT-IPPADS-001');
if (!rows || rows.length === 0) {
    console.error('No se encontro VWA-PAT-IPPADS-001');
    process.exit(1);
}
const ipPadsId = rows[0].id;

const { doc: original, amfe_number, row } = await readAmfe(sb, ipPadsId);
const before = JSON.parse(JSON.stringify(original));
const after = JSON.parse(JSON.stringify(original));

const changes = [];

for (const op of after.operations) {
    const opN = String(op.opNumber || op.operationNumber);
    const newFn = OPERATION_FUNCTIONS[opN];
    if (!newFn) {
        console.log(`  [skip] OP${opN} ${op.name || op.operationName} — sin mapeo`);
        continue;
    }
    const current = op.operationFunction || '';
    // Solo reemplazar si tiene placeholder
    if (!/pendiente/i.test(current)) {
        console.log(`  [skip] OP${opN} ya tiene texto real, no se pisa: "${current.slice(0, 60)}..."`);
        continue;
    }
    changes.push({
        op: `OP${opN} ${op.name || op.operationName}`,
        before: current.slice(0, 60) + '...',
        after: newFn,
    });
    op.operationFunction = newFn;
}

console.log(`\n=== Cambios propuestos: ${changes.length} ===\n`);
for (const c of changes) {
    console.log(`  ${c.op}`);
    console.log(`    -: ${c.before}`);
    console.log(`    +: ${c.after}`);
    console.log('');
}

if (changes.length === 0) {
    console.log('Nada que cambiar.');
    finish(apply);
    process.exit(0);
}

const plan = [{
    id: ipPadsId,
    amfeNumber: amfe_number,
    productName: row.project_name,
    before,
    after,
}];

await runWithValidation(plan, apply, async () => {
    await saveAmfe(sb, ipPadsId, after, { expectedAmfeNumber: amfe_number });
    console.log(`  ✓ ${amfe_number} saved`);
});

finish(apply);
