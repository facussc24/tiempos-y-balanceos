/**
 * Shared Supabase helper for APQP audit scripts.
 * Reads .env.local, authenticates, and provides data fetch helpers.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ---------- ESM compatibility ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- ENV parsing ----------
const envPath = path.resolve(__dirname, '../../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};
for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    envVars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}

const SUPABASE_URL = envVars['VITE_SUPABASE_URL'];
const SUPABASE_KEY = envVars['VITE_SUPABASE_ANON_KEY'];
const LOGIN_EMAIL = envVars['VITE_AUTO_LOGIN_EMAIL'];
const LOGIN_PASSWORD = envVars['VITE_AUTO_LOGIN_PASSWORD'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
}

// ---------- Supabase client ----------
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

let authenticated = false;

export async function ensureAuth(): Promise<void> {
    if (authenticated) return;
    const { error } = await supabase.auth.signInWithPassword({
        email: LOGIN_EMAIL,
        password: LOGIN_PASSWORD,
    });
    if (error) throw new Error(`Auth failed: ${error.message}`);
    authenticated = true;
}

// ---------- Data fetching via RPC (same as SupabaseAdapter) ----------

export async function execSqlRead<T = Record<string, unknown>>(query: string): Promise<T[]> {
    await ensureAuth();
    const { data, error } = await supabase.rpc('exec_sql_read', { query, params: [] });
    if (error) throw new Error(`SQL read failed: ${error.message}\nQuery: ${query}`);
    return (data as T[]) ?? [];
}

export async function execSqlWrite(query: string): Promise<void> {
    await ensureAuth();
    const { error } = await supabase.rpc('exec_sql_write', { query, params: [] });
    if (error) throw new Error(`SQL write failed: ${error.message}\nQuery: ${query}`);
}

// ---------- Document fetchers ----------

export interface RawDoc {
    id: string;
    data: string; // JSON string
    [key: string]: unknown;
}

export async function fetchAllPfdDocs(): Promise<Array<{ id: string; raw: RawDoc; parsed: any }>> {
    const rows = await execSqlRead<RawDoc>(
        `SELECT id, data, part_number, part_name, document_number, customer_name, step_count FROM pfd_documents`
    );
    return rows.map(r => ({ id: r.id, raw: r, parsed: JSON.parse(r.data as string) }));
}

export async function fetchAllAmfeDocs(): Promise<Array<{ id: string; raw: RawDoc; parsed: any }>> {
    const rows = await execSqlRead<RawDoc>(
        `SELECT id, data, project_name, part_number, operation_count, cause_count, ap_h_count, ap_m_count, coverage_percent FROM amfe_documents`
    );
    return rows.map(r => ({ id: r.id, raw: r, parsed: JSON.parse(r.data as string) }));
}

export async function fetchAllCpDocs(): Promise<Array<{ id: string; raw: RawDoc; parsed: any }>> {
    const rows = await execSqlRead<RawDoc>(
        `SELECT id, data, project_name, part_number, part_name, linked_amfe_project, linked_amfe_id, item_count FROM cp_documents`
    );
    return rows.map(r => ({ id: r.id, raw: r, parsed: JSON.parse(r.data as string) }));
}

export async function fetchAllHoDocs(): Promise<Array<{ id: string; raw: RawDoc; parsed: any }>> {
    const rows = await execSqlRead<RawDoc>(
        `SELECT id, data, part_number, part_description, linked_amfe_project, linked_cp_project, linked_amfe_id, linked_cp_id, sheet_count FROM ho_documents`
    );
    return rows.map(r => ({ id: r.id, raw: r, parsed: JSON.parse(r.data as string) }));
}

export async function fetchProductFamilies(): Promise<any[]> {
    return execSqlRead(`SELECT * FROM product_families WHERE active = true ORDER BY name`);
}

export async function fetchFamilyMembers(): Promise<any[]> {
    return execSqlRead(`SELECT * FROM product_family_members`);
}

export async function fetchFamilyDocuments(): Promise<any[]> {
    return execSqlRead(`SELECT * FROM family_documents`);
}

// ---------- Utility ----------

/** Normalize operation name for matching across documents */
export function normOp(name: string): string {
    return (name || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/\s+/g, ' ')
        .trim();
}

/** Write JSON results to file */
export function writeResults(filename: string, data: unknown): void {
    const resultsDir = path.resolve(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
    const filePath = path.join(resultsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Results written to ${filePath}`);
}

/** Backup a document's data JSON before modification */
export function backupDoc(table: string, id: string, dataJson: string): void {
    const backupDir = path.resolve(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const filePath = path.join(backupDir, `${table}_${id}.json`);
    fs.writeFileSync(filePath, dataJson, 'utf-8');
}

export { supabase };
