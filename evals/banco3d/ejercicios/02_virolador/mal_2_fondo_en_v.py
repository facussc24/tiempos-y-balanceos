# -*- coding: utf-8 -*-
"""02 virolador - MAL 2 (mutante sintetico): la v16 con el fondo en V, que apoya en una linea y se hamaca.

    python mal_2_fondo_en_v.py <carpeta>   ->  <carpeta>/virolador_v16_fondo_en_v.stl, .step y .json

Parte del STEP real de la v16 (sha256 verificado) y le pega abajo una cuña en V a lo largo de Y, con la arista a
K_MM por debajo del fondo, en el medio del largo (x = xc): la pieza apoya en una linea. Es la forma de «apoyo en linea
/ fondo convexo» del pedido; no es una pieza que se haya impreso. Tarda ~1 min (importar el STEP real: ~45 s).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _copia_nube import carpeta_salida, escribir_json, origen  # noqa: E402

from build123d import (BuildPart, BuildSketch, Plane, Polygon, export_step, export_stl, extrude,  # noqa: E402
                       import_step)

K_MM = 4.0      # cuanto baja la arista de la cuña respecto del fondo (mutante, no dato de Barack)
SOLAPE = 0.5    # la cuña se mete 0,5 mm en la pieza para que la union sea un solo solido

d = carpeta_salida()
nombre = "virolador_v16_fondo_en_v"
p, s = origen("v16_step")
pieza = import_step(p)
bb = pieza.bounding_box()
x0, x1, z0 = bb.min.X, bb.max.X, bb.min.Z
xc = (x0 + x1) / 2.0
with BuildPart() as cuna:
    with BuildSketch(Plane.XZ):
        Polygon((x0, z0 + SOLAPE), (x1, z0 + SOLAPE), (xc, z0 - K_MM), align=None)
    extrude(amount=bb.size.Y / 2.0 + 1.0, both=True)
mut = pieza.fuse(cuna.part).clean()
assert len(mut.solids()) == 1, "la cuña no quedo unida a la pieza"
bb2 = mut.bounding_box()
assert abs(bb2.min.Z - (z0 - K_MM)) < 0.01, "la arista no quedo abajo de todo"
export_step(mut, os.path.join(d, nombre + ".step"))
export_stl(mut, os.path.join(d, nombre + ".stl"), tolerance=0.05)
escribir_json(os.path.join(d, nombre + ".json"), {
    "partes": [nombre], "stl": nombre + ".stl", "step": nombre + ".step", "mutante_de": {"origen": p, "sha256": s},
    "mutacion": "cuña en V bajo el fondo, arista a lo largo de Y en x = %.2f, %.1f mm por debajo" % (xc, K_MM)})
print("ok", d)
