# Audit Layer 2C: Impact Map for CP Frequency Modifications

**Date**: 2026-03-21
**Scope**: Complete impact analysis of what changes are needed if Control Plan `sampleFrequency` values are modified.
**Source data**: Layer 1A (frequency inventory), Layer 1D (module impact analysis), source code review of 28+ files.
**Status**: READ-ONLY analysis -- no data or code was modified.

---

## 1. Change Scope Summary

### Is changing frequencies a single-table operation?

**Yes.** The `sampleFrequency` field exists as a string inside the JSON blob stored in `cp_documents.data`. There is no separate `control_plan_items` table and no dedicated database column for frequency. The complete path is:

```
cp_documents.data (TEXT) -> JSON parse -> items[N].sampleFrequency (string)
```

### What downstream systems are affected?

| System | Affected? | Nature of Impact | Automatic? |
|--------|-----------|------------------|------------|
| **HO quality checks** | YES | Snapshot copy in `ho_documents.data -> sheets[].qualityChecks[].frequency` | NO -- must regenerate or manually update |
| **Family variant CPs** | YES | Same field propagated via `changePropagation.ts` | YES -- auto-applied if no override; pending proposal if override exists |
| **Family variant HOs** | YES | Each variant HO holds its own stale snapshot | NO -- each must be regenerated separately |
| **AMFE documents** | NO | AMFE has no frequency field in its data model | N/A |
| **PFD documents** | NO | PFD has no frequency field in its data model | N/A |
| **CP cross-validations V5, V7** | YES | Validation rules check frequency text patterns | Automatic on next validation run |
| **CP sync engine** | NO | Sync engine suggests frequency changes but does not store or validate them | N/A |
| **Cross-doc alerts** | YES | Generic alert fires when CP revision changes | Automatic |
| **CP Excel export** | YES | Exports current `sampleFrequency` value from JSON | Automatic (reads current data) |
| **CP PDF export** | YES | Exports current `sampleFrequency` value from JSON | Automatic (reads current data) |
| **HO Excel export** | YES | Exports `qc.frequency` from HO snapshot (may be stale) | Shows whatever is in HO data |
| **HO PDF export** | YES | Same as HO Excel -- exports HO snapshot | Shows whatever is in HO data |

---

## 2. Detailed Change Plan (If Frequencies Are Modified)

### Step 1: Update `cp_documents.data` in Supabase

The frequency lives inside the JSON blob. To modify it:

1. Query the document: `SELECT id, data FROM cp_documents WHERE id = '<doc_id>'`
2. Parse the JSON: `JSON.parse(data)` yields a `ControlPlanDocument` object
3. Locate target items in `document.items[]` by `id`, `processStepNumber`, or `processDescription`
4. Modify `item.sampleFrequency` to the new value
5. Re-serialize: `JSON.stringify(document)`
6. Update the row: `UPDATE cp_documents SET data = '<new_json>', updated_at = NOW() WHERE id = '<doc_id>'`

**Important**: The `revision` field in the CP header (`cp_documents.revision`) should be bumped if this is a formal revision. If it is a data cleanup/normalization, it may be acceptable to update without revising.

### Step 2: How to execute the update

Three options exist (evaluated in Section 5 below):

- **Option A**: Direct SQL UPDATE with JSON manipulation in Supabase
- **Option B**: Script that loads documents through the app's repository layer (`cpRepository.ts`), modifies, and saves back
- **Option C**: Manual edits through the app UI (ControlPlanTable)

### Step 3: Handle HO snapshot copies

After updating CP frequencies, every linked HO document will have stale `frequency` values in its quality checks. The remediation options are:

1. **Regenerate HO from CP** (via `generateHoFromAmfeAndCp()` in `hojaOperacionesGenerator.ts`): This regenerates the entire HO, wiping any manual edits to steps, visual aids, PPE, etc. Only safe if the HO has not been manually customized beyond initial generation.

2. **Surgical update of HO quality checks**: Load the HO document, find quality checks with matching `cpItemId`, update their `frequency` field to match the new CP `sampleFrequency`, and save. This preserves all other HO data. This requires a custom script.

