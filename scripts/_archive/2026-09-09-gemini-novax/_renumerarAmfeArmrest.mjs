/**
 * AMFE 161 (ARMREST DOOR PANEL) — renumera las operaciones contra el Flujograma 153 Rev.B (09/09/2026).
 *
 * Estandariza la mesa de corte a 20-22 (igual que el Insert) y alinea la secuencia
 * completa de corte, costura, inyección, adhesivado y tapizado 1 a 1 con el flujograma.
 *
 *   15 PREPARACION DE CORTE                 -> 20
 *   20 CORTE DE COMPONENTES                 -> 21
 *   25 CONTROL CON MYLAR                    -> 22
 *   40 REFILADO                             -> 30
 *   50 COSTURA UNION                        -> 40
 *   51 COSTURA DOBLE / VISTA                -> 41
 *   60 Inyección DE PIEZAS PLASTICAS        -> 50
 *   61 CONTROL DE PIEZA INYECTADA           -> 51
 *   70 Inyección PU                         -> 60
 *   80 ADHESIVADO                           -> 70
 *   81 Inspección DE PIEZA ADHESIVADA       -> 71
 *   90 TAPIZADO SEMIAUTOMATICO              -> 80-82
 *   100 CONTROL FINAL DE CALIDAD            -> 90
 *   103 REPROCESO: FALTA DE ADHESIVO        -> 100
 *   110 EMBALAJE                            -> 110
 *
 * Uso:  node scripts/_renumerarAmfeArmrest.mjs            (dry-run)
 *       node scripts/_renumerarAmfeArmrest.mjs --apply
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, logChange, finish } from './_lib/dryRunGuard.mjs';

const MAPA = {
    '15': '20',
    '20': '21',
    '25': '22',
    '40': '30',
    '50': '40',
    '51': '41',
    '60': '50',
    '61': '51',
    '70': '60',
    '80': '70',
    '81': '71',
    '90': '80-82',
    '100': '90',
    '103': '100',
    '110': '110',
};

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const { data: rows, error } = await sb
    .from('amfe_documents')
    .select('id, amfe_number, project_name')
    .eq('amfe_number', 'AMFE-ARM-PAT');
if (error) throw error;
if (rows.length !== 1) throw new Error(`Esperaba 1 AMFE-ARM-PAT, encontré ${rows.length}`);

const row = rows[0];
const { doc } = await readAmfe(sb, row.id);
const antes = JSON.parse(JSON.stringify(doc));

const originales = (doc.operations || []).map((op) => String(op.opNumber ?? op.operationNumber));
const destinos = originales.map((n) => MAPA[n] ?? n);

const repetidos = destinos.filter((n, i) => destinos.indexOf(n) !== i);
if (repetidos.length) {
    throw new Error(`La renumeración generaría colisiones: ${[...new Set(repetidos)].join(', ')}`);
}

(doc.operations || []).forEach((op, i) => {
    if (destinos[i] === originales[i]) return;
    const anterior = originales[i];
    const nuevo = destinos[i];
    op.opNumber = nuevo;
    op.operationNumber = nuevo;
    if (nuevo === '80-82') {
        op.name = 'TAPIZADO CONFIGURACION, AUTOMATICO Y REFILADO MANUAL';
        op.operationName = op.name;
    }
    logChange(apply, `OP ${anterior} -> ${nuevo}`, String(op.name ?? op.operationName));
});

// Ordenar numéricamente considerando rangos como 80-82
doc.operations.sort((a, b) => {
    const na = parseInt(String(a.opNumber).split('-')[0], 10);
    const nb = parseInt(String(b.opNumber).split('-')[0], 10);
    return na - nb;
});

doc.revisions = Array.isArray(doc.revisions) ? doc.revisions : [];
doc.revisions.push({
    rev: 'A',
    date: '09/09/2026',
    item: '20-22, 30, 40-41, 50-51, 60, 70-71, 80-82, 90, 100',
    details: 'ALINEACION INTEGRAL DE NUMERACION CON FLUJOGRAMA 153 REV.B: MESA DE CORTE EN DECENA 20 (20-22), COSTURA 40-41, INYECCION PLASTICA 50-51, PU 60, ADHESIVADO 70-71, TAPIZADO 80-82, CONTROL FINAL 90 Y REPROCESO 100.',
    pswDate: '',
    modifiedBy: 'FS',
});
doc.header = doc.header || {};
doc.header.revDate = '09/09/2026';

console.log(`\nSecuencia final: ${doc.operations.map((o) => o.opNumber).join(' ')}`);

await runWithValidation(
    [{ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc }],
    apply,
    async () => {
        await saveAmfe(sb, row.id, doc, { expectedAmfeNumber: row.amfe_number });
        console.log('   escrito AMFE-ARM-PAT');
    },
);

finish(apply);
