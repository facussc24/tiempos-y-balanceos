#!/usr/bin/env bash
# consumos-entregable-guard.sh — Enforcement de las lecciones 2026-07-14/16
# (6 fallos con el mismo patron: regla canonica pisada por dato puntual,
# entregable ejecutable sin verificar, tolerancia que tapa typos).
#
# Detecta trabajo sobre ENTREGABLES EJECUTABLES (xlsx/csv hacia Escritorio/
# Downloads/OneDrive) o sobre consumos/BOM/arb, e inyecta UNA VEZ por hora el
# checklist canonico (speed bump: bloquea esa llamada, la siguiente pasa).
#
# Exit 0 = permite. Exit 2 = bloquea con recordatorio.

set -e

INPUT=$(cat)

# Camino rapido: si el despachador ya parseo el JSON, lo reuso.
# Si no (guardian corrido suelto), parseo yo como siempre.
if [ -n "${HOOK_TARGET+x}" ]; then
  TARGET="$HOOK_TARGET"
else
TARGET=$(printf '%s' "$INPUT" | node -e '
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(s);
    const t = j?.tool_input || {};
    process.stdout.write(String(t.command ?? "") + " " + String(t.file_path ?? ""));
  } catch { process.stdout.write(""); }
});
' 2>/dev/null || true)
fi

if [ -z "${TARGET// /}" ]; then exit 0; fi

MATCH=0
# Entregable hacia afuera del repo
if echo "$TARGET" | grep -qiE '(desktop|escritorio|downloads|onedrive)[^ ]*\.(xlsx|xlsm|csv)'; then MATCH=1; fi
# Trabajo de consumos / carga arb / tizadas
if echo "$TARGET" | grep -qiE '(consumo|tizad|insumos\.txt|carga[ _-]?arb|relaciones.*arb|arb.*relaciones)'; then MATCH=1; fi

if [ "$MATCH" -eq 0 ]; then exit 0; fi

# Cooldown 60 min: recordar una vez, despues dejar trabajar
FLAG="${TMPDIR:-/tmp}/claude-consumos-guard.flag"
NOW=$(date +%s)
LAST=$(cat "$FLAG" 2>/dev/null || echo 0)
[ $((NOW - LAST)) -lt 3600 ] && exit 0
echo "$NOW" > "$FLAG" 2>/dev/null

cat >&2 << 'EOF'
[CONSUMOS-GUARD — checklist canonico ANTES de entregar/cargar. Leer skill verificacion-consumos]
1. REGLA CANONICA > dato puntual: etiqueta 100x60 = 1/CAJA (nunca por pieza);
   quimicos A+B con valor IGUAL en "LTS" = fraccion-de-envase (envases distintos != 1:1);
   la UNIDAD no se elige, SE BUSCA en INSUMOS.txt.
2. BOM: listar el folder de consumo ACTUAL y tomar la Rev de numero MAYOR (parsear int).
   PROHIBIDO decir "no documentado" sin pegar la salida del listado.
3. Vinilo/tela de SERIE: fuente autoritativa = tabla tizadas Mesa de Corte (col ML), no el arb/BOM.
4. Auditoria de valores: tolerancia 0,1% (2% tapa typos reales) + invariantes que cierran
   + node scripts/_validarConsumos.mjs + UN AGENTE INDEPENDIENTE ademas del script propio.
5. Entregable ejecutable: mostrar a Fak el dato crudo before→after con columna
   "actual en arb" + ABRIR el archivo generado antes de entregar.
Si ya cumpliste esto (o no aplica a esta operacion puntual), reintenta el comando y segui.
EOF
exit 2
