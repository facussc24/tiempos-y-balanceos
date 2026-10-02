#!/usr/bin/env bash
# commit-rutas-guard.sh — wrapper fino. La logica vive en scripts/_lib/guardianes.mjs
# (guardian "commit-rutas-guard"), junto con la de los otros: el despachador _dispatcher.sh
# los corre a todos dentro de UN solo node.
#
# Que hace: BLOQUEA un `git commit` que no dice que archivos guarda (sin rutas, con `-a`, con
# `--include`, o con `.` como ruta). El indice de git es uno solo para todas las sesiones que
# trabajan en la misma carpeta: un commit sin rutas se lleva lo que otra sesion haya agregado
# (02/10/2026: cee8f1b2 salio con 12 archivos ajenos). Deja pasar `git commit ... -- ruta1 ruta2`,
# `--only rutas`, `--amend --only` y el commit que cierra un merge.
# Regla: .claude/rules/git-deploy.md, paso 2.
#
#   printf '%s' "$JSON" | bash .claude/hooks/commit-rutas-guard.sh   # 0 pasa · 2 bloquea
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$RAIZ/scripts/_lib/guardianes.mjs" --solo commit-rutas-guard
