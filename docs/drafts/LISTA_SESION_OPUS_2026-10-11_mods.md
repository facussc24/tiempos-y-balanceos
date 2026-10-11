# Sesión Opus 5.5 del 11/10/2026 — instalar los mods y aplicar lo preparado

Pedido: `docs/drafts/PROMPT_SESION_OPUS_2026-10-11_mods.md` (Fak, 11/10 04:05). Arrancó 09:14. Cupo semanal: 55 % al arrancar, 59 % a las 10:49 (corte de la sesión: 75 %). La API está en rojo este ciclo (US$ 262 de 170): no se usa.

## SI LA SESIÓN SE COMPACTÓ, LEER ESTO PRIMERO (estado a las 10:49)

**En `main`, commiteado y pusheado** (`02e1321b`): `f929d890` resto de HOY-12 · `951d70ce` HOY-24b (agente por API cerrado, candado de `--seco` sacado) · `e371b74b` HOY-18d (página HTML) · `02e1321b` cola y lista. El CI de `02e1321b` terminó en verde (leído por API a las 10:49).

**En `main`, SIN commitear (paso 1, los mods; ya INSTALADOS y probados en una sesión real):**
`mods/presupuesto-agentes/{README.md,.gitignore,hooks/presupuesto.mjs,hooks/register.js,tests/presupuesto-agentes.test.ts}` · `mods/tablero/{hooks/estado.mjs,hooks/register.mjs,tests/tablero.test.mjs,tests/tablero-cascara.test.ts}` · `__tests__/mods/presupuesto-agentes.test.mjs` · `__tests__/mods/registroDelMod.test.mjs` · `scripts/_modsInstalar.mjs` · `__tests__/scripts/modsInstalar.test.mjs` · `tsconfig.json` · `vitest.config.ts` · `.claude/rules/techo-agentes.md` · `docs/COLA_CAMBIOS_CODIGO.md` (17 filas nuevas HOY-28 a HOY-44; HOY-26 y HOY-27 tachadas) · esta lista.
→ **Falta**: el SÍ de la segunda vuelta del auditor de los mods (pedida 10:49, agente `a32aeb14a3f6e74d7`); actualizar en la cola las filas **P33** y **HOY-25** (instalados el 11/10; qué se midió; el tablero sin ver en pantalla); `npm run build`; commit por rutas; push; CI. Si el auditor pide un cambio en `mods/`, después del cambio: `node scripts/_modsInstalar.mjs --aplicar` (actualiza las dos copias instaladas) y `--estado`.
NO commitear lo ajeno que ya estaba modificado al arrancar: `.env.example`, `__tests__/scripts/amfeAutoria.test.mjs`, `docs/auto-mejora/*`, `scripts/_crearAmfeUpperTrimming.mjs`, `scripts/_lib/amfeAutoria.mjs`, `tools/instalar_mi_pc/LEEME_CARPETA.txt`.

**En el worktree `C:\Dev\BarackMercosul\.claude\worktrees\p14-p18` (rama `p14-p18`), commiteado ahí, NO en `main`** (los hooks vivos siguen con el código viejo): `780797dd` P14+P15 · `c30bf4f9` P16 · `fbfb6db9` P18 · `7c80dd96` toolL + `escapes:false` · `79240008` P9 rotación · `2b873644` P10 C1a · `1d6582b2` P10 C1b. `node_modules` del worktree es un enlace al del principal.
→ **Falta**: los informes de dos auditores que trabajan sobre el worktree: **P14-P18** (agente `a7748745416d8f626`, informe a `.sgc-cache/auditorias/P14-P18_auditor_2026-10-11.md`, con el diferencial `.sgc-cache/auditorias/P14-P18_diferencial_2026-10-11.md`) y **hooks fusionados P10** (agente `ad07d93baf1b4853e`, informe a `.sgc-cache/auditorias/P10_hooks_fusionados_auditor_2026-10-11.md`). Con su veredicto: arreglar lo que marquen EN EL WORKTREE, y traer a `main` (rebase de `p14-p18` sobre `main` y `git merge --ff-only p14-p18`, o cherry-pick en orden); después `node scripts/_probarMejora.mjs --mensaje "el de SC/CC al pedo me parece, pero los otros 2 mods sí me parecen útiles" --espera "CARACTERISTICAS ESPECIALES"` (en el worktree ya dio «sin fallas»), build, push, CI. Al traerlo, **decir que las sesiones abiertas toman solas los hooks y guardianes**.
→ **P10 commit 4 (cablear UserPromptSubmit en `.claude/settings.json`)**: parche `.sgc-cache/investigacion-2026-10-11/integracion_api/parches_integrar-hooks-un-solo-node-P10/bloque16.patch` + `bloque17.patch` (el de `hooksTienenTest`, que NO aplica: rehacerlo a mano). El plan pide: sin otras sesiones trabajando, respaldo de `.claude/settings.json`, `_probarMejora` al minuto y `git revert` si un hook deja de contestar. Solo si el auditor de P10 dice SÍ. **El commit 5 (cablear Stop) NO va**: el plan §6.4 lo ata a la medición de P9 (5 días hábiles desde el 10/10 23:23).
→ **HOY-28** (el guardián de borrado deja pasar `rm -rf` con `node_modules`/`dist…`/`-r -f`): confirmado por mí; es endurecer; hacerlo en el worktree después del auditor de P14-P18 si queda cupo, si no queda en la cola.

