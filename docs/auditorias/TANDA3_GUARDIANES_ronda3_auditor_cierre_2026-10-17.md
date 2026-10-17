# Tanda 3 — guardianes que frenan de más: auditor de cierre de la ronda 3 (17/10/2026)

**Veredicto: FUNDIR CON ARREGLOS.**

Los ocho agujeros (T1 a T8) y el falso positivo F1 están cerrados. Por cada commit, el test nuevo **falla con la
librería de antes del commit y pasa con la de después**. Los 128 casos del auditor de la ronda 2 dan lo que dice el
informe de la ronda: difieren 14, y son justo los que quedaron escritos para después. Los 11 archivos de test pasan
(586 de 586) y la medición sobre los frenos pasados da la misma tabla: ningún verdadero dejó de frenar (43 → 43).

Al buscar a ciegas aparecieron **tres TRUE BUG**:

- **N1 — una regresión de esta misma ronda (T4).** Adentro de `powershell -Command`, `cp` y `mv` son alias de
  `Copy-Item` y `Move-Item`. Pero `destinoExplicitoDe` los lee con las reglas de GNU. Por eso una copia ENCIMA del
  listado real de AMFE pasa si se escribe `cp -Destination '<AMFE>' <origen>` o `cp -LiteralPath <origen> '<AMFE>'`.
  La punta de la ronda 2 (`76f7aac5`) la frenaba, y la abrió `d4eedb01`.
- **N2 — la misma clase que T8, todavía abierta.** Si en el renglón del `mkdtemp()` viene algo más después de la
  llamada (`… = tempfile.mkdtemp() if '--prueba' in sys.argv else r'<Y:>/salida'`), la variable cuenta igual como
  temporal. Así pasa un script que borra una carpeta del servidor. La base lo frenaba; las rondas 2 y 3, no.
- **N3 — el gemelo que faltaba: apqp-cliente no mira el `cp`/`mv` que corre detrás de `xargs`, `find -exec` o
  `parallel`.** En la ronda 1 eso se arregló solo en escritorio-guard. `ls x | xargs -I {} cp {} "<AMFE>"` y
  `find … -exec cp {} "<AMFE>" \;` copian encima del listado real y pasan, y `ls "<AMFE>" | xargs -I % mv % /c/tmp/`
  lo saca del servidor y también pasa. La base los frenaba; la r2 y la punta, no. Viene de antes de esta ronda, pero
  es de la clase «arreglo hecho en un solo guardián» que esta ronda cerró con T3 y T4.

Los tres se arreglan con poco código (detalle abajo, con archivo:línea). Además hay seis ROBUSTNESS y seis FALSE
POSITIVE. Cuatro de esos falsos positivos los metió esta ronda:

- F3, F4 y F5 vuelven a frenar formas que la ronda 2 ya dejaba pasar (la base las frenaba);
- F6 sale de la decisión de T1 (`bc0be0de`) y es nuevo también contra la base: ni la base ni la r2 lo frenaban.

Ninguno abre un agujero.

**Qué bloquea la fusión.** N1, N2 y N3, con el mismo criterio que usó la madre en las dos rondas anteriores:

- N1 es un arreglo de esta ronda que retrocedió, como T1/T3/T4/T6 en la ronda 2.
- N2 es de la misma clase que T8, y es la forma más natural de las que quedaban: un script con «modo prueba».
- N3 es el gemelo de un arreglo, como T3 y T4. Además, `xargs -I {}` y `find -exec` son formas comunes, no
  rebuscadas como T9.

Lo demás no bloquea, salvo que la madre decida otra cosa.

## Qué se auditó

- Rama `claude/guardianes-tanda3`, punta **`85a0dacf`**, los 10 commits de `76f7aac5..HEAD`. Leí entero el diff de
  `scripts/_lib` (guardianes.mjs +241/−39, shellTexto.mjs: solo el `export` de `finSustitucion`) y el de los tests.
- Los hashes de lo auditado son los mismos al empezar y al cerrar: `guardianes.mjs` 3aa48920, `shellTexto.mjs`
  b9ed8467, `guardianesRonda3.casos.json` 1977916a, `guardianesRonda3.mjs` 67c7bbe6 y `_dispatcher.sh` 11dbe280.
  Durante la auditoría no entró ningún commit.
- Usé tres despachadores, cada uno con su `guardianes.mjs`:
  - la **base** `c157b9f9`: el `git archive` que dejó la madre en `r3/base`, verificado por hash contra el commit;
  - la **r2**, que es la punta de la ronda 2 (`git archive 76f7aac5`, en mi `aud3/r2`);
  - la **punta**, que es el worktree.

  Cada payload entra por stdin a `bash <despachador>`, que solo juzga. Corrí con `HOME`/`USERPROFILE` en una carpeta
  de prueba (`aud3/home`), sin `COMPUTERNAME`, con `session_id` `auditor-cierre-r3` y `cwd` `C:\Dev\BarackMercosul`.
  No ejecuté ningún comando de los casos y no gasté ningún permiso.
- Escribí los esperados ANTES de correr (`aud3/casos_cierre*.test.mjs`), junto con lo que sospechaba que iba a dar,
  y no los toqué después. Los comandos de prueba están en esos archivos; en este informe van por código.

Rutas que usan los casos: `<AMFE>` = el listado maestro real de AMFE, con su carpeta `13. Analisis del modo de falla
y sus efectos ( I-AC-005.3)`; `<TC>` = `TAREAS CERRADAS/2026` de la nube de Ingeniería; `<TAREA>` = una carpeta del
Escritorio; `<Y:>` = la carpeta `13. Analisis …` del servidor; `<secreto>` = el archivo de secretos de la raíz.

## 1. Cada arreglo, y que su ROJO falle sin él

Por cada commit armé dos copias en el scratchpad. Las dos llevan los tests de ESE commit: una con la librería de
**antes** (`X^`) y la otra con la de **después** (`X`). En cada copia corrí con vitest los describe «ronda 3» de los
archivos de test que tocó el commit (`--root <copia>`, `-t "ronda 3"`).

