#!/usr/bin/env node
/**
 * Comprehensive Integrity Verification Script (READ-ONLY)
 *
 * Checks 4 areas:
 *   1. Time-based frequencies in CP (must be 0)
 *   2. SGC references in CP reaction plans
 *   3. Database integrity (families, docs, duplicates, orphans, links, files)
 *   4. EPP coverage in HO sheets
 *
 * Uses ONLY selectSql() — never writes.
 */

import { initSupabase, selectSql, close } from './supabaseHelper.mjs';
import { existsSync } from 'fs';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function hr(char = '═', len = 80) { return char.repeat(len); }
function sectionHeader(title) {
    console.log('\n' + hr());
    console.log(`  ${title}`);
    console.log(hr());
}
function subHeader(title) {
    console.log(`\n  --- ${title} ---`);
}

let totalPass = 0;
let totalFail = 0;
let totalWarn = 0;

function pass(msg) { totalPass++; console.log(`  [PASS] ${msg}`); }
function fail(msg) { totalFail++; console.log(`  [FAIL] ${msg}`); }
function warn(msg) { totalWarn++; console.log(`  [WARN] ${msg}`); }
function info(msg) { console.log(`  [INFO] ${msg}`); }

// ═══════════════════════════════════════════════════════════════════════
// AREA 1: Time-based Frequencies
// ═══════════════════════════════════════════════════════════════════════

