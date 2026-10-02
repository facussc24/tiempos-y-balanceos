#!/usr/bin/env bash
# Graba en video el SEGUNDO monitor entero (donde esta la ventana de Claude), con el puntero, para las tomas
# "Claude trabajando": se ve la conversacion y lo que se abre encima (Outlook, PowerPoint, el navegador).
# Uso: bash grabar_pantalla.sh <segundos> <salida.mp4> [cuadros por segundo=10]
# El monitor 2 de la PC de Ingenieria empieza en x=1920 y mide 1920x1080 (se mide con
# [System.Windows.Forms.Screen]::AllScreens; el principal esta al 125 % y ffmpeg cuenta en pixeles reales).
# Antes de grabar: plegar la lista de conversaciones de la izquierda (no se muestra en el video) y, al editar,
# recortar la barra de tareas. Para una ventana sola (sin lo que tenga encima) esta grabar_ventana.py.
#
# Sale con 1 si no hay lugar en el disco para empezar o si la grabacion quedo mas corta que lo pedido: el 02/10/2026
# una toma de 780 s se corto sola a los 416 s con el disco C: en 0,1 GB libres, y nadie se entero hasta mirarla.
set -e
SEG="${1:?faltan los segundos}"; SALIDA="${2:?falta el archivo de salida}"; CPS="${3:-10}"
LIBRE_MB=$(df -m "$(dirname "$SALIDA")" | awk 'NR==2 {print $4}')
if [ "${LIBRE_MB:-0}" -lt 2000 ]; then
  echo "NO GRABO: quedan ${LIBRE_MB} MB libres en el disco y hacen falta 2000 para no cortar la toma" >&2; exit 1
fi
ffmpeg -v error -y -f gdigrab -framerate "$CPS" -offset_x 1920 -offset_y 0 -video_size 1920x1080 -draw_mouse 1 \
  -t "$SEG" -i desktop -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "$SALIDA"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SALIDA" | cut -d. -f1)
echo "grabados ${DUR:-0} s de $SEG pedidos en $SALIDA"
if [ "${DUR:-0}" -lt $((SEG - 5)) ]; then
  echo "LA TOMA QUEDO CORTA: ${DUR:-0} s de $SEG. Mirar el espacio libre y si la pantalla se bloqueo." >&2; exit 1
fi
