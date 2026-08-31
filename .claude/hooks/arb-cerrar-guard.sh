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

# --- 1. matar el proceso del arb --------------------------------------------
# `produc` cubre produc.exe y la ruta Z:\arb\prod\produc.exe.
if echo "$CMD" | grep -qiE '(taskkill|stop-process|pkill|killall|[^a-z]kill[[:space:]])' \
   && echo "$CMD" | grep -qiE 'produc'; then
  MOTIVO="matar el proceso del arb (produc.exe)"
fi

# --- 2. cerrar la VENTANA PRINCIPAL -----------------------------------------
# Se exige que el comando nombre la ventana principal. `ProdWindow` es la CLASE de
# la ventana y es como la busca todo el codigo del repo (`_arbVer.py buscar('prod')`),
# asi que es la señal fuerte. Los WM_CLOSE sobre `Maestro de Insumos` /
# `Maestro de Relaciones` siguen pasando: son el metodo documentado para descartar
# una edicion sin grabar.
CERRAR_RE='WM_CLOSE|0x0010|DestroyWindow|EndTask|SC_CLOSE|0xF060'
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