async function checkTimeFrequencies() {
    sectionHeader('AREA 1: Time-based Frequencies in CP (must be 0)');

    const rows = await selectSql('SELECT id, project_name, data FROM cp_documents ORDER BY project_name');
    info(`Loaded ${rows.length} CP documents`);

    const timePatterns = [
        /cada\s+hora/i,
        /cada\s+2\s+horas/i,
        /cada\s+3\s+horas/i,
        /cada\s+4\s+horas/i,
        /cada\s+10\s+piezas/i,
        /cada\s+30\s+minutos/i,
        /cada\s+15\s+min/i,
    ];

    const patternLabels = [
        'cada hora', 'cada 2 horas', 'cada 3 horas', 'cada 4 horas',
        'cada 10 piezas', 'cada 30 minutos', 'cada 15 min',
    ];

    const offenders = [];

    for (const row of rows) {
        const doc = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        const items = doc.items || [];
        for (const item of items) {
            const freq = item.sampleFrequency || '';
            for (let p = 0; p < timePatterns.length; p++) {
                if (timePatterns[p].test(freq)) {
                    offenders.push({
                        project: row.project_name,
                        itemId: item.id || '?',
                        operation: item.operationDescription || item.processStep || '?',
                        frequency: freq,
                        pattern: patternLabels[p],
                    });
                }
            }
        }
    }

    if (offenders.length === 0) {
        pass(`0 time-based frequencies found across ${rows.length} CPs`);
    } else {
        fail(`${offenders.length} time-based frequency/ies found!`);
        console.log('');
        console.log(`  ${'Project'.padEnd(40)} | ${'Operation'.padEnd(30)} | Pattern`);
        console.log('  ' + '-'.repeat(90));
        for (const o of offenders) {
            console.log(`  ${o.project.padEnd(40)} | ${o.operation.substring(0, 30).padEnd(30)} | ${o.pattern} → "${o.frequency}"`);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════
// AREA 2: SGC References in Reaction Plans
// ═══════════════════════════════════════════════════════════════════════

async function checkSgcReferences() {
    sectionHeader('AREA 2: SGC References in CP Reaction Plans');

    const rows = await selectSql('SELECT id, project_name, data FROM cp_documents ORDER BY project_name');
    info(`Loaded ${rows.length} CP documents`);

    const sgcPatterns = [/P-09/i, /P-10/i, /P-14/i, /Según SGC/i, /SGC/i];

    const results = [];

    for (const row of rows) {
        const doc = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        const items = doc.items || [];

        let withSgc = 0;
        let withoutSgc = 0;

        for (const item of items) {
            const rp = item.reactionPlan || '';
            if (rp.trim() === '') {
                withoutSgc++;
                continue;
            }
            const hasSgc = sgcPatterns.some(pat => pat.test(rp));
            if (hasSgc) {
                withSgc++;
            } else {
                withoutSgc++;
            }
        }

        const total = withSgc + withoutSgc;
        const pct = total > 0 ? ((withSgc / total) * 100).toFixed(1) : '0.0';
        results.push({ project: row.project_name, withSgc, withoutSgc, total, pct });
    }

    console.log('');
    console.log(`  ${'Product'.padEnd(45)} | ${'With SGC'.padStart(9)} | ${'Without'.padStart(9)} | ${'Total'.padStart(6)} | ${'% Cov'.padStart(7)}`);
    console.log('  ' + '-'.repeat(85));

    let globalWith = 0;
    let globalWithout = 0;

    for (const r of results) {
        globalWith += r.withSgc;
        globalWithout += r.withoutSgc;
        console.log(`  ${r.project.padEnd(45)} | ${String(r.withSgc).padStart(9)} | ${String(r.withoutSgc).padStart(9)} | ${String(r.total).padStart(6)} | ${r.pct.padStart(6)}%`);
    }

    const globalTotal = globalWith + globalWithout;
    const globalPct = globalTotal > 0 ? ((globalWith / globalTotal) * 100).toFixed(1) : '0.0';
    console.log('  ' + '-'.repeat(85));
    console.log(`  ${'TOTAL'.padEnd(45)} | ${String(globalWith).padStart(9)} | ${String(globalWithout).padStart(9)} | ${String(globalTotal).padStart(6)} | ${globalPct.padStart(6)}%`);

    if (globalWithout === 0) {
        pass(`100% SGC coverage in reaction plans (${globalWith}/${globalTotal})`);
    } else if (parseFloat(globalPct) >= 90) {
        warn(`SGC coverage at ${globalPct}% — ${globalWithout} items without SGC reference`);
    } else {
        fail(`SGC coverage at ${globalPct}% — ${globalWithout} items without SGC reference`);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// AREA 3: Database Integrity
// ═══════════════════════════════════════════════════════════════════════

async function checkDatabaseIntegrity() {
    sectionHeader('AREA 3: Database Integrity');

    // 3a. Product families count
    subHeader('3a. Product Families Count (expected: 8)');
    const families = await selectSql('SELECT id, name FROM product_families ORDER BY name');
    if (families.length === 8) {
        pass(`product_families count = ${families.length}`);
    } else {
        fail(`product_families count = ${families.length} (expected 8)`);
    }
    for (const f of families) {
        info(`  Family: ${f.name}`);
    }

    // 3b. Document counts
    subHeader('3b. Document Counts');
    const tables = ['amfe_documents', 'cp_documents', 'ho_documents', 'pfd_documents'];
    for (const table of tables) {
        const countRows = await selectSql(`SELECT COUNT(*) as cnt FROM ${table}`);
        const cnt = countRows[0]?.cnt ?? 0;
        info(`${table}: ${cnt} documents`);
    }

    // 3c. Duplicate project names (ho_documents uses part_description instead of project_name)
    subHeader('3c. Duplicate Project Names');
    let dupsFound = false;
    const tablesWithProjectName = ['amfe_documents', 'cp_documents', 'pfd_documents'];
    for (const table of tablesWithProjectName) {
        const dups = await selectSql(
            `SELECT project_name, COUNT(*) as cnt FROM ${table} GROUP BY project_name HAVING COUNT(*) > 1`
        );
        if (dups.length > 0) {
            dupsFound = true;
            fail(`Duplicates in ${table}:`);
            for (const d of dups) {
                console.log(`    "${d.project_name}" appears ${d.cnt} times`);
            }
        }
    }
    // ho_documents: check duplicate part_description
    const hoDups = await selectSql(
        `SELECT part_description, COUNT(*) as cnt FROM ho_documents GROUP BY part_description HAVING COUNT(*) > 1`
    );
    if (hoDups.length > 0) {
        dupsFound = true;
        fail('Duplicates in ho_documents:');
        for (const d of hoDups) {
            console.log(`    "${d.part_description}" appears ${d.cnt} times`);
        }
    }
    if (!dupsFound) {
        pass('No duplicate project_name/part_description in any document table');
    }

    // 3d. Orphaned family_documents
    subHeader('3d. Orphaned family_documents');
    const orphans = await selectSql(
        `SELECT fd.id, fd.family_id, fd.document_id, fd.module
         FROM family_documents fd
         LEFT JOIN product_families pf ON fd.family_id = pf.id
         WHERE pf.id IS NULL`
    );
    if (orphans.length === 0) {
        pass('No orphaned family_documents');
    } else {
        fail(`${orphans.length} orphaned family_documents (family_id not in product_families)`);
        for (const o of orphans) {
            console.log(`    family_id=${o.family_id}, doc=${o.document_id}, module=${o.module}`);
        }
    }

    // 3e. Headrest CP AMFE links
    subHeader('3e. Headrest CP amfeFailureId Links');
    const headrestCps = await selectSql(
        `SELECT id, project_name, data FROM cp_documents WHERE project_name LIKE '%HEADREST%' ORDER BY project_name`
    );
    info(`Found ${headrestCps.length} headrest CPs`);

    let totalLinked = 0;
    let totalUnlinked = 0;

    for (const row of headrestCps) {
        const doc = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        const items = doc.items || [];
        let linked = 0;
        let unlinked = 0;
        for (const item of items) {
            if (item.amfeFailureId && item.amfeFailureId.trim() !== '') {
                linked++;
            } else {
                unlinked++;
            }
        }
        totalLinked += linked;
        totalUnlinked += unlinked;
        const pct = (linked + unlinked) > 0 ? ((linked / (linked + unlinked)) * 100).toFixed(1) : '0.0';
        info(`  ${row.project_name}: ${linked} linked, ${unlinked} unlinked (${pct}%)`);
    }

    if (totalUnlinked === 0 && totalLinked > 0) {
        pass(`All headrest CP items have amfeFailureId (${totalLinked}/${totalLinked + totalUnlinked})`);
    } else if (totalLinked > 0) {
        warn(`Headrest CP AMFE links: ${totalLinked} linked, ${totalUnlinked} unlinked`);
    } else {
        info('No headrest CP items found');
    }

    // 3f. Verify guide files exist
    subHeader('3f. Guide Files Existence');
    const guideFiles = [
        'docs/GUIA_PLAN_DE_CONTROL.md',
        'docs/GUIA_AMFE.md',
    ];
    for (const file of guideFiles) {
        const fullPath = resolve(projectRoot, file);
        if (existsSync(fullPath)) {
            pass(`${file} exists`);
        } else {
            fail(`${file} NOT FOUND`);
        }
    }

    // 3g. CLAUDE.md contains references
    subHeader('3g. CLAUDE.md References');
    const claudeMdPath = resolve(projectRoot, 'CLAUDE.md');
    if (existsSync(claudeMdPath)) {
        const claudeContent = readFileSync(claudeMdPath, 'utf-8');
        const refs = ['GUIA_PLAN_DE_CONTROL', 'GUIA_AMFE'];
        for (const ref of refs) {
            if (claudeContent.includes(ref)) {
                pass(`CLAUDE.md contains "${ref}"`);
            } else {
                fail(`CLAUDE.md does NOT contain "${ref}"`);
            }
        }
    } else {
        fail('CLAUDE.md not found at project root');
    }
}

// ═══════════════════════════════════════════════════════════════════════
// AREA 4: EPP in HOs
// ═══════════════════════════════════════════════════════════════════════

async function checkEppInHos() {
    sectionHeader('AREA 4: EPP Coverage in Hojas de Operaciones');

    // ho_documents uses id (UUID), client, part_description — NOT project_name
    // EPP is stored as safetyElements[] (array of string IDs like "anteojos", "guantes", "zapatos", etc.)
    const rows = await selectSql('SELECT id, client, part_description, data FROM ho_documents ORDER BY part_description');
    info(`Loaded ${rows.length} HO documents`);

    let totalSheetsWithEpp = 0;
    let totalSheetsWithoutEpp = 0;
    const exceptionsNoEpp = [];

    // Costura hearing protection checks
    const costuraSheets = [];
    const costuraNoHearing = [];

    // Inyeccion respirator checks
    const inyeccionSheets = [];
    const inyeccionNoRespirator = [];

    // PWA basic EPP checks
    const pwaSheets = [];
    const pwaMissingBasic = [];

    for (const row of rows) {
        const doc = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        const sheets = doc.sheets || [];
        const docLabel = `${row.client}/${(row.part_description || '').substring(0, 50)}`;

        for (const sheet of sheets) {
            const sheetName = sheet.operationName || sheet.name || '(unnamed)';
            // safetyElements is an array of string IDs: ["anteojos","guantes","zapatos","proteccionAuditiva",...]
            const safetyElements = sheet.safetyElements || [];
            const eppCount = safetyElements.length;

            if (eppCount > 0) {
                totalSheetsWithEpp++;
            } else {
                totalSheetsWithoutEpp++;
                exceptionsNoEpp.push({ doc: docLabel, sheet: sheetName });
            }

            const fullId = `${docLabel} / ${sheetName}`;

            // Costura: check hearing protection
            if (/costura/i.test(sheetName)) {
                costuraSheets.push(fullId);
                const hasHearing = safetyElements.some(e =>
                    /auditiv/i.test(e) || /proteccionAuditiva/i.test(e) ||
                    /tapones/i.test(e) || /orejeras/i.test(e)
                );
                if (!hasHearing) {
                    costuraNoHearing.push(fullId);
                }
            }

            // Inyeccion: check respirator
            if (/inyecci[oó]n/i.test(sheetName) || /inyeccion/i.test(sheetName)) {
                inyeccionSheets.push(fullId);
                const hasRespirator = safetyElements.some(e =>
                    /respirador/i.test(e) || /mascara/i.test(e) ||
                    /respirat/i.test(e) || /proteccionRespiratoria/i.test(e)
                );
                if (!hasRespirator) {
                    inyeccionNoRespirator.push(fullId);
                }
            }

            // PWA: check basic EPP (safety shoes + glasses + gloves)
            if (/PWA/i.test(row.client)) {
                pwaSheets.push(fullId);
                const hasShoes = safetyElements.some(e => /zapato/i.test(e) || /calzado/i.test(e) || /bota/i.test(e));
                const hasGlasses = safetyElements.some(e => /anteojo/i.test(e) || /lente/i.test(e) || /gafa/i.test(e) || /ocular/i.test(e));
                const hasGloves = safetyElements.some(e => /guante/i.test(e));

                const missing = [];
                if (!hasShoes) missing.push('shoes');
                if (!hasGlasses) missing.push('glasses');
                if (!hasGloves) missing.push('gloves');

                if (missing.length > 0) {
                    pwaMissingBasic.push({ id: fullId, missing });
                }
            }
        }
    }

    // Summary
    const totalSheets = totalSheetsWithEpp + totalSheetsWithoutEpp;
    subHeader(`EPP Coverage: ${totalSheetsWithEpp}/${totalSheets} sheets`);

    if (totalSheetsWithoutEpp === 0) {
        pass(`All ${totalSheets} sheets have EPP assigned (target: 171/171)`);
    } else {
        fail(`${totalSheetsWithoutEpp} sheets WITHOUT EPP:`);
        for (const e of exceptionsNoEpp) {
            console.log(`    ${e.doc} / ${e.sheet}`);
        }
    }

    // Costura hearing protection
    subHeader(`Costura Hearing Protection: ${costuraSheets.length} sheets`);
    if (costuraNoHearing.length === 0 && costuraSheets.length > 0) {
        pass(`All ${costuraSheets.length} costura sheets have hearing protection`);
    } else if (costuraNoHearing.length > 0) {
        fail(`${costuraNoHearing.length} costura sheet(s) missing hearing protection:`);
        for (const s of costuraNoHearing) {
            console.log(`    ${s}`);
        }
    } else {
        info('No costura sheets found');
    }

    // Inyeccion respirator
    subHeader(`Inyeccion Respirator: ${inyeccionSheets.length} sheets`);
    if (inyeccionNoRespirator.length === 0 && inyeccionSheets.length > 0) {
        pass(`All ${inyeccionSheets.length} inyeccion sheets have respirator`);
    } else if (inyeccionNoRespirator.length > 0) {
        fail(`${inyeccionNoRespirator.length} inyeccion sheet(s) missing respirator:`);
        for (const s of inyeccionNoRespirator) {
            console.log(`    ${s}`);
        }
    } else {
        info('No inyeccion sheets found');
    }

    // PWA basic EPP
    subHeader(`PWA Basic EPP (shoes+glasses+gloves): ${pwaSheets.length} sheets`);
    if (pwaMissingBasic.length === 0 && pwaSheets.length > 0) {
        pass(`All ${pwaSheets.length} PWA sheets have basic EPP`);
    } else if (pwaMissingBasic.length > 0) {
        fail(`${pwaMissingBasic.length} PWA sheet(s) missing basic EPP:`);
        for (const s of pwaMissingBasic) {
            console.log(`    ${s.id} — missing: ${s.missing.join(', ')}`);
        }
    } else {
        info('No PWA sheets found');
    }
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

async function main() {
    console.log(hr('═', 80));
    console.log('  BARACK MERCOSUL — COMPREHENSIVE INTEGRITY VERIFICATION');
    console.log('  Date: ' + new Date().toISOString());
    console.log('  Mode: READ-ONLY (selectSql only)');
    console.log(hr('═', 80));

    await initSupabase();

    await checkTimeFrequencies();
    await checkSgcReferences();
    await checkDatabaseIntegrity();
    await checkEppInHos();

    // Final summary
    console.log('\n' + hr('═', 80));
    console.log('  FINAL SUMMARY');
    console.log(hr('═', 80));
    console.log(`  [PASS] ${totalPass}`);
    console.log(`  [WARN] ${totalWarn}`);
    console.log(`  [FAIL] ${totalFail}`);
    console.log(hr('═', 80));

    if (totalFail === 0) {
        console.log('  RESULT: ALL CHECKS PASSED');
    } else {
        console.log(`  RESULT: ${totalFail} CHECK(S) FAILED — review above`);
    }
    console.log(hr('═', 80));

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});
