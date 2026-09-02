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

# Camino rapido: si el despachador ya parseo el JSON, lo reuso.
# Si no (guardian corrido suelto), parseo yo como siempre.
if [ -n "${HOOK_PARSED4+x}" ]; then
  PARSED="$HOOK_PARSED4"
else
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
fi

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
[CAD-GUARD — RECORDATORIO 1x/h de los gates 3D. Detalle: skill cad-design]
Dos causas raiz. La primera: sustituir la fuente real por un proxy (export parcial, capa
blanda, dibujo generico, "confio que salio") y NO verificar contra la fuente. La segunda,
encontrada el 02/09/2026 despues de TRES entregas rechazadas en tres dias con el calculo
estructural bien las tres veces: disenar la ESTRUCTURA y no el PROCESO.

GATE P — EL PROCESO (antes de abrir un CAD). Todo lo de abajo mira la pieza QUIETA; lo que
hace fallar un dispositivo pasa MIENTRAS el operario trabaja:
  0a. Que FUERZAS actuan sobre la pieza en cada etapa, y que PIEZA del dispositivo resuelve
      cada una. Toda etapa de la secuencia lleva al menos una fuerza analizada.
  0b. Si el que pide mando un VIDEO/plano/foto, se mira ANTES de disenar. El video ES el pliego.
  0c. Que tiene Barack YA fabricado que resuelva algo parecido:
      indice_dispositivos.py --buscar <mecanismo>
  Ejecutable:  gate_proceso.py plantilla --tags <...> > pliego.json
               gate_proceso.py verificar pliego.json --workdir W --carpeta-pedido <dir>

GATE PRE-MODELADO (antes de escribir geometria):
  1. Tengo el ENSAMBLE completo, no un export parcial? Si es parcial -> STOP, pedir el assembly.
  2. Confirme CUAL pieza modificar (no adivinar) y compute el ROL de cada solido por codigo.
  3. Existe el 3D/STEP REAL de la pieza? Si existe -> PROHIBIDO usar un dibujo generico.
  4. Toda cota sale del STEP MEDIDO o es dato de Fak. Si falta -> TBD y preguntar.

GATE PRE-ENTREGA (antes de decir "listo" / pasarle algo a Fak):
  5. Renderice y MIRE yo el resultado. Adjuntar el render + el dato crudo.
  6. Interferencia contra el SUSTRATO RIGIDO ~= 0 (no vs el tapizado blando).
  7. CADGenBench: validez(watertight) -> forma -> interface/fit -> topologia.
  8. Lo que va a Fak: PDF visual + STEP + SIMULACION GRABADA. Un .txt o un .html NO son el
     entregable. Los renders con foto3d.py (fondo blanco), NUNCA con matplotlib.
     Ejecutable:  gate_entregable.py --entrega <carpeta> --motor foto3d --render *.png

Enforcement DURO: export_deliverables.py NO entrega sin evidencia en manifest.json
(proceso_declarado sin fuerzas pendientes + collision_check con 0 puntos dentro + render
fresco), y con --final corre ademas el gate de entregable sobre la carpeta destino.
Usa el workdir + los CLIs del skill. Si ya cumpliste (o no aplica), reintenta y segui.
EOF
exit 2