| Commit | Arreglo | Con la lib de antes | Con la lib de después |
|---|---|---|---|
| `bc0be0de` | T1 | 1 test, **falla «ROJO T1»** | 1 de 1 pasa |
| `28feca5e` | T2 | 2 tests, **falla «ROJO T2»** | 2 de 2 |
| `a0439a0a` | T3 | 4 tests, **fallan «ROJO T3» de apqp y de escritorio** | 4 de 4 |
| `d4eedb01` | T4 | 6 tests, **fallan «ROJO T4» de apqp y de escritorio** | 6 de 6 |
| `2a423fad` | T5 | 9 tests, **fallan los tres «T5»** (apqp, escritorio, secretos) | 9 de 9 |
| `f4a58639` | T6 | 2 tests, **falla «P12 ROJO T6»** | 2 de 2 |
| `7a795907` | F1 | 3 tests, **falla «P12 VERDE F1»** | 3 de 3 |
| `7b5b1a2d` | T7 | 4 tests, **falla «P12 ROJO T7»** | 4 de 4 |
| `5b192b08` | T8 | 2 tests, **falla «ROJO T8»**; el VERDE de T8 pasa también antes (cuida que el conteo nuevo no frene de más) | 2 de 2 |
| `85a0dacf` | parte de T5 | el U+E000 literal estaba 1 vez en `2a423fad` | 0 veces en la punta, en `guardianes.mjs` y en `shellTexto.mjs` |

En ninguna corrida de «antes» falló un test de un arreglo anterior: cada commit cierra solo lo suyo.

**Lo mismo, caso por caso.** Cada id ROJO (o VERDE de F1) de los tests de la ronda 3 da lo contrario de lo esperado en
la r2 y lo esperado en la punta. Los ids son estos:

- T1: N-A08;
- T2: X-A11 a X-A14 y N-C05;
- T3: N-A07 y X-E11;
- T4: N-A01 a N-A03, N-A06, Y-A19, N-E01 y N-E02;
- T5: N-S01 a N-S04, N-A04, N-A05, N-E03 a N-E05 y N-E07;
- T6: N-S06 y N-S07;
- T7: N-S08;
- T8: N-B01 a N-B04.

En todos, la r2 da 0 y la punta 2. En F1 (N-S12 y N-S13), la r2 da 2 y la punta 0.

**Los 128 casos del auditor de la ronda 2, por los tres despachadores.** Difieren de lo esperado 14 de 128, los mismos
que dice el informe de la ronda:

- N-A10, Y-A17 e Y-E13: es F2;
- N-E10: está mal armado;
- N-B05, N-B06, X-B10 y X-B11: es R3;
- N-M02: es T9;
- N-C01, N-C04, N-C06, N-C07 y X-C09: son R2 y R3.

Todos los de T1 a T8 y F1 dan lo esperado.

## 2. Regresiones (lo que pedía el encargo)

**`verboDeComando` en los demás que la usan.** `duenoEsTexto`, `loQueEjecuta` y `comandosConEval` la llaman sin
`conocido`, así que solo ven cuatro cambios: `stdbuf`, los segundos con decimales, el salto del valor de las opciones
de la tabla y el `env -S` partido. Con los cuatro el verbo sale más justo; por ejemplo, `xargs -I {} python …` antes
daba `{}` como verbo y ahora da `python`. Lo comprobé así:

- mail: Z-M200 (`xargs -I {}` delante del envío) y Z-M201 (`timeout -s KILL 300` delante del envío) frenan en las tres
  versiones;
- script-inline: Z-I203 (un `cat` detrás de `timeout -s KILL` que escribe prosa a un `.md` del scratchpad) pasa, como
  N-I01;
- en la medición, `mail-guard` queda V 7 → 7 y `script-inline-guard` V 165 → 165.

Revisé la tabla `ENVOLTORIO_CON_VALOR` contra el `--help` de timeout, env 8.32, xargs 4.10, nice y stdbuf de esta
PC. Las opciones que llevan valor están en la tabla. Las de valor opcional pegado no deberían estar: las cortas (`-i`,
`-l` y `-e` de xargs) no están, pero las largas `--replace[=R]` y `--eof[=END]` sí, y se saltean la palabra que sigue,
que es el comando (R9). exec, time y el `sudo` de Windows los revisé leyendo, sin `--help`. Lo que sí cambia algo es
el respaldo `conocido`: ver F5.

**`destinoExplicitoDe`.** Las formas GNU de `cp`/`mv` y las de PowerShell en `Copy-Item`/`Move-Item` andan:

- Z-A35 (`-vt`), Z-A36 (`--target-directory X --`), Z-A37 (`--targ=`), Z-A38 (`-T`), Z-A33 (`copy -Destination`),
  Z-A34 (`-LiteralPath … -Destination`), Z-E42, Z-E43 y Z-E44 frenan;
- traer el listado con esas formas pasa: Z-A39, Z-A40, Z-A41 (`-Container`) y Z-E45.

El verbo que queda mal es el alias `cp` de PowerShell: ver **N1**. `mv -Destination` frena (Z-A42), pero por
casualidad: el listado queda como «origen» de un mover.

**`argumentosDeLlamada`.** Frenan, sobre la ruta real con paréntesis:

- las comillas dobles escapadas de `node -e` y de `python -c` (Z-A10, Z-A12);
- el template literal con `${}` (Z-A15);
- las barras escapadas antes de la comilla (Z-A21);
- `os.path.join` (Z-A16) y `os.replace` (Z-A20);
- `open(…, mode='r+b')` (Z-A17);
- una llamada de varios renglones con un comentario de paréntesis balanceados (Z-A13).

Leer pasa (Z-A18 y Z-A19). El único hueco es un comentario con un `)` suelto: ver R7.

**`asignacionesDe` (T8).** Los VERDES comunes pasan:

- el borrado de la propia carpeta temporal en un renglón, con un argumento con nombre en Python o con el objeto de
  opciones en JS (el test, Z-B185, Z-B187, Z-B189, Z-B160f, Z-B180c y Z-B181c);
- `const opts = { cwd: d, … }` (Z-B189).

Las formas que la ronda 3 cuenta como asignación también frenan: el intercambio de tupla (Z-B169), `globals()['d']`
(Z-B173) y `d = os.path.dirname(d)` (Z-B172).

Lo que sale mal:

- en un ROJO: N2 y R4;
- en un VERDE: F3 y F4.

## 3. Variantes nuevas, buscadas a ciegas (esperado escrito antes de correr)

0 = deja pasar, 2 = frena. «Esperado» es lo que debería dar la punta.

