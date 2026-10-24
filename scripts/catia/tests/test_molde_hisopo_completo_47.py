# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 47 del banco de CATIA (molde completo del hisopo, MIT 2.008, 24/10/2026).
1. La copia del ej72 trae UN solo cambio anotado (la carpeta de la skill sale del repo) y la pieza de la solucion.
2. cerrar_con_papel(): VERDE con lo que midio CATIA el 24/10 13:32; ROJO con la pieza de otro tamano, el canal fuera del
   plano de particion o fuera del medio, el bebedero que no llega arriba, la colada en dos solidos, el gemelo del canal
   corto que no da 2, un expulsor que no toca o que sube a la otra mitad, la mitad de arriba, la mitad de abajo sin
   cavidad, con solo los pines o sin los pines (contra el gemelo de build123d), NaN, un paso fallido o un error del juez;
   cierre idempotente."""
import copy
import importlib.util
import json
import os
import sys
import tempfile
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EJ47 = os.path.join(CATIA_DIR, "ejercicios", "47_molde_hisopo_completo")
sys.path.insert(0, CATIA_DIR)
MEDIDO = {"colada": {"pieza": 1129.94, "canal_cdg": [24.35, 5.0, -0.0], "bebedero_cdg": [24.35, 10.0, 7.5], "colada": 1373.593},
          "control": {"solidos_en_el_archivo": 3, "boca_z": 15.0, "gemelo_canal_corto_solidos": 2,
                      "expulsores": [{"solape_mm3": 0.0, "contacto_mm2": 12.57, "z_max": -3.807},
                                     {"solape_mm3": 0.0, "contacto_mm2": 1.77, "z_max": -1.299}]},
          "molde": {"vol_mitad_abajo": 30159.282, "cdg_z": -7.61}}
GEMELO = {"vol": 30159.282, "cdg": [24.6305, -0.0058, -7.608], "solidos": 1}      # gemelo_molde.py, 24/10


def cargar():
    spec = importlib.util.spec_from_file_location("ej47_catia", os.path.join(EJ47, "catia.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Copia(unittest.TestCase):
    def test_un_solo_cambio(self):
        texto = open(os.path.join(EJ47, "ej72_molde_hisopo_completo.py"), encoding="utf-8").read()
        self.assertEqual(texto.count("CAMBIO "), 1)
        self.assertNotIn(r"C:\Dev\BarackMercosul\.claude", texto)

    def test_pieza_de_la_solucion(self):
        self.assertAlmostEqual(cargar().volumen_pieza(), 1129.94, places=2)


class Cierre(unittest.TestCase):
    def cerrar(self, cambio=None, ok_pasos=True, error_juez=None):
        ej = cargar()
        tmp = tempfile.mkdtemp(prefix="ej47-")
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
        return ej.cerrar_con_papel(tmp, gemelo=GEMELO), tmp, ej

    def test_verde(self):
        s, *_ = self.cerrar()
        self.assertTrue(s["ok"], s.get("error"))
        self.assertNotIn("error", s)

    def test_rojos(self):
        rojos = {
            "pieza de otro tamano": {("colada", "pieza"): 1150.0},
            "canal fuera de la particion": {("colada", "canal_cdg"): [24.35, 5.0, 1.0]},
            "compuerta fuera del medio": {("colada", "canal_cdg"): [20.0, 5.0, 0.0]},
            "bebedero que no llega arriba": {("colada", "bebedero_cdg"): [24.35, 10.0, 6.0]},
            "colada en dos solidos": {("control", "solidos_en_el_archivo"): 4},
            "gemelo ciego": {("control", "gemelo_canal_corto_solidos"): 1},
            "boca abajo de la cara": {("control", "boca_z"): 14.0},
            "expulsor que no toca": {("control", "expulsores", 0, "contacto_mm2"): 0.0},
            "expulsor que se mete": {("control", "expulsores", 1, "solape_mm3"): 0.5},
            "expulsor en la otra mitad": {("control", "expulsores", 1, "z_max"): 2.0},
            "falta un expulsor": {("control", "expulsores"): [{"solape_mm3": 0.0, "contacto_mm2": 12.57, "z_max": -3.807}]},
            "la mitad de arriba": {("molde", "cdg_z"): 7.61},
            "NaN en la pieza": {("colada", "pieza"): float("nan")},
            "NaN en el contacto": {("control", "expulsores", 0, "contacto_mm2"): float("nan")},
            "sin control": {("control",): None},
            # revisor del 47: con solo el signo del centro, estos moldes daban verde
            "molde sin cavidad ni pines": {("molde", "vol_mitad_abajo"): 30915.0, ("molde", "cdg_z"): -7.5},
            "molde con solo los pines": {("molde", "vol_mitad_abajo"): 30755.1, ("molde", "cdg_z"): -7.49},
            "molde sin restar los pines": {("molde", "vol_mitad_abajo"): 30319.2, ("molde", "cdg_z"): -7.617},
            "NaN en la mitad": {("molde", "vol_mitad_abajo"): float("nan")},
            "NaN en el solape": {("control", "expulsores", 0, "solape_mm3"): float("nan")},
            "NaN en z_max": {("control", "expulsores", 1, "z_max"): float("nan")},
            "NaN en el centro del molde": {("molde", "cdg_z"): float("nan")},
            "bebedero corrido en x": {("colada", "bebedero_cdg"): [24.5, 10.0, 7.5]},
            "bebedero corrido en y": {("colada", "bebedero_cdg"): [24.35, 10.2, 7.5]},
        }
        for que, cambio in rojos.items():
            with self.subTest(que):
                self.assertFalse(self.cerrar(cambio)[0]["ok"])
        self.assertFalse(self.cerrar(ok_pasos=False)[0]["ok"])
        self.assertFalse(self.cerrar(error_juez="excepcion fuera de un paso")[0]["ok"])

    def test_idempotente(self):
        s, tmp, ej = self.cerrar({("molde", "cdg_z"): 7.61})
        self.assertFalse(s["ok"])
        with open(os.path.join(tmp, "salida.json"), encoding="utf-8") as f:
            d = json.load(f)
        d["molde"]["cdg_z"] = -7.61
        with open(os.path.join(tmp, "salida.json"), "w", encoding="utf-8") as f:
            json.dump(d, f)
        s2 = ej.cerrar_con_papel(tmp, gemelo=GEMELO)
        self.assertTrue(s2["ok"], s2.get("error"))
        self.assertNotIn("error", s2)


if __name__ == "__main__":
    unittest.main()
