/**
 * _corregirTopRoll162.mjs — limpia el AMFE 162 TOP ROLL y sincroniza la S legacy en todos.
 *
 * Origen: el 21/08/2026 Fak abrio el PDF del 162 y desconfio de tres cosas de la OP5 —
 * una CC con S=10 que quedaba en AP bajo, un campo vacio al lado, y dos filas repetidas.
 * Las tres eran el mismo resto: la OP5 se detallo por material (7 WE nuevos, uno por
 * insumo) pero quedo viva la fila generica "Material recibido" de antes, sin funcion, con
 * sus fallas ya cubiertas por las nuevas, y con la CC de flamabilidad encima. La fila real
 * del TPO — la que tiene el ensayo en camara MC184 — se quedo sin CC. Es el patron que
 * amfe.md §17.5 manda cortar al detallar una OP.
 *
 * QUE HACE
 *
 *   A. En LOS 17 AMFE: AP = calculateAP(S del MODO DE FALLA, O y D de la causa).
 *      La severidad es la del efecto y la comparten todas las causas de ese modo de falla:
 *      es la que edita la UI (una sola celda con rowSpan sobre las filas de causa) y la que
 *      imprime el export; `AmfeCause` ni tiene el campo. Pero 145 causas arrastran una S
 *      propia de una importacion vieja, y recalcular el AP con esa da otro numero.
 *      Medido el 21/08/2026: 84 causas con el AP mal en 9 documentos, y 64 de ellas
 *      SUBdeclarando riesgo. Las 9 del AMFE 162 se rompieron ese mismo dia a las 11:54.
 *      Si al recalcular sube a H y no hay accion, se pone el placeholder que Fak autorizo.
 *
 *   B. Solo en AMFE-TR-PAT:
 *      1. Se borra el WE generico "Material recibido" de la OP5 y la CC de flamabilidad
 *         pasa a la falla real del TPO Bilaminate. Decision de Fak del 21/08/2026 — las
 *         CC/SC las asigna el (core-prohibiciones §2), aca solo se ejecuta lo que eligio.
 *      2. Se sacan los 2 WE Man de la OP5 que no tienen ningun modo de falla: hoy salen
 *         como filas en blanco en el documento que ve el cliente, y no hay de donde sacar
 *         sus fallas sin inventarlas.
 *      3. Se saca el WE "Mezcla de poliol e isocianato" de la OP10: es material de
 *         poliuretano dentro de una operacion de inyeccion de plastico, y ademas no tiene
 *         funcion. El Top Roll no recibe PU en la OP5.
 *      4. Roles Man a los 4 canonicos (amfe.md §9) y fusion de los homonimos que quedan.
 *      5. Modos de falla repetidos en la inyectora: 7 pares con las mismas causas.
 *      6. Un control con vocabulario Claude ("...para asegurar que...", amfe.md §11).
 *
 * LO QUE NO TOCA, a proposito:
 *   - El alcance de la TL 1010. Hoy la falla de flamabilidad esta solo en el TPO; si
 *     corresponde tambien a la resina PC/ABS y a los dos adhesivos lo define Fak o Carlos.
 *     Fak, 21/08/2026: *"si no sabes no lo hagas"*. Queda como pregunta abierta.
 *   - header.partNumber ("N 216 / N 256 / N 285 / N 315") vs applicableParts ("N 216,
 *     N 256"). Se contradicen, pero cual de los dos es el bueno es dato de proyecto.
 *   - El log de revisiones. Esto corrige errores nuestros y eso se arregla en silencio
 *     (hay gate en el export que bloquea si el log confiesa como se redacto el documento).
 *
 * Correr:  node scripts/_corregirTopRoll162.mjs          (dry-run)
 *          node scripts/_corregirTopRoll162.mjs --apply
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';
import { calculateAP } from './_lib/amfeIo.mjs';

const { apply: APLICAR } = parseSafeArgs();
const OBJETIVO = 'AMFE-TR-PAT';
const PLACEHOLDER = 'Pendiente definicion equipo APQP';
const RANGO = { L: 0, M: 1, H: 2 };

/** Roles Man canonicos (amfe.md §9): el mapa de lo que se encontro a lo que corresponde. */
const ROLES_CANONICOS = {
    'lider de equipo': 'Líder de Producción',
    'operador de inyectora': 'Operador de Producción',
    'operador de inyectora (autocontrol)': 'Operador de Producción',
};

