# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 56 del banco de CATIA (chaflan 5 x 5 en las 12 aristas de una caja, CATA 24/10/2026).

1. cuenta(): con los tres planos que se cortan en un punto, el cubo de esquina conserva K^3 / 4 (integrando el area de cada
   rebanada, sin la formula) y la caja da 1 181 250; con K^3 / 6 da 1 181 166,667, lo que midio chamfer() de build123d.
2. revisar_esquinas(): VERDE con las 8 piezas de 56_r2; ROJO con 7 piezas, con una pieza de otro tamano, con dos en la misma
   esquina, con una pieza en el medio y si chamfer - CATIA deja material.
3. cerrar_con_referencia(): VERDE con lo medido en la R21 de CATA (24/10 15:17, 56_r2); ROJO si CATIA cerrara las esquinas
   como chamfer(), con 26 caras, con la distancia exacta, si el gemelo no corrio, con una excepcion fuera de un paso y si
   un paso fallo."""
import importlib.util
import json
import os
import sys
import tempfile
import unittest

os.environ.setdefault("CATIA_TRABAJO", tempfile.mkdtemp(prefix="catia-prueba-"))   # antes de importar catia_base

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ56 = os.path.join(CATIA_DIR, "ejercicios", "56_chaflan_12")
sys.path.insert(0, CATIA_DIR)

# 56_r2, R21 de CATA, 24/10/2026 15:17
CENTROS = [[-121.875, 36.875, 3.125], [-121.875, 36.875, 56.875], [121.875, 36.875, 3.125], [-121.875, -36.875, 3.125],
           [121.875, 36.875, 56.875], [-121.875, -36.875, 56.875], [121.875, -36.875, 3.125], [121.875, -36.875, 56.875]]
SOBRA = [{"volumen": 10.4167, "cdg_mm": c} for c in CENTROS]
COMPARA = {"vol_A": 1181250.0, "vol_B": 1181250.0, "sobra_A_menos_B": 0.0, "falta_B_menos_A": 0.0, "comun": 1181250.0,
           "booleana_cierra": True, "tolerancia_booleana": 0.0001, "dist_max_A_a_B": 0.0, "p99_A_a_B": 0.0,
           "dist_max_B_a_A": 0.0, "p99_B_a_A": 0.0, "dist_max_exacta_A_a_B": 0.0, "dist_max_exacta_B_a_A": 0.0,
           "caja_A": [250.0, 80.0, 60.0], "caja_B": [250.0, 80.0, 60.0], "solidos": [1, 1]}
GEMELO = {"n_planos": 12, "planos": {"volumen": 1181250.0, "cdg_mm": [-0.0, 0.0, 30.0], "solidos": 1, "caras": 18,
                                     "step": "chaflan_planos.step"},
          "chamfer": {"volumen": 1181166.6667, "cdg_mm": [0.0, -0.0, 30.0], "caras": 26},
          "catia": {"caras": 18, "solidos": 1}, "catia_menos_chamfer": SOBRA, "chamfer_menos_catia": []}


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def ej():
    return cargar("ej56_catia", os.path.join(EJ56, "catia.py"))


def material_esquina(k, n=20000):
    """Cubo de esquina [0, k]^3 con los tres chaflanes x+y>=k, y+z>=k, x+z>=k: area de cada rebanada z (Simpson)."""
    def area(z):
        t = k - z                                    # x >= t, y >= t (de los chaflanes con z) y x + y >= k
        return (k - t) ** 2 - (max(k - 2 * t, 0.0) ** 2) / 2
    h = k / n
    s = area(0) + area(k) + sum((4 if i % 2 else 2) * area(i * h) for i in range(1, n))
    return s * h / 3


class Cuenta(unittest.TestCase):
    def test_esquina_y_caja(self):
        e = ej()
        self.assertAlmostEqual(material_esquina(e.K), e.K ** 3 / 4, places=4)
        self.assertAlmostEqual(e.V_PLANOS, 1181250.0, places=6)
        self.assertAlmostEqual(e.V_CHAMFER, GEMELO["chamfer"]["volumen"], places=3)
        self.assertAlmostEqual(e.V_PLANOS - e.V_CHAMFER, 8 * e.K ** 3 / 12, places=6)


class Esquinas(unittest.TestCase):
    def test_verde(self):
        self.assertEqual(ej().revisar_esquinas(SOBRA, []), [])

    def test_rojo(self):
        e = ej()
        self.assertTrue(any("7 piezas" in x for x in e.revisar_esquinas(SOBRA[:7], [])))
        otra = [dict(SOBRA[0], volumen=20.8333)] + SOBRA[1:]
        self.assertTrue(any("no K^3/12" in x for x in e.revisar_esquinas(otra, [])))
        doble = SOBRA[:7] + [dict(SOBRA[0])]
        self.assertTrue(any("una por esquina" in x for x in e.revisar_esquinas(doble, [])))
        medio = SOBRA[:7] + [{"volumen": 10.4167, "cdg_mm": [0.0, 0.0, 30.0]}]
        self.assertTrue(any("no esta junto a una esquina" in x for x in e.revisar_esquinas(medio, [])))
        self.assertTrue(any("chamfer - CATIA" in x for x in e.revisar_esquinas(SOBRA, [{"volumen": 5.0}])))
        self.assertTrue(any("sin volumen" in x for x in e.revisar_esquinas(SOBRA, [{"volumen": None}])))  # revisor
        self.assertTrue(any("sin volumen" in x for x in e.revisar_esquinas(SOBRA, [{"volumen": float("nan")}])))
        self.assertTrue(e.revisar_esquinas(None, []))


class Juez(unittest.TestCase):
    def juez(self, vol=1181250.0, gemelo=None, comparado=None, ok_pasos=True, error=None):
        e = ej()
        tmp = tempfile.mkdtemp(prefix="ej56-")
        s = {"ok": False, "ok_pasos": ok_pasos, "pendiente": True, "volumen_catia": {"chaflan_12": vol},
             "cdg_catia_mm": {"chaflan_12": [0.0, -0.0, 30.0]}, "chaflan": {"caras_del_chaflan": 12},
             "step_catia_en_build123d": {"chaflan_12": {"volumen": vol, "cdg_mm": [0.0, 0.0, 30.0], "solidos": 1,
                                                        "caras_sueltas": 0}}}
        if error:
            s["error"] = error
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        g = gemelo or json.loads(json.dumps(GEMELO))
        return e.cerrar_con_referencia(tmp, gemelo_con=lambda carpeta, paso: g,
                                       comparar_con=lambda a, b: dict(comparado or COMPARA))

    def test_verde(self):
        s = self.juez()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertNotIn("pendiente", s)

    def test_rojo(self):
        self.assertIn("volumen de CATIA", self.juez(vol=1181166.667)["error"])     # esquinas como chamfer()
        g = json.loads(json.dumps(GEMELO))
        g["catia"]["caras"] = 26
        self.assertIn("26 caras", self.juez(gemelo=g)["error"])
        g["planos"]["caras"] = 26                                    # 26 y 26: tampoco (revisor del 56)
        self.assertIn("26 caras", self.juez(gemelo=g)["error"])
        self.assertIn("distancia exacta", self.juez(comparado=dict(COMPARA, dist_max_exacta_A_a_B=0.03))["error"])
        sin = {k: v for k, v in COMPARA.items() if k != "dist_max_exacta_B_a_A"}
        self.assertIn("distancia exacta", self.juez(comparado=sin)["error"])
        self.assertIn("no corrio", self.juez(gemelo={"error": "gemelo_chaflan.py no corrio: x"})["error"])
        s = self.juez(error="excepcion fuera de un paso: Traceback ...")
        self.assertFalse(s["ok"])
        self.assertIn("excepcion fuera de un paso", s["error"])
        self.assertFalse(self.juez(ok_pasos=False)["ok"])


if __name__ == "__main__":
    unittest.main()
