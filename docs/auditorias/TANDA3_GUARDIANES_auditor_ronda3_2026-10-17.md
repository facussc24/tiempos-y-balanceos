# Tanda 3 — guardianes que frenan de más: auditor a ciegas de la RONDA 3 (17/10/2026)

**Veredicto: FUNDIR CON ARREGLOS.**

Los ocho agujeros T1–T8 del auditor de la ronda 2 y el falso positivo F1 están cerrados: sobre la punta `85a0dacf` los
128 casos del auditor reproducen EXACTO lo que dice el informe de la ronda 3 — lo peligroso de T1–T8/F1 frena (exit 2) y
las variantes legítimas pasan (exit 0). Las regresiones de las rondas 1 y 2 siguen frenando, los aflojes que el plan pidió
siguen pasando, la medición diferencial da la misma tabla (ningún verdadero dejó de frenar), los 11 archivos de test de la
tanda pasan (586/586), `node --check` y `eslint` limpios, y el despachador no revienta con basura.

Pero la búsqueda a ciegas encontró **un agujero nuevo de la misma clase que T8**, que la hija no vio y que el propio
arreglo de T8 debía cubrir: **una asignación por desestructuración ENTRE PARÉNTESIS** (`({ d } = …)` de objeto —la única
forma válida en JS— y `([ d ] = …)` de array) **reasigna la variable de `mkdtemp` a una ruta del servidor y el borrado de
esa ruta ya no frena.** La base lo frenaba; la punta lo deja pasar. Es un TRUE BUG. El arreglo es de una línea
(`guardianes.mjs:1890`). Con eso cerrado, se funde.

## Qué se auditó y cómo

- Rama `claude/guardianes-tanda3`, punta **`85a0dacf`** (verificada; no cambió durante la auditoría). Hashes de los
  archivos auditados, idénticos al abrir y al cerrar: `guardianes.mjs` 3aa48920, `shellTexto.mjs` b9ed8467,
  `modeloGuard.mjs` 5859f349, `permisoUnUso.mjs` d31281875, `_dispatcher.sh` 11dbe280. `modeloGuard.mjs` es byte por byte
  el de la punta de la ronda 2: el diff de la ronda 3 no lo toca, así que R1 no pudo cambiar.
- Tres despachadores, cada uno con su `guardianes.mjs`, armados con `git archive` en el scratchpad: **base** `c157b9f9`,
  **r2** `76f7aac5` (la punta que probó el auditor de la ronda 2) y **punta** (el worktree). Cada payload pasa por
  `bash <despachador>` con `HOME`/`USERPROFILE` en una carpeta temporal nueva por corrida (`mkdtemp`), sin `COMPUTERNAME`.
  El despachador **solo juzga**: no se ejecutó ningún comando de ningún caso, no se gastó ningún permiso.
- Los casos peligrosos (lecturas de secretos, copias/moves sobre los listados, borrados de rutas del servidor) viajan
  SIEMPRE por archivo (`.jsonl` de payloads escritos con la herramienta Write) y se corren en un loop de node; nunca se
  escriben en el texto de un comando del chat. En esta sesión nombro cada caso por su código y por lo que mide.
- Los `esperados` de las variantes a ciegas se escribieron ANTES de correr (columnas `eb`/`ep` del `ciegas.jsonl`).

## 1. Los 128 casos de la ronda 3 (base / r2 / punta)

Pasé `__tests__/scripts/guardianesRonda3.casos.json` entero por los tres despachadores. Antes verifiqué que esos 128
casos son los MISMOS que los `casos_r2*.test.mjs` del auditor de la ronda 2 (input, tool y esperado): **0 diferencias**,
así que la hija no cambió ningún caso al pasarlos al JSON.

Resultado: **114 dan lo esperado; los 14 que difieren son EXACTAMENTE los que la ronda 3 dejó escritos sin arreglar.**
Todos los de T1–T8 y F1 dan lo esperado.

