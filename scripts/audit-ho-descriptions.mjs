#!/usr/bin/env node
/**
 * Audit: HO Step Descriptions vs AMFE Data
 *
 * READ-ONLY — does NOT modify any data.
 *
 * For Insert and Armrest projects, loads both the AMFE and HO documents,
 * then checks whether HO step descriptions are genuinely independent
 * operator instructions or just copies/stubs from AMFE data.
 *
 * Classification per sheet:
 *   OK   - Descripcion propia (steps are unique operator instructions)
 *   WARN - Posiblemente copiada (steps contain AMFE text verbatim)
 *   STUB - Generico (step is just "Realizar <OPERATION_NAME>")
 */

import { initSupabase, selectSql, close } from './supabaseHelper.mjs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalize(str) {
    return (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Check if a is a substring of b or vice-versa (case-insensitive, min length 5). */
function isSubstring(a, b) {
    const na = normalize(a);
    const nb = normalize(b);
    if (na.length < 5 || nb.length < 5) return false;
    return na.includes(nb) || nb.includes(na);
}

/** Check if text matches "Realizar <something>" pattern. */
function isGenericStub(description, operationName) {
    const nd = normalize(description);
    const no = normalize(operationName);
    // Exact match: "realizar <opName>"
    if (nd === `realizar ${no}`) return true;
    // Starts with "realizar" and closely matches the operation name
    if (nd.startsWith('realizar ') && isSubstring(nd.replace('realizar ', ''), no)) return true;
    return false;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const TARGETS = [
    {
        label: 'INSERT',
        amfeQuery: `SELECT project_name, data FROM amfe_documents WHERE project_name ILIKE '%INSERT%'`,
    },
    {
        label: 'ARMREST',
        amfeQuery: `SELECT project_name, data FROM amfe_documents WHERE project_name ILIKE '%ARMREST%'`,
    },
];

async function main() {
    await initSupabase();
    console.log('\n========================================================');
    console.log('  AUDIT: HO Step Descriptions vs AMFE Data');
    console.log('  READ-ONLY — no modifications');
    console.log('========================================================\n');

    for (const target of TARGETS) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`  Project group: ${target.label}`);
        console.log(`${'─'.repeat(60)}`);

        // 1. Load AMFE
        const amfeRows = await selectSql(target.amfeQuery);
        if (!amfeRows.length) {
            console.log(`  [!] No AMFE found for ${target.label}`);
            continue;
        }

        for (const amfeRow of amfeRows) {
            const amfeProjectName = amfeRow.project_name;
            const amfeData = typeof amfeRow.data === 'string' ? JSON.parse(amfeRow.data) : amfeRow.data;
            const amfeOps = amfeData.operations || [];

            console.log(`\n  AMFE: ${amfeProjectName} (${amfeOps.length} operations)`);

            // Build AMFE lookup: opNumber -> { name, workElementNames[] }
            const amfeLookup = {};
            for (const op of amfeOps) {
                const weNames = (op.workElements || []).map(we => we.name).filter(Boolean);
                amfeLookup[op.opNumber] = {
                    name: op.name || '',
                    workElementNames: weNames,
                };
            }

            // 2. Load HO linked to this AMFE project
            //    Try exact match first, then fallback to base name without [Lx] suffix
            let hoRows = await selectSql(
                `SELECT id, linked_amfe_project, data FROM ho_documents WHERE linked_amfe_project = '${amfeProjectName.replace(/'/g, "''")}'`
            );
            if (!hoRows.length) {
                // Try base name (strip " [L0]", " [L1]", etc.)
                const baseName = amfeProjectName.replace(/\s*\[L\d+\]\s*$/, '');
                if (baseName !== amfeProjectName) {
                    hoRows = await selectSql(
                        `SELECT id, linked_amfe_project, data FROM ho_documents WHERE linked_amfe_project = '${baseName.replace(/'/g, "''")}'`
                    );
                    if (hoRows.length) {
                        console.log(`  (matched HO via base name: ${baseName})`);
                    }
                }
            }

            if (!hoRows.length) {
                console.log(`  [!] No HO linked to ${amfeProjectName}`);
                continue;
            }

            for (const hoRow of hoRows) {
                const hoData = typeof hoRow.data === 'string' ? JSON.parse(hoRow.data) : hoRow.data;
                const sheets = hoData.sheets || [];

                console.log(`  HO doc: ${hoRow.id.substring(0, 8)}... (${sheets.length} sheets)`);
                console.log('');

                // Table header
                console.log(
                    '  ' +
                    'Op#'.padEnd(8) +
                    'Operation Name'.padEnd(35) +
                    'Steps'.padEnd(7) +
                    'Classification'.padEnd(30) +
                    'Details'
                );
                console.log('  ' + '─'.repeat(120));

                let okCount = 0, warnCount = 0, stubCount = 0, noMatchCount = 0;

                for (const sheet of sheets) {
                    const opNum = sheet.operationNumber || '?';
                    const opName = sheet.operationName || '';
                    const steps = sheet.steps || [];
                    const stepCount = steps.length;

                    // Find matching AMFE operation
                    const amfeOp = amfeLookup[opNum];

                    if (!amfeOp) {
                        console.log(
                            '  ' +
                            opNum.padEnd(8) +
                            opName.substring(0, 33).padEnd(35) +
                            String(stepCount).padEnd(7) +
                            'N/A - No AMFE match'.padEnd(30) +
                            `opNum "${opNum}" not in AMFE`
                        );
                        noMatchCount++;
                        continue;
                    }

                    // Classify each step
                    const issues = [];
                    let hasStub = false;
                    let hasAmfeCopy = false;
                    let hasOwnContent = false;

                    for (const step of steps) {
                        const desc = step.description || '';
                        if (!desc.trim()) continue;

                        // Check 1: Generic stub "Realizar <opName>"
                        if (isGenericStub(desc, amfeOp.name)) {
                            hasStub = true;
                            issues.push(`Step ${step.stepNumber}: STUB "${desc.substring(0, 40)}"`);
                            continue;
                        }

                        // Check 2: Step description is substring of / equals an AMFE work element name
                        let matchedWE = false;
                        for (const weName of amfeOp.workElementNames) {
                            if (isSubstring(desc, weName)) {
                                hasAmfeCopy = true;
                                matchedWE = true;
                                issues.push(`Step ${step.stepNumber}: matches WE "${weName.substring(0, 30)}"`);
                                break;
                            }
                        }

                        // Check 3: Step contains the AMFE operation name verbatim (beyond "Realizar X")
                        if (!matchedWE && amfeOp.name.length >= 5) {
                            const nDesc = normalize(desc);
                            const nOpName = normalize(amfeOp.name);
                            if (nDesc.includes(nOpName) && nDesc !== nOpName) {
                                hasAmfeCopy = true;
                                issues.push(`Step ${step.stepNumber}: contains op name "${amfeOp.name.substring(0, 30)}"`);
                                continue;
                            }
                        }

                        if (!matchedWE) {
                            hasOwnContent = true;
                        }
                    }

                    // Final classification
                    let classification;
                    if (stepCount === 0) {
                        classification = 'EMPTY - Sin pasos';
                        stubCount++;
                    } else if (hasStub && !hasOwnContent && !hasAmfeCopy) {
                        classification = 'STUB - Generico';
                        stubCount++;
                    } else if (hasAmfeCopy && !hasOwnContent) {
                        classification = 'WARN - Posiblemente copiada';
                        warnCount++;
                    } else if (hasAmfeCopy && hasOwnContent) {
                        classification = 'WARN - Mixta (parcial copia)';
                        warnCount++;
                    } else {
                        classification = 'OK - Descripcion propia';
                        okCount++;
                    }

                    const detail = issues.length > 0 ? issues.join(' | ') : '(all steps unique)';
                    console.log(
                        '  ' +
                        opNum.padEnd(8) +
                        opName.substring(0, 33).padEnd(35) +
                        String(stepCount).padEnd(7) +
                        classification.padEnd(30) +
                        detail.substring(0, 80)
                    );

                    // Print remaining issue details on separate lines if truncated
                    if (detail.length > 80) {
                        console.log('  ' + ' '.repeat(80) + detail.substring(80));
                    }
                }

                console.log('  ' + '─'.repeat(120));
                console.log(`  Summary: OK=${okCount}  WARN=${warnCount}  STUB=${stubCount}  NoMatch=${noMatchCount}  Total=${sheets.length}`);
            }
        }
    }

    console.log('\n\n========================================================');
    console.log('  AUDIT COMPLETE (read-only, no changes made)');
    console.log('========================================================\n');

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});
