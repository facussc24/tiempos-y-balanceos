# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 43 del banco de CATIA (gancho de encastre de Bayer, 24/10/2026).
1. Las cuentas: Castigliano 2,3969 mm, espesor constante 1,4655 (el gemelo), volumen 444,03, centro en x 8,4444.
2. cerrar_con_papel(): VERDE con lo que midio CATIA el 24/10 13:07 (2,39668 mm); ROJO con el espesor constante, con el
   trapecio dado vuelta (mismo volumen, centro en 10,556), con otro E, sin la cara de punta, con la flecha lineal, NaN, un
   paso fallido o un error del juez; cierre idempotente."""
import copy
import importlib.util
import json
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ43 = os.path.join(CATIA_DIR, "ejercicios", "43_gancho_bayer")
sys.path.insert(0, CATIA_DIR)
MEDIDO = {"pieza": {"volumen": 444.03, "cdg_mm": [8.444, 4.75, 1.276], "caras_raiz": 1, "caras_punta": 1,
                    "material_reabierta": {"Young Modulus": "1,815e+009N_m2", "Density": "1200kg_m3"}},
          "simulacion": {"flecha_mm": 2.39668, "c3_punta_min": -2.40404, "c3_punta_max": -2.38575}}


def cargar():
    spec = importlib.util.spec_from_file_location("ej43_catia", os.path.join(EJ43, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Cuentas(unittest.TestCase):
    def test_numeros(self):
        ej = cargar()
        self.assertAlmostEqual(ej.flecha_exacta(), 2.3969, places=4)
        self.assertAlmostEqual(ej.flecha_espesor_constante(), 1.4655, places=4)
        self.assertAlmostEqual(ej.volumen_cuenta(), 444.03, places=2)
        self.assertAlmostEqual(ej.x_centro_cuenta(), 8.4444, places=4)


class Cierre(unittest.TestCase):
    def cerrar(self, cambio=None, ok_pasos=True, error_juez=None):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej43-")
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
        return ej.cerrar_con_papel(tmp), tmp, ej

    def test_verde(self):
        s, *_ = self.cerrar()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertNotIn("error", s)

    def test_rojos(self):
        rojos = {
            "espesor constante": {("simulacion", "flecha_mm"): 1.4655, ("pieza", "volumen"): 592.04,
                                  ("pieza", "cdg_mm"): [9.5, 4.75, 1.64]},
            "trapecio dado vuelta (mismo volumen)": {("pieza", "cdg_mm"): [10.556, 4.75, 1.276]},
            "otro E": {("pieza", "material_reabierta"): {"Young Modulus": "2e+011N_m2"}},
            "sin cara de punta": {("pieza", "caras_punta"): 0},
            "malla lineal": {("simulacion", "flecha_mm"): 0.8},
            "flecha 3 % arriba": {("simulacion", "flecha_mm"): 2.47},
            "NaN en la flecha": {("simulacion", "flecha_mm"): float("nan")},
            "sin simulacion": {("simulacion",): None},
            # revisor del 43
            "NaN en el volumen": {("pieza", "volumen"): float("nan")},
            "NaN en el centro": {("pieza", "cdg_mm"): [float("nan"), 4.75, 1.276]},
            "centro corrido en y": {("pieza", "cdg_mm"): [8.444, 4.95, 1.276]},
            "centro corrido en z": {("pieza", "cdg_mm"): [8.444, 4.75, 1.4]},
            "sin cara de raiz": {("pieza", "caras_raiz"): 0},
            "flecha con el signo cambiado": {("simulacion", "flecha_mm"): -2.39668},
            "punta que se tuerce (0,1 mm)": {("simulacion", "c3_punta_max"): -2.30404},
            "sin la punta medida": {("simulacion", "c3_punta_min"): None},
        }
        for que, cambio in rojos.items():
            with self.subTest(que):
                self.assertFalse(self.cerrar(cambio)[0]["ok"])
        self.assertFalse(self.cerrar(ok_pasos=False)[0]["ok"])
        self.assertFalse(self.cerrar(error_juez="excepcion fuera de un paso")[0]["ok"])

    def test_idempotente(self):
        s, tmp, ej = self.cerrar({("simulacion", "flecha_mm"): 1.4655})
        self.assertFalse(s["ok"])
        with open(os.path.join(tmp, "salida.json"), encoding="utf-8") as f:
            d = json.load(f)
        d["simulacion"]["flecha_mm"] = 2.39668
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(d, f)
        s2 = ej.cerrar_con_papel(tmp)
        self.assertTrue(s2["ok"], s2.get("error"))
        self.assertNotIn("error", s2)


if __name__ == "__main__":
    unittest.main()