| Grupo | Casos | base | r2 (punta ronda 2) | punta `85a0dacf` | Veredicto |
|---|---|:-:|:-:|:-:|---|
| **T1** apqp, `.Save()` de COM pegado a `powershell -Command` | N-A08 | 0 | 0 | **2** | cerrado (vuelve a frenar) |
| **T2** apqp, `)` de la ruta real corta el destino | X-A11, X-A12, X-A13, X-A14, N-C05 | 2/0/0/2/na | 0 | **2** | cerrado |
| **T3** apqp+escritorio, `robocopy /tmp` leído como switch | N-A07, X-E11 | 2 | 0 | **2** | cerrado |
| **T4** apqp+escritorio, destino explícito `-rt`/`-t<X>`/`--t…`/`-Dest` | N-A01/02/03/06, Y-A19, N-E01/02 | 2 | 0 | **2** | cerrado |
| **T5** 3 guardianes, envoltorio con opción que lleva valor + `eval`/`stdbuf` | N-S01..04, N-A04/05, N-E03/04/05/07 | 2 | 0 | **2** | cerrado |
| **T6** secretos, intérprete adentro de `xargs`/`find -exec` | N-S06, N-S07 | 2 | 0 | **2** | cerrado |
| **T7** secretos, `)` adentro de `<( … )` | N-S08 | 2 | 0 | **2** | cerrado |
| **T8** borrado, reasignación de la var de `mkdtemp` (tupla, anotación, walrus, `[d]=`) | N-B01..04 | 2 | 0 | **2** | cerrado (pero ver §3: queda abierta la forma ENTRE PARÉNTESIS) |
| **F1** secretos, el PATRÓN del grep no cuenta como nombrar el secreto | N-S12, N-S13 | 0 | 2 | **0** | cerrado (ya no es falso positivo) |
| controles (siguen igual) | N-S05/09/10/15, X-S17/18/19, N-A09, X-A15, X-C08, N-E06/08/09, X-E12, N-B07/09, N-M01/03, X-M05, N-V01, N-P01, H2/H3/H4/H5/H6/H7/H8-* | — | — | igual | OK |
| **T9** (ronda 1, pieza 6), sin arreglar | N-M02 | 2 | 0 | **0** | documentado, no bloquea |
| **R2** MCP: `command` tapa `code`; secretos no ve el `code`; `save_to` | N-C01, N-C04, N-C06, N-C07 | na | 0 | **0** | documentado, no bloquea (sandbox de build123d atenúa) |
| **R3** preexistentes (ni la base) | N-B05, N-B06, X-B10, X-B11, X-C09 | 0 | 0 | **0** | documentado, no bloquea |
| **F2** copiar el listado para leerlo a `/tmp` sin barra o `$env:TEMP` | N-A10, Y-A17, Y-E13 | 2 | 2/2/2 | **2** | falso positivo de antes, no se aflojó; no bloquea |
| **N-E10** mal armado (no toca el archivo de cerradas) | N-E10 | 0 | 0 | **0** | 0 es lo correcto |

Los 14 que difieren de su `esperado` punta son: N-A10, N-E10, N-B05, N-B06, N-M02, N-C01, N-C04, N-C06, N-C07, X-B10,
X-B11, X-C09, Y-A17, Y-E13 — la lista exacta del informe de la ronda 3. No hay ninguno de T1–T8/F1 entre ellos.

## 2. Regresiones (tienen que seguir dando lo mismo)

### 2.1 Los 6 TRUE BUG del auditor de la ronda 1 — siguen frenando en la punta

| Código | Guardián | Qué mide | base | r2 | punta |
|---|---|---|:-:|:-:|:-:|
| RG-E1 | escritorio | `cd` al archivo de cerradas y `mv` la tarea con punto | 2 | 2 | **2** |
| RG-E2 | escritorio | `find -exec mv` la tarea al archivo de cerradas | 2 | 2 | **2** |
| RG-E3 | escritorio | `xargs mv` la tarea al archivo de cerradas | 2 | 2 | **2** |
| RG-A1 | apqp | MOVER el listado al TEMP (lo saca del servidor) | 2 | 2 | **2** |
| RG-A2 | apqp | `robocopy /MOV` del listado | 2 | 2 | **2** |
| RG-A3 | apqp | copiar HACIA el listado con el destino en `$(cygpath …)` | 2 | 2 | **2** |
| RG-S1 | secretos | `grep -rn … --include=<secreto>` (lee el valor) | 2 | 2 | **2** |
| RG-B1 | borrado | un `.mjs` que guarda el borrado en una cadena y lo LANZA por `child_process.exec` (no es dato) | 2 | 2 | **2** |

