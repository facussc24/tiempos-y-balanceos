/**
 * _syncFieldAliases.mjs — Dispara syncFieldAliases() sobre todos los AMFEs
 * que tengan pares de aliases desincronizados.
 *
 * Complementa el auto-sync incorporado en saveAmfe(). A partir de hoy cualquier
 * saveAmfe futura lo hace automatico.
 *
 * Uso:
 *   node scripts/_syncFieldAliases.mjs         # dry-run
 *   node scripts/_syncFieldAliases.mjs --apply # aplicar
 */
import { connectSupabase, readAmfe, saveAmfe, listAmfes, syncFieldAliases } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const amfes = await listAmfes(sb);
console.log(`Auditando ${amfes.length} AMFEs para pares de aliases desincronizados...\n`);

const plan = [];

for (const meta of amfes) {
    const { doc, amfe_number, row } = await readAmfe(sb, meta.id);
    const before = JSON.parse(JSON.stringify(doc));
    const after = JSON.parse(JSON.stringify(doc));

    const { synced, byField } = syncFieldAliases(after);

    if (synced === 0) {
        console.log(`  [OK] ${amfe_number}`);
        continue;
    }

    const detail = Object.entries(byField).map(([k, v]) => `${v}×${k}`).join(', ');
    console.log(`  [SYNC] ${amfe_number} — ${synced} sync  (${detail})`);

    plan.push({
        id: meta.id,
        amfeNumber: amfe_number,
        productName: row.project_name,
        before,
        after,
    });
}

if (plan.length === 0) {
    console.log('\nTodo limpio. Nada que sincronizar.');
    finish(apply);
    process.exit(0);
}

await runWithValidation(plan, apply, async () => {
    for (const change of plan) {
        await saveAmfe(sb, change.id, change.after, {
            expectedAmfeNumber: change.amfeNumber,
            skipAliasSync: true,  // ya sincronizamos arriba
        });
        console.log(`  ✓ ${change.amfeNumber} saved`);
    }
});

finish(apply);
