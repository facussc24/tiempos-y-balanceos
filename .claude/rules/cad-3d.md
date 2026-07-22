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

# Diseño 3D / CAD — 2 gates (regla corta; detalle y scripts: skill `cad-design`)

Causa raíz de mis fallos 3D: sustituir la fuente real por un proxy + entregar sin verificar. Los 2
gates NO son opcionales (los enforcea el hook `cad-guard.sh`):

**PRE-MODELADO:** (1) ensamble COMPLETO, no export parcial (si es parcial → STOP, pedir assembly);
(2) confirmar CUÁL pieza + computar el ROL de cada sólido por código, no adivinar; (3) **si existe el
STEP REAL, PROHIBIDO usar dibujo genérico** — buscar la feature real ANTES; (4) toda cota se EXTRAE del
STEP medido o es dato de Fak — CERO dimensiones inventadas/redondeadas (extiende `core-prohibiciones` #1).

**PRE-ENTREGA:** render + MIRAR yo el resultado + interferencia contra el sustrato RÍGIDO ≈ 0 (no vs el
tapizado blando) + CADGenBench (validez→forma→interface→topología) + adjuntar evidencia. Nunca decir
"listo" sin esto — "un cambio rápido sin verificar no es rápido, es un ida-y-vuelta más".

Entorno: `.venv-cad` (Py3.12 + build123d) para modelar; gmsh en Py3.14 para medir/importar STEP.
Tolerancias de impresión: 0,3-0,5 mm/lado en lo que entra en un vano, panza ≥2 mm, inserto heat-set +
pin anti-giro. Autoridad de identidad = master real, no proxy (unifica con
`feedback_identidad_codigo_pieza_autoridad_destino`).
