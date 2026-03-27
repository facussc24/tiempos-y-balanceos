#!/usr/bin/env node
/**
 * Revert processStepNumber suffixes + populate componentMaterial
 *
 * 1. Items with " - Material" suffix in processStepNumber:
 *    → extract material → componentMaterial, clean PSN to just the number
 * 2. Recepcion items without suffix:
 *    → classify material by keywords in characteristics/specification
 * 3. Non-recepcion items: componentMaterial = "" (empty)
 *
 * Usage:
 *   node scripts/fix-cp-revert-psn-add-material.mjs              # dry-run
 *   node scripts/fix-cp-revert-psn-add-material.mjs --apply       # write changes
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const DRY_RUN = !process.argv.includes('--apply');

function sha256(str) {
    return createHash('sha256').update(str).digest('hex');
}

// ---------------------------------------------------------------------------
// Material classification — universal (works for all product families)
// ---------------------------------------------------------------------------

/**
 * Classify a recepcion item into a material based on its characteristics.
 * Returns null if no material can be determined (generic item).
 *
 * @param {object} item - CP item
 * @param {string} productFamily - product family identifier from project_name
 */
function classifyMaterial(item, productFamily) {
    const prod = (item.productCharacteristic || '').toLowerCase();
    const proc = (item.processCharacteristic || '').toLowerCase();
    const spec = (item.specification || '').toLowerCase();
    const eval_ = (item.evaluationTechnique || '').toLowerCase();
    const desc = (item.processDescription || '').toLowerCase();
    const all = `${prod} ${proc} ${spec} ${eval_} ${desc}`;

    // --- Varilla acero (headrests only — only headrests have steel rods) ---
    if (productFamily === 'HEADREST') {
        if (all.includes('varilla') || all.includes('acero') || all.includes('rod') || all.includes('steel')) {
            return 'Varilla acero';
        }
    }

    // --- Hilo costura ---
    if (all.includes('hilo') || all.includes('thread') || all.includes('costura')) {
        return 'Hilo costura';
    }

    // --- PC/ABS Cycoloy (Insert only) ---
    if (productFamily === 'INSERT') {
        if (all.includes('cycoloy') || all.includes('pc/abs') || all.includes('polycarbonate') ||
            (all.includes('impacto') && all.includes('resistencia'))) {
            return 'PC/ABS Cycoloy LG9000';
        }
    }

    // --- Cinta Tessa (Insert only) ---
    if (productFamily === 'INSERT') {
        if (all.includes('tessa') || all.includes('52110') ||
            (all.includes('cinta') && (all.includes('adhesiv') || all.includes('tape')))) {
            return 'Cinta Tessa 52110';
        }
    }

    // --- Adhesivo Hot Melt (Top Roll) ---
    if (productFamily === 'TOP_ROLL') {
        if (all.includes('adhesiv') || all.includes('hot melt') || all.includes('pegamento') || all.includes('bond')) {
            return 'Adhesivo Hot Melt';
        }
    }

    // --- Sustrato plastico (Top Roll) ---
    if (productFamily === 'TOP_ROLL') {
        if (all.includes('sustrato') || all.includes('substrate') || all.includes('rigido') || all.includes('soporte plastico')) {
            return 'Sustrato plastico';
        }
    }

    // --- Armazon EPP (Armrest) ---
    if (productFamily === 'ARMREST') {
        if (all.includes('armazon') || all.includes('epp') || all.includes('estructura') ||
            all.includes('insert') || all.includes('soporte')) {
            return 'Armazon EPP';
        }
    }

    // --- Aplix (Telas Planas) ---
    if (productFamily === 'TELAS_PLANAS') {
        if (all.includes('aplix') || all.includes('velcro') || all.includes('hook') || all.includes('loop')) {
            return 'Aplix';
        }
    }

    // --- Punzonado bi-componente (Telas Planas) ---
    if (productFamily === 'TELAS_PLANAS') {
        if (all.includes('punzonado') || all.includes('bi-componente') || all.includes('non-woven') || all.includes('nontejido')) {
            return 'Punzonado bi-componente';
        }
    }

    // --- Refuerzos (Telas Termoformadas) ---
    if (productFamily === 'TELAS_TERMOFORMADAS') {
        if (all.includes('refuerzo') || all.includes('reinforcement')) {
            return 'Refuerzos';
        }
    }

    // --- Espuma PUR ---
    if (all.includes('espuma') || all.includes('foam') || all.includes('pur ') || all.includes('poliuretano')) {
        return 'Espuma PUR';
    }
    if (prod.includes('densidad') || prod.includes('dureza')) return 'Espuma PUR';
    if (spec.includes('kg/m') || spec.includes('kpa')) return 'Espuma PUR';

    // --- Tela termoformada ---
    if (productFamily === 'TELAS_TERMOFORMADAS') {
        if (all.includes('tela') || all.includes('tejido') || all.includes('fabric') || all.includes('termoform')) {
            return 'Tela termoformada';
        }
    }

    // --- Tela principal (Telas Planas) ---
    if (productFamily === 'TELAS_PLANAS') {
        if (all.includes('tela') || all.includes('tejido') || all.includes('fabric')) {
            return 'Tela principal';
        }
    }

    // --- PVC/Vinilo (most common material across families) ---
    if (all.includes('vinilo') || all.includes('pvc') || all.includes('vinyl') || all.includes('tl 520')) {
        return 'PVC/Vinilo';
    }
    // Color without foam/thread context → likely PVC/Vinilo surface material
    if ((prod.includes('color') || prod.includes('aspecto')) &&
        !all.includes('espuma') && !all.includes('hilo') && !all.includes('tela')) {
        if (['INSERT', 'ARMREST', 'TOP_ROLL', 'HEADREST'].some(f => productFamily.includes(f))) {
            return 'PVC/Vinilo';
        }
    }
    // Flamabilidad → surface material (PVC/Vinilo for VWA, Tela for PWA)
    if (prod.includes('flamabilidad') || proc.includes('flamabilidad')) {
        if (productFamily === 'TELAS_PLANAS') return 'Tela principal';
        if (productFamily === 'TELAS_TERMOFORMADAS') return 'Tela termoformada';
        return 'PVC/Vinilo';
    }

    // Cannot determine with certainty → leave empty
    return null;
}

