# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 55 del banco de CATIA (tubo cuadrado doblado, 24/10/2026).
1. La cuenta: Pappus 22 717,168 mm3 y el centro por tramos (61,3097; 43,2671; 0), y el gemelo: el tubo doblado para el
   OTRO lado (la curva hacia -X y la recta 2 hacia -X) tiene el MISMO volumen y otro centro.
2. cerrar_con_cuenta(): VERDE con lo que midio CATIA el 24/10 15:03; ROJO con el tubo doblado al reves (mismo volumen),
   con la pared de 1,9, con el STEP en dos solidos o con otro centro, con NaN, un paso fallido o un error del juez;
   cierre idempotente."""
import copy
import importlib.util
import json
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ55 = os.path.join(CATIA_DIR, "ejercicios", "55_tubo_doblado")
sys.path.insert(0, CATIA_DIR)
CDG = [61.31, 43.267, 0.0]
MEDIDO = {"volumen_catia": {"tubo": 22717.168}, "cdg_catia_mm": {"tubo": CDG},
          "step_catia_en_build123d": {"tubo": {"volumen": 22717.168, "cdg_mm": [61.3097, 43.2671, 0.0], "solidos": 1,
                                               "cascaras": 1, "caras_sueltas": 0}}}
# doblado al reves: espejo de la curva y de la recta 2 respecto de x = 50 (mismo volumen)
AL_REVES = [100 - 61.3097, 43.2671, 0.0]
FORMA = {"sobra_A_menos_B": 0.0, "falta_B_menos_A": 0.0, "booleana_cierra": True, "dist_max_exacta_A_a_B": 0.0,
         "dist_max_exacta_B_a_A": 0.0, "solidos": [1, 1]}


def cargar():
    spec = importlib.util.spec_from_file_location("ej55_catia", os.path.join(EJ55, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Cuenta(unittest.TestCase):
    def test_pappus_y_centro(self):
        v, c = cargar().cuenta()
        self.assertAlmostEqual(v, 22717.168, places=3)
        self.assertAlmostEqual(c[0], 61.3097, places=4)
        self.assertAlmostEqual(c[1], 43.2671, places=4)

    def test_copia_trae_el_tubo(self):
        texto = open(os.path.join(EJ55, "ej85_tubo_doblado.py"), encoding="utf-8").read()
        self.assertIn("A_SEC = 30 ** 2 - 26 ** 2", texto)
        self.assertIn("f.CreateCircle(70.0, 40.0, 20.0", texto)


class Cierre(unittest.TestCase):
    def cerrar(self, cambio=None, ok_pasos=True, error_juez=None, forma=None):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej55-")
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
        return ej.cerrar_con_cuenta(tmp, comparar_forma=lambda c: dict(FORMA, **(forma or {}))), tmp, ej

    def test_verde(self):
        s, *_ = self.cerrar()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertNotIn("error", s)

    def test_rojos(self):
        rojos = {
            "doblado al reves (mismo volumen)": {("cdg_catia_mm", "tubo"): AL_REVES,
                                                 ("step_catia_en_build123d", "tubo", "cdg_mm"): AL_REVES},
            "pared de 1,9": {("volumen_catia", "tubo"): (900 - 26.2 ** 2) * 101.4159},
            "STEP en dos solidos": {("step_catia_en_build123d", "tubo", "solidos"): 2},
            "STEP con otro centro": {("step_catia_en_build123d", "tubo", "cdg_mm"): [61.35, 43.2671, 0.0]},
            "NaN en el volumen": {("volumen_catia", "tubo"): float("nan")},
            "NaN en el centro": {("cdg_catia_mm", "tubo"): [float("nan"), 43.267, 0.0]},
            "sin STEP medido": {("step_catia_en_build123d",): "no esta el entorno CAD"},
        }
        for que, cambio in rojos.items():
            with self.subTest(que):
                self.assertFalse(self.cerrar(cambio)[0]["ok"])
        # revisor del 55: el perfil girado 10 grados tiene el mismo volumen y centro; lo caza la forma
        self.assertFalse(self.cerrar(forma={"sobra_A_menos_B": 11725.0, "falta_B_menos_A": 11725.0,
                                            "dist_max_exacta_A_a_B": 2.4})[0]["ok"])
        self.assertFalse(self.cerrar(forma={"dist_max_exacta_B_a_A": 0.02})[0]["ok"])
        self.assertFalse(self.cerrar({("step_catia_en_build123d", "tubo", "caras_sueltas"): 3})[0]["ok"])
        self.assertFalse(self.cerrar({("step_catia_en_build123d", "tubo", "cascaras"): 2})[0]["ok"])
        self.assertFalse(self.cerrar({("step_catia_en_build123d", "tubo", "volumen"): 22717.168 + 0.6})[0]["ok"])
        self.assertTrue(self.cerrar({("volumen_catia", "tubo"): 22717.168 + 0.4})[0]["ok"])     # borde: 0,5 mm3
        self.assertFalse(self.cerrar({("volumen_catia", "tubo"): 22717.168 + 0.6})[0]["ok"])
        self.assertFalse(self.cerrar({("cdg_catia_mm", "tubo"): [61.3097, 43.2671 + 0.011, 0.0]})[0]["ok"])
        self.assertTrue(self.cerrar({("cdg_catia_mm", "tubo"): [61.3097, 43.2671 + 0.0099, 0.0]})[0]["ok"])
        self.assertFalse(self.cerrar(ok_pasos=False)[0]["ok"])
        self.assertFalse(self.cerrar(error_juez="excepcion fuera de un paso")[0]["ok"])

    def test_idempotente(self):
        s, tmp, ej = self.cerrar({("cdg_catia_mm", "tubo"): AL_REVES})
        self.assertFalse(s["ok"])
        with open(os.path.join(tmp, "salida.json"), encoding="utf-8") as f:
            d = json.load(f)
        d["cdg_catia_mm"]["tubo"] = CDG
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(d, f)
        s2 = ej.cerrar_con_cuenta(tmp, comparar_forma=lambda c: FORMA)
        self.assertNotIn("pendiente", s2)
        self.assertTrue(s2["ok"], s2.get("error"))
        self.assertNotIn("error", s2)


if __name__ == "__main__":
    unittest.main()
