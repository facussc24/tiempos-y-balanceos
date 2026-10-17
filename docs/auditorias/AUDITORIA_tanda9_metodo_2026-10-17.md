# Auditoría de la rama `claude/metodo-tanda9` contra `main` — 17/10/2026

**6 Importante, 9 Nit (3 listados y 6 contados), 1 Preexistente.**

- Rama auditada: `e6285a0f`, 14 commits sobre `main`.
- Cuando arrancó la auditoría eran 13 y el HEAD era `a043b739`. A mitad de la auditoría entró `e6285a0f`, que solo toca
  `evals/revisor-pedido/RESULTADOS_2026-10-17.md`; se auditó a ese HEAD.
- Riesgo del cambio: mediano. Toca el CI, el cierre de sesión, la plantilla de encargos, cuatro reglas, `CLAUDE.md` y
  dos agentes.
- La rama no se pushea por encargo, así que los 14 commits sin pushear son lo esperado y no cuentan como hallazgo.

Al lado de cada hallazgo, la sesión anota qué hizo: arreglado / rechazado / a propósito / no importa (REVIEW.md).

## Los chequeos

| Chequeo | Estado | Detalle |
|---|---|---|
| TypeScript | OK | `tsc --noEmit` corrido desde el worktree con el `tsc` del repo principal: 0 errores. `tsconfig.strict.json`: 0 errores. |
| Build | OK | `npm run build` desde el worktree anduvo: terminó en 48,19 s. Node encuentra vite subiendo hasta el repo principal. Dejó `dist/`, que git ignora; el árbol sigue limpio. |
| Git local | OK | Árbol limpio en `e6285a0f`. |
| GitHub | esperado | 14 commits sin pushear, por encargo. |
| CI | sin verificar | `candado.yml` da 404 en la API porque no existe en GitHub hasta el push. El último `deploy.yml` de main es `completed success 2facdbbc`, que es `origin/main`, no esta rama. |
| Tests nuevos y tocados | OK | 12 archivos, 112 de 112. |
| Suite entera (lo que contó la hija) | verificado en parte | Corrí aislados los 6 archivos nombrados: 293 de 299 pasan. `vigilarPrecios` da 6 rojos por `Cannot find package …metodo-tanda9\node_modules\@anthropic-ai\sdk\index.js`: la copia parcial del `node_modules` del worktree tapa la del repo principal. `xlsxComparar`, `imprimirTemporal`, `mailDiferido`, `seguimientos` y `paquete` pasan solos. Ninguno de esos archivos ni lo que prueban lo toca la rama. No corrí la suite entera ni nada en `main`. |
| Dependencias | OK | `package.json` y `package-lock.json` no cambian. `npm ls` en el worktree da 92 faltantes por la copia parcial, así que no sirve como medida. |
| Candado del repo público | OK | `_gateRepoPublico.mjs --selftest`: 11 casos en verde. El gate da limpio. |
| El candado corre siempre | OK | `candado.yml` no tiene `paths`. Mutante: le agregué `paths-ignore` en una copia y `ciWorkflows.test.mjs` se puso rojo. |
| La lista de rutas del deploy | OK | Armé el grafo propio con esbuild desde `index.tsx`, siguiendo los `?url`: 404 archivos. Todos caen en la lista de `deploy.yml`: `components/ core/ hooks/ modules/ src/ types/ utils/`, nueve archivos de la raíz e `index.*`. `index.html` solo apunta a `src/assets` e `/index.tsx`. El único hook de npm es `"prepare": "husky"`, que no toca `scripts/`. |
| Poda de `CLAUDE.md` | no se aplicó | `git diff --numstat`: `CLAUDE.md` +1 −1 (el renglón del deploy). En las reglas solo se agregan renglones (+5, +4 −2, +12, +3). `docs/LECCIONES_APRENDIDAS.md` no cambia. |
| Reglas y `CLAUDE.md` | OK | No encontré una regla que contradiga otra, y no cambia ningún número de una regla de Fak. La bancada deja `auditor.md` y `techo-agentes.md` sin tocar a propósito. |

## Hallazgos Importante

