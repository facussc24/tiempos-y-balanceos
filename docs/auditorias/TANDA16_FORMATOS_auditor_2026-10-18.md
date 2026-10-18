# Auditoría — tanda 16 «formatos de lo que la casa entrega» (rama `claude/tanda16`)

Fecha: 18/10/2026 · Auditor (solo detecta) · 7 commits sobre `main` f5551eb6 (6d4e8c67 … 4e69b716) · ronda 1.

## Resultado: FUNDIR CON ARREGLOS · 7 Importante, 7 Nit, 0 Preexistente

Lo que ya andaba sigue andando: los 6 archivos de test pasan (48 de 48, ninguno salteado), el selftest da 10 de 10, los
generadores dan el mismo azul, el programita arma su página, tsc y eslint limpios, build verde. Los defectos están en
la herramienta nueva (`scripts/revisar.py`): cuatro falsos verdes en reglas que dicen cazar un reclamo de Fak, una firma
que sale verde cuando no pudo mirar, un render deformado y un falso rojo sobre la pantalla real del programita. Y el
libro de observaciones ya da por cerrados #6 y #10 «con la regla que los caza» (commit 4e69b716): esas dos reglas no
ven la forma común del reclamo.

| Check | Estado | Detalle |
|---|---|---|
| TypeScript | OK | `npx tsc --noEmit`: 0 errores |
| Build | OK | `npm run build`: built in 46,2 s, exit 0 |
| Git local | OK | árbol limpio en 4e69b716 |
| GitHub | a propósito | 7 commits sin pushear: lo pidió el usuario, no es hallazgo |
| CI | sin verificar para la rama | no está pusheada; `main` f5551eb6: candado `completed success`, deploy `completed success`. No corrí Ubuntu: las versiones locales son las del CI (PyMuPDF 1.27.2.2, python-pptx 1.0.2, openpyxl 3.1.5, Pillow 11.2.1) y no encontré nada atado a Windows en lo que corre en el test, pero no se ejecutó allá |
| Tests pedidos | OK | `npx vitest run --pool=threads` de pasoCeroSkills, temaCasa, revisar, plantillasCasa, programita, temasAbiertos: 6 archivos, 48 tests, 0 salteados |
| `revisar.py --selftest` | OK | 10 de 10 por contenido rojo→verde, 3 visuales verde, 9,5 s |
| py_compile / node --check | OK | los 11 `.py` y los 9 `.mjs` tocados |
| eslint de los `.mjs` tocados | OK | exit 0 |
| Dependencias | OK | `npm ls --depth=0`: sin UNMET/ERR/missing |

