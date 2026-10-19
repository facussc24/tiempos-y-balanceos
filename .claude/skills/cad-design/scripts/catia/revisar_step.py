"""revisar_step_b123d.py <archivo.step>: la revision de un STEP con OTRO motor (OpenCASCADE/build123d): solidos, volumen
de cada uno, si es valido, caras y BORDES ABIERTOS (aristas que tocan una sola cara = agujero o rendija entre caras).
Imprime un JSON. Corre en .venv-cad."""
import json
import sys

from build123d import import_step
from OCP.TopExp import TopExp
from OCP.TopTools import TopTools_IndexedDataMapOfShapeListOfShape
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE


def bordes_abiertos(forma, minimo=1e-6):
    """Aristas que tocan UNA sola cara. Las de largo ~0 (degeneradas: el polo de una esfera, una costura colapsada) NO
    son agujeros y se cuentan aparte (two_wireless: 44 «abiertas» de 0,0 mm). Devuelve (abiertas, largo, degeneradas,
    aristas)."""
    from OCP.GProp import GProp_GProps
    from OCP.BRepGProp import BRepGProp
    from build123d import Edge
    mapa = TopTools_IndexedDataMapOfShapeListOfShape()
    TopExp.MapShapesAndAncestors_s(forma.wrapped, TopAbs_EDGE, TopAbs_FACE, mapa)
    abiertas, largo, degeneradas = [], 0.0, 0
    for i in range(1, mapa.Extent() + 1):
        if mapa.FindFromIndex(i).Extent() == 1:
            g = GProp_GProps()
            BRepGProp.LinearProperties_s(mapa.FindKey(i), g)
            if g.Mass() < minimo:
                degeneradas += 1
                continue
            abiertas.append(Edge(mapa.FindKey(i)))
            largo += g.Mass()
    return len(abiertas), largo, degeneradas, abiertas


def lazos(aristas):
    """En cuantos lazos cerrados se juntan los bordes libres: 1 = el contorno de afuera; mas = agujeros o rendijas."""
    from build123d import Wire
    if not aristas:
        return []
    ws = Wire.combine(aristas, tol=1e-3)
    return [{"largo_mm": round(w.length, 2), "cerrado": w.is_closed} for w in sorted(ws, key=lambda w: -w.length)]


s = import_step(sys.argv[1])
solidos = s.solids()
filas = []
for k, so in enumerate(solidos):
    ab, lg, deg, _ = bordes_abiertos(so)
    filas.append({"solido": k + 1, "vol": round(so.volume, 3), "area": round(so.area, 3), "caras": len(so.faces()),
                  "valido": so.is_valid, "bordes_abiertos": ab, "largo_bordes_abiertos_mm": round(lg, 3),
                  "aristas_degeneradas": deg})
ids_solidos = {hash(g) for so in solidos for g in so.faces()}
sueltas = [f for f in s.faces() if hash(f) not in ids_solidos]
piel = {}
if sueltas:
    from build123d import Shell
    sh = Shell(sueltas)
    ab, lg, deg, aristas = bordes_abiertos(sh)
    piel = {"caras": len(sueltas), "area": round(sum(f.area for f in sueltas), 3), "bordes_libres": ab,
            "largo_bordes_libres_mm": round(lg, 2), "degeneradas": deg, "lazos": lazos(aristas)}
print(json.dumps({"solidos": filas, "caras_total": len(s.faces()), "superficies_sueltas": piel}))
