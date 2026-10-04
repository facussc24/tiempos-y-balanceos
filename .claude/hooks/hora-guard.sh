#!/usr/bin/env bash
# hora-guard.sh — wrapper fino del control de cierre "trabajar hasta la hora". Logica: scripts/_lib/horaGuard.mjs.
#
# Stop. Frena el cierre del turno (exit 2) cuando:
#   - Fak fijo una hora para trabajar y no hay ningun aviso programado vivo (sin latido la sesion queda parada);
#   - hay una hora vigente y el mensaje final se despide como si el trabajo hubiera terminado;
#   - el ultimo mensaje de Fak ponia una hora y no se fijo ni se escribio "No aplica trabajar-hasta: ...".
# Con una hora vigente, latido vivo y un mensaje que no cierra, deja pasar: la sesion espera el proximo latido.
#
# Por que: 03/10/2026, "no te quedaste hasta las 8, decime por que, defendete". Regla trabajar-hasta-la-hora.md.
# Test: __tests__/scripts/horaGuard.test.mjs (ROJO exit 2 y VERDE exit 0)
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="${RAIZ}/scripts/_lib/horaGuard.mjs"
command -v node >/dev/null 2>&1 || exit 0
[ -f "$GUARD" ] || exit 0
node "$GUARD" --stop
