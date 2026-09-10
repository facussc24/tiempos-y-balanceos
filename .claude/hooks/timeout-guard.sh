#!/usr/bin/env bash
# timeout-guard.sh — PostToolUse + PostToolUseFailure, matcher Bash|PowerShell (A2, 10/09/2026).
#
# Si el resultado del comando dice "Command timed out", deja en el contexto (additionalContext,
# exit 0) el aviso de que ese resultado NO es evidencia: ni de que algo no existe ni de que esta
# bien. Caso de origen: 08/09/2026, el `find` en Y: del anexo I-AC-012.1 se corto, lo di por
# inexistente y el mail salio con el dato falso (el anexo estaba desde 2011).
#
# Corre en CADA Bash: el camino comun es un grep sobre el stdin y exit 0, sin levantar node.
# La logica y las frases viven en scripts/_lib/timeoutGuard.mjs + cierreCanon.data.json.
# Nunca bloquea (el comando ya corrio) y nunca falla ruidoso: exit 0 siempre.
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INPUT=$(cat)

printf '%s' "$INPUT" | grep -qE 'Command timed out after|Command did not complete within' || exit 0
command -v node >/dev/null 2>&1 || exit 0
[ -f "$RAIZ/scripts/_lib/timeoutGuard.mjs" ] || exit 0

printf '%s' "$INPUT" | node "$RAIZ/scripts/_lib/timeoutGuard.mjs" 2>/dev/null
exit 0
