#!/usr/bin/env node
/**
 * AUDIT: Detailed AP=H verification against AIAG-VDA 2019 table
 *
 * Extracts all AMFE causes from Supabase and verifies their AP classification.
 * Outputs a detailed report of all misclassified causes.
 *
 * Usage: node scripts/audit-ap-detailed.mjs
 */

import { initSupabase, selectSql, close } from './supabaseHelper.mjs';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── AIAG-VDA 2019 Action Priority Table (PFMEA) ───────────────────────────
// Exact reproduction of the AIAG & VDA FMEA Handbook 1st Ed. 2019 PFMEA AP table.
// Severity ranges: 9-10, 7-8, 4-6, 2-3, 1
// Returns 'H', 'M', or 'L' based on S, O, D values (1-10 each)
function calcAP_AIAG_VDA(severity, occurrence, detection) {
    const s = Number(severity) || 1;
    const o = Number(occurrence) || 1;
    const d = Number(detection) || 1;

    // S = 1: Always L
    if (s <= 1) return 'L';

    // S = 2-3: Only M when O=8-10 and D=5-10
    if (s >= 2 && s <= 3) {
        if (o >= 8 && d >= 5) return 'M';
        return 'L';
    }

    // S = 4-6
    if (s >= 4 && s <= 6) {
        if (o >= 8) {
            if (d >= 5) return 'H';  // O=8-10, D=5-10 → H
            return 'M';              // O=8-10, D=1-4 → M
        }
        if (o >= 6) {               // O=6-7
            if (d >= 2) return 'M';  // D=2-10 → M
            return 'L';              // D=1 → L
        }
        if (o >= 4) {               // O=4-5
            if (d >= 7) return 'M';  // D=7-10 → M
            return 'L';              // D=1-6 → L
        }
        return 'L';                  // O=1-3 → always L
    }

    // S = 7-8
    if (s >= 7 && s <= 8) {
        if (o >= 8) return 'H';      // O=8-10, any D → H
        if (o >= 6) {               // O=6-7
            if (d >= 2) return 'H';  // D=2-10 → H
            return 'M';              // D=1 → M
        }
        if (o >= 4) {               // O=4-5
            if (d >= 7) return 'H';  // D=7-10 → H
            return 'M';              // D=1-6 → M
        }
        if (o >= 2) {               // O=2-3
            if (d >= 5) return 'M';  // D=5-10 → M
            return 'L';              // D=1-4 → L
        }
        return 'L';                  // O=1 → always L
    }

    // S = 9-10
    if (s >= 9) {
        if (o >= 6) return 'H';      // O=6-10, any D → H
        if (o >= 4) {               // O=4-5
            if (d >= 2) return 'H';  // D=2-10 → H
            return 'M';              // D=1 → M
        }
        if (o >= 2) {               // O=2-3
            if (d >= 7) return 'H';  // D=7-10 → H
            if (d >= 5) return 'M';  // D=5-6 → M
            return 'L';              // D=1-4 → L
        }
        return 'L';                  // O=1 → always L
    }

    return 'L';
}