- [Importante] `.github/workflows/deploy.yml:11-29` y `scripts/_cierreSesion.mjs:346-348` · respuesta: arreglado (combinarCI: falta solo si el deploy rojo es el del HEAD; si es de un commit anterior, aviso con como relanzarlo; test con los dos casos)
  **Un deploy rojo ya no se arregla solo y deja el cierre en «falta» en todas las sesiones.**
  - Los dos workflows corren el mismo `test` (la suite entera).
  - Si un push que cambia la app coincide con un rojo que no es de la app (un test de herramientas, o uno intermitente
    como el del 11/09 que cuenta el mismo `deploy.yml`), el deploy queda rojo.
  - El commit que arregla ese test toca `scripts/` o `__tests__/`, que no están en el filtro, así que `deploy.yml` no
    vuelve a correr.
  - Desde ahí `combinarCI` da `falta` en cada cierre, de cada sesión y de cada PC, y la app nueva no se publica.
  - Ninguna sesión lo puede destrabar: `gh` no tiene login, así que no hay `workflow_dispatch`. Lo único que queda es que
    Fak le dé «Re-run» desde la web, o un commit que toque la app.
  - Antes de esta rama, el push siguiente, cualquiera fuera, volvía a correr el deploy y lo curaba.
  - Caso medido:
    - De los últimos 100 deploys (11/10 al 17/10, por la API), 2 dieron `failure`; ninguna racha roja pasó de 1, porque
      el push siguiente la curaba.
    - De los últimos 300 commits de main, solo 2 entran en el filtro, y los dos son de configuración (`vitest.config.ts`,
      `tsconfig.json`). O sea que el próximo deploy automático puede tardar cientos de commits.
    - `combinarCI(candado verde para el HEAD, deploy {conclusion:'failure'})` da `falta`, `veredicto` da 1, y el detalle
      no dice cómo salir.
  - La línea de riesgo del commit `a3e3fbef` cubre «un cambio de la app fuera de la lista»; este caso no.
  - Para decidir: que el detalle diga cómo se destraba («Re-run desde la web, lo hace Fak»), o que el job `test` de
    `deploy.yml` corra solo las pruebas de la app. Bajar el `falta` a aviso cuando el deploy rojo es anterior a un
    candado verde afloja el control que avisa que Fak prueba una versión vieja: si se elige, lleva su test en las dos
    direcciones.

- [Importante] `.claude/workflows/revision-adversarial.js:89-92` y `:110-117` · respuesta: arreglado (una lente caida y un hallazgo sin voto se dicen como INCOMPLETO y siguen contando; test)
  **El workflow cuenta como «sin hallazgos» o como «refutado» un agente que no devolvió nada** (REVIEW.md, falla 9).
  - Si los votos de un verificador vuelven vacíos (`null`) o tiran error, queda `confirmado: false`. El hallazgo pasa a
    «Refutados» con «por qué no: sin veredicto» y sale del conteo de arriba: se ve, pero no cuenta.
  - Si una lente se cae, sus hallazgos desaparecen por el `.filter(Boolean)` y el informe igual dice «4 lentes … 0
    hallazgos».
  - El guion espera respuestas vacías (filtra con `.filter(Boolean)`), así que el caso está previsto pero mal cerrado.
  - Caso medido (cuerpo del workflow con agentes de mentira, el mismo arnés del test del autor):
    - Una lente reporta un TRUE_BUG Importante y el verificador devuelve `null` o tira error: el conteo da
      `{"Importante":0,"Nit":0,"Preexistente":0}`, con 1 en «Refutados».
    - La lente `controles` tira error: el informe dice «0 Importante… 4 lentes (correctitud, controles, …), 0 hallazgos».
  - Consecuencia en la pieza 6: `docs/BANCADA_REVISOR_2026-10.md:25` propone `53c76112` como diff «limpio», pero ese
    commit agrega estas mismas líneas. Un revisor que encuentre esto ahí se contaría como falso positivo.
  - Para decidir: «sin veredicto» va a «Sin verificar» y cuenta. Una lente caída se nombra en el informe («la lente X no
    devolvió»).

