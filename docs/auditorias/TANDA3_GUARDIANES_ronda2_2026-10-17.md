# Tanda 3 — guardianes que frenan de más: ronda 2 (17/10/2026)

La sesión madre revisó a contrapelo la punta `f660b7f3` de la rama `claude/guardianes-tanda3`: tres revisores y un
escéptico que intentó refutar cada hallazgo corriendo comandos por el despachador de la rama y por el de la base. Quedaron
**9 hallazgos importantes**. Esta ronda los arregla, uno por commit, cada uno con su caso ROJO en el test. Los VERDES que ya
estaban siguen pasando.

Cómo se reprodujo cada uno: los comandos de la descripción del escéptico (encargo `E261017-32fe`), pasados por
`evaluar()` de las dos versiones de `scripts/_lib/guardianes.mjs` (la base `c157b9f9` y la rama), sin ejecutar nada y con
un HOME de prueba. El archivo de casos del escéptico no vino con el encargo; los comandos se armaron desde su descripción.
Dos formas (Z09, T03) ya frenaban en la rama tal como las armé; las del escéptico que no frenaban (Z11, T01, T02) sí se
reprodujeron y son las que quedaron en el test.

## Los 9 hallazgos

| N.º | Guardián | Qué pasaba en la rama (la base lo frenaba) | Qué se cambió | Commit | El ROJO |
|---|---|---|---|---|---|
| 2 | apqp-cliente | `Copy-Item` / `Move-Item` / `cp` del listado adentro de `powershell -Command`, `pwsh -c` o un heredoc a `bash` pasaban | lo pegado a una shell y el heredoc que alimenta a una shell se vuelven a mirar con `escribeListadoBash` (tope de profundidad 3) | `4ae87105` | `apqpClienteGuard.test.mjs`, «ronda 2, hallazgo 2» (4 rojos y el verde de copiar para leer) |
| 3 | apqp-cliente | `robocopy /c/tmp "<carpeta del listado de AMFE>" Listado_Maestro_AMFE.xlsx` pasaba: `/c/tmp` se tiraba como switch | un switch de robocopy es solo `/X` o `/X:valor` | `30d1411f` | «ronda 2, hallazgo 3» (2 rojos y el verde de traerlo para leer) |
| 4 | secretos | `(cd … && cat .env.local)`, `(head -3 .env.local)`: el `)` quedaba pegado al nombre | el argumento se compara sin `)` o `}` del final | `1078cea0` | `guardianes.test.mjs`, «P12 ROJO (ronda 2, hallazgo 4)» |
| 5 | secretos | `ls .env.local \| xargs cat`, `find … -exec grep … {} +`, ``cat `echo .env.local` `` pasaban | la primera palabra CRUDA decide xargs / find / parallel con un lector o un grep/sed/awk; un backtick es algo sin resolver | `a6d7867f` | «P12 ROJO (ronda 2, hallazgo 5)» |
| 6 | secretos | `diff <(cat .env.local) …`, `echo "print(open('.env.local')…)" \| python` pasaban | `<( )` y `>( )` se desarman como sustitución; un intérprete que lee su programa de stdin frena si el comando nombra el secreto | `dc7de4cc` | «P12 ROJO (ronda 2, hallazgo 6)», con dos VERDES (`diff <(sort a) <(sort b)`, `echo "print(1)" \| python`) |
| 7 | escritorio | el archivo de cerradas en una variable de `$(cygpath …)` o de un `for`, `--target-directory=`, `cp -rt` pasaban | `--target-directory=` y una `-t` pegada son destino explícito; lo que no se resuelve se mira contra el comando entero | `cd90c32e` | `escritorioGuard.test.mjs`, «8e. ROJO (ronda 2)» |
| 8 | borrado-masivo | la variable de `mkdtemp` reasignada (`d = r'Y:/…'`) o usada como parámetro de un ayudante (`def limpiar(d)`) seguía contando como temporal | una variable es temporal solo con UNA asignación y si no es parámetro (def, function, flecha, lambda) ni variable de un for o un with | `34277a80` | `borradoMasivoGuard.test.mjs`, «ronda 2, hallazgo 8» (Python reasignada, Python ayudante, JS ayudante) |
| 16 | despachador MCP | `mcp__build123d__execute {code: "shutil.rmtree(r'Y:/…')"}` entraba al despachador y nadie lo miraba | `code` (o `source`) de una MCP se mira como un `python -` con ese código; script-inline no mide el largo del código de una MCP | `0d17a246` | `mcpDespachador.test.mjs`, «ROJO (ronda 2, hallazgo 16)» y su VERDE (un modelado largo pasa) |
| 17 | modelo-guard | el PreToolUse de `set_session_model` frenaba el paso 4 del camino B de `lanzar-sesion-hija` (poner a una hija en Opus) | decisión de la madre: deja pasar si el destino es OTRA sesión y el modelo es `claude-opus-5-5`; otro modelo hacia otra sesión, o sobre la misma, sigue pidiendo la frase de Fak | `0ac93168` | `modeloGuard.test.mjs`, «VERDE (ronda 2) madre → hija en Opus 5.5» y «ROJO (ronda 2) hija en Fable sin frase» |

