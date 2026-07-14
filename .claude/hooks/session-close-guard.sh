#!/usr/bin/env bash
# session-close-guard.sh — Recuerda el checklist de cierre de sesion cuando hay
# cambios de codigo/docs sin commitear en el repo. Cooldown de 20 min para no
# repetir el recordatorio en cada turno. Se dispara en el evento Stop.
cat >/dev/null 2>&1   # drenar el JSON de stdin

REPO=$(git rev-parse --show-toplevel 2>/dev/null)
[ -z "$REPO" ] && exit 0

# Cambios de codigo/docs versionados sin commitear (ignora scratchpad, deps, build)
CHANGES=$(git -C "$REPO" status --porcelain 2>/dev/null \
  | grep -iE '\.(ts|tsx|js|jsx|mjs|css|json|md)$' \
  | grep -viE 'scratchpad|node_modules|/dist/|package-lock' \
  | head -5)
[ -z "$CHANGES" ] && exit 0

# Cooldown: solo recordar una vez cada 20 min
FLAG="${TMPDIR:-/tmp}/claude-close-guard.flag"
NOW=$(date +%s)
if [ -f "$FLAG" ]; then
  LAST=$(cat "$FLAG" 2>/dev/null || echo 0)
  [ $((NOW - LAST)) -lt 1200 ] && exit 0
fi
echo "$NOW" > "$FLAG" 2>/dev/null

echo "Cierre pendiente: hay cambios de codigo/docs sin commitear. SI ya terminaste las tareas de codigo, cerra la sesion (regla git-deploy + protocolo CLAUDE.md): 1) npm run build  2) git commit + push  3) actualiza docs/LECCIONES_APRENDIDAS.md  4) si tocaste Supabase: node scripts/_backup.mjs  5) lanza el agente auditor. SI todavia estas trabajando, ignora esto y segui sin mencionarlo." >&2
exit 2
