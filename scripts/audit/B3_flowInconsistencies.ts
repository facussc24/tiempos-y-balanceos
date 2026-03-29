/**
 * B3_flowInconsistencies.ts
 *
 * Audits cross-document flow consistency across the 4 APQP documents:
 *   PFD → AMFE → CP → HO
 *
 * For each product family, checks that operations defined in one document
 * exist in the others (coverage), and flags inconsistencies.
 */

import {
    ensureAuth,
    fetchAllPfdDocs,
    fetchAllAmfeDocs,
    fetchAllCpDocs,
    fetchAllHoDocs,
    fetchProductFamilies,
    fetchFamilyDocuments,
    normOp,
    writeResults,
} from './supabaseHelper.js';

// ── Types ──────────────────────────────────────────────────────────────

interface Finding {
    family: string;
    product: string;
    opNumber: string;
    opName: string;
    inPFD: boolean;
    inAMFE: boolean;
    inCP: boolean;
    inHO: boolean;
    inconsistency: string;
}

interface FamilySummary {
    family: string;
    product: string;
    pfdSteps: number;
    amfeOps: number;
    cpOps: number;
    hoSheets: number;
    findings: Finding[];
}

interface AuditResult {
    timestamp: string;
    totalFamilies: number;
    totalFindings: number;
    families: FamilySummary[];
}

// ── Matching helpers ───────────────────────────────────────────────────

function opsMatch(name1: string, name2: string): boolean {
    const n1 = normOp(name1);
    const n2 = normOp(name2);
    if (!n1 || !n2) return false;
    // Exact match
    if (n1 === n2) return true;
    // One contains the other (some docs abbreviate)
    if (n1.length >= 3 && n2.length >= 3) {
        if (n1.includes(n2) || n2.includes(n1)) return true;
    }
    // Match by significant words (skip "op", leading numbers)
    const words1 = n1.replace(/^op\s*\d+\s*/i, '').split(/\s+/).filter(w => w.length > 2);
    const words2 = n2.replace(/^op\s*\d+\s*/i, '').split(/\s+/).filter(w => w.length > 2);
    if (words1.length > 0 && words2.length > 0) {
        const overlap = words1.filter(w => words2.includes(w)).length;
        const total = Math.max(words1.length, words2.length);
        if (total > 0 && overlap / total >= 0.5) return true;
    }
    return false;
}

/** Normalize a step/op number to a plain integer string, or '' if invalid */
function normalizeNum(num: string | number | undefined): string {
    if (num == null) return '';
    const n = parseInt(String(num).replace(/\D/g, ''), 10);
    return isNaN(n) ? '' : String(n);
}

// ── PFD step types that should exist in AMFE/CP/HO ────────────────────

const AUDITABLE_PFD_TYPES = new Set(['operation', 'inspection', 'operacion', 'inspeccion']);

