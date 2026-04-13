-- ============================================================================
-- Migration 004: flowchart_documents
-- ============================================================================
-- Creates the table used by the new Flowchart module (modules/flowchart/*).
-- This replaces the legacy PFD module (modules/pfd/*) which used pfd_documents.
--
-- The Flowchart module stores its static JSON document in the `data` column.
-- `linked_amfe_project` is the unique key used by the app to load by AMFE
-- project (e.g. "VWA/PATAGONIA/TOP_ROLL").
--
-- Applied as part of the PFD -> Flowchart migration (see
-- scripts/migratePfdToFlowchart.mjs and archive/pfd-legacy/).
-- ============================================================================

CREATE TABLE IF NOT EXISTS flowchart_documents (
    id                  TEXT PRIMARY KEY,
    linked_amfe_project TEXT NOT NULL UNIQUE,
    data                JSONB NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flowchart_updated ON flowchart_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_flowchart_project ON flowchart_documents(linked_amfe_project);

-- Row Level Security — allow all authenticated users full access (matches
-- the pattern used by amfe_documents, cp_documents, etc.).
ALTER TABLE flowchart_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'flowchart_documents'
          AND policyname = 'authenticated_all_flowchart_documents'
    ) THEN
        CREATE POLICY "authenticated_all_flowchart_documents"
            ON flowchart_documents
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END;
$$;

-- Grant access (harmless if already granted)
GRANT SELECT, INSERT, UPDATE, DELETE ON flowchart_documents TO authenticated;
