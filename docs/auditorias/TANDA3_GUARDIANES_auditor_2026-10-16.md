# Tanda 3 — guardianes que frenan de más: auditoría independiente (16-17/10/2026)

Rama `claude/guardianes-tanda3` (worktree `C:\Dev\BarackMercosul\.claude\worktrees\guardianes-tanda3`), desde `c157b9f9`.
Se auditó la punta **`5f247228`** (15 commits: los 14 del pedido más `5f247228`, que entró a las 00:37 del 17/10 y solo cambia
el U+E000 literal por la secuencia en dos renglones de `guardianes.mjs`; todas las corridas de este informe son posteriores).
Hashes de lo auditado (`git hash-object`, iguales al cerrar): `scripts/_lib/guardianes.mjs` `e95bd8ce`,
`scripts/_lib/modeloGuard.mjs` `a7abd9e8`, `scripts/_lib/permisoUnUso.mjs` `d32f9b14`. No se editó, commiteó ni pusheó nada del repo.

## Veredicto: APROBADO CON CAMBIOS

El trabajo está bien medido y la mayoría de los aflojes son correctos: la medición diferencial da lo que dice el documento
(51 falsos: 38 → 8; 43 verdaderos siguen frenando; el único freno nuevo es el de permisos), los tests de la rama pasan
(466 de 466 en los 10 archivos de la tanda) y la configuración es válida para Claude Code 2.1.299. Pero hay **seis
TRUE BUG**: cinco formas reales de mover, escribir, borrar o leer que la base frenaba y la rama deja pasar (piezas 1, 3, 4
y P12), y uno en la pieza 12 que solo le puede pegar al selector de modelo de Fak. Se arreglan sin rehacer piezas y cada
uno necesita su caso ROJO en el test.

## TRUE BUG

### 1. escritorio-guard (pieza 4): mover a mano al archivo de tareas cerradas con `cd`, `find -exec` o `xargs` ya no frena
`scripts/_lib/guardianes.mjs:1277-1298` (`mueveAMano`). Mira solo el verbo en posición de comando (`mv`, `cp`, `robocopy`…)
y no sigue los `cd` (recibe `cwd` y no lo usa). La regla vieja miraba el texto entero y los frenaba.

```
P4 mover con cd adelante           base=escritorio-guard       nueva=pasa
P4 mover con find -exec            base=escritorio-guard       nueva=pasa
P4 mover con xargs                 base=escritorio-guard       nueva=pasa
P4 control: mv directo             base=escritorio-guard       nueva=escritorio-guard
```
Comandos (archivo `.../1- GENERAL/TAREAS CERRADAS/2026`, tarea en el Escritorio): `cd "<archivo>" && mv "<tarea>" .` ·
`find "<Escritorio>" -maxdepth 1 -name "2026-10-01*" -exec mv {} "<archivo>/" \;` · `ls -d "<Escritorio>/2026-10-01"* | xargs -I{} mv {} "<archivo>/"`.
Es exactamente lo que la regla cuida: la carpeta queda archivada sin fila en el listado. Arreglo: llevar el directorio
de los `cd` (como hace `escribeListadoBash`) y, si el verbo es `find`/`xargs`/`parallel` y alguno de sus argumentos es un
mover, aplicar la regla vieja sobre ese comando.

### 2. apqp-cliente (pieza 3): MOVER el listado maestro al TEMP pasa (lo saca del servidor)
`scripts/_lib/guardianes.mjs:2775-2789` (`escribeListadoBash`). `mv`/`move`/`Move-Item` reciben el mismo trato que `cp`:
si el listado es el ORIGEN y el destino es local, pasa. Para `cp` eso es leer; para `mv` es borrar el maestro del
servidor. Lo mismo `robocopy … /MOV`, que la rama trata como copia.

