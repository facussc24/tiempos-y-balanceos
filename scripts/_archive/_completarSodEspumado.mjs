/**
 * _completarSodEspumado.mjs — carga ocurrencia y deteccion en la inyeccion de PU de los
 * tres apoyacabezas de Patagonia (151, 153, 155).
 *
 * QUE RESUELVE
 * Las 54 causas de la operacion de espumado de cada apoyacabezas (162 en total) tenian
 * `occurrence` y `detection` con el texto literal "TBD-Leo". Sin esos dos numeros no se
 * puede calcular el AP, asi que toda la operacion de inyeccion de PU estaba sin
 * priorizacion de riesgo. Fak pidio resolverlo (18/08/2026) en vez de pasarlo a Calidad.
 *
 * DE DONDE SALEN LOS NUMEROS — no se inventan
 *
 * OCURRENCIA. La escala es la de `rules/amfe.md` §13 y el calibrado sale del AMFE 150
 * (APB Trasero Central), que es el MISMO proceso, la MISMA maquina (Purmatic) y el mismo
 * taller, y ya paso por el equipo APQP. Ahi la inyeccion de PUR usa O=6 para las causas de
 * formula y dosificacion, y O=4 para el resto. Se replica ese criterio por naturaleza de
 * la causa:
 *
 *   6  dosificacion, ratio A:B, calibracion de flujometro   (ocasional, 1-2/semana)
 *   4  error u omision del operario                          (infrecuente, 1/mes)
 *   4  limpieza, purga, contaminacion en planta              (infrecuente)
 *   4  mantenimiento vencido o desgaste                      (infrecuente)
 *   3  falla de equipo o corte de servicio                   (rara, 1-2/año)
 *   3  lote del proveedor fuera de spec                      (rara — llega con certificado)
 *
 * DETECCION. Sale del control detectivo que YA tiene declarado cada causa, contra la misma
 * escala §13. No es criterio libre: es leer que control hay y ubicarlo en la tabla.
 *
 *   2  alarma con PARADA AUTOMATICA del ciclo        (poka-yoke / interlock)
 *   3  sensor o alarma automatica SIN parada         (automatica)
 *   4  monitoreo automatico + inspeccion visual      (100% visual + dimensional)
 *   8  SIN control declarado en la causa             (solo se detecta aguas abajo)
 *
 * El D=8 de las causas sin control NO es un relleno: es el valor honesto. Sube el AP y hace
 * VISIBLE el hueco en vez de taparlo con un numero optimista. Son las tres causas de
 * seguridad (STOP de emergencia, vapores ISO/POLY) y la de geometria, que hoy no tienen
 * ningun control anotado en el AMFE.
 *
 * El AMFE MAESTRO de inyeccion PUR (`AMFE-MAESTRO-PU-001`) tiene las MISMAS 54 causas y
 * tambien sin O ni D: el hueco nace ahi y bajo a las tres variantes. Este script arregla
 * las variantes; el maestro queda reportado aparte.
 *
 * Uso:  node scripts/_completarSodEspumado.mjs           (dry-run)
 *       node scripts/_completarSodEspumado.mjs --apply
 */

import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import { connectSupabase, parseData, saveAmfe, calculateAP } from './_lib/amfeIo.mjs';

const AMFES = ['AMFE-HF-PAT', 'AMFE-HRC-PAT', 'AMFE-HRO-PAT'];

/** Naturaleza de la causa -> ocurrencia. Orden: gana la primera que matchea. */
const OCURRENCIA = [
    { o: 6, re: /flujometro|ratio|dosificaci|calibracion|mezcla A:B|variador .* desincronizado|peso de inyeccion/i,
        nota: 'dosificacion / ratio / calibracion' },
    { o: 3, re: /lote (ISO|PU) del proveedor|contaminacion con sustancias prohibidas/i,
        nota: 'lote del proveedor' },
    { o: 3, re: /corte de energia|falla del PLC|falla del chiller|enfriador desconectado|inoperativo|degradado/i,
        nota: 'falla de equipo o corte de servicio' },
    { o: 4, re: /mantenimiento|desgastad|vencid/i, nota: 'mantenimiento o desgaste' },
    { o: 4, re: /sucio|contaminad|contaminacion|residuos|sin purgar|obstruido|decantado/i,
        nota: 'limpieza / contaminacion' },
    { o: 4, re: /.*/, nota: 'error u omision del operario / condicion de proceso' },
];

