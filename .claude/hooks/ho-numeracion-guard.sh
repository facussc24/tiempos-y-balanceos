#!/usr/bin/env bash
# ho-numeracion-guard.sh — Enforcement de la regla no-pfd-no-ho §"la numeracion
# la manda el flujograma" (leccion 2026-08-13, HO-986 APB Trasero Central).
#
# Que paso: Marcelo Nieve pidio la HO del APB Trasero Central y adjunto su Plan
# de Control. El PdC tenia OTRA numeracion de operaciones que el flujograma y el
# AMFE 150 (costura 30 vs 40, tapizado 41 vs 60, control final 50 vs 70,
# embalaje 60 vs 90) y una COLISION real: el 80 era "reproceso" en el flujograma
# y "test de lay out" en el PdC. Los dos documentos iban al BeOn del cliente.
# Se detecto solo porque se cotejaron las tres fuentes ANTES de escribir la HO.
#
# Detecta trabajo sobre Hojas de Operaciones / hojas de proceso e inyecta UNA VEZ
# por hora el gate de numeracion (speed bump: bloquea esa llamada, la siguiente pasa).
#
# Exit 0 = permite. Exit 2 = bloquea con recordatorio.

set -e

INPUT=$(cat)

# Camino rapido: si el despachador ya parseo el JSON, lo reuso.
# Si no (guardian corrido suelto), parseo yo. Un guardian que no corre parece
# un guardian que aprobo: por eso nunca salgo por fallo de parseo sin mirar.
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

# Red de seguridad: si no se pudo parsear, grep sobre el JSON crudo.
if [ -z "${TARGET// /}" ]; then TARGET="$INPUT"; fi
if [ -z "${TARGET// /}" ]; then exit 0; fi

MATCH=0
# Archivo de HO (HO-986, "HO 211 REV5", carpeta HOJAS DE OPERACIONES)
if echo "$TARGET" | grep -qiE '(hojas? de operacion|hoja de proceso|hojas de proceso|\bHO[- ][0-9]{2,3}\b)'; then MATCH=1; fi
# Formulario del SGC de las HO
if echo "$TARGET" | grep -qiE 'I-IN-002\.4'; then MATCH=1; fi

if [ "$MATCH" -eq 0 ]; then exit 0; fi

# Cooldown 60 min: recordar una vez, despues dejar trabajar
FLAG="${TMPDIR:-/tmp}/claude-ho-numeracion-guard.flag"
NOW=$(date +%s)
LAST=$(cat "$FLAG" 2>/dev/null || echo 0)
[ $((NOW - LAST)) -lt 3600 ] && exit 0
echo "$NOW" > "$FLAG" 2>/dev/null

cat >&2 << 'EOF'
[HO-GUARD — gate de numeracion ANTES de armar una Hoja de Operaciones.
 Regla: .claude/rules/no-pfd-no-ho.md]

1. COTEJAR LAS TRES FUENTES antes de escribir una celda, y armar la tabla
   operacion por operacion:
     FLUJOGRAMA (I-IN-002/III)  ·  AMFE (Supabase live)  ·  PLAN DE CONTROL
   Si no cierran: NO se tapa. Se reporta la tabla de divergencias a Fak.
2. LA NUMERACION LA MANDA EL FLUJOGRAMA. Es el orden APQP: flujograma → AMFE →
   Plan de Control. Si el PdC difiere, lo que se corrige es el PdC.
   Mirar especialmente las COLISIONES (mismo numero, distinta operacion).
3. Los PASOS de una HO son instruccion de planta. Sin documento fuente van TBD.
   PROHIBIDO redactarlos por analogia con otra pieza "parecida" o copiar los de
   otro producto: el proceso puede ser otro (core-prohibiciones §1).
4. FOTOS: solo de la pieza real, o de maquina/gesto donde NO SE RECONOZCA otra pieza.
   Si no hay foto, el recuadro va VACIO — nada de leyendas tipo "FOTO PENDIENTE"
   (Fak, 13/08: "si no hay imagenes en alguna hoja no pongas nada").
   Al duplicar una hoja como plantilla, BORRAR sus imagenes de contenido: se arrastran
   invisibles. Paso con la HO-986: la plantilla era un reproceso de costura y sus 9 fotos
   de agujas quedaron en las 8 hojas nuevas, incluida la de inyeccion de PU.
5. UNA HO ES PARA EL OPERARIO, NO PARA AUDITAR: sin "BORRADOR", sin "pendiente de
   validacion", sin "el Plan de Control dice X pero Y". Donde no hay dato va TBD y nada
   mas; el analisis va en el informe aparte. Estilo de la casa en el ciclo de control:
   Resp. = OP / OC / Insp., Registro = RC / Set-up / N/A, frases cortas (las columnas
   son angostas y un texto largo se CORTA).
6. AL CERRAR: actualizar el listado maestro
   (3- LISTADO\Listado hojas de proceso.xlsx) con la fila nueva en el bloque de
   su sector + la hoja oculta _CONTEXTO_CLAUDE con el proximo numero libre.
7. El .xlsx del SGC no se edita a mano: va instructivo celda por celda al agente
   de Excel (feedback_no_edito_excel_lo_hace_agente_excel).

Si ya cumpliste esto (o no aplica), reintenta y segui.
EOF
exit 2
