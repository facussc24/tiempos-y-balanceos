"""Arma la hoja de plotter de un tipo de Insert: N piezas DER en una columna y N IZQ en otra, apiladas a lo ancho del
material (eje Y), sin girar ni espejar, con separacion real >= GAP. Las piezas salen del archivo de 4 piezas con
orejita (orientacion del mixto R2). La segunda columna se acerca a la primera hasta GAP real."""
import sys, numpy as np, ezdxf, itertools
from shapely.geometry import Polygon
from shapely.affinity import translate

SRC, TIPO, N, GAP, OUT = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
pz = {}
for e in ezdxf.readfile(SRC).modelspace().query("LWPOLYLINE"):
    pol = Polygon([(p[0], p[1]) for p in e.get_points("xy")])
    x0, y0, x1, y1 = pol.bounds
    tipo = "DEL" if (x1 - x0) > 650 else "TRA"
    pz[(tipo, "DER" if x0 < 300 else "IZQ")] = translate(pol, -x0, -y0)
der, izq = pz[(TIPO, "DER")], pz[(TIPO, "IZQ")]


def columna(p, x):
    h = p.bounds[3]
    return [translate(p, x, i * (h + GAP)) for i in range(N)]


c1 = columna(der, 0)
# columna 2: arranca lejos y se acerca de a 0,5 mm hasta que la distancia real a la columna 1 llega a GAP
A = c1[0]
for p in c1[1:]: A = A.union(p)
dx = c1[0].bounds[2] + 100
while True:
    B = columna(izq, dx - 0.5)
    BB = B[0]
    for p in B[1:]: BB = BB.union(p)
    if A.distance(BB) < GAP: break
    dx -= 0.5
c2 = columna(izq, dx)
todas = c1 + c2
X = max(p.bounds[2] for p in todas); Y = max(p.bounds[3] for p in todas)
dmin = min(a.distance(b) for a, b in itertools.combinations(todas, 2))
print(f"{TIPO}: {len(todas)} piezas, hoja {X:.1f} (largo, eje X) x {Y:.1f} (ancho, eje Y) mm, separacion real minima {dmin:.2f} mm")
for p in todas:
    assert abs(p.area - (der if p in c1 else izq).area) < 1e-6
doc = ezdxf.new("R2010"); doc.header["$INSUNITS"] = 4; doc.header["$MEASUREMENT"] = 1
if "CORTE" not in doc.layers: doc.layers.add("CORTE", color=7)
msp = doc.modelspace()
for p in todas:
    msp.add_lwpolyline(list(p.exterior.coords)[:-1], close=True, dxfattribs={"layer": "CORTE"})
doc.saveas(OUT)
print("guardado", OUT)
