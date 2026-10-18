# Auditoría final · ficha de configuración por pieza (tanda 13, ítem 1) · 18/10/2026

Auditor: agente `auditor` (solo detecta, no corrige). Worktree `C:\Dev\BarackMercosul\.claude\worktrees\ficha-pieza`,
rama `claude/ficha-pieza`. Tamaño: grande (`codigo-madre.md`).

## Resultado por commit · 6 Importante, 21 Nit, 1 Preexistente

| Commit | Veredicto |
|---|---|
| `2a11b00c` (los 4 commits pedidos) | **FALLO**: 6 Importante. |
| `8fe2d026` (lo último) | **OK en lo medido**: 0 Importante abiertos. Los 6 están arreglados y medidos; quedan 15 Nits. El CI de la rama todavía no corrió. |

**Arriba de todo: el autor commiteó mientras yo auditaba.** El pedido eran los 4 commits sobre `main` 80838d2e
(`d57ceaa2`..`2a11b00c`). A las 15:39 el árbol tenía 9 archivos modificados sin commitear, y antes de las 15:57
entraron dos commits más:

- `ee8e9389`: «lo de la revisión por API»;
- `8fe2d026`: «lo del revisor-pedido».

Por eso medí sobre **dos copias congeladas** (`git archive`, fuera del repo, con `node_modules` y `exports` enlazados
del checkout principal). Cada Importante se midió en `2a11b00c`, que es lo pedido, y se volvió a medir en `8fe2d026`.

**Segunda ronda, solo el diff nuevo.** Las dos cosas nuevas que dejan pasar algo se probaron en las dos direcciones
sobre `8fe2d026`.

- **`excepciones`:**
  - la 111 «por convención» da verde;
  - si además falta la 80, rojo;
  - una HO sin la 111, rojo;
  - si el flujograma pierde la 111, también rojo.
- **`materiales.codigos`:** un código que la BOM no tiene da rojo.

Cada una tiene su test rojo (`fichaPieza.test.mjs`: «gemelo: otra operacion que falta sigue dando rojo» y «gemelo: el
AMFE nombra un adhesivo que la BOM no tiene: ROJO»).

En los tests de `ee8e9389` (`git diff 2a11b00c ee8e9389 -- __tests__`), las únicas expectativas que cambian de
estado son tres, y las tres corresponden a arreglos:

- la letra inferida pasa de `rojo` a `a_confirmar`;
- el vinilo pasa de `verde` a `una_fuente`;
- la capa 1 pasa a leer un fixture.

No se aflojó ningún caso conocido. Lo que encontré en esta ronda es Nit (N4 a N6 en la lista contada).

| Check | Estado | Detalle |
|---|---|---|
| TypeScript | OK | `npx tsc --noEmit`: 0 errores. `_exportAmfeOficial.ts` entra en el `include` y no cambió en los dos commits nuevos. |
| Build | OK | `npm run build`: `built in 48.57s`, exit 0. |
| Sintaxis | OK | `node --check` de los 6 `.mjs` tocados y de los 3 tests; `py_compile` de `fichaRegistro.py`, `_emitirApqp.py` y `_bomLegajo.py`, en las dos copias. |
| Selftest emisor | OK | `python scripts/_emitirApqp.py --selftest`: todo verde en `2a11b00c` y en `8fe2d026`. |
| Tests | OK | Con los 5 archivos pedidos: 97/97 en `2a11b00c`. En `8fe2d026` hay 113/113, que suma `numeracionAmfe.test.mjs`. Las capas 2 y 3, que leen archivos reales, corrieron sin saltearse. |
| Git local | OK | Worktree limpio en `8fe2d026` al cerrar. |
| GitHub | n/a | La rama no está en GitHub (`origin/claude/ficha-pieza` no existe), lo que es esperable hasta fundir. `main` = `origin/main` = 80838d2e. |
| CI | OK en main; la rama sin verificar | `candado.yml`: `completed success 80838d2e`. `deploy.yml`: `completed success 411f200f`. La rama no tiene corridas. |
| Dependencias | OK | `npm ls --depth=0`: 0 UNMET/ERR. `package.json` no cambia. |

