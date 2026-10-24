"""ej36 — Too Tall Toby Party Pack 01-06 «Bearing Jig» (plano libre para uso educativo, @tootalltoby), gemelo build123d.
Perfil (XY): arriba recta y = 69 de 0 a 22, oreja R10 centro (+-22, 59) hasta su punto a -45 grados, recta a 45 grados
hasta x = 15 (y 37,86), R12 ahi, vertical hasta (15, 15), arco R15 centro (0, 15) hasta (0, 0); espejado. Agujeros D13
en (+-22, 59), D12 en (0, 15) con chavetero 4 de ancho hasta y = 24. Placa z -11..11; cubo D30 z -25..0 con R6 en el
encuentro, todo recortado al perfil; ranura de 10 (z +-5) desde arriba con 42 de profundidad (y 27) segun el plano.
Acero 7800 kg/m3. Respuesta: 328,02 g (+-1)."""
import math
import sys

from build123d import (Align, Axis, Box, BuildLine, BuildSketch, Circle, CenterArc, Cylinder, Line, Locations, Mode,
                       Plane, Pos, Rectangle, export_step, extrude, fillet, make_face, mirror)


def perfil(con_agujeros=True):
    a = math.radians(-45)
    p1 = (22 + 10 * math.cos(a), 59 + 10 * math.sin(a))          # (29,07; 51,93)
    yb = p1[1] - (p1[0] - 15)                                      # 37,86
    with BuildSketch() as s:
        with BuildLine() as l:
            Line((0, 69), (22, 69))
            CenterArc((22, 59), 10, 90, -135)
            Line(p1, (15, yb))
            Line((15, yb), (15, 15))
            CenterArc((0, 15), 15, 0, -90)
            mirror(about=Plane.YZ)
        make_face()
        esq = [v for v in s.vertices() if abs(abs(v.X) - 15) < 1e-6 and abs(v.Y - yb) < 1e-6]
        fillet(esq, 12)
        if con_agujeros:
            with Locations((22, 59), (-22, 59)):
                Circle(6.5, mode=Mode.SUBTRACT)
            with Locations((0, 15)):
                Circle(6, mode=Mode.SUBTRACT)
            with Locations((0, 19.5)):
                Rectangle(4, 9, mode=Mode.SUBTRACT)
    return s.sketch, len(esq)


def pieza(fondo_ranura=27.0):
    sk, n12 = perfil()
    cuerpo = Box(200, 200, 22) + Pos(0, 15, -25) * Cylinder(15, 25, align=(Align.CENTER, Align.CENTER, Align.MIN))
    unir = [e for e in cuerpo.edges() if e.geom_type.name == "CIRCLE" and abs(e.center().Z + 11) < 1e-6 and abs(e.radius - 15) < 1e-6]
    cuerpo = fillet(unir, 6)
    cuerpo = cuerpo & extrude(Plane.XY.offset(11) * sk, -36)
    cuerpo = cuerpo - Pos(0, fondo_ranura, -5) * Box(69, 69, 10, align=(Align.CENTER, Align.MIN, Align.MIN))
    return cuerpo, n12, len(unir)


if __name__ == "__main__":
    for fondo in (27.0, 12.0):
        s, n12, n6 = pieza(fondo)
        print(f"fondo de la ranura y = {fondo}: R12 {n12} R6 {n6} vol {s.volume:.3f} masa {s.volume * 7.8e-3:.2f} g solidos {len(s.solids())}")
    export_step(pieza(27.0)[0], r"C:\Dev\_catia_practica\ej36_bearing_jig\gemelo.step")
