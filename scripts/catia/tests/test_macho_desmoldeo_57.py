# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 57 del banco de CATIA (macho con desmoldeo y radios, 24/10/2026).
1. El prismatoide da 1 118 335,198 mm3 (la tapa achicada 60 tan 4 por lado).
2. cerrar_con_cuenta() con el gemelo inyectado: VERDE con lo que midio CATIA el 24/10 15:06; ROJO con el desmoldeo de unos
   4,025 grados (503 mm3 menos), con 3 aristas redondeadas, con el macho sin los radios, con el centro corrido, con el STEP en dos solidos, con NaN,
   un paso fallido o un error del juez, con la FORMA distinta del gemelo (compara.py inyectado), con el STEP con
   2 cascaras o caras sueltas; bordes de tolerancia (11,07 y 11,18 mm3); cierre idempotente."""
import copy
import importlib.util
import json
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ57 = os.path.join(CATIA_DIR, "ejercicios", "57_macho_desmoldeo")
sys.path.insert(0, CATIA_DIR)
GEMELO = {"desmoldeo": {"vol": 1118335.198, "cdg": [0.0, 0.0, 29.2761]},
          "con_radios": {"vol": 1106821.554, "cdg": [0.0, 0.0, 29.2685]}, "aristas_laterales": 4}
MEDIDO = {"macho": {"catia_desmoldeo": 1118335.2, "catia_con_radios": 1106821.52, "aristas_laterales": 4},
          "volumen_catia": {"macho": 1106821.516}, "cdg_catia_mm": {"macho": [0.0, 0.0, 29.269]},
          "step_catia_en_build123d": {"macho": {"volumen": 1106821.6, "cdg_mm": [0.0, 0.0, 29.2685], "solidos": 1,
                                                "cascaras": 1, "caras_sueltas": 0}}}
FORMA = {"sobra_A_menos_B": 0.0, "falta_B_menos_A": 0.0, "booleana_cierra": True, "dist_max_exacta_A_a_B": 0.0,
         "dist_max_exacta_B_a_A": 0.0, "solidos": [1, 1]}


def cargar():
    spec = importlib.util.spec_from_file_location("ej57_catia", os.path.join(EJ57, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Cuenta(unittest.TestCase):
    def test_prismatoide(self):
        self.assertAlmostEqual(cargar().prismatoide(), 1118335.198, places=2)


class Cierre(unittest.TestCase):
    def cerrar(self, cambio=None, ok_pasos=True, error_juez=None, forma=None):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej57-")
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
        return ej.cerrar_con_cuenta(tmp, gemelo_=GEMELO, comparar_forma=lambda c: dict(FORMA, **(forma or {}))), tmp, ej

    def test_verde(self):
        s, *_ = self.cerrar()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertNotIn("error", s)

    def test_rojos(self):
        rojos = {
            "desmoldeo de unos 4,025 grados (503 mm3 menos)": {("macho", "catia_desmoldeo"): 1118335.2 - 500.0},
            "3 aristas redondeadas": {("macho", "aristas_laterales"): 3},
            "macho sin los radios": {("volumen_catia", "macho"): 1118335.2},
            "centro corrido": {("cdg_catia_mm", "macho"): [0.0, 0.0, 29.3]},
            "STEP en dos solidos": {("step_catia_en_build123d", "macho", "solidos"): 2},
            "NaN en el desmoldeo": {("macho", "catia_desmoldeo"): float("nan")},
            "NaN en el centro del STEP": {("step_catia_en_build123d", "macho", "cdg_mm"): [float("nan"), 0.0, 29.2685]},
            "sin STEP medido": {("step_catia_en_build123d",): "no esta el entorno CAD"},
            "STEP medido como texto en la parte": {("step_catia_en_build123d", "macho"): "error al leer"},
        }
        for que, cambio in rojos.items():
            with self.subTest(que):
                self.assertFalse(self.cerrar(cambio)[0]["ok"])
        # revisor del 57: 250 y 80 cambiados dan el mismo volumen y centro; lo caza la forma
        self.assertFalse(self.cerrar(forma={"sobra_A_menos_B": 600.0, "falta_B_menos_A": 600.0})[0]["ok"])
        self.assertFalse(self.cerrar(forma={"dist_max_exacta_A_a_B": 0.02})[0]["ok"])
        self.assertFalse(self.cerrar(forma={"booleana_cierra": False})[0]["ok"])
        self.assertFalse(self.cerrar({("step_catia_en_build123d", "macho", "cascaras"): 2})[0]["ok"])
        self.assertFalse(self.cerrar({("step_catia_en_build123d", "macho", "caras_sueltas"): 3})[0]["ok"])
        self.assertFalse(self.cerrar({("step_catia_en_build123d", "macho", "volumen"): 1106821.554 + 12})[0]["ok"])
        self.assertFalse(self.cerrar({("step_catia_en_build123d", "macho", "cdg_mm"): [0.0, 0.0, 29.28]})[0]["ok"])
        self.assertTrue(self.cerrar({("volumen_catia", "macho"): 1106821.516 + 10})[0]["ok"])
        self.assertFalse(self.cerrar({("volumen_catia", "macho"): 1106821.516 + 12})[0]["ok"])
        self.assertTrue(self.cerrar({("macho", "catia_desmoldeo"): 1118335.2 + 11})[0]["ok"])
        self.assertFalse(self.cerrar({("macho", "catia_desmoldeo"): 1118335.2 + 12})[0]["ok"])
        self.assertFalse(self.cerrar(ok_pasos=False)[0]["ok"])
        self.assertFalse(self.cerrar(error_juez="excepcion fuera de un paso")[0]["ok"])

    def test_idempotente(self):
        s, tmp, ej = self.cerrar({("macho", "aristas_laterales"): 3})
        self.assertFalse(s["ok"])
        with open(os.path.join(tmp, "salida.json"), encoding="utf-8") as f:
            d = json.load(f)
        d["macho"]["aristas_laterales"] = 4
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(d, f)
        s2 = ej.cerrar_con_cuenta(tmp, gemelo_=GEMELO, comparar_forma=lambda c: FORMA)
        self.assertNotIn("pendiente", s2)
        self.assertTrue(s2["ok"], s2.get("error"))
        self.assertNotIn("error", s2)


if __name__ == "__main__":
    unittest.main()
