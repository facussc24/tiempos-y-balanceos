# Barack Mercosul - Tiempos y Balanceos

App 100% web React 19 + TypeScript + Supabase para gestion de calidad automotriz
(AMFE VDA, Plan de Control AIAG, Hojas de Operaciones) y lean manufacturing
(balanceo de linea, simulador de flujo, kanban, heijunka, mix multi-modelo).
Multi-usuario con auth Supabase (email/password). Sin Tauri, sin Gemini.

## Stack

| Capa         | Tecnologia                                          |
|--------------|-----------------------------------------------------|
| Runtime      | React 19.2, TypeScript 5.8, Vite 6                  |
| Auth + DB    | Supabase (@supabase/supabase-js) + SQLite (sql.js)  |
| Testing      | Vitest 4.x + @testing-library/react + jsdom         |
| Styling      | TailwindCSS 3.4                                     |
| Export       | ExcelJS, html2pdf.js                                |
| Charts       | Recharts 3.4                                        |
| DnD          | @dnd-kit/core                                       |

## Comandos

```bash
npm run dev          # Vite dev server (localhost:3000)
npx vitest run       # Correr todos los tests
npx vitest run --coverage  # Tests con coverage (v8)
npm run build        # Build de produccion
npx tsc --noEmit     # Chequeo de tipos
```

## Estructura del proyecto

```
/                       Raiz del proyecto (NO hay carpeta src/ principal)
  App.tsx               Entry point
  AppRouter.tsx         Routing con lazy loading
  types.ts              Tipos compartidos (~1500 lineas)
  config.ts             Configuracion global
  index.tsx             React root

  components/           UI reutilizable
    auth/               AuthProvider, LoginPage (Supabase auth)
    ui/                 Componentes base (Button, Input, Modal, etc.)
    modals/             ConfirmModal, ExportModal, etc.
    layout/             AppShell, Sidebar, Header
    charts/             Wrappers de Recharts
    navigation/         DropdownNav, Breadcrumbs
    landing/            Landing page components

  core/                 Motores de calculo
    balancing/          Algoritmos de balanceo (SALBP-1, SALBP-2, COMSOAL, etc.)
    math/               Funciones matematicas
    services/           Servicios de negocio
    config/             Configuracion de core
    inheritance/        Herencia maestro→variante (familias de producto)
      documentInheritance.ts   Clonado de docs maestro→variante (UUID regen)
      overrideTracker.ts       Diff variante vs maestro + persistencia overrides
      triggerOverrideTracking.ts  Fire-and-forget post-save para variantes
      changePropagation.ts     Propagacion cambios maestro→variantes (proposals)

  hooks/                18 custom hooks
    useLineBalancing    Motor principal de balanceo
    useProjectPersistence  Guardado a filesystem + SQLite auto-save
    useUndoRedo         Undo/redo con snapshots
    useSessionLock      Lock de sesion en red

  modules/              Modulos de negocio
    amfe/               AMFE VDA + validacion cruzada con PFD
    controlPlan/        Plan de Control AIAG + cross-validation (V1-V5) + link HO
    hojaOperaciones/    Hojas de operaciones (navy theme, ISO PPE) + link CP
    pfd/                Diagrama de Flujo del Proceso (cyan theme, ASME symbols) + link AMFE
    family/             Familias de producto (ChangeProposalPanel, useChangeProposals)
    mix/                Mix multi-modelo
    flow-simulator/     Simulador de flujo (SimScript)
    heijunka/           Nivelado heijunka
    kanban/             Tablero kanban
    balancing/          UI de balanceo
    dashboard/          Dashboard ejecutivo
    logistics-backlog/  Backlog logistico

  utils/                Utilidades
    database.ts         Singleton SQLite, schema DDL, migraciones, adapters
    repositories/       9 repositorios tipados (CRUD sobre SQLite)
      settingsRepository.ts        Key-value de configuracion
      projectRepository.ts         Proyectos de balanceo
      amfeRepository.ts            Documentos AMFE + biblioteca
      cpRepository.ts              Planes de Control
      hoRepository.ts              Hojas de Operaciones
      pfdRepository.ts             Diagramas de Flujo (PFD)
      draftRepository.ts           Borradores auto-save unificados
      familyRepository.ts          Familias de producto + miembros
      familyDocumentRepository.ts  Docs familia, overrides, change proposals
    supabaseClient.ts   Singleton Supabase client
    pfdAmfeLinkValidation.ts   Validacion cruzada PFD ↔ AMFE
    hoCpLinkValidation.ts      Validacion cruzada HO ↔ CP
    crossDocumentAlerts.ts     Alertas APQP cascade (PFD→AMFE→CP→HO)
    storageManager.ts   Settings de storage (delega a settingsRepository)
    unified_fs.ts       Abstraccion filesystem (web)
    logger.ts           Logger centralizado
    settingsStore.ts    Settings (delega a settingsRepository)
    crypto.ts           Hashing para integridad
    networkUtils.ts     Deteccion de red
    processCategory.ts  Inferencia de categoria de proceso

  __tests__/            460+ archivos de test (3964 tests)

  src/                  Assets y datos
    assets/             Imagenes, iconos PPE, logo
    data/               Datos estaticos (SGC catalog)
```

