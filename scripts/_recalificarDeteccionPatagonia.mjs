/**
 * _recalificarDeteccionPatagonia.mjs — la columna D de los 8 AMFE de Patagonia estaba
 * calificada por debajo del piso que fija la norma.
 *
 * LA NORMA
 * Tabla P3 (PFMEA DETECTION) del AIAG-VDA 1st ed., paginas 119-120 del PDF original,
 * transcrita en `amfe.md` §13:
 *   D=8  deteccion AGUAS ABAJO por medios visuales, tactiles o auditivos — "the method
 *        relies on a human for verification and disposition"
 *   D=7  lo mismo EN LA ESTACION — "the method relies on a human"
 *   D=6  exige galga (variable o pasa/no pasa), capacidad todavia no probada
 *   D<=5 ademas exige R&R confirmado
 * O sea: **un control que depende de una persona no puede bajar de 7.** Nosotros veniamos
 * poniendo 3, 4, 5 y 6 a inspecciones visuales. Detectado por /auditoria-cliente el
 * 24/08/2026 sobre el AMFE 172 y confirmado leyendo el manual original, no el destilado.
 *
 * QUE TOCA
 * Solo las causas que marca el check `DETECTION_HUMANA_OPTIMISTA` de
 * `scripts/_lib/amfeValidator.mjs` — control humano, sin instrumento nombrado, con D entre
 * 1 y 6. El criterio de seleccion es el DEL CHECK, no una regla paralela escrita aca.
 *
 * A que valor va cada una:
 *   D=8  si el unico control declarado detecta aguas abajo de donde nace la falla
 *        ("antes de embalar" en una operacion que no es la de embalaje).
 *   D=7  todo el resto. Es el minimo que la norma admite para un control humano: el
 *        cambio mas chico que deja el documento bien.
 * Un control que dice "autocontrol ... + control por Calidad por lote" va a 7, no a 8:
 * tiene un control humano EN la estacion, y la D la fija el mejor control disponible.
 *
 * QUE NO TOCA, Y REPORTA
 * Las causas cuyo control nombra un instrumento o un control de maquina (monitoreo de
 * presion de la inyectora, panel de presion, calibre, regla, lector de codigo de barras).
 * Ahi la D baja puede ser correcta y la calificacion es dato del equipo APQP. Salen
 * listadas al final para que las mire una persona.
 *
 * El AP se recalcula con `calculateAP()` y nunca a mano. La causa que quede en AP=H sin
 * accion recibe el placeholder autorizado por `amfe.md` §4. S y O no se tocan.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';
import { calculateAP, syncLegacyFmFields } from './_lib/amfeIo.mjs';
import { validateAmfeDoc, esDeteccionHumanaOptimista } from './_lib/amfeValidator.mjs';

const { apply: APLICAR } = parseSafeArgs();

const PATAGONIA = {
    'VWA-PAT-IPPADS-001': '149', '150': '150', 'AMFE-HF-PAT': '151', 'AMFE-HRC-PAT': '153',
    'AMFE-HRO-PAT': '155', 'AMFE-INS-PAT': '158', 'AMFE-ARM-PAT': '161', 'AMFE-TR-PAT': '162',
};

/** Instrumento o control de maquina en el texto del control: no se toca, se reporta. */
const INSTRUMENTO = /monitoreo de presi|panel de presi|lector|c[oó]digo de barras|balanza|calibre|galga|torqu[ií]metro|dinamom|term[oó]metro|sensor|\bregla\b|comparador|micr[oó]metro/i;
/** Deteccion posterior a la operacion donde nace la falla. */
const AGUAS_ABAJO = /antes de embalar|control final|inspecci[oó]n final|control de salida|previo al despacho/i;
/** La operacion de embalaje: ahi "antes de embalar" es EN la estacion, no aguas abajo. */
const OP_EMBALAJE = '80';

const PLACEHOLDER = 'Pendiente definicion equipo APQP';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

const { data: rows, error } = await sb.from('amfe_documents')
    .select('id, amfe_number, project_name, data').in('amfe_number', Object.keys(PATAGONIA));
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== Object.keys(PATAGONIA).length) {
    console.error(`Esperaba ${Object.keys(PATAGONIA).length} AMFE, vinieron ${rows.length}`);
    process.exit(1);
}

const plan = [], pendientes = [], sinTocar = [];
let totA7 = 0, totA8 = 0, totPlaceholder = 0;

console.log('N°   | a D=7 | a D=8 | sin tocar | AP antes (H/M/L) | AP despues (H/M/L)');

