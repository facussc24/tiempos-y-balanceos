#!/usr/bin/env bash
# Stop hook — recordar verificar en el preview cuando se toco codigo de la APP.
#
# Historia (21/08/2026): la version anterior vivia inline dentro de settings.json y decia
# "no dev server is running" pero NUNCA chequeaba si habia un dev server: miraba solo el
# `git diff`. Resultado: con el server levantado seguia devolviendo exit 2, y como ademas
# miraba archivos de OTRA sesion sin commitear, dejaba el cierre de turno en un loop infinito.
# Lo reporto Claude y Fak autorizo el arreglo ("si arregalalo").
#
# Ahora: (1) si el dev server ya escucha, no hay nada que recordar; (2) solo mira codigo que
# el navegador puede llegar a mostrar — `scripts/`, `__tests__/` y `tools/` no se ven ahi;
# (3) desde el 10/09/2026 (A4) solo lo que ESTA sesion toco: el JSON del Stop trae
# `transcript_path` y scripts/_lib/archivosSesion.mjs lo convierte en la lista de archivos de la
# sesion (subagentes incluidos). Lo sucio de OTRA sesion sobre el mismo repo no es mio, y
# `.claude/`, `.mcp.json` y los `.md` no se ven en el navegador (8 falsos positivos en la semana).
# Si la lista no se puede atribuir (`*`: sin transcript, o comandos sin archivo) se cuenta todo.
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INPUT=$(cat 2>/dev/null)
# Si este Stop viene de un Stop anterior ya bloqueado (stop_hook_active), no se vuelve a frenar:
# sin esto el turno no puede terminar nunca (visto 10/09/2026, tres Stop seguidos por archivos ajenos).
case "$INPUT" in *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) exit 0;; esac

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 0

# Puerto del dev server, de .claude/launch.json (default 3000).
PORT=$(sed -n 's/.*"port"[[:space:]]*:[[:space:]]*\([0-9]\{1,\}\).*/\1/p' .claude/launch.json 2>/dev/null | head -1)
[ -z "$PORT" ] && PORT=3000

# (1) Ya hay algo escuchando en el puerto -> el preview esta arriba, no molestar.
if command -v netstat >/dev/null 2>&1; then
  if netstat -ano 2>/dev/null | grep -qE "[:.]${PORT}[[:space:]]+.*LISTEN"; then
    exit 0
  fi
fi

# (2) Solo codigo de la app. Lo de scripts/tests/tools no es observable en el navegador.
EDITED=$(git diff --name-only HEAD 2>/dev/null \
  | grep -E '\.(ts|tsx|js|jsx|css|json)$' \
  | grep -vE '^(scripts|__tests__|tools|docs|\.claude)/' \
  | grep -vE '(^|/)\.mcp\.json$' \
  | grep -vE '(^|/)(package(-lock)?|tsconfig[^/]*|vite\.config|vitest\.config)\.json$')

[ -z "$EDITED" ] && exit 0

# (3) Solo lo que ESTA sesion toco. `*` = no atribuible: se cuenta todo, como antes.
TOCADOS=""
if command -v node >/dev/null 2>&1 && [ -f "$RAIZ/scripts/_lib/archivosSesion.mjs" ]; then
  TOCADOS=$(printf '%s' "$INPUT" | node "$RAIZ/scripts/_lib/archivosSesion.mjs" --repo "$(pwd)" 2>/dev/null)
fi
if [ -n "$TOCADOS" ] && [ "$TOCADOS" != "*" ]; then
  EDITED=$(printf '%s\n' "$EDITED" | grep -Fx -f <(printf '%s\n' "$TOCADOS"))
fi
EDITED=$(printf '%s\n' "$EDITED" | grep . | head -5)

[ -z "$EDITED" ] && exit 0

echo "Se toco codigo de la app y no hay dev server escuchando en el puerto ${PORT}." >&2
echo "Si el cambio se ve en el navegador (ver <when_to_verify>), corre preview_start y segui" >&2
echo "<verification_workflow>. Si no se ve, termina el turno sin mencionar este chequeo." >&2
echo "Archivos: $(echo "$EDITED" | tr '\n' ' ')" >&2
exit 2
