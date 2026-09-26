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
{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"[PREGUNTA-GUARD] Antes de preguntarle a Fak: ¿esto lo contesta un archivo, un mail (python scripts/_mails.py --buscar), un transcript, el Escritorio o el propio repo? Si no lo buscaste, buscalo primero. Si igual hace falta preguntar, la pregunta lleva un renglon 'Lo que ya tengo:' con lo que encontraste y por que no alcanza. Un OK para hacer mi propio trabajo no se pide: la respuesta es SI, se hace y se reporta. SI se pregunta, con la ruta y el archivo concretos, lo que el contrato de autonomia manda confirmar: escribir en Supabase, un listado maestro, emitir o dejar algo en el SGC o el legajo, lo que hago por PRIMERA VEZ, mandar un mail, cerrar el arb. Y lo que SOLO Fak puede contestar (una decision suya, un dato de planta que no esta escrito). Un '¿cual de estas...?' va solo si los caminos llevan a trabajo distinto y ningun documento decide; si no, elegi con la mejor practica y deci por que."}}
EOF
exit 0
