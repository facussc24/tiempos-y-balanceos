#!/usr/bin/env bash
# session-start-context.sh — inyeccion deterministica de contexto (SessionStart).
# Doc oficial hooks: en SessionStart, el stdout con exit 0 se agrega al contexto.
#
# Uso (cableado en settings.json):
#   session-start-context.sh lecciones   → matcher startup|resume|clear:
#       inyecta docs/LECCIONES_APRENDIDAS.md completo (protocolo de inicio paso 1,
#       antes dependia de que Claude se acordara de leerlo).
#   session-start-context.sh compact     → matcher compact:
#       la compactacion NO re-inyecta las reglas .claude/rules/ con paths: ni las
#       lecciones — reinyectar el nucleo anti-perdida.

cat >/dev/null 2>&1   # drenar el JSON de stdin

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
MODE="${1:-lecciones}"

if [ "$MODE" = "compact" ]; then
  cat << 'EOF'
[POST-COMPACT Barack — nucleo anti-perdida, inyectado por hook]
1. Las reglas .claude/rules/ condicionales (paths:) NO sobreviven la compactacion:
   se recargan recien al volver a LEER archivos que matcheen. Si seguis trabajando
   AMFE/CP/scripts, relee la regla que aplique antes de editar.
2. Prohibiciones core vigentes: NUNCA inventar datos tecnicos (TBD y avisar);
   CC/SC solo Fak; Supabase live = unica verdad (no dumps); espanol AR simple.
3. Entregables ejecutables (tablas para arb/Supabase): dato crudo before→after
   + abrir el archivo + validador de consumos ANTES de entregar.
4. Si habia numeros/decisiones criticas en la parte compactada: verificarlos de
   nuevo contra la fuente, no confiar en el resumen.
EOF
  exit 0
fi

LECCIONES="$ROOT/docs/LECCIONES_APRENDIDAS.md"
MAX_BYTES=20480   # gate 2026-08-09: el archivo llego a 126 KB y se inyectaba entero (~30k tokens/sesion)
if [ -f "$LECCIONES" ]; then
  SIZE=$(wc -c < "$LECCIONES")
  echo "[Protocolo de inicio Barack: docs/LECCIONES_APRENDIDAS.md inyectado automaticamente por hook SessionStart — no hace falta volver a leerlo]"
  if [ "$SIZE" -gt "$MAX_BYTES" ]; then
    echo "[GATE DE TAMANO: el archivo pesa $SIZE bytes (tope $MAX_BYTES). Se inyectan solo los primeros 20 KB. PODAR YA: destilar lo accionable y archivar el detalle en docs/_archive/ (ver poda 2026-08-09).]"
    head -c "$MAX_BYTES" "$LECCIONES"
  else
    cat "$LECCIONES"
  fi
fi
exit 0
