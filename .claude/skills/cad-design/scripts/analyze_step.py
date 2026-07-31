# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe analyze_step.py --help
"""Analiza un STEP SIN MALLAR: solidos, bboxes, caras planas y sondas de topologia.

Escalera de costo (usar en este orden, nunca saltar al ultimo):
  1. buscar el feature   --find [--only-free]   instantaneo  -> DONDE esta
  2. acotar por ventana  --zone X:a,b           instantaneo  -> que hay en esta zona
  3. vecinos             --neighbors t1,t2,...  instantaneo  -> QUE es (relieve o contorno)
  4. medir               --offset t1,t2,...     segundos     -> CUANTO mide
  5. mallar              (los otros CLIs)       minutos      -> ultimo recurso

Criterio duro: un feature SIN caras de flanco no tiene relieve — es un contorno
imprentado sobre la superficie (se ve en CATIA, ningun visor de solidos lo dibuja).

Carga con highestDimOnly=False (via cadlib.topo): conserva las caras LIBRES, las que no
bordean ningun solido. Los grabados suelen ser exactamente eso — con el default de gmsh
no existen (two_upholstered.stp: 2548 caras contra 2737). El motor esta en `cadlib.topo`.
"""
import argparse
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import geom, topo  # noqa: E402

import gmsh  # noqa: E402
import numpy as np  # noqa: E402

EPILOG = """\
ejemplos (caso real: el simbolo del cargador del Upper Trim VW427):
  # todo junto: buscar los grabados y medirlos (14 s en un STEP de 14 MB)
  analyze_step.py pieza.stp --find --only-free --measure

  # paso a paso
  analyze_step.py pieza.stp --zone X:2572,2583 --zone Z:463,469 --zone Y:0,60
  analyze_step.py pieza.stp --neighbors 2732,2733,2734,2735,2736
  analyze_step.py pieza.stp --offset 2732,2733,2734,2735,2736      # la referencia se deduce
  analyze_step.py pieza.stp --offset 2732,2733,2734,2735,2736:2550 # o se fuerza
"""


def _parse_zone(s):
    """'X:2572,2583' -> (0, 2572.0, 2583.0)"""
    axis_s, rng = s.split(":")
    lo, hi = (float(x) for x in rng.split(","))
    return ("XYZ".index(axis_s.upper()), lo, hi)


def _parse_tags(s):
    return [int(x) for x in s.replace(" ", "").split(",") if x]


def _fmt_bbox(b):
    return "X[%.2f,%.2f] Y[%.2f,%.2f] Z[%.2f,%.2f]" % (b[0], b[3], b[1], b[4], b[2], b[5])


def cabecera(m):
    fb = topo.face_boxes(m)
    libres = int((fb["solid"] == topo.FREE).sum())
    print("Solidos: %d | Caras: %d | de esas LIBRES (sin solido padre): %d"
          % (len(gmsh.model.getEntities(3)), len(fb), libres))
    if libres:
        print("  las caras libres son candidatas a grabado / contorno imprentado: ningun visor"
              " de solidos las dibuja y el mallado no las ve")
    return fb


def probe_find(m, fb, args):
    """Sonda 1: clusters de caras chicas = candidatos a feature fino. Instantaneo."""
    cl = topo.find_fine_features(m, max_diag=args.max_diag, min_faces=args.min_faces,
                                 only_free=args.only_free)
    print("\nFEATURES FINOS ENCONTRADOS: %d cluster(s)%s"
          % (len(cl), " (solo caras libres)" if args.only_free else ""))
    if not cl:
        print("  (ninguno — subir --max-diag, o sacar --only-free)")
        return []
    for i, c in enumerate(cl[:args.max_clusters]):
        print("  [%d] %d caras  %.2f x %.2f x %.2f mm  centro (%.1f, %.1f, %.1f)  %s"
              % (i, c["n_caras"], c["dims"][0], c["dims"][1], c["dims"][2],
                 c["centro"][0], c["centro"][1], c["centro"][2],
                 "LIBRE" if c["libre"] else "de solido"))
        print("      tags: %s" % ",".join(str(t) for t in c["tags"]))
    if len(cl) > args.max_clusters:
        print("  ... y %d cluster(s) mas (subir --max-clusters)" % (len(cl) - args.max_clusters))
    return cl[:args.max_clusters]