Todas las pruebas de ataque se armaron en `%TEMP%\aud16-CeAH\` (fuera del repo). Abajo va el armado mínimo de cada
caso para repetirlo sin esos scripts.

## Importantes

### 1. [Importante · TRUE BUG] `amarillo-y-antes` no ve el amarillo si la fila está pintada entera — `scripts/revisar.py:376-379`

La excepción de «banda del formulario» (fila con amarillo en el 80 % o más de `max_column`, con 4 columnas o más) se
saltea la fila entera, valores y comentarios. Una fila de datos resaltada entera, que es la forma más común de marcar
«fila nueva» o «todo amarillo», queda como banda.

- Armado: hoja con B2 título, cabecera B4:G4, filas 5 a 8 con las 6 celdas en `FFFF00` y un comentario «cambiado por
  Ingeniería» en B. `python scripts/revisar.py amarillo_filas.xlsx --sin-render --json` → `amarillo-y-antes: VERDE`, exit 0.
- Control: la misma hoja con amarillo en 3 de 6 celdas por fila → ROJO (12 celdas). La regla anda: la excepción es la
  que la tapa.
- Modo corrección: fila 5 entera en amarillo, sin «ANTES:», `--modo correccion` → VERDE.
- El selftest no lo ejercita: el gemelo #6 (`scripts/_lib/revisarCasos.py:144-147`) tiene 3 columnas, y con menos de 4
  no hay bandas. La excepción se aflojó sin un gemelo que la haga dar rojo (REVIEW.md, punto 1).
- Por qué importa: es el reclamo #6 al pie de la letra («todo amarillo») y el libro de observaciones
  (`project_observaciones_recibidas`, id `plan-de-control-2026-10-15-11`) lo da por cerrado con
  `gate: revisar.py --oficial (regla amarillo-y-antes y notas-de-mas)`.
- Dirección (sin probar contra el `.xls` real aceptado del 15/10): una banda es una fila pintada con UN solo texto (el
  título combinado, «PLAN DE CONTROL», «REVISIONES»), o una fila que está en la plantilla de `--formulario`; y un gemelo
  rojo con la fila de datos entera en amarillo.
- respuesta: ____

### 2. [Importante · TRUE BUG] `columnas-inventadas` mira la fila equivocada en cuanto hay dos textos en una fila de arriba — `scripts/revisar.py:301-310` (usada en `:331`)

`fila_de_cabecera` toma como cabecera la PRIMERA fila con 2 textos o más. Un formulario oficial tiene casi siempre un
bloque de encabezado arriba («Pieza:», «Cliente:», el código), y un Excel de la casa puede llevar la fecha al lado del
título. En los dos casos la tabla de verdad no se mira nunca.

- Armado A (oficial con bandas): A1 «PLAN DE CONTROL», F1 «I-AC-032», A2 «Pieza:», C2 «Apoyacabezas», E2 «Cliente:»,
  F2 «VWA»; cabecera en la fila 5 con Característica, Método, Frecuencia, Responsable, Reacción y **Fuente**.
  `revisar.py oficial_fuente.xlsx --oficial --documento "plan de control"` → `columnas-inventadas: VERDE`, exit 0.
- Con la plantilla al lado (el uso documentado para formularios): la misma hoja sin la columna Fuente como
  `--formulario plantilla_oficial.xlsx` → **también VERDE** (la fila 1 está en la plantilla, la 5 no se mira).
- Armado B (casa): B2 «Pesos por pieza», E2 «18/10/2026», cabecera B4:D4 con Pieza, Peso g, **Fuente** → VERDE. Control:
  sin E2 → ROJO «fila 4 col 4: Fuente».
- Por qué importa: es la regla de los reclamos #9 y #10, y el libro da por cerrado #10 (`excel-2026-07-24-15`) con
  «reglas notas-de-mas y columnas-inventadas».
- Dirección: la cabecera es la fila con más textos (o la de relleno de cabecera / negrita), o se miran todas las filas
  de texto antes del primer dato; con `--formulario`, la fila del entregable que más coincide con la plantilla. Gemelos
  rojos con los armados A y B.
- respuesta: ____

### 3. [Importante · TRUE BUG + ROBUSTEZ] `firma-ia` sale VERDE cuando el detector no pudo mirar — `scripts/revisar.py:249` y `:252`

Dos caminos al mismo verde, en la regla de la prohibición más dura de la casa (core-prohibiciones §9):

- **TRUE BUG (`:249`)**: `json.loads(p.stdout or "[]")` sin mirar el código de salida. Si `_sinFirmaIA.py` se cae sin
  imprimir, se lee como «no hay nada». Mutante en una copia fuera del repo (`revisar.py` + sus `.data.json`, con un
  `_sinFirmaIA.py` que solo hace `raise RuntimeError`), sobre un PowerPoint que dice «Armado por Claude» →
  `[VERDE] firma-ia`, `=> VERDE en todas las reglas que aplican`, exit 0. Con el detector real, el mismo archivo da ROJO.
- **ROBUSTEZ (`:252`)**: solo cuenta BLOQUEANTE, y el detector informa como AVISO lo que no revisó (`grande` arriba de
  60 MB, `ilegible`, `revision-parcial`). PowerPoint de 60,6 MB (una imagen de ruido) con «Armado por Claude» en la
  lámina: `_sinFirmaIA.py --logo-bloquea` dice «[AVISO] … no se revisó: pesa 61 MB»; `revisar.py` dice `firma-ia: VERDE`,
  exit 0. Hoy ningún entregable de `exports/` pasa de 60 MB (el mayor, `HO-985 - IP PAD REV.A.xlsx`, pesa 51,6 MB; 12
  pasan de 30 MB): por eso es robustez y no un caso visto.
- Dirección: código de salida distinto de 0/1 o stdout vacío = `NO CORRIO`; los AVISO `grande`/`ilegible`/`revision-parcial`
  = `NO CORRIO` con su motivo. Gemelo con el mutante.
- respuesta: ____

### 4. [Importante · TRUE BUG] `firma-ia` no corre en `.txt`, `.md` ni `.html`, y el motivo escrito no se cumple — `scripts/revisar.py:541`

El código dice «texto plano: lo mira la voz y la jerga». Ninguna de las dos busca «Claude» (la jerga es subagente,
tokens, dry-run, commit, pipeline, prompt, llamadas en curso + el inglés del canon). `_sinFirmaIA.py` sí lee texto plano.

- `mail_ia.txt` = «Carlos, te paso el plan de control del apoyacabezas. Lo revisé con Claude. Saludos».
  `revisar.py mail_ia.txt --tipo mail --sin-render` → voz VERDE, jerga VERDE, `=> VERDE en todas`, exit 0.
- `pantalla_ia.html` = `<div>Cupo de la semana: gastado 63 %, quedan 37 %</div><div>Armado por Claude Code el viernes
  23/10 a las 13:00</div>` → VERDE en todas, exit 0.
- `_sinFirmaIA.py mail_ia.txt pantalla_ia.html` → 2 BLOQUEANTES («contenido: nombra a Claude»).
- Atenuante: el mail lo frena al enviar `scripts/_mailEnviar.py:415-423` (`firma_ia_del_mail`). Una página HTML o una
  explicación `.md` armada por un script no tiene ese freno, y el guardián de escritura no ve lo que escribe un programa.
- Dirección: correr la firma también en texto plano (sin `--logo-bloquea`, que no aplica). Gemelo con el mail de arriba.
- respuesta: ____

### 5. [Importante · TRUE BUG] `letra-minima` deja pasar cualquier número suelto, también en las tablas — `scripts/revisar.py:438-444`

La excepción del pie (`txt.strip().isdigit() or autor in txt`) se pensó para el número de página, pero se aplica a todo
run, incluidas las celdas de tabla. Una tabla de tiempos o pesos (lo más común en una lámina de la casa) puede ir a 6 pt.

- Armado: lámina 16:9 con título de 30 pt y una tabla 4×4 con «100», «101», … a 6 pt. `revisar.py tabla_numeros.pptx
  --tipo proyectar` → `letra-minima: VERDE`.
- Control: la misma tabla con «fila 0 col 0» a 6 pt → ROJO «tabla a 6 pt (minimo 12)».
- Es una excepción que afloja sin el gemelo que debe seguir frenando (REVIEW.md, punto 1).
- Dirección: el número suelto vale como número de página solo fuera de las tablas y en el pie (abajo de la lámina).
- respuesta: ____

### 6. [Importante · TRUE BUG] El render «para mirar» deforma toda lámina 16:9 y muestra solo la primera — `scripts/revisar.py:516` + `scripts/lamina_proceso/exportar.py:14`

`revisar.py` reutiliza el exportador de la lámina A3, que pide siempre `Export(png, "PNG", 4961, 3508)`. PowerPoint estira
la lámina a esa medida. Las tres plantillas de presentación de la casa son 16:9.

- Armado: lámina 16:9 con un círculo negro de 8×8 cm. `revisar.py circulo169.pptx --render-en <carpeta>` (PowerPoint
  estaba cerrado y quedó cerrado) → PNG de 4961×3508 (1,414; la lámina es 1,778); el círculo mide 1164×1464 px: ancho
  sobre alto **0,795**, justo 1,414/1,778. La posición en x da lo esperado (1470-2634 contra 1465-2637).
- Solo `Slides(1)`: las láminas 2 a N no se miran.
- Por qué importa: el render es lo único que cubre las 3 quejas visuales (FORMATO_CASA.md, «Lo que no ve»). Mirar una
  imagen deformada lleva a corregir lo que está bien o a no ver lo que está mal.
- Dirección: exportar con el ancho y el alto de la propia lámina (o solo el ancho), y todas las láminas.
- respuesta: ____

### 7. [Importante · ROBUSTEZ, falso rojo] `contador-y-hora` frena la pantalla real del programita — `scripts/revisar.py:488` + `scripts/_lib/formatoCasa.data.json:62`

La regla mira renglón por renglón (`leer_html` corta en `<br>`, `</div>`, `</td>`…): si el día está en el renglón de al
lado, da ROJO.

- Pantalla real: `node scripts/_programita.mjs --una-vez --sin-abrir --sin-medir --sin-windows --salida <temp>` y
  `revisar.py <temp>/tareas.html` → `[ROJO] contador-y-hora — renglon 101: «no imprime · la última terminó (93 capas) a
  las 13:29»`. El día está en el `<div>` siguiente: «vie 16/10 13:29 · hace 45 h 9 min» (sale de
  `scripts/_lib/programita.mjs:230`). Es la «pantalla para Fak» que esta tanda re-estiló, y no puede dar verde.
- Gemelos medidos: `<td>sáb 17/10</td><td>10:59</td>` → ROJO; `Se renueva el viernes 23/10<br>a las 13:00` → ROJO;
  `Se renueva el vie a las 13:00` → ROJO (`dia_re` no tiene las abreviaturas que usa el programita: lun, mar, mié, jue,
  vie, sáb, dom). Control: `renueva 13:00` → ROJO, como debe.
- El «0 falsos rojos sobre 39 entregables» del autor no incluía ningún HTML: es un tipo que no se midió, no un número
  mal contado.
- Dirección: buscar el día en el renglón de la hora y en el anterior/siguiente del mismo bloque; sumar las abreviaturas.
- respuesta: ____

## Nits (3 de 7)

- [Nit · ROBUSTEZ] `scripts/revisar.py:562`, `:574` y `:606` — un `NO CORRIO` no cambia el veredicto ni la salida. Sin `node`
  en el PATH, el mail «testamento» da `[NO CORRIO] voz — no hay node en esta PC` y abajo `=> VERDE en todas las reglas que
  aplican`, exit 0 (con node: ROJO por «atentamente»). Que diga «VERDE salvo N que no corrieron» y no salga 0. respuesta: ____
- [Nit · ROBUSTEZ] `scripts/revisar.py:444` — la letra heredada no se mide y la regla da VERDE igual. Cuadro con
  `lstStyle` a 6 pt y el run sin tamaño, más otro de 18 pt escritos con autoajuste al 30 % (`normAutofit fontScale`) →
  `letra-minima: VERDE`. El aviso «las que heredan del diseño no se miden» solo sale cuando hay ROJO. Ningún generador del
  repo usa autoajuste (buscado), así que pega en láminas editadas a mano. respuesta: ____
- [Nit · ROBUSTEZ] `scripts/_temasAbiertos.mjs:120` — el tema se carga al importar: sin el logo, el módulo ni se importa
  («no esta el logo oficial en …»), aunque se quiera solo `temasDeMemoria` o `pendientesDe`. El de `main` se importaba y
  armaba la página sin logo. Medido en copias fuera del repo, con y sin el PNG. El logo está en git, así que hoy no pasa.
  respuesta: ____
- Y 4 nits más: las plantillas llevan fija la fecha 18/10/2026 y «Rev. A» en el pie (`scripts/plantillasCasa.py:86-88`);
  `revisar.py` no tiene tipo A3 y mide la hoja A3 contra 10 pt cuando el tema dice 12 y 9 (`tema.json` → `tamanos.a3`);
  el programita corre con `setInterval` y el tema queda en caché del proceso, así que el logo de origen se verifica una
  vez por arranque y «en cada vuelta» se compara solo la copia; en `formularios`, el código del flujograma «I-IN-002»
  también está adentro de «I-IN-002.4» (el de la hoja de proceso).

## Lo que se miró y está bien (falsos positivos descartados)

- **El logo deef25cd** (`scripts/lamina_proceso/logo_barack.png`, 1181×354) no lo frena `firma-ia` ni con
  `--logo-bloquea`: queda a **6,7** de la huella del oficial, dentro del umbral «oficial re-guardado» (≤ 10, medido el
  09/10 en `firmaIA.data.json`). Es el mismo dibujo en otra resolución. Que la lámina use el archivo del tema está bien;
  no es un hallazgo del detector. FALSO POSITIVO.
- **El render nunca da VERDE**: `render()` solo devuelve `PARA MIRAR` o `NO CORRIO` (`revisar.py:500-530`). Confirmado.
- **Generadores migrados al tema**: el `AZUL` de los 5 de python-pptx da `RGBColor(0x44,0x54,0x6A)` (test); el de
  `cuadro_estructura.py` arma `"#" + "44546A"`; `_temasAbiertos` da `#44546A` en los mismos lugares. Ningún módulo de
  `scripts/_lib/*.py` choca de nombre con los de `img/`, `hotmelt/`, `novax/` ni `lamina_proceso/` al ponerse primero en
  `sys.path`. Salida idéntica: confirmado.
