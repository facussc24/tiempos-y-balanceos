#!/usr/bin/env node
/**
 * Supabase Helper for seed scripts
 *
 * Provides execSql() and selectSql() functions that call Supabase RPC
 * functions (exec_sql_write / exec_sql_read) — the same ones used by
 * the SupabaseAdapter in the app.
 *
 * Usage:
 *   import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
 *   await initSupabase();           // reads .env.local, logs in
 *   await execSql('INSERT INTO ...');
 *   const rows = await selectSql('SELECT * FROM ...');
 *   close();
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Read .env.local
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');

function getEnv(key) {
    const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
    if (!match) throw new Error(`Missing ${key} in .env.local`);
    return match[1].trim();
}

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY');
const AUTO_LOGIN_EMAIL = getEnv('VITE_AUTO_LOGIN_EMAIL');
const AUTO_LOGIN_PASSWORD = getEnv('VITE_AUTO_LOGIN_PASSWORD');

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});

// ---------------------------------------------------------------------------
// Conflict map (mirrors SupabaseAdapter.CONFLICT_MAP in database.ts)
// ---------------------------------------------------------------------------

const CONFLICT_MAP = {
    projects: 'id',
    amfe_documents: 'id',
    amfe_library_operations: 'id',
    cp_documents: 'id',
    ho_documents: 'id',
    pfd_documents: 'id',
    settings: 'key',
    solicitud_documents: 'id',
    schema_version: 'version',
    drafts: '(module, document_key)',
    cross_doc_checks: '(source_module, source_doc_id, target_module, target_doc_id)',
    products: '(codigo, linea_code)',
    product_families: 'name',
    recent_projects: 'id',
    customer_lines: 'code',
    product_family_members: '(family_id, product_id)',
    document_locks: '(document_id, document_type)',
};

const BIGSERIAL_TABLES = new Set([
    'projects', 'drafts', 'document_revisions', 'cross_doc_checks',
    'product_families', 'product_family_members', 'products',
    'customer_lines', 'recent_projects', 'pending_exports', 'schema_version',
]);

// ---------------------------------------------------------------------------
// SQL translation (mirrors SupabaseAdapter methods)
// ---------------------------------------------------------------------------

function normalizeNow(sql) {
    return sql.replace(/datetime\s*\(\s*'now'\s*\)/gi, 'NOW()');
}

function convertPlaceholders(sql) {
    let counter = 0;
    return sql.replace(/\?/g, () => `$${++counter}`);
}

function convertInsertOrReplace(sql) {
    const tableMatch = /INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)/i.exec(sql);
    if (!tableMatch) return sql;

    const table = tableMatch[1].toLowerCase();
    const conflictCol = CONFLICT_MAP[table] || 'id';
    const conflictClause = conflictCol.startsWith('(') ? conflictCol : `(${conflictCol})`;

    const colsMatch = /INTO\s+\w+\s*\(([^)]+)\)/i.exec(sql);
    if (!colsMatch) {
        return sql.replace(/INSERT\s+OR\s+REPLACE\s+INTO/i, 'INSERT INTO');
    }

    const cols = colsMatch[1].split(',').map(c => c.trim());
    const skipCols = new Set(
        conflictCol.replace(/[()]/g, '').split(',').map(c => c.trim())
    );
    skipCols.add('created_at');
    const updateCols = cols.filter(c => !skipCols.has(c));
    const updateSet = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ');

    let result = sql.replace(/INSERT\s+OR\s+REPLACE\s+INTO/i, 'INSERT INTO');
    const valuesEnd = result.lastIndexOf(')');
    if (valuesEnd > 0 && updateSet) {
        result = `${result.slice(0, valuesEnd + 1)} ON CONFLICT ${conflictClause} DO UPDATE SET ${updateSet}`;
    }
    return result;
}

function convertInsertOrIgnore(sql) {
    const tableMatch = /INSERT\s+OR\s+IGNORE\s+INTO\s+(\w+)/i.exec(sql);
    if (!tableMatch) return sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');

    const table = tableMatch[1].toLowerCase();
    const conflictCol = CONFLICT_MAP[table] || 'id';
    const conflictClause = conflictCol.startsWith('(') ? conflictCol : `(${conflictCol})`;

    let result = sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
    const valuesEnd = result.lastIndexOf(')');
    if (valuesEnd > 0) {
        result = `${result.slice(0, valuesEnd + 1)} ON CONFLICT ${conflictClause} DO NOTHING`;
    }
    return result;
}

function inlineParams(sql, params) {
    let result = sql;
    for (let i = params.length - 1; i >= 0; i--) {
        const val = params[i];
        let replacement;
        if (val === null || val === undefined) {
            replacement = 'NULL';
        } else if (typeof val === 'number') {
            replacement = String(val);
        } else if (typeof val === 'boolean') {
            replacement = val ? '1' : '0';
        } else {
            replacement = `'${String(val).replace(/'/g, "''")}'`;
        }
        result = result.replaceAll(`$${i + 1}`, replacement);
    }
    return result;
}

/**
 * Translate a SQLite-flavored SQL string (with ? placeholders) to PostgreSQL
 * and inline the parameters, returning a ready-to-execute query string.
 */
