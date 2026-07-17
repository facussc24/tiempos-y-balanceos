#!/usr/bin/env bash
# Validator Check Hook
# BLOQUEA si un script .mjs que va a escribir a amfe_documents.data con --apply
# no importa runWithValidation. Es complementario a supabase-guard.sh (ese corre
# backup; este valida que haya gate pre-commit).
# La regla amfe.md §14 y autonomy-contract fila A lo declaran OBLIGATORIO —
# este hook es su enforcement (2026-07-16; antes solo alertaba).
#
# Exit 0 = permite. Exit 2 = bloquea.

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

# Solo la EJECUCION de un .mjs con --apply nos interesa (no menciones en git commit etc.)
if ! echo "$CMD" | grep -qE '(^|[;&|(][[:space:]]*|^[[:space:]]*)(node|npx)[[:space:]][^;&|]*\.mjs'; then exit 0; fi
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

# NO tiene el gate — BLOQUEAR (regla amfe.md §14: runWithValidation obligatorio)
echo "" >&2
echo "VALIDATOR-CHECK BLOQUEO: $SCRIPT_PATH escribe a amfe_documents.data con --apply pero NO usa runWithValidation()." >&2
echo "   Obligatorio por regla amfe.md §14 + contrato de autonomia fila A." >&2
echo "   Fix: importar { parseSafeArgs, runWithValidation } de scripts/_lib/dryRunGuard.mjs y envolver la escritura (ver skill supabase-safety)." >&2
echo "" >&2

exit 2
