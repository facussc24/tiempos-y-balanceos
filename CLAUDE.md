# Barack Mercosul - Tiempos y Balanceos

App web React 19 + TypeScript + Supabase para gestion de calidad automotriz
(**AMFE VDA + Plan de Control AIAG**) y lean manufacturing (balanceo de linea,
simulador de flujo, mix multi-modelo, calculadora de medios). Auth Supabase, pero
**la usa un solo usuario (Fak)** (aclarado 2026-08-07): no hay edicion concurrente, asi que
nada que dependa de locks entre usuarios es critico.
La app no tiene modulo de PFD ni de HO: sus documentos en Supabase son referencia historica de
solo lectura. Los flujogramas los genero yo por script y las HO se arman a pedido de Fak
(regla `no-pfd-no-ho.md`).

## Protocolo de inicio de sesion

0. **PC nueva** (repo recien clonado y `~/.claude/projects/C--Dev-BarackMercosul/memory/` casi
   vacio): esta PC tiene el codigo pero no mi memoria ni la configuracion. Correr
   `node scripts/_nube.mjs --bajar --aplicar` (Node pelado) **sin preguntarle a Fak** y avisarlo en
   una linea, en castellano simple: a Fak no se le dice "el cerebro" (regla `nube-ingenieria.md`).
   Es la red por si el hook `cerebro-guard.sh` no corrio.
1. Las lecciones vigentes ya estan en este contexto: `docs/LECCIONES_APRENDIDAS.md` entra por
   el `@import` de abajo. No releerlo; si un tema tiene memoria propia, esa si se lee al tocarlo.
2. Si Fak menciona un producto: leer su AMFE/CP en Supabase live antes de hacer cambios.
3. PDFs de referencia: leerlos con el metodo de `docs/COMO_LEER_PDF.md`.
4. **Noche de Claude (API)**: si existe `.claude/state/nocturno.json` de hoy, leerlo
   (`node scripts/_nocturno.mjs --estado`); los hallazgos de `reports/staging/PREAUDITORIA_AMFE_*.md`
   son candidatos y se verifican contra Supabase antes de nombrarlos. Si hay clave y la tarea nocturna
   no esta agendada (`node scripts/_claude.mjs --check`), `node scripts/_nocturno.mjs --agendar` y
   avisar en una linea (regla `api-claude.md`).

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
- No preguntar "¿queres que haga X?" por trabajo propio y reversible: se hace y se reporta. Cada
  pregunta le cuesta un turno a Fak (medido del 01/09 al 06/10/2026: 81 preguntas de opciones, 35
  rechazadas por el — *"no deberias hacerme tantas preguntas, deberias saber que hacer"*). **Si lo
  que se decide es trabajo mio y reversible y tengo una opcion recomendada, ya decidi: la hago y
  digo por que. Y no se le lleva un menu de "que mas hago" o "como sigo".** Desde el 06/10/2026 el
  hook `pregunta-guard.sh` pausa esas dos formas para repensarlas (frena, no decide: logica en
  `scripts/_lib/preguntaGuard.mjs`). Lo que el contrato de autonomia marca "confirmar" o "preguntar"
  (datos en Supabase, servidor de la empresa, listados maestros, mandar un mail, CC/SC, primera
  vez) se pregunta SIEMPRE, como "esto va aca, ¿esta bien?", con la ruta concreta y sin marca de
  recomendada; igual lo que solo Fak sabe. En la duda, se pregunta.
- Si Fak dice "decidi vos": decidir con mejor practica y explicar brevemente por que.
  No devolverle la pregunta.
- Si Fak dice que no entendio, pide que se lo explique o que sea facil de entender, o se nota que
  no entendio: no repetir lo mismo mas largo, cambiar la forma. El skill `explicar-mejor` se CARGA
  antes de contestar (verlo en la lista no es usarlo): lo recuerda el hook `explicar-prompt.sh` y
  el cierre del turno lo exige (`cierre-guard.sh`, chequeo 7).
- Si Fak te corrige: registrarlo en LECCIONES_APRENDIDAS inmediatamente.
- Si detectas un problema o inconsistencia: reportar sin esperar a que pregunte.
- Si un cambio afecta multiples productos: sugerir aplicarlo/verificarlos todos.
- Ante duda de datos: TBD y avisar. Nunca inventar (regla `core-prohibiciones.md`).
- Contrato de autonomia (que hago solo vs que requiere OK): `.claude/rules/autonomy-contract.md`.

## Reglas del dominio

1. Nada de datos mock, cero duplicados en Supabase, reusar antes de crear: `core-prohibiciones.md` §5-6.
2. **Export Excel**: AMFE y CP solo `xlsx-js-style`; HO (legacy) solo `ExcelJS`.
   Export AMFE oficial via node (skill `amfe-export-oficial`), no desde la app.
