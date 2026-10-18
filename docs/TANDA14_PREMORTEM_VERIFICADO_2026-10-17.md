# Tanda 14 · El pre-mortem, verificado contra main (17/10/2026)

El informe C del 15/10 (`Claude Fak\viernes-17-plan-sistema\20-informes\oportunidades\C_premortem.md`) listó los 10
fallos más probables de la semana y, para cada uno, un arreglo que el plan da por «ya aplicado» (plan, tanda 14). Acá
está cada arreglo medido el 17/10 entre las 19:20 y las 20:00, no leído del plan:

- **main** = `87679546` (la rama de esta tanda sale de ahí), con los archivos y renglones de este checkout;
- **la configuración** = `~/.claude/` de la PC principal (`DESKTOP-14JG95B`), no la de la notebook de Calidad, donde se
  midió el informe;
- **el prompt y el plan** = `11-PROMPT_IMPLEMENTACION_2026-10-16.md` y `10-PLAN_SISTEMA_2026-10-16.md` de la nube, leídos
  enteros el 17/10.

Estados: **aplicado** (está en main o en la configuración, con archivo y renglón o commit) · **a medias** (una parte sí y
otra no: se dice cuál) · **falta** · **ya no aplica** (el riesgo se cerró por otro lado).

## Resumen

**4 aplicados · 5 a medias · 0 que falten enteros · 1 que ya no aplica.** Lo que falta, junto: las dos pruebas antes de
fundir guardianes no las pide ninguna regla ni script, solo el prompt y este documento (2), el sensor de
correcciones sigue sin ver dos citas textuales de Fak (3), la hoja de los viernes no tiene las 3 filas que pedía el
informe (3), la plantilla del encargo no dice que los comandos van en un archivo (5), el freno de las impresoras de
papel sigue en una rama sin fundir y la Bambu manda sin permiso una pieza corta de día (6), y el prompt conserva tres
renglones viejos (9).

## La tabla

