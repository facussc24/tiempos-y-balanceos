/**
 * UX & Data Consistency Audit
 *
 * Connects to Supabase (with auth) and checks ALL amfe_documents for:
 *   1. Document accessibility (UX) — hierarchy vs flat project_name
 *   2. Metadata sync — actual vs stored operation_count / cause_count
 *   3. Field naming inconsistencies — opNumber vs operationNumber, etc.
 *   4. Documents without family assignment — hidden by "Todas las familias" filter
 *   5. Header completeness — required fields populated
 *
 * EXCLUSIONS (by Fak's decision):
 *   - AP=H without actions (managed personally)
 *   - CC/SC percentages or missing classifications (assigned personally)
 *
 * Usage: node scripts/_auditUxNaming.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ─── Load .env.local ───────────────────────────────────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
    envText.split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// ─── Auth ──────────────────────────────────────────────────────────────────────
const { error: authErr } = await sb.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL,
    password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (authErr) {
    console.error('Auth failed:', authErr.message);
    process.exit(1);
}
console.log('Authenticated OK.\n');

// ─── Fetch data ────────────────────────────────────────────────────────────────
const [amfeRes, familyDocRes, familyRes] = await Promise.all([
    sb.from('amfe_documents').select('*'),
    sb.from('family_documents').select('*'),
    sb.from('product_families').select('*'),
]);

if (amfeRes.error) { console.error('Failed to fetch amfe_documents:', amfeRes.error.message); process.exit(1); }
if (familyDocRes.error) { console.error('Failed to fetch family_documents:', familyDocRes.error.message); process.exit(1); }
if (familyRes.error) { console.error('Failed to fetch product_families:', familyRes.error.message); process.exit(1); }

const amfeDocs = amfeRes.data;
const familyDocs = familyDocRes.data;
const families = familyRes.data;

console.log('='.repeat(100));
console.log('  UX & DATA CONSISTENCY AUDIT');
console.log(`  Date: ${new Date().toISOString()}`);
console.log(`  AMFE documents: ${amfeDocs.length}  |  Family doc links: ${familyDocs.length}  |  Families: ${families.length}`);
console.log('='.repeat(100));

// Build lookup: document_id -> family info
const familyDocByDocId = new Map();
for (const fd of familyDocs) {
    if (fd.module === 'amfe') {
        const family = families.find(f => f.id === fd.family_id);
        familyDocByDocId.set(fd.document_id, {
            familyId: fd.family_id,
            familyName: family?.name || `(family #${fd.family_id})`,
            isMaster: fd.is_master === true || fd.is_master === 1,
        });
    }
}

// ─── Per-document audit ────────────────────────────────────────────────────────
const summaryRows = [];

for (const row of amfeDocs) {
    const issues = [];     // blocker
    const warnings = [];   // warning
    const info = [];       // info items

    const docId = row.id;
    const projectName = row.project_name || '(unnamed)';
    const amfeNumber = row.amfe_number || '';

    // ─── Parse data ──────────────────────────────────────────────────────
    let doc;
    if (typeof row.data === 'string') {
        try { doc = JSON.parse(row.data); } catch { doc = null; }
        if (typeof doc === 'string') {
            issues.push('[DATA] Double-serialized — data is string inside string');
            doc = null;
        }
    } else if (typeof row.data === 'object' && row.data !== null) {
        doc = row.data;
    } else {
        issues.push('[DATA] data column is null/undefined');
        doc = null;
    }

    // ─── 1. Document Accessibility (UX) ──────────────────────────────────
    const hasSlash = projectName.includes('/');
    if (!hasSlash) {
        warnings.push(`[UX] Flat project_name "${projectName}" — will appear under "Sin clasificar"`);
    } else {
        const parts = projectName.split('/');
        if (parts.length < 3) {
            warnings.push(`[UX] project_name "${projectName}" has only ${parts.length} segments (expected CLIENT/PROJECT/NAME)`);
        }
    }

    // Check client column
    if (!row.client || row.client.trim() === '') {
        warnings.push('[UX] Missing "client" column on amfe_documents row');
    }

    // ─── 2. Metadata Sync ────────────────────────────────────────────────
    if (doc) {
        const operations = doc.operations || [];
        const storedOpCount = row.operation_count;
        const actualOpCount = operations.length;

        if (storedOpCount != null && storedOpCount !== actualOpCount) {
            warnings.push(`[SYNC] operation_count mismatch: stored=${storedOpCount}, actual=${actualOpCount}`);
        }

        // Count actual causes
        let actualCauses = 0;
        for (const op of operations) {
            for (const we of (op.workElements || [])) {
                for (const fn of (we.functions || [])) {
                    for (const fail of (fn.failures || [])) {
                        actualCauses += (fail.causes || []).length;
                    }
                }
            }
        }

        const storedCauseCount = row.cause_count;
        if (storedCauseCount != null && storedCauseCount !== actualCauses) {
            warnings.push(`[SYNC] cause_count mismatch: stored=${storedCauseCount}, actual=${actualCauses}`);
        }
    }

    // ─── 3. Field Naming Inconsistencies ─────────────────────────────────
    if (doc) {
        const operations = doc.operations || [];
        const naming = {
            opNumber: false,
            operationNumber: false,
            name: false,
            operationName: false,
            causeAp: false,
            causeActionPriority: false,
            failSeverity: false,
            causeSeverity: false,
        };

        for (const op of operations) {
            if ('opNumber' in op && op.opNumber !== undefined) naming.opNumber = true;
            if ('operationNumber' in op && op.operationNumber !== undefined) naming.operationNumber = true;
            if ('name' in op && op.name !== undefined) naming.name = true;
            if ('operationName' in op && op.operationName !== undefined) naming.operationName = true;

            for (const we of (op.workElements || [])) {
                for (const fn of (we.functions || [])) {
                    for (const fail of (fn.failures || [])) {
                        if ('severity' in fail && fail.severity !== undefined && fail.severity !== '') {
                            naming.failSeverity = true;
                        }

                        for (const c of (fail.causes || [])) {
                            if ('ap' in c && c.ap !== undefined) naming.causeAp = true;
                            if ('actionPriority' in c && c.actionPriority !== undefined) naming.causeActionPriority = true;
                            if ('severity' in c && c.severity !== undefined && c.severity !== '') {
                                naming.causeSeverity = true;
                            }
                        }
                    }
                }
            }
        }

        // Build naming report
        const namingParts = [];

        // Operation number field
        if (naming.opNumber && naming.operationNumber) {
            warnings.push('[NAMING] Uses BOTH opNumber AND operationNumber on operations (mixed)');
        } else if (naming.operationNumber) {
            namingParts.push('op#=operationNumber');
        } else if (naming.opNumber) {
            namingParts.push('op#=opNumber');
        }

        // Operation name field
        if (naming.name && naming.operationName) {
            warnings.push('[NAMING] Uses BOTH name AND operationName on operations (mixed)');
        } else if (naming.operationName) {
            namingParts.push('opName=operationName');
        } else if (naming.name) {
            namingParts.push('opName=name');
        }

        // AP field
        if (naming.causeAp && naming.causeActionPriority) {
            warnings.push('[NAMING] Uses BOTH cause.ap AND cause.actionPriority (mixed)');
        } else if (naming.causeActionPriority) {
            namingParts.push('ap=actionPriority');
        } else if (naming.causeAp) {
            namingParts.push('ap=ap');
        }

        // Severity location
        if (naming.failSeverity && naming.causeSeverity) {
            warnings.push('[NAMING] Severity on BOTH failure AND cause (redundant/conflicting)');
        } else if (naming.causeSeverity && !naming.failSeverity) {
            warnings.push('[NAMING] Severity on cause instead of failure (non-standard)');
        } else if (naming.failSeverity) {
            namingParts.push('severity=failure.severity');
        }

        if (namingParts.length > 0) {
            info.push(`[NAMING] Convention: ${namingParts.join(', ')}`);
        }
    }

    // ─── 4. Family Assignment ────────────────────────────────────────────
    const familyInfo = familyDocByDocId.get(docId);
    if (!familyInfo) {
        // Check if the project_name suggests it SHOULD be in VWA/PATAGONIA or PWA
        const lc = projectName.toLowerCase();
        const isVwaOrPwa = lc.includes('vwa') || lc.includes('pwa') || lc.includes('patagonia') || lc.includes('hilux');
        if (isVwaOrPwa) {
            issues.push(`[FAMILY] No family_documents entry — hidden by "Todas las familias" filter`);
        } else {
            warnings.push(`[FAMILY] No family_documents entry (may be intentional for non-VWA/PWA docs)`);
        }
    } else {
        info.push(`[FAMILY] ${familyInfo.familyName} (${familyInfo.isMaster ? 'master' : 'variant'})`);
    }

    // ─── 5. Header Completeness ──────────────────────────────────────────
    if (doc && doc.header) {
        const h = doc.header;
        const requiredFields = [
            { key: 'organization', label: 'organization' },
            { key: 'client', label: 'client' },
            { key: 'subject', label: 'subject' },
            { key: 'partNumber', label: 'partNumber' },
            { key: 'responsible', label: 'responsible' },
            { key: 'team', label: 'team' },
            { key: 'startDate', label: 'startDate' },
        ];

        const missing = [];
        for (const f of requiredFields) {
            const val = h[f.key];
            if (val === undefined || val === null || String(val).trim() === '') {
                missing.push(f.label);
            }
        }

        if (missing.length > 0) {
            warnings.push(`[HEADER] Missing: ${missing.join(', ')}`);
        }
    } else if (doc) {
        issues.push('[HEADER] No header object in data');
    }

    // ─── Collect summary ─────────────────────────────────────────────────
    const severity = issues.length > 0 ? 'BLOCKER' : warnings.length > 0 ? 'WARNING' : 'OK';

    summaryRows.push({
        projectName,
        amfeNumber,
        docId,
        issues,
        warnings,
        info,
        severity,
    });
}

// ─── Print detailed per-document report ────────────────────────────────────────
console.log('\n');
console.log('='.repeat(100));
console.log('  DETAILED REPORT (per document)');
console.log('='.repeat(100));

for (const r of summaryRows) {
    console.log(`\n${'─'.repeat(100)}`);
    console.log(`  ${r.projectName}  ${r.amfeNumber ? `| #${r.amfeNumber}` : ''}  | ID: ${r.docId}  | ${r.severity}`);
    console.log(`${'─'.repeat(100)}`);

    if (r.issues.length === 0 && r.warnings.length === 0 && r.info.length === 0) {
        console.log('  (no issues)');
        continue;
    }

    for (const i of r.issues)   console.log(`  BLOCKER  ${i}`);
    for (const w of r.warnings) console.log(`  WARNING  ${w}`);
    for (const i of r.info)     console.log(`  INFO     ${i}`);
}

// ─── Print summary table ───────────────────────────────────────────────────────
console.log('\n\n');
console.log('='.repeat(100));
console.log('  SUMMARY TABLE');
console.log('='.repeat(100));

// Column widths
const colName = 50;
const colSev = 10;
const colIssues = 35;

const pad = (s, n) => String(s).padEnd(n).slice(0, n);

console.log(`  ${pad('Document', colName)} ${pad('Severity', colSev)} ${pad('Issues', colIssues)}`);
console.log(`  ${'-'.repeat(colName)} ${'-'.repeat(colSev)} ${'-'.repeat(colIssues)}`);

for (const r of summaryRows) {
    const shortName = r.projectName.length > colName - 2 ? '...' + r.projectName.slice(-(colName - 5)) : r.projectName;
    const issueCount = r.issues.length + r.warnings.length;
    const issueList = [...r.issues.map(i => 'B:' + i.split(']')[0] + ']'), ...r.warnings.map(w => 'W:' + w.split(']')[0] + ']')].join(' ');
    console.log(`  ${pad(shortName, colName)} ${pad(r.severity, colSev)} ${issueCount > 0 ? issueList.slice(0, colIssues * 3) : '(clean)'}`);
}

// ─── Cross-document naming consistency check ───────────────────────────────────
console.log('\n\n');
console.log('='.repeat(100));
console.log('  CROSS-DOCUMENT NAMING CONSISTENCY');
console.log('='.repeat(100));

// Collect all naming conventions
const namingStats = {
    opNumber: 0,
    operationNumber: 0,
    name: 0,
    operationName: 0,
    causeAp: 0,
    causeActionPriority: 0,
    failSeverity: 0,
    causeSeverity: 0,
};

for (const row of amfeDocs) {
    let doc;
    if (typeof row.data === 'string') { try { doc = JSON.parse(row.data); } catch { continue; } }
    else if (typeof row.data === 'object' && row.data !== null) { doc = row.data; }
    else { continue; }
    if (typeof doc === 'string') continue;

    const operations = doc.operations || [];
    for (const op of operations) {
        if ('opNumber' in op && op.opNumber !== undefined) namingStats.opNumber++;
        if ('operationNumber' in op && op.operationNumber !== undefined) namingStats.operationNumber++;
        if ('name' in op && op.name !== undefined) namingStats.name++;
        if ('operationName' in op && op.operationName !== undefined) namingStats.operationName++;

        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    if ('severity' in fail && fail.severity !== undefined && fail.severity !== '') namingStats.failSeverity++;
                    for (const c of (fail.causes || [])) {
                        if ('ap' in c) namingStats.causeAp++;
                        if ('actionPriority' in c) namingStats.causeActionPriority++;
                        if ('severity' in c && c.severity !== undefined && c.severity !== '') namingStats.causeSeverity++;
                    }
                }
            }
        }
    }
}

console.log('\n  Operation number field:');
console.log(`    opNumber ........... ${namingStats.opNumber} occurrences`);
console.log(`    operationNumber .... ${namingStats.operationNumber} occurrences`);

console.log('\n  Operation name field:');
console.log(`    name ............... ${namingStats.name} occurrences`);
console.log(`    operationName ...... ${namingStats.operationName} occurrences`);

console.log('\n  Action Priority field:');
console.log(`    cause.ap ........... ${namingStats.causeAp} occurrences`);
console.log(`    cause.actionPriority ${namingStats.causeActionPriority} occurrences`);

console.log('\n  Severity location:');
console.log(`    failure.severity ... ${namingStats.failSeverity} occurrences`);
console.log(`    cause.severity ..... ${namingStats.causeSeverity} occurrences`);

if (namingStats.opNumber > 0 && namingStats.operationNumber > 0) {
    console.log('\n  ** INCONSISTENCY: Both opNumber and operationNumber are used across documents');
}
if (namingStats.name > 0 && namingStats.operationName > 0) {
    console.log('\n  ** INCONSISTENCY: Both name and operationName are used across documents');
}
if (namingStats.causeAp > 0 && namingStats.causeActionPriority > 0) {
    console.log('\n  ** INCONSISTENCY: Both cause.ap and cause.actionPriority are used');
}
if (namingStats.causeSeverity > 0) {
    console.log('\n  ** WARNING: Some causes have severity directly (should be on failure only per VDA)');
}

// ─── Family coverage gap ───────────────────────────────────────────────────────
console.log('\n\n');
console.log('='.repeat(100));
console.log('  FAMILY COVERAGE GAPS (docs without family_documents entry)');
console.log('='.repeat(100));

const orphans = summaryRows.filter(r => r.issues.some(i => i.includes('[FAMILY]')) || r.warnings.some(w => w.includes('[FAMILY]')));
if (orphans.length === 0) {
    console.log('\n  All AMFE documents have family_documents entries.');
} else {
    for (const o of orphans) {
        const msg = [...o.issues, ...o.warnings].find(m => m.includes('[FAMILY]'));
        console.log(`\n  ${o.projectName} (ID: ${o.docId})`);
        console.log(`    ${msg}`);
    }
}

// ─── Final stats ───────────────────────────────────────────────────────────────
const blockerCount = summaryRows.filter(r => r.severity === 'BLOCKER').length;
const warningCount = summaryRows.filter(r => r.severity === 'WARNING').length;
const okCount = summaryRows.filter(r => r.severity === 'OK').length;

console.log('\n\n');
console.log('='.repeat(100));
console.log('  FINAL STATS');
console.log('='.repeat(100));
console.log(`  Total documents: ${summaryRows.length}`);
console.log(`  BLOCKER: ${blockerCount}`);
console.log(`  WARNING: ${warningCount}`);
console.log(`  OK:      ${okCount}`);
console.log('='.repeat(100));

// ─── Exit ──────────────────────────────────────────────────────────────────────
await sb.auth.signOut();
process.exit(blockerCount > 0 ? 1 : 0);
