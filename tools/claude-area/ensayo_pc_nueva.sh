#!/usr/bin/env bash
# Ensayo de PC NUEVA, sin tocar nada real: arma lo publicado, lo copia a un "pendrive" y lo instala en una "PC" que no
# tiene Node ni Git en el PATH, no ve la nube de Barack y cuyo usuario no esta en la lista de personas. Despues arranca
# la PRIMERA conversacion con el mismo programa que usa la app de Claude (sin cuenta: alcanza para ver si el asistente
# se carga y si corre el aviso de arranque) y dice que paso. Despues publica una version 2 en la carpeta del pendrive y
# comprueba que la PC la ve y se actualiza sola, sin que nadie le diga donde esta la nube (la PC recuerda de que
# carpeta se instalo: <estado>\origen.json).
#
# Uso:  bash tools/claude-area/ensayo_pc_nueva.sh [area] [--dejar] [--paquete <carpeta "CLAUDE POR AREA" ya publicada>]
#       area: la que "dice la persona" al instalar (por defecto Produccion). --dejar: no borra la carpeta temporal.
#       --paquete: en vez de publicar con una clave temporal, ensaya ESE paquete (el que va al pendrive); solo lo lee.
#                  Con --paquete el paso de la version 2 se saltea: no esta la clave que lo firmo.
# Todo corre en una carpeta temporal: ni C:\ClaudeBarack, ni ~/.claude/settings.json, ni la nube real, ni el estado real
# de la PC; y no registra ninguna tarea de Windows (con carpetas de prueba el instalador no la deja).
# Sale con 0 si las ocho comprobaciones dan bien (siete con --paquete); con 1 si alguna no.
set -u
PLUGIN_REPO='C:\Dev\barack-claude'
AREA="Producción"; DEJAR=""; PAQUETE=""; SIG=""
for a in "$@"; do
  if [ "$SIG" = paquete ]; then PAQUETE="$a"; SIG=""; continue; fi
  case "$a" in --dejar) DEJAR=1 ;; --paquete) SIG=paquete ;; *) AREA="$a" ;; esac
done
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$RAIZ"
TP="$(mktemp -d)"; T="$(cygpath -w "$TP")"
REAL="$(sha256sum ~/.claude/settings.json 2>/dev/null | cut -c1-16)"
DEMO="$(sha256sum /c/ClaudeBarack/instalado.json 2>/dev/null | cut -c1-16)"
# el estado real de la PC y la tarea de Windows: este ensayo no los puede tocar (se miran antes y despues)
ESTADO_REAL="$(cygpath -u "${LOCALAPPDATA:-$HOME/AppData/Local}")/BarackEquipo"
hay_tarea() { powershell.exe -NoProfile -Command "if (Get-ScheduledTask -TaskName 'Barack - Claude por area' -ErrorAction SilentlyContinue) { 'EXISTE' } else { 'NO_EXISTE' }" 2>/dev/null | tr -d '\r'; }
ORIGEN_REAL="$(sha256sum "$ESTADO_REAL/origen.json" 2>/dev/null | cut -c1-16)"
TAREA_REAL="$(hay_tarea)"
FALLAS=0; TOTAL=0
bien() { echo "   BIEN  $1"; TOTAL=$((TOTAL + 1)); }
mal()  { echo "   MAL   $1"; TOTAL=$((TOTAL + 1)); FALLAS=$((FALLAS + 1)); }

mkdir -p "$TP/nube/CLAUDE POR AREA" "$TP/pendrive" "$TP/clave" "$TP/pc/estado" "$TP/pc/usuario" "$TP/pc/perfil-windows" "$TP/pc/localappdata"
if [ -n "$PAQUETE" ]; then
  echo "== 1. copiar al pendrive el paquete ya publicado: $PAQUETE"
  ORIGEN="$(cygpath -u "$PAQUETE")"
  [ -f "$ORIGEN/1- PUBLICADO/VERSION.json" ] || { echo "   ese paquete no trae «1- PUBLICADO\\VERSION.json»"; exit 1; }
  HUELLA_ANTES="$(find "$ORIGEN" -type f -printf '%P %s\n' | sort | sha256sum | cut -c1-16)"
  cp -r "$ORIGEN" "$TP/pendrive/CLAUDE POR AREA"
  echo "      versión $(grep -o '"version": [0-9]*' "$ORIGEN/1- PUBLICADO/VERSION.json" | grep -o '[0-9]*'), clave $(grep -o '"clave": "[0-9a-f]*"' "$ORIGEN/1- PUBLICADO/VERSION.json" | cut -d'"' -f4)"
