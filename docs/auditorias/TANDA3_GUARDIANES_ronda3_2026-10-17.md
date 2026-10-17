# Tanda 3 — guardianes que frenan de más: ronda 3 (17/10/2026)

El auditor a ciegas de la ronda 2 (`TANDA3_GUARDIANES_auditor_ronda2_2026-10-17.md`) probó la punta `76f7aac5` y encontró
**ocho agujeros, T1 a T8**, que bloqueaban la fusión: formas que la base `c157b9f9` (o la punta de la ronda 1, `f660b7f3`)
frenaban y la punta dejaba pasar. Esta ronda los cierra, uno por commit y cada uno con su caso ROJO en el test, y arregla
de paso el falso positivo F1. Los VERDES de antes siguen pasando.

**Cómo se probó.** Los casos del auditor (sus `casos_r2*.test.mjs`, con los esperados que escribió antes de correr) se
pasaron a `__tests__/scripts/guardianesRonda3.casos.json` con un script, sin que los comandos pasaran por el chat. Los
tests los llaman por su código (`esperados('<guardián>', ['N-A08', …])`, ayudante `__tests__/scripts/guardianesRonda3.mjs`,
que solo JUZGA el payload con `evaluar()`: no ejecuta nada). Antes de cada arreglo se reprodujo el caso por el
despachador de la base y por el de la punta: los 8 agujeros se reprodujeron igual que en el informe del auditor.

## Los ocho agujeros y el falso positivo

| N.º | Guardián | Qué pasaba en la punta | Qué se cambió | Commit | El ROJO (o el VERDE) |
|---|---|---|---|---|---|
| T1 | apqp-cliente | el `.Save()` de COM sobre el listado escrito adentro de `powershell -Command` pasaba (regresión de la ronda 2) | lo pegado a una shell se mira como comandos **y** como código (`codigoGuardaListado`) | `bc0be0de` | `apqpClienteGuard.test.mjs`, «ronda 3, T1»: N-A08, más el control N-A09 y los 7 casos del hallazgo 2 |
| T2 | apqp-cliente | un `)` de la carpeta real del listado (`( I-AC-005.3)`, `(I-IN-002III)`) cortaba el destino: una copia, `copyFileSync`, `to_excel` u `open(…,'w')` ENCIMA del listado real pasaba | `argumentosDeLlamada()`: los argumentos de la llamada se parten en las comas de primer nivel, saltando comillas y paréntesis anidados | `28feca5e` | «ronda 3, T2»: X-A11, X-A12, X-A13, X-A14, N-C05 (el `code` de una MCP), con las rutas REALES; VERDE: traer el listado real a `C:\tmp` |
| T3 | apqp-cliente y escritorio | `robocopy /tmp …`: `/tmp` se tiraba como switch y el nombre del archivo quedaba como destino | `ROBOCOPY_SWITCH_RE`: un switch es uno de la lista de robocopy o lleva `:valor`; la usan los dos guardianes | `a0439a0a` | «ronda 3, T3»: N-A07 (apqp) y X-E11 (escritorio), con los verdes del hallazgo 3 |
| T4 | apqp-cliente y escritorio | el destino explícito quedaba a medias: apqp no leía `-rt`, `-t<X>` ni `--target-directory X`; escritorio no leía `-t<X>` ni `--target=`; ninguno leía `-Dest` ni `-Destination:X` | `destinoExplicitoDe()`, una sola función para los dos: `-t X`, `-rt X`, `-t<X>`, cualquier prefijo de `--target-directory` (con `=` o espacio) en cp/mv; `-Dest…` (3 letras o más) con espacio o `:` en Copy-Item/Move-Item | `d4eedb01` | «ronda 3, T4»: N-A01, N-A02, N-A03, N-A06, Y-A19 (apqp) y N-E01, N-E02 (escritorio); VERDES: las mismas formas trayendo el listado a una carpeta local |
| T5 | secretos, apqp-cliente y escritorio | `timeout -s KILL 5 …`, `env -u X …`, `exec -a n …` dejaban como verbo al VALOR de la opción; `stdbuf` y `eval` no estaban | `verboDeComando` saltea el valor de las opciones que lo llevan (tabla `ENVOLTORIO_CON_VALOR`; `env -S` se parte en palabras), suma `stdbuf`, y con un envoltorio adelante toma el primer verbo que el guardián reconoce; `comandosConEval()` vuelve a partir lo de detrás de un `eval` | `2a423fad` y `85a0dacf` | `guardianes.test.mjs` «P12 ROJO (ronda 3, T5)»: N-S01..04 y los controles; apqp: N-A04, N-A05; escritorio: N-E03, N-E04, N-E05, N-E07 |
| T6 | secretos | un intérprete adentro de `xargs` o de `find -exec` que abre lo que le pasan (`xargs -I % python -c …`) pasaba | el intérprete cuenta como lo que corre adentro, en los dos lugares donde se mira | `f4a58639` | «P12 ROJO (ronda 3, T6)»: N-S06, N-S07 y los del hallazgo 5 |
| F1 | secretos | buscar quién usa el secreto con `xargs grep -l '<nombre>'` o `find … -exec grep -l '<nombre>'` frenaba (falso positivo que metió el hallazgo 5) | `nombraSecretoFueraDelPatron()`: el PATRÓN del grep/sed/awk de adentro (lo de `-e`, o el primer posicional) no cuenta; con `-f` no hay patrón | `7a795907` | «P12 VERDE (ronda 3, F1)»: N-S12, N-S13; y dos ROJOS de la misma forma: el secreto también es el archivo que `find` le pasa al grep, y la lista de `-f` |
| T7 | secretos | un paréntesis adentro de `<( … )` (`sed 's/(x)//'`) partía la sustitución y el lector quedaba afuera | el cierre se busca con `finSustitucion` (cuenta paréntesis y salta comillas; ahora exportada de `shellTexto.mjs`) | `7b5b1a2d` | «P12 ROJO (ronda 3, T7)»: N-S08 y los del hallazgo 6 |
| T8 | borrado-masivo | la variable de `mkdtemp` reasignada con tupla (`d, e = …`), anotación (`d: str = …`), walrus (`d := …`) o desestructuración (`[d] = …`) seguía contando como temporal | la captura toma solo el nombre al principio de la sentencia; cuentan como asignación la anotación, el walrus y el nombre a la izquierda de un `=` con `[ ( { ,`; un argumento con nombre adentro de una llamada abierta (`rmtree(d, ignore_errors=True)`) no cuenta | `5b192b08` | `borradoMasivoGuard.test.mjs`, «ronda 3, T8»: N-B01..04 y los 8 de la ronda 2; dos VERDES con argumentos con nombre |

