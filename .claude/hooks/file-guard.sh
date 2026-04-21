#!/usr/bin/env bash
# File Guard — bloquea edits a archivos protegidos.
# Exit 2 = bloquea. Exit 0 = permite.

set -e

INPUT=$(cat)

FILE=$(printf '%s' "$INPUT" | node -e '
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(s);
    process.stdout.write(String(j?.tool_input?.file_path ?? ""));
  } catch { process.stdout.write(""); }
});
' 2>/dev/null || true)

if [ -z "$FILE" ]; then exit 0; fi

case "$FILE" in
    *package-lock.json|*.env|*.env.*|*/.git/*)
        echo "BLOCKED: $FILE es archivo protegido" >&2
        exit 2
        ;;
    *)
        exit 0
        ;;
esac
