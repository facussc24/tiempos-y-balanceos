# Tanda 9 (método) — auditor final, ronda 2 (17/10/2026)

Puntas medidas:
- rama `claude/metodo-tanda9` en `bfec5adb` (worktree limpio, sin cambios sin commitear);
- `main` en `862eaca4`;
- base `14ae8367`;
- tanda 3 `claude/guardianes-tanda3` en `76f7aac5`. **Se movió durante la auditoría** a `2a423fad` (5 commits de su
  ronda 3, más un `guardianes.mjs` sin commitear). Esos commits no tocan `.claude/hooks/` ni `.claude/rules/`, y siguen
  sin archivos en común con esta rama. La simulación, vuelta a correr contra su carpeta de hooks actual, da lo mismo, y
  el lint de lo que cambió da 0 errores.

Las otras dos puntas, releídas al final, no se movieron.
Solo se revisó el diff de la ronda 2 (`90dc21c6..bfec5adb`, 22 archivos) más lo que pidió el encargo; lo de la ronda 1
se tocó solo cuando la ronda 2 lo rozaba o cuando un control nuevo lo hizo aparecer.

## Veredicto: FUNDIR CON ARREGLOS

1 Importante, 3 Nit, 0 Preexistente.

- **Los 4 previos a la fusión están bien**, cada uno medido con un caso propio (tabla de abajo).
- **El Importante es de la ronda 1 y frena la fusión:** el lint del repo (`npm run lint` = `eslint .`) da un error en
  `.claude/workflows/revision-adversarial.js`. Después de fundir, el job `lint` sale rojo en cada push: el candado
  queda rojo en todas las sesiones y el deploy no publica. El arreglo es una línea en `eslint.config.mjs`.
- Los 3 Nit no frenan.

## Los 4 previos a la fusión

| # | Qué corrí | Salida | Esperado | Estado |
|---|---|---|---|---|
| 1 | `combinarCI` importada de la rama y la de `90dc21c6` sacada del texto, con 51 casos (`p1_combinar.mjs`): candado verde, rojo o en curso, por deploy `in_progress`, `queued`, `waiting`, `pending` o `requested`, del HEAD o de otro commit, terminado verde, rojo, cancelado, sin corridas o ilegible | Candado verde con deploy del HEAD en curso o en cola: ronda 1 `ok`, ronda 2 `aviso` con «deploy del HEAD en curso (in_progress, abcdef12): volver a mirar antes de cerrar». Con deploy de otro commit sin terminar también da `aviso` (sin «del HEAD»). Terminado verde: `ok`. Deploy rojo del HEAD: `falta`. Candado rojo: `falta` en todos los casos | Aviso cuando el deploy sin terminar es el del HEAD, y test en las dos direcciones | Bien. El test cubre las dos direcciones (`cierreSesion.test.mjs:167-178`). La diferencia con lo propuesto (aviso también con el deploy de otro commit) es más estricta, y es lo que hacía la base con un solo workflow (`evaluarCI` daba aviso con cualquier corrida en curso). Ver Nit 2 |
| 7 | La evaluación de retiros de esta rama contra los hooks reales de la tanda 3 y contra los de `main`, más el archivo de test entero corrido sobre las dos carpetas (sección siguiente) | Verde en las dos variantes | Verde con los hooks de `main` después de las dos fusiones, y saber qué pasa si el orden se invierte | Bien. Ver Nit 1 |
| 8 | `node scripts/_retirosVencidos.mjs --hoy 2026-10-17`; conteo independiente de las razones sin ningún dígito (`p8_contar.mjs`); `cat -A` de la línea 60; `grep '/d/'` | «Razon sin numero, fecha ni incidente (46)». El conteo aparte da 46 de 78: los 76 de antes más las 2 altas de la tanda 3, que traen fecha. La letra «d» da 6, como antes. La línea 60 dice `!/\d/.test(f.justifica)`. `grep '/d/'` da 0 | 46 con `\d` | Bien |
| 9 | `correccionGuard.mjs --medir <jsonl de prueba>` con `--despues 01/10/2026`, con `--despues` sin valor, con `--despues 2026-10-01` y con `--despues 2026-1-01` | Con `01/10/2026`: código 2 y «--despues necesita una fecha AAAA-MM-DD (llego «01/10/2026»)». Sin valor: código 2 («llego «undefined»»). Con `2026-10-01`: código 0 y la tabla por categoría. Con `2026-1-01`: código 2. `--selftest`: «SELFTEST OK (5 rojos, 11 verdes…)» | Código 2 si la fecha no cumple `^\d{4}-\d{2}-\d{2}$`, y test con fecha mala | Bien. Ver Nit 3 (`2026-02-30` pasa) |