else
  echo "== 1. publicar (clave temporal) y copiar al pendrive"
  CLAUDE_AREA_CLAVE="$T\\clave\\publicador.key" node scripts/_paquete.mjs --generar-clave >/dev/null 2>&1
  CLAUDE_AREA_NUBE="$T\\nube\\CLAUDE POR AREA" CLAUDE_AREA_CLAVE="$T\\clave\\publicador.key" \
    node tools/claude-area/armar_publicable.mjs --plugin-repo "$PLUGIN_REPO" --salida "$T\\armado1" --publicar --nota "ensayo de PC nueva" 2>&1 | tail -1 | cut -c1-160
  cp -r "$TP/nube/CLAUDE POR AREA" "$TP/pendrive/"
fi
PEN="$TP/pendrive/CLAUDE POR AREA/1- PUBLICADO"
[ -f "$PEN/Instalar.cmd" ] && [ -f "$PEN/CLAUDE.md" ] && [ -f "$PEN/publicador.pub" ] && bien "el pendrive trae Instalar.cmd, el CLAUDE.md del «instalá» y la clave pública" || mal "al pendrive le falta Instalar.cmd, CLAUDE.md o publicador.pub"

echo "== 2. instalar desde el pendrive, con SU Node, sin Node ni Git en el PATH y sin la nube a la vista"
SYS="$(cygpath -u "${SYSTEMROOT:-C:\\Windows}")"
INICIO=$(date +%s)
SALIDA="$(env -i SYSTEMROOT="${SYSTEMROOT:-C:\\Windows}" TEMP="$T" TMP="$T" PATH="$SYS/System32:$SYS" \
  USERPROFILE="$T\\pc\\perfil-windows" LOCALAPPDATA="$T\\pc\\localappdata" COMPUTERNAME="PC-PLANTA-01" \
  CLAUDE_AREA_HOME="$T\\pc\\ClaudeBarack" CLAUDE_AREA_ESTADO="$T\\pc\\estado" \
  "$PEN/contenido/marketplace/plugins/barack-area/bin/node.exe" "$(cygpath -w "$PEN/contenido/programas/_paquete.mjs")" \
  --instalar --proyecto area --usuario-home "$T\\pc\\usuario" --area "$AREA" --nombre "Persona De Prueba" --puesto "Puesto de prueba" 2>&1)"
COD=$?
SEG=$(( $(date +%s) - INICIO ))
echo "$SALIDA" | head -4 | cut -c1-200 | sed 's/^/      /'
[ "$COD" = 0 ] && echo "$SALIDA" | grep -q "Instalado desde esta carpeta" && bien "instaló desde la carpeta del pendrive en $SEG s (código 0)" || mal "la instalación desde el pendrive salió con código $COD"
grep -q '"declarado": true' "$TP/pc/ClaudeBarack/perfil.json" 2>/dev/null && [ -d "$TP/pc/ClaudeBarack/publicado/conocimiento/comun" ] && [ "$(ls "$TP/pc/ClaudeBarack/publicado/conocimiento" | wc -l)" = 2 ] \
  && bien "perfil con el área que dijo la persona; conocimiento: $(ls "$TP/pc/ClaudeBarack/publicado/conocimiento" | tr '\n' ' ')" || mal "el perfil o el conocimiento no quedaron como dijo la persona"

echo "== 3. la PRIMERA conversación, con el programa de la app (sin cuenta), configuración de Claude recién creada"
BIN="$(ls -t "$APPDATA"/Claude/claude-code/*/*/claude.exe 2>/dev/null | head -1)"
[ -n "$BIN" ] || BIN="$(command -v claude)"
ESPERA="$(command -v timeout)"   # el de Git Bash: con el PATH recortado, "timeout" seria el de Windows
echo "      programa: $("$BIN" --version 2>/dev/null | head -1)"
( cd "$TP/pc/ClaudeBarack" && env PATH="$SYS/System32:$SYS:$SYS/System32/WindowsPowerShell/v1.0" CLAUDE_CONFIG_DIR="$T\\pc\\usuario" \
    CLAUDE_AREA_HOME="$T\\pc\\ClaudeBarack" CLAUDE_AREA_ESTADO="$T\\pc\\estado" \
    "$ESPERA" 120 "$BIN" -p "hola" --output-format stream-json --verbose < /dev/null > "$TP/sesion1.jsonl" 2> "$TP/sesion1.err" )
