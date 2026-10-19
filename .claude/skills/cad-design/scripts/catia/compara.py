"""compara.py <A.step> <B.step> [--mover dx,dy,dz]: compara dos solidos con OpenCASCADE (build123d) y trimesh.
Devuelve volumen de cada uno, lo que SOBRA (A - B) y lo que FALTA (B - A), y la distancia maxima entre superficies en
las dos direcciones (muestreo de 20 000 puntos). Con --mover se corre B (para el gemelo: tiene que dar rojo)."""
import json
import sys
import tempfile
from pathlib import Path

import numpy as np
import trimesh
from build123d import Location, export_stl, import_step

a = import_step(sys.argv[1])
b = import_step(sys.argv[2])
if "--mover" in sys.argv:
    dx, dy, dz = map(float, sys.argv[sys.argv.index("--mover") + 1].split(","))
    b = b.moved(Location((dx, dy, dz)))


from OCP.BRepAlgoAPI import BRepAlgoAPI_Common, BRepAlgoAPI_Cut  # noqa: E402
from OCP.BRepGProp import BRepGProp  # noqa: E402
from OCP.GProp import GProp_GProps  # noqa: E402
from OCP.TopTools import TopTools_ListOfShape  # noqa: E402


def vol(s):
    return float(sum(x.volume for x in s.solids())) if s is not None else 0.0


def vol_sh(sh):
    g = GProp_GProps()
    BRepGProp.VolumeProperties_s(sh, g)
    return g.Mass()


def booleana(Op, x, y, fuzz=1e-4):
    """19/10: dos solidos de motores distintos con caras COINCIDENTES hacen fallar la booleana sin tolerancia (A-B
    devolvia A entero y A^B = 0). Segun el par, cierra con 1e-4 (etapa 2 de la v16) o recien con 1e-2 (v16 de CATIA
    contra la original): por eso se prueban 1e-4, 1e-3 y 1e-2 y se informa cual cerro. Con una pieza CORRIDA no cierra
    con ninguna (comun 0): el que separa ahi es la distancia (0,1 contra 0,0016)."""
    op = Op()
    la, lb = TopTools_ListOfShape(), TopTools_ListOfShape()
    la.Append(x.solids()[0].wrapped)
    lb.Append(y.solids()[0].wrapped)
    op.SetArguments(la)
    op.SetTools(lb)
    op.SetFuzzyValue(fuzz)
    op.Build()
    return vol_sh(op.Shape())


def tres(fuzz):
    return (booleana(BRepAlgoAPI_Cut, a, b, fuzz), booleana(BRepAlgoAPI_Cut, b, a, fuzz),
            booleana(BRepAlgoAPI_Common, a, b, fuzz))


# invariante: sobra + comun = A y falta + comun = B. NO alcanza solo (19/10): cuando la resta devuelve la pieza entera,
# sobra = A y comun = 0 tambien cierran. Por eso, ademas: si las dos piezas se superponen (sus cajas se pisan) el comun
# no puede ser casi cero. Se prueba con tolerancias crecientes hasta que las dos cosas cierren.
pisan = all(max(bb0, cc0) < min(bb1, cc1) for bb0, bb1, cc0, cc1 in zip(
    (a.bounding_box().min.X, a.bounding_box().min.Y, a.bounding_box().min.Z),
    (a.bounding_box().max.X, a.bounding_box().max.Y, a.bounding_box().max.Z),
    (b.bounding_box().min.X, b.bounding_box().min.Y, b.bounding_box().min.Z),
    (b.bounding_box().max.X, b.bounding_box().max.Y, b.bounding_box().max.Z)))
cierra, fuzz_usado = False, None
for fz in (1e-4, 1e-3, 1e-2):
    sobra, falta, comun = tres(fz)
    ok_inv = abs(sobra + comun - vol(a)) < 0.5 and abs(falta + comun - vol(b)) < 0.5
    ok_comun = (not pisan) or comun > 1e-3 * min(vol(a), vol(b))
    if ok_inv and ok_comun:
        cierra, fuzz_usado = True, fz
        break
d = Path(tempfile.mkdtemp())
ma, mb = d / "a.stl", d / "b.stl"
export_stl(a, str(ma), tolerance=0.002, angular_tolerance=0.05)
export_stl(b, str(mb), tolerance=0.002, angular_tolerance=0.05)
A, Bm = trimesh.load(str(ma)), trimesh.load(str(mb))
rng = np.random.default_rng(0)


def hasta(src, dst):
    p, _ = trimesh.sample.sample_surface(src, 20000, seed=1)
    _, dist, _ = trimesh.proximity.closest_point(dst, p)
    return float(dist.max()), float(np.percentile(dist, 99))


ab, ab99 = hasta(A, Bm)
ba, ba99 = hasta(Bm, A)
bba, bbb = a.bounding_box(), b.bounding_box()
print(json.dumps({"vol_A": round(vol(a), 3), "vol_B": round(vol(b), 3), "sobra_A_menos_B": round(sobra, 3),
                  "falta_B_menos_A": round(falta, 3), "comun": round(comun, 3), "booleana_cierra": cierra, "tolerancia_booleana": fuzz_usado, "dist_max_A_a_B": round(ab, 4), "p99_A_a_B": round(ab99, 4),
                  "dist_max_B_a_A": round(ba, 4), "p99_B_a_A": round(ba99, 4),
                  "caja_A": [round(bba.size.X, 3), round(bba.size.Y, 3), round(bba.size.Z, 3)],
                  "caja_B": [round(bbb.size.X, 3), round(bbb.size.Y, 3), round(bbb.size.Z, 3)],
                  "solidos": [len(a.solids()), len(b.solids())]}))
