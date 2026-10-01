#!/usr/bin/env bash
# nube-personal-guard.sh — wrapper fino. La logica vive en scripts/_lib/guardianes.mjs
# (guardian "nube-personal-guard"), junto con la de los otros: el despachador _dispatcher.sh
# los corre a todos dentro de UN solo node.
#
# Que hace: BLOQUEA guardar, copiar, mover o crear algo adentro de `OneDrive - BARACK ARGENTINA SRL\`
# (la nube de la CUENTA de Fak). El trabajo va a la biblioteca del sector, `BARACK ARGENTINA SRL\
# Ingenieria y Proyecto - General\`. Deja pasar leer de la nube personal, sacar cosas de ahi, y el
# Escritorio (Windows lo guarda ahi). Regla: .claude/rules/nube-ingenieria.md (Fak, 01/10/2026).
#
#   printf '%s' "$JSON" | bash .claude/hooks/nube-personal-guard.sh   # 0 pasa · 2 bloquea
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$RAIZ/scripts/_lib/guardianes.mjs" --solo nube-personal-guard
