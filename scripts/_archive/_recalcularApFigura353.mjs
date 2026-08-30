/**
 * _recalcularApFigura353.mjs — recalcula el AP de TODAS las causas de los 17 AMFE con la
 * tabla corregida (Figura 3.5-3 del AIAG-VDA), y pone el placeholder autorizado donde una
 * causa sube a AP=H y no tiene accion.
 *
 * POR QUE
 *
 * La auditoria de cliente del 22/08/2026 leyo la Figura 3.5-3 del manual y encontro que
 * `apTable.ts` agrupaba la severidad en bandas que no son las del AIAG-VDA: usaba
 * 9-10 / 7-8 / 4-6 / 2-3 / 1 donde el manual usa **9-10 / 5-8 / 2-4 / 1**, y ademas se
 * apartaba de la figura en tres celdas. 305 de las 838 combinaciones validas daban distinto
 * y 281 de ellas SUBDECLARABAN el riesgo. El codigo quedo corregido en el commit 6969d691;
 * los datos guardados siguen con el AP viejo, y este script es el que los pone al dia.
 *
 * Medido sobre Supabase live el 22/08/2026: **760 causas con el AP mal en los 17 AMFE**
 * (607 de ellas en los 8 de Patagonia, y 592 subdeclarando).
 *
 * QUE HACE
 *   1. AP = calculateAP(S del MODO DE FALLA, O y D de la causa). La S es la del modo, no la
 *      de la causa: `AmfeCause` ni tiene ese campo, es basura de una importacion vieja
 *      (check CAUSE_SEVERITY_PROPIA).
 *   2. Si una causa pasa a AP=H y no tiene accion, se le pone el placeholder literal que
 *      Fak autorizo (amfe.md §4). Nunca pisa una accion ya escrita.
 *   3. Sincroniza alias (ap/actionPriority) y los campos legacy del modo de falla.
 *
 * QUE NO HACE
 *   - No toca S, O ni D: son dato tecnico y los define el equipo.
 *   - Las combinaciones que la figura marca "Error" (O=1 sin D=1, y al reves) las REPORTA
 *     y les deja el AP que ya tenian. Vaciarlas seria sacar informacion del documento sin
 *     que nadie lo haya decidido; corregir O o D seria inventar un dato tecnico.
 *   - No toca el log de revisiones: esto corrige un error nuestro, no un cambio de proceso.
 *
 * Correr:  node scripts/_recalcularApFigura353.mjs           (dry-run)
 *          node scripts/_recalcularApFigura353.mjs --apply
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';
import { calculateAP, apImplausible, parseData, syncFieldAliases, syncLegacyFmFields } from './_lib/amfeIo.mjs';

const { apply: APLICAR } = parseSafeArgs();
const PLACEHOLDER = 'Pendiente definicion equipo APQP';
const RANGO = { L: 0, M: 1, H: 2 };

const env = Object.fromEntries(
    readFileSync(new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), 'utf8')
        .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

const { data: filas, error } = await sb.from('amfe_documents').select('id, amfe_number, project_name, data');
if (error) { console.error(error.message); process.exit(1); }

const plan = [];
const pendientes = [];
const implausibles = [];
let totalRecalculados = 0, totalSuben = 0, totalBajan = 0, totalPlaceholder = 0;

for (const row of filas) {
    const doc = parseData(row.data);
    const before = JSON.parse(JSON.stringify(doc));
    const cambios = [];
    let sube = 0, baja = 0, placeholders = 0;

    for (const op of doc.operations ?? []) {
        const opNum = op.opNumber ?? op.operationNumber ?? '?';
        for (const we of op.workElements ?? []) {
            for (const fn of we.functions ?? []) {
                for (const fm of fn.failures ?? []) {
                    const s = Number(fm.severity);
                    for (const c of fm.causes ?? []) {
                        const o = Number(c.occurrence), d = Number(c.detection);
                        if (!s || !o || !d) continue;

                        if (apImplausible(s, o, d)) {
                            implausibles.push(`${row.amfe_number} OP${opNum} "${fm.description ?? fm.failureMode}" / "${c.cause ?? c.description}": S=${s} O=${o} D=${d}`);
                            continue;
                        }
                        const nuevo = calculateAP(s, o, d);
                        if (!nuevo) continue;
                        const viejo = String(c.ap ?? c.actionPriority ?? '').trim().toUpperCase();
                        if (viejo === nuevo) continue;

                        c.ap = nuevo;
                        c.actionPriority = nuevo;
                        if (RANGO[nuevo] > RANGO[viejo]) sube++; else baja++;
                        cambios.push(`OP${opNum} "${(c.cause ?? c.description ?? '').slice(0, 55)}" (S=${s} O=${o} D=${d}): ${viejo || '(vacio)'} -> ${nuevo}`);

                        // amfe.md §4: AP=H sin accion definida lleva el placeholder autorizado.
                        const tieneAccion = [c.optimizationAction, c.preventionAction, c.detectionAction]
                            .some(x => x && String(x).trim() && String(x).trim() !== '-');
                        if (nuevo === 'H' && !tieneAccion) {
                            c.optimizationAction = PLACEHOLDER;
                            placeholders++;
                        }
                    }
                }
            }
        }
    }

    if (!cambios.length) continue;
    syncFieldAliases(doc);
    syncLegacyFmFields(doc);

    totalRecalculados += cambios.length; totalSuben += sube; totalBajan += baja; totalPlaceholder += placeholders;
    console.log(`\n  ${row.amfe_number} (${row.project_name}) — ${cambios.length} AP: ${sube} suben, ${baja} bajan, ${placeholders} placeholders`);
    cambios.slice(0, 6).forEach(c => console.log(`     ${c}`));
    if (cambios.length > 6) console.log(`     ... y ${cambios.length - 6} mas`);

    plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before, after: doc });
    pendientes.push({ id: row.id, amfeNumber: row.amfe_number, data: JSON.stringify(doc) });
}

if (implausibles.length) {
    console.log(`\n  ── ${implausibles.length} causas con S/O/D que la Figura 3.5-3 marca "Error" (NO se tocan, las revisa el equipo) ──`);
    implausibles.forEach(i => console.log(`     ${i}`));
}
console.log(`\n=== ${plan.length} documentos | ${totalRecalculados} AP recalculados: ${totalSuben} suben, ${totalBajan} bajan | ${totalPlaceholder} placeholders nuevos ===`);

await runWithValidation(plan, APLICAR, async () => {
    for (const p of pendientes) {
        const { error: e } = await sb.from('amfe_documents')
            .update({ data: p.data, updated_at: new Date().toISOString() }).eq('id', p.id);
        if (e) { console.error(`${p.amfeNumber}: ${e.message}`); process.exit(1); }
        const { data: check } = await sb.from('amfe_documents').select('data').eq('id', p.id).single();
        const doc = JSON.parse(check.data);
        if (!Array.isArray(doc.operations)) { console.error(`${p.amfeNumber}: operations no es array`); process.exit(1); }
        console.log(`  ${p.amfeNumber}: OK (${doc.operations.length} ops, JSON valido)`);
    }
});