```
P3 mover el listado al TEMP        base=apqp-cliente-guard     nueva=pasa
P3 robocopy /MOV del listado       base=apqp-cliente-guard     nueva=pasa
P3 control: copiar al TEMP         base=apqp-cliente-guard     nueva=pasa      (el afloje pedido, correcto)
```
Comandos: `mv "Y:/BARACK/CALIDAD/DOCUMENTACION SGC/HOJAS DE OPERACIONES/3- LISTADO/Listado hojas de proceso.xlsx" "$TEMP/listado.xlsx"` ·
`robocopy "Y:/…/3- LISTADO" C:/tmp "Listado hojas de proceso.xlsx" /MOV`. Arreglo: el listado como origen de un MOVER
frena siempre (en robocopy, con `/MOV` o `/MOVE`).

### 3. apqp-cliente (pieza 3): copiar HACIA el listado con el destino en una variable de `$(…)` pasa
`scripts/_lib/guardianes.mjs:2782`. Si el destino no se resuelve, solo frena cuando el texto sin resolver ya trae el
nombre del listado. `resolvedorDe` deja sin resolver todo lo que sale de un `$(…)`, y `D="$(cygpath -u "…")"` es una forma
común en esta PC.

```
base=apqp-cliente-guard   nueva=pasa                 D="$(cygpath -u "Y:/BARACK/…/Listado hojas de proceso.xlsx")"; cp /c/tmp/nuevo.xlsx "$D"
base=apqp-cliente-guard   nueva=apqp-cliente-guard   cp /c/tmp/nuevo.xlsx "Y:/BARACK/…/Listado hojas de proceso.xlsx"
```
Arreglo: con el destino sin resolver y el listado nombrado en el comando, frenar (es la regla que ya usa
`mueveAMano`: «no se adivina»).

### 4. borrado-masivo (pieza 1): el detector de «el script lanza procesos» no ve cuatro formas comunes
`scripts/_lib/guardianes.mjs:1690` (`BM_LANZA`) y `:1750-1753`. `BM_LANZA` se busca solo en el código de AFUERA de las
cadenas, y la lista no tiene el método `.exec(` (lo excluye a propósito por el `.exec(` de las expresiones regulares), ni
una importación renombrada, ni `asyncio`. Cuando no ve el lanzamiento, el texto de una cadena de un script del scratchpad
(o de una sonda que nombra `guardianes.mjs`) se toma como DATO, y `:1835-1837` apaga V3 para ese Write: el script pasa y
después se corre por ruta, donde ningún guardián lo ve. La base frenaba todo Write con el patrón.

Demostrado con un patrón inocente en lugar del de borrado (la decisión `datoPosible` no depende del patrón), sobre un
archivo del scratchpad, con `borradosDelScriptSonDatoOTemporal(código, archivo, /HOLA/)`:
```
execSync importado por nombre      ¿lo toma como dato? false   (lo ve)
import por defecto + cp.exec       ¿lo toma como dato? true
exec renombrado                    ¿lo toma como dato? true    (import { exec as correr } … correr('…'))
import dinamico + cp.exec          ¿lo toma como dato? true
Python: asyncio                    ¿lo toma como dato? true    (asyncio.create_subprocess_shell('…'))
```
El nombre del módulo (`'node:child_process'`) va adentro de una cadena y por eso desaparece. Los ROJO del test usan solo
`execSync` por nombre. Arreglo: buscar el lanzamiento en el código ENTERO, cadenas incluidas (como ya hace
`v3SoloEnSondaPegada` con el código pegado), y sumar `\.exec\s*\(` cuando el script nombra `child_process`, y
`create_subprocess`, `pty.spawn`, `os.posix_spawn`.

### 5. secretos-guard (P12): `grep -r … --include=.env.local` lee el secreto y ya no frena
`scripts/_lib/guardianes.mjs:322-323`. Los argumentos que empiezan con `-` se descartan enteros, y el nombre del archivo
viaja pegado a la opción.

```
base=true   nueva=false  ls -la .env.local | head -3                         (el afloje pedido, correcto)
base=true   nueva=true   grep -n VITE_SUPABASE_URL .env.local
base=true   nueva=false  grep -rn VITE_SUPABASE_URL . --include=.env.local
```
El tercero imprime los renglones de `.env.local` que coinciden (el valor de la clave). Arreglo: en grep/rg/ag, mirar el
valor de `--include=`, `--include`, `-g`, `--glob`.

