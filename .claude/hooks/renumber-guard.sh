#!/usr/bin/env bash
# Renumber Guard Hook (PreToolUse, matcher=Bash)
#
# Bloquea ejecucion de scripts .mjs que renumeren/reasignen OPs si no se corrio
# antes el auditor _auditWePlaceholdersAndAllocation.mjs en la sesion. Defensa
# contra el incidente 2026-05-14: renumerar sin leer contenido.
#
# Bypass: agregar flag --i-read-content al comando si ya se hizo la lectura.
#
# Exit 0 = permite. Exit 2 = bloquea (stderr se muestra al modelo).

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

# Solo nos interesan scripts .mjs en scripts/
if ! echo "$CMD" | grep -qE 'scripts/_[A-Za-z]+\.mjs'; then exit 0; fi

# Patrones de scripts riesgosos: renumber, align, reassign, realloc, reallocate
if ! echo "$CMD" | grep -qiE 'scripts/_[A-Za-z]*(renumber|align|reassign|realloc)[A-Za-z]*\.mjs'; then exit 0; fi

# Solo si --apply esta presente (dry-run no requiere lectura previa)
if ! echo "$CMD" | grep -qE '(^|[[:space:]])--apply([[:space:]]|$)'; then exit 0; fi

# Bypass: --i-read-content presente
if echo "$CMD" | grep -qE '(^|[[:space:]])--i-read-content([[:space:]]|$)'; then exit 0; fi

# Bloquear con mensaje educativo
cat >&2 << 'EOF'

[RENUMBER-GUARD BLOQUEO]

Estas por correr un script que renumera o reasigna OPs/WEs en amfe_documents
sin haber verificado el contenido previo. La regla
`amfe.md` §10 (leer contenido antes de renumerar) requiere:

  1. Correr ANTES:
     node scripts/_auditWePlaceholdersAndAllocation.mjs

  2. Resolver placeholders y failures mal alocados PRIMERO

  3. Mostrar tabla diff a Fak (WE.name actual vs propuesto, failure mappings)

  4. RECIEN ENTONCES renumerar

Si ya hiciste los pasos 1-3, agregar el flag al comando para bypass:
     ... --apply --i-read-content

Incidente fuente: 2026-05-14 (AMFE-HF-PAT) — renumeracion ciega dejo 76 placeholders
pobres + failures mal alocados que el equipo APQP tuvo que corregir post-hoc.

EOF

exit 2
