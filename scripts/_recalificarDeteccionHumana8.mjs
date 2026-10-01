/**
 * _recalificarDeteccionHumana8.mjs — la inspeccion humana que quedo en D=7 pasa a D=8.
 *
 * LA NORMA (tabla OFICIAL, no el borrador de 2017)
 * Tabla P3 del manual AIAG-VDA (SETEC, `MANUAL AMFE R06 Julio 2020 Participante.pdf`, pag.
 * 109-111; `amfe.md` §13): inspeccion humana o medicion manual con metodo NO probado = 8,
 * probado = 6; por MAQUINA no probado = 7. **Un 7 no existe para un control que hace una
 * persona.** El "D=7 humana en la estacion" era del borrador de 2017 y con ese valor
 * `_recalificarDeteccionPatagonia.mjs` (24/08/2026) dejo cientos de causas en 7.
 * OK de Fak, 01/10/2026: "cambia los datos por favor".
 *
 * QUE TOCA
 * Solo las causas que marca `esDeteccionHumanaOptimista()` de `scripts/_lib/amfeValidator.mjs`
 * (control humano, sin instrumento, no muestreo) y que tienen D EXACTAMENTE 7. Van a 8.
 * El criterio de seleccion es el del check, no una regla paralela escrita aca.
 *
 * QUE NO TOCA, Y REPORTA
 *   - D <= 6 con control humano: un 6 puede ser un metodo PROBADO; lo define el equipo APQP.
 *   - Controles que nombran un instrumento o un control de maquina (misma lista que el
 *     script del 24/08): ahi el 7 puede ser correcto (maquina no probada).
 *   - Causas donde S/O con D=8 cae en la casilla "Error" de la tabla AP (calculateAP vacio).
 *
 * El AP se recalcula con `calculateAP()` SOLO en las causas que cambian. S y O no se tocan.
 * Una causa que quede en AP=H sin accion queda con la celda VACIA (`amfe.md` §4).
 *
 * Uso:
 *   node scripts/_recalificarDeteccionHumana8.mjs            dry-run (no escribe)
 *   node scripts/_recalificarDeteccionHumana8.mjs --apply    escribe (pasa por runWithValidation)
 */
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';
import { connectSupabase, listAmfes, readAmfe, saveAmfe, calculateAP } from './_lib/amfeIo.mjs';
import { validateAmfeDoc, esDeteccionHumanaOptimista } from './_lib/amfeValidator.mjs';

const { apply: APLICAR } = parseSafeArgs();

/** Instrumento o control de maquina en el texto del control: no se toca, se reporta. */
const INSTRUMENTO = /monitoreo de presi|panel de presi|lector|c[oó]digo de barras|balanza|calibre|galga|torqu[ií]metro|dinamom|term[oó]metro|sensor|\bregla\b|comparador|micr[oó]metro/i;

const sb = await connectSupabase();
const lista = (await listAmfes(sb)).sort((a, b) => String(a.amfe_number).localeCompare(String(b.amfe_number)));

const plan = [], pendientes = [], sinTocar = [];
let total = 0;
const cambioAp = {};

console.log('AMFE                     | D 7->8 | sin tocar | AP de las que cambian (antes -> despues)');

