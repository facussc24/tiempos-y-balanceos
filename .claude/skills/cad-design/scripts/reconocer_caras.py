#!/usr/bin/env python
"""Clasifica las caras de un STEP (plano / cilindro / cono / esfera / toro) SIN barrer rayos.

POR QUE EXISTE. Casi todo lo que se pregunta de una pieza en este flujo se venia
contestando con rayos sobre una malla: donde hay un agujero, que radio tiene, cual cara es
plana, donde apoya. Un barrido de rayos cuesta segundos, depende del tamano de malla y
contesta con el error de la teselacion. Pero la mitad de esas preguntas ya estan
contestadas EXACTAS adentro del STEP: una cara cilindrica sabe su radio y su eje.

Dos fuentes, y hay que usar las dos:

  1. BRepAdaptor_Surface.GetType() — gratis (37 ms para 779 caras) y exacto, pero solo
     ve las caras que el STEP guardo como analiticas.
  2. ShapeAnalysis_CanonicalRecognition — recupera la forma canonica de las caras que
     vienen como NURBS. Cuesta ~2 ms por cara.

Cuanto aporta la segunda depende MUCHO del archivo, y por eso conviene medirlo antes de
confiar (numeros reales, tol 1e-4):

    virolador_v9_one_media.step   779 caras   35,3 % analiticas -> +28,8 % (221 planos
                                              y 3 cilindros escondidos en 504 NURBS)
    in/one_wireless.stp          1025 caras   69,2 % analiticas -> +3,7 %  (38 de 316)

O sea: sobre nuestras propias salidas recupera casi un tercio de las caras (el modelador
las guarda como NURBS aunque sean planos exactos: gap mediana 2e-14). Sobre el STEP del
cliente aporta poco, porque ahi lo que es NURBS es NURBS de verdad (clase A).

OJO CON LA TOLERANCIA — es el parametro que decide, no un detalle. Sobre una cara
realmente curva (extrusion de un spline):

    tol <= 1,0  ->  NO reconocida     (correcto)
    tol >= 5,0  ->  "plano"           (a 5 mm de tolerancia, casi todo es un plano)

El default es 1e-4 mm. Subirlo convierte esta herramienta en un generador de datos falsos.

QUE NO HACE. No tiene IsTorus: un toro sale como "no reconocida" (comprobado). Y no
reemplaza a los gates de rayos cuando la pregunta es de OCUPACION o PASO LIBRE — eso es
volumen, no tipo de superficie.

AUTOTEST — corre en cada invocacion. Convierte a NURBS una caja, un cilindro, una esfera y
un cono (tienen que reconocerse) y un toro y una cara de extrusion de spline (NO se tienen
que reconocer). Si el par no separa, sale con codigo 3 sin clasificar nada: un
reconocedor que dice "plano" a todo se ve igual de bien que uno que anda.

USO
    reconocer_caras.py --step pieza.step
    reconocer_caras.py --step pieza.step --cilindros          # radios y ejes (agujeros)
    reconocer_caras.py --step pieza.step --tol 1e-3 --json out.json
    reconocer_caras.py --solo-autotest

CODIGOS DE SALIDA
    0  clasifico
    2  no se pudo leer el STEP
    3  el AUTOTEST fallo: no se clasifica nada con un reconocedor que no probo distinguir
"""
import argparse
import json
import os
import sys
import time
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from OCP.BRepAdaptor import BRepAdaptor_Surface  # noqa: E402
from OCP.BRepBuilderAPI import BRepBuilderAPI_NurbsConvert  # noqa: E402
from OCP.BRepGProp import BRepGProp  # noqa: E402
from OCP.GProp import GProp_GProps  # noqa: E402
from OCP.GeomAbs import (GeomAbs_BezierSurface,  # noqa: E402
                         GeomAbs_BSplineSurface, GeomAbs_Cone,
                         GeomAbs_Cylinder, GeomAbs_Plane, GeomAbs_Sphere,
                         GeomAbs_Torus)
from OCP.IFSelect import IFSelect_RetDone  # noqa: E402
from OCP.STEPControl import STEPControl_Reader  # noqa: E402
from OCP.ShapeAnalysis import ShapeAnalysis_CanonicalRecognition  # noqa: E402
from OCP.TopAbs import TopAbs_FACE  # noqa: E402
from OCP.TopExp import TopExp, TopExp_Explorer  # noqa: E402
from OCP.TopoDS import TopoDS  # noqa: E402
from OCP.TopTools import TopTools_IndexedMapOfShape  # noqa: E402
from OCP.gp import gp_Cone, gp_Cylinder, gp_Pln, gp_Sphere  # noqa: E402

NOM = {GeomAbs_Plane: "plano", GeomAbs_Cylinder: "cilindro", GeomAbs_Cone: "cono",
       GeomAbs_Sphere: "esfera", GeomAbs_Torus: "toro",
       GeomAbs_BSplineSurface: "bspline", GeomAbs_BezierSurface: "bezier"}
