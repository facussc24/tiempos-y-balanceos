# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe render_sections.py --help
"""Secciones planas del conjunto: corta cada pieza con planos axis=station y grafica
los perfiles superpuestos (para VER si el fixture abraza o atraviesa la pieza).
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import geom, render, workdir  # noqa: E402

import numpy as np  # noqa: E402

AXIS_LABELS = {0: ("Y (mm)", "Z (mm)"), 1: ("X (mm)", "Z (mm)"), 2: ("X (mm)", "Y (mm)")}


def _parse_piece(spec):
    """path[:color[:lw]] tolerando rutas Windows (C:\\...) y POSIX de Git Bash (/c/...).

    Git Bash NO convierte /c/... a C:/... cuando el argumento contiene ':', asi que
    lo convertimos aca.
    """
    if len(spec) >= 3 and spec[0] == "/" and spec[2] == "/" and spec[1].isalpha():
        spec = spec[1].upper() + ":" + spec[2:]
    drive = ""
    if len(spec) >= 3 and spec[1] == ":" and spec[2] in "\\/":
        drive, spec = spec[:2], spec[2:]
    parts = spec.split(":")
    return drive + parts[0], (parts[1] if len(parts) > 1 else None), (float(parts[2]) if len(parts) > 2 else None)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--pieces", nargs="+", required=True,
                    help="pieza como path[:color[:lw]] — ej. out/fixture.step:#d9534f:1.6")
    ap.add_argument("--axis", required=True, choices=["X", "Y", "Z"], help="eje del plano de corte")
    ap.add_argument("--stations", required=True, help="valores de corte separados por coma, ej: -240,-210,445")
    ap.add_argument("--transform", default=None,
                    help="aplicar transform del manifest a una pieza: nombre:indice (ej. skeleton:1)")
    ap.add_argument("--points", default=None,
                    help="cache del manifest con nube de puntos .npy para scatter de fondo (ej. full_pts)")
    ap.add_argument("--lc", type=float, default=geom.LC_ANALYSIS)
    args = ap.parse_args()

    w = workdir.ensure_workdir(args.workdir)
    axis = "XYZ".index(args.axis)
    stations = [float(x) for x in args.stations.split(",")]

    tr_name, tr_idx = (None, None)
    if args.transform:
        tr_name, tr_idx = args.transform.rsplit(":", 1)
        tr_idx = int(tr_idx)

    piezas = []
    for i, spec in enumerate(args.pieces):
        path, color, lw = _parse_piece(spec)
        color = color or render.PALETTE[i % len(render.PALETTE)]
        lw = lw or 1.4
        translate = workdir.get_transform(w, tr_name) if tr_idx == i else None
        tris = geom.step_to_tris(path, lc=args.lc, translate=translate)
        piezas.append((os.path.basename(path), tris, color, lw))
        print("%s: %d tris%s" % (os.path.basename(path), len(tris), " (+transform)" if translate is not None else ""))

    cloud = None
    if args.points:
        cloud = np.load(workdir.get_cache(w, args.points))
        print("nube de fondo: %d pts" % len(cloud))

    xl, yl = AXIS_LABELS[axis]
    others = [i for i in range(3) if i != axis]
    for st in stations:
        layers = []
        for name, tris, color, lw in piezas:
            layers.append((render.section_segments(tris, axis, st), color, lw, name))
        scatter = None
        if cloud is not None:
            sel = np.abs(cloud[:, axis] - st) < 0.6
            scatter = (cloud[sel][:, others], "#b8b8b8", "nube de referencia")
        out = os.path.join(w, "renders", "sec_%s%g.png" % (args.axis, st))
        render.render_section(layers, out, title="Seccion %s=%g mm" % (args.axis, st),
                              xlabel=xl, ylabel=yl, scatter=scatter)
        print("saved %s" % out)


if __name__ == "__main__":
    main()
