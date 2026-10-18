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
