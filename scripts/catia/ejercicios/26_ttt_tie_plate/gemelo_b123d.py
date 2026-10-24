"""ej35 — Too Tall Toby Party Pack 01-08 «Tie Plate» (plano libre para uso educativo, @tootalltoby), gemelo build123d.
Placa (z 0..16): rectangulo x +-61, y +-81, unido a dos ranuras 66 x 190 (largo sobre Y) centradas en x = +-61; agujeros
D29 en (+-61, +-62) y D84 en el centro. Orejas (x +-45..125 espejadas): perfil en XZ (45,0) (85,-19) (125,-19) (125,11)
(45,11) con agujero D11 en (x 111, z -5), y +-10, recortadas a una tira y +-4 de x 45 a 125 mas un bloque y +-10 de x 85
a 125. Acero 7800 kg/m3. Respuesta: 3 387,06 g (+-1)."""
from build123d import (Align, Box, BuildLine, BuildSketch, Circle, Cylinder, Location, Locations, Plane, Polyline, Pos,
                       Rectangle, Rot, SlotOverall, export_step, extrude, make_face, mirror)

A = (Align.CENTER, Align.CENTER, Align.MIN)


def pieza():
    with BuildSketch() as s:
        Rectangle(122, 162)
        with Locations((61, 0), (-61, 0)):
            SlotOverall(190, 66, rotation=90)
    placa = extrude(s.sketch, 16)
    for x in (61, -61):
        for y in (62, -62):
            placa = placa - Pos(x, y, 0) * Cylinder(14.5, 16, align=A)
    placa = placa - Cylinder(42, 16, align=A)
    with BuildSketch(Plane.XZ) as p:
        with BuildLine():
            Polyline((45, 0), (85, -19), (125, -19), (125, 11), (45, 11), close=True)
        make_face()
    oreja = extrude(p.sketch, 10, both=True)
    oreja = oreja - Location((111, 0, -5), (90, 0, 0)) * Cylinder(5.5, 40)
    recorte = Pos(85, 0, 0) * Box(80, 8, 60, align=(Align.MIN, Align.CENTER, Align.CENTER))
    recorte = Pos(45, 0, 0) * Box(80, 8, 60, align=(Align.MIN, Align.CENTER, Align.CENTER)) + \
        Pos(85, 0, 0) * Box(40, 20, 60, align=(Align.MIN, Align.CENTER, Align.CENTER))
    oreja = oreja & recorte
    s = placa + oreja + mirror(oreja, Plane.YZ)
    return s


if __name__ == "__main__":
    import json
    import sys
    r = pieza()
    s = r[0] if isinstance(r, tuple) else r
    if len(sys.argv) > 1:
        export_step(s, sys.argv[1])
    print(json.dumps({"volumen": round(s.volume, 3), "solidos": len(s.solids())}))