| # | Fallo | Lo que el informe daba por aplicado | Medido el 17/10 | Estado |
|---|---|---|---|---|
| 1 | Cupo: Fak se queda sin cupo para Barack | Prompt: al 65 % del semanal no se arranca otra tanda; cada cierre dice cuánto queda; probar el aviso del 61 % | Prompt:28 lo dice («al 65 % cerrás la tanda… no arrancás otra tanda del sistema: lo que queda es para el trabajo de Barack»). Los cierres de tanda anotan el cupo en la memoria del plan (`project_plan_sistema_2026-10-16_donde_quedo`, renglón 15: «Cupo 13:50: 5 h 32 %, semana 49 %»). El aviso del 61 % que «no frena» tiene su test: `__tests__/mods/presupuesto-agentes.test.mjs:89` (commit `83bd4d7a`, 16/10). El 65 % no lo hace cumplir ningún programa: es conducta de la sesión que orquesta (y es un número de Fak: no se toca) | **aplicado** |
| 2 | Un guardián roto traba todo | Plan corregido; antes de fundir algo que toque guardianes: `node --check` y una corrida del despachador; destrabe con `disableAllHooks` | Plan:161 corregido. Prompt:38 trae las dos pruebas y el destrabe. `_dispatcher.sh:30-31` devuelve exit 2 si `guardianes.mjs` no carga: **medido** en una copia con el módulo roto (Bash → exit 2). **Corrección al informe:** «ni el Edit que lo arreglaría» no es cierto para `guardianes.mjs`: el carril de auto-reparación (`_dispatcher.sh:85`, desde el 22/09) deja pasar un Edit o Write sobre `guardianes.mjs`, sus módulos y sus `.data.json` (misma copia rota: Edit de `guardianes.mjs` → exit 0 con aviso; Edit de otro archivo → exit 2). Lo que sí queda trabado es Bash (un `git checkout -- …` no pasa). Las dos pruebas antes de fundir solo estaban escritas en `docs/PLAN_GUARDIANES_2026-10-16.md:39` (el plan de la tanda 3) y las corrieron las auditorías de la 1.6 y la 3; ninguna regla ni script las pide: quedan escritas abajo como procedimiento fijo. Hoy en esta rama: `node --check` OK y despachador con un comando inocuo → exit 0 | **a medias**: está en el prompt y escrito acá, pero no en una regla ni en un script que lo haga cumplir |
| 3 | El viernes 23 nadie puede decir con números si el plan funcionó | Línea de base del 16/10 con el mismo comando del 23; calibrar el sensor de correcciones; las 3 filas que faltan | Línea de base **medida** el 16/10 con `node scripts/_cuatroNumeros.mjs --desde 2026-10-09 --hasta 2026-10-16` (memoria del plan, tanda 0; `exports/explicaciones/medicion_2026-10-16.md`). La hoja de los viernes existe (`scripts/_cuatroNumeros.mjs`). **Falta:** `esCorreccion()` (`scripts/_lib/correccionGuard.mjs:90`) sigue dando `false` a «agarraste un archivo viejo sin verificarlo» y a «usaste un logo no oficial de Barack, gravísimo» (corrido hoy); la tanda 9 no lo calibró (`docs/PLAN_METODO_2026-10-16.md` no lo nombra). **Falta:** las filas «actuó sin su OK», «dato sin papel» y «no puedo / no existe» no están en `_cuatroNumeros.mjs` | **a medias** |
| 4 | El ritual del viernes sin Haiku por la profundidad en 2 | No poner la variable, o ponerla en 3 | `~/.claude/settings.json` no tiene `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` (queda el 3 de fábrica). `techo-agentes.md:20` lo dice («la profundidad de lanzamiento queda en su default 3 por el ritual del viernes»). Prompt:56 igual. No probado acá: lanzar Opus → Sonnet → Haiku (gasta agentes; lo prueba el ritual del 23) | **aplicado** |
| 5 | El guardián del coordinador frena encargos que describen el arreglo | Los comandos que son el objeto del trabajo van en un archivo, no literales; en el prompt y en la plantilla de `_encargo.mjs` | En el prompt (26) y en la skill `lanzar-sesion-hija` (`SKILL.md:29-31`, commit `d1a2adf1`, 16/10). **Falta en la plantilla:** el ARRANQUE fijo de cada encargo (`scripts/_lib/coordinadorCanon.data.json`, desde el renglón 232) no lo dice. El guardián ya mira `start_session` (skill, renglón 28) | **a medias** |
| 6 | Una hija manda a imprimir sola | La v16 «laminada y lista»; el freno `.imprimir-ok` | Prompt:63 dice «laminada y lista… se imprime solo con el pedido de Fak»; la v16 no se imprimió (memoria del plan, tandas 11 y 12: «sin imprimir»). **Bambu:** `bambu_red.py:920` y `:1057-1071` (commit `3755a439`, 16/10) piden `<archivo>.ok` con la frase de Fak solo para una pieza de más de 3 h o que termine de noche (test `test_bambu_red.py:776`); **una pieza corta de día sale con `--apply` sin ningún permiso**. **Impresoras de papel:** el freno `.imprimir-ok` (commits `757cc628` y `f68394b3`) sigue en la rama `claude/awesome-gould-9290b2`, sin fundir (8 commits por delante de main; la rama está abierta en otro worktree); en main `_imprimir.py:97` solo frena hojas de proceso con rojo | **a medias** |
| 7 | Tocaba insistirle a Carlos el viernes 16 y el prompt prohíbe Outlook | Un renglón en el prompt: decírselo a Fak en el primer cierre; el borrador lo arma una sesión de Barack | Prompt:22 lo dice. Pero el seguimiento ya estaba cerrado: **Carlos contestó el 15/10 a las 15:23** (memoria `project_seguimientos_con_fecha`: declarar los reprocesos, con su operación de retrabajo en el AMFE y en la HO, y que Calidad lo valide). `node scripts/_seguimientos.mjs` da 0 abiertos al 17/10. Lo que queda es de Barack: el borrador a Calidad armado el 16/10, que manda Fak | **ya no aplica** |
| 8 | Hojas sin EPP: caminos abiertos | `if not d.get("epp")` en todos los caminos (A3 y hot melt) | **En todos los generadores vivos**, commit `7345ae89` (tanda 1.5): `scripts/img/generar_hojas_img.py:945`, `scripts/novax/generar_hojas_insert.py:537`, `scripts/p21/generar_hojas_p21.py:377`, `scripts/hotmelt/generar_hojas_hotmelt.py:658`, `generar_hojas_hotmelt_a3.py:660`, `hoja_a3_fotos.py:458`, `hoja_pptx.py:516`; `armar_deck.py:48` ya no pone EPP por defecto. El A3 de la IMG (`generar_hojas_img_a3.py:169`) llama a `hoja_a3_fotos.hoja()`, que frena antes de dibujar, y su `try` solo envuelve el control de redacción (renglones 162-168): el freno del EPP no se traga. Test `__tests__/scripts/hojasEppDeclarado.test.mjs`: 13/13 hoy. Lo que queda afuera, constatado y sin tocar: dos one-shots consumidos (`scripts/img/_one-shots/actualizar_deck.py:573` y `actualizar_hojas_multifoto.py:557`) con `EPP_STD` y anteojos (su LEEME: «no se corren más»); y `EPP_BASE` con anteojos en `datos_comunes.py:34`, que una hoja pide por nombre (es una declaración, no un valor por defecto) | **aplicado** |
| 9 | Dos órdenes viejas en el prompt y la prueba de la tanda 3 que no cerraba | La prueba sobre los 263 comandos Bash; corregir los renglones del prompt | Plan:165 corregido (263 comandos, 51 falsos pasan, 71 verdaderos frenan). **El prompt no:** el renglón 55 sigue con «los 436 comandos… 141 sin determinar no cambian» y «los 4 sin sí en un worktree» (choca con el 75: «los aflojes entran a main»); el 3 sigue con «Versión del prompt: 15/10 13:55» y «antes de esa hora… sin agentes ni hijas»; el 11 con «tandas 0 a 10». Hoy ya no confunden: la tanda 3 se fundió el 17/10 a las 05:56 (reflog de main) con sus aflojes en main, y las 13:00 del 16/10 pasaron | **a medias** |
| 10 | La orquestadora se compacta esperando a una hija | La memoria del plan se actualiza al cerrar cada tanda; el puntero «LEER PRIMERO» pasa a ella | La memoria `project_plan_sistema_2026-10-16_donde_quedo` tiene un renglón por tanda y un estado del 17/10 19:20; `MEMORY.md:96` la marca «(LEER PRIMERO)». Un dato viejo en el índice: dice «rama sin fundir» de `project_api_tanda5_2026-10-17_donde_quedo`, y la tanda 5 se fundió el 17/10 a las 10:30 y se pusheó a las 10:40 (reflog de main) | **aplicado** |

