/**
 * _llenarOp71PuntadaFloja.mjs — la OP71 de los tres apoyacabezas, escrita desde la HO.
 *
 * DE DONDE SALE CADA COSA (HO-968/969/970 Rev.A, pestaña `71`, texto identico en las tres —
 * `Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES\1- CLIENTES\VWA\PATAGONIA\
 * APOYACABEZAS\<pieza>\`):
 *
 *   Denominacion (E6)         "Reproceso: puntada floja"
 *   Pasos (J11..J25)          1 Tomar las piezas NOK y colocarlas sobre la mesa
 *                             2 Con una aguja Nm140 (N.º 22), localizar la puntada floja
 *                             3 Tensionar el hilo
 *                             4 Con un encendedor, cauterizar el hilo para fijar la tension
 *                             5 Inspeccionar visualmente
 *                             6 Verificar la tension pasando la aguja bajo el hilo
 *                             7 Si pasa holgada y el hilo retorna -> tension correcta
 *                             8 Si pasa holgada y el hilo NO retorna -> FALTA DE TENSION
 *                             9 Si la aguja no pasa               -> TENSION EXCESIVA
 *   Ciclo de control (I40..R42)
 *                             "Puntada floja"            | Visual       | LIDER | Registro de calidad
 *                             "Tension correcta del hilo"| Metodo aguja | LIDER | Registro de calidad
 *   Plan de reaccion (B46..B48) DETENGA / NOTIFIQUE AL LIDER / ESPERE DEFINICION
 *
 * LOS DOS MODOS DE FALLA SON LOS QUE NOMBRA LA PROPIA HO en sus pasos 8 y 9. No se inventan.
 *
 * ⚠️ EL LIMITE, dicho explicito: **la HO no dice POR QUE queda mal**. Da el metodo y da el
 * criterio de aceptacion, no la causa. Las causas de abajo estan redactadas nombrando la
 * desviacion del paso documentado (no tensionar lo suficiente en el paso 3; no fijar la
 * tension al cauterizar en el paso 4; no verificar con el metodo aguja del paso 6). Eso es
 * leer el documento, no inventar un mecanismo — pero es lo mas cerca del limite de toda esta
 * tanda, y por eso se le muestra a Fak en dry-run antes de aplicar.
 *
 * S/O/D: NO se inventan numeros. Se toman del hermano ya desarrollado mas cercano — el
 * reproceso de costura del AMFE-2 OP103 — y quedan marcados `_autoFilled` para que se vean.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';

const { apply: APLICAR } = parseSafeArgs();

const AFECTADOS = ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];
const OP = '71';

const CONTROL_PREV = 'Instruccion de reproceso HO-968/71: tensionar el hilo y cauterizarlo con encendedor para fijar la tension';
const CONTROL_DET = 'Verificacion con metodo aguja (HO-968/71 pasos 6 a 9): la aguja pasa bajo el hilo entre dos puntadas. Responsable LIDER, registro en Registro de calidad';

/** Los dos modos de falla que la propia HO nombra, con sus causas leidas de los pasos. */
const CONTENIDO = {
    operationFunction: 'Corregir la puntada floja tensionando y cauterizando el hilo, y verificar la tension con el metodo aguja antes de devolver la pieza al flujo',
    workElements: [
        {
            name: 'Operador de Producción', type: 'Man',
            fn: 'Tensionar y cauterizar el hilo de la puntada floja segun la instruccion de reproceso',
            failures: [
                {
                    description: 'Falta de tension tras el reproceso — el hilo no retorna a su posicion',
                    effectLocal: 'Pieza sigue NOK, vuelve a reproceso',
                    effectNextLevel: 'Reproceso repetido, demora en la entrega del lote',
                    effectEndUser: 'Costura floja visible en el apoyacabezas',
                    severity: 4,
                    causes: [
                        'Tensionado del hilo insuficiente (paso 3 de la instruccion)',
                        'Cauterizado que no llega a fijar la tension (paso 4 de la instruccion)',
                    ],
                },
                {
                    description: 'Tension excesiva tras el reproceso — la aguja no pasa entre dos puntadas',
                    effectLocal: 'Pieza sigue NOK, vuelve a reproceso',
                    effectNextLevel: 'Riesgo de marcar o cortar el hilo al repetir la correccion',
                    effectEndUser: 'Costura fruncida visible en el apoyacabezas',
                    severity: 4,
                    causes: [
                        'Tensionado del hilo excesivo (paso 3 de la instruccion)',
                    ],
                },
            ],
        },
        {
            name: 'Instruccion de reproceso de puntada floja (HO-968/71)', type: 'Method',
            fn: 'Definir el metodo de correccion y el criterio de aceptacion de la tension',
            failures: [
                {
                    description: 'La tension no se verifica con el metodo aguja antes de liberar la pieza',
                    effectLocal: 'Pieza liberada sin comprobar la correccion',
                    effectNextLevel: 'Defecto detectado recien en el control final',
                    effectEndUser: 'Costura floja o fruncida visible en el apoyacabezas',
                    severity: 4,
                    causes: [
                        'Verificacion con metodo aguja omitida (pasos 6 a 9 de la instruccion)',
                    ],
                },
            ],
        },
    ],
};

