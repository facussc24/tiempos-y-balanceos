/**
 * _corregirSeveridadPaisOrigen.mjs — la severidad del modo de falla "Pais de origen ausente
 * o incorrecto" (OP80, los tres apoyacabezas de Patagonia) estaba en 5 y tiene que ser 7.
 *
 * POR QUE 7 Y NO OTRO NUMERO
 * `amfe.md` §2, textual: *"Efecto legal/aduanero -> S>=7 obligatorio. Si algun efecto
 * (local/next/endUser) menciona incumplimiento legal, retencion aduanera, declaracion de
 * origen, multa o sancion legal: TODAS las causas de ese failure van S>=7 (multa/retencion=7,
 * para linea cliente=8, recall/judicial=9, dano a personas=9-10)"*.
 *
 * El modo de falla declara los tres niveles de efecto asi:
 *   local  "Rechazo embalaje"
 *   next   "Retencion aduanera en cliente"
 *   user   "Incumplimiento legal declaracion origen"
 *
 * Retencion aduanera, sin multa ni recall ni parada de la linea del cliente: **7**, el piso
 * de la banda. No 8, no 9.
 *
 * Ya tenia su check CRITICO (`CAUSE_LEGAL_COMPLIANCE_UNDERCALIBRATED` en
 * `scripts/_lib/amfeValidator.mjs`), que es el que lo destapo: los tres AMFE daban
 * NO LISTO en `_readiness.mjs` por esta fila.
 *
 * QUE MAS CAMBIA
 * Nada. La unica causa del modo de falla tiene O=3 y D=3, asi que el AP se queda en L con
 * S=5 y con S=7 — igual se recalcula con `calculateAP()` y nunca a mano. O y D no se tocan:
 * la S es del EFECTO, y lo que estaba mal calibrado era el efecto.
 *
 * El log de revisiones no se toca: esto corrige un error nuestro.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';
import { calculateAP, syncLegacyFmFields } from './_lib/amfeIo.mjs';

const { apply: APLICAR } = parseSafeArgs();

const AFECTADOS = ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const OP = '80';
const FM = /pais de origen ausente o incorrecto/i;
const S_NUEVA = 7;
const S_ESPERADA = 5;   // lo que tiene que haber para pisarlo; si no, se aborta

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

const { data: rows, error } = await sb.from('amfe_documents')
    .select('id, amfe_number, project_name, data').in('amfe_number', AFECTADOS);
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== AFECTADOS.length) {
    console.error(`Esperaba ${AFECTADOS.length} AMFE, vinieron ${rows.length}`);
    process.exit(1);
}

const plan = [], pendientes = [];

for (const row of rows.sort((a, b) => a.amfe_number.localeCompare(b.amfe_number))) {
    const antes = typeof row.data === 'string' ? JSON.parse(row.data) : structuredClone(row.data);
    const doc = JSON.parse(JSON.stringify(antes));
    const op = (doc.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);
    if (!op) { console.error(`${row.amfe_number}: no existe la OP${OP}`); process.exit(1); }

    let tocados = 0;
    for (const we of (op.workElements ?? [])) for (const fn of (we.functions ?? [])) {
        for (const fm of (fn.failures ?? [])) {
            if (!FM.test(String(fm.description ?? ''))) continue;
            if (Number(fm.severity) === S_NUEVA) continue;                 // idempotente
            if (Number(fm.severity) !== S_ESPERADA) {
                console.error(`${row.amfe_number}: la severidad es ${fm.severity} y esperaba ${S_ESPERADA} — abortar, no piso un valor que no reconozco`);
                process.exit(1);
            }
            console.log(`\n  ${row.amfe_number} OP${OP} — "${fm.description}"`);
            console.log(`     efecto en el cliente: ${fm.effectNextLevel}`);
            console.log(`     efecto en el usuario: ${fm.effectEndUser}`);
            console.log(`     S: ${fm.severity} -> ${S_NUEVA}`);
            fm.severity = S_NUEVA;

            for (const c of (fm.causes ?? [])) {
                const o = Number(c.occurrence);
                const d = Number(c.detection);
                const apAntes = c.actionPriority ?? c.ap;
                const apDespues = calculateAP(S_NUEVA, o, d);
                console.log(`     causa "${c.cause}"  O=${o} D=${d}   AP: ${apAntes} -> ${apDespues}`);
                c.ap = apDespues;
                c.actionPriority = apDespues;
                // AP=H sin accion es bloqueo IATF: va el placeholder autorizado (amfe.md §4).
                if (apDespues === 'H' && !String(c.optimizationAction ?? '').trim()) {
                    c.optimizationAction = 'Pendiente definicion equipo APQP';
                    console.log(`     accion de optimizacion: se agrega el placeholder "Pendiente definicion equipo APQP"`);
                }
            }
            tocados++;
        }
    }

    if (!tocados) { console.log(`\n  ${row.amfe_number}: ya esta en S=${S_NUEVA}.`); continue; }

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
        const malos = (op.workElements ?? []).flatMap(w => w.functions ?? [])
            .flatMap(f => f.failures ?? []).filter(fm => FM.test(String(fm.description ?? '')))
            .filter(fm => Number(fm.severity) !== S_NUEVA).length;
        if (malos) { console.error(`${p.amfeNumber}: quedan ${malos} modos de falla sin corregir`); process.exit(1); }
        console.log(`  ${p.amfeNumber}: OK — severidad en ${S_NUEVA}`);
    }
});
