/**
 * SQLite Database Manager
 *
 * Singleton connection to the Barack Mercosul SQLite database.
 * Uses tauri-plugin-sql in Tauri mode, in-memory fallback for web/dev.
 *
 * @module database
 */

import { isTauri } from './unified_fs';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Database adapter interface (abstracts Tauri SQL plugin vs in-memory)
// ---------------------------------------------------------------------------

export interface QueryResult {
    rowsAffected: number;
    lastInsertId: number;
}

export interface DbAdapter {
    execute(sql: string, bindings?: unknown[]): Promise<QueryResult>;
    select<T = Record<string, unknown>>(sql: string, bindings?: unknown[]): Promise<T[]>;
    close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Schema DDL
// ---------------------------------------------------------------------------

const SCHEMA_VERSION = 1;

const SCHEMA_DDL = `
-- Version tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Projects (Tiempos y Balanceo studies)
CREATE TABLE IF NOT EXISTS projects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    client          TEXT NOT NULL DEFAULT '',
    project_code    TEXT NOT NULL DEFAULT '',
    engineer        TEXT NOT NULL DEFAULT '',
    version         TEXT NOT NULL DEFAULT 'Borrador',
    daily_demand    INTEGER NOT NULL DEFAULT 1000,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    data            TEXT NOT NULL,
    checksum        TEXT
);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

-- AMFE VDA documents (unifies registry + document data)
CREATE TABLE IF NOT EXISTS amfe_documents (
    id                  TEXT PRIMARY KEY,
    amfe_number         TEXT NOT NULL UNIQUE,
    project_name        TEXT NOT NULL,
    subject             TEXT NOT NULL DEFAULT '',
    client              TEXT NOT NULL DEFAULT '',
    part_number         TEXT NOT NULL DEFAULT '',
    responsible         TEXT NOT NULL DEFAULT '',
    organization        TEXT NOT NULL DEFAULT '',
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK(status IN ('draft','inReview','approved','archived')),
    operation_count     INTEGER NOT NULL DEFAULT 0,
    cause_count         INTEGER NOT NULL DEFAULT 0,
    ap_h_count          INTEGER NOT NULL DEFAULT 0,
    ap_m_count          INTEGER NOT NULL DEFAULT 0,
    coverage_percent    REAL NOT NULL DEFAULT 0,
    start_date          TEXT NOT NULL DEFAULT '',
    last_revision_date  TEXT NOT NULL DEFAULT '',
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    data                TEXT NOT NULL,
    revisions           TEXT NOT NULL DEFAULT '[]',
    checksum            TEXT
);

CREATE INDEX IF NOT EXISTS idx_amfe_status ON amfe_documents(status);
CREATE INDEX IF NOT EXISTS idx_amfe_client ON amfe_documents(client);
CREATE INDEX IF NOT EXISTS idx_amfe_updated ON amfe_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_amfe_number ON amfe_documents(amfe_number);

-- AMFE Library (global operation templates)
CREATE TABLE IF NOT EXISTS amfe_library_operations (
    id              TEXT PRIMARY KEY,
    op_number       TEXT NOT NULL,
    name            TEXT NOT NULL,
    category        TEXT DEFAULT '',
    description     TEXT DEFAULT '',
    tags            TEXT DEFAULT '[]',
    version         INTEGER NOT NULL DEFAULT 1,
    last_modified   TEXT NOT NULL DEFAULT (datetime('now')),
    data            TEXT NOT NULL,
    search_text     TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_library_category ON amfe_library_operations(category);
CREATE INDEX IF NOT EXISTS idx_library_name ON amfe_library_operations(name);

-- Control Plan documents
CREATE TABLE IF NOT EXISTS cp_documents (
    id                  TEXT PRIMARY KEY,
    control_plan_number TEXT NOT NULL DEFAULT '',
    phase               TEXT NOT NULL DEFAULT 'production'
                        CHECK(phase IN ('prototype','preLaunch','safeLaunch','production')),
    part_number         TEXT NOT NULL DEFAULT '',
    part_name           TEXT NOT NULL DEFAULT '',
    organization        TEXT NOT NULL DEFAULT '',
    client              TEXT NOT NULL DEFAULT '',
    responsible         TEXT NOT NULL DEFAULT '',
    revision            TEXT NOT NULL DEFAULT '',
    linked_amfe_project TEXT DEFAULT '',
    linked_amfe_id      TEXT REFERENCES amfe_documents(id) ON DELETE SET NULL,
    item_count          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    data                TEXT NOT NULL,
    checksum            TEXT
);

CREATE INDEX IF NOT EXISTS idx_cp_client ON cp_documents(client);
CREATE INDEX IF NOT EXISTS idx_cp_updated ON cp_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cp_linked_amfe ON cp_documents(linked_amfe_id);

-- Hojas de Operaciones documents
CREATE TABLE IF NOT EXISTS ho_documents (
    id                  TEXT PRIMARY KEY,
    form_number         TEXT NOT NULL DEFAULT 'I-IN-002.4-R01',
    organization        TEXT NOT NULL DEFAULT '',
    client              TEXT NOT NULL DEFAULT '',
    part_number         TEXT NOT NULL DEFAULT '',
    part_description    TEXT NOT NULL DEFAULT '',
    linked_amfe_project TEXT DEFAULT '',
    linked_cp_project   TEXT DEFAULT '',
    linked_amfe_id      TEXT REFERENCES amfe_documents(id) ON DELETE SET NULL,
    linked_cp_id        TEXT REFERENCES cp_documents(id) ON DELETE SET NULL,
    sheet_count         INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    data                TEXT NOT NULL,
    checksum            TEXT
);

CREATE INDEX IF NOT EXISTS idx_ho_client ON ho_documents(client);
CREATE INDEX IF NOT EXISTS idx_ho_updated ON ho_documents(updated_at DESC);

-- PFD (Process Flow Diagram) documents
CREATE TABLE IF NOT EXISTS pfd_documents (
    id              TEXT PRIMARY KEY,
    part_number     TEXT NOT NULL DEFAULT '',
    part_name       TEXT NOT NULL DEFAULT '',
    document_number TEXT NOT NULL DEFAULT '',
    revision_level  TEXT NOT NULL DEFAULT 'A',
    revision_date   TEXT NOT NULL DEFAULT '',
    customer_name   TEXT NOT NULL DEFAULT '',
    step_count      INTEGER NOT NULL DEFAULT 0,
    data            TEXT NOT NULL,
    checksum        TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pfd_updated ON pfd_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pfd_customer ON pfd_documents(customer_name);

-- Unified drafts (replaces 4 IndexedDB databases)
CREATE TABLE IF NOT EXISTS drafts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    module          TEXT NOT NULL CHECK(module IN ('project','amfe','cp','ho','pfd')),
    document_key    TEXT NOT NULL,
    data            TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(module, document_key)
);

CREATE INDEX IF NOT EXISTS idx_drafts_module ON drafts(module);
CREATE INDEX IF NOT EXISTS idx_drafts_updated ON drafts(updated_at DESC);

-- Settings (key-value, replaces config.json + localStorage settings)
CREATE TABLE IF NOT EXISTS settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Recent projects
CREATE TABLE IF NOT EXISTS recent_projects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    module          TEXT NOT NULL DEFAULT 'project',
    document_id     TEXT,
    name            TEXT NOT NULL,
    path            TEXT DEFAULT '',
    opened_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recent_opened ON recent_projects(opened_at DESC);
`;

// ---------------------------------------------------------------------------
// Tauri SQLite Adapter
// ---------------------------------------------------------------------------

class TauriSqliteAdapter implements DbAdapter {
    // The Tauri SQL Database instance (typed loosely because it's dynamically imported)
    private db: { execute: (sql: string, bindings?: unknown[]) => Promise<{ rowsAffected: number; lastInsertId?: number }>; select: <T>(sql: string, bindings?: unknown[]) => Promise<T[]>; close: () => Promise<boolean> } | null = null;
    private initialized = false;

