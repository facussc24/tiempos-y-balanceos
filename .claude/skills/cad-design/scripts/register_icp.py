# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe register_icp.py --help
"""Registra (alinea) una pieza contra otra con ICP traslacion-only trimmed y guarda
la transform en el manifest del workdir (con procedencia y rms).

Convencion: pts_source - T = frame del target.
OJO leccion cara: validar con features UNICOS — perfiles constantes no fijan el eje
longitudinal. Con nubes casi identicas usar --trim 1.0 (el trim descarta outliers
entre nubes DISTINTAS; con nubes iguales descarta justo los puntos informativos).
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import geom, workdir  # noqa: E402

import numpy as np  # noqa: E402


def _parse_tags(s):
    return {int(x) for x in s.split(",")} if s else None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--source", required=True, help="STEP de la pieza a alinear (ej. el fixture)")
    ap.add_argument("--target", required=True, help="STEP de referencia (ej. la pieza del cliente)")
    ap.add_argument("--name", required=True, help="nombre de la transform en el manifest (ej. skeleton)")
    ap.add_argument("--seed", default="0,0,0", help="arranque tx,ty,tz (default 0,0,0)")
    ap.add_argument("--source-faces", default=None,
                    help="usar solo caras de estos tipos del source, ej: 'BSpline surface,Torus,Cylinder'")
    ap.add_argument("--source-keep", default=None, help="tags de solidos del source a conservar, ej: 1,2")
    ap.add_argument("--target-keep", default=None, help="tags de solidos del target a conservar")
    ap.add_argument("--sample-target", action="store_true",
                    help="muestreo parametrico del target (geometria sucia que no malla)")
    ap.add_argument("--lc", type=float, default=2.0, help="tamano de malla (default %(default)s)")
    ap.add_argument("--trim", type=float, default=0.6, help="fraccion de puntos mas cercanos a usar (default 0.6)")
    ap.add_argument("--iters", type=int, default=120)
    ap.add_argument("--max-rms", type=float, default=1.0,
                    help="si el rms recortado supera esto, exit 1 (registro dudoso)")
    args = ap.parse_args()

    w = workdir.ensure_workdir(args.workdir)

    if args.source_faces:
        types = {t.strip() for t in args.source_faces.split(",")}
        faces = geom.mesh_nodes(args.source, args.lc, keep=_parse_tags(args.source_keep), per_face=True)
        parts = [p for (t, p) in faces.values() if t in types]
        if not parts:
            tipos = sorted({t for (t, _) in faces.values()})
            raise SystemExit("Ninguna cara del source es de tipo %s. Tipos presentes: %s" % (types, tipos))
        src = np.unique(np.concatenate(parts), axis=0)
    else:
        src = geom.mesh_nodes(args.source, args.lc, keep=_parse_tags(args.source_keep))
    print("source: %d pts" % len(src))

    if args.sample_target:
        tgt = geom.sample_surface_points(args.target, keep=_parse_tags(args.target_keep))
    else:
        tgt = geom.mesh_nodes(args.target, args.lc, keep=_parse_tags(args.target_keep))
    print("target: %d pts" % len(tgt))

    seed = tuple(float(x) for x in args.seed.split(","))
    T, d, rms, its = geom.icp_translation(src, tgt, seed=seed, iters=args.iters, trim=args.trim)
    print("\nT=(%.3f, %.3f, %.3f)  its=%d  rms_trim=%.3f mm" % (T[0], T[1], T[2], its, rms))
    for thr in (0.3, 0.5, 1.0, 1.5, 2.0, 3.0):
        print("   <%.1fmm: %d (%.1f%%)" % (thr, (d < thr).sum(), 100 * (d < thr).mean()))
    print("   mediana=%.2f p25=%.2f p75=%.2f" % (np.median(d), np.percentile(d, 25), np.percentile(d, 75)))

    workdir.set_transform(w, args.name, T, source=args.source, target=args.target,
                          rms_trim=rms, trim=args.trim, seed=list(seed), iters=its)
    print("transform '%s' guardada en %s/manifest.json" % (args.name, w))

    if rms > args.max_rms:
        print("REGISTRO DUDOSO: rms %.3f > max %.3f — validar con features unicos antes de usar" % (rms, args.max_rms))
        sys.exit(1)


if __name__ == "__main__":
    main()
