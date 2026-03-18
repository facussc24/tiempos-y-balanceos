# Audit Report: Control Plans (CP) & Hojas de Operaciones (HO)

**Date:** 2026-03-17
**Source:** Supabase PostgreSQL (production database)
**Scope:** All CP and HO documents stored in Supabase
**Type:** READ-ONLY data audit

---

## Executive Summary

| Metric | CP | HO |
|---|---|---|
| **Total documents** | 26 | 25 |
| **Total items/sheets** | 1,773 items | 250 sheets |
| **Average completeness** | 98% | 71% |
| **Fully complete (100%)** | 19 docs | 0 docs |
| **Critical gaps (<50%)** | 0 docs | 3 docs |
| **Clients** | VWA (22), PWA (4) | VWA (21), PWA (4) |

### Key Findings

1. **CP documents are overall well-populated** (98% average). All items have specification, sample size, sample frequency, reaction plan, and reaction plan owner filled in.
2. **278 CP items contain "TBD" placeholder values** in their specification field, primarily across Headrest and Inserto family variants.
3. **469 CP items (26%) are missing the controlMethod field**, concentrated in 7 documents (ARMREST, INSERTO x3, TOP_ROLL, and PWA TELAS).
4. **HO documents have significant gaps**: 59 sheets (24%) have zero steps, 107 sheets (43%) have only 1 generic auto-generated step, and only 84 sheets (34%) have real multi-step content.
5. **245 of 250 HO sheets (98%) have no quality checks** linked from CP. Only VWA/PATAGONIA/INSERTO has 17 quality checks populated.
6. **1 duplicate CP document** found: "VWA/PATAGONIA/INSERTO [L0]" appears twice with identical content.
7. **3 duplicate HO documents** found: "Insert Patagonia" appears 4 times (likely family variants without distinct names).
8. **All 8 legacy/manual CPs are missing the `approvedBy` header field.**

---

## CP Documents Detail (26 documents, 1,773 items)

### Phase Distribution

| Phase | Count |
|---|---|
| Pre-Launch | 23 |
| Production | 3 |

### Special Characteristic Classification (across all 1,773 items)

| Classification | Count | % |
|---|---|---|
| SC (Significant) | 906 | 51% |
| CC (Critical) | 58 | 3% |
| PTC (Pass-Through) | 0 | 0% |
| Empty/None | 807 | 46% |

### CP Document Table

| # | Project Name | Phase | Items | Empty Spec | TBD Spec | Empty Sample Size | Empty Freq | Empty Control Method | Empty Reaction Plan | Empty RPO | Completeness |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Armrest Door Panel Patagonia | preLaunch | 14 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 100% |
| 2 | Insert Patagonia | preLaunch | 12 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 100% |
| 3 | Insert Patagonia [L0] | preLaunch | 12 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 100% |
| 4 | Proceso de fabricacion - Top Roll | production | 36 | 0 | 16 | 0 | 0 | 0 | 0 | 0 | 100% |
| 5 | PWA/TELAS_PLANAS | production | 33 | 0 | 0 | 0 | 0 | **23** | 0 | 0 | 91% |
| 6 | PWA/TELAS_TERMOFORMADAS | production | 8 | 0 | 0 | 0 | 0 | **4** | 0 | 0 | 94% |
| 7 | Telas Planas PWA | preLaunch | 14 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 100% |
| 8 | Telas Termoformadas PWA | preLaunch | 13 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 100% |
| 9 | Top Roll Patagonia | preLaunch | 15 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 100% |
| 10 | VWA/PATAGONIA/ARMREST | preLaunch | 174 | 0 | 0 | 0 | 0 | **87** | 0 | 0 | 94% |
| 11 | VWA/PATAGONIA/HEADREST_FRONT | preLaunch | 54 | 0 | 15 | 0 | 0 | 0 | 0 | 0 | 100% |
| 12 | VWA/PATAGONIA/HEADREST_FRONT [L1] | preLaunch | 63 | 0 | 18 | 0 | 0 | 0 | 0 | 0 | 100% |
| 13 | VWA/PATAGONIA/HEADREST_FRONT [L2] | preLaunch | 63 | 0 | 18 | 0 | 0 | 0 | 0 | 0 | 100% |
| 14 | VWA/PATAGONIA/HEADREST_FRONT [L3] | preLaunch | 63 | 0 | 18 | 0 | 0 | 0 | 0 | 0 | 100% |
| 15 | VWA/PATAGONIA/HEADREST_REAR_CEN | preLaunch | 52 | 0 | 15 | 0 | 0 | 0 | 0 | 0 | 100% |
| 16 | VWA/PATAGONIA/HEADREST_REAR_CEN [L1] | preLaunch | 61 | 0 | 18 | 0 | 0 | 0 | 0 | 0 | 100% |
| 17 | VWA/PATAGONIA/HEADREST_REAR_CEN [L2] | preLaunch | 61 | 0 | 18 | 0 | 0 | 0 | 0 | 0 | 100% |
| 18 | VWA/PATAGONIA/HEADREST_REAR_CEN [L3] | preLaunch | 61 | 0 | 18 | 0 | 0 | 0 | 0 | 0 | 100% |
| 19 | VWA/PATAGONIA/HEADREST_REAR_OUT | preLaunch | 54 | 0 | 15 | 0 | 0 | 0 | 0 | 0 | 100% |
| 20 | VWA/PATAGONIA/HEADREST_REAR_OUT [L1] | preLaunch | 63 | 0 | 18 | 0 | 0 | 0 | 0 | 0 | 100% |
| 21 | VWA/PATAGONIA/HEADREST_REAR_OUT [L2] | preLaunch | 63 | 0 | 18 | 0 | 0 | 0 | 0 | 0 | 100% |
| 22 | VWA/PATAGONIA/HEADREST_REAR_OUT [L3] | preLaunch | 63 | 0 | 18 | 0 | 0 | 0 | 0 | 0 | 100% |
| 23 | VWA/PATAGONIA/INSERTO | preLaunch | 209 | 0 | 0 | 0 | 0 | **104** | 0 | 0 | 94% |
| 24 | VWA/PATAGONIA/INSERTO [L0] (copy 1) | preLaunch | 209 | 0 | 0 | 0 | 0 | **104** | 0 | 0 | 94% |
| 25 | VWA/PATAGONIA/INSERTO [L0] (copy 2) | preLaunch | 209 | 0 | 0 | 0 | 0 | **104** | 0 | 0 | 94% |
| 26 | VWA/PATAGONIA/TOP_ROLL | preLaunch | 94 | 0 | 0 | 0 | 0 | **43** | 0 | 0 | 94% |
| | **TOTALS** | | **1,773** | **0** | **278** | **0** | **0** | **469** | **0** | **0** | **98% avg** |

