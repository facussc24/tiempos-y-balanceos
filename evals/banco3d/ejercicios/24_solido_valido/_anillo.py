# -*- coding: utf-8 -*-
"""Comun del ejercicio 24: el anillo de ensayo del defecto de la v13 (memoria project_uppertrim_pisador_utillaje.md
l.58-62; 04_decision.md l.26 de la investigacion del 24/10/2026): contorno de 40 x 20 con esquinas R2,22 y el borde
interior retirado 2,55 mm.

  armar(False, nombre): el retiro es PUNTO A PUNTO (cada punto del contorno se corre 2,55 sobre su normal): como 2,55 es
                        mayor que el radio de la esquina (2,22), el arco se da vuelta y el borde interior se cruza.
  armar(True, nombre):  el MISMO contorno con un retiro de verdad (shapely.buffer, como macho.interior_limpio de la v14).

40 x 20, R2,22 y 2,55 salen del papel. La placa de 60 x 40 x 5 que sostiene el anillo y su alto de 3 mm son de ensayo del
banco: no salen de ningun papel ni son un diseno de Barack. Exporta <carpeta de salida>/<nombre>.step."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _comun import carpeta_salida, salir_error  # noqa: E402

A, B, R, RETIRO, ALTO = 40.0, 20.0, 2.22, 2.55, 3.0


def _contorno(n_arco=24):
    """Puntos (x, y) del rectangulo A x B con esquinas R, antihorario, y la normal hacia afuera de cada punto."""
    pts = []
    cx, cy = A / 2 - R, B / 2 - R
    for x0, y0, a0 in ((cx, cy, 0), (-cx, cy, 90), (-cx, -cy, 180), (cx, -cy, 270)):
        for k in range(n_arco + 1):
            a = math.radians(a0 + 90 * k / n_arco)
            n = (math.cos(a), math.sin(a))
            pts.append(((x0 + R * n[0], y0 + R * n[1]), n))
    return pts


def armar(limpio, nombre):
    from build123d import Align, Box, BuildPart, BuildSketch, Mode, Polygon, export_step, extrude
    out = carpeta_salida()
    exterior = [p for p, _ in _contorno()]
    if limpio:
        import shapely.geometry as sg
        interior = list(sg.Polygon(exterior).buffer(-RETIRO, join_style=1).exterior.coords)[:-1]
    else:
        interior = [(p[0] - RETIRO * n[0], p[1] - RETIRO * n[1]) for p, n in _contorno()]
    with BuildPart() as bp:
        Box(60, 40, 5, align=(Align.CENTER, Align.CENTER, Align.MAX))
        with BuildSketch():
            Polygon(*exterior, align=None)
            Polygon(*interior, align=None, mode=Mode.SUBTRACT)
        extrude(amount=ALTO)
    pieza = bp.part
    if limpio and not pieza.is_valid:
        salir_error('el anillo limpio no es valido: el ensayo no sirve de BIEN')
    export_step(pieza, os.path.join(out, nombre + '.step'))
    print('ok', 'is_valid', pieza.is_valid, 'solidos', len(pieza.solids()), 'vol', round(pieza.volume, 3))