### 2.2 Los 9 del escéptico de la ronda 2 y el hallazgo 17 (modelo-guard)

Los 9 (familias H2–H8 y H16) están dentro de los 128 y dan lo esperado (sección 1). El hallazgo 17 (modelo-guard,
`PreToolUse`/`PreModelSwitch` de `set_session_model`) se corrió aparte contra el hook de la punta: 17a 0, 17b 2 (por el
motivo correcto), 17b-ctl 0, 17c-igual 2 (Opus y Fable), **17c-formato-real 0** (esto es R1: el `local_<uuid>` del
`tool_input` no coincide con el uuid pelado del hook — documentado, no bloquea: la app rechaza igual el cambio sobre la
propia sesión), 17d 0/2, 17e 2, PMS-sdk 0, PMS-picker 0, json-roto 0. Idéntico a lo que midió el auditor de la ronda 2.

### 2.3 Los aflojes que el plan pidió — siguen pasando (ningún arreglo de la ronda 3 los volvió a frenar)

Copiar el listado al TEMP para leerlo (H2-V2, H3-V1, H7-V1): 0. `ls -la` del archivo de secretos (H4-V1): 0. Borrar la
carpeta que el mismo comando creó con `mktemp` (N-B08): 0. `cat >>` de prosa a un `.md` (N-I01): 0. El caso del pendrive
de video (en la medición, video-maquina 1→0): destrabado. Mover una tarea del Escritorio con la carpeta y el `mv` en el
mismo comando (H7-V2): 0. **Ninguno volvió a frenar: no hay TRUE BUG por ese lado.**

## 3. Variantes nuevas a ciegas (corte escrito antes de correr) y las decisiones «distinto del auditor»

22 variantes, 2+ por hallazgo y una por cada decisión que la hija tomó distinto del auditor. El corte (`eb`=base,
`ep`=punta) se escribió antes. Clasificación pedida: base frena y punta pasa = **TRUE BUG**; base tampoco frena =
**Preexistente**.