**Sesiones de prueba lanzadas (ya terminadas, encargos cerrados)**: `local_dbe7c0f9…` (informe `.sgc-cache/auditorias/MODS_primera_sesion_2026-10-11.md`) y `local_1d6e97ac…` (`MODS_tablero_sesion_2026-10-11.md`). Tareas a borrar de Programadas (las borra Fak): `hija-prueba-mods-20261011`, `hija-prueba-tablero-20261011`.

**Al cerrar** (prompt, sección «Cierre»): `node scripts/_cierreSesion.mjs`, LECCIONES (hubo lecciones: ver abajo), memoria `project_tanda_orquestador_2026-10-10_donde_quedo` con una sección de esta sesión, `node scripts/_nube.mjs --subir --aplicar`, quitar el worktree solo si todo entró a `main` (`git worktree remove`), y el resumen para Fak **empezando por lo que necesito de él**.

**ACTUALIZACIÓN 11:01 (después del auditor de P14-P18):** veredicto: P14+P15 entran solo con 5 arreglos, P16 con uno, **P18 no entra** (informe `.sgc-cache/auditorias/P14-P18_auditor_2026-10-11.md`). **No entran hoy.** Lo único que entró a `main` es lo que endurece: commit **`18e131af`** (pusheado; falta leer su CI): `nube-personal-guard` y `apqp-cliente-guard` ven un Write/Edit por el camino real + `escapes:false`. Aplicado a mano sobre `main` (no por cherry-pick). La fila P14 de la cola ya tiene el veredicto. La rama `p14-p18` queda con P14-P18 SIN arreglar y con P9 rotación + P10 C1a + C1b encima: **si el auditor de P10 dice SÍ, los tres commits de P10 (`79240008`, `2b873644`, `1d6582b2`) se traen a `main` por cherry-pick, SIN los de P14-P18** (tocan otros archivos: `hooksTiempos.mjs`, los módulos nuevos, `horaGuard.mjs`, `cierreGuard.mjs`, `caracteristicas-especiales-prompt.sh`, tests). HOY-28 (borrado) NO se hace hoy: P18 hay que rehacerlo y va junto.

**ACTUALIZACIÓN 12:10 (lo que pasó después de las 11:01; manda sobre la tabla de abajo):**
- **Mods**: commiteados (`1f083674`); el CI quedó rojo por una línea (`#!` en `scripts/_modsInstalar.mjs`, lo cazó el auditor en su 2ª vuelta) → arreglado en `502ca143`. Lo que el auditor dejó anotado: filas HOY-45 y HOY-46.
- **P10**: el auditor dijo SÍ a los tres commits y SÍ CON ARREGLO al cableado. En `main`: `81879443` (P9 rotación), `34858545` y `fce2b9bd` (P10 C1a y C1b, por cherry-pick, sin P14-P18) y **`48811ad7` (C2: UserPromptSubmit con UN hook, `prompt-hooks.sh`)** con sus tres condiciones y el `.sh` que sale con 1. CI de `48811ad7`: verde. Respaldo: `.claude/settings.json.antes-P10-C2-20261011` (ignorado por git). La suite COMPLETA local encontró tres tests que daban por sentado los cuatro renglones (correccionGuard, probarMejora, hooksTienenTest): actualizados en el mismo commit. Segunda vuelta del auditor pedida (agente `ad07d93baf1b4853e`). C3 (Stop) NO va: fila HOY-47.
- **11:35, Fak escribió** (único mensaje suyo además del pedido): vio la banda y marcó lo que no se entendía. Hecho en `c2e18522` (pusheado; instalado con `--aplicar` a las 11:55): gasto de la API por clave (`saldo.json`, `etiquetaClave`, `saldoPorClave` en `claudeApi.mjs`), fila api «plan: gastado · quedan · hasta el 30/10 · prestada: agotada», la noche dicha en claro, la semana con día. Auditoría pedida al auditor de los mods (agente `a32aeb14a3f6e74d7`, «Tercera vuelta»).
- **11:55: la semana pasó a 61 %**: el mod de presupuesto ya niega subagentes nuevos (salvo auditoría) en las sesiones nuevas.
- **12:20 a 12:55, los dos auditores volvieron**: hooks (C2) **SÍ, sin errores reales**; sus notas aplicadas en `78318bdb` (la tercera lista del canon, un test que fija las tres, el test del tope corta en 9.600). Banda y gasto por clave: **SÍ con tres arreglos**, hechos en `2fd6e295` (la prestada no pudo pagar más de sus US$ 100: plan 163 gastados, quedan ≈ 37) y `307eb81b` (las filas se acortan hasta entrar en el ancho; la noche sin «para mirar»; el reparto de los pedidos viejos fijo en `REPARTO_SIN_ETIQUETA`). Reinstalado a las 12:52; `--estado`: las dos copias iguales al repo. Lo que quedó de los auditores: filas HOY-45 a HOY-48.
- Todo commiteado y pusheado. En el árbol quedan solo los 7 archivos que ya venían modificados de otra sesión (no son de esta tarea, no se tocaron).

