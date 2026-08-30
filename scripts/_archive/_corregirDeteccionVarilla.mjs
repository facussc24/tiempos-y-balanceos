/**
 * _corregirDeteccionVarilla.mjs — la deteccion de la varilla desalineada estaba en 5 porque
 * la sostenia un sensor que no existe.
 *
 * DE DONDE VENIA EL 5
 * La causa "Colocacion incorrecta por parte del operador" del modo de falla "2- Varilla
 * desalineada" (OP41, los tres apoyacabezas) tenia D=5 apoyada en este control de deteccion:
 *
 *   "Poka-Yoke preventivo en estacion (Sensor verifica alineacion y correcta colocacion de la
 *    varilla antes de iniciar el proceso)."
 *
 * Ese sensor se saco el 24/08 (`_sacarPokaYokeVarilla151.mjs`): sale del AMFE PRELIMINAR del
 * delantero, el Plan de Control no lo respalda (0 "sensor", 0 "varilla") y Fak confirmo que
 * la maquina que lo tendria **no se usa en Patagonia: la varilla se pone a mano**. El control
 * quedo en TBD, pero **la D se quedo en 5**, que es el numero de un poka-yoke.
 *
 * POR QUE 8 Y NO OTRO NUMERO
 * Tabla P3 del AIAG-VDA (la corregida el 24/08 contra el manual, `amfe.md` §13): un control
 * que depende de una persona va **D=7 si detecta EN LA ESTACION y D=8 si detecta AGUAS ABAJO**.
 * Acá no hay control declarado en la estacion — el ciclo de control de la pestaña 41 de la HO
 * esta en TBD. Lo que si esta documentado es que el defecto se agarra despues:
 *   - OP52 INYECCION DE PU, modo de falla "La mezcla PU se escapa del molde durante la
 *     inyeccion", causa "El vinilo no abraza la varilla — sello deficiente";
 *   - OP60 CONTROL FINAL, con los 7 chequeos de la HO pestaña 60.
 * O sea: deteccion humana aguas abajo -> **D=8**.
 *
 * Fak, 24/08: *"y la deteccion esa, ¿no la podes corregir en vez de llorarmela a mi?"*.
 *
 * El AP se recalcula con la tabla oficial (`calculateAP`), nunca a mano.
 * S y O NO se tocan: el sensor solo justificaba la D.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';
import { calculateAP, syncLegacyFmFields } from './_lib/amfeIo.mjs';

const { apply: APLICAR } = parseSafeArgs();

const AFECTADOS = ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const OP = '41';
const FM = /varilla desalineada/i;
const D_NUEVA = 8;
const D_ESPERADA = 5;   // lo que tiene que haber para pisarlo; si no, se aborta

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

const { data: rows, error } = await sb.from('amfe_documents')
    .select('id, amfe_number, project_name, cause_count, data').in('amfe_number', AFECTADOS);
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== 3) { console.error(`Esperaba 3 AMFE, vinieron ${rows.length}`); process.exit(1); }

const plan = [], pendientes = [];

for (const row of rows.sort((a, b) => a.amfe_number.localeCompare(b.amfe_number))) {
    const antes = typeof row.data === 'string' ? JSON.parse(row.data) : structuredClone(row.data);
    const doc = JSON.parse(JSON.stringify(antes));
    const op = (doc.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);
    if (!op) { console.error(`${row.amfe_number}: no existe la OP${OP}`); process.exit(1); }

    let tocadas = 0;
    for (const we of (op.workElements ?? [])) for (const fn of (we.functions ?? [])) {
        for (const fm of (fn.failures ?? [])) {
            if (!FM.test(String(fm.description ?? ''))) continue;
            for (const c of (fm.causes ?? [])) {
                if (Number(c.detection) === D_NUEVA) continue;            // idempotente
                if (Number(c.detection) !== D_ESPERADA) {
                    console.error(`${row.amfe_number}: la deteccion es ${c.detection} y esperaba ${D_ESPERADA} — abortar, no piso un valor que no reconozco`);
                    process.exit(1);
                }
                const s = Number(fm.severity ?? c.severity);
                const o = Number(c.occurrence);
                const apAntes = c.actionPriority ?? c.ap;
                const apDespues = calculateAP(s, o, D_NUEVA);
                console.log(`\n  ${row.amfe_number} OP${OP} — "${fm.description}"`);
                console.log(`     causa: ${c.cause}`);
                console.log(`     S=${s} O=${o}   D: ${c.detection} -> ${D_NUEVA}   AP: ${apAntes} -> ${apDespues}`);
                c.detection = D_NUEVA;
                c.ap = apDespues;
                c.actionPriority = apDespues;
                // AP=H sin accion es bloqueo IATF: va el placeholder autorizado (amfe.md §4).
                if (apDespues === 'H' && !String(c.optimizationAction ?? '').trim()) {
                    c.optimizationAction = 'Pendiente definicion equipo APQP';
                    console.log(`     accion de optimizacion: se agrega el placeholder "Pendiente definicion equipo APQP"`);
                }
                tocadas++;
            }
        }
    }

    if (!tocadas) { console.log(`\n  ${row.amfe_number}: ya esta en D=${D_NUEVA}.`); continue; }

    // Los campos legacy a nivel fm tienen que seguir la causa (el export los lee).
    syncLegacyFmFields(doc);

    plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc });
    pendientes.push({ id: row.id, amfeNumber: row.amfe_number, data: JSON.stringify(doc) });
}

if (!plan.length) { console.log('\n  Nada que corregir.'); process.exit(0); }

await runWithValidation(plan, APLICAR, async () => {
    for (const p of pendientes) {
        const { error: e } = await sb.from('amfe_documents')
            .update({ data: p.data, updated_at: new Date().toISOString() }).eq('id', p.id);
        if (e) { console.error(`${p.amfeNumber}: ${e.message}`); process.exit(1); }
        const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', p.id).single();
        const live = typeof chk.data === 'string' ? JSON.parse(chk.data) : chk.data;
        const op = (live.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);
        const malas = (op.workElements ?? []).flatMap(w => w.functions ?? [])
            .flatMap(f => f.failures ?? []).filter(fm => FM.test(String(fm.description ?? '')))
            .flatMap(fm => fm.causes ?? []).filter(c => Number(c.detection) !== D_NUEVA).length;
        if (malas) { console.error(`${p.amfeNumber}: quedan ${malas} causas sin corregir`); process.exit(1); }
        console.log(`  ${p.amfeNumber}: OK — deteccion en ${D_NUEVA}`);
    }
});