## Simulación de retiros (punto 7)

**Cómo la armé.** `git ls-tree` de `.claude/hooks/` y `.claude/rules/` en cada punta:
- la tanda 3 contra su base `c157b9f9`, que tiene los mismos hooks y reglas que `main` hoy:
  - agrega `modelo-guard.sh` y `permiso-un-uso-guard.sh`;
  - mueve `dev-server-guard.sh` y `timeout-guard.sh` a `_retirados/`;
  - no agrega ni saca reglas;
- la tanda 9 no toca ningún hook;
- las dos ramas no tocan **ningún archivo en común** (28 y 81 archivos; intersección vacía): en ninguno de los dos
  órdenes hay conflicto.

Armé tres raíces en el scratchpad con `_retirosVencidos.mjs`, `retiros.data.json` y el test de esta rama:
- simA: los hooks copiados del worktree de la tanda 3; es el estado final, con las dos fusiones hechas;
- simB: los hooks del worktree de la tanda 9, iguales a los de `main` hoy; es el estado intermedio si se funde primero
  la tanda 9;
- simC: la carpeta de hooks del disco de `main`.

| Raíz | sinRenglon | sinArchivo | Pendientes de fusión | Resultado |
|---|---|---|---|---|
| simA (orden previsto: primero la tanda 3, después esta) | [] | [] | 0 | VERDE |
| simB (orden invertido, intermedio) | [] | [] | 4 (las dos altas sin archivo y las dos bajas todavía en el disco) | VERDE |
| simC (disco de main) | [] | [] | 4 | VERDE |

- El `fin` que el test arma a mano (`retirosVencidos.test.mjs:22`) es idéntico a lo que hay de verdad en simA.
- El archivo de test entero, corrido con vitest y `--root` en simA y en simB: 8 de 9 en verde las dos veces. Pasan los
  cuatro de «el registro cubre el disco». El que falla es del arnés: importa `_cierreSesion.mjs`, que no copié. En el
  worktree real pasa.
- Mutantes (cómo podría cambiar la tanda 3 antes de fundir):

| Mutante | Resultado |
|---|---|
| La tanda 3 agrega otro hook | ROJO (sinRenglon) — bien |
| Se borra un hook de main que tiene renglón | ROJO (sinArchivo) — bien |
| Regla nueva sin renglón | ROJO — bien |
| La tanda 3 al final NO retira `timeout-guard` | VERDE, con 1 pendiente — no lo ve nadie (Nit 1) |
| La tanda 3 al final NO trae `permiso-un-uso-guard` | VERDE, con 1 pendiente — no lo ve nadie (Nit 1) |

**Conclusión.** En el orden previsto da verde. Con el orden invertido da verde en el intermedio (con los 4 pendientes
listados) y verde al final. La tanda 3 siguió trabajando mientras yo auditaba: con `2a423fad` sus hooks son los
mismos y el resultado no cambia. Si vuelve a tocar `.claude/hooks/` o `.claude/rules/` antes de fundir, hay que volver a
correr `p7_sim.mjs`.

## Hallazgos

### TRUE BUG