Decidido distinto de lo propuesto, con el motivo:
- **16**: la propuesta era leer `code` «como comando, igual que `command`». Lo puse como el cuerpo de un `python -` en un
  heredoc: el código de build123d es Python, y así lo leen los guardianes como código pegado (el mismo camino que un
  `python -c`), no como una línea de shell. Y script-inline deja de medirlo: en una MCP el código ES el pedido, y sin eso un
  modelado largo quedaba frenado por tamaño.
- **17**: acepto solo el nombre exacto `claude-opus-5-5`, no el alias `opus`, para no ampliar la decisión de la madre.
- **2**: la recursión sigue también `cmd /c`; desde Git Bash el `/c` se convierte en `C:/` y esos casos no corren tal como
  están (lo dijo el escéptico): quedan cubiertos igual, sin test propio.

## Detalles chicos que entraron

- **9** (`6a2466e8`): borrado-masivo cuenta también `system(` importado, `eval(`, `new Function`, `import_module` y
  `__import__` como formas de lanzar procesos (dos ROJO más en el test del hallazgo 4 del auditor).
- **31** (`18083e9e`): `_frenosMedir.mjs` cuenta por freno los guardianes que frenan con la nueva y no con la base.

No entraron (quedan para otra tanda, con lo que falta):
- **10**: no resolver `$(mktemp)` al TEMP cuando el mismo comando cambia `TMPDIR`; y `__pycache__` como carpeta de arriba.
- **12**: la excepción de `>>` / `tee -a` de script-inline mira la extensión del primer destino; mirar todos y no eximir si
  el mismo comando corre o renombra ese archivo.
- **24**: los textos que muestran el permiso sin la cita en `agentes-guard.sh` (hook global: hay que cambiar la copia
  instalada y la del repo a la vez, o falla `hooksTienenTest` 5b), en reglas (`arb-no-cerrar.md`, `nube-ingenieria.md`,
  `techo-agentes.md`, `video-maquina.md`) y skills, y los comentarios que todavía nombran a los hooks retirados.

## La medición después de la ronda

`node scripts/_frenosMedir.mjs --base <git archive c157b9f9>/scripts/_lib/guardianes.mjs --casos`: la misma tabla que antes
(51 falsos: 38 → 8 frenan; 49 verdaderos repetibles: 43 → 43, ninguno dejó de frenar; sin determinar 72 → 65;
script-inline 6 / 165 / 2 → 0 / 165 / 0). Guardianes que frenan de más sobre los 436: solo el de permisos, 6. Detalle en
`TANDA3_GUARDIANES_medicion_2026-10-16.md`.

## Tests

- Los 13 archivos de guardianes de la tanda pasan, cada hallazgo con su ROJO (y los VERDES de antes siguen pasando).
- `npm test` entera, al final de la ronda: **8.068 pasan, 2 fallan, 30 saltados** (402 archivos). Las dos fallas son de
  `claudeAreaInstalar.test.mjs` (el instalador de las PC de las áreas, `sync_area.ps1`): la rama no toca ni ese test ni
  `tools/claude-area`, y el test es inestable en esta PC (corrido solo, en la rama, falló 5 de 80, otros que en la suite, con
  un `estado.json` que no aparece). **En main, el mismo test falla igual: 4 de 80.** Es una falla que ya estaba, no de la rama.