| Caso | Guardián | Forma (resumida) | Base | r2 | Punta | Esperado |
|---|---|---|:-:|:-:|:-:|:-:|
| Z-A01 / Z-A02 | apqp | `pwsh -c` con `.SaveAs(` de COM; `powershell -Command "& { … .Close($true) }"` | 0 | 0 | 2 | 2 |
| Z-A03 | apqp VERDE | COM abre el listado de solo lectura y `.Close($false)` | 0 | 0 | 0 | 0 |
| Z-A04 | apqp VERDE | `bash -c "cp <AMFE> /c/tmp/l.xlsx && python -c '…wb.save(<copia local>)'"` | 0 | 0 | **2** | 0 |
| Z-A10 / Z-A12 | apqp | `node -e` / `python -c` con comillas dobles escapadas, encima de `<AMFE>` | 0 / 2 | 0 | 2 | 2 |
| Z-A11 | apqp | lo mismo con una ruta sin paréntesis (control) | 0 | 2 | 2 | 2 |
| Z-A13 | apqp | heredoc python: `shutil.copy(` de varios renglones, comentario `(no tocar el viejo)` | 2 | 0 | 2 | 2 |
| Z-A14 | apqp | lo mismo, con los comentarios `# 1) el nuevo` / `# 2) encima del maestro` | 2 | 0 | **0** | 2 |
| Z-A15, Z-A16, Z-A17, Z-A20, Z-A21 | apqp | template literal, `os.path.join`, `open(…, mode='r+b')`, `os.replace`, barras escapadas | 0–2 | 0–2 | 2 | 2 |
| Z-A18 / Z-A19 | apqp VERDE | leerlo con `open(…,'rb')`; `read_excel` + `to_excel` a `C:\tmp` | 0 | 0 | 0 | 0 |
| Z-A25 / Z-A26 / Z-A27 | apqp | robocopy desde `/tmp/sub`, `/c/tmp`, `/tmp` con `/NP /NFL` | 2 | 2 / 2 / 0 | 2 | 2 |
| Z-E28 | escritorio | `robocopy /tmp <TC> informe.pdf /R:0` | 2 | 0 | 2 | 2 |
| Z-A29 / Z-E30 | VERDE | robocopy del listado / de `<TC>` hacia `/tmp` | 2 | 0 | 0 | 0 |
| **Z-A31** | apqp | `powershell -Command "cp -Destination '<AMFE>' C:\tmp\n.xlsx"` | 0 | **2** | **0** | 2 |
| **Z-A31c** | apqp | lo mismo con `-Path` nombrado | 0 | **2** | **0** | 2 |
| Z-A31b | apqp | lo mismo con `Copy-Item` en vez de `cp` (control) | 2 | 2 | 2 | 2 |
| Z-A31d | apqp | `cp <origen> -Destination '<AMFE>'` (control: el destino al final) | 0 | 2 | 2 | 2 |
| Z-A31p | apqp | `cp -Destination '<AMFE>' …` por la herramienta PowerShell (control) | 2 | 2 | 2 | 2 |
| Z-A32 | apqp | `cp -Dest '<AMFE>' -Path <origen>` | 0 | 0 | **0** | 2 |
| **Z-A43** | apqp | `powershell -Command "cp -LiteralPath C:\tmp\n.xlsx '<AMFE>'"` | 0 | **2** | **0** | 2 |
| Z-A43b / Z-A44 | apqp | lo mismo con `Copy-Item` (2) / `cp -LiteralPath '<AMFE>' C:\tmp\…` para leer (0) | 2 / 0 | 2 / 0 | 2 / 0 | 2 / 0 |
| Z-A33…Z-A38, Z-A42, Z-E42…Z-E44 | apqp / escritorio | `copy -Destination`, `-LiteralPath … -Destination`, `-vt`, `--target-directory X --`, `--targ=`, `-T`, `mv -Destination`, `mv -vt`, `cp -rvt`, `--target-dir` | 0–2 | 0–2 | 2 | 2 |
| Z-A39, Z-A40, Z-A41, Z-E45 | VERDE | las mismas formas trayendo el listado o un archivo de `<TC>` a una carpeta local | 2 | 0 | 0 | 0 |
| Z-S50…Z-S67 (14 casos) | secretos | el lector del secreto detrás de `timeout --signal KILL 5`, `nice --adjustment 5`, `env -C`, `env -S "…"`, `stdbuf -o L`, `eval '…'`, `builtin eval`, `eval eval`, `timeout -k 5s 10s`, `timeout 1.5`, `env -i PATH=…`, `exec -c`, `time -p`, `sudo -u x` | 0–2 | 0–2 | 2 | 2 |
| Z-S54 | secretos | el lector del secreto en `env -S '… "<secreto>"'` (con comillas adentro) | 0 | 0 | **0** | 2 |
| Z-S56 / Z-S57 | secretos | xargs toma sus argumentos DEL secreto (`-a` / `--arg-file=`) y se los pasa a `echo`, que los imprime | 0 | 0 | **0** | 2 |
| Z-S70…Z-S75 | secretos VERDE | `timeout 60 git grep -n "<secreto>"`, `env -u X ls -la <secreto>`, `timeout 30 test -f`, `eval "$(ssh-agent -s)"`, `rg -g '!<secreto>'` | 0 | 0 | 0 | 0 |
| Z-A80…Z-A86 | apqp | la copia encima de `<AMFE>` detrás de `timeout --signal=KILL`, `nice -n 5`, `stdbuf -o0`, `eval '…'`, `timeout 60 xcopy` | 0–2 | 0–2 | 2 | 2 |
| Z-A84 | apqp | lo mismo con `env -S '… "<AMFE>"'` | 0 | 0 | **0** | 2 |
| Z-E90…Z-E94 | escritorio | mover `<TAREA>` a `<TC>` detrás de `timeout --signal KILL`, `nice -n 5`, `eval '…'`, `stdbuf -oL` | 0–2 | 0–2 | 2 | 2 |
| Z-E93 | escritorio | lo mismo con `env -S '… "<TAREA>" "<TC>/"'` | 0 | 0 | **0** | 2 |
| **Z-E95 / Z-E95c** | escritorio VERDE | `timeout 60 rg -n mv "<TC>/…/notas.md"`; `timeout 60 grep -c cp "<TC>/…"` | 2 | **0** | **2** | 0 |
| Z-E95b | escritorio VERDE | `rg -n mv "<TC>/…"` sin el `timeout` (control) | 2 | 0 | 0 | 0 |
| Z-S100…Z-S109 | secretos | el secreto abierto por un intérprete adentro de `xargs -n1 node -e`, `find -execdir perl -pe`, `-exec /usr/bin/python3 -c`, `-exec sh -c`, `xargs -0 -I@ py -c`, `parallel`, `-exec python {}`, `-ok` | 0–2 | 0–2 | 2 | 2 |
| Z-S107 / Z-S108 | secretos VERDE | `xargs python -m py_compile`; `find -exec node --check {}` | 0 | 0 | 0 | 0 |
| Z-S124…Z-S128, Z-S133 | secretos VERDE | buscar quién lo usa con `xargs grep --regexp=`, `xargs rg -l`, `find -exec grep -H`, `--fixed-strings`, `-lE '\.env\.local'`, `-c` | 0 | 2 | 0 | 0 |
| Z-S120 / Z-S121 | secretos VERDE | `xargs grep -n -m 1 '<secreto>'`; `xargs grep -A 2 '<secreto>'` | 0 | 2 | **2** | 0 |
| Z-S122 / Z-S123 | secretos VERDE | `xargs grep -e '<secreto>' -e dotenv`; `-e dotenv -e '<secreto>'` | 0 | 2 | **2** | 0 |
| Z-S120d / Z-S121d / Z-S122d | secretos VERDE | lo mismo SIN xargs: `grep -n -m 1 '<secreto>' scripts/…`, `grep -rn -A 2 …`, `grep -rn -e …` | 0 | 2 | **2** | 0 |
| Z-S122e | secretos VERDE | `grep -rn '<secreto>' scripts` (control) | 0 | 0 | 0 | 0 |
| Z-S129 / Z-S130 | secretos | un `grep -v` detrás de xargs que recibe el NOMBRE del secreto (por `echo` o por `find -name`) y muestra su contenido | 2 | 2 | 2 | 2 |
| Z-S131 | secretos | un `grep -hv` con el nombre del secreto como patrón, detrás de `ls -a \| xargs`: lee todos los archivos, el secreto también | 0 | 2 | **0** | 2 |
| Z-S132 | secretos VERDE | `xargs grep -l '<secreto>' \| xargs head -3` (lee los que lo NOMBRAN) | 2 | 2 | 2 | 0 |
| Z-S134 | secretos VERDE | `git grep -l '<secreto>' \| xargs grep -n dotenv` | 0 | 2 | **2** | 0 |
| Z-S140…Z-S153 | secretos | `<( … )` con `tr -d '()'`, `grep -v ")"`, `<(echo "(x)")`, `sed 's/\(a\)/b/'`, anidada, `>( … )`, `tr \)`, `$( … sed 's/(x)//')`, `awk`, `< <( … )`, y `python -c` / `node -e` con `<(` en el código | 2 | 0–2 | 2 | 2 |
| Z-S147 / Z-S151 | secretos VERDE | `diff <(git show HEAD:.env.example) .env.example`; `python -c "…2<(3)…" && ls <secreto>` | 0 / 2 | 0 | 0 | 0 |
| **Z-B160d** | borrado (Write .py) | `salida = tempfile.mkdtemp() if '--prueba' in sys.argv else r'<Y:>/salida'` y el borrado de `salida` | 2 | 0 | **0** | 2 |
| Z-B160e / Z-B160f | borrado | la misma variable con la ruta sola (2) / con el `mkdtemp()` solo (0) (controles) | 2 | 2 / 0 | 2 / 0 | 2 / 0 |
| Z-B160 / Z-B161 / Z-B162 | borrado (.py) | `mkdtemp() if False else r'<Y:>'`; `mkdtemp() and r'<Y:>'`; `mkdtemp()[:0] + r'<Y:>'` | 2 | 0 | **0** | 2 |
| Z-B163 / Z-B164 / Z-B165 | borrado (.mjs) | `({ d } = { d: '<Y:>' })`; `d &&= '<Y:>'`; `for (d of ['<Y:>'])` | 2 | 0 | **0** | 2 |
| Z-B166 / Z-B167 | borrado (.py) | `for _, d in [(0, r'<Y:>')]:`; `match r'<Y:>': case d:` | 2 | 0 | **0** | 2 |
| Z-B166c | borrado | `for d in [r'<Y:>']:` (control) | 2 | 2 | 2 | 2 |
| Z-B169 / Z-B172 / Z-B173 | borrado | intercambio de tupla, `d = os.path.dirname(d)`, `globals()['d'] = …` | 2 | 0 / 2 / 0 | 2 | 2 |
| **Z-B180 / Z-B181** | borrado VERDE | el borrado del temporal en dos renglones (`d, ignore_errors=True)` en el segundo); `copytree(` de varios renglones al estilo black | 2 | **0** | **2** | 0 |
| Z-B180c / Z-B181c | borrado VERDE | lo mismo en un solo renglón (controles) | 2 | 0 | 0 | 0 |
| Z-B184 | borrado VERDE | `export const d = fs.mkdtempSync(path.join(os.tmpdir(), 'x-'))` y su borrado | 2 | 0 | **2** | 0 |
| Z-B182 / Z-B188 | borrado VERDE | `print(f"{d=}")`; `d: str = tempfile.mkdtemp()` | 2 | 2 | 2 | 0 (de antes) |
| Z-B185 / Z-B187 / Z-B189 | borrado VERDE | adentro de `def main()` / `try` / `finally`; comentario con paréntesis; objeto `{ cwd: d }` | 2 | 0 | 0 | 0 |
| Z-M200 / Z-M201 / Z-I203 | mail / inline | ver el punto 2 | 2 / 2 / 2 | 2 / 2 / 0 | 2 / 2 / 0 | 2 / 2 / 0 |
| Z-A88 / Z-A89 / Z-A87 | apqp | `ls /c/tmp/n.xlsx \| xargs -i cp {} "<AMFE>"`; lo mismo con `-I {}`; con `--replace` | 2 | 0 | **0** | 2 |
| Z-A91 | apqp | `find /c/tmp -name n.xlsx -exec cp {} "<AMFE>" \;` | 2 | 0 | **0** | 2 |
| Z-A92 | apqp | `find /c/tmp -name <el nombre del listado> \| xargs cp -t "<carpeta del listado>"` | 2 | 0 | **0** | 2 |
| Z-A94 | apqp | `ls "<AMFE>" \| xargs -I % mv % /c/tmp/` (lo saca del servidor) | 2 | 0 | **0** | 2 |
| Z-A96 | apqp | `printf … \| parallel cp {} "<AMFE>"` | 2 | 0 | **0** | 2 |
| Z-A93 | apqp | `xargs -I % cp % "<AMFE>"` (con `%` en vez de `{}`: lo arregló T5) | 2 | 0 | 2 | 2 |
| Z-A95 | apqp VERDE | `ls "<AMFE>" \| xargs -I % cp % /c/tmp/l.xlsx` (traerlo para leer) | 2 | 0 | 0 | 0 |
| Z-S90x | secretos | un lector detrás de `xargs --replace`, que recibe el nombre del secreto por la cañería (control de R9) | 2 | 2 | 2 | 2 |

