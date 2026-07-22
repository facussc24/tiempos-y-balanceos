---
name: cad-design
description: >
  Diseño y modificación de piezas 3D / CAD para Barack — importar un STEP/STL de cliente,
  medirlo, registrarlo contra otra pieza (ICP), modelar/modificar parametrico, verificar
  interferencia y holguras, y exportar STEP + STL + GLB + renders. Usar cuando Fak pida
  "diseñá/modificá esto en 3D", pase un archivo 3D (STEP/STL/IGES) para editar, pida un
  posicionador/fixture/utillaje impreso, o cualquier modelado de pieza. Incluye el entorno,
  la librería de scripts probada y los errores caros que NO hay que repetir.
---

# cad-design — diseñar y modificar piezas 3D en Barack

Nace del proyecto Posicionador Top Roll Trasero (Patagonia): tomar un STEP complejo, medirlo,
modificarlo con la modificación EXACTA pedida, verificar que no choca, y entregar para imprimir.
La capacidad está probada; este skill la hace repetible y evita los errores que ya cometí.

## 0. LOS 2 GATES (bloqueantes — el hook `cad-guard.sh` los inyecta; NO son opcionales)

> **Causa raíz de TODOS mis fallos 3D** (confirmada): bajo presión de "avanzar rápido" sustituyo la
> fuente real por un proxy (export parcial, capa blanda, dibujo genérico, "confío que salió") y salto
> la verificación → Fak termina siendo mi control de calidad. Es el MISMO patrón de
> `feedback_identidad_codigo_pieza_autoridad_destino` y `feedback_no_entregable_ejecutable_sin_verificar`.
> El fix son 2 barreras que se cumplen SÍ o SÍ:

**GATE PRE-MODELADO** (antes de escribir geometría):
- ¿Tengo el ENSAMBLE completo, no un export parcial? Si es parcial → STOP, pedir el assembly.
- ¿Confirmé CUÁL pieza y computé el ROL de cada sólido por código (`trimesh.contains`), sin adivinar?
- **¿Existe el 3D/STEP REAL? Si existe → PROHIBIDO usar un dibujo genérico/representativo.** Buscar la
  feature real ANTES (ej: la abertura del tweeter YA estaba en el STEP; la busqué recién cuando Fak
  me cazó el dibujo genérico). Un genérico solo si la fuente real es genuinamente inobtenible, rotulado.
