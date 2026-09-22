---
name: audit-amfe
description: Audit AMFE documents in Supabase for data integrity, AIAG-VDA compliance, and cross-document coherence. Use this whenever you need to verify AMFE data quality — after enrichments, fix scripts, data migrations, or when the user asks to check/audit/verify AMFEs. Accepts an optional product filter (e.g., "ARMREST", "PWA").
---

# Auditar AMFE en Supabase

Run a comprehensive audit of AMFE documents in Supabase. If an argument is provided, filter to matching products; otherwise audit ALL AMFEs (count them live — 20 on 22/09/2026).

## Connection

Connect to Supabase using `.env.local` credentials (same pattern as all project scripts).

## Audit Checklist

For EACH AMFE, verify all of the following:

### A. Data Integrity
- `data` is TEXT and `JSON.parse(data)` returns an object, not another string (double-serialization bug, `.claude/rules/database.md` §1)
- `data.operations` is an array
- Count operations, work elements, failures, causes
- No operations with 0 work elements

### B. AMFE Rules (from `.claude/rules/amfe.md`)
- Operation names in UPPERCASE
- All text in Spanish (no English in parentheses)
- VDA 3-level effects complete (effectLocal, effectNextLevel, effectEndUser)
- S/O/D in range 1-10 for all causes
- AP matches `calculateAP` (`modules/amfe/apTable.ts`), NOT S*O*D formula (the table's own source is under review, memory `project_tabla_ap_de_la_casa_es_el_borrador_2017`: report, don't recalculate)
- Special characteristics ONLY by S and O of that cause (`.claude/rules/caracteristicas-especiales.md`): CC = S 9-10, SC = S 5-8 and O >= 4. No exemption by words (flamabilidad/seguridad/legal in the text do not make a CC). Assigning is Fak's: report, never set
- A regulatory effect (flamabilidad TL 1010, VOC, ELV) has S=9 by AIAG-VDA Table P1: report it if the S is lower
- Correct norm per client (TL 1010 for VW only, NOT for PWA)

### C. 1M Per Line Rule
- Each Work Element is ONE single item (no "/" groupings)
- Direct materials in process ops only if interaction risk exists

### D. Actions (`.claude/rules/amfe.md` §4-§5)
- Actions are defined by the APQP team: a filled action is NOT a failure, and an AP=H with the action EMPTY is a valid state (not reported, not counted)
- CRITICAL only: the banned placeholder `Pendiente definicion equipo APQP` in any field (§4, since 21/09/2026), or an action Claude wrote that no one dictated (§5)

### E. Cross-Document Coherence
- Compare operation names: AMFE vs CP (PFD/HO son referencia historica, no auditar)
- Report mismatches

## Output

Generate a PASS/FAIL report per product with details per section. List corrective actions for any failures.
