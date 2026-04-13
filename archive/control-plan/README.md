# Plan de Control — Archivo

**Archivado:** 2026-04-10
**Razon:** El modulo Plan de Control (CP) fue deprecado del pipeline APQP de Barack Mercosul por decision de Fak. Las relaciones cruzadas entre AMFE, CP y HO fueron eliminadas del codebase vivo para dejar el flujo APQP mas simple: `AMFE -> HO` directo, sin intermediario CP.

## Contenido

```
archive/control-plan/
├── README.md                       ← este archivo
├── RESTORE.md                      ← como restaurar el modulo si se reactiva
├── cp_documents_backup.json        ← dump completo de tabla Supabase cp_documents (8 documentos)
├── docs/
│   ├── GUIA_PLAN_DE_CONTROL.md    ← guia de autoria original
│   ├── CAUSA_RAIZ_DUPLICADOS_CP.md ← post-mortem duplicados 2026-03-30
│   └── ARQUITECTURA_CAMPOS_HEREDADOS.md ← campos heredados vs locales (CP/HO)
├── rules/
│   └── control-plan.md            ← reglas de negocio CP (AIAG CP 2024)
└── scripts/
    ├── fixCpMaterials.mjs         ← fill de componentMaterial en items de recepcion
    ├── auditCrossDoc.mjs          ← auditoria cascada AMFE->CP->HO
    ├── fixReactionPlan.mjs        ← normalizacion plan de reaccion
    ├── fixPostAudit2026_03_30.mjs ← correcciones post-auditoria
    ├── fixPwaAudit_v2.mjs         ← fixes PWA CP v2
    └── fixPwaAudit_v3.mjs         ← fixes PWA CP v3
```

## Que NO esta en el archivo

- El codigo del modulo `modules/controlPlan/**` (31 archivos TS/TSX) — ya habia sido eliminado del filesystem antes de este archivado. Si en el futuro se reactiva, hay que recuperar los archivos desde el historial de git (`git log --all -- modules/controlPlan/`) o reescribirlos desde cero usando las reglas en `rules/control-plan.md`.
- Los archivos `utils/hoCpLinkValidation.ts`, `hooks/useHoCpLinkAlerts.ts`, `components/ui/HoCpLinkValidationPanel.tsx` fueron eliminados definitivamente. Su contenido no se preservo porque tenian tipos inline obsoletos.

## Estado de la tabla Supabase

La tabla `cp_documents` fue DROPEADA de Supabase luego de este backup. El script que la eliminaba se corrio el 2026-04-10 despues de verificar que el backup JSON estaba completo. Si se reactiva el modulo, recrear la tabla con el DDL de `archive/control-plan/rules/control-plan.md` + importar los documentos desde `cp_documents_backup.json`.

## Ver tambien

- `archive/pfd-legacy/` — archivado paralelo del PFD viejo (reemplazado por Flujograma Estatico)
- `archive/control-plan/RESTORE.md` — pasos detallados de restauracion