## Estandares de calidad

### Mentalidad
- **Nivel senior obligatorio**: nunca entregar algo que no aprobaria un ingeniero de software senior.
- **Cero esfuerzo minimo**: si encontras un bug, busca si hay mas del mismo patron en todo el codebase.
  Ejemplo: si `Math.max(...arr)` puede recibir NaN, busca TODOS los Math.max del proyecto.
- **Verificar antes de editar**: lee el codigo completo, entende el flujo, recien ahi modifica.
  Los fixes basados en suposiciones son peores que no hacer nada.
- **Subagentes no son infalibles**: ~40-50% de hallazgos de audit agents son false positives.
  Siempre verificar manualmente trazando la ejecucion real del codigo antes de aplicar.
- **Cada fix debe mejorar legibilidad**: si un fix agrega complejidad sin valor, no aplicar.
- **Correr tests despues de cada batch de cambios**: `npx vitest run`. No commitear si fallan.
- **NO fixes cosmeticos**: no perder tiempo en acentos/tildes, renombrar variables por estilo,
  o reformatear codigo. Enfocarse en logica, formulas, data flow, race conditions.

### Modo autonomo (deep audits)
- Trabajar sin parar hasta agotar el contexto.
- Usar subagentes para escaneo de archivos (reduce contaminacion del contexto principal).
- Priorizar modulos: PFD, AMFE, HO, Plan de Control, core/balancing.
- Clasificar hallazgos: TRUE BUG > ROBUSTNESS > FALSE POSITIVE.
- Ante la duda, NO aplicar el fix. Es mejor dejar codigo correcto intacto.

### Reglas de codigo
- **Usar repositorios para acceso a datos, nunca SQLite directo** — importar de `utils/repositories/`
- **NO hardcodear API keys** en codigo fuente. Usar variables de entorno (`VITE_*`)
- **Usar logger.ts** en vez de `console.log/warn/error`: `import { logger } from 'utils/logger'`
- **NO usar `as any` ni `@ts-ignore`** - tipar correctamente
- **Auto-save/borradores** via `draftRepository` (SQLite), NO IndexedDB
- **Modulos lazy-loaded** con `React.lazy()` + `Suspense`

### Testing (detalle en .claude/rules/testing.md)
- Framework: Vitest con globals habilitados (`describe`, `it`, `expect` sin import)
- Correr: `npx vitest run` | Coverage: `npx vitest run --coverage`
- Test dir: `__tests__/` (460+ archivos, 3964 tests)
- Mocks: repositorios, `unified_fs`, `logger`, `crypto` (nunca filesystem real)

### Path aliases
- `@/*` mapea a la raiz del proyecto (configurado en tsconfig.json y vite.config.ts)

### Reglas contextuales (.claude/rules/)
Reglas detalladas por modulo se cargan automaticamente al editar archivos relevantes:
- `testing.md` — React 19 gotchas, mock patterns, coverage
- `database.md` — Repositorios, SQLite, persistencia
- `control-plan.md` — CP cross-validation, trazabilidad
- `exports.md` — Excel/PDF export patterns, NaN prevention
- `hoja-operaciones.md` — HO UI, PPE, navy theme

## Datos de referencia

- `INITIAL_PROJECT` y `EXAMPLE_PROJECT` en `types.ts` para datos de test
- Tipos principales: `Project`, `Operation`, `WorkElement`, `AmfeDocument`, `ControlPlanDocument`
- SGC docs catalogados en `src/data/sgc/`

## Auth & Multi-usuario

- Supabase auth con email/password (`components/auth/AuthProvider.tsx`)
- Login page en `components/auth/LoginPage.tsx`
- En dev mode: boton "Entrar como admin (dev)" usa `VITE_AUTO_LOGIN_EMAIL` / `VITE_AUTO_LOGIN_PASSWORD`
- Variables de entorno requeridas: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Documentos APQP en Supabase (62 docs, 8 familias — actualizado 2026-03-18)

| Tipo | Cantidad | Estado |
|------|----------|--------|
| PFD  | 9        | 100% NG paths: all 9 PFDs have decision rombos, scrap dispositions, rework where applicable. Sources: Flujograma 152 (headrests), 153 (armrest), 154 (insert), 122 (top roll), 150 (telas planas), 156 (telas termo) |
| AMFE | 18       | 100% S/O/D, AP=H con acciones, headrest masters+variantes con datos reales (AMFEs 151/153/155) |
| CP   | 18       | 100% controlMethod (1,448 items), 100% CC/SC, 0 warnings V1/V2 |
| HO   | 17       | 171 sheets, 1,038 TWI steps (100% >= 3 steps), QCs vinculados, headrests con SET UP |

