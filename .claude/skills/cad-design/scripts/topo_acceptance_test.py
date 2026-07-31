# -*- coding: utf-8 -*-
# Interprete: .venv-cad (Py3.12). Correr: C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe topo_acceptance_test.py --help
"""Test de aceptacion de cadlib.topo contra un caso REAL: el logo del Upper Trim VW427.

Caso: `-two wireless with switch UPHOLSTERED-0702.stp` (Consola Central / Upper Trim Panel,
VW427-1LA_K Patagonia). Fak pidio ver el logo y medir la profundidad del grabado; el camino
de mallar la pieza entera y buscarlo a ojo tardo 1 h 20 min Y DIO UN NUMERO EQUIVOCADO
(-0,700 mm, que es el rebaje del pad, no el del simbolo). Este test fija el camino correcto:
leer la topologia del STEP, sin mallar.

Verdad de terreno (verificada a mano, 2026-07-31):
  - 6 solidos, 2737 caras, 189 de ellas LIBRES (sin solido padre) — ahi vive el logo.
  - Simbolo lado +Y: caras 2732..2736, vecina unica 2550 (el pad), 26 curvas compartidas.
  - Simbolo lado -Y: caras 2646..2650, vecina unica 2660 (el pad espejado), 26 curvas.
  - Envolvente por lado: X[2572,04-2582,66] Z[463,90-468,83]; Y[36,87-53,08] / [-52,91;-36,70].
  - Tamano sobre la superficie: 16,21 x 11,71 mm. Normal (0,420742; 0; -0,907180) = 24,88 deg.
  - Offset simbolo vs pad = 0,000 mm y SIN caras de flanco -> es un contorno IMPRENTADO,
    no una cavidad. No tiene profundidad.

CORRECCION al traspaso original: la vecina del simbolo -Y es la cara 2660, no la 2464.
La 2464 es una cara de 0,62 x 0,55 x 0,33 mm en X~2630 Y~-34,4 Z~490,5 — ni cerca del
simbolo. La 2660 (X[2532,95-2627,95] Y[-74,15;-15,63] Z[445,78-489,83]) es el espejo exacto
de la 2550, que es lo que tiene que ser.

Si el STEP no esta en disco, el test SKIPea (exit 0) — no falla.
"""
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadlib import envcheck, topo  # noqa: E402

import numpy as np  # noqa: E402

STEP_DEFAULT = os.path.join(
    os.environ.get("TEMP", r"C:\Users\facun\AppData\Local\Temp"),
    r"claude\C--Dev-BarackMercosul\c784a8a1-559a-4816-94ed-591c941c35c5",
    r"scratchpad\uppertrim\in\two_upholstered.stp")

SIMBOLO_MAS_Y = [2732, 2733, 2734, 2735, 2736]
SIMBOLO_MENOS_Y = [2646, 2647, 2648, 2649, 2650]
PAD_MAS_Y = 2550
PAD_MENOS_Y = 2660
N_CARAS = 2737
N_SOLIDOS = 6
N_LIBRES = 189
BBOX_MAS_Y = (2572.04, 36.87, 463.90, 2582.66, 53.08, 468.83)
BBOX_MENOS_Y = (2572.04, -52.91, 463.90, 2582.66, -36.70, 468.83)
TAM_EN_PLANO = (16.21, 11.71)
NORMAL = (0.420742, 0.0, -0.907180)
INCLINACION = 24.88