- [Importante] `.claude/workflows/revision-adversarial.js:152` y `eslint.config.mjs:10-26` · respuesta: arreglado (9b8da2a7: ignores de eslint.config.mjs + caso isPathIgnored en ciWorkflows.test.mjs; `eslint .` 0 errores)
  **El lint del repo da error en el guion del Workflow, y después de fundir deja rojo el candado y frena el deploy.**
  - Caso medido: `eslint .` en el worktree da «✖ 736 problems (1 error, 735 warnings)» y sale con código 1. El único
    error es `152:1 error Parsing error: 'return' outside of function`. Lo mismo con el eslint del principal por
    `--stdin --stdin-filename .claude/workflows/revision-adversarial.js`: el archivo no está ignorado.
  - En `main` el job `lint` está verde (corrida de `2facdbbc`, los 5 jobs en success), así que el error lo trae la rama.
    Entró en `57d5292e` (ronda 1, pieza 3).
  - Por qué nadie lo vio: `lint-staged` solo lintea `*.{ts,tsx}`, así que el commit pasó. La rama nunca se pusheó, así
    que el CI nunca la corrió. El informe de la ronda 2 dice que `node --check` falla en ese archivo «y es lo normal»,
    pero nadie corrió ESLint. ESLint 9 ya no ignora las carpetas que empiezan con punto, y el lint de `.js` y `.mjs`
    corre por defecto aunque la configuración solo ponga reglas a `ts/tsx`.
  - Qué pasa al fundir:
    - el job `lint` de `candado.yml:133-142` sale rojo en cada push, y `_cierreSesion.mjs` marca falta en todas las
      sesiones;
    - `build-and-deploy` espera a `lint` (`deploy.yml:167`) y el commit de la fusión toca `deploy.yml`, que está en su
      propia lista: el deploy sale rojo y GitHub Pages se queda con la versión vieja.
  - Arreglo mínimo: sumar `'.claude/workflows/**'` a los `ignores` de `eslint.config.mjs`, con un comentario. Es un guion
    de la tool Workflow: cuerpo de una función async, con `return` y `await` sueltos, y lo prueba
    `revisionAdversarialWorkflow.test.mjs`.
    - Lo probé con una configuración de prueba que importa la de la rama y suma solo esa línea
      (`lintcfg/arreglo.mjs`): `eslint .` en el worktree da «✖ 735 problems (0 errors, 735 warnings)» y sale con
      código 0. Son las mismas 735 advertencias con el arreglo y sin él. Las reglas solo valen para `ts/tsx`, y la rama
      no toca ninguno de esos archivos. El número de `main` no lo medí.
    - `sourceType: 'commonjs'` no sirve: el guion tiene `export` y `await` de nivel superior.
    - Para que no vuelva: un caso en `ciWorkflows.test.mjs` con `new ESLint().isPathIgnored('.claude/workflows/revision-adversarial.js')`
      igual a `true`.

### ROBUSTNESS

- [Nit] `scripts/_retirosVencidos.mjs:42-43` y `scripts/_cierreSesion.mjs:464-475` · respuesta: arreglado (bfd3372d y 5ef3c410: el cierre avisa con la rama nombrada y el aviso se suma, no tapa los vencidos del viernes)
  **La marca `pendienteDeFusion` no vence, y nadie avisa si queda colgada.**
  - Caso medido: los mutantes 2 y 3 de la simulación dan VERDE. Si la tanda 3 al final no retira `timeout-guard`, o no
    trae `permiso-un-uso-guard`, el registro miente y ningún test lo ve.
  - El test que exige cero pendientes (`retirosVencidos.test.mjs:20-29`) lo hace sobre el `fin` armado a mano, no sobre
    el disco.
  - El paso del cierre (`evaluarRetirosCierre`) no lee `pendientesDeFusion`.
  - Arreglo mínimo: que `evaluarRetirosCierre` dé aviso cuando `pendientesDeFusion.length > 0`, con la rama nombrada.
    Otra opción: un campo `hasta` en la marca; pasada esa fecha, el renglón cuenta como sin archivo o sin renglón.