Z-B186 (una línea de `fsp.rm` adentro de un `async`) no lo frena ninguna de las tres versiones. Lo dejo afuera.

**Por qué pasa N3.** Armé la partición de Z-A89 con `comandosSimples` de la punta: da cuatro comandos (`ls …` |
`xargs -I` | `cp` | el destino). La `{` al principio de una palabra se toma como un bloque de bash, así que `cp` queda
sin argumentos y el destino queda suelto. escritorio-guard ya lo tiene resuelto: en `mueveAMano` (`:1395-1401`), un
`find`, `xargs` o `parallel` con un mover adentro se mira contra el comando entero.

**A qué commit se debe cada uno** (lo comprobé llamando a la función exportada de las copias de antes y de después,
sin el despachador):

- N1 (Z-A31, Z-A31c, Z-A43): la función los ve con `d4eedb01^` y deja de verlos con `d4eedb01`;
- F5 (Z-E95, Z-E95c): `mueveAMano` no frena con `2a423fad^` y frena con `2a423fad`;
- F3 y F4 (Z-B180, Z-B181, Z-B184): con `5b192b08^` el borrado es de una carpeta temporal y con `5b192b08` frena; los
  controles de un renglón dan temporal con los dos;
- N2 y N3 vienen de antes de esta ronda: dan lo mismo en la r2 y en la punta.