node -e '
const fs=require("fs");const L=fs.readFileSync(process.argv[1],"utf8").split(/\r?\n/).filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean);
const init=L.find(d=>d.type==="system"&&d.subtype==="init");const hook=L.find(d=>d.subtype==="hook_response"&&d.hook_event==="SessionStart");
const p=init&&(init.plugins||[]).find(x=>x.name==="barack-area");
console.log("PLUGIN="+(p?p.version+" desde "+p.path:"NO"));
console.log("SKILLS="+((init&&init.skills)||[]).filter(s=>s.startsWith("barack-area:")).length);
console.log("QUIEN="+(hook?String(hook.output).split("\n")[1]||"":"NO CORRIO"));
console.log("MODO="+((init&&init.permissionMode)||"?"));
' "$(cygpath -w "$TP/sesion1.jsonl")" > "$TP/sesion1.txt"
sed 's/^/      /' "$TP/sesion1.txt" | cut -c1-230
grep -q "^PLUGIN=[0-9]" "$TP/sesion1.txt" && bien "el asistente se cargó solo en la primera conversación" || mal "el asistente NO se cargó en la primera conversación"
grep -q "^QUIEN=Quién es: Persona De Prueba" "$TP/sesion1.txt" && bien "el aviso de arranque corrió con el Node del plugin y sabe quién es" || mal "el aviso de arranque no corrió o no sabe quién es"
# el modo de permisos que dejo el instalador en la configuracion de la PC (en la app hace falta, ademas, prender una vez
# la opcion que permite ese modo: eso este ensayo no lo ve)
grep -q "^MODO=bypassPermissions" "$TP/sesion1.txt" && bien "la conversación arranca en «Omitir permisos», sin carteles" || mal "la conversación NO arranca en «Omitir permisos»: $(grep '^MODO=' "$TP/sesion1.txt")"

if [ -n "$PAQUETE" ]; then
  echo "== 4. una versión nueva en el pendrive: SALTEADO (con --paquete no se puede publicar otra versión: no está la clave que lo firmó)"
