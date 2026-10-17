# Tanda 13 · Lo que no se nos ocurrió (las 20 oportunidades del 15/10) — lo hecho, lo medido y lo diseñado

Sesión hija de la tanda 13 del plan del sistema (encargo E261017-f376), sábado 17/10/2026, rama
`claude/fuera-caja-tanda13-13ca7c`. Fuentes: `10-PLAN_SISTEMA_2026-10-16.md` §«Tanda 13» y los informes
`20-informes\oportunidades\A_barack.md` (ítems 1 a 10) y `B_sistema.md` (ítems 11 a 20) de la nube de Ingeniería.
Reglas de la corrida: nada de Supabase, arb, Y: ni Outlook; nada instalado; ninguna llamada paga a la API; ningún mail.

El estado de los 20 ítems está en la tabla del final (§ Estado). Acá va lo medido y lo diseñado, ítem por ítem.

---

## Dos datos medidos que corrigen el encargo

1. **En esta PC (la principal) ya están OpenCV 4.13 y ffmpeg 8.1** (`py -3 -c "import cv2"`, `which ffmpeg`, 17/10
   19:12). El informe A los daba por faltantes porque los midió en CATA. **Lo único que falta para los ítems 6 y 7 es
   `mediapipe`** (y solo para el 6, si se usa el esqueleto). También están PIL 11.2, numpy 2.4, shapely 2.1 y ezdxf 1.4;
   no están matplotlib ni scikit-image.
2. **El ítem 8 no se puede «diseñar con su dry-run» sin leer Supabase**: un dry-run de verdad lee los AMFE live. En esta
   corrida queda el diseño y la prueba sobre datos de ejemplo; el dry-run contra Supabase va desde una sesión con
   permiso de lectura y el sí de Fak para escribir.

---

## Ítem 10 · Cuánto material deja la regla de columnas del plotter (medido)

Script: `.claude/skills/plotter-aol/scripts/medir_regla_columnas.py` (selftest `medir_regla_columnas_selftest.py`, 9
casos en verde). Arma la hoja de columnas con el mismo `acomodar_columnas.py` que se usa de verdad, busca otro acomodo
con las mismas condiciones de Fak (sin girar, sin espejar, 25 mm reales entre piezas, el mismo ancho de material) y da
una cota de abajo (ningún acomodo puede ser más corto). Sparrow (el acomodador MIT del informe) **no se instaló ni se le
subió nada**: el otro acomodo es un buscador simple «primero a la izquierda», así que lo que gana es un mínimo, no el
máximo posible.

DXF: `exports/INSERT_OREJITA_COSTURA_20261015/INSERT PATAGONIA - 4 PIEZAS (1 de cada mano) - OREJITA COSTURA - 2026-10-15.dxf`,
5 + 5 piezas por hoja.

| Hoja | Ancho de material | Columnas (regla de Fak) | Sobra con columnas | Otro acomodo encontrado | Cota de abajo |
|---|---|---|---|---|---|
| Delantero | 1.187,1 mm (el que ocupan las columnas) | 1.380,4 × 1.187,1 mm | 0,469 m² (28,6 %) | ninguno más corto | 1.113,4 mm de largo |
| Trasero | 1.284,6 mm (ídem) | 1.293,1 × 1.284,6 mm | 0,543 m² (32,7 %) | ninguno más corto | 982,2 mm |
| Delantero | 1.800 mm (lo que Fak pensó el 15/10 para la prueba, sin medir) | 1.380,4 mm de largo | 1,315 m² (52,9 %) | 1.290,7 mm: 90 mm menos, 0,161 m² por hoja | 731,1 mm |
| Trasero | 1.800 mm (ídem) | 1.293,1 mm de largo | 1,210 m² (52,0 %) | 1.216,1 mm: 77 mm menos, 0,139 m² por hoja | 697,7 mm |

