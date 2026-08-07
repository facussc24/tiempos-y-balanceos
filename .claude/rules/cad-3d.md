---
paths:
  - ".venv-cad/**"
  - ".claude/skills/cad-design/**"
  - "**/*.step"
  - "**/*.stp"
  - "**/*.stl"
  - "**/*.glb"
  - "**/*.iges"
---

# Diseño 3D / CAD — 3 gates (regla corta; detalle y scripts: skill `cad-design`)

Causa raíz de mis fallos 3D: sustituir la fuente real por un proxy + entregar sin verificar. Los
gates NO son opcionales (el hook `cad-guard.sh` los recuerda 1×/h; el gate DURO es
`export_deliverables.py`, que no entrega sin evidencia de colisión + render en manifest.json):

**GATE 0 — DÓNDE (antes que cualquier otra cosa).** Un utillaje no se define por sus cotas sino por
la ZONA de la pieza sobre la que actúa. Antes de medir nada:

1. Renderizar el 3D del cliente y **marcar sobre esa imagen la zona que entendí**, con el nombre de
   la feature ("el borde del hueco X", no "las ranuras").
2. **Pasarle esa imagen a Fak y esperar que confirme.** Él responde marcando con círculos sobre el
   render — es el formato que usa y es inequívoco.
3. Recién con la zona confirmada se mide y se modela.

Sin este gate se puede pasar un día entero midiendo con precisión de centésimas **la feature
equivocada**, y ninguna verificación posterior lo detecta: todas miden contra la zona que elegí yo.
Pasó el 2026-08-06 (se tomaron las ranuras de los listones en vez del borde del hueco del cargador;
tres versiones tiradas).

**GATE 0.1 — QUÉ es esa zona (ejecutable, antes de mandar el render).** Confirmar el DÓNDE sobre una
imagen no distingue una abertura de un rebaje: el mismo día, **ya con la zona confirmada**, se midió
el contorno de un rebaje de 125×65 creyendo que era el hueco — el panel era macizo ahí. En un render
los dos se ven igual: la confirmación humana es autoridad sobre la UBICACIÓN, nunca sobre la
topología. El "qué" se computa:

```
.venv-cad\Scripts\python.exe .claude\skills\cad-design\scripts\gate_zona.py \
    inventario <cliente.stp> --workdir <W> --render
```

Lista TODAS las aberturas por área y clasifica cada una PASANTE / REBAJE / ESCALÓN por **paridad de
rayos** (rayos adentro del contorno contra un anillo afuera: si adentro hay los mismos impactos que
afuera, ahí hay material). **Agrupa por tamaño y marca las familias repetidas** — una feature que se
repite casi nunca es "la" feature, y ahora eso se cuenta en vez de recordarse. Deja
`renders/gate0_mapa_<pieza>.png` con cada abertura numerada: **ése es el render que se le manda a
Fak**. Nunca auto-aprueba: sale con código 2 mientras falte `--confirmar <id> --quien Fak
--evidencia "..."`. **Enforcement duro:** `export_deliverables.py` no entrega sin `zona_confirmada`
en el manifest.

Ojo con la normal: sin `--normal` la deduce y puede errarle — pasarle la medida de la cara
(`geom.fit_plane`). Con la normal equivocada un pasante se reporta como resalte (comprobado).

**Dos cosas más que NO se verifican a ojo**, mismo CLI:
- **Un vano que tiene que ser AIRE:** `gate_zona.py macizo --pieza P.step --caja x0,y0,z0,x1,y1,z1
  --esperado aire`. Un cuello macizo no tiene nodos de malla adentro, así que buscarlos ahí devuelve
  "libre" cuando la lengüeta está FUNDIDA a la placa — pasó, y en el render no se veía.
- **Toda transformación que se aplica "para que algo quede en X" termina comprobando que quedó en X:**
  `gate_zona.py pose --pieza out/p.step --esperar-luz -0.20 --tol 0.05`. Reporta la luz CON SIGNO y
  avisa cuando el valor sale espejado. Sin ese assert se encadenan errores de signo — van cuatro.

**GATE 1 — PRE-MODELADO:** (1) ensamble COMPLETO, no export parcial (si es parcial → STOP, pedir
assembly); (2) confirmar CUÁL pieza + computar el ROL de cada sólido por código, no adivinar; (3) **si
existe el STEP REAL, PROHIBIDO usar dibujo genérico** — buscar la feature real ANTES; (4) toda cota se
EXTRAE del STEP medido o es dato de Fak — CERO dimensiones inventadas (extiende `core-prohibiciones` #1);
(5) **escribir la SECUENCIA DE LA OPERACIÓN en una línea** (quién apoya qué sobre qué, si hay calor,
presión, cuánto tiempo) y que Fak la confirme. El mecanismo sale de la operación, no al revés.

**PRE-ENTREGA:** render + MIRAR yo el resultado + interferencia contra el sustrato RÍGIDO ≈ 0 (no vs el
tapizado blando) + CADGenBench (validez→forma→interface→topología) + adjuntar evidencia. Nunca decir
"listo" sin esto — "un cambio rápido sin verificar no es rápido, es un ida-y-vuelta más".

Entorno: TODO corre con `.venv-cad\Scripts\python.exe` (Py3.12: gmsh + build123d + trimesh).
Tolerancias de impresión: 0,3-0,5 mm/lado en lo que entra en un vano, panza ≥2 mm, inserto heat-set +
pin anti-giro. Autoridad de identidad = master real, no proxy (unifica con
`feedback_identidad_codigo_pieza_autoridad_destino`).
