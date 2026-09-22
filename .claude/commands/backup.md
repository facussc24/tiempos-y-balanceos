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
This saves a JSON snapshot of every table to `backups/YYYY-MM-DDTHH-MM-SS/` and writes
`_manifest.json`. The script itself compares, table by table, the rows it expected (live
inventory) against the rows it saved: a line with `X` or `DESCUADRE` is the alert. Do not
compare against fixed counts — the number of documents changes every week.

### 2. Verify data integrity

Connect to Supabase and check every APQP document:

For each document type, verify:
- `data` is TEXT: `JSON.parse(data)` returns an object, not another string (a JSON inside a
  JSON is the double-serialization bug — `.claude/rules/database.md` §1, verified live 11/09/2026)
- The main array exists and is an array:
  - AMFEs: `data.operations`
  - CPs: `data.items`
  - HOs: `data.sheets`
  - PFDs: `data.steps`

### 3. Verify counts
- Read the script output: `✓ Backup valido` = every table matched. Any `X` / `DESCUADRE` → ALERT.
- Compare against the previous `backups/*/_manifest.json`: a table that LOST rows since the last
  backup needs an explanation (a delete this session did on purpose) before closing.

### 4. Report

```
=== BACKUP + INTEGRIDAD ===
Backup: backups/YYYY-MM-DDTHH-MM-SS/
Tablas: N | Filas: XXX

INTEGRIDAD:
✅ N/N AMFEs: data parsea a objeto, operations es array
✅ N/N CPs: data parsea a objeto, items es array
✅ N/N HOs: data parsea a objeto, sheets es array
✅ N/N PFDs: data parsea a objeto, steps es array
⚠️ [alertas si hay]
```
