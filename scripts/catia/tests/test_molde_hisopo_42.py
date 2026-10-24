# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 42 del banco de CATIA (molde de dos mitades de un hisopo, CATA 24/10/2026).

1. Las cuentas: pieza 1 129,94 mm3, bloque 61 830, area proyectada 232,34 mm2 (la del papel: 0,00023234 m2) y
   70 MPa x A = 16,264 kN (el papel lo imprime «16.2 kN»), caben 4 en 80 kN; centro del molde x = 24,5655.
2. pieza_ej71.py es la copia del ej71 con los cambios anotados (no corre suelto ni captura; devuelve ctx).
3. cerrar_con_papel(): VERDE con lo medido en la R21 de CATA (24/10 13:09); ROJO si la cara de particion de CUALQUIERA de
   las dos mitades no da el area (sin la huella), si las mitades no son iguales o quedan del mismo lado, si una mitad tiene
   dos caras en z 0, si la cavidad no se resto, si la cavidad se corrio (mismo volumen, otro centro), si el STEP no da el
   volumen, trae dos solidos o tiene otro centro, con un NaN y si un paso fallo (revisor Sonnet del 42)."""
import importlib.util
import json
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ42 = os.path.join(CATIA_DIR, "ejercicios", "42_molde_hisopo")
sys.path.insert(0, CATIA_DIR)

HISOPO = {"cuentas": {"v_pieza": 1129.94, "area_proyectada_mm2": 232.34, "F_por_pieza_kN": 16.26, "caben_en_80kN": 4},
          "pieza": {"vol": 1129.94, "cuenta": 1129.94},
          "molde": {"bloque": 61830.0, "cuenta_bloque": 61830.0, "con_cavidad": 60700.06, "cuenta": 60700.06},
          "mitades": {"0": {"vol": 30350.03, "cdg_z": 7.61, "caras_en_z0": 1, "area_particion": 1828.66},
                      "1": {"vol": 30350.03, "cdg_z": -7.61, "caras_en_z0": 1, "area_particion": 1828.66},
                      "area_proyectada_medida_mm2": 232.34, "F_por_pieza_kN": 16.264, "caben_en_80kN": 4}}
CDG = [24.566, 0.0, 0.0]                                      # CATIA, 42_final
STEP = {"volumen": 60700.06, "cdg_mm": [24.5655, 0.0, 0.0], "solidos": 1, "cascaras": 2, "caras_sueltas": 0}


def cargar_ej42():
    spec = importlib.util.spec_from_file_location("ej42_catia", os.path.join(EJ42, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Cuenta(unittest.TestCase):
    def test_cuentas(self):
        ej = cargar_ej42()
        self.assertAlmostEqual(ej.V_PIEZA, 1129.94, places=2)
        self.assertEqual(ej.V_BLOQUE, 61830.0)
        self.assertAlmostEqual(ej.AREA_CUENTA, 232.34, places=6)
        self.assertAlmostEqual(ej.AREA_CUENTA, ej.PAPEL["area_mm2"], places=6)       # 0,00023234 m2 del papel
        self.assertAlmostEqual(ej.P_CAIDA * ej.AREA_CUENTA / 1000, ej.PAPEL["F_kN"], delta=ej.TOL_F)
        self.assertEqual(int(ej.F_MAQ // (ej.P_CAIDA * ej.AREA_CUENTA / 1000)), ej.PAPEL["caben"])
        self.assertAlmostEqual(ej.CDG_CUENTA[0], 24.5655, places=4)

    def test_la_copia_del_ej71(self):
        with open(os.path.join(EJ42, "pieza_ej71.py"), encoding="utf-8") as fh:
            texto = fh.read()
        self.assertIn("Origen: ej71_molde_hisopo.py", texto)
        self.assertIn("from catia_base import nueva_pieza, ref, medir, topologia, poligono", texto)
        for prohibido in ("captura(", "correr(", '__name__ == "__main__"'):
            self.assertNotIn(prohibido, texto)
        self.assertIn('return {"doc": doc, "part": part, "body": main}', texto)


class Juez(unittest.TestCase):
    def salida(self):
        return {"ok": False, "ok_pasos": True, "pendiente": True, "hisopo": json.loads(json.dumps(HISOPO)),
                "volumen_catia": {"molde_hisopo": 60700.06}, "cdg_catia_mm": {"molde_hisopo": list(CDG)},
                "volumen_step_catia_en_build123d": {"molde_hisopo": 60700.06}}

    def juez(self, s, step=None):
        ej = cargar_ej42()
        tmp = tempfile.mkdtemp(prefix="ej42-")
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(s, f)
        vistos = []

        def medir(args):
            vistos.append(os.path.relpath(args[1], tmp))
            return {"partes": {"molde_hisopo": dict(step or STEP)}}
        r = ej.cerrar_con_papel(tmp, medir=medir)
        self.assertEqual(vistos, [os.path.join(ej.EJ, ej.PARTE + ".stp")])
        return r

    def test_verde(self):
        r = self.juez(self.salida())
        self.assertTrue(r["ok"], r.get("error"))
        self.assertNotIn("pendiente", r)
        self.assertEqual(r["juez"]["area_proyectada_medida_mm2"], [232.34, 232.34])

    def test_rojo(self):
        for i in ("0", "1"):                                                  # la cara sin la huella, en cada mitad
            s = self.salida()
            s["hisopo"]["mitades"][i]["area_particion"] = 2061.0
            self.assertIn(f"mitad {i}", self.juez(s)["error"])
        s = self.salida()
        s["hisopo"]["mitades"]["1"]["vol"] = 30349.0
        self.assertIn("no son iguales", self.juez(s)["error"])
        s = self.salida()
        s["hisopo"]["mitades"]["1"]["cdg_z"] = 7.61
        self.assertIn("una de cada lado", self.juez(s)["error"])
        s = self.salida()
        s["hisopo"]["mitades"]["0"]["caras_en_z0"] = 2
        self.assertIn("UNA cara", self.juez(s)["error"])
        s = self.salida()
        s["hisopo"]["molde"]["con_cavidad"] = 61830.0                         # no se resto la pieza
        s["volumen_catia"]["molde_hisopo"] = 61830.0
        s["volumen_step_catia_en_build123d"]["molde_hisopo"] = 61830.0
        self.assertIn("con la cavidad", self.juez(s)["error"])
        s = self.salida()
        s["cdg_catia_mm"]["molde_hisopo"][0] -= 0.093         # la cavidad corrida 5 mm en x: 5 x 1 129,94 / 60 700
        self.assertIn("la cavidad se corrio", self.juez(s)["error"])
        s = self.salida()
        s["volumen_step_catia_en_build123d"] = "build123d no midio"
        self.assertIn("el STEP (", self.juez(s)["error"])
        s = self.salida()
        s["volumen_step_catia_en_build123d"]["molde_hisopo"] = 60000.0
        self.assertIn("el STEP (", self.juez(s)["error"])
        self.assertIn("1 solido cerrado", self.juez(self.salida(), step=dict(STEP, solidos=2))["error"])
        self.assertIn("centro del STEP", self.juez(self.salida(), step=dict(STEP, cdg_mm=[24.5655, 0.5, 0.0]))["error"])
        s = self.salida()
        s["hisopo"]["mitades"]["1"]["vol"] = float("nan")
        self.assertFalse(self.juez(s)["ok"])
        s = self.salida()
        s["ok_pasos"] = False
        self.assertFalse(self.juez(s)["ok"])

    def test_excepcion_fuera_de_un_paso(self):
        """Pedido 10 de la principal: el error de correr_ejercicio nunca da verde, aunque todo lo demas cierre."""
        s = self.salida()
        s["error"] = "excepcion fuera de un paso: Traceback ..."
        r = self.juez(s)
        self.assertFalse(r["ok"])
        self.assertIn("excepcion fuera de un paso", r["error"])


if __name__ == "__main__":
    unittest.main()
