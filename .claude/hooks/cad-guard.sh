#!/usr/bin/env bash
# cad-guard.sh — RECORDATORIO (1x por hora) de los 2 gates 3D del skill cad-design.
#
# HONESTIDAD: esto NO es enforcement — bloquea UNA llamada y recuerda los gates; la
# siguiente pasa. El enforcement DURO vive en export_deliverables.py, que se niega a
# entregar sin evidencia (collision_check n_inside=0 + render fresco) en manifest.json.
#
# Matching por tool_name para no disparar con comandos read-only que solo MENCIONAN
# una palabra CAD (ls/grep/cat): Bash/PowerShell solo si EJECUTA python CAD;
# Write/Edit solo si escribe un archivo 3D o un .py que importa gmsh/build123d.
#
# Exit 0 = permite. Exit 2 = bloquea con recordatorio.

set -e
INPUT=$(cat)

PARSED=$(printf '%s' "$INPUT" | node -e '
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(s);
    const t = j?.tool_input || {};
    const clean = x => String(x ?? "").replace(/[\x1f\n\r]/g, " ");
    // separador \x1f: TAB es whitespace para IFS y colapsa los campos vacios
    process.stdout.write([
      clean(j?.tool_name),
      clean(t.command).slice(0, 4000),
      clean(t.file_path),
      clean(t.content ?? t.new_string).slice(0, 4000)
    ].join("\x1f"));
  } catch { process.stdout.write(""); }
});
' 2>/dev/null || true)

MATCH=0
if [ -z "$PARSED" ]; then
  # Fallback si node no pudo parsear: NO desactivarse en silencio — grep burdo del JSON crudo
  printf '%s' "$INPUT" | grep -qiE '(gmsh|build123d|cadquery|\.venv-cad|\.(step|stp|stl|glb|iges|igs)[^a-z])' && MATCH=1
else
  IFS=$'\x1f' read -r TOOL CMD FILE BODY <<< "$PARSED"
  case "$TOOL" in
    Bash|PowerShell)
      # solo si EJECUTA python (o el venv CAD) sobre algo CAD — un ls/grep que menciona
      # "posicionador" ya no dispara
      if printf '%s' "$CMD" | grep -qiE '(python|\.venv-cad)'; then
        printf '%s' "$CMD" | grep -qiE '(gmsh|build123d|cadquery|trimesh|\.venv-cad|\.(step|stp|stl|glb|iges|igs)([^a-z]|$))' && MATCH=1
      fi ;;
    Write|Edit)
      printf '%s' "$FILE" | grep -qiE '\.(step|stp|stl|glb|iges|igs)$' && MATCH=1
      if [ "$MATCH" -eq 0 ] && printf '%s' "$FILE" | grep -qiE '\.py$'; then
        printf '%s' "$BODY" | grep -qiE '(import +(gmsh|build123d|cadquery|trimesh)|from +(build123d|cadlib))' && MATCH=1
      fi ;;
  esac
fi

[ "$MATCH" -eq 0 ] && exit 0

# Cooldown 60 min
FLAG="${TMPDIR:-/tmp}/claude-cad-guard.flag"
NOW=$(date +%s)
LAST=$(cat "$FLAG" 2>/dev/null || echo 0)
[ $((NOW - LAST)) -lt 3600 ] && exit 0
echo "$NOW" > "$FLAG" 2>/dev/null

cat >&2 << 'EOF'
[CAD-GUARD — RECORDATORIO 1x/h de los 2 gates 3D. Detalle: skill cad-design]
Causa raiz de los fallos 3D: sustituir la fuente real por un proxy (export parcial, capa
blanda, dibujo generico, "confio que salio") y NO verificar contra la fuente. Los 2 gates:

GATE PRE-MODELADO (antes de escribir geometria):
  1. Tengo el ENSAMBLE completo, no un export parcial? Si es parcial -> STOP, pedir el assembly.
  2. Confirme CUAL pieza modificar (no adivinar) y compute el ROL de cada solido por codigo.
  3. Existe el 3D/STEP REAL de la pieza? Si existe -> PROHIBIDO usar un dibujo generico.
  4. Toda cota sale del STEP MEDIDO o es dato de Fak. Si falta -> TBD y preguntar.

GATE PRE-ENTREGA (antes de decir "listo" / pasarle algo a Fak):
  5. Renderice y MIRE yo el resultado. Adjuntar el render + el dato crudo.
  6. Interferencia contra el SUSTRATO RIGIDO ~= 0 (no vs el tapizado blando).
  7. CADGenBench: validez(watertight) -> forma -> interface/fit -> topologia.

Enforcement DURO: export_deliverables.py NO entrega sin evidencia en manifest.json
(collision_check con 0 puntos dentro + render fresco). Usa el workdir + los CLIs del skill.
Si ya cumpliste (o no aplica), reintenta y segui.
EOF
exit 2