### Reglas duras del pedido

| Regla | Estado | Cómo se verificó |
|---|---|---|
| Supabase solo LECTURA | OK | `leerAmfeLive` usa `conectarSoloLectura` (solo `select`). Yo leí el AMFE por el mismo cliente. |
| Nada del arb ni de Outlook | OK | El arb se lee de su export (`C:/tmp/RELACIONES.TXT`). Para `_mails.py --ver` puse un `win32com` y un `pythoncom` de mentira adelante por `PYTHONPATH`, que dejan una marca al importarse, y corrí con `-X importtime`. Resultado: exit 0, sin marca, y ni `win32com`, ni `pythoncom`, ni `outlookUi` entre los 151 módulos importados. `ver()` lee el caché. |
| Y: solo lectura | OK | Ningún código nuevo abre Y:. Y: aparece solo como texto en `maestro.ruta`. |
| No se instala nada | OK | No hay cambios en dependencias. |
| Ningún archivo con «Claude» en el nombre | OK | `git diff --name-only main...HEAD \| grep -i claude`: 0. El único «claude» del diff es el nombre de la rama en el plan interno: no es un documento de Barack. |
| Listados maestros sin escribir | OK | Nada escribe en ellos. |
| Ningún documento oficial modificado | OK | Lo único que se escribe es `data/configuracion/<pieza>.json`, con un `.tmp` y `rename`. |
| Nada de `as any` | OK | 0 en el diff. |
| Nada inventado | OK, con una pregunta | Las 22 pendientes llevan «lo zanja» con su fuente. Lo de la operación 111 va abajo, como Preexistente. |
| Refactor de `_verificarNumeracion.mjs` | OK | Comparé las tres funciones de `main` con `numeracionAmfe.mjs` de HEAD sin los comentarios: 37 renglones, iguales. El script solo suma el `import`. No pude correrlo contra Supabase desde el worktree porque no hay `.env.local`. `numeracionPatagonia.test` sale verde. |
| Casos de respuesta conocida | OK | Caso 1, adhesivo: ROJO. Caso 2, ancho del rollo 1400 contra 1200 y tizada de 1350 contra 1200: ROJO. Caso 3, densidad 35 contra 45 por la espuma compartida: ROJO. Caso 4, IP PAD (capa 3 con BeOn real): flujograma 157 A contra B ROJO, HO-985 misma letra con 6 en 25 contra 4 en 16 ROJO, AMFE 149 VERDE. Costura del APB de puerta: VERDE, en el test unitario y en la capa 3 con la HO 971 real. Todos tienen gemelo, menos dos (ver Nits). |

---

## Hallazgos IMPORTANTES (todos de `2a11b00c`; estado en `8fe2d026` al lado)

**1. [Importante] Un solo papel daba VERDE: se contaban renglones, no documentos.** `scripts/_lib/fichaPieza.mjs:197-202`.
- Caso real: `node scripts/_fichaPieza.mjs --comparar insert-patagonia` en la copia de `2a11b00c` da
  `[verde] vinilo.ancho_rollo: bom:arb dice 1400`, con un solo documento.
- Sonda: dos renglones de `bom:arb`, uno con 1400 y otro con 1500. Da `rojo | bom:arb dice 1400; bom:arb dice 1500`:
  un «rojo entre documentos» que sale de un solo papel.
- El test «un solo papel» probaba un renglón solo.
- **Estado: arreglado en `ee8e9389`, medido** (`una_fuente`, con test «cuatro renglones de la MISMA BOM»).
- Respuesta: ____

**2. [Importante] `vigente:false` quedaba pegado y borraba el rojo del caso 3.** `scripts/_lib/fichaRelevar.mjs:233`.
- La línea es `if (r.materialConfirmado === false) d.vigente = false;`. No tiene vuelta atrás y pisa la vigencia
  configurada.