**Lectura.** Con el ancho que ocupan las columnas, la regla de Fak es tan buena como lo mejor que encontró el buscador:
las columnas encastran la punta inclinada de una mano en la de la otra. La única ganancia aparece si el material es más
ancho que la columna (1,8 m): ahí el otro acomodo mezcla manos y usa el ancho que la columna deja vacío. O sea: **lo que
deja material no es la regla de columnas, es que 5 piezas por columna no llenan un rollo de 1,8 m**; con el ancho real
del material se puede ver cuántas entran por columna. Los números de 1,8 m son de ejemplo hasta que se mida el ancho.
**No es un consumo** (`consumos-entregables.md` §6): el consumo sale de la planilla oficial de Mesa de Corte o de un
mail de Pablo Gamboa, y a Pablo no se le pregunta por esto.

Para verlo: `py -3 .claude/skills/plotter-aol/scripts/medir_regla_columnas.py "<dxf>" DEL 5 25 --ancho 1800 --png salida.png`
(las dos hojas lado a lado, azul DER y verde IZQ).

---

## Ítem 11 · El buscador de charlas viejas de la app (medido, la vara contra claude-mem)

Herramienta: `search_session_transcripts` (con `include_archived: true`). Corrida el 17/10/2026 entre las 19:25 y las 19:39 en la PC
principal sobre los 6 casos reales de olvido de `20-informes\casa_memoria_olvidos.md`. La pregunta en cada caso: **si el
día del reclamo la sesión hubiera buscado con las palabras del tema, ¿encontraba en una charla ANTERIOR lo que le
faltaba?** (los resultados de después del reclamo no cuentan).

| # | Caso (fecha del reclamo) | Búsqueda | ¿Encontraba lo que faltaba? | Qué trae de antes del reclamo |
|---|---|---|---|---|
| 1 | Costuras, «archivo viejo» (14/10) | `4 en 16` | **A medias** | 25/09, 02/10, 05/10 y 11/10 tienen la tabla con «4 en 16» y la vista «6 en 25»: llega al tema, pero las charlas se contradicen entre sí y ninguna decía todavía «el PowerPoint de mayo no». El buscador encuentra; no decide cuál está vigente |
| 2 | El plotter (14/10) | `plotter de corte` | **A medias** | 30/09 y 02/10: «hoja (mix) para el plotter de corte a partir de un DXF…». Sabía que había un plotter de corte distinto; la ficha del AOL no existía en ningún lado |
| 3 | Tornillo, agujero de 7 mm (14/10) | `tornillo de 7` | **No aplica** | El dato era una medición nueva de Fak ese día: ninguna búsqueda lo podía traer |
| 4 | «Acumuladores» en la hoja (13/10) | `acumuladores` | **Sí** | 02/10 («Tarea de Nicolás Pérez» y «Solución hotmelera producción»): «los acumuladores (los tres tubos negros) en marcha tienen que estar arriba». Era justo la aclaración que pidió Fak |
| 5a | Plan de reacción (07/10) | `plan de reaccion` y `plan de reacción` | **Sí** | Del 22/09 al 02/10, más de 15 charlas con el texto estándar («SI DETECTA PRODUCTO O PROCESO NO CONFORME… DETENGA…») y «PLAN DE REACCION abajo» (01 y 02/10) |
| 5b | Los mails del equipo ya están en la nube (07/10) | `mails del equipo` | **Sí, pero escondido** | 01/10 «Sincronización de mails de Luca»: «la sync de mails del equipo corre sola y en silencio»; 06/10 «Sistema de Claudes por área». Salió en los puestos 37 a 41 de 41 |

**Resultado: 3 de 6 los encontraba (4, 5a, 5b), 2 a medias (1, 2) y 1 no se podía (3).** Esa es la vara: `claude-mem`
(tanda 1.3, pieza 5) tiene que ganarle a 3 + 2 de 6, no a cero.

