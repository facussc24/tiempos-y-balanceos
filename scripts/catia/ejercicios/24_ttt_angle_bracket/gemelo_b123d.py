"""ej34 — Too Tall Toby Party Pack 01-04 «Angle Bracket» (plano libre para uso educativo, @tootalltoby), gemelo build123d.
Base D38 z 0..20, resalto D26 z 20..28, agujero D16 pasante; brazo x 0..61, z 0..7 (hecho de 53 de ancho para el R4 y
recortado a 38); R4 donde el brazo toca la base; pata x 51..61, y +-19, z -23..0; R10 afuera y R5 adentro del doblez;
ranura de 18 (R9) que sube 17 desde abajo, 5 de profundo desde x 61; ranura de 12 (R6) que sube 14, pasante.
Acero 7800 kg/m3. Respuesta: 310 g (+-1)."""
from build123d import (Align, Axis, Box, Cylinder, Location, Plane, Pos, Rot, SlotOverall, export_step, extrude, fillet)

MIN = (Align.MIN, Align.MIN, Align.MIN)
A = (Align.CENTER, Align.CENTER, Align.MIN)


def cerca_circulo_z7(e):
    c = e.center()
    return abs(c.Z - 7) < 1e-6 and e.geom_type.name == "CIRCLE" and abs(e.radius - 19) < 1e-6


def pieza(brazo_ancho=53.0):
    s = Cylinder(19, 20, align=A) + Pos(0, 0, 20) * Cylinder(13, 8, align=A)
    s = s + Pos(0, -brazo_ancho / 2, 0) * Box(61, brazo_ancho, 7, align=MIN)
    s = fillet([e for e in s.edges() if cerca_circulo_z7(e)], 4)
    if brazo_ancho > 38:
        for sy in (1, -1):
            s = s - Pos(0, 19 if sy > 0 else -19 - 10, 0) * Box(61, 10, 15, align=MIN)
    s = s - Cylinder(8, 28, align=A)
    s = s + Pos(51, -19, -23) * Box(10, 38, 23, align=MIN)
    afuera = [e for e in s.edges().filter_by(Axis.Y) if abs(e.center().X - 61) < 1e-6 and abs(e.center().Z - 7) < 1e-6]
    s = fillet(afuera, 10)
    adentro = [e for e in s.edges().filter_by(Axis.Y) if abs(e.center().X - 51) < 1e-6 and abs(e.center().Z) < 1e-6]
    s = fillet(adentro, 5)
    plano = Plane.YZ.offset(61)                      # normal +X: la ranura se corta hacia -X
    s = s - extrude(plano * Pos(0, -23) * Rot(0, 0, 90) * SlotOverall(34, 18), -5)
    s = s - extrude(plano * Pos(0, -23) * Rot(0, 0, 90) * SlotOverall(28, 12), -10)
    return s, len(afuera), len(adentro)


if __name__ == "__main__":
    import json
    import sys
    r = pieza()
    s = r[0] if isinstance(r, tuple) else r
    if len(sys.argv) > 1:
        export_step(s, sys.argv[1])
    print(json.dumps({"volumen": round(s.volume, 3), "solidos": len(s.solids())}))
