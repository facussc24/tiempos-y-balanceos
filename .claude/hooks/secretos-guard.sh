#!/usr/bin/env bash
# secretos-guard.sh — wrapper fino. La logica vive en scripts/_lib/guardianes.mjs (guardian
# "secretos-guard"), junto con la de los otros: el despachador _dispatcher.sh los corre a todos
# dentro de UN solo node.
# Que hace: bloquea que un comando de Bash/PowerShell LEA o PISE .env, .env.<algo> o .qr-secret
# (cat/type/head/grep sin comillas/python -c/node -e/source/`<`/`>`). El deny de settings
# `Read(**/.env.local)` solo cubre la tool Read: la auditoria del 04/09/2026 (Ola 5 del plan de
# mejoras) probo `head -c 1 .env.local | wc -c` -> 1.
#
# Este archivo queda para que el guardian siga corriendo SUELTO, que es como lo invocan sus
# tests (Vitest) y el uso manual:
#   printf '%s' "$JSON" | bash .claude/hooks/secretos-guard.sh      # exit 0 pasa · exit 2 bloquea
# La historia del guardian (que bloquea y que no) esta en el encabezado de su funcion en
# guardianes.mjs.
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$RAIZ/scripts/_lib/guardianes.mjs" --solo secretos-guard
