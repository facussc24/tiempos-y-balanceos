"""ej37 — Too Tall Toby Party Pack 01-01 «Bearing Bracket» (plano libre para uso educativo, @tootalltoby), gemelo build123d.
Base 115 x 50 x 15 (x -57,5..57,5) con ranura pasante 90 x 12 (x -42,5..47,5); orejas de 12 (y 13..25 y -25..-13), de
x -57,5 a -5,5, z 0..68 con punta R26 centrada en z 42; R9 en el encuentro oreja/base (x -5,5, z 15); agujero D24 con
caja D34 x 4 desde la cara de afuera de cada oreja, en (x -31,5, z 42); esquinas verticales R6 (rectangulo 115 x 50 R6);
cola de milano abajo a lo largo de X: 18 de ancho en z 0, lados a 60 grados, 8 de alto (27,24 arriba).
Acero 7800 kg/m3. Respuesta: 797,15 g (+-1)."""
import math

from build123d import (Align, Axis, Box, BuildLine, BuildSketch, Cylinder, Location, Plane, Polyline, Pos,
                       RectangleRounded, SlotOverall, export_step, extrude, fillet, make_face, mirror)

MIN = (Align.MIN, Align.MIN, Align.MIN)


def oreja():
    o = Pos(-57.5, 13, 0) * Box(52, 12, 42, align=MIN) + Location((-31.5, 13, 42), (-90, 0, 0)) * Cylinder(26, 12, align=(Align.CENTER, Align.CENTER, Align.MIN))
    return o


def pieza():
    s = Pos(-57.5, -25, 0) * Box(115, 50, 15, align=MIN)
    s = s - extrude(Pos(2.5, 0) * SlotOverall(90, 12), 15)
    o = oreja()
    s = s + o + mirror(o, Plane.XZ)
    r9 = [e for e in s.edges().filter_by(Axis.Y) if abs(e.center().X + 5.5) < 1e-6 and abs(e.center().Z - 15) < 1e-6]
    s = fillet(r9, 9)
    for sy in (1, -1):      # D24 pasante + caja D34 x 4 desde la cara de afuera (y = +-25)
        s = s - Location((-31.5, 0, 42), (90, 0, 0)) * Cylinder(12, 60)
        s = s - Location((-31.5, sy * 25, 42), (90 if sy > 0 else -90, 0, 0)) * Cylinder(17, 8)
    s = s & extrude(RectangleRounded(115, 50, 6), 80)
    t = math.tan(math.radians(60))
    yb = 9 + 8 / t
    with BuildSketch(Plane.YZ) as c:
        with BuildLine():
            Polyline((-9, 0), (9, 0), (yb, 8), (-yb, 8), close=True)
        make_face()
    s = s - extrude(c.sketch, 57.5, both=True)
    return s, len(r9)


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