## Antes de fundir algo que toque los guardianes (procedimiento fijo)

Por qué: si `scripts/_lib/guardianes.mjs` no carga, `_dispatcher.sh` frena con exit 2 todo Bash, PowerShell, Write y
Edit de todas las sesiones del repo (medido arriba, fallo 2). Lo único que pasa es un Edit o Write sobre los archivos
de los guardianes (el carril de auto-reparación). Hasta hoy esto vivía solo en el plan de la tanda 3.

Se corre desde la carpeta que se va a fundir (el worktree de la hija) y otra vez en main después del merge, antes del
push. Aplica si el merge toca `scripts/_lib/guardianes.mjs`, un módulo que ese archivo importa, un `.data.json` que lee,
`.claude/hooks/_dispatcher.sh` o el `settings.json` del repo:

1. `node --check scripts/_lib/guardianes.mjs` → tiene que salir sin nada y con código 0.
2. Una corrida del despachador con un comando que no hace nada, por la entrada estándar:
   `echo '{"tool_name":"Bash","tool_input":{"command":"echo hola"}}' | bash .claude/hooks/_dispatcher.sh; echo $?` →
   tiene que dar 0. Si da 2, el texto dice qué no cargó: no se funde.
3. Los tests de los guardianes tocados (`npx vitest run __tests__/scripts/<guardian>.test.mjs`) y, si el merge agrega
   archivos o toca `settings.json`, la suite entera (`git-deploy.md`).

