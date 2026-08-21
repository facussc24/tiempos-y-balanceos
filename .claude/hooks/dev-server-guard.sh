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
# el navegador puede llegar a mostrar — `scripts/`, `__tests__/` y `tools/` no se ven ahi.
set -uo pipefail

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
  | grep -vE '^(scripts|__tests__|tools|docs)/' \
  | grep -vE '(^|/)(package(-lock)?|tsconfig[^/]*|vite\.config|vitest\.config)\.json$' \
  | head -5)

[ -z "$EDITED" ] && exit 0

echo "Se toco codigo de la app y no hay dev server escuchando en el puerto ${PORT}." >&2
echo "Si el cambio se ve en el navegador (ver <when_to_verify>), corre preview_start y segui" >&2
echo "<verification_workflow>. Si no se ve, termina el turno sin mencionar este chequeo." >&2
echo "Archivos: $(echo "$EDITED" | tr '\n' ' ')" >&2
exit 2