- Caso, con las fuentes reales `bom-arb`, `ft141-*` y `ft149-*`: ft:149 trae `vigente:false` de una corrida anterior,
  y hoy el arb sí confirma 427ESP001TRO01. `espuma.densidad` pasa de `rojo` a
  `verde | bom:arb y ft:141 y ft:141-copia-legajo dicen 35`, y ft:149 sigue en `false`.
- Alcanza con un `--relevar` hecho con un export del arb que no traiga los códigos del IP PAD.
- **Estado: arreglado en `ee8e9389`, medido.** `materialNoConfirmado` se recalcula: si venía en `true` y hoy el arb
  confirma, queda `false` y el rojo vuelve.
- Respuesta: ____

**3. [Importante] `--parcial` borraba lo que vio el cliente.** `scripts/_lib/fichaRelevar.mjs:220` y `:237-243`.
- El código vacía `d.cliente = []` en todos los documentos, y el `catch` solo repone atributos.
- Caso con todas las fuentes reales y el caché de mails sin responder: «lo que vio el cliente» pasa de 5 documentos a
  0, y los rojos de 7 a 6.
- De punta a punta en la copia, con una ficha chica (flujograma del repo y el mail del 08/09):
  - `--comparar` sale 1;
  - después corre `--relevar --parcial`;
  - `--comparar` sale 0 con «Sin rojos.».
- El propio aviso decía «conservando lo anterior de esas fuentes».
- **Estado: arreglado en `ee8e9389`, medido.** El renglón del cliente queda, marcado `sinReleer`. Queda abierto el
  Nit 3.
- Respuesta: ____

**4. [Importante] Una letra que deja de leerse quedaba con la fecha de hoy.** `scripts/_lib/fichaRelevar.mjs:128-132`,
`:140` y `:230`.
- Lo leído antes no se borraba: `Object.assign` solo pisa lo que vino.
- Caso con la HO-990 real: le cambié el patrón de la letra por uno que ya no calza, como si hubiera cambiado el
  rótulo. Resultado:
  - `ho:990 letra = A`;
  - `leido = 2026-10-18`;
  - 0 fallas y 0 pendientes de letra.
- Pasa igual con la letra de las fichas técnicas (`.doc`) y de los PDF.
- **Estado: arreglado en `ee8e9389`, medido** (`LEIDOS` se borra antes de releer: letra `undefined` y la pendiente
  «letra vigente»).
- Respuesta: ____

**5. [Importante] Sin el ayudante, los emisores no arrancaban.** `scripts/_emitirApqp.py:39` y `scripts/_bomLegajo.py:33`.
- El `import` no tenía `try`.
- Caso en la copia, con `fichaRegistro.py` apartado: `_emitirApqp.py --lista` y `_bomLegajo.py --lista` salen 1 con
  `ModuleNotFoundError`.
- Eso contradice «nunca frenan la emisión» del commit 59661ad3, que es justo lo que el pedido llama «fail-open de
  verdad».
- **Estado: arreglado en `ee8e9389`, medido.** Los dos salen 0, y la función de repuesto devuelve `False` y dice «no
  se pudo cargar ... la emisión ya quedó hecha». Queda sin test (ver Nits).
- Respuesta: ____

**6. [Importante] `--registrar` no movía la fecha.** `scripts/_fichaPieza.mjs:116`.
- `registrarDocumento` acepta `fecha`, pero `registrar()` no se la pasaba.
- Caso en la copia: registro la BOM del legajo del 20/10 (lo que hace `_bomLegajo.py`). Después:
  - `--mostrar` sigue diciendo «no lleva (su versión es la fecha) (2026-10-09)»;
  - `--cambio` dice `bom:legajo (sin letra, del 2026-10-09)`.
