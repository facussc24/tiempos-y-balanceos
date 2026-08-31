#!/usr/bin/env bash
# arb-cerrar-guard.sh — Enforcement de la regla `arb-no-cerrar.md`:
#   EL arb NO SE CIERRA SIN CONSULTARLE A FAK. NUNCA.
#
# Incidente 2026-08-31 (Fak: "fue gravisimo"): termine de leer el maestro de insumos,
# cerre el arb porque una instruccion decia "cuando termines, cerralo", y al rato hubo
# que cargar. Reabrirlo pide USUARIO Y CONTRASEÑA, que yo no tipeo — la tarea quedo
# frenada esperando a Fak, dos veces, por algo que yo mismo habia roto.
# Cerrar el arb cuesta segundos y destrabarlo depende de otra persona: es asimetrico.
#
# QUE BLOQUEA (solo la ventana PRINCIPAL / el proceso):
#   1. matar el proceso            taskkill / Stop-Process / pkill / kill  sobre produc
#   2. cerrar la ventana principal WM_CLOSE / 0x0010 / DestroyWindow / EndTask
#                                  apuntando a ProdWindow o al titulo "Produccion"
#
# QUE NO BLOQUEA (son el metodo documentado y hacen falta todos los dias):
#   - WM_CLOSE sobre `Maestro de Insumos` o `Maestro de Relaciones` — asi se descarta
#     una edicion sin grabar (skill `arb-operar`).
#   - `_arbVer.py reset`, que cierra y REABRE la ventana de Relaciones.
#
# ESCAPE (lo usa Fak, no la sesion):  touch ~/.claude/.arb-cerrar-ok
#   Vale para UN comando: el guardian lo consume y vuelve a quedar armado.
#
# Exit 0 = permite. Exit 2 = bloquea.

set -uo pipefail

INPUT=$(cat)

# Camino rapido: si el despachador ya parseo el JSON, lo reuso.
if [ -n "${HOOK_CMD+x}" ]; then
  CMD="$HOOK_CMD"
else
CMD=$(printf '%s' "$INPUT" | node -e '
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(s);
    process.stdout.write(String(j?.tool_input?.command ?? ""));
  } catch { process.stdout.write(""); }
});
' 2>/dev/null || true)
fi

# Red de seguridad: si el parseo fallo, miro el JSON crudo. Un guardian que no ve
# nada parece un guardian que aprobo.
if [ -z "$CMD" ]; then CMD="$INPUT"; fi
if [ -z "$CMD" ]; then exit 0; fi

MOTIVO=""

# --- 0. NO estorbar al que audita o documenta este mismo tema ---------------
# El guardian mira TEXTO, asi que un `grep WM_CLOSE ... ProdWindow` sobre la skill
# se autobloqueaba: paso dos veces en la auditoria del 31/08. Un comando de SOLO
# LECTURA no cierra nada, por definicion. Para ESCRIBIR estos tokens a un archivo se
# usa la tool `Write`, que no pasa por este guardian.
# OJO: la exencion pide DOS cosas. Arranca con un lector, Y no encadena a nada que
# ejecute — `cat script.sh | bash` arranca con `cat` y corre codigo arbitrario.
if echo "$CMD" | grep -qiE '^[[:space:]]*(grep|rg|cat|sed -n|head|tail|less|type|wc|git (log|show|diff|blame))[[:space:]]' \
   && ! echo "$CMD" | grep -qiE '(\||;|&&)[[:space:]]*(ba)?sh|python|powershell|pwsh|xargs|-exec|node[[:space:]]'; then
  exit 0
fi