3. **Verificacion**: tras seed/migracion contar familias (13 al 22/09/2026: 10 de producto + 3 maestros de proceso; el numero se lee live) y duplicados (0);
   tras export abrir el archivo; `npx tsc --noEmit` y tests del modulo afectado.
4. Documentos APQP son "documentos vivos" (IATF): cambios diarios van al audit trail;
   revisiones mayores (A/B/C) solo en hitos oficiales (prelanzamiento/PPAP/ECN).

## Reglas contextuales (.claude/rules/) — carga automatica

Las reglas sin `paths:` ya estan en este contexto: `core-prohibiciones.md`, `techo-agentes.md`,
`no-pfd-no-ho.md`, `autonomy-contract.md`, `git-deploy.md`, `consumos-entregables.md`,
`caracteristicas-especiales.md` (criterio CC/SC, D/TLD y sus fuentes — pedido de Fak 11/09/2026),
`nube-ingenieria.md` (regla dura de Fak 01/10/2026: se guarda solo en la nube de Ingenieria, nada en
su nube personal `OneDrive - BARACK ARGENTINA SRL\`; hook `nube-personal-guard`),
`trabajar-hasta-la-hora.md` (Fak 03/10/2026: si pone una hora no se cierra antes; lista en un archivo,
hora fijada y latido con `scripts/_latido.mjs` en segundo plano; hooks `hora-prompt` y `hora-guard`),
`codigo-madre.md` (Fak 09/10/2026: el codigo es sagrado; el tamaño del cambio decide el camino —chico
directo, mediano con plan corto + auditor, grande con investigacion + su si + revisor—; los pedidos chicos de la
semana van a `docs/COLA_CAMBIOS_CODIGO.md`).

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
| `mejora-implementada.md` | hooks, skills, reglas, `settings.json`, guardianes y sus canones — una mejora no esta implementada hasta probarla con un mensaje real de Fak (`node scripts/_probarMejora.mjs`) y decirle si las sesiones abiertas la toman solas |
| `documentacion-oficial.md` | `4- MANUALES`, `0-Documentacion cliente`, `1. Imput`, `normas-vw` — el original de un tercero manda y nada mio comparte su carpeta (hook `documentacion-oficial-guard.sh`) |
| `api-claude.md` | `scripts/_lib/claudeApi.mjs`, `_preauditarAmfe.mjs`, `_nocturno.*`, `_claude.mjs` — los creditos de API del plan Max NO cubren Claude Code; la noche no escribe en Supabase/arb/Outlook (test `candadosNocturno`); la clave nunca se imprime |
| `video-maquina.md` | `_videoBiblioteca.mjs`, `*.MOV` / `*.MP4`, material del telefono — va a `5- VIDEOS Y FOTOS`, se cruza por `(IMG_xxxx)` antes de bajar del celular y el master no se borra (hook `video-maquina-guard.sh`) |

**Skills** (on-demand): son el sistema de roles y cargan solo al usarse (decision Fak 2026-08-09:
no crear agentes-rol por dominio ni proyectos separados, multi-agente ≈ 15x tokens; subagentes solo
para trabajo batch/paralelo, techo 10 en Sonnet 5.5 xhigh desde el 30/09/2026 y la auditoria final en Opus, regla `techo-agentes.md`). La lista con la descripcion de cada skill la inyecta Claude
Code en cada sesion; el detalle vive en su `SKILL.md` bajo `.claude/skills/`.
`docs/LECCIONES_APRENDIDAS.md`: gate por bullet y ciclo de graduacion en la regla
`lecciones-consolidacion.md` (lo miden `_cierreSesion.mjs` y el hook Stop).

**Modelo y sesion (decision Fak 04/09/2026):** Fable 5.1 para mejoras de codigo importantes,
Opus (hoy Opus 5.5) para el resto; no tocar el selector por cuenta propia. El modo de permisos lo elige el
selector de la app (el `defaultMode: plan` del settings del repo se saco el 10/10/2026, cola HOY-8: dejaba
en plan a una sesion disparada por el reloj); una sesion lanzada desde otra arranca con el modo guardado en
su tarea o, si no hay, con el del settings, nunca con el de la que la lanza (skill `lanzar-sesion-hija`), y
el modo plan lo pide la plantilla de `_encargo.mjs` solo cuando Fak esta en la ventana (`--lanzada` lo
saca). Auto-compacta a 1M tokens (settings globales); el hook Stop
`cierre-guard.sh` corta el turno si termina pidiendo permiso para mi propio trabajo o si entregue
afuera del repo sin decir la ruta.

## Comandos

```bash
npm run build        # build de produccion — obligatorio antes de push
node scripts/_auditAll.mjs --summary   # salud de los AMFEs en Supabase
```

## Estructura del proyecto (codigo en la RAIZ, no hay src/)

- `utils/repositories/` (repositorios tipados) es el UNICO acceso a datos. One-shots viejos: `scripts/_archive/`.
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
