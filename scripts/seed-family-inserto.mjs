#!/usr/bin/env node
/**
 * Seed: Product Family "Patagonia Inserto" with master + variant documents
 *
 * Creates:
 *   1. A product family "Patagonia Inserto" in product_families
 *   2. Links existing Insert documents (AMFE, CP, PFD, HO) as masters in family_documents
 *   3. Clones each master document to create variant "L0" with fresh UUIDs
 *   4. Inserts cloned variants into their respective tables
 *   5. Links variant documents in family_documents with source_master_id
 *
 * Prerequisites: Run the main seeds first so that AMFE/CP/PFD/HO documents for
 *                "Insert" / "Inserto" exist in Supabase.
 *
 * Usage: node scripts/seed-family-inserto.mjs
 */

import { initSupabase, execSql, selectSql, close } from './supabaseHelper.mjs';
import { randomUUID, createHash } from 'crypto';

// ─── Config ──────────────────────────────────────────────────────────────────

const FAMILY_NAME = 'Patagonia Inserto';
const FAMILY_LINE = 'VWA';
const FAMILY_DESCRIPTION = 'Familia de insertos para plataforma Patagonia VW';
const VARIANT_LABEL = 'L0';

function sha256(str) {
    return createHash('sha256').update(str).digest('hex');
}

// ─── UUID Regeneration (port of documentInheritance.ts) ──────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Recursively walks an object/array and replaces every string field named `id`
 * whose value matches UUID v4 pattern with a fresh UUID.
 * Returns { result, idMap } where idMap is old-UUID -> new-UUID.
 */
function regenerateUuids(obj) {
    const idMap = new Map();

    function walk(value, key) {
        if (value === null || value === undefined) return value;
        if (Array.isArray(value)) return value.map(item => walk(item));
        if (typeof value === 'object') {
            const out = {};
            for (const [k, v] of Object.entries(value)) {
                out[k] = walk(v, k);
            }
            return out;
        }
        // Leaf: only replace strings named 'id' that look like UUIDs
        if (typeof value === 'string' && key === 'id' && UUID_REGEX.test(value)) {
            if (!idMap.has(value)) {
                idMap.set(value, randomUUID());
            }
            return idMap.get(value);
        }
        return value;
    }

    const result = walk(obj);
    return { result, idMap };
}

// ─── Per-Module Clone Helpers (port of documentInheritance.ts) ───────────────

function cloneAmfeDocument(doc, meta, variantLabel) {
    const cloned = JSON.parse(JSON.stringify(doc));
    const { result } = regenerateUuids(cloned);
    const newDoc = result;

    // Append variant label to header fields
    newDoc.header.amfeNumber = `${meta.amfeNumber} [${variantLabel}]`;
    newDoc.header.subject = `${doc.header.subject || meta.projectName} [${variantLabel}]`;

    const newId = randomUUID();
    const projectName = `${meta.projectName} [${variantLabel}]`;
    return { newId, newDoc, projectName };
}

function clonePfdDocument(doc, variantLabel) {
    const cloned = JSON.parse(JSON.stringify(doc));
    const { result } = regenerateUuids(cloned);
    const newDoc = result;

    const newId = randomUUID();
    newDoc.id = newId;
    newDoc.header.partName = `${doc.header.partName} [${variantLabel}]`;
    newDoc.header.documentNumber = doc.header.documentNumber
        ? `${doc.header.documentNumber}-${variantLabel}`
        : '';
    newDoc.createdAt = new Date().toISOString();
    newDoc.updatedAt = new Date().toISOString();

    return { newId, newDoc };
}

function cloneCpDocument(doc, originalProjectName, variantLabel) {
    const cloned = JSON.parse(JSON.stringify(doc));
    const { result } = regenerateUuids(cloned);
    const newDoc = result;

    newDoc.header.controlPlanNumber = doc.header.controlPlanNumber
        ? `${doc.header.controlPlanNumber} [${variantLabel}]`
        : '';
    newDoc.header.partName = `${doc.header.partName} [${variantLabel}]`;

    const newId = randomUUID();
    const projectName = `${originalProjectName} [${variantLabel}]`;
    return { newId, newDoc, projectName };
}

