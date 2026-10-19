"""Prepara los poligonos de los machos de la v16 con el MISMO metodo que build_v10.py (copia en v16_ref/):
exterior = pts - nrm x off (por punto, off = luz y luz + entrada_retiro); interior = shapely buffer(-(luz+espesor),
round, quad_segs 16).simplify(0.002). Deja v16_ref/poligonos.json con todo lo que necesita el armado en CATIA."""
import json
from pathlib import Path

import numpy as np
from shapely.geometry import LinearRing, Polygon

import os  # noqa: E402

# los JSON de la v16 se COPIAN a la carpeta de trabajo (de C:\Dev\_utrim solo se lee): params_v10, cotas_v10_two,
# contorno_two, boca, frame
R = Path(os.environ.get("CATIA_TRABAJO", r"C:\Dev\_catia_practica")) / "v16_ref"
P = json.load(open(R / "params_v10.json", encoding="utf-8"))
C = json.load(open(R / "cotas_v10_two.json", encoding="utf-8"))
CONT = json.load(open(R / "contorno_two.json", encoding="utf-8"))
B = json.load(open(R / "boca.json", encoding="utf-8"))
F = json.load(open(R / "frame.json", encoding="utf-8"))
MA, ND, BS = P["macho"], P["nido"], P["base"]
Z_A, Z_B = B["meseta_pos"], B["meseta_neg"]
Z_TOPE = Z_B + MA["alto"]
Z_PLACA = Z_A - ND["rebaje"]
Z_BASE = Z_A - BS["alto"]
RAN = F["ranuras"]["two"]
CX = float(np.mean([r["x"] for r in RAN]))
LUZ = MA["luz_pared"]
out = {"Z_BASE": Z_BASE, "Z_PLACA": Z_PLACA, "Z_TOPE": Z_TOPE, "Z_CH": Z_TOPE - MA["chaflan"], "CX": CX,
       "HX": ND["x_two"], "HY": ND["y"], "R_PED": ND["fillet_pedestal"], "R_CANTO": ND["r_canto"],
       "AGARRE_R": ND["agarre_r"], "AGARRE_E": ND["agarre_e"], "apoyos": C["apoyos_v16"],
       "volumen_ref_mm3": C["volumen_cm3"] * 1000, "machos": []}
for r in RAN:
    c = CONT["ranuras"][f"{r['x']:.3f}"]
    pts, nrm = np.array(c["pts"]), np.array(c["nrm"])
    ext1 = (pts - nrm * LUZ)[:, :2]
    ext2 = (pts - nrm * (LUZ + MA["entrada_retiro"]))[:, :2]
    pol = Polygon(pts[:, :2]).buffer(-(LUZ + MA["espesor"]), join_style="round", quad_segs=16)
    q = np.array(pol.simplify(0.002).exterior.coords)[:-1]
    assert LinearRing(q).is_simple
    for nombre, a in (("ext1", ext1), ("ext2", ext2)):
        assert LinearRing(a).is_simple, nombre
    out["machos"].append({"x": r["x"], "n_ext": len(ext1), "n_int": len(q),
                          "ext1": ext1.round(5).tolist(), "ext2": ext2.round(5).tolist(), "int": q.round(5).tolist(),
                          "area_ext1": Polygon(ext1).area, "area_int": Polygon(q).area})
json.dump(out, open(R / "poligonos.json", "w", encoding="utf-8"))
print({k: v for k, v in out.items() if k not in ("machos", "apoyos")})
for m in out["machos"]:
    print(m["x"], m["n_ext"], m["n_int"], round(m["area_ext1"], 3), round(m["area_int"], 3))
