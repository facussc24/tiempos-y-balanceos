#!/usr/bin/env node
/**
 * FIX: Corregir nombres de producto "TAOS" → "PATAGONIA" y part numbers "XXX"
 *
 * Problema 1: El vehículo se llama "Patagonia" en Mercosur, no "Taos" (nombre norteamericano).
 * Problema 2: Buscar part numbers placeholder "XXX" y propagar el correcto.
 *
 * Usage: node scripts/fix-product-names.mjs
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

await initSupabase();

let totalFixed = 0;

// ═══════════════════════════════════════════════════════════════════════════
// FASE 1: AUDITORÍA
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n══════════════════════════════════════════════════════');
console.log('  FASE 1: AUDITORÍA');
console.log('══════════════════════════════════════════════════════\n');

// --- 1a. Auditoría "TAOS" ---
console.log('─── Buscando "TAOS" en todas las tablas ───\n');

const taosAudit = {};

// products.descripcion
const prodTaos = await selectSql(`SELECT id, codigo, descripcion FROM products WHERE descripcion LIKE '%TAOS%'`);
if (prodTaos.length) {
    taosAudit['products.descripcion'] = prodTaos.length;
    console.log(`  products.descripcion: ${prodTaos.length} registros`);
    for (const r of prodTaos) console.log(`    ${r.codigo}: ${r.descripcion}`);
}

// products.linea_name
const prodLineTaos = await selectSql(`SELECT DISTINCT linea_name FROM products WHERE linea_name LIKE '%TAOS%'`);
if (prodLineTaos.length) {
    taosAudit['products.linea_name'] = prodLineTaos.length;
    console.log(`  products.linea_name: ${prodLineTaos.length} valores distintos`);
    for (const r of prodLineTaos) console.log(`    ${r.linea_name}`);
}

// customer_lines.name
const clTaos = await selectSql(`SELECT id, code, name FROM customer_lines WHERE name LIKE '%TAOS%'`);
if (clTaos.length) {
    taosAudit['customer_lines.name'] = clTaos.length;
    console.log(`  customer_lines.name: ${clTaos.length} registros`);
    for (const r of clTaos) console.log(`    ${r.code}: ${r.name}`);
}

// product_families
const pfTaos = await selectSql(`SELECT id, name FROM product_families WHERE name LIKE '%TAOS%' OR description LIKE '%TAOS%'`);
if (pfTaos.length) {
    taosAudit['product_families'] = pfTaos.length;
    console.log(`  product_families: ${pfTaos.length} registros`);
    for (const r of pfTaos) console.log(`    ${r.name}`);
}

// APQP document tables — direct columns
for (const [table, cols] of [
    ['amfe_documents', ['project_name', 'subject', 'part_number']],
    ['cp_documents',   ['project_name', 'part_name', 'part_number']],
    ['ho_documents',   ['part_number', 'part_description']],
    ['pfd_documents',  ['part_name', 'part_number']],
]) {
    for (const col of cols) {
        const rows = await selectSql(`SELECT id, ${col} FROM ${table} WHERE ${col} LIKE '%TAOS%'`);
        if (rows.length) {
            taosAudit[`${table}.${col}`] = rows.length;
            console.log(`  ${table}.${col}: ${rows.length} registros`);
            for (const r of rows) console.log(`    id=${r.id.slice(0,8)}... → ${r[col]}`);
        }
    }
}

// APQP document tables — JSON data column
for (const table of ['amfe_documents', 'cp_documents', 'ho_documents', 'pfd_documents']) {
    const rows = await selectSql(`SELECT id FROM ${table} WHERE data LIKE '%TAOS%'`);
    if (rows.length) {
        taosAudit[`${table}.data`] = rows.length;
        console.log(`  ${table}.data (JSON): ${rows.length} registros con "TAOS" en JSON`);
    }
}

// recent_projects
const rpTaos = await selectSql(`SELECT id, name FROM recent_projects WHERE name LIKE '%TAOS%'`);
if (rpTaos.length) {
    taosAudit['recent_projects'] = rpTaos.length;
    console.log(`  recent_projects: ${rpTaos.length} registros`);
}

const totalTaos = Object.values(taosAudit).reduce((a, b) => a + b, 0);
console.log(`\n  TOTAL: ${totalTaos} ocurrencias de "TAOS" en ${Object.keys(taosAudit).length} columnas\n`);

// --- 1b. Auditoría "XXX" ---
console.log('─── Buscando "XXX" placeholder en part numbers ───\n');

const xxxAudit = {};
for (const table of ['amfe_documents', 'cp_documents', 'ho_documents', 'pfd_documents']) {
    const colPart = 'part_number';
    const rows = await selectSql(`SELECT id, ${colPart} FROM ${table} WHERE ${colPart} LIKE '%XXX%'`);
    if (rows.length) {
        xxxAudit[`${table}.${colPart}`] = rows.length;
        console.log(`  ${table}.${colPart}: ${rows.length} registros con "XXX"`);
        for (const r of rows) console.log(`    id=${r.id.slice(0,8)}... → ${r[colPart]}`);
    }

    // Also check inside JSON data for applicableParts, partNumber containing XXX
    const dataRows = await selectSql(`SELECT id FROM ${table} WHERE data LIKE '%XXX%'`);
    if (dataRows.length) {
        xxxAudit[`${table}.data`] = dataRows.length;
        console.log(`  ${table}.data (JSON): ${dataRows.length} registros con "XXX" en JSON`);
    }
}

// Check cp_documents and ho_documents for extra columns
const cpXxx = await selectSql(`SELECT id, part_name FROM cp_documents WHERE part_name LIKE '%XXX%'`);
if (cpXxx.length) {
    xxxAudit['cp_documents.part_name'] = cpXxx.length;
    console.log(`  cp_documents.part_name: ${cpXxx.length} registros con "XXX"`);
}

const hoXxx = await selectSql(`SELECT id, part_description FROM ho_documents WHERE part_description LIKE '%XXX%'`);
if (hoXxx.length) {
    xxxAudit['ho_documents.part_description'] = hoXxx.length;
    console.log(`  ho_documents.part_description: ${hoXxx.length} registros con "XXX"`);
}

const totalXxx = Object.values(xxxAudit).reduce((a, b) => a + b, 0);
if (totalXxx === 0) {
    console.log('  No se encontraron part numbers con "XXX" placeholder.\n');
} else {
    console.log(`\n  TOTAL: ${totalXxx} ocurrencias de "XXX"\n`);
}

// ═══════════════════════════════════════════════════════════════════════════
// FASE 2: CORRECCIONES "TAOS" → "PATAGONIA"
// ═══════════════════════════════════════════════════════════════════════════

console.log('══════════════════════════════════════════════════════');
console.log('  FASE 2: CORRECCIONES');
console.log('══════════════════════════════════════════════════════\n');

// --- Step 1: Replace the specific full string first ---
// "TOP ROLL FRONT DI - DD TAOS" → "TOP ROLL PATAGONIA"
const specificReplacements = [
    // Document direct columns
    [`UPDATE pfd_documents SET part_name = 'TOP ROLL PATAGONIA' WHERE part_name = 'TOP ROLL FRONT DI - DD TAOS'`, 'pfd_documents.part_name'],
    [`UPDATE cp_documents SET part_name = 'TOP ROLL PATAGONIA' WHERE part_name = 'TOP ROLL FRONT DI - DD TAOS'`, 'cp_documents.part_name'],
    [`UPDATE ho_documents SET part_description = 'TOP ROLL PATAGONIA' WHERE part_description = 'TOP ROLL FRONT DI - DD TAOS'`, 'ho_documents.part_description'],

    // JSON data columns — replace full string first
    [`UPDATE amfe_documents SET data = REPLACE(data, 'TOP ROLL FRONT DI - DD TAOS', 'TOP ROLL PATAGONIA') WHERE data LIKE '%TOP ROLL FRONT DI - DD TAOS%'`, 'amfe_documents.data (full string)'],
    [`UPDATE cp_documents SET data = REPLACE(data, 'TOP ROLL FRONT DI - DD TAOS', 'TOP ROLL PATAGONIA') WHERE data LIKE '%TOP ROLL FRONT DI - DD TAOS%'`, 'cp_documents.data (full string)'],
    [`UPDATE ho_documents SET data = REPLACE(data, 'TOP ROLL FRONT DI - DD TAOS', 'TOP ROLL PATAGONIA') WHERE data LIKE '%TOP ROLL FRONT DI - DD TAOS%'`, 'ho_documents.data (full string)'],
    [`UPDATE pfd_documents SET data = REPLACE(data, 'TOP ROLL FRONT DI - DD TAOS', 'TOP ROLL PATAGONIA') WHERE data LIKE '%TOP ROLL FRONT DI - DD TAOS%'`, 'pfd_documents.data (full string)'],
];

console.log('─── Paso 1: Reemplazar "TOP ROLL FRONT DI - DD TAOS" → "TOP ROLL PATAGONIA" ───\n');
for (const [sql, label] of specificReplacements) {
    const result = await execSql(sql);
    if (result.rowsAffected > 0) {
        console.log(`  ✓ ${label}: ${result.rowsAffected} registros`);
        totalFixed += result.rowsAffected;
    }
}

// --- Step 2: Replace remaining "TAOS" → "PATAGONIA" everywhere ---
const genericReplacements = [
    // JSON data — remaining TAOS in any document
    [`UPDATE amfe_documents SET data = REPLACE(data, 'TAOS', 'PATAGONIA') WHERE data LIKE '%TAOS%'`, 'amfe_documents.data (remaining)'],
    [`UPDATE cp_documents SET data = REPLACE(data, 'TAOS', 'PATAGONIA') WHERE data LIKE '%TAOS%'`, 'cp_documents.data (remaining)'],
    [`UPDATE ho_documents SET data = REPLACE(data, 'TAOS', 'PATAGONIA') WHERE data LIKE '%TAOS%'`, 'ho_documents.data (remaining)'],
    [`UPDATE pfd_documents SET data = REPLACE(data, 'TAOS', 'PATAGONIA') WHERE data LIKE '%TAOS%'`, 'pfd_documents.data (remaining)'],

    // Products catalog
    [`UPDATE products SET descripcion = REPLACE(descripcion, 'TAOS', 'PATAGONIA') WHERE descripcion LIKE '%TAOS%'`, 'products.descripcion'],
    [`UPDATE products SET linea_name = REPLACE(linea_name, 'TAOS', 'PATAGONIA') WHERE linea_name LIKE '%TAOS%'`, 'products.linea_name'],

    // Customer lines
    [`UPDATE customer_lines SET name = REPLACE(name, 'TAOS', 'PATAGONIA') WHERE name LIKE '%TAOS%'`, 'customer_lines.name'],

    // Product families (if any)
    [`UPDATE product_families SET name = REPLACE(name, 'TAOS', 'PATAGONIA') WHERE name LIKE '%TAOS%'`, 'product_families.name'],
    [`UPDATE product_families SET description = REPLACE(description, 'TAOS', 'PATAGONIA') WHERE description LIKE '%TAOS%'`, 'product_families.description'],

    // Recent projects (if any)
    [`UPDATE recent_projects SET name = REPLACE(name, 'TAOS', 'PATAGONIA') WHERE name LIKE '%TAOS%'`, 'recent_projects.name'],

    // Document direct columns (remaining TAOS in any column)
    [`UPDATE amfe_documents SET project_name = REPLACE(project_name, 'TAOS', 'PATAGONIA') WHERE project_name LIKE '%TAOS%'`, 'amfe_documents.project_name'],
    [`UPDATE amfe_documents SET subject = REPLACE(subject, 'TAOS', 'PATAGONIA') WHERE subject LIKE '%TAOS%'`, 'amfe_documents.subject'],
    [`UPDATE amfe_documents SET part_number = REPLACE(part_number, 'TAOS', 'PATAGONIA') WHERE part_number LIKE '%TAOS%'`, 'amfe_documents.part_number'],
    [`UPDATE cp_documents SET project_name = REPLACE(project_name, 'TAOS', 'PATAGONIA') WHERE project_name LIKE '%TAOS%'`, 'cp_documents.project_name'],
    [`UPDATE cp_documents SET part_name = REPLACE(part_name, 'TAOS', 'PATAGONIA') WHERE part_name LIKE '%TAOS%'`, 'cp_documents.part_name'],
    [`UPDATE cp_documents SET part_number = REPLACE(part_number, 'TAOS', 'PATAGONIA') WHERE part_number LIKE '%TAOS%'`, 'cp_documents.part_number'],
    [`UPDATE ho_documents SET part_number = REPLACE(part_number, 'TAOS', 'PATAGONIA') WHERE part_number LIKE '%TAOS%'`, 'ho_documents.part_number'],
    [`UPDATE ho_documents SET part_description = REPLACE(part_description, 'TAOS', 'PATAGONIA') WHERE part_description LIKE '%TAOS%'`, 'ho_documents.part_description'],
    [`UPDATE pfd_documents SET part_name = REPLACE(part_name, 'TAOS', 'PATAGONIA') WHERE part_name LIKE '%TAOS%'`, 'pfd_documents.part_name'],
    [`UPDATE pfd_documents SET part_number = REPLACE(part_number, 'TAOS', 'PATAGONIA') WHERE part_number LIKE '%TAOS%'`, 'pfd_documents.part_number'],
];

console.log('\n─── Paso 2: Reemplazar "TAOS" → "PATAGONIA" (restantes) ───\n');
for (const [sql, label] of genericReplacements) {
    const result = await execSql(sql);
    if (result.rowsAffected > 0) {
        console.log(`  ✓ ${label}: ${result.rowsAffected} registros`);
        totalFixed += result.rowsAffected;
    }
}

// --- Step 3: Fix XXX part numbers (if any found) ---
if (totalXxx > 0) {
    console.log('\n─── Paso 3: Corregir part numbers "XXX" ───\n');

    // For each document with XXX, try to find the correct part number from other docs of the same project
    for (const table of ['amfe_documents', 'cp_documents', 'ho_documents', 'pfd_documents']) {
        const rows = await selectSql(`SELECT id, part_number, project_name FROM ${table} WHERE part_number LIKE '%XXX%'`);
        for (const row of rows) {
            // Try to find the correct part number from another document of the same project
            let correctPn = null;
            for (const otherTable of ['amfe_documents', 'cp_documents', 'pfd_documents']) {
                if (otherTable === table) continue;
                const pnCol = 'part_number';
                const refs = await selectSql(
                    `SELECT ${pnCol} FROM ${otherTable} WHERE project_name = ? AND ${pnCol} NOT LIKE '%XXX%' AND ${pnCol} != '' LIMIT 1`,
                    [row.project_name]
                );
                if (refs.length) {
                    correctPn = refs[0][pnCol];
                    break;
                }
            }

            if (correctPn) {
                await execSql(`UPDATE ${table} SET part_number = ? WHERE id = ?`, [correctPn, row.id]);
                console.log(`  ✓ ${table} id=${row.id.slice(0,8)}...: "${row.part_number}" → "${correctPn}" (propagado)`);
                totalFixed++;
            } else {
                console.log(`  ✗ ${table} id=${row.id.slice(0,8)}...: "${row.part_number}" — NO se encontró part number correcto. Requiere input del usuario.`);
            }
        }
    }
} else {
    console.log('\n─── Paso 3: No hay part numbers "XXX" que corregir ───\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// FASE 3: VERIFICACIÓN
// ═══════════════════════════════════════════════════════════════════════════

console.log('══════════════════════════════════════════════════════');
console.log('  FASE 3: VERIFICACIÓN');
console.log('══════════════════════════════════════════════════════\n');

// Verify no TAOS remains
const remainingTaos = [];
for (const [table, cols] of [
    ['products', ['descripcion', 'linea_name']],
    ['customer_lines', ['name']],
    ['product_families', ['name']],
    ['amfe_documents', ['project_name', 'subject', 'part_number', 'data']],
    ['cp_documents', ['project_name', 'part_name', 'part_number', 'data']],
    ['ho_documents', ['part_number', 'part_description', 'data']],
    ['pfd_documents', ['part_name', 'part_number', 'data']],
]) {
    for (const col of cols) {
        const rows = await selectSql(`SELECT COUNT(*) as cnt FROM ${table} WHERE ${col} LIKE '%TAOS%'`);
        const cnt = rows[0]?.cnt ?? 0;
        if (cnt > 0) remainingTaos.push(`${table}.${col}: ${cnt}`);
    }
}

if (remainingTaos.length === 0) {
    console.log('  ✓ CERO registros con "TAOS" restantes en la base de datos.\n');
} else {
    console.log('  ✗ AÚN quedan registros con "TAOS":');
    for (const r of remainingTaos) console.log(`    - ${r}`);
    console.log();
}

// List all products (families) with name and part number
console.log('─── Familias de producto actuales ───\n');
const families = await selectSql(`
    SELECT pf.id, pf.name, pf.linea_name,
           p.codigo as primary_part_number, p.descripcion as primary_description
    FROM product_families pf
    LEFT JOIN product_family_members pfm ON pfm.family_id = pf.id AND pfm.is_primary = 1
    LEFT JOIN products p ON p.id = pfm.product_id
    ORDER BY pf.name
`);
for (const f of families) {
    console.log(`  ${f.name} | PN: ${f.primary_part_number || '(sin producto primario)'} | ${f.primary_description || ''}`);
}

// List APQP documents
console.log('\n─── Documentos APQP: nombres y part numbers actuales ───\n');

for (const [table, nameCol, pnCol] of [
    ['amfe_documents', 'subject', 'part_number'],
    ['cp_documents', 'part_name', 'part_number'],
    ['ho_documents', 'part_description', 'part_number'],
    ['pfd_documents', 'part_name', 'part_number'],
]) {
    const docs = await selectSql(`SELECT id, ${nameCol}, ${pnCol}, project_name FROM ${table} ORDER BY project_name`);
    console.log(`  ${table.toUpperCase()} (${docs.length} docs):`);
    for (const d of docs) {
        console.log(`    ${d.project_name} | ${d[nameCol]} | PN: ${d[pnCol]}`);
    }
    console.log();
}

// Summary
console.log('══════════════════════════════════════════════════════');
console.log(`  RESUMEN: ${totalFixed} correcciones aplicadas`);
console.log('══════════════════════════════════════════════════════\n');

close();
