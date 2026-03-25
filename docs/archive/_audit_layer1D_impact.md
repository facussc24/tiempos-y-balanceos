# Audit Layer 1D: Impact of Control Plan Frequencies on Other APQP Modules

**Date**: 2026-03-21
**Scope**: Read-only analysis of how `sampleFrequency` in Control Plan items propagates to or affects AMFE, HO, PFD, and the family inheritance system.
**Files analyzed**: 28+ source files across modules/controlPlan, modules/amfe, modules/hojaOperaciones, modules/pfd, core/inheritance, utils/, supabase/migrations.

---

## Executive Summary

The `sampleFrequency` field lives **exclusively** in the `ControlPlanItem` type (`controlPlanTypes.ts`, line 58). It is stored as a free-text string inside the `data` JSON column of `cp_documents` in Supabase. There is **no separate database column** for frequency -- it is part of the serialized JSON blob.

Frequency data **flows downstream** to exactly one other module: **HO (Hojas de Operaciones)**, where it is copied into the `HoQualityCheck.frequency` field at generation time. It does **not** flow back upstream to AMFE or sideways to PFD.

Changing frequencies in the CP requires updating **only `cp_documents.data`**. However, the HO module holds a **snapshot copy**, so HO documents will show stale frequencies until regenerated or manually updated. The family inheritance system **does propagate** frequency changes from master to variant CPs through the change proposal mechanism.

---

## 1. AMFE (FMEA) Module

### Question: Do AMFE detection actions reference CP frequencies?

**Answer: No.** The AMFE data model (`amfeTypes.ts`) has no frequency field anywhere in its hierarchy:

- `AmfeCause` has: `preventionControl`, `detectionControl`, `occurrence`, `detection`, `ap`, `characteristicNumber`, `specialChar`, `filterCode` -- but **no frequency**.
- `AmfeFailure` has: `description`, `effects`, `severity`, `causes[]` -- **no frequency**.
- `AmfeOperation` has: `opNumber`, `name`, `workElements[]` -- **no frequency**.

### Question: Is there a link between AMFE detection controls and CP frequency fields?

**Answer: The link is one-directional (AMFE --> CP), not the reverse.** The CP generator (`controlPlanGenerator.ts`) reads AMFE data to **generate** CP items with auto-filled frequencies based on AP level and severity. Specifically:

- `controlPlanDefaults.ts` function `getControlPlanDefaults()` determines `sampleFrequency` from AP + severity + phase:
  - AP=H --> "Cada pieza" (100%)
  - AP=M + S>=9 --> "Cada hora"
  - AP=M + S<9 --> "Cada turno"
  - AP=L + S>=9 (CC) --> "Cada 2 horas"
  - AP=L + S>=5 (SC) --> "Cada turno"

But this is a **one-time generation**. After the CP is generated, the frequency in the CP is independent of the AMFE. Changing the frequency in the CP does **not** update anything in the AMFE.

### Question: Check Supabase schema for foreign keys between amfe_items and control_plan_items.

**Answer: There are no item-level foreign keys.** The schema (`001_initial_schema.sql`) has:
- `cp_documents.linked_amfe_id TEXT REFERENCES amfe_documents(id)` -- document-level FK, not item-level.
- CP items are stored as JSON inside `cp_documents.data` -- they are not in a separate table.
- AMFE items are stored as JSON inside `amfe_documents.data` -- same pattern.
- The traceability link is **inside the JSON**: `ControlPlanItem.amfeCauseIds[]` and `ControlPlanItem.amfeFailureId` point to AMFE cause/failure UUIDs within the JSON blob.

---

## 2. HO (Hojas de Operaciones / Work Instructions) Module

### Question: Do Work Instructions mention control frequencies?

**Answer: Yes. HO is the primary downstream consumer of CP frequencies.**

The `HoQualityCheck` interface (`hojaOperacionesTypes.ts`, line 111) has:
```
frequency: string;  // Sample frequency -- from CP (e.g. "100%", "5 pcs/hora")
```

### How frequency flows CP --> HO:

1. **At generation time** (`hojaOperacionesGenerator.ts`, line 79):
   ```
   frequency: cpItem.sampleFrequency || '',
   ```
   The function `cpItemToQualityCheck()` copies `ControlPlanItem.sampleFrequency` into `HoQualityCheck.frequency`.

2. **Display in UI** (`HoQualityCheckTable.tsx`, line 93):
   The frequency is shown in a read-only "Frec." column in the quality check table.

3. **Excel export** (`hoExcelExport.ts`, line 785):
   `qc.frequency` is written to the "Frecuencia" column.

4. **PDF export** (`hojaOperacionesPdfExport.ts`, line 256):
   `qc.frequency` is rendered in the HTML table.

### Critical finding: Snapshot copy, not live reference

The HO stores a **snapshot** of the frequency at generation time. There is **no live binding** -- if you change `sampleFrequency` in the CP after generating the HO, the HO will show the **old frequency** until:
- The HO is regenerated from the CP, or
- The user manually edits `qc.frequency` in the HO (though the UI shows this as read-only)

