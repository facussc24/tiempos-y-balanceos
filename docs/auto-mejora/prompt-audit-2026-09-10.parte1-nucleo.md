# Prompt-audit 10/09/2026 — parte 1: nucleo siempre cargado

Guia: `claude-api/shared/prompt-audit.md` (Claude Code 2.1.260), pasos 0-6. Modelo objetivo: **Claude Fable 5.1 / Opus 5**.
Auditor: la sesion principal (estos archivos ya estaban en su contexto; no se gasto un subagente).

## 1. Supuestos

- Alcance: lo que entra en TODAS las sesiones del repo: `CLAUDE.md`, `docs/LECCIONES_APRENDIDAS.md` (via `@import`),
  las 7 reglas sin `paths:`, los 2 agentes de `.claude/agents/`, y el texto que inyectan `pregunta-guard.sh`,
  `session-start-context.sh` (bloque NUCLEO) y `cierreGuard.mjs`/`cierreCanon.data.json` (los `titulo`/`detalle`
  que llegan al modelo).
- Contexto que solo el autor sabe y NO se flaggea (keep list #1, #4, #5): Fak es ingeniero de calidad, no
  programador, escribe informal; un solo usuario de la app; las decisiones con fecha son constraints; las
  correcciones repetidas de Fak (LECCIONES) se conservan todas.
- `docs/LECCIONES_APRENDIDAS.md` la esta consolidando OTRA sesion en este momento (`MM` en git): aca solo se
  flaggea, no se propone diff. La pasada de formato (titulares en frase normal, sin 🔴) ya se aplico el 10/09
  (`d90eba51`) y esa sesion la siguio graduando.
- Procedencia: `git log`/`blame` solo donde cambiaba la accion; los datos volatiles se verificaron contra el disco
  (existencia de 22 archivos citados: todos existen; `npx tsc --noEmit`: 0 errores; `gh auth status`: sin login;
  `utils/repositories/`: 23 archivos; versiones de `package.json`; log `InstructionsLoaded`).

## 2. Inventario

| Archivo | Bytes | Se carga |
|---|---|---|
| `CLAUDE.md` | 13.949 | siempre (y se recarga en cada compactacion: 6 veces en el log) |
| `docs/LECCIONES_APRENDIDAS.md` | 26.820 | siempre (`@import`) |
| `.claude/rules/git-deploy.md` | 3.638 | siempre |
| `.claude/rules/no-pfd-no-ho.md` | 3.717 | siempre |
| `.claude/rules/techo-agentes.md` | 3.163 (+~400 el 10/09) | siempre |
| `.claude/rules/core-prohibiciones.md` | 2.754 | siempre |
| `.claude/rules/autonomy-contract.md` | 2.673 | siempre |
| `.claude/rules/consumos-entregables.md` | 1.462 | siempre |
| `.claude/rules/verify-before-close.md` | 1.072 | siempre |
| `.claude/agents/auditor.md` | 8.882 | al lanzar el agente |
| `.claude/agents/amfe-healer.md` | 7.985 | al lanzar el agente |
| `pregunta-guard.sh` (texto al modelo) | ~600 | en cada AskUserQuestion |
| `session-start-context.sh` NUCLEO | ~1.000 | en cada compactacion |
| `cierreGuard.mjs` titulos+detalles | ~1.800 | cuando el Stop hook corta |

Total siempre cargado: ~60 KB de prosa (≈ 15-17k tokens) antes de la primera palabra de trabajo.

## 3. Resumen

Conteo por grupo (alta/media/baja): **1a presion** 6/0/1 · **1c sobre-especificacion / duplicado de lo que el
harness ya da** 2/2/1 · **1d fosiles y frases relativas** 5/3/1 · **1e cluster de prohibiciones** 1/0/0 ·
**Grupo 2 narrativa historica** 3/1/2 · **volatile specifics rotos o vencidos** 4/1/1 · **1b scaffold** 1/0/0.
Total: 22 alta, 7 media, 6 baja/flag.

Los tres de mas impacto:

1. **El parrafo de skills de CLAUDE.md (27 lineas, ~2,9 KB) duplica lo que Claude Code ya inyecta**: la lista de
   skills con su `description` llega en cada sesion por el harness. Es la regla de borrado de la guia en su forma
   mas pura ("¿el modelo ya lo sabe?": si, se lo dan). Ademas esta vencido: falta `editar-video`.
2. **Dos pasos rotos que la sesion ejecuta a ciegas**: `gh run list` en `git-deploy.md` paso 4 y en
   `auditor.md` paso 5 (gh sin login desde el 05/09, memoria `gh_cli_sin_login_ci_por_api`), y "CavityCalculator son
   pre-existentes" en `auditor.md` (hoy `tsc` da 0 errores). Un auditor que clasifica errores contra una lista vieja
   reporta ruido con cara de rigor.
3. **Tres reglas siempre cargadas llevan la historia del incidente adentro** (`techo-agentes.md` 25 lineas,
   `git-deploy.md` 18 lineas, `no-pfd-no-ho.md` 6 lineas): la regla vigente cabe en un cuarto del texto y la
   historia ya vive (o va) en una memoria que se lee al tocar el tema.

Lo que NO se toca (keep): decisiones fechadas de Fak con su cita textual (repo publico, flujogramas los hago yo,
no cerrar el arb, techo 5, modelo por tipo de tarea), los `paths:` de la tabla de reglas (routing), las
prohibiciones de `core-prohibiciones` §1-7 (tienen gate o procedencia), los textos de los hooks (calibrados, con
el porque al lado y medidos contra la poblacion real de cierres).

## 4. Hallazgos

Campos: Ubicacion · Evidencia · Patron · Por que obsoleto para Fable 5.1 · Confianza · Accion.

### CLAUDE.md

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 1 | `CLAUDE.md:103-129` | `**Skills** (on-demand): apqp-schema (...), product-map (...)` 27 lineas | 1c + regla de borrado | El harness inyecta nombre y `description` de cada skill en cada sesion; el parrafo repite eso peor (falta `editar-video`, describe `cad-design` en 5 lineas) | alta | rewrite → 3 lineas: los skills son el sistema de roles, la lista la da Claude Code, detalle en cada SKILL.md |
| 2 | `CLAUDE.md:5-7` | `(aclarado por Fak el 2026-08-07; antes esto decia "multi-usuario" y me hizo sobredimensionar un bug)` | 1d frase relativa | Describe la version anterior del archivo; el modelo no necesita saber que decia antes | alta | rewrite: dejar el hecho y la fecha |
| 3 | `CLAUDE.md:22` | `(desde 04/09/2026; el hook que lo inyectaba llegaba recortado a 2 KB)` | 1d fosil | Historia del canal viejo; ya esta en LECCIONES y en `lecciones-consolidacion.md` | alta | delete parentesis |
| 4 | `CLAUDE.md:29` | `## Protocolo de fin de sesion — OBLIGATORIO, NO OPCIONAL` | 1a presion | Lo hace cumplir `_cierreSesion.mjs` (exit 1) y el hook Stop `cierre-guard.sh`; las mayusculas ya no informan | alta | rewrite titulo |
| 5 | `CLAUDE.md:40` | `NO preguntar si Fak quiere que lo hagas. HACERLO.` | 1a + duplicado de :49 y de core §8 | Tres copias siempre cargadas + dos hooks (`pregunta-guard.sh`, `cierre-guard.sh` chequeo 1) | alta | delete (queda la de "Como interactuar") |
| 6 | `CLAUDE.md:49-50` | `NUNCA preguntar "queres que haga X?" — HACERLO y reportar. Si estas por escribir "queres que...?" o "lo hago?": PARA, la respuesta es siempre SI.` | 1a/1e | Se queda UNA vez, en frase normal, con el porque (37 AskUserQuestion en 2 semanas) y el puntero a los hooks | media | rewrite |
| 7 | `CLAUDE.md:59-66` | `## Reglas criticas — NO ROMPER` + item 1 repite core §5-6 con detalle | 1a + duplicado siempre cargado | `core-prohibiciones.md` ya entra en cada sesion; el detalle ("8 familias", "VWA/PWA") vive ahi | media | rewrite: titulo sin presion, item 1 → puntero |
| 8 | `CLAUDE.md:93` | `boton dev-login: NO TOCAR NUNCA` | 1a | La regla `dev-login.md` carga sola al tocar `components/auth` | media | rewrite: "no se toca (regla propia)" |
| 9 | `CLAUDE.md:164` | `17 repositorios tipados` | volatile specific vencido | En disco hay 23 (`ls utils/repositories/*.ts`) | alta | rewrite sin numero. Idem `database.md:16` |
| 10 | `CLAUDE.md:179` | `...y el 02/09 un auditor independiente le paso 92 de 111 evasiones a gates que yo daba por probados (coordinador.md)` | Grupo 2 narrativa duplicada | El mismo caso esta en LECCIONES (bullet "Lo que yo construyo...") que entra al mismo prompt | media | rewrite corto con puntero |
| 11 | `CLAUDE.md:11-19` | Protocolo de inicio paso 0 "PC nueva" (9 lineas) | 1c | Lo detecta `cerebro-guard.sh` en SessionStart; la red manual cabe en 3 lineas | media | rewrite |
| 12 | `CLAUDE.md:189` | `NotebookLM fue RETIRADO (decision Fak 2026-07-23)` | 1d leve | Decision fechada (keep #4); solo se reordena a estado vigente primero | baja | flag |
| 13 | `CLAUDE.md:70-100` tabla `paths:` | filas de 3-4 lineas (`documentacion-oficial`, `video-maquina`, `coordinador`) | 1c | Son routing hacia reglas que NO estan cargadas: el resumen sirve; solo se recortan las filas mas largas | baja | flag (recorte opcional) |

### Reglas siempre cargadas

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 14 | `git-deploy.md:10` | `**Verificar CI** — gh run list --limit 1` | volatile specific roto | `gh auth status`: "not logged into any GitHub hosts" (verificado 10/09; ya el 05/09 en memoria `gh_cli_sin_login_ci_por_api`). El paso falla con exit 4 en cada cierre | alta | rewrite: `curl -s https://api.github.com/repos/facussc24/tiempos-y-balanceos/actions/runs?per_page=1` y leer `status`/`conclusion` |
| 15 | `git-deploy.md:12` | `(Hasta 2026-07-29 habia un segundo motivo, que Fak trabajaba en 2 PCs; ya no: desde 2026-08-02 quedo una sola, la notebook DESKTOP-14JG95B ...)` | 1d fosil | Narra una version anterior de la regla; el dato vigente esta en memoria `una_sola_pc_facu` | alta | delete parentesis |
| 16 | `git-deploy.md:46-63` | `## Causa raiz del incidente 2026-04-13` + `## Regla absoluta: SIEMPRE...` + `## Nunca mas` (3 NUNCA) | Grupo 2 narrativa + 1e cluster + 1a | La regla (build local antes de push; dependencia en package.json) ya esta en los pasos 1-2 y en el checklist; las 18 lineas restantes son la historia y su eco | alta | move incidente → memoria nueva `reference_incidente_deploy_html_to_image_2026-04-13`; delete las 3 secciones; una linea de "por que" con el puntero |
| 17 | `git-deploy.md:1` | `# Regla: Git Commit + Push + Build Verification — OBLIGATORIO` | 1a | Enforced por `_cierreSesion.mjs` (paso git) | media | rewrite titulo |
| 18 | `git-deploy.md:39-41` | `⚠️ Limite conocido de ese gate: CHECK-2 mira nombres de archivo, no contenido` | volatile specific vencido | Desde el 08/09 existe CHECK-3 (busca secretos de planta por contenido, LECCIONES 08/09) | media | rewrite mencionando CHECK-3 |
| 19 | `verify-before-close.md` (todo) | 5 items + `**Why:**` + `**How to apply:**` | 1b scaffold de memoria + duplicado | Items 1 y 2 = `git-deploy` pasos 1-2; item 5 = `consumos-entregables` §3 y `cierre-guard` chequeo 4 (10/09); el formato Why/How es el de las memorias, no el de una regla | alta | merge: items 2-4 pasan a `git-deploy.md` como "Antes de decir listo"; archivo eliminado; fila de la tabla de CLAUDE.md fuera |
| 20 | `techo-agentes.md:11-35` | `## Por que` (2 incidentes, 14 lineas) + `## Los tres errores` (11 lineas) | Grupo 2 narrativa | La regla vigente es: techo 5, enforced por hook, como decidir, escapes. La historia se lee al tocar el tema, no en cada sesion | alta | move → memoria nueva `feedback_techo_agentes_los_dos_incidentes_2026-08` (texto integro, citas de Fak incluidas); en la regla queda una linea con el puntero |
| 21 | `techo-agentes.md:1` | `# Techo de subagentes — 5. No es una sugerencia.` | 1a | Es un hook con exit 2: la frase no agrega fuerza | media | rewrite |
| 22 | `core-prohibiciones.md:11` | `8. Si Fak te corrige: registrar la leccion ... Si detectas un problema: reportarlo ... NUNCA preguntar "queres que haga X?"` | duplicado siempre cargado (3 frases identicas a CLAUDE.md "Como interactuar") | Mismo prompt, dos veces; el archivo es de prohibiciones de DATOS, este item es de conducta | alta | delete §8 (renumerar §9 → §8) |
| 23 | `consumos-entregables.md:16-19` | `calibrada el 05/09/2026 contra los 26 disparos reales de 15/08-04/09; la palabra suelta "consumo" ya no dispara (bloqueaba escribir memorias y reglas SOBRE consumos)` | 1d "ya no" + narrativa | Se escribe el estado vigente; la calibracion queda como fecha | media | rewrite |
| 24 | `no-pfd-no-ho.md:1` | `# Flujogramas SI (desde 18/08/2026, con el generador del repo) · HO solo a pedido · el MODULO de la app sigue muerto` | 1d ("desde", "sigue") | Titulo escrito como cambio, no como regla | media | rewrite |
| 25 | `no-pfd-no-ho.md:3-9` | `## 🔴 Cambio del 18/08/2026 — los flujogramas los hago YO` + `Es la segunda vez que lo pide. La primera no la tome y le devolvi un prompt...` | 1d + Grupo 2 | La regla es una frase; las 4 citas de Fak son la evidencia y se quedan (keep #5); la historia de "la primera vez" se comprime a una linea | media | rewrite |
| 26 | `no-pfd-no-ho.md:27-31` | `Decision original 2026-05-22 ... Aclarado 2026-08-13 ... Ya paso con la HO 118 (05/06) y la HO-985 IP PAD (02/07)` | 1d patch accretion | Tres capas de fechas para una regla: "las HO se arman aca cuando Fak lo pide, nunca por cuenta propia" | media | rewrite con una fecha |
| 27 | `autonomy-contract.md` | tablas A-E | — | Sin hallazgo: forma correcta (tabla de decisiones, sin presion), coherente con el modo plan | — | keep |

### Agentes

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 28 | `auditor.md:65` | `gh run list --limit 1 --json status,conclusion ...` | volatile specific roto | idem #14: el agente reporta "CI: FALLO" por un exit 4 del CLI, no por el CI | alta | rewrite con el curl |
| 29 | `auditor.md:40` | `Clasificar: nuevos vs pre-existentes (CavityCalculator son pre-existentes)` | volatile specific vencido | `npx tsc --noEmit` 10/09: 0 errores; `components/CavityCalculator.tsx` no existe con ese nombre | alta | rewrite: "hoy el proyecto compila sin errores: cualquier error es nuevo" |
| 30 | `auditor.md:31`, `amfe-healer.md:25` | `la precarga por frontmatter depende de la version de Claude Code — verificado ausente 2026-07-17` | volatile specific sin re-verificar | Dato de la herramienta de hace 2 meses y 130 versiones; se re-verifica con el log `InstructionsLoaded` de una corrida del agente | baja | flag: re-verificar; el fallback ("si no esta, leelas") es inocuo |
| 31 | `auditor.md:123,138` | `**INCIDENTE 2026-04-09:** ...` `**INCIDENTE 2026-04-12:** ...` | Grupo 2 narrativa corta | Son el "porque" de C-AUTH/C-FIELD/C-OPFUNC en 2 lineas cada uno (keep #2); no se tocan | baja | keep |
| 32 | `amfe-healer.md:20,96` | `## Protocolo obligatorio (NO saltear pasos)` · `## Reglas duras (violation = CRITICAL error)` | 1a | Titulos con presion sin porque; el contenido debajo es correcto (pide OK para escribir datos: coincide con `autonomy-contract` A) | media | rewrite titulos |
| 33 | `amfe-healer.md:169` | `_autoHeal.mjs — ejecutor viejo (HISTORICO, su input _auditIntegral.mjs ya no existe; ...)` | 1d fosil | Referencia a un script archivado para explicar que no sirve | baja | delete linea |

### Hooks (texto que llega al modelo)

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| 34 | `session-start-context.sh` NUCLEO item 1 | `Las reglas .claude/rules/ condicionales (paths:) NO sobreviven la compactacion` | volatile specific | **Verificado 10/09 con el log `InstructionsLoaded`**: en `compact` se recargan CLAUDE.md y las 8 reglas sin `paths:` (6 compactaciones), ninguna con `paths:`. La frase es correcta | — | keep |
| 35 | `session-start-context.sh` NUCLEO item 6 | `(19 arranques en ingles en la semana del 02/09/2026)` | Grupo 2 numero historico | Es el porque; 60 caracteres | baja | keep |
| 36 | `pregunta-guard.sh`, `cierreGuard.mjs:572-630` | textos de los 5 chequeos | — | Calibrados: frase, porque con fecha, accion concreta, sin mayusculas de presion; nacidos de la poblacion real de cierres (canon `_que_es`) | — | keep |

### LECCIONES (solo flags: la esta editando otra sesion)

| # | Ubicacion | Evidencia | Patron | Conf. | Accion |
|---|---|---|---|---|---|
| 37 | `LECCIONES:17` | `ahora lo clava el control 4ter` | 1d "ahora" | baja | flag para la sesion que lo edita |
| 38 | `LECCIONES:3-7` | cabecera | — | — | keep (ya sin fosiles desde `d90eba51`) |

## 5. Cambios aplicados (alta/media)

Aplicados el 11/09/2026, en el commit siguiente al del informe: hallazgos 1-12, 14-26, 28-29, 32
(el 33 tambien, por trivial); `verify-before-close.md` eliminado. Los demas `baja`/`flag` quedan aca.
Dos memorias nuevas reciben la historia que sale de las reglas:

- `feedback_techo_agentes_los_dos_incidentes_2026-08.md` ← `techo-agentes.md` "Por que" + "Los tres errores", integro.
- `reference_incidente_deploy_html_to_image_2026-04-13.md` ← `git-deploy.md` "Causa raiz" + "Regla absoluta" + "Nunca mas".

Resultado medido el 11/09: `CLAUDE.md` 13.949 B → 9.610 B (el objetivo era < 9.000 B; lo que queda es la tabla de
routing de las 18 reglas con `paths:`, ~3,3 KB, que si sirve porque esas reglas NO estan cargadas). Reglas siempre
cargadas: 18,5 KB → 15,8 KB (una menos: `verify-before-close.md`). Ademas se saco la tabla "Siempre cargadas" de
CLAUDE.md (repetia reglas que ya estan en el contexto) y `_cerebroLint.mjs` ahora acepta esa lista como parrafo
(`reglasDeParrafo`, con su test). Las 4 citas a `verify-before-close.md` en skills (`cad-design`, `editar-video`,
`hojas-de-proceso`, `verificacion-consumos`) y en la memoria `ghpages_manual_deploy` apuntan a `git-deploy.md`.

Verificacion: `node scripts/_cerebroLint.mjs` 0 rotos (1 aviso previo, ajeno a esto), `node scripts/_cierreSesion.mjs
--sin-build` con LECCIONES en verde. La medicion de contexto del primer turno se repite en una sesion nueva con
`node scripts/_tokens.mjs --desde 2026-09-10`.
