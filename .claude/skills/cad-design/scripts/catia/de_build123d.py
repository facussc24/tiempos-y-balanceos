"""de_build123d.py: pasa el contorno de una cara de build123d (rectas y arcos de circunferencia) a tramos para
croquis.dibujar de CATIA. Sirve cuando el perfil sale de una cuenta (R12 entre una recta a 45 y una vertical, tangentes)
y no conviene calcular cada punto a mano. Corre en .venv-cad (build123d); devuelve JSON por stdout para que el script de
CATIA (en _catia_env) lo lea. Uso: python de_build123d.py <modulo> <funcion>  -> imprime [["L",[x,y],[x,y]], ["A",...]]"""
import importlib
import json
import sys


def tramos(cara, dec=6):
    """Redondeo a 6 decimales: las puntas de dos tramos que se tocan traen ruido de 1e-7 y sin redondear el perfil queda
    ABIERTO en CATIA (cada punta es un punto distinto). Arcos de mas de 170 grados se parten en dos (dibujar elige el
    arco corto y uno de 180 es ambiguo)."""
    def pt(v):
        return [round(v.X, dec) + 0.0, round(v.Y, dec) + 0.0]
    out = []
    for e in cara.outer_wire().edges():
        a, b = pt(e.position_at(0)), pt(e.position_at(1))
        t = e.geom_type.name
        if t == "LINE":
            out.append(["L", a, b])
        elif t == "CIRCLE":
            c, r = pt(e.arc_center), round(e.radius, dec)
            if e.length / r > 170 / 57.29578:
                m = pt(e.position_at(0.5))
                out += [["A", c, r, a, m], ["A", c, r, m, b]]
            else:
                out.append(["A", c, r, a, b])
        else:
            raise SystemExit(f"tramo {t} sin traducir")
    return out


if __name__ == "__main__":
    sys.path.insert(0, sys.argv[3] if len(sys.argv) > 3 else ".")
    m = importlib.import_module(sys.argv[1])
    cara = getattr(m, sys.argv[2])()
    cara = cara.faces()[0] if hasattr(cara, "faces") else cara
    print(json.dumps(tramos(cara)))
