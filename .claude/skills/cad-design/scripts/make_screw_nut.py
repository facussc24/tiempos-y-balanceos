#!/usr/bin/env python
"""Genera un par tornillo + tuerca ROSCADOS pensados para imprimir en FDM.

Por que existe: replicar un tornillo metalico fino (M3/M4, paso 0,7) tal cual en plastico
no enrosca a la primera — el flanco de rosca de un M4x0,7 mide 0,38 mm radiales y la holgura
que necesita el FDM (0,10-0,20 mm por lado) se come el 40%. La practica publicada pone el
piso del paso util en ~1,0 mm. Este CLI mantiene el DIAMETRO EXTERIOR (para que el vastago
siga pasando por el mismo agujero) y sube el PASO, que es la variable que decide si imprime.

Convencion de holgura (ambas piezas impresas): se achica el tornillo, la tuerca queda nominal.
    tornillo major = --major - --clearance
    tuerca   major = --major
El resultado es --clearance/2 de luz radial en cresta y en flanco.

Orientacion de impresion asumida: tornillo PARADO con la cabeza sobre la cama (rosca en Z,
sin soportes); tuerca apoyada de plano. Por eso la cabeza no lleva chaflan abajo.

Uso:
    python make_screw_nut.py --major 4.0 --pitch 1.0 --clearance 0.25 \
        --total-length 25 --head-dia 15 --head-th 4 --nut-af 10 --nut-h 6 \
        --out <dir> --name tornillo_cabeza_ancha
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

from build123d import (  # noqa: E402
    Align,
    Axis,
    Cylinder,
    GeomType,
    Plane,
    Pos,
    RegularPolygon,
    chamfer,
    export_step,
    export_stl,
    extrude,
    fillet,
)
from bd_warehouse.thread import IsoThread  # noqa: E402


# --------------------------------------------------------------------------- tornillo
def build_screw(*, major, pitch, clearance, total_length, head_dia, head_th,
                neck, knurl_n, knurl_depth, head_chamfer):
    """Cabeza en z=[0, head_th], cuello, y rosca hasta z=total_length."""
    thread_major = major - clearance
    thread_len = total_length - head_th - neck
    if thread_len <= 2 * pitch:
        raise SystemExit(f"rosca demasiado corta: {thread_len:.2f} mm")

    thread = IsoThread(
        major_diameter=thread_major,
        pitch=pitch,
        length=thread_len,
        external=True,
        # "fade" abajo: la rosca nace DESDE el nucleo, sin cara coincidente con la cabeza
        # (con "square" el plano de arranque coincide con el del cuello y el solido no cierra)
        end_finishes=("fade", "chamfer"),  # arriba chaflan: entra sola en la tuerca
    )

    head = Cylinder(head_dia / 2, head_th, align=(Align.CENTER, Align.CENTER, Align.MIN))
    if head_chamfer > 0:  # solo el borde de ARRIBA: el de abajo apoya en la cama
        top_edges = head.edges().group_by(Axis.Z)[-1]
        head = chamfer(top_edges, length=head_chamfer)

    # nucleo continuo de punta a punta (enterrado dentro de la cabeza): una sola fusion
    core = Cylinder(thread.min_radius, total_length,
                    align=(Align.CENTER, Align.CENTER, Align.MIN))
    body = head + core

    # radio de acuerdo cabeza-vastago: es donde flexa y donde se corta si no lo tiene
    if neck > 0:
        r_fil = min(neck * 0.8, 1.0)
        target = [e for e in body.edges().filter_by(GeomType.CIRCLE)
                  if abs(e.center().Z - head_th) < 1e-6
                  and abs(e.radius - thread.min_radius) < 1e-6]
        if len(target) != 1:
            raise SystemExit(f"esperaba 1 arista de acuerdo, encontre {len(target)}")
        body = fillet(target, radius=r_fil)

    # moleteado: gajos cilindricos en el canto para agarrar con los dedos
    if knurl_n > 0 and knurl_depth > 0:
        r_cut = 1.2
        r_pos = head_dia / 2 + r_cut - knurl_depth
        for k in range(knurl_n):
            a = 2 * math.pi * k / knurl_n
            body -= Pos(r_pos * math.cos(a), r_pos * math.sin(a), 0) * Cylinder(
                r_cut, head_th * 3, align=(Align.CENTER, Align.CENTER, Align.MIN)
            )

    screw = body + (Pos(0, 0, head_th + neck) * thread)
    return screw, thread


# --------------------------------------------------------------------------- tuerca
def build_nut(*, major, pitch, nut_af, nut_h, nut_chamfer):
    thread = IsoThread(
        major_diameter=major,
        pitch=pitch,
        length=nut_h,
        external=False,
        end_finishes=("chamfer", "chamfer"),  # entra sola por los dos lados
    )
    circum = nut_af / 2 / math.cos(math.radians(30))
    body = extrude(RegularPolygon(circum, 6), amount=nut_h)
    body = Pos(0, 0, 0) * body
    if nut_chamfer > 0:
        body = chamfer(body.edges().filter_by(Plane.XY), length=nut_chamfer)
    body -= Cylinder(major / 2, nut_h * 3, align=(Align.CENTER, Align.CENTER, Align.CENTER))
    nut = body + thread
    return nut, thread


# --------------------------------------------------------------------------- main
def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--major", type=float, required=True, help="diametro exterior nominal (mm)")
    p.add_argument("--pitch", type=float, required=True, help="paso (mm) — >=1,0 para FDM")
    p.add_argument("--clearance", type=float, default=0.25,
                   help="cuanto se le achica al tornillo (mm al diametro). Def 0,25")
    p.add_argument("--total-length", type=float, required=True, help="largo total con cabeza (mm)")
    p.add_argument("--head-dia", type=float, required=True)
    p.add_argument("--head-th", type=float, required=True)
    p.add_argument("--head-chamfer", type=float, default=0.6)
    p.add_argument("--neck", type=float, default=1.0, help="tramo liso entre cabeza y rosca")
    p.add_argument("--knurl-n", type=int, default=12)
    p.add_argument("--knurl-depth", type=float, default=0.8)
    p.add_argument("--nut-af", type=float, required=True, help="entre caras de la tuerca (mm)")
    p.add_argument("--nut-h", type=float, required=True)
    p.add_argument("--nut-chamfer", type=float, default=0.5)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--name", default="tornillo")
    a = p.parse_args(argv)

    a.out.mkdir(parents=True, exist_ok=True)

    screw, sth = build_screw(
        major=a.major, pitch=a.pitch, clearance=a.clearance, total_length=a.total_length,
        head_dia=a.head_dia, head_th=a.head_th, neck=a.neck,
        knurl_n=a.knurl_n, knurl_depth=a.knurl_depth, head_chamfer=a.head_chamfer)
    nut, nth = build_nut(major=a.major, pitch=a.pitch, nut_af=a.nut_af, nut_h=a.nut_h,
                         nut_chamfer=a.nut_chamfer)

    bad = [n for n, s in (("tornillo", screw), ("tuerca", nut)) if not s.is_valid]
    if bad:
        raise SystemExit(f"solido invalido: {bad}")

    files = {}
    for label, solid in (("tornillo", screw), ("tuerca", nut)):
        stem = f"{a.name}_{label}"
        stl, stp = a.out / f"{stem}.stl", a.out / f"{stem}.step"
        export_stl(solid, str(stl), tolerance=0.005, angular_tolerance=0.1)
        export_step(solid, str(stp))
        files[label] = {"stl": str(stl), "step": str(stp)}

    # --- numeros que deciden si enrosca, calculados, no supuestos ---
    gap_crest_screw = a.major / 2 - sth.major_diameter / 2          # cresta tornillo -> raiz tuerca
    gap_crest_nut = nth.min_radius - sth.min_radius                 # cresta tuerca -> raiz tornillo
    flank = sth.major_diameter / 2 - nth.min_radius                 # solape radial real
    flank_nom = 0.5413 * a.pitch                                    # H1 ISO
    rep = {
        "params": vars(a) | {"out": str(a.out)},
        "tornillo": {
            "diam_mayor_rosca_mm": round(sth.major_diameter, 3),
            "diam_nucleo_mm": round(2 * sth.min_radius, 3),
            "vueltas": round((a.total_length - a.head_th - a.neck) / a.pitch, 1),
            "volumen_mm3": round(screw.volume, 1),
        },
        "tuerca": {
            "diam_mayor_rosca_mm": round(nth.major_diameter, 3),
            "diam_menor_mm": round(2 * nth.min_radius, 3),
            "vueltas": round(a.nut_h / a.pitch, 1),
            "volumen_mm3": round(nut.volume, 1),
        },
        "ajuste": {
            "luz_radial_cresta_tornillo_mm": round(gap_crest_screw, 4),
            "luz_radial_cresta_tuerca_mm": round(gap_crest_nut, 4),
            "solape_flanco_mm": round(flank, 4),
            "solape_flanco_nominal_ISO_mm": round(flank_nom, 4),
            "pct_flanco_retenido": round(100 * flank / flank_nom, 1),
        },
        "archivos": files,
    }
    (a.out / f"{a.name}_datos.json").write_text(json.dumps(rep, indent=2, ensure_ascii=False),
                                                encoding="utf-8")
    print(json.dumps(rep["ajuste"] | {"tornillo_vueltas": rep["tornillo"]["vueltas"],
                                      "tuerca_vueltas": rep["tuerca"]["vueltas"]},
                     indent=2, ensure_ascii=False))
    for k, v in files.items():
        print(f"  {k}: {v['stl']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
