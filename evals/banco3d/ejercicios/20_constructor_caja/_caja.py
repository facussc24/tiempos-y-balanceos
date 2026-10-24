"""Comun del ejercicio 20: la caja del pedestal de la palanca del virolador del 20/10 (52 x 30 x 53,11 mm, medidas de
C:\\Dev\\_catia_practica\\virolador_auto\\pulir.py pedestal(): x XC-26..XC+26, y Y_B2-6..Y_B2+24, z de Z_PLACA_SUP -20,28
a la cara Z_B2 - 9,83 = 32,83 con Z_B2 42,66 de moviles.json), apoyada en z = 0 y centrada en XY.
  armar_biblioteca(nombre): con el constructor de la casa (cadlib.constructores.caja), como tiene que salir hoy.
  armar_pelada(nombre): Box a mano, sin el constructor (las «cajas peladas» del 20/10, anexo 00 causa 3).
  armar_pedestal_20_10(nombre): la geometria que dejo pulir.py el 20/10 en CATIA: contorno con esquinas R6 hechas con un
      POLIGONO de 6 tramos por esquina (rrect n=6), hueco de paredes 4 con esquinas R2 y tapa de 6, contorno de arriba vivo.
Exporta <carpeta>/<nombre>.step y .stl."""
import math
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))
sys.path.insert(0, os.path.normpath(os.path.join(AQUI, '..', '..', '..', '..', '.claude', 'skills', 'cad-design', 'scripts')))
from _comun import carpeta_salida, salir_error  # noqa: E402

LARGO, ANCHO = 52.0, 30.0
ALTO = round((42.66 - 9.83) - (-20.28), 2)        # 53,11
PARED, TAPA = 4.0, 6.0


def _exportar(forma, nombre):
    from build123d import export_step, export_stl
    if not forma.is_valid or len(forma.solids()) != 1:
        salir_error(f'{nombre}: no es un solido valido')
    out = carpeta_salida()
    export_stl(forma, os.path.join(out, nombre + '.stl'))
    export_step(forma, os.path.join(out, nombre + '.step'))
    print('ok', round(forma.volume, 3))


def armar_biblioteca(nombre):
    from cadlib import constructores as k
    _exportar(k.caja(LARGO, ANCHO, ALTO), nombre)


def armar_pelada(nombre):
    from build123d import Align, Box
    _exportar(Box(LARGO, ANCHO, ALTO, align=(Align.CENTER, Align.CENTER, Align.MIN)), nombre)


def rrect(x0, y0, x1, y1, r, n=6):
    """copia textual de pulir.py rrect() del 20/10: rectangulo con esquinas redondeadas como POLIGONO"""
    r = min(r, (x1 - x0) / 2 - 1e-3, (y1 - y0) / 2 - 1e-3)
    pts = []
    for cx, cy, a0 in ((x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def armar_pedestal_20_10(nombre):
    from build123d import Plane, Polyline, extrude, make_face
    x0, y0, x1, y1 = -LARGO / 2, -ANCHO / 2, LARGO / 2, ANCHO / 2

    def prisma(pts, z0, h):
        limpios = [p for i, p in enumerate(pts) if i == 0 or math.dist(p, pts[i - 1]) > 1e-6]
        cara = make_face(Polyline(*limpios, close=True))
        return extrude(cara.moved(Plane.XY.offset(z0).location), amount=h)
    exterior = prisma(rrect(x0, y0, x1, y1, 6), 0.0, ALTO)
    hueco = prisma(rrect(x0 + PARED, y0 + PARED, x1 - PARED, y1 - PARED, 2), 0.0, ALTO - TAPA)
    _exportar(exterior - hueco, nombre)
