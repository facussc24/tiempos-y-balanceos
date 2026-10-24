# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 37 del banco de CATIA (CSWA Sample Exam 2013, Tool Block etapas 3 y 4, 24/10/2026).

1. El ej41b copiado trae los datos del papel (A 86, B 58, C 44, densidad 0,0079) y las respuestas que usa el juez; se
   leen del archivo con ast, sin importar CATIA. Los tres contornos que lee estan junto a el.
2. cerrar_con_papel(): VERDE con lo que midio CATIA el 24/10 12:38 (79 516,97 y 54 757,347 mm3; el STEP con el centro
   del gemelo); ROJO con una etapa a 0,2 g, con la etapa 3 a 10 mm3 del gemelo, con la ranura corrida 0,1 mm en z (MISMO
   volumen: el centro de la etapa 3 se mueve 0,028 mm, revisor del 37), con el bolsillo del otro lado (el centro del STEP
   a 8,24 mm), con el STEP en dos solidos, sin centro medido, sin una etapa, con el STEP con otro volumen o sin STEP
   medido, y con un paso fallido; cierre idempotente."""
import ast
import importlib.util
import json
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ37 = os.path.join(CATIA_DIR, "ejercicios", "37_cswa_tool_block_e34")
sys.path.insert(0, CATIA_DIR)
VOL_12_38 = {"etapa3": 79516.97, "etapa4": 54757.347}
CDG = {"etapa3": [45.7428, 32.1317, 26.1652], "etapa4": [42.6006, 31.6783, 32.1674]}      # el gemelo (y el STEP 12:38)
STEP = {"volumen": 54757.347, "cdg_mm": [42.6006, 31.6783, 32.1674], "solidos": 1, "cascaras": 1, "caras_sueltas": 0}


def cargar():
    spec = importlib.util.spec_from_file_location("ej37_catia", os.path.join(EJ37, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def constantes_ej41b():
    texto = open(os.path.join(EJ37, "ej41b_tool_block_e34.py"), encoding="utf-8").read()
    arbol = ast.parse(texto)
    out = {}
    for n in arbol.body:
        if isinstance(n, ast.Assign):
            for t in n.targets:
                if isinstance(t, ast.Name) and t.id == "DENS":
                    out["DENS"] = ast.literal_eval(n.value)
                if isinstance(t, ast.Tuple) and [e.id for e in t.elts] == ["A", "B", "C"]:
                    out["ABC"] = ast.literal_eval(n.value)
    out["oficiales"] = [float(x) for x in ("628.18", "432.58") if f"masa({x}" in texto]
    return out


class Papel(unittest.TestCase):
    def test_ej41b_trae_el_papel(self):
        ej, k = cargar(), constantes_ej41b()
        self.assertEqual(k["DENS"], ej.DENSIDAD_G_MM3)
        self.assertEqual(k["ABC"], ej.DIMS)
        self.assertEqual(sorted(k["oficiales"]), sorted(ej.PAPEL_G.values()))

    def test_contornos_junto_al_ej41b(self):
        for n in ("e3.json", "e4_zona.json", "e4_sin_ranura.json"):
            self.assertTrue(os.path.isfile(os.path.join(EJ37, "ej41_tool_block", n)), n)


class Cierre(unittest.TestCase):
    def cerrar(self, vols=None, vstep="igual", ok=True, error_juez=None, cdg=None, step=None):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej37-")
        v = dict(VOL_12_38, **(vols or {}))
        s = {"ok": False, "ok_pasos": ok, "pendiente": "x",
             "etapas": {k: {"vol": x} for k, x in v.items() if x is not None},
             "cdg_etapas_catia_mm": dict(CDG, **(cdg or {})),
             "step_catia_en_build123d": {"etapa4": dict(STEP, **(step or {}))}}
        if vstep == "igual":
            s["volumen_step_catia_en_build123d"] = {"etapa4": VOL_12_38["etapa4"]}
        elif vstep is not None:
            s["volumen_step_catia_en_build123d"] = {"etapa4": vstep}
        if error_juez:
            s["error"] = error_juez
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        return ej.cerrar_con_papel(tmp), tmp, ej

    def test_verde(self):
        s, *_ = self.cerrar()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertNotIn("error", s)
        self.assertLess(abs(s["dif_masa_g"]["etapa3"]), 0.01)
        self.assertLess(abs(s["dif_masa_g"]["etapa4"]), 0.01)

    def test_rojos(self):
        rojos = {
            "etapa 4 a 0,2 g": dict(vols={"etapa4": VOL_12_38["etapa4"] + 0.2 / 0.0079}),
            # 10 mm3 son 0,079 g: la masa pasa y el gemelo no (lo que no ve la masa, NOTAS del 19/10)
            "etapa 3 a 10 mm3 del gemelo": dict(vols={"etapa3": VOL_12_38["etapa3"] + 10.0}),
            "sin la etapa 3": dict(vols={"etapa3": None}),
            "NaN en la etapa 4": dict(vols={"etapa4": float("nan")}),
            "NaN en el STEP": dict(vstep=float("nan")),
            "error del juez con los pasos ok": dict(error_juez="excepcion fuera de un paso"),
            "STEP con otro volumen": dict(vstep=VOL_12_38["etapa4"] + 5.0),
            "sin STEP medido": dict(vstep=None),
            "un paso fallo": dict(ok=False),
            # la falla que el volumen NO ve (revisor del 37, medido con el gemelo): misma masa, otro centro
            "ranura 0,1 mm mas alta (etapa 3)": dict(cdg={"etapa3": [45.7428, 32.1317, 26.1932]}),
            "bolsillo del otro lado (STEP)": dict(step={"cdg_mm": [42.6006, 31.6783, 23.9274]}),
            "sin centro de la etapa 4": dict(cdg={"etapa4": "no se pudo medir"}),
            "STEP en dos solidos": dict(step={"solidos": 2}),
            "STEP con caras sueltas": dict(step={"caras_sueltas": 3}),
        }
        for que, k in rojos.items():
            with self.subTest(que):
                s, *_ = self.cerrar(**k)
                self.assertFalse(s["ok"])
                if k.get("ok", True):                        # con un paso fallido el texto lo pone el juez comun
                    self.assertTrue(s.get("error"))

    def test_idempotente(self):
        s, tmp, ej = self.cerrar(error_juez="pasos con falla: ['x']", ok=False)
        self.assertFalse(s["ok"])
        s2 = ej.cerrar_con_papel(tmp)
        self.assertEqual(s2["error"], s["error"])            # el error del juez no se duplica


if __name__ == "__main__":
    unittest.main()
