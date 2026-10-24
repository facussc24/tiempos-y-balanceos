# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 23 del banco de CATIA (Too Tall Toby 01-10 Light Cap, 24/10/2026).
1. El ej31b copiado trae la densidad del rotulo (1,02e-3 g/mm3, ABS 1 020) y la respuesta de la guia (211,30): se lee del
   archivo con ast. 2. cerrar_con_papel(): VERDE con lo que midio CATIA el 24/10 10:51 (el volumen del gemelo de la
   practica, 207 159,364); ROJO con 0,2 g de mas, con el volumen corrido del gemelo, con el STEP sin medir (texto de
   error, como en CATA sin .venv-cad) o con los pasos en falla."""
import ast
import importlib.util
import json
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ23 = os.path.join(CATIA_DIR, "ejercicios", "23_ttt_light_cap")
sys.path.insert(0, CATIA_DIR)


def cargar():
    spec = importlib.util.spec_from_file_location("ej23_catia", os.path.join(EJ23, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Papel(unittest.TestCase):
    def test_el_ej31b_trae_densidad_y_respuesta(self):
        ej = cargar()
        texto = open(os.path.join(EJ23, "ej31b_light_cap.py"), encoding="utf-8").read()
        dens = next(ast.literal_eval(n.value) for n in ast.parse(texto).body
                    if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", None) == "DENS")
        self.assertEqual(dens, ej.DENSIDAD_G_MM3)
        self.assertIn("211.30", texto)
        self.assertLess(abs(ej.GEMELO_MM3 * ej.DENSIDAD_G_MM3 - ej.PAPEL_G), 0.01)

    def cerrar(self, vol=207159.364, vstep=207159.364, ok=True):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej23-")
        s = {"ok": False, "ok_pasos": ok, "pendiente": "x", "resultado": {"vol": vol},
             "volumen_step_catia_en_build123d": vstep if isinstance(vstep, str) else {"light_cap": vstep}}
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        return ej.cerrar_con_papel(tmp)

    def test_verde_y_rojos(self):
        self.assertTrue(self.cerrar()["ok"])
        self.assertFalse(self.cerrar(vol=207159.364 + 0.2 / 1.02e-3, vstep=207159.364 + 0.2 / 1.02e-3)["ok"])
        self.assertFalse(self.cerrar(vol=207162.5, vstep=207162.5)["ok"])              # 3,1 mm3 del gemelo (tol 2,07)
        self.assertFalse(self.cerrar(vstep="no esta el entorno CAD")["ok"])
        self.assertFalse(self.cerrar(ok=False)["ok"])


if __name__ == "__main__":
    unittest.main()
