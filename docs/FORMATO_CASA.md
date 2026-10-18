# Formato de lo que entrega la casa (Ingeniería de Barack Mercosul)

Tanda 16 del plan del sistema (16/10/2026), informe G de formatos (15/10/2026). Pedido de Fak, 15/10:
*«formatos de presentaciones, PDFs, Excels... no tengo formatos genéricos... armamos cosas a las apuradas»*.

**Lo medido que manda:** de 13 entregables que volvieron por la forma, solo 3 fueron queja visual; los otros 10
volvieron por CONTENIDO (notas de más, columnas inventadas, recomendaciones no pedidas, jerga, el formulario
equivocado, el orden). Por eso la pieza grande es el revisor de contenido (`scripts/revisar.py`), no la plantilla.

## Paso 0 (el párrafo que llevan todas las skills que arman un entregable)

Fuente única: el bloque de abajo. El test `__tests__/scripts/pasoCeroSkills.test.mjs` exige que esté TEXTUAL en cada
skill de la lista `skills_de_entregable` de `scripts/_lib/formatoCasa.data.json`.

<!-- paso0:inicio -->
**Paso 0 — qué formato se usa, antes de armar nada** (detalle en `docs/FORMATO_CASA.md`). En este orden: (1) si hay **formulario oficial del SGC** para esto, se usa ese; (2) si el **cliente tiene plantilla propia** (VW, BeOn, SMRC), se clona la suya; (3) si un **compañero ya usa un formato** para esto (Leo, Carlos, Gamboa) o hay uno en `FORMATOS GENERAL`, se copia ese; (4) recién ahí, el **formato de la casa** (`scripts/_lib/tema.json`). Y dos modos que no se mezclan: **corregir el archivo de otro** lleva color propio y «ANTES: …» en cada celda tocada (06/10); **rearmarlo entero** va limpio, sin amarillo ni notas (15/10). Antes de mostrarlo: `python scripts/revisar.py <archivo>`.
<!-- paso0:fin -->

De dónde sale cada paso: el 1, de la memoria `feedback_usar_formatos_oficiales_no_inventar` (28/07) y del caso de
Carlos del 13/10 (*«el formato está mal, tenemos que hacer una hoja de proceso»*: los caminos de inspección pasaron al
I-IN-002.4); el 2, de las skills `beon` y `ppap-motherson` y del deck LSR de VW (`scripts/_pptxSlides.py`); el 3, de
Fak el 14/10 (*«no hace falta inventar el fuego si ya existe»*); los dos modos, de `feedback_entregables_para_fak`
(06/10, corregir) y de LECCIONES 15/10 (plan de control rearmado: *«todo amarillo con demasiadas notas»*).

## El revisor de contenido: `python scripts/revisar.py <archivo>`

Da ROJO o VERDE por regla, con la lámina, la celda o el renglón que lo frena, y sale 1 si algo frena. Encadena lo que ya
existía (`_sinFirmaIA.py` con el logo como freno en el formato de la casa; `_vozFak.mjs` en los mails; el render a imagen,
que nunca es verde: es «para mirar» o «no corrió») y suma las reglas de contenido. Las listas están en
`scripts/_lib/formatoCasa.data.json` → `revisar`, cada una con el reclamo de Fak del que sale.

| Regla | Reclamo del que sale | Aplica a |
|---|---|---|
| `firma-ia` | #14 listado de HO con «Claude» en CREADO POR (08/10); logo oficial | todo menos texto plano |
| `formulario-oficial` | #5 camino de inspección: «el formato está mal, tenemos que hacer una hoja de proceso» (13/10) | con `--documento` |
| `notas-de-mas` | #6 «demasiadas notas» (15/10); #10 bloque NOTAS (24/07) | todo |
| `recomendaciones` | #4 Meta Ads «el qué haría está de más» (14/10) | todo (`--pidio-recomendacion` la apaga) |
| `jerga` | #8 «283 llamadas en curso???» (11/10) + el inglés suelto del canon del AMFE | todo |
| `voz` | #13 «le mandaste un testamento» | `--tipo mail` |
| `lo-importante-primero` | informe G §2.2 b | una página, pantalla, texto |
| `contador-y-hora` | #8 «renueva pusiste hora pero no día» | pantalla y texto |
| `medio` | #11 «los txt son al pedo… un PDF» (31/08) | `--tipo explicacion` |
| `columnas-inventadas` | #10 columna Fuente; #9 columnas derivadas (`--formulario` compara contra la plantilla) | Excel |
| `amarillo-y-antes` | #6 «todo amarillo»; modo corrección 06/10 | Excel (las bandas del formulario no cuentan) |
| `titulo-en-b2`, `gris-y-flechitas` | #9 folio (03/09) | Excel de la casa (no oficial) |
| `fuente-sin-captura` | #12 «mencionaste 3 fuentes sin adjuntar la foto» (01/10) | PowerPoint |
| `piezas-antes-que-pasos` | #7 hojas del cambio de molde «extremadamente difícil de comprender» (25/09) | PowerPoint que manda seguir una pantalla |
| `letra-minima` | Garner et al. 2013 (proyectar 18 pt); IMDS 09/10 (leer 10 pt; el pie y el número de página no cuentan) | PowerPoint de la casa |

