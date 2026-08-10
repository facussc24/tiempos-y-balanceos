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
                neck, knurl_n, knurl_depth, head_chamfer, fillet_r=None,
                relief_d=0.0, relief_depth=0.0, shank_d=None):
    """Cabeza en z=[0, head_th], vastago LISO al diametro pleno, y rosca hasta total_length.

    El tramo liso (`neck`) no es decorativo: la rosca adelgaza el nucleo a d-1,23*paso, asi
    que un tornillo roscado de punta a punta se corta justo donde mas flexa, contra la cabeza.
    El vastago liso va al diametro pleno (es el que tiene que pasar por el agujero) y la
    rosca arranca recien despues, donde ya no hay momento flector.
    """
    thread_major = major - clearance
    # el vastago liso es independiente del nominal de rosca: lo fija el AGUJERO por el que
    # pasa, no la rosca. Por defecto va al mismo diametro exterior que la rosca.
    shank_d = thread_major if shank_d is None else shank_d
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

    # REBAJE en la cara de apoyo: hunde el acuerdo por debajo del plano donde arranca el
    # agujero. Sin esto el fillet engorda el vastago 2*r justo en el tramo que tiene que
    # pasar por ese agujero, y el tornillo queda apoyado 1 mm afuera.
    z_acuerdo = head_th
    if relief_d > 0 and relief_depth > 0:
        if relief_d < shank_d + 2 * (fillet_r or 0):
            raise SystemExit(f"el rebaje Ø{relief_d} no da para un fillet de {fillet_r} "
                             f"(hace falta Ø{shank_d + 2 * (fillet_r or 0):.2f})")
        head -= Pos(0, 0, head_th - relief_depth) * Cylinder(
            relief_d / 2, relief_depth * 2, align=(Align.CENTER, Align.CENTER, Align.MIN))
        z_acuerdo = head_th - relief_depth

    # nucleo continuo de punta a punta (enterrado dentro de la cabeza)
    core = Cylinder(thread.min_radius, total_length,
                    align=(Align.CENTER, Align.CENTER, Align.MIN))
    # ORDEN DE FUSION: la rosca se pega PRIMERO a su nucleo, y recien despues entran cabeza
    # y vastago. Al reves (head+core+shank+rosca) el resultado sale VACIO con volumen 0 y
    # `is_valid` True — comprobado con paso 1,5. La rosca es un Compound y solo fusiona
    # limpio contra el cilindro con el que solapa por `interference`.
    vastago = core + (Pos(0, 0, head_th + neck) * thread)
    # vastago liso al diametro PLENO desde la cabeza hasta donde arranca la rosca
    shank = Cylinder(shank_d / 2, head_th + neck,
                     align=(Align.CENTER, Align.CENTER, Align.MIN))
    body = head + vastago + shank

    # radio de acuerdo cabeza-vastago: es donde flexa y donde se corta si no lo tiene
    if neck > 0 and (fillet_r or 0) > 0:
        target = [e for e in body.edges().filter_by(GeomType.CIRCLE)
                  if abs(e.center().Z - z_acuerdo) < 1e-6
                  and abs(e.radius - shank_d / 2) < 1e-6]
        if len(target) != 1:
            raise SystemExit(f"esperaba 1 arista de acuerdo en z={z_acuerdo}, "
                             f"encontre {len(target)}")
        body = fillet(target, radius=fillet_r)

    # moleteado: gajos cilindricos en el canto para agarrar con los dedos
    if knurl_n > 0 and knurl_depth > 0:
        r_cut = 1.2
        r_pos = head_dia / 2 + r_cut - knurl_depth
        for k in range(knurl_n):
            a = 2 * math.pi * k / knurl_n
            body -= Pos(r_pos * math.cos(a), r_pos * math.sin(a), 0) * Cylinder(
                r_cut, head_th * 3, align=(Align.CENTER, Align.CENTER, Align.MIN)
            )

    screw = body
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
    p.add_argument("--neck", type=float, default=1.0,
                   help="largo del vastago LISO al diametro pleno, entre cabeza y rosca")
    p.add_argument("--fillet", type=float, default=0.25,
                   help="radio de acuerdo cabeza-vastago. TOPE: engorda el vastago 2*r en la "
                        "raiz, asi que no puede pasarse de la holgura del agujero")
    p.add_argument("--shank-dia", type=float, default=None,
                   help="diametro del vastago liso. Lo manda el AGUJERO por el que pasa. "
                        "Por defecto = diametro exterior de la rosca")
    p.add_argument("--head-relief", type=float, default=0.0,
                   help="diametro del rebaje en la cara de apoyo: hunde el fillet para que "
                        "el vastago siga entrando en su agujero")
    p.add_argument("--head-relief-depth", type=float, default=0.0)
    p.add_argument("--knurl-n", type=int, default=12)
    p.add_argument("--knurl-depth", type=float, default=0.8)
    p.add_argument("--nut-af", type=float, required=True, help="entre caras de la tuerca (mm)")
    p.add_argument("--nut-h", type=float, required=True)
    p.add_argument("--nut-chamfer", type=float, default=0.5)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--name", default="tornillo")
    a = p.parse_args(argv)

    a.out.mkdir(parents=True, exist_ok=True)

    shank_calc = a.shank_dia if a.shank_dia is not None else a.major - a.clearance
    if abs(shank_calc - (a.major - a.clearance)) < 0.2 and shank_calc != a.major - a.clearance:
        raise SystemExit(f"vastago Ø{shank_calc} y rosca Ø{a.major - a.clearance}: menos de "
                         f"0,2 mm de escalon, el booleano se degenera")

    screw, sth = build_screw(
        major=a.major, pitch=a.pitch, clearance=a.clearance, total_length=a.total_length,
        head_dia=a.head_dia, head_th=a.head_th, neck=a.neck, fillet_r=a.fillet,
        relief_d=a.head_relief, relief_depth=a.head_relief_depth, shank_d=a.shank_dia,
        knurl_n=a.knurl_n, knurl_depth=a.knurl_depth, head_chamfer=a.head_chamfer)
    nut, nth = build_nut(major=a.major, pitch=a.pitch, nut_af=a.nut_af, nut_h=a.nut_h,
                         nut_chamfer=a.nut_chamfer)

    # `is_valid` devuelve True para un compound VACIO: no alcanza como control.
    # Cuando el vastago y la cresta de rosca caen al mismo diametro las caras quedan
    # coincidentes, el booleano se degenera y el export escribe un STEP vacio SIN avisar.
    for nombre, solido in (("tornillo", screw), ("tuerca", nut)):
        if not solido.is_valid:
            raise SystemExit(f"solido invalido: {nombre}")
        if solido.volume < 1.0:
            raise SystemExit(f"{nombre}: volumen {solido.volume:.3f} mm3 — el solido salio "
                             f"vacio. Suele ser vastago y rosca al MISMO diametro "
                             f"(vastago {shank_calc:.2f} vs rosca {a.major - a.clearance:.2f}): "
                             f"dejar al menos 0,2 mm de escalon.")

    files = {}
    for label, solid in (("tornillo", screw), ("tuerca", nut)):
        stem = f"{a.name}_{label}"
        stl, stp = a.out / f"{stem}.stl", a.out / f"{stem}.step"
        export_stl(solid, str(stl), tolerance=0.005, angular_tolerance=0.1)
        export_step(solid, str(stp))
        for f in (stl, stp):   # el export puede fallar en silencio
            if not f.exists() or f.stat().st_size < 20_000:
                raise SystemExit(f"{f.name} no se escribio o quedo vacio "
                                 f"({f.stat().st_size if f.exists() else 0} bytes)")
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
            "vastago_liso_diam_mm": a.shank_dia or round(a.major - a.clearance, 3),
            "vastago_liso_largo_mm": a.neck,
            "diam_max_que_pasa_por_agujero_mm": round(
                max(a.shank_dia or (a.major - a.clearance), a.major - a.clearance)
                + (0 if a.head_relief > 0 else 2 * a.fillet), 3),
            "fillet_en_la_base_mm": a.fillet,
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
