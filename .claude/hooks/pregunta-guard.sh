#!/usr/bin/env bash
# pregunta-guard.sh — PreToolUse, matcher: AskUserQuestion. NO bloquea.
#
# Devuelve additionalContext (exit 0): el recordatorio llega en el momento exacto en que
# estoy por preguntar, sin frenar la herramienta. Medido 04/09/2026: 37 AskUserQuestion en
# dos semanas, 14 contestadas con fastidio o "ya te lo dije" ("no lo puedo creer, en algun
# lugar tiene que estar", "deja de preguntar pelotudeces"); 10 en una sola sesion el 01/09.
# La regla ya existia en CLAUDE.md y en dos memorias; el texto no llegaba a tiempo.
#
# Es un recordatorio y no un candado a proposito: preguntar lo que SOLO Fak sabe es
# correcto, y una lista de patrones no distingue eso en castellano.
cat >/dev/null 2>&1   # drenar el JSON de stdin

cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"[PREGUNTA-GUARD] Antes de preguntarle a Fak: ¿esto lo contesta un archivo, un mail (python scripts/_mails.py --buscar), un transcript, el Escritorio o el propio repo? Si no lo buscaste, buscalo primero. Si igual hace falta preguntar, la pregunta lleva un renglon 'Lo que ya tengo:' con lo que encontraste y por que no alcanza. Si la pregunta arranca con '¿cual de estas...' o pide un OK para hacer mi trabajo, NO se pregunta: la respuesta es SI, se hace y se reporta. Solo se pregunta lo que SOLO Fak puede contestar (una decision suya, un dato de planta que no esta escrito)."}}
EOF
exit 0
