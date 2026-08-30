/**
 * Normalize field names in 6 VWA AMFEs (excluding IP PAD which was already done)
 *
 * For each doc:
 * 1. Check if operations have operationNumber but NOT opNumber
 * 2. If yes: add opNumber/name aliases, move severity from cause to failure, add ap from actionPriority
 * 3. Save back to Supabase (object, NOT JSON.stringify!)
 * 4. Re-sync metadata
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

function apRule(s, o, d) {
    if (s <= 1) return 'L';
    if (s <= 3) return (o >= 8 && d >= 5) ? 'M' : 'L';
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
    if (o >= 2) { if (d >= 7) return 'H'; if (d >= 5) return 'M'; return 'L'; }
    return 'L';
}

function computeStats(doc) {
    let cc = 0, h = 0, m = 0, filled = 0;
    for (const op of (doc.operations || []))
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    for (const c of (fail.causes || [])) {
                        cc++;
                        const ap = c.ap || c.actionPriority || '';
                        if (ap === 'H') h++;
                        if (ap === 'M') m++;
                        const sev = Number(fail.severity) || Number(c.severity) || 0;
                        if (sev && c.occurrence && c.detection) filled++;
                    }
    return { operation_count: (doc.operations || []).length, cause_count: cc, ap_h_count: h, ap_m_count: m, coverage_percent: cc > 0 ? Math.round((filled / cc) * 100) : 0 };
}

const TARGET_NAMES = [
    'HEADREST_FRONT', 'HEADREST_REAR_CEN', 'HEADREST_REAR_OUT',
    'ARMREST_DOOR_PANEL', 'TOP_ROLL', 'INSERT'
];

console.log('=== Normalize VWA AMFEs (6 docs) ===\n');

const { data: allDocs, error } = await sb.from('amfe_documents').select('id, project_name, data');
if (error) { console.error('FATAL:', error.message); process.exit(1); }

// Filter to VWA docs only (excluding IP_PADS and PWA)
const vwaDocs = allDocs.filter(d => {
    const shortName = (d.project_name || '').split('/').pop() || '';
    return TARGET_NAMES.includes(shortName);
});

console.log(`Found ${vwaDocs.length} VWA docs to check\n`);

let totalNormalized = 0;

for (const doc of vwaDocs) {
    const shortName = doc.project_name.split('/').pop();
    const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;

    // Check if normalization is needed
    let needsNorm = false;
    let opNormCount = 0, apNormCount = 0, sevMovedCount = 0;

    for (const op of (data.operations || [])) {
        if (op.operationNumber && !op.opNumber) needsNorm = true;
        if (op.operationName && !op.name) needsNorm = true;
    }

    // Also check causes
    for (const op of (data.operations || []))
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    for (const c of (fail.causes || [])) {
                        if (c.actionPriority && !c.ap) needsNorm = true;
                        if (c.severity && (!fail.severity || fail.severity === '' || fail.severity === 0)) needsNorm = true;
                    }

    if (!needsNorm) {
        console.log(`${shortName}: Already normalized, skipping`);
        continue;
    }

    console.log(`${shortName}: Needs normalization`);

    // Apply normalization
    for (const op of (data.operations || [])) {
        if (op.operationNumber && !op.opNumber) {
            op.opNumber = op.operationNumber;
            opNormCount++;
        }
        if (op.operationName && !op.name) {
            op.name = op.operationName;
            opNormCount++;
        }

        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    // Move severity from causes to failure if not set
                    if (!fail.severity || fail.severity === '' || fail.severity === 0) {
                        let maxSev = 0;
                        for (const c of (fail.causes || [])) {
                            const s = Number(c.severity);
                            if (s > maxSev) maxSev = s;
                        }
                        if (maxSev > 0) {
                            fail.severity = maxSev;
                            sevMovedCount++;
                        }
                    }

                    for (const c of (fail.causes || [])) {
                        // Add ap alias from actionPriority
                        if (c.actionPriority && !c.ap) {
                            c.ap = c.actionPriority;
                            apNormCount++;
                        }
                        // Recalculate AP if we have S/O/D
                        const s = Number(fail.severity) || Number(c.severity);
                        const o = Number(c.occurrence);
                        const d = Number(c.detection);
                        if (s >= 1 && o >= 1 && d >= 1) {
                            const newAp = apRule(s, o, d);
                            if (newAp) {
                                c.ap = newAp;
                                c.actionPriority = newAp;
                            }
                        }
                    }
                }
            }
        }
    }

    console.log(`  Normalized: ${opNormCount} op fields, ${apNormCount} cause.ap added, ${sevMovedCount} severities moved`);

    // Save back (object, NOT JSON.stringify!)
    const { error: saveErr } = await sb.from('amfe_documents').update({ data }).eq('id', doc.id);
    if (saveErr) {
        console.log(`  SAVE FAILED: ${saveErr.message}`);
        continue;
    }
    console.log(`  Saved OK`);

    // Re-sync metadata
    const stats = computeStats(data);
    const { error: metaErr } = await sb.from('amfe_documents').update(stats).eq('id', doc.id);
    if (metaErr) {
        console.log(`  METADATA FAILED: ${metaErr.message}`);
    } else {
        console.log(`  Metadata: ops=${stats.operation_count} c=${stats.cause_count} H=${stats.ap_h_count} M=${stats.ap_m_count} cov=${stats.coverage_percent}%`);
    }

    totalNormalized++;
}

console.log(`\n=== DONE: ${totalNormalized}/${vwaDocs.length} docs normalized ===`);

// Post-verification: check that all docs now have both fields
console.log('\n--- Post-verification ---');
const { data: freshDocs } = await sb.from('amfe_documents').select('id, project_name, data');
for (const doc of freshDocs) {
    const shortName = (doc.project_name || '').split('/').pop() || '';
    if (!TARGET_NAMES.includes(shortName)) continue;

    const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
    let missingOpNumber = 0, missingAp = 0;

    for (const op of (data.operations || [])) {
        if (!op.opNumber) missingOpNumber++;
    }
    for (const op of (data.operations || []))
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    for (const c of (fail.causes || [])) {
                        if (!c.ap && (c.actionPriority || c.severity || c.occurrence)) missingAp++;
                    }

    const status = (missingOpNumber === 0 && missingAp === 0) ? 'OK' : 'ISSUES';
    console.log(`  ${shortName}: ${status} (missingOpNumber=${missingOpNumber}, missingAp=${missingAp})`);
}
