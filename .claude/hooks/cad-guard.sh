#!/usr/bin/env bash
# cad-guard.sh — Enforcement de las lecciones 3D (sesion 2026-07-21, 4 fallos = 1 patron:
# sustituir la fuente real por un proxy + entregar sin verificar).
#
# Detecta trabajo CAD/3D (gmsh, build123d, .venv-cad, archivos .step/.stl/.stp/.glb,
# scripts de cad-design) e inyecta UNA VEZ por hora los 2 GATES bloqueantes que hoy son
# prosa en el skill. Speed bump: bloquea esa llamada, la siguiente pasa.
#
# Exit 0 = permite. Exit 2 = bloquea con recordatorio.

set -e
INPUT=$(cat)

TARGET=$(printf '%s' "$INPUT" | node -e '
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(s);
    const t = j?.tool_input || {};
    process.stdout.write(String(t.command ?? "") + " " + String(t.file_path ?? ""));
  } catch { process.stdout.write(""); }
});
' 2>/dev/null || true)

if [ -z "${TARGET// /}" ]; then exit 0; fi

MATCH=0
# Herramientas / entorno CAD
if echo "$TARGET" | grep -qiE '(\.venv-cad|gmsh|build123d|trimesh|cadquery|import ocp|occ\.)'; then MATCH=1; fi
# Archivos 3D (modelar/exportar/medir)
if echo "$TARGET" | grep -qiE '\.(step|stp|stl|glb|iges|igs)([^a-z]|$)'; then MATCH=1; fi
# Scripts del skill cad-design / modelado de fixtures
if echo "$TARGET" | grep -qiE '(cad-design|former|nido|posicionador|fixture|register_v2|colision|analyze_step)'; then MATCH=1; fi

if [ "$MATCH" -eq 0 ]; then exit 0; fi

# Cooldown 60 min
FLAG="${TMPDIR:-/tmp}/claude-cad-guard.flag"
NOW=$(date +%s)
LAST=$(cat "$FLAG" 2>/dev/null || echo 0)
[ $((NOW - LAST)) -lt 3600 ] && exit 0
echo "$NOW" > "$FLAG" 2>/dev/null

cat >&2 << 'EOF'
[CAD-GUARD — 2 GATES antes de modelar/entregar 3D. Detalle: skill cad-design]
Causa raiz de los fallos 3D: sustituir la fuente real por un proxy (export parcial, capa
blanda, dibujo generico, "confio que salio") y NO verificar contra la fuente. Los 2 gates:

GATE PRE-MODELADO (antes de escribir geometria):
  1. Fuente de IDENTIDAD: tengo el ENSAMBLE completo, no un export parcial? Si es parcial -> STOP, pedir el assembly.
  2. Confirme CUAL pieza modificar (no adivinar) y compute el ROL de cada solido por codigo (trimesh.contains).
  3. Existe el 3D/STEP REAL de la pieza? Si existe -> PROHIBIDO usar un dibujo generico/representativo.
  4. Toda cota sale del STEP MEDIDO o es dato de Fak. CERO dimensiones inventadas/redondeadas/estimadas. Si falta -> TBD y preguntar.

GATE PRE-ENTREGA (antes de decir "listo" / pasarle algo a Fak):
  5. Renderice y MIRE yo el resultado (no que lo cace Fak). Adjuntar el render + el dato crudo.
  6. Chequeo geometrico: interferencia contra el SUSTRATO RIGIDO ~= 0 (no vs el tapizado blando).
  7. CADGenBench: validez(watertight) -> forma -> interface/fit -> topologia. Si falla el gate, NO entregar.

"Un cambio rapido sin verificar NO es rapido, es un ida-y-vuelta mas." Si ya cumpliste (o no aplica), reintenta y segui.
EOF
exit 2
