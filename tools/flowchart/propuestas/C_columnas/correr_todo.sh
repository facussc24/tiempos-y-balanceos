#!/bin/bash
# Corre los 4 flujogramas de prueba de la propuesta C: render + verificacion.
cd /c/Dev/BarackMercosul || exit 1
for k in 158-INSONOS-DUCTOS 152-APOYACABEZAS 157-IP-PAD 153-ARMREST-DOOR-PANEL; do
  node tools/flowchart/propuestas/C_columnas/render.mjs "$k" 2>&1 | grep -vE "^\s+at " | cut -c1-500 | tail -14
  python tools/flowchart/propuestas/C_columnas/verificar.py "$k" 2>&1 | grep -E "^Hojas|^Columnas|FALTANTES|^Palabras|^MINIMO"
done