Lo que se aprendió de la herramienta, medido:
- **Ordena por la última actividad de la sesión, una por sesión, y corta en `limit` (20 por defecto).** Las sesiones
  posteriores que citan el caso (informes, planes, hijas) tapan a las viejas: en 5b las útiles quedaban fuera con el
  límite por defecto. Hay que pedir `limit: 60` o más.
- **Distingue tildes**: `plan de reaccion` y `plan de reacción` traen listas distintas (hay sesiones que salen en una y no en la otra). Se busca con
  las dos formas, o con un pedazo sin tilde.
- **Busca texto exacto**: `plan de reacción abajo` dio 0 aunque «PLAN DE REACCION abajo» existe. Frases cortas.
- Ve las sesiones de esta PC, también las archivadas y las de los worktrees; llega al menos al 08/09/2026 (la más vieja
  que apareció).
- Trae un pedazo de 100 caracteres, no la charla: para leer más hay que abrir esa sesión (`list_events`).

Sin cambios de código: es una herramienta de la app. Queda anotada para las sesiones en la memoria
`reference_buscar_en_charlas_viejas` (cómo usarla y sus trampas).

---

## Ítem 13 · Un estilo de salida propio con la voz y el cierre de Fak (armado, sin activar)

Archivo: `.claude/output-styles/voz-de-fak.md` (frontmatter `name`, `description`, `keep-coding-instructions: true`,
doc oficial `code.claude.com/docs/en/output-styles`, investigado por la casa en julio:
`docs/_archive/research-claude-code-2026-07/research_plugins-output-styles.json`). Es corto a propósito: dice la forma de
cada respuesta (castellano simple, claro antes que corto, no preguntar lo propio, no anunciar trabajo, el orden fijo del
cierre con «Propongo», nada de recomendaciones que nadie pidió, medir antes de escribir un número) y remite a `CLAUDE.md`
para el resto. **No está activado**: activarlo cambia el prompt de sistema de todas las sesiones y es decisión de Fak.

**El «antes», medido** con `node scripts/_stopHooksMedir.mjs --desde <d> --hasta <h> --por-chequeo` (el medidor de la
tanda 9, ahora con el desglose por chequeo de cierre-guard y los frenos cada 100 mensajes de Fak):

| Chequeo de cierre-guard (lo que el estilo quiere evitar) | 03/10 al 09/10 (454 mensajes de Fak) | 10/10 al 16/10 (424 mensajes) |
|---|---|---|
| 1 · termina pidiendo permiso para el propio trabajo | 14 (3,1 cada 100) | 6 (1,4) |
| 5 · el cierre es un informe | 0 | 0 |
| 6 · termina anunciando trabajo que no hizo | 7 (1,5) | 9 (2,1) |
| 7 · Fak pidió que se lo expliquen y no cambió la forma | 0 | 1 (0,2) |
| 10 · termina en inglés | 0 | 4 (0,9) |
| **Suma de los que toca el estilo** | **21 (4,6 cada 100)** | **20 (4,7 cada 100)** |
| (los demás: 2 entregable sin ruta, 3 pendientes, 4 sin abrir, 8, 9) | 116 | 143 |

«Mensajes de Fak» cuenta todo mensaje de persona en el registro, incluido el encargo con que arranca una hija: sirve para
comparar una semana con otra, no como conteo exacto. El chequeo 5 no frenó en las dos semanas (ya lo había medido el
auditor del 16/10: su freno salió por última vez el 13/09).

**El «después»**: con el sí de Fak, se elige el estilo en el menú «Output style» de la barra de título de cada sesión (o
como estilo por defecto de las sesiones nuevas en la configuración de la app), y a la semana se corre el mismo comando con
`--desde <día de activación>`. Sirve si la suma de los chequeos 1, 5, 6, 7 y 10 baja de ~4,6 cada 100 mensajes; si no
baja, se saca (es un archivo: borrarlo o elegir «Default» lo apaga). Los subagentes no lo heredan (solo los fork).

