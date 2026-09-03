#!/usr/bin/env bash
# session-start-context.sh — inyeccion deterministica de contexto (SessionStart).
# Doc oficial hooks: en SessionStart, el stdout con exit 0 se agrega al contexto.
#
# Uso (cableado en settings.json):
#   session-start-context.sh lecciones   → matcher startup|resume|clear:
#       inyecta docs/LECCIONES_APRENDIDAS.md (protocolo de inicio paso 1).
#   session-start-context.sh compact     → matcher compact:
#       reinyecta el nucleo anti-perdida + las LECCIONES completas (2026-08-20:
#       antes solo iba el nucleo y las lecciones no sobrevivian la compactacion,
#       justo en las sesiones largas donde mas errores se cometen).
#
# Gates de tamano (2026-08-20, decision Fak — antes tope duro 20480):
#   SOFT 26 KB: se inyecta entero + aviso de consolidar al cierre.
#   HARD 28 KB: se inyecta hasta el ultimo fin de linea completo + aviso fuerte
#               con los bytes descartados. Nunca truncado silencioso a mitad de
#               leccion (el head -c viejo cortaba mudo).
#   La poda es CONSOLIDAR (fusionar/graduar), no comprimir a fragmentos: ver la
#   seccion "Como agregar lecciones" del propio archivo.

cat >/dev/null 2>&1   # drenar el JSON de stdin

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
MODE="${1:-lecciones}"

LECCIONES="$ROOT/docs/LECCIONES_APRENDIDAS.md"
SOFT_BYTES=26624   # 26 KB: aviso de consolidacion
MAX_BYTES=28672    # 28 KB: corte en fin de linea + aviso fuerte

emitir_lecciones() {
  [ -f "$LECCIONES" ] || return 0
  local SIZE
  SIZE=$(wc -c < "$LECCIONES")
  echo "[Protocolo de inicio Barack: docs/LECCIONES_APRENDIDAS.md inyectado automaticamente por hook SessionStart — no hace falta volver a leerlo]"
  if [ "$SIZE" -le "$SOFT_BYTES" ]; then
    cat "$LECCIONES"
  elif [ "$SIZE" -le "$MAX_BYTES" ]; then
    echo "[AVISO DE TAMANO: el archivo pesa $SIZE bytes (aviso $SOFT_BYTES, tope $MAX_BYTES). Entra ENTERO todavia, pero al cierre de esta sesion corresponde una pasada de CONSOLIDACION segun 'Como agregar lecciones': fusionar lecciones del mismo patron, graduar a regla/memoria/archivo. NO comprimir lecciones a fragmentos cripticos.]"
    cat "$LECCIONES"
  else
    local EMITIDO DESCARTADO
    EMITIDO=$(LC_ALL=C awk -v max="$MAX_BYTES" '{n += length($0) + 1; if (n > max) exit} {print}' "$LECCIONES" | wc -c)
    DESCARTADO=$((SIZE - EMITIDO))
    echo "[GATE DE TAMANO — ATENCION: el archivo pesa $SIZE bytes (tope $MAX_BYTES). Se inyecta hasta el ultimo fin de linea completo: quedaron AFUERA $DESCARTADO bytes del FINAL del archivo. CONSOLIDAR ESTA SESION (seccion 'Como agregar lecciones'): fusionar/graduar/archivar hasta volver bajo $SOFT_BYTES. Las lecciones descartadas se leen con Read del archivo.]"
    LC_ALL=C awk -v max="$MAX_BYTES" '{n += length($0) + 1; if (n > max) exit} {print}' "$LECCIONES"
  fi
}

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
  emitir_lecciones
  exit 0
fi

# El cerebro va PRIMERO: si esta PC no lo tiene, bajarlo es prioritario sobre todo lo
# demas — incluidas las lecciones, que sin memorias ni .env.local quedan a medias.
bash "$ROOT/.claude/hooks/cerebro-guard.sh" 2>/dev/null

emitir_lecciones
exit 0
