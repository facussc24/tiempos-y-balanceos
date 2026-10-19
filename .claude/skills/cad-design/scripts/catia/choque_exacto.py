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
    # una operacion que no termino devuelve una forma vacia y su volumen da 0: se leia «no choca» (19/10, nido con luz
    # del ej25c: el gemelo subido 1 mm tambien daba 0). Sin terminar o con errores es «sin medir», nunca 0
    if not op.IsDone() or op.Shape().IsNull():           # HasErrors no esta expuesto en OCP
        return None
    return vol(op.Shape())


def dist(a_list, b_list):
    best = None
    for a in a_list:
        for b in b_list:
            d = BRepExtrema_DistShapeShape(a.wrapped, b.wrapped)
            d.Perform()
            best = d.Value() if best is None else min(best, d.Value())
    return best


out = {"solidos_utillaje": len(u), "solidos_panel": len(p),
       "vol_utillaje": round(sum(s.volume for s in u), 3), "vol_panel": round(sum(s.volume for s in p), 3)}
def redondo(x):
    return "SIN MEDIR" if x is None else round(x, 4)


inters = [comun(u, p, fz) for fz in (1e-4, 1e-3, 1e-2)]
for fz, x in zip((1e-4, 1e-3, 1e-2), inters):
    out[f"interseccion_fuzz_{fz}"] = redondo(x)
out["distancia_min"] = round(dist(u, p), 4)
dz = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
g = [s.moved(Location((0, 0, dz))) for s in u]
gem = comun(g, p, 1e-4)
out[f"gemelo_subido_{dz}_interseccion"] = redondo(gem)
# «no choca» solo si todas las intersecciones se midieron, dan 0 y el gemelo de la misma corrida SI choco
if any(x is None for x in inters) or gem is None or gem <= 0:
    out["veredicto"] = "SIN MEDIR (una operacion fallo o el gemelo no choco: el control no ve)"
elif max(inters) > 0:
    out["veredicto"] = "CHOCA"
else:
    out["veredicto"] = "no choca"
print(json.dumps(out))