### 6. modelo-guard (pieza 12): la rama que niega en `PreModelSwitch` solo puede frenar el selector de Fak
`scripts/_lib/modeloGuard.mjs:30-45` (`sesionPidioElCambio`) y `:52-58`. El hook niega un cambio `sdk` si en el
transcript hay una llamada a `set_session_model` después del último mensaje de Fak, sin mirar a QUÉ sesión apuntaba. Pero
la app no deja que una sesión se cambie el modelo a sí misma: la descripción de la herramienta en
`app-2.42304.0\resources\app.asar` dice *"Refused for this session: a session must not silently re-price its own turns"*
y, del `session_id`, *"Must not be this session"*. O sea que un `sdk` en esta sesión nunca sale de esa llamada: si el hook
niega, lo que niega es el selector de la app que tocó Fak.

Caso: la madre intentó cambiarle el modelo a una hija (el PreToolUse nuevo lo frena, la llamada queda igual en el
transcript); antes de escribir de nuevo, Fak elige Fable para la madre en el selector:
```
PreModelSwitch de la MADRE, source sdk (el selector de la app): niega - el modelo de una sesion no se cambia por cuenta propia …
salida: {"exit":0,"stdout":"{\"hookSpecificOutput\":{\"hookEventName\":\"PreModelSwitch\",\"permissionDecision\":\"deny\", …
mismo caso con source picker: deja · command: deja
```
(`aud/pieza12.mjs`). El ROJO de `modeloGuard.test.mjs` arma una llamada con `session_id: 'x'` igual a la sesión que
cambia, que es justo lo que la app rechaza. Arreglo: en `PreModelSwitch` dejar pasar siempre `command`, `picker` y `sdk`
(el control real es el `PreToolUse` de `set_session_model`, que sí está bien), o contar solo una llamada cuyo
`input.session_id` sea el `session_id` del evento (hoy no puede pasar).

El 2 y el 3 son del mismo guardián y del mismo bloque: se arreglan juntos.

## ROBUSTNESS (no bloquean; conviene arreglarlas o dejarlas dichas)

**Pieza 9, permisos de un solo uso**
- La cita no se inventa (tiene que estar en el último mensaje real de Fak, con el filtro `mensajesDeFak`), pero alcanza con
  **cualquier pedazo de 2 palabras** de ese mensaje, sin límite de palabra y sin que sea un sí: con «mira el informe de la
  tanda y despues vemos», pasan `"de la"`, `"la tanda"` y hasta `"e la t"` (`permisoUnUso.mjs:87-95`; `aud/pieza9.mjs`).
  Sugerencia: comparar por palabras enteras, 3 como mínimo, y que la cita sea un renglón o una oración del mensaje.
- **Fak contesta por las opciones de una pregunta (AskUserQuestion)**: su respuesta va como `tool_result` y no cuenta. La
  cita «Si, cargala» frena (freno de más), y en cambio pasa citar el pedido de ANTES de la pregunta, aunque Fak hubiera
  elegido «No».
- Formas de armar que no ve (el control es nuevo; antes no había ninguno): `mv /tmp/x ~/.claude/.arb-cerrar-ok`,
  `cd ~/.claude && touch .arb-cerrar-ok`, `echo 30 > ~/.claude/./.agent-limit`. PowerShell (`New-Item … $HOME\.claude\…`) sí.
  Leer, listar, copiar desde y borrar un permiso pasan (bien).
- **Las instrucciones siguen diciendo que se arma sin cita**, así que el primer intento siempre frena: los textos de freno
  de `guardianes.mjs:2546` (espacio), `:2655` (arb), `:2867` (listado), `:2936` (nube personal), `agentes-guard.sh:360,408`, y
  las reglas `arb-no-cerrar.md:70,97`, `nube-ingenieria.md:51`, `techo-agentes.md:122-126,133`, `video-maquina.md:92`, más
  los skills `arb-operar/SKILL.md:33` y `pieza-nueva-flujograma-amfe/SKILL.md:228`.
- El canon se lee con `try/catch` (`permisoUnUso.mjs:28-31`): si `permisosUnUso.data.json` se rompe, el control se apaga sin
  avisar (falla abierto).