`85a0dacf` es parte de T5: el editor había dejado el carácter invisible U+E000 escrito literal en `comandosConEval`, y
el test de `commitRutasGuard` lo frena (un editor que se lo come rompe todos los guardianes). Quedó como escape.

### Lo que decidí distinto de lo que proponía el auditor

- **T1**: el auditor proponía empujar a `codigos` solo lo pegado a PowerShell. Lo hice para cualquier shell (`bash -c`,
  `cmd /c` también): `codigoGuardaListado` no da falsos sobre texto de shell (busca `.Save(`, `shutil.copy(` y similares),
  y el cuerpo de un heredoc que alimenta a una shell ya iba a las dos listas. Una regla igual para todas es más fácil de
  sostener.
- **T3**: el auditor proponía «origen y destino son siempre `args[0]` y `args[1]`». Usé una lista de los switches de
  robocopy (más todo lo que lleva `:valor`): da lo mismo en el orden normal y además aguanta un switch escrito antes de las
  rutas. La lista vive en un solo lugar y la usan los dos guardianes.
- **T4**: las formas GNU (`-t`, `--t…`) se leen solo en `cp` y `mv`, y las de PowerShell solo en `Copy-Item`, `Move-Item`
  y sus alias: leídas en cualquier verbo, `-Container` de PowerShell se tomaba como `-t` con valor «ainer».
- **T5**: además de la tabla de opciones con valor, la red de seguridad del auditor (si después de un envoltorio el verbo
  no se reconoce, se toma el primer lector o mover que sigue) quedó como un parámetro de `verboDeComando` que cada guardián
  pasa con sus verbos; los otros que la usan no cambian.
