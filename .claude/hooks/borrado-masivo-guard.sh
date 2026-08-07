#!/usr/bin/env bash
# borrado-masivo-guard.sh - ENFORCEMENT DURO contra el incidente del 2026-08-07.
#
# QUE PASO: para rescatar ~17 archivos CAD escribi un .ps1 nuevo que copiaba,
# verificaba tamano y borraba el original. Movio 942 (toda la carpeta REVISAR de
# Fak, 1,76 GB) a un arbol de carpetas fantasma, y aplano 242 subcarpetas.
# Ningun byte se perdio; se perdio la JERARQUIA, que era el dato.
#
# Los dos bugs eran SILENCIOSOS - el script decia "listo" haciendo otra cosa:
#   1. .ps1 en UTF-8 sin BOM leido por powershell.exe como ANSI: "Ingenieria" con
#      tilde se convirtio en otra cadena y creo un arbol paralelo entero.
#   2. Get-ChildItem -LiteralPath <dir> -Recurse -Include *.step: -Include se
#      IGNORA si el Path no termina en \*. Devolvio TODOS los archivos.
#
# Pero la causa de fondo fue de metodo: scripts/_escritorio.mjs ya hacia esto con
# --dry-run y verificacion de bytes, y escribi uno nuevo sin esas protecciones.
# El dry-run habria impreso "942" cuando yo esperaba 17. Ahi terminaba.
#
# Este guardian NO tiene cooldown: los 4 vectores son bugs objetivos o pasos
# salteados, no recordatorios de estilo.
#
# Exit 0 = permite. Exit 2 = bloquea.

set -e
INPUT=$(cat)

if [ -n "${HOOK_PARSED4+x}" ]; then
  PARSED="$HOOK_PARSED4"
else
PARSED=$(printf '%s' "$INPUT" | node -e '
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(s);
    const t = j?.tool_input || {};
    const clean = x => String(x ?? "").replace(/[\x1f\n\r]/g, " ");
    process.stdout.write([
      clean(j?.tool_name),
      clean(t.command).slice(0, 6000),
      clean(t.file_path),
      clean(t.content ?? t.new_string).slice(0, 6000)
    ].join("\x1f"));
  } catch { process.stdout.write(""); }
});
' 2>/dev/null || true)
fi

if [ -z "$PARSED" ]; then
  # Red de seguridad: si no se pudo parsear, mirar el JSON crudo. Un guardian
  # que no corre parece un guardian que aprobo.
  TOOL=""; CMD="$INPUT"; FILE=""; BODY="$INPUT"
else
  IFS=$'\x1f' read -r TOOL CMD FILE BODY <<< "$PARSED"
fi

HAYSTACK="$CMD $BODY"
MOTIVO=""

# Los tests y los propios guardianes CITAN los patrones peligrosos como dato: es su
# trabajo. Sin esta excepcion el guardian se bloquea a si mismo - paso al escribir su
# test, y otra vez al editar este archivo.
case "$TOOL" in
  Write|Edit)
    # Las rutas llegan con barra de Windows (\) o de bash (/): aceptar las dos, o la
    # excepcion no matchea y el guardian se bloquea a si mismo. (Lo agarro su test.)
    if printf '%s' "$FILE" | grep -qiE '(__tests__|\.test\.|\.spec\.|[/\\]hooks[/\\][a-z-]+-guard\.sh$)'; then
      exit 0
    fi ;;
esac

# --- VECTOR 1: -Include junto con -Recurse. Bug objetivo, siempre. -----------
# El filtro se ignora en silencio y el alcance se dispara a TODOS los archivos.
if printf '%s' "$HAYSTACK" | grep -qiE 'Get-ChildItem' \
   && printf '%s' "$HAYSTACK" | grep -qiE '\-Recurse' \
   && printf '%s' "$HAYSTACK" | grep -qiE '\-Include'; then
  if ! printf '%s' "$HAYSTACK" | grep -qE '\\\*|/\*'; then
    MOTIVO="${MOTIVO}V1"
  fi
fi

# --- VECTOR 2: .ps1 con caracteres no-ASCII ---------------------------------
# powershell.exe (5.1) lee el archivo como ANSI si no tiene BOM: cualquier
# tilde en una ruta apunta a OTRA carpeta, que ademas se crea sola.
if printf '%s' "$FILE" | grep -qiE '\.ps1$'; then
  if printf '%s' "$BODY" | LC_ALL=C grep -qP '[^\x00-\x7F]' 2>/dev/null \
     || printf '%s' "$BODY" | LC_ALL=C grep -q '[^ -~	]' 2>/dev/null; then
    MOTIVO="${MOTIVO}V2"
  fi
fi

