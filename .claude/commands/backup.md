---
name: backup
description: Run a Supabase backup and verify data integrity of all APQP documents. Use this at the end of every session, after running fix/enrichment scripts, or whenever the user says "backup", "hacer backup", or "guardar snapshot". This is a mandatory end-of-session step per project rules.
---

# Backup Supabase + Verificacion de Integridad

Run a full backup of all Supabase tables and verify data integrity.

## Steps

### 1. Run backup script
```bash
node scripts/_backup.mjs
```
This saves a JSON snapshot of all 12 tables to `backups/YYYY-MM-DDTHH-MM-SS/`.

### 2. Verify data integrity

Connect to Supabase and check every APQP document:

For each document type, verify:
- `typeof data === 'object'` (NOT string — catches double-serialization)
- The main array exists and is an array:
  - AMFEs: `data.operations`
  - CPs: `data.items`
  - HOs: `data.sheets`
  - PFDs: `data.steps`

### 3. Verify expected counts
- 8 amfe_documents (6 VWA + 2 PWA)
- 8 cp_documents
- 8 ho_documents
- 6 pfd_documents
- 8 product_families
- If any count is wrong, ALERT immediately

### 4. Report

```
=== BACKUP + INTEGRIDAD ===
Backup: backups/YYYY-MM-DDTHH-MM-SS/
Tablas: 12 | Filas: XXX

INTEGRIDAD:
✅ 8/8 AMFEs: data es objeto, operations es array
✅ 8/8 CPs: data es objeto, items es array
✅ 8/8 HOs: data es objeto, sheets es array
✅ 6/6 PFDs: data es objeto, steps es array
⚠️ [alertas si hay]
```