---

## Ítem 16 · Revisar un entregable comentando sobre una página (probado hasta donde llega sin una persona)

**Cómo funciona** (descripción de las herramientas `Artifact` y `ArtifactComments` de la sesión, leída el 17/10):
1. La sesión publica la página (privada: solo la ve el dueño de la cuenta y a quien él se la comparta). Al publicar, la
   sesión queda «mirando» la página.
2. Fak abre el link, selecciona el pedazo (un paso de la hoja) y deja un comentario.
3. **El comentario solo le llega a la sesión si Fak lo manda**: respondiendo el hilo con «Send to Claude» o escribiendo
   @claude adentro. Un comentario común queda guardado en la página y no avisa a nadie; la sesión lo lee si se lo piden.
4. Con el comentario mandado, la sesión se despierta, corrige el archivo, vuelve a publicar en el mismo link y responde
   y cierra el hilo («resolve»). Solo puede responder y cerrar hilos mandados; no puede crear comentarios nuevos.
5. La «mirada» es de ESA sesión: si se cierra, nadie escucha. Si Fak quiere que lo vea otra sesión, le pega el link en su
   mensaje y esa sesión empieza a mirarla (`ArtifactComments` con `watch`).

**Lo que se probó (17/10, ~19:45):** se publicó una página de prueba **sin datos de la empresa**
(`https://claude.ai/artifact/ASCDE3Qec1cuNgtZ1qcmHB`, «Prueba de comentarios»: tres pasos de ejemplo, el 2 marcado para
comentar). La publicación anduvo, la sesión quedó mirándola («connected, auto-replies armed») y la lectura de comentarios
anduvo (0 hilos). **Lo que no se pudo probar**: que un comentario de Fak llegue con el paso al que apunta; hace falta que
él comente y lo mande, y esta sesión hija termina antes. La prueba de punta a punta es: abrir el link, comentar el paso 2,
mandarlo, y que la sesión que lo mira conteste en el hilo.

**Para qué se usaría:** un paquete de hojas de proceso o un flujograma se muestra como página y Fak marca sobre el paso
(«este paso no se entiende») en vez de describirlo en el chat. La página es de revisión interna, nunca el entregable
(regla `core-prohibiciones.md` §9: el entregable sigue siendo el PowerPoint o el PDF de la casa).

---

## Ítem 7 · Medir la costura de la CNC con una foto (método probado en imágenes de medida conocida)

Script: `scripts/costura/medir_costura_foto.py` (selftest `medir_costura_foto_selftest.py`, 7 casos en verde). Usa
OpenCV, que **ya está en esta PC** (no se instaló nada). Cómo funciona: la pieza se apoya sobre una hoja A4 impresa con
4 marcas ArUco (`--hoja-referencia hoja.png` la genera); las marcas dan la vista de arriba en milímetros aunque el
celular esté inclinado; el borde de referencia es el de arriba de la pieza, la costura lo que es más oscuro que la pieza,
y se mide la distancia perpendicular del borde al centro de la puntada por tramos de 10 mm. Los valores salen con coma
y entran directo a `node scripts/_aptitudMaquina.mjs --valores "..."` (ítem 2).

**Lo medido (imágenes sintéticas de medida conocida):** 52,4 mm (el delantero que midió Fak) sale 52,35 sin
perspectiva; en 8 «fotos» con el celular inclinado hasta 8 %, desenfoque y ruido, el error máximo por tramo fue 0,05 mm;
con la pieza girada 3° da 52,39; con 46,4 mm (la otra mano del trasero) da 46,37. Sin las marcas, o con una tapada, no
mide y lo dice. La hoja que se imprime tiene sus marcas a menos de 1 px de donde el método las espera.

