-- 007_amfe_change_log: registro de cambios de contenido de un AMFE entre revisiones.
-- Cada edicion guardada (diff-on-save) agrega entradas; al oficializar una revision
-- se marcan como consumidas (consumed_in_rev). Alimenta el resumen de la caratula.
-- Aplicada en Supabase el 2026-07-03 via MCP apply_migration.

CREATE TABLE IF NOT EXISTS amfe_change_log (
    id              BIGSERIAL PRIMARY KEY,
    document_id     TEXT NOT NULL REFERENCES amfe_documents(id) ON DELETE CASCADE,
    op_number       TEXT NOT NULL DEFAULT '',
    scope           TEXT NOT NULL CHECK (scope IN ('header','operation','workElement','function','failure','cause','document')),
    change_type     TEXT NOT NULL CHECK (change_type IN ('added','removed','modified')),
    item_label      TEXT NOT NULL DEFAULT '',
    field           TEXT NOT NULL DEFAULT '',
    old_value       TEXT NOT NULL DEFAULT '',
    new_value       TEXT NOT NULL DEFAULT '',
    summary         TEXT NOT NULL,
    changed_by      TEXT NOT NULL DEFAULT '',
    changed_by_type TEXT NOT NULL DEFAULT 'user',
    consumed_in_rev TEXT DEFAULT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_amfe_change_log_doc ON amfe_change_log(document_id, consumed_in_rev);

ALTER TABLE amfe_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_amfe_change_log" ON amfe_change_log
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
