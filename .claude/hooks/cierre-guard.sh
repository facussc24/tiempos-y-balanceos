#!/usr/bin/env bash
# cierre-guard.sh — hook Stop. Reemplaza a session-close-guard.sh desde el 04/09/2026.
#
# La logica vive en scripts/_lib/cierreGuard.mjs (node): el ultimo mensaje del asistente
# trae comillas, markdown y saltos de linea, y parsear eso con sed es donde esta casa ya
# se comio verdes falsos. Tres cosas mide, en este orden:
#   1. el turno termina pidiendo permiso para hacer mi propio trabajo   -> exit 2
#   2. entregue algo afuera del repo y el cierre no dice la RUTA          -> exit 2
#   3. declaro un cierre ("listo", "pusheado") con pendientes medibles   -> exit 2, 1x/20 min por sesion
# Con stop_hook_active=true (segundo Stop del mismo turno) siempre deja pasar: sin loops.
#
# exit 0 = el turno termina · exit 2 = el stderr vuelve a Claude y el turno sigue.
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="${RAIZ}/scripts/_lib/cierreGuard.mjs"

# Si falta node o el script, se deja pasar: un guardian que rompe el cierre de cada turno
# porque no arranca es el que se termina desactivando entero.
command -v node >/dev/null 2>&1 || exit 0
[ -f "$GUARD" ] || exit 0

node "$GUARD"
