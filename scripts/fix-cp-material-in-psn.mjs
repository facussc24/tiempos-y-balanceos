#!/usr/bin/env node
/**
 * Fix CP material in processStepNumber for Recepcion de MP items.
 *
 * AIAG CP 2024 allows sub-grouping by material within the same operation
 * by reusing the "Nro. Parte/Proceso" column (Col 14).
 * Format: "10 - PVC/Vinilo", "10 - Espuma PUR", etc.
 *
 * The merge logic in the export groups items with identical processStepNumber,
 * so items with "10 - PVC/Vinilo" merge separately from "10 - Espuma PUR".
 *
 * Usage:
 *   node scripts/fix-cp-material-in-psn.mjs              # dry-run
 *   node scripts/fix-cp-material-in-psn.mjs --apply       # write changes
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

const DRY_RUN = !process.argv.includes('--apply');

function sha256(str) {
    return createHash('sha256').update(str).digest('hex');
}

// ---------------------------------------------------------------------------
// Material classification rules for headrest recepcion items
// ---------------------------------------------------------------------------

/**
 * Classify a recepcion item into a material based on its characteristics.
 * Returns null if no material can be determined (generic item).
 */
function classifyMaterial(item) {
    const prod = (item.productCharacteristic || '').toLowerCase();
    const proc = (item.processCharacteristic || '').toLowerCase();
    const spec = (item.specification || '').toLowerCase();
    const eval_ = (item.evaluationTechnique || '').toLowerCase();
    const all = `${prod} ${proc} ${spec} ${eval_}`;

    // PVC/Vinilo
    if (all.includes('vinilo') || all.includes('pvc') || all.includes('vinyl')) return 'PVC/Vinilo';
    if (prod === 'tipo de producto' && spec.includes('pvc')) return 'PVC/Vinilo';
    if (prod === 'color' && !all.includes('espuma') && !all.includes('hilo')) return 'PVC/Vinilo';

    // Espuma PUR
    if (all.includes('espuma') || all.includes('foam') || all.includes('pur ')) return 'Espuma PUR';
    if (prod.includes('densidad') || prod.includes('dureza')) return 'Espuma PUR';
    if (spec.includes('kg/m') || spec.includes('kpa')) return 'Espuma PUR';

    // Armazon EPP
    if (all.includes('armazon') || all.includes('armaz') || all.includes('epp') || all.includes('insert')) return 'Armazon EPP';

    // Hilo costura
    if (all.includes('hilo') || all.includes('thread') || all.includes('costura')) return 'Hilo costura';

    // Varilla acero
    if (all.includes('varilla') || all.includes('acero') || all.includes('rod') || all.includes('steel')) return 'Varilla acero';

    // Tela
    if (all.includes('tela') || all.includes('tejido') || all.includes('fabric')) return 'Tela';

    // Flamabilidad is typically a PVC/Vinilo or surface material test
    if (prod.includes('flamabilidad') || proc.includes('flamabilidad')) return 'PVC/Vinilo';

    // Generic items (Espesor, Aspecto, Dimensional without material context)
    // These apply to multiple materials — leave without suffix
    return null;
}

/**
 * Check if this product is a headrest (well-structured material data).
 */
function isHeadrestProduct(projectName) {
    return projectName.includes('HEADREST') || projectName.includes('headrest');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    await initSupabase();
    console.log(`\nMode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}\n`);

    const cpDocs = await selectSql('SELECT id, project_name, data FROM cp_documents');
    console.log(`Found ${cpDocs.length} CP documents.\n`);

    let totalModified = 0;

    for (const row of cpDocs) {
        const data = JSON.parse(row.data);
        const items = data.items || [];
        let modified = 0;

        // Find recepcion items (OP 10 or OP 5 for Top Roll)
        for (const item of items) {
            const desc = (item.processDescription || '').toUpperCase();
            const isRecepcion = desc.includes('RECEP') || desc.includes('MATERIA PRIMA') || desc.includes('MATERIALES');
            if (!isRecepcion) continue;

            const psn = (item.processStepNumber || '').trim();
            // Skip if already has material suffix
            if (psn.includes(' - ')) continue;

            // Only classify for headrests (they have clear material references)
            if (isHeadrestProduct(row.project_name)) {
                const material = classifyMaterial(item);
                if (material) {
                    item.processStepNumber = `${psn} - ${material}`;
                    modified++;
                }
            }
            // For non-headrest products (Insert, Armrest, Top Roll, PWA):
            // Items are generic AMFE causes — leave processStepNumber as-is
        }

        if (modified > 0) {
            console.log(`  ${row.project_name}: ${modified} items updated`);
            // Show the new processStepNumber values
            const recItems = items.filter(i => (i.processStepNumber || '').includes(' - '));
            const groups = {};
            for (const item of recItems) {
                groups[item.processStepNumber] = (groups[item.processStepNumber] || 0) + 1;
            }
            for (const [psn, count] of Object.entries(groups)) {
                console.log(`    ${psn}: ${count} items`);
            }

            if (!DRY_RUN) {
                const jsonString = JSON.stringify(data);
                const checksum = sha256(jsonString);
                await execSql(
                    `UPDATE cp_documents SET data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                    [jsonString, checksum, row.id]
                );
            }
            totalModified += modified;
        } else {
            console.log(`  ${row.project_name}: no changes (non-headrest or no recepcion items)`);
        }
    }

    console.log(`\n${DRY_RUN ? 'Would modify' : 'Modified'} ${totalModified} items total.`);

    close();
    console.log('Done.');
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
