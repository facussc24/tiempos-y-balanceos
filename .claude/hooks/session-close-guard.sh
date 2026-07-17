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

# Flag de escritura Supabase via MCP (lo marca supabase-write-flag.sh): una sesion
# solo-datos no genera diff de git pero IGUAL requiere backup + verificacion.
SB_FLAG="${TMPDIR:-/tmp}/claude-supabase-write.flag"
SB=0
[ -f "$SB_FLAG" ] && SB=1

[ -z "$CHANGES" ] && [ "$SB" -eq 0 ] && exit 0

# Cooldown: solo recordar una vez cada 20 min
FLAG="${TMPDIR:-/tmp}/claude-close-guard.flag"
NOW=$(date +%s)
if [ -f "$FLAG" ]; then
  LAST=$(cat "$FLAG" 2>/dev/null || echo 0)
  [ $((NOW - LAST)) -lt 1200 ] && exit 0
fi
echo "$NOW" > "$FLAG" 2>/dev/null

MSG="Cierre pendiente:"
[ -n "$CHANGES" ] && MSG="$MSG hay cambios de codigo/docs sin commitear."
if [ "$SB" -eq 1 ]; then
  MSG="$MSG TOCASTE SUPABASE esta sesion (escritura via MCP o script): backup OBLIGATORIO (node scripts/_backup.mjs, o CREATE TABLE AS via MCP si no hay .env.local) + verificar con SELECT que lo escrito quedo bien."
  rm -f "$SB_FLAG" 2>/dev/null
fi
echo "$MSG SI ya terminaste las tareas, cerra la sesion (regla git-deploy + protocolo CLAUDE.md): 1) npm run build  2) git commit + push  3) actualiza docs/LECCIONES_APRENDIDAS.md  4) si Fak te corrigio, decidio o revelo algo nuevo esta sesion: grabalo YA como memoria con su fuente (Fak dixit / doc / arb / Supabase / Y:) y el PORQUE — no confies en acordarte  5) backup si hubo datos  6) lanza el agente auditor. SI todavia estas trabajando, ignora esto y segui sin mencionarlo." >&2
exit 2
