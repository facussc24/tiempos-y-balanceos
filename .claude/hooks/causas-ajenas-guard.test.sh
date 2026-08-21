#!/usr/bin/env bash
# Regresion de causas-ajenas-guard.sh — el guardian que bloquea reconstrucciones causales
# de errores ajenos sin fuente (incidente 21/08/2026, memoria
# `feedback_no_inventar_causas_de_errores_ajenos`).
#
# Los 4 primeros casos son FRASES REALES que se escribieron en memorias y hubo que purgar.
# Los 5 siguientes son la calibracion: si el guardian los bloquea, se vuelve inservible y
# alguien lo va a apagar — un guardian que grita por todo no protege nada.
#
#   bash .claude/hooks/causas-ajenas-guard.test.sh
set -uo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
G=".claude/hooks/causas-ajenas-guard.sh"
ok=0; fail=0

probar() { # $1=esperado $2=file $3=content $4=descripcion
  HOOK_FILE="$2" HOOK_PARSED4="$3" bash "$G" >/dev/null 2>&1
  local rc=$?
  if [ "$rc" -eq "$1" ]; then ok=$((ok+1)); printf '  ok   %s\n' "$4"
  else fail=$((fail+1)); printf '  FALLA %s  (esperaba %s, dio %s)\n' "$4" "$1" "$rc"; fi
}

echo "BLOQUEA (2) — casos reales que hubo que purgar de las memorias:"
probar 2 "/x/memory/reference_algo.md" \
  "El 15 g sale de leer el numero del codigo AD-ADFA15." "el incidente que lo origino"
probar 2 "/x/memory/reference_algo.md" \
  "La BOM dice 18KG: confundieron los litros con los kilos." "confundieron, sin fuente"
probar 2 "/x/docs/LECCIONES_APRENDIDAS.md" \
  "El arb tiene 15,00 donde el resto tiene 0,015: se comio la coma." "se comio la coma"
probar 2 "/x/memory/m.md" \
  "Cambiaron la unidad a BI y nadie recalculo los numeros." "nadie recalculo"

echo "DEJA PASAR (0) — calibracion, esto NO es el patron:"
probar 0 "/x/memory/m.md" \
  "La BOM dice BIDON 18KG y la etiqueta de la lata dice NETO 15 Kg." "describe el ESTADO"
probar 0 "/x/memory/m.md" \
  "Segun el mail del 11/12/2025 de Fak, confundieron la unidad." "misma frase CON fuente"
probar 0 "/x/memory/m.md" \
  "Probablemente nadie recalculo los numeros, no consta." "inferencia declarada"
probar 0 "/x/components/Foo.tsx" \
  "alguien copio esto y nadie recalculo nada" "archivo fuera de alcance"
probar 0 "/x/memory/feedback_no_inventar_causas_de_errores_ajenos.md" \
  "se comio la coma, confundieron, nadie recalculo" "el archivo que documenta la regla"

echo
echo "$ok ok · $fail falla(s)"
[ "$fail" -eq 0 ]