def probe_zone(m, fb, zones, max_faces):
    """Sonda 2: caras cuya bbox cae ENTERA en la ventana. Instantaneo."""
    sel = fb
    for ax, lo, hi in zones:
        nm_lo, nm_hi = ("xmin", "ymin", "zmin")[ax], ("xmax", "ymax", "zmax")[ax]
        sel = sel[(sel[nm_lo] >= lo) & (sel[nm_hi] <= hi)]
    print("\nCARAS DENTRO DE LA ZONA: %d (de %d)" % (len(sel), len(fb)))
    if len(sel) == 0:
        print("  (ninguna cara entra ENTERA en la ventana — agrandarla)")
        return []
    sel = sel[np.argsort(sel["diag"])]
    for r in sel[:max_faces]:
        bb = (r["xmin"], r["ymin"], r["zmin"], r["xmax"], r["ymax"], r["zmax"])
        print("  cara %5d %s %-16s diag=%6.2f mm  %s"
              % (r["tag"], "LIBRE " if r["solid"] == topo.FREE else "solido",
                 gmsh.model.getType(2, int(r["tag"])), r["diag"], _fmt_bbox(bb)))
    if len(sel) > max_faces:
        print("  ... y %d mas (subir --max-faces)" % (len(sel) - max_faces))
    lo = (sel["xmin"].min(), sel["ymin"].min(), sel["zmin"].min())
    hi = (sel["xmax"].max(), sel["ymax"].max(), sel["zmax"].max())
    print("  envolvente del grupo: %s" % _fmt_bbox((lo[0], lo[1], lo[2], hi[0], hi[1], hi[2])))
    print("  tamano: %.2f x %.2f x %.2f mm" % (hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]))
    tags = sorted(int(t) for t in sel["tag"])
    print("  tags: %s" % ",".join(str(t) for t in tags))
    return tags


def probe_neighbors(m, tags):
    """Sonda 3: con quien comparte curvas. Dice si el feature TIENE relieve. Instantaneo."""
    v = topo.face_neighbors(m, tags)
    print("\nVECINDAD del grupo %s" % ",".join(str(t) for t in v["tags"]))
    print("  curvas del contorno: %d" % v["n_curvas"])
    if not v["vecinos"]:
        print("  SIN VECINOS: el grupo es una isla (no es un feature de una superficie)")
        return v
    for tag, k in v["vecinos"][:12]:
        bb = gmsh.model.getBoundingBox(2, tag)
        print("  vecina %5d  %-16s comparte %2d curvas  %s"
              % (tag, gmsh.model.getType(2, tag), k, _fmt_bbox(bb)))
    if len(v["vecinos"]) > 12:
        print("  ... y %d vecina(s) mas" % (len(v["vecinos"]) - 12))
    if len(v["vecinos"]) == 1:
        print("  VEREDICTO: UNA sola cara vecina (%d) -> no hay caras de flanco -> NO hay relieve."
              % v["vecinos"][0][0])
        print("             Contorno IMPRENTADO sobre la superficie. Confirmar con --offset.")
    else:
        print("  VEREDICTO: %d caras vecinas -> puede haber flancos (relieve real). Medir con --offset."
              % len(v["vecinos"]))
    return v


def probe_offset(m, tags, ref, n, n_ref):
    """Sonda 4: cuanto sobresale/se hunde el feature. Segundos (muestreo parametrico)."""
    r = topo.measure_offset(m, tags, tag_referencia=ref, n=n, n_ref=n_ref)
    n_ = r["normal"]
    print("\nOFFSET del grupo %s contra la cara %d%s"
          % (",".join(str(t) for t in r["tags"]), r["tag_referencia"],
             "" if ref else " (referencia deducida: la vecina con mas curvas)"))
    print("  plano del feature: normal=(%+.6f,%+.6f,%+.6f)  inclinacion vs Z=%.2f deg"
          % (n_[0], n_[1], n_[2], r["inclinacion_vs_Z_deg"]))
    print("  planitud del feature: %.6f mm | tamano en su plano: %.2f x %.2f mm"
          % (r["planitud_mm"], r["tam_en_plano_mm"][0], r["tam_en_plano_mm"][1]))
    print("  puntos: %d del feature, %d de la referencia en la ventana"
          % (r["n_pts_feature"], r["n_pts_ref"]))
    print("  OFFSET medio=%+.6f mm  [min %+.6f, max %+.6f]   (+ sobresale / - hundido)"
          % (r["offset_medio_mm"], r["offset_min_mm"], r["offset_max_mm"]))
    if not r["tiene_flancos"] and abs(r["offset_medio_mm"]) < topo.TOL_PLANO:
        print("  -> PROFUNDIDAD 0,000 mm: al ras y sin flancos = contorno imprentado, no es cavidad.")
    else:
        print("  -> el feature %s %.3f mm respecto de la cara %d (flancos: %s)"
              % ("sobresale" if r["offset_medio_mm"] > 0 else "se hunde",
                 abs(r["offset_medio_mm"]), r["tag_referencia"],
                 "si" if r["tiene_flancos"] else "no"))
    return r


