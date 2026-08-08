# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe check_collision.py --help
"""Chequeo de colision: puntos del SUSTRATO (la pieza rigida del cliente) DENTRO del
fixture = choque duro. Registra la evidencia en el manifest (la exige export_deliverables).

Dos controles, y hacen falta LOS DOS:
  1. PENETRACION: puntos del sustrato dentro del fixture = choque duro.
  2. CONTACTO:    el punto mas cercano del sustrato al fixture, y cuantos puntos apoyan.

El 2 existe porque el 1 solo es CIEGO a la falla que costo mas cara (2026-08-07): se
entrego un ensamble con el dispositivo a 60 mm de la pieza y este script imprimio
"OK: sin choque duro" — porque efectivamente no penetraba nada. Aplicando la regla del
valor gemelo: el valor bueno era 0 y el valor CON la falla presente tambien era 0.
Un utillaje que no apoya no sujeta nada.

Leccion cara: verificar contra el sustrato RIGIDO, no contra el tapizado blando.
exit 0 = sin choque Y asienta; exit 1 = hay choque o no toca.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import geom, render, workdir  # noqa: E402

import numpy as np  # noqa: E402


def _parse_tags(s):
    return {int(x) for x in s.split(",")} if s else None


def _parse_zone(s):
    # "X:455,505" -> (0, 455.0, 505.0)
    axis_s, rng = s.split(":")
    lo, hi = (float(x) for x in rng.split(","))
    return ("XYZ".index(axis_s.upper()), lo, hi)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--fixture", required=True, help="STEP del fixture/pieza disenada")
    ap.add_argument("--substrate", required=True, help="STEP del sustrato RIGIDO del cliente")
    ap.add_argument("--substrate-keep", default=None, help="tags de solidos del sustrato, ej: 2")
    ap.add_argument("--transform", default=None,
                    help="nombre de transform del manifest para llevar el sustrato al frame del fixture")
    ap.add_argument("--zone", action="append", default=[],
                    help="limitar a una zona, ej: X:455,505 (repetible)")
    ap.add_argument("--lc", type=float, default=geom.LC_ANALYSIS)
    ap.add_argument("--render", action="store_true", help="renderizar el choque (puntos rojos)")
    ap.add_argument("--contacto-tol", type=float, default=0.30,
                    help="mm: por debajo de esto se considera que el fixture TOCA (default 0,30)")
    ap.add_argument("--min-contacto", type=int, default=30,
                    help="puntos del sustrato en contacto para considerar que asienta (default 30)")
    args = ap.parse_args()

    w = workdir.ensure_workdir(args.workdir)
    translate = None
    if args.transform:
        translate = workdir.get_transform(w, args.transform)
        print("aplicando transform '%s' = (%.3f, %.3f, %.3f) al sustrato" % (args.transform, *translate))

    sub_tris = geom.step_to_tris(args.substrate, lc=args.lc, keep=_parse_tags(args.substrate_keep),
                                 translate=translate)
    sub_pts = np.unique(sub_tris.reshape(-1, 3), axis=0)
    for axis, lo, hi in map(_parse_zone, args.zone):
        sub_pts = sub_pts[(sub_pts[:, axis] > lo) & (sub_pts[:, axis] < hi)]
    print("sustrato: %d pts%s" % (len(sub_pts), " (zona filtrada)" if args.zone else ""))
    if len(sub_pts) == 0:
        raise SystemExit("La zona filtrada dejo 0 puntos del sustrato — revisar --zone")

    m_fix = geom.step_to_trimesh(args.fixture, lc=args.lc)
    inside = geom.contains_batched(m_fix, sub_pts)
    n_in = int(inside.sum())

    stats = {}
    if n_in:
        import trimesh
        coll = sub_pts[inside]
        pq = trimesh.proximity.ProximityQuery(m_fix)
        _, dist, _ = pq.on_surface(coll)
        stats = {"depth_max": round(float(dist.max()), 2), "depth_p95": round(float(np.percentile(dist, 95)), 2)}
        print("CHOQUE: %d puntos del sustrato DENTRO del fixture (prof max %.2f mm, p95 %.2f)"
              % (n_in, dist.max(), np.percentile(dist, 95)))
        print("  zona: X[%.1f,%.1f] Y[%.1f,%.1f] Z[%.1f,%.1f]"
              % (coll[:, 0].min(), coll[:, 0].max(), coll[:, 1].min(), coll[:, 1].max(),
                 coll[:, 2].min(), coll[:, 2].max()))
    else:
        print("OK: 0 puntos del sustrato dentro del fixture (sin choque duro)")

    # ---------- el control COMPLEMENTARIO: ademas de no penetrar, tiene que TOCAR --------
    # Sin esto el gate es ciego a la falla que costo mas cara (2026-08-07): un utillaje
    # flotando a 60 mm de la pieza da n_inside = 0 e imprime "OK: sin choque duro".
    # Aplicando la regla del valor gemelo: el valor bueno es 0 y el valor CON la falla
    # presente tambien es 0 -> el control no distingue. Hace falta medir el contacto.
    import trimesh
    pq2 = trimesh.proximity.ProximityQuery(m_fix)
    _, d_all, _ = pq2.on_surface(sub_pts)
    d_min = float(d_all.min())
    n_toca = int((d_all <= args.contacto_tol).sum())
    area_ratio = 100.0 * n_toca / len(sub_pts)
    print("CONTACTO: el punto mas cercano del sustrato esta a %.2f mm del fixture | "
          "%d pts (%.1f %%) a menos de %.2f mm"
          % (d_min, n_toca, area_ratio, args.contacto_tol))
    sin_contacto = n_toca < args.min_contacto
    if sin_contacto:
        print("  [FALLA] el fixture NO TOCA el sustrato (hacen falta >= %d pts en contacto)."
              % args.min_contacto)
        print("          Un utillaje que no apoya no sujeta nada. Con la falla del 07/08"
              " —dispositivo a 60 mm— este control da 0 y el de penetracion daba 0 igual:")
        print("          por eso hay que correr los dos.")
    else:
        print("  OK: el fixture asienta sobre el sustrato.")

    workdir.record_evidence(w, "collision_check", fixture=os.path.basename(args.fixture),
                            substrate=os.path.basename(args.substrate), transform=args.transform,
                            zones=args.zone, n_inside=n_in, dist_min=round(d_min, 3),
                            n_contacto=n_toca, contacto_ok=not sin_contacto, **stats)

    if args.render:
        fix_tris = geom.step_to_tris(args.fixture, lc=args.lc)
        points = [(sub_pts[inside], "red", "choque (%d pts)" % n_in)] if n_in else None
        files = render.render_views(
            [(fix_tris, "#9ecae1", 0.30), (sub_tris, "#bbbbbb", 0.40)],
            os.path.join(w, "renders", "colision_%s" % os.path.splitext(os.path.basename(args.fixture))[0]),
            views={"iso": (22, -70), "top": (85, -90), "side": (5, 0)},
            title="colision %s vs %s" % (os.path.basename(args.fixture), os.path.basename(args.substrate)),
            points=points)
        for f in files:
            print("saved %s" % f)

    # falla si penetra O si no asienta: son dos modos distintos y los dos rompen
    sys.exit(1 if (n_in or sin_contacto) else 0)


if __name__ == "__main__":
    main()