- **GEOMETRÍA REAL, nunca placeholder:** toda cota se EXTRAE del CAD medido (patrón `finalize.py`, que
  saca features reales y NO hardcodea) o es dato de Fak. CERO dimensiones inventadas/redondeadas/
  estimadas si existe el STEP. Si falta un dato real → TBD y preguntar (extiende `core-prohibiciones` #1).

**GATE PRE-ENTREGA** (antes de decir "listo"): render + MIRÁ vos el resultado + chequeo geométrico
(interferencia vs sustrato RÍGIDO ≈ 0) + CADGenBench (validez→forma→interface→topología) + adjuntar la
evidencia. "Un cambio rápido sin verificar NO es rápido, es un ida-y-vuelta más." Detalle en §4.

## Lecciones caras (el porqué de los gates)

1. **Confirmá CUÁL pieza modificar ANTES de modelar.** En el posicionador modifiqué la torre
   equivocada por adivinar con un export parcial. Identificá la pieza correcta con el cliente o con
   el ensamble completo. Si hay ambigüedad, mostrá un render y confirmá.
2. **Pedí el ENSAMBLE COMPLETO, no un export parcial.** Un STEP con 2 sólidos NO es el conjunto:
   pueden faltar torres, columnas, clips. Sin el ensamble no se ven colisiones ni se modelan
   alivios/agujeros para clips. Onshape/Fusion/AutoCAD: File → Export TODO el assembly.
3. **"Más presión / más apriete" ≠ clavar la cara más adentro.** Contra una pared rígida fina
   (ej. 2,56 mm) meter la cara 4-7 mm la ATRAVIESA = choque, no apriete. La presión sale del
   ÁNGULO/cuña concentrando el contacto donde va el pegado, con interferencia ~compresión del
   material blando (1-2 mm). **Verificá interferencia contra el SUSTRATO RÍGIDO, no contra el
   tapizado/espuma** (el blando engaña: parece que hay para comprimir, pero abajo está lo rígido).
4. **Dejá luz de tolerancia de impresión:** lados que entran en un vano 0,3-0,5 mm/lado (no 100%
   del hueco); panza/pie ≥2 mm. Un fixture "justo" en CAD raspa o traba impreso.
5. **El ojo del que conoce la pieza gana.** Si Fak dice "esto choca", tiene razón: reproducilo y
   corregí, no defiendas el CAD. Sus observaciones de planta son dato duro.

## 1. Entorno CAD

Dos motores; usar el que corresponda:

- **build123d / CadQuery (parametrico ergonomico)** — el mejor para MODELAR desde cero o editar
  parametrico. Requiere **Python 3.9–3.12** (OCP NO corre en 3.13/3.14). Entorno dedicado:
  ```
  # crear una vez (con Python 3.12 instalado):
  py -3.12 -m venv C:\Dev\BarackMercosul\.venv-cad
  C:\Dev\BarackMercosul\.venv-cad\Scripts\python -m pip install -U pip
  C:\Dev\BarackMercosul\.venv-cad\Scripts\pip install build123d cadquery trimesh numpy scipy matplotlib gmsh
  # correr:
  C:\Dev\BarackMercosul\.venv-cad\Scripts\python  models\mi_pieza.py
  ```
- **gmsh 4.15 (OpenCascade) — funciona en Python 3.14 del sistema** — es el kernel para IMPORTAR y
  MEDIR STEPs de cliente, mallar, chequear geometría. Es lo que domino y lo que usan los scripts de
  `scripts/`. Correr siempre con `PYTHONIOENCODING=utf-8`.

Regla práctica: **medir/importar/verificar con gmsh; modelar nuevo con build123d** (cuando el venv
3.12 esté). Si el venv no está, se puede modelar con gmsh OCC (`addBox/addCylinder/addCone/cut/fuse/
fillet/rotate`) — más verboso pero probado (ver `build_v2b.py`).

## 2. Flujo punta a punta (con los scripts de `scripts/`)

1. **Medir el STEP del cliente** — `analyze_step.py <file>` (sólidos, bboxes, volúmenes, caras
   planas con normal/ángulo). `bbox_quick.py` para bbox rápido sin mallar. Geometría "sucia"
   (superficie A automotriz) que falla al mallar → muestreo parametrico `getValue`+`isInside`.
1.5. **ENTENDER el ensamble POR CÓDIGO antes de tocar** (la fuerza de este agente — no "ver", COMPUTAR).
   No adivinar cuál pieza es qué: caracterizar cada sólido numéricamente y REPORTARLO en criollo +
   números antes de modelar. Chequeos concretos:
   - **Rol de cada sólido**: ¿es placa (fina + plana), brazo/torre (esbelto que sobresale), barra?
     (por bbox + relación de aspecto + caras dominantes).
   - **Quién toca/entra en quién**: para cada par pieza↔fixture, contar puntos de A dentro de B
     (`trimesh.contains`) y medir la mínima distancia (cKDTree). Distinguir **"entra en un hueco/
     ventana"** (rodeado de material de la pieza en +/- de un eje) de **"aprieta una pared"** (toca
     una cara externa) de **"solo apoya"**. Esto identifica LA pieza correcta a modificar sin ojo.
   - **Interferencia vs sustrato RÍGIDO** (no el blando) por zona, con profundidad y extensión en mm.
   - Salida: un resumen tipo "sólido 1 = negativo que ENTRA en la ventana X[..] (rodeado en Y±);
     sólido 2 = barra que APRIETA la pared del pico, interferencia 4-9mm". Confirmar con Fak si hay
     dudas. Esto es lo que faltó en el posicionador: se adivinó en vez de computar el rol.
2. **Registrar pieza ↔ fixture** (si hay que alinear dos piezas) — `register_v2.py` (ICP
   traslación-only trimmed con cKDTree; validar con features únicos, NO con perfiles constantes que
   no fijan el eje longitudinal). Guarda las matrices `T_*.npy`.
3. **Modelar / modificar** — build123d (parametrico, variables + variantes) o `build_v2b.py` como
   patrón gmsh (construir en frame local alineado a ejes → `occ.rotate` a global; **NUNCA
   `affineTransform` con matriz casi-ortogonal** → convierte todo a BSpline; tras cada boolean/fillet
   `synchronize()` y re-obtener el sólido con `getEntities(3)`, los tags renumeran).
4. **Verificar** — `colision_check.py` / `colision_puntos.py` (puntos de la pieza RÍGIDA dentro del
   fixture = choque; renderiza en rojo dónde). `curvatura_pared.py` (¿la cara toca parejo o solo en
   picos?). `verify_holes.py` (ring-test de cabezas avellanadas). `trimesh.contains` por lotes ≤2000
   pts o revienta la RAM. Chequear watertight y holguras.
5. **Exportar + entregar** — STEP (`gmsh.write`, geometría OCC) + **STL binario**
   (`gmsh.option.setNumber("Mesh.Binary",1)` + `Mesh.MeshSizeFromCurvature`, archivos livianos) +
   **GLB** (para el visor web de la galería) + renders (`render_step.py`, `render_conjunto.py`,
   `secciones.py`). `finalize.py` = patrón de cierre (extrae features reales del CAD para la
   plantilla, no hardcodea; regenera todo; copia a destino). **Abrir y mirar el archivo antes de
   entregar** (regla verify-before-close).

## 3. Entregables típicos de un fixture

