#!/usr/bin/env bash
# modelo-guard.sh — PreModelSwitch y PreToolUse de mcp__ccd_session_mgmt__set_session_model (tanda 3 del plan del
# sistema, pieza 12, 16/10/2026). El modelo de una sesion no se cambia a mitad de camino por cuenta propia: hace falta
# que Fak lo pida en su ultimo mensaje. /model y el selector interactivo pasan siempre (los dispara una persona); el
# selector de la app de escritorio llega como `sdk` y pasa salvo que el cambio salga de una llamada de la propia sesion.
# La logica vive en scripts/_lib/modeloGuard.mjs. Test: __tests__/scripts/modeloGuard.test.mjs.
#   printf '%s' "$JSON" | bash .claude/hooks/modelo-guard.sh      # PreToolUse: exit 2 frena · PreModelSwitch: JSON deny
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$RAIZ/scripts/_lib/modeloGuard.mjs"