**Lo que NO se pudo probar, y por qué:**
- **Con fotos reales.** No hay fotos de piezas cosidas con una referencia de tamaño: las del calibre del 15/10 se
  sacaron en la notebook de Calidad y no tienen hoja de referencia; sin una medida conocida en la foto no hay milímetros.
  Y barrer `5- VIDEOS Y FOTOS` entero está prohibido (memoria `feedback_no_scan_onedrive`).
- **El espesor de la pieza cambia la escala**: la cara de arriba del vinilo está más cerca del celular que la hoja, y
  todo lo de arriba se ve un poco más grande. Con la pieza de 3 mm y el celular a 40 cm, el error es de ~0,75 % (en
  52 mm, ~0,4 mm), casi el tope de 0,5 mm. Se corrige poniendo las marcas a la altura de la pieza (sobre un taco del
  mismo espesor) o restando ese factor. Es una cuenta de geometría, no una medición: hay que confirmarlo con la primera
  foto real.
- La distorsión del lente del celular no está modelada (los celulares la corrigen casi toda; sin medir).

**Qué foto hace falta para la prueba real:** imprimir la hoja al 100 %, medir con regla la distancia entre los centros
de las marcas (y pasarla con `--centros`), apoyar una pieza cosida ya medida con calibre con su borde de referencia
hacia las marcas 0 y 1, luz pareja sin sombra, y sacar la foto de arriba con la hoja entera adentro. Si el resultado
queda a menos de 0,5 mm del calibre en las 5 piezas ya medidas (DEL 52,4; TRA 50,8 / 55 / 46,4 / ~50), sirve para medir
una tirada entera; si no, solo como control previo. Una estación fija (soporte del celular) la decide Fak cuando vea eso.

---

## Ítem 6 · Los cortes de los videos de tiempos, propuestos solos (solo diseño, sin instalar nada)

**Qué hace:** mira el video de la toma de tiempos y propone dónde empieza y termina cada tramo; Fak confirma o corrige y
el método de siempre sigue igual (`recortar.py`, reloj neto, cartel de lo sacado; memoria
`project_tiempos_forrado_ductos_patagonia`). Qué es neto y qué es espera lo sigue decidiendo Fak.

**Las señales, de la más barata a la más cara:**
1. **La transcripción** (faster-whisper, ya está: `.venv-audio`, versión 1.2.1). Fue lo que mejor ordenó el video del
   ducto el 07/10: dice dónde arranca de verdad y qué componente es («hasta ahí los brazos, ahora el central», 8:26).
2. **Los cambios de escena** con ffmpeg (filtro `select` por escena + `showinfo`): ffmpeg 8.1 ya está.
3. **Los valles de movimiento** con OpenCV (diferencia entre cuadros reducidos, suavizada): las pausas entre una pieza
   y la siguiente. OpenCV 4.13 ya está.
4. **El esqueleto** (mediapipe, la referencia de Konica Minolta: inicio y fin de ciclo por las manos): **es lo único que
   falta**, y con el celular en la mano puede fallar (pide cámara fija).

La salida es una lista de cortes propuestos con su señal y su confianza, y una plancha con el cuadro de cada corte para
que Fak los mire de un vistazo.

**Prueba (respuesta conocida):** el video del ducto de aire `IMG_1086` (1:16 a 11:35,5) con sus tramos ya medidos:
brazo 1 1:37,8 · brazo 2 1:00,4 · central 1:51,4 + 0:23,8 · brazo 3 2:03,5 · brazo 4 1:59,0 · pieza en Y 1:08,1. Cuántos
límites propone dentro de ±1 s de los medidos. **Si con las señales 1 a 3 (sin instalar nada) no acierta, se prueba con
mediapipe; si tampoco, no se usa.**

**Lo que hay que instalar, para decírselo a Fak antes:** **solo `mediapipe`**, y solo si las señales 1 a 3 no alcanzan,
en un entorno propio de Python (`.venv-video`) para no tocar el Python general. El informe decía que faltaban también
OpenCV y ffmpeg: eso era en la notebook de Calidad; en la PC principal ya están. Tamaño: mediano; se arma en una sesión
de código cuando Fak diga.

