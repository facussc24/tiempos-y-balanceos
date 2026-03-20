#!/usr/bin/env node
/**
 * Import ALL Tiempos y Balanceos projects from the server share into Supabase.
 *
 * Source: \\SERVER\compartido\Ingenieria\Datos Software\01_DATA\
 * Target: Supabase `projects` table
 *
 * Also imports plant configuration from 00_CONFIG/.
 *
 * Usage: node scripts/import-server-projects.mjs
 */

import { createHash } from 'crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ─────────────────────────────────────────────────────────────────

// Windows UNC path — use forward slashes for Node compatibility
const SERVER_BASE = '//SERVER/compartido/Ingenieria/Datos Software';
const DATA_DIR = join(SERVER_BASE, '01_DATA');
const CONFIG_DIR = join(SERVER_BASE, '00_CONFIG');

// ─── Helpers ────────────────────────────────────────────────────────────────

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/**
 * Recursively find all master.json files under a directory.
 */
function findMasterJsonFiles(dir) {
    const results = [];
    try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
            const fullPath = join(dir, entry);
            try {
                const stat = statSync(fullPath);
                if (stat.isDirectory()) {
                    results.push(...findMasterJsonFiles(fullPath));
                } else if (entry === 'master.json') {
                    results.push(fullPath);
                }
            } catch { /* skip inaccessible */ }
        }
    } catch { /* skip inaccessible */ }
    return results;
}

/**
 * Derive client, project_code, and a readable name from the file path.
 * Path pattern: .../01_DATA/{CLIENT}/{PROJECT}/{PRODUCT}/master.json
 */
function parseProjectPath(filePath) {
    const relative = filePath.replace(DATA_DIR, '').replace(/\\/g, '/');
    const parts = relative.split('/').filter(Boolean);
    // parts = [CLIENT, PROJECT, PRODUCT, 'master.json']
    if (parts.length < 4) {
        return { client: parts[0] || 'Unknown', project: parts[1] || '', product: parts[2] || basename(dirname(filePath)) };
    }
    return {
        client: parts[0],
        project: parts[1],
        product: parts[2],
    };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  IMPORT SERVER PROJECTS → SUPABASE');
    console.log('═══════════════════════════════════════════════════════════');

    // 1. Verify server access
    if (!existsSync(DATA_DIR)) {
        console.error(`\n  ✗ Cannot access server: ${DATA_DIR}`);
        console.error('    Make sure the network share is accessible.');
        process.exit(1);
    }

    // 2. Find all master.json files
    console.log(`\n  Scanning ${DATA_DIR}...`);
    const masterFiles = findMasterJsonFiles(DATA_DIR);
    console.log(`  Found ${masterFiles.length} project(s)\n`);

    if (masterFiles.length === 0) {
        console.log('  Nothing to import.');
        return;
    }

    // 3. Connect to Supabase
    await initSupabase();

    // 4. Check existing projects
    const existingProjects = await selectSql('SELECT id, name, client, checksum FROM projects');
    const existingMap = new Map();
    for (const p of existingProjects) {
        existingMap.set(`${p.name}|${p.client}`, p);
    }
    console.log(`  ${existingProjects.length} existing project(s) in Supabase\n`);

    // 5. Import each project
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const filePath of masterFiles) {
        const { client, project: projectCode, product } = parseProjectPath(filePath);
        const rawJson = readFileSync(filePath, 'utf-8');
        const projectData = JSON.parse(rawJson);

        // Use the project's own meta.name, or derive from path
        const name = projectData.meta?.name || product;
        const displayClient = projectData.meta?.client || client;

        const checksum = sha256(rawJson);

        console.log(`  ${client}/${projectCode}/${product}`);
        console.log(`    Name: "${name}", Client: "${displayClient}", Demand: ${projectData.meta?.dailyDemand || '?'}`);

        // Check for existing
        const key = `${name}|${displayClient}`;
        const existing = existingMap.get(key);

        if (existing) {
            if (existing.checksum === checksum) {
                console.log(`    → SKIP (already exists, checksum matches)\n`);
                skipped++;
                continue;
            }

            // Update existing project
            console.log(`    → UPDATE (checksum differs)\n`);
            await execSql(
                `UPDATE projects SET project_code = ?, engineer = ?, version = ?, daily_demand = ?, data = ?, checksum = ?, updated_at = datetime('now') WHERE id = ?`,
                [
                    projectData.meta?.project || projectCode,
                    projectData.meta?.engineer || '',
                    projectData.meta?.version || 'Importado',
                    projectData.meta?.dailyDemand || 0,
                    rawJson,
                    checksum,
                    existing.id,
                ]
            );
            updated++;
        } else {
            // Insert new project
            console.log(`    → INSERT (new)\n`);
            await execSql(
                `INSERT INTO projects (name, client, project_code, engineer, version, daily_demand, data, checksum) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    name,
                    displayClient,
                    projectData.meta?.project || projectCode,
                    projectData.meta?.engineer || '',
                    projectData.meta?.version || 'Importado',
                    projectData.meta?.dailyDemand || 0,
                    rawJson,
                    checksum,
                ]
            );
            imported++;
        }
    }

    // 6. Import plant config (settings table)
    console.log('\n  ── Plant Configuration ──');
    for (const configFile of ['assets.json', 'plant_assets.json']) {
        const configPath = join(CONFIG_DIR, configFile);
        if (existsSync(configPath)) {
            const configJson = readFileSync(configPath, 'utf-8');
            const settingsKey = configFile.replace('.json', '');
            console.log(`  Importing ${configFile} as setting "${settingsKey}"`);
            await execSql(
                `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
                [settingsKey, configJson]
            );
        }
    }

    // 7. Final verification
    const finalCount = await selectSql('SELECT COUNT(*) as cnt FROM projects');
    const totalProjects = finalCount[0]?.cnt ?? '?';

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`  RESULT: ${imported} imported, ${updated} updated, ${skipped} skipped`);
    console.log(`  Total projects in Supabase: ${totalProjects}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    close();
}

main().catch(err => {
    console.error('\n  FATAL:', err.message);
    process.exit(1);
});
