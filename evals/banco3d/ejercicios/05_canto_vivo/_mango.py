"""Comun del ejercicio 05: mango de prueba (barra 100 x 30 x 20 con agujero pasante de 8 en cada punta) redondeada con
el radio que se pida en TODAS sus aristas de afuera. Las medidas son de ejemplo, del banco: no es un diseno de Barack.
Uso desde bien.py / mal_*.py: armar(radio) -> exporta <carpeta>/<nombre>.stl y .step"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import carpeta_salida, salir_error  # noqa: E402


def armar(radio, nombre):
    from build123d import Box, Cylinder, Location, fillet, export_stl, export_step
    out = carpeta_salida()
    barra = Box(100, 30, 20)
    for x in (-38, 38):
        barra = barra - Cylinder(4, 30).moved(Location((x, 0, 0)))
    if radio > 0:                      # todas las aristas: las 12 de la barra y los 4 bordes de los agujeros
        barra = fillet(barra.edges(), radio)
    if not barra.is_valid:
        salir_error('el mango no es valido')
    export_stl(barra, os.path.join(out, nombre + '.stl'))
    export_step(barra, os.path.join(out, nombre + '.step'))
    print('ok', round(barra.volume, 1))
