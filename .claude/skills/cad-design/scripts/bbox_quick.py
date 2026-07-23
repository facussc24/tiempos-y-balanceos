# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe bbox_quick.py --help
"""BBox rapido por solido de uno o mas STEP (sin mallar)."""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import geom  # noqa: E402

import gmsh  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("paths", nargs="+", help="archivos STEP/STP/IGES")
    ap.add_argument("--max-vols", type=int, default=12, help="maximo de solidos a listar por archivo")
    args = ap.parse_args()

    for path in args.paths:
        try:
            with geom.gmsh_session():
                geom._load(path)
                vols = gmsh.model.getEntities(3)
                surfs = gmsh.model.getEntities(2)
                curves = gmsh.model.getEntities(1)
                bb = gmsh.model.getBoundingBox(-1, -1)
                print("\n=== %s" % path)
                print("solidos=%d superficies=%d curvas=%d" % (len(vols), len(surfs), len(curves)))
                print("BBOX: X[%.1f,%.1f] Y[%.1f,%.1f] Z[%.1f,%.1f]  dims %.1f x %.1f x %.1f"
                      % (bb[0], bb[3], bb[1], bb[4], bb[2], bb[5], bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]))
                for dim, tag in vols[:args.max_vols]:
                    b = gmsh.model.getBoundingBox(dim, tag)
                    name = gmsh.model.getEntityName(dim, tag)
                    print("  vol %d '%s': X[%.1f,%.1f] Y[%.1f,%.1f] Z[%.1f,%.1f]  dims %.1fx%.1fx%.1f"
                          % (tag, name, b[0], b[3], b[1], b[4], b[2], b[5], b[3] - b[0], b[4] - b[1], b[5] - b[2]))
                if len(vols) > args.max_vols:
                    print("  ... y %d mas" % (len(vols) - args.max_vols))
        except Exception as e:
            print("ERROR %s: %s" % (path, e))


if __name__ == "__main__":
    main()
