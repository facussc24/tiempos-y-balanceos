# -*- coding: utf-8 -*-
"""Prueba sin CATIA del gemelo de los constructores de la casa (scripts/catia/constructores_casa.py, 24/10/2026).

- colocar() con una matriz ESPEJO (det -1, el hallazgo 1 del auditor del 20/10) se niega ANTES de hablar con CATIA: el
  VBScript de Position.SetComponents no se llama. Con una rotacion propia se llama UNA vez, con los 12 numeros en el
  orden de CATIA (rotacion por columnas y despues la traslacion). Con escala, tambien se niega.
- Los radios, el chaflan y los motivos salen del mismo nucleo que build123d (cadlib.constructores): sin chaflan de cama
  (A DECIDIR en lenguaje_diseno.json) placa() se niega antes de abrir un croquis.
Se reemplaza catia_base.evaluar por uno que anota las llamadas."""
import os
import sys
import unittest

CATIA_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, CATIA_DIR)
import catia_base  # noqa: E402
import constructores_casa as cc  # noqa: E402


class Llamadas:
    def __init__(self):
        self.lista = []

    def __call__(self, c, codigo, *objetos):
        self.lista.append((c, codigo, objetos))
        return ""


class ContextoQueNoSeDebeTocar:
    """Si placa() llegara a CATIA con un dato que falta, cualquier atributo revienta la prueba."""

    def __getattr__(self, nombre):
        raise AssertionError(f"placa() toco CATIA ({nombre}) antes de negarse")


class TestColocar(unittest.TestCase):
    def setUp(self):
        self.original = catia_base.evaluar
        self.ev = Llamadas()
        catia_base.evaluar = self.ev

    def tearDown(self):
        catia_base.evaluar = self.original

    def test_espejo_no_llega_a_catia(self):
        espejo = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, -1, 0], [0, 0, 0, 1]]
        with self.assertRaises(cc.Espejo):
            cc.colocar("app", "componente", espejo)
        self.assertEqual(self.ev.lista, [])

    def test_escala_no_llega_a_catia(self):
        with self.assertRaises(cc.NoEsRotacion):
            cc.colocar("app", "componente", [[2, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]])
        self.assertEqual(self.ev.lista, [])

    def test_rotacion_propia_una_llamada_en_orden_catia(self):
        M = cc.marco((0, 0, 1), (1, 0, 0), (5, 6, 7))
        e = cc.colocar("app", "componente", M)
        self.assertEqual(e["det"], 1.0)
        self.assertEqual(len(self.ev.lista), 1)
        c, codigo, objetos = self.ev.lista[0]
        self.assertEqual(c, "app")
        self.assertIn("SetComponents", codigo)
        self.assertEqual(objetos[0], "componente")
        self.assertEqual(list(objetos[1:]), [0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 5.0, 6.0, 7.0])


class TestNucleoCompartido(unittest.TestCase):
    def test_placa_sin_chaflan_se_niega_antes_de_tocar_catia(self):
        with self.assertRaises(cc.FaltaDato):
            cc.placa(ContextoQueNoSeDebeTocar(), 64, 24, 4)

    def test_radio_chico_sin_motivo_se_niega_antes_de_tocar_catia(self):
        with self.assertRaises(cc.SinMotivo):
            cc.caja(ContextoQueNoSeDebeTocar(), 40, 20, 15, radio=0.5)

    def test_mismo_radio_que_build123d(self):
        self.assertEqual(cc._k.radio_mano(), 1.5)


if __name__ == "__main__":
    unittest.main()
