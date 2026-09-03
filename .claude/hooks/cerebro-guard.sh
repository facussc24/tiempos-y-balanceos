#!/usr/bin/env bash
# cerebro-guard.sh — detecta si ESTA PC tiene el cerebro (memorias + config) y, si no,
# le ordena a la sesion que lo baje de OneDrive antes de trabajar.
#
# POR QUE EXISTE
#   Al clonar el repo en una PC nueva llega el codigo, las reglas del proyecto y los
#   hooks — pero NO las memorias ni la config global de Claude, que a proposito no van
#   a GitHub (repo publico). Sin eso la sesion arranca de cero: no sabe como trabaja
#   Fak, no tiene .env.local y no puede leer Supabase.
#
#   Fak no tiene por que acordarse de explicar el procedimiento cada vez. Este hook lo
#   detecta solo y deja la instruccion en el contexto de la sesion, que la ejecuta.
#
# LO IMPORTANTE: `scripts/_nube.mjs` solo usa modulos nativos de Node, asi que la
# bajada funciona ANTES de `npm install`. El bootstrap no depende de nada instalado.
#
# Salida por stdout (SessionStart la agrega al contexto). Exit 0 siempre: este hook
# informa, no bloquea — una PC sin OneDrive todavia tiene que poder abrir el repo.

set -uo pipefail

# ${HOME:-} y no $HOME: con set -u, un HOME sin definir aborta el hook con "unbound
# variable" en vez de informar. No pasa en un shell normal, pero la promesa de este
# archivo es que nunca rompe el arranque de la sesion.
CASA="${HOME:-}"
MEMORIA="$CASA/.claude/projects/C--Dev-BarackMercosul/memory"
MINIMO_MEMORIAS=20   # por debajo de esto la PC no tiene cerebro util, no es "faltan algunas"

# La carpeta del OneDrive corporativo trae el nombre del tenant y el usuario cambia
# segun la PC: se busca con glob, nunca hardcodeada.
nube_path() {
  local d
  for d in "$HOME"/OneDrive*BARACK*/Barack-cerebro; do
    [ -d "$d" ] && { echo "$d"; return 0; }
  done
  return 1
}

cantidad_memorias() {
  [ -d "$MEMORIA" ] || { echo 0; return; }
  find "$MEMORIA" -maxdepth 1 -name '*.md' -type f 2>/dev/null | wc -l | tr -d ' '
}

CANT=$(cantidad_memorias)
NUBE=$(nube_path || true)

# ─────────────────────────────────────────────────────────────────────────────
# CASO 1 — PC sin cerebro. Es lo que pasa recien clonado el repo.
# ─────────────────────────────────────────────────────────────────────────────
if [ "$CANT" -lt "$MINIMO_MEMORIAS" ]; then
  echo "[PC NUEVA DETECTADA — hook cerebro-guard]"
  echo ""
  echo "Esta PC tiene el codigo pero NO tiene el cerebro: hay $CANT memorias en"
  echo "$MEMORIA (deberia haber cientos). Sin eso esta sesion no sabe como trabaja Fak,"
  echo "no tiene las reglas globales y le falta .env.local para leer Supabase."

  if [ -n "$NUBE" ]; then
    echo ""
    echo "HACER ESTO AHORA, ANTES DE CUALQUIER OTRA COSA que haya pedido Fak:"
    echo ""
    echo "    node scripts/_nube.mjs --bajar --aplicar"
    echo ""
    echo "Se baja de: $NUBE"
    echo "Trae memorias, reglas/skills/hooks globales, .env.local, .qr-secret y los"
    echo "caches .sgc-cache y .arb-cache. Corre con Node pelado: NO hace falta npm install."
    echo ""
    echo "No preguntarle a Fak si lo hace: hacerlo, avisar en una linea que la PC era"
    echo "nueva y que se bajo el cerebro, y seguir con lo que pidio. Si el comando falla,"
    echo "reportar el error concreto — no seguir trabajando a ciegas."
  else
    echo ""
    echo "Ademas NO se encuentra la carpeta del cerebro en OneDrive. Buscada como"
    echo "\$HOME/OneDrive*BARACK*/Barack-cerebro"
    echo ""
    echo "Decirle a Fak, en una linea, que falta iniciar sesion en OneDrive con la cuenta"
    echo "de Barack y esperar a que sincronice; despues corre 'node scripts/_nube.mjs"
    echo "--bajar --aplicar'. Mientras tanto se puede trabajar, pero SIN memorias, SIN"
    echo "credenciales de Supabase y sin las reglas globales: avisarlo antes de afirmar"
    echo "cualquier cosa que dependa de datos."
  fi
  echo ""
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
# CASO 2 — Hay cerebro, pero OTRA PC subio despues. Aviso barato: se lee un JSON
# de ~120 bytes, no se recorre la carpeta (que suele estar deshidratada y leerla
# entera la baja de la nube).
# ─────────────────────────────────────────────────────────────────────────────
[ -n "$NUBE" ] || exit 0
ESTADO="$NUBE/_ESTADO.json"
[ -f "$ESTADO" ] || exit 0

PC_NUBE=$(sed -n 's/.*"pc"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$ESTADO" | head -1)
FECHA_NUBE=$(sed -n 's/.*"fecha"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$ESTADO" | head -1)
ESTA_PC="${COMPUTERNAME:-$(hostname 2>/dev/null || echo desconocida)}"

if [ -n "$PC_NUBE" ] && [ "$PC_NUBE" != "$ESTA_PC" ]; then
  # La ultima subida vino de otra PC. Solo avisar si ademas es mas nueva que lo local.
  TS_NUBE=$(date -d "$FECHA_NUBE" +%s 2>/dev/null || echo 0)
  TS_LOCAL=$(find "$MEMORIA" -maxdepth 1 -name '*.md' -type f -printf '%T@\n' 2>/dev/null \
             | sort -rn | head -1 | cut -d. -f1)
  TS_LOCAL="${TS_LOCAL:-0}"
  if [ "$TS_NUBE" -gt "$TS_LOCAL" ]; then
    echo "[CEREBRO DESACTUALIZADO — hook cerebro-guard]"
    echo "La ultima subida a la nube la hizo '$PC_NUBE' el $FECHA_NUBE, despues del"
    echo "ultimo cambio local. Correr ANTES de trabajar, para no pisar lo de la otra PC:"
    echo ""
    echo "    node scripts/_nube.mjs --bajar --aplicar"
    echo ""
    echo "(--bajar nunca borra nada local, solo trae lo que falta o es mas nuevo.)"
    echo ""
  fi
fi

exit 0
