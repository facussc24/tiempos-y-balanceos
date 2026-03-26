---
description: Reglas de acceso a datos y persistencia SQLite
globs:
  - "utils/repositories/**/*.ts"
  - "utils/database.ts"
  - "utils/storageManager.ts"
  - "utils/settingsStore.ts"
  - "hooks/useProjectPersistence.ts"
  - "modules/amfe/useAmfePersistence.ts"
  - "modules/amfe/useAmfeProjects.ts"
---

# Persistencia y Base de Datos

## Regla de Oro
**SIEMPRE usar repositorios tipados. NUNCA ejecutar SQL directo fuera de database.ts.**

## Repositorios (utils/repositories/)
| Repositorio | Tabla(s) | Uso |
|---|---|---|
| settingsRepository | settings | Key-value de config |
| projectRepository | projects | Proyectos de balanceo |
| amfeRepository | amfe_documents, amfe_library_operations | AMFE docs + biblioteca |
| cpRepository | cp_documents | Planes de Control |
| hoRepository | ho_documents | Hojas de Operaciones |
| pfdRepository | pfd_documents | Diagramas de Flujo |
| draftRepository | drafts | Auto-save unificado |
| revisionRepository | document_revisions, cross_doc_checks | Revisiones + alertas APQP |

## Patrones de Persistencia
- **Auto-save**: via `draftRepository` (SQLite), NUNCA IndexedDB
- **Guardado formal**: via repositorios (Supabase)
- **Settings**: `settingsStore.ts` delega a `settingsRepository`
- **UI state efimero** (tabs, filtros, columnas): localStorage (sync, no SQLite)
- **Session locks**: localStorage + BroadcastChannel (cross-tab)

## Race Conditions
- `useAmfeProjects.ts`: save mutex via `savingRef`, snapshot ANTES del await
- Draft recovery al startup, draft cleanup al save/delete
- SQLite WAL mode permite lecturas concurrentes

## Schema
- SCHEMA_VERSION 3 (12 tablas)
- Migraciones en `database.ts` (runMigrations)