- [Nit] `__tests__/scripts/cierreSesion.test.mjs:167-174` · respuesta: arreglado (16a0190f: deploy en curso de otro commit, aviso sin «del HEAD»)
  **La diferencia declarada del hallazgo 1 (aviso también con el deploy de otro commit) no la fija ningún test.**
  - Caso medido: en la matriz de `p1_combinar.mjs`, los dos casos nuevos del test son los del HEAD. Una versión que dé
    aviso solo con el deploy del HEAD los pasa igual.
  - Arreglo mínimo: un caso más, con `head_sha` distinto y `in_progress`, que espere `aviso` y un detalle sin «del HEAD».
- [Nit] `scripts/_lib/correccionGuard.mjs:306` · respuesta: arreglado (de80955b: la fecha convertida tiene que ser la misma; caso 2026-02-30)
  **D7 acepta una fecha que no existe, como `2026-02-30`.**
  - Caso medido: `--despues 2026-02-30` sale con código 0 y el encabezado «despues del 2026-02-30». El `Date.parse` de
    V8 pasa el día al mes siguiente.
  - No miente en las cuentas: compara textos, así que el corte cae entre el 28/02 y el 01/03.
  - Cumple lo pedido (`^\d{4}-\d{2}-\d{2}$` y código 2). El comentario del test dice «inexistente» y solo prueba
    `2026-13-45`.
  - Arreglo mínimo: exigir que la fecha, convertida a ISO y cortada en 10 caracteres, dé el mismo texto que entró.

### FALSE POSITIVE (verificado: no son hallazgos)

- **`node --check` falla en `revision-adversarial.js`.** Es lo esperado. Envuelto en una función async parsea bien. El
  problema real es el de ESLint, de arriba.
- **7 rojos en la carpeta `__tests__/scripts` entera del worktree.** Ninguno es de la rama:
  - `vigilarPrecios.test.mjs` (6): el `node_modules/@anthropic-ai/sdk` del worktree solo trae `resources`. En el
    principal da 74 de 74, con el código de main. La rama no toca ese archivo ni `claudeApi.mjs` (0 en el diff).
  - `imprimirTemporal.test.mjs` (1): se pasó de los 15 s con la carga de la corrida completa; solo, pasa.
- **El paso de CI del cierre dice «verde para 2facdbbc, pero el HEAD local bfec5adb todavia no corrio».** Es lo
  esperado: la rama no está pusheada, y la API da 404 para `candado.yml` (todavía no existe en GitHub), así que
  `_cierreSesion.mjs:368-370` cae a la lectura de antes.
- **Reglas siempre cargadas tocadas por la rama:** `codigo-madre.md` (+5), `git-deploy.md` (+7/-2) y `CLAUDE.md`
  (1 renglón). Describen lo que la tanda cambió (el revisor y el CI partido). Ningún hook ni `settings.json` tocado.
- **Detalle 25: la fuente intermedia existe.** Es el plan general en la biblioteca:
  `Ingeniería y Proyecto - General/Claude Fak/viernes-17-plan-sistema/10-PLAN_SISTEMA_2026-10-16.md`. En el apartado
  «(a bis)» dice textual «Boris 23/09: «`/code-review low` cuesta menos y encuentra más bugs»». La hija lo leyó a las
  02:33 (registro `a2cd7649`). La fuente original sigue sin verificar, como dice su informe.

## Detalles: muestreo (8 de 13)

