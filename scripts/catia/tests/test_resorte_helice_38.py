# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 38 del banco de CATIA (resorte por GSD: helice R20, paso 10, alto 50, circulo R2; CATA
24/10/2026).

1. La formula: largo de la helice 630,3048 mm, volumen 7 920,644 mm3 y con el perfil inclinado atan(10 / 40 pi) =
   4,54987 grados, 7 895,684; el control separa (si el perfil quedara normal, el inclinado daria 25 mm3 de mas).
2. pieza_ej45.py es la copia del ej45 con los cambios anotados (no captura ni guarda ni corre suelto; el CAMBIO 4 pone el
   circulo en el plano ZX del origen).
3. construir() con CATIA FALSA: las dos piezas, cada una con su largo de helice; el inclinado usa el plano ZX y el normal
   AddNewPlaneNormal.
4. cerrar_con_formula(): VERDE con lo medido en la R21 de CATA (24/10 12:46); ROJO con un volumen a 0,6 mm3, con el
   inclinado igual al normal, con el largo de la helice corrido, sin STEP y con un paso fallado."""
import importlib.util
import json
import math
import os
import sys
import tempfile
import types
import unittest

os.environ.setdefault("CATIA_TRABAJO", tempfile.mkdtemp(prefix="catia-prueba-"))   # antes de importar catia_base

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = os.path.dirname(os.path.abspath(__file__))
EJ38 = os.path.join(CATIA_DIR, "ejercicios", "38_resorte_helice")
sys.path.insert(0, CATIA_DIR)
sys.path.insert(0, TESTS)
from test_c_clamp_base_08 import Obj  # noqa: E402

MEDIDO = {"resorte": 7920.665, "resorte_inclinado": 7895.705}           # 38_r1, R21 de CATA, 24/10/2026 12:46
STEP = {"resorte": 7920.618, "resorte_inclinado": 7895.657}
LARGO = 630.3048278758258


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def cargar_ej38():
    return cargar("ej38_catia", os.path.join(EJ38, "catia.py"))


class Formula(unittest.TestCase):
    def test_cuenta_y_gemelo_del_control(self):
        ej = cargar_ej38()
        self.assertAlmostEqual(ej.LARGO, 630.3048, places=4)
        self.assertAlmostEqual(math.degrees(ej.ANGULO), 4.54987, places=5)
        self.assertAlmostEqual(ej.ESPERADO["resorte"], 7920.644, places=3)
        self.assertAlmostEqual(ej.ESPERADO["resorte_inclinado"], 7895.684, places=3)
        self.assertGreater(ej.ESPERADO["resorte"] - ej.ESPERADO["resorte_inclinado"], 40 * ej.jc.TOL_VOL)

    def test_la_copia_del_ej45(self):
        with open(os.path.join(EJ38, "pieza_ej45.py"), encoding="utf-8") as fh:
            texto = fh.read()
        self.assertIn("Origen: ej45_resorte.py", texto)
        self.assertIn("from catia_base import medir, nueva_pieza, ref", texto)
        for prohibido in ("captura(", "guardar_pieza(", "correr(", '__name__ == "__main__"'):
            self.assertNotIn(prohibido, texto)
        self.assertIn("pl = part.OriginElements.PlaneZX", texto)


class Construir(unittest.TestCase):
    def test_dos_piezas_y_el_plano_de_cada_una(self):
        ej = cargar_ej38()
        import catia_base
        planos, cerradas = [], []

        def fabrica():
            return Obj(AddNewPointCoord=lambda x, y, z: ("punto", x, y, z), AddNewLinePtPt=lambda a, b: "eje",
                       AddNewHelix=lambda *a: "helice", AddNewPlaneNormal=lambda h, p: "plano normal",
                       AddNewCircleCtrRad=lambda c_, pl, g, rr: planos.append(pl) or "circulo")

        largos = iter((LARGO, LARGO + 0.5))                     # uno distinto por pieza: cada una guarda el suyo

        def nueva(c_, nombre):
            part = Obj(HybridShapeFactory=fabrica(), Update=lambda: None, OriginElements=Obj(PlaneZX="plano ZX"),
                       HybridBodies=Obj(Add=lambda: Obj(AppendHybridShape=lambda o: None)), InWorkObject=None)
            largo = next(largos)
            doc = Obj(GetWorkbench=lambda n: Obj(GetMeasurable=lambda rf: Obj(Length=largo)),
                      Selection=Obj(Clear=lambda: None, Add=lambda o: None, VisProperties=Obj(SetShow=lambda k: None)),
                      Close=lambda: None)
            return doc, part, "cuerpo", Obj(AddNewRibFromRef=lambda a, b: None)
        catia_base_falso = types.SimpleNamespace(medir=lambda d, p, b: {"volume": 7920.0}, nueva_pieza=nueva,
                                                 ref=lambda p, o: o)
        original_cb, original_cerrar = sys.modules.get("catia_base"), ej.jc.cerrar_parte
        sys.modules["catia_base"] = catia_base_falso            # la pieza importa catia_base al cargarse
        ej.jc.cerrar_parte = lambda cb, c, reg, salida, doc, part, body, nombre, parte, ocultos=(): cerradas.append(parte)
        salida = {}
        try:
            ej.construir(None, Obj(ActiveWindow=Obj()), catia_base.Registro(ej.EJ), salida)
        finally:
            sys.modules["catia_base"] = original_cb
            ej.jc.cerrar_parte = original_cerrar
        self.assertEqual(cerradas, ["resorte", "resorte_inclinado"])
        self.assertEqual(planos, ["plano normal", "plano ZX"])
        self.assertEqual(salida["largo_helice_catia"], {"resorte": LARGO, "resorte_inclinado": LARGO + 0.5})


class Juez(unittest.TestCase):
    def salida(self):
        return {"ok": False, "ok_pasos": True, "pendiente": True, "volumen_catia": dict(MEDIDO),
                "largo_helice_catia": {"resorte": LARGO, "resorte_inclinado": LARGO},
                "volumen_step_catia_en_build123d": dict(STEP)}

    def juez(self, s):
        ej = cargar_ej38()
        tmp = tempfile.mkdtemp(prefix="ej38-")
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        return ej.cerrar_con_formula(tmp)

    def test_verde(self):
        r = self.juez(self.salida())
        self.assertTrue(r["ok"], r.get("error"))
        self.assertNotIn("pendiente", r)

    def test_rojo(self):
        s = self.salida()
        s["volumen_catia"]["resorte"] += 0.6
        self.assertIn("resorte: CATIA", self.juez(s)["error"])
        s = self.salida()
        s["volumen_catia"]["resorte_inclinado"] = MEDIDO["resorte"]          # el nervio puso el perfil normal
        s["volumen_step_catia_en_build123d"]["resorte_inclinado"] = MEDIDO["resorte"]
        self.assertIn("resorte_inclinado: CATIA", self.juez(s)["error"])
        s = self.salida()
        s["largo_helice_catia"]["resorte"] = LARGO + 0.01
        self.assertIn("largo de la helice", self.juez(s)["error"])
        s = self.salida()
        s["volumen_step_catia_en_build123d"] = "build123d no midio"
        self.assertIn("el STEP", self.juez(s)["error"])
        s = self.salida()
        s["ok_pasos"] = False
        self.assertFalse(self.juez(s)["ok"])


if __name__ == "__main__":
    unittest.main()
