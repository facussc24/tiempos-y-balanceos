#!/usr/bin/env bash
# instrucciones-log.sh — hook InstructionsLoaded (todos los load_reason). Registra QUE instrucciones
# cargo Claude Code DE VERDAD en la sesion: .claude/.instrucciones-cargadas.log (gitignoreado por
# `.claude/*`, una linea por carga, TSV).
#
# Por que (LECCIONES 04/09/2026): durante un mes 144 sesiones arrancaron con LECCIONES "inyectado"
# por un hook y sin leerlo, porque la salida se recortaba a 2 KB. La regla que salio de ahi dice
# "lo que un hook inyecta se verifica en el TRANSCRIPT"; esto lo vuelve un registro deterministico:
# despues de cada actualizacion de Claude Code, mirar el log de la sesion siguiente y ver que
# figuren CLAUDE.md (session_start), docs/LECCIONES_APRENDIDAS.md (include) y las 7 reglas
# siempre-cargadas. Si falta una, el canal esta roto y se sabe ese dia, no un mes despues.
#
# Payload (visto con grep -a sobre claude.exe 2.1.260, 10/09/2026): session_id, hook_event_name,
# file_path, load_reason (session_start | nested_traversal | path_glob_match | include | compact),
# memory_type, trigger. Si algun campo no viene, queda "?": el hook nunca falla (exit 0 siempre).
set -uo pipefail

INPUT=$(cat)
RAIZ="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
LOG="$RAIZ/.claude/.instrucciones-cargadas.log"

campo() {
  printf '%s' "$INPUT" | tr -d '\n' \
    | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -1 | sed 's/\\\\/\\/g'
}
SID=$(campo session_id)
RAZON=$(campo load_reason)
ARCHIVO=$(campo file_path)
TIPO=$(campo memory_type)

mkdir -p "$(dirname "$LOG")" 2>/dev/null
printf '%s\t%s\t%s\t%s\t%s\n' "$(date +%FT%T)" "${SID:0:8}" "${RAZON:-?}" "${TIPO:-}" "${ARCHIVO:-?}" >> "$LOG" 2>/dev/null

# Rotacion: pasadas las 4.000 lineas quedan las ultimas 2.000 (una sesion carga ~30).
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG" 2>/dev/null || echo 0)" -gt 4000 ]; then
  tail -n 2000 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
fi
exit 0
