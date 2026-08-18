# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe make_test_geometry.py --help
"""Genera STEPs sinteticos deterministas con ground truth conocida, para smoke tests
de cadlib sin depender de STEPs de cliente (que viven fuera del repo).

- test_substrate.step        pared 100 x 8 x 60 en X[0,100] Y[0,8] Z[0,60]
- test_fixture_clear.step    bloque 40x10x30 con 1.0 mm de luz a la pared (Y[9,19])
- test_fixture_colliding.step bloque 40x10x30 penetrando 3.0 mm en la pared (Y[5,15])
- test_plate_holes.step      placa 120x8x60 con 4 agujeros pasantes r=2.65 (eje Y)
- test_blob.step             2 esferas fusionadas (geometria curva: fija los 3 ejes en ICP)
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import geom  # noqa: E402

import gmsh  # noqa: E402

# ground truth (la usan los asserts del smoke test)
WALL = dict(x=(0.0, 100.0), y=(0.0, 8.0), z=(0.0, 60.0))
CLEAR_GAP = 1.0
COLLIDE_DEPTH = 3.0
HOLE_R = 2.65
HOLE_XZ = [(15.0, 15.0), (105.0, 15.0), (15.0, 45.0), (105.0, 45.0)]


def _write_box(path, x0, y0, z0, dx, dy, dz):
    with geom.gmsh_session():
        gmsh.model.occ.addBox(x0, y0, z0, dx, dy, dz)
        gmsh.model.occ.synchronize()
        gmsh.write(path)


def make(outdir):
    os.makedirs(outdir, exist_ok=True)
    paths = {}

    p = os.path.join(outdir, "test_substrate.step")
    _write_box(p, 0, 0, 0, 100, 8, 60)
    paths["substrate"] = p

    p = os.path.join(outdir, "test_fixture_clear.step")
    _write_box(p, 30, 8 + CLEAR_GAP, 15, 40, 10, 30)
    paths["clear"] = p

    p = os.path.join(outdir, "test_fixture_colliding.step")
    _write_box(p, 30, 8 - COLLIDE_DEPTH, 15, 40, 10, 30)
    paths["colliding"] = p

    p = os.path.join(outdir, "test_plate_holes.step")
    with geom.gmsh_session():
        occ = gmsh.model.occ
        plate = occ.addBox(0, 0, 0, 120, 8, 60)
        holes = []
        for hx, hz in HOLE_XZ:
            holes.append((3, occ.addCylinder(hx, -1, hz, 0, 10, 0, HOLE_R)))
        occ.cut([(3, plate)], holes)
        occ.synchronize()
        gmsh.write(p)
    paths["plate"] = p

    p = os.path.join(outdir, "test_blob.step")
    with geom.gmsh_session():
        occ = gmsh.model.occ
        s1 = occ.addSphere(30, 20, 10, 15)
        s2 = occ.addSphere(48, 28, 16, 9)
        occ.fuse([(3, s1)], [(3, s2)])
        occ.synchronize()
        gmsh.write(p)
    paths["blob"] = p

    # caja con CAVIDAD INTERNA SELLADA: al mallar da 2 cuerpos, el interior con volumen
    # NEGATIVO. Es el caso malo del gate de cuerpos de export_deliverables (2026-08-18:
    # quitar los agujeros M5 sello el vaciado que ventilaban de casualidad, y un STL con
    # 8 cuerpos paso el gate viejo porque juzgaba un re-mallado y no el archivo entregado).
    p = os.path.join(outdir, "test_sealed_cavity.step")
    with geom.gmsh_session():
        occ = gmsh.model.occ
        outer = occ.addBox(0, 0, 0, 40, 30, 20)
        inner = occ.addBox(8, 8, 5, 24, 14, 10)
        occ.cut([(3, outer)], [(3, inner)])
        occ.synchronize()
        gmsh.write(p)
    paths["sealed_cavity"] = p

    return paths


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", required=True, help="directorio de salida para los STEPs de test")
    args = ap.parse_args()
    paths = make(args.out)
    for k, v in paths.items():
        print("%s -> %s (%d KB)" % (k, v, os.path.getsize(v) // 1024))


if __name__ == "__main__":
    main()
