#!/usr/bin/env bash
# permiso-guard.sh — wrapper fino del hook PermissionRequest. Logica: scripts/_lib/permisoGuard.mjs, numeros y
# listas en scripts/_lib/permisoCanon.data.json.
#
# PermissionRequest corre cuando la app esta por mostrar un cartel de permiso. Con una hora de trabajo fijada por
# Fak para ESA sesion (regla trabajar-hasta-la-hora.md) y sin un mensaje suyo reciente, el cartel se contesta solo
# con «no» (deny, con el motivo) y el pedido queda anotado en «Lo que necesita a Fak» de la lista de la tanda.
# Sin hora fijada, con Fak en la ventana o si la herramienta es una pregunta (AskUserQuestion): no imprime nada y
# la app sigue como siempre. NUNCA contesta «si».
#
# Por que: 04/10/2026, cuatro conversaciones 55 minutos esperando un cartel. Cola P41, si de Fak 09/10/2026 16:55.
#
# Sale SIEMPRE con 0: en este evento el codigo 2 no hace nada, y si el control se rompe la app tiene que seguir
# mostrando el cartel. Lo que falla queda en ~/.claude/.permiso-guard.log (un control que falla callado esta apagado).
# Test: __tests__/scripts/permisoGuard.test.mjs (ROJO = niega y anota; VERDE = no decide)
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="${RAIZ}/scripts/_lib/permisoGuard.mjs"
REGISTRO="${HOME:-${USERPROFILE:-/tmp}}/.claude/.permiso-guard.log"
[ -d "${REGISTRO%/*}" ] || mkdir -p "${REGISTRO%/*}" 2>/dev/null   # sin la carpeta, el desvio de stderr de abajo no deja correr a node
no_corrio() { printf '%s\tERROR\t%s\n' "$(date '+%Y-%m-%d %H:%M')" "$1" >> "$REGISTRO" 2>/dev/null; exit 0; }
command -v node >/dev/null 2>&1 || no_corrio "falta node: el cartel se muestra como siempre"
[ -f "$GUARD" ] || no_corrio "falta scripts/_lib/permisoGuard.mjs: el cartel se muestra como siempre"
# Tope de 15 s (el del hook en settings.json es 20): un node colgado se corta ACA y queda dicho en el registro, en vez
# de que lo corte la app sin dejar rastro. Lo que node escriba por stderr (un import roto) va al registro tambien.
CORTE=""; command -v timeout >/dev/null 2>&1 && CORTE="timeout 15"
SALIDA="$($CORTE node "$GUARD" --hook 2>>"$REGISTRO")"
CODIGO=$?
[ "$CODIGO" -eq 0 ] || no_corrio "permisoGuard.mjs salio con codigo ${CODIGO}: el cartel se muestra como siempre"
[ -n "$SALIDA" ] && printf '%s\n' "$SALIDA"
exit 0
