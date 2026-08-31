/**
 * _podarMarcadoApoyacabezas.mjs — el AMFE de los apoyacabezas declaraba SIETE marcados
 * distintos en la pieza y la planta pega UNA etiqueta.
 *
 * QUE HABIA
 * El WE "Metodo: Marcado e identificacion de pieza" de la OP80 (embalaje y etiquetado) de
 * los tres apoyacabezas tenia 7 funciones, una por norma: VW 10500 (identificacion),
 * VW 10514-C10 (logotipo), VW 10550 (pais de origen), VW 10540 (codigo fabricante),
 * DIN 1451-4-3 (tipografia), VW 10560 (fecha) y VDA 260 (codigo de material). Cada una con
 * su modo de falla y su causa.
 *
 * QUE DICEN LOS DOCUMENTOS DE LA PLANTA
 * - Instruccion de proceso HO-968, paso 7 del embalaje: *"Colocar pieza dentro de una bolsa
 *   de nylon y cerrarla etiquetando con la etiqueta autoadhesiva de trazabilidad 50x20mm"*.
 * - Ficha de embalaje GE-103 Rev.C (17/06/2026): *"Pegar 1 etiqueta de trazabilidad
 *   (ET-SATO-50X20) en cada APC"* + 1 etiqueta de ilustracion por cajon.
 * Ninguno de los dos pide logotipo, pais de origen, codigo de fabricante, tipografia, fecha
 * ni codigo de material EN LA PIEZA. Una de las filas ademas declaraba como control un
 * "Lector codigo barras 100%" que no aparece en ningun documento de ese puesto.
 *
 * Las siete normas VW existen en `PPAP CLIENTES\VW\VW427-1LA_K-PATAGONIA\Normas`: lo que no
 * esta respaldado es que Barack marque y controle las siete.
 *
 * QUE HACE ESTE SCRIPT
 * Deja la funcion de identificacion (VW 10500), que es la etiqueta que la HO manda pegar, y
 * saca las otras SEIS con sus modos de falla y causas. Decision de Fak, 31/08/2026:
 * *"suena a cosas demasiado complejas que no creo que controlemos nunca... capaz al pedo
 * ponerlas"*, verificado despues contra la HO y la ficha de embalaje.
 *
 * Si aparece la especificacion de la etiqueta ET-SATO-50X20 y dice que lleva pais de origen
 * o codigo de material, esas filas se vuelven a agregar CON esa fuente.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';
import { syncLegacyFmFields } from './_lib/amfeIo.mjs';

const { apply: APLICAR } = parseSafeArgs();

const AFECTADOS = ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const OP = '80';
const WE = /marcado e identificacion/i;

// La que SE QUEDA: es la etiqueta de trazabilidad que la HO manda pegar.
const SE_QUEDA = /VW\s*10500/i;

// Las que se van, por si el texto de la funcion cambia de forma: se identifican por la norma.
const SE_VAN = [/VW\s*10514/i, /VW\s*10550/i, /VW\s*10540/i, /DIN\s*1451/i, /VW\s*10560/i, /VDA\s*260/i];

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
    const we = (op.workElements ?? []).find(w => WE.test(String(w.name ?? '')));
    if (!we) { console.log(`\n  ${row.amfe_number}: ya no tiene el WE de marcado.`); continue; }

    const total = (we.functions ?? []).length;
    const quedan = [], sacadas = [];
    for (const fn of (we.functions ?? [])) {
        const txt = `${fn.description ?? ''} ${fn.functionDescription ?? ''}`;
        const esLaQueQueda = SE_QUEDA.test(txt);
        const esDeLasQueSeVan = SE_VAN.some(re => re.test(txt));
        if (esLaQueQueda) { quedan.push(fn); continue; }
        if (esDeLasQueSeVan) { sacadas.push(fn); continue; }
        // Una funcion que no reconozco NO se toca: se queda y se avisa.
        console.log(`  ${row.amfe_number}: funcion no reconocida, se DEJA -> "${txt.trim().slice(0, 80)}"`);
        quedan.push(fn);
    }

    if (!sacadas.length) { console.log(`\n  ${row.amfe_number}: ya esta podado.`); continue; }
    if (!quedan.length) {
        console.error(`${row.amfe_number}: el podado dejaria el WE VACIO — abortar`);
        process.exit(1);
    }

    console.log(`\n  ${row.amfe_number} OP${OP} · WE "${we.name}"  (${total} funciones -> ${quedan.length})`);
    console.log(`     SE QUEDA:  "${quedan.map(f => f.description).join('" | "')}"`);
    for (const fn of sacadas) {
        const nFm = (fn.failures ?? []).length;
        const nC = (fn.failures ?? []).reduce((s, fm) => s + (fm.causes ?? []).length, 0);
        console.log(`     se saca:   "${fn.description}"  (${nFm} modo(s) de falla, ${nC} causa(s))`);
    }

    we.functions = quedan;
    syncLegacyFmFields(doc);

    plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc });
    pendientes.push({ id: row.id, amfeNumber: row.amfe_number, data: JSON.stringify(doc), quedan: quedan.length });
}

if (!plan.length) { console.log('\n  Nada que podar.'); process.exit(0); }

await runWithValidation(plan, APLICAR, async () => {
    for (const p of pendientes) {
        const { error: e } = await sb.from('amfe_documents')
            .update({ data: p.data, updated_at: new Date().toISOString() }).eq('id', p.id);
        if (e) { console.error(`${p.amfeNumber}: ${e.message}`); process.exit(1); }
        const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', p.id).single();
        const live = typeof chk.data === 'string' ? JSON.parse(chk.data) : chk.data;
        const op = (live.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);
        const we = (op.workElements ?? []).find(w => WE.test(String(w.name ?? '')));
        const n = (we?.functions ?? []).length;
        if (n !== p.quedan) { console.error(`${p.amfeNumber}: quedaron ${n} funciones y esperaba ${p.quedan}`); process.exit(1); }
        console.log(`  ${p.amfeNumber}: OK — el WE de marcado quedo con ${n} funcion`);
    }
});
