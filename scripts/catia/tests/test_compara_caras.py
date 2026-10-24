# -*- coding: utf-8 -*-
"""Prueba de compara.py --caras (24/10/2026, T3 de la COLA, revisor Fable del cierre de la tanda).
La malla de compara.py reparte 20 000 puntos por AREA y una cara de pocos mm2 puede no recibir ninguno: un agujero ciego
D1 con 2,5 de profundidad en vez de 3 sobre la placa del 58 quedaba verde en toda la cadena. --caras mide una grilla por
CARA del B-Rep, exacta contra la cascara del otro. Con un par chico (placa 30 x 30 x 6):
- el agujero de 2,5 contra el de 3 da 0,5 mm en los dos sentidos (ROJO para cualquier juez con 0,01);
- la pieza contra si misma da 0 y ninguna cara queda sin punto (VERDE).
Sin .venv-cad se saltea, y es lenta (6,5 min el 24/10 en la PC principal): corre solo con
CATIA_PRUEBAS_LENTAS=1."""
import json
import os
import subprocess
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, CATIA_DIR)
COMPARA = os.path.join(CATIA_DIR, "ejercicios", "32_virolador_v16", "compara.py")
ARMAR = """
import sys
from build123d import Align, Box, Cylinder, Pos, export_step
for prof, ruta in ((3.0, sys.argv[1]), (2.5, sys.argv[2])):
    p = Box(30, 30, 6, align=(Align.MIN, Align.MIN, Align.MIN))
    p -= Pos(15, 15, 6 - prof / 2) * Cylinder(0.5, prof)
    export_step(p, ruta)
"""


def venv_cad():
    import juez_comun as jc
    return jc.VENV_CAD


def correr(a, b):
    r = subprocess.run([venv_cad(), "-I", COMPARA, a, b, "--caras"], capture_output=True, text=True, timeout=900)
    return json.loads([x for x in r.stdout.splitlines() if x.startswith("{")][-1])


@unittest.skipUnless(os.path.exists(venv_cad()), "sin .venv-cad")
@unittest.skipUnless(os.environ.get("CATIA_PRUEBAS_LENTAS") == "1", "lenta (~6 min): CATIA_PRUEBAS_LENTAS=1")
class Caras(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        d = tempfile.mkdtemp(prefix="caras-")
        cls.a, cls.b = os.path.join(d, "a.step"), os.path.join(d, "b.step")
        subprocess.run([venv_cad(), "-I", "-c", ARMAR, cls.a, cls.b], check=True, capture_output=True, timeout=600)

    def test_el_fondo_corrido_se_ve(self):
        d = correr(self.a, self.b)
        self.assertGreater(d["dist_max_caras_A_a_B"], 0.4)
        self.assertGreater(d["dist_max_caras_B_a_A"], 0.4)
        self.assertEqual(d["caras_sin_punto_A_a_B"], 0)
        self.assertEqual(d["caras_sin_punto_B_a_A"], 0)

    def test_la_misma_pieza_da_cero(self):
        d = correr(self.a, self.a)
        self.assertLessEqual(d["dist_max_caras_A_a_B"], 1e-4)
        self.assertLessEqual(d["dist_max_caras_B_a_A"], 1e-4)
        self.assertGreater(d["puntos_caras_A_a_B"], 0)

    def test_sin_la_bandera_no_cambia_la_salida(self):
        r = subprocess.run([venv_cad(), "-I", COMPARA, self.a, self.a], capture_output=True, text=True, timeout=900)
        d = json.loads([x for x in r.stdout.splitlines() if x.startswith("{")][-1])
        self.assertFalse(any(k.startswith(("dist_max_caras", "puntos_caras", "caras_sin_punto")) for k in d))


if __name__ == "__main__":
    unittest.main()
