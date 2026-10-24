"""Contornos del Curved Support en coordenadas del croquis, para de_build123d.py.
placa(): envolvente de los dos circulos en XY (H = X, V = Y).  puente(): perfil del puente en (Y, Z) dibujado en XY
(el croquis de CATIA va en el plano YZ: H = Y, V = Z)."""
from build123d import BuildLine, BuildSketch, Circle, Line, Locations, Polyline, ThreePointArc, make_face, make_hull

from gemelo import geometria, punto_en


def placa():
    with BuildSketch() as h:
        Circle(27.5)
        with Locations((0, 125)):
            Circle(15)
    return make_hull(h.sketch.edges())


def puente():
    g = geometria()
    with BuildSketch() as p:
        with BuildLine():
            Line((27.5, 50), g["l8"])
            ThreePointArc(g["l8"], punto_en(g["c30"], 30, g["l8"], g["i"]), g["i"])
            ThreePointArc(g["i"], punto_en(g["c66"], 66, g["i"], g["lh"]), g["lh"])
            Polyline(g["lh"], (125, 32), (125, 0), (0, 0), (0, 50), (27.5, 50))
        make_face()
    return p.sketch
