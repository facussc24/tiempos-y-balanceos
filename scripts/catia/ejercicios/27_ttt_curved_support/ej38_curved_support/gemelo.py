"""ej38 — Too Tall Toby 23-T-24 «Curved Support» (plano libre para uso educativo, @tootalltoby), gemelo build123d.
Cubo D55 z 0..60 (agujero D35), cubo D30 z 0..32 en (0, 125) (agujero D20), placa de abajo = envolvente de los dos
circulos, espesor t (plano: 10; guia: 11); puente de 11 (x +-5,5) con perfil en (Y, Z): recta desde (27,5; 50) que sube a
8 grados hasta tocar tangente un R30 (centro en Y 49,5 = 77 - 27,5), R30 tangente a un R66 concavo cuyo punto mas bajo
toca z 32, y z 32 hasta el cubo chico. Acero 7800 kg/m3. Respuesta: 1 294 g (+-3)."""
import math
import sys

from build123d import (Align, BuildLine, BuildSketch, Circle, Cylinder, Line, Locations, Plane, Polyline, Pos,
                       ThreePointArc, export_step, extrude, make_face, make_hull)

A = (Align.CENTER, Align.CENTER, Align.MIN)


def geometria():
    x30, y66 = 77 - 27.5, 66 + 32
    t8 = math.tan(math.radians(8))
    xl8 = x30 - 30 * math.sin(math.radians(8))           # contacto a la IZQUIERDA del centro: si no, la recta no es tangente
    # la recta (27,5; 50) -> l8 tiene pendiente tan 8 y l8 esta en el R30 con el radio a 8 grados de la vertical
    yl8 = 50 + t8 * (xl8 - 27.5)
    y30 = yl8 - 30 * math.cos(math.radians(8))
    x66 = x30 + math.sqrt(96 ** 2 - (y66 - y30) ** 2)       # la segunda solucion (del lado del cubo chico)
    c30, c66 = (x30, y30), (x66, y66)
    k = 30 / 96
    i = (c30[0] + k * (c66[0] - c30[0]), c30[1] + k * (c66[1] - c30[1]))
    return {"c30": c30, "c66": c66, "l8": (xl8, yl8), "i": i, "lh": (x66, 32.0)}


def punto_en(c, r, a, b):
    """Punto del medio del arco corto de centro c y radio r entre a y b."""
    ta = math.atan2(a[1] - c[1], a[0] - c[0])
    tb = math.atan2(b[1] - c[1], b[0] - c[0])
    d = (tb - ta + math.pi) % (2 * math.pi) - math.pi
    t = ta + d / 2
    return (c[0] + r * math.cos(t), c[1] + r * math.sin(t))


def pieza(t_placa=10.0):
    g = geometria()
    with BuildSketch(Plane.YZ) as p:
        with BuildLine():
            Line((27.5, 50), g["l8"])
            ThreePointArc(g["l8"], punto_en(g["c30"], 30, g["l8"], g["i"]), g["i"])
            ThreePointArc(g["i"], punto_en(g["c66"], 66, g["i"], g["lh"]), g["lh"])
            Polyline(g["lh"], (125, 32), (125, 0), (0, 0), (0, 50), (27.5, 50))
        make_face()
    puente = extrude(p.sketch, 5.5, both=True)
    with BuildSketch() as h:
        Circle(27.5)
        with Locations((0, 125)):
            Circle(15)
    placa = extrude(make_hull(h.sketch.edges()), t_placa)
    s = Cylinder(27.5, 60, align=A) + Pos(0, 125, 0) * Cylinder(15, 32, align=A) + placa + puente
    s = s - Cylinder(17.5, 100, align=A) - Pos(0, 125, 0) * Cylinder(10, 100, align=A)
    return s, g


if __name__ == "__main__":
    for t in (10.0, 11.0):
        s, g = pieza(t)
        print(f"placa {t}: vol {s.volume:.3f} masa {s.volume * 7.8e-3:.2f} g solidos {len(s.solids())}")
    print({k: tuple(round(v, 4) for v in val) for k, val in g.items()})
    export_step(pieza(10.0)[0], r"C:\Dev\_catia_practica\ej38_curved_support\gemelo.step")
