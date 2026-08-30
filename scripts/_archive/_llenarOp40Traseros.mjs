/**
 * _llenarOp40Traseros.mjs — la OP40 de los dos apoyacabezas traseros, escrita desde la HO.
 *
 * DE DONDE SALE CADA COSA
 *
 * HO-969 / HO-970 Rev.A, pestaña `40` (`Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE
 * OPERACIONES\1- CLIENTES\VWA\PATAGONIA\APOYACABEZAS\<pieza>\`), texto identico en las dos:
 *   1  Recibir el asta y la funda. Verificar que esten libres de suciedad, rebabas o defectos
 *   2  Calzar la boca de la funda sobre el extremo del asta
 *   3  Empujar la funda hasta el fondo, "totalmente asentada y SIN PLIEGUES"
 *   4  Verificar que la funda quede "CENTRADA respecto al asta" y que "las dos varillas
 *      sobresalgan PAREJAS por la parte trasera"
 *   5  Si se detecta una no conformidad, se aplica el Plan de Reaccion
 * Los tres criterios en mayusculas son las tres fallas: la HO dice que hay que verificarlos,
 * o sea que su ausencia es el defecto. No se inventa ninguno.
 * ⚠️ El ciclo de control de esa pestaña esta VACIO (solo encabezados).
 *
 * Plan de Control `PATAGONIA_REAR CEN|OUT_HEADREST_..._PdC preliminar.pdf`, `Operacion 40`:
 *   "Correcta colocacion de Asta en Funda"  | Control visual / Muestra patron | 100% | Por lote
 *                                           | Autocontrol | Operador de produccion | Segun P-09/I
 *   "Apariencia sin despegues, cortes, terminacion ok, sin manchas ni marcas" | Visual | 100% ...
 * De ahi salen los controles, con su metodo, muestra, frecuencia, responsable y plan de reaccion.
 *
 * 🔴 LA FILA DEL PLAN DE CONTROL QUE NO SE USA
 * El PdC de los traseros pide ademas "Correcta clipar Asta con Inserto en interior de Funda".
 * **Esa fila esta de mas y se deja afuera**: el inserto es el armazon de EPP, y el propio Plan
 * de Control de los traseros NO recibe ningun EPP — cero menciones en toda su lista de
 * componentes de la Operacion 10. Se contradice dentro del mismo documento. Lo confirman la
 * BOM Barack V3 (12/12 hojas: "EPP CORE" 2HC.881.915 solo en el delantero), la Estructura de
 * Producto Rev.A, el Layout PIP Rev.A (hay contenedor "EPP_Front" y ninguno para los traseros)
 * y la propia HO, que no menciona inserto en ninguno de sus 5 pasos.
 * Fak, 24/08: el Plan de Control se copio del delantero. **Va avisado a Calidad para que lo
 * corrijan.**
 *
 * S/O/D — no se inventan
 *   S=5  del hermano: la OP40 del delantero (151) usa S=5 para el defecto de armado de funda,
 *        con la misma cadena de efectos (retrabajo de re-enfundado / geometria fuera de
 *        tolerancia en control final / forma irregular).
 *   O=4  idem.
 *   D=7  de la **Tabla P3 del AIAG-VDA**: un control visual humano en estacion va D=7. El
 *        delantero tiene D=5 en su OP40 y es una de las 716 causas con la deteccion optimista
 *        que hay que recalibrar aparte; no se copia el error.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';
import { calculateAP } from './_lib/amfeIo.mjs';

const { apply: APLICAR } = parseSafeArgs();

const AFECTADOS = ['AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const OP = '40';

const PREV = 'Muestra patron en el puesto y verificacion del operador segun la instruccion HO-969/40: funda asentada hasta el fondo, centrada respecto al asta y varillas parejas';
const DET = 'Control visual contra muestra patron, 100% por lote, autocontrol del operador de produccion (Plan de Control Operacion 40). Plan de reaccion segun P-09/I';

const SOD = { severity: 5, occurrence: 4, detection: 7 };

const FALLAS = [
    {
        description: 'Funda no asentada hasta el fondo o con pliegues',
        effectLocal: 'Funda mal armada, retrabajo de re-enfundado offline',
        effectNextLevel: 'Pieza con geometria fuera de tolerancia detectada en control final',
        effectEndUser: 'apoyacabezas con forma irregular, posible reclamo estetico',
        causas: ['Funda no empujada hasta el fondo del asta (paso 3 de la instruccion)'],
    },
    {
        description: 'Funda descentrada respecto al asta',
        effectLocal: 'Funda mal armada, retrabajo de re-enfundado offline',
        effectNextLevel: 'Pieza con geometria fuera de tolerancia detectada en control final',
        effectEndUser: 'apoyacabezas con forma irregular, posible reclamo estetico',
        causas: ['Centrado de la funda sobre el asta no verificado antes de continuar (paso 4 de la instruccion)'],
    },
    {
        description: 'Las dos varillas no sobresalen parejas por la parte trasera',
        effectLocal: 'Pieza separada para reposicionar la funda',
        effectNextLevel: 'Riesgo de interferencia al montar en el respaldo',
        effectEndUser: 'Dificultad para insertar el apoyacabezas en el respaldo',
        causas: ['Asta mal calzada dentro de la funda (paso 2 de la instruccion)'],
    },
];

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
if (rows.length !== 2) { console.error(`Esperaba 2 AMFE, vinieron ${rows.length}`); process.exit(1); }

const plan = [], pendientes = [];

for (const row of rows.sort((a, b) => a.amfe_number.localeCompare(b.amfe_number))) {
    const antes = typeof row.data === 'string' ? JSON.parse(row.data) : structuredClone(row.data);
    const doc = JSON.parse(JSON.stringify(antes));
    const op = (doc.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);
    if (!op) { console.error(`${row.amfe_number}: no existe la OP${OP}`); process.exit(1); }
    if ((op.workElements ?? []).length) {
        console.error(`${row.amfe_number} OP${OP} ya tiene contenido — abortar, no piso nada`); process.exit(1);
    }

    const ap = calculateAP(SOD.severity, SOD.occurrence, SOD.detection);

    op.operationFunction = 'Calzar la funda sobre el asta hasta el fondo, asentada y sin pliegues, centrada y con las dos varillas parejas';
    op.workElements = [{
        id: randomUUID(), name: 'Operador de Producción', type: 'Man', description: 'Operador de Producción',
        functions: [{
            id: randomUUID(),
            description: 'Calzar la funda sobre el asta y verificar asentamiento, centrado y varillas parejas',
            functionDescription: 'Calzar la funda sobre el asta y verificar asentamiento, centrado y varillas parejas',
            failures: FALLAS.map(f => ({
                id: randomUUID(),
                description: f.description,
                effectLocal: f.effectLocal, effectNextLevel: f.effectNextLevel, effectEndUser: f.effectEndUser,
                severity: SOD.severity,
                causes: f.causas.map(texto => ({
                    id: randomUUID(), cause: texto, description: texto,
                    severity: SOD.severity, occurrence: SOD.occurrence, detection: SOD.detection,
                    ap, actionPriority: ap,
                    preventionControl: PREV, detectionControl: DET,
                    preventionAction: '', detectionAction: '',
                    optimizationAction: ap === 'H' ? 'Pendiente definicion equipo APQP' : '',
                    specialChar: '', characteristicNumber: '', responsible: '', targetDate: '', status: '',
                    _autoFilled: ['occurrence', 'detection'],
                })),
            })),
        }],
    }];

    const n = op.workElements.flatMap(w => w.functions).flatMap(f => f.failures).flatMap(fm => fm.causes).length;
    console.log(`\n  ${row.amfe_number} OP${OP} "${op.name}"`);
    console.log(`     funcion: ${op.operationFunction}`);
    for (const fn of op.workElements[0].functions) for (const fm of fn.failures) {
        console.log(`     FM "${fm.description}"  S=${fm.severity}`);
        for (const c of fm.causes) console.log(`        causa: ${c.cause}   [O=${c.occurrence} D=${c.detection} AP=${c.ap}]`);
    }
    console.log(`     total: ${n} causas`);

    plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc });
    pendientes.push({ id: row.id, amfeNumber: row.amfe_number, data: JSON.stringify(doc), n });
}

await runWithValidation(plan, APLICAR, async () => {
    for (const p of pendientes) {
        const { error: e } = await sb.from('amfe_documents')
            .update({ data: p.data, updated_at: new Date().toISOString() }).eq('id', p.id);
        if (e) { console.error(`${p.amfeNumber}: ${e.message}`); process.exit(1); }
        const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', p.id).single();
        const live = typeof chk.data === 'string' ? JSON.parse(chk.data) : chk.data;
        const op = (live.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);
        const n = (op.workElements ?? []).flatMap(w => w.functions ?? []).flatMap(f => f.failures ?? []).flatMap(fm => fm.causes ?? []).length;
        if (n !== p.n) { console.error(`${p.amfeNumber}: quedo con ${n} causas`); process.exit(1); }
        console.log(`  ${p.amfeNumber}: OK — OP${OP} con ${n} causas`);
    }
});
