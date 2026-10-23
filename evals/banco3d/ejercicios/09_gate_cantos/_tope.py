"""Comun del ejercicio 09: tope de prueba (bloque 60 x 20 x 15 apoyado en z=0) donde la mano va ARRIBA (la zona de
mano del tarea.yaml es la franja z 12 a 16). Las aristas de abajo (cara de cama) quedan vivas a proposito: no las toca
nadie y la cama lleva chaflan, no R1,5 (G6). Las medidas son de ejemplo, del banco: no es un diseno de Barack.
Uso desde bien.py / mal_*.py: armar(radio_arriba, radio_vertical, nombre) -> exporta <carpeta>/<nombre>.stl y .step"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import carpeta_salida, salir_error  # noqa: E402


def armar(radio_arriba, radio_vertical, nombre):
    from build123d import Align, Axis, Box, export_step, export_stl, fillet
    out = carpeta_salida()
    tope = Box(60, 20, 15, align=(Align.CENTER, Align.CENTER, Align.MIN))
    if radio_vertical > 0:             # las 4 aristas verticales (llegan hasta donde va la mano)
        tope = fillet(tope.edges().filter_by(Axis.Z), radio_vertical)
    if radio_arriba > 0:               # el contorno de arriba, donde apoya la mano
        tope = fillet(tope.edges().group_by(Axis.Z)[-1], radio_arriba)
    if not tope.is_valid:
        salir_error('el tope no es valido')
    export_stl(tope, os.path.join(out, nombre + '.stl'))
    export_step(tope, os.path.join(out, nombre + '.step'))
    print('ok', round(tope.volume, 1))