| # | Cómo lo verifiqué | ¿Es cierto lo del informe? |
|---|---|---|
| 2 | Los chequeos del test copiados tal cual, contra `candado.yml` y `deploy.yml` mutados (`p_mut_ci.mjs`): `if: false` en el job, `if:` al final del job, `continue-on-error` en el paso, `\|\| true` en el gate, el gate borrado dejando el selftest, `paths-ignore` | Sí: los 6 frenan en los dos archivos (`paths-ignore` solo aplica al candado) |
| 4 | Los dos YAML parseados con `js-yaml` y `yaml` (`p_yaml.mjs`) | Sí: 18 rutas en `deploy.yml`, las 18 en el test; `candado.yml` sin `paths` ni `paths-ignore`; `repo-publico` sin `if` ni `continue-on-error` en los dos; `build-and-deploy` espera a `[repo-publico, typecheck, test, lint]` |
| 12 | `_encargo.mjs --lanzada` real (`E261017-82e7`) | Sí: renglón 6 el revisor, renglón 7 el autónomo con «es el punto del cierre» |
| 13 | El frontmatter de `revisor-pedido.md` con dos parsers (`p_front.mjs`), y `claude plugin validate .claude --strict` | Sí: el de la ronda 1 fallaba en `js-yaml` («bad indentation of a mapping entry (2:499)»); el de ahora parsea en los dos parsers y da «Validation passed» |
| 15 | Que exista `feedback_documento_no_confiesa_como_se_hizo.md` en la memoria; además, todas las memorias citadas en `docs/review/`, `REVIEW.md`, graders, prompts y el agente | Sí: las 6 existen |
| 22 | `hallazgosRespondidos` sobre `docs/auditorias/` de la rama, con y sin el filtro (`p22_col6.mjs`), y `_cuatroNumeros.mjs --desde 2026-10-16 --hasta 2026-10-17` | Sí: sin filtro, 2 informes y 13 emitidos; con filtro, 1 informe, 10 emitidos, 7 arreglados y 2 en parte; la hoja imprime «7 arreglados y 2 arreglados en parte de 10 emitidos» |
| 25 | Se buscó la cita en el registro de la hija | Sí (ver FALSE POSITIVE) |
| 26 | `docs/evals/banco-amfe-2026-10-17.md:3` | Sí: «3 corridas por brazo» |

Sin verificar más que en el diff: 3, 5, 16, 18 y 28 (el 28 cita el binario 2.1.301, que no abrí).

## Otras comprobaciones a ciegas

- **`node --check`** de los 21 `.mjs` tocados por la rama: todos bien, salvo el guion del Workflow (ver arriba). Los 4
  `.json` parsean.
- **`npx tsc --noEmit`** en el worktree: 0 errores.
- **El candado del repo público, desde el worktree:**
  - `--selftest` da «SELFTEST VERDE: 11 casos»;
  - el gate da «GATE REPO PUBLICO: limpio (0 credenciales en CI, 0 paths internos versionados)», código 0.

  El pre-commit sí corrió en los commits del worktree: `core.hooksPath` apunta a `C:\Dev\BarackMercosul\.husky\_`.
  Pero el CHECK-3 (secretos de planta) se salteó, porque en el worktree no están los archivos privados. Este informe
  está sin commitear: si la madre lo commitea, tiene que pasar el gate como cualquier otro archivo.
- **`_cierreSesion.mjs --sin-build`** en el worktree: corre entero en 41 s y sale con 1 por 4 pasos que son del entorno
  y no de la rama:
  - LECCIONES en 26,7 KB;
  - 23 commits sin pushear;
  - 3 rutas rotas en memorias (`_cerebroLint`);
  - 4,8 GB libres en C:.

  Los pasos nuevos tienen sentido: «Retiros… 0 vencido(s) y 2 por vencer en 7 dias» y «Revisor contra el pedido… esta
  sesion no le entrego documentos».
- **`_encargo.mjs`, encargo normal** (`E261017-ca53`): 5 renglones de ARRANQUE, el 5 es `lineaRevisor`. Los dos
  encargos de prueba, el normal y el `--lanzada`, se cerraron con `--cerrar` (código 0) y `--listar` ya no los muestra.
  Quedaron en `.claude/state/encargos/` del worktree, que está en `.gitignore`.
- **Lint de lo que cambia la tanda 3** (para la fusión combinada): sin errores, tanto los 19 archivos de código hasta
  `76f7aac5` como los de sus commits de ronda 3 hasta `2a423fad`.
