"""ej41 etapas 3 y 4 — gemelo build123d. Etapa 3 (A 86, B 58, C 44): sobre la pieza de la etapa 1 se agrega un Ø11 pasante
en (A-14, B-14); se saca z 0..19 en x < A-52 y en y < 19 (vistas de frente y costado); y una ranura z 8..32 (12 desde
arriba, 24 de ancho) adentro de un R41 con centro sobre el borde derecho x = A, que corta la diagonal 36 por debajo de
arriba (y = B-36). Respuesta oficial 628,18 g. Etapa 4: un bolsillo de un solo lado (432,58 g)."""
import math
import sys

from build123d import Box, Circle, Cylinder, Location, Pos, extrude, Mode
from gemelo import perfil, DENS

A, B, C = 86.0, 58.0, 44.0


def centro_r41(A, B):
    """Centro (A, yc) del R41 que pasa por el punto de la diagonal (A, B-24)->(A-29, 0) a la altura B-36."""
    y = B - 36
    x = (A - 29) + 29 * y / (B - 24)
    yc = y + math.sqrt(41 ** 2 - (A - x) ** 2)
    return (A, yc), (x, y)


def etapa3(A=A, B=B, C=C, cen=None):
    sk, g = perfil(A, B)
    s = extrude(sk, C)
    s -= Pos(A - 14, B - 14, 0) * Cylinder(5.5, 3 * C, align=None)
    # escalon de abajo: z 0..19, x < A-52 y y < 19
    s -= Pos((A - 52) / 2, B / 2, 9.5) * Box(A - 52, 3 * B, 19)
    s -= Pos(A / 2, 19 / 2 - 50, 9.5) * Box(3 * A, 19 + 100, 19)
    c, p = cen or centro_r41(A, B)[0], centro_r41(A, B)[1]
    s -= Pos(c[0], c[1], 8) * Cylinder(41, 24, align=None)        # align=None arranca en z 0: z 8..32
    return s


if __name__ == "__main__":
    c, p = centro_r41(A, B)
    s = etapa3()
    print(f"centro R41 {c[0]:.3f}, {c[1]:.3f}  punto en la diagonal {p[0]:.3f}, {p[1]:.3f}")
    print(f"etapa 3: vol {s.volume:.3f}  masa {s.volume * DENS:.2f} g  (oficial 628,18)")


def bolsillo(A=A, B=B, C=C, piel_ranura=True, prof=None):
    """Etapa 4: bolsillo desde z 0 hasta C-12 en la zona x > A-52, y > 19, con paredes de 1 (offset -1 del contorno);
    con piel_ranura deja 1 mm alrededor de la ranura del R41 (cilindro R42 en z 7..33)."""
    from build123d import offset, Rectangle, BuildSketch, Plane
    s3 = etapa3(A, B, C)
    sk, g = perfil(A, B, agujero=False)
    zona = sk & (Pos(A - 52 + 100, 19 + 100) * Rectangle(200, 200))
    zona_in = offset(zona, -1)
    z1 = C - 12 if prof is None else prof
    pk = extrude(zona_in, z1)
    if piel_ranura:
        c = centro_r41(A, B)[0]
        pk -= Pos(c[0], c[1], 7) * Cylinder(42, 26, align=None)        # piel de 1: z 7..33
    return s3 - pk


if __name__ == "__main__":
    for piel in (True, False):
        s4 = bolsillo(piel_ranura=piel)
        print(f"etapa 4 piel_ranura={piel}: vol {s4.volume:.3f}  masa {s4.volume * DENS:.2f} g  (oficial 432,58)")
