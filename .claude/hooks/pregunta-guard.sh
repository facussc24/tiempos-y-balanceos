#!/usr/bin/env bash
# pregunta-guard.sh — PreToolUse, matcher: AskUserQuestion. Wrapper fino: la logica vive en
# scripts/_lib/preguntaGuard.mjs y los patrones en scripts/_lib/preguntaCanon.data.json.
#
# PAUSA (exit 2) una pregunta a Fak para que Claude la repiense ANTES de que le llegue, cuando:
#   A. trae una opcion marcada "(Recomendado)";
#   B. tiene forma de menu de alcance o de como seguir ("¿que mas unifico?", "¿por donde arranco?").
# El control frena, no decide: el mensaje devuelve los dos caminos (trabajo propio y reversible -> se
# hace y se dice; algo que se confirma o que solo Fak sabe -> se vuelve a preguntar con la ruta, sin la
# marca de recomendada, y pasa). Una pregunta que nombra un mail, emitir, Supabase, el arb, etc. pasa directo.
#
# Por que dejo de ser un recordatorio (06/10/2026): Fak, "no deberias hacerme tantas preguntas, deberias
# saber que hacer... investigalo para que no vuelva a suceder". Medido del 01/09 al 06/10: 81 preguntas, 35
# rechazadas; el recordatorio llegaba despues de escrita la pregunta y no cambio nada (8 de 20 antes del
# hook, 27 de 61 despues). La primera version de esta tarde mandaba "hace la recomendada" y una auditoria
# independiente la tumbo: un filtro por palabras no sabe que se esta decidiendo (ver preguntaGuard.mjs).
#
# Si no puede correr (sin node, sin la logica, o la logica se rompe) deja pasar y lo DICE.
# Test: __tests__/scripts/preguntaGuard.test.mjs (ROJO exit 2 y VERDE exit 0, con preguntas reales)
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="${RAIZ}/scripts/_lib/preguntaGuard.mjs"
ENTRADA="$(cat 2>/dev/null || true)"
no_corrio() {
  cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"[PREGUNTA-GUARD] OJO: el control de preguntas NO pudo correr en esta PC (falta node, falta scripts/_lib/preguntaGuard.mjs o la logica fallo), asi que esta pregunta sale sin revisar. Antes de preguntarle a Fak: ¿lo contesta un archivo, un mail, un transcript o el repo? Un OK para trabajo propio y reversible no se pide. Lo que se confirma (mail, emitir, servidor, Supabase, arb, borrar, primera vez) va con la ruta concreta. Lo que ya tengo: va en un renglon."}}
EOF
  exit 0
}
command -v node >/dev/null 2>&1 || no_corrio
[ -f "$GUARD" ] || no_corrio
SALIDA="$(printf '%s' "$ENTRADA" | node "$GUARD")"
CODIGO=$?
if [ "$CODIGO" -eq 0 ]; then printf '%s\n' "$SALIDA"; exit 0; fi
if [ "$CODIGO" -eq 2 ]; then exit 2; fi
no_corrio
