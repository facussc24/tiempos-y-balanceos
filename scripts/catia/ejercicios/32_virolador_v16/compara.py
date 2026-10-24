"""compara.py <A.step> <B.step> [--mover dx,dy,dz] [--caras]: compara dos solidos con OpenCASCADE (build123d) y trimesh.
Devuelve volumen de cada uno, lo que SOBRA (A - B) y lo que FALTA (B - A), y la distancia maxima entre superficies en
las dos direcciones (muestreo de 20 000 puntos). Con --mover se corre B (para el gemelo: tiene que dar rojo). Con
--caras agrega dist_max_caras_* (una grilla por CARA del B-Rep, exacta contra la cascara del otro: ve las caras de pocos
mm2 que la malla por area puede no tocar; 24/10, T3)."""
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
    return float(dist.max()), float(np.percentile(dist, 99)), p, dist


def exacta(puntos, dist, propio, otro, umbral=0.005):
    """24/10 (ejercicio 49 y su revisor): la distancia de MALLA a malla mezcla el facetado (OpenCASCADE malla el STEP de
    CATIA con puntos a 0,029 mm de su propio B-Rep). Se recalcula EXACTA en TODOS los puntos de malla a mas de `umbral`:
    cada punto se lleva a la CASCARA propia (el punto mas cercano del B-Rep de donde salio) y de ahi se mide a la CASCARA
    del otro. Contra el solido no: un punto que cae ADENTRO del otro solido da 0 y un resalto de 0,05 pasaba (revisor del
    49). No reemplaza a la de malla: se agrega al lado. None si BRepExtrema no termina."""
    from build123d import Vertex
    from OCP.BRepExtrema import BRepExtrema_DistShapeShape
    try:
        cascara_propia, cascara_otra = propio.shells()[0].wrapped, otro.shells()[0].wrapped
        peor = 0.0
        for i in np.where(dist > umbral)[0]:
            e = BRepExtrema_DistShapeShape(Vertex(*map(float, puntos[i])).wrapped, cascara_propia)
            e.Perform()
            if not e.IsDone():
                return None
            q = e.PointOnShape2(1)
            e2 = BRepExtrema_DistShapeShape(Vertex(q.X(), q.Y(), q.Z()).wrapped, cascara_otra)
            e2.Perform()
            if not e2.IsDone():
                return None
            peor = max(peor, e2.Value())
        return peor
    except Exception:  # noqa: BLE001
        return None


def por_caras(propio, otro, n=5):
    """24/10 (revisor Fable del cierre de la tanda, T3): la malla reparte 20 000 puntos por AREA y una cara de pocos mm2
    (el fondo de un agujero ciego D1) puede no recibir ninguno: un D1 con 2,5 de profundidad en vez de 3 quedaba verde en
    toda la cadena. Aca CADA cara del B-Rep propio recibe una grilla n x n en su espacio (u, v) (los puntos que caen
    adentro de la cara, mas el centro de la caja uv) y cada punto se mide EXACTO contra la cascara del otro.
    Devuelve (peor distancia, puntos medidos, caras sin ningun punto) o None si BRepExtrema no termina."""
    from build123d import Vertex
    from OCP.BRepAdaptor import BRepAdaptor_Surface
    from OCP.BRepClass import BRepClass_FaceClassifier
    from OCP.BRepExtrema import BRepExtrema_DistShapeShape
    from OCP.BRepTools import BRepTools
    from OCP.gp import gp_Pnt2d
    from OCP.TopAbs import TopAbs_IN, TopAbs_ON
    try:
        cascara_otra = otro.shells()[0].wrapped
        peor, medidos, vacias = 0.0, 0, 0
        for f in propio.faces():
            cara = f.wrapped
            umin, umax, vmin, vmax = BRepTools.UVBounds_s(cara)
            sup = BRepAdaptor_Surface(cara)
            uvs = [((umin + umax) / 2, (vmin + vmax) / 2)]
            uvs += [(umin + (umax - umin) * (i + 0.5) / n, vmin + (vmax - vmin) * (j + 0.5) / n)
                    for i in range(n) for j in range(n)]
            dentro = 0
            for u, v in uvs:
                if BRepClass_FaceClassifier(cara, gp_Pnt2d(u, v), 1e-7).State() not in (TopAbs_IN, TopAbs_ON):
                    continue
                q = sup.Value(u, v)
                e = BRepExtrema_DistShapeShape(Vertex(q.X(), q.Y(), q.Z()).wrapped, cascara_otra)
                e.Perform()
                if not e.IsDone():
                    return None
                peor, dentro = max(peor, e.Value()), dentro + 1
            medidos += dentro
            vacias += dentro == 0
        return peor, medidos, vacias
    except Exception:  # noqa: BLE001
        return None


ab, ab99, pa_, da_ = hasta(A, Bm)
ba, ba99, pb_, db_ = hasta(Bm, A)
ab_ex, ba_ex = exacta(pa_, da_, a, b), exacta(pb_, db_, b, a)
caras = {}
if "--caras" in sys.argv:                 # opcional hasta que los jueces lo lean (T3 de la COLA): no cambia lo de hoy
    for clave, (x, y) in (("A_a_B", (a, b)), ("B_a_A", (b, a))):
        r = por_caras(x, y)
        caras[f"dist_max_caras_{clave}"] = None if r is None else round(r[0], 5)
        caras[f"puntos_caras_{clave}"] = None if r is None else r[1]
        caras[f"caras_sin_punto_{clave}"] = None if r is None else r[2]
bba, bbb = a.bounding_box(), b.bounding_box()
print(json.dumps({"vol_A": round(vol(a), 3), "vol_B": round(vol(b), 3), "sobra_A_menos_B": round(sobra, 3),
                  "falta_B_menos_A": round(falta, 3), "comun": round(comun, 3), "booleana_cierra": cierra, "tolerancia_booleana": fuzz_usado, "dist_max_A_a_B": round(ab, 4), "p99_A_a_B": round(ab99, 4),
                  "dist_max_B_a_A": round(ba, 4), "p99_B_a_A": round(ba99, 4),
                  "dist_max_exacta_A_a_B": None if ab_ex is None else round(ab_ex, 5),
                  "dist_max_exacta_B_a_A": None if ba_ex is None else round(ba_ex, 5),
                  "caja_A": [round(bba.size.X, 3), round(bba.size.Y, 3), round(bba.size.Z, 3)],
                  "caja_B": [round(bbb.size.X, 3), round(bbb.size.Y, 3), round(bbb.size.Z, 3)],
                  "solidos": [len(a.solids()), len(b.solids())], **caras}))
