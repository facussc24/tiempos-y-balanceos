#!/usr/bin/env bash
# cierre-guard.sh — hook Stop. Reemplaza a session-close-guard.sh desde el 04/09/2026.
#
# La logica vive en scripts/_lib/cierreGuard.mjs (node): el ultimo mensaje del asistente
# trae comillas, markdown y saltos de linea, y parsear eso con sed es donde esta casa ya
# se comio verdes falsos. Ocho cosas mide; las cinco primeras, en el orden en que se miran:
#   1. el turno termina pidiendo permiso para hacer mi propio trabajo   -> exit 2
#   2. entregue algo afuera del repo y el cierre no dice la RUTA          -> exit 2
#   6. termina anunciando trabajo ("Sigo con eso.") y no corre nada que lo espere -> exit 2
#   7. Fak pidio que se lo explique ("no entiendo", "faicl de entender") y el turno no cargo el
#      skill explicar-mejor ni mostro un dibujo o una pagina (02/10/2026)  -> exit 2
#   8. el mensaje dice que no tengo acceso a los mails de un companero ("el correo de Carlos no lo puedo
#      leer, solo tengo acceso al tuyo") y el turno no miro la nube del equipo (_mails.py --buscar/--buzones)
#      (07/10/2026: los mails de Carlos y de la PC de Marcelo ya estan en la nube de Ingenieria)  -> exit 2
#   3. declaro un cierre ("listo", "pusheado") con pendientes medibles   -> exit 2, 1x/20 min por sesion
#      (entre ellos: una pieza del sistema sin probar con un mensaje real, regla mejora-implementada.md)
#   (y dos mas: entregable sin abrir y cierre-informe —
#    la lista completa y su medicion estan en la cabecera de cierreGuard.mjs)
# Con stop_hook_active=true (segundo Stop del mismo turno) siempre deja pasar: sin loops.
#
# exit 0 = el turno termina · exit 2 = el stderr vuelve a Claude y el turno sigue.
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="${RAIZ}/scripts/_lib/cierreGuard.mjs"

# Si falta node o el script, se deja pasar: un guardian que rompe el cierre de cada turno
# porque no arranca es el que se termina desactivando entero.
command -v node >/dev/null 2>&1 || exit 0
[ -f "$GUARD" ] || exit 0

# MEDICION (10/10/2026, plan P9 commit C0: docs/PLAN_P9_P10_HOOKS_INCREMENTAL_2026-10-10.md §6.4). Solo mide: no
# cambia ninguna decision ni el codigo de salida. Antes de node deja un renglon de INICIO y al volver uno de FIN en
# <tmp>/claude-hooks-tiempos.jsonl; un inicio sin su fin es una corrida que la app corto por el tope. Sin procesos
# extra (el reloj es $EPOCHREALTIME de bash y printf es interno); si el registro no se puede escribir, no dice nada.
# Adentro de node, scripts/_lib/hooksTiempos.mjs anota el tiempo de cada fase con el mismo id.
# Lector: node scripts/_hooksTiempos.mjs · Test: __tests__/scripts/hooksTiempos.test.mjs
REG="${CLAUDE_HOOKS_TIEMPOS:-${TMPDIR:-${TEMP:-/tmp}}/claude-hooks-tiempos.jsonl}"
# Una PRUEBA que lanza este hook no es una corrida real y no va al registro de verdad: adentro de vitest (VITEST) y
# sin un archivo propio, la medicion queda apagada; `_probarMejora.mjs` la apaga con CLAUDE_HOOKS_TIEMPOS=off.
[ -n "${VITEST:-}" ] && [ -z "${CLAUDE_HOOKS_TIEMPOS:-}" ] && REG=off
US="${EPOCHREALTIME:-}"; US="${US//[^0-9]/}"       # microsegundos, sin el separador decimal (punto o coma)
if [ "$REG" = "off" ] || [ "$REG" = "OFF" ] || [ "${#US}" -lt 10 ]; then   # apagada, o un bash sin ese reloj: como siempre, sin medir
  CLAUDE_HOOKS_TIEMPOS=off node "$GUARD"
  exit $?
fi
T0="${US%???}"                                     # milisegundos
ID="$$.${US}"
# (entre llaves: si el registro no se puede abrir, la queja de bash tampoco sale; no puede ensuciar el aviso del cierre)
{ printf '{"ev":"inicio","hook":"cierre-guard","id":"%s","t":%s}\n' "$ID" "$T0" >> "$REG"; } 2>/dev/null
CLAUDE_HOOKS_TIEMPOS="$REG" CLAUDE_HOOKS_TIEMPOS_ID="$ID" CLAUDE_HOOKS_TIEMPOS_T0="$T0" node "$GUARD"
RC=$?
US="${EPOCHREALTIME//[^0-9]/}"; T1="${US%???}"
{ printf '{"ev":"fin","hook":"cierre-guard","id":"%s","t":%s,"rc":%s,"ms":%s}\n' "$ID" "$T1" "$RC" "$((T1 - T0))" >> "$REG"; } 2>/dev/null
exit "$RC"
