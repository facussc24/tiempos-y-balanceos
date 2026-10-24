# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 58 del banco de CATIA (patron rectangular, 24/10/2026).
1. La cuenta: 138 345,133 mm3 y centro (100,6131; 60,2044; 3), 12 agujeros en sus posiciones.
2. cerrar_con_cuenta(): VERDE con lo que midio CATIA el 24/10 15:47; ROJO con el patron en el sentido equivocado (2 agujeros),
   con el paso Y de 30 en vez de 35 (MISMO volumen: lo cazan el centro y los ejes), con un agujero corrido 1 mm (mismo
   volumen), con el STEP en dos solidos, dos cascaras o caras sueltas, con la forma distinta del gemelo, con NaN, un paso
   fallido o un error del juez; bordes de tolerancia (1,38 mm3 y 0,01 mm); cierre idempotente."""
import copy
import importlib.util
import json
import subprocess
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ58 = os.path.join(CATIA_DIR, "ejercicios", "58_patron_rectangular")
sys.path.insert(0, CATIA_DIR)
V = 138345.133
CDG = [100.6131, 60.2044, 3.0]
EJES = [[25.0 + 40 * i, 20.0 + 35 * j] for i in range(4) for j in range(3)]
MEDIDO = {"volumen_catia": {"placa": V}, "cdg_catia_mm": {"placa": [100.613, 60.204, 3.0]},
          "step_catia_en_build123d": {"placa": {"volumen": V, "cdg_mm": CDG, "solidos": 1, "cascaras": 1,
                                                "caras_sueltas": 0}}}
FORMA = {"sobra_A_menos_B": 0.0, "falta_B_menos_A": 0.0, "booleana_cierra": True, "dist_max_exacta_A_a_B": 0.0,
         "dist_max_exacta_B_a_A": 0.0, "solidos": [1, 1], "gemelo": {"ejes_r5_catia": EJES}}
UN_AGUJERO = 3.141592653589793 * 25 * 6
# paso Y 30: mismo volumen, el centro de los agujeros baja 5 en y -> la placa sube 12 * UN_AGUJERO * 5 / V
CDG_PASO_30 = [CDG[0], CDG[1] + 12 * UN_AGUJERO * 5 / V, 3.0]
EJES_PASO_30 = [[25.0 + 40 * i, 20.0 + 30 * j] for i in range(4) for j in range(3)]


def cargar():
    spec = importlib.util.spec_from_file_location("ej58_catia", os.path.join(EJ58, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Cuenta(unittest.TestCase):
    def test_cuenta(self):
        v, c = cargar().cuenta()
        self.assertAlmostEqual(v, V, places=3)
        for a, b in zip(c, CDG):
            self.assertAlmostEqual(a, b, places=4)

    def test_agujeros(self):
        self.assertEqual(sorted(map(list, cargar().agujeros())), sorted(EJES))


class Cierre(unittest.TestCase):
    def cerrar(self, cambio=None, ok_pasos=True, error_juez=None, forma=None):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej58-")
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
        tres = V + 9 * UN_AGUJERO           # el sentido (0, 0) de la corrida real: el original y 2 copias (942,478)
        rojos = {
            "sentido equivocado (3 agujeros)": ({("volumen_catia", "placa"): tres,
                                                 ("step_catia_en_build123d", "placa", "volumen"): tres},
                                                {"falta_B_menos_A": 9 * UN_AGUJERO,
                                                 "gemelo": {"ejes_r5_catia": EJES[:3]}}),
            "paso Y de 30 (mismo volumen)": ({("cdg_catia_mm", "placa"): CDG_PASO_30,
                                             ("step_catia_en_build123d", "placa", "cdg_mm"): CDG_PASO_30}, None),
            "paso Y de 30 visto solo por los ejes": (None, {"gemelo": {"ejes_r5_catia": EJES_PASO_30}}),
            "un agujero corrido 1 mm": (None, {"gemelo": {"ejes_r5_catia": [[26.0, 20.0]] + EJES[1:]}}),
            "un agujero de menos en los ejes": (None, {"gemelo": {"ejes_r5_catia": EJES[1:]}}),
            "sin ejes": (None, {"gemelo": {}}),
            "STEP en dos solidos": ({("step_catia_en_build123d", "placa", "solidos"): 2}, None),
            "STEP con dos cascaras": ({("step_catia_en_build123d", "placa", "cascaras"): 2}, None),
            "STEP con caras sueltas": ({("step_catia_en_build123d", "placa", "caras_sueltas"): 3}, None),
            "forma: sobra": (None, {"sobra_A_menos_B": 2.0}),
            "forma: distancia exacta": (None, {"dist_max_exacta_B_a_A": 0.02}),
            "forma: booleana": (None, {"booleana_cierra": False}),
            "NaN en el volumen": ({("volumen_catia", "placa"): float("nan")}, None),
            "NaN en el centro del STEP": ({("step_catia_en_build123d", "placa", "cdg_mm"): [float("nan"), 60.2, 3.0]},
                                          None),
            "sin STEP medido": ({("step_catia_en_build123d",): "no esta el entorno CAD"}, None),
            "STEP medido como texto en la parte": ({("step_catia_en_build123d", "placa"): "error al leer"}, None),
        }
        for que, (cambio, forma) in rojos.items():
            with self.subTest(que):
                self.assertFalse(self.cerrar(cambio, forma=forma)[0]["ok"])
        # revisor del 58: dos caras del mismo agujero con el eje distinto en el tercer decimal son UN eje
        self.assertTrue(self.cerrar(forma={"gemelo": {"ejes_r5_catia": EJES + [[25.0004, 20.0]]}})[0]["ok"])
        self.assertTrue(self.cerrar({("volumen_catia", "placa"): V + 1.3})[0]["ok"])        # borde: 1,38 mm3
        self.assertFalse(self.cerrar({("volumen_catia", "placa"): V + 1.5})[0]["ok"])
        self.assertTrue(self.cerrar({("cdg_catia_mm", "placa"): [CDG[0], CDG[1] + 0.0099, 3.0]})[0]["ok"])
        self.assertFalse(self.cerrar({("cdg_catia_mm", "placa"): [CDG[0], CDG[1] + 0.011, 3.0]})[0]["ok"])
        self.assertFalse(self.cerrar(ok_pasos=False)[0]["ok"])
        self.assertFalse(self.cerrar(error_juez="excepcion fuera de un paso")[0]["ok"])

    def test_idempotente(self):
        s, tmp, ej = self.cerrar({("step_catia_en_build123d", "placa", "solidos"): 2})
        self.assertFalse(s["ok"])
        with open(os.path.join(tmp, "salida.json"), encoding="utf-8") as f:
            d = json.load(f)
        d["step_catia_en_build123d"]["placa"]["solidos"] = 1
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(d, f)
        s2 = ej.cerrar_con_cuenta(tmp, comparar_forma=lambda c: FORMA)
        self.assertNotIn("pendiente", s2)
        self.assertTrue(s2["ok"], s2.get("error"))
        self.assertNotIn("error", s2)


class GemeloDeVerdad(unittest.TestCase):
    """Revisor del 60: las pruebas de arriba inyectan la forma; esta corre gemelo_placa.py de verdad contra su propio STEP (con
    .venv-cad) y juzga su salida con juzgar_forma: rompe si cambia el parseo de los ejes o el script."""

    def test_gemelo_contra_si_mismo(self):
        ej = cargar()
        if not os.path.exists(ej.jc.VENV_CAD):
            self.skipTest("sin .venv-cad")
        paso = os.path.join(tempfile.mkdtemp(prefix="gem-"), "g.step")
        r = subprocess.run([ej.jc.VENV_CAD, "-I", os.path.join(EJ58, "gemelo_placa.py"), paso, paso], capture_output=True,
                           text=True, timeout=600)
        d = json.loads([x for x in r.stdout.splitlines() if x.startswith("{")][-1])
        self.assertAlmostEqual(d["vol"], V, places=3)
        self.assertEqual(ej.juzgar_forma(dict(FORMA, gemelo=d)), [])


if __name__ == "__main__":
    unittest.main()
