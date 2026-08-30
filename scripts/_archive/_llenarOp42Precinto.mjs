/**
 * _llenarOp42Precinto.mjs — la OP42 del apoyacabezas delantero, escrita desde la HO.
 *
 * DE DONDE SALE CADA COSA
 * HO-968 Rev.A, pestaña `42` — `Colocacion de precinto con pistola etiquetadora`, sector
 * TAPIZADO (`Y:\BARACK\CALIDAD\DOCUMENTACION SGC\HOJAS DE OPERACIONES\1- CLIENTES\VWA\
 * PATAGONIA\APOYACABEZAS\DELANTERO\HO-968 APC DELANTERO REV.A.xlsx`):
 *   1  Identificar el punto donde se une la linea de la abertura con la costura lateral
 *   2  Tomar la pistola etiquetadora cargada con el precinto plastico
 *   3  Colocar la aguja sobre el punto identificado asegurando que atraviese TODO el espesor
 *      del vinilo, y disparar el precinto — repetir en ambos lados
 *   4  Tironear levemente del precinto para comprobar que quedo firme
 *   5  Verificar visualmente que coincida con el criterio de la foto OK
 *   ⚠ NOTA CRITICA (textual): "la aguja debe atravesar TODO el espesor del vinilo. Un precinto
 *     que no pase el espesor completo se sale al tironear y no cumple su funcion."
 *
 * **Esa nota critica enuncia el modo de falla y su mecanismo completo.** El modo de falla de
 * abajo no se deduce: esta escrito en la HO.
 *
 * PARA QUE SIRVE EL PRECINTO — lo dice la HO-968 pestaña `51`, paso 3:
 *   "Enganchar el precinto en ambos lados a los soportes laterales del molde."
 * O sea que un precinto flojo se paga en el cierre del molde y en la inyeccion de PU. Por eso
 * el efecto de nivel siguiente apunta ahi, y no es una suposicion.
 *
 * 🔴 LOS CONTROLES VAN TBD, A PROPOSITO
 * El ciclo de control de la pestaña 42 esta en `TBD` (celda I24) y **el Plan de Control no
 * tiene ninguna fila de precinto** — la operacion queda absorbida dentro de su `Operacion 40`
 * sin caracteristica propia. No hay de donde sacar el control sin inventarlo. Queda listado
 * para que lo defina Fak / Calidad.
 *
 * S/O/D — no se inventan
 *   S=5  del hermano: la OP40 del mismo AMFE usa S=5 para el defecto de armado de funda, con
 *        la misma cadena de efectos (retrabajo offline / detectado en control final).
 *   O=4  idem.
 *   D=7  Tabla P3 del AIAG-VDA: control visual humano en estacion. Con el control en TBD la
 *        deteccion no puede ser mejor que eso.
 *
 * Dry-run por defecto; --apply escribe. Pasa por runWithValidation (regla amfe.md §14).
 */
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs, runWithValidation } from './_lib/dryRunGuard.mjs';
import { calculateAP } from './_lib/amfeIo.mjs';

const { apply: APLICAR } = parseSafeArgs();

const AMFE = 'AMFE-HF-PAT';
const OP = '42';

const PREV = 'TBD — definir el control de prevencion (el ciclo de control de la HO-968/42 esta pendiente y el Plan de Control no tiene fila de precinto)';
const DET = 'TBD — definir el control de deteccion (idem). La instruccion pide tironear el precinto y comparar con la foto OK, pero no esta declarado como control con responsable ni frecuencia';

const SOD = { severity: 5, occurrence: 4, detection: 7 };

const FALLAS = [
    {
        description: 'Precinto colocado sin atravesar todo el espesor del vinilo',
        effectLocal: 'El precinto se sale al tironear, hay que repetir la colocacion',
        effectNextLevel: 'La funda no queda enganchada a los soportes del molde al cerrar (OP51)',
        effectEndUser: 'Riesgo de fuga de PU y pieza descartada',
        causas: ['Aguja de la pistola no apoyada sobre todo el espesor al disparar (paso 3 de la instruccion)'],
    },
    {
        description: 'Precinto colocado fuera del punto de union de la abertura con la costura lateral',
        effectLocal: 'Funda mal sujetada, se reposiciona el precinto',
        effectNextLevel: 'Enganche desparejo en los soportes del molde al cerrar (OP51)',
        effectEndUser: 'Riesgo de fuga de PU y pieza descartada',
        causas: ['Punto de colocacion no identificado antes de disparar (paso 1 de la instruccion)'],
    },
    {
        description: 'Falta el precinto en uno de los dos lados',
        effectLocal: 'Funda sujetada de un solo lado, se completa el precinto faltante',
        effectNextLevel: 'Enganche asimetrico en los soportes del molde al cerrar (OP51)',
        effectEndUser: 'Riesgo de fuga de PU y pieza descartada',
        causas: ['Colocacion no repetida en ambos lados de la funda (paso 3 de la instruccion)'],
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
const op = (doc.operations ?? []).find(o => String(o.opNumber ?? o.operationNumber) === OP);
if (!op) { console.error(`no existe la OP${OP}`); process.exit(1); }
if ((op.workElements ?? []).length) { console.error(`OP${OP} ya tiene contenido — abortar`); process.exit(1); }

const ap = calculateAP(SOD.severity, SOD.occurrence, SOD.detection);

op.operationFunction = 'Colocar un precinto plastico a cada lado de la funda, atravesando todo el espesor del vinilo, para poder engancharla a los soportes del molde';
op.workElements = [{
    id: randomUUID(), name: 'Operador de Producción', type: 'Man', description: 'Operador de Producción',
    functions: [{
        id: randomUUID(),
        description: 'Colocar el precinto en el punto de union de la abertura con la costura lateral, en ambos lados',
        functionDescription: 'Colocar el precinto en el punto de union de la abertura con la costura lateral, en ambos lados',
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
console.log(`\n  ${AMFE} OP${OP} "${op.name}"`);
console.log(`     funcion: ${op.operationFunction}`);
for (const fn of op.workElements[0].functions) for (const fm of fn.failures) {
    console.log(`\n     FM "${fm.description}"  S=${fm.severity}`);
    console.log(`        efecto siguiente: ${fm.effectNextLevel}`);
    for (const c of fm.causes) console.log(`        causa: ${c.cause}   [O=${c.occurrence} D=${c.detection} AP=${c.ap}]`);
}
console.log(`\n     total: ${n} causas · controles en TBD (la HO y el Plan de Control no los tienen)`);

const plan = [{ id: row.id, amfeNumber: AMFE, productName: row.project_name, before: antes, after: doc }];

await runWithValidation(plan, APLICAR, async () => {
    const { error: e } = await sb.from('amfe_documents')
        .update({ data: JSON.stringify(doc), updated_at: new Date().toISOString() }).eq('id', row.id);
    if (e) { console.error(e.message); process.exit(1); }
    const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', row.id).single();
    const live = typeof chk.data === 'string' ? JSON.parse(chk.data) : chk.data;
    const o = (live.operations ?? []).find(x => String(x.opNumber ?? x.operationNumber) === OP);
    const q = (o.workElements ?? []).flatMap(w => w.functions ?? []).flatMap(f => f.failures ?? []).flatMap(fm => fm.causes ?? []).length;
    if (q !== n) { console.error(`quedo con ${q} causas`); process.exit(1); }
    console.log(`  ${AMFE}: OK — OP${OP} con ${q} causas`);
});
