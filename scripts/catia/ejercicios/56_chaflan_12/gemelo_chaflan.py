# -*- coding: utf-8 -*-
"""Gemelo del ejercicio 56 en build123d (se corre con .venv-cad): la caja 250 x 80 x 60 (x e y centrados, z de 0 a 60) con
chaflan 5 x 5 en las 12 aristas, de dos maneras:

  planos   la caja cortada por los 12 planos de chaflan (cada uno a 45 grados entre sus dos caras, a K de la arista): en cada
           esquina los tres planos se cortan en un punto. No usa la operacion chamfer.
  chamfer  chamfer(Box.edges(), K) de build123d (OpenCASCADE), lo que pide la fila 56.

Escribe <carpeta>/chaflan_planos.step y, con el STEP de CATIA como segundo argumento, ubica la diferencia entre CATIA y el
chamfer de build123d: las piezas de (CATIA - chamfer) y de (chamfer - CATIA), con su volumen y su centro.
Imprime un JSON en la ultima linea.

Uso: python gemelo_chaflan.py <carpeta> [<step de CATIA>]"""
import json
import os
import sys

from build123d import Box, Keep, Plane, Vector, chamfer, export_step, import_step, split

A, B, C, K = 250.0, 80.0, 60.0, 5.0


def caja():
    return Box(A, B, C).translate((0, 0, C / 2))


def caras():
    """(normal hacia afuera, distancia del origen a la cara a lo largo de esa normal) de las 6 caras."""
    return [((1, 0, 0), A / 2), ((-1, 0, 0), A / 2), ((0, 1, 0), B / 2), ((0, -1, 0), B / 2), ((0, 0, 1), C), ((0, 0, -1), 0.0)]


def con_planos():
    s = caja()
    cs = caras()
    n_planos = 0
    for i, (n1, d1) in enumerate(cs):
        for n2, d2 in cs[i + 1:]:
            if sum(a * b for a, b in zip(n1, n2)) != 0:          # caras opuestas: no comparten arista
                continue
            v1, v2 = Vector(*n1), Vector(*n2)
            # se queda n1.p + n2.p <= d1 + d2 - K: el plano pasa por (d1 - K) n1 + d2 n2
            pl = Plane(origin=v1 * (d1 - K) + v2 * d2, z_dir=(v1 + v2).normalized())
            s = split(s, bisect_by=pl, keep=Keep.BOTTOM)
            n_planos += 1
    return s, n_planos


def piezas(forma):
    return [{"volumen": round(x.volume, 4), "cdg_mm": [round(v, 4) for v in x.center()]} for x in forma.solids()
            if x.volume > 1e-6]


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    pl, n = con_planos()
    ch = chamfer(caja().edges(), K)
    ruta = os.path.join(out, "chaflan_planos.step")
    export_step(pl, ruta)
    r = {"n_planos": n, "planos": {"volumen": round(pl.volume, 4), "cdg_mm": [round(v, 4) for v in pl.center()],
                                   "solidos": len(pl.solids()), "caras": len(pl.faces()), "step": ruta},
         "chamfer": {"volumen": round(ch.volume, 4), "cdg_mm": [round(v, 4) for v in ch.center()],
                     "caras": len(ch.faces())}}
    if len(sys.argv) > 2:
        cat = import_step(sys.argv[2])
        r["catia"] = {"caras": len(cat.faces()), "solidos": len(cat.solids())}
        r["catia_menos_chamfer"] = piezas(cat - ch)
        r["chamfer_menos_catia"] = piezas(ch - cat)
    print(json.dumps(r))


if __name__ == "__main__":
    main()
