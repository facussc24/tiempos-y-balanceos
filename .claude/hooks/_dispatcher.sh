#!/usr/bin/env bash
# Despachador de guardianes PreToolUse.
#
# POR QUE EXISTE (medido el 2026-08-04 en la notebook de Fak):
#   Los 8 guardianes corrian como 8 hooks separados. Cada uno arrancaba bash
#   (~220 ms) y node (~255 ms) para parsear EL MISMO JSON. Total 5.580 ms de
#   espera antes de CADA Bash/Write/Edit, de los cuales 3.800 ms eran puro
#   arrancar programas.
#   Aca se arranca bash UNA vez y node UNA vez, y el resultado se comparte.
#
# CONTRATO (identico al de un hook suelto):
#   exit 0 = permite ·  exit 2 = bloquea y el stderr va a Claude
#   Si CUALQUIER guardian devuelve 2, se bloquea con SU mensaje y no se sigue.
#
# POR QUE CADA GUARDIAN CORRE EN SUBSHELL — es la parte delicada:
#   Varios usan `exit 0` a mitad de camino para decir "aca no tengo nada que
#   ver". Si se los ejecutara en el shell del despachador, ese `exit 0` lo
#   cortaria y los guardianes SIGUIENTES no correrian nunca, en silencio.
#   Un guardian que no corre parece un guardian que aprobo. Por eso cada uno
#   va aislado en ( ... ) y se lee su codigo de salida.
#
# Los guardianes siguen andando sueltos: si las variables HOOK_* no estan,
# cada uno parsea el JSON por su cuenta como siempre.

set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT=$(cat)

# Que guardian corre con que herramienta — replica EXACTO los matchers que
# antes estaban en settings.json. Si corrieran todos siempre, guardianes que
# hoy no ven un Write empezarian a verlo: eso es cambiar el comportamiento,
# no acelerarlo.
#   Bash|PowerShell ............ supabase, validator, renumber, push
#   Edit|Write ................. file-guard
#   Bash|PowerShell|Write|Edit . consumos, cad, patrones, escritorio
TMP=$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/hookdisp.$$")
mkdir -p "$TMP"
trap 'rm -rf "$TMP"' EXIT

# --- UN solo node: extrae de una vez todo lo que necesitan los 8 ---
# Se escribe a archivos y se leen con $(<archivo), que en bash NO forkea.
printf '%s' "$INPUT" | node -e '
const fs = require("fs");
const dir = process.argv[1];
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  let cmd = "", file = "", tool = "", content = "", ok = false;
  try {
    const j = JSON.parse(s);
    const t = j?.tool_input || {};
    tool = String(j?.tool_name ?? "");
    cmd = String(t.command ?? "");
    file = String(t.file_path ?? "");
    content = String(t.content ?? t.new_string ?? "");
    ok = true;
  } catch {}
  const clean = x => String(x ?? "").replace(/[\x1f\n\r]/g, " ");
  const w = (n, v) => { try { fs.writeFileSync(dir + "/" + n, v); } catch {} };

  // Si el JSON no se pudo parsear, TODO va vacio de verdad — ni un separador.
  // cad-guard, patrones-guard y escritorio-guard distinguen "vacio" para caer a
  // su red de seguridad: greps sobre el JSON crudo (cad-guard:45, patrones:46,
  // escritorio:49, que mete el INPUT entero en CMD). Si les mandaramos
  // "\x1f\x1f\x1f" — no vacio — entrarian por la rama normal, leerian campos
  // todos vacios, no matchearian nada y DEJARIAN PASAR sin decir una palabra.
  // Es el peor final posible: un guardian que no protege pero parece que si.
  if (!ok) {
    for (const n of ["tool","cmd","file","target","parsed4","parsed3"]) w(n, "");
    return;
  }

  w("tool", tool);                                 // para elegir que guardianes corren
  w("cmd", cmd);                                   // supabase/validator/renumber/push
  w("file", file);                                 // file-guard
  w("target", cmd + " " + file);                   // consumos-entregable-guard
  // 6000 y no 4000: borrado-masivo-guard corta en 6000 cuando parsea solo, y con
  // 4000 veia MENOS por el despachador que suelto — un script de 4.842 car. con el
  // borrado al final pasaba limpio (verificado 2026-08-13). Los cortes tienen que
  // ser iguales o el despachador debilita al guardian en silencio.
  w("parsed4", [clean(tool), clean(cmd).slice(0,6000), clean(file),
                clean(content).slice(0,6000)].join("\x1f"));   // cad + patrones + borrado
  w("parsed3", [clean(tool), clean(cmd).slice(0,6000),
                clean(file)].join("\x1f"));        // escritorio-guard
});
' "$TMP" 2>/dev/null || true

