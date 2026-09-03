#!/usr/bin/env bash
# Regresion de cerebro-guard.sh — el hook que detecta una PC sin el cerebro bajado.
#
# Este hook nunca bloquea (siempre exit 0): lo que se prueba es QUE DICE. Por eso los
# casos se afirman sobre el texto que inyecta al contexto, no sobre el exit code.
#
# Los dos primeros son EL caso de uso: PC recien clonada. Si esos fallan, la otra PC
# arranca muda y Fak tiene que acordarse de explicar el procedimiento a mano — que es
# exactamente lo que este hook existe para evitar.
# Los dos ultimos son la calibracion: un hook que grita en cada arranque se apaga solo.
#
#   bash .claude/hooks/cerebro-guard.test.sh
set -uo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
G="$PWD/.claude/hooks/cerebro-guard.sh"
ok=0; fail=0

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Arma un $HOME falso. $1=cantidad de memorias  $2=carpeta nube si/no  $3=pc del _ESTADO
# $4=fecha del _ESTADO
armar() {
  local casa="$TMP/casa$RANDOM$RANDOM"
  local mem="$casa/.claude/projects/C--Dev-BarackMercosul/memory"
  mkdir -p "$mem"
  local i=0
  while [ "$i" -lt "$1" ]; do : > "$mem/memoria_$i.md"; i=$((i+1)); done
  if [ "$2" = "si" ]; then
    local nube="$casa/OneDrive - BARACK ARGENTINA SRL/Barack-cerebro"
    mkdir -p "$nube"
    printf '{\n  "fecha": "%s",\n  "pc": "%s"\n}\n' "$4" "$3" > "$nube/_ESTADO.json"
  fi
  echo "$casa"
}

probar() { # $1=patron esperado (o !patron para "no debe aparecer") $2=casa $3=pc actual $4=desc
  local salida patron="$1" negado=0
  case "$patron" in !*) negado=1; patron="${patron#!}";; esac
  salida=$(HOME="$2" COMPUTERNAME="$3" bash "$G" 2>&1)
  if [ "$negado" -eq 1 ]; then
    if ! printf '%s' "$salida" | grep -q -- "$patron"; then ok=$((ok+1)); printf '  ok    %s\n' "$4"
    else fail=$((fail+1)); printf '  FALLA %s  (no esperaba "%s")\n' "$4" "$patron"; fi
  else
    if printf '%s' "$salida" | grep -q -- "$patron"; then ok=$((ok+1)); printf '  ok    %s\n' "$4"
    else fail=$((fail+1)); printf '  FALLA %s  (esperaba "%s", dio: %s)\n' "$4" "$patron" "${salida:-<vacio>}"; fi
  fi
}

echo "PC NUEVA — el caso que justifica el hook:"
CASA=$(armar 0 si PC-VIEJA "2026-09-03 11:39")
probar 'PC NUEVA DETECTADA'                "$CASA" PC-NUEVA "cero memorias: avisa"
probar 'node scripts/_nube.mjs --bajar'    "$CASA" PC-NUEVA "cero memorias: da el comando exacto"
probar 'ANTES DE CUALQUIER OTRA COSA'      "$CASA" PC-NUEVA "cero memorias: lo marca prioritario"

CASA=$(armar 5 si PC-VIEJA "2026-09-03 11:39")
probar 'PC NUEVA DETECTADA'                "$CASA" PC-NUEVA "5 memorias sueltas siguen siendo PC sin cerebro"

echo
echo "PC NUEVA SIN ONEDRIVE — no puede bajar nada, tiene que decirlo:"
CASA=$(armar 0 no - -)
probar 'iniciar sesion en OneDrive'        "$CASA" PC-NUEVA "sin nube: manda iniciar sesion"
# El comando SI puede nombrarse (como paso posterior); lo que no debe hacer es
# ordenarlo YA, porque sin la carpeta montada falla y la sesion arranca en un error.
probar '!HACER ESTO AHORA'                 "$CASA" PC-NUEVA "sin nube: no lo ordena todavia"
probar 'despues corre'                     "$CASA" PC-NUEVA "sin nube: lo deja como paso siguiente"

echo
echo "CEREBRO DESACTUALIZADO — la otra PC subio despues:"
CASA=$(armar 300 si OTRA-PC "2099-01-01 00:00")
probar 'CEREBRO DESACTUALIZADO'            "$CASA" ESTA-PC "nube mas nueva y de otra PC: avisa"

echo
echo "CALIBRACION — si grita aca, alguien lo apaga:"
CASA=$(armar 300 si ESTA-PC "2099-01-01 00:00")
probar '!DESACTUALIZADO'                   "$CASA" ESTA-PC "la ultima subida es de ESTA PC: callado"

CASA=$(armar 300 si OTRA-PC "2000-01-01 00:00")
probar '!DESACTUALIZADO'                   "$CASA" ESTA-PC "nube vieja: callado"

CASA=$(armar 300 no - -)
probar '!PC NUEVA'                         "$CASA" ESTA-PC "cerebro OK sin OneDrive montado: callado"

echo
if [ "$fail" -gt 0 ]; then
  printf 'FALLARON %s de %s\n' "$fail" "$((ok+fail))"
  exit 1
fi
printf 'OK — %s casos\n' "$ok"
