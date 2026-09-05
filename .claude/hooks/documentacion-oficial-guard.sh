#!/usr/bin/env bash
# documentacion-oficial-guard.sh — wrapper fino. La logica vive en scripts/_lib/guardianes.mjs
# (guardian "documentacion-oficial-guard"), junto con la de los otros trece: el despachador
# _dispatcher.sh los corre a todos dentro de UN solo node.
#
# Que hace: en la carpeta donde vive documentacion de un tercero (4- MANUALES,
# 0-Documentacion cliente, 1. Imput, normas-vw) BLOQUEA escribir un archivo propio, renombrar o
# mover el original, copiar ahi algo generado en esta PC y generar un archivo directo adentro.
# Deja pasar la transcripcion .txt con "Fuente:" + "Fecha de consulta:" en la cabecera y lo que
# va a la carpeta hermana TRADUCIDOS. Regla: .claude/rules/documentacion-oficial.md
#
#   printf '%s' "$JSON" | bash .claude/hooks/documentacion-oficial-guard.sh   # 0 pasa · 2 bloquea
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$RAIZ/scripts/_lib/guardianes.mjs" --solo documentacion-oficial-guard
