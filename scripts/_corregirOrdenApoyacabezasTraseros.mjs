/**
 * _corregirOrdenApoyacabezasTraseros.mjs — los AMFE 153 y 155 tenian el proceso al reves.
 *
 * QUE ESTABA MAL
 * Los dos apoyacabezas traseros (central AMFE-HRC-PAT / lateral AMFE-HRO-PAT) declaraban:
 *
 *      50 INYECCION DE PU  ->  60 ENFUNDADO  ->  70 INSERCION DE VARILLA
 *
 * o sea: espumar primero y enfundar despues. Fak, 18/08/2026, sobre el puesto real:
 * *"es imposible que se inyecte sin la funda, se saldria todo el material"*, *"se coloca
 * la varilla, la funda, y luego se inyecta"*, *"lo tengo 100% claro eso"*.
 *
 * El orden real es VARILLA -> FUNDA -> MOLDE -> INYECCION DE PU: el poliuretano se
 * inyecta ADENTRO de la funda ya montada, y la pieza sale terminada del molde. El AMFE 151
 * (delantero) ya lo tenia bien; estos dos no.
 *
 * COMO QUEDA — es un swap limpio, el enfundado ya estaba en el medio:
 *
 *      50 INSERCION DE VARILLA  ->  60 ENFUNDADO  ->  70 INYECCION DE PU
 *
 * SOLO SE TOCAN LOS NUMEROS. El contenido de cada operacion (work elements, modos de falla,
 * causas, S/O/D, controles) queda intacto: son las mismas operaciones, en el orden correcto.
 * Se verifico que la 50 y la 70 son las que se intercambian POR CONTENIDO, no por posicion
 * (regla `renumerar_sin_leer_contenido`).
 *
 * NO HACE FALTA INVENTAR NINGUN MODO DE FALLA: el mas obvio del orden correcto —que el PU
 * se fugue del molde— ya existe en la operacion de inyeccion ("La mezcla PU se escapa del
 * molde durante la inyeccion"), identico al del AMFE 151.
 *
 * LA REGLA DEL PROYECTO DECIA LO CONTRARIO Y ESTABA MAL. `.claude/rules/amfe.md` §12 afirmaba
 * que los traseros van "directo a PU". Fak: *"debe estar mal esa regla supongo"*. Se corrige
 * en el mismo commit. Lo que la regla SI acierta es que el proceso no es identico al del
 * delantero: el delantero lleva inserto EPP y los traseros solo varilla.
 *
 * Uso:  node scripts/_corregirOrdenApoyacabezasTraseros.mjs           (dry-run)
 *       node scripts/_corregirOrdenApoyacabezasTraseros.mjs --apply
 */

import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import { connectSupabase, parseData, saveAmfe, syncFieldAliases } from './_lib/amfeIo.mjs';

const OBJETIVO = ['AMFE-HRC-PAT', 'AMFE-HRO-PAT'];

/** Los dos que se intercambian, identificados por CONTENIDO (nombre de la operacion). */
const SWAP = [
    { re: /^INSERCION DE VARILLA$/i, de: '70', a: '50' },
    { re: /^INYECCION DE PU$/i, de: '50', a: '70' },
];

const numDe = (op) => String(op.opNumber ?? op.operationNumber ?? '').trim();
const nomDe = (op) => String(op.name ?? op.operationName ?? '').trim();

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const { data: rows, error } = await sb
    .from('amfe_documents').select('id, amfe_number, data').in('amfe_number', OBJETIVO);
if (error) throw error;
if (rows.length !== 2) throw new Error(`Esperaba 2 AMFE y encontre ${rows.length}. Se aborta.`);

const plan = [];
const commits = [];

for (const row of rows.sort((a, b) => a.amfe_number.localeCompare(b.amfe_number))) {
    const before = parseData(row.data);
    const doc = parseData(row.data);

    console.log(`\n─── ${row.amfe_number} ───`);

    // Ubicar las dos operaciones por NOMBRE, y confirmar que estan donde el diagnostico dice.
    const encontradas = SWAP.map(s => {
        const op = (doc.operations || []).find(o => s.re.test(nomDe(o)));
        if (!op) throw new Error(`${row.amfe_number}: no encontre la operacion ${s.re}. Se aborta.`);
        const actual = numDe(op);
        if (actual !== s.de) {
            throw new Error(
                `${row.amfe_number}: "${nomDe(op)}" esta en ${actual} y esperaba ${s.de}. `
                + `Alguien ya la movio; se aborta para no pisar un cambio ajeno.`);
        }
        return { op, ...s };
    });

    // El enfundado tiene que estar en 60 y quedarse ahi: es el que da sentido al swap.
    const enfundado = (doc.operations || []).find(o => /^ENFUNDADO$/i.test(nomDe(o)));
    if (!enfundado || numDe(enfundado) !== '60') {
        throw new Error(`${row.amfe_number}: el ENFUNDADO no esta en 60. Se aborta.`);
    }

    for (const { op, de, a } of encontradas) {
        op.opNumber = a;
        op.operationNumber = a;
        logChange(apply, `${row.amfe_number}: "${nomDe(op)}"  ${de} -> ${a}`, {});
    }

    // Dejar el array en orden de proceso, que es como lo lee el export.
    doc.operations.sort((x, y) => Number(numDe(x) || 0) - Number(numDe(y) || 0));
    console.log(`   secuencia final: ${doc.operations.map(numDe).join(' · ')}`);

    syncFieldAliases(doc);
    plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: 'APOYACABEZAS TRASERO', before, after: doc });

    commits.push(async () => {
        await saveAmfe(sb, row.id, doc);
        const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', row.id).single();
        const live = parseData(chk.data);

        const porNombre = (re) => (live.operations || []).find(o => re.test(nomDe(o)));
        const varilla = numDe(porNombre(/^INSERCION DE VARILLA$/i));
        const funda = numDe(porNombre(/^ENFUNDADO$/i));
        const pu = numDe(porNombre(/^INYECCION DE PU$/i));
        if (varilla !== '50' || funda !== '60' || pu !== '70') {
            throw new Error(`POST-CHECK ${row.amfe_number}: quedo varilla=${varilla} funda=${funda} PU=${pu}`);
        }
        const nums = (live.operations || []).map(numDe).filter(Boolean);
        const dup = nums.filter((v, i) => nums.indexOf(v) !== i);
        if (dup.length) throw new Error(`POST-CHECK ${row.amfe_number}: numeros duplicados ${dup.join(', ')}`);

        console.log(`POST-CHECK live ${row.amfe_number}: 50 varilla · 60 funda · 70 PU, sin duplicados`);
    });
}

await runWithValidation(plan, apply, async () => {
    for (const c of commits) await c();
});

finish(apply);
