# Snapshot de archivado — Plan de Control

**Fecha:** 2026-04-10
**Ejecutado por:** Claude Code (sesion de Fak)
**Backup previo:** `backups/2026-04-10T12-40-17/` (rows: amfe=10, cp=8, ho=8, pfd=7, products=488, families=9)

## Items archivados

| Categoria | Cantidad | Ruta destino |
|-----------|----------|--------------|
| Documentos Supabase cp_documents | 8 | `archive/control-plan/cp_documents_backup.json` |
| Docs markdown | 3 | `archive/control-plan/docs/` |
| Reglas `.claude/rules/` | 1 | `archive/control-plan/rules/` |
| Scripts historicos | 6 | `archive/control-plan/scripts/` |

### Documentos Markdown archivados

- `GUIA_PLAN_DE_CONTROL.md` — guia de autoria CP
- `CAUSA_RAIZ_DUPLICADOS_CP.md` — post-mortem incidente 2026-03-30
- `ARQUITECTURA_CAMPOS_HEREDADOS.md` — campos heredados vs locales (CP/HO)

### Reglas archivadas

- `control-plan.md` — reglas de negocio CP (AIAG CP 2024, cross-validation, filtrado AMFE->CP->HO)

### Scripts archivados

- `fixCpMaterials.mjs` — llena componentMaterial en items de recepcion
- `auditCrossDoc.mjs` — auditoria cascada AMFE->CP->HO
- `fixReactionPlan.mjs` — normalizacion reaction plan
- `fixPostAudit2026_03_30.mjs` — fixes post-auditoria
- `fixPwaAudit_v2.mjs` — fixes PWA CP v2
- `fixPwaAudit_v3.mjs` — fixes PWA CP v3

## Referencias cortadas en codigo vivo

Los siguientes archivos fueron ELIMINADOS del codebase y NO se preservaron (tenian tipos inline obsoletos o eran glue code):

- `utils/hoCpLinkValidation.ts`
- `hooks/useHoCpLinkAlerts.ts`
- `components/ui/HoCpLinkValidationPanel.tsx`
- `__tests__/utils/hoCpLinkValidation.test.ts`

Los siguientes archivos fueron MODIFICADOS para remover referencias CP:

- `modules/hojaOperaciones/hojaOperacionesTypes.ts` — campos `cpItemId`, `linkedCpOperationNumber`, `amfeCauseIds` removidos de `QcItem`
- `modules/hojaOperaciones/hojaOperacionesGenerator.ts` — refactor `generateHoFromAmfeAndCp` -> `generateHoFromAmfe`
- `modules/hojaOperaciones/useHojaOperaciones.ts` — hook sin dependencia CP
- `modules/hojaOperaciones/HojaOperacionesApp.tsx` — sin panel CP
- `modules/hojaOperaciones/HoQualityCheckTable.tsx` — sin columna linked CP
- `modules/hojaOperaciones/hojaOperacionesPdfExport.ts` — sin referencias CP
- `modules/amfe/useAmfeTabNavigation.ts` — llama a nueva firma generateHoFromAmfe
- `modules/family/apqpPackageExport.ts` — CP removido del zip
- `utils/seed/seedApqpDocuments.ts` — stub saveCpDocument eliminado
- `utils/dataExportImport.ts`, `utils/mergeEngine.ts` — sin cp_documents
- `utils/database.ts` — migracion DROP TABLE cp_documents
- `modules/DataManager.tsx` — seccion CP removida
- `CLAUDE.md` — seccion CP removida

## Tabla Supabase

La tabla `cp_documents` fue DROPEADA como parte de la migracion de `utils/database.ts`. El backup JSON contiene todos los 8 documentos para restauracion futura.

## Estado esperado post-archivado

- `grep -r "cp_documents\|cpItemId\|ControlPlan\|PlanControl" --include="*.ts" --include="*.tsx"` -> cero resultados fuera de `archive/`
- `npx tsc --noEmit` -> sin errores relacionados a CP
- App sigue funcionando: AMFE, HO (standalone), Flowchart

## Recovery

Ver `RESTORE.md` en esta misma carpeta.
