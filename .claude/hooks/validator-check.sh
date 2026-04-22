#!/usr/bin/env bash
# Validator Check Hook
# Alerta (no bloquea) si un script .mjs que va a escribir a amfe_documents.data
# no importa runWithValidation. Es complementario a supabase-guard.sh (ese corre
# backup; este valida que haya gate pre-commit).
#
# Exit 0 = permite. Exit 2 = bloquea (no lo usamos aqui, solo alertamos).

set -e

INPUT=$(cat)

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

# Solo .mjs con --apply nos interesan
if ! echo "$CMD" | grep -qE '\.mjs'; then exit 0; fi
if ! echo "$CMD" | grep -qE '(^|[[:space:]])--apply([[:space:]]|$)'; then exit 0; fi

# Extraer el path del .mjs invocado
SCRIPT_PATH=$(echo "$CMD" | grep -oE 'scripts/[a-zA-Z_0-9./-]+\.mjs' | head -1 || true)
if [ -z "$SCRIPT_PATH" ]; then exit 0; fi

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
FULL_PATH="$ROOT/$SCRIPT_PATH"
if [ ! -f "$FULL_PATH" ]; then exit 0; fi

# Solo nos importa si el script escribe a amfe_documents.data
# Heuristicas: menciona 'amfe_documents' Y ('update' O 'upsert' O 'saveAmfe')
TOUCHES_AMFE_DATA=0
if grep -qE "amfe_documents" "$FULL_PATH" 2>/dev/null; then
    if grep -qE "\.update\(|\.upsert\(|saveAmfe" "$FULL_PATH" 2>/dev/null; then
        # Extra check: escribe a la columna data?
        if grep -qE "(data:|\{ ?data ?\})" "$FULL_PATH" 2>/dev/null || \
           grep -qE "saveAmfe" "$FULL_PATH" 2>/dev/null; then
            TOUCHES_AMFE_DATA=1
        fi
    fi
fi

if [ "$TOUCHES_AMFE_DATA" -eq 0 ]; then exit 0; fi

# Usa runWithValidation?
if grep -qE "runWithValidation" "$FULL_PATH" 2>/dev/null; then
    exit 0  # OK, tiene el gate
fi

# NO tiene el gate — alertar (no bloqueamos, solo advertimos)
echo "" >&2
echo "⚠️  VALIDATOR-CHECK: $SCRIPT_PATH escribe a amfe_documents.data pero NO usa runWithValidation()." >&2
echo "   Recomendado: migrar a runWithValidation (ver skill supabase-safety)." >&2
echo "   Continuando — el backup previo (supabase-guard) te cubre ante emergencia." >&2
echo "" >&2

exit 0