---

## Ítem 8 · Un reclamo del cliente que llega al AMFE de toda la familia (solo diseño: no se tocó Supabase)

**Qué hace:** cuando llega un 8D o una alerta, arma una ficha con lo que dice hoy el AMFE de esa pieza sobre ese modo de
falla y una PROPUESTA de agregarlo al maestro de la familia para que baje a las variantes. Nada se escribe solo.

**Qué se reusa (sin crear otro motor; `core-prohibiciones` §6):** `core/inheritance/changePropagation.ts` ya tiene
`diffMasterChanges` (puro: qué cambió entre el maestro viejo y el nuevo), `matchOperationName` / `normalizeOperationName`
(puros: encontrar la operación por nombre) y `propagateChangesToVariants` (crea las propuestas en
`family_change_proposals`: `auto_applied` si la variante no tiene un cambio propio en ese renglón, `pending` si lo tiene).

**El circuito, en orden:**
1. Entrada: el reclamo (número de 8D o alerta, pieza, modo de falla con las palabras del cliente).
2. Lectura (Supabase, solo lectura): el AMFE de la pieza, su familia y su maestro; buscar el modo de falla en la
   operación que corresponde (`matchOperationName`). Si ya está, la ficha lo dice con su S, O, D y sus controles.
3. Propuesta: el renglón nuevo para el MAESTRO. **La S sale del efecto por la Tabla P1, no del reclamo**
   (`caracteristicas-especiales.md` §2bis); O y D por la guía de `amfe.md`, marcadas `_autoFilled`; ninguna acción
   inventada; ninguna sigla CC/SC sin el OK de Fak.
4. **Dry-run**: con el maestro nuevo en memoria, `diffMasterChanges` contra el maestro de hoy y, por cada variante de la
   familia, si quedaría `auto_applied` o `pending`. Se imprime la tabla; no se llama a `createProposal`.
5. Con el sí de Fak: el maestro se escribe con `runWithValidation()` (dry-run y después `--apply`), y la propagación de
   la app crea las propuestas como hace hoy. Backup antes (`_backup.mjs`).

**Caso de prueba:** el 8D 11010843 (la D7: «incorporación del modo de falla de recorte de vinilo para liberar agujeros
de clipsado», AMFE 131 APB central Amarok): que la ficha encuentre (o no) ese modo de falla y lo proponga en el maestro
de la familia, sin escribir nada. **Antes hay que mirar en Supabase si la D7 ya quedó cargada**: dos memorias no cierran
entre sí (una la da vencida; otra dice que el 21/09 se cargó una fila en el editable).

**Lo que necesita:** leer Supabase (lo hace una sesión de Barack, no esta), y para escribir en los AMFE de una familia,
el sí de Fak (contrato de autonomía, filas A y B). Tamaño: mediano en código.

---

## Ítem 17 · Los plugins oficiales de Anthropic para áreas que no programan (plan de la sesión de prueba; no se instaló)

**Qué:** `anthropics/knowledge-work-plugins` (29.775 estrellas y Apache-2.0 según el informe B del 15/10; no lo volví a
medir). No se instala tal cual: se usa como molde. Lo que se prueba y contra qué caso de la casa:

| Plugin / skill | Molde de qué | Caso de respuesta conocida |
|---|---|---|
| `operations/status-report` | el borrador de los viernes para Pedro (tanda 8, ya en `main`) | el borrador del 17/10: ¿el molde agrega algo que el nuestro no tiene? |
| `operations/change-request` | el ECR/ECO (paso c de la ficha por pieza, ítem 1) | el cambio de espuma del Insert del 09/10, después de abrir el procedimiento de cambios de Barack, que manda |
| `data/validate-data` + `small-business/absent-is-not-zero` | un chequeo antes de mostrar un número (balanceo, capacidad, consumo) | un export del arb recortado a propósito: con el chequeo la sesión lo detecta, sin él no |
| `data/data-context-extractor` (solo el modo corrección) | ítem 19: la corrección de Fak entra sola a la ficha de la máquina | el mensaje real del 14/10 15:58 («ese plotter no, el plotter de corte») |
| `small-business/untrusted-content` | ya usado como fuente del ítem 20 | — |

