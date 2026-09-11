# Barack Mercosul - Tiempos y Balanceos

App web React 19 + TypeScript + Supabase para gestion de calidad automotriz
(**AMFE VDA + Plan de Control AIAG**) y lean manufacturing (balanceo de linea,
simulador de flujo, mix multi-modelo, calculadora de medios). Auth Supabase, pero
**la usa un solo usuario (Fak)** (aclarado 2026-08-07): no hay edicion concurrente, asi que
nada que dependa de locks entre usuarios es critico.
PFDs y Hojas de Operaciones no se hacen aca (regla `no-pfd-no-ho.md`);
sus documentos en Supabase son referencia historica de solo lectura.

## Protocolo de inicio de sesion

0. **PC nueva** (repo recien clonado y `~/.claude/projects/C--Dev-BarackMercosul/memory/` casi
   vacio): esta PC tiene el codigo pero no el cerebro. Correr `node scripts/_nube.mjs --bajar --aplicar`
   (Node pelado) y avisarlo en una linea. Es la red por si el hook `cerebro-guard.sh` no corrio.
1. Las lecciones vigentes ya estan en este contexto: `docs/LECCIONES_APRENDIDAS.md` entra por
   el `@import` de abajo. No releerlo; si un tema tiene memoria propia, esa si se lee al tocarlo.
2. Si Fak menciona un producto: leer su AMFE/CP en Supabase live antes de hacer cambios.
3. PDFs de referencia: leerlos con el metodo de `docs/COMO_LEER_PDF.md`.

@docs/LECCIONES_APRENDIDAS.md

## Protocolo de fin de sesion

1. Actualizar `docs/LECCIONES_APRENDIDAS.md` con errores cometidos y correcciones de Fak.
2. Si tocaste datos Supabase: `node scripts/_backup.mjs` (snapshot preventivo).
3. Lanzar agente `auditor` al cerrar tareas de codigo.
4. Tareas de codigo: `npm run build` OK → commit → push (regla `git-deploy.md`).
5. **Tarea de Barack terminada: el entregable a su carpeta por tipo de la biblioteca de
   Ingenieria y la carpeta de la tarea archivada** (`node scripts/_escritorio.mjs --archivar`,
   regla `escritorio-tareas.md`). En el Escritorio no queda nada mio: "te lo deje en el
   Escritorio" no es entregar.

Lo mide `node scripts/_cierreSesion.mjs` (LECCIONES, backup vs escrituras Supabase, build, git,
Escritorio, cerebro; exit 1 si falta algo; `--sin-build` para la pasada rapida). Solo mide:
commit/push/archivar los hago yo.

## Como interactuar con Fak

- Fak escribe en espanol informal con typos. Entender sin corregir.
- Fak no es programador. Explicar decisiones tecnicas en lenguaje simple.
- No preguntar "¿queres que haga X?": se hace y se reporta. La respuesta es siempre si, y cada
  pregunta le cuesta un turno a Fak (37 por semana antes de los hooks `pregunta-guard.sh` y
  `cierre-guard.sh`; 2 despues).
- Si Fak dice "decidi vos": decidir con mejor practica y explicar brevemente por que.
  No devolverle la pregunta.
- Si Fak te corrige: registrarlo en LECCIONES_APRENDIDAS inmediatamente.
- Si detectas un problema o inconsistencia: reportar sin esperar a que pregunte.
- Si un cambio afecta multiples productos: sugerir aplicarlo/verificarlos todos.
- Ante duda de datos: TBD y avisar. Nunca inventar (regla `core-prohibiciones.md`).
- Contrato de autonomia (que hago solo vs que requiere OK): `.claude/rules/autonomy-contract.md`.

## Reglas del dominio

1. Nada de datos mock, cero duplicados en Supabase, reusar antes de crear: `core-prohibiciones.md` §5-6.
2. **Export Excel**: AMFE y CP solo `xlsx-js-style`; HO (legacy) solo `ExcelJS`.
   Export AMFE oficial via node (skill `amfe-export-oficial`), no desde la app.