/** Pares de modos de falla repetidos en la inyectora: se queda el primero, se va el segundo. */
const DUPLICADOS_OP10 = [
    ['Llenado Incompleto de Pieza', 'Pieza incompleta'],
    ['Rebaba Excesiva / Exceso de Material', 'Rebarbas en pieza inyectada'],
    ['Rebaba Excesiva / Exceso de Material', 'Rebabas'],
    ['Quemados en pieza inyectada', 'Quemaduras'],
    ['Hundimientos (hundimientos) en pieza inyectada', 'Hundimientos'],
    ['Dimensional NOK en pieza inyectada', 'Dimensional NOK'],
    ['Peso NOK en pieza inyectada', 'Peso NOK'],
    ['Rayas o marcas superficiales', 'Piezas con rayas/marcas'],
];

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const opId = (op) => String(op.opNumber ?? op.operationNumber ?? '?');
const fallasDe = (we) => (we.functions ?? []).flatMap(fn => fn.failures ?? []);
const contarFallas = (we) => fallasDe(we).length;
/** Firma de una falla por sus causas, para no borrar un duplicado que en realidad difiere. */
const firmaCausas = (f) => (f.causes ?? []).map(c => norm(c.cause ?? c.description)).sort().join('|');

// ─── conexion ───────────────────────────────────────────────────────────────
const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

const { data: rows, error } = await sb.from('amfe_documents').select('id, amfe_number, project_name, data');
if (error) { console.error(error.message); process.exit(1); }

const plan = [], pendientes = [], avisos = [];
let apTotal = 0, subTotal = 0;

