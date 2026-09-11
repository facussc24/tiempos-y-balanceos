/**
 * _recalcularApNovax.mjs — el AP declarado de una causa tiene que salir de la tabla oficial.
 *
 * Lo destapo la auditoria de cliente del 11/09/2026 sobre los AMFE de NOVAX: el AMFE 161
 * (ARMREST DOOR PANEL) tiene causas con AP 'L' donde la Figura 3.5-3 del AIAG-VDA da 'M'
 * (S=8 O=4 D=4). Un AP que subdeclara el riesgo es lo primero que recalcula el auditor del
 * cliente, y el gate CAUSE_AP_MISMATCH del validador ya lo marca como CRITICO.
 *
 * NO es un dato de ingenieria: el AP es 100% derivado de S, O y D por la tabla oficial
 * (regla amfe.md §4: se calcula SOLO con calculateAP, la formula S*O*D esta prohibida).
 * Este script no toca ninguna S, ninguna O, ninguna D ni ninguna sigla: solo reescribe el
 * AP con lo que la tabla dice para los numeros que ya tiene la causa.
 *
 * La severidad que manda es la del MODO DE FALLA (el efecto es del modo, no de la causa),
 * que es la misma que usa el validador: por eso las causas con severidad propia distinta
 * (CAUSE_SEVERITY_PROPIA) no cambian de criterio aca — ese hallazgo va aparte.
 *
 * Uso:
 *   node scripts/_recalcularApNovax.mjs            dry-run
 *   node scripts/_recalcularApNovax.mjs --apply
 */
import { parseSafeArgs, logChange, finish, runWithValidation } from './_lib/dryRunGuard.mjs';
import { connectSupabase, saveAmfe, parseData, calculateAP } from './_lib/amfeIo.mjs';

const AMFES = ['AMFE-INS-PAT', 'AMFE-ARM-PAT', 'AMFE-TR-PAT'];
const { apply } = parseSafeArgs();

const sb = await connectSupabase();
const plan = [];

for (const num of AMFES) {
    const { data: rows, error } = await sb.from('amfe_documents')
        .select('id, amfe_number, project_name, data')
        .eq('amfe_number', num);
    if (error) throw new Error(`READ ${num}: ${error.message}`);
    if (rows.length !== 1) throw new Error(`${num}: esperaba 1 fila y hay ${rows.length}`);
    const row = rows[0];
    const before = parseData(row.data);
    const after = JSON.parse(JSON.stringify(before));
    let cambios = 0;

    for (const op of after.operations ?? []) {
        for (const we of op.workElements ?? []) {
            for (const fn of we.functions ?? []) {
                for (const fa of fn.failures ?? []) {
                    for (const c of fa.causes ?? []) {
                        const s = fa.severity ?? c.severity;
                        const esperado = calculateAP(s, c.occurrence, c.detection);
                        if (!esperado) continue;               // S/O/D incompletos: no se toca
                        const declarado = String(c.ap || c.actionPriority || '').trim().toUpperCase();
                        if (!declarado || declarado === esperado) continue;
                        logChange(`${num} OP ${op.operationNumber ?? op.opNumber} · ${String(c.cause || c.description).slice(0, 55)}`,
                            `AP ${declarado}`, `AP ${esperado}  (S=${s} O=${c.occurrence} D=${c.detection}, tabla AIAG-VDA)`);
                        c.ap = esperado;
                        c.actionPriority = esperado;
                        cambios++;
                    }
                }
            }
        }
    }

    console.log(`${num}: ${cambios} causa${cambios === 1 ? '' : 's'} con el AP fuera de la tabla`);
    if (cambios) plan.push({ id: row.id, amfeNumber: num, productName: row.project_name || '', before, after });
}

if (!plan.length) {
    console.log('\nNada que corregir: todos los AP salen de la tabla oficial.');
    process.exit(0);
}

// runWithValidation llama al commit SIN argumentos (dryRunGuard.mjs:180): el recorrido
// del plan lo hace el commit, no el guard. Pasarle un `change` por parametro lo recibia
// undefined y reventaba al escribir (11/09/2026).
await runWithValidation(plan, apply, async () => {
    for (const change of plan) {
        await saveAmfe(sb, change.id, change.after, { expectedAmfeNumber: change.amfeNumber });
        console.log(`  guardado ${change.amfeNumber}`);
    }
});

finish(apply);