# --- 0b. el CUERPO de un heredoc es CONTENIDO, no comando -------------------
# Un mensaje de commit que documenta este guardian, o un archivo de casos de prueba,
# nombra `taskkill` y `produc.exe` sin ejecutar nada. La primera version se bloqueaba
# a si misma escribiendo su propio commit (paso el 31/08, dos veces).
# DOS condiciones, y la primera es la que importa: el comando tiene que ARRANCAR con algo
# que escribe o versiona, no con un interprete. `python - <<PY` y `bash <<EOF` se comen el
# cuerpo por stdin SIN pipe, asi que ahi el heredoc ES codigo y se mira entero — de hecho
# el comando del incidente del 31/08 es exactamente `python - <<PY`.
if echo "$CMD" | grep -q '<<' \
   && echo "$CMD" | grep -qiE '^[[:space:]]*(git|cat|tee|echo|printf)[[:space:]]' \
   && ! echo "$CMD" | grep -qiE '\|[[:space:]]*((ba)?sh|python|powershell|pwsh|node)'; then
  CMD=$(printf '%s' "$CMD" | awk '
    BEGIN { fin = "" }
    fin != "" { if ($0 == fin || $1 == fin) { fin = "" } ; next }
    {
      linea = $0
      if (match(linea, /<<-?[[:space:]]*'"'"'?[A-Za-z_][A-Za-z0-9_]*'"'"'?/)) {
        marca = substr(linea, RSTART, RLENGTH)
        gsub(/^<<-?[[:space:]]*|'"'"'/, "", marca)
        fin = marca
      }
      print linea
    }')
fi

# --- 1a. cerrar sesion / apagar: se lleva puesto el arb sin nombrarlo --------
if echo "$CMD" | grep -qiE '(^|[;&|][[:space:]]*)(shutdown[[:space:]]+/|logoff|restart-computer|stop-computer)'; then
  MOTIVO="cerrar la sesion de Windows o apagar (se lleva puesto el arb)"
fi

# --- 1. matar el proceso del arb --------------------------------------------
# LISTA CANONICA de verbos, no un regex parcial (memoria `lista_canonica_no_regex`).
# Los `.Kill()` / `.CloseMainWindow()` / `os.kill(` no llevan espacio detras: exigirlo
# era el agujero mas grande, y encima son la sintaxis MAS natural en PowerShell.
MATAR_RE='taskkill|stop-process|pkill|killall|[^a-z]kill[[:space:]]|\.kill\(|os\.kill|closemainwindow|wmic[^|]*(delete|terminate|call)|shutdown[[:space:]]*/'
if echo "$CMD" | grep -qiE "$MATAR_RE"; then
  # 1a. nombra al arb -> directo.  `produc` cubre produc.exe y Z:\arb\prod\produc.exe.
  if echo "$CMD" | grep -qiE 'produc'; then
    MOTIVO="matar el proceso del arb (produc.exe)"
  # 1b. por PID pelado: el comando no dice a quien mata. Se RESUELVE el PID contra el
  #     sistema — solo aca, que es raro, asi que el costo no se paga en cada comando.
  else
    PIDS=$(echo "$CMD" | grep -oiE '(/pid[[:space:]:=]+|os\.kill\([[:space:]]*|-id[[:space:]]+)[0-9]{2,7}' \
           | grep -oE '[0-9]{2,7}' | sort -u)
    for P in $PIDS; do
      if tasklist //FI "PID eq $P" 2>/dev/null | grep -qi 'produc'; then
        MOTIVO="matar el proceso del arb (PID $P es produc.exe)"
        break
      fi
    done
  fi
fi

# --- 2. cerrar la VENTANA PRINCIPAL -----------------------------------------
# Se exige que el comando nombre la ventana principal. `ProdWindow` es la CLASE de
# la ventana y es como la busca todo el codigo del repo (`_arbVer.py buscar('prod')`),
# asi que es la señal fuerte. Los WM_CLOSE sobre `Maestro de Insumos` /
# `Maestro de Relaciones` siguen pasando: son el metodo documentado para descartar
# una edicion sin grabar.
#   `0x10` es el MISMO valor que `0x0010` (WM_CLOSE = 16) — el match es textual, y sin
#   la variante corta se escapaba. Idem las APIs de alto nivel (pywinauto, pyautogui,
#   SendKeys), que cierran la ventana sin escribir nunca `WM_CLOSE`.
CERRAR_RE='WM_CLOSE|0x0010|0x10[^0-9a-f]|DestroyWindow|EndTask|SC_CLOSE|0xF060|pywinauto|pyautogui|sendkeys|%\{F4\}|alt.{0,3}f4|\.close\(\)'
if [ -z "$MOTIVO" ] && echo "$CMD" | grep -qiE "$CERRAR_RE"; then
  if echo "$CMD" | grep -q 'ProdWindow'; then
    MOTIVO="cerrar la ventana principal del arb (clase ProdWindow)"
  # Por titulo. Se exige que NO nombre un `Maestro ...`, porque ahi el WM_CLOSE es
  # el de descartar una edicion y ese tiene que pasar.
  elif echo "$CMD" | grep -qi 'Producci' && ! echo "$CMD" | grep -qi 'Maestro'; then
    MOTIVO="cerrar la ventana principal del arb (titulo Produccion)"
  fi
fi

if [ -z "$MOTIVO" ]; then exit 0; fi

# --- escape de Fak, de un solo uso ------------------------------------------
OK="$HOME/.claude/.arb-cerrar-ok"
if [ -f "$OK" ]; then
  rm -f "$OK"
  echo "ARB-CERRAR-GUARD: habilitado por ~/.claude/.arb-cerrar-ok (consumido). Cerrando el arb." >&2
  exit 0
fi

cat >&2 <<EOF
[ARB-CERRAR-GUARD] BLOQUEADO: ibas a $MOTIVO.

REGLA DURA (Fak, 31/08/2026): el arb NO se cierra sin consultarle. Ni al terminar una
tarea, ni "para dejar limpio", ni porque una instruccion de otra sesion lo diga.

POR QUE: reabrirlo pide USUARIO Y CONTRASEÑA, y la sesion no tipea contraseñas. O sea
que cerrarlo cuesta un segundo y volver a abrirlo NO depende de mi: depende de que Fak
este disponible. El 31/08 lo cerre al terminar de leer el maestro, al rato hubo que
cargar el reemplazo del remache, y la tarea quedo frenada dos veces esperandolo. Fak:
"no vuelvas a cerrar arb sin consultarme, fue gravisimo eso".

QUE HACER EN VEZ:
  - Dejalo abierto. Un arb abierto no molesta a nadie y es el estado por defecto.
  - Si de verdad hay que cerrarlo, PREGUNTALE A FAK primero, con el motivo.
  - Si Fak ya dijo que si:  touch ~/.claude/.arb-cerrar-ok   y reintenta (vale 1 vez).

NO BLOQUEADO, por si era lo que buscabas: cerrar 'Maestro de Insumos' o 'Maestro de
Relaciones' con WM_CLOSE (es el modo documentado de descartar una edicion sin grabar),
y 'python scripts/_arbVer.py reset', que cierra y REABRE la de Relaciones.
EOF
exit 2