**Cuánto aparecen estas formas en los registros.** Conté los renglones con `tool_use` de `~/.claude/projects` (sin
esta sesión ni la del auditor de la ronda 2), por forma; no copié ningún texto:

Son 2.023 registros y 241.707 renglones.

| Forma | Renglones (sesiones) |
|---|:-:|
| `mkdtemp()` seguido de `if`/`and`/`or`/`+`/`[` en el mismo renglón (N2) | 0 |
| `cp`/`mv` con `-Destination`/`-Dest`/`-LiteralPath` (N1) | 0 |
| `grep` con `-m`/`-A`/`-B`/`-C N` antes de un patrón que nombra el secreto (F7) | 0 |
| `grep -e` con el secreto (F7) | 0 |
| `env -S` (R5) | 0 |
| `xargs -a` / `--arg-file` (R6; no miré si alguno nombra el secreto) | 4 (3) |
| `xargs`, `find -exec` o `parallel` con `cp`/`mv` y un listado maestro nombrado (N3; no miré si copia encima o para leer) | 1 (1) |
| `xargs -I {}` con `cp`/`mv`, o `find -exec cp`/`mv`, con cualquier destino (la forma de N3) | 21 (10) |
| envoltorio + `rg`/`grep` + una palabra `mv`/`cp` (F5) | 0 |
| renglón de continuación «nombre, argumento=…» de una llamada de varios renglones (la forma de F3, sin mirar si el nombre es el de un `mkdtemp`) | 28 (16) |

Las formas de N1 y N2 no aparecen en los registros. N3 aparece una vez con un listado nombrado, y su forma general
(`xargs -I {}` o `find -exec` con un copiar o mover) aparece 21 veces en 10 sesiones: es una forma que se usa. F3 es
la forma genérica: una llamada de varios renglones con un argumento con nombre se escribe seguido. No medí cuántas de
esas tienen la variable de un `mkdtemp` y un borrado.

## 4. Hallazgos

### TRUE BUG (la base o la r2 frenaban, y el comando hace de verdad lo que el guardián cuida)

**N1. (lo abrió T4, `d4eedb01`) El alias `cp` de PowerShell se lee con las reglas de GNU.** Z-A31, Z-A31c y Z-A43:
r2 2, punta 0. Los controles con `Copy-Item` frenan (Z-A31b, Z-A43b).

- `destinoExplicitoDe` (`guardianes.mjs:1358-1359`) lee las formas de PowerShell solo en `Copy-Item`, `cpi`,
  `Move-Item`, `mi`, `copy` y `move`. A `cp` y `mv` les aplica las de GNU, pero adentro de `powershell -Command`
  también son alias.
- Con `cp -Destination '<AMFE>' <origen>`, el valor de `-Destination` cae entre los posicionales. Así el origen queda
  como destino, el listado queda como «origen» de una copia hacia una carpeta local, y pasa.
- Con `cp -LiteralPath <origen> '<AMFE>'`, el patrón de grupo corto de `:1365` lee `-LiteralPath` como `-L -i -t
  eralPath` (es lo que haría GNU). El destino queda `eralPath`, una ruta relativa que cae en `C:\Dev`, y pasa.
- La ronda 2 frenaba las dos. A `-Destination` lo reconocía en cualquier verbo, y con `-LiteralPath` tomaba como
  destino el último posicional, que es el listado. `Z-A32` (`cp -Dest`) no lo frenaba nadie.
- Solo afecta lo que `escribeListadoBash` vuelve a mirar de un `powershell -Command` (`:3054`). Por la herramienta
  PowerShell frena (Z-A31p). En escritorio-guard, lo pegado a un intérprete va por la regla vieja (lo leí en
  `mueveAMano`, `:1394`).
- `mv -Destination` frena, pero por casualidad (Z-A42).

*Arreglo mínimo:* que `escribeListadoBash` sepa cuándo el texto viene de `powershell`/`pwsh` (un parámetro en la
vuelta de `:3054`) y, en ese caso, que `destinoExplicitoDe` lea `cp`/`mv` con las reglas de PowerShell
(`-Dest…`/`-Destination:` y `-LiteralPath`/`-Path` como parámetros con nombre).

*Tests:*
- ROJO: Z-A31, Z-A31c, Z-A32 y Z-A43;
- VERDE: Z-A44 y Z-A40;
- que `cp -rvt` / `-t<X>` de Bash sigan como están.

**N2. (desde P18, `a2c4ed6b`; sigue en la ronda 3, misma clase que T8) Lo que viene después del `mkdtemp()` en el mismo renglón
no se mira.** Z-B160d: base 2, r2 0, punta 0. Controles: con la ruta escrita sola frena (Z-B160e), y con el
`mkdtemp()` solo pasa (Z-B160f). También pasan Z-B160, Z-B161 y Z-B162 (`and`, `[:0] + …`).

