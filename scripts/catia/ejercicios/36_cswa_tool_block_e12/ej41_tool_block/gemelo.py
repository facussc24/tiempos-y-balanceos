"""ej41 — CSWA Sample Exam 2013 (SolidWorks, oficial) «Tool Block», etapas 1 y 2, gemelo build123d.
Perfil (x 0..A, y 0..B), espesor C; franja izquierda y 19..51 con chaflanes 7 x 45 y D14 en (14, 33); arriba: plano de
(7, 51) a (14, 51), recta a -10 grados tangente a un R19 que pasa por la esquina (A-29, B); arriba plano hasta (A-5, B),
chaflan 5 x 45, borde derecho hasta y = B-24, recta hasta (A-29, 0), plano hasta el R29 (centro sobre esa recta a y 19),
R29 hasta un R5 tangente a la recta y = 19. Acero 0,0079 g/mm3. Respuestas: 939,54 g (81 57 43) y 1032,32 g (84 59 45)."""
import math
import sys

from build123d import (BuildLine, BuildSketch, Circle, Line, Locations, Mode, ThreePointArc, export_step, extrude,
                       make_face)

DENS = 0.0079


def resolver_r19(A, B):
    """Centro del R19: a 19 de la recta que sale de (14, 51) a -10 grados (del lado de arriba) y a 19 de (A-29, B)."""
    a = math.radians(-10)
    d = (math.cos(a), math.sin(a))
    nrm = (-d[1], d[0])                                  # normal hacia arriba
    p0 = (14.0, 51.0)
    # centro = punto de la recta desplazado 19 por la normal: c(t) = p0 + t d + 19 n ; |c(t) - E| = 19
    E = (A - 29.0, B)
    base = (p0[0] + 19 * nrm[0] - E[0], p0[1] + 19 * nrm[1] - E[1])
    bb = 2 * (base[0] * d[0] + base[1] * d[1])
    cc = base[0] ** 2 + base[1] ** 2 - 19 ** 2
    t = (-bb - math.sqrt(bb * bb - 4 * cc)) / 2          # la raiz chica: el centro queda cerca de (35,5; 66,6) como en el dibujo
    tang = (p0[0] + t * d[0], p0[1] + t * d[1])
    cen = (tang[0] + 19 * nrm[0], tang[1] + 19 * nrm[1])
    return cen, tang, E


def geometria(A, B):
    cen19, tg19, E = resolver_r19(A, B)
    xs = A - 29 + 29 * 19 / (B - 24)                    # recta (A, B-24) -> (A-29, 0) a la altura 19
    c29 = (xs, 19.0)
    xb = xs - math.sqrt(29 ** 2 - 19 ** 2)               # el R29 toca y = 0
    c5 = (xs - math.sqrt(34 ** 2 - 5 ** 2), 14.0)        # R5 tangente a y 19 (desde abajo) y al R29 por afuera
    t5_linea = (c5[0], 19.0)
    u = ((c5[0] - c29[0]) / 34, (c5[1] - c29[1]) / 34)
    t5_arco = (c29[0] + 29 * u[0], c29[1] + 29 * u[1])
    return dict(cen19=cen19, tg19=tg19, E=E, c29=c29, xb=xb, c5=c5, t5l=t5_linea, t5a=t5_arco)


def medio(c, r, a, b):
    ta, tb = math.atan2(a[1] - c[1], a[0] - c[0]), math.atan2(b[1] - c[1], b[0] - c[0])
    dd = (tb - ta + math.pi) % (2 * math.pi) - math.pi
    t = ta + dd / 2
    return (c[0] + r * math.cos(t), c[1] + r * math.sin(t))


def perfil(A, B, agujero=True):
    g = geometria(A, B)
    with BuildSketch() as s:
        with BuildLine():
            Line((0, 26), (0, 44))
            Line((0, 44), (7, 51))
            Line((7, 51), (14, 51))
            Line((14, 51), g["tg19"])
            ThreePointArc(g["tg19"], medio(g["cen19"], 19, g["tg19"], g["E"]), g["E"])
            Line(g["E"], (A - 5, B))
            Line((A - 5, B), (A, B - 5))
            Line((A, B - 5), (A, B - 24))
            Line((A, B - 24), (A - 29, 0))
            Line((A - 29, 0), (g["xb"], 0))
            ThreePointArc((g["xb"], 0), medio(g["c29"], 29, (g["xb"], 0), g["t5a"]), g["t5a"])
            ThreePointArc(g["t5a"], medio(g["c5"], 5, g["t5a"], g["t5l"]), g["t5l"])
            Line(g["t5l"], (7, 19))
            Line((7, 19), (0, 26))
        make_face()
        if agujero:
            with Locations((14, 33)):
                Circle(7, mode=Mode.SUBTRACT)
    return s.sketch, g


if __name__ == "__main__":
    for A, B, C, of in ((81, 57, 43, 939.54), (84, 59, 45, 1032.32)):
        sk, g = perfil(A, B)
        s = extrude(sk, C)
        print(f"A{A} B{B} C{C}: area {sk.area:.3f} vol {s.volume:.3f} masa {s.volume * DENS:.2f} g (oficial {of})")
    export_step(extrude(perfil(81, 57)[0], 43), r"C:\Dev\_catia_practica\ej41_tool_block\gemelo.step")
