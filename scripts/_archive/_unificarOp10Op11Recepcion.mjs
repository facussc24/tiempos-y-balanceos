/**
 * _unificarOp10Op11Recepcion.mjs — la recepcion y la inspeccion de materia prima son UNA
 * operacion, como dice el flujograma.
 *
 * LA DECISION (Fak, 24/08/2026): *"si, para mi va todo en la 10; si el flujograma tiene 10 y
 * 11, en todo caso las unificamos en el AMFE"*. El flujograma NO tiene 11:
 *
 *   `tools/flowchart/data/152-APOYACABEZAS.json` -> unico paso de la decena:
 *       stepId "10", type "op-ins", description "RECEPCION E INSPECCION DE MATERIA PRIMA"
 *
 * `type: "op-ins"` es operacion + inspeccion: las dos cosas en un paso. Y coincide con el
 * resto de los documentos:
 *   - HO-969 y HO-970: una sola pestaña `10`, llamada "Recepcion e inspeccion de Materia Prima".
 *     NO existe pestaña 11.
 *   - Plan de Control de las tres piezas: una sola `Operacion 10 Recepcion`.
 *
 * El unico documento que las separa es el AMFE, y esa OP11 entro desde el PFD preliminar —
 * lo dice su propia metadata: `_addedFromPfd: "P-APO-001/PRE 04/05/2026"`, `_status: "TBD"`.
 * Como **la numeracion la manda el flujograma** (regla `no-pfd-no-ho.md`), sobra.
 *
 * QUE HACE
 *  1. Saca la OP11 de los dos traseros. Esta VACIA (`workElements: []`, `operationFunction: ""`)
 *     — el script aborta si encontrara aunque sea una causa, para no perder contenido.
 *  2. Renombra la OP10 de las TRES piezas a "RECEPCION E INSPECCION DE MATERIA PRIMA", que es
 *     como la llaman el flujograma y la HO. Al quedar la inspeccion adentro, el nombre lo tiene
 *     que decir.
 *
 * Su OP10 ya tiene 14 work elements y 66 causas de control de materia prima por componente
 * (vinilos, telas, hilos, poliol, isocianato, varilla consignada), asi que llenar la OP11
 * hubiera duplicado todo eso.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply: APLICAR } = parseSafeArgs();

const TODOS = ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const CON_OP11 = ['AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const NOMBRE_10 = 'RECEPCION E INSPECCION DE MATERIA PRIMA';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

const { data: rows, error } = await sb.from('amfe_documents')
    .select('id, amfe_number, project_name, data').in('amfe_number', TODOS);
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== 3) { console.error(`Esperaba 3 AMFE, vinieron ${rows.length}`); process.exit(1); }

const contarCausas = d => (d.operations ?? []).flatMap(o => o.workElements ?? [])
    .flatMap(w => w.functions ?? []).flatMap(f => f.failures ?? []).flatMap(fm => fm.causes ?? []).length;

const plan = [], pendientes = [];

for (const row of rows.sort((a, b) => a.amfe_number.localeCompare(b.amfe_number))) {
    const antes = typeof row.data === 'string' ? JSON.parse(row.data) : structuredClone(row.data);
    const doc = JSON.parse(JSON.stringify(antes));
    const cambios = [];

    // 1. Renombrar la OP10 (las tres)
    const op10 = (doc.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === '10');
    if (!op10) { console.error(`${row.amfe_number}: no existe la OP10 — abortar`); process.exit(1); }
    if (String(op10.name ?? '') !== NOMBRE_10) {
        cambios.push(`OP10: "${op10.name}" -> "${NOMBRE_10}"`);
        op10.name = NOMBRE_10;
        op10.operationName = NOMBRE_10;   // alias, van juntos o el export lee el vacio
    }

    // 2. Sacar la OP11 (solo los traseros), con guarda de contenido
    if (CON_OP11.includes(row.amfe_number)) {
        const i = (doc.operations ?? []).findIndex(o => String(o.opNumber ?? o.operationNumber) === '11');
        if (i === -1) {
            console.log(`\n  ${row.amfe_number}: la OP11 ya no esta.`);
        } else {
            const op11 = doc.operations[i];
            const causas = (op11.workElements ?? []).flatMap(w => w.functions ?? [])
                .flatMap(f => f.failures ?? []).flatMap(fm => fm.causes ?? []).length;
            if (causas > 0 || (op11.workElements ?? []).length > 0) {
                console.error(`${row.amfe_number} OP11 tiene contenido (${(op11.workElements ?? []).length} WE, ${causas} causas) — ABORTAR, no se borra nada con contenido`);
                process.exit(1);
            }
            cambios.push(`OP11 "${op11.name}": SE SACA (vacia; entro desde ${op11._addedFromPfd ?? 'el PFD'})`);
            doc.operations.splice(i, 1);
        }
    }

    if (!cambios.length) { console.log(`\n  ${row.amfe_number}: nada que cambiar.`); continue; }

    // Invariante: no se pierde ni una causa (la OP11 estaba vacia).
    if (contarCausas(antes) !== contarCausas(doc)) {
        console.error(`${row.amfe_number}: cambio la cantidad de causas — ABORTAR`); process.exit(1);
    }

    console.log(`\n  ${row.amfe_number}`);
    cambios.forEach(c => console.log(`     ${c}`));
    console.log(`     operaciones: ${antes.operations.length} -> ${doc.operations.length}   ·   causas: ${contarCausas(doc)} (sin cambio)`);

    plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc });
    pendientes.push({ id: row.id, amfeNumber: row.amfe_number, data: JSON.stringify(doc), ops: doc.operations.length });
}

if (!plan.length) { console.log('\n  Nada que cambiar.'); process.exit(0); }

await runWithValidation(plan, APLICAR, async () => {
    for (const p of pendientes) {
        const { error: e } = await sb.from('amfe_documents')
            .update({ data: p.data, updated_at: new Date().toISOString() }).eq('id', p.id);
        if (e) { console.error(`${p.amfeNumber}: ${e.message}`); process.exit(1); }
        const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', p.id).single();
        const live = typeof chk.data === 'string' ? JSON.parse(chk.data) : chk.data;
        const hay11 = (live.operations ?? []).some(o => String(o.opNumber ?? o.operationNumber) === '11');
        const op10 = (live.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === '10');
        if (hay11 && CON_OP11.includes(p.amfeNumber)) { console.error(`${p.amfeNumber}: la OP11 sigue ahi`); process.exit(1); }
        if (op10.name !== NOMBRE_10) { console.error(`${p.amfeNumber}: la OP10 quedo "${op10.name}"`); process.exit(1); }
        console.log(`  ${p.amfeNumber}: OK — ${live.operations.length} operaciones, OP10 "${op10.name}"`);
    }
});