- **F1**: el auditor proponía buscar el secreto en el comando sin el patrón. Lo cuento: frena si el comando nombra el
  secreto más veces que las que lo nombra el patrón. Así `find -name <secreto> -exec grep -l '<secreto>' {} +`, que lee el
  archivo, sigue frenando.

## Lo que quedó escrito, sin arreglar (y por qué)

Lo que el encargo dejó para después, más lo que el auditor marcó como preexistente. Ninguno lo cubrió de paso un arreglo
de T1 a T8 (los casos siguen dando lo mismo que antes):

- **T9** (pieza 6, de la ronda 1): el pedido de mandar un mail que le llega al script por `xargs` desde un `echo` (N-M02)
  sigue pasando. `loQueEjecuta` saca el `echo` como texto y lo que llega por la cañería queda afuera. Arreglo propuesto
  por el auditor: si un comando de texto entrega por una cañería a `xargs` o a un intérprete, sumarlo a lo que corre.
  Forma rebuscada, no aparece en los registros.
- **R1** (modelo-guard): el `session_id` de `set_session_model` llega como `local_<uuid>` y el del hook es el uuid pelado,
  así que «sobre la misma sesión» nunca se cumple. Hoy no cambia nada (la app rechaza el cambio sobre la propia sesión).
  Falta decirlo en el comentario y en el test.
- **R2** (despachador de MCP): si vienen `command` y `code`, gana `command` (N-C01); secretos-guard no mira el `code` de
  una MCP porque lo recibe como cuerpo de heredoc (N-C04, N-C07); `script(save_to=…)` no pasa por el despachador. El
  sandbox del build123d-mcp instalado lo atenúa.
- **R3** (preexistentes, ni la base los frenaba): `-EncodedCommand`; el heredoc a python que lee el secreto; un
  `os.system('rmdir /s /q …')` en código (X-B10, X-B11, N-C06); un script del scratchpad que guarda el borrado en una
  cadena y lo corre con `os.startfile` o `WScript.Shell.Run` (N-B05, N-B06); un `rmtree` importado con alias (X-C09).
- **F2** (falso positivo de antes, no se aflojó): copiar el listado para leerlo a `/tmp` sin barra o a `$env:TEMP`
  (Y-A17, Y-E13, N-A10) sigue frenando, igual que en la base: para `cp`/`mv` el `/tmp` se tira como si fuera un switch de
  Windows y `resolvedorDe` no resuelve `$env:TEMP`. No lo toqué: es un afloje que no estaba pedido.
- **N-E10**: el auditor lo marcó como mal armado (no toca el archivo de cerradas); 0 es lo correcto.

## Las verificaciones

- `node --check` de `guardianes.mjs` y `shellTexto.mjs`: OK.
- Despachador de la punta con un Bash inocente (`ls -la`): **exit 0**, sin salida ni error.
- Los casos del auditor por el despachador de la punta: de los 128, difieren de lo esperado 14, y son exactamente los de
  la lista de arriba (T9, R2, R3, F2, N-E10). Todos los de T1 a T8 y F1 dan lo esperado.
- Tests de la tanda (13 archivos: los 10 que tocó la rama más `nubePersonalGuard`, `commitRutasGuard` y `firmaIAGuard`):
  **758 de 758** después del arreglo del carácter invisible.
- Medición diferencial, `node scripts/_frenosMedir.mjs --base <base c157b9f9>/scripts/_lib/guardianes.mjs --casos`:

| Clase (sin script-inline, 263) | Medibles | Frenan con la base | Frenan con la punta |
|---|:-:|:-:|:-:|
| Verdaderos (71) | 49 | 43 | **43** |
| Falsos (51) | 51 | 38 | 8 |
| Sin determinar (141) | 86 | 72 | 65 |

  script-inline (173): verdaderos 165 → 165, falsos 6 → 0, sin determinar 2 → 0. Cambiaron 45 (aflojan 45, aprietan 0).
  Guardianes que frenan con la nueva y no con la base: `permiso-un-uso-guard`, 6. **Es la misma tabla que la ronda 2:
  ningún verdadero dejó de frenar.**
