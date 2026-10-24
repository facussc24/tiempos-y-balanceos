# -*- coding: utf-8 -*-
"""Ejercicio 28 del banco de CATIA (COLA_CATIA.md, 24/10/2026, CATA): Too Tall Toby PPP01-01 Bearing Bracket (guia de build123d,
https://build123d.readthedocs.io/en/stable/tttt.html, libre para uso educativo) en CATIA, con la masa contra la de la
guia: 797.15 g con 7800.0 kg/m3. Mismo molde que el 24 (ver su docstring): la pieza la arma pieza_ej37.py (copia por script
del ej de la practica del 19/10) y el veredicto lo da cerrar_con_respuesta() del 24 con esta CFG.

Uso: python catia.py <carpeta de trabajo>  ->  salida.json, el STEP y la captura.
"""
import importlib.util
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("ej24_catia", os.path.join(os.path.dirname(AQUI), "24_ttt_angle_bracket",
                                                                          "catia.py"))
e24 = importlib.util.module_from_spec(_spec)                      # el molde
_spec.loader.exec_module(e24)

CFG = {"ej": "28_ttt_bearing_bracket", "parte": "bearing_bracket", "carpeta": AQUI, "pieza": "pieza_ej37", "nombre": "Too Tall Toby PPP01-01 Bearing Bracket", "masa_g": 797.15,
       "densidad": 7800.0, "preferidos": e24.ACERO}

if __name__ == "__main__":
    sys.exit(e24.correr(CFG))