### CP Critical Gaps

#### GAP-CP-1: 278 items with "TBD" in specification (HIGH)
Specifications contain placeholder text like "TBD g/m2", "TBD N", "Segun ficha tecnica TBD". These are items where engineering values have not yet been defined. Affected documents:
- All Headrest variants (FRONT, REAR_CEN, REAR_OUT) and their L1/L2/L3 family copies: 15-18 TBD specs each
- Proceso de fabricacion - Top Roll: 16 TBD specs + 9 TBD in other fields
- Top Roll Patagonia: 4 TBD specs
- Insert Patagonia / Insert Patagonia [L0]: 2 TBD specs each
- Armrest Door Panel: 3 TBD specs
- Telas Planas/Termoformadas PWA: 2-3 TBD specs each

#### GAP-CP-2: 469 items missing controlMethod (HIGH)
26% of all CP items have an empty control method field. This is concentrated in the auto-generated CPs from AMFE:
- VWA/PATAGONIA/INSERTO (x3 copies): 104 items each (50% of items)
- VWA/PATAGONIA/ARMREST: 87 items (50% of items)
- VWA/PATAGONIA/TOP_ROLL: 43 items (46% of items)
- PWA/TELAS_PLANAS: 23 items (70% of items)
- PWA/TELAS_TERMOFORMADAS: 4 items (50% of items)

#### GAP-CP-3: 8 documents missing `approvedBy` header (MEDIUM)
All legacy/manually-created CPs lack the approvedBy field:
- Armrest Door Panel Patagonia, Insert Patagonia, Insert Patagonia [L0], Proceso de fabricacion - Top Roll, Telas Planas PWA, Telas Termoformadas PWA, Top Roll Patagonia, VWA/PATAGONIA/ARMREST

#### GAP-CP-4: Duplicate document (LOW)
"VWA/PATAGONIA/INSERTO [L0]" exists twice in the database with identical content (same 209 items, same completeness). One should be removed.

---

## HO Documents Detail (25 documents, 250 sheets)

### Sheet Step Distribution

| Category | Count | % of 250 sheets |
|---|---|---|
| Sheets with 0 steps | 59 | 24% |
| Sheets with 1 generic step | 107 | 43% |
| Sheets with 2+ real steps | 84 | 34% |

### Quality Check Coverage

| Metric | Value |
|---|---|
| Sheets with quality checks | 5 of 250 (2%) |
| Total quality checks across all HOs | 17 |
| Only document with QCs | VWA/PATAGONIA/INSERTO |

