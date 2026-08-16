#!/usr/bin/env bash
# Test de regresion — mail-guard.sh
#
# POR QUE EXISTE
#   El guard nacio el 2026-08-14 despues de mandar un mail duplicado. Los 7 casos
#   se probaron sueltos en la consola y NO quedaron guardados: el auditor lo marco
#   el 16/08. Un guardian sin test se rompe callado en el proximo refactor del
#   parser compartido de `_dispatcher.sh` — ya paso con otros 3 guardianes (ccef7f09).
#
# Corre los casos por las DOS vias: el guardian suelto y el despachador, porque
# son dos caminos de parseo distintos y el bug historico estuvo en el compartido.
#
#   bash .claude/hooks/mail-guard.test.sh
#
# Exit 0 = todo verde. Exit 1 = alguna regresion.

set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FALLAS=0

# JSON del incidente real del 14/08: objeto COM de Outlook + .Send() suelto.
JSON_INCIDENTE='{"tool_name":"Bash","tool_input":{"command":"python - <<PY\nimport win32com.client as win32\nol=win32.Dispatch(\"Outlook.Application\"); ns=ol.GetNamespace(\"MAPI\")\nit=ns.GetDefaultFolder(16).Items.Item(1)\nit.Send()\nPY"}}'

probar () {
  local via="$1" nombre="$2" json="$3" esperado="$4"
  local rc
  if [ "$via" = "guard" ]; then
    printf '%s' "$json" | bash "$DIR/mail-guard.sh" >/dev/null 2>&1; rc=$?
  else
    printf '%s' "$json" | bash "$DIR/_dispatcher.sh" >/dev/null 2>&1; rc=$?
  fi
  if [ "$rc" = "$esperado" ]; then
    printf '  OK    %-52s (exit %s)\n' "$nombre" "$rc"
  else
    printf '  *** FALLA %-48s exit %s, esperaba %s\n' "$nombre" "$rc" "$esperado"
    FALLAS=$((FALLAS+1))
  fi
}

echo "Test de regresion — mail-guard  (2 = bloquea, 0 = deja pasar)"
echo
echo "BLOQUEA (envio real por Outlook fuera de _mailEnviar.py):"
probar guard "el .Send() suelto del incidente 14/08" "$JSON_INCIDENTE" 2
probar guard "SendAndReceive suelto" \
  '{"tool_name":"Bash","tool_input":{"command":"python -c \"import win32com.client as w; w.Dispatch(\\\"Outlook.Application\\\").GetNamespace(\\\"MAPI\\\").SendAndReceive(False)\""}}' 2
probar guard ".Send() escrito con Write" \
  '{"tool_name":"Write","tool_input":{"file_path":"x.py","content":"import win32com.client\nol=win32com.client.Dispatch(\"Outlook.Application\")\nm=ol.CreateItem(0)\nm.Send()"}}' 2
probar guard ".Send() metido con Edit" \
  '{"tool_name":"Edit","tool_input":{"file_path":"x.py","new_string":"ol=Dispatch(\"Outlook.Application\")\nmsg=ol.CreateItem(0)\nmsg.Send()"}}' 2

echo
echo "DEJA PASAR (no envia, o va por la via autorizada):"
probar guard "la via autorizada _mailEnviar.py" \
  '{"tool_name":"Bash","tool_input":{"command":"python scripts/_mailEnviar.py --buscar \"APB TRA CEN\" --enviar"}}' 0
probar guard "solo Display (deja el borrador abierto)" \
  '{"tool_name":"Bash","tool_input":{"command":"python -c \"import win32com.client as w; w.Dispatch(\\\"Outlook.Application\\\").CreateItem(0).Display()\""}}' 0
probar guard "leer mails con _mails.py" \
  '{"tool_name":"Bash","tool_input":{"command":"python scripts/_mails.py --buscar Nieve"}}' 0
probar guard "un .Send() que no es de Outlook" \
  '{"tool_name":"Bash","tool_input":{"command":"node -e \"socket.Send()\""}}' 0
probar guard "ReplyAll sin enviar" \
  '{"tool_name":"Bash","tool_input":{"command":"python -c \"import win32com.client as w; w.Dispatch(\\\"Outlook.Application\\\").GetNamespace(\\\"MAPI\\\").GetDefaultFolder(6).Items.Item(1).ReplyAll().Display()\""}}' 0

echo
echo "POR EL DESPACHADOR (el camino real — parser compartido):"
probar disp "el .Send() del incidente bloquea via despachador" "$JSON_INCIDENTE" 2
probar disp "comando inocente pasa via despachador" \
  '{"tool_name":"Bash","tool_input":{"command":"git status"}}' 0

echo
if [ "$FALLAS" -eq 0 ]; then
  echo "Todo OK."
  exit 0
fi
echo "$FALLAS caso(s) en falla — el guardian del mail tiene una regresion."
exit 1
