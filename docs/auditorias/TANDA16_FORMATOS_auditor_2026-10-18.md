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
