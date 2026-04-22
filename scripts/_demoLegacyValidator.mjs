/**
 * _demoLegacyValidator.mjs — Demo READ-ONLY. Simula un cambio que vacia
 * fm.severity manteniendo cause.severity con valor, y verifica que el validator
 * lo detecta como CRITICO y bloquea.
 */
import { connectSupabase, readAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

// Tomar AMFE-1 (ahora que esta sincronizado)
const { doc: original, amfe_number } = await readAmfe(sb, '57011560-d4c1-4a8a-83f0-ed37a2bab1d5');

// Simular cambio malo: borrar fm.severity del primer failure con severity
const bad = JSON.parse(JSON.stringify(original));
let injected = false;
for (const op of bad.operations) {
    for (const we of op.workElements || []) {
        for (const fn of we.functions || []) {
            for (const fm of fn.failures || []) {
                if (!injected && fm.severity && (fm.causes || []).some(c => c.severity)) {
                    console.log(`Inyectando fallo en OP${op.opNumber} FM "${fm.description}"`);
                    console.log(`  fm.severity=${fm.severity} -> ""`);
                    console.log(`  cause[0].severity=${fm.causes[0].severity} (queda igual)`);
                    fm.severity = '';
                    injected = true;
                }
            }
        }
    }
}

const plan = [{
    id: 'demo-id',
    amfeNumber: `${amfe_number} [DEMO LEGACY BAD]`,
    productName: 'TELAS_PLANAS',
    before: original,
    after: bad,
}];

let commitCalled = false;
await runWithValidation(plan, apply, async () => {
    commitCalled = true;
    console.log('  ERROR: commit no deberia haberse ejecutado');
});

console.log(`\ncommit ejecutado: ${commitCalled}  (esperado: false si --apply)`);
finish(apply);
