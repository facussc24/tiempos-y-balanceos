/**
 * _alinearOp60ControlFinal.mjs — el control final del apoyacabezas trasero lateral queda
 * como el de sus dos hermanos.
 *
 * QUE PASA
 * La OP60 CONTROL FINAL DE CALIDAD es la MISMA operacion en las tres piezas: la HO-968, la
 * HO-969 y la HO-970 tienen la pestaña `60` con texto identico (7 chequeos: costura alineada,
 * arrugas/pliegues, agujeros y filtrado de espuma, puntadas salteadas e hilos flojos en la
 * zona de atraque, hilo sobrante, rasgaduras, y etiqueta de trazabilidad 50x20), el mismo
 * ciclo de control (`Aspecto con criterio de biblia de defecto y pieza patron` visual, y
 * `Control en calibre DIM` contra calibre, responsable `Insp.`, registro `RC`) y la misma nota
 * de liberacion de primera pieza contra calibre.
 *
 * Pero en el AMFE:
 *   - 151 y 153 tienen la OP60 con dos work elements identicos entre si — `Mesa de control
 *     final` (Machine) e `Inspector de Calidad` (Man) — y el modo de falla "1- Pieza con
 *     rebaba visible" con su causa.
 *   - 155 tiene OTRA cosa: un solo work element `Metodo: Inspeccion visual con plantilla de
 *     referencia` (Method) y CERO modos de falla.
 *
 * QUE HACE
 * Le copia al 155 el contenido de la OP60 de sus hermanos (ids nuevos), y de paso completa el
 * `operationFunction` del 153 y el 155, que estaban vacios y el 151 si lo tiene.
 *
 * NO SE ESCRIBE NADA NUEVO: es propagacion entre hermanos de la MISMA operacion, con la misma
 * HO detras. Fak, 24/08: *"mientras esten los 3 alineados bien estamos bien, no vaya a ser que
 * uno tenga el reproceso y los otros 2 no"*.
 *
 * El work element que hoy tiene el 155 (`Metodo: Inspeccion visual...`) se REEMPLAZA: no
 * aporta ningun modo de falla, su nombre arranca con la etiqueta generica "Metodo:" que la
 * regla amfe.md §7 desaconseja, y dejarlo ademas de los dos nuevos rompe la alineacion que es
 * justamente el objetivo.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply: APLICAR } = parseSafeArgs();

const FUENTES = ['AMFE-HF-PAT', 'AMFE-HRC-PAT'];   // tienen que ser identicas entre si
const DESTINO = 'AMFE-HRO-PAT';
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
    .select('id, amfe_number, project_name, data').in('amfe_number', [...FUENTES, DESTINO]);
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== 3) { console.error(`Esperaba 3 AMFE, vinieron ${rows.length}`); process.exit(1); }

const parse = r => (typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
const buscarOp = d => (d.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);
const sinIds = o => JSON.stringify(o, (k, v) => (k === 'id' ? undefined : v));

// Gate 1: las dos fuentes tienen que decir exactamente lo mismo.
const ops = FUENTES.map(n => ({ n, op: buscarOp(parse(rows.find(r => r.amfe_number === n))) }));
for (const { n, op } of ops) if (!op || !(op.workElements ?? []).length) {
    console.error(`${n} OP${OP}: sin contenido — abortar`); process.exit(1);
}
if (sinIds(ops[0].op.workElements) !== sinIds(ops[1].op.workElements)) {
    console.error(`${FUENTES.join(' y ')} NO coinciden en la OP${OP} — abortar, lo define Fak`);
    process.exit(1);
}
const fuente = ops[0].op;
const conIdsNuevos = n => JSON.parse(JSON.stringify(n), (k, v) => (k === 'id' ? randomUUID() : v));

const plan = [], pendientes = [];

for (const row of rows.sort((a, b) => a.amfe_number.localeCompare(b.amfe_number))) {
    const antes = parse(row);
    const doc = JSON.parse(JSON.stringify(antes));
    const op = buscarOp(doc);
    const cambios = [];

    // El operationFunction vacio se completa desde el hermano que si lo tiene.
    if (!String(op.operationFunction ?? '').trim() && String(fuente.operationFunction ?? '').trim()) {
        cambios.push(`operationFunction: (vacia) -> "${fuente.operationFunction}"`);
        op.operationFunction = fuente.operationFunction;
    }

    if (row.amfe_number === DESTINO) {
        const viejos = (op.workElements ?? []).map(w => `[${w.type}] ${w.name}`);
        const causasViejas = (op.workElements ?? []).flatMap(w => w.functions ?? [])
            .flatMap(f => f.failures ?? []).flatMap(fm => fm.causes ?? []).length;
        if (causasViejas > 0) {
            console.error(`${DESTINO} OP${OP} ya tiene ${causasViejas} causas — abortar, no piso contenido real`);
            process.exit(1);
        }
        op.workElements = conIdsNuevos(fuente.workElements);
        const nuevos = op.workElements.map(w => `[${w.type}] ${w.name}`);
        cambios.push(`work elements: ${viejos.join(' + ') || '(ninguno)'}\n                    -> ${nuevos.join(' + ')}`);
    }

    if (!cambios.length) { console.log(`\n  ${row.amfe_number}: ya esta alineado.`); continue; }

    console.log(`\n  ${row.amfe_number} OP${OP} "${op.name}"`);
    cambios.forEach(c => console.log(`     ${c}`));
    if (row.amfe_number === DESTINO) {
        for (const we of op.workElements) for (const fn of (we.functions ?? [])) for (const fm of (fn.failures ?? [])) {
            console.log(`     FM "${fm.description}" (S=${fm.severity})`);
            for (const c of (fm.causes ?? [])) console.log(`        causa: ${c.cause}  [O=${c.occurrence} D=${c.detection} AP=${c.ap}]`);
        }
    }

    plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc });
    pendientes.push({ id: row.id, amfeNumber: row.amfe_number, data: JSON.stringify(doc) });
}

if (!plan.length) { console.log('\n  Nada que cambiar.'); process.exit(0); }

await runWithValidation(plan, APLICAR, async () => {
    for (const p of pendientes) {
        const { error: e } = await sb.from('amfe_documents')
            .update({ data: p.data, updated_at: new Date().toISOString() }).eq('id', p.id);
        if (e) { console.error(`${p.amfeNumber}: ${e.message}`); process.exit(1); }
        const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', p.id).single();
        const live = typeof chk.data === 'string' ? JSON.parse(chk.data) : chk.data;
        const op = buscarOp(live);
        const n = (op.workElements ?? []).flatMap(w => w.functions ?? [])
            .flatMap(f => f.failures ?? []).flatMap(fm => fm.causes ?? []).length;
        console.log(`  ${p.amfeNumber}: OK — OP${OP} con ${(op.workElements ?? []).length} WE y ${n} causas`);
    }
});
