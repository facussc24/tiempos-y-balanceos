/**
 * _fixDates.mjs — Normalize ALL date fields in AMFE/CP/HO documents to dd/MM/yyyy
 * Also fix IP PAD AMFE header fields (confidentiality, partNumber, applicableParts)
 * Also fix double-serialized data (string instead of object)
 * Also inspect OP 130 vs OP 140 for duplicate content
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// ── Supabase connection (no dotenv) ──────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

// ── formatDateAR (same logic as utils/formatting.ts) ─────────────
function formatDateAR(dateStr) {
    if (!dateStr || typeof dateStr !== 'string' || !dateStr.trim()) return '';
    const trimmed = dateStr.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
    const d = new Date(trimmed);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return day + '/' + month + '/' + d.getFullYear();
    }
    const spanishMonths = {
        'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
        'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
        'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12',
    };
    const spanishMatch = trimmed.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
    if (spanishMatch) {
        const monthNum = spanishMonths[spanishMatch[2].toLowerCase()];
        if (monthNum) {
            return spanishMatch[1].padStart(2, '0') + '/' + monthNum + '/' + spanishMatch[3];
        }
    }
    return trimmed;
}

/** Ensure data is an object (fix double-serialization) */
function ensureObject(data) {
    let obj = data;
    let depth = 0;
    while (typeof obj === 'string' && depth < 5) {
        try { obj = JSON.parse(obj); } catch { return null; }
        depth++;
    }
    if (depth > 0 && typeof obj === 'object') {
        console.log(`    (fixed double-serialization, depth=${depth})`);
    }
    return typeof obj === 'object' ? obj : null;
}

// ── Backup ───────────────────────────────────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = new URL(`../backups/fixDates-${ts}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(backupDir, { recursive: true });

const AMFE_HEADER_DATE_FIELDS = ['startDate', 'revDate', 'amfeDate', 'date'];
const CP_HEADER_DATE_FIELDS = ['date', 'revisionDate'];
const HO_HEADER_DATE_FIELDS = ['date', 'revisionDate'];

const IP_PAD_AMFE_ID = 'c9b93b84-f804-4cd0-91c1-c4878db41b97';

let totalChanges = 0;

// ══════════════════════════════════════════════════════════════════
// AMFE DOCUMENTS
// ══════════════════════════════════════════════════════════════════
console.log('\n=== AMFE DOCUMENTS ===');
const { data: amfeDocs, error: amfeErr } = await sb.from('amfe_documents').select('id, project_name, data');
if (amfeErr) { console.error('Error fetching AMFEs:', amfeErr.message); process.exit(1); }

writeFileSync(`${backupDir}/amfe_documents.json`, JSON.stringify(amfeDocs, null, 2));
console.log(`  Backed up ${amfeDocs.length} AMFE documents`);