/** S/O/D del hermano desarrollado mas cercano (AMFE-2 OP103, reproceso de costura). */
const SOD = { occurrence: 3, detection: 7 };

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
if (rows.length !== 3) { console.error(`Esperaba 3 AMFE, vinieron ${rows.length}`); process.exit(1); }

// El AP se calcula con la tabla oficial, nunca a ojo (regla amfe.md §4).
const { calculateAP } = await import('./_lib/amfeIo.mjs');

const plan = [], pendientes = [];

for (const row of rows.sort((a, b) => a.amfe_number.localeCompare(b.amfe_number))) {
    const antes = typeof row.data === 'string' ? JSON.parse(row.data) : structuredClone(row.data);
    const doc = JSON.parse(JSON.stringify(antes));
    const op = (doc.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);
    if (!op) { console.error(`${row.amfe_number}: no existe la OP${OP}`); process.exit(1); }
    if ((op.workElements ?? []).length) {
        console.error(`${row.amfe_number} OP${OP} ya tiene contenido — abortar, no piso nada`); process.exit(1);
    }

    op.operationFunction = CONTENIDO.operationFunction;
    op.workElements = CONTENIDO.workElements.map(we => ({
        id: randomUUID(), name: we.name, type: we.type, description: we.name,
        functions: [{
            id: randomUUID(), description: we.fn, functionDescription: we.fn,
            failures: we.failures.map(fm => ({
                id: randomUUID(),
                description: fm.description,
                effectLocal: fm.effectLocal, effectNextLevel: fm.effectNextLevel, effectEndUser: fm.effectEndUser,
                severity: fm.severity,
                causes: fm.causes.map(texto => {
                    const ap = calculateAP(fm.severity, SOD.occurrence, SOD.detection);
                    return {
                        id: randomUUID(), cause: texto, description: texto,
                        severity: fm.severity, occurrence: SOD.occurrence, detection: SOD.detection,
                        ap, actionPriority: ap,
                        preventionControl: CONTROL_PREV, detectionControl: CONTROL_DET,
                        preventionAction: '', detectionAction: '',
                        optimizationAction: ap === 'H' ? 'Pendiente definicion equipo APQP' : '',
                        specialChar: '', characteristicNumber: '', responsible: '', targetDate: '', status: '',
                        _autoFilled: ['occurrence', 'detection'],
                    };
                }),
            })),
        }],
    }));

    const nCausas = op.workElements.flatMap(w => w.functions).flatMap(f => f.failures).flatMap(fm => fm.causes).length;
    console.log(`\n  ${row.amfe_number} OP${OP} "${op.name}"`);
    console.log(`     funcion: ${op.operationFunction}`);
    for (const we of op.workElements) {
        console.log(`     · WE [${we.type}] ${we.name}`);
        for (const fn of we.functions) for (const fm of fn.failures) {
            console.log(`         FM "${fm.description}"  S=${fm.severity}`);
            for (const c of fm.causes) console.log(`            causa: ${c.cause}   [O=${c.occurrence} D=${c.detection} AP=${c.ap}]`);
        }
    }
    console.log(`     total: ${nCausas} causas`);

    plan.push({ id: row.id, amfeNumber: row.amfe_number, productName: row.project_name, before: antes, after: doc });
    pendientes.push({ id: row.id, amfeNumber: row.amfe_number, data: JSON.stringify(doc), nCausas });
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
        if (n !== p.nCausas) { console.error(`${p.amfeNumber}: quedo con ${n} causas, esperaba ${p.nCausas}`); process.exit(1); }
        console.log(`  ${p.amfeNumber}: OK — OP${OP} con ${n} causas`);
    }
});