3. **Do nothing**: Leave the HO as-is. The cross-doc alert system will notify users when they open the HO that the upstream CP has changed. Users can then manually update. This is the IATF 16949 compliant approach (human review required).

### Step 4: Family inheritance -- masters vs variants

The family system has two levels to consider:

**Master CPs (is_master = true):**
- Update the master CP frequency as described in Steps 1-2.
- The `changePropagation.ts` engine will automatically detect the change when the master is saved.
- The `serializeCpItem()` function in `overrideTracker.ts` (line 161-168) **includes** `sampleFrequency` in the comparable fields (it only excludes `id`, `autoFilledFields`, `amfeAp`, `amfeSeverity`, `operationCategory`, `amfeCauseIds`, `amfeFailureId`, `amfeFailureIds`).

**Variant CPs:**
- **If the variant has NO override on that item**: The change proposal gets status `auto_applied` -- the frequency flows through automatically.
- **If the variant HAS an override on that item**: The change proposal gets status `pending` -- a human must accept/reject via the `ChangeProposalPanel` UI.
- **Warning**: If you bypass the app and update via direct SQL, the change propagation engine will NOT fire (it is triggered by the app's save flow in `triggerChangePropagation()`). You would need to either:
  - Run the propagation manually, or
  - Update all variant CPs directly as well.

**Variant HOs:**
- Each variant family member has its own HO document with its own snapshot.
- There is NO automatic propagation from master HO to variant HO for frequency.
- Each variant HO must be handled separately (same options as Step 3).

---

## 3. File/Table Impact Matrix

### Database Tables

| Table | Column | Needs Update? | How | Automated? |
|-------|--------|---------------|-----|------------|
| `cp_documents` | `data` (JSON) | **YES** | Modify `items[].sampleFrequency` inside JSON blob | Manual or script |
| `ho_documents` | `data` (JSON) | **YES** (stale copies) | Modify `sheets[].qualityChecks[].frequency` inside JSON blob, or regenerate | Manual, script, or regenerate |
| `amfe_documents` | `data` (JSON) | NO | No frequency field exists | N/A |
| `pfd_documents` | `data` (JSON) | NO | No frequency field exists | N/A |
| `family_document_overrides` | all | MAYBE | If variant CP frequencies are updated, override tracking will detect the change next time the variant is saved | Automatic on next variant save |
| `family_change_proposals` | all | MAYBE | New proposals created if master CP is saved through the app | Automatic via `changePropagation.ts` |
| `cross_doc_checks` | all | MAYBE | Alert created when CP revision changes | Automatic via `crossDocumentAlerts.ts` |
| `document_revisions` | all | MAYBE | New revision recorded if CP is formally revised | Automatic on save through app |

### Source Files (read frequency, validate, or export)

| File | Path | Role | Needs Code Change? |
|------|------|------|-------------------|
| `controlPlanTypes.ts` | `modules/controlPlan/` | Type definition for `sampleFrequency` | NO |
| `controlPlanDefaults.ts` | `modules/controlPlan/` | Auto-fill rules (AP + severity -> frequency) | Only if the default rules change |
| `controlPlanGenerator.ts` | `modules/controlPlan/` | Generates CP from AMFE (uses defaults) | NO |
| `controlPlanTemplates.ts` | `modules/controlPlan/` | Pre-built template frequencies | Only if templates need normalization |
| `controlPlanPatagoniaTemplate.ts` | `modules/controlPlan/` | Manual template items for Insert | Only if template needs normalization |
| `ControlPlanTable.tsx` | `modules/controlPlan/` | UI table -- renders sampleFrequency | NO |
| `controlPlanExcelExport.ts` | `modules/controlPlan/` | Excel export -- writes sampleFrequency | NO |
| `controlPlanPdfExport.ts` | `modules/controlPlan/` | PDF export -- renders sampleFrequency | NO |
| `cpCrossValidation.ts` | `modules/controlPlan/` | V5 (Poka-Yoke) and V7 (sampling consistency) | Only if validation word-match patterns change |
| `cpSyncEngine.ts` | `modules/controlPlan/` | Advisory alerts for AP changes | NO |
| `useControlPlan.ts` | `modules/controlPlan/` | Hook that loads/saves CP documents | NO |
| `hojaOperacionesGenerator.ts` | `modules/hojaOperaciones/` | Copies `cpItem.sampleFrequency` to `qc.frequency` | NO |
| `hojaOperacionesTypes.ts` | `modules/hojaOperaciones/` | Type definition for `HoQualityCheck.frequency` | NO |
| `HoQualityCheckTable.tsx` | `modules/hojaOperaciones/` | UI table -- renders frequency column (read-only) | NO |
| `hoExcelExport.ts` | `modules/hojaOperaciones/` | Excel export -- writes `qc.frequency` | NO |
| `hojaOperacionesPdfExport.ts` | `modules/hojaOperaciones/` | PDF export -- renders `qc.frequency` | NO |
| `overrideTracker.ts` | `core/inheritance/` | `serializeCpItem()` includes sampleFrequency | NO |
| `changePropagation.ts` | `core/inheritance/` | Detects frequency changes in master, creates proposals | NO |
| `hoCpLinkValidation.ts` | `utils/` | Validates cpItemId references (NOT frequency values) | NO |
| `crossDocumentAlerts.ts` | `utils/` | Generic alert when CP changes | NO |
| `cpRepository.ts` | `utils/repositories/` | CRUD for CP documents | NO |
| `hoRepository.ts` | `utils/repositories/` | CRUD for HO documents | NO |
| `seedApqpDocuments.ts` | `utils/seed/` | Seed data for 5 product families | Only if seed data needs normalization |
| `seed-headrest.mjs` | `scripts/` | Seed data for 3 headrest families | Only if seed data needs normalization |

**Summary: No source code changes are needed to modify frequencies.** The only code changes would be needed if:
- The normalization standard changes the auto-fill default rules
- The template library frequencies need to be normalized
- The seed scripts need to be updated to reflect normalized values

---

## 4. Risk Assessment

### What could go wrong?

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **HO shows stale frequency after CP update** | Medium | HIGH (guaranteed if HO not regenerated) | Update HOs after CPs, or accept stale data with cross-doc alert |
| **Variant CP not updated (direct SQL bypass)** | Medium | Medium (only if using Option A) | Use Option B (repository layer) to trigger propagation |
| **Cross-validation false positives after normalization** | Low | Medium | V5 checks for "verific" substring; V7 checks for "pieza/continuo/100%". Normalized values must still contain these keywords |
| **Broken HO-CP link after regeneration** | Medium | Low | Regeneration creates new UUIDs for quality checks, breaking `cpItemId` references. Only a risk if HO is regenerated, not surgically updated |
| **Export shows inconsistent data** | Low | Medium | If CP is updated but HO is not, the CP export shows new frequency while HO export shows old frequency |
| **Data loss on HO regeneration** | HIGH | Medium | Full regeneration wipes manual steps, visual aids, PPE customizations. NEVER use unless HO has no manual edits |

### Race conditions?

**No significant race conditions exist for frequency modification:**
- The CP save flow uses a `savingRef` mutex to prevent concurrent saves.
- The change propagation is fire-and-forget (`void async` in `triggerChangePropagation`), so a slow propagation will not block the UI. However, if two saves happen in rapid succession, the second propagation may overwrite proposals from the first. This is mitigated by the idempotent cleanup: propagation always deletes old pending/auto_applied proposals before creating new ones.
- HO regeneration is a user-initiated action (not automatic), so no race condition there.

### Cross-validation rules (V5, V7)

**V5 - Poka-Yoke Frequency Verification** (`cpCrossValidation.ts`, lines 303-324):
- Checks: `(item.sampleFrequency ?? '').toLowerCase().includes('verific')`
- **Impact**: If a normalized frequency for Poka-Yoke items does NOT contain the substring "verific", V5 will emit a warning `POKAYOKE_NO_VERIFY`.
- **Action needed**: Ensure that any Poka-Yoke-related frequency string includes the word "verificacion" or "verific" (e.g., "Verificacion inicio de turno").

**V7 - Sampling Consistency** (`cpCrossValidation.ts`, lines 411-439):
- Checks: When `sampleSize === '100%'`, the frequency must contain one of: `pieza`, `continuo`, `cada una`, `100%`, `each`, `continuous`.
- **Impact**: If a normalized frequency for 100% sample items does not contain one of these words, V7 will emit an info `SAMPLE_INCONSISTENCY`.
- **Action needed**: Ensure the canonical value for 100% inspection is `Cada pieza` (which already contains "pieza").

### Cross-doc alerts

- The `crossDocumentAlerts.ts` cascade definition says: `cp` changes -> targets: `['ho']`.
- This only fires when a CP document is saved with a new revision via the app's revision tracking system.
- If you update via direct SQL without incrementing the revision, no alert fires.
- The alert is generic: "El documento Plan de Control fue actualizado a Rev. X" -- it does not specify which fields changed.

---

## 5. Recommended Approach

### Option A: Direct Supabase UPDATE with JSON manipulation

```sql
-- Example: Normalize "1x turno" to "Cada turno" across all CPs
UPDATE cp_documents
SET data = REPLACE(data, '"1x turno"', '"Cada turno"'),
    updated_at = NOW()
WHERE data LIKE '%1x turno%';
```

| Pros | Cons |
|------|------|
| Fast, one command per normalization | Dangerous: blind string replacement in JSON could corrupt data if substring appears in other fields |
| No app dependency | Does NOT trigger change propagation to variants |
| Can be run in batch | Does NOT update HO documents |
| | Does NOT create cross-doc alerts |
| | Does NOT increment revision |
| | No audit trail |

**Verdict: NOT RECOMMENDED** for production data. Acceptable only for one-off fixes where the string is 100% unique to `sampleFrequency`.

### Option B: Script using the app's repository layer

```typescript
// Pseudocode: Load, modify, save through cpRepository
const docs = await listCpDocuments();
for (const meta of docs) {
    const doc = await loadCpDocument(meta.id);
    let changed = false;
    for (const item of doc.items) {
        const normalized = normalizeFrequency(item.sampleFrequency);
        if (normalized !== item.sampleFrequency) {
            item.sampleFrequency = normalized;
            changed = true;
        }
    }
    if (changed) {
        await saveCpDocument(meta.id, meta.project_name, doc, meta.linked_amfe_id);
        // triggerChangePropagation fires automatically in the save flow
    }
}
```

| Pros | Cons |
|------|------|
| Uses the same save path as the UI | Requires building and running a script |
| Triggers change propagation to variants automatically | Still does not auto-update HO documents |
| Maintains checksums and timestamps | Need to handle the HO update as a separate step |
| Audit trail through repository layer | |
| Can include normalization logic with validation | |

**Verdict: RECOMMENDED** approach. Safest option that respects the app's data integrity guarantees.

### Option C: Manual edits through the app UI

| Pros | Cons |
|------|------|
| Fully safe, all systems engaged | Extremely slow for 700-800 items across 18 CPs |
| Full IATF traceability | Error-prone (human typos re-introduce inconsistencies) |
| Cross-doc alerts fire naturally | No batch capability |
| Change propagation fires on save | |

**Verdict: NOT PRACTICAL** for bulk normalization. Acceptable for one-off individual frequency corrections.

### Recommended Sequence for Bulk Normalization

1. **Build a normalization script** (Option B) that:
   - Loads all 18 CPs via `cpRepository`
   - Applies a normalization map (see Section 6 below)
   - Saves each modified CP via `saveCpDocument()`
   - This automatically triggers change propagation to variant CPs

2. **After CP normalization**, build a companion script that:
   - For each CP that was modified, loads the linked HO via `hoRepository`
   - For each quality check with a `cpItemId`, looks up the corresponding CP item
   - Updates `qc.frequency` to match `cpItem.sampleFrequency`
   - Saves the HO via `hoRepository`

3. **Verify** by:
   - Counting unique frequency values across all CPs (should match canonical list)
   - Running cross-validation on all CPs (`validateCpAgainstAmfe`) to check for V5/V7 issues
   - Spot-checking HO exports to confirm frequencies match updated CP values

---

## 6. Normalization Opportunity

### Current State (from Layer 1A)

36 unique frequency strings exist with 9 normalization groups where the same concept is expressed differently:

| # | Concept | Current Variants | Recommended Canonical Form |
|---|---------|-----------------|---------------------------|
| 1 | Once per shift | `Cada turno`, `1x turno`, `Por turno` | `Cada turno` |
| 2 | Every hour | `Cada hora`, `C/hora` | `Cada hora` |
| 3 | Start of lot | `Inicio lote`, `Inicio de lote` | `Inicio de lote` |
| 4 | Every piece | `Cada pieza` (already consistent) | `Cada pieza` |
| 5 | Every container | `Cada contenedor`, `Cada cont.` | `Cada contenedor` |
| 6 | Every lot | `Cada lote`, `Por lote`, `Cada lote de material` | `Cada lote` |
| 7 | Start + hourly | `Inicio + c/hora`, `Inicio turno + c/hora`, `Inicio turno + cada hora` | `Inicio de turno + cada hora` |
| 8 | Start of shift | `Inicio turno`, `Inicio de turno` | `Inicio de turno` |
| 9 | Per delivery | `Cada recepcion`, `Por entrega` | `Cada recepcion` |

### Normalization Map (for script implementation)

```typescript
const FREQUENCY_NORMALIZATION_MAP: Record<string, string> = {
    '1x turno': 'Cada turno',
    'Por turno': 'Cada turno',
    'C/hora': 'Cada hora',
    'Inicio lote': 'Inicio de lote',
    'Cada cont.': 'Cada contenedor',
    'Por lote': 'Cada lote',
    'Cada lote de material': 'Cada lote',
    'Inicio + c/hora': 'Inicio de turno + cada hora',
    'Inicio turno + c/hora': 'Inicio de turno + cada hora',
    'Inicio turno + cada hora': 'Inicio de turno + cada hora',
    'Inicio turno': 'Inicio de turno',
    'Por entrega': 'Cada recepcion',
    'Inicio + c/50': 'Inicio de lote + cada 50 piezas',
    'Inicio + c/50 pzas': 'Inicio de lote + cada 50 piezas',
};
```

### Should we also normalize in HO documents?

**Yes, if we normalize CPs.** The HO `frequency` field is a snapshot copy of `sampleFrequency` at generation time. After CP normalization:

1. **If HO is regenerated**: It picks up the new normalized value automatically (via `cpItemToQualityCheck()` in `hojaOperacionesGenerator.ts`, line 79: `frequency: cpItem.sampleFrequency || ''`).

2. **If HO is surgically updated**: The update script should apply the same normalization map to `qc.frequency` values.

3. **If HO is left as-is**: The HO will have the old non-normalized string. This creates an inconsistency between CP and HO that confuses auditors. The cross-doc alert will notify users, but the alert is generic (does not specify "frequency changed").

**Recommendation**: Always normalize HO frequencies as part of the same batch operation. Use the surgical update approach (option 2 above) to avoid data loss from full regeneration.

### Impact on `controlPlanDefaults.ts`

The auto-fill default rules already produce canonical values:
- `Cada pieza` (AP=H)
- `Cada pieza (Pre-Lanzamiento)` (AP=M, preLaunch)
- `Cada hora` (AP=M, S>=9)
- `Cada turno` (AP=M, S<9)
- `Cada 2 horas` (AP=L, S>=9)
- `Cada turno` (AP=L, S>=5)

These are already in the canonical form. **No changes needed to `controlPlanDefaults.ts`.**

### Impact on `controlPlanTemplates.ts`

The template library uses some non-canonical forms. After normalization, the templates should also be updated to use canonical values. Otherwise, newly generated CPs from templates will re-introduce non-canonical frequencies.

### Impact on seed scripts

Both `seedApqpDocuments.ts` and `seed-headrest.mjs` hardcode frequency strings. After normalization:
- If seeds are ever re-run, they would re-introduce non-canonical values.
- Updating the seed scripts is recommended to maintain consistency, but it is low priority since seeds are only run once during initial setup.

### Post-Normalization Canonical Frequency List

After normalization, the 36 unique values reduce to approximately 22 canonical values:

| # | Canonical Value | Category |
|---|----------------|----------|
| 1 | `Cada pieza` | EVENT |
| 2 | `Cada pieza (Pre-Lanzamiento)` | EVENT |
| 3 | `Cada recepcion` | EVENT |
| 4 | `Cada lote` | EVENT |
| 5 | `Cada tendido` | EVENT |
| 6 | `Cada caja` | EVENT |
| 7 | `Cada contenedor` | EVENT |
| 8 | `Cada pallet` | EVENT |
| 9 | `Cada setup` | EVENT |
| 10 | `Cada 50 piezas` | EVENT |
| 11 | `Auditoria de Producto` | EVENT |
| 12 | `Segun tabla vida herramienta` | EVENT |
| 13 | `Cada turno` | TIME |
| 14 | `Cada hora` | TIME |
| 15 | `Cada 2 horas` | TIME |
| 16 | `Inicio de turno` | TIME |
| 17 | `Inicio de lote` | EVENT |
| 18 | `Continuo` | TIME |
| 19 | `Continuo (sensor) + manual inicio turno` | TIME |
| 20 | `Inicio de turno + cada hora` | HYBRID |
| 21 | `Inicio de turno y despues de cada intervencion mecanica` | HYBRID |
| 22 | `Inicio de turno / cambio de lote` | HYBRID |
| 23 | `Inicio y fin de turno / 100% Por lote` | HYBRID |
| 24 | `Inicio de lote + cada 50 piezas` | HYBRID |

---

## 7. Decision Matrix Summary

| If you want to... | Do this | Estimated effort | Risk |
|-------------------|---------|-----------------|------|
| Change one frequency in one CP item | Edit through the app UI (Option C) | 2 minutes | None |
| Normalize all frequencies across all CPs | Build + run a script (Option B) | 2-3 hours | Low |
| Also update HO snapshots to match | Surgical HO update script alongside CP script | +1-2 hours | Low |
| Also update template library | Edit `controlPlanTemplates.ts` and `controlPlanPatagoniaTemplate.ts` | +30 minutes | None |
| Also update seed scripts | Edit `seedApqpDocuments.ts` and `seed-headrest.mjs` | +1 hour | None |
| Add dropdown/enum to prevent future drift | UI enhancement to ControlPlanTable.tsx | +4-6 hours | Low |

---

## 8. Propagation Flow Diagram (Summary)

```
   AMFE (AP, Severity)
       |
       | [ONE-TIME at generation via controlPlanDefaults.ts]
       v
   CP master (sampleFrequency)  <-- YOU MODIFY THIS
       |
       |--[LIVE via changePropagation.ts]--> CP variant (sampleFrequency)
       |       |
       |       | auto_applied (no override) or pending (has override)
       |       v
       |   CP variant saved --> triggers HO stale alert
       |
       |--[ONE-TIME snapshot via hojaOperacionesGenerator.ts]--> HO master (qc.frequency)
       |       |
       |       | NOT auto-updated. Requires manual regeneration or surgical script.
       |       v
       |   HO master: shows OLD frequency until updated
       |
       |--[cross-doc alert via crossDocumentAlerts.ts]--> HO notification
               |
               | Generic: "CP was updated to Rev X"
               | Does NOT specify which fields changed
               v
           User sees warning banner in HO UI
```

---

## 9. Final Recommendation

**For a normalization effort**, the recommended approach is:

1. Build a TypeScript script that uses `cpRepository.loadCpDocument()` and `cpRepository.saveCpDocument()` to load, normalize, and save all 18 CPs. This triggers the change propagation engine for variants automatically.

2. Build a companion script that uses `hoRepository` to surgically update HO quality check frequencies to match the normalized CP values, using `cpItemId` as the join key.

3. Update `controlPlanTemplates.ts` and `controlPlanPatagoniaTemplate.ts` to use canonical frequency values, preventing future drift.

4. Optionally, add a frequency dropdown or combobox to the ControlPlanTable UI to guide users toward canonical values (prevents free-text drift in the future).

**For a one-off frequency correction** (e.g., changing "Cada hora" to "Cada 2 horas" for a specific item), simply edit through the app UI. The change propagation and cross-doc alert systems will handle the rest.
