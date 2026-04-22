/**
 * _syncLegacyFmFields.mjs — Dispara syncLegacyFmFields() sobre todos los AMFEs
 * que tengan campos legacy a nivel fm vacios con cause[] poblado.
 *
 * Complementa el auto-sync incorporado en saveAmfe(): este script barre los
 * docs existentes y corrige el estado. A partir de hoy, cualquier saveAmfe
 * futura lo hace automatico.
 *
 * Uso:
 *   node scripts/_syncLegacyFmFields.mjs         # dry-run
 *   node scripts/_syncLegacyFmFields.mjs --apply # aplicar
 */
import { connectSupabase, readAmfe, saveAmfe, listAmfes, syncLegacyFmFields } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const amfes = await listAmfes(sb);
console.log(`Auditando ${amfes.length} AMFEs...\n`);

const plan = [];

for (const meta of amfes) {
    const { doc, amfe_number, row } = await readAmfe(sb, meta.id);
    const before = JSON.parse(JSON.stringify(doc));
    const after = JSON.parse(JSON.stringify(doc));

    const { synced } = syncLegacyFmFields(after);

    if (synced === 0) {
        console.log(`  [OK] ${amfe_number} — 0 sync`);
        continue;
    }

    console.log(`  [SYNC] ${amfe_number} — ${synced} fields sincronizados`);

    plan.push({
        id: meta.id,
        amfeNumber: amfe_number,
        productName: row.project_name,
        before,
        after,
    });
}

if (plan.length === 0) {
    console.log('\nNo hay AMFEs para sincronizar. Todo limpio.');
    finish(apply);
    process.exit(0);
}

await runWithValidation(plan, apply, async () => {
    for (const change of plan) {
        // skipLegacySync: ya lo hicimos manualmente arriba, no duplicar.
        await saveAmfe(sb, change.id, change.after, {
            expectedAmfeNumber: change.amfeNumber,
            skipLegacySync: true,
        });
        console.log(`  ✓ ${change.amfeNumber} saved`);
    }
});

finish(apply);
