#!/usr/bin/env bash
# session-start-context.sh — contexto deterministico al arrancar (SessionStart).
#
# Desde el 04/09/2026 este hook YA NO inyecta docs/LECCIONES_APRENDIDAS.md: el archivo entra
# al system prompt por `@docs/LECCIONES_APRENDIDAS.md` desde CLAUDE.md. Motivo, medido ese dia
# sobre los transcripts: desde el 03/08 (version nueva de Claude Code) toda salida de hook
# mayor a ~10 KB se guarda en un archivo y al modelo le llega un preview de 2 KB ("Output too
# large"). 144 sesiones arrancaron asi: con las lecciones "inyectadas" y sin leerlas. El
# @import no tiene ese tope (4 MiB) y sobrevive la compactacion porque es parte del system
# prompt, asi que tampoco hace falta reinyectarlas en el modo compact.
#
# Uso (cableado en settings.json):
#   session-start-context.sh inicio    → matcher startup|resume|clear: corre cerebro-guard
#       (baja el cerebro si esta PC no lo tiene). No emite texto.
#   session-start-context.sh compact   → matcher compact: reinyecta el nucleo anti-perdida,
#       menos de 1 KB.
#   "lecciones" se acepta como alias de "inicio" (nombre viejo del modo).

cat >/dev/null 2>&1   # drenar el JSON de stdin

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
MODE="${1:-inicio}"

if [ "$MODE" = "compact" ]; then
  cat << 'NUCLEO'
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
5. docs/LECCIONES_APRENDIDAS.md sigue en el system prompt (@import desde CLAUDE.md):
   no hace falta releerlo. Las memorias del tema que estabas tocando, si.
NUCLEO
  exit 0
fi

# El cerebro va PRIMERO: si esta PC no lo tiene, bajarlo es prioritario sobre todo lo demas.
bash "$ROOT/.claude/hooks/cerebro-guard.sh" 2>/dev/null
exit 0
