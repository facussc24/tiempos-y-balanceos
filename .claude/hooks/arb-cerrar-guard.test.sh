#!/usr/bin/env bash
# Test de regresion — arb-cerrar-guard.sh
#
# POR QUE EXISTE
#   Un gate que solo se probo "en verde" (bloquea lo que tenia que bloquear) esta
#   probado a medias: lo caro es que bloquee de mas y frene el trabajo de todos los
#   dias. Aca se prueban las DOS direcciones — memoria
#   `feedback_un_control_se_audita_en_las_dos_direcciones`.
#   El caso 1 es el comando REAL con el que cerre el arb el 31/08/2026.
#
# Corre por las dos vias (guardian suelto y despachador): son dos caminos de parseo
# distintos y los bugs historicos estuvieron en el compartido.
#
#   bash .claude/hooks/arb-cerrar-guard.test.sh
#
# Exit 0 = todo verde. Exit 1 = alguna regresion.

set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FALLAS=0

# El comando exacto del incidente del 31/08: enumera ventanas y le manda WM_CLOSE
# a ProdWindow (la principal) ademas de a TabCtrl.
JSON_INCIDENTE='{"tool_name":"Bash","tool_input":{"command":"python - <<PY\nimport ctypes\nu=ctypes.windll.user32\nif cls(h) in (\"ProdWindow\",\"TabCtrl\"): found.append(h)\nfor h in found: u.PostMessageW(h,0x0010,0,0)\nPY"}}'

probar () {
  local via="$1" nombre="$2" json="$3" esperado="$4" rc
  if [ "$via" = "guard" ]; then
    printf '%s' "$json" | bash "$DIR/arb-cerrar-guard.sh" >/dev/null 2>&1; rc=$?
  else
    printf '%s' "$json" | bash "$DIR/_dispatcher.sh" >/dev/null 2>&1; rc=$?
  fi
  if [ "$rc" = "$esperado" ]; then
    printf '  OK    %-56s (exit %s)\n' "$nombre" "$rc"
  else
    printf '  *** FALLA %-52s exit %s, esperaba %s\n' "$nombre" "$rc" "$esperado"
    FALLAS=$((FALLAS+1))
  fi
}

# El escape no puede estar puesto durante el test o los casos rojos darian verdes.
ESCAPE="$HOME/.claude/.arb-cerrar-ok"
GUARDADO=""
if [ -f "$ESCAPE" ]; then GUARDADO="$(mktemp)"; mv "$ESCAPE" "$GUARDADO"; fi
restaurar () { [ -n "$GUARDADO" ] && mv "$GUARDADO" "$ESCAPE"; }
trap restaurar EXIT

echo "Test de regresion — arb-cerrar-guard  (2 = bloquea, 0 = deja pasar)"
echo
echo "BLOQUEA (cerrar el arb):"
probar guard      "el WM_CLOSE a ProdWindow del incidente 31/08" "$JSON_INCIDENTE" 2
probar dispatcher "idem, por el despachador"                     "$JSON_INCIDENTE" 2
probar guard "taskkill del proceso" \
  '{"tool_name":"Bash","tool_input":{"command":"taskkill /IM produc.exe /F"}}' 2
probar guard "Stop-Process de PowerShell" \
  '{"tool_name":"PowerShell","tool_input":{"command":"Get-Process produc | Stop-Process -Force"}}' 2
probar guard "WM_CLOSE por titulo de la ventana principal" \
  '{"tool_name":"Bash","tool_input":{"command":"python -c \"h=ventana(_Produccion_); u.SendMessageW(h,0x0010,0,0)\""}}' 2
probar guard "DestroyWindow sobre ProdWindow" \
  '{"tool_name":"Bash","tool_input":{"command":"python -c \"u.DestroyWindow(hwnd_ProdWindow)\""}}' 2

echo
echo "DEJA PASAR (metodo documentado, hace falta todos los dias):"
probar guard "WM_CLOSE a Maestro de Insumos (descarta edicion)" \
  '{"tool_name":"Bash","tool_input":{"command":"python -c \"if _Maestro de Insumos_ in txt(h): u.PostMessageW(h,0x0010,0,0)\""}}' 0
probar guard "WM_CLOSE a Maestro de Relaciones" \
  '{"tool_name":"Bash","tool_input":{"command":"python -c \"if _Maestro de Relaciones_ in txt(h): u.PostMessageW(h,0x0010,0,0)\""}}' 0
probar guard "_arbVer.py reset (cierra y REABRE Relaciones)" \
  '{"tool_name":"Bash","tool_input":{"command":"python scripts/_arbVer.py reset"}}' 0
probar guard "_arbVer.py estado (solo lee)" \
  '{"tool_name":"Bash","tool_input":{"command":"python scripts/_arbVer.py estado"}}' 0
probar guard "listar el proceso sin matarlo" \
  '{"tool_name":"PowerShell","tool_input":{"command":"Get-Process produc | Select-Object Id,MainWindowTitle"}}' 0
probar guard "la carga normal en el arb" \
  '{"tool_name":"Bash","tool_input":{"command":"python scripts/_arbSustituir.py --tabla x.csv --apply"}}' 0
probar guard "un comando cualquiera" \
  '{"tool_name":"Bash","tool_input":{"command":"npm run build"}}' 0

echo
echo "EL ESCAPE DE FAK (un solo uso):"
mkdir -p "$HOME/.claude"; touch "$ESCAPE"
probar guard "con ~/.claude/.arb-cerrar-ok puesto, deja pasar" "$JSON_INCIDENTE" 0
probar guard "y se consumio: el siguiente vuelve a bloquear"   "$JSON_INCIDENTE" 2

echo
if [ "$FALLAS" -eq 0 ]; then
  echo "TODO VERDE"
else
  echo "$FALLAS FALLA(S)"
fi
exit $([ "$FALLAS" -eq 0 ] && echo 0 || echo 1)
