# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 59 del banco de CATIA (caja 120 x 80 x 50 vaciada con AddNewShell, CATA 24/10/2026).

1. La cuenta (83 508 mm3 y centro z 17,8781) armada de otra forma: el fondo y las cuatro paredes como cinco placas.
2. cerrar_con_referencia(): VERDE con lo medido en la R21 de CATA (24/10 15:46, 59_r1); ROJO con la pared hacia afuera, con
   la cara de abajo sacada en vez de la de arriba (mismo volumen, otro centro), con otras caras, con la distancia exacta,
   si el gemelo no corrio, con un NaN, con una excepcion fuera de un paso y si un paso fallo."""
import importlib.util
import json
import os
import sys
import tempfile
import unittest

os.environ.setdefault("CATIA_TRABAJO", tempfile.mkdtemp(prefix="catia-prueba-"))   # antes de importar catia_base

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ59 = os.path.join(CATIA_DIR, "ejercicios", "59_caja_vaciada")
sys.path.insert(0, CATIA_DIR)

# 59_r1, R21 de CATA, 24/10/2026 15:46
MEDIDO = {"vol": 83508.0, "cdg": [60.0, 40.0, 17.878], "saca": 396492.0, "z_sacado": 26.5}
COMPARA = {"vol_A": 83508.0, "vol_B": 83508.0, "sobra_A_menos_B": 0.0, "falta_B_menos_A": 0.0, "comun": 83508.0,
           "booleana_cierra": True, "tolerancia_booleana": 0.0001, "dist_max_A_a_B": 0.0, "p99_A_a_B": 0.0,
           "dist_max_B_a_A": 0.0, "p99_B_a_A": 0.0, "dist_max_exacta_A_a_B": 0.0, "dist_max_exacta_B_a_A": 0.0,
           "solidos": [1, 1]}
GEMELO = {"gemelo": {"volumen": 83508.0, "cdg_mm": [60.0, 40.0, 17.8781], "caras": 11, "solidos": 1,
                     "step": "caja_vaciada_gemelo.step"}, "catia": {"caras": 11, "solidos": 1}}


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def ej():
    return cargar("ej59_catia", os.path.join(EJ59, "catia.py"))


class Cuenta(unittest.TestCase):
    def test_cinco_placas(self):
        e = ej()
        a, b, c, t = e.A, e.B, e.C, e.T
        placas = [(a * b * t, t / 2),                                  # fondo
                  (a * t * (c - t), t + (c - t) / 2), (a * t * (c - t), t + (c - t) / 2),          # paredes largas
                  ((b - 2 * t) * t * (c - t), t + (c - t) / 2), ((b - 2 * t) * t * (c - t), t + (c - t) / 2)]
        v = sum(p[0] for p in placas)
        z = sum(p[0] * p[1] for p in placas) / v
        self.assertAlmostEqual(v, 83508.0, places=6)
        self.assertAlmostEqual(e.V_CUENTA, v, places=6)
        self.assertAlmostEqual(e.CDG[2], z, places=9)
        self.assertAlmostEqual(e.CDG[2], 17.8781, places=4)          # el de la fila


class Juez(unittest.TestCase):
    def juez(self, vol=None, cdg=None, saca=None, z_sacado=None, gemelo=None, comparado=None, ok_pasos=True, error=None,
             step=None, step_texto=None):
        e = ej()
        tmp = tempfile.mkdtemp(prefix="ej59-")
        v = MEDIDO["vol"] if vol is None else vol
        c = cdg or MEDIDO["cdg"]
        s = {"ok": False, "ok_pasos": ok_pasos, "pendiente": True, "volumen_catia": {"caja_vaciada": v},
             "cdg_catia_mm": {"caja_vaciada": c},
             "cascara": {"saca": MEDIDO["saca"] if saca is None else saca,
                         "z_de_lo_sacado": MEDIDO["z_sacado"] if z_sacado is None else z_sacado},
             "step_catia_en_build123d": {"caja_vaciada": {"volumen": v, "cdg_mm": [c[0], c[1], 17.8781] if not cdg else c,
                                                          "solidos": 1, "caras_sueltas": 0}}}
        s["step_catia_en_build123d"]["caja_vaciada"].update(step or {})
        if step_texto:
            s["step_catia_en_build123d"] = step_texto
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
        # la pared hacia afuera: 126 x 86 x 53 - 120 x 80 x 50
        afuera = 126 * 86 * 53 - 120 * 80 * 50
        self.assertIn("volumen de CATIA", self.juez(vol=afuera)["error"])
        # la cara de abajo sacada: mismo volumen, el centro y lo sacado cambian de lado
        abajo = self.juez(cdg=[60.0, 40.0, 50 - 17.8781], z_sacado=50 - 26.5)
        self.assertIn("centro de CATIA", abajo["error"])
        self.assertIn("lo que saco la cascara", abajo["error"])
        self.assertIn("la cascara saco", self.juez(saca=480000.0 - 83508.0 + 50)["error"])
        self.assertIn("lo que saco la cascara", self.juez(z_sacado=float("nan"))["error"])
        g = json.loads(json.dumps(GEMELO))
        g["catia"]["caras"] = 12
        self.assertIn("12 caras", self.juez(gemelo=g)["error"])
        g["gemelo"]["caras"] = 12                                    # 12 y 12: tampoco
        self.assertIn("12 caras", self.juez(gemelo=g)["error"])
        self.assertIn("distancia exacta", self.juez(comparado=dict(COMPARA, dist_max_exacta_B_a_A=0.02))["error"])
        sin = {k: v for k, v in COMPARA.items() if k != "dist_max_exacta_A_a_B"}
        self.assertIn("distancia exacta", self.juez(comparado=sin)["error"])
        self.assertIn("sobra", self.juez(comparado=dict(COMPARA, sobra_A_menos_B=3.0))["error"])
        self.assertIn("2 solidos", self.juez(step={"solidos": 2})["error"])
        self.assertIn("centro del STEP", self.juez(step={"cdg_mm": [60.0, 40.0, 17.9]})["error"])
        sin_cad = self.juez(step_texto="medir_b123d no corrio: no esta .venv-cad")   # revisor: antes era una excepcion
        self.assertFalse(sin_cad["ok"])
        self.assertIn("no esta .venv-cad", sin_cad["error"])
        self.assertIn("no corrio", self.juez(gemelo={"error": "gemelo_caja.py no corrio: x"})["error"])

    def test_gemelo_sin_entorno_cad(self):
        e = ej()
        viejo = e.jc.VENV_CAD
        e.jc.VENV_CAD = os.path.join(tempfile.mkdtemp(), "no_esta", "python.exe")
        try:
            self.assertIn("no esta el entorno CAD", e.gemelo(tempfile.mkdtemp(), "x.stp")["error"])
        finally:
            e.jc.VENV_CAD = viejo
        s = self.juez(error="excepcion fuera de un paso: Traceback ...")
        self.assertFalse(s["ok"])
        self.assertIn("excepcion fuera de un paso", s["error"])
        self.assertFalse(self.juez(ok_pasos=False)["ok"])


if __name__ == "__main__":
    unittest.main()
