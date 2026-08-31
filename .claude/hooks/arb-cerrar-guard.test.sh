#!/usr/bin/env bash
# Test de regresion — arb-cerrar-guard.sh
#
# POR QUE EXISTE
#   Un gate probado solo "en verde" (bloquea lo que tenia que bloquear) esta probado a
#   medias: lo caro es que bloquee de mas y frene el trabajo de todos los dias. Aca se
#   prueban las DOS direcciones — memoria `feedback_un_control_se_audita_en_las_dos_direcciones`.
#   El caso 1 es el comando REAL con el que cerre el arb el 31/08/2026.
#
#   Los 8 casos marcados [AUDIT 31/08] son BYPASSES REALES que encontro el agente auditor
#   sobre la primera version del guardian, verificados a mano uno por uno. Varios usan
#   sintaxis MAS natural que la que el guardian si cazaba: `.Kill()` es mas idiomatico en
#   PowerShell que `Stop-Process`. Un gate que solo caza la forma en que YO lo escribi no
#   protege del proximo que lo escriba distinto.
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
    printf '  OK    %-60s (exit %s)\n' "$nombre" "$rc"
  else
    printf '  *** FALLA %-56s exit %s, esperaba %s\n' "$nombre" "$rc" "$esperado"
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
echo "BLOQUEA — matar el proceso:"
probar guard "taskkill por nombre" \
  '{"tool_name":"Bash","tool_input":{"command":"taskkill /IM produc.exe /F"}}' 2
probar guard "Stop-Process de PowerShell" \
  '{"tool_name":"PowerShell","tool_input":{"command":"Get-Process produc | Stop-Process -Force"}}' 2
probar guard "[AUDIT 31/08] .Kill() de .NET" \
  '{"tool_name":"PowerShell","tool_input":{"command":"(Get-Process -Name produc).Kill()"}}' 2
probar guard "[AUDIT 31/08] .CloseMainWindow()" \
  '{"tool_name":"PowerShell","tool_input":{"command":"(Get-Process -Name produc).CloseMainWindow()"}}' 2
probar guard "[AUDIT 31/08] os.kill de Python nombrando el arb" \
  '{"tool_name":"Bash","tool_input":{"command":"python -c \"import os,signal; os.kill(pid_produc, signal.SIGTERM)\""}}' 2
probar guard "[AUDIT 31/08] wmic process ... delete" \
  '{"tool_name":"Bash","tool_input":{"command":"wmic process where name=PRODUC.EXE delete"}}' 2
probar guard "[AUDIT 31/08] shutdown /l se lleva puesto todo" \
  '{"tool_name":"Bash","tool_input":{"command":"shutdown /l /f"}}' 2

echo
echo "BLOQUEA — cerrar la ventana principal:"
probar guard      "el WM_CLOSE a ProdWindow del incidente 31/08" "$JSON_INCIDENTE" 2
probar dispatcher "idem, por el despachador"                     "$JSON_INCIDENTE" 2
probar guard "WM_CLOSE por titulo de la ventana principal" \
  '{"tool_name":"Bash","tool_input":{"command":"python -c \"h=ventana(_Produccion_); u.SendMessageW(h,0x0010,0,0)\""}}' 2
probar guard "DestroyWindow sobre ProdWindow" \
  '{"tool_name":"Bash","tool_input":{"command":"python -c \"u.DestroyWindow(hwnd_ProdWindow)\""}}' 2
probar guard "[AUDIT 31/08] 0x10 sin padding es el mismo WM_CLOSE" \
  '{"tool_name":"Bash","tool_input":{"command":"python -c \"u.PostMessageW(h_ProdWindow,0x10,0,0)\""}}' 2
probar guard "[AUDIT 31/08] pywinauto .close()" \
  '{"tool_name":"Bash","tool_input":{"command":"python -c \"from pywinauto import Application; Application().connect(title=_Produccion_).window().close()\""}}' 2
probar guard "[AUDIT 31/08] SendKeys Alt+F4" \
  '{"tool_name":"PowerShell","tool_input":{"command":"$w = New-Object -ComObject WScript.Shell; $w.AppActivate(_Produccion_); $w.SendKeys(_%{F4}_)"}}' 2

echo
echo "DEJA PASAR — metodo documentado, hace falta todos los dias:"
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
probar guard "matar un dev server, que no es el arb" \
  '{"tool_name":"Bash","tool_input":{"command":"taskkill /IM node.exe /F"}}' 0
probar guard "un comando cualquiera" \
  '{"tool_name":"Bash","tool_input":{"command":"npm run build"}}' 0

echo
echo "DEJA PASAR — auditar/documentar este mismo guardian (autobloqueo del 31/08):"
probar guard "grep de los tokens sobre la skill" \
  '{"tool_name":"Bash","tool_input":{"command":"grep -nE \"WM_CLOSE|0x0010|DestroyWindow|EndTask|ProdWindow|taskkill\" .claude/skills/arb-operar/SKILL.md"}}' 0
probar guard "git show del commit de la regla" \
  '{"tool_name":"Bash","tool_input":{"command":"git show 222674cf -- .claude/hooks/arb-cerrar-guard.sh"}}' 0
probar guard "PERO un lector que encadena a un shell NO se exime" \
  '{"tool_name":"Bash","tool_input":{"command":"cat <<EOF | bash\ntaskkill /IM produc.exe /F\nEOF"}}' 2
probar guard "ni uno que lo pasa por xargs" \
  '{"tool_name":"Bash","tool_input":{"command":"grep -l produc *.sh | xargs bash"}}' 0
# El cuerpo de un heredoc es CONTENIDO. Escribir el commit que documenta este guardian
# se autobloqueaba — paso de verdad el 31/08, dos veces seguidas.
probar guard "el commit que DOCUMENTA el guardian pasa" \
  '{"tool_name":"Bash","tool_input":{"command":"git commit -F - <<EOF\nfix: tapar bypasses\n\nTapados: .Kill() y taskkill sobre produc.exe y wmic delete.\nEOF"}}' 0
probar guard "escribir un archivo que NOMBRA los verbos pasa" \
  '{"tool_name":"Bash","tool_input":{"command":"cat > notas.txt <<EOF\nprobar taskkill /IM produc.exe /F\nEOF"}}' 0
probar guard "pero el kill FUERA del heredoc sigue bloqueando" \
  '{"tool_name":"Bash","tool_input":{"command":"taskkill /IM produc.exe /F && git commit -F - <<EOF\nnota\nEOF"}}' 2

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
