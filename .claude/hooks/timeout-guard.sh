#!/usr/bin/env bash
# timeout-guard.sh — PostToolUse + PostToolUseFailure, matcher Bash|PowerShell (A2, 10/09/2026).
#
# Si el resultado del comando dice "Command timed out", deja en el contexto (additionalContext,
# exit 0) el aviso de que ese resultado NO es evidencia: ni de que algo no existe ni de que esta
# bien. Caso de origen: 08/09/2026, el `find` en Y: del anexo I-AC-012.1 se corto, lo di por
# inexistente y el mail salio con el dato falso (el anexo estaba desde 2011).
#
# DESDE EL 30/09/2026 settings.json NO llama a este archivo: llama directo a
#   node "${CLAUDE_PROJECT_DIR}/scripts/_lib/timeoutGuard.mjs"
# (un solo node, sin bash). Corria en CADA Bash (~21.000 veces en septiembre, avisó 1) y el bash +
# dos subshells + grep costaban mas que el chequeo. La compuerta barata (el grep que hacia este
# archivo) paso adentro de timeoutGuard.mjs. Este wrapper queda IDENTICO en lo que hace y sigue
# andando suelto: lo usan sus tests y sirve para probar el hook a mano. La logica y las frases viven
# en scripts/_lib/timeoutGuard.mjs + cierreCanon.data.json.
# Nunca bloquea (el comando ya corrio) y nunca falla ruidoso: exit 0 siempre.
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

command -v node >/dev/null 2>&1 || exit 0
[ -f "$RAIZ/scripts/_lib/timeoutGuard.mjs" ] || exit 0

node "$RAIZ/scripts/_lib/timeoutGuard.mjs" 2>/dev/null
exit 0
