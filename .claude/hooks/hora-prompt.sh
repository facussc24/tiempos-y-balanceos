#!/usr/bin/env bash
# hora-prompt.sh — wrapper fino. La logica vive en scripts/_lib/horaGuard.mjs y las palabras en
# scripts/_lib/horaCanon.data.json. NO bloquea nunca: solo agrega contexto.
#
# UserPromptSubmit, matcher vacio. Con cada mensaje de Fak:
#   - si lo deja trabajando solo hasta una hora ("quedate laburando como minimo hasta esa hora", "labura hasta las 8",
#     "continua hasta manana a las 10am, hasta esa hora no pares", "ponete un cronometro"), le recuerda a Claude lo
#     que hay que armar ANTES de seguir: la lista en un archivo, fijar la hora (--fijar) y el latido (scripts/_latido.mjs en segundo plano);
#   - si ya hay una hora vigente, le recuerda que sigue vigente (o como terminarla si Fak dice que pare).
# Que no se cierre antes de la hora lo mide el cierre del turno: hora-guard.sh.
#
# Por que: el 03/10/2026 Fak se fue con "quedate laburando hasta las 8"; Claude cerro a las 17:10 con un resumen y
# quedo parado seis horas ("no te quedaste hasta las 8, decime por que, defendete"). Una sesion no sigue sola.
# Test: __tests__/scripts/horaGuard.test.mjs
#
#   printf '%s' "$JSON" | bash .claude/hooks/hora-prompt.sh   # exit 0 siempre
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
node "$RAIZ/scripts/_lib/horaGuard.mjs" --hook
exit 0
