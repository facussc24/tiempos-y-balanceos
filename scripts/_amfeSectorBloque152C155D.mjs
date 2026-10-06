/**
 * AMFE de los apoyacabezas (151, 153, 155) y del Top Roll (162) alineados a los flujogramas 152 Rev.C y
 * 155 Rev.D: un sector es un bloque (skill flujogramas 1.5; Fak, 06/10/2026: "esos tambien tienen que ser
 * unificados en criterio"). Mismo metodo que `_amfeIpPad157C.mjs`: las filas quedan cubriendo los pasos
 * del flujograma con un rango; no se parte ni se reescribe contenido.
 *
 *   152 Rev.C: corte 20-21 (antes "OP 20-27"), mylar 22 (antes 28), costura union 30 (deja de llamarse
 *              "OP 30 / 32-34": el flujograma ya no dibuja 32 a 34, que son pasos de las HO 968/969/970).
 *   155 Rev.D: inyeccion 10-11 (el control de pieza inyectada ya estaba adentro de la OP 10 desde el
 *              20/08/2026) y adhesivado 20-21 (la OP 20 ya declara "lamina rechazada en control de adhesivado").
 *
 * Uso:  node scripts/_amfeSectorBloque152C155D.mjs            (dry-run)
 *       node scripts/_amfeSectorBloque152C155D.mjs --apply
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, logChange, finish } from './_lib/dryRunGuard.mjs';

const FECHA = '06/10/2026';
const CORTE = {
    '20': ['20-21', 'PREPARACION Y CARGA DE VINILO Y CORTE AUTOMATICO DE COMPONENTES'],
    '28': ['22', 'CONTROL CON MYLAR'],
    '30': ['30', 'COSTURA UNION'],
};
const REV_152 = ['20-21, 22, 30', 'SE ALINEA CON EL FLUJOGRAMA 152 REV. C: EL CORTE PASA A NUMERARSE 20-21 (PREPARACION Y CORTE AUTOMATICO), EL CONTROL CON MYLAR PASA DE 28 A 22 Y LA COSTURA UNION QUEDA COMO OPERACION 30.'];
// numero de AMFE -> [cambios por fila, [item, detalle] de la fila de revision]
const PLAN = {
    'AMFE-HF-PAT': [CORTE, REV_152],
    'AMFE-HRC-PAT': [CORTE, REV_152],
    'AMFE-HRO-PAT': [CORTE, REV_152],
    'AMFE-TR-PAT': [{
        '10': ['10-11', 'INYECCION DE PIEZA PLASTICA Y CONTROL DE PIEZA INYECTADA'],
        '20': ['20-21', 'ADHESIVADO HOT MELT E INSPECCION DE LAMINA ADHESIVADA'],
    }, ['10-11, 20-21', 'SE ALINEA CON EL FLUJOGRAMA 155 REV. D: LA INYECCION PASA A NUMERARSE 10-11 (INYECCION Y CONTROL DE PIEZA INYECTADA) Y EL ADHESIVADO 20-21 (ADHESIVADO HOT MELT E INSPECCION DE LAMINA ADHESIVADA).']],
};

const { apply } = parseSafeArgs();
const sb = await connectSupabase();
const lote = [];

for (const [numero, [cambios, [item, detalle]]] of Object.entries(PLAN)) {
    const { data: rows, error } = await sb.from('amfe_documents').select('id, amfe_number, project_name').eq('amfe_number', numero);
    if (error) throw error;
    if (rows.length !== 1) throw new Error(`Esperaba 1 ${numero}, encontre ${rows.length}`);
    const row = rows[0];
    const { doc } = await readAmfe(sb, row.id);
    const antes = JSON.parse(JSON.stringify(doc));
    const primero = Object.values(cambios)[0][0];
    if ((doc.operations || []).some((o) => String(o.opNumber) === primero)) {
        console.log(`${numero}: ya tiene la fila ${primero}, no hay nada que hacer.`);
        continue;
    }
    console.log(`\n=== ${numero} ===`);
    for (const [viejo, [nuevo, nombre]] of Object.entries(cambios)) {
        const op = (doc.operations || []).find((o) => String(o.opNumber) === viejo);
        if (!op) throw new Error(`${numero}: no encontre la OP ${viejo}`);
        const nombreViejo = String(op.name ?? op.operationName);
        op.opNumber = nuevo;
        op.operationNumber = nuevo;
        op.name = nombre;
        op.operationName = nombre;
        logChange(apply, `${numero} OP ${viejo} -> ${nuevo}`, `${nombreViejo}  ->  ${nombre}`);
    }
    // Un control que cite por numero una operacion que cambia quedaria apuntando a otra: se listan, no se reescriben solos.
    const viejos = Object.keys(cambios).filter((v) => cambios[v][0] !== v);
    const re = /\bOP\.?\s*(\d{1,3})\b/gi;
    (function barrer(o, ruta) {
        if (typeof o === 'string') {
            for (const m of o.matchAll(re)) {
                const num = Number(m[1]);
                if (viejos.includes(m[1]) || (numero !== 'AMFE-TR-PAT' && num >= 21 && num <= 34)) console.log(`   cita a mirar  ${ruta}: ${o.slice(0, 130)}`);
            }
        } else if (Array.isArray(o)) {
            o.forEach((x, i) => barrer(x, `${ruta}[${i}]`));
        } else if (o && typeof o === 'object') {
            for (const [k, v] of Object.entries(o)) if (k !== 'name' && k !== 'operationName') barrer(v, `${ruta}.${k}`);
        }
    })(doc.operations, 'operations');

    doc.revisions = Array.isArray(doc.revisions) ? doc.revisions : [];
    const letra = String(doc.revisions.at(-1)?.rev ?? doc.header?.revision ?? doc.header?.rev ?? 'A');
    doc.revisions.push({ rev: letra, date: FECHA, item, details: detalle, pswDate: '', modifiedBy: 'FS' });
    doc.header = doc.header || {};
    doc.header.revDate = FECHA;
    console.log(`   secuencia final: ${doc.operations.map((o) => o.opNumber).join(' ')}`);
    lote.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc });
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