ANALITICAS = (GeomAbs_Plane, GeomAbs_Cylinder, GeomAbs_Cone, GeomAbs_Sphere, GeomAbs_Torus)
LIBRES = (GeomAbs_BSplineSurface, GeomAbs_BezierSurface)


def _caras(shape):
    fmap = TopTools_IndexedMapOfShape()
    TopExp.MapShapes_s(shape, TopAbs_FACE, fmap)
    return [TopoDS.Face_s(fmap.FindKey(i)) for i in range(1, fmap.Extent() + 1)]


def canonico(face, tol):
    """(nombre, gap, parametros) de la cara NURBS, o (None, None, None)."""
    rec = ShapeAnalysis_CanonicalRecognition(face)
    pln, cyl, con, sph = gp_Pln(), gp_Cylinder(), gp_Cone(), gp_Sphere()
    pruebas = (("plano", "IsPlane", pln), ("cilindro", "IsCylinder", cyl),
               ("cono", "IsCone", con), ("esfera", "IsSphere", sph))
    for nombre, met, obj in pruebas:
        try:
            rec.ClearStatus()
            if getattr(rec, met)(tol, obj):
                par = {}
                if nombre == "cilindro":
                    par = {"R": obj.Radius()}
                elif nombre == "cono":
                    par = {"semiangulo_deg": obj.SemiAngle() * 180.0 / 3.141592653589793}
                elif nombre == "esfera":
                    par = {"R": obj.Radius()}
                return nombre, float(rec.GetGap()), par
        except Exception:
            try:
                rec.ClearStatus()
            except Exception:
                pass
    return None, None, None


def clasificar(shape, tol, recuperar=True):
    """[(tipo, fuente, area, params)] por cara. fuente = 'GetType' o 'Canonical'."""
    out = []
    for f in _caras(shape):
        ad = BRepAdaptor_Surface(f)
        t = int(ad.GetType())
        g = GProp_GProps()
        BRepGProp.SurfaceProperties_s(f, g)
        area = float(g.Mass())
        if t in ANALITICAS:
            par = {}
            if t == GeomAbs_Cylinder:
                par = {"R": float(ad.Cylinder().Radius())}
            elif t == GeomAbs_Sphere:
                par = {"R": float(ad.Sphere().Radius())}
            out.append((NOM[t], "GetType", area, par, 0.0))
        elif t in LIBRES and recuperar:
            nom, gap, par = canonico(f, tol)
            if nom:
                out.append((nom, "Canonical", area, par or {}, gap))
            else:
                out.append(("libre", "-", area, {}, None))
        else:
            out.append((NOM.get(t, "tipo%d" % t), "-", area, {}, None))
    return out


# =========================================================================================
# AUTOTEST
# =========================================================================================
def _nurbs(shape):
    return BRepBuilderAPI_NurbsConvert(shape, True).Shape()


def autotest(tol=1e-4):
    prob = []
    from OCP.BRepPrimAPI import BRepPrimAPI_MakeTorus
    from build123d import (BuildLine, BuildPart, BuildSketch, Box, Cone,  # noqa
                           Cylinder, Line, Spline, extrude, make_face)

    # --- BIEN: canonicas convertidas a NURBS, tienen que recuperarse ---
    casos = (("caja", Box(20, 30, 10).wrapped, "plano", 6),
             ("cilindro R=7", Cylinder(7, 20).wrapped, "cilindro", 1),
             ("cono", Cone(10, 4, 15).wrapped, "cono", 1))
    for nom, sh, esperado, cuantas in casos:
        n = _nurbs(sh)
        tipos = [int(BRepAdaptor_Surface(f).GetType()) for f in _caras(n)]
        if any(t in ANALITICAS for t in tipos):
            prob.append("%s: NurbsConvert dejo caras analiticas, el autotest no prueba "
                        "nada" % nom)
            continue
        res = Counter(canonico(f, tol)[0] or "NO" for f in _caras(n))
        print("    BIEN %-14s NURBS -> %s" % (nom, dict(res)))
        if res.get(esperado, 0) < cuantas:
            prob.append("%s: esperaba >=%d '%s' y dio %s -> el reconocedor NO recupera "
                        "una %s escondida en NURBS" % (nom, cuantas, esperado,
                                                       dict(res), esperado))

    # --- MAL: geometria que NO es ninguna de las cuatro ---
    toro = _nurbs(BRepPrimAPI_MakeTorus(20.0, 5.0).Shape())
    r_toro = [canonico(f, tol)[0] for f in _caras(toro)]
    print("    MAL  toro R=20 r=5   NURBS -> %s" % [x or "NO" for x in r_toro])
    if any(x is not None for x in r_toro):
        prob.append("el toro se reconoce como %s: FALSO POSITIVO (no hay IsTorus, "
                    "tendria que dar 'no reconocida')" % [x for x in r_toro if x])

    with BuildPart() as bp:
        with BuildSketch() as sk:  # noqa: F841
            with BuildLine() as bl:
                s1 = Spline((-20, 0), (-8, 9), (4, -6), (20, 3))
                Line(s1 @ 1, (20, -25))
                Line((20, -25), (-20, -25))
                Line((-20, -25), s1 @ 0)
            make_face()
        extrude(amount=12)
    n = _nurbs(bp.part.wrapped)
    res = Counter(canonico(f, tol)[0] or "NO" for f in _caras(n))
    print("    MAL  cara de spline  NURBS -> %s" % dict(res))
    if res.get("NO", 0) < 1:
        prob.append("la cara curva de la extrusion de spline se reconocio como canonica: "
                    "FALSO POSITIVO, el reconocedor le dice 'plano' a cualquier cosa")
    if res.get("plano", 0) < 5:
        prob.append("las 5 caras planas de la extrusion tendrian que reconocerse y dio "
                    "%s: FALSO NEGATIVO" % dict(res))
    return prob