### HO Document Table

| # | Linked AMFE Project | Sheets | Total Steps | Empty Steps | Placeholder Steps | Quality Checks | Sheets w/o PPE | Completeness |
|---|---|---|---|---|---|---|---|---|
| 1 | Armrest Door Panel Patagonia | 9 | 37 | 0 | 1 | 0 | 0 | 79% |
| 2 | Insert Patagonia (copy 1) | 11 | 36 | 0 | 0 | 0 | 0 | 80% |
| 3 | Insert Patagonia (copy 2) | 11 | 36 | 0 | 0 | 0 | 0 | 80% |
| 4 | Insert Patagonia (copy 3) | 11 | 36 | 0 | 0 | 0 | 0 | 80% |
| 5 | Insert Patagonia (copy 4) | 11 | 36 | 0 | 0 | 0 | 0 | 80% |
| 6 | PWA/TELAS_PLANAS | 12 | 0 | 0 | 0 | 0 | **12** | **20%** |
| 7 | PWA/TELAS_TERMOFORMADAS | 8 | 0 | 0 | 0 | 0 | **8** | **20%** |
| 8 | Telas Planas PWA | 8 | 35 | 0 | 1 | 0 | 0 | 79% |
| 9 | Telas Termoformadas PWA | 9 | 37 | 0 | 0 | 0 | 0 | 80% |
| 10 | Top Roll Patagonia | 9 | 35 | 0 | 2 | 0 | 0 | 79% |
| 11 | VWA/PATAGONIA/ARMREST | 22 | 0 | 0 | 0 | 0 | 0 | **30%** |
| 12 | VWA/PATAGONIA/HEADREST_FRONT | 8 | 8 | 0 | 0 | 0 | 0 | 80% |
| 13 | VWA/PATAGONIA/HEADREST_FRONT [L1] | 8 | 8 | 0 | 0 | 0 | 0 | 80% |
| 14 | VWA/PATAGONIA/HEADREST_FRONT [L2] | 8 | 8 | 0 | 0 | 0 | 0 | 80% |
| 15 | VWA/PATAGONIA/HEADREST_FRONT [L3] | 8 | 8 | 0 | 0 | 0 | 0 | 80% |
| 16 | VWA/PATAGONIA/HEADREST_REAR_CEN | 8 | 8 | 0 | 0 | 0 | 0 | 80% |
| 17 | VWA/PATAGONIA/HEADREST_REAR_CEN [L1] | 8 | 8 | 0 | 0 | 0 | 0 | 80% |
| 18 | VWA/PATAGONIA/HEADREST_REAR_CEN [L2] | 8 | 8 | 0 | 0 | 0 | 0 | 80% |
| 19 | VWA/PATAGONIA/HEADREST_REAR_CEN [L3] | 8 | 8 | 0 | 0 | 0 | 0 | 80% |
| 20 | VWA/PATAGONIA/HEADREST_REAR_OUT | 8 | 8 | 0 | 0 | 0 | 0 | 80% |
| 21 | VWA/PATAGONIA/HEADREST_REAR_OUT [L1] | 8 | 8 | 0 | 0 | 0 | 0 | 80% |
| 22 | VWA/PATAGONIA/HEADREST_REAR_OUT [L2] | 8 | 8 | 0 | 0 | 0 | 0 | 80% |
| 23 | VWA/PATAGONIA/HEADREST_REAR_OUT [L3] | 8 | 8 | 0 | 0 | 0 | 0 | 80% |
| 24 | VWA/PATAGONIA/INSERTO | 22 | 23 | 0 | 0 | **17** | **17** | **38%** |
| 25 | VWA/PATAGONIA/TOP_ROLL | 11 | 11 | 0 | 0 | 0 | 0 | 80% |
| | **TOTALS** | **250** | **418** | **0** | **4** | **17** | **37** | **71% avg** |

### HO Critical Gaps

#### GAP-HO-1: 245 of 250 sheets (98%) have no quality checks (CRITICAL)
Per IATF 16949 clause 8.5.1.2, work instructions must include quality verification criteria from the Control Plan. Only VWA/PATAGONIA/INSERTO has quality checks populated (17 checks across 5 of 22 sheets). All other HO documents have zero quality checks.

#### GAP-HO-2: 59 sheets (24%) have zero process steps (HIGH)
These sheets have only the header (operation name, PPE, etc.) but no step-by-step instructions. Affected documents:
- VWA/PATAGONIA/ARMREST: 22 sheets, all with 0 steps
- PWA/TELAS_PLANAS: 12 sheets, all with 0 steps
- PWA/TELAS_TERMOFORMADAS: 8 sheets, all with 0 steps
- VWA/PATAGONIA/INSERTO: some sheets with 0 steps (17 of 22 have 0 or 1 step)

