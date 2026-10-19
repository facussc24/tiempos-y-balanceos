"""Pruebas SIN CATIA de fem.py y material_catia.py (19/10, simulacion por programa):
1. leer_export sobre un pedazo REAL del txt que exporto CATIA en el ej57 (viga en voladizo, malla lineal): saltea los 3
   renglones de encabezado, lee coma decimal y exponente («-4,56031e-005»), y la punta (x 200) vale -0,273555 en C3.
2. material_por_indice encuentra Metal/Steel recorriendo por indice y se niega (KeyError) si el material no esta."""
import os
import sys
import types

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import fem  # noqa: E402
import material_catia as mc  # noqa: E402

fallas = []


def chequear(nombre, cond, detalle=""):
    print(("   ok    " if cond else "   FALLA ") + nombre + ("" if cond else f"  [{detalle}]"))
    if not cond:
        fallas.append(nombre)


filas = fem.leer_export(open(os.path.join(AQUI, "_casos_fem", "disp_symbol_ej57.txt"), encoding="latin-1").read())
chequear("leer_export: 9 nodos (los 3 encabezados afuera)", len(filas) == 9, len(filas))
chequear("leer_export: cada nodo con x y z + C1 C2 C3", all(len(f) == 6 for f in filas), [len(f) for f in filas])
punta = [f for f in filas if f[0] == 200.0]
chequear("leer_export: la punta (x 200) baja -0,273555 en C3 (coma decimal)", punta and punta[0][5] == -0.273555, punta[:1])
chequear("leer_export: exponente «e-005» leido", any(abs(f[4] + 4.56031e-05) < 1e-12 for f in filas), filas[-1])
chequear("leer_export: renglones sin numeros no rompen", fem.leer_export("Values axis\tGlobal\t\n\n") == [])
chequear("leer_export: un renglon con menos de 4 numeros se descarta", fem.leer_export("1\t2\t3\t\n") == [])


def familia(nombre, mats):
    ms = types.SimpleNamespace(Count=len(mats), Item=lambda j: types.SimpleNamespace(Name=mats[j - 1]))
    return types.SimpleNamespace(Name=nombre, Materials=ms)


fams = [familia("Construction", ["Concrete"]), familia("Metal", ["Aluminium", "Iron", "Steel"])]
mdoc = types.SimpleNamespace(Families=types.SimpleNamespace(Count=len(fams), Item=lambda i: fams[i - 1]))
chequear("material_por_indice: Metal/Steel", mc.material_por_indice(mdoc, "Metal", "Steel").Name == "Steel")
try:
    mc.material_por_indice(mdoc, "Metal", "Acero")
    chequear("material_por_indice: un material que no esta se niega", False, "no se nego")
except KeyError:
    chequear("material_por_indice: un material que no esta se niega", True)
try:
    mc.material_por_indice(mdoc, "Wood", "Steel")
    chequear("material_por_indice: la familia equivocada se niega", False, "no se nego")
except KeyError:
    chequear("material_por_indice: la familia equivocada se niega", True)

print("RESULTADO:", "OK" if not fallas else f"{len(fallas)} FALLAS {fallas}")
sys.exit(1 if fallas else 0)
