#!/usr/bin/env bash
# doc-tercero-guard.sh — Enforcement de .claude/rules/documentos-de-terceros.md
# (incidente 25-27/08/2026, ensayos de un laboratorio externo).
#
# Que paso: de seis ensayos sobre la misma muestra, uno estaba emitido a nombre de
# otra empresa. Se lo "corrigio" tapando el campo con un rectangulo blanco (el texto
# original quedo en la capa de texto igual), y despues se pidio cambiar el QR — que
# apunta al LIMS del laboratorio — por uno a nuestra copia editada, para cargarlo en
# el portal del cliente. Eso es falsificar el certificado. Detalle concreto en la
# memoria local `documento_de_tercero_no_se_edita`: el repo es publico.
#
# Dispara al ver una operacion de EDICION de PDF, o el dominio del laboratorio.
# Speed bump 1x/hora: bloquea esa llamada, la siguiente pasa.
#
# Exit 0 = permite. Exit 2 = bloquea con recordatorio.

set -e

# Camino rapido: si el despachador ya parseo el JSON, lo reuso — y NO leo stdin,
# que colgaria al guardian corrido suelto. Si no hay nada parseado, parseo yo.
# Un guardian que no corre parece un guardian que aprobo.
INPUT=""
if [ -n "${HOOK_PARSED4+x}" ]; then
  TARGET="$HOOK_PARSED4"
elif [ -n "${HOOK_TARGET+x}" ]; then
  TARGET="$HOOK_TARGET"
else
INPUT=$(cat)
TARGET=$(printf '%s' "$INPUT" | node -e '
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(s);
    const t = j?.tool_input || {};
    process.stdout.write([String(t.command ?? ""), String(t.file_path ?? ""),
                          String(t.content ?? t.new_string ?? "")].join(" "));
  } catch { process.stdout.write(""); }
});
' 2>/dev/null || true)
fi

# Red de seguridad: si no se pudo parsear, grep sobre el JSON crudo.
if [ -z "${TARGET// /}" ] && [ -n "$INPUT" ]; then TARGET="$INPUT"; fi
if [ -z "${TARGET// /}" ]; then exit 0; fi

# Portal de verificacion de un emisor externo: dispara siempre. (Los nombres propios
# del incidente no van en un repo publico; estos patrones cubren el mecanismo.)
if echo "$TARGET" | grep -qiE 'lims\.|ReportQRQuery|report.?verif|certificate.?verif'; then MATCH=1; else MATCH=0; fi

# Edicion de PDF: verbo de escritura sobre un PDF. Los generadores PROPIOS quedan
# afuera — este guardian protege papeles ajenos, no frena nuestros exports.
if [ "$MATCH" -eq 0 ]; then
  if echo "$TARGET" | grep -qiE '\.pdf\b' \
     && echo "$TARGET" | grep -qiE 'draw_rect|add_redact_annot|apply_redactions|insert_text|insert_htmlbox|insert_image|replace_image|update_stream|delete_image|add_highlight' ; then
    MATCH=1
  fi
fi

# QR nuevo sobre un PDF: el caso que motivo la regla.
if [ "$MATCH" -eq 0 ]; then
  if echo "$TARGET" | grep -qiE '\.pdf\b' \
     && echo "$TARGET" | grep -qiE 'qrcode|qr_code|segno|QRCodeDetector|pyzbar|zxing' ; then
    MATCH=1
  fi
fi

if [ "$MATCH" -eq 0 ]; then exit 0; fi

# Nuestros propios generadores de PDF no son documentos de terceros.
if echo "$TARGET" | grep -qiE '_pdfBomArb|_exportAmfe|_flujograma|html2pdf|_legajo|dist/|node_modules'; then exit 0; fi

# Cooldown 60 min: recordar una vez, despues dejar trabajar.
FLAG="${TMPDIR:-/tmp}/claude-doc-tercero-guard.flag"
NOW=$(date +%s)
LAST=$(cat "$FLAG" 2>/dev/null || echo 0)
[ $((NOW - LAST)) -lt 3600 ] && exit 0
echo "$NOW" > "$FLAG" 2>/dev/null

cat >&2 << 'EOF'
[DOC-TERCERO-GUARD — 1x/h. Regla: .claude/rules/documentos-de-terceros.md]

Solo aplica si el EMISOR no es Barack Y vas a tocar su CONTENIDO (cliente,
fecha, resultado) o su VERIFICACION (QR/LIMS/hash/firma) — reapuntar eso a una
copia nuestra es falsificar el certificado. Si es asi: no se edita, se pide la
REEMISION al emisor (mail corto). Si el PDF es nuestro, o es leer/extraer/OCR/
traducir aparte, no aplica nada de esto — reintenta y segui.
EOF
exit 2