# --- VECTOR 3: borrado permanente en vez de Papelera ------------------------
# Dos exclusiones, las dos senaladas por el auditor: un guardian que bloquea trabajo
# legitimo todos los dias termina desactivado, y ahi no protege nada.
#   - `git rm`: lo borrado sigue en el historial, se recupera con git. No es este riesgo.
#   - scratchpad / carpetas temporales: son efimeras por definicion, no son cosas de Fak.
ES_EXCLUIDO=0
printf '%s' "$HAYSTACK" | grep -qiE '(^|[;&|]|\s)git\s+rm\b' && ES_EXCLUIDO=1
printf '%s' "$HAYSTACK" | grep -qiE '(scratchpad|[/\\]tmp[/\\]|AppData[/\\]Local[/\\]Temp|node_modules|[/\\]dist[/\\]?|\.venv)' && ES_EXCLUIDO=1
if [ "$ES_EXCLUIDO" -eq 0 ] && printf '%s' "$HAYSTACK" | grep -qiE '(Remove-Item[^|;]*-(Force|Recurse)|rm +-[a-z]*r[a-z]*f|rm +-[a-z]*f[a-z]*r|DeletePermanently|shutil\.rmtree|fs\.rmSync)'; then
  MOTIVO="${MOTIVO}V3"
fi

# --- VECTOR 4: script que borra/mueve en lote y no tiene dry-run ------------
ESCRIBE_SCRIPT=0
case "$TOOL" in
  Write|Edit) printf '%s' "$FILE" | grep -qiE '\.(ps1|sh|mjs|js|py|bat|cmd)$' && ESCRIBE_SCRIPT=1 ;;
esac
if [ "$ESCRIBE_SCRIPT" -eq 1 ]; then
  if printf '%s' "$BODY" | grep -qiE '(Remove-Item|Move-Item|DeleteFile|DeleteDirectory|shutil\.(move|rmtree)|os\.remove|fs\.(unlink|rm|rename)|\bmv\b|\brm\b)'; then
    # El bucle, en los 4 lenguajes que cubre la lista de extensiones de arriba.
    # `for x in y:` de Python NO matcheaba con `for +\(` (estilo C/JS). Lo agarro el
    # auditor: un .py con `for f in os.listdir(d): shutil.move(...)` y sin dry-run es
    # EXACTAMENTE el incidente del 07/08 en otro lenguaje, y pasaba limpio.
    if printf '%s' "$BODY" | grep -qiE '(foreach|for +\(|for +[a-z_]+ +in |while|Get-ChildItem|find |glob|walk|readdir|listdir|iterdir|rglob|scandir)'; then
      printf '%s' "$BODY" | grep -qiE 'dry[-_ ]?run|dryRun|DRYRUN|WhatIf' || MOTIVO="${MOTIVO}V4"
    fi
  fi
fi

[ -z "$MOTIVO" ] && exit 0

{
echo "[BORRADO-MASIVO-GUARD - BLOQUEO. Incidente 2026-08-07: 942 archivos movidos en vez de 17]"
echo
case "$MOTIVO" in *V1*)
echo "V1 - Get-ChildItem con -Recurse Y -Include, y el Path no termina en \\*"
echo "     -Include se IGNORA en silencio: esto devuelve TODOS los archivos, no los"
echo "     de la extension que pediste. Es exactamente el bug que movio los 942."
echo "     Usar: -Filter, o -Path \"\$dir\\*\", o Where-Object { \$_.Extension -in @(...) }"
echo ;; esac
case "$MOTIVO" in *V2*)
echo "V2 - .ps1 con caracteres no-ASCII (tildes, enies)"
echo "     powershell.exe lo lee como ANSI: 'Ingenieria' con tilde apunta a OTRA ruta"
echo "     y la crea sola. Asi nacio el arbol de carpetas fantasma."
echo "     Armar las rutas con variables/wildcard, o pasarlas como argumento. Cero"
echo "     acentos en literales de ruta dentro del .ps1."
echo ;; esac
case "$MOTIVO" in *V3*)
echo "V3 - borrado PERMANENTE (-Force / -Recurse / rm -rf / rmtree)"
echo "     Sobre carpetas de Fak va a PAPELERA, que se deshace con un click:"
echo "       [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile(\$p,'OnlyErrorDialogs','SendToRecycleBin')"
echo "     La papelera local quedo VACIA tras el incidente: -Force no deja vuelta atras."
echo ;; esac
case "$MOTIVO" in *V4*)
echo "V4 - script que borra o mueve EN LOTE y no tiene dry-run"
echo "     Antes de tocar nada: imprimir el plan (origen -> destino, uno por linea)"
echo "     y MIRAR EL CONTEO. Si esperabas 17 y dice 942, ahi se termina."
echo ;; esac
echo "ANTES DE ESCRIBIR UNO NUEVO: 'node scripts/_escritorio.mjs --archivar ... --dry-run'"
echo "ya hace esto con verificacion de bytes y sin una sola llamada de borrado."
echo "Regla: .claude/rules/escritorio-tareas.md - 'Nada se borra, nunca'."
} >&2
exit 2