| Código | Guardián | Qué mide (forma nueva) | base | r2 | punta | Clase |
|---|---|---|:-:|:-:|:-:|---|
| BT1a | apqp | T1 con `pwsh -c` (otra shell): COM `Open`+`SaveAs`+`Quit` sobre el listado AMFE | 0 | 0 | **2** | frena OK (la regla «cualquier shell» aguanta) |
| BT1b | apqp | T1 FP-probe: COM `.SaveAs` pegado a `powershell` sobre un `.xlsx` LOCAL, sin nombrar listado | 0 | 0 | **0** | sin FP: `codigoGuardaListado` está gatillado por `APQP_LISTADO.test` |
| BT2a | apqp | T2 `os.replace` encima del listado de FLUJOGRAMAS (ruta real con `( )`) | 0 | 0 | **2** | frena OK |
| BT2b | apqp | T2 destino armado por llamada anidada `os.path.join(DIR-con-paréntesis, nombre)` | 2 | 0 | **2** | frena OK (paréntesis anidado) |
| BT3a | apqp | T3 `ROBOCOPY` en MAYÚSCULAS desde `/tmp`, con switch `:valor` | 2 | 0 | **2** | frena OK |
| BT3b | escritorio | T3 gemelo: `robocopy` desde `/tmp` al archivo de cerradas con dos switches | 2 | 0 | **2** | frena OK |
| BT3c | apqp | T3 decisión: un switch de robocopy ESCRITO ANTES de las rutas (`/MIR`) | 2 | 0 | **2** | frena OK (la lista de switches lo soporta) |
| BT4a | apqp | T4 `cp -rt` pegado al dir (sin espacio) | 2 | 0 | **2** | frena OK |
| BT4b | escritorio | T4 PowerShell `Move-Item -Destination:` en escritorio | 2 | 2 | **2** | frena OK |
| BT4c | apqp | T4 decisión: `-Container` de PowerShell NO se lee como `-t`; `-Destination` sí es el destino | 2 | 2 | **2** | frena OK |
| BT5a | secretos | T5 envoltorios anidados `nohup timeout -k 3 5 cat <secreto>` | 2 | 2 | **2** | frena OK |
| BT5b | apqp | T5 `env -S "cp … <listado>"` (parte su valor en palabras) | 0 | 0 | **0** | Preexistente (base tampoco; el path con espacios se parte — forma muy rebuscada) |
| BT5c | secretos | T5 decisión: la red de seguridad NO sobra — envoltorio + `echo <nombre>` (no lee) pasa | 0 | 0 | **0** | OK (no frena de más) |
| BT6a | secretos | T6 intérprete `perl` adentro de `xargs` | 2 | 0 | **2** | frena OK |
| BT6b | secretos | T6 intérprete `ruby` adentro de `find -exec` | 2 | 0 | **2** | frena OK |
| BT7a | secretos | T7 paréntesis anidados en `<( grep -oE '(…)' )` sobre el secreto | 2 | 0 | **2** | frena OK |
| BT7b | secretos | T7 `awk` con paréntesis dentro de `<( )` sobre el secreto | 2 | 2 | **2** | frena OK |
| BT8a | borrado | T8 encadenada `e = d = <servidor>` | 2 | 2 | **2** | frena OK |
| **BT8b** | **borrado** | **T8 desestructuración de OBJETO `({ d } = { d: <servidor> })`** | **2** | 0 | **0** | **TRUE BUG** |
| **BT8c** | **borrado** | **T8 desestructuración de array ENTRE PARÉNTESIS `([ d ] = […])`** | **2** | 0 | **0** | **TRUE BUG (misma raíz)** |
| BT8d | borrado | T8 tupla entre paréntesis `(d,) = (<servidor>,)` (Python) | 2 | 0 | **2** | frena OK |
| BF1a | secretos | F1 VERDE: `find … | xargs grep '<secreto>'` (el secreto es el PATRÓN) | 0 | 2 | **0** | OK (ya no es FP) |
| BF1b | secretos | F1 conteo: `find -name <secreto> -exec grep …` (el secreto es el ARCHIVO, no solo el patrón) | 2 | 2 | **2** | frena OK (la decisión «cuento» aguanta) |

Las cinco decisiones «distinto del auditor» quedaron probadas y **ninguna abre nada**: T1 para cualquier shell (BT1a y el
control BT1b sin FP), T3 por lista de switches (BT3c, switch antes de las rutas), T4 GNU solo en cp/mv y PowerShell solo
en Copy-Item/Move-Item (BT4c: `-Container` no se confunde con `-t`), T5 red de seguridad parametrizada (BT5c: no agarra
un `echo`), F1 conteo del secreto vs patrón (BF1b: sigue frenando cuando el secreto es el archivo).

### TRUE BUG (bloquea la fusión)

**TB-1. El arreglo de T8 no cubre la desestructuración ENTRE PARÉNTESIS: un `rmtree`/`rmSync` sobre una ruta del
servidor reasignada así ya no frena.** — `scripts/_lib/guardianes.mjs:1887-1890` (`variablesTemporales` →
`asignacionesDe`).

- Reproducción: BT8b (objeto `({ d } = { d: '<servidor>' })`) y BT8c (array entre paréntesis `([ d ] = […])`): **base 2,
  punta 0**. Control BT8d (`(d,) = (…,)`, tupla de Python entre paréntesis): punta 2 (frena bien). Las formas que la hija
  SÍ arregló siguen frenando: N-B01..04 y BT8a punta 2.
