#!/usr/bin/env bash
# Ensayo de PC NUEVA, sin tocar nada real: arma lo publicado, lo copia a un "pendrive" y lo instala en una "PC" que no
# tiene Node ni Git en el PATH, no ve la nube de Barack y cuyo usuario no esta en la lista de personas. Despues arranca
# la PRIMERA conversacion con el mismo programa que usa la app de Claude (sin cuenta: alcanza para ver si el asistente
# se carga y si corre el aviso de arranque) y dice que paso.
#
# Uso:  bash tools/claude-area/ensayo_pc_nueva.sh [area] [--dejar]
#       area: la que "dice la persona" al instalar (por defecto Produccion). --dejar: no borra la carpeta temporal.
# Todo corre en una carpeta temporal: ni C:\ClaudeBarack, ni ~/.claude/settings.json, ni la nube real.
# Sale con 0 si las seis comprobaciones dan bien; con 1 si alguna no.
set -u
AREA="Producción"; DEJAR=""
for a in "$@"; do case "$a" in --dejar) DEJAR=1 ;; *) AREA="$a" ;; esac; done
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$RAIZ"
TP="$(mktemp -d)"; T="$(cygpath -w "$TP")"
REAL="$(sha256sum ~/.claude/settings.json 2>/dev/null | cut -c1-16)"
DEMO="$(sha256sum /c/ClaudeBarack/instalado.json 2>/dev/null | cut -c1-16)"
FALLAS=0
bien() { echo "   BIEN  $1"; }
mal()  { echo "   MAL   $1"; FALLAS=$((FALLAS + 1)); }

echo "== 1. publicar (clave temporal) y copiar al pendrive"
mkdir -p "$TP/nube/CLAUDE POR AREA" "$TP/pendrive" "$TP/clave" "$TP/pc/estado" "$TP/pc/usuario" "$TP/pc/perfil-windows" "$TP/pc/localappdata"
CLAUDE_AREA_CLAVE="$T\\clave\\publicador.key" node scripts/_paquete.mjs --generar-clave >/dev/null 2>&1
CLAUDE_AREA_NUBE="$T\\nube\\CLAUDE POR AREA" CLAUDE_AREA_CLAVE="$T\\clave\\publicador.key" \
  node tools/claude-area/armar_publicable.mjs --plugin-repo 'C:\Dev\barack-claude' --publicar --nota "ensayo de PC nueva" 2>&1 | tail -1 | cut -c1-160
cp -r "$TP/nube/CLAUDE POR AREA" "$TP/pendrive/"
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
' "$(cygpath -w "$TP/sesion1.jsonl")" > "$TP/sesion1.txt"
sed 's/^/      /' "$TP/sesion1.txt" | cut -c1-230
grep -q "^PLUGIN=[0-9]" "$TP/sesion1.txt" && bien "el asistente se cargó solo en la primera conversación" || mal "el asistente NO se cargó en la primera conversación"
grep -q "^QUIEN=Quién es: Persona De Prueba" "$TP/sesion1.txt" && bien "el aviso de arranque corrió con el Node del plugin y sabe quién es" || mal "el aviso de arranque no corrió o no sabe quién es"

echo "== 4. nada real cambió"
[ "$REAL" = "$(sha256sum ~/.claude/settings.json 2>/dev/null | cut -c1-16)" ] && [ "$DEMO" = "$(sha256sum /c/ClaudeBarack/instalado.json 2>/dev/null | cut -c1-16)" ] && bien "la configuración real de Claude y C:\\ClaudeBarack siguen igual" || mal "cambió la configuración real o C:\\ClaudeBarack"

if [ -n "$DEJAR" ]; then echo "   (queda la carpeta: $T)"; else case "$TP" in /tmp/tmp.*) rm -rf "$TP" && echo "   carpeta temporal sacada" ;; esac; fi
echo "== RESULTADO: $([ "$FALLAS" = 0 ] && echo "todo bien (6 de 6)" || echo "$FALLAS comprobación(es) MAL")"
[ "$FALLAS" = 0 ]
