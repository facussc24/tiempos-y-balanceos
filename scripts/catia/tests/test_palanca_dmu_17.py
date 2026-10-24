# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 17 del banco de CATIA (palanca con DMU Kinematics, 24/10/2026).

1. Los chequeos esperados (ESPERADO) son los de los mal_*.py y el bien.py del 06 del banco 3D (otra fuente: se leen de
   esos archivos con ast, no se copian).
2. La cuenta: punta_esperada (giro que levanta la palanca, _conjunto.py del 06), aplicar() de una Position de CATIA, el
   volumen de cada fija contra lo que midio CATIA el 24/10 10:15 (409 900; 456 158,517; 449 073,5; 464 910,3).
3. cerrar_con_choques(): VERDE con lo que midio OpenCASCADE a las 10:17 (con la luz sin soporte); ROJO si la punta se
   corre, si un mutante no choca donde debe, si la buena choca, o si la luz del mal_2 no es 15."""
import ast
import importlib.util
import json
import math
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ17 = os.path.join(CATIA_DIR, "ejercicios", "17_palanca_dmu")
BANCO06 = os.path.join(os.path.dirname(os.path.dirname(CATIA_DIR)), "evals", "banco3d", "ejercicios", "06_palanca_0_60")
sys.path.insert(0, CATIA_DIR)
VOL_CATIA_10_15 = {"fija_bien": 409900.0, "fija_mal1": 456158.517, "fija_mal2": 449073.5, "fija_mal3": 464910.3}
# medir_choques.py sobre la corrida de las 10:17 (choque mm3, luz sin soporte mm)
CHOQUES_10_17 = {"0": {"fija_bien": (0.0, 55.0), "fija_mal1": (0.0, 35.0), "fija_mal2": (0.0, 35.0), "fija_mal3": (0.0, 35.0)},
                 "35": {"fija_bien": (0.0, 55.0), "fija_mal1": (4491.553, None), "fija_mal2": (0.0, 15.9548),
                        "fija_mal3": (0.0, 35.0)},
                 "50": {"fija_bien": (0.0, 55.0), "fija_mal1": (0.0, 7.9039), "fija_mal2": (0.0, 15.0),
                        "fija_mal3": (0.0, 13.4256)},
                 "60": {"fija_bien": (0.0, 55.0), "fija_mal1": (0.0, 26.2428), "fija_mal2": (0.0, 15.0),
                        "fija_mal3": (562.699, None)}}


def cargar():
    spec = importlib.util.spec_from_file_location("ej17_catia", os.path.join(EJ17, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def chequeos_del_banco(archivo):
    """Los argumentos brazo= y chequeos= de la llamada armar(...) del archivo del 06."""
    arbol = ast.parse(open(os.path.join(BANCO06, archivo), encoding="utf-8").read())
    for n in ast.walk(arbol):
        if isinstance(n, ast.Call) and getattr(n.func, "id", None) == "armar":
            kw = {k.arg: ast.literal_eval(k.value) for k in n.keywords}
            return kw.get("brazo"), {g: q for g, q in kw.get("chequeos", [])}
    raise AssertionError(f"sin armar() en {archivo}")


class Cuenta(unittest.TestCase):
    def test_esperado_y_brazos_son_los_del_banco(self):
        ej = cargar()
        for fija, archivo in (("fija_bien", "bien.py"), ("fija_mal1", "mal_1_choca_a_35.py"),
                              ("fija_mal2", "mal_2_pellizco_15_a_50.py"), ("fija_mal3", "mal_3_choca_a_60.py")):
            brazo, cheq = chequeos_del_banco(archivo)
            self.assertEqual(ej.BRAZOS[fija], brazo, fija)
            self.assertEqual(ej.ESPERADO[fija], cheq, fija)

    def test_punta_y_aplicar(self):
        ej = cargar()
        self.assertEqual(ej.punta_esperada(0), (150.0, 0.0, 80.0))
        t = math.radians(30)
        # giro de 30 alrededor del eje (0, y, 80) con direccion -Y (el que levanta la palanca): Position de CATIA
        X = (math.cos(t), 0.0, math.sin(t))
        Z = (-math.sin(t), 0.0, math.cos(t))
        o = (80.0 * math.sin(t), 0.0, 80.0 - 80.0 * math.cos(t))       # el punto (0, 0, 80) queda quieto
        a = list(X) + [0.0, 1.0, 0.0] + list(Z) + list(o)
        self.assertLess(math.dist(ej.aplicar(a, (0.0, 0.0, 80.0)), (0.0, 0.0, 80.0)), 1e-9)
        self.assertLess(math.dist(ej.aplicar(a, ej.PUNTA), ej.punta_esperada(30)), 1e-9)

    def test_volumen_de_las_fijas_contra_catia(self):
        ej = cargar()
        for k, v in VOL_CATIA_10_15.items():
            self.assertLess(abs(ej.volumen_fija(ej.BRAZOS[k]) - v), 0.01, k)


class Cierre(unittest.TestCase):
    def cerrar(self, cambio_choques=None, dif_punta=0.0, signo=-1.0):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej17-")
        s = {"ok": False, "ok_pasos": True, "pendiente": "x", "signo_del_comando": signo,
             "cinematica": {str(t): {"dif_mm": dif_punta} for t in ej.ANGULOS},
             "steps": {k: "x.stp" for k in list(ej.BRAZOS) + ["palanca"]}, "poses": {"0": [1.0] * 12}}
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        ch = {a: {k: {"choque_mm3": v[0], "luz_mm": 2.0 if v[1] is not None else 0.0,
                      **({"luz_sin_soporte_mm": v[1]} if v[1] is not None else {})} for k, v in r.items()}
              for a, r in CHOQUES_10_17.items()}
        for (a, k), d in (cambio_choques or {}).items():
            ch[a][k].update(d)
        return ej.cerrar_con_choques(tmp, medir=lambda e: ch)

    def test_verde(self):
        s = self.cerrar()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertEqual(len(s["chequeos"]), 12)

    def test_rojos(self):
        self.assertFalse(self.cerrar(dif_punta=0.01)["ok"])                                       # punta corrida
        self.assertFalse(self.cerrar(signo=1.0)["ok"])          # el eje va a +Y y el banco gira alrededor de -Y: tiene que ser -1
        self.assertFalse(self.cerrar({("35", "fija_mal1"): {"choque_mm3": 0.0, "luz_sin_soporte_mm": 3.0}})["ok"])
        self.assertFalse(self.cerrar({("60", "fija_bien"): {"choque_mm3": 12.0}})["ok"])          # la buena choca
        self.assertFalse(self.cerrar({("50", "fija_mal2"): {"luz_sin_soporte_mm": 16.0}})["ok"])  # luz fuera de 15 +- 0,5


if __name__ == "__main__":
    unittest.main()