**Cómo es la sesión de prueba (cuando Fak diga):** una sesión aparte, en un worktree; agregar el marketplace
`anthropics/knowledge-work-plugins`, instalar de a uno, `claude plugin validate` antes de usarlo (qué hooks pone: que no
se crucen con los guardianes de la casa), correr cada caso con y sin el plugin, anotar el resultado y desinstalar lo que
no gane. Lo que gane no queda instalado: se copia la idea a la skill de la casa, con su fuente. **Necesita el sí de Fak
porque instala algo en la configuración de Claude Code de la PC.**

---

## Ítems 2, 4, 5, 9, 14 y 20 · lo hecho, en pocas líneas cada uno (el detalle está en su script y su test)

- **14** · La API ya puede leer un PDF o una foto: van como bloques `document` / `image` en base64 adelante del texto
  (`contenidoConAdjuntos()` de `scripts/_lib/claudeApi.mjs`; desde la consola, `node scripts/_apiTarea.mjs ... --adjunto
  manual.pdf`). **Qué pasa con un archivo que no sirve**: uno que se llama .pdf o .png y por dentro no lo es se frena
  antes de mandar; un PDF de más de 600 páginas, también; si todo junto pasa los 32 MB que acepta un pedido (25 MB de PDF
  ya son 33 en base64), también. Por `--adjunto`, un texto sigue yendo como texto (hasta 2 MB) y cualquier otro binario
  (un .docx, un .xlsx) se frena: hay que pasarlo a PDF o a texto. Nada se paga en esos casos. El costo de un PDF se mide
  con `--estimar` (count_tokens, gratis) antes de pagar. Probado sin red: 12 tests con un cliente de mentira miran el
  cuerpo exacto y que el gasto quede en el registro como siempre; la noche no cambió.
- **5** · `node scripts/_observaciones.mjs --antes-de-mandar AMFE` lista lo que ya le marcaron a ese tipo de documento,
  primero lo que ningún control caza («A MANO»). El libro vive en la memoria `project_observaciones_recibidas` (no en el
  repo) y arranca con las 6 observaciones reales de Carlos al AMFE de ductos (10/08 y 20/08): 5 sobre el AMFE y 1 sobre
  el flujograma; 1 la caza un control solo, 1 a medias y 4 hay que mirarlas a mano. Si una observación nueva es de una
  clase que ya se había cerrado, dice VOLVIÓ (el chequeo que se armó no alcanzó). Un renglón en las skills de AMFE,
  hojas y flujogramas lo pide antes de mandar.

- **2** · `node scripts/_aptitudMaquina.mjs --valores "..."`: la cuenta del control estadístico preliminar con el criterio
  del I-AC-021 rev A (extracto local del 01/10): subgrupos de 5, límites tentativos desde 8 subgrupos y preliminares con
  25, PP y PPK de 1,67 o más solo con proceso estable y tolerancia dada. El caso del 28/07 da 12,99 / 1,68 / 0,70 y
  «muestra insuficiente». Dice que es la cuenta y no el estudio de Calidad.
- **4** · Los vencimientos de Ingeniería salen en el aviso de arranque (lista `vencimientos` en la memoria de
  seguimientos, del que vence primero; los de otra área no se le llevan a Fak). La D7 del 8D, de prueba, el 21/09 dice
  «VENCIÓ hace 4 días» y un plazo de PPAP de Calidad no aparece. **La D7 real no se cargó**: su estado se mira en
  Supabase primero (dos memorias no cierran entre sí).