STEP + STL(binario) de cada pieza y variantes, conjunto con la pieza en posición (un archivo para ver
el calce), plantilla de agujereado (PNG + DXF, cotas del CAD medido), render de secciones mostrando
que NO choca, README corto. Para diseños de CLIENTE: no publicar en repos públicos; ver galería
(Fase 2) con almacenamiento privado.

## 4. Verificar antes de cerrar — REGLA DURA

**Renderizar e inspeccionar el resultado DESPUÉS DE CADA CAMBIO, antes de entregar.** No pasarle a
Fak un archivo sin haberlo mirado yo primero (renders v3/v4 del posicionador salieron mal —agujero al
pepe, lengüeta por arriba— y Fak los tuvo que cazar al abrirlos). Un cambio rápido sin verificar NO es
rápido, es un ida-y-vuelta más. Es la práctica #1 del rubro ("los agentes que hacen CAD están ciegos"
→ la solución es render→ver→corregir en el loop, no post-export).

Criterio de aceptación objetivo (metodología CADGenBench — aplicar en orden, si falla el gate, no
entregar):
1. **Validez** — BREP watertight / manifold (si falla, todo lo demás no vale).
2. **Forma** — la geometría se parece a la intención (distancia de superficie + solape de volumen).
3. **Interface/fit** — las caras de acople encajan con la pieza destino (features contra sub-volúmenes).
4. **Topología** — nº de agujeros/features correctos (no perdí ni agregué material inesperado).
Más lo propio de fixtures: reproducir cualquier choque que reporte el cliente; interferencia contra
sustrato rígido ~0 (salvo compresión buscada del blando); STEP abre; **mirar el archivo**.
Si toca la app (galería): `npm run build` OK antes de push (regla git-deploy).

## 5. Herramientas maduras a adoptar (investigado 2026-07-21 — no reinventar)

**PRÓXIMO PASO concreto — `build123d-mcp`** (github.com/pzfreo/build123d-mcp, Apache, activo): MCP que
le da al agente **OJOS EN VIVO** dentro del loop — render PNG/SVG/DXF, medir geometría (vol/área/bbox/
centro de masa), **detección de features** (agujeros, bosses, avellanados, patrones), comparar fit/
alineación, importar STEP/STL de referencia, validez/printability, y `last_error`. Evidencia dura:
subió CADGenBench 0.360→0.457 y validez geométrica 88%→100%. Mismo backend build123d + Python 3.12 que
el `.venv-cad`. Instalar (necesita `uv`):
```
# en ~/.claude.json o .mcp.json del proyecto:
#   "build123d": { "command": "uvx", "args": ["--python","3.12","build123d-mcp@latest"] }
# (activa la próxima sesión). Mantener los scripts propios (ICP register_v2, colision_check) para la
# verificación FINA — el MCP no hace registración ni interferencia contra sustrato rígido.
```
- **Metodología CADGenBench** (github.com/huggingface/cadgenbench) — ya integrada como criterio de
  aceptación en §4. Es know-how, no dependencia.
- **Base ya instalada**: skill `text-to-cad-harness` (earthtojake/text-to-cad, 9,5k★) = el harness
  build123d/OCP líder; re-sincronizar con upstream de vez en cuando.
- **CAD en vivo (si algún día hace falta)**: `neka-nat/freecad-mcp` (1,4k★, FreeCAD GUI vivo) o los
  conectores oficiales Fusion/Blender de claude.ai. Onshape tiene REST API.
- **IGNORAR** (evaluado): Blender-MCP y OpenSCAD-MCP (malla/CSG, sin BREP/STEP — no filetean ni operan
  sobre el STEP del cliente); `clawd-maf/cad-agent` (stale, Docker, menos capaz que esta skill).

### Gemas nuevas a minar (barrido 2026-07-21)
- **`armpro24-blip/cad-cae-copilot`** (41★, activo) — LO MÁS FUERTE: agente build123d/OCCT maduro con
  **punteros de topología estables `@face:*`** para ediciones dirigidas y **edición DIFF-AWARE (detecta
  si una pieza se movió/cambió sin querer)** — justo lo que hubiera cazado la v3/v4 rotas. También DFM,
  FEA CalculiX, BOM, standard parts. Estudiar y adoptar su topology-pointer + diff-edit.
- **`filaPro/cad-recode`** (247★, ICCV'25) — point cloud → código CadQuery editable. **Se engancha con el
  CR-Scan Raptor de Fak**: convierte un escaneo en CAD paramétrico en vez de malla muerta. Recupera
  geometría, no intención; punto de partida, no pieza final.
- **`clay-good/anvilate`** (pre-alpha, mismo stack) — CANTERA de código: tolerancias **ISO 286**,
  stack-ups Monte Carlo, DFM, packs normativos. Su geometría está verde; usar como librería de análisis.
- **Colisión: NO reinventar** — usar `python-fcl` + `trimesh.collision.CollisionManager` (maduros) en el
  paso Verificar, en vez del contains a mano.
- **Edición por texto sobre STEP**: `microsoft/CAD-Editor` (locate-then-infill) = método de referencia.
