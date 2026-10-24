# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 07 del obrero (Tool Block del examen CATIA V5 Associate, 24/10/2026).

1. perfil_2d.py (la geometria en Python puro que dibuja los croquis) contra _tool_block.py del ejercicio 13 del banco
   (build123d): puntos, areas del perfil, del bloque, del hueco y del hueco sin el R42, vertices del hueco. Si .venv-cad
   no tiene build123d, se saltea.
2. La cuenta de perfil_2d por pregunta contra el volumen que midio medir_b123d.py sobre bien.py del 13 (24/10/2026 04:42,
   PC principal): q3 118 929,059; q4 130 673,503; q5 79 516,884; q6 54 757,26 mm3.
3. construir() del catia.py con una CATIA FALSA: cada croquis cierra (cada punto lo comparten dos tramos), cada arco
   empieza y termina en sus puntos y barre lo que dice perfil_2d, las operaciones encadenan, las partes se llaman q3..q6,
   el material y la masa llegan a salida.json.
4. cerrar_con_masa(): VERDE con las masas a menos de 1 g; ROJO con una a 2 g (la q3 sin el agujero de 14 pesa 52 g de
   mas); sin material, el ok es el del cruce de volumen y no aparece ninguna masa."""
import importlib.util
import json
import math
import os
import sys
import tempfile
import types
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ07 = os.path.join(CATIA_DIR, "ejercicios", "07_tool_block_examen")
BANCO13 = os.path.join(os.path.dirname(os.path.dirname(CATIA_DIR)), "evals", "banco3d", "ejercicios",
                       "13_examen_catia_associate")
sys.path.insert(0, EJ07)
sys.path.insert(0, CATIA_DIR)
import perfil_2d as p2  # noqa: E402

VOL_BIEN = {"q3": 118929.059, "q4": 130673.503, "q5": 79516.884, "q6": 54757.26}


def cargar_ej07():
    spec = importlib.util.spec_from_file_location("ej07_catia", os.path.join(EJ07, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


try:
    import build123d  # noqa: F401
    HAY_B123D = True
except Exception:  # noqa: BLE001
    HAY_B123D = False


@unittest.skipUnless(HAY_B123D, "sin build123d (correr con .venv-cad)")
class ContraBuild123d(unittest.TestCase):
    def test_perfil_bloque_hueco(self):
        sys.path.insert(0, BANCO13)
        import _tool_block as tb
        from build123d import Align, Circle, Kind, Location, Rectangle, offset
        for q, d in tb.PREGUNTAS.items():
            A, B, C = d["A"], d["B"], d["C"]
            k1, k2 = tb.puntos(A, B), p2.puntos(A, B)
            for n in k1:
                self.assertLess(math.dist((k1[n].X, k1[n].Y), k2[n]), 1e-9, f"{q} {n}")
            g = p2.geometria(d["paso"], A, B, C)
            cara = tb.perfil(A, B)
            self.assertAlmostEqual(cara.area, g["area_perfil"], places=6)
            if d["paso"] < 5:
                continue
            caja = Rectangle(tb.ANCHO_DER + 10, B + 10, align=(Align.MIN, Align.MIN)).moved(
                Location((A - tb.ANCHO_DER, tb.ORE_Y_BAJO)))
            blq = (cara & caja).faces()[0]
            c41 = tb.centro_r41(A, B)
            self.assertAlmostEqual(blq.area, g["area_bloque"], places=6)
            d41 = Circle(tb.R41).moved(Location((c41.X, c41.Y)))
            self.assertAlmostEqual((cara & d41).area, g["area_perfil_y_R41"], places=6)
            self.assertAlmostEqual((blq & d41).area, g["area_bloque_y_R41"], places=6)
            if d["paso"] < 6:
                continue
            hueco = offset(blq, -tb.PARED, kind=Kind.INTERSECTION).faces()[0]
            self.assertAlmostEqual(hueco.area, g["area_hueco"], places=6)
            sr = hueco - Circle(tb.R41 + tb.PARED).moved(Location((c41.X, c41.Y)))
            self.assertAlmostEqual(sr.area, g["area_hueco_sin_ranura"], places=6)
            vb = sorted((v.X, v.Y) for v in hueco.vertices())
            v2 = sorted(t[1] if t[0] == "L" else t[3] for t in g["hueco"])
            self.assertEqual(len(vb), len(v2))
            for a, b in zip(vb, v2):
                self.assertLess(math.dist(a, b), 1e-6)


class Cuenta(unittest.TestCase):
    def test_volumen_por_pregunta_contra_bien_py(self):
        ej = cargar_ej07()
        for q, (paso, A, B, C) in ej.PREGUNTAS.items():
            g = p2.geometria(paso, A, B, C)
            self.assertLess(abs(g["volumen"] - VOL_BIEN[q]), 0.01, q)
            self.assertLess(abs(g["volumen"] * 7.86e-3 - ej.MASA_EXAMEN_G[q]), 0.01, q)    # 7 860 kg/m3: acero de CATIA

    def test_el_corte_mal_hecho_da_otro_volumen(self):
        """Gemelo: un vaciado de una sola zona (el hueco entero de z 12 a C, sin la pared alrededor de la ranura) no da
        el volumen de la q6 (mal_3 del banco: 14,19 g de menos)."""
        g = p2.geometria(6, 86.0, 58.0, 44.0)
        una_zona = g["volumen"] - dict(g["ops"])["vaciado_sin_ranura"] - dict(g["ops"])["vaciado_delante"]
        una_zona -= (g["area_hueco"] - math.pi * 5.5 ** 2) * (44.0 - 12.0)
        self.assertGreater(abs(g["volumen"] - una_zona), 100.0)


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
    def __init__(self, doc):
        self.doc, self.f = doc, Fabrica2D()

    def OpenEdition(self):
        return self.f

    def CloseEdition(self):
        self.doc.croquis.append(self.f)


class Rasgo:
    def __init__(self, doc, largo):
        self.doc = doc
        self.IsSymmetric = False
        self.DirectionOrientation = 0
        self.FirstLimit = Obj(Dimension=Obj(Value=largo))
        self.dv = doc.esperado.pop(0)          # lo que tiene que sumar o sacar, en el orden de perfil_2d


class DocFalso:
    def __init__(self, ej, nombre):
        q = nombre.rsplit("_", 1)[-1]
        paso, A, B, C = ej.PREGUNTAS[q]
        self.g = p2.geometria(paso, A, B, C)
        self.esperado = [v for _, v in self.g["ops"]]
        self.rasgos, self.croquis, self.cerrado, self.material = [], [], False, False
        doc = self
        self.Product = Obj(PartNumber=nombre, Analyze=Obj())
        self.Selection = Obj(Clear=lambda: None, Add=lambda o: None, VisProperties=Obj(SetShow=lambda k: None))

        class Cuerpo:
            Sketches = Obj(Add=lambda ref: Croquis(doc))

            @staticmethod
            def InsertHybridShape(p):
                pass

        class Fabrica:
            @staticmethod
            def AddNewPad(sk, largo):
                r = Rasgo(doc, largo)
                doc.rasgos.append(r)
                return r
            AddNewPocket = AddNewPad

        self.body, self.sf = Cuerpo(), Fabrica()

        def gi(nombre_):
            def aplicar(part, mat, modo):
                doc.material = True
            return Obj(ApplyMaterialOnPart=aplicar)
        self.part = Obj(OriginElements=Obj(PlaneXY="XY"), MainBody=self.body, Update=lambda: None,
                        CreateReferenceFromObject=lambda o: o, GetItem=gi,
                        HybridShapeFactory=Obj(AddNewPlaneOffset=lambda ref, z, inv: Obj(z=z)))

    def volumen(self):
        return sum(r.dv for r in self.rasgos)

    def GetWorkbench(self, nombre):
        doc = self

        class Inercias:
            @staticmethod
            def Add(prod):
                dens = 7860.0 if doc.material else 1000.0
                return Obj(Density=dens, Mass=doc.volumen() * 1e-9 * dens)
        return Obj(Inertias=Inercias())

    def Activate(self):
        pass

    def Close(self):
        self.cerrado = True


class Cuenta07(unittest.TestCase):
    def correr_falso(self, aplicar_material=True):
        ej = cargar_ej07()
        jc = ej.jc
        tmp = tempfile.mkdtemp(prefix="ej07-")
        os.environ["CATIA_TRABAJO"] = tmp
        import catia_base
        cat = os.path.join(tmp, "Catalog.CATMaterial")
        open(cat, "w").close()
        os.environ["CATIA_CATALOGO_MATERIALES"] = cat
        docs = []

        def nueva_pieza(c, nombre):
            d = DocFalso(ej, nombre)
            docs.append(d)
            return d, d.part, d.body, d.sf

        def medir(doc, part, obj):
            return {"volume": round(doc.volumen(), 3), "cdg_mm": [0.0, 0.0, 0.0]}

        def guardar(doc, reg, nombre):
            ruta = os.path.join(reg.carpeta, nombre + ".stp")
            open(ruta, "w").close()
            return {"step": ruta}
        steel = Obj(Name="Steel")
        familia = Obj(Name="Metal", Materials=Obj(Count=1, Item=lambda j: steel))
        mdoc = Obj(Families=Obj(Count=1, Item=lambda i: familia))
        c = Obj(Documents=Obj(Read=lambda ruta: mdoc if aplicar_material else (_ for _ in ()).throw(OSError("no"))))
        cb = types.SimpleNamespace(nueva_pieza=nueva_pieza, medir=medir, guardar_pieza=guardar, ref=lambda p, o: o,
                                   Registro=catia_base.Registro, CATIA_INSTALADA=tmp)
        jc.captura_bmp = lambda c_, carpeta, nombre: os.path.join(carpeta, nombre + "_iso.bmp")
        reg = catia_base.Registro(ej.EJ)
        salida = {"volumen_build123d": {}, "cdg_build123d_mm": {}, "volumen_catia": {}, "cdg_catia_mm": {},
                  "archivos": [], "_carpeta": tmp, "_steps": {}}
        for q in ej.PREGUNTAS:                     # como lo deja medir_b123d con el bien.py del 13
            salida["volumen_build123d"][f"tool_block_q3_a_q6__{q}"] = VOL_BIEN[q]
            salida["cdg_build123d_mm"][f"tool_block_q3_a_q6__{q}"] = [0.0, 0.0, 0.0]
        salida["volumen_build123d"]["tool_block_q3_a_q6"] = sum(VOL_BIEN.values())
        salida["cdg_build123d_mm"]["tool_block_q3_a_q6"] = [0.0, 0.0, 0.0]
        ej.construir(cb, c, reg, salida)
        return ej, jc, reg, salida, docs, tmp

    def test_croquis_cerrados_y_operaciones(self):
        ej, jc, reg, salida, docs, _ = self.correr_falso()
        fallas = [p for p in reg.pasos if not p["ok"]]
        self.assertEqual(fallas, [], fallas)
        self.assertEqual(sorted(salida["volumen_build123d"]), ["q3", "q4", "q5", "q6"])
        self.assertIn("tool_block_q3_a_q6", salida["build123d_aparte"])
        self.assertTrue(jc.comparar(salida))
        self.assertEqual([len(d.rasgos) for d in docs], [1, 1, 4, 6])
        for d in docs:
            self.assertEqual(d.esperado, [], "quedaron operaciones sin hacer")
            self.assertTrue(d.cerrado and d.material)
            self.assertTrue(all(r.IsSymmetric for r in d.rasgos))
            for f in d.croquis:
                usos = {}
                for ln in f.lineas:
                    self.assertEqual((ln.StartPoint.x, ln.StartPoint.y), ln.a)
                    self.assertEqual((ln.EndPoint.x, ln.EndPoint.y), ln.b)
                    for p in (ln.StartPoint, ln.EndPoint):
                        usos[id(p)] = usos.get(id(p), 0) + 1
                for ar in f.arcos:
                    self.assertTrue(0 < ar.fin - ar.ini < math.pi, "arco de 180 o mas: sentido dudoso")
                    for p, a in ((ar.StartPoint, ar.ini), (ar.EndPoint, ar.fin)):
                        self.assertLess(math.dist((p.x, p.y), (ar.c[0] + ar.r * math.cos(a), ar.c[1] + ar.r * math.sin(a))),
                                        1e-9)
                        usos[id(p)] = usos.get(id(p), 0) + 1
                self.assertTrue(usos or f.circulos)
                self.assertEqual(set(usos.values()) or {2}, {2}, "un punto que no lo comparten dos tramos: no cierra")
        # el perfil de la q3 lleva 14 tramos (11 rectas, 3 arcos) y el agujero de 14 en (14, 33)
        f0 = docs[0].croquis[0]
        self.assertEqual((len(f0.lineas), len(f0.arcos), f0.circulos), (11, 3, [(14.0, 33.0, 7.0)]))
        # la q4 va corrida 150 en x
        self.assertEqual(docs[1].croquis[0].circulos, [(164.0, 33.0, 7.0)])
        for q in ej.PREGUNTAS:
            self.assertAlmostEqual(salida["masa_catia_g"][q], VOL_BIEN[q] * 7.86e-3, delta=0.01)

    def test_masa_verde_y_rojo(self):
        ej, jc, reg, salida, docs, tmp = self.correr_falso()
        salida["ok"] = True
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_masa(tmp)
        self.assertTrue(s["ok"] and s["ok_masa"] and s["ok_cruce_build123d"])
        self.assertEqual(sorted(s["dif_masa_g"]), ["q3", "q4", "q5", "q6"])
        salida["masa_catia_g"]["q3"] = round(ej.MASA_EXAMEN_G["q3"] + 2.0, 3)        # una a 2 g: rojo
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_masa(tmp)
        self.assertFalse(s["ok"])
        self.assertIn("q3", s["error"])

    def test_sin_material_no_hay_masa_y_decide_el_volumen(self):
        ej, jc, reg, salida, docs, tmp = self.correr_falso(aplicar_material=False)
        self.assertEqual(salida["masa_catia_g"], {})
        self.assertFalse(any(d.material for d in docs))
        salida["ok"] = True
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_masa(tmp)
        self.assertTrue(s["ok"])
        self.assertIsNone(s["ok_masa"])
        self.assertEqual(sorted(s["masa_no_leida"]), ["q3", "q4", "q5", "q6"])
        self.assertTrue(all(v is None for v in s["dif_masa_g"].values()))


if __name__ == "__main__":
    unittest.main()