for (const row of rows.sort((a, b) => String(a.amfe_number).localeCompare(String(b.amfe_number)))) {
    const before = JSON.parse(row.data);
    const doc = JSON.parse(row.data);
    if (!Array.isArray(doc.operations)) continue;
    const cambios = [];

    // ── A. AP recalculado con la S del modo de falla, en todos los AMFE ──────
    let ap = 0, sub = 0, ph = 0;
    for (const op of doc.operations)
        for (const we of op.workElements ?? [])
            for (const fn of we.functions ?? [])
                for (const f of fn.failures ?? [])
                    for (const c of f.causes ?? []) {
                        const s = Number(f.severity) || Number(c.severity);
                        const o = Number(c.occurrence), d = Number(c.detection);
                        if (!(s && o && d)) continue;
                        const esperado = calculateAP(s, o, d);
                        const declarado = String(c.ap ?? c.actionPriority ?? '').trim().toUpperCase();
                        if (!esperado || !declarado || declarado === esperado) continue;
                        if (RANGO[esperado] > RANGO[declarado]) sub++;
                        c.ap = esperado; c.actionPriority = esperado; ap++;
                        // Un AP=H sin accion es bloqueo IATF (amfe.md §4).
                        if (esperado === 'H' && !String(c.optimizationAction ?? '').trim()) {
                            c.optimizationAction = PLACEHOLDER; ph++;
                        }
                    }
    if (ap) {
        cambios.push(`AP recalculado con la S del modo de falla en ${ap} causas (${sub} estaban SUBdeclarando riesgo${ph ? `, ${ph} con placeholder por pasar a H` : ''})`);
        apTotal += ap; subTotal += sub;
    }

    // ── B. solo el TOP ROLL ──────────────────────────────────────────────────
    if (row.amfe_number === OBJETIVO) {
        const op5 = doc.operations.find(o => opId(o) === '5');
        const op10 = doc.operations.find(o => opId(o) === '10');

        // B1. la CC de flamabilidad pasa a la fila real del TPO, y se borra la generica
        if (op5) {
            const tpo = (op5.workElements ?? []).find(w => /TPO Bilaminate/i.test(w.name ?? ''));
            const flam = tpo && fallasDe(tpo).find(f => /flamabilidad/i.test(f.description ?? ''));
            const generico = (op5.workElements ?? []).find(w => norm(w.name) === 'material recibido');

            if (!tpo || !flam) {
                avisos.push('OP5: no encontre la falla de flamabilidad del TPO — NO se borro la fila generica');
            } else if (generico) {
                for (const c of flam.causes ?? []) c.specialChar = 'CC';
                op5.workElements = op5.workElements.filter(w => w !== generico);
                cambios.push(`OP5: CC de flamabilidad -> "${flam.description}" (WE ${tpo.name}); se borra el WE generico "Material recibido" con sus ${contarFallas(generico)} fallas`);
            }
        }

        // B2. WE Man de la OP5 sin ningun modo de falla (salen como filas en blanco)
        if (op5) {
            const vacios = (op5.workElements ?? []).filter(w => w.type === 'Man' && contarFallas(w) === 0);
            if (vacios.length) {
                op5.workElements = op5.workElements.filter(w => !vacios.includes(w));
                cambios.push(`OP5: se sacan ${vacios.length} WE Man sin fallas (${vacios.map(w => w.name).join(', ')})`);
            }
        }

        // B3. material de poliuretano dentro de la inyeccion de plastico
        if (op10) {
            const pu = (op10.workElements ?? []).find(w => /poliol e isocianato/i.test(w.name ?? ''));
            if (pu) {
                op10.workElements = op10.workElements.filter(w => w !== pu);
                cambios.push(`OP10: se saca el WE "${pu.name}" (${contarFallas(pu)} fallas) — es PU en una OP de inyeccion de plastico`);
            }
        }

        // B4. roles Man canonicos + fusion de homonimos
        for (const op of doc.operations) {
            for (const we of op.workElements ?? []) {
                if (we.type !== 'Man') continue;
                const canon = ROLES_CANONICOS[norm(we.name)];
                if (canon && we.name !== canon) {
                    cambios.push(`OP${opId(op)}: rol "${we.name}" -> "${canon}"`);
                    we.name = canon;
                }
            }
            // homonimos: el primero se queda con las funciones del resto, sin repetir fallas
            const porNombre = new Map();
            for (const we of op.workElements ?? []) {
                if (we.type !== 'Man') continue;
                const k = norm(we.name);
                if (!porNombre.has(k)) { porNombre.set(k, we); continue; }
                const destino = porNombre.get(k);
                const yaEstan = new Set(fallasDe(destino).map(f => norm(f.description)));
                let movidas = 0, descartadas = 0;
                for (const fn of we.functions ?? []) {
                    const nuevas = (fn.failures ?? []).filter(f => {
                        if (yaEstan.has(norm(f.description))) { descartadas++; return false; }
                        yaEstan.add(norm(f.description)); movidas++; return true;
                    });
                    if (nuevas.length) (destino.functions ??= []).push({ ...fn, failures: nuevas });
                }
                op.workElements = op.workElements.filter(w => w !== we);
                cambios.push(`OP${opId(op)}: se fusiona el WE Man homonimo "${we.name}" (${movidas} fallas movidas, ${descartadas} ya estaban)`);
            }
        }

        // B5. modos de falla repetidos en la inyectora
        if (op10) {
            const iny = (op10.workElements ?? []).find(w => /inyectora de pl/i.test(w.name ?? ''));
            for (const [quedaTxt, vaTxt] of DUPLICADOS_OP10) {
                if (!iny) break;
                const queda = fallasDe(iny).find(f => norm(f.description) === norm(quedaTxt));
                const va = fallasDe(iny).find(f => norm(f.description) === norm(vaTxt));
                if (!queda || !va) continue;
                if (firmaCausas(queda) !== firmaCausas(va)) {
                    avisos.push(`OP10: "${vaTxt}" NO se borro — sus causas no son las mismas que las de "${quedaTxt}"`);
                    continue;
                }
                for (const fn of iny.functions ?? []) fn.failures = (fn.failures ?? []).filter(f => f !== va);
                cambios.push(`OP10: se borra el modo de falla repetido "${vaTxt}" (mismas causas que "${quedaTxt}")`);
            }
            // el typo viaja dentro del texto del modo de falla que se queda
            const hund = iny && fallasDe(iny).find(f => /Hundimientos \(hundimientos\)/i.test(f.description ?? ''));
            if (hund) {
                const antes = hund.description;
                hund.description = 'Hundimientos en pieza inyectada';
                cambios.push(`OP10: "${antes}" -> "${hund.description}"`);
            }
        }

        // B5b. duplicados exactos dentro de un mismo WE: mismo texto Y mismas causas.
        // Los pares de B5 son el caso dificil (texto distinto, causas iguales); este es el
        // facil, y estaba en la OP5 — "Falta de documentacion o trazabilidad" dos veces
        // seguidas en el WE del P-14, identica palabra por palabra.
        for (const op of doc.operations)
            for (const we of op.workElements ?? []) {
                const vistas = new Set();
                for (const fn of we.functions ?? []) {
                    fn.failures = (fn.failures ?? []).filter(f => {
                        const k = `${norm(f.description)}##${firmaCausas(f)}`;
                        if (!vistas.has(k)) { vistas.add(k); return true; }
                        cambios.push(`OP${opId(op)}: se borra el modo de falla duplicado exacto "${f.description}" en el WE "${we.name}"`);
                        return false;
                    });
                }
            }

        // B6. vocabulario Claude en un control
        for (const op of doc.operations)
            for (const we of op.workElements ?? [])
                for (const fn of we.functions ?? [])
                    for (const f of fn.failures ?? [])
                        for (const c of f.causes ?? [])
                            for (const k of ['preventionControl', 'detectionControl']) {
                                if (!/para asegurar que/i.test(String(c[k] ?? ''))) continue;
                                const antes = c[k];
                                c[k] = 'Set up de arranque de turno';
                                cambios.push(`OP${opId(op)}: ${k} "${antes}" -> "${c[k]}"`);
                            }
    }

    if (!cambios.length) continue;
    console.log(`\n  ${row.amfe_number}:`);
    cambios.forEach(c => console.log(`     ${c}`));

    const after = doc;
    plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before, after });
    pendientes.push({ id: row.id, amfeNumber: row.amfe_number, data: JSON.stringify(after) });
}

if (avisos.length) {
    console.log('\n  ── NO se aplico (revisar a mano) ──');
    avisos.forEach(a => console.log(`     ${a}`));
}
console.log(`\n=== ${plan.length} documentos | ${apTotal} AP recalculados, ${subTotal} de ellos subdeclaraban riesgo ===`);

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
