-- ============================================================================
-- Barack Mercosul — Family Documents: master/variant document infrastructure
-- Apply via: supabase db push  OR  Supabase dashboard SQL editor
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. family_documents — Links a document to a family as master or variant
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS family_documents (
    id BIGSERIAL PRIMARY KEY,
    family_id BIGINT NOT NULL REFERENCES product_families(id) ON DELETE CASCADE,
    module TEXT NOT NULL CHECK (module IN ('amfe', 'cp', 'ho', 'pfd')),
    document_id TEXT NOT NULL,
    is_master INTEGER NOT NULL DEFAULT 0,
    source_master_id BIGINT REFERENCES family_documents(id) ON DELETE SET NULL,
    product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(family_id, module, document_id)
);

CREATE INDEX IF NOT EXISTS idx_famdoc_family ON family_documents(family_id);
CREATE INDEX IF NOT EXISTS idx_famdoc_module ON family_documents(module);
CREATE INDEX IF NOT EXISTS idx_famdoc_document ON family_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_famdoc_source_master ON family_documents(source_master_id);

ALTER TABLE family_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "authenticated_all_family_documents" ON family_documents
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. family_document_overrides — Tracks variant changes vs master
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS family_document_overrides (
    id BIGSERIAL PRIMARY KEY,
    family_doc_id BIGINT NOT NULL REFERENCES family_documents(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    override_type TEXT NOT NULL CHECK (override_type IN ('modified', 'added', 'removed', 'rejected')),
    override_data TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_famoverride_doc ON family_document_overrides(family_doc_id);

ALTER TABLE family_document_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "authenticated_all_family_document_overrides" ON family_document_overrides
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. family_change_proposals — Queue of master changes pending per variant
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS family_change_proposals (
    id BIGSERIAL PRIMARY KEY,
    family_id BIGINT NOT NULL REFERENCES product_families(id) ON DELETE CASCADE,
    module TEXT NOT NULL CHECK (module IN ('amfe', 'cp', 'ho', 'pfd')),
    master_doc_id TEXT NOT NULL,
    target_family_doc_id BIGINT NOT NULL REFERENCES family_documents(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL,
    item_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    old_data TEXT,
    new_data TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'auto_applied')),
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_famproposal_family ON family_change_proposals(family_id);
CREATE INDEX IF NOT EXISTS idx_famproposal_target ON family_change_proposals(target_family_doc_id);
CREATE INDEX IF NOT EXISTS idx_famproposal_status ON family_change_proposals(status);

ALTER TABLE family_change_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "authenticated_all_family_change_proposals" ON family_change_proposals
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. ALTER product_family_members — Add variant_label column
-- ---------------------------------------------------------------------------
ALTER TABLE product_family_members ADD COLUMN IF NOT EXISTS variant_label TEXT NOT NULL DEFAULT '';