The `HoQualityCheck.cpItemId` field provides traceability back to the source CP item, but there is **no automatic sync mechanism** that updates HO frequencies when CP frequencies change.

### HO --> CP link validation (`hoCpLinkValidation.ts`)

This validation checks whether `cpItemId` references in HO quality checks still exist in the CP. It does **not** check whether the frequency values are still in sync. It only validates referential integrity of the link itself.

---

## 3. PFD (Process Flow Diagram) Module

### Question: Does the PFD have any frequency-related fields?

**Answer: No.** The PFD data model (`pfdTypes.ts`) has no frequency field:

- `PfdStep` has: `stepNumber`, `stepType`, `description`, `machineDeviceTool`, `productCharacteristic`, `processCharacteristic`, `productSpecialChar`, `processSpecialChar`, `reference`, `department`, `notes`, `rejectDisposition`, `cycleTimeMinutes`, `branchId`, etc.
- None of these are frequency-related.
- `PfdStep.linkedCpItemIds` provides linkage to CP items, but this is for traceability only -- no frequency data is stored or displayed in PFD.

### PFD --> AMFE validation (`pfdAmfeLinkValidation.ts`)

This checks `linkedAmfeOperationId` / `linkedPfdStepId` integrity. It has **no frequency-related validation**.

---

## 4. Cross-Validations

### CP Cross-Validation (`cpCrossValidation.ts`)

Two validations directly involve frequency:

**V5 - Poka-Yoke Frequency Verification** (lines 303-324):
Checks that items using Poka-Yoke as `controlMethod` have a verification frequency. Looks for the word "verific" in `sampleFrequency`. If missing, emits a **warning** (`POKAYOKE_NO_VERIFY`).

**V7 - Sampling Consistency** (lines 411-439):
Checks that when `sampleSize` is "100%", the frequency text includes consistent wording like "pieza", "continuo", "cada una", "100%". If inconsistent, emits an **info** (`SAMPLE_INCONSISTENCY`).

### CP Sync Engine (`cpSyncEngine.ts`)

The sync engine detects changes between AMFE and CP. When AP level changes, it generates alerts suggesting:
- AP escalation (L-->M, M-->H): "Reforzar controles: aumentar frecuencia de muestreo"
- AP de-escalation: "Puede considerar reducir frecuencia de muestreo"

These are **advisory suggestions only** -- the sync engine does not auto-modify `sampleFrequency`. There is no patch generated for the frequency field (the `patch` only covers `processCharacteristic`, `productCharacteristic`, `controlMethod`, `amfeAp`, `amfeSeverity`).

### Cross-Document Alerts (`crossDocumentAlerts.ts`)

APQP cascade defined as:
- `cp` changes --> targets: `['ho']`

When a CP document is saved with a new revision, the system creates a `cross_doc_checks` record alerting the HO that its upstream CP changed. This is a **generic notification** -- it does not identify which fields changed (frequency, controlMethod, etc.). The user sees: "El documento Plan de Control fue actualizado a Rev. X. Revise si este documento necesita actualizarse."

### What is NOT validated:

- **No cross-module frequency consistency check**: There is no validation that `HoQualityCheck.frequency` matches `ControlPlanItem.sampleFrequency` for the same linked item.
- **No AMFE-to-CP frequency derivation check**: There is no validation that CP frequencies follow the AP/severity rules from `controlPlanDefaults.ts` after initial generation.

---

## 5. Database Schema

### Where frequency is stored:

| Table | Column | Contains frequency? |
|-------|--------|-------------------|
| `cp_documents` | `data` (TEXT/JSON) | Yes -- `items[].sampleFrequency` inside JSON blob |
| `ho_documents` | `data` (TEXT/JSON) | Yes -- `sheets[].qualityChecks[].frequency` inside JSON blob |
| `amfe_documents` | `data` (TEXT/JSON) | No |
| `pfd_documents` | `data` (TEXT/JSON) | No |

There is **no dedicated database column** for frequency. Both instances (CP and HO) are embedded in JSON `data` columns. This means:
- You cannot query frequency values with simple SQL -- you need JSON path queries.
- There are no database-level constraints on frequency values.
- There are no foreign keys between CP item frequencies and HO quality check frequencies.

### Schema relationships relevant to frequency:

```
cp_documents.linked_amfe_id --> amfe_documents.id  (document-level FK)
ho_documents.linked_cp_id   --> cp_documents.id     (document-level FK)
```

These are document-level links only. Item-level traceability is handled within the JSON:
- `ControlPlanItem.amfeCauseIds[]` --> cause UUIDs in AMFE JSON
- `HoQualityCheck.cpItemId` --> item UUID in CP JSON

---

## 6. Impact of Changing Frequencies in CP

### What tables need UPDATE statements?

**Only `cp_documents`**. Specifically, you update `cp_documents.data` (the JSON blob) to change `items[N].sampleFrequency`. The typical flow:

1. Load CP document (parse JSON from `data` column)
2. Modify `items[].sampleFrequency` in the parsed object
3. Re-serialize to JSON and UPDATE `cp_documents.data`
4. Update metadata (`cp_documents.updated_at`, optionally `cp_documents.revision_level`)

