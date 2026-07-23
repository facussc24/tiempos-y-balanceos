# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe analyze_step.py --help
"""Analiza un STEP: solidos, bounding boxes, volumenes, caras planas con normal/angulo."""
import argparse
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import geom  # noqa: E402

import gmsh  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("path", help="archivo STEP/STP/IGES a analizar")
    ap.add_argument("--planes", type=int, default=12, help="cuantas caras planas listar por solido (por area)")
    args = ap.parse_args()

    with geom.gmsh_session():
        geom._load(args.path)
        vols = gmsh.model.getEntities(3)
        surfs = gmsh.model.getEntities(2)
        print("ARCHIVO: %s" % args.path)
        print("Solidos: %d | Superficies: %d" % (len(vols), len(surfs)))

        xmin, ymin, zmin, xmax, ymax, zmax = gmsh.model.getBoundingBox(-1, -1)
        print("BBOX TOTAL: X[%.2f,%.2f] Y[%.2f,%.2f] Z[%.2f,%.2f]" % (xmin, xmax, ymin, ymax, zmin, zmax))
        print("  dims: %.2f x %.2f x %.2f mm" % (xmax - xmin, ymax - ymin, zmax - zmin))

        for dim, tag in vols:
            bb = gmsh.model.getBoundingBox(dim, tag)
            mass = gmsh.model.occ.getMass(dim, tag)
            com = gmsh.model.occ.getCenterOfMass(dim, tag)
            name = gmsh.model.getEntityName(dim, tag)
            print("\nSOLIDO tag=%d name='%s'" % (tag, name))
            print("  bbox: X[%.2f,%.2f] Y[%.2f,%.2f] Z[%.2f,%.2f]" % (bb[0], bb[3], bb[1], bb[4], bb[2], bb[5]))
            print("  dims: %.2f x %.2f x %.2f mm" % (bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]))
            print("  volumen: %.2f cm3 | centro masa: (%.1f, %.1f, %.1f)" % (mass / 1000, com[0], com[1], com[2]))
            _, sdown = gmsh.model.getAdjacencies(dim, tag)
            planes = []
            for st in sdown:
                stype = gmsh.model.getType(2, st)
                area = gmsh.model.occ.getMass(2, st)
                if stype == "Plane":
                    try:
                        (u0, v0), (u1, v1) = gmsh.model.getParametrizationBounds(2, st)
                        n = gmsh.model.getNormal(st, [(u0 + u1) / 2, (v0 + v1) / 2])
                        nz = max(-1.0, min(1.0, n[2]))
                        ang = math.degrees(math.acos(nz))
                        planes.append((area, st, n, ang))
                    except Exception:
                        planes.append((area, st, None, None))
            planes.sort(reverse=True)
            print("  caras planas (top %d por area):" % args.planes)
            for area, st, n, ang in planes[:args.planes]:
                if n is not None:
                    incl = abs(ang if ang <= 90 else 180 - ang)
                    print("    surf %d: area=%.0f mm2  normal=(%+.3f,%+.3f,%+.3f)  ang_vs_Z=%.2f deg  inclinacion=%.2f"
                          % (st, area, n[0], n[1], n[2], ang, incl))
                else:
                    print("    surf %d: area=%.0f mm2  (sin normal)" % (st, area))
            other = {}
            for st in sdown:
                t = gmsh.model.getType(2, st)
                if t != "Plane":
                    other[t] = other.get(t, 0) + 1
            if other:
                print("  otras superficies: %s" % other)


if __name__ == "__main__":
    main()
