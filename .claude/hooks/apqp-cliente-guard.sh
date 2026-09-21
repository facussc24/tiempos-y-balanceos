#!/usr/bin/env bash
# apqp-cliente-guard.sh — wrapper fino. La logica vive en scripts/_lib/guardianes.mjs
# (guardian "apqp-cliente-guard"), junto con la de los otros: el despachador _dispatcher.sh
# los corre a todos dentro de UN solo node.
#
# Que hace: BLOQUEA poner un archivo en el paquete de PPAP que va al cliente (`PPAP_<PN>_<n>\`,
# que lo arma CALIDAD) y escribir en un listado maestro (flujogramas, AMFEs, hojas de proceso).
# Deja pasar leer las dos cosas, SACAR algo del paquete, el resto del legajo APQP y el dry-run
# de los scripts de alta. Regla: .claude/rules/autonomy-contract.md §F
#
#   printf '%s' "$JSON" | bash .claude/hooks/apqp-cliente-guard.sh   # 0 pasa · 2 bloquea
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$RAIZ/scripts/_lib/guardianes.mjs" --solo apqp-cliente-guard
