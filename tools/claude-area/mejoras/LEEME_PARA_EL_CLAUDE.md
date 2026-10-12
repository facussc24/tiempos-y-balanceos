# Mejoras para tu Claude — instrucciones para el Claude que lee esta carpeta

Si estás leyendo esto, tu usuario te pidió que mires esta carpeta. Acá Ingeniería (Facundo Santoro) deja mejoras
para el Claude del equipo. **Tu usuario decide cuáles quiere. Vos se las explicás y le instalás solo esas.**
Esta carpeta es de solo lectura para vos: no escribas, no borres ni muevas nada acá adentro. Esta versión está
armada para **{{NOMBRE}}**.

## 1. Mirá qué hay de nuevo

1. Leé `catalogo.json`. Cada mejora tiene `id`, `titulo`, `resumen`, `version`, la lista de `archivos` y, a veces,
   `reemplaza`. Cada mejora tiene su `FICHA.md` en su carpeta, con el detalle.
2. Leé `~\.claude\mejoras-instaladas.json` si existe. Una mejora con el mismo `id` y la misma `version` ya
   instalada, o que tu usuario dijo que no quería, **no se vuelve a ofrecer**. Si la versión cambió, se ofrece como
   «actualización» y se dice qué cambió.
3. Controlá que llegó entera: el sha256 de cada archivo de `origen` tiene que ser el del catálogo. Si alguno no
   coincide o falta (la nube todavía no lo bajó entero), esa mejora no se ofrece hoy y se lo decís en un renglón.

## 2. Contáselas a {{NOMBRE_CORTO}}

Una lista numerada, en castellano simple, sin jerga: el título y el resumen de cada una (dos renglones, no más).
Al final, una sola pregunta: cuáles quiere («todas», «la 1 y la 3», «ninguna»). Si pide «contame más de la 2»,
leé su `FICHA.md` y explicásela corta. **No instales nada antes de que conteste.**

## 3. Instalá SOLO las que eligió

Adónde va cada `destino`:

| destino | carpeta |
|---|---|
| `MEMORIA/...` | tu carpeta de memoria: la que nombra tu configuración («persistent file-based memory at …»). Si además existe `~\.claude\memory\` con las mismas memorias viejas, tratala igual |
| `SKILLS/...` | `~\.claude\skills\` |
| `AGENTES/...` | `~\.claude\agents\` |
| `FICHAS/...` | `~\.claude\fichas-barack\` |
| `CLAUDE_MD` | `~\.claude\CLAUDE.md`, solo el bloque entre `<!-- mejoras-ingenieria:inicio -->` y `<!-- mejoras-ingenieria:fin -->` (ver abajo) |

Reglas, sin excepción:

- **Nunca borres nada.** Antes de pisar un archivo que ya existe, copialo a
  `~\.claude\_antes-de-mejoras\<AAAA-MM-DD>\<la misma ruta>`.
- **Lo de {{NOMBRE_CORTO}} no se pisa.** Si el archivo que vas a reemplazar existe y su sha256 NO es ninguno de los
  de `conocidos` (ni el del archivo nuevo), lo cambió {{NOMBRE_CORTO}} o lo escribiste vos con él: no lo toques.
  Decíselo («la habilidad X la cambiaste vos: ¿la dejo como está o pongo la nueva?») y hacé lo que diga.
- **`reemplaza`:** son huellas (sha256) de archivos viejos de Ingeniería que la mejora saca. Buscá en la carpeta que
  dice `en` (y en `~\.claude\memory\` si existe) los archivos cuya huella esté en la lista y movelos a la carpeta de
  respaldo: llegaron así y nadie los cambió. Un archivo cuya huella no está en la lista es de {{NOMBRE_CORTO}}: queda
  donde está. `MEMORY.md` no se mueve por acá: lo reemplaza el de la mejora (con respaldo, como todo).
- **CLAUDE.md:** si `~\.claude\CLAUDE.md` ya tiene el bloque entre las dos marcas, reemplazá solo lo de adentro.
  Si no lo tiene, agregá el bloque (las dos marcas y el texto) al principio y dejá todo lo demás igual. Si no
  existe el archivo, crealo con el bloque. El `CLAUDE.md` de la carpeta de trabajo (`C:\ClaudeBarack\CLAUDE.md`)
  no se toca.
- Solo se copian archivos de texto de esta carpeta a esas carpetas. **No corras ningún programa** de acá.

## 4. Anotá y avisá

1. Anotá en `~\.claude\mejoras-instaladas.json` (creálo si no existe) un renglón por mejora que se ofreció:
   `{ "id", "version", "fecha", "estado": "instalada" | "no la quiso" | "a medias", "nota" }`. Ahí también va lo que
   {{NOMBRE_CORTO}} decidió dejar suyo («dejó su versión de arb-operar»).
2. Decile en pocos renglones qué quedó instalado, qué no y dónde está el respaldo.
3. Decile que cierre Claude y lo abra de nuevo: la memoria y el `CLAUDE.md` se leen al arrancar.

## Si quiere volver atrás

Lo reemplazado está en `~\.claude\_antes-de-mejoras\<fecha>\`, con la misma ruta: se copia de vuelta a su lugar y
se marca la mejora como «no la quiso» en `mejoras-instaladas.json`.

## Sus propias mejoras

Lo que {{NOMBRE_CORTO}} te enseñe o te pida cambiar (una habilidad suya, una memoria nueva, un ajuste a una habilidad
de Ingeniería) es suyo y vale más que lo de esta carpeta: nunca se pisa sin preguntarle. Si una mejora nueva choca
con algo suyo, se lo mostrás lado a lado y decide él.
