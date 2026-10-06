#!/usr/bin/env bash
# pregunta-guard.sh — PreToolUse, matcher: AskUserQuestion. Wrapper fino: la logica vive en
# scripts/_lib/preguntaGuard.mjs y los patrones en scripts/_lib/preguntaCanon.data.json.
#
# BLOQUEA (exit 2) una pregunta a Fak cuando:
#   A. trae una opcion "(Recomendado)" y no es algo que el contrato de autonomia mande confirmar;
#   B. es un menu de alcance o de como seguir ("¿que mas unifico?", "¿por donde arranco?").
# Deja pasar (exit 0, con el recordatorio por additionalContext) lo que se confirma — mandar un mail,
# emitir, Supabase, el arb, un listado maestro, el legajo, borrar, la primera vez — y lo que solo Fak sabe.
#
# Por que dejo de ser un recordatorio (06/10/2026): Fak, "no deberias hacerme tantas preguntas, deberias
# saber que hacer... investigalo para que no vuelva a suceder". Medido del 01/09 al 06/10: 81 preguntas, 35
# rechazadas; el recordatorio llegaba despues de escrita la pregunta y no cambio nada (8 de 20 antes del
# hook, 27 de 61 despues). Contra esas 81: frena 18 de las 35 rechazadas y ninguna de las 24 de contrato.
#
# Si no puede correr (sin node o sin la logica) deja pasar y lo DICE: un control que no lee la pregunta
# no puede frenarla, y frenar a ciegas dejaria sin confirmar un mail o una emision.
# Test: __tests__/scripts/preguntaGuard.test.mjs (ROJO exit 2 y VERDE exit 0, con preguntas reales)
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="${RAIZ}/scripts/_lib/preguntaGuard.mjs"
ENTRADA="$(cat 2>/dev/null || true)"
if command -v node >/dev/null 2>&1 && [ -f "$GUARD" ]; then
  printf '%s' "$ENTRADA" | node "$GUARD"
  exit $?
fi
cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"[PREGUNTA-GUARD] OJO: el control de preguntas NO pudo correr en esta PC (falta node o scripts/_lib/preguntaGuard.mjs), asi que esta pregunta sale sin revisar. Antes de preguntarle a Fak: ¿lo contesta un archivo, un mail, un transcript o el repo? Un OK para trabajo propio no se pide, y una pregunta con opcion recomendada tampoco: se hace y se dice por que. Lo que ya tengo: va en un renglon."}}
EOF
exit 0
