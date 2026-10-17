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