- [Importante] `scripts/_lib/revisorPedido.mjs:64` (y la cabecera `:8-9`) · respuesta: arreglado (cuenta tambien un comando que nombra un documento en exports o en la biblioteca; el caso D2 real ahora da aviso; la cabecera dice que no-aplica no prueba que no hubo entrega)
  **El paso del cierre dice «esta sesión no le entregó documentos a Fak» en una sesión que entregó un mail y un Excel
  que Fak devolvió.**
  - Solo cuenta como entrega un `SendUserFile` o un `Write`/`Edit` de un documento.
  - Un mail armado con `scripts/_mails.py` o un Excel armado por Python cae en `no-aplica`, que no es un aviso.
  - La cabecera dice lo contrario («lo que no ve: un documento que arma un script de Python … por eso es aviso»).
  - Caso medido: corrí `relevarRevisorPedido` y `evaluarRevisorPedido` sobre los registros reales de los 4 casos de la
    calibración:
    - D1 (`523e8e4a`): 14 entregas, aviso.
    - A1 (`f8086778`): 1 entrega, aviso.
    - A2 (`d24e5d74`): 2 entregas, aviso.
    - **D2 (`c24ed0c5`, el mail a Federico): 0 entregas, `no-aplica`.** Esa sesión hizo 107 llamadas a Bash, 0
      `SendUserFile`, y nombra 47 veces `Consumo de material.xlsx`.
  - Los mails son uno de los tres tipos de `docs/review/`, y justo D2 es el ejemplo de lo que el revisor tiene que
    frenar.
  - Para decidir: que la falta de entregas vistas, con Bash que escribió en `exports/` o en la biblioteca, o con
    `_mails.py`, sea aviso y no `no-aplica`. O al menos que el detalle diga que el mail y lo armado por Python no se ven.

