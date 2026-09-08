/**
 * AMFE 158 (INSERT) — el log de revisiones queda en UNA fila Rev. A.
 *
 * Por que: el log se venia escribiendo empujando una entrada por cada cosa que se tocaba.
 * Quedaron 7 filas, 6 de ellas con la misma letra y la misma fecha, repitiendo "SE AGREGA LA
 * OPERACION ..." tres veces seguidas. Fak, 08/09/2026, mirando la caratula exportada:
 * *"aca lo que deberiamos ver es solo una Rev A con fecha 8/09 con todos los items cambiados
 * y en detalles todo junto lo que se cambio... es como que pusiste muchas cosas o se
 * repitieron una y otra vez"*.
 *
 * El generador ya consolida por letra al exportar (`consolidateRevisions` en
 * amfeCaratulaSheet.ts), asi que esto NO es lo que hace que se vea bien: esto arregla el
 * TEXTO, que consolidado quedaba repetitivo. Las dos cosas son necesarias.
 *
 * Nada de lo que dice la fila nueva es informacion nueva: sale de las 7 filas que reemplaza,
 * mas el cambio de simbologia a D/TLD y W, que se hizo hoy sobre este mismo documento y no
 * habia quedado registrado en ninguna fila (se verifica contra las marcas del doc antes de
 * escribirlo: si las marcas no son las de VW, aborta).
 *
 * La LETRA no sube: el Insert no entro en serie (regla de Fak del 03/08/2026), asi que los
 * cambios siguen entrando como Rev. A.
 *
 * Uso:  node scripts/_amfeInsertRevisionUnica.mjs            (dry-run)
 *       node scripts/_amfeInsertRevisionUnica.mjs --apply
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, logChange, finish } from './_lib/dryRunGuard.mjs';

const FILA_UNICA = {
    rev: 'A',
    date: '08/09/2026',
    item: '20, 21, 22, 70-71, 93, 100, 101, 102',
    details:
        'SE AGRUPAN LAS OPERACIONES DE LA MESA DE CORTE EN LA DECENA 20: PREPARACION DE CORTE 20, '
        + 'CORTE DE COMPONENTES 21 Y CONTROL CON MYLAR 22. LA INYECCION PASA A NUMERARSE 70-71 Y '
        + 'CUBRE LA INYECCION Y EL CONTROL DE PIEZA INYECTADA (WE MEASUREMENT: BALANZA, CALIBRE Y '
        + 'PIEZA PATRON), CONTENIDO ADAPTADO DE VWA-PAT-IPPADS-001. EL REPROCESO POR FALTA DE '
        + 'ADHESIVO PASA A 93, LA DECENA DE SU SECTOR. SE AGREGAN LAS OPERACIONES 100 TAPIZADO '
        + 'SEMIAUTOMATICO, 101 VIROLADO MANUAL Y 102 REFILADO POST-TAPIZADO, TOMADAS DE LA HO-215. '
        + 'LAS CARACTERISTICAS ESPECIALES PASAN A LA SIMBOLOGIA DEL CLIENTE VW: D/TLD Y W.',
    pswDate: '',
    modifiedBy: 'FS',
};

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const { data: rows, error } = await sb
    .from('amfe_documents')
    .select('id, amfe_number, project_name')
    .eq('amfe_number', 'AMFE-INS-PAT');
if (error) throw error;
if (rows.length !== 1) throw new Error(`Esperaba 1 AMFE-INS-PAT, encontre ${rows.length}`);

const row = rows[0];
const { doc } = await readAmfe(sb, row.id);
const antes = JSON.parse(JSON.stringify(doc));

// ── candado 1: todas las filas que se reemplazan tienen que ser de la misma letra ──
const previas = Array.isArray(doc.revisions) ? doc.revisions : [];
const letras = [...new Set(previas.map((r) => String(r.rev || '').trim().toUpperCase()))];
if (letras.length !== 1 || letras[0] !== 'A') {
    throw new Error(`Solo colapso un log de UNA letra. Encontre: ${letras.join(', ')}`);
}

// ── candado 2: el texto nuevo dice que la simbologia paso a VW; se verifica en el doc ──
const marcas = new Set();
for (const op of doc.operations || []) {
    for (const we of op.workElements || []) {
        for (const fn of we.functions || []) {
            for (const f of fn.failures || []) {
                for (const c of f.causes || []) {
                    const m = String(c.specialChar || '').trim();
                    if (m) marcas.add(m.toUpperCase());
                }
            }
        }
    }
}
const noVw = [...marcas].filter((m) => !['D/TLD', 'W'].includes(m));
if (noVw.length) {
    throw new Error(`La fila nueva afirma simbologia VW pero el doc tiene marcas ${noVw.join(', ')}`);
}
console.log(`marcas de caracteristica especial en el doc: ${[...marcas].join(', ')} (${marcas.size} distintas)`);

console.log(`\nfilas que se reemplazan: ${previas.length}`);
previas.forEach((r, i) => console.log(`  ${i}. ${r.rev} ${r.date} [${r.item}] ${String(r.details).slice(0, 70)}...`));

doc.revisions = [FILA_UNICA];
doc.header = doc.header || {};
doc.header.revDate = FILA_UNICA.date;

logChange(apply, `revisiones ${previas.length} -> 1`, `Rev. ${FILA_UNICA.rev} ${FILA_UNICA.date} · items ${FILA_UNICA.item}`);
console.log(`\nDETALLES (${FILA_UNICA.details.length} caracteres):\n${FILA_UNICA.details}\n`);

await runWithValidation(
    [{ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc }],
    apply,
    async () => {
        await saveAmfe(sb, row.id, doc, { expectedAmfeNumber: row.amfe_number });
        console.log('   escrito AMFE-INS-PAT');
    },
);

finish(apply);
