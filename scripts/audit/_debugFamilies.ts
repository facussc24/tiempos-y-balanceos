import { ensureAuth, execSqlRead } from './supabaseHelper.js';

async function run() {
    await ensureAuth();
    console.log('auth ok');

    try {
        const fam = await execSqlRead('SELECT * FROM product_families');
        console.log('families count:', fam.length);
        if (fam.length > 0) {
            console.log('columns:', Object.keys(fam[0]));
            console.log('first:', JSON.stringify(fam[0]).slice(0, 300));
        }
    } catch (e: any) {
        console.log('error fetching product_families:', e.message);
    }

    try {
        const fd = await execSqlRead('SELECT DISTINCT family_id FROM family_documents');
        console.log('distinct family_ids in family_documents:', fd.length);
        for (const f of fd) console.log('  fam_id:', JSON.stringify(f));
    } catch (e: any) {
        console.log('error fetching family_documents:', e.message);
    }

    process.exit(0);
}

run().catch(e => { console.error('FATAL', e); process.exit(1); });