- La suite entera (`npx vitest run --pool=threads`, 402 archivos): **8.083 pasan, 1 falla, 30 saltados**. La que falla es
  `xlsxComparar.test.mjs` (un caso se pasó de los 15 s con la suite y el auditor corriendo a la vez); corrido solo da
  13 de 13. La rama no toca ese test ni `_xlsxComparar.py`.

## Segunda tanda: lo que encontraron los dos auditores de la ronda 3

Sobre la punta `85a0dacf` corrieron dos auditores Opus: el de cierre de esta sesión
(`TANDA3_GUARDIANES_ronda3_auditor_cierre_2026-10-17.md`) y uno a ciegas que lanzó la madre
(`TANDA3_GUARDIANES_auditor_ronda3_2026-10-17.md`). Los dos dicen FUNDIR CON ARREGLOS. Sus casos se sumaron por script a
`guardianesRonda3.casos.json` (128 → 316; el auditor a ciegas arma el nombre del secreto en su corredor con un marcador,
y se reemplaza igual que allá). La madre pidió aplicar el TRUE BUG del auditor a ciegas y N1, N2, F3, F4 y F5 del de
cierre. Apliqué también **N3**, que el auditor de cierre marca como bloqueante y la madre no nombró; está en su propio
commit (`d559ce2e`) para poder sacarlo si no se quiere.

| N.º | Guardián | Qué pasaba | Qué se cambió | Commit | El ROJO (o el VERDE) |
|---|---|---|---|---|---|
| TB-1 (a ciegas) | borrado-masivo | la desestructuración ENTRE PARÉNTESIS (`({ d } = …)`, `([ d ] = …)`) reasignaba la variable de `mkdtemp` sin que se contara | la izquierda del `=` que empieza con `(` y tiene uno sin cerrar también cuenta como asignación | `cbe85dbf` | `borradoMasivoGuard.test.mjs` «TB-1»: BT8b, BT8c, Z-B163; VERDE la misma forma sobre otra variable |
| F3 | borrado-masivo | el renglón de continuación de una llamada de varios renglones (`    d, ignore_errors=True)`) contaba como asignación (lo metió T8) | un renglón que sigue a un `(` / `[` abierto en los de antes, con el `nombre=` pegado, es un argumento con nombre | `e75b9495` | «F3»: VERDES Z-B180, Z-B181; ROJO la reasignación adentro del cuerpo de una función de varios renglones |
| F4 | borrado-masivo | `export const d = fs.mkdtempSync(…)` ya no era temporal (lo metió T8) | se acepta `export` adelante | `18c8c33b` | «F4»: VERDE Z-B184 |
| N2 | borrado-masivo | `d = tempfile.mkdtemp() if prueba else r'<servidor>'`: la variable contaba como temporal (desde P18) | después del `)` que cierra el `mkdtemp` solo puede quedar un `;` o un comentario | `23c65844` | «N2»: Z-B160d, Z-B160, Z-B161, Z-B162 y sus controles |
| F5 | escritorio y apqp-cliente | `timeout 60 rg -n mv <archivo de cerradas>` frenaba: el respaldo de T5 tomaba el patrón como verbo | el respaldo vale solo para el valor de una opción del envoltorio: la palabra que sigue a la opción no es conocida y la siguiente sí | `936cc48e` | `escritorioGuard.test.mjs` «F5»: VERDES Z-E95, Z-E95c; los envoltorios de T5 siguen frenando |
| N1 | apqp-cliente | adentro de `powershell -Command`, `cp -Destination '<listado>' …` y `cp -LiteralPath … '<listado>'` pasaban: T4 leía `cp`/`mv` con las reglas de GNU (regresión de `d4eedb01`) | la vuelta sabe si la shell es PowerShell y ahí lee `cp`/`mv` como alias de Copy-Item / Move-Item | `f5352e4a` | `apqpClienteGuard.test.mjs` «N1»: Z-A31, Z-A31c, Z-A32, Z-A43; VERDES Z-A44, Z-A40 y las formas de Bash |
| N3 | apqp-cliente | el `cp`/`mv` detrás de `xargs -I {}`, `find -exec` o `parallel` encima del listado pasaba (la regla estaba solo en escritorio-guard desde la ronda 1) | el `{}` ya no parte el comando; se juzga el comando de adentro hasta su `;` / `+` / `:::`, con el origen que llega por la cañería; el bloque que juzga una copia pasa a `juzgaCopia` | `d559ce2e` | «N3»: Z-A87, Z-A88, Z-A89, Z-A91, Z-A92, Z-A93, Z-A94, Z-A96; VERDE Z-A95 (traerlo por xargs para leerlo) |

