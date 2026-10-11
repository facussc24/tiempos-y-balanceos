#!/usr/bin/env bash
# .claude/hooks/caracteristicas-especiales-prompt.sh — wrapper fino. Desde el 10/10/2026 (cola P10) la logica vive en
# scripts/_lib/caracteristicasEspecialesPrompt.mjs y corre dentro de prompt-hooks.sh junto con las otras tres piezas;
# este .sh queda suelto para sus pruebas (hooksVarios.test.mjs) hasta que Fak de el OK para borrarlo. NO bloquea.
# Que hace y por que (11/09/2026, "siempre que te preguntes, recuerdes todo esto"): ver la cabecera del modulo.
#
#   printf '%s' "$JSON" | bash .claude/hooks/caracteristicas-especiales-prompt.sh   # exit 0 siempre
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
node "$RAIZ/scripts/_lib/caracteristicasEspecialesPrompt.mjs" --hook
exit 0