### Productos VWA (proyecto PATAGONIA)
- **Insert** (master + [L0] variante) — VWA/PATAGONIA/INSERT
- **Armrest Door Panel** — VWA/PATAGONIA/ARMREST_DOOR_PANEL
- **Top Roll** — VWA/PATAGONIA/TOP_ROLL
- **Headrest Front** (L0 + L1/L2/L3) — VWA/PATAGONIA/HEADREST_FRONT — AMFE real (60 causas, AMFE-151), variantes propagadas
- **Headrest Rear Center** (L0 + L1/L2/L3) — VWA/PATAGONIA/HEADREST_REAR_CEN — AMFE real (55 causas, AMFE-153), variantes propagadas
- **Headrest Rear Outer** (L0 + L1/L2/L3) — VWA/PATAGONIA/HEADREST_REAR_OUT — AMFE real (55 causas, AMFE-155), variantes propagadas

### Productos PWA
- **Telas Planas** — PWA/TELAS_PLANAS — HILUX 581D
- **Telas Termoformadas** — PWA/TELAS_TERMOFORMADAS — HILUX 582D

### Gaps conocidos
- Toyota 737 RR1 MHV: 0 documentos en Supabase (carpeta fisica existe pero sin datos)
- AMFE-00001 Insert master: 94% S/O/D coverage (6% causas incompletas)

Reportes de auditoria: `docs/AUDIT_AMFE.md`, `docs/AUDIT_CP_HO.md`, `docs/AUDIT_CROSSVALIDATION.md`, `docs/AUDIT_CURRENT_STATE.md`

## Validaciones cruzadas APQP

- PFD ↔ AMFE: `pfdAmfeLinkValidation.ts` + `usePfdAmfeLinkAlerts` hook + `LinkValidationPanel` UI
- HO ↔ CP: `hoCpLinkValidation.ts` + `useHoCpLinkAlerts` hook + `HoCpLinkValidationPanel` UI
- CP interna: `cpCrossValidation.ts` (V1-V8: CC/SC, orphan failures, 4M, reaction owners, poka-yoke, sampling, machines)
- Cascada APQP: `crossDocumentAlerts.ts` (PFD→AMFE→CP→HO)

## Familias de Producto (Herencia Maestro→Variante)

### Tablas SQLite
- `product_families` — Familias (nombre, linea, miembros)
- `product_family_members` — Productos en familia (M:N, uno `is_primary`)
- `family_documents` — Vincula docs a familias (`is_master`, `source_master_id`, modulo)
- `family_document_overrides` — Cambios de variante vs maestro (por item: step/op/item/sheet)
- `family_change_proposals` — Propuestas de cambio maestro→variante (pending/auto_applied/accepted/rejected)

### Flujo de herencia
1. **Clonado**: `documentInheritance.ts` clona maestro→variante regenerando UUIDs
2. **Override tracking**: Al guardar variante, `triggerOverrideTracking` diffs vs maestro (fire-and-forget)
3. **Change propagation**: Al guardar maestro, `triggerChangePropagation` genera proposals para variantes
   - Item sin override en variante → `auto_applied`
   - Item con override en variante → `pending` (requiere confirmacion manual)
4. **UI**: `ChangeProposalPanel` muestra proposals pendientes en docs variante (aceptar/rechazar)

### Granularidad de items (por modulo)
- PFD: `pfd_step` (step.id)
- AMFE: `amfe_operation` (operation.id)
- CP: `cp_item` (item.id)
- HO: `ho_sheet` (sheet.id)

### Hooks relevantes
- `useInheritanceStatus` — Status de herencia por item (inherited/modified/own)
- `useChangeProposals` — Proposals pendientes para variantes
- `useFamilyDocuments` — Docs vinculados a familia

## Preview & Verificacion Visual

Usar `preview_start` con name "dev" para levantar Vite en puerto 3002.
La configuracion esta en `.claude/launch.json`.

## Design System y Testing

### UI Consistente
- Toda UI nueva DEBE seguir el design system documentado en `docs/DESIGN_SYSTEM.md`
- Antes de crear cualquier componente visual nuevo, consultar ese archivo para usar los mismos colores, componentes, patrones de layout e iconografía
- No inventar estilos nuevos si ya existe un patrón establecido

### Estrategia de Testing
- Durante desarrollo: correr solo tests del módulo afectado con `npx vitest run --testPathPattern=<módulo>`
- Tests generales completos (`npx vitest run`) solo antes del commit final
- Siempre verificar TypeScript con `npx tsc --noEmit` antes de commitear