    constructor(private dbPath: string) {}

    private async ensureConnection(): Promise<void> {
        if (this.initialized) return;
        const SQL = await import('@tauri-apps/plugin-sql');
        this.db = await SQL.default.load(`sqlite:${this.dbPath}`);
        this.initialized = true;
    }

    async execute(sql: string, bindings?: unknown[]): Promise<QueryResult> {
        await this.ensureConnection();
        const result = await this.db!.execute(sql, bindings ?? []);
        return {
            rowsAffected: result.rowsAffected ?? 0,
            lastInsertId: result.lastInsertId ?? 0,
        };
    }

    async select<T = Record<string, unknown>>(sql: string, bindings?: unknown[]): Promise<T[]> {
        await this.ensureConnection();
        return await this.db!.select<T>(sql, bindings ?? []);
    }

    async close(): Promise<void> {
        if (this.initialized && this.db) {
            await this.db.close();
            this.initialized = false;
        }
    }
}

// ---------------------------------------------------------------------------
// In-Memory Adapter (web/dev fallback)
// ---------------------------------------------------------------------------

interface MemTable {
    autoId: number;
    rows: Map<string | number, Record<string, unknown>>;
    columns: string[];
}

class InMemoryAdapter implements DbAdapter {
    private tables = new Map<string, MemTable>();