for (const doc of amfeDocs) {
    const label = doc.project_name || doc.id;
    let changed = false;

    // Fix double-serialization
    let dataObj = ensureObject(doc.data);
    if (!dataObj) { console.log(`  [AMFE] ${label}: SKIP (null/invalid data)`); continue; }
    if (typeof doc.data === 'string') {
        console.log(`  [AMFE] ${label}: fixing double-serialized data`);
        changed = true;
    }

    const header = dataObj.header;
    if (!header) continue;

    // Normalize date fields
    for (const field of AMFE_HEADER_DATE_FIELDS) {
        if (header[field] && typeof header[field] === 'string') {
            const normalized = formatDateAR(header[field]);
            if (normalized !== header[field]) {
                console.log(`  [AMFE] ${label}: ${field}: "${header[field]}" -> "${normalized}"`);
                header[field] = normalized;
                changed = true;
            }
        }
    }

    // Special fix for IP PAD AMFE
    if (doc.id === IP_PAD_AMFE_ID) {
        console.log(`\n  --- IP PAD AMFE special fixes ---`);

        if (header.confidentiality !== 'Confidencial') {
            console.log(`  confidentiality: "${header.confidentiality}" -> "Confidencial"`);
            header.confidentiality = 'Confidencial';
            changed = true;
        }

        const newPartNumber = '2HC.858.417.B FAM / 2HC.858.417.C GKK / 2HC.858.417.C GKN';
        if (header.partNumber !== newPartNumber) {
            console.log(`  partNumber: "${header.partNumber}" -> "${newPartNumber}"`);
            header.partNumber = newPartNumber;
            changed = true;
        }

        const newApplicableParts = 'L1: 2HC.858.417.B FAM (Low Version)\nL2: 2HC.858.417.C GKK (High Version)\nL3: 2HC.858.417.C GKN (High Version)';
        if (header.applicableParts !== newApplicableParts) {
            console.log(`  applicableParts: "${(header.applicableParts || '').substring(0, 60)}..." -> updated`);
            header.applicableParts = newApplicableParts;
            changed = true;
        }

        // Check OP 130 vs OP 140
        console.log(`\n  --- Checking OP 130 vs OP 140 for duplicate content ---`);
        const operations = dataObj.operations || [];
        const op130 = operations.find(op => op.opNumber === '130' || op.operationNumber === '130');
        const op140 = operations.find(op => op.opNumber === '140' || op.operationNumber === '140');

        if (op130) {
            console.log(`  OP 130: name="${op130.name || op130.operationName}"`);
            console.log(`    operationFunction: "${(op130.operationFunction || '').substring(0, 120)}"`);
            const we130 = op130.workElements || [];
            console.log(`    workElements (${we130.length}):`);
            for (const we of we130) {
                console.log(`      [${we.type}] "${we.name}"`);
                for (const fn of (we.functions || [])) {
                    const fdesc = fn.description || fn.functionDescription || '';
                    console.log(`        func: "${fdesc.substring(0, 80)}"`);
                    for (const fail of (fn.failures || [])) {
                        console.log(`          fail: "${(fail.description || '').substring(0, 80)}"`);
                    }
                }
            }
        } else {
            console.log(`  OP 130 NOT FOUND`);
        }

        if (op140) {
            console.log(`  OP 140: name="${op140.name || op140.operationName}"`);
            console.log(`    operationFunction: "${(op140.operationFunction || '').substring(0, 120)}"`);
            const we140 = op140.workElements || [];
            console.log(`    workElements (${we140.length}):`);
            for (const we of we140) {
                console.log(`      [${we.type}] "${we.name}"`);
                for (const fn of (we.functions || [])) {
                    const fdesc = fn.description || fn.functionDescription || '';
                    console.log(`        func: "${fdesc.substring(0, 80)}"`);
                    for (const fail of (fn.failures || [])) {
                        console.log(`          fail: "${(fail.description || '').substring(0, 80)}"`);
                    }
                }
            }
        } else {
            console.log(`  OP 140 NOT FOUND`);
        }

        if (op130 && op140) {
            const we130Names = (op130.workElements || []).map(w => w.name).sort();
            const we140Names = (op140.workElements || []).map(w => w.name).sort();
            const nameOverlap = we130Names.filter(n => we140Names.includes(n));
            if (nameOverlap.length > 0) {
                console.log(`\n  *** OVERLAP: WE names shared: ${JSON.stringify(nameOverlap)}`);
            }

            const getFailDescs = (op) => {
                const descs = [];
                for (const we of (op.workElements || [])) {
                    for (const fn of (we.functions || [])) {
                        for (const fail of (fn.failures || [])) {
                            if (fail.description) descs.push(fail.description);
                        }
                    }
                }
                return descs;
            };
            const fail130 = getFailDescs(op130);
            const fail140 = getFailDescs(op140);
            const failOverlap = fail130.filter(d => fail140.includes(d));
            if (failOverlap.length > 0) {
                console.log(`  *** OVERLAP: Failure descriptions shared: ${JSON.stringify(failOverlap)}`);
            }
            if (fail130.length === 0 && fail140.length === 0) {
                console.log(`  No failures in either OP 130 or OP 140 — nothing to compare`);
            }

            if (op130.operationFunction && op140.operationFunction &&
                op130.operationFunction === op140.operationFunction) {
                console.log(`  *** OVERLAP: operationFunction is IDENTICAL in OP 130 and OP 140`);
            }
        }
    }

    if (changed) {
        totalChanges++;
        // Pass OBJECT, not JSON.stringify
        const { error } = await sb.from('amfe_documents').update({ data: dataObj }).eq('id', doc.id);
        if (error) console.error(`  ERROR updating AMFE ${doc.id}: ${error.message}`);
        else console.log(`  Updated AMFE: ${label}`);
    }
}

// ══════════════════════════════════════════════════════════════════
// CP DOCUMENTS
// ══════════════════════════════════════════════════════════════════
console.log('\n=== CP DOCUMENTS ===');
const { data: cpDocs, error: cpErr } = await sb.from('cp_documents').select('id, project_name, data');
if (cpErr) { console.error('Error fetching CPs:', cpErr.message); process.exit(1); }

writeFileSync(`${backupDir}/cp_documents.json`, JSON.stringify(cpDocs, null, 2));
console.log(`  Backed up ${cpDocs.length} CP documents`);

