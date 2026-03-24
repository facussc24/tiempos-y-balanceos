#!/usr/bin/env node
/**
 * Load visual aid images into Insert Patagonia HO document.
 *
 * Reads 6 PNG images from the user's originals folder and inserts them
 * as base64 into the corresponding HO sheets in Supabase.
 *
 * Image mapping:
 *   OP30 → Imagen1.png (inyectora), Imagen2.png (rack piezas)
 *   40   → Imagen3.png (pieza con líneas dimensionales)  → sheet operationNumber '40'
 *   60   → 1.png, 2.png, 3.png (diagramas embalaje)      → sheet operationNumber '60'
 *
 * Note: OP30 folder → operationNumber '30' (Almacenamiento WIP / Inyección)
 *
 * Usage: node scripts/load-ho-images.mjs
 */

import { initSupabase, selectSql, execSql, close } from './supabaseHelper.mjs';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Image definitions
// ---------------------------------------------------------------------------

const IMAGES_BASE = 'C:/Users/FacundoS-PC/Documents/AMFES PC HO/VWA/INSERT/imagenes para HO';

const IMAGE_MAP = [
    {
        opNumber: '30',
        file: resolve(IMAGES_BASE, 'OP30', 'Imagen1.png'),
        caption: 'Maquina inyectora (prensa)',
    },
    {
        opNumber: '30',
        file: resolve(IMAGES_BASE, 'OP30', 'Imagen2.png'),
        caption: 'Insertos terminados en rack',
    },
    {
        opNumber: '40',
        file: resolve(IMAGES_BASE, '40', 'Imagen3.png'),
        caption: 'Pieza terminada - referencia dimensional',
    },
    {
        opNumber: '60',
        file: resolve(IMAGES_BASE, '60', '1.png'),
        caption: 'Diagrama de caja: 496x634x170mm, 8 piezas/caja',
    },
    {
        opNumber: '60',
        file: resolve(IMAGES_BASE, '60', '2.png'),
        caption: 'Layout de pallet: 3 cajas/nivel, hasta 72 piezas',
    },
    {
        opNumber: '60',
        file: resolve(IMAGES_BASE, '60', '3.png'),
        caption: 'Vista tecnica: pieza en caja',
    },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    console.log('=== Load HO Visual Aid Images ===\n');

    await initSupabase();

    // 1. Find the Insert Patagonia HO document
    const hoRows = await selectSql(
        `SELECT id, data, sheet_count FROM ho_documents WHERE linked_amfe_project = ?`,
        ['VWA/PATAGONIA/INSERT'],
    );

    if (hoRows.length === 0) {
        console.error('ERROR: Insert Patagonia HO not found in Supabase');
        close();
        process.exit(1);
    }

    const hoRow = hoRows[0];
    const hoId = hoRow.id;
    const doc = JSON.parse(hoRow.data);
    console.log(`Found HO: ${hoId} (${doc.sheets.length} sheets)\n`);

    // 2. Read images and add to sheets
    let totalAdded = 0;
    const sheetUpdates = new Map(); // opNumber → count

    for (const img of IMAGE_MAP) {
        // Find the matching sheet
        const sheet = doc.sheets.find(s => s.operationNumber === img.opNumber);
        if (!sheet) {
            console.warn(`  WARN: No sheet found for operationNumber '${img.opNumber}', skipping ${img.file}`);
            continue;
        }

        // Read the image file
        let raw;
        try {
            raw = readFileSync(img.file);
        } catch (err) {
            console.warn(`  WARN: Cannot read ${img.file}: ${err.message}`);
            continue;
        }

        // Convert to base64 data URI
        const base64 = `data:image/png;base64,${raw.toString('base64')}`;
        const sizeKB = Math.round(raw.length / 1024);
        const base64KB = Math.round(base64.length / 1024);

        // Check size limit (2MB raw)
        if (raw.length > 2 * 1024 * 1024) {
            console.warn(`  WARN: ${img.file} is ${sizeKB}KB (exceeds 2MB limit), skipping`);
            continue;
        }

        // Initialize visualAids array if needed
        if (!Array.isArray(sheet.visualAids)) {
            sheet.visualAids = [];
        }

        // Check if this caption already exists (prevent duplicates)
        if (sheet.visualAids.some(v => v.caption === img.caption)) {
            console.log(`  SKIP: "${img.caption}" already exists in Op ${img.opNumber}`);
            continue;
        }

        // Add the visual aid
        const order = sheet.visualAids.length;
        sheet.visualAids.push({
            id: randomUUID(),
            imageData: base64,
            caption: img.caption,
            order,
        });

        totalAdded++;
        sheetUpdates.set(img.opNumber, (sheetUpdates.get(img.opNumber) || 0) + 1);
        console.log(`  OK: Op ${img.opNumber} ← "${img.caption}" (${sizeKB}KB raw, ${base64KB}KB base64)`);
    }

    if (totalAdded === 0) {
        console.log('\nNo images to add (all already exist or files missing).');
        close();
        return;
    }

    // 3. Save back to Supabase
    console.log(`\nSaving ${totalAdded} images to Supabase...`);

    const updatedData = JSON.stringify(doc);
    await execSql(
        `UPDATE ho_documents SET data = ?, updated_at = NOW() WHERE id = ?`,
        [updatedData, hoId],
    );

    console.log('Saved successfully.');

    // 4. Summary
    console.log('\n=== Summary ===');
    console.log(`Total images added: ${totalAdded}`);
    for (const [op, count] of sheetUpdates.entries()) {
        const sheet = doc.sheets.find(s => s.operationNumber === op);
        console.log(`  Op ${op} (${sheet?.operationName}): ${count} image(s), total now: ${sheet?.visualAids?.length}`);
    }
    console.log(`Document data size: ${Math.round(updatedData.length / 1024)}KB`);

    close();
}

main().catch(err => {
    console.error('FATAL:', err);
    close();
    process.exit(1);
});