## Estado por paso

| Paso | Qué | Estado |
|---|---|---|
| 0 | `known_marketplaces.json` con marca BOM | **Hecho**: reescrito sin la marca; respaldos `*.antes-mods-20261011` (ese archivo, `installed_plugins.json`, `settings.json`) |
| 1 | Instalar `tablero-casa` y `presupuesto-agentes` | **INSTALADOS** (marketplace `mods-casa`, copia en `~/.claude/mods-casa/` y en `~/.claude/plugins/cache/mods-casa/`). Medido en una sesión nueva de la app (10:38): el presupuesto cargó, decidió un `buscador` (peso 1) y un `auditor` (peso 0) con `def=<carpeta>`, leyó el cupo real (`five_hour`, `seven_day`), y su registro coincidió con el del bash. El tablero cargó pero **la app no le pidió dibujar la banda en una sesión que nadie tenía en pantalla**: no pude ver la banda. Falta: SÍ del auditor (segunda vuelta), cola P33/HOY-25, commit |
| 2 | HOY-24b | **HECHO** `951d70ce` |
| 3 | P14, P15, P16, P18 (+ toolL + `escapes:false`) | En el worktree, 658 tests verdes; diferencial contra 88.996 llamadas reales: 68 cambian de veredicto. **Esperando al auditor** |
| 4 | P10 | Commits 1-3 en el worktree (igualdad: 20 mensajes reales, 7 con inyección, 0 diferencias; 438 tests de regresión verdes). **Esperando al auditor**; commit 4 pendiente de su SÍ; commit 5 no va hoy |
| 5 | HOY-26 / HOY-27 | **HECHO**: verificados por dos `investigador` Opus (`.sgc-cache/auditorias/HOY-26_verificacion_2026-10-11.md`, `HOY-27_…`); yo repetí el del borrado y el de `gh-pages`. 17 filas nuevas en la cola (HOY-28 a HOY-44) |
| 6 | P9 / C1 (H6) | **No se hace hoy**: el parche v2 de la API vino cortado (hay que completarlo a mano), toca el hook más sensible y el plan pide no mezclar con la medición C0 en curso (hasta ~17/10). Queda en su fila |
| 7 | P30 | **No se hace hoy**: su fila dice «después de H37» (investigar los 194 casos de código 127), que no está hecha; y la integración hay que escribirla de cero |
| 8 | HOY-12 resto, HOY-18d página | **HECHO** `f929d890`, `e371b74b` |

## Lo que necesita a Fak (va PRIMERO en el cierre)

