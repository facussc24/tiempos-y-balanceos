#!/usr/bin/env bash
# Graba en video el SEGUNDO monitor entero (donde esta la ventana de Claude), con el puntero, para las tomas
# "Claude trabajando": se ve la conversacion y lo que se abre encima (Outlook, PowerPoint, el navegador).
# Uso: bash grabar_pantalla.sh <segundos> <salida.mp4> [cuadros por segundo=10]
# El monitor 2 de la PC de Ingenieria empieza en x=1920 y mide 1920x1080 (se mide con
# [System.Windows.Forms.Screen]::AllScreens; el principal esta al 125 % y ffmpeg cuenta en pixeles reales).
# Antes de grabar: plegar la lista de conversaciones de la izquierda (no se muestra en el video) y, al editar,
# recortar la barra de tareas. Para una ventana sola (sin lo que tenga encima) esta grabar_ventana.py.
set -e
SEG="${1:?faltan los segundos}"; SALIDA="${2:?falta el archivo de salida}"; CPS="${3:-10}"
ffmpeg -v error -y -f gdigrab -framerate "$CPS" -offset_x 1920 -offset_y 0 -video_size 1920x1080 -draw_mouse 1 \
  -t "$SEG" -i desktop -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "$SALIDA"
ffprobe -v error -show_entries format=duration:stream=width,height -of csv=p=0 "$SALIDA"