3. **Verificacion**: tras seed/migracion contar familias (8) y duplicados (0);
   tras export abrir el archivo; `npx tsc --noEmit` y tests del modulo afectado.
4. Documentos APQP son "documentos vivos" (IATF): cambios diarios van al audit trail;
   revisiones mayores (A/B/C) solo en hitos oficiales (prelanzamiento/PPAP/ECN).

## Reglas contextuales (.claude/rules/) — carga automatica

Las reglas sin `paths:` ya estan en este contexto: `core-prohibiciones.md`, `techo-agentes.md`,
`no-pfd-no-ho.md`, `autonomy-contract.md`, `git-deploy.md`, `consumos-entregables.md`,
`caracteristicas-especiales.md` (criterio CC/SC, D/TLD y sus fuentes — pedido de Fak 11/09/2026).

| Con `paths:` (cargan al tocar) | Ambito |
|---|---|
| `amfe.md` | modules/amfe, core/amfe, scripts *.mjs, utils/seed — regla APQP consolidada |
| `control-plan.md` | modules/controlPlan |
| `database.md` + `verify-supabase-live.md` | repositorios, scripts, persistencia |
| `exports.md` | archivos *export* |
| `mail-envio.md` | `scripts/_mail*` + `*.py` — mandar un mail: nunca con un `.Send()` suelto (hook `mail-guard.sh`) |
| `patrones-corte.md` | `*.dxf` / `*.plt` / `*.hpgl` + skill `patrones-corte-plotter` — 3 gates antes de mover un punto |
| `coordinador.md` | `_encargo.mjs`, `coordinadorGuard`, su hook y test — lo que sale hacia otra sesion pasa por `_encargo.mjs` (hook `coordinador-guard.sh`) |
| `testing.md` | __tests__ |
| `dev-login.md` | components/auth — el boton dev-login no se toca (regla propia) |
| `arb-no-cerrar.md` | `scripts/_arb*.py` + skill `arb-operar` — el arb no se cierra sin consultarle a Fak (hook `arb-cerrar-guard.sh`) |
| `cad-3d.md` | archivos .step/.stl/.glb, `.venv-cad`, skill cad-design — gates 3D (el primero es el de PROCESO) |
| `dxf-entregable.md` | `*.dxf` / `*.plt` — el juez de un DXF es AutoCAD, no ezdxf (`scripts/_validarDxf.py`); rutas de mas de 259 caracteres no abren |
| `escritorio-tareas.md` | `_escritorio.mjs` + su hook — cola de tareas: cuando se cierra y como se archiva |
| `hojas-proceso.md` | hojas de proceso / HO (`I-IN-002.4-R01`) — una hoja se juzga impresa (skill `hojas-de-proceso`, gate `hoja_proceso_check.py`) |
| `lecciones-consolidacion.md` | `docs/LECCIONES_APRENDIDAS.md` — ciclo de vida de una leccion y gate por bullet |
| `documentacion-oficial.md` | `4- MANUALES`, `0-Documentacion cliente`, `1. Imput`, `normas-vw` — el original de un tercero manda y nada mio comparte su carpeta (hook `documentacion-oficial-guard.sh`) |
| `video-maquina.md` | `_videoBiblioteca.mjs`, `*.MOV` / `*.MP4`, material del telefono — va a `5- VIDEOS Y FOTOS`, se cruza por `(IMG_xxxx)` antes de bajar del celular y el master no se borra (hook `video-maquina-guard.sh`) |

