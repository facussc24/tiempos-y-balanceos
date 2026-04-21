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
