#!/usr/bin/env bash
# coordinador-guard.sh — PreToolUse, matcher: SendMessage|Agent
#
# El cerrojo del rol coordinador. La logica vive en scripts/_lib/coordinadorGuard.mjs
# (node, no bash: el cuerpo de un mensaje trae comillas, saltos y backslashes de Windows,
# y parsear eso con sed es donde esta casa ya se comio bugs de verde falso).
#
# exit 0 = pasa · exit 2 = bloquea y el stderr vuelve a Claude como feedback.
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="${RAIZ}/scripts/_lib/coordinadorGuard.mjs"

# Si falta node o el script, se deja pasar: un guardian que rompe el trabajo diario porque
# no arranca es peor que uno que no corre (se termina desactivando entero).
command -v node >/dev/null 2>&1 || exit 0
[ -f "$GUARD" ] || exit 0

node "$GUARD"
