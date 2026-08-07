---
name: cad-design
description: >
  Diseño y modificación de piezas 3D / CAD para Barack — importar un STEP/STL de cliente,
  medirlo, registrarlo contra otra pieza (ICP), modelar/modificar parametrico, verificar
  interferencia y holguras, y exportar STEP + STL + GLB + renders. Usar cuando Fak pida
  "diseñá/modificá esto en 3D", pase un archivo 3D (STEP/STL/IGES) para editar, pida un
  posicionador/fixture/utillaje impreso, o cualquier modelado de pieza. Incluye el entorno,
  la librería cadlib + CLIs genéricos y los errores caros que NO hay que repetir.
---

# cad-design — diseñar y modificar piezas 3D en Barack

Capacidad probada en el caso Posicionador Top Roll Trasero (ver
`examples/posicionador/README.md`: el caso completo, sus 4 errores caros y dónde viven
las fuentes). La librería vive en `scripts/cadlib/` + CLIs genéricos con `--help`.

## 0. LOS 3 GATES (bloqueantes)

> **Causa raíz de TODOS mis fallos 3D** (confirmada): bajo presión de "avanzar rápido"
> sustituyo la fuente real por un proxy (export parcial, capa blanda, dibujo genérico,
> "confío que salió") y salto la verificación → Fak termina siendo mi control de calidad.

**GATE 0 — LA ZONA** (antes de medir una sola cota). Un utillaje no se define por sus cotas sino
por la ZONA sobre la que actúa, y un número perfecto sobre la zona equivocada es peor que no medir:
da confianza. Se computa, no se mira.

```
gate_zona.py inventario <cliente.stp> --workdir W --render   # -> renders/gate0_mapa_<pieza>.png
# Fak circula cuál es sobre esa imagen
gate_zona.py inventario <cliente.stp> --workdir W --confirmar A3 --quien Fak --evidencia "..."
```

- Clasifica cada contorno PASANTE / REBAJE / ESCALÓN por **paridad de rayos**: un rebaje cosmético
  y una abertura tienen el mismo contorno y el mismo render; sólo se distinguen contando impactos
  adentro contra un anillo afuera.
- Agrupa por familias de tamaño: si la candidata mayor es una de varias iguales, sale AMBIGUO.
  Una feature que se repite casi nunca es "la" feature.
- Nunca auto-aprueba (exit 2 mientras falte `--confirmar`). Enforcement: `export_deliverables.py`
  exige `zona_confirmada` en el manifest.
- Pasarle `--normal` medida de la cara (`geom.fit_plane`): sin eso la deduce y puede reportar un
  pasante como resalte.

Hermanos del mismo CLI: `pasante` (un candidato puntual, en segundos), `macizo` (¿ese vano es aire
o material? — caza la lengüeta fundida que el render no muestra), `pose` (¿la transformación dejó
la pieza donde dije? — caza los errores de signo).

**GATE 1 — PRE-MODELADO** (antes de escribir geometría):
- ¿Tengo el ENSAMBLE completo, no un export parcial? Si es parcial → STOP, pedir el assembly.
- ¿Confirmé CUÁL pieza y computé el ROL de cada sólido por código (`cadlib.geom.contains_batched`
  + bboxes), sin adivinar?
