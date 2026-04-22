/**
 * _demoValidator.mjs — Demo READ-ONLY del gate de validacion pre-commit.
 *
 * Toma el primer AMFE en Supabase, simula 2 cambios hipoteticos (1 inocuo,
 * 1 destructivo), y muestra como runWithValidation() detecta el malo.
 *
 * NO escribe a Supabase bajo ninguna circunstancia — aunque se pase --apply,
 * el commitFn es un no-op. El unico proposito es validar que el gate funciona.
 *
 * Uso:
 *   node scripts/_demoValidator.mjs          # simula cambios, muestra reporte
 */

import { connectSupabase, listAmfes, readAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();

const sb = await connectSupabase();
const amfes = await listAmfes(sb);
if (amfes.length === 0) {
    console.error('No hay AMFEs para probar. Saliendo.');
    process.exit(0);
}

// Tomar el primer AMFE disponible
const target = amfes[0];
console.log(`Target: ${target.amfe_number} (${target.project_name})`);

const { doc: original } = await readAmfe(sb, target.id);

// ─── Cambio 1: INOCUO — clonar el doc sin tocarlo ────────────────────────
const innocuous = JSON.parse(JSON.stringify(original));
// (no modificamos nada — should produce 0 new issues)

// ─── Cambio 2: WARNING — borrar effectLocal de un failure ────────────────
const warningChange = JSON.parse(JSON.stringify(original));
let warnInjected = false;
for (const op of warningChange.operations || []) {
    for (const we of op.workElements || []) {
        for (const fn of we.functions || []) {
            for (const fm of fn.failures || []) {
                if (!warnInjected && fm.effectLocal) {
                    fm.effectLocal = '';
                    warnInjected = true;
                }
            }
        }
    }
}

// ─── Cambio 3: CRITICO — borrar TODAS las causas de un failure ───────────
const criticalChange = JSON.parse(JSON.stringify(original));
let critInjected = false;
for (const op of criticalChange.operations || []) {
    for (const we of op.workElements || []) {
        for (const fn of we.functions || []) {
            for (const fm of fn.failures || []) {
                if (!critInjected && (fm.causes || []).length > 0) {
                    fm.causes = [];  // deja failure huerfano — CRITICO
                    critInjected = true;
                }
            }
        }
    }
}

// Armar el plan y pasarlo al gate
const plan = [
    {
        id: target.id + '-innocuous',
        amfeNumber: `${target.amfe_number} [INOCUO]`,
        productName: target.project_name,
        before: original,
        after: innocuous,
    },
    {
        id: target.id + '-warning',
        amfeNumber: `${target.amfe_number} [WARNING]`,
        productName: target.project_name,
        before: original,
        after: warningChange,
    },
    {
        id: target.id + '-critical',
        amfeNumber: `${target.amfe_number} [CRITICO]`,
        productName: target.project_name,
        before: original,
        after: criticalChange,
    },
];

let commitCalled = false;
const result = await runWithValidation(plan, apply, async () => {
    commitCalled = true;
    console.log('  (commitFn dummy: NO se escribe nada — esto es una demo)');
});

console.log('\n=== DEMO RESULT ===');
console.log(`  bloqueado: ${result.blocked}`);
console.log(`  criticos introducidos: ${result.introducedCritical}`);
console.log(`  warnings introducidos: ${result.introducedWarning}`);
console.log(`  commit ejecutado: ${commitCalled}`);

finish(apply);
