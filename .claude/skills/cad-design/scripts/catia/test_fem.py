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


vm = fem.leer_export(open(os.path.join(AQUI, "_casos_fem", "vm_iso_ej58.txt"), encoding="latin-1").read())
chequear("leer_export: Von Mises real de 4 columnas (ej58), 5 nodos", len(vm) == 5 and all(len(f) == 4 for f in vm), vm)
chequear("leer_export: 7,59218e+007 N/m2 = 75,92 MPa", abs(vm[0][3] - 7.59218e7) < 1, vm[:1])


modos = fem.leer_frecuencias(open(os.path.join(AQUI, "_casos_fem", "informe_frecuencias_ej60.html"),
                                  encoding="latin-1").read())
chequear("leer_frecuencias: 10 modos del informe real (ej60)", len(modos) == 10 and modos[0][0] == 1, modos[:2])
chequear("leer_frecuencias: modo 1 = 204,19 Hz y modo 2 = 405,47 Hz (cuenta 203,71 / 407,43)",
         modos[:2] == [(1, 204.19), (2, 405.47)], modos[:2])
chequear("leer_frecuencias: un html sin tabla de modos da []", fem.leer_frecuencias("<html>Energy</html>") == [])


class MallaFalsa:
    def __init__(self):
        self.spec = {}

    def SetGlobalSpecification(self, k, v):
        self.spec[k] = v


def estudio_falso(n_mallas=1):
    e = fem.Estudio.__new__(fem.Estudio)
    m = MallaFalsa()
    partes = types.SimpleNamespace(Count=n_mallas, Item=lambda i: m)
    e.mo = types.SimpleNamespace(MeshManager=types.SimpleNamespace(AnalysisMeshParts=partes))
    return e, m


e, m = estudio_falso()
e.malla("Parabolic", "2mm")
chequear("malla(): pone ElementOrder Parabolic y el tamano (la lineal por defecto da -66 %)",
         m.spec == {"ElementOrder": "Parabolic", "SizeValue": "2mm"}, m.spec)
try:
    estudio_falso(2)[0].malla()
    chequear("malla(): con 2 mallas se niega (la otra quedaria lineal)", False, "no se nego")
except RuntimeError:
    chequear("malla(): con 2 mallas se niega (la otra quedaria lineal)", True)

import tempfile  # noqa: E402
carp = tempfile.mkdtemp(prefix="fem_test_")
viejo = os.path.join(carp, "desp.txt")
open(viejo, "w").write("x\ty\tz\tC1\n1\t2\t3\t4\n")


def estudio_que_exporta(contenido):
    e = fem.Estudio.__new__(fem.Estudio)
    e.c = types.SimpleNamespace(FileSystem=types.SimpleNamespace(GetFolder=lambda p: p))

    def add(*a):
        def export(carpeta, nombre, fmt):
            if contenido is not None:
                open(os.path.join(carpeta, nombre + ".txt"), "w").write(contenido)
        return types.SimpleNamespace(ExportData=export)
    e.sol = types.SimpleNamespace(AnalysisImages=types.SimpleNamespace(Add=add))
    return e


try:
    estudio_que_exporta(None).exportar("Disp_Symbol", carp, "desp")
    chequear("exportar: si CATIA no escribe nada se niega (y no lee el txt VIEJO)", False, "devolvio datos")
except RuntimeError:
    chequear("exportar: si CATIA no escribe nada se niega (y no lee el txt VIEJO)", True)
try:
    estudio_que_exporta("Locations Axis\tGlobal\nx(mm)\ty(mm)\tz(mm)\tValue(mm)\n").exportar("Disp_Symbol", carp, "desp")
    chequear("exportar: un txt solo con encabezados se niega", False, "devolvio []")
except RuntimeError:
    chequear("exportar: un txt solo con encabezados se niega", True)
chequear("exportar: un txt con nodos se lee", len(estudio_que_exporta("x\ty\tz\tV\n1\t2\t3\t4,5\n").exportar(
    "Disp_Symbol", carp, "desp")) == 1)

doc_sin = types.SimpleNamespace(Part=types.SimpleNamespace(GetItem=lambda n: types.SimpleNamespace(
    ApplyMaterialOnPart=lambda *a: None), Update=lambda: None), Product=None,
    GetWorkbench=lambda n: types.SimpleNamespace(Inertias=types.SimpleNamespace(
        Add=lambda p: types.SimpleNamespace(Density=1000.0))))
_orig = fem.material_por_indice
fem.material_por_indice = lambda *a: "acero"
c_falso = types.SimpleNamespace(Documents=types.SimpleNamespace(Read=lambda r: None))
try:
    fem.poner_acero(c_falso, doc_sin)
    chequear("poner_acero: densidad 1000 despues de aplicar = se niega", False, "devolvio 1000")
except RuntimeError:
    chequear("poner_acero: densidad 1000 despues de aplicar = se niega", True)
fem.material_por_indice = _orig


class Param:
    def __init__(self, nombre, valor):
        self.Name, self.valor, self.Value = nombre, valor, None

    def ValuateFromString(self, s):
        self.valor = s

    def ValueAsString(self):
        return self.valor if self.Value is None else str(self.Value)


def part_falsa(materiales=1):
    ps = []
    for m in range(materiales):
        for n, v in (("Young Modulus", "2e+011N_m2"), ("Density", "7860kg_m3"), ("Poisson Ratio", "0,266")):
            ps.append(Param(f"viga\\Steel\\Steel.{m + 1}\\{n}", v))
    ps.append(Param("viga\\PartBody\\Pad.1\\FirstLimit\\Length", "200mm"))
    lista = types.SimpleNamespace(Count=len(ps), Item=lambda i: ps[i - 1])
    return types.SimpleNamespace(Parameters=lista, Update=lambda: None), ps


pf, ps_f = part_falsa()
r = fem.material_propio(pf, 2.58e9, 1240, None)
chequear("material_propio: Young y densidad del PLA (TDS Bambu V3.0), Poisson sin tocar",
         ps_f[0].valor == "2.580000e+09N_m2" and ps_f[1].valor == "1240kg_m3" and ps_f[2].valor == "0,266", r)
pf2, _ = part_falsa(2)
try:
    fem.material_propio(pf2, 2.58e9, 1240)
    chequear("material_propio: con DOS materiales aplicados se niega", False, "no se nego")
except RuntimeError:
    chequear("material_propio: con DOS materiales aplicados se niega", True)


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
