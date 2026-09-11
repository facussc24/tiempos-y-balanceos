#!/usr/bin/env bash
# caracteristicas-especiales-guard.sh — wrapper fino. La logica vive en
# scripts/_lib/guardianes.mjs (guardian "caracteristicas-especiales-guard"): el despachador
# _dispatcher.sh lo corre junto con los otros dentro de UN solo node.
#
# Que hace: recordatorio 1x/h (additionalContext, exit 0, NO bloquea) del criterio de
# caracteristicas especiales cuando toco la columna de sigla, un flujograma o el tema por su
# nombre. Pedido de Fak 11/09/2026: "es un error gravisimo que debemos corregir para siempre...
# me gustan esas memorias pero a veces no las lees". El texto y los disparadores estan en
# core/amfe/caracteristicasEspeciales.data.json (fuente unica, la misma del validador y la app).
#
# Suelto, como lo invocan sus tests y el uso manual:
#   printf '%s' "$JSON" | bash .claude/hooks/caracteristicas-especiales-guard.sh
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$RAIZ/scripts/_lib/guardianes.mjs" --solo caracteristicas-especiales-guard
