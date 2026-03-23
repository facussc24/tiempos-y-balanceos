#!/usr/bin/env node
/**
 * fix-autoelevador.mjs
 *
 * Fixes "Autoelevador" assignments in CP reception operations.
 * In reception ops (OP 5, OP 10), "Autoelevador" should NOT be the
 * machineDeviceTool for all items. The correct instrument depends on
 * the characteristic type.
 *
 * Rules:
 *   - weight/gramaje/peso → "Balanza electrónica"
 *   - dimensional/medida/espesor/ancho/largo → "Calibre"
 *   - certificado/lote/identificación/fecha → "N/A"
 *   - color/aspecto/visual → "Visual"
 *   - Default: "N/A"
 *
 * Usage: node scripts/fix-autoelevador.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { createHash } from 'crypto';

// ─── Classification rules ────────────────────────────────────────────────────

function determineCorrectTool(item) {
    const text = [
        item.productCharacteristic || '',
        item.processCharacteristic || '',
    ].join(' ').toLowerCase();

    // Weight / gramaje / peso
    if (/\b(peso|gramaje|weight|gramos|kg|kilogramo|densidad)\b/i.test(text)) {
        return 'Balanza electrónica';
    }

    // Dimensional
    if (/\b(dimensional|medida|espesor|ancho|largo|longitud|diámetro|diametro|distancia|mm\b|milímetro|milimetro|tolerancia geom)/i.test(text)) {
        return 'Calibre';
    }

    // Certificate / lot / identification / date
    if (/\b(certificado|certificación|lote|identificaci[oó]n|fecha|trazabilidad|remito|etiqueta|rotulado|vencimiento|proveedor|tipo de producto|documentaci[oó]n|cod[ií]go)\b/i.test(text)) {
        return 'N/A';
    }

    // Visual / color / appearance
    if (/\b(color|aspecto|visual|apariencia|superficie|contaminaci[oó]n|mancha|rasgadura|golpe|da[nñ]o|abolladuras|deformaci[oó]n|rotura|suciedad|embalaje|estiba|manipulaci[oó]n|protecciones|protección|almacenaje)\b/i.test(text)) {
        return 'Visual';
    }

    // Default
    return 'N/A';
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    await initSupabase();

    console.log('\n========================================================================');
    console.log('  FIX: Autoelevador → correct instrument in reception ops');
    console.log('========================================================================\n');

    const cpRows = await selectSql(
        `SELECT id, project_name, data FROM cp_documents ORDER BY project_name`
    );
    console.log(`Loaded ${cpRows.length} CP documents.\n`);

    let totalItemsFixed = 0;
    let docsUpdated = 0;
    const allChanges = [];

    for (const row of cpRows) {
        const cpData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        const cpName = row.project_name || row.id;
        const items = cpData?.items || [];
        let modified = false;
        let cpChanges = 0;

        for (const item of items) {
            if (item.machineDeviceTool !== 'Autoelevador') continue;

            const correctTool = determineCorrectTool(item);

            allChanges.push({
                cpName,
                processDesc: item.processDescription || '(no desc)',
                characteristic: (item.productCharacteristic || item.processCharacteristic || '').slice(0, 80),
                oldTool: 'Autoelevador',
                newTool: correctTool,
            });

            item.machineDeviceTool = correctTool;
            modified = true;
            cpChanges++;
            totalItemsFixed++;
        }

        if (modified) {
            docsUpdated++;
            const dataStr = JSON.stringify(cpData);
            const checksum = createHash('sha256').update(dataStr).digest('hex');
            const jsonEscaped = dataStr.replace(/'/g, "''");

            await execSql(
                `UPDATE cp_documents SET data = '${jsonEscaped}', checksum = '${checksum}', updated_at = NOW() WHERE id = '${row.id}'`
            );

            console.log(`  Updated: ${cpName} (${cpChanges} items fixed, checksum: ${checksum.slice(0, 12)}...)`);
        }
    }

    // ── Report ──
    console.log('\n========================================================================');
    console.log('  INDIVIDUAL CHANGES');
    console.log('========================================================================\n');

    for (const c of allChanges) {
        console.log(`  CP: ${c.cpName}`);
        console.log(`    Item: ${c.processDesc} — ${c.characteristic}`);
        console.log(`    ${c.oldTool} -> ${c.newTool}`);
        console.log();
    }

    console.log('========================================================================');
    console.log('  SUMMARY');
    console.log('========================================================================\n');
    console.log(`  Total items fixed:       ${totalItemsFixed}`);
    console.log(`  CP documents updated:    ${docsUpdated} / ${cpRows.length}`);
    console.log();

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});
