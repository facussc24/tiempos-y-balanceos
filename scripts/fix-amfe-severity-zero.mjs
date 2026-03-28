#!/usr/bin/env node
/**
 * Fix A: Correct severity=0 in AMFE failures for 3 headrest products.
 *
 * The 12 failures (4 per headrest) have severity=0 because they were created
 * without a severity value. We assign realistic values based on the failure description
 * per the calibration rules in .claude/rules/amfe.md.
 *
 * Also fills in empty cause descriptions where missing.
 * Recalculates AP after fixing severity.
 *
 * Run: node scripts/fix-amfe-severity-zero.mjs
 */
import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';

// AP calculation per AIAG-VDA 2019 PFMEA standard
function apRule(s, o, d) {
    if (s <= 1) return 'L';
    if (s <= 3) {
        if (o >= 8 && d >= 5) return 'M';
        return 'L';
    }
    if (s <= 6) {
        if (o >= 8) return d >= 5 ? 'H' : 'M';
        if (o >= 6) return d >= 2 ? 'M' : 'L';
        if (o >= 4) return d >= 7 ? 'M' : 'L';
        return 'L';
    }
    if (s <= 8) {
        if (o >= 8) return 'H';
        if (o >= 6) return d >= 2 ? 'H' : 'M';
        if (o >= 4) return d >= 7 ? 'H' : 'M';
        if (o >= 2) return d >= 5 ? 'M' : 'L';
        return 'L';
    }
    if (o >= 6) return 'H';
    if (o >= 4) return d >= 2 ? 'H' : 'M';
    if (o >= 2) {
        if (d >= 7) return 'H';
        if (d >= 5) return 'M';
        return 'L';
    }
    return 'L';
}

// Severity assignments based on failure description and AMFE calibration rules:
// S=5-6: Arrugas masivas, delaminacion, costura torcida, Squeak & Rattle, retrabajo offline
// S=3-4: Cosmetico menor, hilo suelto, mancha limpiable, retrabajo in-station
const SEVERITY_MAP = {
    'Ensamblar componente con color equivocado': { severity: 5, causeDesc: 'Error en identificacion de color vs Orden de Produccion' },
    'Puntada fuera de tolerancia': { severity: 6, causeDesc: 'Set up de maquina incorrecto o desgaste de aguja' },
    'Hilo roto / costura incompleta': { severity: 6, causeDesc: 'Tension de hilo incorrecta o hilo defectuoso' },
    'Color de hilo incorrecto': { severity: 4, causeDesc: 'Error en seleccion de hilo vs Orden de Produccion' },
};

await initSupabase();

const amfes = await selectSql("SELECT id, project_name, data FROM amfe_documents WHERE project_name LIKE '%HEADREST%'");
let totalFixed = 0;

for (const amfe of amfes) {
    const data = typeof amfe.data === 'string' ? JSON.parse(amfe.data) : amfe.data;
    let changed = 0;

    for (const op of (data.operations || [])) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    const failSev = Number(fail.severity) || 0;
                    if (failSev === 0) {
                        // Find matching severity by failure description
                        const match = SEVERITY_MAP[fail.description];
                        if (match) {
                            fail.severity = match.severity;
                            console.log(`  ${amfe.project_name} OP${op.opNumber || '?'}: "${fail.description}" → S=${match.severity}`);

                            // Fix empty causes and recalculate AP
                            for (const cause of (fail.causes || [])) {
                                if (!cause.cause || cause.cause.trim() === '') {
                                    cause.cause = match.causeDesc;
                                }
                                const o = Number(cause.occurrence) || 0;
                                const d = Number(cause.detection) || 0;
                                if (o > 0 && d > 0) {
                                    const newAp = apRule(match.severity, o, d);
                                    console.log(`    Cause: "${cause.cause}" → AP=${newAp} (S=${match.severity} O=${o} D=${d})`);
                                    cause.ap = newAp;
                                }
                            }
                            changed++;
                        } else {
                            console.log(`  ⚠️ ${amfe.project_name} OP${op.opNumber || '?'}: no match for "${fail.description}"`);
                        }
                    }
                }
            }
        }
    }

    if (changed > 0) {
        const jsonStr = JSON.stringify(data).replace(/'/g, "''");
        await execSql(`UPDATE amfe_documents SET data = '${jsonStr}' WHERE id = '${amfe.id}'`);
        console.log(`  ✅ ${amfe.project_name}: ${changed} failures fixed\n`);
        totalFixed += changed;
    } else {
        console.log(`  ${amfe.project_name}: no fixes needed`);
    }
}

console.log(`\nDone. Total failures fixed: ${totalFixed}`);
close();