else
  echo "== 4. sale la versión 2 en el pendrive: la PC la ve y se actualiza sola, sin que nadie le diga dónde está la nube"
  # la version 2 se publica en la MISMA carpeta del pendrive, con un archivo de conocimiento cambiado en una copia temporal
  cp -r "$(cygpath -u "$PLUGIN_REPO")/conocimiento" "$TP/conocimiento2"
  CAMBIADO="$(cd "$TP/conocimiento2/comun" 2>/dev/null && ls *.md 2>/dev/null | head -1)"
  [ -n "$CAMBIADO" ] || { CAMBIADO="ensayo.md"; mkdir -p "$TP/conocimiento2/comun"; }
  MARCA="Renglon del ensayo: esto llego con la version 2."
  printf '\n- %s\n' "$MARCA" >> "$TP/conocimiento2/comun/$CAMBIADO"
  CLAUDE_AREA_NUBE="$T\\pendrive\\CLAUDE POR AREA" CLAUDE_AREA_CLAVE="$T\\clave\\publicador.key" \
    node tools/claude-area/armar_publicable.mjs --plugin-repo "$PLUGIN_REPO" --conocimiento "$T\\conocimiento2" --salida "$T\\armado2" --publicar --nota "ensayo: version 2" 2>&1 | tail -1 | cut -c1-160
  # desde la copia INSTALADA, con su Node y las carpetas de prueba de la PC; la nube NO se le dice
  en_la_pc() {
    env -i SYSTEMROOT="${SYSTEMROOT:-C:\\Windows}" TEMP="$T" TMP="$T" PATH="$SYS/System32:$SYS" \
      USERPROFILE="$T\\pc\\perfil-windows" LOCALAPPDATA="$T\\pc\\localappdata" COMPUTERNAME="PC-PLANTA-01" \
      CLAUDE_AREA_HOME="$T\\pc\\ClaudeBarack" CLAUDE_AREA_ESTADO="$T\\pc\\estado" \
      "$TP/pc/ClaudeBarack/publicado/marketplace/plugins/barack-area/bin/node.exe" "$T\\pc\\ClaudeBarack\\publicado\\programas\\_paquete.mjs" "$@" 2>&1
  }
  CHEQUEO="$(en_la_pc --chequear --proyecto area)"; COD_CH=$?
  ACTUALIZO="$(en_la_pc --actualizar --proyecto area)"; COD_AC=$?
  echo "$CHEQUEO" | head -1 | cut -c1-200 | sed 's/^/      /'
  echo "$ACTUALIZO" | head -2 | cut -c1-200 | sed 's/^/      /'
  # y la tarea de la PC, tal como viaja en la copia instalada, en una PC SIN Node: corre con el Node del plugin (una
  # copia en el estado de la PC) y encuentra sola la carpeta recordada. No registra nada (-SinTarea) ni releva programas.
  env -u CLAUDE_AREA_HOME -u CLAUDE_AREA_NUBE -u CLAUDE_AREA_ESTADO PATH="$SYS/System32:$SYS:$SYS/System32/WindowsPowerShell/v1.0" \
    USERPROFILE="$T\\pc\\perfil-windows" LOCALAPPDATA="$T\\pc\\localappdata" COMPUTERNAME="PC-PLANTA-01" \
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$T\\pc\\ClaudeBarack\\publicado\\programas\\sync_area.ps1" \
    -HomeDir "$T\\pc\\ClaudeBarack" -EstadoDir "$T\\pc\\estado" -SinTarea -SinInventario > "$TP/tarea.txt" 2>&1 < /dev/null
  COD_TA=$?
  TAREA="$(node -e 'try{const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8").replace(/^﻿/,""));console.log([s.actualizar&&s.actualizar.resultado,s.nube,(s.errores||[]).length].join("/"))}catch(e){console.log("sin estado.json")}' "$(cygpath -w "$TP/pc/estado/estado.json")")"
  echo "      la tarea, sin Node en la PC: $TAREA (código $COD_TA)"
  [ "$COD_CH" = 2 ] && echo "$CHEQUEO" | grep -q '"estado":"hay_novedades"' && echo "$CHEQUEO" | grep -q '"publicada":2' \
    && [ "$COD_AC" = 0 ] && grep -q '^  "version": 2' "$TP/pc/ClaudeBarack/publicado/.claude/.paquete-instalado.json" 2>/dev/null \
    && grep -qF "$MARCA" "$TP/pc/ClaudeBarack/publicado/conocimiento/comun/$CAMBIADO" 2>/dev/null \
    && [ "$COD_TA" = 0 ] && [ "$TAREA" = "ok/recordada/0" ] && [ -f "$TP/pc/estado/node/node.exe" ] \
    && bien "la PC vio la versión 2 en la carpeta de donde se instaló (chequeo: hay novedades) y se actualizó sola a la 2 ($CAMBIADO llegó cambiado); la tarea corre con el Node del plugin" \
    || mal "la PC no vio o no bajó la versión 2 de la carpeta de donde se instaló (chequeo: código $COD_CH; actualizar: código $COD_AC; la tarea: $TAREA, código $COD_TA)"
fi

echo "== 5. nada real cambió"
[ "$REAL" = "$(sha256sum ~/.claude/settings.json 2>/dev/null | cut -c1-16)" ] && [ "$DEMO" = "$(sha256sum /c/ClaudeBarack/instalado.json 2>/dev/null | cut -c1-16)" ] \
  && [ "$ORIGEN_REAL" = "$(sha256sum "$ESTADO_REAL/origen.json" 2>/dev/null | cut -c1-16)" ] && [ "$TAREA_REAL" = "$(hay_tarea)" ] \
  && bien "la configuración real de Claude, C:\\ClaudeBarack y el estado real de la PC siguen igual, y no se registró ninguna tarea de Windows" || mal "cambió la configuración real, C:\\ClaudeBarack, el estado real de la PC o la tarea de Windows"
if [ -n "$PAQUETE" ]; then
  [ "$HUELLA_ANTES" = "$(find "$ORIGEN" -type f -printf '%P %s\n' | sort | sha256sum | cut -c1-16)" ] && echo "   el paquete ensayado quedó igual (solo se leyó)" || mal "el paquete ensayado cambió"
fi

if [ -n "$DEJAR" ]; then echo "   (queda la carpeta: $T)"; else case "$TP" in /tmp/tmp.*) rm -rf "$TP" && echo "   carpeta temporal sacada" ;; esac; fi
echo "== RESULTADO: $([ "$FALLAS" = 0 ] && echo "todo bien ($TOTAL de $TOTAL)" || echo "$FALLAS comprobación(es) MAL de $TOTAL")"
[ "$FALLAS" = 0 ]