**Casos de respuesta conocida** (`python scripts/revisar.py --selftest`, test `__tests__/scripts/revisar.test.mjs`): los
13 entregables devueltos, como gemelos mínimos armados en `scripts/_lib/revisarCasos.py` con la cita de Fak al lado
(los originales están fuera del repo, que es público). **Los 10 por contenido dan ROJO antes y VERDE después; los 3
visuales dan VERDE en la versión que quedó** (Meta Ads además da ROJO antes, por el «qué haría»).

**Sobre entregables reales** (18/10, solo en esta PC, 39 archivos de `exports/` y de la nube): **0 falsos rojos sobre
los aceptados** (PowerPoint del IMDS rehecho del 09/10, plan de control del apoyacabezas «propuesta de Ingeniería» del
15/10, PDF final de Meta Ads, las hojas A3 de grampas aprobadas el 13/10, las hojas del IMG y del hot melt del 13/10).
Los rojos que quedan son verdaderos: los 6 caminos de inspección del 01/10 (los que Carlos rechazó: no usan el
formulario oficial), 5 hojas viejas del hot melt con las propiedades de la librería en el archivo, el plan de control
«correcciones» del 15/10 (amarillo sin «ANTES:»), la HO-990 Rev.A del 07/10 (dice «NOTA: Instrucción técnica base
alineada al AMFE 158» en las láminas 7 y 10) y la lámina del Insert (epígrafes a 7,2 pt). Tres reglas se ajustaron
midiendo contra esos archivos antes de darlas por buenas: el pie y el número de página no cuentan para la letra mínima,
una fila pintada entera es una banda del formulario y no una corrección, y una hoja nombra sus piezas también con las
llamadas «REF. n» de la misma lámina (y «tocar» o «apretar» no son palabras de pantalla).

