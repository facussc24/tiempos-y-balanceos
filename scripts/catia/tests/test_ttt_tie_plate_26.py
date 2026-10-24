# -*- coding: utf-8 -*-
"""Prueba sin CATIA del ejercicio 26 del banco de CATIA (Too Tall Toby Tie Plate, CATA 24/10/2026), con las ayudas del molde
(test_ttt_angle_bracket_24.py): lo que midio CATIA en la R21 de CATA (24/10 10:28-10:29) contra la guia (3387.06 g con
7800.0 kg/m3), contra el gemelo y contra el STEP; la copia del ej de la practica con sus cambios anotados; el juez en verde
con lo medido y en rojo con la masa a 2 g, sin masa, sin gemelo, con otro volumen del gemelo y sin STEP."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_ttt_angle_bracket_24 as molde  # noqa: E402

CARPETA = "26_ttt_tie_plate"


class Cuenta(unittest.TestCase):
    def test_cuenta_y_copia(self):
        ej, _texto = molde.comprobar_cuenta(self, CARPETA)
        self.assertEqual((ej.CFG["masa_g"], ej.CFG["densidad"], ej.CFG["preferidos"]), (3387.06, 7800.0, ej.e24.ACERO))

    def test_juez(self):
        molde.comprobar_juez(self, CARPETA)


@unittest.skipUnless(molde.HAY_B123D, "sin build123d (correr con .venv-cad)")
class ContraBuild123d(unittest.TestCase):
    def test_gemelo(self):
        molde.comprobar_gemelo(self, CARPETA)


if __name__ == "__main__":
    unittest.main()
