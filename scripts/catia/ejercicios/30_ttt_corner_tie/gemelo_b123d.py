"""ej40 — Too Tall Toby Party Pack 01-09 «Corner Tie» (plano libre para uso educativo, @tootalltoby), gemelo build123d.
Placa: x -69..0, y +-37,5, z 0..13, R17 en las esquinas de x -69, 2 x D8 con caja D15 x 4 desde arriba en (-52, +-20,5).
Alma (x -13..0): perfil en YZ = circulo R15 centro z 45 con D12, tangentes hasta la base (+-37,5; 0). Pestana a 45 grados:
plano por el origen con normal (1,0,1)/V2, rectangulo de largo 26,14 (45·2/V2 - 37,5... = hasta el centro del disco) y
75 de ancho + disco R37,5 con D33, espesor 6 hacia la normal; se completa hasta el alma (cara de arranque extendida) y R16
en el encuentro. Aluminio 2700 kg/m3. Respuesta: 307,23 g (+-1)."""
import math

from build123d import (Align, Axis, Box, BuildLine, BuildSketch, Circle, Cylinder, Line, Location, Locations, Mode,
                       Plane, Polyline, Pos, Rectangle, export_step, extrude, fillet, make_face, mirror)

A = (Align.CENTER, Align.CENTER, Align.MIN)
S2 = math.sqrt(2)


def tangente_desde(p, c, r, lado):
    """Punto de contacto de la tangente desde p a la circunferencia (c, r); lado +1 / -1 elige la rama."""
    dx, dy = p[0] - c[0], p[1] - c[1]
    d = math.hypot(dx, dy)
    a = math.atan2(dy, dx)
    b = math.acos(r / d)
    t = a + lado * b
    return (c[0] + r * math.cos(t), c[1] + r * math.sin(t))


def pieza(r16=True):
    with BuildSketch() as pl:
        with Locations((-34.5, 0)):
            Rectangle(69, 75)
    placa = extrude(pl.sketch, 13)
    esq = [e for e in placa.edges().filter_by(Axis.Z) if abs(e.center().X + 69) < 1e-6]
    placa = fillet(esq, 17)
    for y in (20.5, -20.5):
        placa = placa - Pos(-52, y, 0) * Cylinder(4, 13, align=A) - Pos(-52, y, 9) * Cylinder(7.5, 4, align=A)
    # alma en YZ (local x = Y, y = Z)
    # los lados del alma son tangentes al R15 con 75 grados ENTRE ellos (vista lateral), no rectas a la esquina de la
    # base: tocan el circulo a 37,5 grados y llegan al borde y = 37,5 en z ~20,8, con un tramo vertical abajo
    a = math.radians(37.5)
    t1 = (15 * math.cos(a), 45 + 15 * math.sin(a))
    d = (math.sin(a), -math.cos(a))
    k = (37.5 - t1[0]) / d[0]
    z1 = t1[1] + k * d[1]
    t2 = (-t1[0], t1[1])
    with BuildSketch(Plane.YZ) as al:
        with BuildLine():
            from build123d import ThreePointArc
            Polyline(t2, (-37.5, z1), (-37.5, 0), (37.5, 0), (37.5, z1), t1)
            ThreePointArc(t1, (0, 60), t2)
        make_face()
        with Locations((0, 45)):
            Circle(6, mode=Mode.SUBTRACT)
    alma = extrude(al.sketch, -13)                       # Plane.YZ normal +X: hacia -X (x -13..0)
    # pestana
    n = (1 / S2, 0, 1 / S2)
    xd = (1 / S2, 0, -1 / S2)
    pp = Plane(origin=(0, 0, 0), x_dir=xd, z_dir=n)
    L = 45 * 2 / S2 - 37.5                               # 26,14
    with BuildSketch(pp) as pe:
        with Locations((L / 2, 0)):
            Rectangle(L, 75)
        with Locations((L, 0)):
            Circle(37.5)
            Circle(16.5, mode=Mode.SUBTRACT)
    pestana = extrude(pe.sketch, 6)
    # completar entre la pestana y el alma: la cara de arranque (normal (-1,0,1)) extendida hasta x = 0
    tri_pts = [(0, 0), (6 / S2, 6 / S2), (0, 6 * S2)]       # (x, z): triangulo entre el alma (x 0) y la cara de arranque
    with BuildSketch(Plane.XZ) as tr:
        with BuildLine():
            Polyline(*tri_pts, close=True)
        make_face()
    relleno = extrude(tr.sketch, 37.5, both=True)
    s = placa + alma + pestana + relleno
    if r16:
        cand = [e for e in s.edges().filter_by(Axis.Y) if abs(e.center().X) < 1e-3 and e.center().Z > 0.1
                and abs(e.length - 75) < 1e-3]
        s = fillet(cand, 16) if cand else s
    return s


if __name__ == "__main__":
    import json
    import sys
    r = pieza()
    s = r[0] if isinstance(r, tuple) else r
    if len(sys.argv) > 1:
        export_step(s, sys.argv[1])
    c = s.center()                  # 24/10, pedido 10 de la principal: el centro, contra el de CATIA
    print(json.dumps({"volumen": round(s.volume, 3), "solidos": len(s.solids()),
                      "cdg": [round(c.X, 4), round(c.Y, 4), round(c.Z, 4)]}))