- La exclusión de `.encargo-libre` y `.agent-builtin-ok` está justificada por las reglas que cita (`coordinador.md:29`: el
  pase lo arma la sesión para un mensaje que no es encargo; `techo-agentes.md:80-82`: «lo escribo yo, lo digo, y lo retiro»).
  Es un desvío del plan (que nombraba `.encargo-libre`): lo tiene que saber Fak.

**Pieza 10, despachador para MCP**
- El matcher distingue mayúsculas y no admite guiones ni dígitos en el nombre de la herramienta: no entran
  `mcp__gmail__SendEmail`, `mcp__outlook__send-mail`, `mcp__whatsapp__send_message_v2`, ni `mcp__text-to-cad__generate`
  (una de las MCP que el plan nombra). Hoy no hay ninguna instalada; el comentario del settings ya dice que se agrega el
  verbo el día que se instala, pero conviene `(?i)`-equivalente (`[Ss]end`…) o una lista de servidores.
- Probado por el `_dispatcher.sh` real con 9 payloads (`aud/mcpPayloads.mjs`): envío por Gmail y Slack → 2; borrador,
  `create_branch`, `tool_input` nulo o con objetos → 0; ~200 ms cada uno. No revienta.

**Pieza 12 y pieza 9, costo con transcripts grandes**
- Con el transcript más grande de la PC (294 MB, `c66e2969`), `PreModelSwitch` tarda **14,2 s** y usa ~1,8 GB (lee el
  archivo dos veces; el hook tiene `timeout: 20`; si se pasa, sigue, o sea que no traba, pero hace esperar el cambio).
  `mensajesDeFak` solo: 7,3 s, y es lo que paga el despachador cada vez que un comando arma un permiso.

**Pieza 3, costo**
- `escribeListadoBash` corre en cada Bash y lee el script del TEMP o del scratchpad que el comando corre por ruta (hasta 200 KB),
  aunque el comando no nombre ningún listado: con uno de 195 KB, 1,8 → 24,8 ms por comando. Un `APQP_LISTADO.test` antes de
  leer no cambia el resultado (el código igual tiene que nombrar el listado) y ahorra la lectura.
- Un heredoc de 66 KB a python: 171 → 259 ms (medido con otra prueba corriendo en paralelo; orden de magnitud, no exacto).

**Pieza 1, por lectura de código (no se corrió)**
- `variablesTemporales` marca una variable como temporal si alguna vez se le asignó un `mkdtemp`: una reasignación posterior
  o un parámetro de función con el mismo nombre quedan como temporales.

**Pieza 5**: `cat >> nota.md > otro.py <<EOF` cuenta como agregar prosa aunque el contenido vaya al `.py` (la última
redirección gana). Es un control de costo, no de seguridad; se deja dicho.

**Pieza 11**: «el de mails» se leyó como el despachador de las MCP; el despachador de Bash/Write (donde corre el mail-guard de
`_mailEnviar.py`) no lleva `onFailure`. La razón que da el commit (un timeout trabaría todo) es razonable, y ese despachador
ya frena solo con exit 2 cuando el módulo no carga. Lo decide Fak.

## FALSE POSITIVE (sospechas descartadas al correrlas)
- `$(mktemp -d)` + `..`: `borradosPermanentesFueraDeEfimero` normaliza la ruta antes de comparar; subir del TEMP sigue
  frenando. Con `-p`, `--tmpdir=` o una plantilla con barra, `mktemp` no se resuelve (queda como antes).
- Pieza 6: el pedido de envío por `_mailEnviar.py` se sigue viendo directo, con `cd` adelante, en un `.sh` escrito por heredoc
  y corrido en el mismo comando, con la ruta en una variable y por `bash -c` (`aud/pieza6.mjs`). Solo deja de verse en el
  texto de un `sed` (el afloje pedido).
- Pieza 7: la copia real del teléfono usa `CopyHere`, que está en las dos listas (teléfono y copiar): partir por `;` no la
  separa. El test lo prueba también en varios renglones.
- La medición con Write recortados: los 64 Write/Edit de `frenos_bruto4.jsonl` traen el contenido entero (`contentHead` =
  `contentLen` en los 64).
