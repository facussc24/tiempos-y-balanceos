# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe a_plano.py --help
"""Lleva una pieza YA VERIFICADA del frame del cliente al frame de IMPRESION.

Por que existe: las piezas se modelan en el frame del cliente, que suele estar a metros
del origen y con la cara de apoyo inclinada. Si se entrega asi, el laminador la recibe
torcida y hay que enderezarla a mano. El entregable impreso va **apoyado plano en z=0 y
centrado en XY**.

NO cambia geometria: solo rota y traslada. El control es el VOLUMEN, que se imprime
antes y despues y tiene que dar identico (tolerancia 1e-6 relativa).

La normal se saca con `cadlib.geom.fit_plane` sobre la cara de apoyo — no se escribe a mano
ni se copia de otra pieza. Ejemplo con una cara a 30 grados (valor sintetico; el real sale
de la medicion). OJO: si arranca con signo menos hay que usar `--normal=` pegado, o argparse
lo lee como otra opcion:
  a_plano.py --normal=-0.5,0,0.8660254 --out out_print pieza.step
"""
import argparse
import os

import numpy as np
import gmsh

try:
    from cadlib import envcheck  # noqa: F401
except ImportError:
    pass


def _rot_a_z(n):
    """Eje y angulo que llevan el versor n a +Z."""
    n = np.asarray(n, dtype=float)
    n = n / np.linalg.norm(n)
    z = np.array([0.0, 0.0, 1.0])
    ax = np.cross(n, z)
    s = np.linalg.norm(ax)
    if s < 1e-12:                      # ya alineado (o al reves)
        return z, (0.0 if n[2] > 0 else np.pi)
    return ax / s, float(np.arctan2(s, float(n @ z)))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pieces", nargs="+", help="STEP a reorientar")
    ap.add_argument("--normal", required=True,
                    help="normal de la cara que tiene que quedar APOYADA (x,y,z en el frame "
                         "del cliente). Sale de cadlib.geom.fit_plane sobre esa cara — no se adivina")
    ap.add_argument("--out", default="out_print", help="carpeta destino (default %(default)s)")
    ap.add_argument("--lc", type=float, default=2.0, help="tamano de malla del STL")
    ap.add_argument("--curvature", type=float, default=40.0)
    args = ap.parse_args()

    n = np.array([float(v) for v in args.normal.split(",")])
    axis, ang = _rot_a_z(n)
    os.makedirs(args.out, exist_ok=True)
    print("normal (%.4f, %.4f, %.4f) -> +Z  |  rotacion %.3f deg sobre (%.4f, %.4f, %.4f)"
          % (n[0], n[1], n[2], np.degrees(ang), axis[0], axis[1], axis[2]))

    for src in args.pieces:
        gmsh.initialize()
        gmsh.option.setNumber("General.Terminal", 0)
        occ = gmsh.model.occ
        occ.importShapes(src)
        occ.synchronize()
        vols = gmsh.model.getEntities(3)
        if len(vols) != 1:
            gmsh.finalize()
            raise SystemExit("%s tiene %d solidos (se espera 1)" % (src, len(vols)))
        v0 = occ.getMass(3, vols[0][1])

        occ.rotate(vols, 0, 0, 0, axis[0], axis[1], axis[2], ang)
        occ.synchronize()
        bb = gmsh.model.getBoundingBox(3, vols[0][1])
        occ.translate(vols, -(bb[0] + bb[3]) / 2, -(bb[1] + bb[4]) / 2, -bb[2])
        occ.synchronize()

        bb = gmsh.model.getBoundingBox(3, vols[0][1])
        v1 = occ.getMass(3, vols[0][1])
        if abs(v1 - v0) > 1e-6 * max(abs(v0), 1.0):
            gmsh.finalize()
            raise SystemExit("ABORTA: el volumen cambio (%.6f -> %.6f). Se toco geometria." % (v0, v1))

        base = os.path.join(args.out, os.path.splitext(os.path.basename(src))[0])
        gmsh.write(base + ".step")
        gmsh.option.setNumber("Mesh.MeshSizeMax", args.lc)
        gmsh.option.setNumber("Mesh.MeshSizeMin", 0.2)
        gmsh.option.setNumber("Mesh.MeshSizeFromCurvature", args.curvature)
        gmsh.model.mesh.generate(2)
        gmsh.write(base + ".stl")
        gmsh.finalize()
        print("  %-40s -> %6.1f x %6.1f x %6.1f mm  z0=%.3f  vol %.3f cm3 (igual)"
              % (os.path.basename(src), bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2],
                 bb[2], v1 / 1000.0))


if __name__ == "__main__":
    main()
