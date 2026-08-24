/**
 * _sincronizarFmLegacyYContadores.mjs — arregla dos cosas que dejaron mis scripts de hoy.
 *
 * QUE ROMPI, Y COMO SE VIO
 * Los scripts que llenaron las operaciones vacias de los apoyacabezas (OP42, OP50, OP51,
 * OP40 de los traseros, OP71) escribieron los modos de falla con `severity` a nivel fm pero
 * SIN `occurrence`, `detection` ni `ap`. Esos son campos "legacy" que el export lee a nivel
 * fm: si estan vacios, el Excel oficial saca celdas en blanco.
 *
 * `_auditAll.mjs --summary` lo marco: `fm_sod_missing` paso de 24 a 146. De esos 146, **40
 * son mios** (20 modos de falla nuevos x 2 campos faltantes): HF 16, HRC 12, HRO 12. Los
 * otros 106 son de antes o de la sesion paralela (82 del AMFE de ductos, 24 del maestro de PU).
 *
 * Y al sacar la OP11 y agregar causas quedaron desactualizadas las columnas `operation_count`
 * y `cause_count` de la tabla, que es lo que mira el check `metadata_desync`.
 *
 * LA CAUSA DE FONDO: escribi con `.update()` crudo en vez de usar `saveAmfe()` de
 * `_lib/amfeIo.mjs`, que hace este sync solo (`syncLegacyFmFields` + `syncFieldAliases`) —
 * justo lo que la regla `amfe.md` §14 dice que hay que usar. **Reusar antes de crear**: la
 * funcion existia y la salteé.
 *
 * QUE HACE: corre `syncLegacyFmFields()` (que copia S/O/D y AP desde las causas al modo de
 * falla) y `syncFieldAliases()` sobre los tres, y recalcula los dos contadores.
 * NO cambia ningun valor: solo copia hacia arriba lo que ya esta en las causas.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';
import { syncLegacyFmFields, syncFieldAliases } from './_lib/amfeIo.mjs';

const { apply: APLICAR } = parseSafeArgs();
const AFECTADOS = ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

const { data: rows, error } = await sb.from('amfe_documents')
    .select('id, amfe_number, project_name, operation_count, cause_count, data').in('amfe_number', AFECTADOS);
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== 3) { console.error(`Esperaba 3 AMFE, vinieron ${rows.length}`); process.exit(1); }

const contarCausas = d => (d.operations ?? []).flatMap(o => o.workElements ?? [])
    .flatMap(w => w.functions ?? []).flatMap(f => f.failures ?? []).flatMap(fm => fm.causes ?? []).length;
const fmSinSod = d => (d.operations ?? []).flatMap(o => o.workElements ?? [])
    .flatMap(w => w.functions ?? []).flatMap(f => f.failures ?? [])
    .filter(fm => (fm.causes ?? []).length && ['severity', 'occurrence', 'detection']
        .some(k => fm[k] === undefined || fm[k] === null || fm[k] === '' || fm[k] === 0)).length;

const plan = [], pendientes = [];

for (const row of rows.sort((a, b) => a.amfe_number.localeCompare(b.amfe_number))) {
    const antes = typeof row.data === 'string' ? JSON.parse(row.data) : structuredClone(row.data);
    const doc = JSON.parse(JSON.stringify(antes));

    const sinSodAntes = fmSinSod(doc);
    const r1 = syncLegacyFmFields(doc);
    const r2 = syncFieldAliases(doc);
    const sinSodDespues = fmSinSod(doc);

    const ops = (doc.operations ?? []).length;
    const causas = contarCausas(doc);
    const opsDesync = row.operation_count !== ops;
    const causasDesync = row.cause_count !== causas;

    const hayAlgo = sinSodAntes !== sinSodDespues || opsDesync || causasDesync
        || (r1?.synced ?? 0) > 0 || (r2?.synced ?? 0) > 0;
    if (!hayAlgo) { console.log(`\n  ${row.amfe_number}: ya esta sincronizado.`); continue; }

    console.log(`\n  ${row.amfe_number}`);
    console.log(`     modos de falla sin S/O/D: ${sinSodAntes} -> ${sinSodDespues}   (campos copiados desde las causas: ${r1?.synced ?? 0})`);
    if (r2?.synced) console.log(`     aliases sincronizados: ${r2.synced}`);
    if (opsDesync) console.log(`     operation_count: ${row.operation_count} -> ${ops}`);
    if (causasDesync) console.log(`     cause_count: ${row.cause_count} -> ${causas}`);

    // Invariante: no se toca ni una causa, solo se copia hacia arriba.
    if (contarCausas(antes) !== causas) { console.error(`${row.amfe_number}: cambio la cantidad de causas — ABORTAR`); process.exit(1); }

    plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc });
    pendientes.push({ id: row.id, amfeNumber: row.amfe_number, data: JSON.stringify(doc), ops, causas });
}

if (!plan.length) { console.log('\n  Nada que sincronizar.'); process.exit(0); }

await runWithValidation(plan, APLICAR, async () => {
    for (const p of pendientes) {
        const { error: e } = await sb.from('amfe_documents').update({
            data: p.data, operation_count: p.ops, cause_count: p.causas,
            updated_at: new Date().toISOString(),
        }).eq('id', p.id);
        if (e) { console.error(`${p.amfeNumber}: ${e.message}`); process.exit(1); }

        const { data: chk } = await sb.from('amfe_documents')
            .select('data, operation_count, cause_count').eq('id', p.id).single();
        const live = typeof chk.data === 'string' ? JSON.parse(chk.data) : chk.data;
        const q = fmSinSod(live);
        if (q > 0) { console.error(`${p.amfeNumber}: quedan ${q} modos de falla sin S/O/D`); process.exit(1); }
        if (chk.operation_count !== p.ops || chk.cause_count !== p.causas) {
            console.error(`${p.amfeNumber}: los contadores no quedaron`); process.exit(1);
        }
        console.log(`  ${p.amfeNumber}: OK — 0 modos de falla sin S/O/D, ${chk.operation_count} ops, ${chk.cause_count} causas`);
    }
});
