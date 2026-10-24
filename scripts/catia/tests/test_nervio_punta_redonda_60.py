# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 60 del banco de CATIA (redondeo tritangente, 24/10/2026).
1. La cuenta: 23 613,717 mm3 y centro (50; 3; 19,6838).
2. cerrar_con_cuenta(): VERDE con lo que midio CATIA el 24/10 15:53; ROJO con dos redondeos R2 en vez de la punta redonda,
   con la punta sin redondear, con el eje del R3 corrido o en otra direccion, con dos ejes, sin ejes, con el STEP en dos
   solidos, dos cascaras o caras sueltas, con la forma distinta del gemelo, con NaN, un paso fallido o un error del juez;
   bordes de tolerancia (0,5 mm3 y 0,01 mm); cierre idempotente."""
import copy
import importlib.util
import json
import subprocess
import math
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ60 = os.path.join(CATIA_DIR, "ejercicios", "60_nervio_punta_redonda")
sys.path.insert(0, CATIA_DIR)
V = 23613.717
CDG = [50.0, 3.0, 19.6838]
MEDIDO = {"volumen_catia": {"nervio": V}, "cdg_catia_mm": {"nervio": [50.0, 3.0, 19.684]},
          "step_catia_en_build123d": {"nervio": {"volumen": V, "cdg_mm": CDG, "solidos": 1, "cascaras": 1,
                                                 "caras_sueltas": 0}}}
FORMA = {"sobra_A_menos_B": 0.0, "falta_B_menos_A": 0.0, "booleana_cierra": True, "dist_max_exacta_A_a_B": 0.0,
         "dist_max_exacta_B_a_A": 0.0, "solidos": [1, 1], "gemelo": {"ejes_r3_catia": [[3.0, 37.0, 1.0]]}}
DOS_R2 = 100 * (6 * 40 - 2 * (4 - math.pi))         # redondeo R2 en las dos aristas de arriba: punta plana de 2
SIN_REDONDEO = 24000.0


def cargar():
    spec = importlib.util.spec_from_file_location("ej60_catia", os.path.join(EJ60, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Cuenta(unittest.TestCase):
    def test_cuenta(self):
        v, c = cargar().cuenta()
        self.assertAlmostEqual(v, V, places=3)
        for a, b in zip(c, CDG):
            self.assertAlmostEqual(a, b, places=4)


class Cierre(unittest.TestCase):
    def cerrar(self, cambio=None, ok_pasos=True, error_juez=None, forma=None):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej60-")
        s = dict(copy.deepcopy(MEDIDO), ok=False, ok_pasos=ok_pasos, pendiente="x")
        for ruta, val in (cambio or {}).items():
            d = s
            for k in ruta[:-1]:
                d = d[k]
            d[ruta[-1]] = val
        if error_juez:
            s["error"] = error_juez
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        return ej.cerrar_con_cuenta(tmp, comparar_forma=lambda c: dict(copy.deepcopy(FORMA), **(forma or {}))), tmp, ej

    def test_verde(self):
        s, *_ = self.cerrar()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertNotIn("error", s)

    def test_rojos(self):
        rojos = {
            "dos redondeos R2": ({("volumen_catia", "nervio"): DOS_R2}, None),
            "sin redondeo": ({("volumen_catia", "nervio"): SIN_REDONDEO,
                              ("step_catia_en_build123d", "nervio", "volumen"): SIN_REDONDEO}, None),
            "centro de CATIA corrido en z": ({("cdg_catia_mm", "nervio"): [50.0, 3.0, 19.7]}, None),
            "eje del R3 corrido en z": (None, {"gemelo": {"ejes_r3_catia": [[3.0, 36.0, 1.0]]}}),
            "eje del R3 corrido en y": (None, {"gemelo": {"ejes_r3_catia": [[2.0, 37.0, 1.0]]}}),
            "eje del R3 en Y": (None, {"gemelo": {"ejes_r3_catia": [[3.0, 37.0, 0.0]]}}),
            "dos ejes": (None, {"gemelo": {"ejes_r3_catia": [[3.0, 37.0, 1.0], [3.0, 3.0, 1.0]]}}),
            "sin ejes": (None, {"gemelo": {"ejes_r3_catia": []}}),
            "ejes ausentes": (None, {"gemelo": {}}),
            "STEP en dos solidos": ({("step_catia_en_build123d", "nervio", "solidos"): 2}, None),
            "STEP con dos cascaras": ({("step_catia_en_build123d", "nervio", "cascaras"): 2}, None),
            "STEP con caras sueltas": ({("step_catia_en_build123d", "nervio", "caras_sueltas"): 3}, None),
            "forma: falta": (None, {"falta_B_menos_A": 2.0}),
            "forma: distancia exacta": (None, {"dist_max_exacta_A_a_B": 0.02}),
            "forma: dos solidos": (None, {"solidos": [2, 1]}),
            "NaN en el volumen": ({("volumen_catia", "nervio"): float("nan")}, None),
            "NaN en el centro del STEP": ({("step_catia_en_build123d", "nervio", "cdg_mm"): [50.0, float("nan"), 19.68]},
                                          None),
            "sin STEP medido": ({("step_catia_en_build123d",): "no esta el entorno CAD"}, None),
            "STEP medido como texto en la parte": ({("step_catia_en_build123d", "nervio"): "error al leer"}, None),
        }
        for que, (cambio, forma) in rojos.items():
            with self.subTest(que):
                self.assertFalse(self.cerrar(cambio, forma=forma)[0]["ok"])
        self.assertTrue(self.cerrar(forma={"gemelo": {"ejes_r3_catia": [[3.0, 37.0, -1.0]]}})[0]["ok"])   # eje al reves
        self.assertTrue(self.cerrar({("volumen_catia", "nervio"): V + 0.4})[0]["ok"])        # borde: 0,5 mm3
        self.assertFalse(self.cerrar({("volumen_catia", "nervio"): V + 0.6})[0]["ok"])
        self.assertTrue(self.cerrar({("cdg_catia_mm", "nervio"): [50.0, 3.0, CDG[2] + 0.0099]})[0]["ok"])
        self.assertFalse(self.cerrar({("cdg_catia_mm", "nervio"): [50.0, 3.0, CDG[2] + 0.011]})[0]["ok"])
        self.assertFalse(self.cerrar(ok_pasos=False)[0]["ok"])
        self.assertFalse(self.cerrar(error_juez="excepcion fuera de un paso")[0]["ok"])

    def test_idempotente(self):
        s, tmp, ej = self.cerrar({("step_catia_en_build123d", "nervio", "cascaras"): 2})
        self.assertFalse(s["ok"])
        with open(os.path.join(tmp, "salida.json"), encoding="utf-8") as f:
            d = json.load(f)
        d["step_catia_en_build123d"]["nervio"]["cascaras"] = 1
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(d, f)
        s2 = ej.cerrar_con_cuenta(tmp, comparar_forma=lambda c: FORMA)
        self.assertNotIn("pendiente", s2)
        self.assertTrue(s2["ok"], s2.get("error"))
        self.assertNotIn("error", s2)


class GemeloDeVerdad(unittest.TestCase):
    """Revisor del 60: las pruebas de arriba inyectan la forma; esta corre gemelo_nervio.py de verdad contra su propio STEP (con
    .venv-cad) y juzga su salida con juzgar_forma: rompe si cambia el parseo de los ejes o el script."""

    def test_gemelo_contra_si_mismo(self):
        ej = cargar()
        if not os.path.exists(ej.jc.VENV_CAD):
            self.skipTest("sin .venv-cad")
        paso = os.path.join(tempfile.mkdtemp(prefix="gem-"), "g.step")
        r = subprocess.run([ej.jc.VENV_CAD, "-I", os.path.join(EJ60, "gemelo_nervio.py"), paso, paso], capture_output=True,
                           text=True, timeout=600)
        d = json.loads([x for x in r.stdout.splitlines() if x.startswith("{")][-1])
        self.assertAlmostEqual(d["vol"], V, places=3)
        self.assertEqual(ej.juzgar_forma(dict(FORMA, gemelo=d)), [])


if __name__ == "__main__":
    unittest.main()