function translateSql(sql, bindings = []) {
    let pgSql = normalizeNow(sql.trim());

    // Skip DDL
    if (/^(CREATE|ALTER|DROP|BEGIN|COMMIT|ROLLBACK|PRAGMA)/i.test(pgSql)) {
        return null; // signal to skip
    }

    // Convert SQLite dialect to PostgreSQL
    if (/INSERT\s+OR\s+REPLACE/i.test(pgSql)) {
        pgSql = convertInsertOrReplace(pgSql);
    } else if (/INSERT\s+OR\s+IGNORE/i.test(pgSql)) {
        pgSql = convertInsertOrIgnore(pgSql);
    }

    // Add RETURNING id for plain INSERT into BIGSERIAL tables
    const isPlainInsert = /^INSERT\s+INTO\s+(\w+)/i.test(pgSql) && !/ON\s+CONFLICT/i.test(pgSql);
    if (isPlainInsert) {
        const tblMatch = /^INSERT\s+INTO\s+(\w+)/i.exec(pgSql);
        const tblName = tblMatch?.[1]?.toLowerCase() ?? '';
        if (BIGSERIAL_TABLES.has(tblName)) {
            pgSql = pgSql + ' RETURNING id';
        }
    }

    // Replace ? with $1, $2, ... then inline values
    pgSql = convertPlaceholders(pgSql);
    return inlineParams(pgSql, bindings);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let _authenticated = false;

/**
 * Authenticate with Supabase using the auto-login credentials from .env.local.
 * Must be called once before execSql / selectSql.
 */
export async function initSupabase() {
    if (_authenticated) return;
    console.log(`  Connecting to Supabase: ${SUPABASE_URL}`);
    console.log(`  Logging in as: ${AUTO_LOGIN_EMAIL}`);

    const { data, error } = await supabase.auth.signInWithPassword({
        email: AUTO_LOGIN_EMAIL,
        password: AUTO_LOGIN_PASSWORD,
    });

    if (error) {
        throw new Error(`Supabase auth failed: ${error.message}`);
    }

    console.log(`  Authenticated (user ID: ${data.user.id})`);
    _authenticated = true;
}

/**
 * Execute a write SQL statement (INSERT, UPDATE, DELETE).
 * Accepts SQLite-flavored SQL with ? placeholders — translates to PostgreSQL automatically.
 *
 * @param {string} sql   SQLite-flavored SQL
 * @param {any[]}  bindings  Parameter values matching the ? placeholders
 * @returns {Promise<{rowsAffected: number, lastInsertId: number}>}
 */
export async function execSql(sql, bindings = []) {
    const pgSql = translateSql(sql, bindings);
    if (pgSql === null) {
        // DDL — skip silently
        return { rowsAffected: 0, lastInsertId: 0 };
    }

    const { data, error } = await supabase.rpc('exec_sql_write', {
        query: pgSql,
        params: [],
    });

    if (error) {
        console.error(`  SQL ERROR: ${error.message}`);
        console.error(`  Query: ${pgSql.slice(0, 200)}`);
        throw new Error(`exec_sql_write failed: ${error.message}`);
    }

    const result = data;
    return {
        rowsAffected: result?.rows_affected ?? 1,
        lastInsertId: result?.last_insert_id ?? 0,
    };
}

/**
 * Execute a read SQL statement (SELECT).
 * Accepts SQLite-flavored SQL with ? placeholders — translates to PostgreSQL automatically.
 *
 * @param {string} sql   SQLite-flavored SQL
 * @param {any[]}  bindings  Parameter values matching the ? placeholders
 * @returns {Promise<object[]>}
 */
export async function selectSql(sql, bindings = []) {
    const pgSql = translateSql(sql, bindings);
    if (pgSql === null) return [];

    const { data, error } = await supabase.rpc('exec_sql_read', {
        query: pgSql,
        params: [],
    });

    if (error) {
        console.error(`  SQL ERROR: ${error.message}`);
        console.error(`  Query: ${pgSql.slice(0, 200)}`);
        throw new Error(`exec_sql_read failed: ${error.message}`);
    }

    return data ?? [];
}

/**
 * Clean up (sign out). Optional but good practice.
 */
export function close() {
    supabase.auth.signOut().catch(() => {});
}
