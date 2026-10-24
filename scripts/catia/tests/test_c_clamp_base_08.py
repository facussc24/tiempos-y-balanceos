# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 08 del banco de CATIA (Too Tall Toby PPP01-03 C Clamp Base, CATA 24/10/2026).

1. Las cotas del catia.py son las de _c_clamp_base.py del ejercicio 14 del banco 3D (la lectura del plano).
2. La cuenta por operacion (geometria(), Python puro) contra el volumen que midio medir_b123d.py sobre el bien.py del 14
   (CATA, 24/10/2026 09:05: 35 605,547 mm3): el area de la U por Green contra la cuenta cerrada, y la masa con 2 700 kg/m3
   contra la guia (96,13 g). Con build123d (.venv-cad): el volumen de modelo() y lo que saca el agujero.
3. construir() con una CATIA FALSA: la U cierra (cada punto lo comparten dos tramos), cada arco barre menos de 180 y
   pasa por su punto medio, los planos de los topes quedan en x 2,5 y 86, el Hole va a la cara de x -9 con el modo del
   ej33, el aluminio del catalogo (2 710) pasa a 2 700 y la masa llega a salida.json.
4. cerrar_con_masa(): VERDE con la masa a 0,005 g; ROJO con los dos mutantes del 14 (sin el agujero +2,885 g, sin los
   R18 +6,008 g, tarea.yaml); sin material no hay verde."""
import importlib.util
import json
import math
import os
import sys
import tempfile
import types
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ08 = os.path.join(CATIA_DIR, "ejercicios", "08_c_clamp_base")
BANCO14 = os.path.join(os.path.dirname(os.path.dirname(CATIA_DIR)), "evals", "banco3d", "ejercicios",
                       "14_ttt_c_clamp_base")
sys.path.insert(0, CATIA_DIR)
VOL_BIEN = 35605.547                    # medir_b123d.py bien sobre el bien.py del 14 (CATA, 24/10/2026)


def cargar_ej08():
    spec = importlib.util.spec_from_file_location("ej08_catia", os.path.join(EJ08, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def cargar_banco14():
    sys.path.insert(0, BANCO14)
    import _c_clamp_base as cc
    return cc


try:
    import build123d  # noqa: F401
    HAY_B123D = True
except Exception:  # noqa: BLE001
    HAY_B123D = False


class Cuenta(unittest.TestCase):
    def test_cotas_iguales_a_las_del_banco(self):
        ej, cc = cargar_ej08(), cargar_banco14()
        for n in ("ANCHO", "ESP", "BRAZO_IZQ", "BRAZO_DER", "BASE", "EJE_Z", "R_EXT", "R_INT", "D_TOPE", "L_TOPE_IZQ",
                  "D_AGUJ", "D_AVELL"):
            self.assertEqual(getattr(ej, n), getattr(cc, n), n)
        self.assertAlmostEqual(ej.DENSIDAD_PLANO * 1e-6, cc.DENSIDAD, places=12)
        # la parte se llama como el .step que escribe bien.py (si no, el juez compara contra nada)
        with open(os.path.join(BANCO14, "bien.py"), encoding="utf-8") as f:
            self.assertIn(f"armar('{ej.PARTE}')", f.read())

    def test_volumen_y_masa(self):
        ej = cargar_ej08()
        g = ej.geometria()
        cerrada = (ej.ANCHO * ej.EJE_Z - (ej.ANCHO - ej.BRAZO_IZQ - ej.BRAZO_DER) * (ej.EJE_Z - ej.BASE)
                   - 2 * (1 - math.pi / 4) * ej.R_EXT ** 2 + 2 * (1 - math.pi / 4) * ej.R_INT ** 2)
        self.assertAlmostEqual(g["area_perfil"], cerrada, places=9)
        self.assertLess(abs(g["volumen"] - VOL_BIEN), 0.01)
        self.assertLess(abs(g["volumen"] * ej.DENSIDAD_PLANO * 1e-6 - ej.MASA_GUIA_G), ej.TOL_MASA_G)
        # lo que saca el agujero es lo que el mutante mal_1 del 14 pesa de mas (tarea.yaml: +1068,6 mm3)
        self.assertLess(abs(-dict(g["ops"])["agujero"] - 1068.6), 0.2)

    def test_un_arco_al_reves_cambia_el_area(self):
        """Gemelo: si el sentido de un R7 se eligiera mal (el arco largo), el area cambiaria mucho."""
        ej = cargar_ej08()
        tramos = ej.perfil()
        i = next(k for k, t in enumerate(tramos) if t[0] == "A" and t[2] == ej.R_INT)
        _, c, r, a, b, m = tramos[i]
        tramos[i] = ("A", c, r, a, b, (2 * c[0] - m[0], 2 * c[1] - m[1]))     # el medio del otro lado
        self.assertGreater(abs(abs(ej.area_green(tramos)) - ej.geometria()["area_perfil"]), 100.0)


@unittest.skipUnless(HAY_B123D, "sin build123d (correr con .venv-cad)")
class ContraBuild123d(unittest.TestCase):
    def test_modelo_del_banco(self):
        ej, cc = cargar_ej08(), cargar_banco14()
        g = ej.geometria()
        self.assertLess(abs(cc.modelo().volume - g["volumen"]), 0.01)
        sin_ag = cc.modelo(frozenset({"agujero"})).volume
        self.assertLess(abs((sin_ag - cc.modelo().volume) + dict(g["ops"])["agujero"]), 0.01)


# ---------------------------------------------------------------- CATIA falsa
class Obj:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class Fabrica2D:
    def __init__(self):
        self.puntos, self.lineas, self.arcos, self.circulos = [], [], [], []

    def CreatePoint(self, x, y):
        p = Obj(x=x, y=y)
        self.puntos.append(p)
        return p

    def CreateLine(self, x1, y1, x2, y2):
        ln = Obj(a=(x1, y1), b=(x2, y2), StartPoint=None, EndPoint=None)
        self.lineas.append(ln)
        return ln

    def CreateCircle(self, cx, cy, r, ini, fin):
        ar = Obj(c=(cx, cy), r=r, ini=ini, fin=fin, StartPoint=None, EndPoint=None, CenterPoint=None)
        self.arcos.append(ar)
        return ar

    def CreateClosedCircle(self, h, v, r):
        self.circulos.append((h, v, r))
        return Obj()


class Croquis:
    def __init__(self, doc, plano):
        self.doc, self.plano, self.f = doc, plano, Fabrica2D()

    def OpenEdition(self):
        return self.f

    def CloseEdition(self):
        self.doc.croquis.append((self.plano, self.f))


class Rasgo:
    def __init__(self, doc, sk, largo):
        self.doc, self.sk = doc, sk
        self.IsSymmetric = False
        self.DirectionOrientation = 0
        self.FirstLimit = Obj(Dimension=Obj(Value=largo))
        self.dv = doc.esperado.pop(0)


class Agujero:
    def __init__(self, doc, x, y, z, cara, prof):
        self.doc, self.punto, self.cara = doc, (x, y, z), cara
        self.Type = self.CounterSunkMode = self.BottomType = None
        self.Diameter, self.HeadDepth, self.HeadAngle = Obj(Value=0.0), Obj(Value=0.0), Obj(Value=0.0)
        self.BottomLimit = Obj(LimitMode=None)
        self.dv = doc.esperado.pop(0)
        self.invertido = False

    def Reverse(self):
        self.invertido = not self.invertido


class DocFalso:
    def __init__(self, ej, densidad_catalogo=2710.0):
        self.esperado = [v for _, v in ej.geometria()["ops"]]
        self.rasgos, self.croquis, self.cerrado, self.material, self.ocultos = [], [], False, None, []
        self.densidad_catalogo = densidad_catalogo
        doc = self
        self.Product = Obj(PartNumber=None)
        self.Application = Obj()
        self.Selection = Obj(Clear=lambda: None, Add=lambda o: doc.ocultos.append(o),
                             VisProperties=Obj(SetShow=lambda k: None), Delete=lambda: None)

        class Cuerpo:
            Sketches = Obj(Add=lambda plano: Croquis(doc, plano))

            @staticmethod
            def InsertHybridShape(p):
                pass

        class Fabrica:
            @staticmethod
            def AddNewPad(sk, largo):
                r = Rasgo(doc, sk, largo)
                doc.rasgos.append(r)
                return r
            AddNewPocket = AddNewPad

            @staticmethod
            def AddNewHoleFromPoint(x, y, z, cara, prof):
                h = Agujero(doc, x, y, z, cara, prof)
                doc.rasgos.append(h)
                return h

        self.body, self.sf = Cuerpo(), Fabrica()
        self.densidad = Obj(Name="c_clamp_base\\Aluminium\\Aluminium.1\\Density", Value=densidad_catalogo)

        def gi(nombre_):
            def aplicar(part, mat, modo):
                doc.material = mat.Name
            return Obj(ApplyMaterialOnPart=aplicar)

        class PartFalsa(Obj):
            @property
            def Parameters(self):
                lista = [Obj(Name="c_clamp_base\\PartBody\\Pad.1\\FirstLimit\\Length", Value=8.0)]
                if doc.material:
                    lista.append(doc.densidad)
                return Obj(Count=len(lista), Item=lambda i: lista[i - 1])
        self.part = PartFalsa(OriginElements=Obj(PlaneXY="XY", PlaneYZ="YZ", PlaneZX="ZX"), MainBody=self.body,
                              Update=lambda: None, CreateReferenceFromObject=lambda o: o, GetItem=gi,
                              HybridShapeFactory=Obj(AddNewPlaneOffset=lambda ref, x, inv: Obj(ref=ref,
                                                                                               Offset=Obj(Value=x))))

    def volumen(self):
        return sum(r.dv for r in self.rasgos if not getattr(r, "invertido", False))

    def GetWorkbench(self, nombre):
        doc = self

        class Inercias:
            @staticmethod
            def Add(prod):
                dens = doc.densidad.Value if doc.material else 1000.0
                return Obj(Density=dens, Mass=doc.volumen() * 1e-9 * dens)
        return Obj(Inertias=Inercias(), GetMeasurable=lambda ref: Obj(plano=ref))

    def Activate(self):
        pass

    def Close(self):
        self.cerrado = True


class Cuenta08(unittest.TestCase):
    def correr_falso(self, aplicar_material=True, densidad_catalogo=2710.0):
        ej = cargar_ej08()
        jc = ej.jc
        tmp = tempfile.mkdtemp(prefix="ej08-")
        os.environ["CATIA_TRABAJO"] = tmp
        import catia_base
        cat = os.path.join(tmp, "Catalog.CATMaterial")
        open(cat, "w").close()
        os.environ["CATIA_CATALOGO_MATERIALES"] = cat
        doc = DocFalso(ej, densidad_catalogo)

        def nueva_pieza(c, nombre):
            doc.Product.PartNumber = nombre
            return doc, doc.part, doc.body, doc.sf

        def medir(d, part, obj):
            return {"volume": round(d.volumen(), 3), "cdg_mm": [0.0, 0.0, 0.0]}

        def guardar(d, reg, nombre):
            ruta = os.path.join(reg.carpeta, nombre + ".stp")
            open(ruta, "w").close()
            return {"step": ruta}

        def topologia(d, feat, tipo):
            return [{"ref": "cara x -9", "cdg": [-9.0, 0.0, 34.0]}, {"ref": "cara x 14", "cdg": [14.0, 0.0, 37.4]}]

        def evaluar(c, macro, m):
            return f"{m.plano.Offset.Value};0;0;0;1;0;0;0;1".replace(".", ",")      # VBScript devuelve coma
        alu = Obj(Name="Aluminium")
        familia = Obj(Name="Metal", Materials=Obj(Count=1, Item=lambda j: alu))
        mdoc = Obj(Families=Obj(Count=1, Item=lambda i: familia))
        c = Obj(Documents=Obj(Read=lambda ruta: mdoc if aplicar_material else (_ for _ in ()).throw(OSError("no"))))
        cb = types.SimpleNamespace(nueva_pieza=nueva_pieza, medir=medir, guardar_pieza=guardar, ref=lambda p, o: o,
                                   topologia=topologia, evaluar=evaluar, Registro=catia_base.Registro,
                                   CATIA_INSTALADA=tmp)
        self.addCleanup(setattr, jc, "captura_bmp", jc.captura_bmp)       # auditor de la tanda: se devuelve
        jc.captura_bmp = lambda c_, carpeta, nombre: os.path.join(carpeta, nombre + "_iso.bmp")
        reg = catia_base.Registro(ej.EJ)
        salida = {"volumen_build123d": {ej.PARTE: VOL_BIEN}, "cdg_build123d_mm": {ej.PARTE: [0.0, 0.0, 0.0]},
                  "volumen_catia": {}, "cdg_catia_mm": {}, "archivos": [], "_carpeta": tmp, "_steps": {}}
        ej.construir(cb, c, reg, salida)
        return ej, jc, reg, salida, doc, tmp

    def test_croquis_cerrados_y_operaciones(self):
        ej, jc, reg, salida, doc, _ = self.correr_falso()
        fallas = [p for p in reg.pasos if not p["ok"]]
        self.assertEqual(fallas, [], fallas)
        self.assertEqual(doc.esperado, [], "quedaron operaciones sin hacer")
        self.assertTrue(jc.comparar(salida))
        self.assertTrue(doc.cerrado)
        self.assertEqual(reg.pasos[3]["dato"]["metodo"], "hole")
        pads = [r for r in doc.rasgos if isinstance(r, Rasgo)]
        self.assertEqual(len(pads), 3)
        self.assertTrue(all(r.IsSymmetric for r in pads))
        self.assertEqual([r.FirstLimit.Dimension.Value for r in pads], [8.0, 11.5, 9.0])
        # la U en ZX: 8 rectas y 4 arcos, cada punto compartido por dos tramos
        plano_u, f = doc.croquis[0]
        self.assertEqual(plano_u, "ZX")
        self.assertEqual((len(f.lineas), len(f.arcos)), (8, 4))
        usos = {}
        for ln in f.lineas:
            self.assertEqual((ln.StartPoint.x, ln.StartPoint.y), ln.a)
            self.assertEqual((ln.EndPoint.x, ln.EndPoint.y), ln.b)
            for p in (ln.StartPoint, ln.EndPoint):
                usos[id(p)] = usos.get(id(p), 0) + 1
        for ar in f.arcos:
            self.assertTrue(0 < ar.fin - ar.ini < math.pi, "arco de 180 o mas: sentido dudoso")
            for p, a in ((ar.StartPoint, ar.ini), (ar.EndPoint, ar.fin)):
                self.assertLess(math.dist((p.x, p.y), (ar.c[0] + ar.r * math.cos(a), ar.c[1] + ar.r * math.sin(a))), 1e-9)
                usos[id(p)] = usos.get(id(p), 0) + 1
        self.assertEqual(set(usos.values()), {2}, "un punto que no lo comparten dos tramos: no cierra")
        # en ZX la H es Z y la V es X: el R18 de la esquina (95, 0) tiene el centro en (h 18, v 77)
        self.assertIn((18.0, 77.0), [ar.c for ar in f.arcos])
        # los topes: circulos R8 en (h 0, v 34) sobre planos en x 2,5 y 86
        for (plano, fc), x in zip(doc.croquis[1:3], (2.5, 86.0)):
            self.assertEqual((plano.ref, plano.Offset.Value), ("YZ", x))        # desplazado desde YZ, no desde otro
            self.assertEqual(fc.circulos, [(0.0, 34.0, 8.0)])
        self.assertEqual({k: v["origen"][0] for k, v in salida["planos"].items()}, {"tope_izq": 2.5, "tope_der": 86.0})
        # el Hole: en la cara de x -9, punto (-9, 0, 34), los modos del ej33
        h = doc.rasgos[-1]
        self.assertIsInstance(h, Agujero)
        self.assertEqual((h.cara, h.punto), ("cara x -9", (-9.0, 0.0, 34.0)))
        self.assertEqual((h.Type, h.CounterSunkMode, h.BottomType, h.BottomLimit.LimitMode), (3, 0, 0, 2))
        self.assertEqual((h.Diameter.Value, h.HeadAngle.Value), (5.5, 90.0))
        self.assertAlmostEqual(h.HeadDepth.Value, 2.85, places=9)
        # material: aluminio del catalogo (2 710) pasado a 2 700 y la masa de CATIA
        self.assertEqual(salida["material_catia"]["densidad_catalogo_kg_m3"], 2710.0)
        self.assertEqual(salida["material_catia"]["densidad_kg_m3"], 2700.0)
        self.assertAlmostEqual(salida["masa_catia_g"], VOL_BIEN * 2.7e-3, delta=0.01)
        # los dos planos se ocultan antes de exportar
        self.assertEqual(sum(1 for o in doc.ocultos if getattr(o, "Offset", None) is not None), 2)

    def test_masa_verde_y_rojo_con_los_mutantes(self):
        ej, jc, reg, salida, doc, tmp = self.correr_falso()
        salida["ok"] = True
        salida["volumen_catia"] = {ej.PARTE: VOL_BIEN}
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_masa(tmp)
        self.assertTrue(s["ok"] and s["ok_masa"] and s["ok_cruce_build123d"])
        for de_mas_g, de_mas_mm3 in ((2.885, 1068.6), (6.008, 2225.0)):        # mal_1 y mal_2 del 14 (tarea.yaml)
            salida["masa_catia_g"] = round(VOL_BIEN * 2.7e-3 + de_mas_g, 3)
            salida["volumen_catia"] = {ej.PARTE: VOL_BIEN + de_mas_mm3}
            jc.escribir(tmp, salida)
            s = ej.cerrar_con_masa(tmp)
            self.assertFalse(s["ok"])
            self.assertFalse(s["ok_masa"])
        # la masa justa pero sin coherencia con el volumen (otra densidad): tambien rojo
        salida["masa_catia_g"] = ej.MASA_GUIA_G
        salida["volumen_catia"] = {ej.PARTE: VOL_BIEN * 0.98}
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_masa(tmp)
        self.assertFalse(s["ok"])
        self.assertFalse(s["masa_sobre_volumen"]["coherente"])

    def test_sin_material_no_hay_verde(self):
        ej, jc, reg, salida, doc, tmp = self.correr_falso(aplicar_material=False)
        self.assertNotIn("masa_catia_g", salida)
        self.assertIsNone(doc.material)
        salida["ok"] = True
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_masa(tmp)
        self.assertFalse(s["ok"])
        self.assertIsNone(s["ok_masa"])
        self.assertIn("sin masa de CATIA", s["error"])           # el obrero publica «error»


if __name__ == "__main__":
    unittest.main()
