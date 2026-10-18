# Auditoría final de la tanda 14 — 17/10/2026

Rama `claude/premortem-tanda14-6443ac`, commits `b59a6b35` (los tres lectores de mails), `a94d598c` (el pre-mortem
verificado) y `8bda1c46` (el paquete por persona), sobre main `87679546`. Auditor: agente `auditor`, solo lectura.

## Resultado: fundir con arreglos · 0 Importante, 9 Nit, 1 Preexistente

No encontré nada que rompa algo ni que afloje un control. Los parsers dan lo correcto sobre la copia real, y ninguna
salida lleva una clave. Los arreglos son tres nits: un test que le falta al parte de INCA, una pieza que `piezaDe()`
junta mal y un número del paquete que la medición no sostiene. Los demás nits van en una tabla.

**Sobre los arreglos.** El encargo me dejaba hacer arreglos chicos, pero mi definición es solo detección por decisión
de Fak. Por eso no edité código, tests ni documentos de la tanda: lo único que escribí es este informe. El parche del
test de INCA está abajo, textual, y lo probé en una copia del scratchpad.

| Control | Estado | Detalle |
|---|---|---|
| TypeScript | OK | `npx tsc --noEmit`: 0 errores |
| Build | OK | `npm run build`: «built in 1m 22s» (solo el aviso de siempre por el tamaño de los archivos del build) |
| Git local | OK | árbol limpio al empezar y al cerrar; los 3 commits tocan solo archivos de la tanda |
| GitHub sync | no aplica | la rama es local y no se sube, como pide el encargo |
| CI | OK (base) | `candado.yml` completed success sobre `87679546` (la base de la rama); `deploy.yml` completed success |
| Tests de la tanda | OK | `npx vitest run` de los 3 tests nuevos + `convencionesScripts`: **40 de 40** |
| Mutantes | 16 de 21 mueren (más el control en verde) | los 5 vivos se explican abajo: M2 (cinturón doble), M15 (equivalente) y M16 (no cambia nada hoy) no son hallazgo; M19 y M20 son el nit 1 y mueren con el parche |
| Claves | OK | 0 apariciones del patrón de la clave en las 3 salidas (la mía y la de `exports/`), en los commits y en los mensajes |
| Repo público | OK | `node scripts/_gateRepoPublico.mjs`: limpio |
| Dependencias | OK | `npm ls --depth=0`: sin UNMET / ERR / missing |
| La copia de mails | sin tocar | md5 de `mails.jsonl` igual al empezar y al cerrar (`c71363c1…`) |

Contexto: mientras auditaba, main sumó 3 commits de documentación (`edc1a5ae`, `5ab27c19`, `44b6b555`). Tocan
`docs/AUTOMATIZACION_PEDRO_TAREA_VIERNES.md`, `docs/COLA_CAMBIOS_CODIGO.md` y `scripts/_lib/retiros.data.json`, ninguno
de la tanda. `git merge-tree` da merge sin conflictos.

## Hallazgos (los 3 con detalle)

### 1. [Nit · ROBUSTNESS] El test de INCA no ve la columna «> 2 Weeks» ni de qué enlace salen las piezas

Dónde: `__tests__/scripts/incaParte.test.mjs` (el código, `scripts/_incaParte.mjs:63-67` y `:43`, está bien).

El código lee bien los 29 partes reales. En el encabezado del mail, `Task description / Supplier / Total / > 2 Weeks*`,
la columna 3 es el Total y la 4 es la de «> 2 semanas». En tres partes los dos números son distintos y lo que sale
coincide:

| Parte | Lo que sale |
|---|---|
| CW14 (01/04) | 6 / 3 |
| CW15 (08/04) | 6 / 4 |
| CW29 y CW30 (15 y 22/07) | 6 / 1 |

Las piezas salen del primer enlace (el del Total). El problema es que ningún test lo fija. En los casos de muestra, los
dos números o son iguales o el «> 2» no se compara. Medido con mutantes, en una copia del scratchpad con el vitest del
repo:

- **M19**: «> 2 semanas» lee la columna del Total → **vive** (0 de 37 en rojo).
- **M20**: las piezas salen del último enlace (el de «> 2 semanas») → **vive** (0 de 37 en rojo).

M20 sí cambia la salida real: corrido sobre la copia de mails, la tabla del último parte pasa de esto…

```
| 2HC858417D | 01/04/2026 | 26 de 29 |        ->  | 2HC858417D | 08/04/2026 | 23 de 29 |
| 2HT881901E | 01/04/2026 | 26 de 29 |        ->  | 2HT881901E | 15/04/2026 | 22 de 29 |
| 2HT881901E_OHE | 11/03/2026 | 29 de 29 |    ->  | 2HT881901E_OHE | 11/03/2026 | 27 de 29 |
```

…y los 37 tests siguen en verde.

**Parche** (un `it` más dentro de `describe('leer un parte')`, sin tocar `lectoresMailTanda14.casos.json`, cuyos ids y
el «3 partes» usan otros tests):

