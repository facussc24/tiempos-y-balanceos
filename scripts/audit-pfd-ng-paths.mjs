#!/usr/bin/env node
/**
 * AUDIT: Check all PFDs for NG disposition paths
 *
 * For each PFD, verifies:
 * 1. Decision symbols (rombo) for quality checks
 * 2. Rework paths (retrabajo) with return arrows
 * 3. Scrap/sorteo dispositions for NG parts
 * 4. Cross-reference with CP reaction plans
 *
 * Usage: node scripts/audit-pfd-ng-paths.mjs
 */

import { initSupabase, selectSql, close } from './supabaseHelper.mjs';

async function main() {
    console.log('================================================================');
    console.log('  AUDIT: PFD NG Disposition Paths');
    console.log('================================================================\n');

    await initSupabase();

    // ── Load all PFDs ─────────────────────────────────────────────────────
    const pfdList = await selectSql(
        `SELECT id, part_name, document_number, step_count, customer_name, data
         FROM pfd_documents ORDER BY document_number`
    );

    console.log(`  Total PFDs found: ${pfdList.length}\n`);

    const auditResults = [];

    for (const pfd of pfdList) {
        const doc = JSON.parse(pfd.data);
        const steps = doc.steps || [];

        // ── Analyze steps ──────────────────────────────────────────────
        const decisions = steps.filter(s => s.stepType === 'decision');
        const inspections = steps.filter(s => s.stepType === 'inspection');
        const reworks = steps.filter(s => s.isRework === true);
        const scraps = steps.filter(s => s.rejectDisposition === 'scrap');
        const sorts = steps.filter(s => s.rejectDisposition === 'sort');
        const reworkDisp = steps.filter(s => s.rejectDisposition === 'rework');
        const hasAnyNgPath = decisions.length > 0 || reworks.length > 0 || scraps.length > 0;
        const branches = new Set(steps.filter(s => s.branchId).map(s => s.branchId));

        // ── Check for missing elements ─────────────────────────────────
        const issues = [];

        if (decisions.length === 0) {
            issues.push('MISSING: No decision symbols (rombos) for quality checks');
        }

        if (inspections.length === 0) {
            issues.push('MISSING: No inspection steps');
        }

        if (reworks.length === 0 && reworkDisp.length === 0) {
            issues.push('MISSING: No rework paths (retrabajo)');
        }

        if (scraps.length === 0) {
            issues.push('MISSING: No scrap dispositions for NG parts');
        }

        // Check if decisions have proper NG routing
        for (const d of decisions) {
            if (d.rejectDisposition === 'none' && !d.notes) {
                issues.push(`WARNING: Decision "${d.description}" has no reject disposition and no notes describing NG path`);
            }
        }

        // Check if inspections lead to decisions
        for (let i = 0; i < steps.length; i++) {
            if (steps[i].stepType === 'inspection') {
                // Look ahead for a decision within 3 steps
                let hasFollowingDecision = false;
                for (let j = i + 1; j < Math.min(i + 4, steps.length); j++) {
                    if (steps[j].stepType === 'decision') {
                        hasFollowingDecision = true;
                        break;
                    }
                }
                if (!hasFollowingDecision) {
                    // Check if the inspection itself has a reject disposition
                    if (steps[i].rejectDisposition === 'none') {
                        issues.push(`WARNING: Inspection "${steps[i].description}" (step ${steps[i].stepNumber || i}) has no following decision point and no reject disposition`);
                    }
                }
            }
        }

        const result = {
            docNumber: pfd.document_number,
            partName: pfd.part_name,
            stepCount: steps.length,
            decisions: decisions.length,
            inspections: inspections.length,
            reworks: reworks.length,
            scraps: scraps.length,
            sorts: sorts.length,
            reworkDisp: reworkDisp.length,
            branches: branches.size,
            hasAnyNgPath,
            issues,
            status: issues.length === 0 ? 'PASS' :
                    issues.some(i => i.startsWith('MISSING')) ? 'FAIL' : 'WARN',
        };
        auditResults.push(result);

        // ── Print per-PFD report ───────────────────────────────────────
        const statusIcon = result.status === 'PASS' ? 'OK' :
                          result.status === 'FAIL' ? 'FAIL' : 'WARN';
        console.log(`  [${statusIcon}] ${pfd.document_number} — ${pfd.part_name}`);
        console.log(`       Steps: ${steps.length} | Decisions: ${decisions.length} | Inspections: ${inspections.length}`);
        console.log(`       Reworks: ${reworks.length} | Scraps: ${scraps.length} | Sorts: ${sorts.length} | Branches: ${branches.size}`);

        if (issues.length > 0) {
            for (const issue of issues) {
                console.log(`       >> ${issue}`);
            }
        }

        // Print decision details
        if (decisions.length > 0) {
            console.log('       Decisions:');
            for (const d of decisions) {
                const disp = d.rejectDisposition !== 'none' ? ` [${d.rejectDisposition}]` : '';
                const desc = d.scrapDescription ? ` → ${d.scrapDescription}` : '';
                console.log(`         - "${d.description}"${disp}${desc}`);
            }
        }

        // Print rework details
        if (reworks.length > 0 || reworkDisp.length > 0) {
            console.log('       Rework paths:');
            for (const r of [...reworks, ...reworkDisp.filter(rd => !rd.isRework)]) {
                const ret = r.reworkReturnStep ? ` → returns to step ${r.reworkReturnStep}` : '';
                console.log(`         - "${r.description}" (${r.stepNumber})${ret}`);
            }
        }

        // Print scrap details
        if (scraps.length > 0) {
            console.log('       Scrap dispositions:');
            for (const s of scraps) {
                console.log(`         - "${s.description}" → ${s.scrapDescription || 'no description'}`);
            }
        }

        console.log('');
    }

    // ── Cross-reference with CP reaction plans ────────────────────────────
    console.log('================================================================');
    console.log('  CROSS-REFERENCE: PFD NG Paths vs CP Reaction Plans');
    console.log('================================================================\n');

    const cpList = await selectSql(
        `SELECT id, part_name, document_number, data FROM cp_documents ORDER BY document_number`
    );

    console.log(`  Total CPs found: ${cpList.length}\n`);

    for (const cp of cpList) {
        const cpDoc = JSON.parse(cp.data);
        const items = cpDoc.items || [];
        const reactionPlans = items.filter(i => i.reactionPlan && i.reactionPlan.trim() !== '');
        const reactionPlanActions = new Set();
        for (const item of reactionPlans) {
            const rp = item.reactionPlan.toLowerCase();
            if (rp.includes('scrap') || rp.includes('descart')) reactionPlanActions.add('scrap');
            if (rp.includes('retrab') || rp.includes('rework') || rp.includes('reproces')) reactionPlanActions.add('rework');
            if (rp.includes('sort') || rp.includes('selecci') || rp.includes('sorteo')) reactionPlanActions.add('sort');
            if (rp.includes('contener') || rp.includes('contain')) reactionPlanActions.add('contain');
            if (rp.includes('segreg')) reactionPlanActions.add('segregate');
        }

        console.log(`  CP: ${cp.document_number} — ${cp.part_name}`);
        console.log(`    Items with reaction plans: ${reactionPlans.length} / ${items.length}`);
        console.log(`    Reaction plan actions: ${[...reactionPlanActions].join(', ') || 'none detected'}`);

        // Find matching PFD
        const matchingPfd = auditResults.find(r =>
            r.partName && cp.part_name &&
            (r.partName.toLowerCase().includes(cp.part_name.toLowerCase().split(' ')[0]) ||
             cp.part_name.toLowerCase().includes(r.partName.toLowerCase().split(' ')[0]))
        );

        if (matchingPfd) {
            const pfdActions = new Set();
            if (matchingPfd.scraps > 0) pfdActions.add('scrap');
            if (matchingPfd.reworks > 0 || matchingPfd.reworkDisp > 0) pfdActions.add('rework');
            if (matchingPfd.sorts > 0) pfdActions.add('sort');

            const missingInPfd = [...reactionPlanActions].filter(a => !pfdActions.has(a));
            if (missingInPfd.length > 0) {
                console.log(`    GAP: CP has "${missingInPfd.join(', ')}" in reaction plans but PFD "${matchingPfd.docNumber}" lacks these disposition paths`);
            } else {
                console.log(`    MATCH: PFD "${matchingPfd.docNumber}" covers all CP reaction plan actions`);
            }
        } else {
            console.log(`    No matching PFD found for cross-reference`);
        }
        console.log('');
    }

    // ── Summary ───────────────────────────────────────────────────────────
    console.log('================================================================');
    console.log('  AUDIT SUMMARY');
    console.log('================================================================');

    const passed = auditResults.filter(r => r.status === 'PASS');
    const failed = auditResults.filter(r => r.status === 'FAIL');
    const warned = auditResults.filter(r => r.status === 'WARN');

    console.log(`\n  Total PFDs: ${auditResults.length}`);
    console.log(`  PASS: ${passed.length}`);
    console.log(`  WARN: ${warned.length}`);
    console.log(`  FAIL: ${failed.length}`);

    if (failed.length > 0) {
        console.log('\n  FAILED PFDs (need NG path additions):');
        for (const f of failed) {
            console.log(`    - ${f.docNumber}: ${f.issues.filter(i => i.startsWith('MISSING')).join('; ')}`);
        }
    }

    if (warned.length > 0) {
        console.log('\n  WARNED PFDs (minor issues):');
        for (const w of warned) {
            console.log(`    - ${w.docNumber}: ${w.issues.join('; ')}`);
        }
    }

    console.log('\n================================================================');

    close();
}

main().catch((err) => {
    console.error('\n  FATAL ERROR:', err.message);
    console.error(err.stack);
    close();
    process.exit(1);
});
