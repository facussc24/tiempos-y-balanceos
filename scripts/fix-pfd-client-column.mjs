#!/usr/bin/env node
/**
 * Fix: Add missing `client` column to pfd_documents in Supabase PostgreSQL.
 *
 * The SupabaseAdapter in database.ts silently no-ops all DDL statements
 * (CREATE, ALTER, DROP), so migration 11 never actually ran on Supabase.
 *
 * This script connects directly to the PostgreSQL database using the
 * Supabase pooler connection string to run the ALTER TABLE as the
 * `postgres` superuser, which has DDL permissions.
 *
 * It then backfills the `client` column from `customer_name` and verifies.
 *
 * Usage: node scripts/fix-pfd-client-column.mjs
 *
 * Requires: SUPABASE_DB_URL environment variable OR the script will
 *           construct it from the project ref + db password.
 *
 * If direct DB connection is not available, falls back to printing
 * the SQL statements for manual execution in the Supabase Dashboard.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');

function getEnv(key) {
    const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
    if (!match) return null;
    return match[1].trim();
}

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY');
const AUTO_LOGIN_EMAIL = getEnv('VITE_AUTO_LOGIN_EMAIL');
const AUTO_LOGIN_PASSWORD = getEnv('VITE_AUTO_LOGIN_PASSWORD');

// Extract project ref from URL: https://<ref>.supabase.co
const projectRef = SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

// ---------------------------------------------------------------------------
// Supabase client (for verification queries only)
// ---------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

async function selectRaw(sql) {
    const { data, error } = await supabase.rpc('exec_sql_read', { query: sql, params: [] });
    if (error) throw new Error(`SQL failed: ${error.message}\n  Query: ${sql}`);
    return data ?? [];
}

// ---------------------------------------------------------------------------
// Direct database connection via pg (if available)
// ---------------------------------------------------------------------------

async function tryDirectConnection() {
    try {
        // Dynamic import — pg may not be installed
        const { default: pg } = await import('pg');
        const dbUrl = process.env.SUPABASE_DB_URL
            || getEnv('SUPABASE_DB_URL')
            || `postgresql://postgres.${projectRef}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`;

        if (!process.env.SUPABASE_DB_URL && !getEnv('SUPABASE_DB_URL') && !process.env.SUPABASE_DB_PASSWORD) {
            return null; // No credentials available for direct connection
        }

        const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
        await client.connect();
        return client;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Supabase Management API approach (via CLI)
// ---------------------------------------------------------------------------

async function tryCLIQuery(sql) {
    const { execSync } = await import('child_process');
    try {
        const result = execSync(
            `npx supabase db query --linked "${sql.replace(/"/g, '\\"')}"`,
            { cwd: resolve(__dirname, '..'), timeout: 15000, encoding: 'utf-8' }
        );
        return { success: true, output: result };
    } catch {
        return { success: false };
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    console.log('================================================================');
    console.log('  FIX: Add missing `client` column to pfd_documents');
    console.log('================================================================\n');

    // Step 0: Authenticate
    console.log('Step 0: Authenticating...');
    const { error: authErr } = await supabase.auth.signInWithPassword({
        email: AUTO_LOGIN_EMAIL,
        password: AUTO_LOGIN_PASSWORD,
    });
    if (authErr) {
        console.error('  FAILED:', authErr.message);
        process.exit(1);
    }
    console.log('  OK: Logged in as', AUTO_LOGIN_EMAIL);

    // Step 1: Check if column already exists
    console.log('\nStep 1: Checking if `client` column already exists...');
    const cols = await selectRaw(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'pfd_documents' AND column_name = 'client'`
    );

    if (cols.length > 0) {
        console.log('  Column `client` already exists. Nothing to do.');
        return;
    }
    console.log('  Column `client` NOT found. Attempting to add it...');

    // Step 2: Try approaches in order of preference
    let ddlSuccess = false;

    // Approach A: Direct database connection (requires pg module + DB password)
    console.log('\nStep 2a: Trying direct PostgreSQL connection...');
    const pgClient = await tryDirectConnection();
    if (pgClient) {
        try {
            await pgClient.query(`ALTER TABLE pfd_documents ADD COLUMN IF NOT EXISTS client TEXT NOT NULL DEFAULT ''`);
            await pgClient.query(`CREATE INDEX IF NOT EXISTS idx_pfd_client ON pfd_documents(client)`);
            await pgClient.query(`UPDATE pfd_documents SET client = customer_name WHERE client = '' AND customer_name != ''`);
            console.log('  OK: DDL executed via direct PostgreSQL connection.');
            ddlSuccess = true;
        } catch (err) {
            console.log('  Direct connection DDL failed:', err.message);
        } finally {
            await pgClient.end();
        }
    } else {
        console.log('  No direct DB connection available.');
    }

    // Approach B: Supabase CLI linked query
    if (!ddlSuccess) {
        console.log('\nStep 2b: Trying Supabase CLI --linked...');
        const cliResult = await tryCLIQuery(
            `ALTER TABLE pfd_documents ADD COLUMN IF NOT EXISTS client TEXT NOT NULL DEFAULT ''`
        );
        if (cliResult.success) {
            await tryCLIQuery(`CREATE INDEX IF NOT EXISTS idx_pfd_client ON pfd_documents(client)`);
            await tryCLIQuery(`UPDATE pfd_documents SET client = customer_name WHERE client = '' AND customer_name != ''`);
            console.log('  OK: DDL executed via Supabase CLI.');
            ddlSuccess = true;
        } else {
            console.log('  CLI approach not available (project not linked).');
        }
    }

    // Approach C: Manual instructions
    if (!ddlSuccess) {
        console.log('\n' + '='.repeat(64));
        console.log('  MANUAL ACTION REQUIRED');
        console.log('='.repeat(64));
        console.log('\nThe `client` column cannot be added automatically because:');
        console.log('  - exec_sql_write runs as `authenticated` role (no DDL perms)');
        console.log('  - No direct DB connection or Supabase CLI link available');
        console.log('\nPlease run the following SQL in the Supabase Dashboard SQL Editor:');
        console.log(`  Project URL: ${SUPABASE_URL}`);
        console.log(`  Dashboard:   https://supabase.com/dashboard/project/${projectRef}/sql/new\n`);
        console.log('--- Copy & paste the SQL below ---\n');

        const migrationSql = `-- Fix: Add missing client column to pfd_documents
-- (Migration 11 was silently skipped by SupabaseAdapter DDL filter)

-- 1. Add the column
ALTER TABLE pfd_documents ADD COLUMN IF NOT EXISTS client TEXT NOT NULL DEFAULT '';

-- 2. Create the index
CREATE INDEX IF NOT EXISTS idx_pfd_client ON pfd_documents(client);

-- 3. Backfill: copy customer_name into client for existing documents
UPDATE pfd_documents SET client = customer_name WHERE client = '' AND customer_name != '';

-- 4. Verify
SELECT id, part_name, customer_name, client FROM pfd_documents ORDER BY updated_at DESC;`;

        console.log(migrationSql);
        console.log('\n--- End of SQL ---\n');
        console.log('After running the SQL above, re-run this script to verify.\n');
        process.exit(2); // Exit code 2 = manual action needed
    }

    // Step 3: Verify
    console.log('\nStep 3: Verifying column exists...');
    const verifyResult = await selectRaw(
        `SELECT column_name, data_type, column_default
         FROM information_schema.columns
         WHERE table_name = 'pfd_documents' AND column_name = 'client'`
    );

    if (verifyResult.length === 0) {
        console.error('  FAILED: Column `client` still not found!');
        process.exit(1);
    }
    console.log('  OK: Column verified:', JSON.stringify(verifyResult[0]));

    // Step 4: Show results
    console.log('\nStep 4: Current PFD documents:');
    const pfdDocs = await selectRaw(
        `SELECT id, part_name, customer_name, client FROM pfd_documents ORDER BY updated_at DESC`
    );
    if (pfdDocs.length === 0) {
        console.log('  (no PFD documents found)');
    } else {
        for (const doc of pfdDocs) {
            console.log(`  [${doc.id.slice(0, 8)}...] part="${doc.part_name}" customer="${doc.customer_name}" client="${doc.client}"`);
        }
    }

    console.log('\n================================================================');
    console.log('  FIX COMPLETE');
    console.log('================================================================');
}

main().catch(err => {
    console.error('\nFIX FAILED:', err);
    process.exit(1);
});