- **Plantillas commiteadas = regeneradas**: `plantillasCasa.py --salida <temp>` y comparación parte por parte del zip,
  sin las fechas: ninguna parte distinta en las 4. Las 4 commiteadas pasan `revisar.py` y `_sinFirmaIA.py --logo-bloquea`.
- **Tema**: el sha256 del logo en disco y en el blob de git es 6798d5bc…; el PNG está marcado binario en
  `.gitattributes`, así que el checkout de Ubuntu no lo toca. El test del tema prueba carga y freno en JS y Python.
- **Paso 0**: está textual en las 10 skills, y el test da rojo si falta o cambia (dos direcciones).
- **Programita**: genera la página con el tema y repone `logo.png` si su sha256 no es el oficial; si el tema no carga,
  `una()` lo atrapa y lo dice («no pude armar la página»).

## Pregunta (no es hallazgo)

- El paso 0 suma 731 caracteres arriba en cada skill. En `cad-design`, `carga-arb`, `flujogramas`, `hojas-de-proceso`,
  `planes-de-control` y `superficie-vinilo-3d` empuja texto más allá de las marcas de 16.000 / 19.000 / 20.000 caracteres que usó la auditoría de
  H23/H24 (por ejemplo, en `flujogramas` cruza «Un decimal exige su operación madre» y «SCRAP como terminal LATERAL»). No
  vi el mecanismo del corte al compactar, así que no lo doy por pérdida: ¿vale la pena medirlo como en H23/H24?

