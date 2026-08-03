#!/usr/bin/env bash
# escritorio-guard.sh — protege la cola de tareas y su archivo.
# Regla: .claude/rules/escritorio-tareas.md · Script: scripts/_escritorio.mjs
#
# Territorio protegido:
#   · el Escritorio (la cola de pendientes)
#   · la biblioteca de Ingenieria sincronizada (`BARACK ARGENTINA SRL\...`), que ademas
#     lleva "(NUNCA BORRAR)" en el nombre y esta bajo control documental
#   · `TAREAS CERRADAS\` (el archivo) y la vieja `_TERMINADAS\` del Escritorio
#
# Bloquea de verdad (no recuerda: bloquea):
#   1. Borrar cualquier cosa ahi adentro. Nada se borra nunca.
#   2. Mover a mano hacia/desde el archivo. Archivar y registrar son la misma operacion:
#      va por `node scripts/_escritorio.mjs --archivar`, que no mueve sin registro y ademas
#      verifica que no se haya perdido ningun archivo en el camino.
#   3. Tocar el listado de tareas cerradas a mano, o dejar un README/LEEME/NOTAS suelto en
#      una carpeta de Fak (incidente 2026-07-24, marcado GRAVE).
# Y RECUERDA (1x/hora) el procedimiento cuando una orden simplemente toca ese territorio.
#
# Exit 0 = permite. Exit 2 = bloquea con el motivo.

set -e
INPUT=$(cat)

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
    ].join("\x1f"));
  } catch { process.stdout.write(""); }
});
' 2>/dev/null || true)

if [ -z "$PARSED" ]; then
  TOOL=""; CMD=$(printf '%s' "$INPUT" | tr -d '\n'); FILE=""
else
  IFS=$'\x1f' read -r TOOL CMD FILE <<< "$PARSED"
fi

TODO="$CMD $FILE"

# El propio script es la via autorizada: pasa siempre, y sin recordatorio.
printf '%s' "$TODO" | grep -q '_escritorio\.mjs' && exit 0

# ¿Esto toca el territorio protegido?
#
# Se exige la barra de RUTA adelante porque el hook mira tambien mensajes de commit y prosa
# en español, donde "el Escritorio" aparece todo el tiempo. Dos falsos positivos reales al
# escribir esto:
#   · `git commit -m "...sus carpetas (Escritorio, OneDrive...)"` disparaba el recordatorio.
#   · peor: **`del` es alias de borrado Y preposicion en español**, asi que "del Escritorio"
#     en un mensaje de commit se leia como un borrado y bloqueaba el commit.
# Toda operacion real trae la ruta con separadores; la prosa no.
ZONA='[\\/](Escritorio([^A-Za-z]|$)|Desktop([^A-Za-z]|$)|_TERMINADAS|TAREAS CERRADAS|BARACK ARGENTINA SRL)'
printf '%s' "$TODO" | grep -qiE "$ZONA" || exit 0

# ── 1. Borrar: prohibido, sin excepcion ──────────────────────────────────────
#
# `del` y `rd` (alias CMD/PowerShell) van aparte y exigen una LETRA DE UNIDAD atras:
# "del" es tambien preposicion en español, y un mensaje de commit que dice "del Escritorio"
# y encima cita una ruta real se leia como un borrado. Paso dos veces al escribir esto.
# El resto de los verbos no tienen homonimo en español, asi que van sueltos.
BORRA='(^|[;&|[:space:]])(rm|rmdir|unlink|erase)([[:space:]]|$)|Remove-Item|Clear-Content|shutil\.rmtree'
BORRA_CMD='(^|[;&|[:space:]])(del|rd)([[:space:]]+/[A-Za-z]+)*[[:space:]]+.?[A-Za-z]:'
if printf '%s' "$CMD" | grep -qiE "$BORRA|$BORRA_CMD"; then
  cat >&2 << 'EOF'
[ESCRITORIO-GUARD] BLOQUEADO: estas por borrar algo del Escritorio o de la biblioteca de
Ingenieria — que ademas lleva "(NUNCA BORRAR)" en el nombre y esta bajo control documental.

NADA SE BORRA NUNCA. El contexto de un reclamo aparece dos anos despues con un ECN o un
PPAP viejo, y guardar sale gratis.

Lo que se termino se ARCHIVA, no se borra:
  node scripts/_escritorio.mjs --archivar "<carpeta>" --cerrada AAAA-MM-DD \
       --quien "<quien lo pidio>" --que "<que se hizo>" --donde "<donde quedo el entregable>"

Si de verdad hay que sacar algo, lo decide Fak explicitamente, no yo.
EOF
  exit 2
fi

# ── 2. Mover a mano hacia/desde el archivo ───────────────────────────────────
if printf '%s' "$TODO" | grep -qiE '(_TERMINADAS|TAREAS CERRADAS)' \
   && printf '%s' "$CMD" | grep -qiE '(^|[;&|[:space:]])(mv|move|cp|copy|xcopy|robocopy)([[:space:]]|$)|Move-Item|Copy-Item|shutil\.(move|copy)'; then
  cat >&2 << 'EOF'
[ESCRITORIO-GUARD] BLOQUEADO: mover a mano hacia/desde el archivo de tareas cerradas.

