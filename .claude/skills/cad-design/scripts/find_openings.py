# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe find_openings.py --help
"""Encuentra ABERTURAS (ranuras, ventanas, agujeros) de un STEP — sin mallar.

Una abertura es un LAZO INTERNO de una cara: se saca con `getBoundary` de la cara y
agrupando sus curvas por puntos compartidos (union-find). Es instantaneo.

No confundir con `analyze_step.py --find`, que busca clusters de caras FINAS (grabados,
logos): con `--max-diag` grande devuelve un cluster gigante que no sirve para esto
(incidente 2026-07-31: buscando ranuras devolvio un cluster de 1465 caras).

Ejemplo:
  find_openings.py pieza.stp --top 14 --max-loop 120
"""
import argparse
import os
import sys

import numpy as np
import gmsh

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import topo  # noqa: E402


def loops_of_face(tag):
    """Lazos de una cara: [(n_curvas, lo, hi)] con el bbox de cada lazo."""
    cur = [abs(t) for _, t in gmsh.model.getBoundary([(2, tag)], oriented=False, recursive=False)]
    if not cur:
        return []
    pts, bbs = {}, {}
    for c in cur:
        pts[c] = {abs(t) for _, t in gmsh.model.getBoundary([(1, c)], oriented=False, recursive=False)}
        bbs[c] = np.array(gmsh.model.getBoundingBox(1, c))
    padre = {c: c for c in cur}

    def find(a):
        while padre[a] != a:
            padre[a] = padre[padre[a]]
            a = padre[a]
        return a

    for i, a in enumerate(cur):
        for b in cur[i + 1:]:
            if pts[a] & pts[b]:
                ra, rb = find(a), find(b)
                if ra != rb:
                    padre[ra] = rb
    grupos = {}
    for c in cur:
        grupos.setdefault(find(c), []).append(c)
    out = []
    for g in grupos.values():
        B = np.array([bbs[c] for c in g])
        out.append((len(g), B[:, 0:3].min(axis=0), B[:, 3:6].max(axis=0)))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("path", help="STEP/STP/IGES")
    ap.add_argument("--top", type=int, default=12, help="cuantas caras grandes revisar (default %(default)s)")
    ap.add_argument("--max-loop", type=float, default=120.0,
                    help="diagonal maxima de un lazo para contarlo como abertura (default %(default)s mm)")
    ap.add_argument("--min-loop", type=float, default=0.0, help="descarta lazos mas chicos que esto")
    args = ap.parse_args()

    fb = topo.face_boxes(args.path)
    gmsh.initialize()
    gmsh.option.setNumber("General.Terminal", 0)
    gmsh.option.setNumber("Geometry.OCCImportLabels", 1)
    gmsh.model.occ.importShapes(args.path, highestDimOnly=False)
    gmsh.model.occ.synchronize()
    total = 0
    for i in np.argsort(-fb["area_bbox"])[:args.top]:
        f = fb[i]
        dentro = [l for l in loops_of_face(int(f["tag"]))
                  if args.min_loop <= max(l[2] - l[1]) < args.max_loop]
        if not dentro:
            continue
        print("CARA %d (solido %d) dims %.0fx%.0fx%.0f centro (%.0f,%.0f,%.0f) -> %d abertura(s)"
              % (f["tag"], f["solid"], f["dx"], f["dy"], f["dz"], f["cx"], f["cy"], f["cz"], len(dentro)))
        for n, lo, hi in sorted(dentro, key=lambda l: -max(l[2] - l[1])):
            d = hi - lo
            print("   %2d curvas  X[%.2f,%.2f] Y[%.2f,%.2f] Z[%.2f,%.2f]  %.2f x %.2f x %.2f mm"
                  % (n, lo[0], hi[0], lo[1], hi[1], lo[2], hi[2], d[0], d[1], d[2]))
            total += 1
    gmsh.finalize()
    print("\n%d abertura(s) en las %d caras mas grandes." % (total, args.top))
    if not total:
        print("Nada: subir --top, o --max-loop si la abertura es grande.")


if __name__ == "__main__":
    main()
