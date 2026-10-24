# -*- coding: utf-8 -*-
"""El control de build123d del ej67 de la practica (la cadena CONTROL de ej67_perno_diamante.py, sin cambios salvo este
docstring): con el STEP que exporta CATIA (perno y placa), interseccion exacta del perno con la placa corrida 0 / 0,15 /
0,20 en x, y la del gemelo, un perno REDONDO del mismo d corrido 0,15. Corre en .venv-cad.
Uso: python choque_perno.py <step> <d>  ->  una linea JSON."""
import sys, json
from build123d import import_step, Pos, Cylinder, Box
sol = sorted(import_step(sys.argv[1]).solids(), key=lambda s: s.volume)
perno, placa = sol[0], sol[1]
d = float(sys.argv[2])
redondo = Pos(0, 0, 5) * Cylinder(d / 2, 10)
def choque(a, corr):
    i = a & (Pos(corr, 0, 0) * placa)
    return round(sum(s.volume for s in i.solids()) if i else 0.0, 6)
print(json.dumps({"vol_perno": round(perno.volume, 3), "vol_placa": round(placa.volume, 3),
                  "diamante_corrido_0": choque(perno, 0.0), "diamante_corrido_0.15": choque(perno, 0.15),
                  "diamante_corrido_0.20": choque(perno, 0.20), "redondo_corrido_0.15": choque(redondo, 0.15)}))
