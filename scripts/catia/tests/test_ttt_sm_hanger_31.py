# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 31 del banco de CATIA (Too Tall Toby 23-02-02 SM Hanger como solido, CATA 24/10/2026),
con las ayudas del molde (test_ttt_angle_bracket_24.py): lo que midio CATIA en la R21 de CATA (24/10 11:13) contra la guia
(1 028 g +- 10 con 7 800 kg/m3), contra la referencia de la guia y contra el STEP; la copia del ej54 con sus perfiles; el
juez en verde con lo medido y en rojo con la masa fuera de los 10 g, sin masa, sin referencia y sin STEP."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_ttt_angle_bracket_24 as molde  # noqa: E402

CARPETA = "31_ttt_sm_hanger"


class Cuenta(unittest.TestCase):
    def test_cuenta_y_copia(self):
        ej, _texto = molde.comprobar_cuenta(self, CARPETA)
        self.assertEqual((ej.CFG["masa_g"], ej.CFG["tol_masa_g"], ej.CFG["densidad"]), (1028.0, 10.0, 7800.0))
        self.assertEqual(ej.CFG["volumen_referencia"], 131756.349)
        for j in ("ala", "lado", "oreja", "pie", "triangulo"):        # los perfiles que lee la pieza (AQUI/ej54_sm_hanger)
            self.assertTrue(os.path.isfile(os.path.join(molde.EJERCICIOS, CARPETA, "ej54_sm_hanger", j + ".json")), j)

    def test_juez(self):
        molde.comprobar_juez(self, CARPETA)

    def test_tolerancia_de_10_g(self):
        """Revisor del 31: a 2 g de la guia NO es rojo de masa (+-10); a 11 g si."""
        import tempfile
        ej = molde.cargar(CARPETA)
        tmp = tempfile.mkdtemp(prefix="ej31-")
        cfg = ej.CFG
        dos = molde.salida_medida(cfg)
        dos["masa_catia_g"] = cfg["masa_g"] + 2.0
        dos["volumen_catia"][cfg["parte"]] = dos["masa_catia_g"] / 7.8e-3      # coherente: solo mira la masa
        s = molde.juez(ej, cfg, dos, tmp, gemelo=lambda: {"volumen": dos["volumen_catia"][cfg["parte"]]})
        self.assertNotIn("de la guia", s.get("error", ""))
        once = molde.salida_medida(cfg)
        once["masa_catia_g"] = cfg["masa_g"] + 11.0
        once["volumen_catia"][cfg["parte"]] = once["masa_catia_g"] / 7.8e-3
        s = molde.juez(ej, cfg, once, tmp, gemelo=lambda: {"volumen": once["volumen_catia"][cfg["parte"]]})
        self.assertIn("de la guia", s["error"])

    def test_la_referencia_sale_de_la_cfg(self):
        ej = molde.cargar(CARPETA)
        self.assertEqual(ej.e24.gemelo(ej.CFG)["volumen"], 131756.349)


if __name__ == "__main__":
    unittest.main()