/**
 * Identify product family from project_name.
 */
function identifyFamily(projectName) {
    const name = (projectName || '').toUpperCase();
    if (name.includes('INSERT')) return 'INSERT';
    if (name.includes('ARMREST')) return 'ARMREST';
    if (name.includes('TOP') && name.includes('ROLL')) return 'TOP_ROLL';
    if (name.includes('HEADREST')) return 'HEADREST';
    if (name.includes('PLANA')) return 'TELAS_PLANAS';
    if (name.includes('TERMOFORMAD')) return 'TELAS_TERMOFORMADAS';
    return 'UNKNOWN';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    await initSupabase();
    console.log(`\nMode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}\n`);

    const cpDocs = await selectSql('SELECT id, project_name, data FROM cp_documents');
    console.log(`Found ${cpDocs.length} CP documents.\n`);

    let totalReverted = 0;
    let totalClassified = 0;

    for (const row of cpDocs) {
        const data = JSON.parse(row.data);
        const items = data.items || [];
        const family = identifyFamily(row.project_name);
        let reverted = 0;
        let classified = 0;

        for (const item of items) {
            const psn = (item.processStepNumber || '').trim();
            const descUpper = (item.processDescription || '').toUpperCase();
            const isRecepcion = descUpper.includes('RECEP') || descUpper.includes('MATERIA PRIMA');

            // Step 1: Revert items with " - " suffix
            if (psn.includes(' - ')) {
                const dashIdx = psn.indexOf(' - ');
                const cleanPsn = psn.substring(0, dashIdx).trim();
                const material = psn.substring(dashIdx + 3).trim();
                item.processStepNumber = cleanPsn;
                item.componentMaterial = material;
                reverted++;
                continue; // already classified
            }

            // Step 2: Classify recepcion items that didn't have suffix
            if (isRecepcion && !(item.componentMaterial || '').trim()) {
                const material = classifyMaterial(item, family);
                if (material) {
                    item.componentMaterial = material;
                    classified++;
                }
            }

            // Step 3: Non-recepcion items — ensure componentMaterial is empty
            if (!isRecepcion) {
                item.componentMaterial = '';
            }
        }

        console.log(`  ${row.project_name} (${family}):`);
        console.log(`    Reverted PSN: ${reverted} | Classified: ${classified}`);

        // Show material distribution for recepcion items
        const recItems = items.filter(i => {
            const desc = (i.processDescription || '').toUpperCase();
            return desc.includes('RECEP') || desc.includes('MATERIA PRIMA');
        });
        const materialGroups = {};
        let emptyCount = 0;
        for (const item of recItems) {
            const mat = (item.componentMaterial || '').trim();
            if (mat) {
                materialGroups[mat] = (materialGroups[mat] || 0) + 1;
            } else {
                emptyCount++;
            }
        }
        for (const [mat, count] of Object.entries(materialGroups).sort()) {
            console.log(`      ${mat}: ${count} items`);
        }
        if (emptyCount > 0) {
            console.log(`      (sin material): ${emptyCount} items`);
        }

        if (reverted > 0 || classified > 0) {
            if (!DRY_RUN) {
                const jsonString = JSON.stringify(data);
                const checksum = sha256(jsonString);
                await execSql(
                    `UPDATE cp_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                    [jsonString, checksum, row.id]
                );
            }
        }

        totalReverted += reverted;
        totalClassified += classified;
    }

    console.log(`\n${DRY_RUN ? 'Would revert' : 'Reverted'} ${totalReverted} PSN suffixes.`);
    console.log(`${DRY_RUN ? 'Would classify' : 'Classified'} ${totalClassified} recepcion items.`);

    close();
    console.log('Done.');
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