for (const fila of lista) {
    const { doc: antes, row } = await readAmfe(sb, fila.id);
    const doc = JSON.parse(JSON.stringify(antes));
    let n = 0, saltadas = 0;
    const mov = {};

    for (const op of (doc.operations ?? [])) {
        const opNum = String(op.opNumber ?? op.operationNumber ?? '');
        for (const we of (op.workElements ?? [])) for (const fn of (we.functions ?? [])) {
            for (const fm of (fn.failures ?? [])) for (const c of (fm.causes ?? [])) {
                if (Number(c.detection) !== 7) continue;
                if (!esDeteccionHumanaOptimista(c.detectionControl, c.detection)) continue;
                const texto = String(c.detectionControl ?? '');
                if (INSTRUMENTO.test(texto)) {
                    saltadas++;
                    sinTocar.push({ amfe: fila.amfe_number, op: opNum, motivo: 'instrumento', control: texto.slice(0, 110) });
                    continue;
                }
                const s = Number(fm.severity), o = Number(c.occurrence);
                const apNuevo = calculateAP(s, o, 8);
                if (!apNuevo) {
                    saltadas++;
                    sinTocar.push({ amfe: fila.amfe_number, op: opNum, motivo: `S=${fm.severity} O=${c.occurrence} con D=8 cae en "Error" de la tabla AP`, control: texto.slice(0, 110) });
                    continue;
                }
                const apViejo = String(c.ap ?? c.actionPriority ?? '').toUpperCase() || '?';
                c.detection = 8;
                c.ap = apNuevo;
                c.actionPriority = apNuevo;
                n++;
                const k = `${apViejo}->${apNuevo}`;
                mov[k] = (mov[k] ?? 0) + 1;
                cambioAp[k] = (cambioAp[k] ?? 0) + 1;
            }
        }
    }

    total += n;
    if (n || saltadas) {
        const movTxt = Object.entries(mov).map(([k, v]) => `${k}: ${v}`).join('  ');
        console.log(`${String(fila.amfe_number).padEnd(25)}| ${String(n).padStart(6)} | ${String(saltadas).padStart(9)} | ${movTxt}`);
    }
    if (!n) continue;
    plan.push({ id: fila.id, amfeNumber: fila.amfe_number, productName: row.project_name, before: antes, after: doc });
    pendientes.push({ id: fila.id, amfeNumber: fila.amfe_number, productName: row.project_name, doc });
}

console.log(`\nTOTAL: ${total} causas de D=7 a D=8 en ${plan.length} AMFE · ${sinTocar.length} sin tocar`);
console.log('AP de las causas que cambian: ' + Object.entries(cambioAp).map(([k, v]) => `${k}: ${v}`).join('  '));

if (sinTocar.length) {
    console.log('\n=== NO SE TOCARON (las define el equipo APQP):');
    const grupos = new Map();
    for (const s of sinTocar) {
        const k = `${s.motivo} | ${s.control}`;
        if (!grupos.has(k)) grupos.set(k, { n: 0, amfes: new Set() });
        const g = grupos.get(k); g.n++; g.amfes.add(s.amfe);
    }
    for (const [k, g] of [...grupos].sort((a, b) => b[1].n - a[1].n).slice(0, 25)) {
        console.log(`  [${String(g.n).padStart(2)}] ${[...g.amfes].join(', ')} · ${k}`);
    }
}

if (!plan.length) { console.log('\nNada que recalificar.'); process.exit(0); }

await runWithValidation(plan, APLICAR, async () => {
    for (const p of pendientes) {
        await saveAmfe(sb, p.id, p.doc, { expectedAmfeNumber: p.amfeNumber });
        const { doc: live } = await readAmfe(sb, p.id);
        let quedan7 = 0;
        for (const op of (live.operations ?? [])) for (const we of (op.workElements ?? []))
            for (const fn of (we.functions ?? [])) for (const fm of (fn.failures ?? []))
                for (const c of (fm.causes ?? [])) {
                    if (Number(c.detection) === 7 && esDeteccionHumanaOptimista(c.detectionControl, c.detection)
                        && !INSTRUMENTO.test(String(c.detectionControl ?? ''))) quedan7++;
                }
        const avisos = validateAmfeDoc(live, p.productName, p.amfeNumber).all
            .filter(i => i.type === 'DETECTION_HUMANA_OPTIMISTA').length;
        console.log(`  ${p.amfeNumber}: OK — releido de Supabase: ${quedan7} humanas en 7 (debe ser 0) · ${avisos} avisos de deteccion humana que quedan (D<=6 o instrumento)`);
    }
});