    async execute(sql: string, bindings?: unknown[]): Promise<QueryResult> {
        const trimmed = sql.trim().toUpperCase();

        // DDL: silently accept CREATE/INDEX/PRAGMA statements
        if (trimmed.startsWith('CREATE') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('INSERT INTO SCHEMA_VERSION')) {
            return { rowsAffected: 0, lastInsertId: 0 };
        }

        // INSERT
        const insertMatch = sql.match(/INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+(\w+)/i);
        if (insertMatch) {
            const table = insertMatch[1];
            return this.handleInsert(table, sql, bindings ?? []);
        }

        // UPDATE
        const updateMatch = sql.match(/UPDATE\s+(\w+)\s+SET/i);
        if (updateMatch) {
            const table = updateMatch[1];
            return this.handleUpdate(table, sql, bindings ?? []);
        }

        // DELETE
        const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
        if (deleteMatch) {
            const table = deleteMatch[1];
            return this.handleDelete(table, sql, bindings ?? []);
        }

        return { rowsAffected: 0, lastInsertId: 0 };
    }

    async select<T = Record<string, unknown>>(sql: string, bindings?: unknown[]): Promise<T[]> {
        const selectMatch = sql.match(/FROM\s+(\w+)/i);
        if (!selectMatch) return [];

        const table = selectMatch[1];
        const tbl = this.tables.get(table);
        if (!tbl) return [];

        let rows = Array.from(tbl.rows.values());

        // Simple WHERE id = ? / WHERE key = ?
        const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
        if (whereMatch && bindings && bindings.length > 0) {
            const col = whereMatch[1];
            const val = bindings[0];
            rows = rows.filter(r => r[col] === val);
        }

        // Simple WHERE col1 = ? AND col2 = ?
        const whereAndMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?\s+AND\s+(\w+)\s*=\s*\?/i);
        if (whereAndMatch && bindings && bindings.length >= 2) {
            const col1 = whereAndMatch[1];
            const col2 = whereAndMatch[2];
            rows = rows.filter(r => r[col1] === bindings[0] && r[col2] === bindings[1]);
        }

        // ORDER BY ... DESC
        const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)\s+(DESC|ASC)/i);
        if (orderMatch) {
            const col = orderMatch[1];
            const dir = orderMatch[2].toUpperCase() === 'DESC' ? -1 : 1;
            rows.sort((a, b) => {
                if (a[col]! < b[col]!) return -dir;
                if (a[col]! > b[col]!) return dir;
                return 0;
            });
        }

        // LIMIT
        const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
        if (limitMatch) {
            rows = rows.slice(0, parseInt(limitMatch[1]));
        }

        return rows as T[];
    }

    async close(): Promise<void> {
        this.tables.clear();
    }

    private ensureTable(name: string): MemTable {
        if (!this.tables.has(name)) {
            this.tables.set(name, { autoId: 0, rows: new Map(), columns: [] });
        }
        return this.tables.get(name)!;
    }

    private handleInsert(table: string, sql: string, bindings: unknown[]): QueryResult {
        const tbl = this.ensureTable(table);

        // Parse column names from INSERT INTO table (col1, col2, ...) VALUES (?, ?, ...)
        const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
        if (!colsMatch) return { rowsAffected: 0, lastInsertId: 0 };

        const cols = colsMatch[1].split(',').map(c => c.trim());
        const row: Record<string, unknown> = {};
        cols.forEach((col, i) => {
            row[col] = bindings[i] ?? null;
        });

        // Auto-generate ID if not provided
        let id = row['id'];
        if (id === undefined || id === null) {
            tbl.autoId++;
            id = tbl.autoId;
            row['id'] = id;
        }

        // OR REPLACE support
        tbl.rows.set(id as string | number, row);

        return { rowsAffected: 1, lastInsertId: typeof id === 'number' ? id : 0 };
    }

    private handleUpdate(table: string, _sql: string, bindings: unknown[]): QueryResult {
        const tbl = this.ensureTable(table);
        // Last binding is typically the WHERE id = ?
        const id = bindings[bindings.length - 1];
        const row = tbl.rows.get(id as string | number);
        if (!row) return { rowsAffected: 0, lastInsertId: 0 };

        // Parse SET col1 = ?, col2 = ?
        const setMatch = _sql.match(/SET\s+(.+?)\s+WHERE/i);
        if (setMatch) {
            const setParts = setMatch[1].split(',').map(s => s.trim().split(/\s*=\s*/));
            setParts.forEach((part, i) => {
                row[part[0]] = bindings[i] ?? null;
            });
        }

        tbl.rows.set(id as string | number, row);
        return { rowsAffected: 1, lastInsertId: 0 };
    }

    private handleDelete(table: string, _sql: string, bindings: unknown[]): QueryResult {
        const tbl = this.ensureTable(table);
        if (!bindings || bindings.length === 0) {
            const count = tbl.rows.size;
            tbl.rows.clear();
            return { rowsAffected: count, lastInsertId: 0 };
        }
        const id = bindings[0];
        const deleted = tbl.rows.delete(id as string | number);
        return { rowsAffected: deleted ? 1 : 0, lastInsertId: 0 };
    }
}

