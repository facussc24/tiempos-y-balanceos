# Barack Mercosul - Tiempos y Balanceos

App de escritorio Tauri + React 19 + TypeScript para gestion de calidad automotriz
(AMFE VDA, Plan de Control AIAG, Hojas de Operaciones) y lean manufacturing
(balanceo de linea, simulador de flujo, kanban, heijunka, mix multi-modelo).

## Stack

| Capa         | Tecnologia                                          |
|--------------|-----------------------------------------------------|
| Runtime      | Tauri 2.x, React 19.2, TypeScript 5.8, Vite 6      |
| Persistencia | SQLite (tauri-plugin-sql) + WAL mode                |
| AI           | Gemini flash-lite (sugerencias), flash (chat copilot)|
| Testing      | Vitest 4.x + @testing-library/react + jsdom         |
| Styling      | TailwindCSS 3.4                                     |
| Export       | xlsx-js-style, html2pdf.js                          |
| Charts       | Recharts 3.4                                        |
| DnD          | @dnd-kit/core                                       |

## Comandos

```bash
npm run dev          # Vite dev server (localhost:3000)
npx vitest run       # Correr todos los tests
npx vitest run --coverage  # Tests con coverage (v8)
npm run build        # Build de produccion
npx tsc --noEmit     # Chequeo de tipos
npm run tauri:dev    # Dev con Tauri
npm run tauri:build  # Build Tauri
```

## Estructura del proyecto

```
/                       Raiz del proyecto (NO hay carpeta src/ principal)
  App.tsx               Entry point
  AppRouter.tsx         Routing con lazy loading
  types.ts              Tipos compartidos (~1500 lineas)
  config.ts             Configuracion global
  index.tsx             React root

  components/           UI reutilizable (14 carpetas/archivos)
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
    inheritance/        Herencia de configuracion

  hooks/                18 custom hooks
    useLineBalancing    Motor principal de balanceo
    useProjectPersistence  Guardado a filesystem + SQLite auto-save
    useUndoRedo         Undo/redo con snapshots
    useSessionLock      Lock de sesion en red

  modules/              Modulos de negocio
    amfe/               AMFE VDA (analisis modal de fallas) + AI chat copilot
    controlPlan/        Plan de Control AIAG + AI copilot + cross-validation
    hojaOperaciones/    Hojas de operaciones (navy theme, ISO PPE)
    pfd/                Diagrama de Flujo del Proceso (cyan theme, ASME symbols)
    mix/                Mix multi-modelo
    flow-simulator/     Simulador de flujo (SimScript)
    heijunka/           Nivelado heijunka
    kanban/             Tablero kanban
    balancing/          UI de balanceo
    dashboard/          Dashboard ejecutivo
    logistics-backlog/  Backlog logistico

  utils/                Utilidades
    database.ts         Singleton SQLite, schema DDL, migraciones, adapters
    repositories/       8 repositorios tipados (CRUD sobre SQLite)
      settingsRepository.ts   Key-value de configuracion
      projectRepository.ts    Proyectos de balanceo
      amfeRepository.ts       Documentos AMFE + biblioteca
      cpRepository.ts         Planes de Control
      hoRepository.ts         Hojas de Operaciones
      pfdRepository.ts        Diagramas de Flujo (PFD)
      draftRepository.ts      Borradores auto-save unificados
    geminiClient.ts     Cliente Gemini con cache y circuit breaker
    storageManager.ts   Settings de storage (delega a settingsRepository)
    unified_fs.ts       Abstraccion filesystem (Tauri/web)
    tauri_smart_save.ts Guardado formal a red con locks/atomic/backup
    logger.ts           Logger centralizado
    settingsStore.ts    Settings (delega a settingsRepository)
    crypto.ts           Hashing para integridad
    networkUtils.ts     Deteccion de red
    processCategory.ts  Inferencia de categoria de proceso

  __tests__/            209 archivos de test (3753+ tests)

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
- **NO hardcodear API keys** en codigo fuente. Usar `settingsStore` o variables de entorno
- **Usar logger.ts** en vez de `console.log/warn/error`: `import { logger } from 'utils/logger'`
- **Imports dinamicos** para `@tauri-apps/*`: `const { readTextFile } = await import('@tauri-apps/plugin-fs')`
- **NO usar `as any` ni `@ts-ignore`** - tipar correctamente
- **Guardado formal** a filesystem (Tauri) con locks y atomic writes para red
- **Auto-save/borradores** via `draftRepository` (SQLite), NO IndexedDB
- **Modulos lazy-loaded** con `React.lazy()` + `Suspense`

### Testing (detalle en .claude/rules/testing.md)
- Framework: Vitest con globals habilitados (`describe`, `it`, `expect` sin import)
- Correr: `npx vitest run` | Coverage: `npx vitest run --coverage`
- Test dir: `__tests__/` (209 archivos, 3753+ tests)
- Mocks: repositorios, `unified_fs`, `logger`, `crypto` (nunca filesystem real)

### Path aliases
- `@/*` mapea a la raiz del proyecto (configurado en tsconfig.json y vite.config.ts)

### Reglas contextuales (.claude/rules/)
Reglas detalladas por modulo se cargan automaticamente al editar archivos relevantes:
- `testing.md` — React 19 gotchas, mock patterns, coverage
- `amfe-ai.md` — Gemini integration, sugerencias, chat copilot
- `database.md` — Repositorios, SQLite, persistencia
- `control-plan.md` — CP AI, cross-validation, trazabilidad
- `exports.md` — Excel/PDF export patterns, NaN prevention
- `hoja-operaciones.md` — HO UI, PPE, navy theme

## Datos de referencia

- `INITIAL_PROJECT` y `EXAMPLE_PROJECT` en `types.ts` para datos de test
- Tipos principales: `Project`, `Operation`, `WorkElement`, `AmfeDocument`, `ControlPlanDocument`
- SGC docs catalogados en `src/data/sgc/`

## Preview & Verificacion Visual

Usar `preview_start` con name "dev" para levantar Vite en puerto 3002.
La configuracion esta en `.claude/launch.json`.
