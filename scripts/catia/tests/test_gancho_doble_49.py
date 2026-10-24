# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 49 del banco de CATIA (el gancho doble de la casa rehecho en CATIA, 24/10/2026).
1. Las cotas salen del params_doble.json del repo (derivadas, no escritas) y la entrada guiada se corta SOLO del lado -Y
   (lo entregado no tiene la del +Y).
2. cerrar_con_referencia() con la referencia, la medicion y la comparacion inyectadas: VERDE con lo de la corrida de las
   13:57 (exactas 0,0016 y 0,0; la de malla da 0,029 por el facetado de OpenCASCADE); ROJO con los gemelos (la nariz R2,95,
   la entrada de los dos lados, y los resaltos y la muesca del revisor del 49), con el volumen o el centro de CATIA por dentro corridos, con una compara.py vieja (sin la distancia exacta),
   con NaN, con el STEP en dos solidos, sin STEP, con un paso fallido o un error del juez; cierre idempotente."""
import copy
import importlib.util
import json
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ49 = os.path.join(CATIA_DIR, "ejercicios", "49_gancho_doble")
sys.path.insert(0, CATIA_DIR)
REF = {"volumen": 68604.251, "cdg_mm": [6.7948, 0.0122, 9.9653], "solidos": 1, "cascaras": 1, "caras_sueltas": 0}
STEP = {"volumen": 68604.59, "cdg_mm": [6.7948, 0.0122, 9.9653], "solidos": 1, "cascaras": 1, "caras_sueltas": 0}
COMP = {"vol_A": 68604.59, "vol_B": 68604.251, "sobra_A_menos_B": 0.0, "falta_B_menos_A": 0.0, "booleana_cierra": True,
        "dist_max_A_a_B": 0.0276, "p99_A_a_B": 0.0, "dist_max_B_a_A": 0.0217, "p99_B_a_A": 0.0,
        "dist_max_exacta_A_a_B": 0.0016, "dist_max_exacta_B_a_A": 0.0, "solidos": [1, 1]}


def cargar():
    spec = importlib.util.spec_from_file_location("ej49_catia", os.path.join(EJ49, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Datos(unittest.TestCase):
    def test_derivadas_del_params(self):
        d = cargar().parametros()
        self.assertAlmostEqual(d["ye"], 22.3)
        self.assertAlmostEqual(d["y_raiz"], 22.3)
        self.assertAlmostEqual(d["ancho_X"], 36.0)
        self.assertAlmostEqual(d["ia"], 13.3)

    def test_entrada_solo_del_lado_menos_y(self):
        texto = open(os.path.join(EJ49, "catia.py"), encoding="utf-8").read()
        self.assertIn("[tri_m]", texto)
        self.assertNotIn("[tri, tri_m]", texto)

    def test_area_del_ala(self):
        ej = cargar()
        ala = ej.perfiles(ej.parametros())[0]
        self.assertAlmostEqual(ej.area_centro(ala)[0], 238.0)


class Cierre(unittest.TestCase):
    def cerrar(self, ref=None, step=None, comp=None, interno=None, ok_pasos=True, error_juez=None, sin_step=False):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej49-")
        os.makedirs(os.path.join(tmp, ej.EJ))
        if not sin_step:
            open(os.path.join(tmp, ej.EJ, ej.NOMBRE + ".stp"), "w").close()
        vc, cc = interno or (68604.251, [6.795, 0.012, 9.965])
        s = {"ok": False, "ok_pasos": ok_pasos, "pendiente": "x", "volumen_catia": {ej.NOMBRE: vc},
             "cdg_catia_mm": {ej.NOMBRE: cc}, "step_catia_en_build123d": {ej.NOMBRE: dict(STEP, **(step or {}))}}
        if error_juez:
            s["error"] = error_juez
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        r = dict(REF, **(ref or {}))
        c = comp if comp is not None else COMP
        return ej.cerrar_con_referencia(tmp, referencia="ref.step", medir=lambda p: r, comparar=lambda a, b: c), tmp, ej

    def cambiado(self, **k):
        c = copy.deepcopy(COMP)
        c.update(k)
        return c

    def test_verde(self):
        s, *_ = self.cerrar()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertNotIn("error", s)

    def test_gemelos_del_criterio_nuevo(self):
        r295 = self.cerrar(ref={"volumen": 68613.445},
                           comp=self.cambiado(falta_B_menos_A=9.194, dist_max_exacta_B_a_A=0.02071, p99_A_a_B=0.0189))
        self.assertFalse(r295[0]["ok"])
        dos_lados = self.cerrar(step={"volumen": 68548.652, "cdg_mm": [6.7797, 0.0, 9.9621]},
                                interno=(68548.251, [6.78, 0.0, 9.962]),
                                comp=self.cambiado(falta_B_menos_A=56.0, dist_max_exacta_B_a_A=0.82174))
        self.assertFalse(dos_lados[0]["ok"])

    def test_rojos(self):
        nan = float("nan")
        rojos = {
            "solo la distancia exacta referencia -> CATIA": dict(comp=self.cambiado(dist_max_exacta_B_a_A=0.0105)),
            # los gemelos del revisor del 49 (resaltos y muesca sobre el STEP de CATIA, compara.py corregido 14:55)
            "resalto 1 x 1 x 0,03 (solo CATIA -> referencia)": dict(comp=self.cambiado(sobra_A_menos_B=0.03, dist_max_exacta_A_a_B=0.03)),
            "resalto 2 x 2 x 0,015": dict(comp=self.cambiado(sobra_A_menos_B=0.06, dist_max_exacta_A_a_B=0.015, dist_max_exacta_B_a_A=0.015)),
            "muesca 1 x 1 x 0,05": dict(comp=self.cambiado(falta_B_menos_A=0.05, dist_max_exacta_A_a_B=0.05, dist_max_exacta_B_a_A=0.05)),
            "NaN en la exacta CATIA -> referencia": dict(comp=self.cambiado(dist_max_exacta_A_a_B=float("nan"))),
            "volumen de CATIA por dentro 0,02 corrido": dict(interno=(68604.271, [6.795, 0.012, 9.965])),
            "centro de CATIA por dentro corrido": dict(interno=(68604.251, [6.795, 0.03, 9.965])),
            "compara.py vieja (sin la distancia exacta)": dict(comp={k: v for k, v in COMP.items()
                                                                     if not k.startswith("dist_max_exacta")}),
            "NaN en la distancia exacta": dict(comp=self.cambiado(dist_max_exacta_B_a_A=nan)),
            "NaN en el volumen interno": dict(interno=(nan, [6.795, 0.012, 9.965])),
            "booleana que no cierra": dict(comp=self.cambiado(booleana_cierra=False)),
            "STEP en dos solidos": dict(step={"solidos": 2}),
            "sin STEP de CATIA": dict(sin_step=True),
            "un paso fallo": dict(ok_pasos=False),
            "error del juez": dict(error_juez="excepcion fuera de un paso"),
        }
        for que, k in rojos.items():
            with self.subTest(que):
                self.assertFalse(self.cerrar(**k)[0]["ok"])

    def test_idempotente(self):
        s, tmp, ej = self.cerrar(comp=self.cambiado(falta_B_menos_A=56.0))
        self.assertFalse(s["ok"])
        s2 = ej.cerrar_con_referencia(tmp, referencia="ref.step", medir=lambda p: REF, comparar=lambda a, b: COMP)
        self.assertTrue(s2["ok"], s2.get("error"))
        self.assertNotIn("error", s2)


if __name__ == "__main__":
    unittest.main()
