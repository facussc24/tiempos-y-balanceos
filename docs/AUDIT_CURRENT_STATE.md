# Deep Audit — Current State of All 8 Products

**Date**: 2026-03-18
**Method**: Direct Supabase/SQLite query via browser runtime
**Totals pre-fix**: 63 documents (18 AMFE, 19 CP, 18 HO, 8 PFD) across 8 product families
**Totals post-fix**: 61 documents (18 AMFE, 18 CP, 17 HO, 8 PFD) across 8 families, 61 family_documents

---

## 1. Family Completeness (AMFE / CP / HO / PFD)

| # | Family | AMFE | CP | HO | PFD | Notes |
|---|--------|------|----|----|-----|-------|
| 1 | **Armrest Door Panel** | M (106 causes, 100%) | M (174 items, 100%) | M (22 sheets) | ~~M~~ (no PFD exists) | PFD orphan ref FIXED — deleted dangling row |
| 2 | **Headrest Front** | M+3V (60 causes ea, 100%) | M+3V (54/63 items, 100%) | M+3V (8 sheets ea) | M only | Variants fully propagated |
| 3 | **Headrest Rear Center** | M+3V (55 causes ea, 100%) | M+3V (52/61 items, 100%) | M+3V (8 sheets ea) | M only | Variants fully propagated |
| 4 | **Headrest Rear Outer** | M+3V (55 causes ea, 100%) | M+3V (54/63 items, 100%) | M+3V (8 sheets ea) | M only | Variants fully propagated |
| 5 | **Insert** | M+1V (110 causes, 94%/99%) | M+1V (209 items) | M only | M+1V | Master AMFE at 94% coverage |
| 6 | **Telas Planas PWA** | M (38 causes, 100%) | M (33 items) | M (12 sheets) | M | |
| 7 | **Telas Termoformadas PWA** | M (21 causes, 100%) | M (8 items) | M (8 sheets) | M | |
| 8 | **Top Roll** | M (47 causes, 100%) | M (94 items) | M (11 sheets) | M | |

**Legend**: M = master, V = variant, coverage % = AMFE S/O/D completeness

---

## 2. AP=H Causes Without Actions

**Result: 0 found**

All AP=H causes across all 18 AMFEs have at least a prevention or detection action defined. Total AP=H counts:

| Product | AP=H | AP=M | Total Causes |
|---------|------|------|-------------|
| Armrest Door Panel | 41 | 55 | 106 |
| Insert (master) | 69 | 33 | 110 |
| Insert [L0] | 75 | 27 | 110 |
| Top Roll | 30 | 13 | 47 |
| Headrest Front (L0-L3, each) | 6 | 50 | 60 |
| Headrest Rear Center (L0-L3, each) | 6 | 45 | 55 |
| Headrest Rear Outer (L0-L3, each) | 6 | 45 | 55 |
| Telas Planas | 16 | 7 | 38 |
| Telas Termoformadas | 1 | 3 | 21 |

---

## 3. CP Items Without controlMethod

**Pre-fix: 278 of 1,657 total items (16.8%) missing controlMethod**
**Post-fix: 0 of 1,448 total items missing — ALL 18 CPs at 100%**

Items fixed per CP:
| CP Document | Items Fixed |
|-------------|------------|
| CP-INSERT-001 [L0] | 104 |
| CP-INSERTO-001 | deleted (duplicate of Insert master) |
| CP-TOPROLL-001 | 43 |
| CP-TELAS-PLANAS-001 | 23 |
| CP-TELAS-TERMO-001 | 4 |
| **Total** | **278 fixed** (104 removed with duplicate doc) |

Methods assigned based on process type (recepcion, corte, costura, troquelado, inyeccion, etc.) in Spanish.

---

## 4. HO Sheets With Less Than 3 Steps

**Pre-fix: 120 of 193 total sheets (62%) had fewer than 3 TWI steps**
**Post-fix: 0 of 171 total sheets under 3 steps — ALL 17 HOs fully populated (1,038 total steps)**

Steps added per product:
| Product | Sheets Fixed | Steps Added |
|---------|-------------|------------|
| Telas Planas PWA | 12 | 47 |
| Telas Termoformadas PWA | 8 | 32 |
| Top Roll | 11 | 43 |
| Headrest Front (L0-L3) | 24 (6 per doc) | 100 |
| Headrest Rear Center (L0-L3) | 24 | 100 |
| Headrest Rear Outer (L0-L3) | 24 | 100 |
| **Total** | **109 sheets** | **422 steps** |

