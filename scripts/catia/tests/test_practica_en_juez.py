# -*- coding: utf-8 -*-
"""Prueba sin CATIA de scripts/catia/practica_en_juez.py y de los ejercicios 25, 27 y 29 que lo usan (24/10/2026).

1. Los datos que cada catia.py le pasa a pj.main (papel, tolerancia, densidad, gemelo) son los que dice el ejNN copiado
   de la practica en su «return {... "oficial" ... "gemelo" ...}» y su DENS (se leen de los archivos, no se copian).
2. cerrar_con_masa: VERDE con lo que midio CATIA el 24/10 10:55-10:57; ROJO con la masa fuera de la tolerancia del
   papel, con el volumen lejos del gemelo, con el STEP corrido o sin medir (texto de error) y con los pasos en falla; y
   (24/10, revisor del 37) con el centro del STEP corrido 0,05 mm (mismo volumen), sin centro, con el STEP en dos
   solidos, con NaN en el volumen y con un error del juez con los pasos ok.
3. tol_volumen: 0,5 mm3 en piezas chicas y 1e-5 del volumen en las grandes (el Buffer Stand: 0,9 mm3 entre el gemelo y
   su propio STEP)."""
import ast
import json
import os
import re
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ = os.path.join(CATIA_DIR, "ejercicios")
sys.path.insert(0, CATIA_DIR)
import practica_en_juez as pj  # noqa: E402

# carpeta, ejNN, lo que midio CATIA (volumen de CATIA y de su STEP leido con build123d)
CASOS = {"25_ttt_bearing_jig": ("ej36_bearing_jig", 42053.828, 42053.842),
         "27_ttt_curved_support": ("ej38_curved_support", 166112.182, 166112.182),
         "29_ttt_buffer_stand": ("ej39_buffer_stand", 228694.873, 228695.446)}
# el centro del STEP de CATIA de las corridas de las 11:21-11:23 (build123d)
STEP_CDG = {"25_ttt_bearing_jig": [0.0, 32.1106, -3.5724], "27_ttt_curved_support": [0.0, 35.9647, 22.8158],
            "29_ttt_buffer_stand": [0.0, 0.0, 35.6756]}


def argumentos(carpeta):
    """Los argumentos posicionales y con nombre de pj.main(...) del catia.py del ejercicio."""
    arbol = ast.parse(open(os.path.join(EJ, carpeta, "catia.py"), encoding="utf-8").read())
    for n in ast.walk(arbol):
        if isinstance(n, ast.Call) and getattr(n.func, "attr", None) == "main":
            pos = [ast.literal_eval(a) if not isinstance(a, ast.Name) else a.id for a in n.args]
            kw = {k.arg: ast.literal_eval(k.value) for k in n.keywords}
            return pos, kw
    raise AssertionError(carpeta)


