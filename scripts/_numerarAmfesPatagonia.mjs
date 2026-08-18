/**
 * _numerarAmfesPatagonia.mjs — carga el N° DE AMFE oficial en la caratula.
 *
 * PROBLEMA QUE RESUELVE
 * La caratula del formulario I-AC-005.3 tiene el campo "N° DE AMFE", que sale de
 * `data.header.amfeNumber`. En 5 de los 8 AMFE de Patagonia ese campo estaba VACIO y en
 * los IP Pads tenia el identificador interno de la app (`VWA-PAT-IPPADS-001`) en vez del
 * numero de la empresa. O sea: los documentos salian a Calidad sin numero.
 *
 * DE DONDE SALE EL NUMERO
 * Del sistema documental real, verificado el 17/08/2026 en dos lugares que coinciden:
 *   1. `Y:\Ingenieria\Documentacion Gestion Ingenieria\13. Analisis del modo de falla y sus
 *      efectos ( I-AC-005.3)\2. AMFES DE PROCESO\` — cada AMFE vive en una carpeta
 *      `<numero> - <PIEZA>` con su `AMFE <numero> - <PIEZA> - Rev.<letra>.xlsx`.
 *   2. `1. LISTADO DE AMFES\Listado_Maestro_AMFE.xlsx`, hoja "Listado AMFE".
 * El mapeo pieza->numero se confirmo ademas contra `4. OBSOLETO\AMFES DE PROCESO\`, que
 * conserva los nombres previos a la renumeracion.
 *
 * NO se toca la columna `amfe_number` de la tabla: es el identificador interno de la app y
 * lo usan otros scripts. Lo que sale impreso en el entregable es el header. La diferencia
 * entre los dos queda reportada a Fak.
 *
 * Uso:  node scripts/_numerarAmfesPatagonia.mjs           (dry-run)
 *       node scripts/_numerarAmfesPatagonia.mjs --apply
 */

import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import { connectSupabase, parseData, saveAmfe } from './_lib/amfeIo.mjs';

/** identificador interno en la app -> numero oficial de Barack + carpeta del maestro */
const NUMERACION = {
    'VWA-PAT-IPPADS-001': { nro: '149', pieza: 'TRIM ASM-UPR WRAPPING' },
    '150': { nro: '150', pieza: 'APOYABRAZOS TRASERO' },
    'AMFE-HF-PAT': { nro: '151', pieza: 'APC DELANTERO CON COSTURA VISTA' },
    'AMFE-HRC-PAT': { nro: '153', pieza: 'APC TRASERO CENTRAL CON COSTURA VISTA' },
    'AMFE-HRO-PAT': { nro: '155', pieza: 'APC TRASERO LATERAL CON COSTURA VISTA' },
    'AMFE-INS-PAT': { nro: '158', pieza: 'INSERT' },
    'AMFE-ARM-PAT': { nro: '161', pieza: 'ARMREST DOOR PANEL' },
    'AMFE-TR-PAT': { nro: '162', pieza: 'TOP ROLL' },
};

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const plan = [];
const commits = [];

for (const [idApp, { nro, pieza }] of Object.entries(NUMERACION)) {
    const { data: rows, error } = await sb
        .from('amfe_documents')
        .select('id, amfe_number, data')
        .eq('amfe_number', idApp)
        .limit(1);
    if (error) throw error;
    if (!rows?.length) { console.log(`  (no existe) ${idApp}`); continue; }

    const row = rows[0];
    const before = parseData(row.data);
    const doc = parseData(row.data);
    doc.header = doc.header || {};

    const actual = doc.header.amfeNumber || '';
    if (actual === nro) { console.log(`  OK ya numerado: ${idApp} -> ${nro}`); continue; }

    doc.header.amfeNumber = nro;
    logChange(apply, `${idApp}: header.amfeNumber "${actual || '(vacio)'}" -> "${nro}"  [${pieza}]`, {});

    plan.push({ id: row.id, amfeNumber: idApp, productName: pieza, before, after: doc });
    commits.push(async () => {
        await saveAmfe(sb, row.id, doc);
        const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', row.id).single();
        const live = parseData(chk.data);
        if (live.header?.amfeNumber !== nro) {
            throw new Error(`POST-CHECK ${idApp}: se esperaba "${nro}" y quedo "${live.header?.amfeNumber}"`);
        }
        console.log(`POST-CHECK live ${idApp}: N° DE AMFE = ${live.header.amfeNumber}`);
    });
}

await runWithValidation(plan, apply, async () => {
    for (const c of commits) await c();
});

finish(apply);
