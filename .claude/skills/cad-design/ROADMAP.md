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
