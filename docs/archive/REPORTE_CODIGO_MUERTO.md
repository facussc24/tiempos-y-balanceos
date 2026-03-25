# Reporte de Codigo Muerto y Dependencias No Usadas — 2026-03-22

## Dependencias No Usadas en package.json

### Para Remover (3 paquetes)

| Paquete | Version | Motivo |
|---------|---------|--------|
| `@tanstack/react-virtual` | ^3.13.22 | 0 imports en todo el codebase — libreria de virtualizacion sin uso |
| `simscript` | ^1.0.37 | 0 imports en todo el codebase — simulador de flujo no implementado con esta lib |
| `@types/uuid` | ^10.0.0 | Redundante — uuid v13+ trae sus propios tipos TypeScript |

### Dependencias Usadas (13 paquetes — todas activas)

| Paquete | Imports | Uso |
|---------|---------|-----|
| `@dnd-kit/core` | 5 | Drag-and-drop en balanceo y HO |
| `@dnd-kit/sortable` | 1 | Listas ordenables en HoStepEditor |
| `@dnd-kit/utilities` | 3 | CSS transforms para DnD |
| `@supabase/supabase-js` | 3 | Auth + sync con Supabase |
| `dompurify` | 2 | Sanitizacion XSS |
| `exceljs` | 4 | Export HO con imagenes |
| `html2pdf.js` | dinamico | Export PDF via iframe |
| `lucide-react` | 192 | Iconos en toda la UI |
| `react` | 280+ | Framework core |
| `react-dom` | 8 | Rendering React |
| `recharts` | 5 | Graficos en dashboards |
| `uuid` | 23 | Generacion de IDs |
| `xlsx-js-style` | 6 | Export AMFE/CP/PFD a Excel |

## Componentes React Sin Uso

No se encontraron componentes huerfanos significativos. Todos los modulos en AppRouter.tsx estan activos:
- AmfeApp, ControlPlanApp, HojaOperacionesApp, PfdApp (APQP core)
- DocumentHub, FamilyManager (gestion documental)
- TiemposApp, Dashboard, FlowSimulator, etc. (lean manufacturing)
- AdminPanel, PfdTestRoute, PfdSvgAudit (herramientas dev/audit)

## Exports No Usados

No se identificaron exports significativos sin uso. Los modulos principales exponen APIs coherentes que se consumen internamente.

## Acciones Recomendadas

1. **Remover `@tanstack/react-virtual`** de package.json (ahorro ~50KB en node_modules)
2. **Remover `simscript`** de package.json (ahorro ~100KB)
3. **Mover `@types/uuid`** a devDependencies o remover (uuid v13 trae tipos)
4. **NO se recomienda borrar ningun archivo** — todo el codigo fuente esta en uso