- `variablesTemporales` (`guardianes.mjs:1864-1870`) captura `nombre = …mkdtemp(` y del resto del renglón
  (`[^\n]{0,160}`) solo mira si hay un `dir=`.
- En `salida = tempfile.mkdtemp() if '--prueba' in sys.argv else r'<Y:>/salida'`, `salida` cuenta como temporal. El
  borrado de `salida` pasa, y sin `--prueba` borra la carpeta del servidor.
- Es la forma natural de un script con modo prueba, más natural que el walrus o la anotación que arregló T8.

*Arreglo mínimo:* buscar el `)` que cierra el `mkdtemp(` (con `argumentosDeLlamada`) y aceptar la variable solo si
después no queda nada más que espacios, un `;` o un comentario.

*Test:* ROJO con Z-B160d, Z-B160 y Z-B161; VERDE con Z-B160f.

**N3. (de la ronda 1: `escribeListadoBash` nace en `a4ec24b2`, P13; la regla de find/xargs/parallel entra en
`0c3cbdf6`, el arreglo del TRUE BUG 1 de esa ronda, pero solo en escritorio-guard) apqp-cliente no mira el copiar o
mover que corre detrás de `xargs`, `find -exec` o `parallel`.** Base 2, r2 0, punta 0, en todos estos:

- Z-A88 y Z-A89: `xargs -i` / `-I {}` con `cp {} "<AMFE>"`;
- Z-A91: `find -exec cp {} "<AMFE>" \;`;
- Z-A92: `xargs cp -t <carpeta del listado>`, con el nombre del listado en el `find`;
- Z-A94: `ls "<AMFE>" | xargs -I % mv % /c/tmp/`, que saca el listado del servidor;
- Z-A96: `parallel cp {} "<AMFE>"`;
- Z-A87: `xargs --replace`.

Por qué pasa:

- La `{}` parte el comando (`comandosSimples` la toma como un bloque de bash), así que el `cp` llega sin argumentos y
  el destino queda en otro pedazo.
- Cuando el que corre es xargs, el nombre del listado está en otro comando de la cañería, y `escribeListadoBash`
  (`guardianes.mjs:3010-3030`) solo mira el comando del `cp`/`mv`.
- Con `%` en vez de `{}` frena (Z-A93), gracias a T5.

escritorio-guard tiene la regla desde la ronda 1, en `mueveAMano` (`:1395-1401`): un `find`, `xargs` o `parallel` con
un mover adentro se mira contra el comando entero. apqp-cliente nunca la recibió. Es la misma clase que T3 y T4: el
arreglo quedó en un solo guardián.

*Arreglo mínimo:* la misma regla en `escribeListadoBash`. Si la primera palabra cruda es `find`, `xargs` o `parallel` y
alguna palabra es un copiar o mover, frenar cuando el comando entero (resuelto) nombra el listado. Así se vuelve a
frenar también traer el listado para leerlo por xargs (Z-A95, que la base frenaba). Si se quiere evitar eso:
- tomar como destino la palabra de `-t` o la última antes del `\;`/`+` del comando entero;
- frenar solo si ese destino nombra el listado o no es local, o si el verbo es mover.

*Test:*
- ROJO: Z-A89, Z-A91, Z-A92, Z-A94 y Z-A96;
- VERDE (si se toma el camino fino): Z-A95.

### ROBUSTNESS (ni la r2 los frenaba, o son formas rebuscadas)

**R4. (T8) Más formas de volver a asignar la variable que el conteo no ve.** Z-B163 a Z-B167: base 2, r2 0, punta 0.
`asignacionesDe` (`guardianes.mjs:1883-1893`) y los parámetros (`:1875-1880`) no ven estas formas:

- `({ d } = …)`, que es la forma válida en JS de lo que el comentario de `:1881` dice que cuenta (`{ d } = …` suelto
  no compila);
- `d &&= …`;
- `for (d of …)` sin `const`/`let`;
- `for _, d in …` (el `for` de Python con tupla);
- `case d:`.

De estas, la más fácil de escribir sin querer es `for nombre, d in pares:`, si se reusa la `d`.

*Arreglo mínimo:*
- contar el nombre después de `for` y antes de `in`/`of`, aunque venga con coma o sin `const`;
- contar `&&=`, `||=` y `??=`;
- contar `case <nombre>`;
- contar la sentencia que empieza con `(` y lleva el nombre a la izquierda del `=`.

**R5. (T5) `env -S` se parte sin respetar las comillas.** Z-S54, Z-A84 y Z-E93: base 0, r2 0, punta 0.
`guardianes.mjs:2165-2166` parte el valor con `split(/\s+/)`:

- el secreto entre comillas queda como `".env…"`, y `SECRETO_ARG_RE` no lo reconoce;
- una ruta con espacios queda en pedazos, y ninguno nombra `TAREAS CERRADAS` entero.

Sin comillas frena (Z-S53).

*Arreglo mínimo:* partirlo con `comandosSimples(partido)[0].palabras`.

**R6. (T5) El secreto como valor de `-a` / `--arg-file` de xargs.** Z-S56 y Z-S57: base 0, r2 0, punta 0. xargs lee
el archivo y le pasa su contenido como argumentos a `echo`, que lo imprime. La tabla nueva (`guardianes.mjs:2134`) saltea ese
valor como si fuera una opción cualquiera.

*Arreglo mínimo:* en secretos-guard, que el valor de `-a`/`--arg-file` de xargs cuente como una lectura.

**R7. (T2) Un comentario con un `)` suelto adentro de una llamada de varios renglones.** Z-A14: base 2, r2 0, punta 0.
El control Z-A13 cambia solo el comentario y frena.

- `argumentosDeLlamada` (`guardianes.mjs:2943-2965`) no saltea los comentarios.
- En `# 1) el nuevo`, el `)` cierra la llamada antes de llegar al destino.
- La numeración «1)» en un comentario es costumbre en castellano, pero la forma es rara.

*Arreglo mínimo:* fuera de una cadena, saltear de `#` (o de `//`) hasta el fin del renglón. Si se saltea de más, el
guardián frena de más, nunca de menos.

**R8. (lo trae F1, por diseño) Un `grep -hv` con el nombre del secreto como patrón, sobre la lista de `ls -a`.**
Z-S131: base 0, r2 2, punta 0. Lee todos los archivos, el secreto también, y muestra los renglones que no nombran el
secreto. Es el costo del afloje de F1 y deja el comportamiento como en la base. Lo anoto para que la decisión quede
escrita.

