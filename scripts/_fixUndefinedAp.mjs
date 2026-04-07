/**
 * Fix causes where ap/actionPriority = "undefined" (string literal)
 * These are causes without S/O/D that got string "undefined" from normalization
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });

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

console.log('=== Fix "undefined" string in ap/actionPriority ===\n');

const { data: allDocs } = await sb.from('amfe_documents').select('id, project_name, data');

for (const doc of allDocs) {
    const shortName = (doc.project_name || '').split('/').pop();
    const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
    let fixCount = 0;

    for (const op of (data.operations || []))
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    for (const c of (fail.causes || [])) {
                        // Fix string "undefined" values
                        if (c.ap === 'undefined' || c.ap === undefined) { c.ap = ''; fixCount++; }
                        if (c.actionPriority === 'undefined' || c.actionPriority === undefined) { c.actionPriority = ''; fixCount++; }
                        // Fix other string "undefined" fields
                        for (const key of Object.keys(c)) {
                            if (c[key] === 'undefined') { c[key] = ''; fixCount++; }
                        }
                    }

    if (fixCount > 0) {
        const { error: saveErr } = await sb.from('amfe_documents').update({ data }).eq('id', doc.id);
        const stats = computeStats(data);
        await sb.from('amfe_documents').update(stats).eq('id', doc.id);
        console.log(`${shortName}: Fixed ${fixCount} "undefined" strings, saved OK. Metadata: ops=${stats.operation_count} c=${stats.cause_count} H=${stats.ap_h_count} M=${stats.ap_m_count}`);
    } else {
        console.log(`${shortName}: No "undefined" strings found`);
    }
}

// Post-check
console.log('\n--- Post-check: causes with empty ap that HAVE S/O/D (should be 0) ---');
const { data: freshDocs } = await sb.from('amfe_documents').select('id, project_name, data');
for (const doc of freshDocs) {
    const shortName = (doc.project_name || '').split('/').pop();
    const data = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
    let emptyApWithRatings = 0;
    let emptyApNoRatings = 0;
    for (const op of (data.operations || []))
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const fail of (fn.failures || []))
                    for (const c of (fail.causes || [])) {
                        if (!c.ap || c.ap === '') {
                            const s = Number(fail.severity) || Number(c.severity) || 0;
                            const o = Number(c.occurrence) || 0;
                            const d = Number(c.detection) || 0;
                            if (s && o && d) emptyApWithRatings++;
                            else emptyApNoRatings++;
                        }
                    }
    if (emptyApWithRatings > 0 || emptyApNoRatings > 0) {
        console.log(`  ${shortName}: emptyAP+ratings=${emptyApWithRatings} emptyAP+noRatings=${emptyApNoRatings}`);
    }
}

console.log('\n=== DONE ===');
