"""ej31 — Too Tall Toby Party Pack 01-10 «Light Cap» (plano libre para uso educativo, @tootalltoby), gemelo build123d.
Seccion de punta (plano XZ): afuera = arco R40 con centro (0, 6) (cima en z 46) y lados TANGENTES desde la base (+-42, 0);
adentro = la misma forma corrida 8 hacia adentro, cortada en el techo plano z = 30 (46 - 16) con R8 en esas esquinas; la base
abierta. La seccion se extruye 100 (y -50..50) y las puntas son la media seccion revolucionada alrededor de los ejes
verticales en y = +-50 (largo total 184). ABS 1020 kg/m3. Respuesta: 211,30 g (+-1)."""
import math

from build123d import (Axis, BuildLine, BuildSketch, Circle, Location, Plane, Polyline, Rectangle, export_step,
                       extrude, fillet, make_face, offset, revolve, Pos)


def tangente(px, pz, cx, cz, r):
    """Punto de tangencia (lado de afuera, x > 0) desde (px, pz) a la circunferencia (cx, cz, r)."""
    dx, dz = px - cx, pz - cz
    d2 = dx * dx + dz * dz
    t = math.sqrt(d2 - r * r)
    a = math.atan2(dz, dx)
    b = math.asin(r / math.sqrt(d2))
    ang = a + b       # el tangente que queda arriba
    tx, tz = px - t * math.cos(ang - 0), pz - t * math.sin(ang - 0)
    return tx, tz


def seccion():
    # afuera, extendida 30 por debajo de la base siguiendo la recta tangente (para que el corrido de adentro sea recto)
    c = (0.0, 6.0)
    with BuildSketch(Plane.XZ) as s:
        Circle(40).moved(Location((0, 6))) if False else None
    circ = Circle(40).moved(Location((0, 6, 0)))
    tri_pts = []
    for sx in (1, -1):
        px, pz = 42.0 * sx, 0.0
        # tangente desde (px, 0) a la circunferencia: el punto de contacto
        dx, dz = c[0] - px, c[1] - pz
        d = math.hypot(dx, dz)
        th = math.atan2(dz, dx)
        al = math.asin(40 / d)
        ang = th - al * sx                    # rama de afuera
        L = math.sqrt(d * d - 40 * 40)
        tx, tz = px + L * math.cos(ang), pz + L * math.sin(ang)
        ux, uz = (px - tx) / L, (pz - tz) / L  # direccion de la tangente hacia abajo
        tri_pts.append(((px + 30 * ux, pz + 30 * uz), (tx, tz)))
    return circ, tri_pts


def pieza():
    from build123d import ConvexHull, Face, Wire, make_hull
    circ, tp = seccion()
    pts = [tp[0][0], tp[1][0]]
    from build123d import Locations
    with BuildSketch() as afuera_ext:
        with Locations((0, 6)):
            Circle(40)
        with BuildLine():
            Polyline(tp[0][0], tp[0][1], tp[1][1], tp[1][0], close=True)
        make_face()
    hull = make_hull(afuera_ext.sketch.edges())
    afuera = hull & Pos(0, 50) * Rectangle(200, 100)                  # z >= 0 (el croquis va en XY: y = z)
    adentro = offset(hull, -8) & Pos(0, -50 + 30) * Rectangle(200, 100)   # z <= 30
    esq = [v for v in adentro.vertices() if abs(v.Y - 30) < 1e-6 and abs(v.X) > 1]
    adentro = fillet(esq, 8)
    pared = afuera - adentro
    print("DIAG afuera", round(afuera.area, 1), "caja", [round(v, 2) for v in (afuera.bounding_box().min.X, afuera.bounding_box().max.X, afuera.bounding_box().min.Y, afuera.bounding_box().max.Y)], "adentro", round(adentro.area, 1), "tangentes", [[round(v, 2) for v in p] for t in tp for p in t])
    sec = Plane.XZ * pared                          # a la seccion de punta, en XZ
    medio = extrude(sec, 50, both=True)             # y -50..50
    media = sec & Plane.XZ * (Pos(50, 50) * Rectangle(100, 100))     # x >= 0
    punta = revolve(media, Axis.Z)                  # la media seccion revolucionada = las dos puntas juntas
    vol = medio.volume + punta.volume
    return pared, medio, punta, vol


if __name__ == "__main__":
    pared, medio, punta, vol = pieza()
    print(f"area seccion {pared.area:.3f}  medio {medio.volume:.3f}  puntas {punta.volume:.3f}  "
          f"vol {vol:.3f}  masa {vol * 1.02e-3:.2f} g")
