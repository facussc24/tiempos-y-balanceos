#!/usr/bin/env bash
# explicar-prompt.sh — wrapper fino. La logica vive en scripts/_lib/explicarGuard.mjs y las palabras en
# scripts/_lib/explicarCanon.data.json. NO bloquea nunca: solo agrega contexto.
#
# UserPromptSubmit, matcher vacio. Con cada mensaje de Fak:
#   - si dice que no entendio ("no entiendo", "noe nteidno", "no te entendi un carajo") o pide que se lo expliquen
#     ("explicame mejor", "explica bien facil"), le recuerda a Claude el skill `explicar-mejor`: no repetir lo mismo
#     mas largo, cambiar la forma (texto corto -> dibujo -> pagina);
#   - si pide corto ("sintetiza", "mucho texto", "no voy a leer todo eso"), le recuerda responder en 1 a 4 renglones.
# "entendes?" y "entendiste?" son muletilla: no disparan.
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