function isAuditablePfdStep(step: any): boolean {
    const t = (step.stepType || step.type || '').toLowerCase().trim();
    // If no type is set, assume it's an operation (some PFDs omit the type)
    if (!t) return true;
    return AUDITABLE_PFD_TYPES.has(t);
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
    console.log('=== B3: Flow Inconsistencies Audit ===\n');
    await ensureAuth();

    // Fetch all data in parallel
    const [pfdDocs, amfeDocs, cpDocs, hoDocs, families, familyDocs] = await Promise.all([
        fetchAllPfdDocs(),
        fetchAllAmfeDocs(),
        fetchAllCpDocs(),
        fetchAllHoDocs(),
        fetchProductFamilies(),
        fetchFamilyDocuments(),
    ]);

    console.log(`Loaded: ${pfdDocs.length} PFDs, ${amfeDocs.length} AMFEs, ${cpDocs.length} CPs, ${hoDocs.length} HOs`);
    console.log(`Families: ${families.length}, Family-doc links: ${familyDocs.length}\n`);

    // Index docs by id
    const pfdById = new Map(pfdDocs.map(d => [d.id, d]));
    const amfeById = new Map(amfeDocs.map(d => [d.id, d]));
    const cpById = new Map(cpDocs.map(d => [d.id, d]));
    const hoById = new Map(hoDocs.map(d => [d.id, d]));

    // Group family_documents by family_id
    const familyDocMap = new Map<string, any[]>();
    for (const fd of familyDocs) {
        const arr = familyDocMap.get(fd.family_id) || [];
        arr.push(fd);
        familyDocMap.set(fd.family_id, arr);
    }

    // Family name lookup
    const familyNameById = new Map<string, string>();
    for (const f of families) {
        familyNameById.set(f.id, f.name);
    }

    const allFamilySummaries: FamilySummary[] = [];

    for (const family of families) {
        const fDocs = familyDocMap.get(family.id) || [];
        // Get master documents only
        const masterPfd = fDocs.filter((d: any) => d.module === 'pfd' && d.is_master).map((d: any) => pfdById.get(d.document_id)).filter(Boolean);
        const masterAmfe = fDocs.filter((d: any) => d.module === 'amfe' && d.is_master).map((d: any) => amfeById.get(d.document_id)).filter(Boolean);
        const masterCp = fDocs.filter((d: any) => d.module === 'cp' && d.is_master).map((d: any) => cpById.get(d.document_id)).filter(Boolean);
        const masterHo = fDocs.filter((d: any) => d.module === 'ho' && d.is_master).map((d: any) => hoById.get(d.document_id)).filter(Boolean);

        if (masterPfd.length === 0 && masterAmfe.length === 0 && masterCp.length === 0 && masterHo.length === 0) {
            console.log(`⚠ Family "${family.name}": no master documents found, skipping.`);
            continue;
        }

        const productName = masterAmfe[0]?.raw?.project_name || masterCp[0]?.raw?.project_name || masterPfd[0]?.raw?.part_name || family.name;

        // ── Extract operations from each doc type ──

        // PFD steps (only auditable types)
        interface OpEntry { num: string; name: string; }
        const pfdOps: OpEntry[] = [];
        for (const doc of masterPfd) {
            const steps = doc.parsed?.steps || [];
            for (const step of steps) {
                if (!isAuditablePfdStep(step)) continue;
                pfdOps.push({
                    num: normalizeNum(step.stepNumber),
                    name: step.description || step.name || '',
                });
            }
        }

        // AMFE operations
        const amfeOps: OpEntry[] = [];
        for (const doc of masterAmfe) {
            const ops = doc.parsed?.operations || [];
            for (const op of ops) {
                amfeOps.push({
                    num: normalizeNum(op.opNumber),
                    name: op.name || '',
                });
            }
        }

        // CP items → unique operations
        const cpOpsMap = new Map<string, OpEntry>();
        for (const doc of masterCp) {
            const items = doc.parsed?.items || [];
            for (const item of items) {
                const num = normalizeNum(item.processStepNumber);
                if (num && !cpOpsMap.has(num)) {
                    cpOpsMap.set(num, {
                        num,
                        name: item.processDescription || '',
                    });
                }
            }
        }
        const cpOps: OpEntry[] = Array.from(cpOpsMap.values());

        // HO sheets
        const hoOps: OpEntry[] = [];
        for (const doc of masterHo) {
            const sheets = doc.parsed?.sheets || [];
            for (const sheet of sheets) {
                hoOps.push({
                    num: normalizeNum(sheet.sheetNumber),
                    name: sheet.title || '',
                });
            }
        }

        // ── Build unified operation list ──
        // Collect all unique operation numbers across all docs
        const allNums = new Set<string>();
        const allEntries: { num: string; name: string; source: string }[] = [];

        for (const op of pfdOps) {
            if (op.num) allNums.add(op.num);
            allEntries.push({ ...op, source: 'PFD' });
        }
        for (const op of amfeOps) {
            if (op.num) allNums.add(op.num);
            allEntries.push({ ...op, source: 'AMFE' });
        }
        for (const op of cpOps) {
            if (op.num) allNums.add(op.num);
            allEntries.push({ ...op, source: 'CP' });
        }
        for (const op of hoOps) {
            if (op.num) allNums.add(op.num);
            allEntries.push({ ...op, source: 'HO' });
        }

        // ── Check coverage for each operation number ──
        const findings: Finding[] = [];

        for (const num of [...allNums].sort((a, b) => parseInt(a) - parseInt(b))) {
            // Find the best name for this operation (prefer AMFE, then PFD, then CP, then HO)
            const amfeMatch = amfeOps.find(o => o.num === num);
            const pfdMatch = pfdOps.find(o => o.num === num);
            const cpMatch = cpOps.find(o => o.num === num);
            const hoMatch = hoOps.find(o => o.num === num);

            // Also try name-based matching (for cases where numbers differ slightly)
            const bestName = amfeMatch?.name || pfdMatch?.name || cpMatch?.name || hoMatch?.name || `Op ${num}`;

            const inPFD = !!pfdMatch || pfdOps.some(o => opsMatch(o.name, bestName));
            const inAMFE = !!amfeMatch || amfeOps.some(o => opsMatch(o.name, bestName));
            const inCP = !!cpMatch || cpOps.some(o => opsMatch(o.name, bestName));
            const inHO = !!hoMatch || hoOps.some(o => opsMatch(o.name, bestName));

            // Build inconsistency description
            const missing: string[] = [];
            if (!inPFD) missing.push('PFD');
            if (!inAMFE) missing.push('AMFE');
            if (!inCP) missing.push('CP');
            if (!inHO) missing.push('HO');

            if (missing.length > 0) {
                // Determine the source(s) where it IS present
                const present: string[] = [];
                if (inPFD) present.push('PFD');
                if (inAMFE) present.push('AMFE');
                if (inCP) present.push('CP');
                if (inHO) present.push('HO');

                findings.push({
                    family: family.name,
                    product: productName,
                    opNumber: num,
                    opName: bestName,
                    inPFD,
                    inAMFE,
                    inCP,
                    inHO,
                    inconsistency: `Op ${num} "${bestName}" missing from ${missing.join(', ')} (present in ${present.join(', ')})`,
                });
            }
        }

        // ── Also check for name mismatches on same number ──
        for (const num of allNums) {
            const names: { source: string; name: string }[] = [];
            const pfdMatch = pfdOps.find(o => o.num === num);
            const amfeMatch = amfeOps.find(o => o.num === num);
            const cpMatch = cpOps.find(o => o.num === num);
            const hoMatch = hoOps.find(o => o.num === num);

            if (pfdMatch?.name) names.push({ source: 'PFD', name: pfdMatch.name });
            if (amfeMatch?.name) names.push({ source: 'AMFE', name: amfeMatch.name });
            if (cpMatch?.name) names.push({ source: 'CP', name: cpMatch.name });
            if (hoMatch?.name) names.push({ source: 'HO', name: hoMatch.name });

            // Check pairwise name mismatches
            for (let i = 0; i < names.length; i++) {
                for (let j = i + 1; j < names.length; j++) {
                    if (!opsMatch(names[i].name, names[j].name)) {
                        // Only report once per op number
                        const alreadyReported = findings.some(f =>
                            f.family === family.name && f.opNumber === num && f.inconsistency.includes('name mismatch')
                        );
                        if (!alreadyReported) {
                            findings.push({
                                family: family.name,
                                product: productName,
                                opNumber: num,
                                opName: `${names[i].name} / ${names[j].name}`,
                                inPFD: !!pfdMatch,
                                inAMFE: !!amfeMatch,
                                inCP: !!cpMatch,
                                inHO: !!hoMatch,
                                inconsistency: `Op ${num} name mismatch: ${names[i].source}="${names[i].name}" vs ${names[j].source}="${names[j].name}"`,
                            });
                        }
                    }
                }
            }
        }

        const summary: FamilySummary = {
            family: family.name,
            product: productName,
            pfdSteps: pfdOps.length,
            amfeOps: amfeOps.length,
            cpOps: cpOps.length,
            hoSheets: hoOps.length,
            findings: findings.sort((a, b) => parseInt(a.opNumber) - parseInt(b.opNumber)),
        };
        allFamilySummaries.push(summary);

        // Print summary
        const icon = findings.length === 0 ? '✅' : '⚠';
        console.log(`${icon} ${family.name} (${productName})`);
        console.log(`   PFD: ${pfdOps.length} ops | AMFE: ${amfeOps.length} ops | CP: ${cpOps.length} ops | HO: ${hoOps.length} sheets`);
        if (findings.length > 0) {
            console.log(`   ${findings.length} inconsistencies:`);
            for (const f of findings) {
                console.log(`     - ${f.inconsistency}`);
            }
        }
        console.log();
    }

    // ── Summary ──
    const totalFindings = allFamilySummaries.reduce((s, f) => s + f.findings.length, 0);
    console.log('━'.repeat(60));
    console.log(`TOTAL: ${allFamilySummaries.length} families audited, ${totalFindings} inconsistencies found.\n`);

    // Group findings by type for a high-level view
    const missingFromPFD = allFamilySummaries.flatMap(f => f.findings).filter(f => !f.inPFD && !f.inconsistency.includes('name mismatch'));
    const missingFromAMFE = allFamilySummaries.flatMap(f => f.findings).filter(f => !f.inAMFE && !f.inconsistency.includes('name mismatch'));
    const missingFromCP = allFamilySummaries.flatMap(f => f.findings).filter(f => !f.inCP && !f.inconsistency.includes('name mismatch'));
    const missingFromHO = allFamilySummaries.flatMap(f => f.findings).filter(f => !f.inHO && !f.inconsistency.includes('name mismatch'));
    const nameMismatches = allFamilySummaries.flatMap(f => f.findings).filter(f => f.inconsistency.includes('name mismatch'));

    console.log('By type:');
    console.log(`  Missing from PFD:  ${missingFromPFD.length}`);
    console.log(`  Missing from AMFE: ${missingFromAMFE.length}`);
    console.log(`  Missing from CP:   ${missingFromCP.length}`);
    console.log(`  Missing from HO:   ${missingFromHO.length}`);
    console.log(`  Name mismatches:   ${nameMismatches.length}`);

    // ── Write results ──
    const result: AuditResult = {
        timestamp: new Date().toISOString(),
        totalFamilies: allFamilySummaries.length,
        totalFindings,
        families: allFamilySummaries,
    };
    writeResults('B3_flowInconsistencies.json', result);
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
