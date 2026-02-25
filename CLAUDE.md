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

  __tests__/            166 archivos de test (2362+ tests)

  src/                  Assets y datos
    assets/             Imagenes, iconos PPE, logo
    data/               Datos estaticos (SGC catalog)
```

## Reglas de desarrollo

### Obligatorio
- **Usar repositorios para acceso a datos, nunca SQLite directo** — importar de `utils/repositories/`
- **NO hardcodear API keys** en codigo fuente. Usar `settingsStore` o variables de entorno
- **Usar logger.ts** en vez de `console.log/warn/error`: `import { logger } from 'utils/logger'`
- **Imports dinamicos** para `@tauri-apps/*`: `const { readTextFile } = await import('@tauri-apps/plugin-fs')`
- **NO usar `as any` ni `@ts-ignore`** - tipar correctamente
- **Guardado formal** a filesystem (Tauri) con locks y atomic writes para red
- **Auto-save/borradores** via `draftRepository` (SQLite), NO IndexedDB
- **Modulos lazy-loaded** con `React.lazy()` + `Suspense`

### Testing
- Framework: Vitest con globals habilitados (`describe`, `it`, `expect` sin import)
- Patron: `describe > it > expect`
- Hooks: usar `renderHook` de `@testing-library/react`
- React 19 concurrent mode: ErrorBoundary tests NO pueden usar patron "throw once"
- `ConfirmModal` requiere `vi.useFakeTimers()` para tests con `isOpen=false`
- Mocks comunes: repositorios (`utils/repositories/*`), `unified_fs`, `logger`, `crypto`
- Test dir: `__tests__/` (167 archivos, 2368+ tests)

### Path aliases
- `@/*` mapea a la raiz del proyecto (configurado en tsconfig.json y vite.config.ts)

## Datos de referencia

- `INITIAL_PROJECT` y `EXAMPLE_PROJECT` en `types.ts` para datos de test
- Tipos principales: `Project`, `Operation`, `WorkElement`, `AmfeDocument`, `ControlPlanDocument`
- SGC docs catalogados en `src/data/sgc/`

## ⚠️ BUG CONOCIDO: preview_start NO funciona — NO intentar

**`mcp__Claude_Preview__preview_start` SIEMPRE falla con `spawn EINVAL` en este proyecto.**

### Causa raiz
La ruta del proyecto tiene espacios (`Software Barack Mercosul\Tiempos y Balanceos`).
Node.js v22 en Windows tira EINVAL en `child_process.spawn()` cuando el CWD tiene espacios
(CVE-2024-27980 + nodejs/node#7367). El MCP Preview tool no usa `{ shell: true }`.

### Ya se probo TODO esto (2026-02-24) y TODO fallo:
- `cmd.exe /c npx vite` → EINVAL
- `npx` (resuelve a npx.cmd) → EINVAL
- `node` / `node.exe` → EINVAL
- Ruta absoluta `C:\Program Files\nodejs\node.exe` → EINVAL
- Ruta corta 8.3 `C:\PROGRA~1\nodejs\node.exe` → EINVAL
- PowerShell como ejecutable → EINVAL
- Junction sin espacios `C:\dev\barack` → EINVAL
- Wrapper `.js` con `shell: true` → EINVAL
- Wrapper `.cmd` en ruta sin espacios → EINVAL
- Hasta `node --version` (sin args complejos) → EINVAL

### Que hacer en su lugar
Para verificacion visual, usar **Bash + Chrome extension**:
```bash
cd "C:\Users\FacundoS-PC\Documents\Software Barack Mercosul\Tiempos y Balanceos"
npx vite --port 3002 &    # levantar server en background
# Luego usar mcp__Claude_in_Chrome__navigate para ir a localhost:3002
```

### Solucion definitiva (pendiente)
Renombrar la carpeta del proyecto para eliminar espacios, o esperar que Anthropic
arregle el MCP Preview tool agregando `{ shell: true }` al spawn (como hizo Continue.dev
en su PR #5631 para el mismo bug).