def overview(n_planes):
    vols = gmsh.model.getEntities(3)
    xmin, ymin, zmin, xmax, ymax, zmax = gmsh.model.getBoundingBox(-1, -1)
    print("BBOX TOTAL: X[%.2f,%.2f] Y[%.2f,%.2f] Z[%.2f,%.2f]" % (xmin, xmax, ymin, ymax, zmin, zmax))
    print("  dims: %.2f x %.2f x %.2f mm" % (xmax - xmin, ymax - ymin, zmax - zmin))

    for dim, tag in vols:
        bb = gmsh.model.getBoundingBox(dim, tag)
        mass = gmsh.model.occ.getMass(dim, tag)
        com = gmsh.model.occ.getCenterOfMass(dim, tag)
        name = gmsh.model.getEntityName(dim, tag)
        print("\nSOLIDO tag=%d name='%s'" % (tag, name))
        print("  bbox: %s" % _fmt_bbox(bb))
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
        print("  caras planas (top %d por area):" % n_planes)
        for area, st, n, ang in planes[:n_planes]:
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


def main():
    ap = argparse.ArgumentParser(description=__doc__, epilog=EPILOG,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("path", help="archivo STEP/STP/IGES a analizar")
    ap.add_argument("--planes", type=int, default=12, help="cuantas caras planas listar por solido (por area)")
    ap.add_argument("--find", action="store_true",
                    help="[sonda 1] buscar clusters de caras chicas (grabados, nervaduras, logos)")
    ap.add_argument("--only-free", action="store_true", help="con --find: solo caras libres")
    ap.add_argument("--max-diag", type=float, default=None,
                    help="con --find: diagonal maxima de una cara 'chica' (default 5%% de la pieza)")
    ap.add_argument("--min-faces", type=int, default=2, help="con --find: minimo de caras por cluster")
    ap.add_argument("--max-clusters", type=int, default=8, help="con --find: cuantos clusters listar")
    ap.add_argument("--measure", action="store_true",
                    help="con --find: ademas correr vecinos + offset de cada cluster listado")
    ap.add_argument("--zone", action="append", default=[], metavar="AXIS:lo,hi",
                    help="[sonda 2] caras cuya bbox cae en la ventana, ej: X:2572,2583 (repetible)")
    ap.add_argument("--max-faces", type=int, default=30, help="maximo de caras a listar en --zone")
    ap.add_argument("--neighbors", default=None, metavar="t1,t2,...",
                    help="[sonda 3] con que caras comparte curvas ese grupo (dice si hay relieve)")
    ap.add_argument("--offset", default=None, metavar="t1,t2,...[:tref]",
                    help="[sonda 4] offset del grupo contra la cara tref (si no se da, se deduce)")
    ap.add_argument("--grid", type=int, default=30, help="puntos por lado al muestrear el feature")
    ap.add_argument("--grid-ref", type=int, default=250, help="puntos por lado al muestrear la referencia")
    ap.add_argument("--solids-only", action="store_true",
                    help="cargar descartando las caras libres (el default de gmsh) — solo para comparar")
    args = ap.parse_args()

    sondas = bool(args.find or args.zone or args.neighbors or args.offset)

    with topo.open_step(args.path, highest_dim_only=args.solids_only) as m:
        print("ARCHIVO: %s%s" % (args.path, "  [--solids-only]" if args.solids_only else ""))
        fb = cabecera(m)
        if not sondas:
            overview(args.planes)
            return

        tags_zona = probe_zone(m, fb, [_parse_zone(z) for z in args.zone], args.max_faces) if args.zone else None

        if args.find:
            for c in probe_find(m, fb, args):
                if args.measure:
                    probe_neighbors(m, c["tags"])
                    try:
                        probe_offset(m, c["tags"], None, args.grid, args.grid_ref)
                    except RuntimeError as e:
                        print("  (no se pudo medir el offset: %s)" % e)

        tags_vec = _parse_tags(args.neighbors) if args.neighbors else (tags_zona if args.zone else None)
        if tags_vec and not (args.find and args.measure):
            probe_neighbors(m, tags_vec)

        if args.offset:
            spec = args.offset
            ref = None
            if ":" in spec:
                spec, ref_s = spec.rsplit(":", 1)
                ref = int(ref_s)
            try:
                probe_offset(m, _parse_tags(spec), ref, args.grid, args.grid_ref)
            except RuntimeError as e:
                # tipico: se forzo una referencia que no esta al lado del feature. Medir
                # contra la cara equivocada es como salio -0,700 mm donde iba 0,000:
                # mejor cortar que devolver un numero lindo y falso.
                raise SystemExit("[offset] %s\n"
                                 "Si forzaste --offset ...:tref, revisar que tref sea la vecina real"
                                 " (correr --neighbors primero) o dejar que se deduzca sola." % e)


if __name__ == "__main__":
    main()