**R9. (T5) En la tabla, `--replace` y `--eof` de xargs se comen la palabra que sigue.** En `guardianes.mjs:2134`
están como opciones con valor en la palabra siguiente. Según el `--help` de xargs 4.10, su valor es opcional y va
pegado (`--replace[=R]`, `--eof[=END]`). Con `xargs --replace cp {} …` se saltea el `cp`. Hoy solo suma a N3 (Z-A87);
en secretos frena igual, por la regla de xargs (Z-S90x).

*Arreglo mínimo:* sacar `eof` y `replace` de la lista larga.

### FALSE POSITIVE

**F3. (lo metió T8, `5b192b08`) Un renglón de continuación de una llamada cuenta como asignación.** Z-B180 y Z-B181:
r2 0, punta 2. Los controles en un renglón pasan (Z-B180c, Z-B181c).

- El partido por renglón de `guardianes.mjs:1887-1891` toma dos casos como «lo de la izquierda de un `=`» con el
  nombre adentro:
  - `    d, ignore_errors=True)`;
  - `    os.path.join(…), d, dirs_exist_ok=True` (el formato de black para una llamada larga).
- Así se vuelve a frenar el borrado de la propia carpeta temporal, que la ronda 2 ya dejaba pasar.

*Arreglo mínimo:* llevar la cuenta de paréntesis abiertos entre renglones y no mirar un renglón que está adentro de
una llamada abierta.

**F4. (lo metió T8) `export const d = fs.mkdtempSync(…)` ya no se reconoce.** Z-B184: r2 0, punta 2. La captura de
`guardianes.mjs:1864` pide el nombre al principio de la sentencia o después de `const`/`let`/`var`.

*Arreglo mínimo:* aceptar también `export` adelante.

**F5. (lo metió el respaldo de T5, `2a423fad`) Después de un envoltorio, un `mv` o un `cp` que aparece como texto pasa
a ser el verbo.** Z-E95 y Z-E95c: r2 0, punta 2. Sin el `timeout` pasa (Z-E95b).

- En `guardianes.mjs:2170-2173`, si el verbo pelado no es «conocido» (`rg`, `grep`, `git`…), se toma la primera
  palabra conocida que sigue.
- En `timeout 60 rg -n mv "<TC>/…/notas.md"`, esa palabra es el patrón: el comando queda como un `mv` sobre `<TC>`.
- Pasa lo mismo en apqp-cliente, porque `APQP_VERBO_CONOCIDO` tampoco tiene a los lectores.

*Arreglo mínimo:* usar el respaldo solo cuando la palabra salteada siga a una opción del envoltorio (el caso de una
opción con valor que no está en la tabla). Otra salida es sumar los lectores de texto (`grep`, `rg`, `cat`, `ls`…) a
los «conocidos», para que el respaldo no pase por encima de ellos.

**F6. (lo trae la decisión de T1 de mirar como código lo pegado a CUALQUIER shell) `bash -c` con una copia del listado
y un `.save(` de openpyxl sobre otra copia local.** Z-A04: base 0, r2 0, punta 2.

- `codigoGuardaListado` recibe el texto entero del `bash -c`: nombra el listado (en el `cp`) y tiene un `.save(`.
- `APQP_COM_GUARDA` (`guardianes.mjs:2918`, con `/i`) lo toma como el COM que guarda el libro que abrió.
- El mismo comando sin `bash -c` pasa.

Es raro y frena de más sin abrir nada. Si se quiere, la regla del COM puede ir solo para `powershell`/`pwsh`, que es
lo que proponía el auditor de la ronda 2.

**F7. (de P12, `19c7350a`, ronda 1; no lo tocó esta ronda) `grep` con una opción que lleva valor antes del patrón, o
con `-e`.** Frena con y sin xargs: Z-S120d, Z-S121d y Z-S122d (directos) y Z-S120 a Z-S123 (con xargs), todos con
base 0, r2 2 y punta 2.

- En `guardianes.mjs:378-380`, con `-m 1` o `-A 2` el patrón que se saltea es el `1` o el `2`, y el secreto queda como
  archivo.
- Con `-e '<secreto>'`, todos los posicionales cuentan como archivos, también el valor de `-e`.
- `nombraSecretoFueraDelPatron` (`:320`) tiene el mismo tropiezo con `-m`/`-A`.
- Es justo lo que recomienda el texto del freno («Buscar quien lo usa: grep con el patron entre comillas»), con un
  `-A 2` o un `-m 1`.

*Arreglo mínimo:*
- sacar de los posicionales el valor de `-e`/`--regexp`;
- saltear el valor de `-m`/`-A`/`-B`/`-C`/`--max-count`/`--context` (y de `-g`/`-t` de rg).

**F8. (de la ronda 2, hallazgo 5; F1 no lo cubre) El secreto nombrado como patrón de OTRO grep de la cañería.**
Z-S134 (`git grep -l '<secreto>' | xargs grep -n dotenv`): base 0, r2 2, punta 2.
`nombraSecretoFueraDelPatron` (`guardianes.mjs:322`) cuenta las menciones en el comando entero (`todo`) y resta solo
las del patrón del grep de adentro.

*Arreglo mínimo:* restar también las menciones que son el patrón de un grep/rg de otro comando de la misma línea.

### Lo que la ronda dejó escrito sin arreglar

T9, R1, R2, R3 y F2 siguen como dice el informe de la ronda. Lo comprobé por los tres despachadores: dan lo mismo en
la r2 y en la punta, y son los 14 que difieren de los 128.

## 5. Chequeos pedidos

- **`node --check`** de `guardianes.mjs` y de `shellTexto.mjs`: los dos OK.
- **El despachador de la punta con un Bash inocente** (`ls -la`): **exit 0**, sin stdout y sin stderr (0 bytes).
- **Los tests**, en el worktree, con `npx vitest run --pool=threads` sobre los 11 archivos pedidos: los 4 de la ronda,
  `hooksTienenTest`, `hooksVarios`, `mcpDespachador`, `modeloGuard`, `permisoUnUso`, `videoMaquinaGuard` y
  `commitRutasGuard`. Dio **Test Files 11 passed (11) · Tests 586 passed (586)** (76 s).