- Qué pasa: la captura de `mkdtemp` toma `d` como variable temporal; para decidir si `d` sigue apuntando al TEMP, cuenta
  sus asignaciones. El bloque que cuenta la desestructuración parte la sentencia, toma la izquierda del `=`
  (`izq`) y exige que esté balanceada:
  `if ((izq.match(/[([{]/g) ?? []).length === (izq.match(/[)\]}]/g) ?? []).length) n++;`.
  En `({ d } = …)` la izquierda es `({ d } ` → abre `(` y `{` (2), cierra `}` (1): **desbalanceada**, porque el `)` de
  cierre está DESPUÉS del `=`. Por eso no se cuenta la reasignación, `d` queda contada una sola vez (la del `mkdtemp`),
  sigue marcada como temporal y el borrado se exime. Como la ÚNICA forma válida en JS de una asignación por
  desestructuración de objeto es justamente `({ … } = …)`, la forma idiomática escapa entera; el array `[d] = …` sin
  paréntesis (lo que probó la hija en N-B04) sí se cuenta, pero `([d] = …)` con paréntesis también escapa.
- Por qué es un TRUE BUG y no ruido: verifiqué que el comando hace lo que el guardián cuida —`d` queda reasignada a
  `Y:/Ingenieria/…/13. Analisis…` y `fs.rmSync(d,{recursive:true,force:true})` borra esa carpeta del servidor— y la base
  lo frenaba. Es exactamente la clase de T8 (reasignar la var de `mkdtemp`), que la ronda 3 dijo cerrar nombrando
  `{ d } =`; quedó abierta la única forma en que `{ d } =` se escribe de verdad. No figura en la lista de «lo que quedó
  sin arreglar» del informe de la ronda 3: es un hueco no visto.
- Arreglo mínimo (1 línea, `:1890`): aceptar también la izquierda con UN paréntesis de apertura sin cerrar. P. ej.:
  `const o=(izq.match(/[([{]/g)??[]).length, c=(izq.match(/[)\]}]/g)??[]).length; if (o===c || (/^\s*\(/.test(izq) && o===c+1)) n++;`
  (mantiene `(a, d) =` y `(d,) =`, agrega `({ d } =` y `([ d ] =`). Test: ROJO con BT8b y BT8c; VERDE con una limpieza
  temporal legítima que use `({ … } = …)` para OTRA variable.

### ROBUSTNESS / Preexistentes (no bloquean)

- **BT5b — `env -S "cp … <listado>"`** no frena en ninguna versión (base 0, punta 0). La T5 parte el valor de `env -S`
  por espacios y rompe la ruta del listado (que tiene espacios) en muchas palabras, así que el `cp` no se reconstruye.
  La base tampoco lo veía → Preexistente, no lo abrió esta tanda; forma muy rebuscada (no aparece en los registros).
- **R1** (modelo-guard, `local_<uuid>` vs uuid pelado) sigue como lo dejó la ronda 3: 17c-formato-real pasa. El archivo
  es byte por byte el de la ronda 2, así que no cambió nada; queda dicho que el test «sobre la misma» usa dos textos
  iguales que en la realidad no se dan.

### FALSE POSITIVE

- Ninguno nuevo. El probe BT1b (COM `.SaveAs` sobre un archivo local) confirma que el arreglo de T1, aunque ahora empuja
  a `codigos` el código pegado a CUALQUIER shell, no frena de más: `codigoGuardaListado` arranca con
  `if (!APQP_LISTADO.test(s)) return false`, así que un `.Save()` sobre un archivo local pasa.

## 4. Chequeos pedidos

- `node --check` de `guardianes.mjs`, `shellTexto.mjs`, `modeloGuard.mjs`, `permisoUnUso.mjs`: los cuatro OK.
- Despachador de la punta: Bash inocente (`ls -la`) → **exit 0, sin stdout ni stderr**. Tampoco revienta (exit 0, sin
  texto) con: payload sin `tool_input`, `tool_input: null`, una MCP con `tool_input` vacío, y un JSON roto / que no es
  JSON. (5 payloads, todos exit 0, 0 B de salida.)
- Tests de la tanda (`npx vitest run … --pool=threads`): los 11 archivos pedidos — **11 passed, 586 passed**. (La ronda 3
  no agregó archivos de test: sumó casos a `guardianes/apqpCliente/escritorio/borradoMasivo` y el ayudante
  `guardianesRonda3.mjs` + `.casos.json`.)
- `npx eslint scripts/_lib/guardianes.mjs scripts/_lib/shellTexto.mjs __tests__/scripts/guardianesRonda3.mjs`: **exit 0,
  0 errores**.
