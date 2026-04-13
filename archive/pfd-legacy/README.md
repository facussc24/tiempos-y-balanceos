# PFD viejo (editor interactivo) — Archivo

**Archivado:** 2026-04-10
**Razon:** El modulo `modules/pfd/**` (editor interactivo table-based de Diagramas de Flujo) fue reemplazado por el **Flujograma Estatico nuevo** (`modules/flowchart/**`) el 2026-04-10. Los 7 documentos guardados en la tabla Supabase `pfd_documents` fueron migrados automaticamente al nuevo formato `flowchart_documents` via `scripts/migratePfdToFlowchart.mjs`.

## Contenido

```
archive/pfd-legacy/
├── README.md                      ← este archivo
├── pfd_documents_backup.json      ← dump completo de tabla Supabase pfd_documents (7 documentos)
├── migration-report.md            ← reporte detallado de la migracion PFD -> Flowchart (generado por script)
└── docs/
    └── GUIA_PFD_old.md            ← guia original del PFD viejo (formato interactivo)
```

## Motivacion del cambio

Fak incorporo un **nuevo formato estatico** de flujograma (`modules/flowchart/FlowchartApp.tsx`) que:
- Renderiza el flujo completo como componentes React puros (sin edicion tabular)
- Se edita via panel JSON lateral ("Base de Conocimiento Central")
- Exporta a PNG/SVG via html-to-image con el logo de empresa real
- Linkea 1:1 a un AMFE via `linkedAmfeProject` (string)

El PFD viejo editor era demasiado complejo para el workflow de Fak y ya no se usaba en produccion.

## Migracion aplicada

Se transformaron los 7 PFDs via script que mapea:

| PFD viejo | Flowchart nuevo |
|-----------|-----------------|
| `steps[].stepNumber` | `nodes[].stepId` |
| `steps[].name` | `nodes[].description` (uppercase) |
| `steps[].type: 'operation'` | `nodes[].type: 'operation'` |
| `steps[].type: 'inspection'` | `nodes[].type: 'inspection'` |
| `steps[].type: 'transport'` | `nodes[].type: 'transfer'` |
| `steps[].type: 'storage'` | `nodes[].type: 'storage'` |
| `steps[].type: 'decision'` | `nodes[].type: 'condition'` |
| `header.partName/partNumber` | `header.project/documentCode` |
| — | `productCodes[]` derivado de AMFE.header.applicableParts |

**Nota lossy**: los `linkedAmfeOperationId` (UUIDs que apuntaban a operaciones AMFE especificas) se pierden en la migracion porque el Flowchart nuevo linkea por `stepId` (numero de operacion como string). El validador `flowchartAmfeLinkValidation.ts` recupera la correspondencia por matching de `stepId === operationNumber`.

## Restaurar PFD viejo

Si por alguna razon hay que revertir la migracion:

1. Recrear tabla `pfd_documents` en Supabase con DDL del commit anterior
2. Importar datos desde `pfd_documents_backup.json`
3. Restaurar `modules/pfd/**` desde git history (`git checkout <commit> -- modules/pfd/`)
4. Restaurar `utils/pfdAmfeLinkValidation.ts`, `hooks/usePfdAmfeLinkAlerts.ts`, `utils/repositories/pfdRepository.ts`
5. Revertir cambios en `AppRouter.tsx`, `AmfeApp.tsx`, `AmfeTabBar.tsx`, `useAmfeTabNavigation.ts`

No se espera que esto sea necesario. El formato estatico nuevo cumple todos los casos de uso previos.

## Ver tambien

- `archive/control-plan/` — archivado paralelo del Plan de Control
- `modules/flowchart/` — modulo nuevo activo
- `docs/GUIA_FLUJOGRAMA.md` — guia del formato nuevo
