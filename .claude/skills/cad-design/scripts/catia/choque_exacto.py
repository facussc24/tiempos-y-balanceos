"""choque_exacto.py <utillaje.step> <panel.step>: interseccion EXACTA (B-Rep, OpenCASCADE) entre las dos piezas y
distancia minima, con tolerancias crecientes; mas el gemelo (utillaje subido 1 mm hacia el panel) que tiene que dar choque."""
import json
import sys

from build123d import Location, import_step
from OCP.BRepAlgoAPI import BRepAlgoAPI_Common
from OCP.BRepExtrema import BRepExtrema_DistShapeShape
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.TopTools import TopTools_ListOfShape

u = import_step(sys.argv[1]).solids()
p = import_step(sys.argv[2]).solids()


def vol(sh):
    g = GProp_GProps()
    BRepGProp.VolumeProperties_s(sh, g)
    return g.Mass()


def comun(a_list, b_list, fuzz):
    op = BRepAlgoAPI_Common()
    la, lb = TopTools_ListOfShape(), TopTools_ListOfShape()
    for s in a_list:
        la.Append(s.wrapped)
    for s in b_list:
        lb.Append(s.wrapped)
    op.SetArguments(la)
    op.SetTools(lb)
    op.SetFuzzyValue(fuzz)
    op.Build()
    # una operacion que no termina devuelve una forma vacia de volumen 0, que se leeria «no choca»: sin terminar es
    # «sin medir», nunca 0 (HasErrors no esta expuesto en OCP)
    if not op.IsDone() or op.Shape().IsNull():
        return None
    return vol(op.Shape())


def dist(a_list, b_list):
    best = None
    for a in a_list:
        for b in b_list:
            d = BRepExtrema_DistShapeShape(a.wrapped, b.wrapped)
            d.Perform()
            if not d.IsDone():
                return None
            best = d.Value() if best is None else min(best, d.Value())
    return best


out = {"solidos_utillaje": len(u), "solidos_panel": len(p),
       "vol_utillaje": round(sum(s.volume for s in u), 3), "vol_panel": round(sum(s.volume for s in p), 3)}
def redondo(x):
    return "SIN MEDIR" if x is None else round(x, 4)


inters = [comun(u, p, fz) for fz in (1e-4, 1e-3, 1e-2)]
for fz, x in zip((1e-4, 1e-3, 1e-2), inters):
    out[f"interseccion_fuzz_{fz}"] = redondo(x)
dmin = dist(u, p)
out["distancia_min"] = redondo(dmin)
dz = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
g = [s.moved(Location((0, 0, dz))) for s in u]
out[f"gemelo_subido_{dz}_interseccion"] = redondo(comun(g, p, 1e-4))   # dato, no decide
# 19/10, auditor: un gemelo > 0 no prueba la luz (el nido del ej25c con el gemelo subido 2 mm daba 1,08 mm³ y salia
# «no choca» con distancia 0). Decide la distancia exacta (BRepExtrema), que no pasa por el booleano
TOL = 1e-4
medidas = [x for x in inters if x is not None]
if any(x > TOL for x in medidas):
    out["veredicto"] = "CHOCA"
elif len(medidas) < len(inters) or dmin is None:
    out["veredicto"] = "SIN MEDIR (una operacion de OpenCASCADE fallo)"
elif dmin <= TOL:
    out["veredicto"] = "toca (luz 0)"
else:
    out["veredicto"] = "no choca"
print(json.dumps(out))