#### GAP-HO-3: 107 sheets (43%) have only 1 generic auto-generated step (MEDIUM)
These sheets contain a single step with the pattern "Ejecutar operacion XX: [operation name]" - a placeholder generated when creating the HO from AMFE, not actual work instructions. Affected:
- All Headrest variants (FRONT, REAR_CEN, REAR_OUT) and their L1/L2/L3 copies
- VWA/PATAGONIA/TOP_ROLL
- VWA/PATAGONIA/INSERTO (some sheets)

#### GAP-HO-4: 3 documents at critical completeness level (HIGH)
- **PWA/TELAS_PLANAS (20%)**: 12 sheets, 0 steps, 0 QC, 0 PPE
- **PWA/TELAS_TERMOFORMADAS (20%)**: 8 sheets, 0 steps, 0 QC, 0 PPE
- **VWA/PATAGONIA/ARMREST (30%)**: 22 sheets, 0 steps, 0 QC (has PPE and operation names)

#### GAP-HO-5: 37 sheets missing PPE assignments (MEDIUM)
Safety PPE selection is missing on 37 sheets, concentrated in:
- VWA/PATAGONIA/INSERTO: 17 sheets without PPE
- PWA/TELAS_PLANAS: 12 sheets without PPE
- PWA/TELAS_TERMOFORMADAS: 8 sheets without PPE

#### GAP-HO-6: Duplicate documents (LOW)
"Insert Patagonia" appears 4 times as linked_amfe_project across 4 different HO documents (likely family variants that should have distinct names like [L0], [L1], etc.).

---

## CP-HO Linkage Analysis

### All HOs have linked CPs: 25/25

### CPs without corresponding HO document: 3

| CP Document | Reason |
|---|---|
| Insert Patagonia [L0] | No HO links to this CP project name |
| Proceso de fabricacion - Top Roll | Legacy/manual CP, no auto-generated HO |
| VWA/PATAGONIA/INSERTO [L0] | Duplicate CP, HO links to the other copy |

### Broken links: 0
All HO documents that reference a CP project name correctly resolve to an existing CP document.

---

## Recommendations (Priority Order)

### Priority 1 - CRITICAL

1. **Populate quality checks in HO documents from Control Plan data.** 98% of HO sheets are missing quality verification criteria. The system has a CP-to-HO projection mechanism (`HoQualityCheck` type) but it is not being used for most documents.

2. **Fill in the 469 missing controlMethod values** in CP items for INSERTO, ARMREST, TOP_ROLL, and PWA TELAS documents. Control method is a mandatory AIAG field.

### Priority 2 - HIGH

3. **Replace 278 "TBD" specifications** with actual engineering values. These are distributed across Headrest variants (propagated through family inheritance) and the legacy Top Roll CP.

4. **Add process steps** to the 59 HO sheets that currently have zero steps (ARMREST, PWA TELAS_PLANAS, PWA TELAS_TERMOFORMADAS).

5. **Expand single-step sheets** from the generic "Ejecutar operacion XX" pattern into actual detailed work instructions for the 107 affected sheets.

### Priority 3 - MEDIUM

6. **Add `approvedBy`** to the 8 CP document headers that are missing this field.

7. **Assign PPE** to the 37 HO sheets that currently have no safety elements selected.

8. **Clean up duplicates**: Remove the duplicate "VWA/PATAGONIA/INSERTO [L0]" CP and differentiate the 4 "Insert Patagonia" HO documents with proper variant labels.

---

## Methodology

- **Data source**: Supabase PostgreSQL REST API, queried with authenticated session (admin@barack.com)
- **CP completeness score**: Weighted across 8 required AIAG fields per item (processDescription, product/process characteristic, specification, sampleSize, sampleFrequency, controlMethod, reactionPlan, reactionPlanOwner). A field counts as filled if it has non-empty trimmed content. Score = filled fields / (items x 8) x 100.
- **HO completeness score**: Per-sheet weighted score: operation name (10%), has steps (30%), steps have real content (20%), has quality checks (20%), has PPE (10%), has reaction plan (10%). Average across all sheets.
- **TBD detection**: Pattern matching for "TBD", "Completar", "TODO", "Pendiente", "Por definir" in item field values.
- **Placeholder step detection**: Steps with descriptions matching empty, "Completar", "TBD", "TODO", "Pendiente", "...", or "-".
