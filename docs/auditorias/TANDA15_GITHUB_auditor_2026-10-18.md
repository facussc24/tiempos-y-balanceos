# Auditoría de la tanda 15 — GitHub oficial de Anthropic y la comunidad (rama `claude/tanda15`)

18/10/2026 · agente `auditor` · worktree `C:\Dev\BarackMercosul\.claude\worktrees\tanda15`, 6 commits sobre main
`f5551eb6` (`bf5a6573` a `51fdfbe3`; 6 adelante, 0 atrás, árbol limpio, sin pushear por encargo). Primera ronda.

## Veredicto: FUNDIR CON ARREGLOS · 2 Importante, 3 Nit (y 7 nits más contados), 1 Preexistente

El arreglo de `mcpComoHerramienta` (pieza 1) cierra el agujero que buscaba: el código de consola que corre una MCP
ahora lo ven los guardianes. Pero abre otro: le cree al `language` que trae la llamada, y una MCP que corre Python y
descarta ese argumento (build123d, la que está instalada en esta PC) deja de mostrarle su código Python a dos
guardianes (I1).

El chequeo «antes de fundir» que esta tanda sube a regla always-on (I2) corre el despachador real con el HOME de Fak.
Dos de sus seis pedidos escriben el listado maestro, así que si Fak dejó un permiso de un solo uso para cargarlo, el
chequeo se lo gasta.

Los dos arreglos son chicos y van antes de fundir. Lo demás (destrabe, avisos de humanizer, open-steps, los documentos)
está bien hecho y medido. Lo que encontré son detalles.

> **Efecto de esta auditoría en la PC, para la sesión principal.** Hoy, antes de las 12:03, corrí una vez el despachador de
> **main** con el HOME real (sin aislar) sobre una entrada que guarda el listado maestro. Dio **exit 0**. La misma
> entrada, después y con el mismo HOME, da exit 2. El único camino que abre ese freno es `~/.claude/.apqp-listado-ok`,
> y el guardián lo **borra al usarlo** (`guardianes.mjs:3153-3157`). Así que **muy probablemente gasté un permiso de un
> solo uso** que Fak había dejado para cargar una fila. No quedó rastro: el despachador no lo anota, el registro
> `~/.claude/.permisos-un-uso.log` no muestra que nadie lo armara hoy, y yo había tirado la salida a `/dev/null`.
> Si alguna sesión estaba por cargar una fila del listado con el sí de Fak, va a quedar frenada y necesita su sí de
> nuevo. No lo volví a armar: no me toca. Desde ahí, todas mis corridas del despachador fueron con HOME aislado.

| Chequeo | Estado | Detalle |
|---|---|---|
| TypeScript | OK | `npx tsc --noEmit`: 0 errores |
| Build | OK | `npm run build`: built en 57,7 s (solo el aviso de siempre: hay pedazos de más de 500 kB) |
| Git local | OK | 0 archivos sin commitear en el worktree |
| GitHub sync | No aplica | la rama no se pushea por encargo; main = `f5551eb6` |
| CI | OK | `candado.yml` completed success `f5551eb6` (el HEAD de main) · `deploy.yml` completed success `411f200f` |
| Dependencias | OK | `npm ls --depth=0`: 0 renglones con UNMET, ERR o missing |
| `node --check scripts/_lib/guardianes.mjs` | OK | sin errores |
| Despachador con los 6 pedidos conocidos | OK | worktree y main `exit: 2 2 2 2 0 0`, con el HOME real (`payloads.sh`, al arrancar) y con HOME aislado (al final). Ver I2: con el HOME real el chequeo puede gastar un permiso |
| Tests | OK | `npx vitest run --pool=threads` con mcpDespachador, guardianes, disparoSkills y firmaIASelftest: 4 archivos, 207 tests en verde |
| Selftest del detector | OK | `python scripts/_sinFirmaIA.py --selftest`: «todo verde (47 casos)» |
| Nada se instaló | OK | `claude plugin list`: 32 renglones, 4 plugins instalados (presupuesto-agentes, recordatorio-temas, rust-analyzer-lsp, tablero-casa) + 1 sincronizado de claude.ai (cowork-plugin-management), lo mismo que dice el documento |

