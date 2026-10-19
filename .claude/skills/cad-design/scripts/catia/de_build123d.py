"""de_build123d.py: pasa el contorno de una cara de build123d (rectas y arcos de circunferencia) a tramos para
croquis.dibujar de CATIA. Sirve cuando el perfil sale de una cuenta (R12 entre una recta a 45 y una vertical, tangentes)
y no conviene calcular cada punto a mano. Corre en .venv-cad (build123d); devuelve JSON por stdout para que el script de
CATIA (en _catia_env) lo lea. Uso: python de_build123d.py <modulo> <funcion>  -> imprime [["L",[x,y],[x,y]], ["A",...]]"""
import importlib
import json
import sys


def tramos(cara, dec=6):
    """Cada punta sale del VERTICE COMPARTIDO del contorno y despues se redondea a 6 decimales: redondear position_at()
    no alcanza (dos puntas a 1e-7 caen a los dos lados del corte: 14 de 300 perfiles girados quedaban ABIERTOS en CATIA,
    auditor 19/10). Un arco se parte en ceil(angulo / 170) tramos (dibujar elige el arco corto: uno de 180 es ambiguo y
    una circunferencia entera no entra en uno solo). Una cara con agujeros se NIEGA: solo se traduce el contorno de afuera
    y los agujeros van aparte (circulos o vaciados)."""
    import math
    if cara.inner_wires():
        raise SystemExit(f"la cara tiene {len(cara.inner_wires())} agujero(s): de_build123d traduce solo el contorno de "
                         "afuera; pasar la cara sin agujeros y hacerlos aparte")
    vs = cara.outer_wire().vertices()

    def pt(v):
        return [round(v.X, dec) + 0.0, round(v.Y, dec) + 0.0]

    def punta(v):
        return pt(min(vs, key=lambda q: (q.X - v.X) ** 2 + (q.Y - v.Y) ** 2))
    out = []
    for e in cara.outer_wire().edges():
        a, b = punta(e.position_at(0)), punta(e.position_at(1))
        t = e.geom_type.name
        if t == "LINE":
            out.append(["L", a, b])
        elif t == "CIRCLE":
            c, r = pt(e.arc_center), round(e.radius, dec)
            n = max(1, math.ceil((e.length / e.radius) / math.radians(170)))
            pts = [a] + [pt(e.position_at(k / n)) for k in range(1, n)] + [b]
            out += [["A", c, r, pts[k], pts[k + 1]] for k in range(n)]
        else:
            raise SystemExit(f"tramo {t} sin traducir")
    return out


if __name__ == "__main__":
    sys.path.insert(0, sys.argv[3] if len(sys.argv) > 3 else ".")
    m = importlib.import_module(sys.argv[1])
    cara = getattr(m, sys.argv[2])()
    if hasattr(cara, "faces"):
        caras = cara.faces()
        if len(caras) != 1:
            raise SystemExit(f"{sys.argv[2]}() devolvio {len(caras)} caras: tiene que ser UNA")
        cara = caras[0]
    print(json.dumps(tramos(cara)))