- En una BOM la versión es la fecha: la ficha seguía dando por vigente la BOM vieja. En el flujograma, una letra nueva
  quedaba con la fecha de la anterior.
- **Estado: arreglado en `8fe2d026`, medido** (queda `2026-10-20`).
- Respuesta: ____

## Hallazgos WARNING

### Preexistente

**[Preexistente] La 111 «no lleva AMFE» se apoya en una regla que no la nombra.**
`scripts/_lib/numeracionPatagonia.data.json`, nota del AMFE-INS-PAT.
- La nota dice «los almacenamientos WIP (...) y la 111 no llevan AMFE propio (amfe.md §9)».
- `amfe.md` §9 nombra remito, almacenamiento WIP y transporte interno. La 111 es «CLASIFICACIÓN Y SEGREGACIÓN DE
  PRODUCTO NO CONFORME», de tipo `operation` en `tools/flowchart/data/154-INSERT.json` desde 137a6bf6 (08/09).
- Supabase live (`AMFE-INS-PAT`, updated_at 2026-10-01T14:57) confirma que el AMFE no la tiene.
- En `2a11b00c` la ficha lo marcaba ROJO. `8fe2d026` lo pasa a excepción «por convención» con esa fuente, y
  `_verificarNumeracion` no lo ve porque compara contra ese canon.
- **Pregunta para Fak**, no decido: ¿la 111 lleva AMFE?
- Respuesta: ____

### Nits (los 3 primeros; los otros se cuentan)

**N1. [Nit] `normalizar` se engaña con formas comunes y da verde falso. Abierto en `8fe2d026`.**
`scripts/_lib/fichaPieza.mjs:58-78` y `:114`.
- Los casos medidos:

  | Texto | Lo lee como | Consecuencia |
  |---|---|---|
  | `densidad 35 ± 5 kg/m3` | 5 | contra `45 ± 5` da `verde \| dicen 5` |
  | `espuma 5 mm x 1400 mm` | 5 | contra `... x 1200 mm` da verde |
  | `6±1 puntadas en 25 mm` | `1 en 25` | contra `8±1 ...`, verde |
  | `TBD` o `a confirmar`, en un atributo sin normalizador propio | un valor | dos TBD dan verde |

- Ningún papel real lo escribe así hoy. Lo busqué en FT141, FT149, la FT del legajo, las dos HO-990, la HO 971, la
  HO-985 y la pptx de costura del 14/10. FT141 dice `35Kg/m3 +/-5Kg/m3` y da 35 bien. Por eso es Nit.
- Respuesta: ____

**N2. [Nit] Lo que no se pudo leer da verde en el tope y en la cita. Abierto en `8fe2d026`.**
- Un tope ilegible da `verde | entra en el espuma.ancho_rollo declarado (1400)` (`fichaPieza.mjs:210`: `pasados`
  ignora los `null`).
- Si el documento citado no tiene letra, dos HO que citan «154 Rev. B» dan `verde | ho:990 y ho:990-copia dicen B`
  (`:174`: el citado entra solo si tiene letra).
- Hoy no se alcanza con datos reales: el único tope es la tizada `.MRK`, que frena si no trae `<WIDTH>`, y el
  flujograma siempre trae su letra.
- Respuesta: ____

**N3. [Nit] `--comparar` sale 0 con fuentes sin leer. Abierto en `8fe2d026`.**
- `resumenComparacion` (`fichaPieza.mjs:319`) cuenta solo los rojos. Las pendientes en estado `falla` salen como
  «ojo:», pero el código sigue en 0 con «Sin rojos.».
- Medido en `8fe2d026` con la ficha chica y la fuente del mail sin leer.
- Respuesta: ____

**Y 18 nits más, contados.**

De la segunda ronda (diff de `ee8e9389` y `8fe2d026`), abiertos:

