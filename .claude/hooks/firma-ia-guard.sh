#!/usr/bin/env bash
# firma-ia-guard.sh — wrapper fino. La logica vive en scripts/_lib/guardianes.mjs
# (guardian "firma-ia-guard"), junto con la de los otros: el despachador _dispatcher.sh
# los corre a todos dentro de UN solo node.
#
# Que hace: BLOQUEA escribir en un documento de Barack algo que diga o deje ver que lo hizo Claude o
# una IA (una celda "Claude" en CREADO POR, una pestaña "_CONTEXTO_CLAUDE", las propiedades del
# archivo, un nombre de archivo o carpeta con "Claude" en el servidor). Deja pasar el trabajo de
# todos los dias que nombra a Claude sin meterlo en un documento (commits, memoria, reglas, la
# configuracion). Regla: .claude/rules/core-prohibiciones.md §9 (Fak, 08/10/2026: "es un error
# gravisimo, no puede volver a suceder nunca"). Detector por archivo: scripts/_sinFirmaIA.py.
#
#   printf '%s' "$JSON" | bash .claude/hooks/firma-ia-guard.sh   # 0 pasa · 2 bloquea
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$RAIZ/scripts/_lib/guardianes.mjs" --solo firma-ia-guard
