# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe render_step.py --help
"""Renderiza uno o mas STEP en vistas ortograficas + isometricas (colores por archivo).

Reemplaza tambien al viejo render_conjunto.py: pasar N archivos con --colors/--alphas
(ej. sustrato gris translucido + fixture naranja opaco).
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import geom, render  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+", help="archivos STEP a renderizar juntos")
    ap.add_argument("--out", required=True, help="prefijo de salida (genera <out>_<vista>.png)")
    ap.add_argument("--lc", type=float, default=geom.LC_PREVIEW, help="tamano de malla (default %(default)s)")
    ap.add_argument("--colors", nargs="*", default=None, help="un color por archivo (hex o nombre matplotlib)")
    ap.add_argument("--alphas", nargs="*", type=float, default=None, help="un alpha por archivo (0-1)")
    ap.add_argument("--title", default="", help="titulo del render")
    args = ap.parse_args()

    layers = []
    for i, path in enumerate(args.paths):
        tris = geom.step_to_tris(path, lc=args.lc)
        color = (args.colors[i] if args.colors and i < len(args.colors)
                 else render.PALETTE[i % len(render.PALETTE)])
        alpha = (args.alphas[i] if args.alphas and i < len(args.alphas)
                 else (0.45 if len(args.paths) > 1 and i == 0 else 1.0))
        layers.append((tris, color, alpha))
        print("%s: %d tris" % (os.path.basename(path), len(tris)))

    files = render.render_views(layers, args.out, title=args.title)
    for f in files:
        print("saved %s" % f)


if __name__ == "__main__":
    main()