/** Control detectivo declarado -> deteccion. Orden: gana la primera que matchea. */
const DETECCION = [
    { d: 2, re: /parada automatica/i, nota: 'alarma con parada automatica (interlock)' },
    { d: 4, re: /inspeccion visual/i, nota: 'monitoreo automatico + inspeccion visual' },
    { d: 3, re: /sensor|alarma|monitoreo|PT100|pantalla/i, nota: 'sensor o alarma sin parada' },
    { d: 8, re: /.*/, nota: 'SIN control declarado — se detecta aguas abajo' },
];

function elegir(tabla, texto, campo) {
    const hit = tabla.find(r => r.re.test(texto || ''));
    return { valor: hit[campo], nota: hit.nota };
}

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const plan = [];
const commits = [];
const resumen = new Map();

for (const amfeNumber of AMFES) {
    const { data: rows, error } = await sb
        .from('amfe_documents')
        .select('id, amfe_number, data')
        .eq('amfe_number', amfeNumber)
        .limit(1);
    if (error) throw error;
    const row = rows[0];
    const before = parseData(row.data);
    const doc = parseData(row.data);

    let tocadas = 0;
    for (const op of doc.operations || []) {
        if (!/INYECCION DE PU/i.test(op.name || op.operationName || '')) continue;
        for (const we of op.workElements || []) {
            for (const fn of we.functions || []) {
                for (const fl of fn.failures || []) {
                    for (const cs of fl.causes || []) {
                        const oNum = Number(cs.occurrence);
                        const dNum = Number(cs.detection);
                        if (Number.isInteger(oNum) && oNum > 0 && Number.isInteger(dNum) && dNum > 0) continue;

                        const s = Number(cs.severity);
                        const o = elegir(OCURRENCIA, cs.cause || cs.description, 'o');
                        const d = elegir(DETECCION, cs.detectionControl, 'd');
                        const ap = calculateAP(s, o.valor, d.valor);

                        cs.occurrence = o.valor;
                        cs.detection = d.valor;
                        cs.ap = ap;
                        cs.actionPriority = ap;
                        // AP=H sin accion definida lleva el placeholder autorizado (amfe.md §4).
                        if (ap === 'H' && !cs.preventionAction) {
                            cs.preventionAction = 'Pendiente definicion equipo APQP';
                        }
                        cs._autoFilled = true;
                        tocadas++;

                        const k = `S${s} O${o.valor} D${d.valor} -> AP ${ap}  |  ${o.nota}  |  ${d.nota}`;
                        resumen.set(k, (resumen.get(k) || 0) + 1);
                    }
                }
            }
        }
    }

    logChange(apply, `${amfeNumber}: ${tocadas} causas del espumado con O y D cargadas`, {});
    plan.push({ id: row.id, amfeNumber, productName: 'APOYACABEZAS', before, after: doc });
    commits.push(async () => {
        await saveAmfe(sb, row.id, doc);
        const { data: chk } = await sb.from('amfe_documents').select('data').eq('id', row.id).single();
        const live = parseData(chk.data);
        let sinOd = 0;
        for (const op of live.operations || []) {
            if (!/INYECCION DE PU/i.test(op.name || op.operationName || '')) continue;
            for (const we of op.workElements || []) {
                for (const fn of we.functions || []) {
                    for (const fl of fn.failures || []) {
                        for (const cs of fl.causes || []) {
                            if (!Number.isInteger(Number(cs.occurrence)) || !Number.isInteger(Number(cs.detection))) sinOd++;
                        }
                    }
                }
            }
        }
        if (sinOd > 0) throw new Error(`POST-CHECK ${amfeNumber}: quedaron ${sinOd} causas sin O/D`);
        console.log(`POST-CHECK live ${amfeNumber}: 0 causas del espumado sin O/D`);
    });
}

console.log('\n--- como quedo asignado (una linea por combinacion) ---');
for (const [k, n] of [...resumen.entries()].sort()) {
    console.log(`  ${String(n).padStart(3)} causas  ${k}`);
}
console.log();

await runWithValidation(plan, apply, async () => {
    for (const c of commits) await c();
});

finish(apply);
