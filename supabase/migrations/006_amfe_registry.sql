-- 006_amfe_registry: Catalogo maestro de AMFEs (espejo del Listado Maestro del SGC).
-- Una fila por AMFE, este o no cargado su contenido en amfe_documents.
-- document_id NULL = solo metadata (contenido vive unicamente en el servidor Y:).
-- Aplicada en Supabase el 2026-07-03 via MCP apply_migration.

CREATE TABLE IF NOT EXISTS amfe_registry (
    id               TEXT PRIMARY KEY,
    amfe_code        TEXT NOT NULL UNIQUE,
    tipo             TEXT NOT NULL DEFAULT 'proceso' CHECK (tipo IN ('proceso','maestro','diseno')),
    producto         TEXT NOT NULL DEFAULT '',
    part_number      TEXT NOT NULL DEFAULT '',
    cliente          TEXT NOT NULL DEFAULT '',
    proyecto         TEXT NOT NULL DEFAULT '',
    planta           TEXT NOT NULL DEFAULT '',
    estado           TEXT NOT NULL DEFAULT 'Borrador'
                     CHECK (estado IN ('Borrador','En revision','Liberado','Obsoleto')),
    propietario      TEXT NOT NULL DEFAULT '',
    equipo           TEXT NOT NULL DEFAULT '',
    fecha_creacion   TEXT NOT NULL DEFAULT '',
    rev_actual       TEXT NOT NULL DEFAULT 'A',
    fecha_ultima_rev TEXT NOT NULL DEFAULT '',
    proxima_revision TEXT NOT NULL DEFAULT '',
    server_path      TEXT NOT NULL DEFAULT '',
    document_id      TEXT REFERENCES amfe_documents(id) ON DELETE SET NULL,
    historial        TEXT NOT NULL DEFAULT '[]',
    notas            TEXT NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       TEXT NOT NULL DEFAULT '',
    updated_by       TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_amfe_registry_estado ON amfe_registry(estado);
CREATE INDEX IF NOT EXISTS idx_amfe_registry_doc    ON amfe_registry(document_id);

ALTER TABLE amfe_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_amfe_registry" ON amfe_registry
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
