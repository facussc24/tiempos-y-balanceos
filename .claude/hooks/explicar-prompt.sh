#!/usr/bin/env bash
# explicar-prompt.sh — wrapper fino. La logica vive en scripts/_lib/explicarGuard.mjs y las palabras en
# scripts/_lib/explicarCanon.data.json. NO bloquea nunca: solo agrega contexto.
#
# UserPromptSubmit, matcher vacio. Con cada mensaje de Fak:
#   - si dice que no entendio ("no entiendo", "noe nteidno", "no te entendi un carajo"), pide que se lo expliquen
#     ("explicame mejor", "explica bien facil") o pide que sea facil de entender ("faicl de entender", "facil
#     denentende ry"), le recuerda a Claude el skill `explicar-mejor`: cargarlo, no repetir lo mismo mas largo,
#     cambiar la forma (texto corto -> dibujo -> pagina). Si ademas pide el ESTADO de una tarea o proyecto, dice
#     que va la pagina (escalon 3);
#   - si pide corto ("sintetiza", "mucho texto", "no voy a leer todo eso"), le recuerda responder en 1 a 4 renglones.
# "entendes?" y "entendiste?" son muletilla: no disparan. Un mensaje que llega con un aviso de la app adelante
# (<system-reminder>...) es de Fak igual: hasta el 02/10/2026 a la tarde ese mensaje no recibia nada.
# Que el skill se cargo de verdad lo mide el cierre del turno: cierre-guard.sh, chequeo 7.
#
# Por que: en 64 de 257 sesiones Fak escribio que no entendia y la respuesta habitual era lo mismo con mas
# detalle. Pedido del 02/10/2026, despues de probar la escalera del post de Karpathy: "aplicarlo permanente para
# cuando alguien quiere y pide una mejor explicacion o nota que no entiende".
# Test: __tests__/scripts/explicarGuard.test.mjs · node scripts/_lib/explicarGuard.mjs --selftest
#
#   printf '%s' "$JSON" | bash .claude/hooks/explicar-prompt.sh   # exit 0 siempre
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
node "$RAIZ/scripts/_lib/explicarGuard.mjs" --hook
exit 0
