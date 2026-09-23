#!/usr/bin/env bash
# Test de regresion del despachador de guardianes.
#
#   bash .claude/hooks/_dispatcher.test.sh
#
# Correr despues de CUALQUIER cambio en _dispatcher.sh o en los guardianes.
#
# POR QUE EXISTE (2026-08-04): al consolidar los 8 hooks en uno, el parser
# compartido escribia "\x1f\x1f\x1f" cuando el JSON no se podia parsear. Eso NO
# es la cadena vacia, asi que el `[ -z "$PARSED" ]` de cad-guard, patrones-guard
# y escritorio-guard nunca disparaba y su red de seguridad (grep sobre el JSON
# crudo) quedaba muerta: los tres DEJABAN PASAR en vez de bloquear.
# El commit original decia haber probado "JSON roto -> corren los 9" — y era
# cierto, corrian los 9. Pero correr no es proteger. Lo encontro el auditor.
#
# OJO AL ESCRIBIR TESTS DE ESTOS GUARDIANES: tres de ellos tienen enfriamiento
# de 3600 s. Si no se borra la marca antes de cada corrida salen 0 pase lo que
# pase, y el test da verde sin haber probado nada.

cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1
H=.claude/hooks
FALLOS=0

limpiar() {
  rm -f "${TMPDIR:-/tmp}/claude-cad-guard.flag" \
        "${HOME:-/tmp}/.claude/patrones-guard.flag" \
        "${HOME:-/tmp}/.claude/escritorio-guard.flag" 2>/dev/null
}

afirmar() { # nombre, esperado, obtenido
  if [ "$2" = "$3" ]; then
    printf '  OK    %-52s (exit %s)\n' "$1" "$3"
  else
    printf '  FALLA %-52s esperaba %s, dio %s\n' "$1" "$2" "$3"
    FALLOS=$((FALLOS + 1))
  fi
}

correr() { limpiar; printf '%s' "$1" | bash "$H/_dispatcher.sh" >/dev/null 2>&1; echo $?; }
# Desde el 05/09/2026 los recordatorios NO bloquean: salen como additionalContext (JSON en
# stdout, exit 0). "avisa" se mide en el stdout, no en el exit.
avisa() { limpiar; printf '%s' "$1" | bash "$H/_dispatcher.sh" 2>/dev/null | grep -q "$2" && echo si || echo no; }

RUTA='/c/Users/FacundoS-PC/OneDrive/Escritorio/tarea'
ROTO_ESC='{"tool_name":"Bash","tool_input":{"command":"rm -rf '"$RUTA"'"'   # sin cerrar
ROTO_CAD='{"tool_name":"Bash","tool_input":{"command":"python m.py --usa-gmsh"'

echo "Test de regresion — despachador de guardianes"
echo ""
echo "JSON ROTO (el guardian tiene que caer a su red de seguridad):"
afirmar "borrado del Escritorio con JSON roto -> BLOQUEA" 2 "$(correr "$ROTO_ESC")"
afirmar "comando CAD con JSON roto -> pasa (exit 0)"       0 "$(correr "$ROTO_CAD")"
afirmar "  ...y avisa por additionalContext (CAD-GUARD)"   si "$(avisa "$ROTO_CAD" CAD-GUARD)"

echo ""
echo "JSON VALIDO (comportamiento normal):"
afirmar "comando inocente -> pasa" 0 \
  "$(correr '{"tool_name":"Bash","tool_input":{"command":"echo hola"}}')"
afirmar "borrado del Escritorio -> BLOQUEA" 2 \
  "$(correr '{"tool_name":"Bash","tool_input":{"command":"rm -rf '"$RUTA"'"}}')"
afirmar "herramienta que no matchea -> pasa" 0 \
  "$(correr '{"tool_name":"Read","tool_input":{"file_path":"a.txt"}}')"

echo ""
echo "El parser compartido deja los campos VERDADERAMENTE vacios si falla:"
D=$(mktemp -d)
printf '%s' "$ROTO_CAD" | node -e "$(awk '/^printf .%s. "\$INPUT" \| node -e /{f=1;next} f&&/^. "\$TMP"/{exit} f' "$H/_dispatcher.sh")" "$D" 2>/dev/null
for campo in parsed4 parsed3 cmd; do
  N=$( [ -f "$D/$campo" ] && wc -c < "$D/$campo" || echo ausente )
  afirmar "$campo con JSON roto mide 0 bytes" 0 "$N"