**Skills** (on-demand): son el sistema de roles y cargan solo al usarse (decision Fak 2026-08-09:
no crear agentes-rol por dominio ni proyectos separados, multi-agente ≈ 15x tokens; subagentes solo
para trabajo batch/paralelo, techo 5). La lista con la descripcion de cada skill la inyecta Claude
Code en cada sesion; el detalle vive en su `SKILL.md` bajo `.claude/skills/`.
`docs/LECCIONES_APRENDIDAS.md`: gate por bullet y ciclo de graduacion en la regla
`lecciones-consolidacion.md` (lo miden `_cierreSesion.mjs` y el hook Stop).

**Modelo y sesion (decision Fak 04/09/2026):** Fable 5.1 para mejoras de codigo importantes,
Opus 5 para el resto; no tocar el selector por cuenta propia. Toda sesion arranca en modo plan
(`permissions.defaultMode`) y auto-compacta a 400k tokens (settings globales); el hook Stop
`cierre-guard.sh` corta el turno si termina pidiendo permiso para mi propio trabajo o si entregue
afuera del repo sin decir la ruta.

## Stack y comandos

React + TypeScript + Vite · Supabase (auth+DB) · Vitest + testing-library · TailwindCSS ·
xlsx-js-style / ExcelJS / html2pdf.js · Recharts · @dnd-kit (versiones: `package.json`).

```bash
npm run dev          # Vite dev server (localhost:3000)
npx vitest run       # tests (durante desarrollo: --testPathPattern=<modulo>)
npm run build        # build de produccion — obligatorio antes de push
npx tsc --noEmit     # chequeo de tipos
node scripts/_auditAll.mjs --summary   # salud de los AMFEs en Supabase
```

## Estructura del proyecto (codigo en la RAIZ, no en src/)

`App.tsx`/`AppRouter.tsx` (entry + routing lazy) · `types/` · `components/` · `core/` (balancing,
inheritance maestro→variante, amfe) · `hooks/` · `modules/` (amfe, controlPlan, family, balancing,
dashboard, registry, mix, flow-simulator, eightD, flowchart) · `utils/repositories/` (repositorios
tipados: UNICO acceso a datos) · `scripts/` (_backup, _restore, _auditAll, `_lib/`, `archive/` de
one-shots) · `__tests__/` (Vitest) · `docs/` (guias APQP, LECCIONES, `_archive/`).

- Path alias `@/*` → raiz. Modulos lazy con `React.lazy()` + `Suspense`.
- NO hardcodear API keys (`VITE_*`). `logger.ts` en vez de console.log. NO `as any` ni `@ts-ignore`.
- Familias de producto (herencia maestro→variante): tablas `product_families`,
  `family_documents`, `family_change_proposals`; motor en `core/inheritance/`.
  Detalle de schema: skill `apqp-schema`.

## Calidad

- Nivel senior: leer el codigo completo antes de editar; verificar antes de afirmar.
- Un hallazgo de subagente se verifica contra la fuente antes de aplicarlo: en los audits la
  mayoria son falsos positivos (el caso del 02/09, 92 de 111 evasiones, esta en LECCIONES y en `coordinador.md`).
- En deep audits autonomos: clasificar TRUE BUG > ROBUSTNESS > FALSE POSITIVE; ante la duda NO aplicar el fix; correr tests tras cada batch.

## Auth y deploy

- Dev: boton "Acceso rapido (dev)" (borde naranja) con `VITE_AUTO_LOGIN_EMAIL/PASSWORD` — protegido por regla `dev-login.md`.
- Produccion: https://facussc24.github.io/tiempos-y-balanceos/ — la despliega `.github/workflows/deploy.yml` en cada push a `main` (repo publico). `npx gh-pages -d dist` no se usa (memoria `ghpages_manual_deploy`).

## Documentos de la empresa

El conocimiento de la empresa se consulta directo de las fuentes reales (servidor Y:, OneDrive
4-MANUALES, docs/ del repo, docs-local/) y del cache local `.sgc-cache/` (gitignoreado, extractos
con fuente+fecha). Routing y protocolo de refresh: skill `docs-empresa`. El original siempre le
gana al cache. NotebookLM se retiro (decision Fak 2026-07-23).
