# cad-design — roadmap de herramientas a evaluar (NADA de esto está instalado)

Investigación 2026-07-21, movida fuera del SKILL.md para que la skill describa solo
capacidad REAL. Antes de adoptar cualquiera: instalar, probar con el smoke test, y
recién ahí mencionarla en SKILL.md.

## Próximo paso concreto — `build123d-mcp`

github.com/pzfreo/build123d-mcp (Apache, activo): MCP que da al agente OJOS EN VIVO en el
loop — render PNG/SVG/DXF, medir geometría, detección de features (agujeros, bosses,
avellanados, patrones), comparar fit/alineación, importar STEP/STL, validez/printability,
`last_error`. Evidencia: CADGenBench 0.360→0.457, validez geométrica 88%→100%. Mismo
backend build123d + Py3.12 que `.venv-cad`. Instalar (necesita `uv`):

```
# en .mcp.json del proyecto:
#   "build123d": { "command": "uvx", "args": ["--python","3.12","build123d-mcp@latest"] }
# (activa la próxima sesión). Mantener register_icp/check_collision propios para la
# verificación FINA — el MCP no hace registración ni interferencia contra sustrato rígido.
```

## Pendientes internos (mejoras a cadlib, no herramientas de terceros)

- **Mallar SOLO una zona** (receta verificada 2026-07-31, todavía sin helper):
  `occ.remove(vols, recursive=False)` deja las caras sueltas → `occ.remove(caras que sobran,
  recursive=True)` → mallar. Medido en 3 cajas: 1344 → 272 nodos, igual que mallar la caja sola.
  `removeEntities` NO sirve para esto (no recorta nada de lo que se malla).
- Exponer las caras libres en el resto de los CLIs: hoy solo `cadlib.topo` carga con
  `highest_dim_only=False`; `bbox_quick.py` sigue reportando el conteo de caras sin ellas.
- Ya hecho 2026-07-31 (no volver a proponerlo): `geom._load(highest_dim_only=)`,
  `geom.fit_plane` por covarianza 3×3, y el módulo `cadlib.topo` con sus sondas.

## Gemas a minar (barrido 2026-07-21)

- **`armpro24-blip/cad-cae-copilot`** (41★, activo) — punteros de topología estables
  `@face:*` para ediciones dirigidas + edición DIFF-AWARE (detecta si una pieza se
  movió/cambió sin querer — hubiera cazado las v3/v4 rotas). También DFM, FEA CalculiX, BOM.