Lo que no se tocó: Supabase, el arb, Y:, Outlook y la API paga. Las pruebas contra guardianes solo **evaluaron**
llamadas (`evaluar()` y `_dispatcher.sh` con el JSON por la entrada): no se ejecutó ningún código de ninguna MCP. Los
scripts de la auditoría quedaron fuera del repo, en `%TEMP%\aud15\` (`atacar_mcp.mjs`, `alcance_mcp.mjs`,
`gen_casos.mjs`, `extra_arg.py`, `bloquear_red.mjs`, `medir_humanizer.py`, `exports_humanizer.py`,
`preexistentes.mjs`).

---

## Importante

### I1 · TRUE BUG · `scripts/_lib/guardianes.mjs:180-181` — con `language: 'bash'`, el código Python de una MCP que corre Python pasa sin que lo vean `apqp-cliente-guard` ni `mail-guard`

**Qué pasa.** El renglón 180 decide «es de consola» por lo que dice el argumento `language` (o `lang`, `runtime`) de
la llamada, sin mirar si esa MCP lo usa. Si dice `bash`, el renglón 181 le pasa el código crudo a los guardianes, sin
el `python - <<'CODIGO_MCP'` alrededor. Hay guardianes que reconocen el código Python **por ese envoltorio** (el de
listados maestros y el de mails, que buscan lo que corre un intérprete). Sin el envoltorio no lo ven.

**Por qué el código corre igual.** La MCP de build123d está instalada (`C:\Dev\BarackMercosul\.mcp.json`:
`uvx build123d-mcp==0.3.83`). Su herramienta es `execute(code: str)` (`server.py:358` del paquete), y el SDK que usa
(mcp 2.3.0, `func_metadata.py:96-112`) arma el modelo de argumentos sin prohibir los de más. Medido con ese mismo
SDK, sin llamar al servidor (`%TEMP%\aud15\extra_arg.py`):

```
acepta language de mas: {'code': 'print(1)'}
schema additionalProperties: (no dice: se permite)
```

O sea: `mcp__build123d__execute {code: <python>, language: 'bash'}` corre el Python, y el `language` se tira en
silencio. Su nombre entra al despachador por el verbo `execute` del matcher de `.claude/settings.json:38`.

**Reproducción** (el despachador real, `bash .claude/hooks/_dispatcher.sh` con el JSON por la entrada,
`CLAUDE_PROJECT_DIR` de cada checkout y **HOME aislado** en una carpeta temporal vacía con `.claude/` adentro). Las
dos entradas de `tool_input`, sin pegar el código acá (los textos se arman en `gen_casos.mjs`):

- LISTADO: `code` = Python con openpyxl que guarda un libro en la carpeta `3- LISTADO` de hojas de proceso de Y:, con
  el nombre del listado maestro.
- MAIL: `code` = Python que abre Outlook por COM, crea un ítem y lo manda.

| Entrada | main | worktree |
|---|---|---|
| LISTADO sin `language` | exit 2, `[APQP-CLIENTE] BLOQUEADO` | exit 2, `[APQP-CLIENTE] BLOQUEADO` |
| LISTADO con `language: 'bash'` | exit 2, `[APQP-CLIENTE] BLOQUEADO` | **exit 0** |
| MAIL sin `language` | exit 2, `[MAIL-GUARD — BLOQUEO` | exit 2, `[MAIL-GUARD — BLOQUEO` |
| MAIL con `language: 'bash'` | exit 2, `[MAIL-GUARD — BLOQUEO` | **exit 0** |

Lo mismo con `evaluar()` (`alcance_mcp.mjs`, contra cada checkout): en el worktree, `language: 'bash'` pierde
`apqp-cliente-guard` y `mail-guard`; `borrado-masivo-guard` y `firma-ia-guard` se mantienen.

**Ojo al repetirlo.** Con el HOME real, el despachador de **main** dio una vez exit 0 en el LISTADO: muy probablemente
porque consumió un permiso de un solo uso (ver el recuadro de arriba y I2). Sin aislar el HOME parece que la regresión
no existe. Es falso: con HOME aislado, main frena siempre.

**El test que falta.** `__tests__/scripts/mcpDespachador.test.mjs:138-165` prueba el rojo de «consola que se declara
consola» y el verde del `ls`, pero no la dirección que se afloja: una MCP de Python con `language` de consola. REVIEW.md
§1: un control que afloja sin test en las dos direcciones.

**Arreglo sugerido** (lo decide la sesión principal). Cuando `language` diga consola, que los guardianes vean **las
dos lecturas** del código, cruda y envuelta en Python, y se junten los frenos. Lo que corre por consola se sigue
viendo como comando, y un Python que miente sobre su lenguaje no se esconde. Otra opción es aplicar la lectura de
consola solo a las MCP que de verdad usan el argumento (hoy, `ctx_execute` de Context Mode), pero eso obliga a
mantener una lista. Con cualquiera de las dos, sumar dos rojos al test: `mcp__build123d__execute` con
`language: 'bash'` y el guardado del listado (frena `apqp-cliente-guard`), y lo mismo con el envío por Outlook (frena
`mail-guard`).

**En el mismo renglón, ROBUSTEZ (no hay ninguna MCP así instalada).** La lista del renglón 180 no reconoce
`powershell.exe`, `cmd.exe`, `bat` ni `shellscript`, y no mira la clave `languageId`, que es la de las MCP tipo
«code-runner» (`languageId: 'shellscript'`). Con cualquiera de esas, un `git commit` sin rutas sigue pasando
envuelto en Python como antes del arreglo (`atacar_mcp.mjs`, sección 1 y 1b: `[]`). Si se hace la doble lectura de
arriba, esto deja de importar para los frenos que ya miran el texto crudo.

### I2 · ROBUSTEZ · `.claude/rules/codigo-madre.md:38-39` y `docs/DESTRABE_GUARDIAN_ROTO.md` («Para no llegar a esto») — el chequeo «antes de fundir» gasta los permisos de un solo uso de Fak

**Qué pasa.** El párrafo nuevo de la regla (always-on) manda correr «el despachador con los seis pedidos de
`__tests__/scripts/despachadorPayloadsConocidos.jsonl`» antes de fundir algo que toque los guardianes o un hook. No
dice con qué HOME. Corrido como lo corre `payloads.sh` (el despachador real, `bash .claude/hooks/_dispatcher.sh`, con
el HOME de Fak):

- Los pedidos 2 y 3 escriben el listado maestro. Medido con HOME aislado: los dos dan exit 2 con
  `[APQP-CLIENTE] BLOQUEADO: estas por escribir en un LISTADO MAESTRO`.
- Si en ese momento existe `~/.claude/.apqp-listado-ok`, `apqp-cliente-guard` lo **borra** y deja pasar
  (`guardianes.mjs:3153-3157`).
- El despachador no le pasa `escapes: false` a los guardianes (`grep escapes .claude/hooks/_dispatcher.sh`: nada), así
  que el consumo corre.

**Resultado.** Salen dos cosas a la vez:
- un falso «se rompió el guardián» («2 0 2 2 0 0»);
- el sí de Fak para una carga real, gastado en una prueba.

Es lo que muy probablemente me pasó a mí hoy (recuadro de arriba). Los permisos de un solo uso se arman solo con su
cita (`permiso-un-uso-guard`), así que reponerlo es volver a pedirle el sí. Con la regla nueva, este chequeo lo van a
correr todas las sesiones que toquen guardianes.

**Arreglo sugerido.** Escribir en la regla (y en `payloads.sh`, si se queda como herramienta) que el chequeo va con HOME
aislado: `HOME=$(mktemp -d)` con `mkdir -p $HOME/.claude` delante del `bash _dispatcher.sh`. Los seis pedidos dan lo
mismo (2 2 2 2 0 0, medido con HOME aislado en los dos checkouts) y ningún permiso real se toca. La memoria del
auditor ya lo decía para los arneses (`gates_y_enforcement_code.md:352`, «Harness sin tocar `~/.claude` real»).

---

## Nit (3)

### N1 · ROBUSTEZ · `scripts/_lib/firmaIA.data.json:31` — `humanizer-titulo-emoji` no compila en JS

El rango literal `[🌀-🫿]` funciona en Python, pero en JS sin la bandera `u` el rango queda entre medias de pares
sustitutos. Compilado como lo hacen los dos lectores JS de la casa (`new RegExp(re, 'i')`, `firmaIA.mjs:17-19` y
`flujogramaCanon.mjs:36-38`):

```
NO COMPILA en JS humanizer-titulo-emoji flags i -> Invalid regular expression: /(^|\n)\s*[🌀-🫿]/i: Range out of order in character
```

Hoy no rompe nada: `flujogramaCanon.mjs` filtra los dos ids que usa antes de compilar y `firmaIA.mjs` solo compila
`bloqueante` (los dos cargan bien, medido). Pero el canon es «una sola fuente que leen Python y Node»: el primer
módulo JS que compile todos los avisos se cae al cargar. Sugerido: un test que compile el canon entero con las
banderas de JS, o marcar esa entrada como solo de Python.

### N2 · ROBUSTEZ · `scripts/_lib/firmaIA.data.json:26` y `:28` — dos avisos saltan con frases que Fak escribe

Medido con el canon del worktree sobre texto escrito por personas (`medir_humanizer.py`, el hilo citado cortado):

| Corpus | Textos | Con aviso humanizer |
|---|---|---|
| Mails enviados por Fak (`.mail-cache`) | 1.688 | 4: 2 con «no dudes en …», 1 con «cabe destacar», 1 con un emoji a principio de renglón (las frases y fechas exactas se sacaron al commitear: el contenido de los mails no va al repo público) |
| Mails recibidos (planta, clientes, proveedores) | 4.477 | 22: 15 emojis de avisos automáticos, 5 «cabe destacar / resaltar», 1 «no dudes en …», 1 «no es solo X, sino …» |
| Documentos del SGC en texto (`.sgc-cache`: sgc, empresa-extracted, sgc-servidor, emitidos-respaldo) | 675 | 5: «Es importante resaltar» en el manual de AMFE de la casa (`07-AMFE-FMEA-de-proceso-CM-Revision02`), «crea sinergias» en Formel Q, y 3 más en normas |
| `exports/` con el detector real (`exports_humanizer.py`) | 789 | 1, en un texto en inglés de Bambu (`impresion_3d\fuentes_bambu\plates.txt`, «👇Click») |

La última fila confirma la medición del autor (0 avisos en los entregables de Barack). Pero el `que` de
`humanizer-palabras` dice «van las de Fak», y «Cabe destacar» y «no dudes en consultarme» **son** de Fak. El impacto es
bajo, y conviene decirlo: estos avisos solo salen al correr `python scripts/_sinFirmaIA.py <archivo>` a mano. El
cierre corre el detector con `--sin-avisos` (`cierreGuard.mjs:1467`), y mandar un mail o imprimir filtran a 4 ids
(`_mailEnviar.py:108`, `firmaIA.py` `exigir_sin_firma`). O sea, el «Hecho» del ítem 17 no se le muestra a nadie
solo. Sugerido: sacar «cabe destacar / resaltar» y «no dudes en» de la lista, o dejarlos y corregir el `que`.

### N3 · TRUE BUG (dato) · `docs/DESTRABE_GUARDIAN_ROTO.md:42` — «no hay `settings.local.json`» es falso en la PC principal

`C:\Dev\BarackMercosul\.claude\settings.local.json` existe: 394 bytes, del 14/10, ignorado por git
(`.gitignore:41`). Sus claves son `permissions`, `skillOverrides` y `enabledMcpjsonServers`, y no tiene
`disableAllHooks`, así que **la conclusión se sostiene**: hoy nada le gana al `true` del usuario. La frase viene del
informe E (§2, medido el 15/10) y en el worktree no hay ese archivo; en el checkout donde abre Fak, sí. Corregir la
frase y decir que es justo el archivo que más manda de los tres. Si algún día trae `"disableAllHooks": false`, el
destrabe del Bloc de notas no anda.

**Y 7 nits más** (contados, sin detalle):

- títulos y números de test en `disparoSkills.test.mjs:372`;
- un número de renglón citado en `TANDA15_GITHUB:74`;
- tres citas de ítem de informe corridas en `REVISAR_ANTES_DE_INSTALAR.md:3`, `:16` y `AUTOMATIZACION_PEDRO:72` (son §7 y §8 de E y la tabla §2 de F);
- un parafraseo en `TANDA15_GITHUB:167`: el informe dice «acción **o justificación**»;
- la alternativa WSL de text-to-cad, que el informe F nombra y la ficha no;
- 3 de los 9 avisos sin caso rojo en el selftest (`arranque`, `frase-profunda`, `titulo-emoji`; los tres saltan, medido);
- en `DESTRABE_GUARDIAN_ROTO.md:10`, «todavía puede editarlo» vale solo cuando el módulo no carga (`_dispatcher.sh:85-119`), no cuando carga y frena todo.

---

## Preexistente (no se le carga al autor)

### P1 · `secretos-guard`, `push-guard`, `borrado-masivo-guard`, `commit-rutas-guard` — el Python que llega por heredoc

Por Bash, `python - <<'X'` con un `print(open(<ruta del .env.local>).read())` adentro da **exit 0** en el despachador
de **main** (HOME aislado, `p_heredoc_env.json`). La misma lectura como `python -c` sí frena (`secretos-guard`). Con
`evaluar()`, en main y en el worktree por igual, tampoco frenan dentro de un Python por heredoc (o por una MCP sin
`language`, que es lo mismo):

- un push forzado por `os.system`;
- un commit por `subprocess`;
- un borrado en bucle con `os.remove` sobre `exports/`;
- una escritura con `open()` en la nube personal.

Ninguno sale de esta tanda. Lo anoto porque la ficha de Context Mode recomienda «solo para leer, nunca para
ejecutar», y esto dice que esa recomendación es la que protege, no el despachador.

### Pregunta (no es hallazgo: no pude verificar que exista la herramienta)

Si alguna MCP manda los comandos como lista de objetos (`commands: [{label, command}]`), `mcpComoHerramienta` la tira
entera: medido, `{"tool":"Write","cmd":"","file":"","content":""}`. El informe F solo nombra `ctx_execute` de
Context Mode. Si se instala, mirar antes si trae una herramienta de varios comandos.

---

## Lo atacado que salió limpio (FALSO POSITIVO)

- **Pieza 1, variantes de `language`**: «Shell», « PowerShell » (con espacios), «SH», «pwsh», «ps1», «cmd», «batch»
  y «zsh» se reconocen, y el commit sin rutas frena. `language` como lista (`['bash']`) también. Un objeto, un
  número o `null` caen en Python, como antes.
- **Pieza 1, la otra dirección para el código de consola**: nada que frenara antes deja de frenar. El borrado y el
  push forzado frenan con y sin `language`. Ahora frenan además el commit sin rutas, el `cat` del archivo de claves y
  el `cp` al listado de Y:, que antes pasaban envueltos. El `ls` sigue libre.
- **Pieza 4, open-steps no llama a nada**: con la red bloqueada por precarga (`bloquear_red.mjs`: fetch, http, https,
  net y tls tiran error y lo anotan) y sin `ANTHROPIC_API_KEY`, `--open-steps explicar-mejor` dio exit 0, 0 intentos
  de red, 25 frases + 3 ajenas, 252 llamadas contadas. Desde el worktree encontró registros (usa el checkout
  principal). `--simular` desde el worktree lee «0 mensajes de Fak en 30 dias (0 archivos)», como dice el documento.
- **Pieza 2, destrabe**:
  - `claude --version` = 2.1.302 y `CLAUDE_CODE_EXECPATH` = `C:\Users\FacundoS-PC\.local\bin\claude.exe`.
  - `claude --help` lista `--safe-mode` («CLAUDE.md, skills, installed plugins, hooks, MCP servers… disabled… Sets
    CLAUDE_CODE_SAFE_MODE=1»).
  - El ejecutable trae «hooks are turned off in your settings (disableAllHooks)» y «the session runs in safe mode»
    (son motivos de mods apagados, como dice el documento).
  - El `settings.json` del usuario arranca con `{` y una clave en el renglón 2: el renglón con coma que dice el paso 3
    deja un JSON válido.
  - No hay configuración administrada (`C:\Program Files\ClaudeCode`, `C:\ProgramData\ClaudeCode`).
  - El carril de auto-reparación existe (`_dispatcher.sh:85-119`).
  - El usuario `catav` de CATA sale de `.claude/pcs/CATA.md:1`.
- **Pieza 5, la tarea de los viernes no se tocó**: `~/.claude/scheduled-tasks/borrador-mail-pedro-automatizacion/SKILL.md`
  es del 17/10 20:26, sigue pidiendo menos de 585 caracteres y no tiene nada del 3P.
- **Pieza 5, datos de las fichas**: las 9 cantidades de estrellas, licencias y fechas coinciden con los informes E y F.
  También coinciden R28 / R21, Elastic License 2.0, Smart App Control, el `reviewed_commit` y «un resultado limpio no
  es una auditoría» (E §7). Las citas de código existen: `register.mjs:96` `$.clock.every`, `horaGuard.mjs:233`
  `latidoVivo`, `no_es_de_fak` en `correccionCanon.data.json`. `which python3`: nada. Ningún hook escribe
  `<system-reminder>` (solo lo leen y lo sacan). La app 2.42304.0 está instalada
  (`AppData\Local\AnthropicClaude\app-2.42304.0`). El renglón nuevo del contrato de autonomía no choca con ninguno
  existente.
- **Pieza 3, el regex**: los 9 compilan en Python con `re.IGNORECASE` y recorrieron 6.165 mails y 789 documentos sin
  colgarse. `\b` de Python entiende tildes.

## Acciones requeridas

1. **Antes de fundir**:
   - el arreglo de I1, con sus dos rojos (MCP de Python con `language: 'bash'`: listado y mail);
   - el de I2: HOME aislado en el párrafo de `codigo-madre.md` y en `payloads.sh`;
   - repetir `node --check` y los seis pedidos **con HOME aislado** (2 2 2 2 0 0).
2. **Ya, aparte del merge**: si alguna sesión esperaba cargar una fila del listado maestro con un permiso de un solo
   uso, ese permiso muy probablemente lo gasté yo (recuadro del principio). Pedirle a Fak el sí de nuevo; no lo armé.
3. Al gusto de la sesión principal: N1 (test que compile el canon con banderas de JS), N2 (sacar o reescribir dos
   avisos), N3 (corregir la frase del destrabe).
4. **Memoria del auditor**: las dos entradas nuevas quedaron en la carpeta del worktree, que está fuera de git
   (`.gitignore:41`) y se pierde con el worktree. La memoria que vale es la de `C:\Dev\BarackMercosul\.claude\agent-memory\auditor\`:
   conviene pasarlas ahí (`gotcha_despachador_home_aislado.md`, `gotcha_mcp_argumentos_de_mas.md`).
5. **Para Fak, al fundir** (salida de `node scripts/_probarMejora.mjs --sesiones`, «RESULTADO: sin fallas»): el
   guardián lo toman solas las sesiones abiertas en segundos, **una vez que llegue a `C:\Dev\BarackMercosul`**;
   `codigo-madre.md` y `autonomy-contract.md` no tienen `paths:`: **hay que reabrir las sesiones** para que las tomen.

Respuesta del autor al lado de cada hallazgo (arreglado / rechazado / a propósito / no importa):
I1 ____ · I2 ____ · N1 ____ · N2 ____ · N3 ____ · P1 ____
