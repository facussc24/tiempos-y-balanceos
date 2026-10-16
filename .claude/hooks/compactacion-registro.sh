#!/usr/bin/env bash
# compactacion-registro.sh — hooks PreCompact y PostCompact. Anota cada compactacion (fecha, sesion, causa
# auto|manual|idle, tokens del ultimo turno, largo del resumen) en .claude/state/compactaciones.jsonl.
# Logica: scripts/_lib/compactacionRegistro.mjs. Test: __tests__/scripts/compactacionRegistro.test.mjs.
# Tanda 1.3.3 del plan del sistema (16/10/2026). Nunca frena la compactacion: exit 0 siempre.
RAIZ="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
node "$RAIZ/scripts/_lib/compactacionRegistro.mjs" 2>/dev/null
exit 0
