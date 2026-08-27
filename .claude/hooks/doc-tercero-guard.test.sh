#!/usr/bin/env bash
# Regresion de doc-tercero-guard.sh — el guardian que frena la edicion de papeles
# emitidos por terceros (incidente 25-27/08/2026, ensayos de un laboratorio externo,
# regla .claude/rules/documentos-de-terceros.md).
#
# Los primeros casos son las operaciones REALES del incidente. Los ultimos son la
# calibracion: si frena nuestros propios exports de PDF se vuelve inservible y
# alguien lo va a apagar — un guardian que grita por todo no protege nada.
#
#   bash .claude/hooks/doc-tercero-guard.test.sh
set -uo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
G=".claude/hooks/doc-tercero-guard.sh"
ok=0; fail=0

probar() { # $1=esperado $2=target $3=descripcion
  rm -f "${TMPDIR:-/tmp}/claude-doc-tercero-guard.flag"
  HOOK_PARSED4="$2" bash "$G" >/dev/null 2>&1
  local rc=$?
  if [ "$rc" -eq "$1" ]; then ok=$((ok+1)); printf '  ok   %s\n' "$3"
  else fail=$((fail+1)); printf '  FALLA %s  (esperaba %s, dio %s)\n' "$3" "$1" "$rc"; fi
}

echo "BLOQUEA (2) — las operaciones reales del incidente:"
probar 2 "page.draw_rect(rect, fill=(1,1,1)) sobre 吸音.pdf" "tapar un campo con rectangulo blanco"
probar 2 "python qr.py --pdf informe.pdf --qrcode nuevo" "meterle un QR nuevo a un PDF"
probar 2 "curl http://lims.ejemplo.com/#/ReportQRQuery/2B90" "el LIMS del laboratorio"
probar 2 "abrir report-verify de un certificado" "portal de verificacion del emisor"
probar 2 "doc.insert_htmlbox(r, 'BARACK') en certificado.pdf" "reemplazar el cliente del reporte"
probar 2 "doc.insert_text((100,200), 'BARACK', ) guardar en reporte.pdf" "escribir texto encima"
probar 2 "page.apply_redactions() en certificado.pdf" "redaccion sobre un certificado"

echo "DEJA PASAR (0) — calibracion, esto es trabajo normal:"
probar 0 "node scripts/_pdfBomArb.py --producto APC" "nuestro generador de PDF de difusion"
probar 0 "node scripts/_exportAmfeOficial.ts --amfe 151" "nuestro export oficial"
probar 0 "node scripts/_flujograma.mjs --todos" "nuestro generador de flujogramas"
probar 0 "python -c \"import pymupdf; print(doc.get_text())\" informe.pdf" "LEER un PDF ajeno"
probar 0 "pdftotext plano.pdf salida.txt" "extraer texto"
probar 0 "cv2.QRCodeDetector().detectAndDecode(img)" "decodificar un QR sin tocar el PDF"
probar 0 "git commit -m 'docs: lecciones'" "un commit cualquiera"
probar 0 "npm run build" "el build"

echo
printf 'ok=%d  fallas=%d\n' "$ok" "$fail"
rm -f "${TMPDIR:-/tmp}/claude-doc-tercero-guard.flag"
[ "$fail" -eq 0 ]
