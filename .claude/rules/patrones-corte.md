---
description: Patrones de corte DXF/PLT — 3 gates antes de mover un punto
paths:
  - "**/*.dxf"
  - "**/*.plt"
  - "**/*.hpgl"
  - ".claude/skills/patrones-corte-plotter/**"
---

# Patrones de corte DXF/PLT — regla corta (detalle y librería: skill `patrones-corte-plotter`)

Antes de mover un punto de un patrón de corte, en este orden:

1. **APLOMO**: `gate_aplomo(C)` — la recta de apoyo (envolvente convexo inferior) es la
   posición 0 de la pieza. Si el patrón está chueco, el movimiento se va en diagonal.
   NO ajustar una recta al borde inferior: es curvo y devuelve la curvatura, no el giro.
2. **DIRECCIÓN — EL CHEQUEO FRENA, NO DECIDE.** Lo que Fak dice que movió es **dato duro**;
   mi heurística es una hipótesis. Si `tabla_4_combinaciones()` da alarma (punto a menos de
   3 mm del filo; rango sano 5-17 mm), **mostrarle la tabla y preguntar** — jamás invertirle
   la dirección por cuenta propia (ya rompió un patrón el 30/07/2026). La alarma suele ser un
   falso positivo con explicación de negocio: **para que la costura vaya a la izquierda, el
   punto va a la derecha** (se mueven en sentido contrario). Reportar la consecuencia *medida*
   —distancia al filo y cuántos de los 4 extremos de la cruz quedan fuera del contorno— y que
   decida él. Para identificar una cruz, anclar a la anatomía (`punta_fina`), nunca a
   "izquierda/derecha" a secas ni al nombre del archivo.
3. **VERIFICACIÓN**: contorno **vértice contra vértice** en 0.000000 mm (la distancia
   punto-a-contorno es CIEGA a un vértice que se desliza sobre un tramo recto: da 0 en ambos
   sentidos), brazos de cruz en 6.000, misma cantidad de entidades, piquetes sin mover, y
   mirar la imagen de comparación —con un zoom por CADA punto movido— antes de entregar.

Mover trasladando los **brazos existentes** de la cruz (nunca reconstruirla desde el centro)
y guardar con `doc.saveas()` sobre el documento leído (nunca reescribir el DXF de cero).

Nomenclatura: `Patron_<FAMILIA>_<PIEZA>_<MANO>_<AAAA-MM-DD>`, el "qué cambió" va en la
bitácora, no en el nombre. Lo reemplazado va a `obsoleto\` en el mismo momento.

**Datos de piezas reales (medidas, coordenadas, historial) NO van al repo: es público.**
Van a `.sgc-cache/patrones-corte/` (ignorado) o a la carpeta de trabajo de Fak.

**Enforcement:**
- DURO — `patronlib.entregar()` levanta `EntregaRechazada` y **no escribe el PLT** si el
  contorno se movió, si una cruz quedó a menos de 3 mm del filo o fuera del contorno, si un
  brazo no mide 6.000, si cambió la cantidad de vértices/piquetes, o si el aplomo da CHUECO.
  Cuando no se le pasan los piquetes originales, ese sub-check no corre y lo **declara** en
  `piquetes_verificados`. Verificable: `python scripts/patronlib_selftest.py` — 7 casos malos
  que tienen que ser rechazados (incluido el vértice deslizado, punto ciego de Hausdorff) +
  contornos degenerados + roundtrip del PLT.
- BLANDO — hook `patrones-guard.sh` (PreToolUse) recuerda los 3 gates 1×/hora al tocar
  `.dxf`/`.plt` o código que importa `ezdxf`/`patronlib`.
