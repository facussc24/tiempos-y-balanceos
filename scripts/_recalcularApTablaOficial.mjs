/**
 * _recalcularApTablaOficial.mjs — recalcula el AP guardado de TODAS las causas de todos los
 * AMFE con la tabla OFICIAL del AIAG-VDA (SETEC, pag. 116-118 del PDF).
 *
 * POR QUE
 * Entre el 22/08 y el 23/09/2026 `calculateAP` copiaba la tabla de un BORRADOR de 2017 del
 * manual (bandas de S 9-10/5-8/2-4/1 y casilleros "Error"). Fak, 23/09/2026: "vamos a usar
 * la tabla oficial ni mas ni menos". El codigo ya calcula con la oficial (apTable.ts y su
 * replica en _lib/amfeIo.mjs); este script pone al dia lo que quedo GUARDADO.
 *
 * QUE HACE
 *   1. AP = calculateAP(S del MODO DE FALLA, O y D de la causa), en `ap` y `actionPriority`.
 *   2. Actualiza las columnas derivadas `ap_h_count` y `ap_m_count` de la fila.
 *   3. Guarda con saveAmfe() (sincroniza alias y campos legacy, pone updated_at, relee).
 *
 * QUE NO HACE
 *   - No toca S, O ni D: son dato tecnico del equipo.
 *   - No toca acciones: un AP=H sin accion queda con la celda VACIA (amfe.md §4); el
 *     placeholder esta prohibido.
 *   - No toca el log de revisiones: cambia la vara con la que se calcula, no el proceso.
 *
 * Correr:  node scripts/_recalcularApTablaOficial.mjs                (dry-run, todos)
 *          node scripts/_recalcularApTablaOficial.mjs AMFE-P21-NAR-MY26   (dry-run, uno)
 *          node scripts/_recalcularApTablaOficial.mjs [AMFE] --apply
 */
import { connectSupabase, parseData, calculateAP, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply: APLICAR, positional } = parseSafeArgs();
const SOLO = positional[0] || null;
const RANGO = { '': -1, L: 0, M: 1, H: 2 };

const sb = await connectSupabase();
let q = sb.from('amfe_documents').select('id, amfe_number, project_name, data');
if (SOLO) q = q.eq('amfe_number', SOLO);
const { data: filas, error } = await q;
if (error) { console.error(error.message); process.exit(1); }
if (!filas.length) { console.error(`No hay AMFE ${SOLO ?? ''}`); process.exit(1); }

const plan = [];
const guardar = [];
let total = 0, suben = 0, bajan = 0;

for (const row of filas) {
    const doc = parseData(row.data);
    if (!doc || !Array.isArray(doc.operations)) { console.log(`  ${row.amfe_number}: sin operations, se saltea`); continue; }
    const before = JSON.parse(JSON.stringify(doc));
    const cambios = [];
    const cuenta = { H: 0, M: 0, L: 0 };

    for (const op of doc.operations) {
        const opNum = op.opNumber ?? op.operationNumber ?? '?';
        for (const we of op.workElements ?? []) for (const fn of we.functions ?? []) for (const fm of fn.failures ?? []) {
            const s = Number(fm.severity);
            for (const c of fm.causes ?? []) {
                const o = Number(c.occurrence), d = Number(c.detection);
                const nuevo = (s && o && d) ? calculateAP(s, o, d) : '';
                const viejo = String(c.ap ?? c.actionPriority ?? '').trim().toUpperCase();
                const vale = nuevo || viejo;
                if (cuenta[vale] !== undefined) cuenta[vale]++;
                if (!nuevo || viejo === nuevo) continue;
                c.ap = nuevo;
                c.actionPriority = nuevo;
                if (RANGO[nuevo] > (RANGO[viejo] ?? -1)) suben++; else bajan++;
                cambios.push(`OP${opNum} "${String(c.cause ?? c.description ?? '').slice(0, 50)}" S${s} O${o} D${d}: ${viejo || '(vacio)'} -> ${nuevo}`);
            }
        }
    }

    if (!cambios.length) { console.log(`  ${row.amfe_number}: sin cambios`); continue; }
    total += cambios.length;
    console.log(`\n  ${row.amfe_number} (${row.project_name}) — ${cambios.length} AP cambian · queda H=${cuenta.H} M=${cuenta.M} L=${cuenta.L}`);
    cambios.slice(0, 5).forEach(c => console.log(`     ${c}`));
    if (cambios.length > 5) console.log(`     ... y ${cambios.length - 5} mas`);

    plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before, after: doc });
    guardar.push({ id: row.id, amfeNumber: row.amfe_number, doc, cuenta });
}

console.log(`\n=== ${guardar.length} AMFE · ${total} AP recalculados: ${suben} suben, ${bajan} bajan ===`);

await runWithValidation(plan, APLICAR, async () => {
    for (const g of guardar) {
        await saveAmfe(sb, g.id, g.doc, {
            expectedAmfeNumber: g.amfeNumber,
            extraFields: { ap_h_count: g.cuenta.H, ap_m_count: g.cuenta.M },
        });
        console.log(`  ${g.amfeNumber}: guardado y releido OK (H=${g.cuenta.H} M=${g.cuenta.M} L=${g.cuenta.L})`);
    }
});
