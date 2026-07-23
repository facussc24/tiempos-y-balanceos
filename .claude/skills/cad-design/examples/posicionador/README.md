# Caso de estudio: Posicionador Top Roll Trasero v2 (2026-07)

Primer trabajo CAD completo de la capacidad 3D Barack: un posicionador impreso en 3D
(cabezal + empujador en 3 variantes de ángulo) para el Top Roll Trasero de Patagonia.
Entregado en `C:\Users\facun\OneDrive\Escritorio\Posicionador TopRoll Trasero v2\`
(ahí también viven los STEP fuente, en `_fuentes_y_datos\` — pesan 44-62 MB, no van al repo).

## Qué hay acá

Los 9 scripts CONGELADOS de la corrida original. **NO se corren** (tienen rutas absolutas
a un scratchpad temporal que ya no existe): son el registro histórico de los algoritmos,
que hoy viven parametrizados en `scripts/` + `scripts/cadlib/`. Cada archivo dice en su
header cuál es su versión genérica. `params_posicionador.json` rescata TODOS los números
del caso (frame, seed de ICP, cotas, avellanado, zonas) con su significado.

## Flujo que se usó (hoy: los CLIs genéricos)

1. Medir los STEP (`analyze_step`, `bbox_quick`) → identificar sólidos y roles.
2. Registrar posicionador ↔ pieza con ICP traslación-only (`register_v2` → hoy `register_icp.py`).
3. Modelar el empujador v2 en frame local + rotar a global (`build_v2b` — patrón gmsh OCC).
4. Verificar: colisión contra el sustrato RÍGIDO (`colision_check`/`colision_puntos` → hoy
   `check_collision.py`), planitud de la pared (`curvatura_pared` → `cadlib.geom.fit_plane`),
   asiento de cabezas M5 (`verify_holes` → `cadlib.geom.extract_cylinder_axes`).
5. Entregar: plantilla de agujereado desde el CAD medido + STL fino + conjunto + copia
   (`finalize` → hoy `export_deliverables.py`, que además EXIGE la evidencia de 4).

## Los errores caros (por qué existen los 2 gates)

1. **Modifiqué la torre equivocada** por adivinar con un export parcial → gate "ensamble
   completo + rol de cada sólido por código".
2. **"Más presión" ≠ clavar la cara en la pared rígida** (2,56 mm): la atraviesa. La presión
   sale del ángulo/cuña → gate "interferencia vs sustrato RÍGIDO ≈ 0".
3. **Renders v3/v4 entregados sin mirarlos** (agujero de más, lengüeta arriba) → gate
   "render + MIRARLO yo antes de entregar" (hoy además el gate duro de `export_deliverables.py`).
4. **Margen de agujero 12 mm pisaba la barra** con la cabeza DIN 7991 (luz 4,30 < 6,1) →
   por eso el margen quedó en 10 mm y existe el ring-test.

## Trampas técnicas que quedaron aprendidas (ver también memoria `reference_cad_gmsh_workflow`)

- `affineTransform` con matriz casi-ortogonal convierte todo a BSpline → usar `occ.rotate`.
- Tras cada boolean/fillet: `synchronize()` y re-obtener el sólido (los tags renumeran).
- ICP no fija ejes con perfiles constantes; validar con features únicos (hoy es un assert
  del `smoke_test.py`: la caja lisa desliza, el blob curvo converge exacto).
- `trimesh.contains` por lotes ≤2000 puntos o revienta la RAM.