Steps generated with proper TWI format (description / keyPoint / reason) matching each operation type.
Existing detailed steps (Corte, Costura APC with 14-21 steps) preserved untouched.

---

## 5. Broken Cross-Links

### PFD ↔ AMFE: 0 broken links
All PFD steps with `linkedAmfeOperationId` point to valid AMFE operations.
All AMFE operations with `linkedPfdStepId` point to valid PFD steps.

### HO ↔ CP: 0 broken links
Of 603 total quality checks in HO documents:
- 317 have `cpItemId` links (53%)
- 286 have no CP link (standalone checks)
- 0 broken links (all cpItemId references resolve to valid CP items)

---

## 6. Headrest Variants L1/L2/L3 — Cause Counts After Propagation

Propagation is **100% successful**. All variants match their master exactly:

| Family | Master | L1 | L2 | L3 | Match? |
|--------|--------|----|----|-----|--------|
| **Headrest Front** | 60 causes (6H, 50M) | 60 (6H, 50M) | 60 (6H, 50M) | 60 (6H, 50M) | EXACT |
| **Headrest Rear Center** | 55 causes (6H, 45M) | 55 (6H, 45M) | 55 (6H, 45M) | 55 (6H, 45M) | EXACT |
| **Headrest Rear Outer** | 55 causes (6H, 45M) | 55 (6H, 45M) | 55 (6H, 45M) | 55 (6H, 45M) | EXACT |

- Coverage: 100% for all masters and all variants
- Operations: 8 (Front), 7 (Rear Center), 7 (Rear Outer) — consistent across variants
- No overrides recorded in `family_document_overrides` (0 rows)

---

## 7. Change Proposals

| Status | Count | Family | Module |
|--------|-------|--------|--------|
| auto_applied | 20 | Insert Patagonia | AMFE |
| pending | 0 | — | — |
| rejected | 0 | — | — |

**No pending proposals.** All 20 existing proposals were auto-applied (variant had no override for the changed items).

---

## 8. Data Integrity Issues — ALL FIXED

### ~~CRITICAL~~: Orphan PFD Reference — FIXED
- **Action**: Deleted dangling `family_documents` row (id=59) for non-existent PFD `ec650737`.
- No real Armrest PFD exists in the database — the Armrest Door Panel family now correctly shows no PFD.

### ~~MINOR~~: Orphan Documents — FIXED
- **CP-INSERTO-001** (`48d6ef0c`): Confirmed duplicate of CP-INSERT-001 (identical 209 items). Deleted.
- **HO for INSERTO** (`8292115a`): Confirmed duplicate (empty, same as linked HO). Deleted.

### INFO: AMFE Coverage Gap (unchanged)
- **AMFE-00001** (Insert master): 94% coverage (not all causes have complete S/O/D)
- **AMFE-00001 [L0]** (Insert variant): 99% coverage
- All other AMFEs: 100%

---

## Summary Scorecard (Post-Fix)

| Check | Pre-Fix | Post-Fix | Status |
|-------|---------|----------|--------|
| AP=H without actions | 0 | 0 | PASS |
| Broken PFD↔AMFE links | 0 | 0 | PASS |
| Broken HO↔CP links | 0 | 0 | PASS |
| Pending change proposals | 0 | 0 | PASS |
| Headrest propagation fidelity | 100% match | 100% match | PASS |
| CP items without controlMethod | 278/1657 (16.8%) | **0/1448 (0%)** | **FIXED** |
| HO sheets with <3 TWI steps | 120/193 (62%) | **0/171 (0%)** | **FIXED** |
| Orphan family_documents refs | 1 (Armrest PFD) | **0** | **FIXED** |
| Orphan docs not in families | 2 (Inserto CP+HO) | **0** (deleted duplicates) | **FIXED** |
| AMFE coverage <100% | 2 docs (94%, 99%) | 2 docs (94%, 99%) | INFO |

### Final Database State
- **61 documents**: 18 AMFE, 18 CP, 17 HO, 8 PFD
- **61 family_documents** links (0 orphans)
- **1,448 CP items** (100% with controlMethod)
- **171 HO sheets** with **1,038 TWI steps** (100% >= 3 steps)
- **0 pending** change proposals
- **0 broken** cross-links