Si igual se rompe en main: la sesión puede arreglar `guardianes.mjs` con Edit (el carril lo deja pasar). Si lo roto es
el despachador o algo que el carril no cubre, el destrabe lo hace Fak: en el `settings.json` del repo o de su usuario
escribe `"disableAllHooks": true` (con el Bloc de notas, 30 segundos), o abre la sesión con `claude --safe-mode`
(en la PC principal `claude` está en el PATH). Después se saca. Fuentes: `disableAllHooks` es un campo de la
configuración de hooks de la documentación oficial (relevada en `docs/_archive/research-claude-code-2026-07/research_hooks.json`);
`--safe-mode` figura en `claude --help` de la versión 2.1.301 de esta PC («Start with all customizations (… hooks …)
disabled — useful for troubleshooting a broken configuration», medido el 18/10). **Que alguno de los dos destrabe de
verdad una sesión trabada no se probó acá: lo verifica la tanda 15.**

## Lo que no coincide (la tabla del informe, medida hoy en la PC principal)

| Nombre | Lo que decía el informe (medido en CATA el 15/10) | Lo que hay hoy | Estado |
|---|---|---|---|
| Variable global de modelo de subagentes | El plan y el prompt la querían en `opus`; `techo-agentes.md` dice Sonnet | `~/.claude/settings.json`: `CLAUDE_CODE_SUBAGENT_MODEL = claude-sonnet-5-5`. Las 7 definiciones llevan `model` y `effort` fijos, así que la variable no decide nada para ellas (que era lo que pedía el informe). El prompt:26 todavía dice `model: "opus"` para `start_session`; esta hija arrancó en Opus 5.5 igual | coincide con la regla; no se tocó ningún número |
| Skill `hojas-de-proceso` | 779 renglones | 394 (`SKILL.md`; el resto pasó a `reference/` en la tanda 1.5; último commit `4772019e`, tanda 12) | resuelto |
| Definiciones de agentes | 6 (3 del repo y 3 de `~/.claude/agents`) | **7**: entró `revisor-pedido` (tanda 9). Repo: `amfe-healer`, `auditor`, `auditor-cliente`, `revisor-pedido`; usuario: `buscador`, `explorador`, `investigador`. Las 7 con `model`, `effort` y `omitClaudeMd: true`; `maxTurns` en 5 (`auditor` y `auditor-cliente` sin tope, como dice `techo-agentes.md`) | constatado |
| `.imprimir-ok` | No está en main | Sigue igual (fallo 6) | falta |
| Hoja de los 4 números | `_cierreSesion.mjs` no la arma | La arma `scripts/_cuatroNumeros.mjs` | resuelto |
| «Todos los guardianes dejan pasar si fallan» | Plan:149 | Corregido en el plan (renglón 161) | resuelto |
| 436 = 51 / 71 / 141 | Prompt:54 | Plan corregido; el prompt:55 no (fallo 9) | a medias |
| `claude` en el PATH | En CATA no | En la PC principal sí (`/c/Users/FacundoS-PC/.local/bin/claude`); CATA no se midió desde acá | constatado |
| Plugin `next-steps` | Dudoso | No se instala: dibuja solo en la terminal (memoria del plan, tanda 1.2) | resuelto |
| `coordinador-guard` sobre `start_session` | No lo miraba | Lo mira desde el 16/10 (`d1a2adf1`) | resuelto |
| `_conflictos\` de la nube | Nadie lo mira | 3 archivos nuevos desde el 15/10 (de CATA el 15/10 12:26 y de esta PC el 16/10 11:13, todos memorias); no se abrieron | constatado |

## No verificado

- Que la profundidad 3 deje lanzar Opus → Sonnet → Haiku (fallo 4): no se lanzaron agentes de prueba.
- `/claude-api migrate` en el binario (fila del informe): no se miró.
- Lo de CATA (su settings, si `claude` está en su PATH): esta sesión corre en la PC principal.
