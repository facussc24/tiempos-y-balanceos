"""ej39 — Too Tall Toby 24-SPO-06 «Buffer Stand» (plano libre para uso educativo, @tootalltoby), gemelo build123d en
PULGADAS (se escala x25,4 al final). Media pieza x >= 0 y espejo YZ. Montante: planta = rectangulo x 0..1,25, y +-1,25 con
la punta en arco por (2,75; 0), alto 4; recortado al trapecio de punta (base 2,5, 6 grados por lado, alto 4, punta redonda
llena). Hueco interior: x 0..2,125, z 0,25..7,75 con R0,5 en las esquinas; el resalte (circulo de la punta redonda) queda
de x 1,75 a 2,125. Agujero D0,625 pasante sobre X con caja D1,25 x 0,5. Nervio: trapecio base 0,5, 8 grados por lado,
z 0,25..1,25 con punta redonda, de x 0 a 2,125. Acero 7800 kg/m3. Respuesta: 3,923 lb (+-0,02)."""
import math
import sys

from build123d import (Align, Axis, Box, BuildLine, BuildSketch, Circle, Cylinder, Line, Location, Locations, Plane,
                       Polyline, Pos, RectangleRounded, Rot, ThreePointArc, export_step, extrude, make_face, mirror,
                       scale)

IN = 25.4


def trapecio_redondo(base, alto, ang_lado, z0=0.0):
    """Trapecio centrado en Y, de z0 a z0+alto, lados a ang_lado de la vertical, con la punta redondeada llena (un
    circulo tangente a los dos lados y a la arista de arriba). Devuelve (cara_en_XY_local (y, z), centro, radio)."""
    t = math.tan(math.radians(ang_lado))
    arriba = base - 2 * alto * t
    # circulo tangente a los dos lados y a la recta z = z0 + alto
    # centro en y = 0, z = zc; distancia a un lado = r, distancia a la tapa = r -> zc = z0 + alto - r
    # lado derecho: pasa por (base/2, z0) con direccion (-sin, cos); distancia de (0, zc) al lado = r
    s, c = math.sin(math.radians(ang_lado)), math.cos(math.radians(ang_lado))
    # recta: n = (c, s) normal hacia afuera; n . (p - p0) = 0 con p0 = (base/2, z0); distancia = -(n . ((0, zc) - p0))
    # -(c*(0 - base/2) + s*(zc - z0)) = r  y  zc = z0 + alto - r
    r = (c * base / 2 - s * alto) / (1 - s)
    zc = z0 + alto - r
    yt = c * r                              # punto de tangencia sobre el lado derecho
    zt = zc + s * r
    with BuildSketch() as k:
        with BuildLine():
            Polyline((-yt, zt), (-base / 2, z0), (base / 2, z0), (yt, zt))
            ThreePointArc((yt, zt), (0, zc + r), (-yt, zt))
        make_face()
    return k.sketch, (0.0, zc), r


def pieza(caja="afuera"):
    with BuildSketch() as pl:
        with BuildLine():
            Polyline((2.5, -1.25), (0, -1.25), (0, 1.25), (2.5, 1.25))      # plano: 5,00 recto (la guia decia 1,25)
            ThreePointArc((2.5, 1.25), (2.75, 0), (2.5, -1.25))
        make_face()
    s = extrude(pl.sketch, 4.0)
    tr, cen, r = trapecio_redondo(2.5, 4.0, 6.0)
    s = s & extrude(Plane.YZ * tr, 10)
    # hueco interior con R0,5: rectangulo redondeado x +-2,125 y z 0,25..7,75 (en XZ), atravesando en Y
    hueco = extrude(Plane.XZ * Pos(0, 4.0) * RectangleRounded(4.25, 7.5, 0.5), 3, both=True)
    resalte = extrude(Plane.YZ.offset(1.75) * Pos(cen[0], cen[1]) * Circle(r), 0.375)
    s = s - (hueco - resalte)
    zc = cen[1]
    s = s - Location((0, 0, zc), (0, 90, 0)) * Cylinder(0.3125, 10)
    if caja == "afuera":
        s = s - Location((2.75, 0, zc), (0, 90, 0)) * Cylinder(0.625, 1.0)          # de x 2,25 a 3,25
    else:
        s = s - Location((1.75, 0, zc), (0, 90, 0)) * Cylinder(0.625, 1.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
    nr, _, _ = trapecio_redondo(0.5, 1.0, 8.0, z0=0.25)
    nervio = extrude(Plane.YZ * nr, 2.125)
    s = s + nervio
    s = s + mirror(s, Plane.YZ)
    return scale(s, IN), r, zc


if __name__ == "__main__":
    for caja in ("afuera", "adentro"):
        s, r, zc = pieza(caja)
        lb = s.volume * 7.8e-3 / 453.592
        print(f"caja {caja}: r punta {r:.4f} in, centro z {zc:.4f} in, vol {s.volume:.1f} mm3, {lb:.4f} lb solidos {len(s.solids())}")
    export_step(pieza("afuera")[0], r"C:\Dev\_catia_practica\ej39_buffer_stand\gemelo.step")
