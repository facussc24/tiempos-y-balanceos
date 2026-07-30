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
2. **MARCO**: `tabla_4_combinaciones()` — la pieza se corta del revés y el usuario suele
   mirar una de las manos girada 180°. Punto a menos de 3 mm del filo = dirección mal leída,
   FRENAR. Rango sano: 5 a 17 mm. Anclar a la anatomía (`punta_fina`), nunca a
   "izquierda/derecha" a secas ni al nombre del archivo.
3. **VERIFICACIÓN**: contorno con desviación máxima **0.000000 mm**, brazos de cruz en
   6.000, misma cantidad de entidades, piquetes sin mover, y mirar la imagen de comparación
   —con un zoom por CADA punto movido— antes de entregar.

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
  Verificable: `python scripts/patronlib_selftest.py` (5 casos, incluye los 2 errores caros).
- BLANDO — hook `patrones-guard.sh` (PreToolUse) recuerda los 3 gates 1×/hora al tocar
  `.dxf`/`.plt` o código que importa `ezdxf`/`patronlib`.
