"""Contornos del Buffer Stand en MILIMETROS y en las coordenadas de cada croquis de CATIA, para de_build123d.py.
planta(): XY (H = X, V = Y).  punta() y nervio(): YZ (H = Y, V = Z).  hueco(): ZX (H = Z, V = X)."""
from build123d import BuildLine, BuildSketch, Polyline, Pos, RectangleRounded, ThreePointArc, make_face, scale

from gemelo import trapecio_redondo

IN = 25.4


def planta():
    with BuildSketch() as pl:
        with BuildLine():
            Polyline((2.5, -1.25), (-2.5, -1.25))
            ThreePointArc((-2.5, -1.25), (-2.75, 0), (-2.5, 1.25))
            Polyline((-2.5, 1.25), (2.5, 1.25))
            ThreePointArc((2.5, 1.25), (2.75, 0), (2.5, -1.25))
        make_face()
    return scale(pl.sketch, IN)


def punta():
    return scale(trapecio_redondo(2.5, 4.0, 6.0)[0], IN)


def nervio():
    return scale(trapecio_redondo(0.5, 1.0, 8.0, z0=0.25)[0], IN)


def hueco():
    # en ZX el croquis tiene H = Z y V = X: rectangulo redondeado de z 0,25..7,75 (centro 4) y x +-2,125
    # en mm directo: scale() NO escala el corrimiento de un Pos (quedo centrado en 4 mm, 19/10)
    return Pos(4.0 * IN, 0) * RectangleRounded(7.5 * IN, 4.25 * IN, 0.5 * IN)