- **¿Existe el 3D/STEP REAL? Si existe → PROHIBIDO usar un dibujo genérico/representativo.**
- Toda cota se EXTRAE del CAD medido (`cadlib.geom.extract_cylinder_axes`, `analyze_step.py`)
  o es dato de Fak. CERO dimensiones inventadas/redondeadas (extiende `core-prohibiciones` #1).

**GATE 2 — PRE-ENTREGA** (antes de decir "listo"): render + MIRAR yo el resultado + interferencia
contra el sustrato RÍGIDO ≈ 0 + CADGenBench (validez→forma→interface→topología) + evidencia.

**Enforcement**: el hook `cad-guard.sh` solo RECUERDA estos gates 1×/hora. El enforcement
duro está en `export_deliverables.py`: se NIEGA a entregar sin evidencia de `collision_check`
con 0 puntos dentro + render posterior al STEP en el manifest (override `--skip-gate` con
`--reason`, deja huella).

## 1. Entorno — UN solo intérprete

Todo corre con **`C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe`** (Py3.12: gmsh 4.15 +
build123d + cadquery + trimesh + rtree + scipy + matplotlib, verificado 2026-07-23).

| Qué | Comando |
|---|---|
| Crear el venv (si no está) | `py -3.12 -m venv .venv-cad` + `pip install build123d cadquery trimesh rtree numpy scipy matplotlib gmsh` |
| Correr un script | `PYTHONIOENCODING=utf-8 C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe <script> --help` |
| Autoverificar el entorno | `smoke_test.py --out <scratchpad>/cad-smoke` (8 checks, geometría sintética) |

Si un script se corre con el Python equivocado, `cadlib.envcheck` lo dice y sale con código 3.
(Fallback histórico: gmsh también corre en el Py3.14 del sistema, pero no hace falta.)

## 2. Convención de workdir

Cada pieza/trabajo usa un workdir en el scratchpad con `manifest.json` (transforms con
procedencia, frames, evidencia de verificación, caches) + `in/` (STEPs cliente) + `out/`
(piezas producidas) + `renders/` + `cache/` (nubes .npy pesadas). Lo crea el primer CLI
con `--workdir`. Las transforms se leen con nombre (`--transform skeleton`) — si no existe,
el error lista las disponibles. Parámetros de modelado: variables nombradas en un
`params.json` del workdir (patrón `examples/posicionador/params_posicionador.json`), nunca
literales sueltos en el código.

## 3. Flujo punta a punta (CLIs de `scripts/`, todos con `--help`)

0. **Confirmar la ZONA** — `gate_zona.py inventario <cliente.stp> --workdir W --render`,
   mandarle `renders/gate0_mapa_<pieza>.png` a Fak, volver con `--confirmar <id>`. **Antes de
   esto no se mide nada.**
1. **Medir** — `analyze_step.py <file>` (sólidos, bbox, caras planas+normales, y las 3 sondas
   de topología del §3bis: `--zone` / `--neighbors` / `--offset`); `bbox_quick.py <files...>`.
2. **Entender el ensamble POR CÓDIGO** (no "ver": COMPUTAR): rol de cada sólido por bbox +
   relación de aspecto; quién toca/entra en quién con `contains_batched` + cKDTree; reportar
   en criollo + números ANTES de modelar. Si hay dudas → confirmar con Fak.
3. **Registrar** (alinear pieza↔fixture) — `register_icp.py --workdir W --source F.step
   --target P.step --name skeleton [--source-faces "BSpline surface,Torus"] [--seed x,y,z]`.
   ICP traslación-only trimmed; exit 1 si rms dudoso. Validar con features ÚNICOS (la caja
   lisa DESLIZA — es un assert del smoke test). Con nubes casi idénticas: `--trim 1.0`.
4. **Modelar** — build123d parametrico (variables derivadas de dimensiones clave, variantes
   por parámetro). Patrón gmsh OCC de referencia: `examples/posicionador/build_v2b.py`
   (construir en frame local → `occ.rotate` a global; **NUNCA `affineTransform`** con matriz
   casi-ortogonal → todo BSpline; tras cada boolean/fillet `synchronize()` + re-obtener el
   sólido, los tags renumeran). Frames: `cadlib.geom.orthonormal_frame`.
5. **Verificar** — `check_collision.py --workdir W --fixture out/p.step --substrate cliente.step
   [--substrate-keep 2] [--transform skeleton] [--zone X:455,505] --render` → evidencia en el
   manifest, exit 1 si choca, puntos rojos en el render. Planitud: `cadlib.geom.fit_plane`.
   Secciones: `render_sections.py --pieces a.step:gris b.step:rojo --axis X --stations ...`.
6. **Enderezar para imprimir** — `a_plano.py --normal=<nx,ny,nz> --out out_print pieza.step`
   lleva la pieza del frame del cliente al de impresión (apoyada en z=0, centrada en XY) y
   **aborta si cambia el volumen**. La normal sale de `geom.fit_plane` sobre la cara de apoyo,
   no se adivina. Sin esto el laminador recibe la pieza torcida y a metros del origen.
7. **Entregar** — `export_deliverables.py --workdir W --pieces out_print/*.step --deliver <destino>
   [--glb]` → exige evidencia (gate §0), exporta STL binario fino (curvatura 40) + GLB,
   copia y registra la entrega. Avisa si la pieza sale en coordenadas del cliente.
   Después: ABRIR los archivos y mirarlos (verify-before-close).

## 3bis. Antes de mallar: LEER LA TOPOLOGÍA

**Presupuesto: si una consulta 3D va a tardar más de 2 minutos, está mal planteada.** Y el
primer resultado útil se le muestra a Fak apenas existe, no al final. Escalera de costo:

| Paso | Cómo (`analyze_step.py f.stp ...`) | Costo | Responde |
|---|---|---|---|
| buscar el feature | `--find [--only-free]` | instantáneo | DÓNDE está (sin saber tags) |
| buscar una ABERTURA | `find_openings.py f.stp` | instantáneo | ranuras/ventanas = lazos internos |
| acotar por ventana | `--zone X:a,b --zone Z:c,d` | instantáneo | qué hay en esta zona |
| vecinos (`getBoundary`) | `--neighbors t1,t2,...` | instantáneo | QUÉ es |
| muestreo paramétrico | `--offset t1,...` (la referencia se deduce) | segundos | CUÁNTO mide |
| mallar | los demás CLIs | minutos | último recurso, y solo la zona |

Todo junto: `--find --only-free --measure`. Motor en `cadlib.topo`; test: `topo_acceptance_test.py`.

- **Criterio duro: un feature SIN caras de flanco no tiene relieve.** Si las N caras del grupo
  comparten TODAS sus curvas con UNA sola vecina, es un contorno *imprentado* sobre la
  superficie: se ve en CATIA y en ningún visor de sólidos. Buscarlo a ojo en renders es tiempo
  tirado. Medirlo = offset contra el plano de esa vecina (0,000 mm ⇒ no hay cavidad).
- **Medir contra la cara equivocada da un número lindo y falso.** La referencia se deduce sola
  (la vecina que comparte más curvas); si se fuerza una que no está al lado, `measure_offset`
  ABORTA en vez de inventar. No forzarla sin correr `--neighbors` antes.
- **Las caras libres (sin sólido padre) se pierden con el default de gmsh**: `highestDimOnly=True`
  y el grabado directamente no existe (two_upholstered.stp: 2548 caras vs 2737). `cadlib.topo`
  carga con `False` y las marca `LIBRE`; el resto de los CLIs (mallado, colisión, render) NO las
  ve — por eso ningún render iba a mostrar el logo, por más triángulos que le pusiera.
- **`gmsh.model.removeEntities` NO recorta lo que se malla** (medido: caras 3→3, nodos 1344→1344).
  Para quedarse con parte del modelo: `occ.remove(..., recursive=True)` + `synchronize()` —
  es lo que hace `geom._load(keep=...)` (verificado end-to-end: 9405 → 356 pts).
- Ajuste de plano con nubes grandes: covarianza 3×3 (`geom.fit_plane`), **nunca**
  `np.linalg.svd(pts-ctr)` con `full_matrices=True` — con 490k puntos pide 1,75 TiB.

## 4. Verificar antes de cerrar — REGLA DURA

Render → MIRARLO → corregir, DESPUÉS de cada cambio (no post-export). Criterio CADGenBench
en orden: 1) validez (watertight/manifold), 2) forma, 3) interface/fit contra la pieza
destino, 4) topología (nº de agujeros/features). Más: reproducir cualquier choque que
reporte el cliente; tolerancias de impresión 0,3-0,5 mm/lado en vanos, panza ≥2 mm,
inserto heat-set + pin anti-giro.

