/**
 * E_diagnose_tbds.ts
 *
 * Diagnose all TBD/vague specifications across all CP documents in Supabase.
 * READ-ONLY — does not modify any data.
 */
import {
    ensureAuth,
    fetchAllCpDocs,
    fetchAllAmfeDocs,
    fetchAllHoDocs,
    writeResults,
} from './supabaseHelper.js';

// Patterns that indicate a TBD or vague specification
const VAGUE_PATTERNS = [
    /^tbd$/i,
    /\btbd\b/i,
    /^según especificación$/i,
    /^conforme a especificación$/i,
    /^según instrucción/i,
    /^conforme a instrucción/i,
    /^según patrón$/i,
    /^según plano$/i,     // only if no actual value
    /^según set-?up/i,
    /^según planilla/i,
    /^calibración correcta$/i,
    /^visual$/i,
    /^n\/a$/i,
    /^-$/,
    /^$/,
];

function isVague(spec: string): boolean {
    if (!spec || spec.trim() === '') return true;
    const trimmed = spec.trim();
    return VAGUE_PATTERNS.some(p => p.test(trimmed));
}

async function main() {
    console.log('=== Diagnose TBDs in CP Documents ===\n');
    await ensureAuth();

    const cpDocs = await fetchAllCpDocs();
    console.log(`Loaded ${cpDocs.length} CP documents\n`);

    const results: any[] = [];
    let totalItems = 0;
    let totalVague = 0;

    for (const cp of cpDocs) {
        const project = cp.raw.project_name as string || 'UNKNOWN';
        const partName = cp.raw.part_name as string || '';
        const items = cp.parsed.items || [];

        const vagueItems: any[] = [];
        for (const item of items) {
            totalItems++;
            const spec = (item.specification || '').trim();
            if (isVague(spec)) {
                totalVague++;
                vagueItems.push({
                    opNumber: item.processStepNumber,
                    opName: item.processDescription || item.processStepName || '',
                    productChar: item.productCharacteristic || '',
                    processChar: item.processCharacteristic || '',
                    currentSpec: spec || '(vacío)',
                    evalTechnique: item.evaluationTechnique || '',
                    specialChar: item.specialCharClass || '',
                });
            }
        }

        if (vagueItems.length > 0) {
            console.log(`\n[${project}] ${partName} — ${vagueItems.length}/${items.length} items vagos`);
            for (const v of vagueItems) {
                console.log(`  OP ${v.opNumber} | ${v.productChar || v.processChar} | spec: "${v.currentSpec}"`);
            }
            results.push({
                project,
                partName,
                docId: cp.id,
                totalItems: items.length,
                vagueCount: vagueItems.length,
                vagueItems,
            });
        }
    }

    console.log('\n\n════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('════════════════════════════════════════════════════');
    console.log(`  Total CP items: ${totalItems}`);
    console.log(`  Vague/TBD specs: ${totalVague}`);
    console.log(`  Documents with vague specs: ${results.length}/${cpDocs.length}`);

    // Also check AMFE for PWA fabric orientation
    console.log('\n\n=== PWA AMFE Check (Fabric Orientation) ===\n');
    const amfeDocs = await fetchAllAmfeDocs();
    for (const amfe of amfeDocs) {
        const project = amfe.raw.project_name as string || '';
        if (!project.includes('TELAS') && !project.includes('PWA')) continue;

        console.log(`\n[${project}]`);
        const ops = amfe.parsed.operations || [];
        for (const op of ops) {
            const opName = op.operationName || op.name || '';
            if (opName.toLowerCase().includes('costura') || opName.toLowerCase().includes('sewing')) {
                console.log(`  OP ${op.operationNumber} "${opName}"`);
                for (const we of op.workElements || []) {
                    for (const fn of we.functions || []) {
                        for (const fail of fn.failures || []) {
                            const desc = fail.description || '';
                            console.log(`    Failure: "${desc}"`);
                            if (desc.toLowerCase().includes('orientac') || desc.toLowerCase().includes('invert')) {
                                console.log(`    >>> FOUND orientation-related failure!`);
                            }
                        }
                    }
                }
            }
        }
    }

    // Check HO sheets for PWA costura
    console.log('\n\n=== PWA HO Check (Costura sheets) ===\n');
    const hoDocs = await fetchAllHoDocs();
    for (const ho of hoDocs) {
        const project = ho.raw.linked_amfe_project as string || '';
        if (!project.includes('TELAS') && !project.includes('PWA')) continue;

        console.log(`\n[${project}] ${ho.raw.part_description || ''}`);
        const sheets = ho.parsed.sheets || [];
        for (const sheet of sheets) {
            const opName = sheet.operationName || '';
            if (opName.toLowerCase().includes('costura') || opName.toLowerCase().includes('sewing')) {
                console.log(`  Sheet: ${sheet.hoNumber} OP ${sheet.operationNumber} "${opName}"`);
                console.log(`  Steps: ${(sheet.steps || []).length}`);
                console.log(`  QC Items: ${(sheet.qcItems || []).length}`);
            }
        }
    }

    writeResults('E_diagnose_tbds.json', {
        timestamp: new Date().toISOString(),
        summary: { totalItems, totalVague, docsWithVague: results.length },
        documents: results,
    });

    console.log('\nDone.');
}

main().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});