```js
    it('Total y «> 2 Weeks» son dos columnas, y las piezas salen del enlace del Total (forma del parte CW14 del 01/04: 6 y 3)', () => {
        const enlace = (pzs) => `<https://lso.volkswagen.de/inca/x?command=findTLKs&tlks=${pzs.map((p) => `_${p}`).join(',')}&duns=1>`;
        const seis = ['2HT881901E_OHE', '2HT853839', '2HC858417D', '2HT881901E', '2HT881901D', '2HT881901D_YZM'];
        const tres = ['2HT881901E_OHE', '2HT853839', '2HT881901D_YZM'];
        const cuerpo = [
            'this is your weekly INCA status report from Wednesday 01. April 2026, 06:48.',
            'Task description\tSupplier\tTotal\t> 2 Weeks*\t',
            `Parts to be assigned to BKA\t978890452 - Barack Argentina SRL\t6 ${enlace(seis)}  \t3 ${enlace(tres)}  \t`,
        ].join('\n');
        const p = leerParte({ fecha: '2026-04-01 01:48', asunto: 'INCA: weekly status report CW 14.2026', cuerpo });
        expect(p.sinBka).toEqual({ total: 6, masDeDosSemanas: 3, piezas: seis });
    });
```

Lo probé en la copia, con el parche puesto:

- M0 (control, sin mutar): **verde, 38 de 38**.
- M14 (Total y «> 2» cruzados): **muere** (2 en rojo).
- M19: **muere** (1 en rojo).
- M20: **muere** (1 en rojo).

respuesta: aplicado tal cual en `__tests__/scripts/incaParte.test.mjs` (commit `6061fd70`), más un caso de un `%` mal formado (nit 7).

### 2. [Nit · ROBUSTNESS] `piezaDe()` junta dos estanterías distintas en la pieza «estanteria»

Dónde: `scripts/_adjuntosIndice.mjs:46` (`VERSION_FINAL` saca un número suelto del final) y `:53-58`.

Los dos archivos son de Pablo Gamboa, del 21/08, y son estanterías distintas:

- `ESTANTERIA.rar`, del mail «ESTANTERIA DE CAJAS» (11:19).
- `ESTANTERIA-1.rar`, del mail «ESTANTERIA IP Y TOP ROLL» (12:19).

Los dos dan `piezaDe() = "estanteria"` (medido: `piezaDe('ESTANTERIA.rar')` y `piezaDe('ESTANTERIA-1.rar')` →
`estanteria | estanteria`). En la tabla «Por pieza — comprimidos» quedan como dos versiones de una sola pieza. La tabla
de piezas no muestra el asunto; el detalle sí.

Sobre la copia real hay **18 de 265 piezas** que juntan más de un nombre de archivo. Las demás son versiones legítimas:
rev22/rev25, fechas, «corregido», `TOPE TOP ROLL 2A…10B`, «PATTERN CHINA 20251217 R13».

No hay un arreglo obvio: el «-1» también es la marca de versión de `ESTANTERIA INSERTO -1.rar`, el caso que motivó la
herramienta. Dos ideas: mostrar el asunto del primer mail en la tabla de piezas, o no sacar un número suelto cuando los
asuntos de los mails difieren.

El caso conocido sale bien: `--buscar "estanteria inserto"` trae exactamente dos mails, 25/08 16:02
(`ESTANTERIA INSERTO -1.rar`) y 28/08 16:45 (`ESTANTERIA ARMADA ESPUMA INSERTO.rar`). En la copia cruda, todas las
carpetas, no hay otro.

respuesta: aplicada la primera idea: la tabla por pieza muestra los asuntos de los mails al lado (sin «RE:»), con su test (commit `6061fd70`). `piezaDe()` no se cambió: el «-1» sigue siendo la versión de la estantería del inserto.

### 3. [Nit] El paquete dice que a Carlos «le llegan 23» de los 91 mails de Pablo con 3D: son 46

Dónde: `docs/TANDA14_PAQUETE_POR_PERSONA_2026-10-17.md:118-120` («23 van a Carlos (22 de ellos con Fak en copia)…
medido, no es así») y `:139` («le llegan 23 de los 91 mails de Pablo con 3D»).

Lo reconté con `leerMails` y `filasDeAdjuntos` de la tanda:

| Qué | Cuántos |
|---|---|
| Filas del índice | 425 |
| De Pablo | 193 |
| De Carlos | 58 |
| Mails de Pablo con esos adjuntos | 91 |
| Con Fak en «Para» o en copia | 91 |
| Carlos en «Para» | 23 (22 de ellos con Fak en copia) |
| Carlos **solo en copia** | **23** |
| Fak en «Para» | 26 |
| Fak solo en copia | 65 |

Entonces:

- A Carlos le llegan **46** de los 91, no 23.
- Fak está solo en copia en 65 de los 91: esa mitad del informe D («con Fak en copia») era cierta, y el «medido, no
  es así» exagera la corrección.
- El título de la sección sigue siendo cierto: a Fak le llegan 91 y a Carlos 46.

respuesta: corregido en el paquete: 91 mails de Pablo con 3D; Fak en los 91 (26 en «Para», 65 solo en copia); Carlos en 46 (23 y 23). Medido de nuevo con los lectores de la tanda.

### Y 6 nits más (sin detalle)

| # | Clase | Dónde | Qué pasa · caso medido | respuesta |
|---|---|---|---|---|
| 4 | ROBUSTNESS | `scripts/_adjuntosIndice.mjs:31-33` | `.jt` y `.tar` no entran: `tipoAdjunto('x.jt')` y `tipoAdjunto('x.tar')` dan `null`. En la copia hay 5 `.jt`. Cuatro son del mail de Fak del 02/09/2025 15:37, «Conjunto tela FSC RH / LH P2X (208) 2D Y 3D»: ese mail **no aparece en el índice** (sus 2D son PDF). El quinto `.jt` es del mail del MQB, que sí entra por `.stp`/`.igs`. También falta un `.tar` de VW (`2HT_853_839…SCHEUERSCHUTZFOLIE….tar`, 09/12/2024), que no aparece. `.jt` no estaba en la lista pedida. Si se suma, cambian los números 306/119/425/193/58/91 que cita el paquete | aplicado: `.jt` y `.tar` entran (commit `6061fd70`); los números del paquete pasan a 311 + 120 = 431 |
| 5 | TRUE BUG sin efecto hoy | `scripts/_plannerCarlos.mjs:63` y `:88` | Dos formas del castellano de Planner (2023) que el parser no reconoce. El encabezado «Tiene una tarea vencida hoy» no es «vence hoy»: la tarea queda «sin seccion» (2 avisos). «1 día de retraso» no da `dias` (2 renglones). No mueven ninguna cifra: solo «vencida» suma, y los dos son del plan «Tareas», cuya tabla no muestra el atraso | aplicado: «vencida hoy» y «de retraso», con test (`diasDeAtraso`, commit `6061fd70`) |
| 6 | ROBUSTNESS | `scripts/_incaParte.mjs:169` | El renglón de consola imprime `u.sinBka.piezas` sin `taparClaves()`. Las piezas salen de un enlace de VW, así que el riesgo real es nulo. Pero el encabezado de `_lib/lectorMails.mjs:12` dice «todo texto que sale de un mail pasa por `taparClaves()`», y en este renglón no es cierto | aplicado: el renglón de consola pasa por `taparClaves()` |
| 7 | ROBUSTNESS | `scripts/_incaParte.mjs:43` | `decodeURIComponent` sobre el renglón entero tira con un `%` mal formado (`piezasDelEnlace('… a=100%&tlks=_A …')` → `URIError: URI malformed`) y frena el script entero. Los 29 partes reales pasan | aplicado: se decodifica solo el valor de `tlks`, con try; test del `%` mal formado |
| 8 | dato del documento | `docs/TANDA14_PAQUETE_POR_PERSONA_2026-10-17.md:162` | «las 6 piezas que VW ve sin acuerdo de capacidad desde abril»: 3 están desde el 11/03, el primer parte de la copia (`2HT881901D_YZM`, `2HT853839` y `2HT881901E_OHE`, 29 de 29 partes). Las otras 3 están desde el 01/04. Como grupo de 6 es desde el 01/04 | corregido en el paquete: 3 desde el 11/03 y 3 desde el 01/04 |
| 9 | datos del documento (menores) | los dos documentos | **Pre-mortem, fila 9:** la tanda 3 se fundió a las 05:56 (el documento dice 05:58). **Fila 10:** la tanda 5 se fundió a las 10:30, con el push a las 10:40 (el documento dice 10:33). Las dos horas salen del reflog de `main`. **Fila 9:** «Versión 15/10 13:55» va entre comillas, pero el renglón dice «Versión del prompt: 15/10 13:55». **Paquete:** Carlos tiene 279 mails desde el 01/06 con la regla de repetidos de la tanda (278 en la Bandeja + 1 en Eliminados, «RV: Seguimiento Proyectos» del 12/06), no 278 (`:109`). Los 109 avisos van del 03/10 (PRUEBA-NUBE-01), no del 04/10 (`:13`). «PD270 lo usan 11 productos» (`:83`): la lista de 11 incluye al propio PD270 y a 3 semielaborados | corregidos los cinco datos (horas del reflog, cita del prompt, 279 mails, 03/10, PD270 en 11 códigos con él mismo y 3 semielaborados) |

## Preexistente

- [Preexistente] `eslint` sale 0 sobre los 4 `.mjs` y los 3 tests, pero `npx eslint --print-config scripts/_incaParte.mjs`
  da **0 reglas**: en este repo eslint no revisa los `.mjs`. No es de la tanda.

## Lo que no es hallazgo (para que nadie lo reabra)

- **M2 vivo** (`escribirSalida()` sin `taparClaves`): es el segundo cinturón. Todo texto libre que sale de un mail ya
  pasa por `celda()`. M1 (`celda()` sin tapar) muere con 3 tests de claves en rojo, y M3 (los dos sin tapar) con 6.
- **M15 vivo** (los RE y RV cuentan como parte): es equivalente. El remitente exacto, `inca-mail@volkswagen.de`, ya deja
  afuera los de Carlos.
- **M16 vivo** (fecha de llegada en vez de la del parte): en los 29 partes reales caen el mismo día.
- **`claveMail` junta 9 pares de «New Delivery Schedule»** (`Info@vwgroupsupply…`, el mismo minuto, la misma carpeta).
  Difieren solo adentro del enlace (`1a diferencia … dentro de enlace: true`). No tienen adjuntos ni son de Planner o
  INCA: no tocan a ninguno de los tres lectores. Queda un riesgo latente, con 0 casos hoy: dos tareas de Planner con el
  **mismo título**, asignadas en el mismo minuto, se juntarían, porque el id está en el enlace que la clave saca.
- **Las salidas no están ignoradas en main hasta que se funda** (el `.gitignore` nuevo vive en la rama): son datos de la
  empresa, y por decisión de Fak eso no es hallazgo.
- **«38 tareas daban 29»**: con la clave vieja (fecha + remitente + asunto) medí 37 tareas, de las cuales **29** tienen
  aviso de asignación. Cierra con lo que dice el documento si se cuenta como el informe D.

## Cómo se midió

### Los parsers contra la copia real

Los tres scripts corrieron con `--out` a mi carpeta temporal y dieron lo mismo que el documento. Mis salidas son
idénticas byte a byte a las de `exports/` (`diff -q` vacío):

- `_adjuntosIndice`: 306 de diseño y 119 comprimidos, de 5.909 mails sin repetir.
- `_plannerCarlos`: 38 tareas de «Actividades Ingenieria», 58 avisos de asignación, 76 mails de vencimientos y 152
  renglones de vencida.
- `_incaParte`: 29 partes; el del 14/10 trae 6 piezas.

**Fechas del Planner, mes/día contra día/mes.** Para cada renglón de cada aviso de vencimientos (134 avisos crudos, todas
las carpetas) comparé los días entre la llegada del mail y el vencimiento parseado contra el texto del propio aviso
(«N days late», «Due in N days», «vence hoy»). **313 de 315 cierran y 0 no cierran.** Los 2 sin texto son los
«vencida hoy» en castellano del nit 5, con diferencia 0. En las 58 asignaciones, ningún vencimiento cae fuera de −1…60
días de la llegada.

Filas que miré contra el crudo:

- «Telas Nuevas PWa 21-9694 y 21-9695»: aviso del 08/07, `7/1/2026 · 7 days late` → vence el 01/07.
- Las dos «lista maestra» del 19/05: KKHG «vence hoy» el 21/05, sin aviso del 22 al 27 y «7 days late» el 28/05. Así lo
  mandó Planner, y la salida lo copia fiel.
- «PPAP HEADREST»: vence el 18/05 (antes el 07/05), con 12 avisos.

**La clave de repetidos (`claveMail`), sobre los 6.165 renglones:**

- 155 no cuentan: 119 Borradores, 33 Correo no deseado y 3 Bandeja de salida.
- Quedan 5.909 claves.
- 83 grupos juntan más de un renglón:
  - 63 son copias con el mismo cuerpo en la misma carpeta: repetidos reales.
  - 9 son los «New Delivery Schedule» de arriba.
  - Los demás son copias del mismo mail en carpetas distintas, con el mismo cuerpo.
- Queda **1 solo par sin juntar**: el 15/10/2024 08:32, «RV: Nueva referencia APC Trasero lateral…», Enviados contra
  Eliminados, con «Para» distinto.
- Los 134 avisos de Planner no tienen repetidos (134 crudos = 134 contados).

**El renglón «Parts to be assigned to BKA» de INCA.** Volqué los 29 partes: todos de `inca-mail@volkswagen.de` y todos en
la Bandeja. Las columnas de cada uno coinciden con el encabezado del mail (ver nit 1). El rojo B00000330933 «ARMREST REAR
/ 2HC885081» aparece en 17 partes, del 15/04 al 26/08. A la copia le faltan los partes del 27/05, el 03/06 y el 10/06:
es la copia, no el parser.

**Mutantes.** 21 mutantes (M1 a M21) más el control M0, sobre una copia en el scratchpad, con `node_modules` por enlace
(junction) y vitest con `globals`; el worktree no se tocó. Mueren 16; viven 5 (M2, M15, M16, M19 y M20).

| Mutante | Resultado |
|---|---|
| M0 control | verde, 37 de 37 |
| M1 `celda()` sin tapar | muere (3) |
| M2 `escribirSalida()` sin tapar | vive (cinturón doble) |
| M3 los dos sin tapar | muere (6) |
| M4 clave sin cuerpo | muere (3) |
| M5 clave sin destinatario ni adjuntos | muere (1) |
| M6 Borradores cuentan | muere (1) |
| M7 se queda la copia de Eliminados | muere (1) |
| M8 inglés leído día/mes | muere (5) |
| M9 castellano leído mes/día | muere (1) |
| M10 toda sección es vencida | muere (2) |
| M11 lo de Enviados no es de Fak | muere (2) |
| M12 comprimido = diseño | muere (3) |
| M13 `piezaDe` no saca la versión | muere (2) |
| M14 Total y «> 2» cruzados | muere (1, de rebote) |
| M15 los RE y RV cuentan | vive (equivalente) |
| M16 fecha de llegada | vive (no cambia nada hoy) |
| M17 no avisa si el número no coincide | muere (1) |
| M18 una opción desconocida pasa | muere (1) |
| M19 «> 2» lee el Total | **vive** (nit 1) |
| M20 piezas del último enlace | **vive** (nit 1) |
| M21 sin el encabezado «retrasada» | muere (1) |

### Claves

Busqué el patrón de la clave en tres lugares:

- En las 3 salidas reales (la mía y la de `exports/`): 0, y tampoco «[clave retirada]», porque no había ninguna.
- En el diff de la tanda: solo aparece adentro de los `expect(...).not.toMatch(...)` de los tests.
- En los mensajes de los 3 commits: 0.

Los casos de muestra llevan `{{CLAVE_FALSA}}`, y la clave falsa la arma cada test por código. El filtro de Planner
(`esAvisoPlanner`) y el de INCA (remitente exacto) no dejan entrar el cuerpo del mail de Pedro. El índice de adjuntos lee
cuerpos solo para la clave de repetidos, en memoria, y no los escribe. El cuerpo de ese mail no se imprimió ni se leyó
a mano en esta auditoría: los scripts de conteo lo pasaron por la clave de repetidos en memoria, igual que el lector de
la tanda. Lo único que miré de él es la fecha y que el asunto está vacío.

### Los documentos

**Pre-mortem: 10 filas muestreadas, todas ciertas salvo lo del nit 9.**

1. `__tests__/mods/presupuesto-agentes.test.mjs:89` es el test del 61 %, y `83bd4d7a` está en main. La cita de la
   memoria del plan («Cupo 13:50: 5 h 32 %, semana 49 %») está en su renglón 15.
2. `_dispatcher.sh:30-31` y `:85` dicen lo que el documento cita. **Medido en una copia con `guardianes.mjs` roto:**
   - Bash → exit 2 («[GUARDIANES] no pude correr … SyntaxError»);
   - Edit sobre `guardianes.mjs` → exit 0;
   - Edit sobre otro archivo → exit 2.
   `docs/PLAN_GUARDIANES_2026-10-16.md:39` existe. **El procedimiento fijo, corrido tal como está escrito desde la rama:**
   `node --check` da exit 0 y el despachador con `echo hola` da exit 0.
3. `esCorreccion()` (`correccionGuard.mjs:90`) da `false` a las dos frases. Como control, «otra vez lo mismo, ya te lo
   dije» da `true`. `_cuatroNumeros.mjs` no tiene las 3 filas. `PLAN_METODO` no habla de calibrar el sensor.
4. `~/.claude/settings.json` no tiene `MAX_SUBAGENT_SPAWN_DEPTH`. `techo-agentes.md:20` dice «La profundidad de
   lanzamiento queda en su default 3 por el ritual del viernes».
5. `lanzar-sesion-hija/SKILL.md:29-31` dice que los comandos van en un archivo. `d1a2adf1` está en main. En
   `coordinadorCanon.data.json` (`plantillaArranque`, renglón 229) no aparecen «literal», «archivo adjunto» ni «objeto
   del trabajo»: la falta que dice el documento es cierta.
6. `bambu_red.py:920` (`OK_FAK_MINUTOS = 180`), `:1057-1071` (`falta_ok_de_fak`) y `test_bambu_red.py:776` existen.
   `3755a439` está en main. `757cc628` y `f68394b3` **no** están en main: están en `claude/awesome-gould-9290b2`, 8
   commits por delante, abierta en su worktree. `_imprimir.py:95-99` es el freno de hojas con rojo.
7. `Prompt:22` («insistirle a Carlos»). `node scripts/_seguimientos.mjs`: «Seguimientos abiertos al sabado 2026-10-17: 0».
8. Los 7 renglones del EPP en los generadores y `armar_deck.py:48` coinciden. El `try` de
   `generar_hojas_img_a3.py:162-168` envuelve solo `gate_redaccion`. Los one-shots (`:573`, `:557`) y
   `datos_comunes.py:34` coinciden. `hojasEppDeclarado.test.mjs` da 13 de 13.
9. `Plan:165` (263 / 51 / 71). En el prompt: `:55` («141 sin determinar no cambian», «los 4 sin sí en un worktree»),
   `:75` («los aflojes entran a `main`»), `:11` («tandas 0 a 10») y `:3` (la versión del prompt).
10. `MEMORY.md:96` marca «(LEER PRIMERO)» y sigue diciendo «rama sin fundir» para la tanda 5.

En la tabla «Lo que no coincide»:

- `CLAUDE_CODE_SUBAGENT_MODEL = claude-sonnet-5-5`.
- Las 7 definiciones de agentes llevan `model`, `effort` y `omitClaudeMd: true`. Cinco tienen `maxTurns` y `auditor` /
  `auditor-cliente` no tienen tope.
- La skill `hojas-de-proceso` tiene 394 renglones, con último commit `4772019e`.

**Paquete: 9 afirmaciones muestreadas.**

- **Federico: 20 mails desde el 01/06, todos con Fak en «Para».** Los 12 de BOM y los 8 restantes son los que lista el
  documento, uno por uno.
- **Pedro.** Mandó 3 mails desde 2025: 10/04/2025, 15/05/2025 y 09/10/2026 (este con el asunto vacío). Aparece en 105
  mails de 2026.
- **Avisos de los asistentes.** Hay 109 en total por carpeta de PC: 25 + 9 + 3 + 51 + 20 + 1. Lo que dice el documento
  para cada uno:
  - Federico, 51 avisos: `pc` 14 + `manejo-pc` 9 = 23; `derivo` 10; `servidor` 8; `office` 4; otros 6.
  - Carlos, 25 avisos: `derivo` 9, «sobre la PC» 7, otros 4, `imprimir` 2, `servidor` 2, `office` 1.
  - Pedro, 3 avisos, todos del 05/10.
- **Optitex.** El listado coincide en nombres, tamaños (92.919.938 y 72.047.219 bytes; 4 × 6.220.854) y fechas. El
  `.txt` de 214 bytes trae los pasos 5 a 9 y el F7.
- **`_consumo.py` sobre `C:\tmp\RELACIONES.TXT`** (13/10 08:42, el sello avisa «PUEDE ESTAR VIEJO»):
  - `PD270` lleva 0,03 KG de sí mismo (ver nit 9);
  - `APLIX-A999R8395` lleva 1 rollo de `APLIX ROLLO`;
  - `--export` y `--donde-se-usa` existen.
- **Memoria:** el «144 insumos» (`reference_arb_export_estructura`), el «858 sub-ensambles»
  (`reference_arb_local_cache`, renglón 38) y el «6,21 min/pieza» (`project_p21_tiempos_balanceos`) están donde dice el
  documento.
- **Las herramientas** dan los números de la tabla del principio: 306 / 119, 38, 33, 08/07, 29 partes y 17 en rojo.

No verificable desde acá: las skills de la cuenta de claude.ai (punto «Foto a tabla») y lo de CATA.

### Convenciones

- Sin shebang: los 4 `.mjs` arrancan con `/**`.
- Sin `as any` ni `@ts-ignore` en el diff.
- `convencionesScripts.test.mjs` en verde.
- `logger` no aplica: son scripts de consola.
- Los commits se hicieron con rutas: la transcripción muestra `git commit … -- scripts/_lib/lectorMails.mjs
  scripts/_adjuntosIndice.mjs …`, y cada commit trae solo archivos de la tanda.
- Ningún hook, regla ni `CLAUDE.md` tocado.

## Ronda 2 (diff d8211553..3f0a5d44)

Revisé solo el diff nuevo: `6061fd70` (los arreglos en los tres lectores y sus tests) y `3f0a5d44` (los dos documentos
y las respuestas de arriba). Es la segunda y última ronda: lo que quede abierto va al cierre para Fak.

### Resultado: fundir · 0 Importante, 3 Nit (y 1 más), 0 Preexistente

Los arreglos hacen lo que dicen. Los 9 nits de la ronda 1 quedaron aplicados o corregidos, y M19 y M20 ahora mueren.
Los números nuevos de los documentos salen de correr los lectores. Ninguna salida lleva una clave ni la palabra Claude.
Quedan 3 nits chicos y uno más, de un mensaje de commit. Ninguno frena la fusión.

| Control | Estado | Detalle |
|---|---|---|
| Tests de la tanda | OK | `npx vitest run` de los 3 tests + `convencionesScripts`: **46 de 46** (en la ronda 1 eran 40) |
| TypeScript | OK | `npx tsc --noEmit`: 0 errores |
| Build | OK | `npm run build`: «built in 35.76s» |
| Git local | OK | árbol limpio al empezar; el único commit mío es esta sección |
| Fundir | OK | `git merge-tree` contra main `44b6b555`: sin conflictos |
| Mutantes | OK | M19 y M20 mueren. De 15 mutantes nuevos sobre el código de esta ronda, mueren 11 (detalle abajo) |
| Claves y «Claude» | OK | 0 en las 3 salidas. `python scripts/_sinFirmaIA.py`: 0 bloqueantes y 0 avisos en las 3 |
| La copia de mails | sin tocar | md5 de `mails.jsonl` igual que en la ronda 1 (`c71363c1…`), al empezar y al cerrar |

### Lo que pidió el encargo, punto por punto

**1. Los tests.** Los 3 de la tanda más `convencionesScripts`: 46 de 46. Son 6 `it` nuevos (con 17 `expect`).

**2. M19 y M20.** Armé una copia en el scratchpad con los archivos de `HEAD` (`git show`), `node_modules` por enlace
(junction) y vitest con `globals`. El worktree no se tocó.

| Mutante | Resultado |
|---|---|
| M0 control | verde, 43 de 43 (los 3 tests, sin `convencionesScripts`) |
| M19 «> 2 semanas» lee la columna del Total | **muere** (1 en rojo) |
| M20 las piezas salen del último enlace | **muere** (1 en rojo) |

**3. `huecos()`.** Lo corrí con casos armados a mano:

| Caso | Lo que da |
|---|---|
| Dos partes el mismo día, y después uno a la semana | ninguno |
| Tres semanas seguidas | ninguno |
| Dos partes en orden inverso (sin pasar por `historia`) | ninguno |
| Los mismos dos, por `historia()` (que ordena) | 27/05, 03/06 y 10/06 |
| Miércoles a jueves de la semana siguiente (8 días) | ninguno |
| Miércoles a miércoles de dos semanas (14 días) | el miércoles del medio |
| Cruce de año: 24/12/2025 a 14/01/2026 | 31/12 y 07/01 |
| Un solo parte, o ninguno | ninguno |

En la salida real (`node scripts/_incaParte.mjs --out <scratchpad>`), el aviso dice «Partes que faltan en la copia (el
parte sale cada miercoles): 27/05/2026, 03/06/2026, 10/06/2026. Las cuentas de «partes» de abajo son de los 29 que
estan». Los 29 partes reales caen en miércoles (29 de 29) y ninguno repite fecha.

El «17 partes, no 17 semanas corridas» del paquete cierra así: del 15/04 al 26/08 hay 20 miércoles; menos los 3 que
faltan, quedan 17. O sea, el B00000330933 estuvo en rojo en todos los partes de la copia entre esas dos fechas.

**4. Los números de los documentos, corridos.** Los tres lectores con `--out` a mi carpeta temporal. Las tres salidas
son idénticas byte a byte a las de `exports/` del checkout principal (de las 20:44 y 20:45). Para lo que no imprime un
lector, armé una sonda que importa los mismos módulos del worktree e imprime solo conteos, sin ningún cuerpo de mail.

| Dato del documento | Medido | Cómo |
|---|---|---|
| 311 adjuntos de diseño + 120 comprimidos = 431 | 311 + 120 = 431 | `_adjuntosIndice.mjs --out` |
| Pablo mandó 193, Carlos 58 | 193 y 58 | `filasDeAdjuntos` por remitente |
| 91 mails de Pablo con 3D; Fak en los 91 (26 en «Para», 65 solo en copia) | 91; 26 + 65; 0 sin Fak | `para` y `cc` de esos 91 |
| Carlos en 46 (23 en «Para» y 23 en copia) | 23 + 23 = 46 | ídem |
| El mail del 02/09/2025 «Conjunto tela FSC RH / LH P2X (208) 2D Y 3D» entra por `.jt` | entra, con sus 4 `.jt` | salida del índice |
| ESTANTERIA.rar y ESTANTERIA-1.rar con sus asuntos al lado | «ESTANTERIA DE CAJAS»; «ESTANTERIA IP Y TOP ROLL» | salida del índice |
| 38 tareas, 33 con aviso de vencida, último el 08/07; 76 mails de vencimientos | 38; 33; 08/07/2026; 76 (con 152 renglones de vencida) | `_plannerCarlos.mjs --out` |
| El «50» del informe D | 50 mails en inglés de vencida, pero ver el nit 2 | encabezados de los 76 mails |
| 279 mails de Carlos desde el 01/06, uno en Eliminados | 279, pero ver el nit 3 | `leerMails` por remitente y carpeta |
| 29 partes; 3 piezas desde el 11/03 y 3 desde el 01/04 | igual | `_incaParte.mjs --out` |
| Tanda 3 fundida a las 05:56; tanda 5 a las 10:30 y push a las 10:40 | 05:56:00; 10:30:31; push 10:40:44 | `git reflog show main` y `origin/main` |
| Punto 5 de Federico: 9 afirmaciones = 7 sí, 1 no, 1 a medias; y 2 que faltan | 7 «Sí», 1 «No», 1 «A medias» y 2 «Falta» | conté la columna «¿Coincide?» de la tabla |

**Viejo contra nuevo.** Corrí también las versiones de `d8211553` sobre la misma copia y comparé:

- **INCA:** cambian solo el aviso de los partes que faltan y la frase del comprador. Las tablas son iguales: leer el
  enlace sin decodificar el renglón entero no movió ninguna pieza.
- **Planner:** la salida es idéntica byte a byte. Es lo esperado: el nit 5 no movía ninguna cifra.
- **Índice:** sacando la columna nueva de asuntos, el `diff` marca 21 renglones (cuenta el viejo y el nuevo de lo que
  cambió), y todos se explican:
  - los 4 del resumen: 8 renglones, 4 viejos y 4 nuevos;
  - las 4 filas `.jt` del 02/09/2025;
  - la fila del MQB, que suma su `.jt`: 2 renglones, la vieja y la nueva;
  - la fila del `.tar` de VW (09/12/2024);
  - y sus 6 renglones de detalle.

  8 + 4 + 2 + 1 + 6 = 21.

  Facundo Santoro pasa de 83 a 87 (los 4 `.jt`). Nada más se movió.

**5. Claves y la palabra Claude.**

- En las 3 salidas: 0 apariciones del patrón de la clave, 0 «clave retirada» y 0 «claude». El detector de la casa da 0
  bloqueantes y 0 avisos en las tres.
- En los renglones que agrega el diff: 0 apariciones del patrón de la clave, y tampoco en los mensajes de los 2 commits.
- «claude» aparece 3 veces en los renglones agregados, todas en el paquete:
  - la ruta de la carpeta `_CUARENTENA_CLAUDE POR AREA`, que ya estaba (el renglón cambió por la fecha 03/10);
  - la ruta del repo `.claude/skills/`;
  - el nombre de la plataforma, `claude.ai`, en la ficha de «foto a tabla».

  Las 3 están en un documento del repo para Fak, no en un entregable de Barack: no es hallazgo.
- El cuerpo del mail de Pedro del 09/10 no se abrió ni se imprimió. Las sondas de conteo pasan por `leerMails`, que
  arma la clave de repetidos en memoria, igual que en la ronda 1. El filtro del Planner no lo deja entrar.

**Mutantes nuevos, sobre el código de esta ronda** (misma copia, uno por vez):

| Mutante | Resultado |
|---|---|
| M22 `huecos`: umbral de 7 días en vez de 8 | vive (equivalente: con 8 días el bucle no agrega nada igual) |
| M23 `huecos` incluye el día del parte siguiente | muere (1) |
| M24 `huecos` siempre vacío | muere (2) |
| M25 sin el aviso de los partes que faltan | muere (1) |
| M26a vuelve a decodificar el renglón entero | muere (1) |
| M26b sin el `try` al decodificar el valor de `tlks` | **vive** (nit 1) |
| M27 separa solo por coma, sin `%2C` | **vive** (nit 1) |
| M28 el renglón de consola de INCA sin `taparClaves` | vive (sin test; ver abajo) |
| M29 `diasDeAtraso` sin «de retraso» | muere (1) |
| M30 el encabezado sin «vencida hoy» | muere (1) |
| M31 `diasDeAtraso` toma el primer número del renglón | muere (1) |
| M32 el asunto sin sacarle el «RE:» | muere (1) |
| M33 la columna de asuntos vacía | muere (1) |
| M34 sin `.jt` | muere (1) |
| M35 sin `.tar` | muere (1) |

### Hallazgos de la ronda 2

**1. [Nit · ROBUSTNESS] El arreglo del nit 7 está probado en una sola dirección.**
Dónde: `__tests__/scripts/incaParte.test.mjs:59` y `scripts/_incaParte.mjs:51`.

El test nuevo pone el `%` mal formado **afuera** del valor de `tlks` (`a=100%&tlks=_A1,_B2`). Eso mata a M26a (volver a
decodificar el renglón entero), pero el `catch` no corre nunca. Por eso viven dos mutantes:

- M26b: sin el `try`, un `%` mal formado **adentro** del valor frena el script.
- M27: separar solo por coma. Solo importa cuando el `catch` corrió.

El código anda bien:

- `piezasDelEnlace('6 <https://x/inca?tlks=_A1%2C_B2%ZZ&duns=1>')` da `["A1","B2%ZZ"]`, sin tirar error.
- Con `_A1%2C_B2`, da `["A1","B2"]`.

Riesgo bajo: los 29 partes reales no tienen un `%` así. Lo que falta es un `expect` con el `%` adentro del valor.

respuesta: ____

**2. [Nit · dato del documento] «los 50 mails en inglés «You have late tasks»».**
Dónde: `docs/TANDA14_PAQUETE_POR_PERSONA_2026-10-17.md:25`.

Conté los encabezados de los 76 mails de vencimientos:

- 34 dicen «You have late tasks».
- 16 dicen «You have a late task».
- 3 en castellano dicen «Tiene una tarea retrasada».

El 50 está bien como «mails en inglés con tareas vencidas». La frase entre comillas, en cambio, es la de 34. El total
de 76 también cierra.

respuesta: ____

**3. [Nit · dato del documento, sobre un número que propuse yo en la ronda 1] Los 279 de Carlos incluyen un aviso de
Teams.**
Dónde: `docs/TANDA14_PAQUETE_POR_PERSONA_2026-10-17.md:120`.

Medido por remitente y carpeta desde el 01/06:

- 277 de «Carlos Baptista» en la Bandeja;
- 1 de él en Eliminados (12/06, «RV: Seguimiento Proyectos»);
- 1 de «Carlos Baptista en Teams» en la Bandeja.

Los «278 de la Bandeja» del documento cuentan ese aviso de Teams. El 279 sale de mi nit 9 de la ronda 1, que lo contó
igual sin decirlo. No cambia el «el que más le escribe». Si se cuenta solo el remitente «Carlos Baptista», son 278
(277 + 1).

respuesta: ____

**Y 1 nit más:** el mensaje de `6061fd70` dice «9 tests nuevos» y son 6 (`it`): de 40 a 46 con `convencionesScripts`,
de 37 a 43 en la copia. No se arregla sin reescribir la historia.

### Lo que no es hallazgo en esta ronda (para que nadie lo reabra)

- **M22 vive:** es equivalente (ver la tabla).
- **M28 vive:** el renglón de consola de INCA no tiene test, pero las piezas salen de un enlace de VW, así que el riesgo
  es nulo. Además, el cambio aprieta, no afloja.
- **`huecos()` y un parte corrido de día:** si un parte llegara un viernes, 9 días después del anterior, `huecos()`
  daría como faltante el miércoles del medio. Eso es lo que dice su comentario: «un salto de mas de 8 dias es un parte
  que no esta». Hoy hay 0 casos: los 29 partes son de un miércoles.
- **«El parte dice que ahi INCA le avisa al comprador de VW»:** el pie del parte dice «The responsible buyer will be
  notificated if the tasks are waiting for processing longer than two weeks». «De VW» es una lectura, no una cita
  textual. Se sostiene.
- **La ficha de «foto a tabla»:** el aporte de Federico del 06/10 (renglón 108) nombra «foto a tabla» entre «las
  habilidades» que van por separado. Que esté habilitada en la cuenta de claude.ai no se puede verificar desde acá,
  igual que en la ronda 1. En `.claude/skills/` del repo no está.
- **Las respuestas de la ronda 1:** las 9 tienen su «respuesta» y verifiqué cada una contra el código o contra el
  documento.

Ronda 2 = última. Lo abierto (los 3 nits y el del commit) va al cierre para Fak.
