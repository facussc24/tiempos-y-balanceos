#!/usr/bin/env bash
# .claude/hooks/stop-hooks.sh — hook Stop, UN solo node (cola P10, plan §2): cierre-guard y despues hora-guard, en
# scripts/_lib/stopHooks.mjs. Reemplaza a cierre-guard.sh + hora-guard.sh (+ dev-server-guard.sh, que se saca: P11).
# exit 0 = el turno termina · exit 2 = el stderr (los dos avisos, concatenados) vuelve a Claude y el turno sigue.
# Con stop_hook_active=true cada pieza decide sola, como hoy.
# Tests: __tests__/scripts/stopHooks.test.mjs · stopHooks.gate.test.mjs
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="${RAIZ}/scripts/_lib/stopHooks.mjs"
command -v node >/dev/null 2>&1 || exit 0
[ -f "$HOOK" ] || exit 0

# MEDICION: el mismo bloque de cierre-guard.sh (plan P9 C0, §6.4), con hook="stop-hooks" para que el lector
# (node scripts/_hooksTiempos.mjs --hook stop-hooks) no mezcle estas corridas con la linea de base de P9.
# Copiado y no compartido a proposito: cierre-guard.sh no se toca mientras mide; cuando se borre (OK de Fak) queda este.
REG="${CLAUDE_HOOKS_TIEMPOS:-${TMPDIR:-${TEMP:-/tmp}}/claude-hooks-tiempos.jsonl}"
[ -n "${VITEST:-}" ] && [ -z "${CLAUDE_HOOKS_TIEMPOS:-}" ] && REG=off
US="${EPOCHREALTIME:-}"; US="${US//[^0-9]/}"
if [ "$REG" = "off" ] || [ "$REG" = "OFF" ] || [ "${#US}" -lt 10 ]; then
  CLAUDE_HOOKS_TIEMPOS=off node "$HOOK" --correr
  exit $?
fi
T0="${US%???}"; ID="$$.${US}"
{ printf '{"ev":"inicio","hook":"stop-hooks","id":"%s","t":%s}\n' "$ID" "$T0" >> "$REG"; } 2>/dev/null
CLAUDE_HOOKS_TIEMPOS="$REG" CLAUDE_HOOKS_TIEMPOS_ID="$ID" CLAUDE_HOOKS_TIEMPOS_T0="$T0" CLAUDE_HOOKS_TIEMPOS_HOOK=stop-hooks node "$HOOK" --correr
RC=$?
US="${EPOCHREALTIME//[^0-9]/}"; T1="${US%???}"
{ printf '{"ev":"fin","hook":"stop-hooks","id":"%s","t":%s,"rc":%s,"ms":%s}\n' "$ID" "$T1" "$RC" "$((T1 - T0))" >> "$REG"; } 2>/dev/null
exit "$RC"
