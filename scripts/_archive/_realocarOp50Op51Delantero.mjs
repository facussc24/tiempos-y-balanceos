/**
 * _realocarOp50Op51Delantero.mjs — dos operaciones vacias que en realidad YA estaban escritas,
 * pero colgadas de la operacion equivocada.
 *
 * QUE PASA
 * En `AMFE-HF-PAT` (151, apoyacabezas delantero), las operaciones 50 y 51 estan declaradas y
 * VACIAS. Su contenido esta dentro de la OP52 INYECCION DE PU, mezclado con lo que si es de la
 * inyectora. Se comprueba contra la HO-968 (`Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE
 * OPERACIONES\1- CLIENTES\VWA\PATAGONIA\APOYACABEZAS\DELANTERO\HO-968 APC DELANTERO REV.A.xlsx`),
 * donde cada causa coincide con un paso del operario:
 *
 *   OP50 "Colocacion de bolsa y carga del apoyacabezas en el molde"
 *     paso 1  Colocar la bolsita dentro de la abertura inferior de la funda   -> "Bolsita no colocada o mal orientada"
 *     paso 3  Calzar las dos astas en las guias del molde                     -> "Astas mal calzadas en las guias del molde"
 *     paso 4  Hacer coincidir la marca de las astas con la del molde          -> "Marcas de las astas no coinciden con las del molde"
 *     paso 5  Verificar que no sobresalga vinilo que pueda dañarse al cerrar  -> "Vinilo o funda sobresale y queda atrapado al cerrar"
 *
 *   OP51 "Cierre del molde y colocacion de boquilla"
 *     paso 4  Bajar el molde manteniendo la bolsa recta hacia arriba          -> "Bolsa atrapada al cerrar el molde"
 *     paso 5  Cerrar los clamps de fijacion del molde                         -> "Clamps de fijacion mal cerrados"
 *     paso 6  Introducir la boquilla dentro de la bolsa                       -> "Boquilla queda fuera de la bolsa"
 *
 * NO SE ESCRIBE NINGUN MODO DE FALLA NI CAUSA NUEVA. Se mueven los que ya existen, con su
 * S/O/D intacto. Lo que queda en OP52 es lo que si es de la maquina (carrusel, plataforma,
 * bomba dosificadora, sistema hidraulico) y lo que viene de otras operaciones.
 *
 * LOS CONTROLES: por que van a TBD la prevencion, y por que la deteccion se conserva
 * Los controles de estos dos modos de falla estan escritos POR MODO DE FALLA, no por causa:
 * las 7 causas de la fuga comparten un mismo texto y las 6 del descentrado otro. Por eso la
 * bolsita mal orientada arrastra hoy una prevencion que habla de "Sensores de posicion del
 * plato rotativo. Chiller verificado" — que no previene nada de lo que hace el operario.
 *   - PREVENCION -> TBD. El texto actual es de otro equipo, y el ciclo de control de las
 *     pestañas 50 y 51 de la HO esta en TBD: no hay de donde sacarlo sin inventarlo.
 *   - DETECCION de OP51 -> se conserva ("Monitoreo de presion durante el ciclo — caida brusca
 *     indica fuga. Inspeccion visual al desmoldeo"). Detecta la fuga aguas abajo, en la
 *     inyeccion, y eso es correcto: un control de deteccion puede estar despues de donde nace
 *     la causa.
 *   - DETECCION de OP50 -> hoy es "-" (vacia). Va TBD.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply: APLICAR } = parseSafeArgs();
const AMFE = 'AMFE-HF-PAT';

const TBD_PREV = 'TBD — definir el control de prevencion en el puesto (ciclo de control de la HO-968 pendiente)';
const TBD_DET = 'TBD — definir el control de deteccion en el puesto (ciclo de control de la HO-968 pendiente)';

/** Que causa se va a que operacion, y con que funcion la recibe. Texto de la HO-968. */
const MUDANZAS = [
    {
        op: '50',
        fmOrigen: /descentrado o con geometria incorrecta/i,
        causas: [
            'Bolsita no colocada o mal orientada',
            'Astas mal calzadas en las guias del molde',
            'Marcas de las astas no coinciden con las del molde',
            'Vinilo o funda sobresale y queda atrapado al cerrar',
        ],
        opFunction: 'Colocar la bolsa en la funda y cargar el apoyacabezas en el molde, con las astas calzadas en las guias y sin vinilo que sobresalga',
        weName: 'Operador de Producción',
        weType: 'Man',
        fnDescription: 'Colocar la bolsa y cargar el apoyacabezas en el molde en la posicion correcta',
        conservarDeteccion: false,
    },
    {
        op: '51',
        fmOrigen: /mezcla PU se escapa del molde/i,
        causas: [
            'Bolsa atrapada al cerrar el molde',
            'Clamps de fijacion mal cerrados',
            'Boquilla queda fuera de la bolsa',
        ],
        opFunction: 'Cerrar el molde con la bolsa por fuera y colocar la boquilla de inyeccion dentro de la bolsa',
        weName: 'Operador de Producción',
        weType: 'Man',
        fnDescription: 'Cerrar el molde y colocar la boquilla asegurando que la bolsa quede por fuera y la boquilla adentro',
        conservarDeteccion: true,
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
    .select('id, amfe_number, project_name, data').eq('amfe_number', AMFE);
if (error) { console.error(error.message); process.exit(1); }
if (rows.length !== 1) { console.error(`Esperaba 1 AMFE, vinieron ${rows.length}`); process.exit(1); }

const row = rows[0];
const antes = typeof row.data === 'string' ? JSON.parse(row.data) : structuredClone(row.data);
const doc = JSON.parse(JSON.stringify(antes));
const buscarOp = (n) => (doc.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === n);

const contarCausas = (d) => (d.operations ?? []).flatMap(o => o.workElements ?? [])
    .flatMap(w => w.functions ?? []).flatMap(f => f.failures ?? []).flatMap(fm => fm.causas ?? fm.causes ?? []).length;
const causasAntes = contarCausas(antes);

for (const m of MUDANZAS) {
    const destino = buscarOp(m.op);
    if (!destino) { console.error(`no existe la OP${m.op} — abortar`); process.exit(1); }
    if ((destino.workElements ?? []).length) {
        console.error(`OP${m.op} ya tiene contenido — abortar, no piso nada`); process.exit(1);
    }

    // Ubicar el modo de falla de origen POR TEXTO, nunca por posicion.
    let fmOrigen = null;
    for (const we of (buscarOp('52')?.workElements ?? [])) for (const fn of (we.functions ?? []))
        for (const fm of (fn.failures ?? [])) if (m.fmOrigen.test(String(fm.description ?? ''))) fmOrigen = fm;
    if (!fmOrigen) { console.error(`no encontre el modo de falla de origen para OP${m.op} — abortar`); process.exit(1); }

    const seVan = (fmOrigen.causes ?? []).filter(c => m.causas.includes(String(c.cause ?? '').trim()));
    if (seVan.length !== m.causas.length) {
        console.error(`OP${m.op}: esperaba ${m.causas.length} causas y encontre ${seVan.length} — abortar`);
        console.error(`  buscaba: ${m.causas.join(' | ')}`);
        process.exit(1);
    }

    // Se copian con id nuevo; la prevencion va a TBD porque el texto actual es de otro equipo.
    const movidas = seVan.map(c => {
        const n = JSON.parse(JSON.stringify(c));
        n.id = randomUUID();
        n.preventionControl = TBD_PREV;
        if (!m.conservarDeteccion || !String(c.detectionControl ?? '').replace(/-/g, '').trim()) {
            n.detectionControl = TBD_DET;
        }
        return n;
    });

    destino.operationFunction = m.opFunction;
    destino.workElements = [{
        id: randomUUID(), name: m.weName, type: m.weType, description: m.weName,
        functions: [{
            id: randomUUID(), description: m.fnDescription, functionDescription: m.fnDescription,
            failures: [{
                id: randomUUID(),
                description: fmOrigen.description,
                effectLocal: fmOrigen.effectLocal,
                effectNextLevel: fmOrigen.effectNextLevel,
                effectEndUser: fmOrigen.effectEndUser,
                severity: fmOrigen.severity,
                causes: movidas,
            }],
        }],
    }];

    // Y se sacan del origen, para no duplicarlas.
    fmOrigen.causes = (fmOrigen.causes ?? []).filter(c => !m.causas.includes(String(c.cause ?? '').trim()));

    console.log(`\n  OP${m.op} "${destino.name}"  <-  desde OP52, FM "${fmOrigen.description}"`);
    console.log(`     funcion: ${m.opFunction}`);
    for (const c of movidas) {
        console.log(`     · ${c.cause}   [S=${fmOrigen.severity} O=${c.occurrence} D=${c.detection} AP=${c.ap}]`);
        console.log(`         prev: ${c.preventionControl}`);
        console.log(`         det : ${c.detectionControl}`);
    }
    console.log(`     quedan en OP52: ${fmOrigen.causes.length} causa(s) — ${fmOrigen.causes.map(c => c.cause).join(' | ')}`);
}

// Invariante duro: no se pierde ni se duplica ninguna causa.
const causasDespues = contarCausas(doc);
if (causasAntes !== causasDespues) {
    console.error(`\n  ABORTAR: habia ${causasAntes} causas y quedarian ${causasDespues}. Se mueven, no se crean ni se borran.`);
    process.exit(1);
}
console.log(`\n  Invariante OK: ${causasAntes} causas antes, ${causasDespues} despues (se movieron de lugar).`);

const plan = [{ id: row.id, amfeNumber: AMFE, productName: row.project_name, before: antes, after: doc }];

await runWithValidation(plan, APLICAR, async () => {
    const { error: e } = await sb.from('amfe_documents')
        .update({ data: JSON.stringify(doc), updated_at: new Date().toISOString() }).eq('id', row.id);
    if (e) { console.error(e.message); process.exit(1); }

    const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', row.id).single();
    const live = typeof chk.data === 'string' ? JSON.parse(chk.data) : chk.data;
    if (contarCausas(live) !== causasAntes) { console.error('releido: cambio la cantidad de causas'); process.exit(1); }
    for (const m of MUDANZAS) {
        const op = (live.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === m.op);
        const n = (op.workElements ?? []).flatMap(w => w.functions ?? [])
            .flatMap(f => f.failures ?? []).flatMap(fm => fm.causes ?? []).length;
        if (n !== m.causas.length) { console.error(`OP${m.op}: quedo con ${n} causas`); process.exit(1); }
        console.log(`  OP${m.op}: OK — ${n} causas`);
    }
});