- **`filaPro/cad-recode`** (247★, ICCV'25) — point cloud → código CadQuery editable. Se
  engancha con el CR-Scan Raptor de Fak: escaneo → CAD paramétrico. Recupera geometría,
  no intención; punto de partida, no pieza final.
- **`clay-good/anvilate`** (pre-alpha) — cantera de código: tolerancias ISO 286, stack-ups
  Monte Carlo, DFM. Su geometría está verde; usar como librería de análisis.
- **Colisión madura**: `python-fcl` + `trimesh.collision.CollisionManager` como alternativa
  al contains propio si algún caso lo exige (piezas gigantes, muchas piezas).
- **Edición por texto sobre STEP**: `microsoft/CAD-Editor` (locate-then-infill) = referencia.

## Base relacionada ya disponible

- Skill global `text-to-cad-harness` (earthtojake/text-to-cad) = harness build123d/OCP con
  visor CAD Explorer local. Frontera con esta skill: text-to-cad-harness genera desde texto;
  cad-design mide/registra/verifica contra STEPs de cliente. Re-sincronizar con upstream
  de vez en cuando.

## Evaluado y DESCARTADO

- Blender-MCP y OpenSCAD-MCP: malla/CSG, sin BREP/STEP — no filetean ni operan el STEP del
  cliente. `clawd-maf/cad-agent`: stale, Docker, menos capaz que esta skill.
- CAD en vivo si algún día hace falta: `neka-nat/freecad-mcp` o conectores Fusion/Blender
  de claude.ai; Onshape tiene REST API.

---

# Barrido del 2026-08-29 (busqueda web, NO verificado por mi)

Lo que sigue lo reporto como lo devolvio la busqueda: versiones, numeros de benchmark y
estado de madurez **no los comprobe corriendo nada**. Antes de adoptar cualquiera va el
mismo criterio de siempre: instalar, correr contra un caso YA resuelto con numeros
conocidos, y aplicarle a la herramienta el test del valor gemelo (darle una pieza con
defecto conocido y ver si lo ve).

## Lo unico que cambio de verdad: `build123d-mcp` maduro hacia la VERIFICACION

Cuando se anoto arriba (julio) era render + medir + features. El barrido de agosto dice
que ahora trae justo lo que mas duele en este trabajo, y sobre B-Rep, no sobre malla:

| lo que trae | contra que leccion de este skill pega |
|---|---|
| `validate()` con localizacion 3D del defecto | §10 (cavidad sellada), §20 (validez por pieza) |
| `clearance()` — espesor de pared y fit | §18 (la capa de tapizado), el control de pared minima |
| `cross_sections()` con deteccion de vacios | §10 |
| `find_holes/bosses/countersinks/hole_patterns` | §3bis (leer topologia antes de mallar) |
| `shape_compare()` — donde y cuanto cambio una superficie | comparacion CAD-a-CAD, hoy artesanal |
| `verify_spec()` — geometria construida vs intencion declarada | §31 (un indice no es un criterio) |
| `design_audit()` — perturba parametros y mide robustez | §28 (el valor gemelo) |

Corre por `uvx`, o sea que **no contamina `.venv-cad`**. Su filosofia declarada ("honest
reporting over false positives") es §28 escrito por otro.
**Lo que NO hace: ICP ni colision contra el sustrato.** `register_icp.py` y
`check_collision.py` siguen siendo nuestros. El rol seria **segunda opinion al lado de los
gates, nunca reemplazo**.

## `argus-diff` — diff de STEP sobre B-Rep, en alfa

`pip install "argus-diff[render]"`. Mismo kernel (OCCT via OCP). Compara dos STEP y
localiza el cambio analiticamente ("cara cilindrica: radio 2,500 -> 3,000"), con
interferencia por booleano. El caso de uso es de manual: **el cliente manda una revision
nueva y hay que saber que cambio**. Alfa confesa, un autor, una estrella: se prueba
supervisado sobre un cambio de revision real y se compara contra lo que se encuentre a
mano. Si no aguanta, la tecnica de localizacion analitica se mina hacia `cadlib`.

## Lo que el barrido dice que NO conviene, y cierra la pregunta

- **Generacion text-to-CAD: no, y se puede cerrar por 6-12 meses.** Cuatro fuentes
  independientes coinciden (MUSE, Text2CAD-Bench, CadBench, y las pruebas de terceros
  sobre Zoo/KittyCAD): la geometria sale dimensionalmente no confiable y el mismo prompt
  da resultados distintos entre corridas. Modelar parametrico contra cotas extraidas del
  STEP medido es mas fuerte que cualquier generador de 2026. Lo unico minable gratis de
  ese mundo es el corpus de assertions de **CADTestBench**.
- **Reconocimiento de features por GNN (AAGNet y familia): no.** Entrenados sobre piezas
  prismaticas de mecanizado; los paneles de NURBS recortadas de CATIA no se parecen en
  nada a ese dominio. `reconocer_caras.py` + `ShapeAnalysis_Canonical` es el approach
  correcto para esta geometria.
- **`occwl` (Autodesk):** envuelve pythonocc, no OCP. Meterlo en `.venv-cad` es riesgo de
  conflicto de bindings. Solo como fuente de lectura.
- **Fixture design automatizado: no hay NADA instalable.** Todo lo que existe son papers
  de RL para layout y ML de deformacion, sobre fixtures de mecanizado en metal. Para
  nidos y apoyos sobre piezas blandas no hay open source. La §31 de este skill —enumerar
  el conjunto factible entero y optimizar sobre el— ya es lo mejor disponible.

## Lo que confirma, y conviene tener a mano cuando alguien pregunte

Los tres fallos recurrentes de este skill tienen literatura de 2026 con nombre propio:
sustituir la fuente por un proxy es *verification asymmetry*; un agente que escribe sus
propios controles los escribe ciegos (§28) tiene paper con estadistica; y la contramedida
que propone el area es la que ya esta implementada aca: **inyeccion de fallas**.
Y el dato que ordena todo: **el campo entero invierte en GENERAR CAD, casi nadie en
VERIFICAR CAD contra la pieza de un cliente.** Por eso lo mejor disponible para lo que
hacemos es un proyecto de una sola persona, y por eso estos gates no tienen reemplazo
comercial ni academico a agosto de 2026.
