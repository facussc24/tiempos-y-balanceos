#!/usr/bin/env bash
# correccion-guard.sh — wrapper fino. La logica vive en scripts/_lib/correccionGuard.mjs y las palabras en
# scripts/_lib/correccionCanon.data.json. NO bloquea nunca: solo agrega contexto.
#
# UserPromptSubmit, matcher vacio. Con cada mensaje de Fak:
#   - lee del transcript (solo el tramo nuevo) lo que se le entrego con SendUserFile y lo cuenta por carpeta;
#   - si Fak corrige por 2a vez dentro de la misma tanda, o ya recibio 2 versiones de la misma carpeta y sigue
#     objetando, le devuelve a Claude el PEDIDO ORIGINAL textual y le exige contrastar el entregable contra el.
#
# Por que: 01/10/2026, fotos de las prensas Hot Press. El primer mensaje ya decia todo y se entregaron tres cosas
# distintas respondiendo solo a la ultima correccion. Medido: en 15 de 54 sesiones con entregas, lo mismo volvio
# 3 veces o mas. Test: __tests__/scripts/correccionGuard.test.mjs · node scripts/_lib/correccionGuard.mjs --selftest
#
#   printf '%s' "$JSON" | bash .claude/hooks/correccion-guard.sh   # exit 0 siempre
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
node "$RAIZ/scripts/_lib/correccionGuard.mjs" --hook
exit 0