- Medición diferencial `node scripts/_frenosMedir.mjs --base <c157b9f9>/scripts/_lib/guardianes.mjs --casos` (datos leídos
  de la nube de Ingeniería): **la misma tabla de las rondas 1 y 2.**
  - sin script-inline (263): V 71 (medibles 49: frenan 43 → **43**) · F 51 (51: 38 → 8) · SD 141 (86: 72 → 65);
  - script-inline (173): V 165 → **165** · F 6 → 0 · SD 2 → 0;
  - cambiaron 45, **aflojan 45, aprietan 0**; ningún verdadero dejó de frenar; guardián que frena con la nueva y no con la
    base: `permiso-un-uso-guard`, 6. Los 45 cambios son todos «afloja» (revisé uno por uno la clase [V]/[F]/[SD]: no hay
    ningún [V] que deje de frenar).

## 5. Lo que no pude medir

- **Falsos positivos nuevos sobre comandos que nunca frenaron.** `_frenosMedir.mjs` repite solo los 436 frenos, así que
  un comando que antes pasaba y ahora frena no aparece. Los cambios que PODRÍAN frenar de más son T4 (más formas de
  destino), T5 (la red de seguridad después de un envoltorio) y T8 (más formas de asignación), pero los tres frenan solo
  si la ruta del listado / del archivo de cerradas / del servidor ya está en el comando. El probe BT1b y los controles
  BT5c, BT4c, BF1a no mostraron FP nuevos.
- **La app de escritorio** y si deja que una sesión se cambie el modelo a sí misma (R1): es del `app.asar`, no lo releí.
- **El sandbox de build123d** (R2): no corrí la MCP; lo que lo atenúa está dicho en el informe de la ronda 3.
- No corrí `npm test` entera, `tsc` ni `build`: el pedido eran los tests de la tanda.

## Archivos de esta auditoría (scratchpad de la sesión, carpeta `aud3r3/`)

`base/` y `r2/` (git archive de `c157b9f9` y `76f7aac5`); `correr.test.mjs` + `r3casos.json` + `salida_r3casos.txt`
(los 128); `comparar.test.mjs` (los 128 del JSON == los del auditor r2); `ciegas.jsonl` / `ciegas2.jsonl` + `correr_ciegas*.mjs`
+ `ciegas*.resultados.json` (las 22 variantes a ciegas, corte antes); `regr.jsonl` + `correr_regr.mjs` (las regresiones r1);
`robust.jsonl` + `robrun.sh` (el despachador con basura); `medicion.txt` (la medición diferencial). Los informes previos:
`TANDA3_GUARDIANES_auditor_2026-10-16.md`, `..._auditor_ronda2_2026-10-17.md`, `..._ronda3_2026-10-17.md`.

## Respuesta (la hija de la ronda 3, 17/10/2026)

| Hallazgo | Qué se hizo | Commit | Test |
|---|---|---|---|
| **TB-1** desestructuración entre paréntesis (BT8b, BT8c) | arreglado como proponía el informe: la izquierda del `=` que empieza con `(` y tiene uno sin cerrar cuenta como asignación. Cierra también Z-B163 del auditor de cierre, que es la misma forma | `cbe85dbf` | `borradoMasivoGuard.test.mjs`, «ROJO (ronda 3, TB-1 del auditor a ciegas)», con el VERDE pedido: la misma forma sobre OTRA variable pasa |
| BT5b `env -S` con una ruta con espacios | no se arregló: es el R5 del auditor de cierre (preexistente, la base tampoco lo frenaba); va a la cola de cambios | — | — |
| R1 (modelo-guard) | sin cambios, como dice el informe; va a la cola | — | — |

Los casos de este informe (`ciegas.jsonl`, `ciegas2.jsonl`) están en `__tests__/scripts/guardianesRonda3.casos.json` con
el campo `auditor: "a ciegas r3"`. Sobre la punta `d559ce2e` todos dan lo esperado salvo BT5b. El detalle de la segunda
tanda está en `TANDA3_GUARDIANES_ronda3_2026-10-17.md`.
