/**
 * _revisionAlineacionPatagonia.mjs — deja constancia del cambio del 18/08 en el log de
 * revisiones de los AMFE que se tocaron.
 *
 * QUE SE HIZO ESE DIA
 * Los flujogramas de Patagonia pasaron a Rev. B y los AMFE adoptaron su numeracion
 * (criterio de Fak: el AMFE agrupa pero DECLARA el rango en el nombre de la operacion).
 * Ademas, en los dos apoyacabezas traseros se corrigio el orden del proceso: tenian el
 * espumado ANTES del enfundado, y en planta se enfunda primero.
 *
 * LA LETRA NO SUBE. Criterio de Fak del 03/08/2026: mientras el producto no entro en SERIE,
 * el AMFE no cambia de letra aunque se le hagan cambios — el cambio se registra en el log
 * con la MISMA letra. Es lo contrario de lo que se hizo con los flujogramas, y a proposito:
 * a esos los gobierna el `I-IN-002`, que exige correlativa; al AMFE lo gobierna el
 * `I-AC-005`. Ver memoria `revision_no_sube_si_no_entro_en_serie`.
 *
 * ⚠️ `revisions` es una COLUMNA de `amfe_documents` (un string JSON), NO vive adentro de
 * `data` — y el export lee la columna. Se escriben las DOS para que no se desincronicen
 * (leccion 14/08: la fila que agregue solo al objeto nunca llego a la caratula).
 *
 * Uso:  node scripts/_revisionAlineacionPatagonia.mjs           (dry-run)
 *       node scripts/_revisionAlineacionPatagonia.mjs --apply
 */

import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import { connectSupabase, parseData, saveAmfe } from './_lib/amfeIo.mjs';

const FECHA = '18/08/2026';

/** Solo los que CAMBIARON el 18/08. Los que no se tocaron no llevan fila nueva. */
const CAMBIOS = {
    'VWA-PAT-IPPADS-001': {
        producto: 'IP PAD',
        item: '20, 30',
        detalle: 'SE ALINEA CON EL FLUJOGRAMA 157 REV. B. LAS OP. 20 Y 30 DECLARAN EL RANGO QUE CUBREN.',
    },
    'AMFE-HF-PAT': {
        producto: 'APOYACABEZAS DELANTERO',
        item: 'OP 20 A 80',
        detalle: 'SE ALINEA CON EL FLUJOGRAMA 152 REV. B. CORTE Y COSTURA DECLARAN SU RANGO.',
    },
    'AMFE-HRC-PAT': {
        producto: 'APOYACABEZAS TRASERO CENTRAL',
        item: 'OP 20 A 80',
        detalle: 'EL ENFUNDADO VA ANTES DEL ESPUMADO. SE ALINEA CON EL FLUJOGRAMA 152 REV. B.',
    },
    'AMFE-HRO-PAT': {
        producto: 'APOYACABEZAS TRASERO LATERAL',
        item: 'OP 20 A 80',
        detalle: 'EL ENFUNDADO VA ANTES DEL ESPUMADO. SE ALINEA CON EL FLUJOGRAMA 152 REV. B.',
    },
    'AMFE-TR-PAT': {
        producto: 'TOP ROLL',
        item: 'OP 5 A 90',
        detalle: 'SE ALINEA CON EL FLUJOGRAMA 155 REV. B: RECEPCION 5 Y CONTROL FINAL 80.',
    },
};

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const claves = Object.keys(CAMBIOS);
const { data: rows, error } = await sb
    .from('amfe_documents').select('id, amfe_number, data, revisions, revision_level').in('amfe_number', claves);
if (error) throw error;

/** La columna llega como string JSON; en algun documento podria venir ya parseada. */
const leerRevisiones = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v.trim()) { try { return JSON.parse(v); } catch { return []; } }
    return [];
};

const plan = [];
const commits = [];

for (const clave of claves) {
    const row = rows.find(r => r.amfe_number === clave);
    if (!row) throw new Error(`No encontre ${clave}.`);
    const { producto, item, detalle } = CAMBIOS[clave];
    const before = parseData(row.data);
    const doc = parseData(row.data);

    const revs = leerRevisiones(row.revisions);
    const letra = String(row.revision_level || revs[revs.length - 1]?.rev || 'A');

    const fila = { rev: letra, date: FECHA, item, pswDate: '', modifiedBy: 'FS', description: detalle };

    // Idempotente y CORREGIBLE: si ya hay una fila de esta fecha se REEMPLAZA, no se
    // duplica ni se deja la vieja. Hizo falta porque el primer texto que escribi se cortaba
    // en el PDF (la celda ITEM CAMBIADO muestra ~31 caracteres y la de DETALLES 3 lineas),
    // y un script que solo sabe "agregar si no esta" no permite arreglar eso.
    const i = revs.findIndex(r => r.date === FECHA);
    const nuevas = i >= 0 ? revs.map((r, k) => (k === i ? fila : r)) : [...revs, fila];
    if (i >= 0 && JSON.stringify(revs[i]) === JSON.stringify(fila)) {
        console.log(`  = ${clave.padEnd(20)} la fila del ${FECHA} ya esta como corresponde`);
        continue;
    }

    doc.revisions = nuevas;   // el objeto, para que la UI lo vea
    logChange(apply, `${clave.padEnd(20)} + fila Rev.${letra} ${FECHA} — ${detalle.slice(0, 62)}...`, {});

    plan.push({ id: row.id, amfeNumber: clave, productName: producto, before, after: doc });
    commits.push(async () => {
        // Y la COLUMNA, que es de donde lee el export.
        await saveAmfe(sb, row.id, doc, { extraFields: { revisions: JSON.stringify(nuevas) } });
        const { data: chk } = await sb.from('amfe_documents').select('revisions').eq('id', row.id).single();
        const live = leerRevisiones(chk.revisions);
        if (!live.some(r => r.date === FECHA)) {
            throw new Error(`POST-CHECK ${clave}: la fila del ${FECHA} no quedo en la columna revisions`);
        }
        console.log(`POST-CHECK live ${clave}: ${live.length} filas de revision, ultima ${live[live.length - 1].date}`);
    });
}

if (!plan.length) { console.log('\nNada que agregar.'); finish(apply); process.exit(0); }

await runWithValidation(plan, apply, async () => { for (const c of commits) await c(); });
finish(apply);
