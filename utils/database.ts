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

const SCHEMA_VERSION = 8;

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
CREATE INDEX IF NOT EXISTS idx_amfe_project_name ON amfe_documents(project_name);

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
    project_name        TEXT NOT NULL DEFAULT '',
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

CREATE INDEX IF NOT EXISTS idx_cp_project_name ON cp_documents(project_name);
CREATE INDEX IF NOT EXISTS idx_cp_client ON cp_documents(client);
CREATE INDEX IF NOT EXISTS idx_cp_updated ON cp_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cp_linked_amfe ON cp_documents(linked_amfe_id);
CREATE INDEX IF NOT EXISTS idx_cp_linked_amfe_project ON cp_documents(linked_amfe_project);

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
CREATE INDEX IF NOT EXISTS idx_ho_linked_amfe_project ON ho_documents(linked_amfe_project);

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

-- Document revisions (snapshot history)
CREATE TABLE IF NOT EXISTS document_revisions (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    module                TEXT NOT NULL CHECK(module IN ('amfe','cp','ho','pfd')),
    document_id           TEXT NOT NULL,
    revision_level        TEXT NOT NULL,
    description           TEXT NOT NULL,
    revised_by            TEXT NOT NULL DEFAULT '',
    snapshot_data         TEXT NOT NULL,
    snapshot_checksum     TEXT,
    parent_revision_level TEXT DEFAULT '',
    created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_revisions_module_doc ON document_revisions(module, document_id);

-- Cross-document change tracking
CREATE TABLE IF NOT EXISTS cross_doc_checks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    source_module   TEXT NOT NULL,
    source_doc_id   TEXT NOT NULL,
    target_module   TEXT NOT NULL,
    target_doc_id   TEXT NOT NULL,
    source_revision TEXT NOT NULL,
    source_updated  TEXT NOT NULL,
    acknowledged_at TEXT,
    UNIQUE(source_module, source_doc_id, target_module, target_doc_id)
);

CREATE INDEX IF NOT EXISTS idx_cross_doc_target ON cross_doc_checks(target_module, target_doc_id);