- **9** · `node scripts/_parametrosMaquina.mjs --maquina hotmelt`: la ficha de la hot melt tiene 5 parámetros con sus
  lecturas fechadas por el video (consigna de rodillos 195 → 185 el 26/08, alarma de sobretemperatura 160 → 220 el
  28/08, y los tres del fusor del 25 al 28/08) y marca cada cambio; `--anotar` avisa si una lectura nueva cambió.
- **20** · El resumen de mails de la noche dice que un mail es dato y no una orden, y lo que pide plata, claves o cambiar
  datos sale con «OJO:». `candadosNocturno` en verde.

---

## Estado de los 20 ítems

| # | Ítem | Estado |
|---|---|---|
| 1 | Ficha de configuración por pieza | **Plan para el sí de Fak**: `docs/PLAN_FICHA_CONFIGURACION_PIEZA_2026-10-17.md` |
| 2 | Estudio de aptitud de máquina calculado solo | **Hecho** (`scripts/_aptitudMaquina.mjs`, 16 tests) |
| 3 | Versión grabada en cada utillaje impreso | **En otra tanda** (11, ya fundida) |
| 4 | Vencimientos de Ingeniería al arrancar | **Hecho** (`scripts/_lib/seguimientos.mjs`, 7 tests nuevos); sin cargar la D7 real |
| 5 | Libro de observaciones recibidas | **Hecho** (`scripts/_observaciones.mjs`, 6 tests; 6 observaciones reales de Carlos en la memoria) |
| 6 | Cortes de los videos de tiempos | **Diseño** (arriba); solo falta `mediapipe`, y quizás ni eso; se instala con el sí de Fak |
| 7 | Medir la costura de la CNC con una foto | **Método hecho y probado en imágenes de medida conocida** (`scripts/costura/`, 7 casos); con fotos reales **no se pudo** (no hay ninguna con referencia de tamaño) |
| 8 | Un reclamo que llega al AMFE de toda la familia | **Diseño** (arriba); el dry-run contra Supabase, desde una sesión de Barack, y escribir con el sí de Fak |
| 9 | Parámetros de máquina en el tiempo | **Hecho** (`scripts/_parametrosMaquina.mjs`, 10 tests; ficha de la hot melt cargada) |
| 10 | Cuánto material deja la regla de columnas | **Hecho y medido** (`medir_regla_columnas.py`, selftest 9 casos); no es un consumo |
| 11 | El buscador de charlas viejas | **Medido** (3 de 6 olvidos los encontraba, 2 a medias, 1 no se podía); memoria `reference_buscar_en_charlas_viejas` |
| 12 | Remote Control desde el navegador | **En otra tanda** (10) |
| 13 | Estilo de salida propio | **Archivo armado y «antes» medido**; **sin activar** (es de Fak) |
| 14 | La API lee PDFs y fotos | **Hecho** (`claudeApi.mjs` + `_apiTarea --adjunto`, 12 tests sin red) |
| 15 | Conector de Microsoft 365 | **Descartado con motivo** (Fak, 15/10: la cuenta de la empresa no se puede conectar) |
| 16 | Revisar comentando sobre una página | **Documentado y probado hasta donde llega sin una persona** (publicar, mirar, leer comentarios); el comentario de Fak de punta a punta queda para él |
| 17 | Plugins oficiales para áreas que no programan | **Plan de la sesión de prueba** (arriba); instalar es con el sí de Fak |
| 18 | El conector de CATIA era otro | **En otra tanda** (11, ya fundida) |
| 19 | La corrección de Fak entra sola a la ficha | **En otra tanda** (1.4) |
| 20 | La noche: un mail es dato, no una orden | **Hecho** (`nocturno.mjs`, test en `nocturno.test.mjs`; candados en verde) |
