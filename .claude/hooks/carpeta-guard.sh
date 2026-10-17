#!/usr/bin/env bash
# carpeta-guard.sh — hook GLOBAL (~/.claude/hooks; copia identica en .claude/hooks del repo): la sesion no esta en la
# carpeta del proyecto. SessionStart y el PRIMER mensaje de cada sesion.
#
# Fak, 16/10/2026 10:55: «ni yo se que carpeta debo elegir, ¿Barack Mercosul? Si Claude detecta que estoy en la carpeta
# incorrecta me puede avisar, es muy importante». Medido ese dia: las 8 sesiones de la notebook de Calidad (CATA) abrieron
# en C:\Dev, y ahi no cargan los hooks, las reglas, las skills ni la memoria de la casa (todo cuelga de
# C:\Dev\BarackMercosul). La respuesta a «¿que carpeta elijo?» es siempre esa, en las tres PC. Tanda 1.7.
#
# Que hace: si la carpeta de la sesion (cwd del JSON) es una de las que se eligen POR ERROR en vez del repo —una carpeta
# de arriba del repo (C:\, C:\Dev), la carpeta de usuario, u otra carpeta con «barack» en el nombre (otro clon, el
# asistente por area)— y el repo EXISTE en esta PC, imprime un renglon; en el repo, en un worktree adentro, o en una
# carpeta que Fak abre a proposito (estudio, kits, otras cosas suyas) calla (auditor 16/10, H4). Con «prompt», ademas,
# cuando el mensaje pregunta por la carpeta contesta aunque la sesion este bien. Siempre sale con 0: avisa, no frena.
#
# Uso (cableado en ~/.claude/settings.json; tools/instalar_mi_pc/ajustar_settings.mjs lo cablea en las notebooks):
#   carpeta-guard.sh inicio   -> SessionStart (matcher startup|resume|clear|compact)
#   carpeta-guard.sh prompt   -> UserPromptSubmit: solo el PRIMER mensaje de la sesion (marca en
#                                ~/.claude/.carpeta-guard/<session_id>) o un mensaje que pregunta por la carpeta.
# Velocidad: solo builtins de bash (sin node, sin grep, sin date): corre en cada arranque y cada mensaje de TODA sesion
# de la PC. Pruebas: BARACK_REPO apunta la carpeta «correcta» a otra y HOME a una carpeta de prueba.
# Limites conocidos: las marcas de ~/.claude/.carpeta-guard/ (un archivo vacio por sesion) no se limpian; la pregunta
# por la carpeta se reconoce por palabras (puede saltar de mas en un mensaje que no es de Fak: un aviso de la app que
# habla de carpetas); _probarMejora.mjs no corre hooks globales, la prueba con el mensaje real de Fak esta en el test.
# Test: __tests__/scripts/carpetaGuard.test.mjs.
PAYLOAD="$(cat 2>/dev/null)"
MODE="${1:-inicio}"
REPO="${BARACK_REPO:-C:/Dev/BarackMercosul}"

# campo <nombre>: el valor de "nombre":"..." del JSON, con sus escapes crudos (\\ sigue siendo \\).
campo() {
  local re="\"$1\"[[:space:]]*:[[:space:]]*\"(([^\"\\\\]|\\\\.)*)\""
  if [[ "$PAYLOAD" =~ $re ]]; then printf '%s' "${BASH_REMATCH[1]}"; fi
}
# normalizar <ruta>: barras normales, sin barra final, minusculas, y /c/x -> c:/x (la forma de Git Bash).
normalizar() {
  local p="$1"
  p="${p//\\\\//}"; p="${p//\\//}"; p="${p%/}"; p="${p,,}"
  if [[ "$p" =~ ^/([a-z])(/.*)?$ ]]; then p="${BASH_REMATCH[1]}:${BASH_REMATCH[2]}"; fi
  printf '%s' "$p"
}

cwd="$(campo cwd)"
[ -z "$cwd" ] && exit 0            # sin carpeta no hay nada que juzgar
cwdl="$(normalizar "$cwd")"
repol="$(normalizar "$REPO")"
homel="$(normalizar "${HOME:-}")"
repo_win="${repol//\//\\}"

en_repo=0
if [ "$cwdl" = "$repol" ] || [[ "$cwdl" == "$repol/"* ]]; then en_repo=1; fi
# Las carpetas que se eligen por error: una de arriba del repo (C:\, C:\Dev), la de usuario, u otra con «barack».
por_error=0
if [ "$en_repo" = 0 ]; then
  if [[ "$repol" == "$cwdl/"* ]] || { [ -n "$homel" ] && [ "$cwdl" = "$homel" ]; } || [[ "$cwdl" == *barack* ]]; then por_error=1; fi
fi

pregunta=0
if [ "$MODE" = "prompt" ]; then
  prompt="$(campo prompt)"; promptl="${prompt,,}"
  # Un aviso de la app o de otra sesion no es una pregunta de Fak (empieza con <, [ o «From »).
  case "$promptl" in
    "<"*|"["*|"from "*) ;;
    *carpeta*)
      # «qué» y «cuál» con tilde son dos bytes en UTF-8 y bash puede verlos como un caracter o como dos: qu./qu.. y cu.l/cu..l.
      if [[ "$promptl" =~ (que|qu.|qu..|cual|cu.l|cu..l)[^.?!]{0,40}carpeta[^.?!]{0,40}(eleg|elij|abr[io]|abrir|debo|tengo que|hay que) ]] \
         || [[ "$promptl" =~ carpeta[^.?!]{0,30}(incorrecta|equivocada|correcta) ]]; then pregunta=1; fi ;;
  esac
  sid="$(campo session_id)"; sid="${sid//[^A-Za-z0-9_.-]/}"; sid="${sid:0:64}"
  primero=0
  if [ -n "$sid" ]; then
    dir="${HOME:-.}/.claude/.carpeta-guard"
    if [ ! -e "$dir/$sid" ]; then
      primero=1
      mkdir -p "$dir" 2>/dev/null && : > "$dir/$sid" 2>/dev/null
    fi
  fi
  if [ "$primero" = 0 ] && [ "$pregunta" = 0 ]; then exit 0; fi
fi

if [ "$por_error" = 1 ] && [ -d "$repol" ]; then
  cwd_win="${cwdl//\//\\}"
  printf '[CARPETA] Esta sesion esta en «%s» y la carpeta del proyecto es %s: sin ella no cargan los hooks, las reglas, las skills ni la memoria de la casa. Deciselo a Fak en un renglon: cerrar esta sesion y abrirla en esa carpeta (en el selector de carpeta de la app, la destacada, Alt+1).\n' "$cwd_win" "$repo_win"
fi
if [ "$pregunta" = 1 ]; then
  printf '[CARPETA] Si Fak pregunta que carpeta elegir o abrir: siempre %s, en las tres PC (la destacada del selector, Alt+1); una sesion en otra carpeta no carga nada de la casa.\n' "$repo_win"
fi
exit 0
