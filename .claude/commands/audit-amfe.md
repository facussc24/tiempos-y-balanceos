---
name: audit-amfe
description: Audit AMFE documents in Supabase for data integrity, AIAG-VDA compliance, and cross-document coherence. Use this whenever you need to verify AMFE data quality — after enrichments, fix scripts, data migrations, or when the user asks to check/audit/verify AMFEs. Accepts an optional product filter (e.g., "ARMREST", "PWA").
---

# Auditar AMFE en Supabase

Run a comprehensive audit of AMFE documents in Supabase. If an argument is provided, filter to matching products; otherwise audit ALL 8 AMFEs.

## Connection

Connect to Supabase using `.env.local` credentials (same pattern as all project scripts).

## Audit Checklist

For EACH AMFE, verify all of the following:

### A. Data Integrity
- `typeof data === 'object'` (NOT string — double-serialization bug, see `.claude/rules/database.md`)
- `data.operations` is an array
- Count operations, work elements, failures, causes
- No operations with 0 work elements

### B. AMFE Rules (from `.claude/rules/amfe.md`)
- Operation names in UPPERCASE
- All text in Spanish (no English in parentheses)
- VDA 3-level effects complete (effectLocal, effectNextLevel, effectEndUser)
- S/O/D in range 1-10 for all causes
- AP matches AIAG-VDA official table (from `modules/amfe/apTable.ts`), NOT S*O*D formula
- CC only for S>=9 or flamabilidad/seguridad/legal
- Flamabilidad present as CC in all interior cabin products
- Correct norm per client (TL 1010 for VW only, NOT for PWA)

### C. 1M Per Line Rule
- Each Work Element is ONE single item (no "/" groupings)
- Direct materials in process ops only if interaction risk exists

### D. Actions (CRITICAL — `.claude/rules/amfe-actions.md`)
- ALL action fields EMPTY: preventionAction, detectionAction, responsible, targetDate, status
- Any non-empty action = CRITICAL failure

### E. Cross-Document Coherence
- Compare operation names: AMFE vs CP, AMFE vs PFD, AMFE vs HO
- Report mismatches

## Output

Generate a PASS/FAIL report per product with details per section. List corrective actions for any failures.
