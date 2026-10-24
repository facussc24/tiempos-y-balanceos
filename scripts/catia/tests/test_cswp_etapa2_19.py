# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 19 del banco de CATIA (CSWP Sample Exam 2, etapa 2, 24/10/2026).

1. El ej28 copiado trae los datos del papel (preguntas 4 y 5: A..E y masas, densidad 0,0077) y son los mismos que usa
   el juez (PAPEL_G, DENSIDAD_G_MM3): se leen del archivo con ast, sin importar CATIA.
2. cerrar_con_papel(): VERDE con lo que midio CATIA el 24/10 10:31 (1 715 115,249 y 1 845 195,325 mm3); ROJO con una
   pregunta a 2 g, sin una pregunta, o con el STEP de CATIA con otro volumen."""
import ast
import importlib.util
import json
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ19 = os.path.join(CATIA_DIR, "ejercicios", "19_cswp_etapa2")
sys.path.insert(0, CATIA_DIR)
VOL_10_31 = {"4": 1715115.249, "5": 1845195.325}


def cargar():
    spec = importlib.util.spec_from_file_location("ej19_catia", os.path.join(EJ19, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def constantes_ej28():
    arbol = ast.parse(open(os.path.join(EJ19, "ej28_etapa2.py"), encoding="utf-8").read())
    out = {}
    for n in arbol.body:
        if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name) and n.targets[0].id in ("DENS", "PREG"):
            out[n.targets[0].id] = ast.literal_eval(n.value)
    return out


class Papel(unittest.TestCase):
    def test_ej28_trae_el_papel(self):
        ej, k = cargar(), constantes_ej28()
        self.assertEqual(k["DENS"], ej.DENSIDAD_G_MM3)
        self.assertEqual({n: v[-1] for n, v in k["PREG"].items()}, ej.PAPEL_G)
        self.assertEqual(k["PREG"][4][:5], (221, 211, 165, 121, 37))
        self.assertEqual(k["PREG"][5][:5], (229, 217, 163, 119, 34))

    def cerrar(self, vols=None, vstep=None, ok=True):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej19-")
        v = dict(VOL_10_31, **(vols or {}))
        s = {"ok": False, "ok_pasos": ok, "pendiente": "x",
             "preguntas": {n: {"vol": x} for n, x in v.items() if x is not None},
             "volumen_step_catia_en_build123d": {"cswp_q5": VOL_10_31["5"] if vstep is None else vstep}}
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        return ej.cerrar_con_papel(tmp)

    def test_verde(self):
        s = self.cerrar()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertLess(abs(s["dif_masa_g"]["4"]), 0.02)

    def test_rojos(self):
        self.assertFalse(self.cerrar(vols={"4": VOL_10_31["4"] + 2.0 / 0.0077})["ok"])        # 2 g de mas
        self.assertFalse(self.cerrar(vols={"5": None})["ok"])                                   # sin la pregunta 5
        self.assertFalse(self.cerrar(vstep=VOL_10_31["5"] + 3.0)["ok"])                         # el STEP no es lo medido
        self.assertFalse(self.cerrar(ok=False)["ok"])


if __name__ == "__main__":
    unittest.main()