function cloneHoDocument(doc, variantLabel) {
    const cloned = JSON.parse(JSON.stringify(doc));
    const { result } = regenerateUuids(cloned);
    const newDoc = result;

    newDoc.header.partDescription = `${doc.header.partDescription} [${variantLabel}]`;

    const newId = randomUUID();
    return { newId, newDoc };
}

// ─── Save Helpers (match repository INSERT OR REPLACE patterns) ──────────────

/** Count AMFE causes and AP levels */
function computeAmfeStats(doc) {
    let operationCount = 0, causeCount = 0, apHCount = 0, apMCount = 0;
    let covered = 0;
    operationCount = (doc.operations || []).length;
    for (const op of doc.operations || []) {
        for (const we of op.workElements || []) {
            for (const func of we.functions || []) {
                for (const fail of func.failures || []) {
                    for (const cause of fail.causes || []) {
                        causeCount++;
                        if (cause.ap === 'H') apHCount++;
                        if (cause.ap === 'M') apMCount++;
                        if ((cause.preventionControl && cause.preventionControl !== '-' && cause.preventionControl !== 'N/A') ||
                            (cause.detectionControl && cause.detectionControl !== '-' && cause.detectionControl !== 'N/A')) {
                            covered++;
                        }
                    }
                }
            }
        }
    }
    const coveragePercent = causeCount > 0 ? Math.round((covered / causeCount) * 10000) / 100 : 0;
    return { operationCount, causeCount, apHCount, apMCount, coveragePercent };
}

async function saveAmfeVariant(id, amfeNumber, projectName, doc) {
    const data = JSON.stringify(doc);
    const checksum = sha256(data);
    const stats = computeAmfeStats(doc);
    const h = doc.header;

    await execSql(
        `INSERT INTO amfe_documents
         (id, amfe_number, project_name, subject, client, part_number, responsible,
          organization, status, operation_count, cause_count, ap_h_count, ap_m_count,
          coverage_percent, start_date, last_revision_date, created_at, updated_at,
          data, revisions, checksum)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
          amfe_number = EXCLUDED.amfe_number,
          project_name = EXCLUDED.project_name,
          subject = EXCLUDED.subject,
          client = EXCLUDED.client,
          part_number = EXCLUDED.part_number,
          responsible = EXCLUDED.responsible,
          organization = EXCLUDED.organization,
          status = EXCLUDED.status,
          operation_count = EXCLUDED.operation_count,
          cause_count = EXCLUDED.cause_count,
          ap_h_count = EXCLUDED.ap_h_count,
          ap_m_count = EXCLUDED.ap_m_count,
          coverage_percent = EXCLUDED.coverage_percent,
          start_date = EXCLUDED.start_date,
          last_revision_date = EXCLUDED.last_revision_date,
          updated_at = EXCLUDED.updated_at,
          data = EXCLUDED.data,
          revisions = EXCLUDED.revisions,
          checksum = EXCLUDED.checksum`,
        [
            id, amfeNumber, projectName,
            h.subject || '', h.client || '', h.partNumber || '',
            h.responsible || '', h.organization || '', 'draft',
            stats.operationCount, stats.causeCount, stats.apHCount, stats.apMCount,
            stats.coveragePercent, h.startDate || '', h.revDate || '',
            data, '[]', checksum,
        ]
    );
}