- **N4.** La regla de prefijo de `cubre` (5 caracteres o más) da verde con un código distinto que empieza igual:
  `AD - ADFA15` en el AMFE contra `AD - ADFA150` en la BOM, o `427ESP001` contra `427ESP001TRO01`. Falta el gemelo
  rojo de esa regla. Es un chequeo nuevo, no afloja uno que existía: por eso no lo marco Importante.
- **N5.** Con la excepción puesta, si el flujograma pierde la 111 el rojo dice «flujograma:154 no tiene 111». La
  excepción mete la 111 en el AMFE: el rojo es correcto, pero el texto engaña.
- **N6.** El fixture «CONGELADO» de la capa 1 (`fixtures/fichaInsertPatagonia_2026-10-18.json`) es igual byte a byte
  a la ficha viva: `8fe2d026` reescribió los dos juntos. La respuesta conocida sigue a los datos.

Abiertos desde `2a11b00c`:

1. «emitido: letra undefined» en `--mostrar`, para la BOM (`_fichaPieza.mjs:47`).
2. Un `--apply` donde todo daba «igual» registra una emisión que no copió nada (`_emitirApqp.py:444`).
3. Los hilos no tienen un gemelo rojo.
4. El import de repuesto de los emisores no tiene test.
5. `bom:legajo` sin `--familia` registra en todas las fichas que lo tengan.
6. `documentoDeNombre` toma el primer número de 2 a 4 cifras: «FLUJOGRAMA VW427 154 ...» da 427.
7. El `.tmp` de `guardarFicha` tiene un nombre fijo: dos registros a la vez pierden uno.
8. `--registrar` importa toda la cadena del relevamiento, hasta `core/amfe/genericLabels.data.json`.
9. La fuente de la BOM del legajo tiene el nombre fechado (`_20261009.pdf`): después de la próxima BOM, `--relevar`
   frena, y «leído en» queda con el archivo viejo.

Ya arreglados en `ee8e9389`:

10. La letra inferida decidía rojo o verde.
11. `resolverRuta` rompía las rutas de red, y `{biblioteca}` vacía daba «null/...».
12. `normalizarLetra` no leía «REV.» en mayúsculas.
13. `hay('python')` corría sin `-I`.
14. La «vigencia a confirmar» no se avisaba en el detalle.
15. La capa 2 no se salteaba si faltaba `{principal}/exports/...`, que no está en git. Ahora mira todas las rutas.

## Descartados (falsos positivos, verificados)

- **BeOn `/SI/i` sin ancla.** En el archivo real, la columna «¿VW lo vio?» tiene solo `SI` (33), `NO` (33) y `-` (2).
- **`_lib` adelante en `sys.path`.** Ningún `.py` de `_lib` se llama como un módulo que importen los dos emisores.
- **Rutas de esta PC en la ficha.** No hay `C:\`, `Users` ni `OneDrive`: 0 en la ficha y en el fixture de
  `8fe2d026`, y ahora un test lo afirma. Los destinos que escribirían los emisores son de Y:, iguales en todas las PC.
- **`header.amfeNumber` del export.** En Supabase live es `"158"`: calza con `amfe:158`.
- **La capa 2 roja en mi primera copia.** Era un efecto de la copia: `{principal}` apuntaba a ella, que no tenía
  `exports/`.

## Acciones requeridas

- `2a11b00c` solo no se funde: sin `ee8e9389` y `8fe2d026` quedan los 6 Importantes.
- `8fe2d026` no tiene Importantes abiertos en lo medido. Antes de fundir falta subir la rama y que el CI corra
  `candado.yml` sobre ella. Hasta entonces, el CI de la rama queda sin verificar.
- La pregunta de la 111 va a Fak.
- N1 a N4 conviene cerrarlos antes de sumar la segunda pieza: son los que pueden dar verde sin haber medido.

Evidencia (fuera del repo): las copias congeladas, los `sondas*.mjs`, `parcial*.sh` y `ver.sh` y las salidas están
en `C:\Users\FACUND~1\AppData\Local\Temp\aud-ficha\`.