- **La medición diferencial**, `node scripts/_frenosMedir.mjs --base <r3/base>/scripts/_lib/guardianes.mjs --casos`:
  - sin script-inline: **V 71 (medibles 49: frenan 43 → 43) · F 51 (medibles 51: frenan 38 → 8) · SD 141 (medibles
    86: frenan 72 → 65)**;
  - script-inline: V 165 → 165 · F 6 → 0 · SD 2 → 0;
  - cambiaron 45 (aflojan 45, aprietan 0);
  - frenan con la nueva y no con la base: `permiso-un-uso-guard`, 6.

  Es la misma tabla que la de las rondas 2 y 3: **ningún verdadero dejó de frenar**.
- **`git status` del worktree.** Al empezar, y en todos los chequeos de arriba, lo único sin commitear eran los dos
  informes de `docs/auditorias`: el del auditor de la ronda 2 y el de la ronda 3. Los 10 commits tocan solo
  `scripts/_lib/guardianes.mjs`, `scripts/_lib/shellTexto.mjs` y seis archivos de `__tests__/scripts/`: los cuatro
  tests, el `.casos.json` y el ayudante. La rama no tiene upstream y no hice commits.

  **Al cerrar (05:34) el worktree cambió, y no fui yo:**
  - apareció `docs/auditorias/TANDA3_GUARDIANES_auditor_ronda3_2026-10-17.md` (05:30), de otro auditor de esta ronda;
  - `__tests__/scripts/guardianesRonda3.casos.json` quedó modificado sin commitear (05:34). Pasó de 128 casos a 316, y
    trae mis Z-* y otros (BT*, BF*).

  Hay otra sesión trabajando en el worktree. Los dos archivos que auditaba (`guardianes.mjs` 3aa48920 y
  `shellTexto.mjs` b9ed8467) y la punta (`85a0dacf`) siguen iguales. Los resultados de arriba se midieron con el
  `.casos.json` de HEAD (1977916a).

## 6. Lo que no pude medir

- **Los falsos positivos sobre comandos que nunca frenaron.** La medición repite solo los 436 frenos. Por eso F3, F4,
  F5, F6 y F8 salieron de los casos, no de la medición. Para ver cuánto pesan conté las formas en los registros
  (punto 3).
- **No corrí PowerShell ni Python.** Que `cp -Destination X Y` adentro de PowerShell copie Y encima de X es la
  semántica documentada del alias (`cp` → `Copy-Item`), y lo mismo vale para `case d:` de Python 3.10. No ejecuté
  nada.
- **No corrí `npm test` entero, `tsc` ni `build`.** El pedido eran los tests de la tanda.
- **No tengo la columna r1 (`f660b7f3`)** para estos casos. Para saber desde cuándo viene cada hallazgo usé la base,
  la r2 y los commits de esta ronda.

## Archivos de esta auditoría (scratchpad de la sesión madre, `aud3/`)

- `casos_cierre.test.mjs` a `casos_cierre6.test.mjs`: los casos, con el esperado y la sospecha escritos antes de
  correr;
- `split_a89.mjs`: la partición de Z-A89 (N3);
- `correr3.test.mjs`: el corredor que los pasa por los tres despachadores. Los resultados quedan en `res3_*.json` y
  en `casos128.txt` (los 128 del auditor);
- `rojo/<commit>/{antes,despues}`, `rojo/correr_rojos.sh` y `rojo/resumen.mjs`: el ROJO de cada commit con la lib de
  antes y la de después; el detalle está en `rojo/res_*.json`;
- `n1_commit.mjs` y `fc_fa_commit.mjs`: a qué commit se debe N1, F3, F4 y F5;
- `contar_formas.mjs`, `contar_formas2.mjs` y `contar_formas4.mjs` (los dos últimos sin las sesiones de
  auditoría): el realismo, con la salida en `formas2.txt` y `formas4.txt`. `contar_formas3.mjs` quedó mal armado (se
  le comieron las barras) y no lo uso;
- `vitest11.log`, `medir.txt`, `inocente.json`, `inoc_out.txt` e `inoc_err.txt`;
- `r2/`: el `git archive` de `76f7aac5`.

## Respuesta (la hija de la ronda 3, 17/10/2026)

| Hallazgo | Qué se hizo | Commit |
|---|---|---|
| **N1** el alias `cp`/`mv` de PowerShell | arreglado como proponía el informe: la vuelta sabe si la shell es PowerShell y ahí `destinoExplicitoDe` lee `cp`/`mv` con las reglas de Copy-Item / Move-Item. ROJOS Z-A31, Z-A31c, Z-A32, Z-A43; VERDES Z-A44, Z-A40 y las formas de Bash | `f5352e4a` |
| **N2** algo después del `mkdtemp()` en el renglón | arreglado como proponía el informe: el `)` que cierra se busca con `argumentosDeLlamada`, y después solo puede quedar un `;` o un comentario. ROJOS Z-B160d, Z-B160, Z-B161, Z-B162; VERDE Z-B160f | `23c65844` |
| **N3** cp/mv detrás de xargs, find -exec o parallel en apqp-cliente | arreglado por el camino fino: el `{}` ya no parte el comando, y se juzga el comando de adentro con el origen que llega por la cañería. ROJOS Z-A87 a Z-A96; VERDE Z-A95. La madre no lo nombró en su lista: va en su propio commit, por si no se quiere | `d559ce2e` |
| **F3** renglón de continuación | arreglado con un cambio: solo se saltea el renglón que sigue a un `(` / `[` abierto cuando lo de la izquierda termina pegado al `=` (`nombre=`). No mirar ningún renglón adentro de una llamada abierta dejaba de ver una reasignación en el cuerpo de una función de varios renglones; hay un ROJO para eso. VERDES Z-B180, Z-B181 | `e75b9495` |
| **F4** `export const` | arreglado. VERDE Z-B184 | `18c8c33b` |
| **F5** el respaldo de T5 | arreglado con la primera salida del informe, ajustada: el respaldo mira solo la palabra que sigue al valor de una opción del envoltorio. VERDES Z-E95, Z-E95c | `936cc48e` |
| R4, R5, R6, R7, R8, R9, F6, F7, F8 | no se arreglaron: son ROBUSTNESS o preexistentes, y van a la cola de cambios (la lista está en el informe de la ronda) | — |

Los casos de este informe (`casos_cierre*.test.mjs`) están en `__tests__/scripts/guardianesRonda3.casos.json` con el
campo `auditor: "cierre r3"`. La «otra sesión» que el informe vio escribiendo ese archivo a las 05:34 era la hija misma,
sumando estos casos. La memoria del auditor quedó en el worktree (`.claude/agent-memory/auditor/`, que el `.gitignore`
deja afuera). No la copié al repo principal porque el encargo dice que ahí no se toca; queda dicho para la madre.
