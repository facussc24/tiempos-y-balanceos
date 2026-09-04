#!/usr/bin/env bash
# session-close-guard.sh — Recuerda el checklist de cierre de sesion cuando hay
# cambios de codigo/docs sin commitear en el repo. Cooldown de 20 min para no
# repetir el recordatorio en cada turno. Se dispara en el evento Stop.
# RETIRADO 04/09/2026 — reemplazado por cierre-guard.sh (logica en scripts/_lib/cierreGuard.mjs).
# Motivo, medido sobre los transcripts: devolvio exit 2 en 115 cierres de turno en dos semanas,
# cada uno un turno extra a 300-500k de contexto con el mismo texto. El nuevo solo habla cuando
# el mensaje DECLARA cierre y hay pendientes medibles, con cooldown por sesion. No esta cableado
# en settings.json; si alguien lo vuelve a cablear, sale sin hacer nada.
cat >/dev/null 2>&1
exit 0

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

# LECCIONES sobre el aviso de 26 KB: al cierre corresponde CONSOLIDAR (fusionar
# lecciones del mismo patron, graduar a regla/memoria/archivo), no comprimir a
# fragmentos. Gate del hook de arranque: aviso 26624, tope duro 28672.
LEC="$REPO/docs/LECCIONES_APRENDIDAS.md"
LEC_SOFT=26624
LEC_OVER=0
if [ -f "$LEC" ]; then
  LEC_SIZE=$(wc -c < "$LEC")
  [ "$LEC_SIZE" -gt "$LEC_SOFT" ] && LEC_OVER=1
fi

[ -z "$CHANGES" ] && [ "$SB" -eq 0 ] && [ "$LEC_OVER" -eq 0 ] && exit 0

# Cooldown de 20 min SOLO para el recordatorio de commit. El aviso de Supabase
# no respeta cooldown: se muestra siempre que haya flag y el flag se borra aca
# mismo — si respetara cooldown, un cierre silenciado dejaria el flag vivo y la
# proxima sesion arrancaria con un falso "tocaste Supabase".
FLAG="${TMPDIR:-/tmp}/claude-close-guard.flag"
NOW=$(date +%s)
if [ "$SB" -eq 0 ] && [ -f "$FLAG" ]; then
  LAST=$(cat "$FLAG" 2>/dev/null || echo 0)
  [ $((NOW - LAST)) -lt 1200 ] && exit 0
fi
echo "$NOW" > "$FLAG" 2>/dev/null

MSG="Cierre pendiente:"
[ -n "$CHANGES" ] && MSG="$MSG hay cambios de codigo/docs sin commitear."
[ "$LEC_OVER" -eq 1 ] && MSG="$MSG LECCIONES_APRENDIDAS.md pesa $LEC_SIZE bytes (aviso $LEC_SOFT): antes de cerrar, pasada de CONSOLIDACION segun su seccion 'Como agregar lecciones' — fusionar lecciones del mismo patron y graduar a regla/memoria/archivo; PROHIBIDO comprimir a fragmentos cripticos o pelear bytes sueltos."
if [ "$SB" -eq 1 ]; then
  MSG="$MSG TOCASTE SUPABASE esta sesion (escritura via MCP o script): backup OBLIGATORIO (node scripts/_backup.mjs, o CREATE TABLE AS via MCP si no hay .env.local) + verificar con SELECT que lo escrito quedo bien."
  # Renombrar, NO borrar: _cierreSesion.mjs compara este epoch contra el del ultimo
  # backup valido. Con rm, un aviso silenciado hacia desaparecer la evidencia y el
  # checklist daba "no aplica" con un backup todavia pendiente. El .avisado deja de
  # pesar solo cuando un backup posterior lo cubre.
  mv -f "$SB_FLAG" "$SB_FLAG.avisado" 2>/dev/null
fi
echo "$MSG Corre 'node scripts/_cierreSesion.mjs' para medir el checklist de cierre (LECCIONES, backup, build, git, Escritorio) en vez de recordarlo. SI ya terminaste las tareas, cerra la sesion (regla git-deploy + protocolo CLAUDE.md): 1) npm run build  2) git commit + push  3) actualiza docs/LECCIONES_APRENDIDAS.md  4) si Fak te corrigio, decidio o revelo algo nuevo esta sesion: grabalo YA como memoria con su fuente (Fak dixit / doc / arb / Supabase / Y:) y el PORQUE — no confies en acordarte  5) backup si hubo datos  6) lanza el agente auditor. SI todavia estas trabajando, ignora esto y segui sin mencionarlo." >&2
exit 2
