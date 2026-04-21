#!/usr/bin/env bash
# Supabase Safety Guard
# Dispara _backup.mjs ANTES de correr scripts destructivos contra Supabase.
# Exit 0 = permite. Exit 2 = bloquea.
#
# Parsea JSON con node (no depende de jq).
# Dispara backup si el Bash command matchea:
#   - node scripts/_(fix|sync|delete|clean|reset|reseed|propagate|apply|seed|migrate)*.mjs
#   - cualquier .mjs con flag --apply

set -e

INPUT=$(cat)

# Extraer el campo tool_input.command usando node (portable).
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

if [ -z "$CMD" ]; then exit 0; fi

# Solo nos importan .mjs
if ! echo "$CMD" | grep -qE '\.mjs'; then exit 0; fi

# Deteccion de destructivo
DESTRUCTIVE=0
if echo "$CMD" | grep -qE 'scripts/_(fix|sync|delete|clean|reset|reseed|propagate|apply|seed|migrate)'; then
    DESTRUCTIVE=1
fi
if echo "$CMD" | grep -qE '(^|[[:space:]])--apply([[:space:]]|$)'; then
    DESTRUCTIVE=1
fi

if [ "$DESTRUCTIVE" -eq 0 ]; then exit 0; fi

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
BACKUP_SCRIPT="$ROOT/scripts/_backup.mjs"

if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "Supabase guard: no encontre _backup.mjs en $BACKUP_SCRIPT" >&2
    echo "Permito pero SIN backup previo. Inseguro." >&2
    exit 0
fi

echo "Supabase guard: script destructivo detectado, corriendo _backup.mjs antes..." >&2
if ( cd "$ROOT" && node "$BACKUP_SCRIPT" ) >&2; then
    echo "Supabase guard: backup OK." >&2
    exit 0
else
    echo "Supabase guard: BACKUP FALLO. Bloqueo comando destructivo." >&2
    exit 2
fi