# Si el parseo fallo, NO exporto nada: cada guardian parsea solo (camino lento
# pero correcto). Preferible lento que desprotegido.
TOOL_NAME=""
if [ -f "$TMP/cmd" ]; then
  TOOL_NAME="$(<"$TMP/tool")"
  export HOOK_CMD="$(<"$TMP/cmd")"
  export HOOK_FILE="$(<"$TMP/file")"
  export HOOK_TARGET="$(<"$TMP/target")"
  export HOOK_PARSED4="$(<"$TMP/parsed4")"
  export HOOK_PARSED3="$(<"$TMP/parsed3")"
fi

# Que guardian corre con que herramienta — replica EXACTO los matchers que
# antes vivian en settings.json. Si corrieran todos siempre, guardianes que hoy
# no ven un Write empezarian a verlo: eso es cambiar el comportamiento, no
# acelerarlo.
#   Bash|PowerShell ............ supabase, validator, renumber, push
#   Edit|Write ................. file-guard
#   Bash|PowerShell|Write|Edit . consumos, cad, patrones, escritorio
GUARDIANES=()
case "$TOOL_NAME" in
  Bash|PowerShell) GUARDIANES+=(supabase-guard validator-check renumber-guard push-guard
                                arb-cerrar-guard) ;;
  Edit|Write)      GUARDIANES+=(file-guard causas-ajenas-guard) ;;
esac
case "$TOOL_NAME" in
  Bash|PowerShell|Write|Edit)
    GUARDIANES+=(consumos-entregable-guard cad-guard patrones-guard escritorio-guard
                 borrado-masivo-guard ho-numeracion-guard mail-guard) ;;
esac

# Si no se pudo parsear el tool_name, NO adivino: corro TODOS los guardianes.
# Fallar hacia el lado seguro es correr de mas, nunca de menos.
if [ -z "$TOOL_NAME" ]; then
  GUARDIANES=(file-guard supabase-guard validator-check renumber-guard push-guard
              consumos-entregable-guard cad-guard patrones-guard escritorio-guard
              borrado-masivo-guard ho-numeracion-guard mail-guard arb-cerrar-guard)
fi

if [ ${#GUARDIANES[@]} -eq 0 ]; then exit 0; fi

# Se corren TODOS, aunque uno bloquee. Es lo que pasaba con 8 hooks sueltos:
# Claude Code los ejecuta todos y muestra los mensajes de todos los que
# bloquean. Cortar en el primero le escondería a Claude el resto de los
# motivos — y ademas se saltearía el efecto de supabase-guard, que corre el
# backup. Mismo comportamiento que antes, no "parecido".
ERR="$TMP/err"
BLOQUEOS=""
for g in "${GUARDIANES[@]}"; do
  [ -f "$DIR/$g.sh" ] || continue
  ( source "$DIR/$g.sh" ) <<< "$INPUT" 2>"$ERR"
  RC=$?
  MSG="$(<"$ERR")"
  if [ "$RC" -eq 2 ]; then
    BLOQUEOS="${BLOQUEOS}${MSG}"$'\n'
  elif [ "$RC" -ne 0 ] && [ -n "$MSG" ]; then
    printf '%s\n' "$MSG" >&2            # error no bloqueante: se avisa y sigue
  elif [ -n "$MSG" ]; then
    printf '%s\n' "$MSG" >&2            # el guardian dejo pasar pero dijo algo
  fi
done

if [ -n "$BLOQUEOS" ]; then
  printf '%s' "$BLOQUEOS" >&2
  exit 2
fi

exit 0
