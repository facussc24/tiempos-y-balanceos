#!/usr/bin/env bash
# validator-check.sh — wrapper fino. Desde el 05/09/2026 la logica vive en
# scripts/_lib/guardianes.mjs (guardian "validator-check"), junto con la de los otros doce: el
# despachador _dispatcher.sh los corre a todos dentro de UN solo node (Ola 2 del plan de
# mejoras: de 2,6-3,5 s a menos de 1 s por cada Bash/Edit/Write).
# Antes: Validator Check Hook
#
# Este archivo queda para que el guardian siga corriendo SUELTO, que es como lo invocan sus
# tests (.test.sh y Vitest) y el uso manual:
#   printf '%s' "$JSON" | bash .claude/hooks/validator-check.sh      # exit 0 pasa · exit 2 bloquea
# Con HOOK_FILE / HOOK_PARSED4 / HOOK_CMD en el entorno no lee stdin (asi lo usa su .test.sh).
# La historia del guardian (que incidente lo origino, que bloquea y que no) esta en el
# encabezado de su funcion en guardianes.mjs. Los recordatorios 1x/h salen como
# additionalContext (JSON en stdout, exit 0); los bloqueos siguen siendo exit 2 + stderr.
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$RAIZ/scripts/_lib/guardianes.mjs" --solo validator-check