Mover y registrar son UNA operacion. A mano, la carpeta queda archivada sin fila en el
listado — que es exactamente el problema que Fak pidio resolver: despues no hay forma de
encontrar lo archivado ni de saber donde quedo el entregable. El script ademas VERIFICA
que el movimiento no haya perdido archivos (OneDrive con Files On-Demand puede morder).

  node scripts/_escritorio.mjs --archivar "<carpeta>" --cerrada AAAA-MM-DD \
       --quien "<quien lo pidio>" --que "<que se hizo>" --donde "<donde quedo el entregable>"
  node scripts/_escritorio.mjs --reabrir "<carpeta archivada>"   # si se reabre
  node scripts/_escritorio.mjs --check                           # invariantes

Agrega --dry-run para ver el plan sin tocar nada.
EOF
  exit 2
fi

# ── 3. Listado a mano, o archivo auxiliar en carpeta de Fak ──────────────────
case "$TOOL" in
  Write|Edit)
    RUTA=$(printf '%s' "$FILE" | tr '\\' '/')
    if printf '%s' "$RUTA" | grep -qiE 'LISTADO DE TAREAS CERRADAS'; then
      cat >&2 << 'EOF'
[ESCRITORIO-GUARD] BLOQUEADO: el listado de tareas cerradas no se toca a mano.

Lo escribe `_escritorio.mjs` en el mismo momento que mueve la carpeta. Editarlo aparte es
como se desincronizan la fila y la carpeta, y entonces el listado miente. Si hay que
corregir una fila mal cargada, decilo y lo resolvemos por el script.
EOF
      exit 2
    fi
    if printf '%s' "$RUTA" | grep -qiE '/(READ ?ME|LEE ?ME|NOTAS?|APUNTES|CHANGELOG|POR.?QUE)[^/]*\.(md|txt)$'; then
      cat >&2 << 'EOF'
[ESCRITORIO-GUARD] BLOQUEADO: archivo auxiliar suelto en una carpeta de Fak.

Incidente 2026-07-24, marcado GRAVE por Fak: un "LEEME - por que esta aca.txt" en una
carpeta suya. Ahi va EXACTAMENTE el entregable que pidio y nada mas. El porque va a MI
memoria y, si la tarea se cierra, a la fila del listado (--quien / --que / --donde).
EOF
      exit 2
    fi
    ;;
esac

# ── Recordatorio del procedimiento, 1x/hora ──────────────────────────────────
#
# El directorio se puede pisar por env var para que los tests no compitan por el mismo
# archivo con el guard vivo de la sesion. Compartirlo hace flaky al test del recordatorio:
# da rojo si la sesion acaba de tocar el Escritorio (el cooldown ya estaba consumido) y
# verde si corre a favor — que es peor, porque pasa por el motivo equivocado.
FLAGDIR="${ESCRITORIO_GUARD_FLAGDIR:-${HOME:-/tmp}/.claude}"
mkdir -p "$FLAGDIR" 2>/dev/null || true
FLAG="$FLAGDIR/escritorio-guard.flag"
NOW=$(date +%s 2>/dev/null || echo 0)
LAST=$(cat "$FLAG" 2>/dev/null || echo 0)
case "$LAST" in ''|*[!0-9]*) LAST=0 ;; esac
case "$NOW" in ''|*[!0-9]*) NOW=0 ;; esac
if [ "$NOW" -gt 0 ] && [ "$LAST" -gt 0 ] && [ $((NOW - LAST)) -lt 3600 ]; then
  exit 0
fi
printf '%s' "$NOW" > "$FLAG" 2>/dev/null || true

cat >&2 << 'EOF'
[ESCRITORIO-GUARD — RECORDATORIO 1x/h. Regla: .claude/rules/escritorio-tareas.md]
El Escritorio es la cola de tareas: una carpeta por pendiente, y ahi queda SOLO lo abierto.

CERRADA = la ultima accion que era de Barack esta hecha Y el ENTREGABLE ya esta en su
carpeta por tipo de la biblioteca de Ingenieria. Esperando a un tercero NO es cerrada.
"El archivo esta listo pero no lo mande" NO es cerrada.

LOS DOS MOTIVOS POR LOS QUE NO CIERRA (triage 03/08: las 30 carpetas caian en uno de estos):
  1. El trabajo tecnico ESTA hecho, pero nadie le contesto al que lo pidio.
     -> se comprueba: no hay ningun .msg de respuesta en la carpeta.
  2. El entregable ESTA hecho, pero quedo suelto en el Escritorio.
     -> se comprueba: no esta en su carpeta por tipo.
Que el archivo exista en su carpeta NO prueba que el trabajo se hizo: puede ser el mismo
adjunto que ya estaba ahi, reenviado. Comparar fecha y contenido, nunca el nombre.

Al archivar NO se copia el entregable: eso duplicaria el documento. Se mueve solo el RASTRO
(el mail que la origino, capturas, borradores) y el listado dice DONDE quedo el entregable.

  node scripts/_leerMsg.mjs --dir "<carpeta>"   # que se pidio, quien y CUANDO (fecha del mail)
  node scripts/_escritorio.mjs              # relevar: que hay abierto y hace cuanto
  node scripts/_escritorio.mjs --archivar "<carpeta>" --cerrada AAAA-MM-DD \
       --quien "<quien lo pidio>" --que "<que se hizo>" --donde "<donde quedo el entregable>"

Nada se borra. No se mueve a mano. Si ya cumpliste (o no aplica), reintenta y segui.
EOF
exit 2