1. **La clave actual del usuario de desarrollo está publicada** en la rama pública `gh-pages` del repo (commit `b685a744` del 30/08; `assets/index-DgWvDWRX.js`). Medido: mail y clave de `.env.local` de hoy están en ese archivo. Dos pasos, los dos suyos: `node scripts/_rotarPasswordDev.mjs` en una terminal, y borrar la rama `gh-pages`. Fila HOY-36.
2. **La semana pasó el 60 % (61 % a las 11:55): el mod nuevo ya no deja salir ningún subagente** (salvo la auditoría) en las sesiones nuevas, hasta el vie 16/10 13:00. **El 60 no es un número suyo**: entró con el borrador que escribió la API; los suyos son 75 % para cerrar una sesión y 60/65 para lanzar hijas. Si quiere agentes igual: que lo diga y se escribe `touch ~/.claude/.agent-cupo-ok` (12 h). Alternativa que probé y saqué porque nadie la pidió (lo marcó el auditor): entre 60 y 85 % dejar salir pocos (10 puntos cada 10 min) en vez de ninguno; negar también una búsqueda en Haiku manda ese trabajo al modelo de la sesión, que cuesta más. Es decisión suya.
3. **El tablero**: Fak ya vio la banda (captura, 11:35) y marcó cuatro cosas; corregidas e instaladas (`c2e18522`). La ve en una sesión nueva o con `/reload-plugins`. Falta que la mire de nuevo y que pruebe `/tablero` (el panel). Si molesta: `claude plugin disable tablero-casa@mods-casa`.
3 bis. **La tarea de la noche está frenada hasta el 30/10** porque su tope suma las dos claves (US$ 262,93 de 170). Con la cuenta por clave, de la del plan salieron ≈ US$ 163 (96 % del tope de 170: amarillo, no rojo). Si quiere que vuelva a correr (≈ US$ 1 a 3 por noche de los ≈ US$ 37 que quedan): fila HOY-49.
3 ter. Los cuatro `.sh` viejos de mensajes quedaron sin uso (`caracteristicas-especiales-prompt`, `correccion-guard`, `explicar-prompt`, `hora-prompt`): borrarlos es borrar archivos → su sí.
4. `window.__cleanupAmfeActions()` está en producción (HOY-37): sacarla es sacar una función de la app → su sí.
5. Borrar de Programadas las dos tareas de prueba de hoy.
6. Un verificador mostró en su salida la línea de `scripts/hotmelt/datos_privados.py` con la clave del HMI (queda en el registro de esa sesión, que se sincroniza a la nube de Ingeniería). Esa clave ya estaba en la historia pública de git (memoria `project_automejora_2026-09-30_diez_frentes`); cambiarla en la máquina es de él o de planta.

## Decidí distinto de lo pedido

- **La banda nueva y el gasto por clave (`c2e18522`) salieron ANTES de su auditoría y sin el plan corto escrito**: Fak estaba mirando la banda y la corrección era suya. Toca `claudeApi.mjs`, que es la puerta de la noche. La auditoría se pidió enseguida (agente `a32aeb14a3f6e74d7`, «Tercera vuelta»); vuelta atrás del tablero: `~/.claude/mods-casa/_anteriores/tablero-20261011-115451`.
- **Marketplace en una copia (`~/.claude/mods-casa/`), no en `mods/` del repo**: un marketplace de ruta local carga en el lugar; con `mods/` una edición a medias quedaba viva en todas las sesiones. La copia cambia solo con `scripts/_modsInstalar.mjs --aplicar` (valida y prueba antes).
- **El agente por API ya no corre `node`, y de Python corre solo sus propios `.py`**, adentro de una caja en tiempo real (`scripts/_lib/agenteCaja.py`). Node 22.20 no corta la red ni deja excluir los secretos del repo; un script del repo puede guardar en la nube o escribir en Supabase aunque su texto no lo diga. Lista de scripts del repo permitidos: `scripts/_lib/agenteCanon.data.json`, vacía.
- **P14-P18 y P10 se trabajan en un worktree y entran a `main` de una vez**: `guardianes.mjs` y los hooks corren en vivo; un parche que deja el archivo roto frena a todas las sesiones.
- **El contrato de P10 (commit C1b) lo escribí yo** (la integración lo dejaba para la API, en rojo): `horaGuard.atenderPrompt`, `horaGuard.correrStop`, `cierreGuard.correrStop`.
- **C1/H6 y P30 no se arrancaron** (motivos en la tabla).
- **El freno semanal quedó como dice la regla (60 %)**: había puesto un tramo intermedio y el auditor marcó que era aflojar sin pedido de Fak; lo saqué.

## No pude verificar

