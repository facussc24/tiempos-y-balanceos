#!/usr/bin/env bash
# pedidos-pendientes.sh — hook GLOBAL (~/.claude/hooks; copia identica en .claude/hooks del repo). SessionStart.
#
# Al arrancar, reanudar o compactar cualquier sesion de esta PC, lista los PEDIDO N que otra PC de Fak dejo en la
# carpeta FACUNDO de la nube de Ingenieria para ESTA PC y que todavia no tienen su «PEDIDO N - listo». Un renglon por
# pedido; nada si no hay nada. Tanda 1.7 del plan del sistema (16/10/2026): el 16/10 a las 10:55 la PC principal dijo
# «todavia no lo encuentro» con el PEDIDO 8 escrito desde las 09:56; Fak: «el Claude de mi PC principal no sabe como
# se comunican mis 2 notebooks».
#
# Por que es GLOBAL y no del repo: una sesion abierta en la carpeta equivocada (C:\Dev, como las 8 de CATA) no carga
# los hooks del repo; este corre igual. La logica (que PC soy, a quien va cada pedido, que cuenta como «listo») vive en
# el repo, scripts/_lib/pedidosPendientes.mjs, con su canon y su test: aca solo se ubica el repo y se la llama. El repo
# se busca primero en su lugar fijo (C:\Dev\BarackMercosul, el mismo en las tres PC) y recien despues en la carpeta de
# la sesion (auditor 16/10, H15). Si no hay repo, no hay node o la nube no esta: sale con 0 sin decir nada.
#
# Cableado en ~/.claude/settings.json (SessionStart, matcher startup|resume|clear|compact); tools/instalar_mi_pc/
# ajustar_settings.mjs lo cablea en las notebooks. Las pruebas apuntan el repo con BARACK_REPO y la carpeta con
# BARACK_FACUNDO (las lee el .mjs). Test: __tests__/scripts/pedidosPendientes.test.mjs.
PAYLOAD="$(cat 2>/dev/null)"

REPO=""
for c in "${BARACK_REPO:-}" "C:/Dev/BarackMercosul" "${HOME:-}/Dev/BarackMercosul" "${CLAUDE_PROJECT_DIR:-}"; do
  if [ -n "$c" ] && [ -f "$c/scripts/_lib/pedidosPendientes.mjs" ]; then REPO="$c"; break; fi
done
[ -z "$REPO" ] && exit 0
command -v node >/dev/null 2>&1 || exit 0

printf '%s' "$PAYLOAD" | node "$REPO/scripts/_lib/pedidosPendientes.mjs" --hook 2>/dev/null
exit 0