for (const doc of cpDocs) {
    const label = doc.project_name || doc.id;
    let changed = false;
    let dataObj = ensureObject(doc.data);
    if (!dataObj) continue;
    if (typeof doc.data === 'string') {
        console.log(`  [CP] ${label}: fixing double-serialized data`);
        changed = true;
    }

    const header = dataObj.header;
    if (!header) continue;

    for (const field of CP_HEADER_DATE_FIELDS) {
        if (header[field] && typeof header[field] === 'string') {
            const normalized = formatDateAR(header[field]);
            if (normalized !== header[field]) {
                console.log(`  [CP] ${label}: ${field}: "${header[field]}" -> "${normalized}"`);
                header[field] = normalized;
                changed = true;
            }
        }
    }

    if (changed) {
        totalChanges++;
        const { error } = await sb.from('cp_documents').update({ data: dataObj }).eq('id', doc.id);
        if (error) console.error(`  ERROR updating CP ${doc.id}: ${error.message}`);
        else console.log(`  Updated CP: ${label}`);
    }
}

// ══════════════════════════════════════════════════════════════════
// HO DOCUMENTS
// ══════════════════════════════════════════════════════════════════
console.log('\n=== HO DOCUMENTS ===');
const { data: hoDocs, error: hoErr } = await sb.from('ho_documents').select('id, linked_amfe_project, data');
if (hoErr) { console.error('Error fetching HOs:', hoErr.message); process.exit(1); }

writeFileSync(`${backupDir}/ho_documents.json`, JSON.stringify(hoDocs, null, 2));
console.log(`  Backed up ${hoDocs.length} HO documents`);

for (const doc of hoDocs) {
    const label = doc.linked_amfe_project || doc.id;
    let changed = false;
    let dataObj = ensureObject(doc.data);
    if (!dataObj) continue;
    if (typeof doc.data === 'string') {
        console.log(`  [HO] ${label}: fixing double-serialized data`);
        changed = true;
    }

    const header = dataObj.header;
    if (header) {
        for (const field of HO_HEADER_DATE_FIELDS) {
            if (header[field] && typeof header[field] === 'string') {
                const normalized = formatDateAR(header[field]);
                if (normalized !== header[field]) {
                    console.log(`  [HO] ${label}: header.${field}: "${header[field]}" -> "${normalized}"`);
                    header[field] = normalized;
                    changed = true;
                }
            }
        }
    }

    const sheets = dataObj.sheets || [];
    for (const sheet of sheets) {
        if (sheet.date && typeof sheet.date === 'string') {
            const normalized = formatDateAR(sheet.date);
            if (normalized !== sheet.date) {
                console.log(`  [HO] ${label}: sheet ${sheet.operationNumber || '?'} date: "${sheet.date}" -> "${normalized}"`);
                sheet.date = normalized;
                changed = true;
            }
        }
    }

    if (changed) {
        totalChanges++;
        const { error } = await sb.from('ho_documents').update({ data: dataObj }).eq('id', doc.id);
        if (error) console.error(`  ERROR updating HO ${doc.id}: ${error.message}`);
        else console.log(`  Updated HO: ${label}`);
    }
}

// ══════════════════════════════════════════════════════════════════
// VERIFICATION
// ══════════════════════════════════════════════════════════════════
console.log('\n=== VERIFICATION ===');
const { data: verifyDoc } = await sb.from('amfe_documents').select('id, data').eq('id', IP_PAD_AMFE_ID).single();
if (verifyDoc) {
    let vData = ensureObject(verifyDoc.data);
    const h = vData?.header;
    console.log(`  IP PAD AMFE verification:`);
    console.log(`    typeof data: ${typeof verifyDoc.data} (should be object)`);
    console.log(`    confidentiality: "${h?.confidentiality}"`);
    console.log(`    partNumber: "${h?.partNumber}"`);
    console.log(`    applicableParts: "${(h?.applicableParts || '').substring(0, 80)}..."`);
    console.log(`    startDate: "${h?.startDate}"`);
    console.log(`    revDate: "${h?.revDate}"`);
    console.log(`    operations count: ${(vData?.operations || []).length}`);
}

// Verify all docs are objects (not strings)
for (const table of ['amfe_documents', 'cp_documents', 'ho_documents']) {
    const { data: allDocs } = await sb.from(table).select('id, data');
    const strDocs = (allDocs || []).filter(d => typeof d.data === 'string');
    if (strDocs.length > 0) {
        console.log(`  WARNING: ${table} still has ${strDocs.length} docs with string data`);
    } else {
        console.log(`  ${table}: all ${(allDocs || []).length} docs have object data (OK)`);
    }
}

console.log(`\n=== DONE: ${totalChanges} documents updated ===`);
console.log(`Backups saved to: ${backupDir}`);