- [Importante] `scripts/_revisorCalibrar.mjs:49` y `evals/revisor-pedido/casos.json:77` · respuesta: arreglado en parte (la nota de A1 ya no adelanta la pregunta 2; RESULTADOS dice que las 3 corridas de A1 la vieron y que investigador no es revisor-pedido; la carpeta de corridas queda bajo evals/revisor-pedido/, que el prompt prohibe abrir)
  **La calibración le adelanta al revisor una parte de la respuesta en un caso aprobado, y el informe dice que ese caso
  es independiente.**
  - `armarPrompt` le pasa la `nota` del entregable.
  - La nota de A1 dice «la (3) y la (4) son las que ya no tienen la fila de aclaracion». Eso contesta de antemano el
    renglón 3 de la definición de hecho y la pregunta 2 del quiz («¿Hay una fila de aclaración debajo del título?»).
  - Probablemente no movió el veredicto: en la corrida 3 (`a313cf8e`) el revisor abrió el `.xlsx` él mismo con
    openpyxl. Lo que se cae es la afirmación de que A1 es independiente.
  - El test (`__tests__/scripts/revisorCalibrar.test.mjs:24-33`) mira la reacción de Fak, lo esperado y el tipo, no la
    nota.
  - `RESULTADOS_2026-10-17.md:37-38` dice «A1 y A2 son independientes».
  - Hay dos caminos más que el informe no cuenta:
    - **Los prompts y las respuestas comparten carpeta.** `--prompts <carpeta>` y las respuestas `<id>.<n>.txt` van al
      mismo lugar (`:10-15`, `:104`), y el prompt solo prohíbe `evals/revisor-pedido/` (`:52`).
    - **El agente medido no es exactamente el que se entrega.** Las 12 corridas fueron `investigador`, y su definición
      (`~/.claude/agents/investigador.md`) trae escritos en el prompt de sistema `core-prohibiciones.md` §1 y §9 (la
      firma de IA) y otras reglas de la casa. `revisor-pedido.md` los recibe solo a través de `REVIEW.md` (su paso 5
      lo manda ahí, y la falla 3 de REVIEW.md cita §9 y `_sinFirmaIA.py`). RESULTADOS dice «investigador con el
      cuerpo del revisor pegado», pero no esa diferencia. Si cambió el renglón REGLAS DE LA CASA no se midió.
  - Caso medido:
    - En la corrida 3 de D2 (subagente `a643ad27`), el revisor listó `Temp\t9\calib\` y vio los 8 archivos de
      respuestas de las corridas 1 y 2. No los abrió.
    - El `.1.txt` de D2 que estaba ahí ya traía «CONTRA EL PEDIDO: NO CUMPLE (escrito a mano…)» y «caso contaminado».
  - Lo que sí está bien:
    - Las 12 corridas guardadas en `evals/revisor-pedido/corridas/` coinciden con los registros crudos de los 12
      subagentes: los mismos conteos de Importante, Nit y Preexistente, y los mismos veredictos.
    - Ninguno de los 12 prompts lleva la reacción de Fak, lo esperado ni el tipo.
    - La corrida más larga usó 43 turnos, así que `maxTurns: 60` alcanza.
  - Para decidir: sacar de las notas lo que contesta el quiz, escribir las respuestas en otra carpeta, y decir en
    RESULTADOS lo de A1 y lo del `investigador`.

- [Importante] `scripts/_lib/ppm.mjs:25-31` · respuesta: arreglado (la respuesta cuenta solo en el renglon del hallazgo con etiqueta; test: nunca mas respuestas que hallazgos)
  **La columna 6 de la hoja de los viernes («hallazgos del auditor aceptados sobre emitidos») cuenta respuestas sin
  emparejarlas con su hallazgo.**
  - Cuenta por un lado las etiquetas entre corchetes de todo el texto y por otro las respuestas, en negrita o con
    «respuesta:».
  - Caso medido: sobre `docs/auditorias/` de la rama da
    `{"informes":1,"emitidos":3,"respondidos":4,"arreglados":1}`. La hoja imprimiría «1 arreglados de 3 emitidos · 4 con
    respuesta».
  - El único informe con etiquetas es la prueba del diff plantado: sus dos Importante son defectos sembrados a propósito.
  - El único «arreglado» es la fila del hueco del test, que no es un hallazgo etiquetado. Más respuestas que hallazgos,
    y un aceptado que no es de ninguno.
  - Es un número que Fak valida esta semana (`a071276b`).
  - Para decidir: contar solo la respuesta que está en el mismo renglón que su etiqueta (como en la plantilla de
    `auditor.md`), y dejar afuera los informes de prueba. Este informe ya lo hace: cada respuesta va en el renglón de
    su etiqueta.

- [Importante] commits `498bdd8b`, `f7c3e4c2`, `57d5292e`, `20fac8b7`, `0144c962`, `a3e3fbef` y `a043b739` · respuesta: arreglado en el ultimo turno de la hija (renglon de sesiones abiertas de _probarMejora.mjs --sesiones)
  **Ninguno dice si las sesiones abiertas toman el cambio** (REVIEW.md, falla 10; `mejora-implementada.md` paso 2).
  - Qué toca la rama, y qué hace una sesión abierta según la tabla de `mejora-implementada.md` («Que toma sola una
    sesion abierta»):
    - `CLAUDE.md:211` y dos reglas que cargan siempre (`codigo-madre.md:22`, `git-deploy.md:27`): hay que reabrir.
    - Dos reglas con `paths:` (`mejora-implementada.md`, `lecciones-consolidacion.md`): entran al tocar esas rutas; la
      sesión que ya las cargó sigue con la vieja.
    - `auditor.md`, el agente nuevo `revisor-pedido` y la plantilla de encargos (`lineaRevisor`): la tabla no los
      nombra, así que hay que medirlo.
    - Nada de esto existe para ninguna sesión hasta que llegue al checkout principal (lo dice la misma regla).
  - Caso medido: `git log --format=%B main..HEAD | grep -ci "sesiones abiertas|reabrir|toman sol"` da 0.
  - El renglón sale de `node scripts/_probarMejora.mjs --sesiones`. Según la regla y el plan, lo debe la hija en su
    último turno.

## Hallazgos Nit (3 listados, por el tope de REVIEW.md)

- [Nit] `scripts/_lib/retiros.data.json:3` y `scripts/_retirosVencidos.mjs:48` · respuesta: arreglado en parte (el contador lista las razones sin numero, fecha ni incidente: 6 por texto; el criterio mas estricto del auditor, 54, no se mide por texto y queda para la revision de cada pieza)
  **54 de 76 «justifica» no traen un número ni un incidente, y el script dice «Sin razon escrita (0)».**
  - El plan pide `justifica: <número o incidente>`.
  - La nota del propio archivo dice que, donde la cabecera no lo trae, «va TBD». Sin embargo hay 0 TBD, y el contador
    solo mira lo vacío o lo que empieza con TBD.
  - Tres textuales:
    - `hook:_dispatcher`: «Despachador de guardianes PreToolUse (matcher: Bash|PowerShell|Write|Edit). HISTORIA»
    - `hook:apqp-cliente-guard`: «apqp-cliente-guard.sh — wrapper fino. La logica vive en scripts/_lib/guardianes.mjs…»
    - `regla:git-deploy`: «Regla: build + commit + push al cerrar una tarea de codigo»
  - Ningún script escribe el archivo (solo lo leen `_retirosVencidos.mjs` y `_cierreSesion.mjs`), así que la excepción
    de REVIEW.md para los `*.data.json` generados no le aplica.
  - Si el contador tiene que verlo, poner TBD en esos 54.

- [Nit] `.claude/workflows/revision-adversarial.js:95`, `:101` y `:108` · respuesta: arreglado (rutas normalizadas antes de juntar, tope total de 10 agentes tambien con votos > 1 salvo sinTope, maxVerificar >= 0, como mucho 3 nits en el informe; test)
  **La deduplicación, el tope y los nits.**
  - **Deduplicación:** solo junta la misma ruta escrita igual. `./scripts/x.mjs`, `scripts/x.mjs` y
    `C:/Dev/BarackMercosul/scripts/x.mjs` en la misma línea dan 3 Importante y 3 verificadores. En la corrida real las
    lentes escribieron la ruta igual, por eso no se vio.
  - **El tope de 10 agentes vale solo con los valores por defecto:** con `votos: 3` y 6 hallazgos se lanzan 22 agentes.
    Con `maxVerificar: -1`, `slice(0, -1)` verifica 29 de 30.
  - **El tope de 3 nits no se aplica al informe:** 7 nits de las lentes salen los 7.
  - Todo medido con el mismo arnés.

- [Nit] `scripts/_lib/revisorPedido.mjs:32` y `:46` · respuesta: arreglado (revisor solo por su tipo o con el prompt que EMPIEZA con su cuerpo, y solo si corrio despues de la ultima entrega; tests)
  **El paso da `ok` con señales que no prueban que se revisó lo entregado.**
  - Un `Agent` de otro tipo cuyo prompt cita «# Revisor contra el pedido» (un auditor que revisa ese archivo, por
    ejemplo) cuenta como revisor. Medido: `senalesDeLinea` con `subagent_type: 'auditor'` y esa frase en el prompt
    devuelve `revisor: true`.
  - Un revisor que corrió antes de las entregas también vale, porque el orden no se mira.

Y 6 nits más, contados y sin respuesta pedida:

1. `REVISION_diff_plantado…:34,54` etiqueta Preexistente una línea de `revisorPedido.mjs`, que es un archivo nuevo de
   esta rama.
2. El commit `a3e3fbef` dice «ciWorkflows 6/6», pero el archivo tiene 5 tests.
3. `git-deploy.md:27-31` dice «se lee uno por vez», pero muestra solo el `curl` del candado.
4. `chequearRetiros` usa la fecha UTC y el viernes local: después de las 21 h se corre un día.
5. RESULTADOS punto 5 llama «hueco del detector» a algo que es a propósito en `--arreglar`. El detector sí ve los 44;
   lo del contenido se arregla a mano según su cabecera.
6. «De 300 commits solo 1 tocó la app»: medido, son 2 que entran en el filtro, y los dos de configuración. No cambia la
   conclusión.

## Preexistente

- [Preexistente] `…\6- ARCHIVO DE CORREO\ADJUNTOS\INGENIERIA Y PROYECTOS\2026\` · respuesta: no importa para la rama (ya salieron; va a Fak en el cierre: que decida)
  **Los dos adjuntos ya enviados que usó la calibración (A1 y A2) nombran a Claude en partes ocultas.**
  - Archivos: `Codigos y colores Patagonia_20260901 (4).xlsx` (salió el 01/09) y `TryOut_IMG_Dia1a4.pptx` (salió el
    31/08).
  - Caso medido: `python -B scripts/_sinFirmaIA.py <los dos> --sin-avisos` da «revisados: 2 · bloqueantes: 48».
    - En el `.pptx`, 44 textos alternativos con `/home/claude/assets/…`.
    - En el `.xlsx`, el scratchpad en `workbook.xml` y `claude.fileId`.
  - Son anteriores a la regla del 08/10 y ya salieron, así que qué hacer lo decide Fak. Lo encontró la calibración y lo
    dejo confirmado.

## Lo que se verificó y está bien (sin hallazgo)

- **CI:**
  - `combinarCI` y `leerUltimoRunCI`: un candado rojo manda; un deploy que no se puede leer da aviso, nunca verde.
  - Mientras `candado.yml` dé 404 se lee como antes.
  - `deploy.yml` conserva su propio candado y sus cuatro gates.
- **Los pasos nuevos del cierre nunca dan `falta`:** el revisor da aviso, `no-aplica` u ok, y los retiros dan aviso u
  ok. Un error al medir da aviso en los dos (`_cierreSesion.mjs:435-442`, `:463-472`).
- **El brazo «sin» del banco no tiene las reglas:**
  - El hijo del eval corre en un `…\home\cwd` vacío y se le niega la carpeta de arriba.
  - En las 30 corridas del brazo sin no aparecen «Carlos», «Baptista», «Tabla P1» ni «reglas-amfe». En el brazo con
    aparecen (Carlos 18, Tabla P1 6).
  - En el brazo sin no corre el indicador de disparo, porque es solo del brazo con.
  - Los registros (`tracePath`) ya se borraron, así que el prompt de sistema del brazo sin queda sin verificar.
  - Los informes de `docs/evals/` dicen lo que corrió: 3 corridas por brazo, juez con 3 votos y costo 4,91 + 3,83 =
    8,74 USD, como dice el commit.
- **D7:** `--despues` y `--filas` existen y `reapariciones` hace lo que dice la regla.
- **«9 de 47» reproducido:** `_cuatroNumeros.mjs --desde 2026-01-01 --hasta 2026-10-01 --json` da 47 sesiones con
  entregas y 9 con reentrega, sobre 249 sesiones.
- **Hooks Stop:** hoy dan 375 frenos de `cierre-guard`, 252 trabajo y 123 cierres repetidos; racha máxima 8 y 2 topes.
  Contra los 366, 244 y 122 del documento, la diferencia son las sesiones de hoy, porque la ventana llega hasta ahora.
  El 8 sale de `docs/_archive/research-claude-code-2026-07/research_hooks.json`.
- **Banco de AMFE:** el caso `aph-sin-accion` del brazo sin falla por lo que dice, no solo porque no encuentra el
  archivo. Promete «proponer para cada una una acción concreta», y el criterio lo marca incorrecto.

## La prueba de la tanda, según lo medido

| Prueba del plan | Estado |
|---|---|
| El revisor marca los devueltos y pasa los aprobados | Contra el pedido, 12 de 12 con 2 y 2 casos, no 3 y 3. Cuatro corridas se calificaron a mano y hay contaminación: ver el Importante de la calibración. El veredicto final acierta 6 de 12. |
| El banco de 10 casos corre con y sin skill | Corrió y dejó informe. |
| La hoja v0 reproduce el «15 de 54» | **No se cumple:** da 9 de 47, y el commit lo dice. |
| El workflow encuentra los 2 defectos plantados | Sí, corrido a mano porque la herramienta Workflow está bloqueada. |
| `_retirosVencidos.mjs` lista los 2 retiros decididos | Sí. |
| La poda no se aplica sin el A/B | No se aplicó. |

## Para el rol del auditor (sugerencias, no se editó nada)

- Un chequeo que faltaba y sirvió: correr un paso nuevo del cierre sobre los registros REALES de los casos de
  calibración, no solo sobre registros armados. Así salió el `no-aplica` de D2.
- Los pasos de este informe se pueden repetir con los scripts del scratchpad de la sesión `a2cd7649`: `grafo.mjs`,
  `wf.mjs`, `rp4.mjs`, `calibacceso.mjs`, `ppm.mjs` y `appcommits.mjs`.
