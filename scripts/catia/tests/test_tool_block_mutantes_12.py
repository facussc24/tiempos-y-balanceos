# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 12 del banco de CATIA (los tres mutantes del Tool Block del examen, CATA 24/10/2026).

1. La cuenta de cada mutante (Python puro, perfil_2d del 07) contra lo que midio build123d sobre la pregunta que cambia
   de cada mal_*.py del 13 (CATA, 24/10/2026): 125 548,395 / 101 595,13 / 52 951,827 mm3, y la masa con el Steel de
   CATIA contra tarea.yaml (986,81 / 798,54 / 416,20 g). Con build123d: _tool_block.pieza(..., sin=...) da lo mismo.
2. Ninguna masa de mutante cae a 1 g de la lamina 12: el control de la masa PUEDE dar rojo en los tres.
3. construir() con una CATIA FALSA: mal_1 sin el circulo de 14, mal_2 sin la ranura (3 operaciones), mal_3 con UN
   vaciado del hueco entero (5 operaciones), cada parte corrida a su x.
4. cerrar_con_juez(): VERDE con las masas de los mutantes; NO verde si CATIA hubiera hecho la pieza BIEN (la masa da la
   lamina: el juez no puede aprobar la buena), si falta una masa o si una masa no es la del mutante."""
import importlib.util
import json
import math
import os
import sys
import tempfile
import types
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = os.path.dirname(os.path.abspath(__file__))
EJ12 = os.path.join(CATIA_DIR, "ejercicios", "12_tool_block_mutantes")
BANCO13 = os.path.join(os.path.dirname(os.path.dirname(CATIA_DIR)), "evals", "banco3d", "ejercicios",
                       "13_examen_catia_associate")
sys.path.insert(0, CATIA_DIR)
sys.path.insert(0, TESTS)
from test_tool_block_07 import Croquis, Obj  # noqa: E402  (la CATIA falsa de croquis del 07)

VOL_MUTANTE = {"mal_1_q3": 125548.395, "mal_2_q5": 101595.13, "mal_3_q6": 52951.827}   # build123d, CATA 24/10/2026


def cargar_ej12():
    spec = importlib.util.spec_from_file_location("ej12_catia", os.path.join(EJ12, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


try:
    import build123d  # noqa: F401
    HAY_B123D = True
except Exception:  # noqa: BLE001
    HAY_B123D = False


class Cuenta(unittest.TestCase):
    def test_volumen_y_masa_de_cada_mutante(self):
        ej = cargar_ej12()
        for parte in ej.MUTANTES:
            v = sum(x for _, x in ej.cuenta(parte))
            self.assertLess(abs(v - VOL_MUTANTE[parte]), 0.01, parte)
            self.assertLess(abs(v * 7.86e-3 - ej.MASA_MUTANTE_G[parte]), 0.01, parte)

    def test_el_control_puede_dar_rojo_en_los_tres(self):
        ej = cargar_ej12()
        for parte, (q, *_r) in ej.MUTANTES.items():
            self.assertGreater(abs(ej.MASA_MUTANTE_G[parte] - ej.MASA_LAMINA_G[q]), 10 * ej.TOL_MASA_G, parte)

    def test_mal_1_a_mano(self):
        """tarea.yaml del 13: el agujero de 14 que falta pesa pi x 7^2 x 43 x 0,00786 = 52,03 g."""
        ej = cargar_ej12()
        g = ej.p2.geometria(3, 81.0, 57.0, 43.0)
        base_bien = dict(g["ops"])["base"]
        self.assertAlmostEqual(ej.cuenta("mal_1_q3")[0][1] - base_bien, math.pi * 49 * 43, places=6)
        self.assertAlmostEqual(math.pi * 49 * 43 * 7.86e-3, 52.03, places=2)

    def test_los_scripts_del_banco_existen(self):
        ej = cargar_ej12()
        for parte, m in ej.MUTANTES.items():
            self.assertTrue(os.path.isfile(os.path.join(BANCO13, m[7])), parte)


@unittest.skipUnless(HAY_B123D, "sin build123d (correr con .venv-cad)")
class ContraBuild123d(unittest.TestCase):
    def test_pieza_del_banco_con_el_paso_salteado(self):
        ej = cargar_ej12()
        sys.path.insert(0, BANCO13)
        import _tool_block as tb
        for parte, (q, paso, A, B, C, _i, sin, _s) in ej.MUTANTES.items():
            v = tb.pieza(paso, A, B, C, frozenset({sin})).volume
            self.assertLess(abs(v - sum(x for _, x in ej.cuenta(parte))), 0.01, parte)


# ---------------------------------------------------------------- CATIA falsa
class Rasgo:
    def __init__(self, doc, sk, largo):
        self.doc, self.sk = doc, sk
        self.IsSymmetric = False
        self.DirectionOrientation = 0
        self.FirstLimit = Obj(Dimension=Obj(Value=largo))
        self.dv = doc.esperado.pop(0)


class DocFalso:
    def __init__(self, ej, nombre):
        self.parte = nombre.replace("tool_block_", "")
        self.esperado = [v for _, v in ej.cuenta(self.parte)]
        self.rasgos, self.croquis, self.cerrado, self.material = [], [], False, False
        doc = self
        self.Product = Obj(PartNumber=nombre)
        self.Selection = Obj(Clear=lambda: None, Add=lambda o: None, VisProperties=Obj(SetShow=lambda k: None))

        class Cuerpo:
            Sketches = Obj(Add=lambda ref: Croquis(doc))

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


class Cuenta12(unittest.TestCase):
    def correr_falso(self):
        ej = cargar_ej12()
        jc = ej.jc
        tmp = tempfile.mkdtemp(prefix="ej12-")
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
        c = Obj(Documents=Obj(Read=lambda ruta: mdoc))
        cb = types.SimpleNamespace(nueva_pieza=nueva_pieza, medir=medir, guardar_pieza=guardar, ref=lambda p, o: o,
                                   Registro=catia_base.Registro, CATIA_INSTALADA=tmp)
        jc.captura_bmp = lambda c_, carpeta, nombre: os.path.join(carpeta, nombre + "_iso.bmp")
        reg = catia_base.Registro(ej.EJ)
        salida = {"volumen_build123d": {"q3": 1.0}, "cdg_build123d_mm": {"q3": [0.0, 0.0, 0.0]}, "volumen_catia": {},
                  "cdg_catia_mm": {}, "archivos": [], "_carpeta": tmp, "_steps": {}}
        original = jc.medir_b123d
        jc.medir_b123d = lambda args, timeout=900: {"partes": {                    # sin build123d: lo que midio
            f"x__{ej.MUTANTES[p][0]}": {"volumen": VOL_MUTANTE[p], "cdg_mm": [0.0, 0.0, 0.0]}
            for p in ej.MUTANTES if ej.MUTANTES[p][7] in args[1]}}
        try:
            ej.construir(cb, c, reg, salida)
        finally:
            jc.medir_b123d = original                  # juez_comun es uno solo para todas las pruebas
        return ej, jc, reg, salida, docs, tmp

    def test_operaciones_de_cada_mutante(self):
        ej, jc, reg, salida, docs, _ = self.correr_falso()
        self.assertEqual([p for p in reg.pasos if not p["ok"]], [])
        self.assertEqual(sorted(salida["volumen_build123d"]), sorted(ej.MUTANTES))
        self.assertEqual(salida["build123d_bien_aparte"]["volumen"], {"q3": 1.0})
        self.assertTrue(jc.comparar(salida))
        self.assertNotIn("operaciones_sin_hacer", salida)
        self.assertEqual([len(d.rasgos) for d in docs], [1, 3, 5])
        for d in docs:
            self.assertEqual(d.esperado, [])
            self.assertTrue(d.cerrado and d.material)
            self.assertTrue(all(r.IsSymmetric for r in d.rasgos))
        # mal_1: la base SIN el circulo de 14; mal_2 y mal_3: con el circulo, corrido a su x
        self.assertEqual(docs[0].croquis[0].circulos, [])
        self.assertEqual(docs[1].croquis[0].circulos, [(14.0 + 300.0, 33.0, 7.0)])
        self.assertEqual(docs[2].croquis[0].circulos, [(14.0 + 450.0, 33.0, 7.0)])
        # mal_2 sin ranura: rebaje y agujero de 11 de la altura entera (pocket de C/2 + 1 por lado)
        self.assertEqual(docs[1].rasgos[2].FirstLimit.Dimension.Value, 44.0 / 2 + 1)
        # mal_3: el ultimo vaciado es UNO, de 32 por lado desde z 44 (z 12 a 44)
        self.assertEqual(docs[2].rasgos[4].FirstLimit.Dimension.Value, 44.0 - 12.0)
        for p in ej.MUTANTES:
            self.assertAlmostEqual(salida["masa_catia_g"][p], ej.MASA_MUTANTE_G[p], delta=0.01)

    def juez(self, salida, tmp, ej, masas):
        salida["volumen_catia"] = dict(VOL_MUTANTE)
        salida["ok"] = ej.jc.comparar(salida)          # como correr_ejercicio: llena diferencia_mm3
        salida["masa_catia_g"] = masas
        ej.jc.escribir(tmp, salida)
        return ej.cerrar_con_juez(tmp)

    def test_mal_3_vacia_el_hueco_entero(self):
        """El ultimo croquis de mal_3 es el contorno del hueco ENTERO (no el hueco sin el R42 de la BIEN)."""
        ej, jc, reg, salida, docs, _ = self.correr_falso()
        g = ej.p2.geometria(6, 86.0, 58.0, 44.0)
        f = docs[2].croquis[-1]
        self.assertEqual(len(f.lineas) + len(f.arcos), len(g["hueco"]))
        self.assertNotEqual(len(g["hueco"]), len(g["hueco_sin_ranura"]))

    def test_juez_rojo_si_un_mutante_no_tiene_cruce(self):
        """Revisor 24/10: comparar() mira solo lo que midio build123d; un mutante sin medir no puede pasar."""
        ej, jc, reg, salida, docs, tmp = self.correr_falso()
        salida["volumen_build123d"].pop("mal_3_q6")
        salida["build123d_mutantes"]["mal_3_q6"] = {"error": "bien.py salio con 1: falla de prueba"}
        s = self.juez(salida, tmp, ej, {p: round(VOL_MUTANTE[p] * 7.86e-3, 3) for p in ej.MUTANTES})
        self.assertTrue(s["ok_cruce_build123d"])                 # comparar da verde igual: por eso el control nuevo
        self.assertFalse(s["ok"])
        self.assertIn("mal_3_q6 sin cruce de build123d", s["error"])

    def test_rojo_justo_en_la_tolerancia(self):
        """A 0,9 g de la lamina el control NO da rojo (dentro de 1 g): el juez no puede aprobar ese mutante."""
        ej, jc, reg, salida, docs, tmp = self.correr_falso()
        masas = {p: round(VOL_MUTANTE[p] * 7.86e-3, 3) for p in ej.MUTANTES}
        masas["mal_1_q3"] = ej.MASA_LAMINA_G["q3"] + 0.9
        s = self.juez(salida, tmp, ej, masas)
        self.assertFalse(s["ok"])
        self.assertFalse(s["juez_por_mutante"]["mal_1_q3"]["rojo_contra_lamina"])

    def test_juez_verde_con_los_mutantes(self):
        ej, jc, reg, salida, docs, tmp = self.correr_falso()
        s = self.juez(salida, tmp, ej, {p: round(VOL_MUTANTE[p] * 7.86e-3, 3) for p in ej.MUTANTES})
        self.assertTrue(s["ok"] and s["juez_da_rojo_en_los_tres"])

    def test_juez_no_aprueba_la_pieza_buena(self):
        """Gemelo: si CATIA hubiera hecho la BIEN, la masa seria la de la lamina: el juez tiene que decir que no."""
        ej, jc, reg, salida, docs, tmp = self.correr_falso()
        masas = {p: round(VOL_MUTANTE[p] * 7.86e-3, 3) for p in ej.MUTANTES}
        masas["mal_2_q5"] = ej.MASA_LAMINA_G["q5"]
        salida_v = dict(VOL_MUTANTE)
        salida_v["mal_2_q5"] = ej.MASA_LAMINA_G["q5"] / 7.86e-3
        salida["ok"], salida["volumen_catia"], salida["masa_catia_g"] = True, salida_v, masas
        jc.escribir(tmp, salida)
        s = ej.cerrar_con_juez(tmp)
        self.assertFalse(s["ok"])
        self.assertFalse(s["juez_da_rojo_en_los_tres"])
        self.assertIn("NO da rojo", s["error"])

    def test_juez_rojo_sin_masa_o_con_otra_masa(self):
        ej, jc, reg, salida, docs, tmp = self.correr_falso()
        masas = {p: round(VOL_MUTANTE[p] * 7.86e-3, 3) for p in ej.MUTANTES}
        sin_una = {k: v for k, v in masas.items() if k != "mal_3_q6"}
        s = self.juez(salida, tmp, ej, sin_una)
        self.assertFalse(s["ok"])
        self.assertIn("mal_3_q6 sin masa", s["error"])
        corrida = dict(masas, mal_1_q3=masas["mal_1_q3"] + 3.0)              # ni la lamina ni el mutante
        salida.pop("error", None)
        s = self.juez(salida, tmp, ej, corrida)
        self.assertFalse(s["ok"])


if __name__ == "__main__":
    unittest.main()