// ---------------------------------------------------------------------------
// Singleton management
// ---------------------------------------------------------------------------

let _adapter: DbAdapter | null = null;
let _initializing: Promise<DbAdapter> | null = null;

/**
 * Get the database path based on settings.
 * Falls back to a default path.
 */
async function resolveDbPath(): Promise<string> {
    try {
        // Try to read amfeBasePath or shared path from localStorage (bootstrap)
        if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem('barack_storage_settings');
            if (stored) {
                const parsed = JSON.parse(stored);
                const base = parsed.sharedStoragePath || parsed.localStoragePath;
                if (base) return `${base}\\barack_mercosul.db`;
            }
        }
    } catch { /* ignore */ }

    // Default: same network drive base path
    return 'Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\15. Tiempos\\barack_mercosul.db';
}

async function initializeAdapter(): Promise<DbAdapter> {
    if (isTauri()) {
        const dbPath = await resolveDbPath();
        logger.info('Database', 'Initializing SQLite', { path: dbPath });
        const adapter = new TauriSqliteAdapter(dbPath);

        // Run pragmas
        await adapter.execute('PRAGMA journal_mode = WAL');
        await adapter.execute('PRAGMA busy_timeout = 5000');
        await adapter.execute('PRAGMA foreign_keys = ON');
        await adapter.execute('PRAGMA synchronous = NORMAL');
        await adapter.execute('PRAGMA cache_size = -8000');

        // Run schema DDL (IF NOT EXISTS makes this idempotent)
        const statements = SCHEMA_DDL.split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const stmt of statements) {
            await adapter.execute(stmt);
        }

        // Check/insert schema version
        const versions = await adapter.select<{ version: number }>('SELECT version FROM schema_version WHERE version = ?', [SCHEMA_VERSION]);
        if (versions.length === 0) {
            await adapter.execute(
                'INSERT INTO schema_version (version, description) VALUES (?, ?)',
                [SCHEMA_VERSION, 'Initial schema - SQLite migration']
            );
        }

        logger.info('Database', 'SQLite initialized successfully');
        return adapter;
    }

    // Web/dev fallback: in-memory
    logger.info('Database', 'Using in-memory database (web mode)');
    return new InMemoryAdapter();
}

/**
 * Get the database adapter singleton.
 * Initializes on first call (lazy).
 */
export async function getDatabase(): Promise<DbAdapter> {
    if (_adapter) return _adapter;

    // Prevent concurrent initialization
    if (_initializing) return _initializing;

    _initializing = initializeAdapter().then(adapter => {
        _adapter = adapter;
        _initializing = null;
        return adapter;
    }).catch(err => {
        // Reset so the next call retries instead of returning a rejected promise forever
        _initializing = null;
        logger.error('Database', 'Initialization failed — will retry on next access', {}, err instanceof Error ? err : undefined);
        throw err;
    });

    return _initializing;
}

/**
 * Close the database connection.
 * Used for cleanup/testing.
 */
export async function closeDatabase(): Promise<void> {
    if (_adapter) {
        await _adapter.close();
        _adapter = null;
    }
    _initializing = null;
}

/**
 * Reset the database singleton (for testing).
 */
export function resetDatabaseForTesting(): void {
    _adapter = null;
    _initializing = null;
}
