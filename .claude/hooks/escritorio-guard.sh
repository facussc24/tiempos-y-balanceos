#!/usr/bin/env bash
# escritorio-guard.sh — protege la cola de tareas del Escritorio.
# Regla: .claude/rules/escritorio-tareas.md · Script: scripts/_escritorio.mjs
#
# Tres cosas que BLOQUEA de verdad (no recuerda: bloquea, y la unica salida es hacerlo bien):
#   1. Borrar cualquier cosa del Escritorio o de _TERMINADAS. Nada se borra nunca.
#   2. Mover a mano hacia/desde _TERMINADAS. Archivar y registrar son la misma operacion:
#      va por `node scripts/_escritorio.mjs --archivar`, que no mueve sin registro.
#   3. Escribir el INDICE.md a mano, o dejar un README/LEEME/NOTAS suelto en una carpeta
#      de Fak (incidente 2026-07-24, marcado GRAVE: el contexto va a mi memoria, no a su
#      filesystem).
# Y RECUERDA (1x/hora) el procedimiento cuando una orden simplemente toca el Escritorio.
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
  # Fallback si node no pudo parsear: no desactivarse en silencio, pero tampoco
  # bloquear a ciegas — solo mirar si el payload crudo huele a Escritorio.
  printf '%s' "$INPUT" | grep -qiE '(Escritorio([^A-Za-z]|$)|_TERMINADAS)' || exit 0
  TOOL=""; CMD=$(printf '%s' "$INPUT" | tr -d '\n'); FILE=""
else
  IFS=$'\x1f' read -r TOOL CMD FILE <<< "$PARSED"
fi

TODO="$CMD $FILE"

# El propio script es la via autorizada: pasa siempre, y sin recordatorio.
printf '%s' "$TODO" | grep -q '_escritorio\.mjs' && exit 0

# ¿Esto toca el Escritorio o el archivo de terminadas?
# El sufijo `[^A-Za-z]|$` es para agarrar la ruta que termina ahi mismo (`ls ".../Escritorio"`)
# sin comerse palabras que solo empiezan igual. Sobre-detectar cuesta un recordatorio;
# sub-detectar cuesta una carpeta borrada.
printf '%s' "$TODO" | grep -qiE '(Escritorio([^A-Za-z]|$)|_TERMINADAS)' || exit 0

# ── 1. Borrar: prohibido, sin excepcion ──────────────────────────────────────
if printf '%s' "$CMD" | grep -qiE '(^|[;&|[:space:]])(rm|rmdir|unlink|del|rd|erase)([[:space:]]|$)|Remove-Item|Clear-Content|\.rm(Sync)?\(|shutil\.rmtree'; then
  cat >&2 << 'EOF'
[ESCRITORIO-GUARD] BLOQUEADO: estas por borrar algo del Escritorio o de _TERMINADAS.

NADA SE BORRA NUNCA. Es la regla base del archivado (escritorio-tareas.md): el contexto
de un reclamo aparece dos anos despues con un ECN o un PPAP viejo, y guardar sale gratis
porque el Escritorio ya vive en OneDrive — mover no libera ni ocupa espacio.

Lo que se termino se ARCHIVA, no se borra:
  node scripts/_escritorio.mjs --archivar "<carpeta>" --cerrada AAAA-MM-DD \
       --que "<que quedo hecho>" --donde "<donde quedo el entregable>"

Si de verdad hay que sacar algo de la maquina, lo decide Fak explicitamente, no yo.
EOF
  exit 2
fi

# ── 2. Mover a mano hacia/desde el archivo ───────────────────────────────────
if printf '%s' "$TODO" | grep -qi '_TERMINADAS' \
   && printf '%s' "$CMD" | grep -qiE '(^|[;&|[:space:]])(mv|move|cp|copy|xcopy|robocopy)([[:space:]]|$)|Move-Item|Copy-Item|rename(Sync)?\(|shutil\.(move|copy)'; then
  cat >&2 << 'EOF'
[ESCRITORIO-GUARD] BLOQUEADO: mover a mano hacia/desde _TERMINADAS.

Mover y registrar son UNA operacion. Si se mueve a mano, la carpeta queda archivada sin
fila en el INDICE — que es exactamente el problema que Fak pidio resolver: despues no hay
forma de encontrar lo archivado ni de saber por que se cerro.

  node scripts/_escritorio.mjs --archivar "<carpeta>" --cerrada AAAA-MM-DD \
       --que "<que quedo hecho>" --donde "<donde quedo el entregable>"
  node scripts/_escritorio.mjs --registrar "<carpeta ya archivada>" ...   # legado
  node scripts/_escritorio.mjs --reabrir "<carpeta archivada>"            # si se reabre
  node scripts/_escritorio.mjs --check                                    # invariantes

Agrega --dry-run para ver el plan sin tocar nada.
EOF
  exit 2
fi

# ── 3. Escribir a mano el INDICE, o dejar un archivo auxiliar en carpeta de Fak ──
case "$TOOL" in
  Write|Edit)
    RUTA=$(printf '%s' "$FILE" | tr '\\' '/')
    if printf '%s' "$RUTA" | grep -qiE '_TERMINADAS[^/]*/INDICE\.md$'; then
      cat >&2 << 'EOF'
[ESCRITORIO-GUARD] BLOQUEADO: el INDICE.md no se edita a mano.

Lo escribe `_escritorio.mjs` en el mismo momento que mueve la carpeta. Editarlo a mano es
como se desincronizan la fila y la carpeta, y entonces el INDICE miente.
Si hay que corregir una fila mal cargada, decilo y lo resolvemos por el script.
EOF
      exit 2
    fi
    if printf '%s' "$RUTA" | grep -qiE '/(READ ?ME|LEE ?ME|NOTAS?|APUNTES|CHANGELOG|POR.?QUE)[^/]*\.(md|txt)$'; then
      cat >&2 << 'EOF'
[ESCRITORIO-GUARD] BLOQUEADO: archivo auxiliar suelto en una carpeta de Fak.

Incidente 2026-07-24, marcado GRAVE por Fak: un "LEEME - por que esta aca.txt" en una
carpeta suya. En las carpetas de Fak va EXACTAMENTE el entregable que pidio y nada mas.
El porque / el contexto / la razon de la decision van a MI memoria y, si la tarea se cierra,
a la fila del INDICE (--que / --donde). Yo me hago cargo de recordarlo.
EOF
      exit 2
    fi
    ;;
esac

# ── Recordatorio del procedimiento, 1x/hora ──────────────────────────────────
FLAGDIR="${HOME:-/tmp}/.claude"
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
El Escritorio es la cola de tareas: una carpeta por pendiente. En el Escritorio queda SOLO
lo abierto.

CERRADA = la ultima accion que era de Barack esta hecha Y dejo rastro fuera del Escritorio
(mail enviado, archivo en el server/legajo, carga hecha en el ERP, commit pusheado).
Esperando a un tercero NO es cerrada. "El archivo esta listo pero no lo mande" NO es cerrada.

  node scripts/_escritorio.mjs              # relevar: que hay abierto y hace cuanto
  node scripts/_escritorio.mjs --archivar "<carpeta>" --cerrada AAAA-MM-DD \
       --que "<que quedo hecho>" --donde "<donde quedo el entregable>"

Nada se borra. No se mueve a mano. El que/donde son obligatorios y el script los valida.
Si ya cumpliste (o no aplica), reintenta y segui.
EOF
exit 2
