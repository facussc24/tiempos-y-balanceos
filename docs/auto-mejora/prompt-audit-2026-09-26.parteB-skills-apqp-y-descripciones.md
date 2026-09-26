# Prompt-audit 26/09/2026 — auditor B, tanda 1: skills de documentos APQP + todas las `description`

Guia: `claude-api/shared/prompt-audit.md` (Claude Code 2.1.281) + `model-migration.md` (Opus 5.5, Opus 5, Fable 5.1).
Trabajo **read-only**: no se edito ningun archivo del repo. Este informe propone; los hunks se toman de a uno.

## 0. Supuestos

- **Alcance**: `hojas-de-proceso`, `flujogramas`, `apqp-legajo`, `ppap-motherson`, `carga-arb`,
  `informe-tryout` (cuerpo entero) + el `description` de los 26 skills de `.claude/skills/` (Grupo 3).
  Donde un hallazgo no cierra sin tocar una regla (`no-pfd-no-ho.md`, `hojas-proceso.md`,
  `autonomy-contract.md`) o el canon `docs/CRITERIOS_HOJAS_DE_PROCESO.md` —que el skill manda leer
  primero y declara que "gana"—, el hunk se propone igual y se marca **↗ fuera del skill**.
- **Modelo objetivo**: Claude Opus 5.5 y Claude Fable 5.1. Las instrucciones de verificacion van
  como `flag` (Opus 5: borrarlas; Fable 5.1: mantenerlas, tentativo).
