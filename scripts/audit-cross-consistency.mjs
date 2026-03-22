#!/usr/bin/env node
/**
 * AUDIT: Cross-consistency PFD ↔ AMFE ↔ CP ↔ HO
 *
 * Verifies:
 * - Each PFD step has at least one AMFE operation
 * - Each CC/SC AMFE characteristic appears in CP
 * - Each CP operation matches a PFD step
 * - Each HO corresponds to a CP operation
 * - HO QCs match CP characteristics/frequencies
 *
 * Usage: node scripts/audit-cross-consistency.mjs
 */

import { initSupabase, selectSql, close } from './supabaseHelper.mjs';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Product families to audit ──────────────────────────────────────────────
const FAMILIES = [
    { name: 'Insert Patagonia', project: 'VWA/PATAGONIA/INSERTO' },
    { name: 'Insert Patagonia [L0]', project: 'VWA/PATAGONIA/INSERT [L0]' },
    { name: 'Armrest Door Panel', project: 'VWA/PATAGONIA/ARMREST_DOOR_PANEL' },
    { name: 'Top Roll', project: 'VWA/PATAGONIA/TOP_ROLL' },
    { name: 'Headrest Front', project: 'VWA/PATAGONIA/HEADREST_FRONT' },
    { name: 'Headrest Rear Center', project: 'VWA/PATAGONIA/HEADREST_REAR_CEN' },
    { name: 'Headrest Rear Outer', project: 'VWA/PATAGONIA/HEADREST_REAR_OUT' },
    { name: 'Telas Planas PWA', project: 'PWA/TELAS_PLANAS' },
    { name: 'Telas Termoformadas PWA', project: 'PWA/TELAS_TERMOFORMADAS' },
];

function normalizeOpNumber(num) {
    return String(num || '').replace(/^0+/, '').trim();
}

function extractOpNumberFromName(name) {
    const match = String(name || '').match(/^(\d+)/);
    return match ? match[1] : '';
}

