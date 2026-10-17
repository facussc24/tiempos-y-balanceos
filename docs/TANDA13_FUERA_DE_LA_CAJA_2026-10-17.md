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