- Imports nuevos (`./permisoUnUso.mjs`, `mensajesDeFak`): `node --check` pasa, el módulo carga por el despachador real, y
  `permisoUnUso.mjs` entra en el carril de auto-reparación (se lee del `from './…'` de `guardianes.mjs`).

## C. settings.json contra Claude Code 2.1.299 (leído del ejecutable)
- JSON válido; los 17 hooks cableados apuntan a archivos que existen (ninguno a `dev-server-guard` ni a `timeoutGuard`).
- `onFailure`: el esquema es `["continue","block"]`, vale para hooks de comando y http; con `block`, *"the failure counts as
  exit code 2"* cuando el hook no arranca, se pasa de tiempo, sale con algo que no es 0 ni 2 o imprime JSON inválido; se
  ignora en async y en Stop/SubagentStop/TaskCompleted/TeammateIdle. `mcp-write-gate.sh` solo sale con 0 o 2: no frena de más.
- `PreModelSwitch`: existe; entrada `from_model, to_model, requested_model, source, context_tokens`; *"Exit code 0 - switch
  proceeds; JSON permissionDecision allow/deny/ask as for PreToolUse"*. La salida del hook es la correcta.
- El matcher MCP compila como expresión regular y deja afuera las internas de la app, `execute_sql` y `apply_migration`
  (`aud/settingsCheck.mjs`).

## F. La medición
`node scripts/_frenosMedir.mjs --base <base>/scripts/_lib/guardianes.mjs --casos` da lo mismo que el documento:
F 51 (medibles 51: 38 → 8), V 71 (49: 43 → 43), SD 141 (86: 72 → 65), script-inline 6/165/2 → 0/165/0, 45 cambios, todos
aflojes, 9 «a mirar», con el detalle por guardián que lista el documento. Además corrí el diferencial con TODOS los
guardianes de cada payload (no solo el del freno, `aud/medirTodo.mjs`): el único que frena algo que antes pasaba es
`permiso-un-uso-guard` (6), como dice el documento. El script compara bien (misma entrada a las dos versiones,
`marcar:false`, `escapes:false`, HOME de prueba). Lo que no puede ver, y el documento no lo dice: los cinco agujeros de las piezas 1, 3, 4 y P12
no están en los 436 frenos (ninguna de esas formas aparece en los 30 días), por eso la medición sale limpia. Una medición
diferencial sobre frenos pasados muestra lo que se destraba, no lo que se abre.

## G. Tests
- Los 10 archivos de la tanda: 466 de 466 (`npx vitest run …`, 66 s). Los casos chequean el texto del freno de su guardián
  (no pasan en verde por otro guardián).
- Faltan los ROJO de los agujeros de arriba: `cd`/`find -exec`/`xargs` en `escritorioGuard.test.mjs`; `mv`/`robocopy /MOV` y
  destino en `$(…)` en `apqpClienteGuard.test.mjs`; las cuatro formas de lanzar en `borradoMasivoGuard.test.mjs`;
  `--include=` en la P12 de `guardianes.test.mjs`; y en `modeloGuard.test.mjs` el ROJO tiene que usar otra sesión de
  destino (con el arreglo, pasa a VERDE).
- Carpeta `__tests__/scripts` entera: 4.628 pasan, 22 saltados, 1 falla: `xlsxComparar.test.mjs` («una hoja agregada o
  quitada…», 15.810 ms contra el tope de 15.000, con otras pruebas corriendo). Corrido solo: 13 de 13. La rama no toca ni ese
  test ni `_xlsxComparar.py`: es un corte por tiempo de la PC, no del cambio.

## Archivos de la prueba (scratchpad de esta auditoría, carpeta `aud/`)
`arnes.mjs` (base contra rama), `settingsCheck.mjs`, `binBuscar.mjs`/`binBuscar2.mjs` (ejecutable y app.asar),
`mcpPayloads.mjs`, `medirTodo.mjs`, `piezas34.mjs`, `p3b.mjs`, `pieza1.mjs`, `pieza2.mjs`, `pieza6.mjs`, `pieza9.mjs`,
`pieza12.mjs`, `tiempos.mjs`, `tiempoModelo.mjs`; la base en `aud/base` (`git archive c157b9f9`).