TOL_OFFSET = 1e-4   # mm — exigido por el criterio de aceptacion
TOL_BBOX = 0.01     # mm
TOL_NORMAL = 1e-5


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--step", default=STEP_DEFAULT, help="STEP del Upper Trim (default: copia en scratchpad)")
    ap.add_argument("--max-seg", type=float, default=60.0, help="tope de tiempo total en segundos")
    args = ap.parse_args()

    if not os.path.isfile(args.step):
        print("SKIP: no esta el STEP del caso real.\n"
              "  buscado en: %s\n"
              "  original  : Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\Proyecto\\VWA\\"
              "VW427-1LA_K-PATAGONIA\\Consola Central_Upper Trim Panel\\05 - Documentos de Producto "
              "y Proceso\\Planos y 3D\\-two wireless with switch UPHOLSTERED-0702.stp\n"
              "  copiar ese archivo (Y: es SOLO LECTURA) y volver a correr con --step <ruta>."
              % args.step)
        return 0

    envcheck.require(("gmsh", "numpy", "scipy"))
    if sys.version_info[:2] != (3, 12):
        print("AVISO: interprete %d.%d (canonico: 3.12 del .venv-cad)" % sys.version_info[:2])

    t0 = time.time()
    with topo.open_step(args.step) as m:
        t_load = time.time() - t0
        print("[1/7] STEP importado en %.1f s (una sola vez; todo lo demas reusa la sesion)" % t_load)

        t = time.time()
        fb = topo.face_boxes(m)
        libres = int((fb["solid"] == topo.FREE).sum())
        solidos = len(set(int(s) for s in fb["solid"] if s != topo.FREE))
        assert len(fb) == N_CARAS, "esperaba %d caras, hay %d" % (N_CARAS, len(fb))
        assert solidos == N_SOLIDOS, "esperaba %d solidos, hay %d" % (N_SOLIDOS, solidos)
        assert libres == N_LIBRES, "esperaba %d caras libres, hay %d" % (N_LIBRES, libres)
        print("[2/7] face_boxes: %d caras / %d solidos / %d caras LIBRES en %.2f s (sin mallar)"
              % (len(fb), solidos, libres, time.time() - t))

        # --- encontrar los simbolos SIN pasarle los tags, con los defaults de la libreria ---
        t = time.time()
        clusters = topo.find_fine_features(m, min_faces=3)
        t_find = time.time() - t
        por_tags = {tuple(c["tags"]): c for c in clusters}
        c_mas = por_tags.get(tuple(SIMBOLO_MAS_Y))
        c_menos = por_tags.get(tuple(SIMBOLO_MENOS_Y))
        assert c_mas is not None, ("find_fine_features no devolvio el cluster %s. Clusters con "
                                   "3-10 caras: %s" % (SIMBOLO_MAS_Y,
                                                       [c["tags"] for c in clusters if c["n_caras"] <= 10]))
        assert c_menos is not None, "find_fine_features no devolvio el cluster %s" % SIMBOLO_MENOS_Y
        finos = [c for c in clusters if c["libre"] and 3 <= c["n_caras"] <= 10]
        print("[3/7] find_fine_features (defaults, sin tags): %d clusters en %.2f s; "
              "los 2 simbolos salen EXACTOS (%s y %s). Candidatos libres de 3-10 caras: %d"
              % (len(clusters), t_find, c_mas["tags"], c_menos["tags"], len(finos)))

        for nombre, c, esperado in (("+Y", c_mas, BBOX_MAS_Y), ("-Y", c_menos, BBOX_MENOS_Y)):
            err = np.abs(np.asarray(c["bbox"]) - np.asarray(esperado)).max()
            assert err <= TOL_BBOX, "bbox %s: error %.4f mm vs verdad de terreno (%s)" % (nombre, err, c["bbox"])
        print("[4/7] envolventes OK: +Y X[%.2f,%.2f] Y[%.2f,%.2f] Z[%.2f,%.2f] | -Y Y[%.2f,%.2f]"
              % (c_mas["bbox"][0], c_mas["bbox"][3], c_mas["bbox"][1], c_mas["bbox"][4],
                 c_mas["bbox"][2], c_mas["bbox"][5], c_menos["bbox"][1], c_menos["bbox"][4]))

        # --- la vecindad es lo que distingue grabado real de contorno imprentado ---
        t = time.time()
        v_mas = topo.face_neighbors(m, SIMBOLO_MAS_Y)
        v_menos = topo.face_neighbors(m, SIMBOLO_MENOS_Y)
        for nombre, v, pad in (("+Y", v_mas, PAD_MAS_Y), ("-Y", v_menos, PAD_MENOS_Y)):
            assert v["n_curvas"] == 26, "%s: esperaba 26 curvas, hay %d" % (nombre, v["n_curvas"])
            assert len(v["vecinos"]) == 1, "%s: esperaba UNA vecina, hay %s" % (nombre, v["vecinos"])
            assert v["vecinos"][0] == (pad, 26), "%s: vecina %s (esperaba (%d, 26))" % (nombre, v["vecinos"][0], pad)
        print("[5/7] face_neighbors en %.3f s: +Y -> 26 curvas, vecina unica %d | -Y -> 26 curvas, vecina unica %d"
              % (time.time() - t, PAD_MAS_Y, PAD_MENOS_Y))

        # --- medicion: plano por covarianza 3x3, offset contra la normal comun ---
        t = time.time()
        med = {}
        for nombre, tags, pad in (("+Y", SIMBOLO_MAS_Y, PAD_MAS_Y), ("-Y", SIMBOLO_MENOS_Y, PAD_MENOS_Y)):
            r = topo.measure_offset(m, tags)  # sin pasarle la referencia: la deduce
            med[nombre] = r
            assert r["tag_referencia"] == pad, "%s: dedujo referencia %d (esperaba %d)" % (
                nombre, r["tag_referencia"], pad)
            assert abs(r["offset_medio_mm"]) < TOL_OFFSET, "%s: offset medio %.6f mm" % (nombre, r["offset_medio_mm"])
            assert abs(r["offset_min_mm"]) < TOL_OFFSET, "%s: offset min %.6f mm" % (nombre, r["offset_min_mm"])
            assert abs(r["offset_max_mm"]) < TOL_OFFSET, "%s: offset max %.6f mm" % (nombre, r["offset_max_mm"])
            assert r["tiene_flancos"] is False, "%s: tiene_flancos deberia ser False" % nombre
            assert r["planitud_mm"] < TOL_OFFSET, "%s: planitud %.6f mm" % (nombre, r["planitud_mm"])
            nerr = np.abs(np.abs(r["normal"]) - np.abs(np.asarray(NORMAL))).max()
            assert nerr < TOL_NORMAL, "%s: normal %s (esperaba %s)" % (nombre, r["normal"], NORMAL)
            assert abs(r["inclinacion_vs_Z_deg"] - INCLINACION) < 0.01, "%s: inclinacion %.3f deg" % (
                nombre, r["inclinacion_vs_Z_deg"])
            tam = np.abs(np.asarray(r["tam_en_plano_mm"]) - np.asarray(TAM_EN_PLANO)).max()
            assert tam < TOL_BBOX, "%s: tamano en plano %s (esperaba %s)" % (nombre, r["tam_en_plano_mm"], TAM_EN_PLANO)
        r = med["+Y"]
        print("[6/7] measure_offset en %.2f s | offset medio %.9f mm (min %.9f / max %.9f), "
              "planitud %.9f mm, tiene_flancos=%s, %d pts feature vs %d pts pad"
              % (time.time() - t, r["offset_medio_mm"], r["offset_min_mm"], r["offset_max_mm"],
                 r["planitud_mm"], r["tiene_flancos"], r["n_pts_feature"], r["n_pts_ref"]))
        print("      normal (%.6f, %.6f, %.6f) = %.2f deg | logo %.2f x %.2f mm sobre la superficie"
              % (r["normal"][0], r["normal"][1], r["normal"][2], r["inclinacion_vs_Z_deg"],
                 r["tam_en_plano_mm"][0], r["tam_en_plano_mm"][1]))

        # --- control NEGATIVO: fit_plane no puede reventar con nubes grandes ---
        t = time.time()
        pts = np.random.default_rng(0).normal(size=(500000, 3))
        pts[:, 2] *= 1e-6
        n_fit, _c, _d = topo.fit_plane_robust(pts)
        assert abs(abs(float(n_fit[2])) - 1.0) < 1e-6, "fit_plane_robust no encontro el plano XY: %s" % n_fit
        print("[7/7] fit_plane_robust con 500.000 puntos en %.2f s (con np.linalg.svd de la matriz "
              "completa numpy pediria 1,75 TiB y moriria)" % (time.time() - t))

    total = time.time() - t0
    print("\nTOPO ACCEPTANCE OK — %.1f s totales (tope %.0f s). Camino viejo: 1 h 20 min y el "
          "numero mal." % (total, args.max_seg))
    assert total < args.max_seg, "tardo %.1f s, el tope es %.0f s" % (total, args.max_seg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