async function main() {
    await initSupabase();

    // Fetch all documents
    const amfeDocs = await selectSql(`SELECT id, amfe_number, project_name, data FROM amfe_documents ORDER BY project_name`);
    const cpDocs = await selectSql(`SELECT id, control_plan_number, project_name, data FROM cp_documents ORDER BY project_name`);
    const pfdDocs = await selectSql(`SELECT id, document_number, part_name, customer_name, data FROM pfd_documents ORDER BY part_name`);
    const hoDocs = await selectSql(`SELECT id, form_number, part_description, linked_amfe_project, linked_cp_project, data FROM ho_documents ORDER BY linked_amfe_project`);

    console.log(`  AMFE: ${amfeDocs.length}, CP: ${cpDocs.length}, PFD: ${pfdDocs.length}, HO: ${hoDocs.length}`);

    const results = {
        crossConsistency: [],
        hoCpConsistency: [],
        summary: {},
    };

    // Match AMFE/CP documents by project_name
    function findDocsByProject(docs, projectSearch) {
        return docs.filter(d => {
            const pn = d.project_name || '';
            return pn === projectSearch || pn.startsWith(projectSearch + ' ');
        });
    }

    // PFD matching map: project name → PFD part_name patterns
    const PFD_MAP = {
        'VWA/PATAGONIA/INSERTO': ['Insert'],
        'VWA/PATAGONIA/INSERT [L0]': ['Insert [L0]', 'Insert'],
        'VWA/PATAGONIA/ARMREST_DOOR_PANEL': ['Armrest'],
        'VWA/PATAGONIA/TOP_ROLL': ['TOP ROLL'],
        'VWA/PATAGONIA/HEADREST_FRONT': ['Delantero'],
        'VWA/PATAGONIA/HEADREST_REAR_CEN': ['Central'],
        'VWA/PATAGONIA/HEADREST_REAR_OUT': ['Lateral'],
        'PWA/TELAS_PLANAS': ['Planas'],
        'PWA/TELAS_TERMOFORMADAS': ['Termoformadas'],
    };

    function findPfdByProject(projectSearch) {
        const patterns = PFD_MAP[projectSearch] || [];
        return pfdDocs.filter(d => {
            const partName = (d.part_name || '').toLowerCase();
            return patterns.some(p => partName.includes(p.toLowerCase()));
        });
    }

    // HO matching by linked_amfe_project
    function findHoByProject(projectSearch) {
        return hoDocs.filter(d => {
            const linked = d.linked_amfe_project || '';
            return linked === projectSearch;
        });
    }

    let totalIssues = 0;

    for (const family of FAMILIES) {
        console.log(`\n  Analyzing: ${family.name} (${family.project})`);

        const amfes = findDocsByProject(amfeDocs, family.project);
        const cps = findDocsByProject(cpDocs, family.project);
        const pfds = findPfdByProject(family.project);
        const hos = findHoByProject(family.project);

        if (amfes.length === 0 && cps.length === 0) {
            console.log(`    Skipped - no AMFE or CP found`);
            continue;
        }

        const familyResult = {
            family: family.name,
            project: family.project,
            docCounts: { amfe: amfes.length, cp: cps.length, pfd: pfds.length, ho: hos.length },
            issues: [],
        };

        // ─── PFD → AMFE ─────────────────────────────────────────────────
        for (const pfd of pfds) {
            const pfdData = typeof pfd.data === 'string' ? JSON.parse(pfd.data) : pfd.data;
            const pfdSteps = pfdData?.steps || [];

            for (const step of pfdSteps) {
                const stepNum = normalizeOpNumber(step.stepNumber || step.number || '');
                const stepName = step.description || step.name || '';

                // Skip non-process steps (start/end symbols)
                if (!stepNum || stepName.toLowerCase().includes('inicio') || stepName.toLowerCase().includes('fin')) continue;

                // Check if any AMFE has an operation matching this PFD step
                let found = false;
                for (const amfe of amfes) {
                    const amfeData = typeof amfe.data === 'string' ? JSON.parse(amfe.data) : amfe.data;
                    const ops = amfeData?.operations || [];
                    for (const op of ops) {
                        const opNum = normalizeOpNumber(op.opNumber);
                        if (opNum === stepNum) {
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }

                if (!found) {
                    familyResult.issues.push({
                        type: 'PFD_NO_AMFE',
                        severity: 'warning',
                        message: `PFD step ${stepNum} "${stepName}" has no matching AMFE operation`,
                    });
                }
            }
        }

        // ─── AMFE → PFD ─────────────────────────────────────────────────
        for (const amfe of amfes) {
            const amfeData = typeof amfe.data === 'string' ? JSON.parse(amfe.data) : amfe.data;
            const ops = amfeData?.operations || [];

            for (const op of ops) {
                const opNum = normalizeOpNumber(op.opNumber);
                if (!opNum) continue;

                // Check if PFD has this step
                let foundInPfd = pfds.length === 0; // If no PFD, skip check
                for (const pfd of pfds) {
                    const pfdData = typeof pfd.data === 'string' ? JSON.parse(pfd.data) : pfd.data;
                    const pfdSteps = pfdData?.steps || [];
                    for (const step of pfdSteps) {
                        const stepNum = normalizeOpNumber(step.stepNumber || step.number || '');
                        if (stepNum === opNum) {
                            foundInPfd = true;
                            break;
                        }
                    }
                    if (foundInPfd) break;
                }

                if (!foundInPfd) {
                    familyResult.issues.push({
                        type: 'AMFE_NO_PFD',
                        severity: 'info',
                        message: `AMFE op ${opNum} "${op.name}" has no matching PFD step`,
                    });
                }
            }
        }

        // ─── AMFE CC/SC → CP ────────────────────────────────────────────
        for (const amfe of amfes) {
            const amfeData = typeof amfe.data === 'string' ? JSON.parse(amfe.data) : amfe.data;
            const ops = amfeData?.operations || [];

            for (const op of ops) {
                const opNum = normalizeOpNumber(op.opNumber);

                for (const we of (op.workElements || [])) {
                    for (const fn of (we.functions || [])) {
                        for (const fail of (fn.failures || [])) {
                            for (const cause of (fail.causes || [])) {
                                const sc = (cause.specialChar || '').trim();
                                const ap = (cause.ap || '').toUpperCase();

                                if (sc === 'CC' || sc === 'SC' || ap === 'H') {
                                    // This cause should have CP coverage
                                    let foundInCp = false;
                                    for (const cp of cps) {
                                        const cpData = typeof cp.data === 'string' ? JSON.parse(cp.data) : cp.data;
                                        const items = cpData?.items || [];
                                        for (const item of items) {
                                            const itemOpNum = normalizeOpNumber(item.processStepNumber || item.operationNumber || item.processStep || '');
                                            if (itemOpNum === opNum) {
                                                foundInCp = true;
                                                break;
                                            }
                                        }
                                        if (foundInCp) break;
                                    }

                                    if (!foundInCp) {
                                        familyResult.issues.push({
                                            type: 'AMFE_CC_NO_CP',
                                            severity: ap === 'H' ? 'error' : 'warning',
                                            message: `AMFE op ${opNum}, cause "${(cause.cause || '').substring(0, 50)}" (${sc || 'AP=' + ap}) has no CP coverage`,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // ─── CP → PFD ──────────────────────────────────────────────────
        for (const cp of cps) {
            const cpData = typeof cp.data === 'string' ? JSON.parse(cp.data) : cp.data;
            const items = cpData?.items || [];
            const seenOps = new Set();

            for (const item of items) {
                const itemOpNum = normalizeOpNumber(item.processStepNumber || item.operationNumber || item.processStep || '');
                if (!itemOpNum || seenOps.has(itemOpNum)) continue;
                seenOps.add(itemOpNum);

                // Check if PFD has this step
                let foundInPfd = pfds.length === 0;
                for (const pfd of pfds) {
                    const pfdData = typeof pfd.data === 'string' ? JSON.parse(pfd.data) : pfd.data;
                    const pfdSteps = pfdData?.steps || [];
                    for (const step of pfdSteps) {
                        const stepNum = normalizeOpNumber(step.stepNumber || step.number || '');
                        if (stepNum === itemOpNum) {
                            foundInPfd = true;
                            break;
                        }
                    }
                    if (foundInPfd) break;
                }

                if (!foundInPfd) {
                    familyResult.issues.push({
                        type: 'CP_NO_PFD',
                        severity: 'info',
                        message: `CP operation ${itemOpNum} has no matching PFD step`,
                    });
                }
            }
        }

        // ─── HO → CP ───────────────────────────────────────────────────
        const hoResult = {
            family: family.name,
            project: family.project,
            issues: [],
        };

        for (const ho of hos) {
            const hoData = typeof ho.data === 'string' ? JSON.parse(ho.data) : ho.data;
            const sheets = hoData?.sheets || [];

            for (const sheet of sheets) {
                const sheetOpNum = normalizeOpNumber(sheet.operationNumber || '');
                const sheetName = sheet.name || sheet.operationName || '';
                if (!sheetOpNum) continue;

                // Check if CP has this operation
                let foundInCp = false;
                let cpItemsForOp = [];
                for (const cp of cps) {
                    const cpData = typeof cp.data === 'string' ? JSON.parse(cp.data) : cp.data;
                    const items = cpData?.items || [];
                    for (const item of items) {
                        const itemOpNum = normalizeOpNumber(item.processStepNumber || item.operationNumber || item.processStep || '');
                        if (itemOpNum === sheetOpNum) {
                            foundInCp = true;
                            cpItemsForOp.push(item);
                        }
                    }
                }

                if (!foundInCp) {
                    hoResult.issues.push({
                        type: 'HO_NO_CP',
                        severity: 'warning',
                        message: `HO sheet "${sheetName}" (op ${sheetOpNum}) has no matching CP operation`,
                    });
                }

                // Check QC alignment
                const qcs = sheet.qualityChecks || [];
                for (const qc of qcs) {
                    const qcCharacteristic = qc.characteristic || qc.description || '';
                    const qcFrequency = qc.frequency || '';

                    // Find matching CP item by characteristic
                    let qcMatchFound = cpItemsForOp.length === 0; // skip if no CP items
                    for (const cpItem of cpItemsForOp) {
                        const cpChar = cpItem.characteristic || cpItem.productCharacteristic || '';
                        if (cpChar && qcCharacteristic && (
                            cpChar.toLowerCase().includes(qcCharacteristic.toLowerCase().substring(0, 20)) ||
                            qcCharacteristic.toLowerCase().includes(cpChar.toLowerCase().substring(0, 20))
                        )) {
                            qcMatchFound = true;

                            // Check frequency match
                            const cpFreq = cpItem.frequency || cpItem.sampleFrequency || '';
                            if (cpFreq && qcFrequency && cpFreq !== qcFrequency) {
                                hoResult.issues.push({
                                    type: 'HO_CP_FREQ_MISMATCH',
                                    severity: 'info',
                                    message: `HO op ${sheetOpNum} QC "${qcCharacteristic.substring(0, 40)}": freq="${qcFrequency}" vs CP freq="${cpFreq}"`,
                                });
                            }
                            break;
                        }
                    }
                }
            }
        }

        totalIssues += familyResult.issues.length + hoResult.issues.length;
        results.crossConsistency.push(familyResult);
        results.hoCpConsistency.push(hoResult);

        const issueCount = familyResult.issues.length + hoResult.issues.length;
        console.log(`    Cross: ${familyResult.issues.length} issues, HO-CP: ${hoResult.issues.length} issues`);
    }

    // Summary
    results.summary = {
        totalFamiliesAnalyzed: FAMILIES.length,
        totalIssues,
        crossConsistencyIssues: results.crossConsistency.reduce((sum, r) => sum + r.issues.length, 0),
        hoCpIssues: results.hoCpConsistency.reduce((sum, r) => sum + r.issues.length, 0),
    };

    console.log(`\n  TOTAL ISSUES: ${totalIssues}`);

    const outPath = resolve(__dirname, '..', 'docs', 'audit_cross_consistency_data.json');
    writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`  Output: ${outPath}`);

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
