# Restaurar modulo Plan de Control

Este documento describe los pasos para reactivar el modulo Plan de Control si Fak o el equipo APQP deciden volver a usarlo.

## Prerequisitos

- Acceso al historial git del proyecto (el modulo `modules/controlPlan/**` existia en commits anteriores al 2026-03-20 aprox.)
- Acceso a Supabase (para recrear tabla y importar datos)
- Entender que este rollback es disruptivo: toca HO, types, exports, tests, docs

## Paso 1: Recuperar codigo del modulo desde git

```bash
# Encontrar el ultimo commit que tenia el modulo
git log --all --oneline -- modules/controlPlan/

# Restaurar carpeta al estado de ese commit
git checkout <commit-hash> -- modules/controlPlan/
git checkout <commit-hash> -- utils/repositories/cpRepository.ts
git checkout <commit-hash> -- utils/hoCpLinkValidation.ts
git checkout <commit-hash> -- hooks/useHoCpLinkAlerts.ts
git checkout <commit-hash> -- components/ui/HoCpLinkValidationPanel.tsx
```

## Paso 2: Recrear tabla en Supabase

Ejecutar el DDL (referenciar `utils/database.ts` del commit anterior):

```sql
CREATE TABLE IF NOT EXISTS cp_documents (
    id TEXT PRIMARY KEY,
    project_name TEXT,
    control_plan_number TEXT,
    phase TEXT,
    part_number TEXT,
    part_name TEXT,
    organization TEXT,
    client TEXT,
    responsible TEXT,
    revision TEXT,
    linked_amfe_project TEXT,
    linked_amfe_id TEXT,
    item_count INTEGER,
    created_at TEXT,
    updated_at TEXT,
    created_by TEXT,
    updated_by TEXT,
    data JSONB,
    checksum TEXT
);

CREATE INDEX idx_cp_project_name ON cp_documents(project_name);
CREATE INDEX idx_cp_client ON cp_documents(client);
CREATE INDEX idx_cp_updated ON cp_documents(updated_at DESC);
CREATE INDEX idx_cp_linked_amfe ON cp_documents(linked_amfe_id);
```

## Paso 3: Importar datos desde backup JSON

```bash
node scripts/_restoreFromBackup.mjs \
    --table cp_documents \
    --file archive/control-plan/cp_documents_backup.json
```

(Crear este script si no existe — debe leer el JSON, parsear cada row, hacer upsert en Supabase preservando IDs)

## Paso 4: Restaurar referencias en HO

El modulo `modules/hojaOperaciones/` fue modificado el 2026-04-10 para NO depender del CP. Hay que revertir esos cambios:

- `hojaOperacionesTypes.ts` — reagregar campos `cpItemId`, `linkedCpOperationNumber` a `QcItem`
- `hojaOperacionesGenerator.ts` — reagregar firma `generateHoFromAmfeAndCp(amfe, cp, project)`
- `useHojaOperaciones.ts` — reinstalar carga del CP linkeado
- `HojaOperacionesApp.tsx` — reagregar `<HoCpLinkValidationPanel />`
- `HoQualityCheckTable.tsx` — reagregar columna/badge de linked CP item

Ver el commit que aplico la limpieza (buscar commit message "archive CP module") para diffs exactos.

## Paso 5: Restaurar exports y validacion cruzada

- `modules/family/apqpPackageExport.ts` — reincluir CP en el zip APQP
- `utils/crossDocumentAlerts.ts` — reagregar cascada `amfe -> cp -> ho`
- `utils/seed/seedApqpDocuments.ts` — reactivar `saveCpDocument`
- `utils/dataExportImport.ts` — reagregar `cp_documents` al registry
- `utils/mergeEngine.ts` — reagregar CP

## Paso 6: Restaurar navegacion UI

- `AppRouter.tsx` — agregar `currentMode === 'cp'` con CP lazy-loaded
- `components/layout/AppSidebar.tsx` — reagregar entrada "Plan de Control"
- `modules/amfe/AmfeTabBar.tsx` — reagregar tab `cp` si era parte de AmfeApp
- `CLAUDE.md` — reagregar la seccion "Plan de Control" al mapa de tablas

## Paso 7: Restaurar tests

Recuperar desde git:
- `__tests__/utils/hoCpLinkValidation.test.ts`
- Tests internos del modulo CP

Y actualizar los tests modificados el 2026-04-10 para reincluir assertions CP.

## Paso 8: Verificar

```bash
npx tsc --noEmit            # cero errores
npx vitest run              # todos verdes
npm run dev                  # dev server arranca
# Manual: abrir tab CP, verificar listado de 8 documentos
```

## Alternativa: reescribir desde cero

Si el historial git es inaccesible o el modulo restaurado tiene deuda tecnica, reescribir desde cero usando:
- `archive/control-plan/rules/control-plan.md` como specification
- `archive/control-plan/docs/GUIA_PLAN_DE_CONTROL.md` como guia de autoria
- `archive/control-plan/cp_documents_backup.json` como fixtures de test