async function saveCpVariant(id, projectName, doc) {
    const data = JSON.stringify(doc);
    const checksum = sha256(data);
    const h = doc.header;

    await execSql(
        `INSERT INTO cp_documents
         (id, project_name, control_plan_number, phase, part_number, part_name,
          organization, client, responsible, revision, linked_amfe_project,
          linked_amfe_id, item_count, created_at, updated_at, data, checksum)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NOW(), NOW(), ?, ?)
         ON CONFLICT (id) DO UPDATE SET
          project_name = EXCLUDED.project_name,
          control_plan_number = EXCLUDED.control_plan_number,
          phase = EXCLUDED.phase,
          part_number = EXCLUDED.part_number,
          part_name = EXCLUDED.part_name,
          organization = EXCLUDED.organization,
          client = EXCLUDED.client,
          responsible = EXCLUDED.responsible,
          revision = EXCLUDED.revision,
          linked_amfe_project = EXCLUDED.linked_amfe_project,
          item_count = EXCLUDED.item_count,
          updated_at = EXCLUDED.updated_at,
          data = EXCLUDED.data,
          checksum = EXCLUDED.checksum`,
        [
            id, projectName, h.controlPlanNumber || '', h.phase || 'production',
            h.partNumber || '', h.partName || '', h.organization || '',
            h.client || '', h.responsible || '', h.revision || '',
            h.linkedAmfeProject || '', (doc.items || []).length,
            data, checksum,
        ]
    );
}

async function savePfdVariant(id, doc) {
    const data = JSON.stringify(doc);
    const checksum = sha256(data);
    const h = doc.header;
    // client: use explicit header field, fall back to customerName
    const client = h.client || h.customerName || '';

    await execSql(
        `INSERT INTO pfd_documents
         (id, part_number, part_name, document_number, revision_level,
          revision_date, customer_name, client, step_count, created_at, updated_at,
          data, checksum)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?)
         ON CONFLICT (id) DO UPDATE SET
          part_number = EXCLUDED.part_number,
          part_name = EXCLUDED.part_name,
          document_number = EXCLUDED.document_number,
          revision_level = EXCLUDED.revision_level,
          revision_date = EXCLUDED.revision_date,
          customer_name = EXCLUDED.customer_name,
          client = EXCLUDED.client,
          step_count = EXCLUDED.step_count,
          updated_at = EXCLUDED.updated_at,
          data = EXCLUDED.data,
          checksum = EXCLUDED.checksum`,
        [
            id, h.partNumber || '', h.partName || '', h.documentNumber || '',
            h.revisionLevel || 'A', h.revisionDate || '',
            h.customerName || '', client, (doc.steps || []).length,
            data, checksum,
        ]
    );
}