- ~~Que la banda del tablero se vea en la app~~: **Fak la vio a las 11:35** (captura). Lo que sigue sin verse: la banda NUEVA en su pantalla (está instalada; el dibujo con los datos reales de esta PC lo corrí yo: ninguna fila pasa de 93 columnas) y el panel `/tablero`.
- El hook único de mensajes en una sesión real: **sí se vio una vez** (el mensaje de Fak de las 11:35 recibió `[EXPLICAR-MEJOR]` por `prompt-hooks.sh`). No se vio: un mensaje real con las cuatro piezas a la vez, ni un corte de la app a los 30 s (`hook_cancelled`): fila HOY-47.
- El gasto por clave de los pedidos de ANTES del 11/10 es estimado (el registro no anotaba la clave): el reparto por hora le atribuía 107,04 a la prestada, que tenía US$ 100; desde las 12:27 el sobrante se le carga al plan (`CREDITO_PRESTADAS_USD`): plan 162,93 gastados, quedan ≈ 37,07. No es el saldo que muestra Anthropic.
- Un lanzamiento negado por cupo real en una sesión de verdad (la semana estaba en 58 %): está probado con el motor de pruebas.
- (el CI de `02e1321b` se leyó: verde)

## Lecciones para LECCIONES_APRENDIDAS (al cerrar)

- Puse horas en la cola que no había medido («HECHO 10:25») y eran falsas (el commit fue 10:10): las saqué. Una hora en un registro sale de `date` o del commit, no de la cabeza.
- Aflojé un umbral (60 % → tramos) razonando solo; el auditor lo frenó. Un umbral de la regla no se cambia sin el pedido de Fak aunque el argumento parezca bueno: va como propuesta.
- La doc decía «un marketplace local carga en el lugar» y la app de escritorio cargó la copia de la caché: se midió con un renglón en el registro (`mod=`), no se dedujo.
- Un subagente que busca dónde está una clave la imprime: en el encargo hay que decir «grep -l» o «-c», no «no la repitas».
- Pusheé los mods habiendo corrido solo las pruebas de los archivos tocados: el CI quedó rojo por una convención del repo (un `#!` en un script). Antes de un push que agrega archivos o cambia `settings.json`, la suite COMPLETA; en el segundo intento (el cableado) esa corrida encontró tres pruebas más que dependían de lo que cambiaba.
- La banda la escribí con mis palabras (`api hoy/octubre`, `283 llamadas · en curso`, `noche · 0 prioridades`) y Fak no la entendió. Corrección suya del 11/10 11:35; el criterio quedó en la memoria `feedback_lenguaje_del_entregable_palabras_de_fak`.

## Registro (horas medidas: `date`, «Start at» de vitest, hora de cada commit)

- 09:14 arranque. Paso 0. 09:26-09:29 paso 1 (primer código). Auditor de los mods lanzado.
- 09:42 paso 2. Auditor del agente lanzado. 09:46 cupo 55 %. Paso 3 en el worktree. 09:54 diferencial y verificadores.
- 09:57-10:05 paso 4 en el worktree (P9, C1a, C1b; igualdad 0 diferencias).
- Auditor del agente: NO → arreglo → segunda vuelta SÍ. 10:08 cupo 57 %.
- 10:09 `f929d890` · 10:10 `951d70ce` · 10:15 `e371b74b` · push `02e1321b`.
- Auditor de los mods: 5 hallazgos (T1 tipos, T2 registro en paralelo, T3 auditor negado sin definición, T4 vuelta atrás que miente, T5 umbral aflojado) → arreglados.
- Verificadores HOY-27 y HOY-26: vuelven; repetí borrado y `gh-pages`.
- 10:32 primera instalación · 10:35 actualización · 10:38 sesión de prueba (mods cargan y deciden) · 10:45 actualización con el registro del tablero · 10:46 segunda sesión de prueba (el tablero carga; no dibuja sin pantalla).
- 10:49 cupo 59 %; segunda vuelta del auditor de los mods pedida; 17 filas nuevas en la cola.
- 11:02 `1f083674` (mods) → CI rojo (shebang) · 11:16 cupo 60 %; `502ca143` · 11:18 cherry-pick de P9/P10 y push (`fce2b9bd`, CI verde a las 11:24).
- 11:26-11:35 suite completa (4 rojos por el cableado, 1 ajeno) · 11:35 mensaje de Fak sobre la banda · 11:42 `48811ad7` (C2) y push (CI verde).
- 11:45-11:54 gasto por clave + banda nueva; 11:55 instalada; cupo 61 % · 11:56-12:06 suite completa (verde para lo tocado) · `c2e18522` y push · auditorías pedidas a los dos auditores (reanudados).
- 12:14 `2469b373` (documentos del cierre; CI verde) · 12:17 nube: 230 archivos · 12:20 `78318bdb` · 12:28 `2fd6e295` · 12:29 build local OK · 12:52 reinstalación · 12:53 `307eb81b`.
- Disco: 9,2 GB libres en C: (medido 12:17; bajo el piso de 10). Los videos de la biblioteca ya están liberados (el barrido en seco no encontró nada); la carpeta temporal de esta sesión pesa 674 MB.
