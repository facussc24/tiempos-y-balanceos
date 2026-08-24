/**
 * _alinearFocusOp60Lateral.mjs — el `focusElementFunction` de la OP60 del AMFE 155.
 *
 * HALLAZGO DEL AUDITOR DE CIERRE (24/08/2026)
 * Al alinear la OP60 del trasero lateral con sus hermanos (`_alinearOp60ControlFinal.mjs`)
 * copie los `workElements` y complete el `operationFunction`, pero deje el
 * `focusElementFunction` viejo: un texto corto, sin el formato VDA de tres perspectivas que
 * si tienen el 151 y el 153. Dije "los tres alineados" y quedo un campo distinto.
 *
 * QUE TEXTO VA — y por que NO el del hermano
 * El `focusElementFunction` describe el PRODUCTO, no la operacion: el del 153 dice "trasero
 * central" y este es el LATERAL. Copiarlo meteria el nombre del producto equivocado.
 * Se usa el texto **canonico del propio AMFE 155**, el que ya tienen **9 de sus 13
 * operaciones**. Es consistencia interna del documento, no propagacion entre hermanos.
 *
 * ALCANCE: solo la OP60. El 155 tiene otras 3 operaciones con `focusElementFunction` propio
 * (costura, inyeccion de PU y embalaje) — son preexistentes, no las toco en esta tanda, y
 * quedan reportadas.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply: APLICAR } = parseSafeArgs();
const AMFE = 'AMFE-HRO-PAT';
const OP = '60';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

const { data: rows, error } = await sb.from('amfe_documents')
    .select('id, amfe_number, project_name, data').eq('amfe_number', AMFE);
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== 1) { console.error(`Esperaba 1 AMFE, vinieron ${rows.length}`); process.exit(1); }

const row = rows[0];
const antes = typeof row.data === 'string' ? JSON.parse(row.data) : structuredClone(row.data);
const doc = JSON.parse(JSON.stringify(antes));

// El texto canonico se DERIVA del documento: el mas usado entre sus operaciones.
const cuenta = new Map();
for (const op of (doc.operations ?? [])) {
    const f = String(op.focusElementFunction ?? '').trim();
    if (f) cuenta.set(f, (cuenta.get(f) ?? 0) + 1);
}
const [canonico, veces] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
if (!canonico || veces < 5) {
    console.error(`no hay un texto canonico claro en ${AMFE} (el mas usado aparece ${veces ?? 0} veces) — abortar`);
    process.exit(1);
}
if (!/trasero lateral/i.test(canonico)) {
    console.error(`el texto canonico no nombra "trasero lateral" — abortar, no vaya a ser el del producto equivocado`);
    process.exit(1);
}

const op = (doc.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);
if (!op) { console.error(`no existe la OP${OP}`); process.exit(1); }
if (String(op.focusElementFunction ?? '').trim() === canonico) {
    console.log(`  ${AMFE} OP${OP}: ya esta alineado.`); process.exit(0);
}

console.log(`\n  ${AMFE} OP${OP} "${op.name}"`);
console.log(`     texto canonico del documento (lo usan ${veces} de ${doc.operations.length} operaciones)`);
console.log(`\n     ANTES: ${op.focusElementFunction}`);
console.log(`\n     AHORA: ${canonico}`);
op.focusElementFunction = canonico;

// Invariante: no se toca nada mas.
const causas = d => (d.operations ?? []).flatMap(o => o.workElements ?? [])
    .flatMap(w => w.functions ?? []).flatMap(f => f.failures ?? []).flatMap(fm => fm.causes ?? []).length;
if (causas(antes) !== causas(doc) || antes.operations.length !== doc.operations.length) {
    console.error('cambio la estructura — abortar'); process.exit(1);
}

const plan = [{ id: row.id, amfeNumber: AMFE, productName: row.project_name, before: antes, after: doc }];

await runWithValidation(plan, APLICAR, async () => {
    const { error: e } = await sb.from('amfe_documents')
        .update({ data: JSON.stringify(doc), updated_at: new Date().toISOString() }).eq('id', row.id);
    if (e) { console.error(e.message); process.exit(1); }
    const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', row.id).single();
    const live = typeof chk.data === 'string' ? JSON.parse(chk.data) : chk.data;
    const o = (live.operations ?? []).find(x => String(x.opNumber ?? x.operationNumber) === OP);
    if (String(o.focusElementFunction ?? '').trim() !== canonico) { console.error('no quedo'); process.exit(1); }
    console.log(`  ${AMFE}: OK — OP${OP} alineada con el texto del documento`);
});
