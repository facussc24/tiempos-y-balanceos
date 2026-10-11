#!/usr/bin/env bash
# .claude/hooks/prompt-hooks.sh — UserPromptSubmit, matcher vacio, UN solo hook (cola P10, 10/10/2026). Reemplaza a
# caracteristicas-especiales-prompt.sh, correccion-guard.sh, explicar-prompt.sh y hora-prompt.sh, que corrian como
# 4 bash + 4 node por cada mensaje de Fak (2.800-3.786 ms cada uno; 62 cancelados en el mes, R6). Ahora: 1 bash + 1 node.
# La logica y el orden viven en scripts/_lib/promptHooks.mjs; el texto de cada pieza es el mismo que daba suelta.
# NO bloquea nunca. Sin node o sin el modulo deja pasar: un hook que no arranca en cada mensaje se termina apagando.
# Tests: __tests__/scripts/promptHooks.test.mjs · promptHooks.gate.test.mjs · promptHooks.igualdad.test.mjs
#
#   printf '%s' "$JSON" | bash .claude/hooks/prompt-hooks.sh   # exit 0; 1 si node no termino bien; nunca 2
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="${RAIZ}/scripts/_lib/promptHooks.mjs"
command -v node >/dev/null 2>&1 || exit 0
[ -f "$HOOK" ] || exit 0
node "$HOOK" --correr
# Si node no termino bien (un modulo roto, sin memoria) sale con 1: la app lo muestra como error del hook y el mensaje
# de Fak pasa igual. Nunca con 2, que en este evento BORRA el mensaje. Con 0 quedaria mudo y nadie se enteraria.
[ $? -eq 0 ] || exit 1
exit 0
