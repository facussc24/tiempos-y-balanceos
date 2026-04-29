-- ============================================================================
-- BOM (Bill of Materials / Lista de Materiales) — migration 005
-- ============================================================================
-- Almacena fichas BOM por part number, agrupadas por categoria de material
-- (PLASTICO, FUNDA, SUSTRATO, ADHESIVO_RETICULANTE, ETIQUETA, CARTON, PRIMER, FILM).
-- Cada fila = 1 ficha (1 PN). El JSONB en `data` contiene los grupos e items.
-- Patron analogo a amfe_documents/cp_documents/ho_documents.
-- ============================================================================

CREATE TABLE IF NOT EXISTS bom_documents (
    id                  TEXT PRIMARY KEY,
    bom_number          TEXT NOT NULL UNIQUE,
    part_number         TEXT NOT NULL DEFAULT '',
    descripcion         TEXT NOT NULL DEFAULT '',
    cliente             TEXT NOT NULL DEFAULT '',
    proyecto            TEXT NOT NULL DEFAULT '',
    familia             TEXT NOT NULL DEFAULT '',
    family_id           BIGINT REFERENCES product_families(id) ON DELETE SET NULL,
    revision            TEXT NOT NULL DEFAULT 'A',
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK(status IN ('draft','inReview','approved','archived')),
    item_count          INTEGER NOT NULL DEFAULT 0,
    group_count         INTEGER NOT NULL DEFAULT 0,
    fecha_emision       TEXT NOT NULL DEFAULT '',
    elaborado_por       TEXT NOT NULL DEFAULT '',
    aprobado_por        TEXT NOT NULL DEFAULT '',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          TEXT NOT NULL DEFAULT '',
    updated_by          TEXT NOT NULL DEFAULT '',
    data                TEXT NOT NULL,
    checksum            TEXT
);

CREATE INDEX IF NOT EXISTS idx_bom_status      ON bom_documents(status);
CREATE INDEX IF NOT EXISTS idx_bom_cliente     ON bom_documents(cliente);
CREATE INDEX IF NOT EXISTS idx_bom_familia     ON bom_documents(familia);
CREATE INDEX IF NOT EXISTS idx_bom_part_number ON bom_documents(part_number);
CREATE INDEX IF NOT EXISTS idx_bom_updated     ON bom_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bom_family_id   ON bom_documents(family_id);
