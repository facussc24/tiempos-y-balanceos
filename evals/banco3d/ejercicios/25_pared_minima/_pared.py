"""Comun del ejercicio 25 (pared minima imprimible): las piezas de ensayo de 04_decision.md, 1.2, armadas aca con build123d
y SIN usar el codigo del control (espesor_pared.py trae las suyas para su autotest; estas son escritas aparte, para que
un error de geometria no pase por los dos lados).

  armar_bloque(w, nombre): bloque 40 x 20 x 10 con dos bolsillos (arriba y abajo, 32 x 12, borde de 4 mm) que dejan un
      alma de w mm en el medio, y un pin de 5 mm de diametro con punta conica de 4 mm (que termina en un vertice) sobre la
      cara del extremo x = 20. Las tres piezas de alma (1,6 / 0,30 / 0,60) solo cambian w.
  armar_cuna(nombre): cuna de 100 x 60 mm que va de 3 mm de espesor a 0,3 mm.
Medidas de ejemplo para el banco; no son un diseno de Barack. Exporta <carpeta>/<nombre>.step y .stl."""
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))
from _comun import carpeta_salida, salir_error  # noqa: E402


def _exportar(forma, nombre):
    from build123d import export_step, export_stl
    if not forma.is_valid or len(forma.solids()) != 1:
        salir_error(f'{nombre}: no es un solido valido de un solo cuerpo')
    out = carpeta_salida()
    export_stl(forma, os.path.join(out, nombre + '.stl'))
    export_step(forma, os.path.join(out, nombre + '.step'))
    print('ok', round(forma.volume, 3))


def armar_bloque(w, nombre):
    from build123d import Box, Cone, Cylinder, Pos, Rot
    bolsillo = 5.0 - w / 2.0                       # profundidad de cada bolsillo hasta la cara del alma
    arriba = Pos(0, 0, 5.0 - bolsillo / 2.0 + 0.5) * Box(32, 12, bolsillo + 1.0)    # sobresale 1 mm: sin cara coincidente
    abajo = Pos(0, 0, -(5.0 - bolsillo / 2.0 + 0.5)) * Box(32, 12, bolsillo + 1.0)
    bloque = Box(40, 20, 10) - arriba - abajo
    # pin de eje X: cuerpo de 10 mm + punta conica de 4 mm; la base entra 2 mm en el bloque para fundirse sin caras
    # coincidentes (la cara del extremo es x = 20)
    pin = Pos(20.0 - 2.0 + 5.0, 0, 0) * Rot(0, 90, 0) * (Cylinder(2.5, 10.0) + Pos(0, 0, 7.0) * Cone(2.5, 0.0, 4.0))
    _exportar(bloque + pin, nombre)


def armar_cuna(nombre):
    from build123d import Face, Vector, Wire, extrude
    perfil = Wire.make_polygon([Vector(0, 0, 0), Vector(100, 0, 0), Vector(100, 0, 0.3), Vector(0, 0, 3.0)], close=True)
    _exportar(extrude(Face(perfil), amount=60.0, dir=Vector(0, 1, 0)), nombre)
