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
| projectRepository | projects, recent_projects | Proyectos de balanceo |
| amfeRepository | amfe_documents, amfe_library_operations | AMFE docs + biblioteca |
| cpRepository | cp_documents | Planes de Control |
| hoRepository | ho_documents | Hojas de Operaciones |
| pfdRepository | pfd_documents | Diagramas de Flujo |
| draftRepository | drafts | Auto-save unificado |
| revisionRepository | document_revisions, cross_doc_checks | Revisiones + alertas APQP |
| familyRepository | product_families, product_family_members | Familias de producto |
| familyDocumentRepository | family_documents, family_document_overrides, family_change_proposals | Docs familia |
| productRepository | products, customer_lines | Catálogo productos |
| solicitudRepository | solicitud_documents | Solicitudes |
| documentLockRepository | document_locks | Locks multi-tab |
| pendingExportRepository | pending_exports | Cola de exports |
| crossDocRepository | cross_doc_checks | Alertas cruzadas |
| adminRepository | (Supabase RPC) | Admin panel |

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
- SCHEMA_VERSION 14 (25 tablas incluyendo views)
- Migraciones en `database.ts` (runMigrations)

## Scripts que modifican Supabase — reglas obligatorias

### NUNCA double-serializar JSONB
- Las columnas `data` de amfe_documents, cp_documents, ho_documents, pfd_documents son JSONB.
- Al hacer `.update({ data: objeto })`, pasar el OBJETO JavaScript directo. NUNCA hacer `.update({ data: JSON.stringify(objeto) })`.
- `JSON.stringify()` convierte el objeto a string, y Supabase lo guarda como string dentro de JSONB = double-serialized.
- La app lee `doc.data.operations` y recibe `undefined` porque `data` es un string, no un objeto.
- **Incidente 2026-04-06:** 8 AMFEs quedaron ilegibles por double-serialization. El auditor lo detecto.
- **Verificacion obligatoria:** Despues de cualquier `.update({ data })` en scripts, verificar con `typeof doc.data === 'object'`.

### SIEMPRE usar tabla AP oficial para calcular Action Priority
- NUNCA usar formulas simplificadas como `S * O * D > umbral` para calcular AP.
- La tabla AP oficial esta en `modules/amfe/apTable.ts` → funcion `calculateAP(s, o, d)`.
- Si el script es .mjs y no puede importar .ts, COPIAR la tabla de lookup completa (ver `docs/GUIA_AMFE.md` seccion 6).
- **Incidente 2026-04-06:** 56 causas tenian AP incorrecto por usar formula S*O*D. Un item de seguridad S=10 quedo como M en vez de H.

### Verificacion post-script obligatoria
Despues de ejecutar cualquier script que modifique documentos APQP en Supabase:
1. Verificar `typeof data === 'object'` (no string) para documentos modificados
2. Verificar que `data.operations` (AMFE), `data.items` (CP), `data.sheets` (HO), `data.steps` (PFD) sean arrays
3. Contar operaciones/items/sheets y comparar con lo esperado
4. Hacer backup con `node scripts/_backup.mjs`
