import { ensureAuth, fetchAllAmfeDocs, fetchAllCpDocs, fetchAllHoDocs, fetchAllPfdDocs } from './supabaseHelper';

async function main() {
    await ensureAuth();
    console.log('Auth OK');

    const amfe = await fetchAllAmfeDocs();
    console.log(`AMFE docs: ${amfe.length}`);

    const cp = await fetchAllCpDocs();
    console.log(`CP docs: ${cp.length}`);

    const ho = await fetchAllHoDocs();
    console.log(`HO docs: ${ho.length}`);

    const pfd = await fetchAllPfdDocs();
    console.log(`PFD docs: ${pfd.length}`);

    // Print first AMFE doc operation names as sanity check
    if (amfe.length > 0) {
        const firstDoc = amfe[0].parsed;
        const ops = firstDoc.operations || [];
        console.log(`\nFirst AMFE (${amfe[0].raw.project_name}):`);
        for (const op of ops.slice(0, 5)) {
            console.log(`  OP ${op.opNumber}: ${op.name}`);
        }
    }
}

main().catch(e => { console.error(e); process.exit(1); });