-- Solicitudes de Generacion de Codigo
CREATE TABLE IF NOT EXISTS solicitud_documents (
    id                  TEXT PRIMARY KEY,
    solicitud_number    TEXT NOT NULL UNIQUE,
    tipo                TEXT NOT NULL CHECK(tipo IN ('producto','insumo')),
    codigo              TEXT NOT NULL DEFAULT '',
    descripcion         TEXT NOT NULL DEFAULT '',
    solicitante         TEXT NOT NULL DEFAULT '',
    area_departamento   TEXT NOT NULL DEFAULT '',
    status              TEXT NOT NULL DEFAULT 'borrador'
                        CHECK(status IN ('borrador','enviada','aprobada','rechazada','obsoleta')),
    fecha_solicitud     TEXT NOT NULL DEFAULT '',
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    data                TEXT NOT NULL,
    checksum            TEXT,
    server_folder_path  TEXT NOT NULL DEFAULT '',
    attachment_count    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_solicitud_number ON solicitud_documents(solicitud_number);
CREATE INDEX IF NOT EXISTS idx_solicitud_tipo ON solicitud_documents(tipo);
CREATE INDEX IF NOT EXISTS idx_solicitud_status ON solicitud_documents(status);
CREATE INDEX IF NOT EXISTS idx_solicitud_updated ON solicitud_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_solicitud_solicitante ON solicitud_documents(solicitante);

-- Product catalog (articles / customer product codes)
CREATE TABLE IF NOT EXISTS products (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo          TEXT NOT NULL,
    descripcion     TEXT NOT NULL,
    linea_code      TEXT NOT NULL,
    linea_name      TEXT NOT NULL,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(codigo, linea_code)
);

CREATE INDEX IF NOT EXISTS idx_products_codigo ON products(codigo);
CREATE INDEX IF NOT EXISTS idx_products_linea ON products(linea_code);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_descripcion ON products(descripcion);

-- Customer lines (derived from products for quick lookup)
CREATE TABLE IF NOT EXISTS customer_lines (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    product_count   INTEGER NOT NULL DEFAULT 0,
    is_automotive   INTEGER NOT NULL DEFAULT 0,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customer_lines_code ON customer_lines(code);
CREATE INDEX IF NOT EXISTS idx_customer_lines_automotive ON customer_lines(is_automotive);

-- Product families (groups of products sharing manufacturing process)
CREATE TABLE IF NOT EXISTS product_families (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    description     TEXT NOT NULL DEFAULT '',
    linea_code      TEXT NOT NULL DEFAULT '',
    linea_name      TEXT NOT NULL DEFAULT '',
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_families_name ON product_families(name);
CREATE INDEX IF NOT EXISTS idx_families_linea ON product_families(linea_code);
CREATE INDEX IF NOT EXISTS idx_families_active ON product_families(active);

-- Product family members (M:N relationship: product <-> family)
CREATE TABLE IF NOT EXISTS product_family_members (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id       INTEGER NOT NULL REFERENCES product_families(id) ON DELETE CASCADE,
    product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    is_primary      INTEGER NOT NULL DEFAULT 0,
    added_at        TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(family_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_pfm_family ON product_family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_pfm_product ON product_family_members(product_id);

-- Pending exports queue (offline sync to Y: drive)
CREATE TABLE IF NOT EXISTS pending_exports (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    module          TEXT NOT NULL,
    document_id     TEXT NOT NULL,
    revision_level  TEXT NOT NULL,
    export_format   TEXT NOT NULL,
    filename        TEXT NOT NULL,
    file_data       BLOB NOT NULL,
    target_dir      TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    retry_count     INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_exports_module ON pending_exports(module);
CREATE INDEX IF NOT EXISTS idx_pending_exports_created ON pending_exports(created_at);
`;

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

async function runMigrations(adapter: DbAdapter): Promise<void> {
    // Get current version
    let currentVersion = 0;
    try {
        const rows = await adapter.select<{ version: number }>('SELECT MAX(version) as version FROM schema_version');
        currentVersion = rows[0]?.version ?? 0;
    } catch {
        // Table may not exist yet on first run — version 0
    }

    // Migration 1→2: Add project_name column to cp_documents
    if (currentVersion < 2) {
        try {
            await adapter.execute(
                `ALTER TABLE cp_documents ADD COLUMN project_name TEXT NOT NULL DEFAULT ''`
            );
            logger.info('Database', 'Migration 2: Added project_name to cp_documents');
        } catch {
            // Column already exists (DDL ran first on fresh install) — safe to ignore
        }

        try {
            await adapter.execute(
                `CREATE INDEX IF NOT EXISTS idx_cp_project_name ON cp_documents(project_name)`
            );
        } catch {
            // Index may already exist
        }

        await adapter.execute(
            `INSERT OR REPLACE INTO schema_version (version, description) VALUES (?, ?)`,
            [2, 'Add project_name to cp_documents']
        );
    }

    // Migration 2→3: Add document_revisions, cross_doc_checks tables, revision columns
    if (currentVersion < 3) {
        const alters = [
            `ALTER TABLE cp_documents ADD COLUMN revision_level TEXT NOT NULL DEFAULT 'A'`,
            `ALTER TABLE cp_documents ADD COLUMN last_revision_at TEXT DEFAULT ''`,
            `ALTER TABLE ho_documents ADD COLUMN revision_level TEXT NOT NULL DEFAULT 'A'`,
            `ALTER TABLE ho_documents ADD COLUMN last_revision_at TEXT DEFAULT ''`,
            `ALTER TABLE pfd_documents ADD COLUMN last_revision_at TEXT DEFAULT ''`,
            `ALTER TABLE amfe_documents ADD COLUMN revision_level TEXT NOT NULL DEFAULT 'A'`,
        ];
        for (const sql of alters) {
            try { await adapter.execute(sql); } catch { /* column may already exist */ }
        }
        await adapter.execute(
            `INSERT OR REPLACE INTO schema_version (version, description) VALUES (?, ?)`,
            [3, 'Add document_revisions, cross_doc_checks tables, revision columns']
        );
    }

    // Migration 3→4: Add solicitud_documents table, expand drafts + revisions CHECK constraints
    if (currentVersion < 4) {
        // solicitud_documents table is created by DDL (IF NOT EXISTS) above.
        // Expand CHECK constraints on drafts and document_revisions to include 'solicitud'.
        // SQLite doesn't support ALTER CHECK, so we recreate the tables.

        try {
            await adapter.execute(`CREATE TABLE IF NOT EXISTS drafts_v4 (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                module          TEXT NOT NULL CHECK(module IN ('project','amfe','cp','ho','pfd','solicitud')),
                document_key    TEXT NOT NULL,
                data            TEXT NOT NULL,
                created_at      TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(module, document_key)
            )`);
            await adapter.execute(`INSERT OR IGNORE INTO drafts_v4 (id, module, document_key, data, created_at, updated_at)
                SELECT id, module, document_key, data, created_at, updated_at FROM drafts`);
            await adapter.execute('DROP TABLE IF EXISTS drafts');
            await adapter.execute('ALTER TABLE drafts_v4 RENAME TO drafts');
            await adapter.execute('CREATE INDEX IF NOT EXISTS idx_drafts_module ON drafts(module)');
            await adapter.execute('CREATE INDEX IF NOT EXISTS idx_drafts_updated ON drafts(updated_at DESC)');
        } catch (e) {
            logger.warn('Database', 'Migration 4: drafts table recreation skipped', {}, e instanceof Error ? e : undefined);
        }

        try {
            await adapter.execute(`CREATE TABLE IF NOT EXISTS document_revisions_v4 (
                id                    INTEGER PRIMARY KEY AUTOINCREMENT,
                module                TEXT NOT NULL CHECK(module IN ('amfe','cp','ho','pfd','solicitud')),
                document_id           TEXT NOT NULL,
                revision_level        TEXT NOT NULL,
                description           TEXT NOT NULL,
                revised_by            TEXT NOT NULL DEFAULT '',
                snapshot_data         TEXT NOT NULL,
                snapshot_checksum     TEXT,
                parent_revision_level TEXT DEFAULT '',
                created_at            TEXT NOT NULL DEFAULT (datetime('now'))
            )`);
            await adapter.execute(`INSERT OR IGNORE INTO document_revisions_v4
                SELECT * FROM document_revisions`);
            await adapter.execute('DROP TABLE IF EXISTS document_revisions');
            await adapter.execute('ALTER TABLE document_revisions_v4 RENAME TO document_revisions');
            await adapter.execute('CREATE INDEX IF NOT EXISTS idx_revisions_module_doc ON document_revisions(module, document_id)');
        } catch (e) {
            logger.warn('Database', 'Migration 4: document_revisions table recreation skipped', {}, e instanceof Error ? e : undefined);
        }

        await adapter.execute(
            `INSERT OR REPLACE INTO schema_version (version, description) VALUES (?, ?)`,
            [4, 'Add solicitud_documents, expand draft/revision CHECK constraints']
        );
        logger.info('Database', 'Migration 4: solicitud_documents + CHECK constraint expansion complete');
    }

    // Migration 4→5: Add server_folder_path, attachment_count to solicitud_documents, expand status CHECK
    if (currentVersion < 5) {
        try {
            // Recreate solicitud_documents with updated CHECK constraint and new columns
            await adapter.execute(`CREATE TABLE IF NOT EXISTS solicitud_documents_v5 (
                id                  TEXT PRIMARY KEY,
                solicitud_number    TEXT NOT NULL UNIQUE,
                tipo                TEXT NOT NULL CHECK(tipo IN ('producto','insumo')),
                codigo              TEXT NOT NULL DEFAULT '',
                descripcion         TEXT NOT NULL DEFAULT '',
                solicitante         TEXT NOT NULL DEFAULT '',
                area_departamento   TEXT NOT NULL DEFAULT '',
                status              TEXT NOT NULL DEFAULT 'borrador'
                                    CHECK(status IN ('borrador','enviada','aprobada','rechazada','obsoleta')),
                fecha_solicitud     TEXT NOT NULL DEFAULT '',
                created_at          TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
                data                TEXT NOT NULL,
                checksum            TEXT,
                server_folder_path  TEXT NOT NULL DEFAULT '',
                attachment_count    INTEGER NOT NULL DEFAULT 0
            )`);
            await adapter.execute(`INSERT OR IGNORE INTO solicitud_documents_v5
                (id, solicitud_number, tipo, codigo, descripcion, solicitante,
                 area_departamento, status, fecha_solicitud, created_at, updated_at,
                 data, checksum, server_folder_path, attachment_count)
                SELECT id, solicitud_number, tipo, codigo, descripcion, solicitante,
                       area_departamento, status, fecha_solicitud, created_at, updated_at,
                       data, checksum, '', 0
                FROM solicitud_documents`);
            await adapter.execute('DROP TABLE IF EXISTS solicitud_documents');
            await adapter.execute('ALTER TABLE solicitud_documents_v5 RENAME TO solicitud_documents');
            // Recreate indexes
            await adapter.execute('CREATE INDEX IF NOT EXISTS idx_solicitud_number ON solicitud_documents(solicitud_number)');
            await adapter.execute('CREATE INDEX IF NOT EXISTS idx_solicitud_tipo ON solicitud_documents(tipo)');
            await adapter.execute('CREATE INDEX IF NOT EXISTS idx_solicitud_status ON solicitud_documents(status)');
            await adapter.execute('CREATE INDEX IF NOT EXISTS idx_solicitud_updated ON solicitud_documents(updated_at DESC)');
            await adapter.execute('CREATE INDEX IF NOT EXISTS idx_solicitud_solicitante ON solicitud_documents(solicitante)');
        } catch (e) {
            logger.warn('Database', 'Migration 5: solicitud_documents recreation skipped', {}, e instanceof Error ? e : undefined);
        }

        await adapter.execute(
            `INSERT OR REPLACE INTO schema_version (version, description) VALUES (?, ?)`,
            [5, 'Add server_folder_path, attachment_count, obsoleta status to solicitud_documents']
        );
        logger.info('Database', 'Migration 5: solicitud_documents v5 complete');
    }

    // Migration 5→6: Add products and customer_lines tables
    if (currentVersion < 6) {
        // Tables created by DDL above (IF NOT EXISTS), just record the version
        await adapter.execute(
            `INSERT OR REPLACE INTO schema_version (version, description) VALUES (?, ?)`,
            [6, 'Add products and customer_lines tables']
        );
        logger.info('Database', 'Migration 6: products + customer_lines tables created');
    }

    // Migration 6→7: Add product_families and product_family_members tables
    if (currentVersion < 7) {
        // Tables created by DDL above (IF NOT EXISTS), just record the version
        await adapter.execute(
            `INSERT OR REPLACE INTO schema_version (version, description) VALUES (?, ?)`,
            [7, 'Add product_families and product_family_members tables']
        );
        logger.info('Database', 'Migration 7: product_families + product_family_members tables created');
    }

    // Migration 7→8: Add pending_exports table for offline export sync
    if (currentVersion < 8) {
        // Table created by DDL above (IF NOT EXISTS), just record the version
        await adapter.execute(
            `INSERT OR REPLACE INTO schema_version (version, description) VALUES (?, ?)`,
            [8, 'Add pending_exports table for offline export sync']
        );
        logger.info('Database', 'Migration 8: pending_exports table created');
    }
}

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

    // Default column values for tables (applied when INSERT omits them)
    private static readonly TABLE_DEFAULTS: Record<string, Record<string, unknown>> = {
        product_families: { active: 1, description: '', linea_code: '', linea_name: '' },
        product_family_members: { is_primary: 0 },
        products: { active: 1 },
        customer_lines: { active: 1, product_count: 0, is_automotive: 0 },
        settings: {},
        schema_version: {},
    };

    // Composite UNIQUE constraints per table (beyond the primary key)
    private static readonly UNIQUE_CONSTRAINTS: Record<string, string[][]> = {
        product_family_members: [['family_id', 'product_id']],
        products: [['codigo', 'linea_code']],
        drafts: [['module', 'document_key']],
    };

    async execute(sql: string, bindings?: unknown[]): Promise<QueryResult> {
        const trimmed = sql.trim().toUpperCase();

        // DDL: silently accept CREATE/ALTER/INDEX/PRAGMA statements
        if (trimmed.startsWith('CREATE') || trimmed.startsWith('ALTER') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('INSERT INTO SCHEMA_VERSION')) {
            return { rowsAffected: 0, lastInsertId: 0 };
        }

        // Transaction control: no-op for in-memory (single-threaded, no real transactions needed)
        if (trimmed.startsWith('BEGIN') || trimmed.startsWith('COMMIT') || trimmed.startsWith('ROLLBACK')) {
            return { rowsAffected: 0, lastInsertId: 0 };
        }

        // DROP TABLE
        if (trimmed.startsWith('DROP')) {
            const dropMatch = sql.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i);
            if (dropMatch) {
                this.tables.delete(dropMatch[1]);
            }
            return { rowsAffected: 0, lastInsertId: 0 };
        }

        // INSERT
        const insertMatch = sql.match(/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+(\w+)/i);
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
        // Find the main FROM clause (not inside parenthesized subqueries)
        const table = this.findMainFrom(sql);
        if (!table) return [];
        const tbl = this.tables.get(table);
        if (!tbl) return [];

        let rows = Array.from(tbl.rows.values());

        // ---- JOIN support ----
        if (/\bJOIN\b/i.test(sql)) {
            rows = this.resolveJoins(rows, sql);
        }

        // ---- WHERE clause filtering ----
        const whereClause = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s|\s+LIMIT\s|\s+OFFSET\s|\s+GROUP\s|$)/is)?.[1];
        if (whereClause && bindings && bindings.length > 0) {
            rows = this.applyWhere(rows, whereClause, [...bindings]);
        } else if (whereClause) {
            // WHERE without bindings (e.g. WHERE active = 1)
            rows = this.applyWhere(rows, whereClause, []);
        }

        // ---- Subquery evaluation (e.g. (SELECT COUNT(*) FROM t WHERE col = ref) as alias) ----
        rows = this.resolveSubqueries(rows, sql);

        // ---- COUNT(*) aggregate ----
        const countMatch = sql.match(/SELECT\s+COUNT\s*\(\s*\*\s*\)\s+(?:as|AS)\s+(\w+)/i);
        if (countMatch) {
            const alias = countMatch[1];
            return [{ [alias]: rows.length } as unknown as T];
        }

        // ---- ORDER BY (supports multi-column, with table aliases like p.codigo) ----
        const orderMatch = sql.match(/ORDER\s+BY\s+(.+?)(?:\s+LIMIT\s|\s+OFFSET\s|$)/i);
        if (orderMatch) {
            const parts = orderMatch[1].split(',').map(p => p.trim());
            const orderCols = parts.map(p => {
                const m = p.match(/^([\w.]+)(?:\s+(DESC|ASC))?$/i);
                return m ? { col: this.stripAlias(m[1]), dir: m[2]?.toUpperCase() === 'DESC' ? -1 : 1 } : null;
            }).filter(Boolean) as { col: string; dir: number }[];

            if (orderCols.length > 0) {
                rows.sort((a, b) => {
                    for (const { col, dir } of orderCols) {
                        if (a[col]! < b[col]!) return -dir;
                        if (a[col]! > b[col]!) return dir;
                    }
                    return 0;
                });
            }
        }

        // ---- LIMIT / OFFSET ----
        const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
        if (limitMatch) {
            const offsetMatch = sql.match(/OFFSET\s+(\d+)/i);
            const off = offsetMatch ? parseInt(offsetMatch[1]) : 0;
            rows = rows.slice(off, off + parseInt(limitMatch[1]));
        }

        // Clean internal metadata before returning
        for (const row of rows) {
            delete row.__leftNullAliases;
        }

        return rows as T[];
    }

    // ---- Helpers ----

    /** Find the main FROM table name, skipping subqueries inside parentheses. */
    private findMainFrom(sql: string): string | null {
        let depth = 0;
        const fromRegex = /FROM\s+(\w+)/gi;
        // Track paren depth for each position
        const parenDepth: number[] = new Array(sql.length);
        for (let i = 0; i < sql.length; i++) {
            if (sql[i] === '(') depth++;
            parenDepth[i] = depth;
            if (sql[i] === ')') depth--;
        }
        let match: RegExpExecArray | null;
        while ((match = fromRegex.exec(sql)) !== null) {
            if (parenDepth[match.index] === 0) {
                return match[1];
            }
        }
        return null;
    }

    /** Strip table alias prefix from column name (e.g. "pf.active" → "active") */
    private stripAlias(col: string): string {
        const dotIdx = col.lastIndexOf('.');
        return dotIdx >= 0 ? col.substring(dotIdx + 1) : col;
    }

    /**
     * Resolve JOIN clauses by merging rows from joined tables.
     * Supports INNER JOIN and LEFT JOIN with ON conditions.
     */
    private resolveJoins(rows: Record<string, unknown>[], sql: string): Record<string, unknown>[] {
        // Match: (LEFT )? JOIN tableName (alias)? ON expr1 = expr2
        const joinRegex = /(LEFT\s+)?JOIN\s+(\w+)\s+(\w+)?\s*ON\s+([\w.]+)\s*=\s*([\w.]+)/gi;
        let match: RegExpExecArray | null;
        let result = rows;

        while ((match = joinRegex.exec(sql)) !== null) {
            const isLeftJoin = !!match[1];
            const joinTableName = match[2];
            const leftExpr = match[4];   // e.g., pfm.product_id
            const rightExpr = match[5];  // e.g., p.id

            const joinTbl = this.tables.get(joinTableName);
            if (!joinTbl || joinTbl.rows.size === 0) {
                // INNER JOIN with missing/empty table → no rows match
                if (!isLeftJoin) return [];
                // LEFT JOIN with missing/empty table → tag all rows as null for this alias
                const alias = match[3] || joinTableName;
                for (const row of result) {
                    const existing = (row.__leftNullAliases as Set<string> | undefined) ?? new Set<string>();
                    existing.add(alias);
                    row.__leftNullAliases = existing;
                }
                continue;
            }

            const leftCol = this.stripAlias(leftExpr);
            const rightCol = this.stripAlias(rightExpr);
            const joinRows = Array.from(joinTbl.rows.values());

            const newResult: Record<string, unknown>[] = [];
            for (const row of result) {
                // Find matching rows in join table (try both column directions)
                const matching = joinRows.filter(jr => {
                    if (row[leftCol] !== undefined && jr[rightCol] !== undefined) {
                        return row[leftCol] === jr[rightCol];
                    }
                    if (row[rightCol] !== undefined && jr[leftCol] !== undefined) {
                        return row[rightCol] === jr[leftCol];
                    }
                    return false;
                });

                if (matching.length > 0) {
                    for (const jr of matching) {
                        // Merge: joined table columns override (so p.id doesn't clobber pfm.id)
                        // Strategy: keep primary row's 'id', merge other cols from joined row
                        const merged = { ...row };
                        for (const [k, v] of Object.entries(jr)) {
                            if (k === 'id') continue; // Don't overwrite primary key
                            merged[k] = v;
                        }
                        newResult.push(merged);
                    }
                } else if (isLeftJoin) {
                    const nullRow = { ...row };
                    // Track which join aliases had no match (for IS NULL support)
                    const alias = match![3] || joinTableName;
                    const existing = (nullRow.__leftNullAliases as Set<string> | undefined) ?? new Set<string>();
                    existing.add(alias);
                    nullRow.__leftNullAliases = existing;
                    newResult.push(nullRow);
                }
                // INNER JOIN: no match = row excluded (default)
            }
            result = newResult;
        }

        return result;
    }

    /**
     * Resolve inline subqueries like:
     * (SELECT COUNT(*) FROM tableName WHERE col = alias.col) as alias_name
     */
    private resolveSubqueries(rows: Record<string, unknown>[], sql: string): Record<string, unknown>[] {
        const subqRegex = /\(SELECT\s+COUNT\s*\(\s*\*\s*\)\s+FROM\s+(\w+)\s+WHERE\s+([\w.]+)\s*=\s*([\w.]+)\)\s+[Aa][Ss]\s+(\w+)/g;
        let match: RegExpExecArray | null;
        const subqueries: Array<{
            table: string;
            filterCol: string;
            refCol: string;
            alias: string;
        }> = [];

        while ((match = subqRegex.exec(sql)) !== null) {
            subqueries.push({
                table: match[1],
                filterCol: this.stripAlias(match[2]),
                refCol: this.stripAlias(match[3]),
                alias: match[4],
            });
        }

        if (subqueries.length === 0) return rows;

        return rows.map(row => {
            const newRow = { ...row };
            for (const sq of subqueries) {
                const subTbl = this.tables.get(sq.table);
                if (!subTbl) {
                    newRow[sq.alias] = 0;
                    continue;
                }
                const refValue = row[sq.refCol];
                const count = Array.from(subTbl.rows.values())
                    .filter(r => r[sq.filterCol] === refValue).length;
                newRow[sq.alias] = count;
            }
            return newRow;
        });
    }

    /**
     * Evaluate a WHERE clause against rows.
     * Supports: col = ?, col = literal, col LIKE ?, col IS NULL, AND, OR, parenthesized groups.
     * Handles table-aliased column names (e.g. pf.active → active).
     */
    private applyWhere(rows: Record<string, unknown>[], whereClause: string, bindings: unknown[]): Record<string, unknown>[] {
        return rows.filter(row => {
            const ctx = { bindings, idx: 0 };
            return this.evalWhereExpr(row, whereClause, ctx);
        });
    }

    private evalWhereExpr(row: Record<string, unknown>, expr: string, ctx: { bindings: unknown[]; idx: number }): boolean {
        const trimmed = expr.trim();

        // Split by top-level AND (respecting parentheses)
        const andParts = this.splitRespectingParens(trimmed, /\s+AND\s+/i);
        if (andParts.length > 1) {
            return andParts.every(part => this.evalWhereExpr(row, part, ctx));
        }

        // Split by top-level OR (respecting parentheses)
        const orParts = this.splitRespectingParens(trimmed, /\s+OR\s+/i);
        if (orParts.length > 1) {
            return orParts.some(part => this.evalWhereExpr(row, part, ctx));
        }

        // Remove surrounding parentheses
        if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
            return this.evalWhereExpr(row, trimmed.slice(1, -1), ctx);
        }

        // col IS NULL (with LEFT JOIN awareness: alias.col IS NULL checks __leftNullAliases)
        const isNullMatch = trimmed.match(/^([\w.]+)\s+IS\s+NULL$/i);
        if (isNullMatch) {
            const raw = isNullMatch[1];
            const dotIdx = raw.lastIndexOf('.');
            if (dotIdx >= 0) {
                // Table-qualified column (e.g. pfm.id) — check if this alias had no LEFT JOIN match
                const alias = raw.substring(0, dotIdx);
                const nullAliases = row.__leftNullAliases as Set<string> | undefined;
                if (nullAliases?.has(alias)) return true;
            }
            const col = this.stripAlias(raw);
            return row[col] === null || row[col] === undefined;
        }

        // col IS NOT NULL
        const isNotNullMatch = trimmed.match(/^([\w.]+)\s+IS\s+NOT\s+NULL$/i);
        if (isNotNullMatch) {
            const raw = isNotNullMatch[1];
            const dotIdx = raw.lastIndexOf('.');
            if (dotIdx >= 0) {
                const alias = raw.substring(0, dotIdx);
                const nullAliases = row.__leftNullAliases as Set<string> | undefined;
                if (nullAliases?.has(alias)) return false;
            }
            const col = this.stripAlias(raw);
            return row[col] !== null && row[col] !== undefined;
        }

        // col LIKE ?
        const likeMatch = trimmed.match(/^([\w.]+)\s+LIKE\s+\?$/i);
        if (likeMatch) {
            const col = this.stripAlias(likeMatch[1]);
            const pattern = String(ctx.bindings[ctx.idx++] ?? '');
            const val = String(row[col] ?? '');
            // Convert SQL LIKE pattern to regex: % → .*, _ → .
            const regexStr = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                .replace(/%/g, '.*').replace(/_/g, '.');
            return new RegExp(`^${regexStr}$`, 'i').test(val);
        }

        // col = ?
        const eqBindMatch = trimmed.match(/^([\w.]+)\s*=\s*\?$/i);
        if (eqBindMatch) {
            const col = this.stripAlias(eqBindMatch[1]);
            const val = ctx.bindings[ctx.idx++];
            return row[col] === val;
        }

        // col = literal (number or string)
        const eqLitMatch = trimmed.match(/^([\w.]+)\s*=\s*(\d+|'[^']*')$/i);
        if (eqLitMatch) {
            const col = this.stripAlias(eqLitMatch[1]);
            let lit: unknown = eqLitMatch[2];
            if (typeof lit === 'string' && lit.startsWith("'")) {
                lit = lit.slice(1, -1);
            } else {
                lit = Number(lit);
            }
            return row[col] === lit;
        }

        // col IN (?, ?, ...)
        const inMatch = trimmed.match(/^([\w.]+)\s+IN\s*\(([^)]+)\)$/i);
        if (inMatch) {
            const col = this.stripAlias(inMatch[1]);
            const placeholders = inMatch[2].split(',').map(p => p.trim());
            const values = placeholders.map(p => p === '?' ? ctx.bindings[ctx.idx++] : p);
            return values.includes(row[col]);
        }

        // Fallback: ignore unknown condition (pass all)
        return true;
    }

    /** Split a SQL string by a delimiter regex, respecting parentheses nesting. */
    private splitRespectingParens(str: string, delim: RegExp): string[] {
        const parts: string[] = [];
        let depth = 0;
        let current = '';

        // Scan character by character
        for (let i = 0; i < str.length; i++) {
            if (str[i] === '(') depth++;
            else if (str[i] === ')') depth--;

            if (depth === 0) {
                // Check if delimiter matches at this position
                const remaining = str.slice(i);
                const m = remaining.match(delim);
                if (m && m.index === 0) {
                    parts.push(current.trim());
                    i += m[0].length - 1;
                    current = '';
                    continue;
                }
            }
            current += str[i];
        }
        if (current.trim()) parts.push(current.trim());
        return parts;
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

        // Parse column names from INSERT INTO table (col1, col2, ...) VALUES (...)
        const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
        if (!colsMatch) return { rowsAffected: 0, lastInsertId: 0 };

        const cols = colsMatch[1].split(',').map(c => c.trim());
        const valueParts = colsMatch[2].split(',').map(v => v.trim());
        const row: Record<string, unknown> = {};
        let bindIdx = 0;

        cols.forEach((col, i) => {
            const valExpr = valueParts[i]?.trim();
            if (valExpr === '?') {
                row[col] = bindings[bindIdx++] ?? null;
            } else if (valExpr !== undefined) {
                // Literal value: number, string, or SQL function (e.g. datetime('now'))
                if (/^\d+$/.test(valExpr)) {
                    row[col] = Number(valExpr);
                } else if (valExpr.startsWith("'") && valExpr.endsWith("'")) {
                    row[col] = valExpr.slice(1, -1);
                } else {
                    // SQL functions like datetime('now') → use current ISO string
                    row[col] = valExpr.includes('datetime') ? new Date().toISOString() : valExpr;
                }
            } else {
                row[col] = bindings[bindIdx++] ?? null;
            }
        });

        // Apply table defaults for columns not in the INSERT statement
        const defaults = InMemoryAdapter.TABLE_DEFAULTS[table];
        if (defaults) {
            for (const [key, defVal] of Object.entries(defaults)) {
                if (!(key in row)) {
                    row[key] = defVal;
                }
            }
        }

        // Auto-generate ID if not provided
        let id = row['id'];
        if (id === undefined || id === null) {
            tbl.autoId++;
            id = tbl.autoId;
            row['id'] = id;
        }

        // OR REPLACE / OR IGNORE support
        const isIgnore = /INSERT\s+OR\s+IGNORE/i.test(sql);
        const isReplace = /INSERT\s+OR\s+REPLACE/i.test(sql);

        if (isIgnore) {
            // Check primary key uniqueness
            if (tbl.rows.has(id as string | number)) {
                return { rowsAffected: 0, lastInsertId: 0 };
            }
            // Check composite UNIQUE constraints
            const constraints = InMemoryAdapter.UNIQUE_CONSTRAINTS[table];
            if (constraints) {
                const existing = Array.from(tbl.rows.values());
                for (const cols of constraints) {
                    const duplicate = existing.some(r =>
                        cols.every(c => r[c] !== undefined && r[c] === row[c])
                    );
                    if (duplicate) {
                        return { rowsAffected: 0, lastInsertId: 0 };
                    }
                }
            }
        }

        if (isReplace) {
            // For OR REPLACE, check if a row with same primary key exists and overwrite
            // Also check composite unique constraints — replace the matching row
            const constraints = InMemoryAdapter.UNIQUE_CONSTRAINTS[table];
            if (constraints) {
                for (const cols of constraints) {
                    for (const [existingKey, existingRow] of tbl.rows) {
                        const isMatch = cols.every(c => existingRow[c] !== undefined && existingRow[c] === row[c]);
                        if (isMatch) {
                            tbl.rows.delete(existingKey);
                            break;
                        }
                    }
                }
            }
        }

        tbl.rows.set(id as string | number, row);
        return { rowsAffected: 1, lastInsertId: typeof id === 'number' ? id : 0 };
    }

    private handleUpdate(table: string, sql: string, bindings: unknown[]): QueryResult {
        const tbl = this.ensureTable(table);

        // Parse SET clause: col1 = ?, col2 = ?, col3 = datetime('now'), ...
        // Also supports CASE WHEN: col = CASE WHEN x = ? THEN 1 ELSE 0 END
        const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/is);
        if (!setMatch) return { rowsAffected: 0, lastInsertId: 0 };

        // Split on commas that are NOT inside CASE...END blocks
        const setRaw = setMatch[1];
        const setParts: string[] = [];
        let depth = 0;
        let current = '';
        for (const token of setRaw.split(/\b/)) {
            if (/^CASE$/i.test(token)) depth++;
            if (/^END$/i.test(token)) depth--;
            current += token;
            if (depth === 0 && token === ',') {
                setParts.push(current.slice(0, -1)); // remove trailing comma
                current = '';
            }
        }
        if (current.trim()) setParts.push(current);

        const setSegments = setParts.map(s => {
            // Split only on the first `=` to preserve CASE WHEN ... = ? inside
            const m = s.trim().match(/^([\w.]+)\s*=\s*(.+)$/s);
            if (!m) return null;
            const col = this.stripAlias(m[1]);
            const valExpr = m[2].trim();
            const isCase = /^CASE\s/i.test(valExpr);
            // Count ? placeholders inside this segment
            const bindingCount = (valExpr.match(/\?/g) || []).length;
            return { col, isBinding: valExpr === '?', isCase, valExpr, bindingCount };
        }).filter(Boolean) as { col: string; isBinding: boolean; isCase: boolean; valExpr: string; bindingCount: number }[];

        // Count how many SET bindings there are (simple ? + those inside CASE)
        const setBindCount = setSegments.reduce((sum, s) => sum + s.bindingCount, 0);

        // SET bindings come first in the bindings array, WHERE bindings come after
        const setBindings = bindings.slice(0, setBindCount);
        const whereBindings = bindings.slice(setBindCount);

        // Extract WHERE clause
        const whereClause = sql.match(/WHERE\s+(.+)$/is)?.[1];

        let affected = 0;
        for (const [key, row] of tbl.rows) {
            let matches = true;
            if (whereClause) {
                const ctx = { bindings: [...whereBindings], idx: 0 };
                matches = this.evalWhereExpr(row, whereClause, ctx);
            }

            if (matches) {
                let bIdx = 0;
                for (const seg of setSegments) {
                    if (seg.isCase) {
                        // CASE WHEN col = ? THEN thenVal ELSE elseVal END
                        const cm = seg.valExpr.match(/CASE\s+WHEN\s+([\w.]+)\s*=\s*\?\s+THEN\s+(\S+)\s+ELSE\s+(\S+)\s+END/i);
                        if (cm) {
                            const caseCol = this.stripAlias(cm[1]);
                            const thenRaw = cm[2];
                            const elseRaw = cm[3];
                            const caseBinding = setBindings[bIdx++];
                            // eslint-disable-next-line eqeqeq
                            const met = row[caseCol] == caseBinding;
                            const raw = met ? thenRaw : elseRaw;
                            row[seg.col] = /^\d+$/.test(raw) ? Number(raw) : raw.replace(/^'|'$/g, '');
                        }
                    } else if (seg.isBinding) {
                        row[seg.col] = setBindings[bIdx++] ?? null;
                    } else if (seg.valExpr?.includes('datetime')) {
                        row[seg.col] = new Date().toISOString();
                    } else if (seg.valExpr && /^\d+$/.test(seg.valExpr)) {
                        // Literal numeric SET value (e.g. SET is_primary = 0)
                        row[seg.col] = Number(seg.valExpr);
                    } else if (seg.valExpr && seg.valExpr.startsWith("'") && seg.valExpr.endsWith("'")) {
                        // Literal string SET value (e.g. SET status = 'active')
                        row[seg.col] = seg.valExpr.slice(1, -1);
                    }
                }
                tbl.rows.set(key, row);
                affected++;
            }
        }

        return { rowsAffected: affected, lastInsertId: 0 };
    }

    private handleDelete(table: string, sql: string, bindings: unknown[]): QueryResult {
        const tbl = this.ensureTable(table);

        // No bindings and no WHERE = delete all
        if (!bindings || bindings.length === 0) {
            const whereClause = sql.match(/WHERE\s+(.+)$/is)?.[1];
            if (!whereClause) {
                const count = tbl.rows.size;
                tbl.rows.clear();
                return { rowsAffected: count, lastInsertId: 0 };
            }
            // WHERE without bindings (e.g. WHERE active = 0)
            const keysToDelete: (string | number)[] = [];
            for (const [key, row] of tbl.rows) {
                const ctx = { bindings: [], idx: 0 };
                if (this.evalWhereExpr(row, whereClause, ctx)) {
                    keysToDelete.push(key);
                }
            }
            for (const key of keysToDelete) tbl.rows.delete(key);
            return { rowsAffected: keysToDelete.length, lastInsertId: 0 };
        }

        // Parse WHERE clause and evaluate against all rows
        const whereClause = sql.match(/WHERE\s+(.+)$/is)?.[1];
        if (!whereClause) {
            // Fallback: delete all
            const count = tbl.rows.size;
            tbl.rows.clear();
            return { rowsAffected: count, lastInsertId: 0 };
        }

        const keysToDelete: (string | number)[] = [];
        for (const [key, row] of tbl.rows) {
            const ctx = { bindings: [...bindings], idx: 0 };
            if (this.evalWhereExpr(row, whereClause, ctx)) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            tbl.rows.delete(key);
        }

        return { rowsAffected: keysToDelete.length, lastInsertId: 0 };
    }
}

// ---------------------------------------------------------------------------
// Supabase Adapter (web mode)
// ---------------------------------------------------------------------------

/**
 * SupabaseAdapter — implements DbAdapter using Supabase PostgreSQL.
 *
 * Strategy:
 *  - All queries are translated from SQLite dialect to PostgreSQL and
 *    executed via the exec_sql_read / exec_sql_write RPC functions defined
 *    in supabase/migrations/001_initial_schema.sql.
 *  - SQLite-isms handled: datetime('now') → NOW(),
 *    INSERT OR REPLACE → INSERT ... ON CONFLICT DO UPDATE,
 *    INSERT OR IGNORE  → INSERT ... ON CONFLICT DO NOTHING,
 *    ? placeholders    → $1, $2, ...
 */
class SupabaseAdapter implements DbAdapter {
    // Conflict columns per table (for INSERT OR REPLACE → ON CONFLICT)
    private static readonly CONFLICT_MAP: Record<string, string> = {
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
    };

    // Tables with BIGSERIAL (auto-increment) primary keys — need RETURNING id
    private static readonly BIGSERIAL_TABLES = new Set([
        'projects', 'drafts', 'document_revisions', 'cross_doc_checks',
        'product_families', 'product_family_members', 'products',
        'customer_lines', 'recent_projects', 'pending_exports', 'schema_version',
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(private supabase: any) {}

    /** Replace datetime('now') with NOW() */
    private normalizeNow(sql: string): string {
        return sql.replace(/datetime\s*\(\s*'now'\s*\)/gi, 'NOW()');
    }

    /** Replace ? with $1, $2, ... */
    private convertPlaceholders(sql: string): string {
        let counter = 0;
        return sql.replace(/\?/g, () => `$${++counter}`);
    }

    /** Convert INSERT OR REPLACE INTO table → PostgreSQL upsert */
    private convertInsertOrReplace(sql: string): string {
        const tableMatch = /INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)/i.exec(sql);
        if (!tableMatch) return sql;

        const table = tableMatch[1].toLowerCase();
        const conflictCol = SupabaseAdapter.CONFLICT_MAP[table] || 'id';
        const conflictClause = conflictCol.startsWith('(') ? conflictCol : `(${conflictCol})`;

        // Extract column list from INSERT INTO table (col1, col2, ...)
        const colsMatch = /INTO\s+\w+\s*\(([^)]+)\)/i.exec(sql);
        if (!colsMatch) {
            return sql.replace(/INSERT\s+OR\s+REPLACE\s+INTO/i, 'INSERT INTO');
        }

        const cols = colsMatch[1].split(',').map(c => c.trim());
        // Columns to skip in the DO UPDATE SET (conflict key + created_at)
        const skipCols = new Set(
            conflictCol.replace(/[()]/g, '').split(',').map(c => c.trim())
        );
        skipCols.add('created_at'); // preserve original created_at on update
        const updateCols = cols.filter(c => !skipCols.has(c));
        const updateSet = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ');

        let result = sql.replace(/INSERT\s+OR\s+REPLACE\s+INTO/i, 'INSERT INTO');

        // Find the closing paren of the VALUES clause and append conflict handler
        const valuesEnd = result.lastIndexOf(')');
        if (valuesEnd > 0 && updateSet) {
            result = `${result.slice(0, valuesEnd + 1)} ON CONFLICT ${conflictClause} DO UPDATE SET ${updateSet}`;
        }
        return result;
    }

    /** Convert INSERT OR IGNORE INTO table → PostgreSQL INSERT ... ON CONFLICT DO NOTHING */
    private convertInsertOrIgnore(sql: string): string {
        const tableMatch = /INSERT\s+OR\s+IGNORE\s+INTO\s+(\w+)/i.exec(sql);
        if (!tableMatch) return sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');

        const table = tableMatch[1].toLowerCase();
        const conflictCol = SupabaseAdapter.CONFLICT_MAP[table] || 'id';
        const conflictClause = conflictCol.startsWith('(') ? conflictCol : `(${conflictCol})`;

        let result = sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
        const valuesEnd = result.lastIndexOf(')');
        if (valuesEnd > 0) {
            result = `${result.slice(0, valuesEnd + 1)} ON CONFLICT ${conflictClause} DO NOTHING`;
        }
        return result;
    }

    async execute(sql: string, bindings?: unknown[]): Promise<QueryResult> {
        const b = bindings ?? [];
        let pgSql = this.normalizeNow(sql.trim());
        const upper = pgSql.toUpperCase();

        // DDL + transactions → no-op (schema managed via migrations)
        if (/^(CREATE|ALTER|DROP|BEGIN|COMMIT|ROLLBACK|PRAGMA)/i.test(pgSql) ||
            /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+SCHEMA_VERSION/i.test(pgSql)) {
            return { rowsAffected: 0, lastInsertId: 0 };
        }

        // Convert SQLite dialect to PostgreSQL
        if (/INSERT\s+OR\s+REPLACE/i.test(pgSql)) {
            pgSql = this.convertInsertOrReplace(pgSql);
        } else if (/INSERT\s+OR\s+IGNORE/i.test(pgSql)) {
            pgSql = this.convertInsertOrIgnore(pgSql);
        }

        // Add RETURNING id for plain INSERT into BIGSERIAL tables (needed for lastInsertId)
        const isPlainInsert = /^INSERT\s+INTO\s+(\w+)/i.test(pgSql) && !/ON\s+CONFLICT/i.test(pgSql);
        if (isPlainInsert) {
            const tblMatch = /^INSERT\s+INTO\s+(\w+)/i.exec(pgSql);
            const tblName = tblMatch?.[1]?.toLowerCase() ?? '';
            if (SupabaseAdapter.BIGSERIAL_TABLES.has(tblName)) {
                pgSql = pgSql + ' RETURNING id';
            }
        }

        // Replace ? → $1, $2, ...
        pgSql = this.convertPlaceholders(pgSql);

        const { data, error } = await this.supabase.rpc('exec_sql_write', {
            query: pgSql,
            params: b,
        });

        if (error) {
            logger.error('SupabaseAdapter', 'Execute failed', { sql: pgSql, error: error.message });
            throw new Error(`DB execute failed: ${error.message}`);
        }

        const result = data as { rows_affected?: number; last_insert_id?: number } | null;
        return {
            rowsAffected: result?.rows_affected ?? 1,
            lastInsertId: result?.last_insert_id ?? 0,
        };
    }

    async select<T = Record<string, unknown>>(sql: string, bindings?: unknown[]): Promise<T[]> {
        const b = bindings ?? [];
        const pgSql = this.convertPlaceholders(this.normalizeNow(sql.trim()));

        const { data, error } = await this.supabase.rpc('exec_sql_read', {
            query: pgSql,
            params: b,
        });

        if (error) {
            logger.error('SupabaseAdapter', 'Select failed', { sql: pgSql, error: error.message });
            return [];
        }

        return (data as T[]) ?? [];
    }

    async close(): Promise<void> {
        // No-op — Supabase manages connections
    }
}

// ---------------------------------------------------------------------------
// Singleton management
// ---------------------------------------------------------------------------

let _adapter: DbAdapter | null = null;
let _initializing: Promise<DbAdapter> | null = null;

/**
 * Validate that a database path meets security requirements:
 * - Must start with a drive letter (e.g. C:\, Y:\) or be a UNC path (\\server\)
 * - Must not contain .. segments (directory traversal)
 * - Must end with .db
 *
 * Returns true if the path is considered safe, false otherwise.
 */
export function isValidDbPath(path: string): boolean {
    if (!path || typeof path !== 'string') return false;

    // Reject any path containing directory traversal segments
    if (/\.\./.test(path)) return false;

    // Must end with .db
    if (!path.endsWith('.db')) return false;

    // Must start with a Windows drive letter (e.g. C:\) or a UNC path (\\server\)
    const driveLetterPattern = /^[A-Za-z]:\\/;
    const uncPattern = /^\\\\/;
    if (!driveLetterPattern.test(path) && !uncPattern.test(path)) return false;

    return true;
}

/**
 * Get the database path based on settings.
 * Falls back to a default path.
 */
async function resolveDbPath(): Promise<string> {
    // SIMPLIFIED: Always use relative path so the Tauri SQL plugin resolves it
    // to the app config dir (AppData\Roaming\com.barackmercosul.app\).
    // This avoids: spaces in paths, network drive hangs, stale localStorage paths.
    // The SQL plugin creates parent dir + DB file automatically if needed.
    const dbName = 'barack_mercosul.db';
    logger.info('Database', `resolveDbPath → using relative path: ${dbName}`);
    return dbName;
}

async function initializeAdapter(): Promise<DbAdapter> {
    const tauriDetected = isTauri();
    logger.info('Database', 'Initializing adapter', { tauri: tauriDetected });

    if (tauriDetected) {
        const dbPath = await resolveDbPath();
        logger.info('Database', 'DB path resolved', { path: dbPath });

        try {
            const adapter = new TauriSqliteAdapter(dbPath);

            // Run pragmas
            logger.debug('Database', 'Running PRAGMAs');
            await adapter.execute('PRAGMA journal_mode = WAL');

            // Verify WAL mode activation
            const walResult = await adapter.select<{ journal_mode: string }>('PRAGMA journal_mode');
            if (walResult[0] && walResult[0].journal_mode !== 'wal') {
                logger.warn('Database', 'WAL mode not active', { mode: walResult[0].journal_mode });
            }

            await adapter.execute('PRAGMA busy_timeout = 5000');
            await adapter.execute('PRAGMA foreign_keys = ON');
            await adapter.execute('PRAGMA synchronous = NORMAL');
            await adapter.execute('PRAGMA cache_size = -8000');

            // Run schema DDL (IF NOT EXISTS makes this idempotent)
            logger.debug('Database', 'Running DDL');
            const statements = SCHEMA_DDL.split(';')
                .map(s => s.trim())
                // Strip leading SQL comments (-- ...) before checking if statement is empty.
                // SQLite handles -- comments natively, but we need to avoid filtering out
                // CREATE TABLE statements that are preceded by a comment line.
                .map(s => s.replace(/^--[^\n]*\n?/gm, '').trim())
                .filter(s => s.length > 0);

            for (const stmt of statements) {
                await adapter.execute(stmt);
            }

            // Run migrations
            await runMigrations(adapter);

            logger.info('Database', 'SQLite initialized successfully');
            return adapter;
        } catch (err) {
            logger.error('Database', 'Failed to initialize SQLite', {}, err instanceof Error ? err : undefined);
            throw err;
        }
    }

    // Web mode: use Supabase adapter
    // Persist adapter on window to survive Vite HMR (module re-execution resets _adapter to null)
    const win = globalThis as Record<string, unknown>;
    if (win.__BARACK_SUPABASE_DB__ instanceof SupabaseAdapter) {
        logger.info('Database', 'Reusing Supabase adapter (HMR recovery)');
        return win.__BARACK_SUPABASE_DB__ as SupabaseAdapter;
    }

    // In test environments, fall back to InMemoryAdapter if Supabase is unavailable
    if (win.__BARACK_IN_MEMORY_DB__ instanceof InMemoryAdapter) {
        logger.info('Database', 'Reusing InMemory adapter (test/HMR recovery)');
        return win.__BARACK_IN_MEMORY_DB__ as InMemoryAdapter;
    }

    try {
        // Dynamic import to avoid bundling Supabase in non-web builds
        const { supabase } = await import('./supabaseClient');
        const adapter = new SupabaseAdapter(supabase);
        win.__BARACK_SUPABASE_DB__ = adapter;
        logger.info('Database', 'Using Supabase adapter (web mode)');
        return adapter;
    } catch (err) {
        // Supabase unavailable (e.g., test environment without network)
        // Fall back to InMemoryAdapter for local use
        logger.warn('Database', 'Supabase unavailable — falling back to InMemoryAdapter', {}, err instanceof Error ? err : undefined);
        const memAdapter = new InMemoryAdapter();
        await runInMemorySetup(memAdapter);
        win.__BARACK_IN_MEMORY_DB__ = memAdapter;
        return memAdapter;
    }
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
    // Clear HMR-persisted adapters so re-init creates a fresh one
    const win = globalThis as Record<string, unknown>;
    delete win.__BARACK_IN_MEMORY_DB__;
    delete win.__BARACK_SUPABASE_DB__;
}

/**
 * Run DDL setup for InMemoryAdapter.
 * Called when creating a fresh InMemoryAdapter for tests or offline fallback.
 */
async function runInMemorySetup(adapter: InMemoryAdapter): Promise<void> {
    // InMemoryAdapter creates tables automatically on first INSERT,
    // so we only need to run any required initialization.
    // Skip SQLite-specific PRAGMAs (not applicable).
    try {
        await runMigrations(adapter);
    } catch {
        // Migrations may fail in InMemoryAdapter if schema differs — not critical for tests
    }
}

/**
 * Reset the database singleton (for testing).
 * Pre-seeds a fresh InMemoryAdapter so tests bypass Supabase entirely.
 */
export function resetDatabaseForTesting(): void {
    _adapter = null;
    _initializing = null;
    // Clear all HMR-persisted adapters so tests get a fresh DB
    const win = globalThis as Record<string, unknown>;
    delete win.__BARACK_IN_MEMORY_DB__;
    delete win.__BARACK_SUPABASE_DB__;
    // Pre-seed a fresh InMemoryAdapter — getDatabase() will return it without hitting Supabase
    const memAdapter = new InMemoryAdapter();
    win.__BARACK_IN_MEMORY_DB__ = memAdapter;
}
