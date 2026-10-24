# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 41 del banco de CATIA (viga por elementos finitos contra la cuenta, 24/10/2026).
1. La cuenta: Timoshenko 0,80152 mm; Euler-Bernoulli 203,71 y 407,43 Hz (los numeros del ej57/ej60 de la practica).
2. cerrar_con_cuenta(): VERDE con lo que midio CATIA el 24/10 12:50 (0,79707 mm; 204,07 y 405,29 Hz); ROJO con la malla
   lineal (0,27256 mm, ej57), con aluminio (la frecuencia sola casi no cambia: lo caza el material), con el alto 11, sin
   un modo, con NaN, con la pieza reabierta sin el acero, con la carga en otra cara, con un paso fallido o un error del
   juez; con NaN en cualquier campo, con nu 0,30 o E de aluminio leidos (solo los ve el control del material), con la
   cara de carga partida, la punta que no baja pareja (carga en media cara) o la malla de 10 mm; cierre idempotente."""
import copy
import importlib.util
import json
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ41 = os.path.join(CATIA_DIR, "ejercicios", "41_fem_viga")
sys.path.insert(0, CATIA_DIR)
MEDIDO = {"viga": {"volumen": 40000.0, "densidad_reabierta": 7860.0, "cara_empotrada_x": 0.0, "cara_carga_x": 200.0,
                   "cara_empotrada_area": 200.0, "cara_carga_area": 200.0,
                   "propiedades_reabierta": {"Young Modulus": "2e+011N_m2", "Poisson Ratio": "0,266",
                                             "Density": "7860kg_m3"}},
          "estatica": {"flecha_mm": 0.79707, "nodos_punta": 153, "c3_punta_min": -0.797085, "c3_punta_max": -0.797057},
          "frecuencias": {"modos_Hz": [[1, 204.07], [2, 405.29], [3, 1264.5]]}}


def cargar():
    spec = importlib.util.spec_from_file_location("ej41_catia", os.path.join(EJ41, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Cuenta(unittest.TestCase):
    def test_numeros_de_la_cuenta(self):
        ej = cargar()
        self.assertAlmostEqual(ej.flecha_timoshenko(200000.0, 0.266), 0.80152, places=5)
        f1, f2 = ej.frecuencias_euler(2e11, 7860.0)
        self.assertAlmostEqual(f1, 203.71, places=1)
        self.assertAlmostEqual(f2, 407.43, places=1)
        self.assertEqual(ej.numero("2e+011N_m2"), 2e11)
        self.assertEqual(ej.numero("0,266"), 0.266)

    def test_aluminio_en_frecuencia_es_ciego(self):
        # el porque del control de material: E/rho del aluminio casi igual al del acero
        ej = cargar()
        f_al = ej.frecuencias_euler(7e10, 2710.0)[0]
        self.assertLess(abs(f_al - 203.71) / 203.71, 0.015)


class Cierre(unittest.TestCase):
    def cerrar(self, cambio=None, ok_pasos=True, error_juez=None):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej41-")
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
        return ej.cerrar_con_cuenta(tmp), tmp, ej

    def test_verde(self):
        s, *_ = self.cerrar()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertNotIn("error", s)

    def test_rojos(self):
        nan = float("nan")
        rojos = {
            "malla lineal": {("estatica", "flecha_mm"): 0.27256},
            "aluminio": {("viga", "propiedades_reabierta", "Young Modulus"): "7e+010N_m2",
                         ("viga", "propiedades_reabierta", "Density"): "2710kg_m3", ("viga", "densidad_reabierta"): 2710.0},
            # revisor del 41: casos que SOLO puede cazar el control del material leido
            "nu 0,30 (la flecha casi no cambia)": {("viga", "propiedades_reabierta", "Poisson Ratio"): "0,3"},
            "E de aluminio leido con todo lo demas de acero": {("viga", "propiedades_reabierta", "Young Modulus"):
                                                              "7e+010N_m2"},
            "sin propiedades reabiertas": {("viga", "propiedades_reabierta"): {}},
            "NaN en el volumen": {("viga", "volumen"): nan},
            "NaN en la densidad reabierta": {("viga", "densidad_reabierta"): nan},
            "NaN en la cara de carga": {("viga", "cara_carga_x"): nan},
            "cara de carga partida (100 mm2)": {("viga", "cara_carga_area"): 100.0},
            "carga en media cara (la punta gira)": {("estatica", "c3_punta_min"): -0.7999, ("estatica", "c3_punta_max"): -0.7943},
            "malla de 10 mm (25 nodos)": {("estatica", "nodos_punta"): 25},
            "NaN en un modo": {("frecuencias", "modos_Hz"): [[1, nan], [2, 405.29]]},
            "alto 11 (flecha -25 %)": {("estatica", "flecha_mm"): 0.6013},
            "sin el segundo modo": {("frecuencias", "modos_Hz"): [[1, 204.07]]},
            "segundo modo corrido 3 %": {("frecuencias", "modos_Hz"): [[1, 204.07], [2, 419.6]]},
            "NaN en la flecha": {("estatica", "flecha_mm"): nan},
            "reabierta sin el acero": {("viga", "densidad_reabierta"): 1000.0},
            "carga en otra cara": {("viga", "cara_carga_x"): 100.0},
            "viga de otro tamano": {("viga", "volumen"): 44000.0},
        }
        for que, cambio in rojos.items():
            with self.subTest(que):
                self.assertFalse(self.cerrar(cambio)[0]["ok"])
        self.assertFalse(self.cerrar(ok_pasos=False)[0]["ok"])
        self.assertFalse(self.cerrar(error_juez="excepcion fuera de un paso")[0]["ok"])

    def test_idempotente(self):
        s, tmp, ej = self.cerrar({("estatica", "flecha_mm"): 0.27256})
        self.assertFalse(s["ok"])
        with open(os.path.join(tmp, "salida.json"), encoding="utf-8") as f:
            d = json.load(f)
        d["estatica"]["flecha_mm"] = 0.79707
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(d, f)
        s2 = ej.cerrar_con_cuenta(tmp)
        self.assertTrue(s2["ok"], s2.get("error"))
        self.assertNotIn("error", s2)


if __name__ == "__main__":
    unittest.main()