- **Keep list aplicada**: toda cita fechada de Fak se conserva; los incidentes del 13/09 en adelante
  son fallas demostradas con los modelos actuales (keep #5) — solo se propone mover la HISTORIA,
  no la regla; los comandos exactos de operaciones fragiles (arb, SLT, PDF de difusion) se quedan;
  datos de empresa en el repo no son hallazgo.
- **Y: no esta montado en esta sesion** (`/y/` no existe, `net use` vacio). Las rutas del servidor
  se dan como **no verificables**, no como rotas. No se monto el disco (seria cambiar estado).

## 1. Resumen

**42 hallazgos: 9 alta · 23 media · 10 baja/flag.**

Por grupo: **duplicados que discrepan** (skill↔skill, skill↔regla, skill↔canon) 5 alta / 9 media /
4 baja · **Grupo 2 volatile specifics rotos, falsos o vencidos** 4 alta / 5 media · **Grupo 2
history narratives / 1d fosiles, frases relativas y patch accretion** 0 alta / 5 media / 3 baja ·
**Grupo 3 descripciones** 3 media / 1 baja · **add (contrato sub-descripto)** 1 media ·
**verificacion (tension Opus 5 / Fable 5.1)** 1 flag · **vision Opus 5.5** 1 flag (se queda).

Los tres de mas impacto:

1. **La regla del TBD en una hoja de proceso dice tres cosas distintas segun donde se lea.**
   Fak, 24/09: *"no puede haber ni 1 TBD"* en la descripcion. Lo cumplen el skill (5 lugares),
   `hojas-proceso.md` #18 y `redaccion.revisar_tbd()`. Pero `no-pfd-no-ho.md:37` (always-on, 18/08)
   dice *"sin documento fuente van **TBD**"*, y el canon `CRITERIOS_HOJAS_DE_PROCESO.md` §4.4:321
   dice *"se rotula como **TBD**"* — y el skill (linea 30-31) manda abrir ese canon **primero** porque
   *"sus secciones ganan sobre cualquier criterio que yo derive solo"*. Peor: la tabla del skill
   (linea 40) le **atribuye al canon 4.4** lo contrario de lo que el canon dice. En el mismo canon
   §4.4:313 esta *"❌ Prohibido redactar en imperativo"*, y el skill §4:537 manda *"frases cortas,
   **imperativas**"* (texto del 03/09, anterior a la regla del infinitivo).
2. **`flujogramas` enseña a copiar las siglas CC/SC de la revision anterior** (linea 272-273,
   08/09): *"en un flujograma nuevo se transcriben las que ya traia la revision anterior"*. Es
   exactamente lo que `caracteristicas-especiales.md` (always-on, 11/09) prohibe dos veces: §1
   *"Nunca porque otro documento la tenia (... Rev.A de un flujograma)"* y §3 *"una ▽ heredada sin
   causa S >= 9 detras no se copia"*. Fak lo llamo *"un error gravisimo que debemos corregir para
   siempre"*. En la misma seccion §5 de entrega manda escribir el listado maestro por Excel COM como
   paso de rutina, cuando `autonomy-contract.md` §F dice **Preguntar** — y el camino COM ni siquiera
   lo ve el `apqp-cliente-guard` (su regex de escritura es `cp/mv/Copy-Item`).
3. **Dos comandos que el skill manda correr no funcionan como estan escritos**, verificado
   corriendolos: `carga-arb:76` `_pdfBomArb.py --verificar-vigencia "<PN>..."` sale con
   *"the following arguments are required: --piezas"* (el gate de productos ANULADOS, que nacio de
   un incidente, queda inutilizable; la memoria `feedback_formato_carga_arb` tiene el comando bien);
   y `hojas-de-proceso:246` `py -3 hojalib.py # ver ancho_que_le_toca_cm` no imprime nada
   (`hojalib.py` no tiene `__main__`). A esto se suma el spec "fuera del repo" (skill :610 y regla
   `hojas-proceso.md`:118), que es falso: `scripts/hotmelt/hojas_spec.py` y `HOJAS_IMG` estan
   versionados.

Lo que **no** se propone tocar esta en §6.

---

## (a) Inventario

`description` = caracteres del campo del frontmatter (viaja en TODAS las sesiones).

| Archivo | Lineas | Bytes | description |
|---|---:|---:|---:|
| `.claude/skills/hojas-de-proceso/SKILL.md` | 647 | 43.434 | 392 |
| `.claude/skills/hojas-de-proceso/vocabulario.data.json` | — | 13.612 | — |
| `.claude/skills/hojas-de-proceso/scripts/*.py` (9, solo mensajes de gate) | — | ~130 KB | — |
| `.claude/skills/flujogramas/SKILL.md` | 284 | 17.064 | 278 |
| `.claude/skills/carga-arb/SKILL.md` | 257 | 14.359 | 464 |
| `.claude/skills/apqp-legajo/SKILL.md` (nuevo) | 170 | 11.305 | 400 |
| `.claude/skills/ppap-motherson/SKILL.md` (nuevo) | 145 | 11.217 | 512 |
| `.claude/skills/informe-tryout/SKILL.md` | 46 | 3.237 | 378 |
| Superficie que entra junto: `.claude/rules/hojas-proceso.md` (carga sola con el skill: `paths` incluye `.claude/skills/hojas-de-proceso/**`) | 119 | ~8 KB | — |
| Superficie que el skill manda leer primero: `docs/CRITERIOS_HOJAS_DE_PROCESO.md` | ~440 | 37.067 | — |
| `description` de los 26 skills | — | — | total ≈ 9,6 KB por sesion |

`hojas-de-proceso` crecio de 216 lineas (11/09) a **647** (+440 en el diff contra `1695d553`): con
la regla que carga sola y el canon que manda leer, una tarea de HO arranca con ~88 KB de prompt.
Largo no es hallazgo por si solo; lo que se propone mover (M5) es la **historia** que ocupa el lugar
de las reglas, no el contenido operativo.

---

## (b) Hallazgos

Ubicacion `archivo:linea` sobre el estado de `HEAD` (f7dd8612) + arbol de trabajo.

### Alta

| # | Ubicacion | Evidencia | Patron | Por que es un problema para Opus 5.5 / Fable 5.1 | Conf. | Accion |
|---|---|---|---|---|---|---|
| H1 | `carga-arb/SKILL.md:76` | `python scripts/_pdfBomArb.py --verificar-vigencia "<PN1>,<PN2>,..."` | G2 volatile specific roto | Corrido el 26/09: `error: the following arguments are required: --piezas`. `--verificar-vigencia` es `store_true`; la lista va en `--piezas`. La memoria `feedback_formato_carga_arb` lo escribe bien: **el skill y su memoria discrepan**. Un modelo que sigue instrucciones al pie de la letra corre el comando roto y el gate de ANULADOS no corre | alta | rewrite |
| H2 | `flujogramas/SKILL.md:272-273` | `❌ Asignar CC/SC. ... en un flujograma nuevo se transcriben las que ya traia la revision anterior, sobre las mismas operaciones.` | duplicado que discrepa (skill ↔ regla always-on) | `caracteristicas-especiales.md` §1: *"Nunca porque otro documento la tenia (backup, Rev.A de un flujograma...)"*; §3: *"La marca de una operacion en el flujograma = union de las siglas de sus causas en el AMFE. Una ▽ heredada sin causa S >= 9 detras no se copia"*. El hook `caracteristicas-especiales-guard` inyecta lo mismo. Blame: la linea del skill es del 08/09, la regla del 11/09. Dos instrucciones opuestas en el mismo contexto: el modelo tiene que adivinar cual manda | alta | rewrite |
| H3 | `hojas-de-proceso/SKILL.md:537` | `- Pasos: frases cortas, imperativas, una accion por renglon.` | duplicado que discrepa (dentro del skill y con el canon) | El mismo skill (GATE 0 uno :65) exige **infinitivo**; el canon §4.4:313 dice *"❌ Prohibido redactar en imperativo personal como 'Colocá', 'Apretá'"*; la regla `hojas-proceso.md` #14 y `redaccion.revisar_voz()` tambien. Blame: 03/09, anterior al 21/09. Lectura literal = contradiccion | alta | rewrite |
| H4 | `.claude/rules/no-pfd-no-ho.md:37` ↗ y `docs/CRITERIOS_HOJAS_DE_PROCESO.md:321` ↗ vs `hojas-de-proceso/SKILL.md:40, 231, 425-427, 539-546, 632` | regla: `sin documento fuente van **TBD**`; canon 4.4: `se rotula como **TBD** (To Be Defined)`; skill :40: `4.4 | ... TBD solo en el cajetin, nunca en la descripcion (Fak 24/09/2026)` | duplicado que discrepa (3 fuentes) | Decision de Fak 24/09 (*"no puede haber ni 1 TBD"*) aplicada al skill, a `hojas-proceso.md` #18 y a `revisar_tbd()`, pero no a la regla always-on (18/08) ni al canon, que el skill declara que **gana**. La tabla de :40 describe un canon que no existe. El modelo recibe "TBD" y "nunca TBD" a la vez | alta | rewrite (regla + canon) |
| H5 | `hojas-de-proceso/SKILL.md:610-611` y `.claude/rules/hojas-proceso.md:118` ↗ | skill: `El spec de cada maquina vive fuera del repo (trae contraseñas de HMI y part numbers de cliente). En el repo va solo lo generico`; regla: `El resto del spec ... vive donde se lo busca —la carpeta de la maquina—, no en el repo.` | G2 volatile specific falso + fosil de politica | `git ls-files`: `scripts/hotmelt/hojas_spec.py` (versionado desde 08/09) y `HOJAS_IMG` dentro de `scripts/img/generar_hojas_img.py` (21/09) estan en el repo. Lo unico afuera es la clave del HMI en `scripts/hotmelt/datos_privados.py` (gitignoreado, `.gitignore:147`). "part numbers de cliente" como motivo contradice `git-deploy.md` (Fak 18/08: se commitea con part numbers). Una sesion que le cree busca el spec donde no esta | alta | rewrite (skill + regla) |
| H6 | `hojas-de-proceso/SKILL.md:245-247` | `py -3 .claude/skills/hojas-de-proceso/scripts/hojalib.py   # ver ancho_que_le_toca_cm` | G2 volatile specific roto | `hojalib.py` no tiene `if __name__ == "__main__"` (grep sobre los 9 scripts: esta en los otros 6, no en este). Corrido: exit 0, **cero salida**. Es el GATE 2 ("¿a cuantos cm va a salir impresa?"): el paso que responde esa pregunta no responde nada | alta | rewrite |
| H7 | `carga-arb/SKILL.md:247-248` | `(esta en la carpeta Modificacion arb por Leo del Escritorio, junto con el PDF modelo)` | G2 puntero roto | El Escritorio no la tiene (`ls ~/Desktop`: 7 entradas, ninguna). Esta archivada en `...\1- GENERAL\TAREAS CERRADAS\2026\2026-07-31 - Modificacion arb por Leo`. Coherente con CLAUDE.md ("En el Escritorio no queda nada mio") y con `escritorio-tareas.md` | alta | rewrite |
| H8 | `flujogramas/SKILL.md:257-262` | `2. El PDF va a la carpeta del legajo por tipo — para un PPAP, el casillero 20- Flujograma de proceso.` · `3. Actualizar el listado maestro de Gestion Ingenieria (...Listado_Maestro_FLUJOGRMAS.xlsx): ... se edita por Excel COM` | duplicado que discrepa (skill ↔ `autonomy-contract.md` §F ↔ `ppap-motherson`) | §F (21/09): *"Escribir en un listado maestro (flujogramas, AMFEs, hojas de proceso) — **Preguntar**"*; el guard `apqp-cliente-guard` bloquea escribir `Listado_Maestro_*.xlsx`, pero su `APQP_ESCRIBE` solo reconoce `cp/mv/Copy-Item`: **el camino COM que el skill prescribe pasa por abajo del guard** (`guardianes.mjs:1631`). Y para SMRC el PDF va a `05 Process Flow` y el editable a Gestion `8. Flujograma Sinóptico` (`ppap-motherson:46-48, 61`), casillero 20 no existe. Blame: 08/09, anterior a §F | alta | rewrite |
| H9 | `apqp-legajo/SKILL.md:78` (fila 23) y `:96-97` (§3) | fila 23: `IMDS | ... Skill imds | INGENIERIA`; §3: `Ingenieria deja la base en el legajo: flujograma, AMFE, base de plan de control, IMDS y el alta de codigos` | duplicado que discrepa (skill ↔ regla ↔ skill ↔ cita de Fak) | `mail-envio.md:94` cita a Fak (08/09): *"el imds es de calidad"*; `autonomy-contract.md:93` (22/09): *"PPAP/PSW e IMDS: Calidad"*; `ppap-motherson:20` y `:70`: IMDS = Calidad. Solo `apqp-legajo` y la memoria `project_imds_barack` ("Paso a Ingenieria", sin cita) dicen Ingenieria. El skill contradice la cita textual del dueño de la regla | alta | rewrite (alinear a la cita de Fak) |

### Media

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| M1 | `hojas-de-proceso:588, 604, 617` + `hojas-proceso.md:112` ↗ · `flujogramas:20` · `hojas-de-proceso:127-128` | `25 casos` / `(25/25)` · `con 18 casos` · `lista canonica de 67 primeras palabras` | G2 volatile specific vencido | Corridos el 26/09: `hojalib_selftest.py` → **31 casos**; `flujogramaCanon.test.mjs` → **19**; `vocabulario.data.json` `denominacion.primera_palabra` → **68**. Un checklist que pide "25/25" contra una suite de 31 obliga a reconciliar o hace dudar del verde. El numero no aporta: el criterio es "en verde" | media | rewrite (sacar el conteo) |
| M2 | `flujogramas:110-111` | `En el Armrest se hizo al reves: el 153 Rev.B se alineo a la HO-971 y quedaron 11 colisiones abiertas` | G2 estado vencido | `node scripts/_verificarNumeracion.mjs` (read-only, Supabase live, 26/09): *"ARMREST DOOR PANEL · AMFE 161 · flujograma 153 rev C ✅ cierra: 19 operaciones ... Quedan resueltas las colisiones de numeracion"*. La leccion vale; el "abiertas" no | media | rewrite |
| M3 | `flujogramas:52-54` | `Para SMRC/SAS apoyabrazos-IP-APC el modelo es el 153` | G2 volatile specific incoherente | `tools/flowchart/data/153-ARMREST-DOOR-PANEL.json` header: `client: VWA`, `project: PATAGONIA`. El SMRC del generador es el **159** (`SMRC / STELLANTIS`). La frase de arriba pide "del mismo cliente y familia" y el ejemplo es de otro cliente. (126/131/105 del servidor: no verificables sin Y:) | media | rewrite |
| M4 | `hojas-de-proceso:25, 27, 51, 100, 132, 166, 184, 208` | `## 0. LOS GATES (bloqueantes, en este orden)` seguido de `GATE 0 cero · 0 uno · 0 cuatro · 0 tres · 0 dos · 0 · 0 bis` | 1d patch accretion | Cada gate se inserto donde cayo; el titulo promete un orden que los rotulos contradicen (cuatro antes de tres antes de dos). El modelo no puede usar la numeracion para ordenar el trabajo, que es lo que el titulo dice que hace. Ninguna referencia externa viva usa esos rotulos (grep: solo un snapshot archivado); "Gates 1 y 2" del canon §2.3 se conservan | media | rewrite |
| M5 | `hojas-de-proceso` — 12 tramos (tabla en §c) | ej. `:8-21` la historia del 03/09; `:44-49`; `:116-125`; `:127-130` *"mi primera version, hecha con sufijos..."*; `:138-142`+`:150-157`; `:214-218`; `:276-279`+`:299-301`+`:561-562` (la misma historia del criterio 1, tres veces); `:388-392`; `:437-446`; `§5 :556-579` | G2 history narratives + SKILL.md que no se lee de una sentada | 647 lineas. Las reglas estan, pero entre relatos fechados de *como* se descubrieron; el criterio 1 se cuenta tres veces. Se conserva cada regla y cada cita de Fak en una linea; el relato va a `reference/casos.md`, que se lee para entender un gate, no para aplicarlo | media | move |
| M6 | `hojas-de-proceso:199-202` y `:332` | `Antes esto no estaba escrito y por eso cada hoja salia con la cantidad de pasos que quedara. Ahora lo frena` · `` `_INFO SACADA DE LOS VIDEOS` (hoy `.claude\fotogramas de cada video`) `` | 1d migration-relative phrasing | Diff contra una version que el modelo nunca vio; el nombre viejo de la carpeta es una alternativa fantasma. La ruta vigente esta en la memoria `reference_videos_y_fotos_de_maquina_donde_van` (`<MAQUINA>\.claude\fotogramas de cada video\`) | media | rewrite |
| M7 | `hojas-de-proceso:591, 595, 600, 601` (Enforcement) y `:201` | `_gate_una_foto_por_paso() del generador` · `_gate_texto_para_el_operario() del generador` · `gate_materiales_del_deck() del generador` | G3-analogo: contrato sub-descripto (add) | El skill nunca nombra **cual** generador. Verificado: los `_gate_*` y `gate_materiales_del_deck` viven en `scripts/img/generar_hojas_img.py`; `scripts/p21/generar_hojas_p21.py` y `scripts/embossing/generar_hojas_embossing.py` lo importan; `scripts/hotmelt/hoja_pptx.py` y `scripts/novax/generar_hojas_insert.py` (sin versionar) **no**. Y `gate_redaccion` corre solo desde el generador: `hoja_proceso_check.py` sobre el PPTX solo mira legibilidad, jerarquia y `revisar_cocina`. La regla `no-pfd-no-ho.md` si nombra el generador; el skill, que es el manual, no | media | add |
| M8 | `docs/CRITERIOS_HOJAS_DE_PROCESO.md:145-158` (§2.6) ↗ vs `hojas-de-proceso:364-384` (§2 ter) y `:69-70` | canon: `cartel o badge instructivo ... ubicado directamente sobre el selector o botón, con flecha ... Viñetas de función explicativa`; skill: `Dentro de una hoja se usa --banda ninguna: el texto de cada numero ya esta en el bloque DESCRIPCION` · `El numero va montado sobre la ESQUINA del recuadro, no adentro` | duplicado que discrepa (canon 08/09 ↔ skill 21/09) | El skill manda abrir el canon primero y dice que gana; el canon pide un badge con viñetas sobre el boton, el skill un numero en la esquina y el texto en la descripcion (y `rotular.py --banda ninguna` hace lo segundo). Ademas `:69-70` del propio skill dice *"El nombre de un comando va en la foto"*, que con `--banda ninguna` no es cierto | media | rewrite (canon) + rewrite `:69-70` |
| M9 | `carga-arb:24-25`, `:54-55`, `:70-71` | `Sin ellos tiene que ir a buscarlos al arb` · `porque Fak la ejecuta creyendo que es lo que le pidieron` · `Si entra en la tabla, Fak carga algo que no existe.` | 1d fosil (contradice §2 del mismo archivo) | §2: *"La carga la hago YO. Lo unico de Fak es loguearse"* (desde 05/08). Tres frases de antes siguen razonando como si Fak tipeara. La regla que protegen vale igual; el sujeto esta mal | media | rewrite |
| M10 | `carga-arb:29-30` | `Si el codigo que sale y el que entra tienen unidades distintas en el maestro (UN vs UNID), decirlo: el arb no deja pisar la linea, hay que borrar y crear.` | G2 afirmacion vencida | `scripts/_arbSustituir.py` (docstring): desde el 23/09 pisa codigo + `cantidad,modulo,proceso` en la misma fila — el caso que lo estreno fue la resina `KG` → semiterminado `1 UNID`. Y si el arb borra algo al sustituir, el script aborta sin ENTER ("hay que ir por alta + baja"). "Borrar y crear" manda al unico camino que el propio skill (:131) declara sin probar | media | rewrite |
| M11 | `carga-arb:47-48` y `:104-105` | `ni se escribe en este archivo — el repo es publico y los volumenes de produccion son datos de la empresa.` · `(fuera del repo — este es publico)` | 1d fosil de politica (skill ↔ `git-deploy.md`) | `git-deploy.md` (Fak 18/08): *"saca esa regla de cero datos de la empresa... es un sacrificio que vamos a hacer"*. El motivo citado ya no rige. Lo que si rige y queda: el volumen no va al **mail** (§5, cita de Fak 04/08) | media | rewrite |
| M12 | `carga-arb:253-254` | `revisar si tambien hay que tocar ficha de embalaje (1- GENERAL\FICHAS DE EMBALAJE\<cliente>\<proyecto>\)` | duplicado que discrepa (skill ↔ skill ↔ memoria) | `ppap-motherson:48`: el editable vive en `Gestion Ingenieria\17. Fichas de embalaje\2- CLIENTES\SMRC\...`; la memoria `reference_fichas_embalaje_server`: *"Repositorio actual (Ingenieria): Y:\Ingenieria\Documentacion Gestion Ingenieria\17. Fichas de embalaje\"* con su listado maestro. La carpeta de OneDrive existe (`P21, PWA, SMRC, VWA`), asi que hay dos lugares y el skill apunta al que no es el maestro | media | rewrite |
| M13 | `informe-tryout:25-26` | `` kit en scripts/tryout/ (`clonlib.py` con dup / mover / `set_pairs_exacto` / `set_lineas_exacto` `` | G2 volatile specific inexacto | `clonlib.py` define `dup, mover, byid, set_pairs, set_txt, dump_runs`. `set_pairs_exacto` y `set_lineas_exacto` estan en `scripts/tryout/dia6_bilingue.py:86, 97`. Un `from clonlib import set_pairs_exacto` falla | media | rewrite |
| M14 | `apqp-legajo:34-35` (§0.4), `:81` (fila 26) y `autonomy-contract.md:73` ↗ | `El maestro vive en Gestion Ingenieria` · fila 26: `Las hojas de operacion (HO). Skill hojas-de-proceso | INGENIERIA` · §F: `Emitir un documento controlado (flujograma, AMFE, HO) en Gestion Ingenieria` | duplicado que discrepa | Para la HO el original **no** vive en Gestion Ingenieria: vive en `Y:\...\DOCUMENTACION SGC\HOJAS DE OPERACIONES\` (Fak 24-25/09; `hojas-de-proceso` §3 bis, `no-pfd-no-ho.md`). El `description` de `apqp-legajo` engancha *"al archivar un ... HO"*, y su fila 26 no dice donde esta el original: una pregunta "¿donde guardo la HO?" cae en el skill equivocado | media | rewrite |
| M15 | `autonomy-contract.md:74` ↗ vs `apqp-legajo:29-31, 86` | §F: `Poner algo en el paquete del cliente (31-...\PPAP_<PN>\)` · legajo: `El paquete de PPAP del cliente entero (PPAP_<part number>_<n>\) va ahi [1. Imput]` · fila 31: `El paquete del cliente NO va aca: va a 1. Imput` | duplicado que discrepa (ruta) | El test del guard lo confirma: *"MOVER el paquete entero del cliente a 1. Imput (es lo que pidio Fak)"* VERDE, *"el paquete en su ubicacion vieja tambien se frena"* ROJO. §F conserva la ubicacion vieja. El guard usa `/PPAP_.../` en cualquier lado, asi que el enforcement no se rompe; la prosa si | media | rewrite |
| M16 | `apqp-legajo:96-97` (§3) | `Ingenieria deja la base en el legajo: flujograma, AMFE, base de plan de control, IMDS` | duplicado que discrepa | §F: *"Plan de Control: Calidad ... Una base preliminar alineada con flujograma y AMFE, **solo si Fak la pide** (11/09)"*. El skill la lista como entregable fijo (y el IMDS es H9) | media | rewrite (junto con H9) |
| M17 | `no-pfd-no-ho.md:38-40` ↗ | `El listado maestro (3- LISTADO\Listado hojas de proceso.xlsx + hoja oculta _CONTEXTO_CLAUDE) manda la numeracion de HO y se actualiza en la misma tanda.` | duplicado que discrepa (regla ↔ regla ↔ guard) | §F: *"Escribir en un listado maestro (... hojas de proceso) — Preguntar"*; el guard bloquea `Listado hojas de proceso.xlsx` (`APQP_LISTADO`). La regla always-on lo pide como paso automatico | media | rewrite |
| M18 | `.claude/rules/hojas-proceso.md:33-36` (#6) ↗ | `Una foto por paso, de 2 a 4 pasos por hoja` | duplicado que discrepa (regla ↔ skill ↔ codigo) | El skill (:189-193) y el codigo (`generar_hojas_img.py`: `tope = 6 if modo == "rotulada" else MAX_FOTOS`) admiten hasta 6 en una hoja rotulada. La regla entra siempre junto con el skill y lo dice absoluto | media | rewrite |
| M19 | `ppap-motherson:20` vs `:65` (y `apqp-legajo:84`) | §0 Calidad: `... dimensional, capacidad, ensayos ...` · §2: `11 Capability · 17a Run-at-Rate | Estudio de capacidad ... volumen anual y capacidad semanal | Ingenieria + planta` · legajo fila 29: `Capacidad preliminar | Ppk. Hoy tiene metodos y tiempos, que es otra cosa | CALIDAD` | duplicado que discrepa (misma palabra, dos cosas, dos dueños) | "Capacidad" es Ppk (Calidad) en un lugar y capacidad productiva (Ingenieria) en otro, dentro del mismo skill. Sin el calificador el modelo asigna mal el dueño | media | rewrite |
| M20 | `ppap-motherson:111-112` vs `amfe-export-oficial/SKILL.md:3, 92-93` | ppap: `El Excel del AMFE va con la caratula que acomodo Fak para imprimir (margen y area B2:M29): el export pelado la pierde` · export-oficial: `Exportar un AMFE Barack a Excel oficial CORRECTO ... Usar SIEMPRE al exportar ... para el pendrive o el cliente` | duplicado que discrepa (skill ↔ skill) | El skill del export promete el Excel listo para el cliente; el otro documenta que le falta el ajuste de impresion y que solo lo pone un one-shot archivado (`scripts/_archive/2026-09-23-ppap-p21-naranja/armar_final.py`, que dice "AMFE 173" en su cabecera). Una sesion que exporta para otro cliente no lo sabe | media | add (una linea en `amfe-export-oficial`) |
| M21 | `description` de `informe-tryout`, `render-a-foto-real`, `amfe-cookbook` | `"el informe del try out", "armá el día N", "agregá la jornada al deck de Carlos", "el TryOut de la IMG"` · `"que parezca una foto", "hacelo real", "pasalo a foto"` · `"completar AMFE", "reparar AMFE", "fill gaps", "fix AMFE gaps", "llenar faltantes"` | G2 trigger-case enumeration | Frases casi sinonimas que crecen de a una; la guia: las categorias de intencion generalizan mejor. En `amfe-cookbook` las mismas frases se repiten en el comando `fix-amfe-gaps` y el agente `amfe-healer`: tres superficies disparan con el mismo texto sin decir cual hace que | media | rewrite |
| M22 | `description` de `ppap-motherson`, `verificacion-consumos`, `apqp-legajo` | `Nace del PPAP del APB P21 hilo naranja MY2026 (23/09/2026).` · `Nace de 6 fallos reales de 2026-07-14/16.` · `Trae lo que Fak decidio el 21/09/2026 y las preguntas que todavia no tienen respuesta.` | G3: arqueologia en texto de enrutado | Viaja en cada request y no ayuda a decidir si el skill se carga (mismo patron que el #42 del audit del 11/09). La procedencia ya esta en el cuerpo | media | rewrite |
| M23 | `description` de `hojas-de-proceso` y `arb-operar` | `... (formulario I-IN-002.4-R01) en PPTX o Excel — ...` · `... carga/modificación de consumos en Relaciones de Consumo. Usar cuando haya que cargar o corregir consumos en el arb ...` | G3: description desactualizada respecto del cuerpo | `hojas-de-proceso`: el cuerpo §3 bis cubre **donde se guarda y que numero lleva** (`_hoNumeros.py`), y la description no lo nombra (compite con M14); "PPTX o Excel" choca con `no-pfd-no-ho.md` (*"No el Excel viejo"*, Fak 24/09). `arb-operar`: el cuerpo y sus `reference/` cubren altas y sustitucion de lineas, maestro de insumos (alta, descripcion) y unidad (`_arbUnidad.py`); la description solo nombra consumos | media | rewrite |

### Baja / flag

| # | Ubicacion | Evidencia | Patron | Por que | Conf. | Accion |
|---|---|---|---|---|---|---|
| L1 | `hojas-de-proceso:633-639` · `informe-tryout:42-43` · `ppap-motherson:119-129` | `revision ciega (22/09/2026): UN Agent recibe SOLO el PDF impreso` · `Revision ciega: UN Agent recibe solo el PDF` · `Tres agentes en paralelo` | verificacion (tension documentada) | Opus 5: borrar scaffolding de verificacion y "no usar subagentes para verificar"; Fable 5.1: mantener (tentativo). En `ppap-motherson` es orden textual de Fak (*"audita con agentes independientes antes de mandar el mail"*) → keep. En los otros dos nacio de fallas del 21-22/09 que los gates no vieron → keep list #5 hasta medir | baja | flag |
| L2 | `flujogramas:220-224` | `Se recorta la zona a resolucion completa y se mira.` | 1d visual scaffolding (Opus 5.5 re-test) | Es un paso de recorte obligatorio, pero el PNG de un flujograma se revisa "al 13 % de escala": multiplica varias veces el borde de 2576 px, asi que el recorte lo impone la resolucion, no la vision del modelo. La guia lo deja expresamente ("keep crop/zoom and higher-resolution for the densest material") | baja | flag (keep) |
| L3 | `hojas-de-proceso:484-486` | `son del criterio VIEJO y hay que rehacerlas con este.` | TODO en prosa + frase relativa | Pendiente de trabajo (5 pantallas redibujadas de la HOTMELT, siguen en `aplicar_criterios.py`) escrito como instruccion permanente. Va a la memoria `project_hojas_proceso_hotmelt` | baja | move |
| L4 | `hojas-de-proceso:288-301` | tabla con criterios `7 ... 13, 15` y abajo `Del 7 y del 14 (dos chapas no se pisan) falta el numero: el umbral se corre antes contra las 17 hojas` | TODO en prosa + hueco en la tabla | El 14 se nombra y no esta en la tabla; el "falta" es pendiente, no regla | baja | flag |
| L5 | `hojas-de-proceso:520-524` | `Los decks de HOTMELT y MOLDEADORA IMG se mudaron el 25/09 ... el de la PRENSA EMBOSSING se mudo el mismo 24/09` | history narrative + fecha incoherente | Bitacora de mudanzas en el manual; "el mismo 24/09" despues de "25/09" (dos ediciones, 1d94bc9f sobre a69be358). Va a la memoria `reference_hojas_de_operaciones_carpeta_estado` | baja | move |
| L6 | `ppap-motherson:103-104` vs `.claude/rules/amfe.md:311-312` ↗ | `Ningun TBD: un control que no existe es "Sin control preventivo" con O=10` · amfe.md: `una causa cuyo control preventivo todavia es TBD, no puede estar en 3` | posible discrepancia de alcance | amfe.md contempla un preventivo `TBD` como estado; ppap-motherson lo prohibe en el AMFE que va al cliente. Coherente si se lee "en el entregable"; conviene que amfe.md lo diga | baja | flag ↗ |
| L7 | `CLAUDE.md` (*"PFDs y Hojas de Operaciones no se hacen aca"*) y `core-prohibiciones.md` §7 ↗ | vs titulo de `no-pfd-no-ho.md` (*"Flujogramas: los hago yo ... HO solo a pedido"*) | duplicado que discrepa (nucleo) | Se lee como prohibicion total; la regla y los skills dicen lo contrario ("en la app" es la aclaracion que falta). Lo audita la parte del nucleo | baja | flag ↗ |
| L8 | `docs/CRITERIOS_HOJAS_DE_PROCESO.md:139-140` (§2.5) ↗ | `requieren rotación de 90° en sentido horario (ROTATE_90), nunca rotaciones ciegas de 270°` | regla ciega vs `hojas-de-proceso:338-339` | El skill (21/09) dice que el metadato de rotacion puede mentir y *"la rotacion se MIRA"*; el canon fija un giro. Compatible en la practica, pero es una receta fija donde el skill pide juicio | baja | flag |
| L9 | memoria `project_imds_barack.md:11-12` ↗ | `lo cargaba Calidad / Marcelo Nieve, que renuncio el 02/09/2026. Paso a Ingenieria.` | discrepancia memoria ↔ cita de Fak | Mismo tema que H9: si se aplica H9, esta linea queda sola contra `mail-envio.md:94`. Conviene decir "lo opera Ingenieria solo a pedido de Fak; el dueño es Calidad" | baja | flag ↗ |
| L10 | `description` de `product-map` y `docs-empresa` | `familias (13 al 22/09/2026)` · `Reemplaza a NotebookLM (retirado 2026-07-23)` | G3: dato fechado en trigger text | Fechado, no roto; la cuenta real se lee live (CLAUDE.md). Bajo costo, se señala | baja | flag |

---

## (c) Hunks propuestos (uno por hallazgo alto o medio)

### H1 — `carga-arb/SKILL.md:76`

```diff
-python scripts/_pdfBomArb.py --verificar-vigencia "<PN1>,<PN2>,..."
+python scripts/_pdfBomArb.py --verificar-vigencia --piezas "<PN1>,<PN2>,..."
```

### H2 — `flujogramas/SKILL.md:272-273`

```diff
-❌ Asignar CC/SC. Las asigna Fak o el cliente (`core-prohibiciones.md` §2); en un flujograma
-   nuevo se transcriben las que ya traia la revision anterior, sobre las mismas operaciones.
+❌ Asignar CC/SC por cuenta propia, o copiarlas de la revision anterior. La marca de cada
+   operacion es la union de las siglas de sus causas en el AMFE (`caracteristicas-especiales.md`
+   §3); una marca heredada que el AMFE no sostiene se informa como diferencia, no se copia.
+   Asignarlas es de Fak o del cliente (`core-prohibiciones.md` §2).
```

### H3 — `hojas-de-proceso/SKILL.md:537`

```diff
-- Pasos: frases cortas, imperativas, una accion por renglon. Sin "BORRADOR" ni "pendiente".
+- Pasos: frases cortas, en infinitivo (canon 4.4), una accion por renglon. Sin "BORRADOR" ni "pendiente".
```

### H4 — la regla del TBD, en sus dos fuentes viejas

`.claude/rules/no-pfd-no-ho.md:37-38` ↗

```diff
-- Los pasos de una HO son instruccion de planta: sin documento fuente van **TBD**. No se
-  redactan por analogia con otra pieza "parecida" (`core-prohibiciones` §1). El listado
+- Los pasos de una HO son instruccion de planta: cada paso cita su fuente, y **en la
+  descripcion no va ningun `TBD`** (Fak, 24/09/2026: *"no puede haber ni 1 TBD... el TBD del
+  numero de hoja si"*). Lo que no se sabe se escribe generico con lo que hay, sin inventar un
+  valor, y el hueco va a la lista de pendientes; el `TBD` queda solo en el cajetin. No se
+  redactan por analogia con otra pieza "parecida" (`core-prohibiciones` §1). El listado
```

`docs/CRITERIOS_HOJAS_DE_PROCESO.md:320-321` ↗

```diff
-* **Tratamiento de Datos No Confirmados:**  
-  Queda prohibido imprimir leyendas como "BORRADOR", "SUJETO A REVISIÓN" o "PENDIENTE DE VALIDACIÓN" cruzando la lámina. Si un dato técnico exacto no está disponible en la documentación fuente, se rotula como **`TBD`** (*To Be Defined*) y se notifica formalmente a Ingeniería.
+* **Tratamiento de Datos No Confirmados:**  
+  Queda prohibido imprimir leyendas como "BORRADOR", "SUJETO A REVISIÓN" o "PENDIENTE DE VALIDACIÓN" cruzando la lámina. Si un dato técnico exacto no está disponible en la documentación fuente, **no se escribe `TBD` en la descripción** (Fak, 24/09/2026): el paso se redacta genérico con la información disponible, sin inventar el valor, y el faltante va a la lista de pendientes. `TBD` solo en el cajetín (N° de operación, HO, sector).
```

(Con esto la linea 40 del skill queda cierta tal como esta.)

### H5 — `hojas-de-proceso/SKILL.md:610-611` y `.claude/rules/hojas-proceso.md:117-118` ↗

```diff
-El **spec de cada maquina vive fuera del repo** (trae contraseñas de HMI y part numbers de
-cliente). En el repo va solo lo generico: libreria, gate y selftest.
+El spec de cada maquina vive en el repo, junto a su generador (`scripts/hotmelt/hojas_spec.py`,
+`HOJAS_IMG` en `scripts/img/generar_hojas_img.py`). Lo unico que no entra es la **contraseña del
+HMI**: va en `scripts/hotmelt/datos_privados.py` (gitignoreado) y `_gateRepoPublico.mjs` CHECK-3
+la busca por contenido.
```

```diff
 **Las contraseñas de HMI no van al repo** (`_gateRepoPublico.mjs` CHECK-3 las busca por contenido).
-El resto del spec de la maquina vive donde se lo busca —la carpeta de la maquina—, no en el repo.
+El resto del spec vive en el repo, junto a su generador (`scripts/<maquina>/`); la contraseña va en
+`datos_privados.py`, que esta en `.gitignore`.
```

### H6 — `hojas-de-proceso/SKILL.md:245-247`

```diff
 ```bash
-py -3 .claude/skills/hojas-de-proceso/scripts/hojalib.py   # ver ancho_que_le_toca_cm
+py -3 -c "import sys; sys.path.insert(0, '.claude/skills/hojas-de-proceso/scripts'); import hojalib; print(hojalib.ancho_que_le_toca_cm(1600, 900, 2))"   # ancho_px, alto_px, n_imagenes -> cm
 ```
```

(Probado: devuelve `10.03`, lo mismo que el caso `1600x900 con 2` del selftest.)

### H7 — `carga-arb/SKILL.md:247-248`

```diff
-enterarse de un cambio de BOM. La lista buena es la del ultimo mail de difusion formato Leo
-(esta en la carpeta `Modificacion arb por Leo` del Escritorio, junto con el PDF modelo).
+enterarse de un cambio de BOM. La lista buena es la del ultimo mail de difusion formato Leo
+(la tarea archivada `1- GENERAL\TAREAS CERRADAS\2026\2026-07-31 - Modificacion arb por Leo\`
+de la biblioteca de Ingenieria tiene el mail y el PDF modelo; el ultimo mail enviado, con
+`python scripts/_mails.py --buscar "Difundo actualizacion"`).
```

### H8 — `flujogramas/SKILL.md:257-262`

```diff
-2. El PDF va a la carpeta del legajo por tipo — para un PPAP, el casillero
-   **`20- Flujograma de proceso`**. Ver `reference_donde_se_archiva_cada_entregable`.
-3. Actualizar el **listado maestro** de Gestion Ingenieria
-   (`8. Flujograma Sinóptico (I-IN-002III)\1. LISTADO DE FLUJOGRAMAS\Listado_Maestro_FLUJOGRMAS.xlsx`):
-   columna M revision, N fecha. Tiene tablas y formulas — se edita por **Excel COM**, no con
-   openpyxl. Antes de escribir, verificar que la fila es la del producto correcto.
+2. El editable vive en Gestion Ingenieria (`8. Flujograma Sinóptico`); emitirlo ahi se
+   **pregunta** (`autonomy-contract.md` §F). La copia en PDF va al casillero
+   **`20- Flujograma de proceso`** del legajo; para SMRC, a `05 Process Flow` del paquete
+   (skill `ppap-motherson`). Ver `reference_donde_se_archiva_cada_entregable`.
+3. El **listado maestro** (`...\1. LISTADO DE FLUJOGRAMAS\Listado_Maestro_FLUJOGRMAS.xlsx`,
+   columna M revision, N fecha) es registro compartido: se le muestra a Fak la fila que va a
+   quedar y se carga con su OK (§F; escape `~/.claude/.apqp-listado-ok`). Tiene tablas y
+   formulas — se edita por **Excel COM**, no con openpyxl — y el guard no ve ese camino, asi
+   que el OK se pide igual.
```

### H9 + M16 — `apqp-legajo/SKILL.md:78` y `:96-99`

```diff
-| 23 | IMDS | 1/6 | La declaracion y su captura. Skill `imds` | INGENIERIA |
+| 23 | IMDS | 1/6 | La declaracion y su captura. Skill `imds` | CALIDAD (Fak, 08/09/2026: *"el imds es de calidad"*); Ingenieria lo opera solo a pedido de Fak |
```

```diff
-El PPAP lo coordina **CALIDAD**. Ingenieria deja la base en el legajo: flujograma, AMFE, base
-de plan de control, IMDS y el alta de codigos en el arb. **No arma el paquete que va al
+El PPAP lo coordina **CALIDAD**. Ingenieria deja la base en el legajo: flujograma, AMFE y el
+alta de codigos en el arb; una base de plan de control, solo si Fak la pide (§F). **No arma el paquete que va al
```

### M1 — conteos que envejecen

`hojas-de-proceso/SKILL.md:588, 604, 617`

```diff
-| **Regresion** | 25 casos, cada criterio en ROJO y en VERDE | `.claude/skills/hojas-de-proceso/scripts/hojalib_selftest.py` |
+| **Regresion** | cada criterio en ROJO y en VERDE | `.claude/skills/hojas-de-proceso/scripts/hojalib_selftest.py` |
...
-py -3 .claude/skills/hojas-de-proceso/scripts/hojalib_selftest.py     # 25 casos
+py -3 .claude/skills/hojas-de-proceso/scripts/hojalib_selftest.py     # tiene que dar "0 fallan"
...
-- [ ] `hojalib_selftest.py` en verde (25/25)
+- [ ] `hojalib_selftest.py` en verde ("0 fallan")
```

(Lo mismo en `redaccion_selftest.py` —hoy 71, coincide— para que no vuelva a pasar, y en
`.claude/rules/hojas-proceso.md:112-113` ↗: `— 25 casos` → `— cada criterio en ROJO y en VERDE`.)

`hojas-de-proceso/SKILL.md:127-128`

```diff
-Lo frena `redaccion.revisar_denominacion()` contra la **lista canonica de 67 primeras
-palabras reales**, no contra un sufijo: mi primera version, hecha con sufijos, marcaba en
-rojo `CONTROL DE PIEZA INYECTADA` y `ARRANQUE Y ALINEACION`, que son de Barack. Una palabra
-nueva da **aviso**, no rojo, para agregarla mirando un documento real.
+Lo frena `redaccion.revisar_denominacion()` contra la **lista canonica de primeras palabras
+reales** (`vocabulario.data.json` → `denominacion.primera_palabra`), no contra un sufijo. Una
+palabra nueva da **aviso**, no rojo, para agregarla mirando un documento real.
```

`flujogramas/SKILL.md:20`

```diff
-con 18 casos en `__tests__/scripts/flujogramaCanon.test.mjs`. `--sin-canon` dibuja igual para
+con sus casos en `__tests__/scripts/flujogramaCanon.test.mjs`. `--sin-canon` dibuja igual para
```

### M2 — `flujogramas/SKILL.md:110-111`

```diff
-⚠️ En el **Armrest** se hizo al reves: el 153 Rev.B se alineo a la HO-971 y quedaron **11
-colisiones abiertas** entre flujograma, AMFE y Plan de Control. No repetirlo.
+⚠️ En el **Armrest** se hizo al reves: el 153 Rev.B se alineo a la HO-971 y abrio 11
+colisiones entre flujograma, AMFE y Plan de Control, que costo cerrar hasta la Rev.C. No
+repetirlo. El estado de cada producto se lee de `_verificarNumeracion.mjs`, no de aca.
```

### M3 — `flujogramas/SKILL.md:52-54`

```diff
-**Antes de numerar nada, abrir dos flujogramas vigentes del mismo cliente y familia.** Para
-SMRC/SAS apoyabrazos-IP-APC el modelo es el **153**; en el servidor, 126 Rev.7, 131 Rev.5 y
-105 Rev.H.
+**Antes de numerar nada, abrir dos flujogramas vigentes del mismo cliente y familia.** En el
+generador, el de SMRC es el **159** (APB P21) y el apoyabrazos de Patagonia (VWA) el **153**; en
+el servidor, 126 Rev.7, 131 Rev.5 y 105 Rev.H. El cliente de cada JSON esta en `header.client`.
```

### M4 — `hojas-de-proceso/SKILL.md` titulos de los gates

```diff
-## 0. LOS GATES (bloqueantes, en este orden)
+## 0. LOS GATES (bloqueantes). Los 0.x se contestan antes de escribir; 1 a 3, al armar y al entregar
...
-### GATE 0 cero — el canon se abre ANTES de escribir el primer paso
+### GATE 0.1 — el canon se abre ANTES de escribir el primer paso
...
-### GATE 0 uno — ¿este paso le dice al operario que HACER?
+### GATE 0.2 — ¿este paso le dice al operario que HACER?
...
-### GATE 0 cuatro — la operacion se llama como Barack las llama
+### GATE 0.3 — la operacion se llama como Barack las llama
...
-### GATE 0 tres — la lista de hojas sale del TRABAJO, no de lo que hay filmado
+### GATE 0.4 — la lista de hojas sale del TRABAJO, no de lo que hay filmado
...
-### GATE 0 dos — el castellano de planta
+### GATE 0.5 — el castellano de planta
...
-### GATE 0 — antes de escribir nada: ¿cuantos pasos tiene esta hoja, y entran?
+### GATE 0.6 — ¿cuantos pasos tiene esta hoja, y entran?
...
-### GATE 0 bis — la transcripcion del video se lee ENTERA, siempre
+### GATE 0.7 — la transcripcion del video se lee ENTERA, siempre
```

### M5 — `hojas-de-proceso`: la historia a `reference/casos.md`

Criterio: en SKILL.md queda **la regla, la cita de Fak en una linea y el comando**; el relato de
como se descubrio va integro a `reference/casos.md`. No se resume ni se borra nada.

| Tramo | Queda en SKILL.md | Va a `reference/casos.md` |
|---|---|---|
| `:8-21` | `:6` + `:8` (*"El que decide si una hoja sirve ... es como se lee en el papel"*) | `:9-21` (la lamina 3 de la HOTMELT, las 7 pantallas a 2,3-4,5 pt, las dos causas) |
| `:44-49` | una linea: *"Un canon huerfano no gobierna nada (21/09/2026: 26 de 27 pasos narrando la maquina y una hoja que decia SETA)."* | el parrafo entero con la cita de Fak |
| `:116-125` | *"Antes de inventar una forma se abre la maquina hermana (Fak: 'eso es cualquier cosa')."* + la aclaracion de `etapa=` en una linea | el precedente de las 17 sub-operaciones de la HOTMELT y el relato |
| `:127-130` | ver hunk M1 | *"mi primera version, hecha con sufijos, marcaba en rojo..."* |
| `:138-142`, `:150-157` | `:134-136`, `:144-148`, `:159-164` (la regla, el balance de materiales y las tres preguntas) | el vinilo que falto el 21/09 y como el gate reprodujo la correccion |
| `:214-218` | `:210-212` (las dos citas de Fak) + `:220` (*"Los fotogramas dicen QUE HAY..."*) | el caso del IMG_0596 y el manometro |
| `:276-279`, `:299-301`, `:561-562` | una sola frase en §1: *"Un umbral se prueba contra la poblacion entera antes de declararlo (el primer 45 % reprobaba 13 de 17 hojas sanas)."* | las tres versiones del mismo relato, juntas |
| `:388-392` | la cita de Fak (primera frase) | *"yo habia puesto las marcas mirando un render..."* y el 15/09 |
| `:437-446` | *"El idioma de la pantalla no es del dia: se cambia en cualquier momento, asi que se busca cuadro por cuadro."* + `:447-449` (OCR ordena, decide el ojo) | los 5.335 fotogramas, las horas exactas del 09/09 y 11/09 |
| `:475-479` | *"No se pasa por un generador de imagenes: reinventa los digitos, y una marca de procedencia no se saca."* | la propuesta de Gemini del 03/09 con su cita |
| `§5 :556-579` | puntero de una linea | los 7 errores de la tanda del 03/09 (la mitad ya esta graduada: LECCIONES, `git-deploy.md`, memoria `dos_lecturas...`) |

Puntero que queda donde estaba §5:

```markdown
## 5. De donde sale cada gate

Cada gate de arriba nacio de una hoja que Fak devolvio. Los casos, con fecha y cita, estan en
`reference/casos.md`: se leen para entender por que un gate esta donde esta, no para aplicarlo.
```

Control despues de aplicar: una tarea de HO corriente (escribir pasos, sacar y rotular fotos,
guardar y numerar) se tiene que poder hacer sin abrir `reference/casos.md`. Si no, el corte
quedo mal y ese tramo vuelve.

### M6 — `hojas-de-proceso/SKILL.md:199-202` y `:332`

```diff
 Fak, 21/09/2026: *"en el flujograma lo que nos paso es que en algunos casos pusimos muy
-pocos pasos, a veces muchisimos, esta medio confuso"*. Antes esto no estaba escrito y por
-eso cada hoja salia con la cantidad de pasos que quedara. Ahora lo frena
-`_gate_una_foto_por_paso()` del generador.
+pocos pasos, a veces muchisimos, esta medio confuso"*. Lo frena `_gate_una_foto_por_paso()`
+de `scripts/img/generar_hojas_img.py`.
```

```diff
-`_INFO SACADA DE LOS VIDEOS` (hoy `.claude\fotogramas de cada video`) muestrea **un cuadro
+La biblioteca de fotogramas de la maquina (`<MAQUINA>\.claude\fotogramas de cada video\`,
+memoria `reference_videos_y_fotos_de_maquina_donde_van`) muestrea **un cuadro
```

### M7 — `hojas-de-proceso/SKILL.md`, al principio de §6 Enforcement (despues de `:582`)

```diff
 ## 6. Enforcement
+
+Los `_gate_*()` y `gate_materiales_del_deck()` que nombra esta tabla viven en
+**`scripts/img/generar_hojas_img.py`**; los generadores de P21 y de la prensa embossing lo
+importan. Un deck armado con otro generador (el de la HOTMELT, `scripts/hotmelt/hoja_pptx.py`)
+no pasa por ellos, y `hoja_proceso_check.py` sobre el PPTX mira legibilidad, jerarquia y
+cocina, no la redaccion: en ese caso se corre `redaccion.py spec <generador.py> HOJAS_X`.
+Un generador nuevo importa el de la IMG en vez de copiar los gates.
```

### M8 — `docs/CRITERIOS_HOJAS_DE_PROCESO.md` §2.6 ↗ y `hojas-de-proceso/SKILL.md:69-70`

```diff
-- **Estándar de cartelón superpuesto (Overlay SGC):**  
-  Se debe incorporar un cartel o badge instructivo de alta nitidez en español ubicado directamente sobre el selector o botón, con flecha indicadora:
+- **Rótulo dentro de una hoja (Fak, 21/09/2026):** sobre la foto va solo un recuadro y un
+  **número montado en la esquina** (`rotular.py --banda ninguna`), para no taparle al control la
+  serigrafía; el texto en castellano de cada número va en la DESCRIPCIÓN, citando la serigrafía
+  original (*"Verde ARRANQUE DE CICLO (循环启动)"*). El cartelón con viñetas que sigue es para una
+  foto que viaja sola (mail, PDF), con `--banda derecha|abajo`:
```

```diff
-3. **Un rotulo no es un paso.** El nombre de un comando va **en la foto** (`rotular.py`); en
-   la DESCRIPCION va lo que hay que hacer con ese comando.
+3. **Un rotulo no es un paso.** La foto lleva el numero (`rotular.py`); el renglon de la
+   DESCRIPCION nombra el comando y dice que hacer con el.
```

(Si se aplica, `.claude/rules/hojas-proceso.md` #14 ↗ tiene la misma frase: *"el nombre del
comando va en la FOTO"* → *"la foto lleva el numero; el renglon nombra el comando y que hacer"*.)

### M9 — `carga-arb/SKILL.md:24-25`, `:54-55`, `:70-71`

```diff
-- **Sector y unidad van SI o SI adentro de la tabla.** Sin ellos tiene que ir a buscarlos al
-  arb, que es justo lo que la tabla viene a evitar.
+- **Sector y unidad van SI o SI adentro de la tabla.** Es lo que Fak revisa antes de la carga
+  y lo que el CSV de carga necesita: sin ellos la tabla no se ejecuta sola.
```

```diff
-pedido nunca menciono. Si aparece un desvio real fuera de alcance, se reporta aparte — no se
-mete en la carga, porque Fak la ejecuta creyendo que es lo que le pidieron.
+pedido nunca menciono. Si aparece un desvio real fuera de alcance, se reporta aparte — no se
+mete en la carga: Fak la aprueba creyendo que es lo que le pidieron.
```

```diff
-queda huerfana.** Si entra en la tabla, Fak carga algo que no existe.
+queda huerfana.** Si entra en la tabla, se carga una BOM de un producto que ya no existe.
```

### M10 — `carga-arb/SKILL.md:29-30`

```diff
-- Si el codigo que sale y el que entra tienen **unidades distintas** en el maestro (`UN` vs
-  `UNID`), decirlo: el arb no deja pisar la linea, hay que borrar y crear.
+- Si el codigo que sale y el que entra tienen **unidades distintas** en el maestro (`UN` vs
+  `UNID`), decirlo en la tabla: el cambio va por `_arbSustituir.py` con `cantidad` (y
+  `modulo,proceso` si cambian) en la misma fila. Si el arb borra algo al sustituir, el script
+  aborta sin grabar y hay que ir por alta + baja, que se le consulta a Fak (borrar no esta probado).
```

### M11 — `carga-arb/SKILL.md:47-48` y `:104-105`

```diff
-⚠ Ese numero **se queda en el analisis**: no sube al mail de difusion (ver §5) ni se escribe
-en este archivo — el repo es publico y los volumenes de produccion son datos de la empresa.
+⚠ Ese numero **se queda en el analisis**: no sube al mail de difusion (ver §5).
```

```diff
-Crearlo hubiera dejado dos codigos para lo mismo en deposito. Numeros del caso en la
-memoria `project_alta_codigos_sansuy_427` (fuera del repo — este es publico).
+Crearlo hubiera dejado dos codigos para lo mismo en deposito. Numeros del caso en la
+memoria `project_alta_codigos_sansuy_427`.
```

### M12 — `carga-arb/SKILL.md:253-254`

```diff
-El cambio de BOM casi nunca viene solo: revisar si tambien hay que tocar **ficha de embalaje**
-(`1- GENERAL\FICHAS DE EMBALAJE\<cliente>\<proyecto>\`) y si aplica subir revision.
+El cambio de BOM casi nunca viene solo: revisar si tambien hay que tocar **ficha de embalaje**
+(el maestro esta en `Y:\Ingenieria\Documentacion Gestion Ingenieria\17. Fichas de embalaje\`,
+con su listado; memoria `reference_fichas_embalaje_server`) y si aplica subir revision.
```

### M13 — `informe-tryout/SKILL.md:25-28`

```diff
-3. **Clonar, no dibujar**: kit en `scripts/tryout/` (`clonlib.py` con dup / mover /
-   `set_pairs_exacto` / `set_lineas_exacto`; `contenido_diaN.py` solo texto ES+EN; `diaN_bilingue.py`
-   el generador; `mapear.py` para ver indice/id/texto de una slide). Se copia el par
+3. **Clonar, no dibujar**: kit en `scripts/tryout/` (`clonlib.py` con dup / mover / set_pairs /
+   set_txt; `contenido_diaN.py` solo texto ES+EN; `diaN_bilingue.py` el generador, que trae
+   `set_pairs_exacto` / `set_lineas_exacto`; `mapear.py` para ver indice/id/texto de una slide). Se copia el par
```

### M14 — `apqp-legajo/SKILL.md:34-35` y `:81`; `autonomy-contract.md:73` ↗

```diff
-4. **Un documento vivo tiene UN solo lugar.** El maestro vive en `Gestion Ingenieria`; lo que se
-   copia al legajo es una COPIA que envejece sola. No se reparte "por las dudas".
+4. **Un documento vivo tiene UN solo lugar.** El maestro vive en `Gestion Ingenieria` —salvo la
+   HO, que vive en `DOCUMENTACION SGC\HOJAS DE OPERACIONES\` (skill `hojas-de-proceso` §3 bis)—;
+   lo que se copia al legajo es una COPIA que envejece sola. No se reparte "por las dudas".
```

```diff
-| 26 | **Instrucciones de Proceso** | 5/6 | **Las hojas de operacion (HO).** Skill `hojas-de-proceso` | INGENIERIA |
+| 26 | **Instrucciones de Proceso** | 5/6 | **Copia** de las hojas de operacion (HO). El original y su numero viven en `HOJAS DE OPERACIONES` del SGC: skill `hojas-de-proceso` §3 bis | INGENIERIA |
```

```diff
-| Emitir un documento controlado (flujograma, AMFE, HO) en `Gestion Ingenieria` | **Preguntar** — el documento lo firma Fak |
+| Emitir un documento controlado (flujograma y AMFE en `Gestion Ingenieria`, HO en `HOJAS DE OPERACIONES` del SGC) | **Preguntar** — el documento lo firma Fak |
```

### M15 — `autonomy-contract.md:74` ↗

```diff
-| Poner algo en el paquete del cliente (`31-...\PPAP_<PN>\`) | **Prohibido sin OK**: ...
+| Poner algo en el paquete del cliente (`PPAP_<PN>\`, que vive en `1. Imput` del legajo: skill `apqp-legajo` §0) | **Prohibido sin OK**: ...
```

### M17 — `no-pfd-no-ho.md:38-40` ↗

```diff
-  redactan por analogia con otra pieza "parecida" (`core-prohibiciones` §1). El listado
-  maestro (`3- LISTADO\Listado hojas de proceso.xlsx` + hoja oculta `_CONTEXTO_CLAUDE`) manda
-  la numeracion de HO y se actualiza en la misma tanda.
+  redactan por analogia con otra pieza "parecida" (`core-prohibiciones` §1). El listado
+  maestro (`3- LISTADO\Listado hojas de proceso.xlsx` + hoja oculta `_CONTEXTO_CLAUDE`) manda
+  la numeracion de HO; la fila nueva se le muestra a Fak y se carga con su OK en la misma
+  tanda (`autonomy-contract.md` §F, hook `apqp-cliente-guard`).
```

### M18 — `.claude/rules/hojas-proceso.md:33` ↗

```diff
-6. **Una foto por paso, de 2 a 4 pasos por hoja, y la operacion que no entra se PARTE**
+6. **Una foto por paso, de 2 a 4 pasos por hoja (hasta 6 en una hoja `rotulada`: un panel,
+   una sola foto), y la operacion que no entra se PARTE**
```

### M19 — `ppap-motherson/SKILL.md:20` y `:65`

```diff
-| **Calidad** (...) | Plan de control, R&R/MSA, dimensional, capacidad, ensayos, PSW (firma), IMDS, CSR firmados |
+| **Calidad** (...) | Plan de control, R&R/MSA, dimensional, capacidad de proceso (Ppk), ensayos, PSW (firma), IMDS, CSR firmados |
```

```diff
-| 11 Capability · 17a Run-at-Rate | Estudio de capacidad y Performance Test Corp-8.3.4: **por sectores**, ...
+| 11 Capability · 17a Run-at-Rate | Capacidad **productiva** (no Ppk) y Performance Test Corp-8.3.4: **por sectores**, ...
```

(Si Fak confirma que la `11 Capability` de SMRC pide Ppk, el dueño de esa fila es Calidad y el
hunk se da vuelta.)

### M20 — `amfe-export-oficial/SKILL.md`, checklist (despues de `:93`)

```diff
+- [ ] Si el Excel va a imprimirse o al cliente: la caratula lleva el margen y el area de
+      impresion que acomodo Fak (`B2:M29`). `buildAmfeOficialWorkbook` no los pone; hoy lo hace
+      el molde `scripts/_archive/2026-09-23-ppap-p21-naranja/armar_final.py` (skill `ppap-motherson` §4).
```

### M21 — descripciones por categoria de intencion

```yaml
# informe-tryout  (378 -> ~300)
description: Informe de TryOut / T0 de Patagonia — el deck bilingue (castellano e ingles) de
  Carlos Baptista sobre la IMG y los moldes, que crece una jornada por corrida. Usar cuando haya
  que informar una corrida de prueba o sumarle una jornada a ese deck con las fotos, audios y
  partes del dia.

# render-a-foto-real  (334 -> ~290)
description: Pasar un render o modelo 3D (HTML de Claude Design, STEP renderizado, captura) a
  imagenes que parezcan fotos reales para un deck o un cliente, incluidas la version nocturna y la
  vista aerea. Usar cuando haya que convertir un render o una propuesta 3D en imagen fotorrealista.

# amfe-cookbook  (319 -> ~330)
description: Recetas para completar gaps en AMFEs de Barack — tabla tipo de issue -> accion, con
  ejemplos; es la referencia de `_fixAmfePlaceholdersAndAllocation.mjs`. Usar cuando haya que
  completar o reparar lo que le falta a un AMFE. Lo ejecutan el comando /fix-amfe-gaps y el
  agente amfe-healer; lo detectan /audit-amfe y los auditores.
```

### M22 — descripciones sin arqueologia

```diff
# ppap-motherson
-... o al armar el legajo de una pieza nueva de SMRC. Nace del PPAP del APB P21 hilo naranja MY2026 (23/09/2026).
+... o al armar el legajo de una pieza nueva de SMRC.

# verificacion-consumos
-... o fichas de embalaje. Nace de 6 fallos reales de 2026-07-14/16.
+... o fichas de embalaje.

# apqp-legajo
-... o cuando haya que decidir en que carpeta va un documento del proyecto. Trae lo que Fak decidio el 21/09/2026 y las preguntas que todavia no tienen respuesta.
+... o cuando haya que decidir en que carpeta va un documento del proyecto. Marca lo que esta SIN DEFINIR, que se pregunta. Para SMRC / Motherson el legajo es el paquete del cliente: skill ppap-motherson.
```

### M23 — descripciones al dia con su cuerpo

```yaml
# hojas-de-proceso  (392 -> ~440)
description: Hojas de proceso / hojas de operaciones (HO) de Barack, formulario I-IN-002.4-R01 en
  PowerPoint — que le manda cada paso al operario y con que palabras, que foto va en cada paso,
  como se prepara una pantalla de HMI para que se lea impresa, donde se guarda la hoja y que
  numero de HO lleva. El canon es `docs/CRITERIOS_HOJAS_DE_PROCESO.md`; trae `hojalib`, el gate
  de redaccion, el gate que rechaza la hoja y sus selftests.

# arb-operar  (435 -> ~470)
description: Operar el ERP arb (ARB Sistemas "Producción") por teclado desde Claude — navegación,
  pantallas, carga y corrección de consumos, altas y sustitución de líneas de BOM, y el maestro de
  insumos (alta de códigos, descripción, unidad). Usar cuando haya que escribir o verificar algo
  en el arb, o automatizar una tarea repetitiva dentro del ERP. Complementa `carga-arb` (que arma
  QUÉ cargar) y `verificacion-consumos` (que valida los números); esta cubre CÓMO se opera.
```

---

## (d) Verificado contra disco (26/09/2026)

**186 verificaciones** (77 archivos + 20 memorias + ~50 flags + 22 funciones/constantes + 8 corridas
+ 4 datos + 1 consulta a Supabase live + 4 de git), todas contra el disco, git, la ejecucion o la
base; ninguna contra la documentacion.

- **77 archivos/scripts citados, `ls`** — existen todos salvo los marcados:
  hojas-de-proceso (24: canon, `vocabulario.data.json`, los 9 scripts del skill,
  `_infoDeVideos.py`, `elegir_frame.py`, `pantalla_seguridad.py`, los 5 `pantalla_*.py` redibujados,
  `generar_hojas_img.py`, `hoja_pptx.py`, `_hoNumeros.py`, `hojas_spec.py`) · flujogramas (8 +
  los 8 JSON de `tools/flowchart/data/`) · ppap-motherson (10, incluidos los 4 moldes de
  `scripts/_archive/2026-09-23-ppap-p21-naranja/`, `modules/amfe/apTable.ts` y el agente
  `auditor-cliente`) · carga-arb (13) · informe-tryout (`scripts/tryout/` con `clonlib.py`,
  `mapear.py`, `verificar6.py`, `_gemelo_roto.pptx`, `contenido_dia5/6`, `dia5/6_bilingue`;
  `_mails.py`) · apqp-legajo (hook `apqp-cliente-guard.sh`, guardian en `guardianes.mjs:1645`, su
  test) · 25 reglas y 4 hooks nombrados.
  **Rotos o desplazados**: carpeta `Modificacion arb por Leo` fuera del Escritorio (H7);
  `set_pairs_exacto`/`set_lineas_exacto` fuera de `clonlib.py` (M13).
- **20 memorias** en `~/.claude/projects/C--Dev-BarackMercosul/memory/`: todas existen (con su
  prefijo `feedback_`/`reference_`/`project_`).
- **~50 flags y subcomandos** leidos de su `argparse` / `sys.argv`: `redaccion.py texto|spec`,
  `hoja_proceso_check.py --spec --jerarquia`, `fotodevideo.py ubicar|ventana|sacar|leer` y sus
  flags, `rotular.py --banda ninguna --marca --zona --lisa-ok`, `medir_marca.py --marcado`,
  `_infoDeVideos.py audio --solo` (acepta `0869`), `_hoNumeros.py --q3`,
  `_flujograma.mjs --lista --todos --out --sin-canon`, los 15 de `_sltSmrc.py`,
  `_mailResponder.py` `solo_remitente`/`cc_extra`, `_mailEnviar.py --buscar --enviar`,
  `_pdfBomArb.py`, `_bomLegajo.py --lista --apply`, `_arbVer.py export`, `_mails.py --buscar`.
  **Roto**: `_pdfBomArb.py --verificar-vigencia "<PN>"` (H1, corrido).
- **22 funciones y constantes**: `hojalib.ancho_que_le_toca_cm / guardar_pantalla` y los umbrales
  (45 %, 1,6x, 25 %, 7 pt, `SECUENCIA_MAX=4`, 25 cm², `MAX_FOTOS=4`, `tope = 6` en rotulada);
  `redaccion.revisar_denominacion / revisar_tbd / gate_redaccion / revisar_cocina`;
  `rotular.sin_glifo / chequear_marcas`; los 9 `_gate_*` y `gate_materiales_del_deck` de
  `generar_hojas_img.py`; `portada()` en los dos generadores; `branchColumnWidth` (sin el, 900 px)
  y `lineWidth` en `Flowchart.jsx`; los 12 ids de rojo del canon de flujogramas.
- **Ejecutado**: `redaccion_selftest.py` → 71 ✓ · `hojalib_selftest.py` → **31** (el skill dice 25) ·
  `flujogramaCanon.test.mjs` → **19** (dice 18) · `pdfBomArb.test.mjs` → 17 ✓ ·
  `apqpClienteGuard.test.mjs` → 24 verdes (en la corrida conjunta uno fallo y solo paso verde;
  flaky, no relacionado) · `hojalib.py` sin `__main__` (H6) · el comando de reemplazo de H6 → 10,03 ✓.
- **Datos**: `primera_palabra` = **68** (dice 67); 8 flujogramas en el generador ✓; header
  `client` de cada JSON (153 = VWA, 159 = SMRC); el 151 sigue con los reprocesos en serie ✓.
- **Supabase live, read-only**: `node scripts/_verificarNumeracion.mjs` — 9 verificados, el
  Armrest cierra (M2).
- **Git**: `hojas_spec.py` y `generar_hojas_img.py` versionados; `datos_privados.py` en
  `.gitignore:147` (H5); `scripts/novax/` sin versionar. Blame de las 8 lineas en discrepancia para
  fecharlas contra la regla que las contradice.
- **No verificable (Y: sin montar)**: arbol de `HOJAS DE OPERACIONES`, plantilla `2_APQP Vacio`,
  `I-IN-001`, `Listado_Maestro_FLUJOGRMAS.xlsx`, `17. Fichas de embalaje`, `28- Corrida de
  Produccion\01- TryOut\`, flujogramas 126/131/105 del servidor.

---

## 6. Lo que NO se toca, y por que

- **Todas las citas de Fak** de los seis skills (41 contadas en cursiva de un renglon, mas las
  que cortan renglon). En los hunks se conserva la cita y se saca el andamiaje.
- **Comandos exactos de operaciones fragiles** (keep #3): la carga y el export del arb, los cinco
  gates del PDF de difusion y su mutador, `_bomLegajo.py` con dry-run, `_sltSmrc.py` con la
  procedencia de cada dato, el protocolo de mail al SQE, la receta de enderezar una pantalla.
- **Las tablas con su numero y su porque** (`hojas-de-proceso` §1, §1 bis, §2 bis; `flujogramas`
  §1.1 y la tabla de rojos): contexto que solo el autor sabe, calibrado contra la poblacion.
- **`hojas-de-proceso` §3 bis** (donde se guarda, el numero, `_hoNumeros.py`): decisiones de Fak
  del 24-25/09, frescas y coherentes con `no-pfd-no-ho.md`.
- **`informe-tryout`** fuera de M13: es corto y delega en dos memorias — la forma correcta.
- **`apqp-legajo` §2, §4, §5, §6**: relevamiento fechado de 7 legajos reales; es contexto, no instruccion.
- **Vision en Opus 5.5**: `hojas-de-proceso` §2 sexies ya dice lo que la guia recomienda (*"El OCR
  ordena la busqueda; el que decide es el ojo"*); "mirar a tamaño impreso" (§7) es la vara de
  calidad del papel, no un andamiaje de lectura. Nada que sacar.
- **Urgencia en trigger text** (`supabase-safety` "Uso obligatorio", `verificacion-consumos` y
  `amfe-export-oficial` "SIEMPRE"): keep #6. **Jerga de Fak en `carga-arb`** ("el PDF de Leo",
  "el extracto") y **alias de cliente en `ppap-motherson`** (SMRC / Motherson / Capuana / Reydel):
  nombran cosas distintas, no son sinonimos — se quedan.
- **Redundancia regla ↔ skill** (`hojas-proceso.md` repite 20 puntos del skill y carga con el):
  keep #8 donde coinciden. Solo se proponen los tres puntos donde discrepan (H5, M1, M18).
- `amfe-domain` e `injection-process`: su `description` sigue siendo un indice (flag #44 del
  11/09); sin cambios, no se repite.
