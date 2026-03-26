/**
 * add-vw-norms-reception.ts
 *
 * Enrich reception (OP 10 / OP 5) CP items for VWA products with VW norm references.
 * Only touches VWA CPs — never PWA, never IP PAD.
 *
 * Run: npx tsx scripts/add-vw-norms-reception.ts
 */
import {
    ensureAuth,
    fetchAllCpDocs,
    updateDocDirect,
    backupDoc,
} from './audit/supabaseHelper.js';

// ── Norm mapping ─────────────────────────────────────────────────────────────

interface NormRule {
    keywords: string[];
    norm: string;
    fullSpec: string;
}

const NORM_RULES: NormRule[] = [
    {
        keywords: ['flamabilidad', 'inflamabilidad', 'combustion'],
        norm: 'TL 1010',
        fullSpec: 'Según TL 1010 VW',
    },
    {
        keywords: ['emision', 'voc', 'olor'],
        norm: 'VW 50180',
        fullSpec: 'Emisiones ≤ 30 µg C/g, fogging ≤ 2 mg, olor ≤ 3.5 según VW 50180',
    },
    {
        keywords: ['color', 'brillo', 'apariencia', 'aspecto'],
        norm: 'VW 50190',
        fullSpec: '', // append-only — handled in logic
    },
    {
        keywords: ['pvc', 'vinilo', 'cuero sintet', 'synthetic leather'],
        norm: 'VW 50132',
        fullSpec: 'Espesor 1.10 ± 0.10 mm, backing Ether-PUR 1.0 + 0.5 mm según VW 50132',
    },
    {
        keywords: ['hilo', 'thread', 'costura'],
        norm: 'VW 50106',
        fullSpec: 'Hilo Polyester según VW 50106 tipo M,D,L,Q',
    },
    {
        keywords: ['tela', 'textil', 'fabric', 'tejido'],
        norm: 'VW 50105',
        fullSpec: 'Según VW 50105',
    },
    {
        keywords: ['espuma', 'foam', 'pur', 'poliuretano'],
        norm: 'PV 3410',
        fullSpec: 'Según PV 3410 y TL 52653-C',
    },
    {
        keywords: ['luz', 'uv', 'solidez', 'light fast'],
        norm: 'PV 1303',
        fullSpec: 'Escala gris ≥ 4 post 5 periodos según PV 1303',
    },
    {
        keywords: ['pp', 'polipropileno'],
        norm: 'VW 44045',
        fullSpec: 'PP según VW 44045-PP1',
    },
    {
        keywords: ['marcado', 'identificacion', 'etiqueta', 'codigo'],
        norm: 'VW 10500',
        fullSpec: 'Según VW 10500 (cod. fabricante VW 10540-1, país VW 10550, fecha VW 10560)',
    },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize text: lowercase + strip accents */
function norm(text: string): string {
    return (text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Check if the spec already contains a given norm reference */
function specHasNorm(spec: string, normRef: string): boolean {
    // Normalize both for comparison — strip spaces and case
    const normSpec = norm(spec);
    const normNorm = norm(normRef);
    return normSpec.includes(normNorm);
}

/** Check if spec is effectively TBD / empty */
function isTbd(spec: string): boolean {
    const s = (spec || '').trim().toUpperCase();
    return s === '' || s === 'TBD' || s === 'N/A' || s === '-';
}

/**
 * Try to enrich a CP item specification with the appropriate VW norm.
 * Returns the new spec string, or null if no change.
 */
function tryEnrichWithNorm(combined: string, currentSpec: string): string | null {
    const normalized = norm(combined);

    for (const rule of NORM_RULES) {
        const matched = rule.keywords.some(kw => normalized.includes(norm(kw)));
        if (!matched) continue;

        // Never add a norm that's already referenced
        if (specHasNorm(currentSpec, rule.norm)) {
            return null;
        }

        // Also check secondary norm references (e.g. PV 3410 rule also has TL 52653-C)
        if (rule.fullSpec.includes('TL 52653') && specHasNorm(currentSpec, 'TL 52653')) {
            return null;
        }

        // Special case: color/apariencia — append "según VW 50190" to existing spec
        if (rule.norm === 'VW 50190') {
            if (isTbd(currentSpec)) {
                return 'Según VW 50190';
            }
            return `${currentSpec.trim()} según VW 50190`;
        }

        // If spec is TBD, replace entirely with the norm-based spec
        if (isTbd(currentSpec)) {
            return rule.fullSpec;
        }

        // Spec has a concrete value — append the norm reference
        return `${currentSpec.trim()} según ${rule.norm}`;
    }

    return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('=== Add VW Norms to Reception CP Items ===\n');
    await ensureAuth();

    console.log('Loading CP documents...');
    const cpDocs = await fetchAllCpDocs();
    console.log(`  Total CPs: ${cpDocs.length}`);

    // Filter VWA only — exclude PWA (TELAS), IP PAD
    const vwaCps = cpDocs.filter(d => {
        const proj = ((d.raw.project_name as string) || '').toUpperCase();
        return (
            !proj.includes('TELAS') &&
            !proj.includes('PWA') &&
            !proj.includes('IP_PAD') &&
            !proj.includes('IP PAD')
        );
    });
    console.log(`  VWA CPs: ${vwaCps.length}`);

    let totalEnriched = 0;
    const enrichLog: Array<{
        project: string;
        opNumber: string;
        characteristic: string;
        oldSpec: string;
        newSpec: string;
        normAdded: string;
    }> = [];

    for (const cp of vwaCps) {
        const doc = cp.parsed;
        let changed = 0;

        for (const item of doc.items || []) {
            const opNum = item.processStepNumber;
            // Only reception ops (5, 10)
            if (opNum !== '5' && opNum !== '10') continue;

            const spec = (item.specification || '').toLowerCase();
            const prodChar = (item.productCharacteristic || item.characteristic || '').toLowerCase();
            const procChar = (item.processCharacteristic || '').toLowerCase();
            const combined = `${prodChar} ${procChar} ${spec}`;

            const newSpec = tryEnrichWithNorm(combined, item.specification || '');
            if (newSpec && newSpec !== item.specification) {
                const oldSpec = item.specification || '';
                item.specification = newSpec;
                changed++;

                // Figure out which norm was added
                const normMatch = newSpec.match(/(?:VW\s*\d+|TL\s*\d+|PV\s*\d+)/i);
                enrichLog.push({
                    project: String(cp.raw.project_name),
                    opNumber: opNum,
                    characteristic: item.productCharacteristic || item.characteristic || item.processCharacteristic || '?',
                    oldSpec,
                    newSpec,
                    normAdded: normMatch ? normMatch[0] : '?',
                });
            }
        }

        if (changed > 0) {
            backupDoc('cp_documents', cp.id, cp.raw.data as string);
            const dataJson = JSON.stringify(doc);
            await updateDocDirect('cp_documents', cp.id, dataJson, {
                item_count: doc.items.length,
            });
            console.log(`  [${cp.raw.project_name}] Enriched ${changed} items with VW norms`);
            totalEnriched += changed;
        }
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n════════════════════════════════════════════════════');
    console.log('  ENRICHMENT SUMMARY');
    console.log('════════════════════════════════════════════════════');
    console.log(`\n  Total items enriched: ${totalEnriched}`);

    if (enrichLog.length > 0) {
        console.log('\n  Details:');
        for (const e of enrichLog) {
            console.log(`    [${e.project}] OP ${e.opNumber} — ${e.characteristic}`);
            console.log(`      Old: "${e.oldSpec}"`);
            console.log(`      New: "${e.newSpec}"`);
            console.log(`      Norm: ${e.normAdded}`);
        }
    } else {
        console.log('\n  No items needed enrichment (all already have norm references).');
    }

    console.log('\nDone.');
}

main().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});
