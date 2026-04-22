/**
 * Helper para scripts que modifican Supabase.
 *
 * Convenciones (seguridad de datos):
 *   - Dry-run por default. --apply para ejecutar.
 *   - Imprime resumen de cambios antes de aplicar.
 *   - No ejecuta si no se confirma con flag explicita.
 *
 * USO en un script nuevo:
 *   import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
 *
 *   const { apply } = parseSafeArgs();
 *   for (const doc of docs) {
 *     logChange(apply, `update ${doc.id}`, { before: doc.data.x, after: newX });
 *     if (apply) {
 *       await sb.from('amfe_documents').update({ data: newData }).eq('id', doc.id);
 *     }
 *   }
 *   finish(apply);
 */

export function parseSafeArgs(argv = process.argv.slice(2)) {
    const apply = argv.includes('--apply');
    const verbose = argv.includes('--verbose') || argv.includes('-v');
    const positional = argv.filter(a => !a.startsWith('--') && !a.startsWith('-'));
    if (!apply) {
        console.log('DRY-RUN (no toca Supabase). Agrega --apply para ejecutar.\n');
    } else {
        console.log('APLICANDO cambios a Supabase.\n');
    }
    return { apply, verbose, positional };
}

let changeCount = 0;
export function logChange(apply, description, detail = null) {
    changeCount++;
    const prefix = apply ? '[APPLY]' : '[DRY ]';
    if (detail && typeof detail === 'object') {
        console.log(`  ${prefix} ${description}`);
        for (const [k, v] of Object.entries(detail)) {
            const str = typeof v === 'string' ? v : JSON.stringify(v);
            const trimmed = str.length > 80 ? str.slice(0, 77) + '...' : str;
            console.log(`       ${k}: ${trimmed}`);
        }
    } else {
        console.log(`  ${prefix} ${description}`);
    }
}

export function finish(apply) {
    console.log(`\n${apply ? 'Aplicados' : 'Simulados'} ${changeCount} cambios.`);
    if (!apply && changeCount > 0) {
        console.log('Si se ve bien, volve a correr con --apply.');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gate de validacion pre-commit para AMFE documents
// ─────────────────────────────────────────────────────────────────────────────

import { validateAmfeDoc, diffIssues, printIssues } from './amfeValidator.mjs';

/**
 * Gate obligatorio ANTES de escribir cambios a amfe_documents.
 * Valida estado before vs after y bloquea el apply si introduce issues criticos.
 *
 * @param {Array<{id, amfeNumber, productName, before, after}>} plan
 *        Cambios propuestos. `before` y `after` son objetos AMFE parseados.
 * @param {boolean} apply - Si true y hay criticos nuevos, aborta con exit 1.
 * @param {Function} commitFn - async function que ejecuta el write real
 *        (solo se llama si apply=true Y no hay criticos nuevos bloqueantes).
 * @param {{allowNewCritical?: boolean}} [opts] - allowNewCritical=true permite
 *        pasar con override explicito (caso: script que arregla criticos existentes
 *        y puede dejar otros — requiere revision manual).
 * @returns {Promise<{blocked: boolean, introducedCritical: number, introducedWarning: number}>}
 */
export async function runWithValidation(plan, apply, commitFn, opts = {}) {
    let totalIntroducedCritical = 0;
    let totalIntroducedWarning = 0;
    const blockers = [];

    console.log(`\n=== VALIDACION PRE-COMMIT (${plan.length} doc${plan.length === 1 ? '' : 's'}) ===`);

    for (const change of plan) {
        const { id, amfeNumber, productName = '', before, after } = change;
        const label = amfeNumber || id || '(sin id)';

        const beforeIssues = validateAmfeDoc(before, productName, label);
        const afterIssues = validateAmfeDoc(after, productName, label);
        const introduced = diffIssues(beforeIssues, afterIssues);

        const newCrit = introduced.critical.length;
        const newWarn = introduced.warning.length;
        totalIntroducedCritical += newCrit;
        totalIntroducedWarning += newWarn;

        if (newCrit > 0 || newWarn > 0) {
            console.log(`\n[${label}] introduce ${newCrit} crit + ${newWarn} warn`);
            printIssues('NUEVOS', introduced);
            if (newCrit > 0) blockers.push({ id, amfeNumber, newCrit });
        } else {
            console.log(`[${label}] OK — no introduce nuevos issues`);
        }
    }

    console.log(`\n=== TOTAL: ${totalIntroducedCritical} crit + ${totalIntroducedWarning} warn introducidos ===`);

    const shouldBlock = totalIntroducedCritical > 0 && apply && !opts.allowNewCritical;

    if (shouldBlock) {
        console.error('\n❌ BLOQUEADO: el cambio introduce issues criticos nuevos.');
        console.error('   Revisar el script o correr con --allow-new-critical si se justifica.');
        process.exit(1);
    }

    if (apply) {
        console.log('\n→ Validacion OK, ejecutando commit...');
        await commitFn();
    } else {
        console.log('\n→ Dry-run: no se escribio a Supabase. Agrega --apply cuando este OK.');
    }

    return {
        blocked: shouldBlock,
        introducedCritical: totalIntroducedCritical,
        introducedWarning: totalIntroducedWarning,
    };
}
