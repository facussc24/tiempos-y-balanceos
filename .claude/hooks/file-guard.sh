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

# Normalizar separadores Windows → POSIX para que los globs matcheen
FILE=$(printf '%s' "$FILE" | tr '\\' '/')

case "$FILE" in
    *package-lock.json|*.env|*.env.*|*/.git/*)
        echo "BLOCKED: $FILE es archivo protegido" >&2
        exit 2
        ;;
esac

# Regla nueva/modificada en .claude/rules/ → recordar el gate de enforcement
# (skill rule-enforcement-gate: toda regla con SIEMPRE/NUNCA nace con check
# ejecutable en la misma sesion). Speed bump una vez por hora, despues pasa.
case "$FILE" in
    *.claude/rules/*.md)
        FLAG="${TMPDIR:-/tmp}/claude-rule-gate.flag"
        NOW=$(date +%s)
        LAST=$(cat "$FLAG" 2>/dev/null || echo 0)
        if [ $((NOW - LAST)) -ge 3600 ]; then
            echo "$NOW" > "$FLAG" 2>/dev/null
            echo "RULE-GATE: estas editando una regla ($FILE). Si declara un SIEMPRE/NUNCA operativo, cargala con su ENFORCEMENT ejecutable en esta misma sesion (hook, check del validator o gate de script) — skill rule-enforcement-gate. Si ya lo tenes cubierto o es solo prosa informativa, reintenta el edit y segui." >&2
            exit 2
        fi
        ;;
esac

exit 0
