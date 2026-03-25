import { ensureAuth, fetchProductFamilies, fetchFamilyDocuments, execSqlRead } from './supabaseHelper.js';

async function run() {
    await ensureAuth();

    // Test the actual helper function
    const families = await fetchProductFamilies();
    console.log('fetchProductFamilies() returned:', families.length);

    // Try without active filter
    const allFamilies = await execSqlRead('SELECT id, name, active FROM product_families ORDER BY name');
    console.log('All families (no filter):', allFamilies.length);
    for (const f of allFamilies) console.log('  ', JSON.stringify(f));

    // Family documents
    const fDocs = await fetchFamilyDocuments();
    console.log('\nfetchFamilyDocuments() returned:', fDocs.length);
    if (fDocs.length > 0) {
        console.log('columns:', Object.keys(fDocs[0]));
        console.log('first:', JSON.stringify(fDocs[0]));
    }

    process.exit(0);
}

run().catch(e => { console.error('FATAL', e); process.exit(1); });