def del_ej(carpeta, ej):
    texto = open(os.path.join(EJ, carpeta, ej + ".py"), encoding="utf-8").read()
    dens = next(ast.literal_eval(n.value) for n in ast.parse(texto).body
                if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", None) == "DENS")
    oficial = float(re.search(r'"oficial(?:_lb)?": ([0-9.]+)', texto).group(1))
    gemelo = float(re.search(r'"gemelo": ([0-9.]+)', texto).group(1))
    tol = re.search(r'"tolerancia": ([0-9.]+)', texto)
    return dens, oficial, gemelo, float(tol.group(1)) if tol else None


class Datos(unittest.TestCase):
    def test_cada_catia_py_pasa_lo_que_dice_su_ej(self):
        for carpeta, (ej, _, _) in CASOS.items():
            pos, kw = argumentos(carpeta)
            self.assertEqual(pos[:3], [carpeta, ej, ej], carpeta)
            dens, oficial, gemelo, tol = del_ej(carpeta, ej)
            self.assertEqual((pos[3], pos[5], pos[6]), (oficial, dens, gemelo), carpeta)
            if tol is not None:                      # la guia da la tolerancia: se usa esa
                self.assertEqual(pos[4], tol, carpeta)

    def test_tol_volumen(self):
        self.assertEqual(pj.tol_volumen(42053.8), 0.5)
        self.assertAlmostEqual(pj.tol_volumen(228694.873), 2.287, places=3)


class Cierre(unittest.TestCase):
    def cerrar(self, carpeta, vol=None, vstep=None, ok=True, cdg=None, solidos=1, sin_step=False, error_juez=None):
        ej, v0, s0 = CASOS[carpeta]
        pos, kw = argumentos(carpeta)
        tmp = tempfile.mkdtemp(prefix="pj-")
        v = v0 if vol is None else vol
        s = {"ok": False, "ok_pasos": ok, "pendiente": "x", "resultado": {"vol": v},
             "volumen_step_catia_en_build123d": vstep if isinstance(vstep, str) else {pj.CLAVE_STEP: s0 if vstep is None
                                                                                       else vstep}}
        if not sin_step:
            s["step_catia_en_build123d"] = {pj.CLAVE_STEP: {"cdg_mm": cdg or STEP_CDG[carpeta], "solidos": solidos,
                                                            "cascaras": 1, "caras_sueltas": 0}}
        if error_juez:
            s["error"] = error_juez
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        return pj.cerrar_con_masa(tmp, pos[3], pos[4], pos[5], pos[6], kw.get("factor", 1.0), kw.get("unidad", "g"),
                                  kw.get("gemelo_cdg"))

    def test_verde_con_lo_medido(self):
        for carpeta in CASOS:
            self.assertTrue(self.cerrar(carpeta)["ok"], carpeta)
            self.assertIsNotNone(argumentos(carpeta)[1].get("gemelo_cdg"), carpeta)     # los tres pasan el centro

    def test_rojos(self):
        v = 42053.828 + 0.2 / 7.8e-3                   # SOLO la masa: el gemelo y el STEP cuadran con v (revisor)
        self.assertFalse(pj.cerrar_con_masa(self._salida(v), 328.02, 0.1, 7.8e-3, v)["ok"])
        self.assertFalse(self.cerrar("27_ttt_curved_support", vol=166112.182 + 3.0, vstep=166112.182 + 3.0)["ok"])   # gemelo
        self.assertFalse(self.cerrar("29_ttt_buffer_stand", vstep=228694.873 + 3.0)["ok"])                         # STEP
        self.assertFalse(self.cerrar("29_ttt_buffer_stand", vstep="no esta el entorno CAD")["ok"])
        self.assertFalse(self.cerrar("25_ttt_bearing_jig", ok=False)["ok"])
        # el centro: lo que la masa y el volumen no ven (revisor del 37, CATA en el 36)
        self.assertFalse(self.cerrar("25_ttt_bearing_jig", cdg=[0.0, 32.1606, -3.5724])["ok"])
        self.assertFalse(self.cerrar("27_ttt_curved_support", sin_step=True)["ok"])
        self.assertFalse(self.cerrar("29_ttt_buffer_stand", solidos=2)["ok"])
        self.assertFalse(self.cerrar("25_ttt_bearing_jig", vol=float("nan"))["ok"])
        self.assertFalse(self.cerrar("27_ttt_curved_support", error_juez="excepcion fuera de un paso")["ok"])
        # el 29 con la masa a 0,03 lb del papel (tolerancia 0,02) es rojo aunque el volumen cuadre con su gemelo
        self.assertFalse(pj.cerrar_con_masa(self._salida(228694.873 + 0.03 * 453.592 / 7.8e-3), 3.923, 0.02, 7.8e-3,
                                            228694.873 + 0.03 * 453.592 / 7.8e-3, 453.592, "lb")["ok"])

    def _salida(self, v):
        tmp = tempfile.mkdtemp(prefix="pj-")
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump({"ok_pasos": True, "resultado": {"vol": v},
                       "volumen_step_catia_en_build123d": {pj.CLAVE_STEP: v}}, f)
        return tmp


if __name__ == "__main__":
    unittest.main()
