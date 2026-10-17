#!/usr/bin/env bash
# permiso-un-uso-guard.sh — wrapper fino. La logica vive en scripts/_lib/guardianes.mjs (guardian
# "permiso-un-uso-guard") y en scripts/_lib/permisoUnUso.mjs; el despachador _dispatcher.sh lo corre
# dentro de UN solo node, junto con los otros (tanda 3 del plan del sistema, pieza 9, 16/10/2026).
# Que hace: frena que la sesion arme un permiso de un solo uso de Fak (~/.claude/.apqp-listado-ok,
# .arb-cerrar-ok, .nube-personal-ok, .espacio-ok, .agent-opus-ok, .agent-cupo-ok, .agent-limit,
# .workflow-ok) sin la cita de Fak en el mismo comando: # Fak DD/MM HH:MM: "lo que dijo", que tiene
# que estar en su ultimo mensaje del transcript. Regla: .claude/rules/autonomy-contract.md, seccion G.
#
# Este archivo queda para que el guardian siga corriendo SUELTO, que es como lo invocan sus
# tests y el uso manual:
#   printf '%s' "$JSON" | bash .claude/hooks/permiso-un-uso-guard.sh      # exit 0 pasa · exit 2 bloquea
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$RAIZ/scripts/_lib/guardianes.mjs" --solo permiso-un-uso-guard
