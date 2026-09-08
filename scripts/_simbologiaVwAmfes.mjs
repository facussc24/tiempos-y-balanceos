/**
 * Pasa las caracteristicas especiales de los AMFE de VW a la simbologia del cliente:
 * CC -> D/TLD y SC -> W (Wichtig).
 *
 * Por que: el instructivo del SGC `I-AC-005` cierra con "sera utilizada la simbologia
 * especificada por el Cliente cuando el mismo asi lo requiera", y la tabla de conversion del
 * `I-PY-001.7` (requisito IATF 16949) dice que para VW la critica es `D/TLD` y la significativa
 * `Wichtig (W)`. Decision de Fak, 08/09/2026: *"quedo claro que deberiamos usar las siglas de VW
 * entonces... y corregir la documentacion de VW porque en ingenieria no la veniamos usando"*.
 * Fuentes y divergencias: rules/amfe.md §2.1 + memoria `caracteristicas_especiales_notacion_barack`.
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
 *   - `OS` y `HI`: la tabla de conversion dice N/A para VW, asi que se quedan como estan.
 *
 * Uso:  node scripts/_simbologiaVwAmfes.mjs            (dry-run, no escribe)
 *       node scripts/_simbologiaVwAmfes.mjs --apply    (escribe)
 */
import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, logChange, finish } from './_lib/dryRunGuard.mjs';

// Espejo de modules/amfe/specialChars.ts (los .mjs no pueden importar .ts sin build).
// Si cambia alla, cambia aca: los tests de specialChars.test.ts fijan el contrato.
const CRITICA = ['CC', '∇', '▽', 'D', 'D/TLD', 'TLD'];
const SIGNIFICATIVA = ['SC', 'CS', 'W', 'WICHTIG'];
const VW = { CRITICA: 'D/TLD', SIGNIFICATIVA: 'W' };

/** Excluidos a proposito, con el motivo. Un AMFE que no este aca ni sea VWA se reporta. */
const NO_VW = new Set(['AMFE-1', 'AMFE-2', '159', '160', 'AMFE-MAESTRO-PU-001', 'AMFE-DUC-PAT']);

function convertir(raw) {
    const txt = String(raw || '').trim();
    if (!txt) return txt;
    const num = txt.match(/\s*(\d+)$/);
    const base = txt.toUpperCase().replace(/\s*\d+$/, '').trim();
    if (CRITICA.includes(base)) return VW.CRITICA + (num ? ` ${num[1]}` : '');
    if (SIGNIFICATIVA.includes(base)) return VW.SIGNIFICATIVA + (num ? ` ${num[1]}` : '');
    return txt; // OS, HI y cualquier sigla que no reconozcamos quedan intactas
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
                        if (!antesSc) continue;
                        totalCausas++;
                        const despues = convertir(antesSc);
                        if (despues === antesSc) {
                            const base = antesSc.toUpperCase().replace(/\s*\d+$/, '').trim();
                            if (!['OS', 'HI'].includes(base)) {
                                desconocidas.set(`${num}: '${antesSc}'`,
                                    (desconocidas.get(`${num}: '${antesSc}'`) || 0) + 1);
                            }
                            continue;
                        }
                        c.specialChar = despues;
                        if (fail.specialChar) fail.specialChar = convertir(fail.specialChar);
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
    console.log('\n⚠ SIGLAS QUE NINGUNA FUENTE RECONOCE (no se tocaron):');
    for (const [k, n] of desconocidas) console.log(`   ${k}  x${n}`);
}

await runWithValidation(plan, apply, async () => {
    for (const p of plan) {
        await saveAmfe(sb, p.id, p.after, { expectedAmfeNumber: p.amfeNumber });
        console.log(`   escrito ${p.amfeNumber}`);
    }
});

finish(apply);
