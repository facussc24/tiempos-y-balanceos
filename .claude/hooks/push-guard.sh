#!/usr/bin/env bash
# push-guard.sh — Enforcement de la regla git-deploy: "SIEMPRE npm run build antes
# de pushear" (incidente 2026-04-13: 3 deploys rotos por import sin dependencia).
#
# Bloquea `git push` si hay codigo fuente mas nuevo que el ultimo build (dist/).
# El build de vite solo escribe dist/ cuando pasa, asi que dist mas nuevo que
# todo el codigo == hubo build exitoso post-cambios.
#
# Exit 0 = permite. Exit 2 = bloquea.

set -e

INPUT=$(cat)

# Camino rapido: si el despachador ya parseo el JSON, lo reuso.
# Si no (guardian corrido suelto), parseo yo como siempre.
if [ -n "${HOOK_CMD+x}" ]; then
  CMD="$HOOK_CMD"
else
CMD=$(printf '%s' "$INPUT" | node -e '
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(s);
    process.stdout.write(String(j?.tool_input?.command ?? ""));
  } catch { process.stdout.write(""); }
});
' 2>/dev/null || true)
fi

if [ -z "$CMD" ]; then exit 0; fi

# Solo comandos que ejecutan git push
if ! echo "$CMD" | grep -qE '(^|[;&|][[:space:]]*)git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?push'; then exit 0; fi

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
DIST="$ROOT/dist/index.html"

if [ ! -f "$DIST" ]; then
    echo "PUSH-GUARD: no existe dist/index.html — corre 'npm run build' ANTES de pushear (regla git-deploy). Si el build pasa, reintenta el push." >&2
    exit 2
fi

DIST_M=$(stat -c %Y "$DIST" 2>/dev/null || echo 0)
NEWEST=$(cd "$ROOT" && git ls-files -z -- '*.ts' '*.tsx' '*.css' 'index.html' 'package.json' 'vite.config.ts' 2>/dev/null \
  | xargs -0 stat -c %Y 2>/dev/null | sort -rn | head -1)
NEWEST=${NEWEST:-0}

if [ "$NEWEST" -gt "$DIST_M" ]; then
    echo "PUSH-GUARD: hay codigo fuente mas nuevo que el ultimo build (dist/). Corre 'npm run build' primero (regla git-deploy — incidente 2026-04-13: el build de CI valida imports que el dev server no). Si pasa, reintenta el push." >&2
    exit 2
fi

exit 0