done
rm -rf "$D"
limpiar

echo ""
echo "CARRIL DE AUTO-REPARACION (22/09/2026): guardianes.mjs NO carga (SyntaxError, como el 10/09):"
# Arbol de mentira con una COPIA del despachador y un guardianes.mjs roto. El despachador vivo
# no se toca: si se rompe, se traba todo (incluido el Edit que lo arreglaria). Va adentro del
# tmp/ del repo (gitignoreado) y no en /tmp: bajo msys /tmp es un montaje y `pwd` lo devuelve
# como /tmp/..., que el file:/// del despachador no resuelve (el vivo esta en /c/Dev/...).
mkdir -p tmp
R=$(mktemp -d "$PWD/tmp/_despachador_roto.XXXXXX")
mkdir -p "$R/.claude/hooks" "$R/scripts/_lib"
cp "$H/_dispatcher.sh" "$R/.claude/hooks/_dispatcher.sh"
printf '%s\n' "import { sinCuerposHeredoc } from './shellTexto.mjs';" "const CANON = 'consumosCanon.data.json';" "export const roto = ;" > "$R/scripts/_lib/guardianes.mjs"
printf '%s\n' "export const sinCuerposHeredoc = (s) => s;" > "$R/scripts/_lib/shellTexto.mjs"
roto() { printf '%s' "$1" | bash "$R/.claude/hooks/_dispatcher.sh" >/dev/null 2>&1; echo $?; }
edit() { printf '{"tool_name":"%s","tool_input":{"file_path":"%s","old_string":"a","new_string":"b"}}' "$1" "$2"; }
afirmar "Edit de scripts/_lib/guardianes.mjs -> pasa (0)"            0 "$(roto "$(edit Edit "$R/scripts/_lib/guardianes.mjs")")"
afirmar "Write con ruta Windows (C:\\\\...\\\\guardianes.mjs) -> pasa" 0 "$(roto "$(edit Write 'C:\\Dev\\BarackMercosul\\scripts\\_lib\\guardianes.mjs')")"
afirmar "Edit de su modulo local ./shellTexto.mjs -> pasa"          0 "$(roto "$(edit Edit "$R/scripts/_lib/shellTexto.mjs")")"
afirmar "Write de scripts/_lib/consumosCanon.data.json -> pasa"     0 "$(roto "$(edit Write "$R/scripts/_lib/consumosCanon.data.json")")"
AVISO=$(printf '%s' "$(edit Edit "$R/scripts/_lib/guardianes.mjs")" | bash "$R/.claude/hooks/_dispatcher.sh" 2>/dev/null | grep -c "CARRIL DE AUTO-REPARACION")
afirmar "  ...y avisa por additionalContext que estan CAIDOS"      1 "$AVISO"
afirmar "Bash inocente con el modulo roto -> BLOQUEA"               2 "$(roto '{"tool_name":"Bash","tool_input":{"command":"echo hola"}}')"
afirmar "Bash node --check del mismo archivo -> BLOQUEA"            2 "$(roto '{"tool_name":"Bash","tool_input":{"command":"node --check scripts/_lib/guardianes.mjs"}}')"
afirmar "Edit de otro archivo de scripts/_lib -> BLOQUEA"           2 "$(roto "$(edit Edit "$R/scripts/_lib/cierreGuard.mjs")")"
afirmar "Edit de un archivo cualquiera -> BLOQUEA"                  2 "$(roto "$(edit Edit "$R/App.tsx")")"
afirmar "Write de un guardianes.mjs FUERA de scripts/_lib -> BLOQUEA" 2 "$(roto "$(edit Write "$R/tmp/guardianes.mjs")")"
afirmar "JSON roto con el modulo roto -> BLOQUEA"                   2 "$(roto '{"tool_name":"Edit","tool_input":{"file_path":"scripts/_lib/guardianes.mjs"')"
rm -rf "$R"

echo ""
if [ "$FALLOS" -eq 0 ]; then
  echo "Todo OK."
else
  echo "FALLARON $FALLOS chequeos. Un guardian puede haber perdido el veto: NO pushear."
fi
exit $((FALLOS > 0))
