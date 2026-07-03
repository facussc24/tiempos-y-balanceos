---
description: Persistencia, repositorios tipados y scripts que tocan Supabase
paths:
  - "utils/repositories/**"
  - "utils/database.ts"
  - "utils/storageManager.ts"
  - "utils/settingsStore.ts"
  - "hooks/useProjectPersistence.ts"
  - "modules/amfe/useAmfePersistence.ts"
  - "modules/amfe/useAmfeProjects.ts"
  - "scripts/**"
---

# Persistencia y Base de Datos

**Regla de oro:** SIEMPRE repositorios tipados (`utils/repositories/`, 17 repos via index.ts). NUNCA SQL directo fuera de database.ts.

**Iron Law (regla `verify-supabase-live.md`):** el estado actual de cualquier doc APQP se afirma SOLO con query a Supabase live. Dumps de `tmp/`/`backups/`/docs viejos son fotos historicas.

## Patrones
- Auto-save: `draftRepository`. Guardado formal: repositorios (Supabase). Settings: `settingsStore` → `settingsRepository`. UI efimero (tabs, filtros): localStorage. Locks multi-tab: localStorage + BroadcastChannel.
- Race conditions: `useAmfeProjects.ts` usa save mutex (`savingRef`) + snapshot ANTES del await. Draft recovery al startup, cleanup al save/delete.

## Scripts .mjs que modifican Supabase — obligatorio
1. **NUNCA double-serializar JSONB**: `.update({ data: objeto })` con el objeto directo, JAMAS `JSON.stringify(objeto)` (la app leeria un string y `data.operations` seria undefined). Verificar despues: `typeof doc.data === 'object'`.
2. **AP solo con la tabla oficial** `calculateAP` (`modules/amfe/apTable.ts`); prohibida la formula S*O*D.
3. **Gate `runWithValidation()`** de `scripts/_lib/dryRunGuard.mjs` para todo script que toque `amfe_documents.data` (dry-run → review → --apply). Detalle: regla `amfe.md` §14 y skill `supabase-safety`.
4. **Verificacion post-script**: `data` es objeto (no string); `data.operations` (AMFE) / `data.items` (CP) son arrays; conteos esperados; backup con `node scripts/_backup.mjs`.
