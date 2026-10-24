# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 45 del banco de CATIA (ajuste por contraccion, MIT 2.008, 24/10/2026).
1. Las cuentas: presion 2,7896e7 Pa, Lame -0,147042 / +0,032958 mm, suma 0,18; con nu 0 el de adentro da -0,15296.
2. cerrar_con_papel(): VERDE con lo que midio CATIA el 24/10 13:11; ROJO con nu mal (cada anillo se aparta y la suma
   queda en 0,18), con un anillo sin presion, con la presion al reves o 1 % alta, con la presion cargada distinta de la
   calculada, con pocos nodos en r = 45 o que no se mueven parejo, con el material mal, con un volumen o una cara de mas,
   con NaN, un paso fallido o un error del juez; cierre idempotente (revisor del 45)."""
import copy
import importlib.util
import json
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ45 = os.path.join(CATIA_DIR, "ejercicios", "45_ajuste_contraccion")
sys.path.insert(0, CATIA_DIR)
MAT = {"Young Modulus": "7e+010N_m2", "Poisson Ratio": "0,33", "Density": "2700kg_m3"}
MEDIDO = {"anillos": {"anillo_in": {"volumen": 5006.913, "caras": {"y0": 1, "x0": 1, "z0": 1}, "contacto": 1,
                                   "material_reabierta": dict(MAT)},
                      "anillo_out": {"volumen": 93953.255, "caras": {"y0": 1, "x0": 1, "z0": 1}, "contacto": 1,
                                     "material_reabierta": dict(MAT)}},
          "simulacion": {"anillo_in": {"ur_medio_mm": -0.147042, "presion_cargada": 27896090.53497943, "nodos_r45": 1366,
                                       "ur_min": -0.147044, "ur_max": -0.147039},
                         "anillo_out": {"ur_medio_mm": 0.032958, "presion_cargada": 27896090.53497943, "nodos_r45": 1329,
                                        "ur_min": 0.032958, "ur_max": 0.032959}}}


def cargar():
    spec = importlib.util.spec_from_file_location("ej45_catia", os.path.join(EJ45, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Cuentas(unittest.TestCase):
    def test_numeros(self):
        ej = cargar()
        self.assertAlmostEqual(ej.presion(), 2.7896e7, delta=1e3)
        li, lo = ej.lame_mm()
        self.assertAlmostEqual(li, -0.147042, places=6)
        self.assertAlmostEqual(lo, 0.032958, places=6)
        self.assertAlmostEqual(lo - li, 0.18, places=9)          # la formula del papel es esta suma
        self.assertAlmostEqual(ej.lame_mm(nu=0)[0], -0.15296, places=5)


class Cierre(unittest.TestCase):
    def cerrar(self, cambio=None, ok_pasos=True, error_juez=None):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej45-")
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
        self.assertAlmostEqual(s["suma_mm"], 0.18, places=6)

    def test_rojos(self):
        nan = float("nan")
        rojos = {
            # con nu 0 los dos anillos se mueven (-0,15296 y +0,02704) y la SUMA sigue en 0,18: solo cada anillo lo ve
            "nu 0 en los anillos": {("simulacion", "anillo_in", "ur_medio_mm"): -0.15296,
                                    ("simulacion", "anillo_out", "ur_medio_mm"): 0.02704},
            "anillo de afuera sin presion": {("simulacion", "anillo_out", "ur_medio_mm"): 0.0},
            "material mal (acero)": {("anillos", "anillo_in", "material_reabierta", "Young Modulus"): "2e+011N_m2"},
            "nu mal en el material": {("anillos", "anillo_out", "material_reabierta", "Poisson Ratio"): "0,266"},
            "volumen de mas": {("anillos", "anillo_in", "volumen"): 5100.0},
            "dos caras de contacto": {("anillos", "anillo_out", "contacto"): 2},
            "NaN en el desplazamiento": {("simulacion", "anillo_in", "ur_medio_mm"): nan},
            "NaN en el volumen": {("anillos", "anillo_out", "volumen"): nan},
            "sin simulacion": {("simulacion",): None},
            # revisor del 45
            "presion al reves": {("simulacion", "anillo_in", "ur_medio_mm"): 0.147042,
                                 ("simulacion", "anillo_out", "ur_medio_mm"): -0.032958},
            "presion 1 % alta (cargada y su efecto)": {("simulacion", "anillo_in", "presion_cargada"): 2.8175e7,
                                                       ("simulacion", "anillo_in", "ur_medio_mm"): -0.148512},
            "presion cargada distinta de la calculada": {("simulacion", "anillo_out", "presion_cargada"): 2.80e7},
            "pocos nodos en r = 45": {("simulacion", "anillo_in", "nodos_r45"): 40},
            "nodos de r = 45 que no se mueven parejo": {("simulacion", "anillo_out", "ur_max"): 0.0335},
            "dos caras en un corte": {("anillos", "anillo_in", "caras"): {"y0": 2, "x0": 1, "z0": 1}},
        }
        for que, cambio in rojos.items():
            with self.subTest(que):
                self.assertFalse(self.cerrar(cambio)[0]["ok"])
        self.assertFalse(self.cerrar(ok_pasos=False)[0]["ok"])
        self.assertFalse(self.cerrar(error_juez="excepcion fuera de un paso")[0]["ok"])

    def test_idempotente(self):
        s, tmp, ej = self.cerrar({("simulacion", "anillo_out", "ur_medio_mm"): 0.0})
        self.assertFalse(s["ok"])
        with open(os.path.join(tmp, "salida.json"), encoding="utf-8") as f:
            d = json.load(f)
        d["simulacion"]["anillo_out"]["ur_medio_mm"] = 0.032958
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(d, f)
        s2 = ej.cerrar_con_papel(tmp)
        self.assertTrue(s2["ok"], s2.get("error"))
        self.assertNotIn("error", s2)


if __name__ == "__main__":
    unittest.main()