### Are there cascading changes?

**No automatic cascading.** However:

1. **HO documents will be stale**: If CP frequencies change, the corresponding `HoQualityCheck.frequency` in `ho_documents.data` will still hold the old value. The HO must be regenerated or manually updated.

2. **Cross-doc alert will fire**: When the CP is saved with a new revision, `crossDocumentAlerts.ts` will generate a warning for the linked HO document via `cross_doc_checks` table. The user will see a notification when they open the HO.

3. **No auto-update of HO**: The system does NOT automatically update HO frequencies when CP frequencies change. This is by design -- per IATF 16949, the HO "consumes" CP data but changes require human review.

### Does the family inheritance system propagate frequency changes?

**Yes, for CP-to-CP inheritance (master --> variant).** Here is how it works:

1. **Override Tracker** (`overrideTracker.ts`): When comparing master vs variant CP, the `serializeCpItem()` function (line 161-168) includes `sampleFrequency` in the comparable fields. It explicitly **excludes** metadata like `id`, `autoFilledFields`, `amfeAp`, `amfeSeverity`, but **includes** `sampleFrequency`. So if a variant has a different frequency than the master, it will be detected as a `modified` override.

2. **Change Propagation** (`changePropagation.ts`): When a master CP is saved, `triggerChangePropagation()` diffs old vs new master. If `sampleFrequency` changed on any item, it will:
   - For variants **without** an override on that item: Create a proposal with status `auto_applied` (the change flows through automatically)
   - For variants **with** an override on that item: Create a proposal with status `pending` (requires manual acceptance via `ChangeProposalPanel`)

3. **Clone** (`documentInheritance.ts`): When creating a new variant from a master, the entire CP is deep-cloned including all `sampleFrequency` values. New UUIDs are generated but content is identical.

### Summary of propagation paths:

```
AMFE (S,O,D,AP) --[generation]--> CP (sampleFrequency)  [ONE-TIME, at CP generation]
                                    |
                                    |--[generation]--> HO (frequency)  [ONE-TIME snapshot]
                                    |
                                    |--[inheritance]--> CP variant (sampleFrequency)  [LIVE via proposals]
                                    |
                                    |--[cross-doc alert]--> HO notification  [GENERIC alert, no auto-update]
```

---

## 7. Identified Gaps (Informational)

These are observations, not recommendations to change code:

1. **No HO frequency sync check**: There is no validation that `HoQualityCheck.frequency` still matches `ControlPlanItem.sampleFrequency` for linked items. If frequencies change in CP, the HO can silently hold stale data.

2. **No frequency consistency re-validation**: After initial generation, CP frequencies can be manually edited to any value. There is no validation that they still align with the AP/severity-based rules from `controlPlanDefaults.ts`.

3. **CP sync engine suggests frequency changes but cannot auto-apply**: When AP changes in AMFE, the sync engine advises the user to increase/decrease frequency, but the `patch` mechanism does not cover `sampleFrequency` -- only text fields like `processCharacteristic` and `controlMethod`.

4. **Cross-doc alert is generic**: The HO notification says "CP was updated" but does not specify which fields changed (frequency, controlMethod, specification, etc.).

---

## 8. Complete Field Traceability Map

| Source | Field | Target | Field | Mechanism | Live? |
|--------|-------|--------|-------|-----------|-------|
| AMFE cause | AP + severity | CP item | sampleFrequency | `controlPlanDefaults.ts` at generation | No (one-time) |
| CP item | sampleFrequency | HO quality check | frequency | `hojaOperacionesGenerator.ts` at generation | No (snapshot) |
| CP master item | sampleFrequency | CP variant item | sampleFrequency | `changePropagation.ts` via proposals | Yes (live) |
| CP item | sampleFrequency | CP validation V5 | Poka-Yoke check | `cpCrossValidation.ts` | Yes (on validation run) |
| CP item | sampleFrequency + sampleSize | CP validation V7 | Sampling consistency | `cpCrossValidation.ts` | Yes (on validation run) |

---

## 9. Answer to the Core Question

**If you change frequencies in CP, what needs to happen?**

| Action | Required? | How |
|--------|-----------|-----|
| Update `cp_documents.data` | Yes | Edit sampleFrequency in the JSON, save via CP repository |
| Update `ho_documents.data` | No auto -- manual | Regenerate HO from CP, or manually edit HO quality checks |
| Update `amfe_documents.data` | No | AMFE has no frequency fields |
| Update `pfd_documents.data` | No | PFD has no frequency fields |
| Family master --> variant CP | Automatic | `changePropagation.ts` creates proposals; auto-applied if no override |
| Family master --> variant HO | Not automatic | Each variant HO would need separate regeneration |
| Cross-doc notification | Automatic | `cross_doc_checks` record created when CP revision changes |

**Bottom line**: Changing CP frequencies is a **single-table operation** (`cp_documents`) with **one downstream stale copy** in HO that requires manual regeneration. The family inheritance system handles master-to-variant CP propagation automatically. No other tables or modules are structurally affected.
