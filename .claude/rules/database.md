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

**Regla de oro:** SIEMPRE repositorios tipados (`utils/repositories/`, via index.ts). NUNCA SQL directo fuera de database.ts.

**Iron Law (regla `verify-supabase-live.md`):** el estado actual de cualquier doc APQP se afirma SOLO con query a Supabase live. Dumps de `tmp/`/`backups/`/docs viejos son fotos historicas.

## Patrones
- Auto-save: `draftRepository`. Guardado formal: repositorios (Supabase). Settings: `settingsStore` → `settingsRepository`. UI efimero (tabs, filtros): localStorage. Locks multi-tab: localStorage + BroadcastChannel.
- Race conditions: `useAmfeProjects.ts` usa save mutex (`savingRef`) + snapshot ANTES del await. Draft recovery al startup, cleanup al save/delete.

## Scripts .mjs que modifican Supabase — obligatorio
1. **`data` es TEXT: se escribe con `JSON.stringify(objeto)`** en `amfe/cp/ho/pfd_documents` (verificado contra Supabase live el 11/09/2026; los repositorios de la app hacen lo mismo). Mandar el objeto crudo deja el documento ilegible. Lo que sigue prohibido es **double-serializar**: un JSON adentro de otro, que es lo que `parseData()` de `_lib/amfeIo.mjs` desarma al leer.
2. **AP solo con la tabla oficial** `calculateAP` (`modules/amfe/apTable.ts`); prohibida la formula S*O*D.
3. **Gate `runWithValidation()`** de `scripts/_lib/dryRunGuard.mjs` para todo script que toque `amfe_documents.data` (dry-run → review → --apply). Detalle: regla `amfe.md` §14 y skill `supabase-safety`.
4. **Verificacion post-script**: `JSON.parse(data)` devuelve un objeto (no otro string); `data.operations` (AMFE) / `data.items` (CP) son arrays; conteos esperados; backup con `node scripts/_backup.mjs`. Los `save*()` de `_lib/amfeIo.mjs` ya hacen esta relectura.