## 5. Lecciones caras (el porqué de todo esto)

1. Confirmá CUÁL pieza ANTES de modelar (modifiqué la torre equivocada por adivinar).
2. Ensamble COMPLETO, no export parcial (sin él no se ven colisiones ni clips).
3. "Más presión" ≠ clavar la cara en la pared rígida: la ATRAVIESA. La presión sale del
   ángulo/cuña; interferencia solo contra compresión del material BLANDO (1-2 mm).
4. Luz de impresión: 0,3-0,5 mm/lado o el fixture impreso raspa/traba.
5. El ojo de Fak gana: "esto choca" = dato duro; reproducir y corregir, no defender el CAD.
6. **Una abertura NO se busca con `--find`** (2026-07-31, buscando ranuras): `--find` caza
   caras finas (grabados); con `--max-diag` grande escupe un cluster de 1465 caras que no dice
   nada. Las ranuras son **lazos internos** de la cara → `find_openings.py`. Y para ver cómo es
   una cara clase A: scatter de centroides de triángulos con normal +Z coloreados por Z — las
   aberturas aparecen como huecos, en segundos.
7. **El entregable impreso no va en coordenadas del cliente** (mismo día): entregué dos piezas en
   el frame del cliente, inclinadas y a metros del origen. Van apoyadas en z=0 y centradas →
   `a_plano.py` (paso 6 del flujo). El control de que no se tocó geometría es el **volumen idéntico**.
8. **Logo del Upper Trim (2026-07-31): 1 h 20 buscando un grabado a ojo en renders de 9 M de
   triángulos, y encima con el número MAL** — reporté −0,700 mm (el rebaje del pad) cuando la
   profundidad real es 0,000 mm: `removeEntities` no había recortado nada, así que "la cara con
   más nodos" era la clase A de alrededor y no el pad. Con las sondas del §3bis: 14 segundos y
   el dato correcto. Antes de mallar, leer la topología.

Mejoras candidatas (build123d-mcp, cad-cae-copilot, etc.): ver `ROADMAP.md` — nada de eso
está instalado hoy.