- **`npm ls --depth=0`** en el principal: sin dependencias faltantes.
- **Lo que la rama toca de main fuera de su tarea**
  (`git diff 14ae8367..claude/metodo-tanda9 --stat -- CLAUDE.md .claude/rules .claude/hooks .claude/settings.json`):
  6 archivos, +31 y -3, todos de la tanda:
  - `codigo-madre.md`, `git-deploy.md` y `CLAUDE.md`, que cargan siempre;
  - `coordinador.md`, `lecciones-consolidacion.md` y `mejora-implementada.md`, con `paths:`;
  - ningún hook y nada de `settings.json`.

## Salida resumida de los tests

- Los 14 archivos de la tanda, en el worktree: «Test Files 14 passed (14) · Tests 214 passed (214)», 12,7 s.
- `__tests__/scripts` entera, en el worktree: «Test Files 2 failed | 165 passed | 1 skipped (168) · Tests 7 failed | 4705
  passed | 6 skipped», 457 s. Los 7 son de entorno (ver FALSE POSITIVE).
- La suite completa (`npx vitest run`, la misma que corre el job `test` del CI), en el worktree: «Test Files 2 failed |
  406 passed | 2 skipped (410) · Tests 7 failed | 8134 passed | 14 skipped», 761 s. Los 7 rojos son los mismos 7 de
  entorno.
- En los 12 tests nuevos o tocados de la rama busqué cosas que solo existen en esta PC: el home, `USERPROFILE`, rutas
  `C:`, PowerShell, el CLI `claude`, y carpetas ignoradas como `evals/results` o `.claude/state`.
  - Las rutas `C:` son textos de prueba.
  - Los tests que arman un home lo hacen en un temporal.
  - Lo que leen del repo está versionado (lo comprobé con `git ls-files`).

  No encontré nada que dé rojo en el runner de Linux.
- Simulación de retiros con el test real: 8 de 9 en simA y en simB. El que falla es del arnés.

## Lo que no pude medir

- **El CI de verdad.** La rama no está en GitHub y `candado.yml` nunca corrió. El hallazgo 1 se midió como función pura,
  no con un deploy real en curso.
- **`npm run build`.** No lo corrí: la rama no toca ningún archivo que entre al build. De la lista de `deploy.yml` solo
  toca el propio `deploy.yml`. La ronda 1 lo corrió.
- **La tool Workflow con el guion real.** No la corrí; la cubre su test.
- **El detalle 28** (lo que hace el eval 2.1.301 con `with-only`): no abrí el binario.
- **El CHECK-3 del candado** (secretos de planta) sobre los archivos de la rama: en el worktree se saltea, y no copié
  los archivos privados. Va a correr en el pre-commit del principal cuando se haga la fusión.

## Para la sesión madre, al fundir

1. Arreglar el Importante **antes del commit de fusión**, no después: una línea en `eslint.config.mjs`, y después
   `npx eslint .` tiene que dar 0 errores. El commit de fusión toca `deploy.yml`, así que dispara los dos workflows; si
   el arreglo entra en un commit posterior, el de la fusión ya sale rojo y no publica.
2. Decirle a Fak qué toman las sesiones abiertas (`node scripts/_probarMejora.mjs --sesiones`). La ronda 2 volvió a tocar:
   - `git-deploy.md`, que carga siempre: hay que reabrir;
   - `coordinador.md`, con `paths:`;
   - el frontmatter del agente.

   Ni su informe ni sus commits lo dicen.
3. Después de las dos fusiones, correr `node scripts/_retirosVencidos.mjs`: tiene que decir «Pendientes de fusion (0)».
   Ahí se saca el campo `pendienteDeFusion`.
4. Aparte, y no es de esta rama: `main` local tiene `862eaca4` (docs de la cola) sin pushear.

Scripts de esta auditoría, en el scratchpad de la sesión (`aud9r2/`): `p1_combinar.mjs`, `p7_sim.mjs`, `p8_contar.mjs`,
`p_yaml.mjs`, `p_mut_ci.mjs`, `p_front.mjs`, `p22_col6.mjs`, `p25_fuente.mjs`, `lintcfg/arreglo.mjs`.
