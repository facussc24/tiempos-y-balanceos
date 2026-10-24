"""ej30 — Too Tall Toby Party Pack 01-02 «Post Cap» (plano libre para uso educativo, @tootalltoby), gemelo build123d.
Lectura: tapa por revolucion, afuera D49 x 48 con el borde de arriba en cuarto de elipse (20 horizontal x 8 vertical,
centro en r 4,5 / z 40); hueco D42 abajo, alto 37, desmolde 4 grados hacia adentro, R3 en la esquina de arriba; asa por
barrido de una elipse 4 (en el plano del arco) x 10 (perpendicular) por un arco R17 con centro a 15 del eje y a 20 de
abajo (semicirculo del lado de afuera; lo que entra al hueco lo saca el hueco). R1 en el encuentro: aparte.
ABS 1020 kg/m3. Respuesta: 43,09 g."""
import math

from build123d import (AngularDirection, Axis, BuildLine, BuildPart, BuildSketch, CenterArc, Ellipse, EllipticalCenterArc, Line,
                       Location, Plane, Polyline, export_step, fillet, make_face, revolve, sweep)

T4 = math.tan(math.radians(4))


def pieza(r1=False):
    with BuildSketch(Plane.XZ) as afuera:
        with BuildLine():
            Polyline((0, 48), (0, 0), (24.5, 0), (24.5, 40))
            EllipticalCenterArc((4.5, 40), 20, 8, start_angle=0, end_angle=90, angular_direction=AngularDirection.COUNTER_CLOCKWISE)
            Line((4.5, 48), (0, 48))
        make_face()
    tapa = revolve(afuera.sketch, Axis.Z)
    # el arco en el plano XZ: centro (x=-15, z=20), de arriba (90 grados) a abajo (270) por afuera (x negativo)
    with BuildLine(Plane.XZ) as cl:
        CenterArc((-15, 20), 17, 90, 180)
    path = cl.line
    inicio = path @ 0
    radial = inicio - path.edges()[0].arc_center
    perfil = Plane(origin=inicio, x_dir=radial, z_dir=path % 0) * Ellipse(2, 5)    # 4 en el plano del arco, 10 afuera
    asa = sweep(perfil, path=path)
    s = tapa + asa
    with BuildSketch(Plane.XZ) as adentro:
        with BuildLine():
            Polyline((0, -1), (21 + T4, -1), (21 - 37 * T4, 37), (0, 37), (0, -1))
        make_face()
    hueco = revolve(adentro.sketch, Axis.Z)
    hueco = fillet([e for e in hueco.edges() if abs(e.center().Z - 37) < 1e-3 and e.length > 60], 3)
    s = s - hueco
    return s, asa.volume


if __name__ == "__main__":
    import json
    import sys
    s, va = pieza()
    if len(sys.argv) > 1:
        export_step(s, sys.argv[1])
    print(json.dumps({"volumen": round(s.volume, 3), "asa": round(va, 3), "solidos": len(s.solids())}))