Decidido distinto de lo propuesto:
- **F3**: el auditor proponía no mirar ningún renglón adentro de una llamada abierta. Así se dejaba de ver una
  reasignación adentro del cuerpo de una función de varios renglones (`lista.forEach((x) => {` … `[d] = […]` … `})`). Solo
  salteo el renglón de continuación cuando lo de la izquierda termina pegado al `=` (`nombre=`, la forma de un argumento
  con nombre); las llaves no cuentan como abiertas. El ROJO del test cuida justo eso.
- **F5**: tomé la primera salida del auditor y la ajusté: el respaldo mira solo la palabra que sigue al valor (`timeout -x
  VAL cat`), no cualquiera de más adelante.
- **N3**: tomé el camino fino (destino y origen del comando de adentro), no el grueso: traer el listado por xargs para
  leerlo (Z-A95) sigue pasando.

**Lo que queda para la cola de cambios** (ROBUSTNESS o preexistente; ninguno lo frenaba la r2, salvo lo marcado):
- del auditor de cierre: **R4** (más formas de reasignar: `&&=`, `for (d of …)` sin `let`, `for _, d in`, `case d:`;
  Z-B164..167), **R5** (`env -S` se parte sin respetar comillas; Z-S54, Z-A84, Z-E93, y BT5b del auditor a ciegas), **R6**
  (el secreto como `-a` / `--arg-file` de xargs; Z-S56, Z-S57), **R7** (un comentario con un `)` suelto adentro de una
  llamada de varios renglones; Z-A14), **R8** (`grep -hv` con el secreto como patrón sobre `ls -a`: es el costo de F1, por
  diseño; Z-S131), **R9** (`--replace` y `--eof` de xargs se comen la palabra que sigue); **F6** (un `.save(` de una copia
  local adentro de `bash -c` frena, por la decisión de T1 de mirar como código lo pegado a cualquier shell; Z-A04), **F7**
  (grep con `-m` / `-A` / `-e` antes del patrón, de P12; Z-S120..123 y Z-S120d..122d), **F8** (el secreto como patrón de
  OTRO grep de la cañería; Z-S134), y los falsos de antes Z-S132, Z-B182 y Z-B188;
- de la ronda 2, sin cambios: T9, R1, R2, R3, F2 y N-E10 (arriba).

Verificaciones de la segunda tanda, sobre la punta `d559ce2e`:
- `node --check` de los dos módulos: OK; el despachador con un Bash inocente: **exit 0**, 0 bytes de salida y de error;
- los 316 casos por el despachador de la punta: difieren de lo esperado 38, y son exactamente los de la lista de la cola
  (los 14 de la ronda 2 más los 24 de arriba); todos los de TB-1, N1, N2, N3, F3, F4 y F5 dan lo esperado;
- tests de la tanda (los mismos 13 archivos): **765 de 765**;
- medición diferencial: **la misma tabla** (verdaderos 43 → 43, falsos 38 → 8, sin determinar 72 → 65; script-inline
  165 → 165, 6 → 0, 2 → 0; aflojan 45, aprietan 0).

## Lo que no pude medir

- Los falsos positivos nuevos sobre comandos que nunca frenaron (lo mismo que dijo el auditor): `_frenosMedir.mjs` repite
  solo los 436 frenos. Los cambios que pueden frenar de más son T4 (lee más formas de destino), T5 (la red de seguridad
  después de un envoltorio) y T8 (cuenta más formas de asignación). T4 y T5 frenan solo si la ruta del listado o del
  archivo de cerradas está en el comando; T8 solo vuelve a la regla de la base (la variable deja de contar como temporal).
- Los commits van sin push, en la rama `claude/guardianes-tanda3`.
