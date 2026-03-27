-- ============================================================================
-- Barack Mercosul — PostgreSQL Schema (migrated from SQLite schema v8)
-- Apply via: supabase db push  OR  Supabase dashboard SQL editor
-- ============================================================================

-- Enable UUID extension (used for auth.uid())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- HELPER FUNCTIONS (used by SupabaseAdapter for raw SQL execution)
-- ============================================================================

-- Applies positional parameters ($1, $2, ...) to a SQL query string using
-- JSONB values (preserves type: numbers as numbers, strings as strings).
CREATE OR REPLACE FUNCTION apply_params(query text, params jsonb DEFAULT '[]'::jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    i     int;
    total int;
    param jsonb;
    pval  text;
    result text := query;
BEGIN
    total := jsonb_array_length(params);
    FOR i IN 0..total - 1 LOOP
        param := params->i;
        CASE jsonb_typeof(param)
            WHEN 'null'    THEN pval := 'NULL';
            WHEN 'number'  THEN pval := (param#>>'{}');            -- no quotes
            WHEN 'boolean' THEN pval := CASE WHEN (param#>>'{}') = 'true' THEN '1' ELSE '0' END;
            ELSE                 pval := quote_literal(param#>>'{}');   -- quoted string
        END CASE;
        result := replace(result, '$' || (i + 1), pval);
    END LOOP;
    RETURN result;
END;
$$;

-- Execute a SELECT query and return results as a JSON array.
-- Used by SupabaseAdapter.select() for complex queries (JOINs, aggregates, subqueries).
CREATE OR REPLACE FUNCTION exec_sql_read(query text, params jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    resolved_query text;
    result jsonb;
BEGIN
    resolved_query := apply_params(query, params);
    EXECUTE format('SELECT COALESCE(json_agg(t), ''[]''::json) FROM (%s) t', resolved_query)
    INTO result;
    RETURN COALESCE(result, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'exec_sql_read error: % — query: %', SQLERRM, resolved_query;
    RETURN '[]'::jsonb;
END;
$$;

-- Execute an INSERT/UPDATE/DELETE query and return rows_affected + last_insert_id.
-- Used by SupabaseAdapter.execute() for write operations.
-- Automatically detects RETURNING id clause to capture the last inserted id.
CREATE OR REPLACE FUNCTION exec_sql_write(
    query text,
    params jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    resolved_query text;
    r_count        integer := 0;
    last_id        bigint  := 0;
    result_row     record;
BEGIN
    resolved_query := apply_params(query, params);

    IF upper(resolved_query) LIKE '%RETURNING ID%' THEN
        -- Execute and capture the auto-generated id
        FOR result_row IN EXECUTE resolved_query LOOP
            BEGIN
                last_id := (result_row.id)::bigint;
            EXCEPTION WHEN OTHERS THEN
                last_id := 0;  -- TEXT primary keys (UUIDs) return 0
            END;
            r_count := r_count + 1;
        END LOOP;
    ELSE
        EXECUTE resolved_query;
        GET DIAGNOSTICS r_count = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object('rows_affected', r_count, 'last_insert_id', last_id);
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'exec_sql_write error: % — query: %', SQLERRM, resolved_query;
    RETURN jsonb_build_object('rows_affected', 0, 'last_insert_id', 0);
END;
$$;

-- ============================================================================
-- SCHEMA VERSION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_version (version, description) VALUES (8, 'Initial schema (migrated from SQLite v8)')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- PROJECTS (Tiempos y Balanceo studies)
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    client          TEXT NOT NULL DEFAULT '',
    project_code    TEXT NOT NULL DEFAULT '',
    engineer        TEXT NOT NULL DEFAULT '',
    version         TEXT NOT NULL DEFAULT 'Borrador',
    daily_demand    INTEGER NOT NULL DEFAULT 1000,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data            TEXT NOT NULL,
    checksum        TEXT
);

CREATE INDEX IF NOT EXISTS idx_projects_client  ON projects(client);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_name    ON projects(name);

-- ============================================================================
-- AMFE VDA DOCUMENTS
-- ============================================================================

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
    coverage_percent    DOUBLE PRECISION NOT NULL DEFAULT 0,
    start_date          TEXT NOT NULL DEFAULT '',
    last_revision_date  TEXT NOT NULL DEFAULT '',
    revision_level      TEXT NOT NULL DEFAULT 'A',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data                TEXT NOT NULL,
    revisions           TEXT NOT NULL DEFAULT '[]',
    checksum            TEXT
);

CREATE INDEX IF NOT EXISTS idx_amfe_status       ON amfe_documents(status);
CREATE INDEX IF NOT EXISTS idx_amfe_client       ON amfe_documents(client);
CREATE INDEX IF NOT EXISTS idx_amfe_updated      ON amfe_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_amfe_number       ON amfe_documents(amfe_number);
CREATE INDEX IF NOT EXISTS idx_amfe_project_name ON amfe_documents(project_name);

-- ============================================================================
-- AMFE LIBRARY (global operation templates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS amfe_library_operations (
    id            TEXT PRIMARY KEY,
    op_number     TEXT NOT NULL,
    name          TEXT NOT NULL,
    category      TEXT DEFAULT '',
    description   TEXT DEFAULT '',
    tags          TEXT DEFAULT '[]',
    version       INTEGER NOT NULL DEFAULT 1,
    last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data          TEXT NOT NULL,
    search_text   TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_library_category ON amfe_library_operations(category);
CREATE INDEX IF NOT EXISTS idx_library_name     ON amfe_library_operations(name);

-- ============================================================================
-- CONTROL PLAN DOCUMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS cp_documents (
    id                  TEXT PRIMARY KEY,
    project_name        TEXT NOT NULL DEFAULT '',
    control_plan_number TEXT NOT NULL DEFAULT '',
    phase               TEXT NOT NULL DEFAULT 'preLaunch'
                        CHECK(phase IN ('prototype','preLaunch','safeLaunch','production')),
    part_number         TEXT NOT NULL DEFAULT '',
    part_name           TEXT NOT NULL DEFAULT '',
    organization        TEXT NOT NULL DEFAULT '',
    client              TEXT NOT NULL DEFAULT '',
    responsible         TEXT NOT NULL DEFAULT '',
    revision            TEXT NOT NULL DEFAULT '',
    revision_level      TEXT NOT NULL DEFAULT 'A',
    last_revision_at    TEXT DEFAULT '',
    linked_amfe_project TEXT DEFAULT '',
    linked_amfe_id      TEXT REFERENCES amfe_documents(id) ON DELETE SET NULL,
    item_count          INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data                TEXT NOT NULL,
    checksum            TEXT
);

CREATE INDEX IF NOT EXISTS idx_cp_project_name       ON cp_documents(project_name);
CREATE INDEX IF NOT EXISTS idx_cp_client             ON cp_documents(client);
CREATE INDEX IF NOT EXISTS idx_cp_updated            ON cp_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cp_linked_amfe        ON cp_documents(linked_amfe_id);
CREATE INDEX IF NOT EXISTS idx_cp_linked_amfe_project ON cp_documents(linked_amfe_project);

-- ============================================================================
-- HOJAS DE OPERACIONES DOCUMENTS
-- ============================================================================

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
    revision_level      TEXT NOT NULL DEFAULT 'A',
    last_revision_at    TEXT DEFAULT '',
    sheet_count         INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data                TEXT NOT NULL,
    checksum            TEXT
);

CREATE INDEX IF NOT EXISTS idx_ho_client              ON ho_documents(client);
CREATE INDEX IF NOT EXISTS idx_ho_updated             ON ho_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ho_linked_amfe_project ON ho_documents(linked_amfe_project);

-- ============================================================================
-- PFD (Process Flow Diagram) DOCUMENTS
-- ============================================================================

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
    last_revision_at TEXT DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pfd_updated  ON pfd_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pfd_customer ON pfd_documents(customer_name);

-- ============================================================================
-- UNIFIED DRAFTS (auto-save)
-- ============================================================================

CREATE TABLE IF NOT EXISTS drafts (
    id           BIGSERIAL PRIMARY KEY,
    module       TEXT NOT NULL CHECK(module IN ('project','amfe','cp','ho','pfd','solicitud')),
    document_key TEXT NOT NULL,
    data         TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(module, document_key)
);

CREATE INDEX IF NOT EXISTS idx_drafts_module  ON drafts(module);
CREATE INDEX IF NOT EXISTS idx_drafts_updated ON drafts(updated_at DESC);

-- ============================================================================
-- SETTINGS (key-value store)
-- ============================================================================

CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- RECENT PROJECTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS recent_projects (
    id          BIGSERIAL PRIMARY KEY,
    project_id  BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    module      TEXT NOT NULL DEFAULT 'project',
    document_id TEXT,
    name        TEXT NOT NULL,
    path        TEXT DEFAULT '',
    opened_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recent_opened ON recent_projects(opened_at DESC);

-- ============================================================================
-- DOCUMENT REVISIONS (snapshot history)
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_revisions (
    id                    BIGSERIAL PRIMARY KEY,
    module                TEXT NOT NULL CHECK(module IN ('amfe','cp','ho','pfd','solicitud')),
    document_id           TEXT NOT NULL,
    revision_level        TEXT NOT NULL,
    description           TEXT NOT NULL,
    revised_by            TEXT NOT NULL DEFAULT '',
    snapshot_data         TEXT NOT NULL,
    snapshot_checksum     TEXT,
    parent_revision_level TEXT DEFAULT '',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revisions_module_doc ON document_revisions(module, document_id);

-- ============================================================================
-- CROSS-DOCUMENT CHANGE TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS cross_doc_checks (
    id              BIGSERIAL PRIMARY KEY,
    source_module   TEXT NOT NULL,
    source_doc_id   TEXT NOT NULL,
    target_module   TEXT NOT NULL,
    target_doc_id   TEXT NOT NULL,
    source_revision TEXT NOT NULL,
    source_updated  TEXT NOT NULL,
    acknowledged_at TIMESTAMPTZ,
    UNIQUE(source_module, source_doc_id, target_module, target_doc_id)
);

CREATE INDEX IF NOT EXISTS idx_cross_doc_target ON cross_doc_checks(target_module, target_doc_id);

-- ============================================================================
-- SOLICITUDES DE GENERACIÓN DE CÓDIGO
-- ============================================================================

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
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data                TEXT NOT NULL,
    checksum            TEXT,
    server_folder_path  TEXT NOT NULL DEFAULT '',
    attachment_count    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_solicitud_number     ON solicitud_documents(solicitud_number);
CREATE INDEX IF NOT EXISTS idx_solicitud_tipo       ON solicitud_documents(tipo);
CREATE INDEX IF NOT EXISTS idx_solicitud_status     ON solicitud_documents(status);
CREATE INDEX IF NOT EXISTS idx_solicitud_updated    ON solicitud_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_solicitud_solicitante ON solicitud_documents(solicitante);

-- ============================================================================
-- PRODUCT CATALOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
    id          BIGSERIAL PRIMARY KEY,
    codigo      TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    linea_code  TEXT NOT NULL,
    linea_name  TEXT NOT NULL,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(codigo, linea_code)
);

CREATE INDEX IF NOT EXISTS idx_products_codigo     ON products(codigo);
CREATE INDEX IF NOT EXISTS idx_products_linea      ON products(linea_code);
CREATE INDEX IF NOT EXISTS idx_products_active     ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_descripcion ON products(descripcion);

-- ============================================================================
-- CUSTOMER LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_lines (
    id            BIGSERIAL PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    product_count INTEGER NOT NULL DEFAULT 0,
    is_automotive INTEGER NOT NULL DEFAULT 0,
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_lines_code       ON customer_lines(code);
CREATE INDEX IF NOT EXISTS idx_customer_lines_automotive ON customer_lines(is_automotive);

-- ============================================================================
-- PRODUCT FAMILIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_families (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    linea_code  TEXT NOT NULL DEFAULT '',
    linea_name  TEXT NOT NULL DEFAULT '',
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_families_name   ON product_families(name);
CREATE INDEX IF NOT EXISTS idx_families_linea  ON product_families(linea_code);
CREATE INDEX IF NOT EXISTS idx_families_active ON product_families(active);

-- ============================================================================
-- PRODUCT FAMILY MEMBERS (M:N)
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_family_members (
    id         BIGSERIAL PRIMARY KEY,
    family_id  BIGINT NOT NULL REFERENCES product_families(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    is_primary INTEGER NOT NULL DEFAULT 0,
    added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(family_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_pfm_family  ON product_family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_pfm_product ON product_family_members(product_id);

-- ============================================================================
-- PENDING EXPORTS (offline queue — kept for schema compatibility, unused in web)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_exports (
    id             BIGSERIAL PRIMARY KEY,
    module         TEXT NOT NULL,
    document_id    TEXT NOT NULL,
    revision_level TEXT NOT NULL,
    export_format  TEXT NOT NULL,
    filename       TEXT NOT NULL,
    file_data      BYTEA NOT NULL,
    target_dir     TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retry_count    INTEGER NOT NULL DEFAULT 0,
    last_error     TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_exports_module  ON pending_exports(module);
CREATE INDEX IF NOT EXISTS idx_pending_exports_created ON pending_exports(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Simple policy: all authenticated users can read/write all data.
-- For multi-tenant isolation, add user_id columns and per-user RLS policies.
-- TODO: Add user_id columns and per-user RLS if multi-tenant isolation is needed.

ALTER TABLE projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE amfe_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE amfe_library_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ho_documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pfd_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitud_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_lines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_families    ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_revisions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_doc_checks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_version      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_exports     ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access to all tables
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'projects', 'amfe_documents', 'amfe_library_operations',
        'cp_documents', 'ho_documents', 'pfd_documents',
        'drafts', 'settings', 'solicitud_documents',
        'products', 'customer_lines', 'product_families',
        'product_family_members', 'document_revisions',
        'cross_doc_checks', 'recent_projects', 'schema_version',
        'pending_exports'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format(
            'CREATE POLICY IF NOT EXISTS "authenticated_all_%s" ON %I
             FOR ALL TO authenticated USING (true) WITH CHECK (true)',
            tbl, tbl
        );
    END LOOP;
END;
$$;

-- Grant execute on helper functions to authenticated role
GRANT EXECUTE ON FUNCTION apply_params(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql_read(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql_write(text, jsonb) TO authenticated;
