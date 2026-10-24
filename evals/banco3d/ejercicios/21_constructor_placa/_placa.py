"""Comun del ejercicio 21: la brida del macho del virolador del 20/10 (64 x 24 x 4 mm con chaflan de cama 0,6; medidas
de C:\\Dev\\_catia_practica\\virolador_auto\\fase3.py machos(): rrect(xc-32, yc-12, xc+32, yc+12), de Z_PLACA_SUP -20,28
a -16,28, abajo=0.6), apoyada en z = 0 y centrada en XY. Sin los dos agujeros de 5,5 (el constructor da la placa; los
agujeros se agregan aparte) y con el radio de la casa (R1,5) en vez del R3 de las esquinas.
  armar_biblioteca(nombre): cadlib.constructores.placa(64, 24, 4, chaflan_cama=0.6).
  armar_cama_con_filete(nombre): igual pero el contorno de la cama con filete R0,6 (lo que G6 prohibe).
  armar_cama_viva(nombre): R1,5 arriba y en las verticales, la cama sin chaflan.
  armar_escalones_20_10(nombre): como lo dejo fase3.py en CATIA con pad_chaflan() de pulir.py: el «chaflan» son 3
      escalones de 0,2 mm (contorno con esquinas de poligono rrect, achicado 0,6 / 0,4 / 0,2), arriba vivo.
El tamano 0,6 es el que uso la casa el 20/10 (sin validar; lenguaje_diseno.json lo deja A DECIDIR): el corrector juzga
el angulo, no el tamano. Exporta <carpeta>/<nombre>.step y .stl."""
import math
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))
sys.path.insert(0, os.path.normpath(os.path.join(AQUI, '..', '..', '..', '..', '.claude', 'skills', 'cad-design', 'scripts')))
from _comun import carpeta_salida, salir_error  # noqa: E402

LARGO, ANCHO, ESP, CH, R = 64.0, 24.0, 4.0, 0.6, 1.5


def _exportar(forma, nombre):
    from build123d import export_step, export_stl
    if not forma.is_valid or len(forma.solids()) != 1:
        salir_error(f'{nombre}: no es un solido valido')
    out = carpeta_salida()
    export_stl(forma, os.path.join(out, nombre + '.stl'))
    export_step(forma, os.path.join(out, nombre + '.step'))
    print('ok', round(forma.volume, 3))


def _base():
    from build123d import Align, Axis, Box, fillet
    b = Box(LARGO, ANCHO, ESP, align=(Align.CENTER, Align.CENTER, Align.MIN))
    b = fillet(b.edges().filter_by(Axis.Z), R)
    return fillet(b.edges().group_by(Axis.Z)[-1], R)


def armar_biblioteca(nombre):
    from cadlib import constructores as k
    _exportar(k.placa(LARGO, ANCHO, ESP, chaflan_cama=CH), nombre)


def armar_cama_con_filete(nombre):
    from build123d import Axis, fillet
    b = _base()
    _exportar(fillet(b.edges().group_by(Axis.Z)[0], CH), nombre)


def armar_cama_viva(nombre):
    _exportar(_base(), nombre)


def rrect(x0, y0, x1, y1, r, n=6):
    """copia textual de pulir.py rrect() del 20/10"""
    r = min(r, (x1 - x0) / 2 - 1e-3, (y1 - y0) / 2 - 1e-3)
    pts = []
    for cx, cy, a0 in ((x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def armar_escalones_20_10(nombre):
    """pad_chaflan(abajo=0.6, paso=0.2) de pulir.py con el perfil de la brida de fase3.py: rrect(..., 3 - i/2)"""
    from build123d import Plane, Polyline, extrude, make_face
    x0, y0, x1, y1 = -LARGO / 2, -ANCHO / 2, LARGO / 2, ANCHO / 2

    def prisma(ins, za, zb):
        pts = rrect(x0 + ins, y0 + ins, x1 - ins, y1 - ins, 3 - ins / 2)
        pts = [p for i, p in enumerate(pts) if i == 0 or math.dist(p, pts[i - 1]) > 1e-6]
        cara = make_face(Polyline(*pts, close=True))
        return extrude(cara.moved(Plane.XY.offset(za).location), amount=zb - za)
    paso, abajo = 0.2, CH
    n = int(round(abajo / paso))
    forma = prisma(0.0, n * paso, ESP)
    for i in range(n):
        forma = forma + prisma(abajo - i * paso, i * paso, (i + 1) * paso)
    _exportar(forma.clean(), nombre)