for (const row of rows.sort((a, b) => PATAGONIA[a.amfe_number].localeCompare(PATAGONIA[b.amfe_number]))) {
    const nro = PATAGONIA[row.amfe_number];
    const antes = typeof row.data === 'string' ? JSON.parse(row.data) : structuredClone(row.data);
    const doc = JSON.parse(JSON.stringify(antes));

    let a7 = 0, a8 = 0, saltadas = 0, place = 0;
    const apAntes = { H: 0, M: 0, L: 0 }, apDespues = { H: 0, M: 0, L: 0 };

    for (const op of (doc.operations ?? [])) {
        const opNum = String(op.opNumber ?? op.operationNumber);
        for (const we of (op.workElements ?? [])) for (const fn of (we.functions ?? [])) {
            for (const fm of (fn.failures ?? [])) for (const c of (fm.causes ?? [])) {
                const apA = String(c.ap ?? c.actionPriority ?? '').toUpperCase();
                if (apA in apAntes) apAntes[apA]++;

                // Mismo predicado que usa el check: una sola definicion, en el validador.
                if (esDeteccionHumanaOptimista(c.detectionControl, c.detection)) {
                    const texto = String(c.detectionControl ?? '');
                    const d = Number(c.detection);
                    if (INSTRUMENTO.test(texto)) {
                        saltadas++;
                        sinTocar.push({ nro, op: opNum, d, motivo: 'instrumento', control: texto.slice(0, 110) });
                    } else {
                        const abajo = AGUAS_ABAJO.test(texto) && opNum !== OP_EMBALAJE;
                        const dNueva = abajo ? 8 : 7;
                        // Si con la D nueva la combinacion cae donde la Figura 3.5-3 dice
                        // "Error" (O=1 exige D=1), calculateAP devuelve vacio. Ahi NO se toca
                        // nada: hay que revisar O y D juntos, y eso es dato del equipo.
                        if (!calculateAP(Number(fm.severity), Number(c.occurrence), dNueva)) {
                            saltadas++;
                            sinTocar.push({ nro, op: opNum, d, motivo: `S=${fm.severity} O=${c.occurrence} D ${d}->${dNueva} cae en "Error" de la Figura 3.5-3`, control: texto.slice(0, 110) });
                        } else {
                            c.detection = dNueva;
                            if (abajo) a8++; else a7++;
                        }
                    }
                }

                const s = Number(fm.severity), o = Number(c.occurrence), dFinal = Number(c.detection);
                const apD = calculateAP(s, o, dFinal);
                if (apD) {
                    c.ap = apD;
                    c.actionPriority = apD;
                    if (apD === 'H' && !String(c.optimizationAction ?? '').trim()) {
                        c.optimizationAction = PLACEHOLDER;   // amfe.md §4, bloqueo IATF
                        place++;
                    }
                    apDespues[apD]++;
                }
            }
        }
    }

    totA7 += a7; totA8 += a8; totPlaceholder += place;
    console.log(`${nro.padEnd(5)}| ${String(a7).padStart(5)} | ${String(a8).padStart(5)} | ${String(saltadas).padStart(9)} | ${apAntes.H}/${apAntes.M}/${apAntes.L}`.padEnd(62)
        + `| ${apDespues.H}/${apDespues.M}/${apDespues.L}   (+${place} placeholder)`);

    if (!a7 && !a8) continue;

    syncLegacyFmFields(doc);
    plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc });
    pendientes.push({ id: row.id, amfeNumber: row.amfe_number, nro, data: JSON.stringify(doc) });
}

console.log(`\nTOTAL: ${totA7} causas a D=7 · ${totA8} a D=8 · ${sinTocar.length} sin tocar · ${totPlaceholder} placeholders`);

if (sinTocar.length) {
    console.log('\n=== NO SE TOCARON. La calificacion de estas la define el equipo APQP, no este script.');
    const conInstrumento = sinTocar.filter(s => s.motivo === 'instrumento');
    const error353 = sinTocar.filter(s => s.motivo !== 'instrumento');

    console.log(`\n  A) el control nombra instrumento o control de maquina (${conInstrumento.length}):`);
    const porControl = new Map();
    for (const s of conInstrumento) {
        if (!porControl.has(s.control)) porControl.set(s.control, { n: 0, ds: new Set(), amfes: new Set() });
        const e = porControl.get(s.control); e.n++; e.ds.add(s.d); e.amfes.add(s.nro);
    }
    for (const [ctrl, e] of [...porControl].sort((a, b) => b[1].n - a[1].n)) {
        console.log(`     [${String(e.n).padStart(2)}] D=${[...e.ds].sort().join(',')}  AMFE ${[...e.amfes].sort().join(',')}`);
        console.log(`          "${ctrl}"`);
    }

    if (error353.length) {
        console.log(`\n  B) subir la D las mandaria a la casilla "Error" de la Figura 3.5-3 (${error353.length}).`);
        console.log('     Hay que mirar la O y la D juntas — con O=1 la norma exige D=1:');
        for (const s of error353) console.log(`     AMFE ${s.nro} OP${s.op} · ${s.motivo}\n          "${s.control}"`);
    }
}

if (!plan.length) { console.log('\n  Nada que recalificar.'); process.exit(0); }

await runWithValidation(plan, APLICAR, async () => {
    for (const p of pendientes) {
        const { error: e } = await sb.from('amfe_documents')
            .update({ data: p.data, updated_at: new Date().toISOString() }).eq('id', p.id);
        if (e) { console.error(`${p.amfeNumber}: ${e.message}`); process.exit(1); }
        const { data: chk } = await sb.from('amfe_documents').select('data, project_name').eq('id', p.id).single();
        const live = typeof chk.data === 'string' ? JSON.parse(chk.data) : chk.data;
        const quedan = validateAmfeDoc(live, chk.project_name, p.amfeNumber).all
            .filter(i => i.type === 'DETECTION_HUMANA_OPTIMISTA').length;
        console.log(`  ${p.amfeNumber}: OK — quedan ${quedan} causas marcadas (las de instrumento, a proposito)`);
    }
});