// ─── Extract all causes from AMFE document data ─────────────────────────────
function extractCauses(doc) {
    const results = [];
    const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
    if (!data || !data.operations) return results;

    for (const op of data.operations) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    const severity = Number(fail.severity) || 0;
                    for (const cause of (fail.causes || [])) {
                        const occ = Number(cause.occurrence) || 0;
                        const det = Number(cause.detection) || 0;
                        const currentAP = (cause.ap || '').toUpperCase();
                        const correctAP = (severity > 0 && occ > 0 && det > 0)
                            ? calcAP_AIAG_VDA(severity, occ, det)
                            : '';

                        results.push({
                            amfeNumber: data.header?.amfeNumber || doc.amfe_number || '',
                            projectName: doc.project_name || '',
                            opNumber: op.opNumber || '',
                            opName: op.name || '',
                            weType: we.type || '',
                            weName: we.name || '',
                            failureDesc: fail.description || '',
                            causeText: (cause.cause || '').substring(0, 80),
                            S: severity,
                            O: occ,
                            D: det,
                            currentAP,
                            correctAP,
                            match: currentAP === correctAP,
                            preventionAction: cause.preventionAction || '',
                            detectionAction: cause.detectionAction || '',
                        });
                    }
                }
            }
        }
    }
    return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
    await initSupabase();
    console.log('\n  Fetching all AMFE documents...');

    const docs = await selectSql(
        `SELECT id, amfe_number, project_name, data FROM amfe_documents ORDER BY project_name`
    );

    console.log(`  Found ${docs.length} AMFE documents`);

    let allCauses = [];
    for (const doc of docs) {
        const causes = extractCauses(doc);
        allCauses.push(...causes);
    }

    console.log(`  Total causes extracted: ${allCauses.length}`);

    // Filter only causes with complete S/O/D
    const completeCauses = allCauses.filter(c => c.S > 0 && c.O > 0 && c.D > 0);
    console.log(`  Causes with complete S/O/D: ${completeCauses.length}`);

    // Separate by current AP
    const apH = completeCauses.filter(c => c.currentAP === 'H');
    const apM = completeCauses.filter(c => c.currentAP === 'M');
    const apL = completeCauses.filter(c => c.currentAP === 'L');

    console.log(`  AP=H: ${apH.length}, AP=M: ${apM.length}, AP=L: ${apL.length}`);

    // Find misclassified
    const inflatedH = apH.filter(c => !c.match);
    const deflatedM = apM.filter(c => !c.match);
    const deflatedL = apL.filter(c => !c.match);
    const allMisclassified = completeCauses.filter(c => !c.match);

    console.log(`\n  MISCLASSIFIED:`);
    console.log(`    AP=H inflated (should be M or L): ${inflatedH.length}`);
    console.log(`    AP=M wrong: ${deflatedM.length}`);
    console.log(`    AP=L wrong: ${deflatedL.length}`);
    console.log(`    Total misclassified: ${allMisclassified.length}`);

    // Write JSON output for further processing
    const output = {
        summary: {
            totalDocuments: docs.length,
            totalCauses: allCauses.length,
            causesWithSOD: completeCauses.length,
            apH: apH.length,
            apM: apM.length,
            apL: apL.length,
            inflatedH: inflatedH.length,
            deflatedM: deflatedM.length,
            deflatedL: deflatedL.length,
            totalMisclassified: allMisclassified.length,
        },
        inflatedH: inflatedH.map(c => ({
            amfe: c.amfeNumber,
            project: c.projectName,
            op: `${c.opNumber} ${c.opName}`,
            cause: c.causeText,
            S: c.S, O: c.O, D: c.D,
            currentAP: c.currentAP,
            correctAP: c.correctAP,
            hasPreventionAction: !!c.preventionAction,
            hasDetectionAction: !!c.detectionAction,
        })),
        deflatedM: deflatedM.map(c => ({
            amfe: c.amfeNumber,
            project: c.projectName,
            op: `${c.opNumber} ${c.opName}`,
            cause: c.causeText,
            S: c.S, O: c.O, D: c.D,
            currentAP: c.currentAP,
            correctAP: c.correctAP,
        })),
        deflatedL: deflatedL.map(c => ({
            amfe: c.amfeNumber,
            project: c.projectName,
            op: `${c.opNumber} ${c.opName}`,
            cause: c.causeText,
            S: c.S, O: c.O, D: c.D,
            currentAP: c.currentAP,
            correctAP: c.correctAP,
        })),
        allCauses: completeCauses.map(c => ({
            amfe: c.amfeNumber,
            project: c.projectName,
            op: `${c.opNumber} ${c.opName}`,
            failure: c.failureDesc,
            cause: c.causeText,
            S: c.S, O: c.O, D: c.D,
            currentAP: c.currentAP,
            correctAP: c.correctAP,
            match: c.match,
        })),
    };

    const outPath = resolve(__dirname, '..', 'docs', 'audit_ap_detailed_data.json');
    writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`\n  Output written to: ${outPath}`);

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