## Acciones requeridas (las decide la sesión principal con Fak)

1. Arreglar los falsos verdes 1, 2, 3, 4 y 5 y el render 6, cada uno con su gemelo rojo/verde en
   `scripts/_lib/revisarCasos.py` (los armados de arriba sirven tal cual), y el falso rojo 7 con la pantalla del
   programita como gemelo verde.
2. En el libro de observaciones, #6 (`plan-de-control-2026-10-15-11`) y #10 (`excel-2026-07-24-15`) no deberían decir
   que `revisar.py` los caza hasta que existan los gemelos de la fila entera en amarillo y de la columna debajo de un
   encabezado: hoy el control es parcial.
3. Los nits, a criterio.

---

## Ronda 2 — 18/10/2026 (solo el diff 90209a42..HEAD: bf6f70e2, 4e69b716, 8664f871, 3eda7f08)

### Resultado: FUNDIR CON ARREGLOS · 4 Importante, 3 Nit, 1 Preexistente

De los 7 Importantes de la ronda 1 quedan cerrados 6 (1, 3, 4, 5, 6 y 7). Los medí con los mismos casos de
`%TEMP%\aud16-CeAH\`. El 2 sigue abierto: el arreglo anda en el gemelo armado, pero no en el formulario real del 15/10,
donde la cabecera de la tabla está pegada al encabezado. Los arreglos abrieron tres agujeros nuevos:

- Si un documento de la casa NOMBRA el código de un formulario, se apagan sus reglas de diseño.
- La ventana de ±1 renglón toma el día de otra cosa. Es el reclamo #8 tal cual.
- El pie de la lámina del IMDS, el caso con el que se calibró la regla, ahora da falso rojo.

Nada empeora respecto de `main` (ahí `revisar.py` no existe) y ningún gate depende del código de salida de `revisar.py`
(grep: solo lo llaman los tests). Lo que queda abierto va al cierre para Fak.

| Check | Estado | Detalle |
|---|---|---|
| `revisar.py --selftest` | OK | 10 de 10 dan rojo→verde, los 3 visuales dan verde y los 10 contraejemplos nuevos dan lo esperado (13,7 s) |
| Tests pedidos | OK | 6 archivos, 50 tests, 0 fallas (el del logo de la lámina corrió: el archivo está en esta PC) |
| py_compile, node --check, eslint de lo tocado | OK | sin errores |
| TypeScript / build | no aplica | el diff no toca la app (0 archivos .ts/.tsx); en la ronda 1 dieron limpio |
| Plantillas | OK | regeneradas = commiteadas, parte por parte. Ya no llevan fecha fija (el pie dice «[fecha]» y «[rev.]»). Las 4 pasan `revisar.py` y `_sinFirmaIA.py --logo-bloquea` |
| Git | OK | árbol limpio en 3eda7f08; la rama sigue sin pushear (a propósito) |
| Diferencial sobre entregables reales | ver abajo | `revisar.py` de 90209a42 contra el de HEAD, sin render, sobre 252 archivos de `exports/` (Excel, PowerPoint y HTML desde el 01/10, de menos de 60 MB) |

### Los 7 Importantes de la ronda 1

| # | Estado | Medido |
|---|---|---|
| 1 amarillo en la fila entera | cerrado | `amarillo_filas.xlsx` → ROJO (24 celdas); en modo corrección → ROJO. El `.xls` aceptado del 15/10 sigue VERDE y el de «correcciones» sigue ROJO. El diferencial trajo un caso real: `revision-pc-puertas-patagonia/Revision PC APB, Insert y Top Roll Patagonia - 01-10-2026.xlsx` tiene la fila 8 de datos pintada entera en FFF2CC («A definir juntos»). Antes pasaba como banda; ahora da ROJO, y es un rojo verdadero |
| 2 columna inventada debajo del encabezado | **abierto en el formulario real** | ver R2-1 |
| 3 firma que no pudo mirar | cerrado | los mutantes del detector (se cae, sale 0 sin imprimir, devuelve un objeto) dan `NO CORRIO`, `SIN VERDE` y exit 3. El pptx de 60,6 MB con «Armado por Claude» → ROJO (el tope pasó a 1000 MB) |
| 4 firma en texto y HTML | cerrado | `mail_ia.txt` y `pantalla_ia.html` → ROJO «nombra a Claude» |
| 5 números chicos en una tabla | cerrado | `tabla_numeros.pptx` → ROJO «tabla a 6 pt: 100»; el control con texto → ROJO |
| 6 render deformado, y solo la lámina 1 | cerrado | círculo de 8×8 cm en una lámina 16:9: PNG de 1467×825 (1,778), círculo de 344×344 px (ancho/alto 1,000), en x 434-778 contra 433-780 esperado. Un deck de 3 láminas da 3 PNG. PowerPoint quedó cerrado |
| 7 falso rojo en la pantalla del programita | cerrado | `tareas.html` regenerado con el worktree → `contador-y-hora: VERDE`, exit 0. `<td>sáb 17/10</td><td>10:59</td>`, el `<br>` y «vie» → VERDE; «renueva 13:00» solo → ROJO |

Nits de la ronda 1:

- Cerrados:
  - El `NO CORRIO` que salía en verde: sin `node`, el mail «testamento» da `SIN VERDE` y exit 3.
  - `_temasAbiertos` sin el logo: el módulo se importa y `armarHtml` frena con «no esta el logo oficial».
  - La fecha fija de las plantillas.
  - El tipo A3.
  - «I-IN-002» que coincidía adentro de «I-IN-002.4».
- Sigue igual: la letra heredada o con autoajuste (`letra_heredada.pptx` → VERDE).

### Importantes nuevos o que siguen

#### R2-1. [Importante · TRUE BUG, sigue el #2] La cabecera real del plan de control oficial no se mira — `scripts/revisar.py:348` y `:355`

En el formulario real, la cabecera de la tabla de controles está en la fila 69 («Nº PIEZA / PROCESO», «NOMBRE DEL
PROCESO», …, «PLAN DE REACCION ANTE DESCONTROL») y pegada al bloque de encabezado (fila 68: «BARACK MERCOSUL»). Las dos
ramas de la regla la saltean:

- `:348`: la lista negra saltea toda fila que tenga texto en la de arriba. En las primeras 99 filas de la primera pestaña
  del `.xls` real, solo mira la 44 (firmas), la 61 y la 72 («TAM», «FREC»). Ni la 69 ni la 70.
- `:355`: con `--formulario`, la cabecera se busca solo en las primeras 30 filas. Gana la 10 (la tabla de REVISIONES) y
  la 69 no se compara nunca.

Cómo lo armé: una copia de
`exports/PC_APC_PATAGONIA_20261015/PC APOYACABEZAS Patagonia - propuesta de Ingenieria 15-10-2026.xls`, editada con
Excel por COM: O69 = «FUENTE» y O76 = «plano rev C» (`%TEMP%\aud16-CeAH\r2\cabecera.py`).

- `revisar.py` sin banderas, con `--oficial --documento "plan de control"` y con `--formulario <la copia sin tocar>` →
  **`columnas-inventadas: VERDE` en los tres**, exit 0.
- Control: la copia sin tocar → VERDE.

Lo que lo deja pasar y lo que queda mal escrito:

- El gemelo `columna-fuente-debajo-de-un-encabezado` (`scripts/_lib/revisarCasos.py:233-236`) pasa porque deja vacías
  las filas 2 y 3: no tiene la forma del formulario real.
- `docs/FORMATO_CASA.md:84` dice que la columna «Fuente» «se busca en todas las filas de cabecera»; la medición dice que
  no.
- El libro de observaciones sigue dando por cerrado el #10 (`excel-2026-07-24-15`) con esta regla.

Dirección (sin probar):

- En la lista negra, mirar cada fila con 3 textos o más hasta la primera fila de datos de cada bloque, no solo la
  primera del bloque.
- Con `--formulario`, comparar la fila del entregable que más coincide con la plantilla, sin el tope de 30.
- Un gemelo con el encabezado pegado a la cabecera (la copia real o el mismo armado).

respuesta: ____

#### R2-2. [Importante · TRUE BUG, nuevo en 8664f871] Nombrar un código de formulario apaga las reglas de diseño en un documento de la casa — `scripts/revisar.py:611-614`

`codigo_oficial` busca el código en TODO el texto. Si lo encuentra, pone `op.oficial = True` y dejan de correr
`titulo-en-b2`, `gris-y-flechitas` y `letra-minima`. Un documento de la casa que solo cita el formulario («según el
plan de control I-AC-032») pasa como formulario oficial.

- Lámina 16:9 para proyectar, con título de 30 pt y un cuadro a 7 pt que termina en «(formulario I-AC-032)» →
  `formulario-detectado` y `=> VERDE`, exit 0. La misma lámina sin la cita → `letra-minima: ROJO «texto a 7 pt (minimo
  18)»`.
- Excel con el título en A1 y «Formulario: I-AC-032» en B6 → VERDE, exit 0. Sin B6 → `titulo-en-b2: ROJO`.
- Visto en un archivo real: `exports/explicaciones/beon_revisiones_patagonia_15-10.html` es una explicación de la casa
  que nombra I-AC-005.3. Da `formulario-detectado` y `formulario-oficial: VERDE «lleva el formulario oficial
  I-AC-005.3»`. Ahí no se perdió ninguna regla, porque en HTML no corren las de diseño.
- Es una excepción nueva con un solo gemelo, el verde (`formulario-oficial-sin-banderas`, `revisarCasos.py:242-243`):
  punto 1 de REVIEW.md.
- Dirección: reconocer el formulario por el lugar del código (las primeras filas de cada pestaña, el cajetín de la
  lámina), no por cualquier mención. Y un gemelo rojo con la lámina de arriba.

respuesta: ____

#### R2-3. [Importante · TRUE BUG, nuevo en 8664f871] La hora toma el día de otro renglón — `scripts/revisar.py:541-544`

Para arreglar el #7, la regla acepta el día en el renglón de antes o en el de después, sin mirar si habla de la misma
cosa. El reclamo #8 al pie de la letra pasa si el renglón de al lado tiene una fecha cualquiera.

- `<div>Cupo de la semana: gastado 63 %, quedan 37 %</div><div>se renueva a las 13:00</div><div>ultima vuelta: sáb 17/10
  10:59</div>` → `contador-y-hora: VERDE`, exit 0. Control: lo mismo sin «sáb 17/10» → ROJO «renglon 2: se renueva a las
  13:00».
- En el diferencial, 2 páginas reales pasaron de ROJO a VERDE por esto:
  - `exports/explicaciones/noche-2026-10-09.html`: «CI verde a las 00:30», sin día, toma el «hoy» del título que sigue
    («2. Cómo se toca el código desde hoy»).
  - `lo-que-se-viene-2026-10-09.html`: «cada madrugada a las 6:30» toma el «mañana» de «A la mañana te llevo…». Este es
    discutible, porque la hora es de todos los días.
- Para la ventana solo hay gemelo verde (`hora-con-el-dia-en-la-celda-de-al-lado`, `revisarCasos.py:240-241`). El
  gemelo rojo del #8 (`banda_antes.html`) no pone a prueba la ventana, porque ninguno de sus renglones vecinos tiene
  día. La dirección que di en la ronda 1 decía «del mismo bloque»; quedó en ±1 renglón sin mirar el bloque.
- Dirección, en dos partes (las dos sin código):
  - «El vecino vale solo si tiene el día y no tiene hora propia, o si tiene la MISMA hora» cubre el armado de arriba y
    deja en verde la página del programita (repite 13:29 en los dos renglones), `c6` y los `<td>` (ahí el vecino tiene
    solo el día).
  - Esa condición NO cubre los dos casos reales: «desde hoy» y «A la mañana» tampoco tienen hora propia. Ahí el
    problema está en `dia_re` (`formatoCasa.data.json:62`): «hoy» en un título y «mañana» en el sentido de la parte del
    día cuentan como día. Esa lista ya estaba en la ronda 1; la ventana la estira al renglón de al lado.
  - Gemelo rojo con el HTML de arriba.

respuesta: ____

#### R2-4. [Importante · ROBUSTEZ, falso rojo, nuevo en 3eda7f08] El pie de la lámina del IMDS ya no se perdona — `scripts/revisar.py:490`

El arreglo que pidió la revisión por API exige dos «·» para tomar un texto como pie. El pie de la lámina del IMDS, el
caso con el que se midió la regla (comentario de `:486-487` y `tema.json:49`), usa guiones.

- `exports/explicaciones/formatos_antes_despues_2026-10-18/_trabajo/imds_hoy.pptx` es la lámina del IMDS del 09/10 que
  se usó para el antes/después:
  - con 90209a42 y con 8664f871: `letra-minima: VERDE`;
  - con HEAD: `ROJO «texto a 9 pt (minimo 10): IMDS Patagonia - 09/10/2026 - F.Santoro»`, exit 1.
- `docs/FORMATO_CASA.md:71-72` sigue diciendo «0 falsos rojos sobre los aceptados (PowerPoint del IMDS rehecho del
  09/10…)».
- Límite de la medición: el PowerPoint original del 09/10 no está en esta PC (lo busqué en `exports/` y en las dos
  carpetas de OneDrive). Lo medido es la copia de `_trabajo`.
- Dirección: pie es el texto que lleva el autor y una fecha (con «·» o con « - »), o el que está abajo de la lámina. El
  «Realizó: F.Santoro» suelto de la revisión por API sigue sin ser pie. Y un gemelo verde con el pie del IMDS.

respuesta: ____

### Nits (3)

- [Nit] `scripts/revisar.py:346-352` — «Verificado» sigue dando falso rojo en la primera fila de un grupo de datos que
  viene después de una fila vacía. `verificado_grupo.xlsx`: B4 Pieza | Estado, datos en las filas 5 y 6, la 7 vacía, y
  en la 8 «Funda» | «Verificado» → `columnas-inventadas: ROJO «fila 8 col 3: Verificado»`. En los 97 Excel reales del
  diferencial no apareció ningún caso así. respuesta: ____
- [Nit] `scripts/revisar.py:251` — el arreglo de `oficial_pedido` anda en las dos direcciones, pero no tiene gemelo: si
  alguien lo revierte, ni el selftest ni el test lo ven. Lo medí con un mutante de `_sinFirmaIA.py` que frena solo si
  le llega `--logo-bloquea`, sobre una lámina que cita I-AC-032: sin banderas → ROJO; con `--oficial` → VERDE; con el
  `revisar.py` de 8664f871 → VERDE. respuesta: ____
- [Nit] `scripts/revisar.py:574-575` — el render le sigue pidiendo a `exportar.py` la imagen A3, y en la carpeta del
  render queda `<nombre>_exportar.png` de 4961×3508 (deformada en una lámina 16:9) al lado de las buenas. El informe no
  la nombra, pero el archivo está. respuesta: ____

### Preexistente (1)

- [Preexistente] `scripts/revisar.py:573-579` — si PowerPoint no exporta, el render rasteriza el PDF viejo que haya
  quedado con el mismo nombre en la carpeta. La carpeta por defecto es `%TEMP%\revisar`, compartida por todas las
  corridas. Lo medí con un mutante de `exportar.py` que sale 1, sobre otro `tres.pptx` de una sola lámina: da `PARA
  MIRAR` con las 3 láminas del archivo anterior. La versión 90209a42 hacía lo mismo con el PNG (también medido). Además,
  con `--render-en` relativo el render no corre en ninguna de las dos versiones (`NO CORRIO`). respuesta: ____

### Preguntas (no son hallazgos)

1. **El logo del formulario de hoja de proceso.**
   - Lo que decidió Fak: el 10/10 dijo que el logo de letras finas del formulario de HO «avise sin frenar» (P83,
     `docs/COLA_CAMBIOS_CODIGO.md:251`).
   - Lo que hace `revisar.py`: frena por el logo salvo que la persona diga `--oficial`, también cuando detecta el
     formulario solo. 8664f871 apagaba ese freno al detectar el formulario y 3eda7f08 lo volvió a prender.
   - Lo medido: en el diferencial, 55 archivos de `exports/` dan `firma-ia: ROJO` por el logo sin `--oficial` (HO 21-9463
     a 9475 REV.A, HO THERMOFORMADO, el embalaje de Gamboa, las grampas). En `HO 21-9463 REV.A.xlsx`, con `--oficial`
     da VERDE.
   - No es un cambio respecto de la ronda 1 (90209a42 hacía lo mismo) y `FORMATO_CASA.md` lo dice.
   - La pregunta: si una sesión corrige uno de esos archivos y corre `revisar.py` sin `--oficial`, ¿va a cambiar el logo
     antes de que Fak lo pida?
2. **Las explicaciones sobre el sistema.** Ahora que la firma corre en HTML, 23 páginas de `exports/` pasan a ROJO por
   nombrar a Claude (`CLAUDES_POR_AREA_20261001/fuentes/*.html`, `explicaciones/explicacion-sistema-claude-2026-10-08.html`,
   `seguir-novedades-claude.html`, …). Son páginas para Fak que tratan justamente de Claude. ¿Se revisan con
   `revisar.py` o quedan afuera?

### Sobre el diferencial

- Los 55 cambios de `firma-ia` de VERDE a ROJO en Excel y PowerPoint NO salen del diff. La copia de 90209a42 que armé no
  tenía el logo oficial al lado, y su detector comparaba solo por hash («OJO: el chequeo del logo… no corre»). Los
  descarto.
- Ningún archivo real pasó a exit 3 ni a `NO CORRIO`. La versión vieja pasó los 900 s en los 3
  `Listado_Maestro_FLUJOGRMAS*.xlsx`; la nueva los termina.
- 123 archivos se detectan como formulario (HO, AMFE y el plan de control). Todos son formularios, menos la explicación
  de R2-2.
- 6 caminos de inspección de grampas (`IMPRESION_0710_V3/fuentes/logo_oficial/`, archivos del 07/10) pasan a
  `letra-minima: ROJO` (11 pt contra 12) porque ahora se toman como A3. Los 12 pt son lo que dice `tema.json`. No llevan
  el código del formulario, así que no se detectan como formulario. Tienen los mismos nombres que los 6 de
  `hojas-grampas-patagonia-01-10/`, pero con el logo oficial y en una carpeta de impresión. Si alguno de estos se
  imprimió y quedó aceptado, el tipo A3 automático es un falso rojo nuevo. No lo pude saber: queda para Fak.

### Para el cierre con Fak

1. Quedan abiertos R2-1 a R2-4, cada uno con su reproducción arriba.
2. Libro de observaciones:
   - El #6 (`plan-de-control-2026-10-15-11`) ya tiene su gemelo y un caso real que lo confirma.
   - El #10 (`excel-2026-07-24-15`) sigue sin cazarse en el formulario real (R2-1).
   - El #8 (`pantalla-2026-10-11-13`, cerrado el 18/10 con «revisar.py --tipo html, regla contador-y-hora») queda
     cazado a medias: el contador interno se caza, pero la hora sin día pasa si el renglón de al lado tiene una fecha
     cualquiera (R2-3).
3. Las dos preguntas de arriba, y si los 6 caminos de grampas del 07/10 se aceptaron (Sobre el diferencial).