async function saveHoVariant(id, doc) {
    const data = JSON.stringify(doc);
    const checksum = sha256(data);
    const h = doc.header;

    await execSql(
        `INSERT INTO ho_documents
         (id, form_number, organization, client, part_number, part_description,
          linked_amfe_project, linked_cp_project, linked_amfe_id, linked_cp_id,
          sheet_count, created_at, updated_at, data, checksum)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NOW(), NOW(), ?, ?)
         ON CONFLICT (id) DO UPDATE SET
          form_number = EXCLUDED.form_number,
          organization = EXCLUDED.organization,
          client = EXCLUDED.client,
          part_number = EXCLUDED.part_number,
          part_description = EXCLUDED.part_description,
          linked_amfe_project = EXCLUDED.linked_amfe_project,
          linked_cp_project = EXCLUDED.linked_cp_project,
          sheet_count = EXCLUDED.sheet_count,
          updated_at = EXCLUDED.updated_at,
          data = EXCLUDED.data,
          checksum = EXCLUDED.checksum`,
        [
            id, h.formNumber || 'I-IN-002.4-R01', h.organization || '',
            h.client || '', h.partNumber || '', h.partDescription || '',
            h.linkedAmfeProject || '', h.linkedCpProject || '',
            (doc.sheets || []).length,
            data, checksum,
        ]
    );
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('================================================================');
    console.log('  SEED: Product Family "Patagonia Inserto" (master + variant L0)');
    console.log('================================================================\n');

    // ─── Step 0: Authenticate ────────────────────────────────────────────────
    console.log('Step 0: Authenticating...');
    await initSupabase();

    // ─── Step 1: Find existing Insert documents ──────────────────────────────
    console.log('\nStep 1: Finding existing Insert documents...');

    // AMFE
    const amfeDocs = await selectSql(
        `SELECT id, amfe_number, project_name, operation_count, data
         FROM amfe_documents WHERE UPPER(project_name) LIKE '%INSERTO%' ORDER BY operation_count DESC LIMIT 1`
    );
    if (amfeDocs.length === 0) {
        console.error('  FAILED: No AMFE document found matching "Insert"');
        process.exit(1);
    }
    const masterAmfe = amfeDocs[0];
    console.log(`  AMFE: ${masterAmfe.id} (${masterAmfe.project_name}, ${masterAmfe.operation_count} ops)`);

    // CP
    const cpDocs = await selectSql(
        `SELECT id, project_name, data
         FROM cp_documents WHERE UPPER(project_name) LIKE '%INSERTO%' ORDER BY item_count DESC LIMIT 1`
    );
    if (cpDocs.length === 0) {
        console.error('  FAILED: No CP document found matching "Insert"');
        process.exit(1);
    }
    const masterCp = cpDocs[0];
    console.log(`  CP:   ${masterCp.id} (${masterCp.project_name})`);

    // PFD
    const pfdDocs = await selectSql(
        `SELECT id, part_name, data
         FROM pfd_documents WHERE part_name LIKE '%Insert%' LIMIT 1`
    );
    if (pfdDocs.length === 0) {
        console.error('  FAILED: No PFD document found matching "Insert"');
        process.exit(1);
    }
    const masterPfd = pfdDocs[0];
    console.log(`  PFD:  ${masterPfd.id} (${masterPfd.part_name})`);

    // HO
    const hoDocs = await selectSql(
        `SELECT id, part_description, data
         FROM ho_documents WHERE part_description LIKE '%Insert%' LIMIT 1`
    );
    if (hoDocs.length === 0) {
        console.error('  FAILED: No HO document found matching "Insert"');
        process.exit(1);
    }
    const masterHo = hoDocs[0];
    console.log(`  HO:   ${masterHo.id} (${masterHo.part_description})`);

    // ─── Step 2: Create the product family ───────────────────────────────────
    console.log('\nStep 2: Creating product family...');

    // Check if family already exists
    const existingFamilies = await selectSql(
        `SELECT id FROM product_families WHERE name = ?`, [FAMILY_NAME]
    );

    let familyId;
    if (existingFamilies.length > 0) {
        familyId = existingFamilies[0].id;
        console.log(`  Family "${FAMILY_NAME}" already exists (id=${familyId}), reusing.`);
    } else {
        const result = await execSql(
            `INSERT INTO product_families (name, description, linea_code, linea_name)
             VALUES (?, ?, ?, ?) RETURNING id`,
            [FAMILY_NAME, FAMILY_DESCRIPTION, FAMILY_LINE, 'VWA']
        );
        familyId = result.lastInsertId;
        console.log(`  Created family "${FAMILY_NAME}" (id=${familyId})`);
    }

    // ─── Step 3: Link master documents to the family ─────────────────────────
    console.log('\nStep 3: Linking master documents to family...');

    const masterDocIds = {};

    for (const { module, documentId, label } of [
        { module: 'amfe', documentId: masterAmfe.id, label: 'AMFE' },
        { module: 'cp', documentId: masterCp.id, label: 'CP' },
        { module: 'pfd', documentId: masterPfd.id, label: 'PFD' },
        { module: 'ho', documentId: masterHo.id, label: 'HO' },
    ]) {
        // Check if already linked
        const existing = await selectSql(
            `SELECT id FROM family_documents WHERE family_id = ? AND module = ? AND document_id = ?`,
            [familyId, module, documentId]
        );

        if (existing.length > 0) {
            masterDocIds[module] = existing[0].id;
            console.log(`  ${label}: Already linked as master (family_doc_id=${existing[0].id})`);
        } else {
            const result = await execSql(
                `INSERT INTO family_documents (family_id, module, document_id, is_master, source_master_id, product_id)
                 VALUES (?, ?, ?, 1, NULL, NULL) RETURNING id`,
                [familyId, module, documentId]
            );
            masterDocIds[module] = result.lastInsertId;
            console.log(`  ${label}: Linked as master (family_doc_id=${result.lastInsertId})`);
        }
    }

    // ─── Step 4: Clone master documents to create variant "L0" ───────────────
    console.log(`\nStep 4: Creating variant "${VARIANT_LABEL}" by cloning masters...`);

    // Parse the master document data
    const amfeDocData = JSON.parse(masterAmfe.data);
    const cpDocData = JSON.parse(masterCp.data);
    const pfdDocData = JSON.parse(masterPfd.data);
    const hoDocData = JSON.parse(masterHo.data);

    // --- Clone AMFE ---
    console.log('\n  Cloning AMFE...');
    const { newId: variantAmfeId, newDoc: variantAmfeDoc, projectName: variantAmfeProject } =
        cloneAmfeDocument(amfeDocData, {
            projectName: masterAmfe.project_name,
            amfeNumber: masterAmfe.amfe_number,
        }, VARIANT_LABEL);

    await saveAmfeVariant(variantAmfeId, `${masterAmfe.amfe_number} [${VARIANT_LABEL}]`, variantAmfeProject, variantAmfeDoc);
    console.log(`    Saved: id=${variantAmfeId}, project="${variantAmfeProject}"`);
    console.log(`    Operations: ${(variantAmfeDoc.operations || []).length}`);

    // --- Clone CP ---
    console.log('  Cloning CP...');
    const cpOrigProjectName = masterCp.project_name;
    const { newId: variantCpId, newDoc: variantCpDoc, projectName: variantCpProject } =
        cloneCpDocument(cpDocData, cpOrigProjectName, VARIANT_LABEL);

    await saveCpVariant(variantCpId, variantCpProject, variantCpDoc);
    console.log(`    Saved: id=${variantCpId}, project="${variantCpProject}"`);
    console.log(`    Items: ${(variantCpDoc.items || []).length}`);

    // --- Clone PFD ---
    console.log('  Cloning PFD...');
    const { newId: variantPfdId, newDoc: variantPfdDoc } =
        clonePfdDocument(pfdDocData, VARIANT_LABEL);

    await savePfdVariant(variantPfdId, variantPfdDoc);
    console.log(`    Saved: id=${variantPfdId}, part="${variantPfdDoc.header.partName}"`);
    console.log(`    Steps: ${(variantPfdDoc.steps || []).length}`);

    // --- Clone HO ---
    console.log('  Cloning HO...');
    const { newId: variantHoId, newDoc: variantHoDoc } =
        cloneHoDocument(hoDocData, VARIANT_LABEL);

    await saveHoVariant(variantHoId, variantHoDoc);
    console.log(`    Saved: id=${variantHoId}, desc="${variantHoDoc.header.partDescription}"`);
    console.log(`    Sheets: ${(variantHoDoc.sheets || []).length}`);

    // ─── Step 5: Link variant documents to family ────────────────────────────
    console.log('\nStep 5: Linking variant documents to family...');

    const variantDocIds = {};

    for (const { module, documentId, sourceMasterId, label } of [
        { module: 'amfe', documentId: variantAmfeId, sourceMasterId: masterDocIds.amfe, label: 'AMFE' },
        { module: 'cp', documentId: variantCpId, sourceMasterId: masterDocIds.cp, label: 'CP' },
        { module: 'pfd', documentId: variantPfdId, sourceMasterId: masterDocIds.pfd, label: 'PFD' },
        { module: 'ho', documentId: variantHoId, sourceMasterId: masterDocIds.ho, label: 'HO' },
    ]) {
        // Check if already linked
        const existing = await selectSql(
            `SELECT id FROM family_documents WHERE family_id = ? AND module = ? AND document_id = ?`,
            [familyId, module, documentId]
        );

        if (existing.length > 0) {
            variantDocIds[module] = existing[0].id;
            console.log(`  ${label}: Already linked as variant (family_doc_id=${existing[0].id})`);
        } else {
            const result = await execSql(
                `INSERT INTO family_documents (family_id, module, document_id, is_master, source_master_id, product_id)
                 VALUES (?, ?, ?, 0, ?, NULL) RETURNING id`,
                [familyId, module, documentId, sourceMasterId]
            );
            variantDocIds[module] = result.lastInsertId;
            console.log(`  ${label}: Linked as variant (family_doc_id=${result.lastInsertId}, source_master=${sourceMasterId})`);
        }
    }

    // ─── Step 6: Verify ──────────────────────────────────────────────────────
    console.log('\nStep 6: Verifying...');

    const family = await selectSql(
        `SELECT * FROM product_families WHERE id = ?`, [familyId]
    );
    console.log(`  Family: ${JSON.stringify(family[0], null, 2)}`);

    const familyDocs = await selectSql(
        `SELECT id, module, document_id, is_master, source_master_id
         FROM family_documents WHERE family_id = ? ORDER BY module, is_master DESC`,
        [familyId]
    );
    console.log(`\n  Family documents (${familyDocs.length} total):`);
    for (const fd of familyDocs) {
        const role = fd.is_master ? 'MASTER' : 'VARIANT';
        const source = fd.source_master_id ? ` (from master fd_id=${fd.source_master_id})` : '';
        console.log(`    [${fd.module.toUpperCase().padEnd(4)}] ${role.padEnd(7)} doc=${fd.document_id}${source}`);
    }

    // Verify variant documents exist in their tables
    const varAmfe = await selectSql(`SELECT id, project_name FROM amfe_documents WHERE id = ?`, [variantAmfeId]);
    const varCp = await selectSql(`SELECT id, project_name FROM cp_documents WHERE id = ?`, [variantCpId]);
    const varPfd = await selectSql(`SELECT id, part_name FROM pfd_documents WHERE id = ?`, [variantPfdId]);
    const varHo = await selectSql(`SELECT id, part_description FROM ho_documents WHERE id = ?`, [variantHoId]);

    console.log(`\n  Variant documents in their tables:`);
    console.log(`    AMFE: ${varAmfe.length > 0 ? varAmfe[0].project_name : 'NOT FOUND'}`);
    console.log(`    CP:   ${varCp.length > 0 ? varCp[0].project_name : 'NOT FOUND'}`);
    console.log(`    PFD:  ${varPfd.length > 0 ? varPfd[0].part_name : 'NOT FOUND'}`);
    console.log(`    HO:   ${varHo.length > 0 ? varHo[0].part_description : 'NOT FOUND'}`);

    // ─── Summary ─────────────────────────────────────────────────────────────
    console.log('\n================================================================');
    console.log('  SEED COMPLETE');
    console.log('================================================================');
    console.log(`  Family:    "${FAMILY_NAME}" (id=${familyId})`);
    console.log(`  Line:      ${FAMILY_LINE}`);
    console.log(`  Masters:   4 documents (AMFE, CP, PFD, HO)`);
    console.log(`  Variant:   "${VARIANT_LABEL}" - 4 cloned documents`);
    console.log(`    AMFE:    ${variantAmfeId}`);
    console.log(`    CP:      ${variantCpId}`);
    console.log(`    PFD:     ${variantPfdId}`);
    console.log(`    HO:      ${variantHoId}`);
    console.log('================================================================');

    close();
}

main().catch(err => {
    console.error('\nSEED FAILED:', err);
    process.exit(1);
});
