/**
 * Pasa las caracteristicas especiales de los AMFE de VW a la simbologia del cliente:
 * critica -> D/TLD y significativa -> SC.
 *
 * Por que: el instructivo del SGC `I-AC-005` cierra con "sera utilizada la simbologia
 * especificada por el Cliente cuando el mismo asi lo requiera". Para VW la critica es `D/TLD`
 * (Formel Q Capacidad de Calidad pag. 28 §7.5: D y TLD son UNA sola marca, documentacion
 * obligatoria legal, la designa el cliente en el plano) y VW no tiene sigla propia de
 * significativa, asi que se escribe `SC` (Fak 09/09/2026: "la W no existe"). Hasta el 09/09
 * este script escribia `W`, que salia de una hoja del I-PY-001.7 que hoy esta en OBSOLETOS.
 * Criterio, siglas por destinatario y fuentes con pagina: regla `caracteristicas-especiales.md`.
 *
 * NO asigna ni saca ninguna caracteristica: solo TRADUCE la sigla de las que ya estan puestas.
 * La clasificacion la asigna Fak o el cliente (core-prohibiciones.md §2).
 *
 * Alcance: solo documentos cuyo cliente es VW/VWA. Quedan afuera a proposito:
 *   - PWA (159, 160, AMFE-1, AMFE-2): su tabla dice que la significativa sigue siendo `SC` y
 *     que la critica se consulta en su CSR, que no tenemos.
 *   - AMFE-MAESTRO-PU-001: es maestro, no va a ningun cliente.
 *   - AMFE-DUC-PAT (insonos/ductos): el proyecto es VW427 pero el CLIENTE de Barack es COZZUOL
 *     — asi lo declara su propio flujograma 158. La simbologia de VW no le aplica sola.
 *   - `OS` y `HI`: no tienen equivalente VW, se quedan como estan.
 *   - Una sigla que ninguna fuente reconoce (`W`, `Wichtig`, `Clave`...) NO se traduce: se
 *     reporta, y el validador la frena como SIGLA_DESCONOCIDA.
 *
 * Las tablas salen de la fuente unica core/amfe/caracteristicasEspeciales.data.json, a traves
 * de scripts/_lib/amfeValidator.mjs (mismo canon que la app y los hooks; sin espejo a mano).
 *
 * Uso:  node scripts/_simbologiaVwAmfes.mjs            (dry-run, no escribe)
 *       node scripts/_simbologiaVwAmfes.mjs --apply    (escribe)
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, logChange, finish } from './_lib/dryRunGuard.mjs';
import { CARACTERISTICAS_ESPECIALES, nivelDeSigla, esSinMarca } from './_lib/amfeValidator.mjs';

const VW = CARACTERISTICAS_ESPECIALES.simbologia.VW;

/** Excluidos a proposito, con el motivo. Un AMFE que no este aca ni sea VWA se reporta. */
const NO_VW = new Set(['AMFE-1', 'AMFE-2', '159', '160', 'AMFE-MAESTRO-PU-001', 'AMFE-DUC-PAT']);

/** Sigla en simbologia VW, o null si ninguna fuente la reconoce (se reporta, no se adivina). */
function convertir(raw) {
    const txt = String(raw || '').trim();
    if (!txt || esSinMarca(txt)) return txt;
    const num = txt.match(/\s*(\d+)$/);
    const nivel = nivelDeSigla(txt);
    if (!nivel || !VW[nivel]) return null;
    return VW[nivel] + (num ? ` ${num[1]}` : '');
}

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const { data: rows, error } = await sb
    .from('amfe_documents')
    .select('id, amfe_number, project_name');
if (error) throw error;

const plan = [];
const desconocidas = new Map();
let totalCausas = 0;

for (const row of rows) {
    const num = String(row.amfe_number || '');
    const proj = String(row.project_name || '');
    if (NO_VW.has(num)) continue;
    if (!/^VWA\//.test(proj)) continue;

    const { doc } = await readAmfe(sb, row.id);
    const antes = JSON.parse(JSON.stringify(doc));
    let tocadas = 0;
    const resumen = new Map();

    for (const op of doc.operations || []) {
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fail of fn.failures || []) {
                    for (const c of fail.causes || []) {
                        const antesSc = String(c.specialChar || '').trim();
                        if (!antesSc || esSinMarca(antesSc)) continue;
                        totalCausas++;
                        const despues = convertir(antesSc);
                        if (despues === null) {
                            const k = `${num}: '${antesSc}'`;
                            desconocidas.set(k, (desconocidas.get(k) || 0) + 1);
                            continue;
                        }
                        if (despues === antesSc) continue;
                        c.specialChar = despues;
                        if (fail.specialChar) fail.specialChar = convertir(fail.specialChar) ?? fail.specialChar;
                        tocadas++;
                        const k = `${antesSc} -> ${despues}`;
                        resumen.set(k, (resumen.get(k) || 0) + 1);
                    }
                }
            }
        }
    }

    if (!tocadas) continue;
    logChange(apply, `${num} (${proj}): ${tocadas} causa(s)`,
        [...resumen.entries()].map(([k, n]) => `${k}  x${n}`).join('   '));
    plan.push({ id: row.id, amfeNumber: num, productName: proj, before: antes, after: doc });
}

console.log(`\nCausas con caracteristica especial revisadas: ${totalCausas}`);
if (desconocidas.size) {
    console.log('\n⚠ SIGLAS QUE NINGUNA FUENTE RECONOCE (no se tocaron; las asigna Fak o se corrigen a mano):');
    for (const [k, n] of desconocidas) console.log(`   ${k}  x${n}`);
}

await runWithValidation(plan, apply, async () => {
    for (const p of plan) {
        await saveAmfe(sb, p.id, p.after, { expectedAmfeNumber: p.amfeNumber });
        console.log(`   escrito ${p.amfeNumber}`);
    }
});

finish(apply);