**Lo que no ve:** lo visual (portada oscura, tarjetas de colores, fotos «mejoradas»): eso lo mira una persona sobre el
render; si una hoja de reunión pregunta cosas que ya se saben (#3); si un número está bien.

## El tema: `scripts/_lib/tema.json`

Un solo archivo con el logo (ruta y sha256), la letra, los colores, los tamaños por tipo y el pie. Lo cargan
`scripts/_lib/temaCasa.py` y `temaCasa.mjs`, que **frenan si el logo no es el oficial** (sha256 `6798d5bc…`;
`5d9207e12856` es el sha1 del mismo archivo). Copia la mecánica de la skill `brand-guidelines` de Anthropic (Apache 2.0);
las skills oficiales `pptx`, `xlsx`, `docx` y `pdf` no se copian (su licencia lo prohíbe).

- **Logo**: solo el oficial, arriba a la izquierda, nunca agrandado ni redibujado. Mide 151×75 px: a 15 mm de alto
  impreso queda en unos 127 dpi.
- **Letra**: Calibri. **Colores**: fondo blanco, texto negro, cabecera de tabla `#44546A` con letra blanca (fijo: tiene
  papel), gris `9AA3AD`, relleno `F3F4F6`, rojo `C00000` solo para marcar el renglón que importa.
- **El azul de acento lo elige Fak.** Propuesto `#44546A`, el único con papel. Hoy hay otros azules sin papel en tres
  generadores (`004E98` la lámina de proceso, `1B4F8F` la superficie de vinilo, `1F3A5F` los de hilos) y uno en el
  zip `Sistema_Procesos_Barack_v1.0.zip` de la nube (`1A5FA8`). No se cambian hasta que Fak elija.
- **Quién lo lee hoy**: los seis generadores de hoja de proceso y la página de temas abiertos, que ya usaban `#44546A`
  (salida idéntica, probado en `__tests__/scripts/temaCasa.test.mjs`), la lámina del Insert (el logo), el programita
  (logo, letra y colores) y las plantillas de abajo. La letra de los generadores de hoja de proceso sigue escrita en
  ellos porque la miden con `calibri.ttf`, y el diseño de un formulario oficial no se toca.

## Plantillas: `python scripts/plantillasCasa.py` (deja `templates/CASA_*`)

**PowerPoint, dos tipos que no se mezclan en el mismo archivo:**

| | Para proyectar en una reunión | Para mandar y leer (el más común) |
|---|---|---|
| Archivo | `templates/CASA_PRESENTACION_PROYECTAR.pptx` | `templates/CASA_PRESENTACION_LEER.pptx` |
| Título | la AFIRMACIÓN en una oración, 28 a 32 pt («La OP 30 pasa de 2 a 1 operario», no «Análisis OP 30») | la afirmación, 22 pt |
| Cuerpo | UNA evidencia por lámina (captura del papel, foto real, tabla o gráfico); letra de 18 pt o más | lo mismo, 10 pt o más |
| De dónde sale | Garner, Alley, Wolfe y Sawarynski, *Int. J. Engineering Education* 29(6), 2013: título-oración y una imagen por lámina, d = 0,81 en comprensión y 0,89 en recuerdo; el deck LSR de VW que la casa ya presentó usa 32 / 18 / 12 | **sale de un solo caso**: el PowerPoint del IMDS rehecho el 09/10 (cuerpo 10 a 14 pt) |

Cada fuente que se nombra lleva su lámina con la captura del papel y el renglón en rojo (reclamo del 01/10). El pie:
título · fecha · F.Santoro · revisión · página. La función `lamina()` de `scripts/plantillasCasa.py` arma una lámina así
para cualquier generador.

**Excel de datos** (`templates/CASA_EXCEL_B2.xltx`, función `excel_b2()`): fila 1 y columna A vacías, **título en
B2**, tabla desde B4 con la cabecera `#44546A` en letra blanca, bordes finos, paneles inmovilizados debajo de la
cabecera, ancho de columna al dato, autor «Facundo Santoro». Solo título y datos: sin notas, sin gris, sin columnas que
derive yo. Parte de `PLAN DE TRABAJO Formato Rev. 1.xlsx` de `FORMATOS GENERAL`, el único Excel de esa carpeta que ya
cumplía la regla del dueño (columna A de 3,7 de ancho, título en B2 con `#44546A`); cambia su letra (Times New Roman y
Aptos Narrow) por la del tema.

**Hoja de una página / A3** (`templates/CASA_HOJA_A3.pptx`, A3 horizontal): **la primera línea dice qué pasa y qué se
necesita**, de quién y para cuándo; debajo, los 6 bloques del A3 de Toyota (situación, objetivo, causa,
contramedida, plan con responsable y fecha, seguimiento; Sobek y Smalley 2008, lexicón del Lean Enterprise
Institute). Letra de 12 pt o más en texto y 9 pt en tablas (el A3 de hoja de proceso de Gamboa va de 8,5 a 12,5). Sirve
para un problema, un desvío o el estado de un tema. En A4 no hay fuente de un mínimo impreso: se fija con una prueba de
impresión.

**Pantalla para Fak** (el programita, `scripts/_programita.mjs`): *«mucho más 2D y mucho más serio»*, el logo arriba a
la izquierda; plata como «gastado / quedan»; fecha con día; ningún contador interno; verde = cierra, rojo = no cierra,
con su leyenda.

**Mail**: no lleva plantilla visual; lleva la voz (`python scripts/revisar.py <borrador.txt> --tipo mail`, que usa
`_vozFak.mjs`).

**Capturas para que Fak elija** (18/10, fuera de git): `exports/explicaciones/formatos_antes_despues_2026-10-18/`, con
una lámina (IMDS del 09/10 contra la pregunta 5 sola con el tema), la hoja A3 y un Excel (el mapeo de vinilos tal como
está contra los mismos datos en B2). Lo que Fak elija pasa a `tema.json`.

## Los 13 reclamos, en el libro de observaciones

Las 13 filas de la tabla 1.3 del informe G entraron el 18/10 como observaciones de forma al libro de la tanda 13
(`node scripts/_observaciones.mjs`, datos en la memoria `project_observaciones_recibidas`), con la cita, la fecha y quién
lo marcó, y cerradas: 11 con la regla de `revisar.py` que las caza como control, y 2 «a mano» (el PowerPoint del IMDS
y la hoja de la reunión: lo visual lo mira una persona). Antes de mandar un documento:
`node scripts/_observaciones.mjs --antes-de-mandar "<tipo>"`.
