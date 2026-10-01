#!/usr/bin/env bash
# Captura la pantalla y la recorta a la ventana de la app (rectangulo en pixeles reales), para mirarla
# y, si se pasa un nombre, para guardarla como captura del manual.
# Uso: bash ver.sh [nombre-final.png|-] [izq arr der aba]   (por defecto el rectangulo donde deje la ventana)
cd "$(dirname "$0")" || exit 1
L=${2:-68}; T=${3:-20}; R=${4:-1752}; B=${5:-1012}
python - "$1" "$L" "$T" "$R" "$B" <<'EOF'
import sys
from PIL import ImageGrab, Image
import ctypes
ctypes.windll.user32.SetProcessDPIAware()
nombre, L, T, R, B = sys.argv[1], *map(int, sys.argv[2:6])
im = ImageGrab.grab(bbox=(L, T, R, B))
im.save('capturas/_ver_grande.png')
if nombre and nombre != '-':
    im.save('capturas/' + nombre); print('guardada: capturas/' + nombre, im.size)
v = im.copy(); v.thumbnail((1280, 1280)); v.save('capturas/_ver.png'); print('vista', v.size)
EOF