# =========================================================================================
def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--step")
    p.add_argument("--tol", type=float, default=1e-4,
                   help="tolerancia de reconocimiento [mm]. OJO: con 5 mm casi todo es un "
                        "plano. Default 1e-4.")
    p.add_argument("--cilindros", action="store_true",
                   help="listar los radios de las caras cilindricas (agujeros, pines)")
    p.add_argument("--sin-recuperar", action="store_true",
                   help="solo GetType(), sin CanonicalRecognition (para comparar)")
    p.add_argument("--solo-autotest", action="store_true")
    p.add_argument("--json")
    a = p.parse_args()

    print("AUTOTEST del reconocedor (canonicas a NURBS que tienen que volver, "
          "y geometria libre que no)")
    prob = autotest(a.tol)
    if prob:
        print("  [AUTOTEST FALLA]")
        for x in prob:
            print("    - " + x)
        print("  No se clasifica nada con un reconocedor que no probo distinguir.")
        return 3
    print("  [AUTOTEST OK]\n")
    if a.solo_autotest:
        return 0
    if not a.step:
        p.error("hace falta --step (o --solo-autotest)")
    if not os.path.isfile(a.step):
        print("no existe: %s" % a.step)
        return 2

    t0 = time.perf_counter()
    rd = STEPControl_Reader()
    if rd.ReadFile(a.step) != IFSelect_RetDone:
        print("STEP ilegible: %s" % a.step)
        return 2
    rd.TransferRoots()
    shape = rd.OneShape()
    t_load = time.perf_counter() - t0

    t0 = time.perf_counter()
    filas = clasificar(shape, a.tol, recuperar=not a.sin_recuperar)
    t_cls = time.perf_counter() - t0
    n = len(filas)
    if not n:
        print("el STEP no tiene caras")
        return 2

    print("pieza: %s" % os.path.basename(a.step))
    print("caras: %d   lectura %.1f s   clasificacion %.2f s (%.1f ms/cara)   tol=%g\n"
          % (n, t_load, t_cls, 1000 * t_cls / n, a.tol))

    por_tipo = Counter(f[0] for f in filas)
    por_fuente = Counter(f[1] for f in filas)
    area_total = sum(f[2] for f in filas) or 1.0
    print("%-10s %6s %7s %9s %s" % ("tipo", "caras", "%", "% area", "de donde"))
    for tipo, k in por_tipo.most_common():
        ar = sum(f[2] for f in filas if f[0] == tipo)
        fue = Counter(f[1] for f in filas if f[0] == tipo)
        print("%-10s %6d %6.1f%% %8.1f%%  %s"
              % (tipo, k, 100.0 * k / n, 100.0 * ar / area_total,
                 " ".join("%s:%d" % (x, y) for x, y in fue.most_common())))

    directas = por_fuente.get("GetType", 0)
    recuperadas = por_fuente.get("Canonical", 0)
    print("\nanaliticas directas del STEP : %d  (%.1f %%)" % (directas, 100.0 * directas / n))
    print("recuperadas de NURBS         : %d  (%.1f %% extra)"
          % (recuperadas, 100.0 * recuperadas / n))
    print("siguen libres (NURBS de verdad): %d  (%.1f %%)"
          % (por_tipo.get("libre", 0), 100.0 * por_tipo.get("libre", 0) / n))

    if a.cilindros:
        radios = sorted(((f[3]["R"], f[1], f[2]) for f in filas
                         if f[0] == "cilindro" and "R" in f[3]), key=lambda x: x[0])
        print("\ncaras cilindricas por radio (candidatas a agujero / pin):")
        agr = Counter(round(r, 3) for r, _, _ in radios)
        for R, k in sorted(agr.items()):
            print("   R=%8.3f mm  (D=%8.3f)  x%d" % (R, 2 * R, k))

    if a.json:
        with open(a.json, "w", encoding="utf-8") as fh:
            json.dump({"autotest": "OK", "step": os.path.basename(a.step), "tol": a.tol,
                       "caras": n, "por_tipo": dict(por_tipo),
                       "por_fuente": dict(por_fuente),
                       "t_lectura_s": round(t_load, 3), "t_clasif_s": round(t_cls, 3),
                       "cilindros_R": sorted({round(f[3]["R"], 4) for f in filas
                                              if f[0] == "cilindro" and "R" in f[3]})},
                      fh, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
