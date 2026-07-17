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
if [ -f "$LECCIONES" ]; then
  echo "[Protocolo de inicio Barack: docs/LECCIONES_APRENDIDAS.md inyectado automaticamente por hook SessionStart — no hace falta volver a leerlo]"
  cat "$LECCIONES"
fi
exit 0
