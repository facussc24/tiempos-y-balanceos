# -*- coding: utf-8 -*-
"""Ejercicio 31 del banco de CATIA (COLA_CATIA.md, pedido 8 de la principal, 24/10/2026, CATA): Too Tall Toby 23-02-02
«SM Hanger» (guia de build123d, https://build123d.readthedocs.io/en/stable/tttt.html, libre para uso educativo), chapa de
4 hecha como SOLIDO en CATIA (esta R21 no tiene la biblioteca de chapa por COM), con la masa contra la de la guia:
1 028 g +- 10 en acero de 7 800 kg/m3. Mismo molde que el 24: la pieza la arma pieza_ej54.py (el ej54 de la practica del
19/10, copiado por portar_ej.py, con sus perfiles en ej54_sm_hanger/*.json) y el veredicto lo da cerrar_con_respuesta()
del 24 con esta CFG. No hay gemelo propio: el volumen se compara contra la REFERENCIA de la guia (referencia.py de la
practica, codigo de la guia de build123d que no entra al repo), corrida en la PC principal el 19/10 (NOTAS.md y registro.json de la practica) y otra vez en CATA el 24/10 (referencia_corrida_cata.txt): 131 756,349 mm3 = 1 027,70 g.

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

CFG = {"ej": "31_ttt_sm_hanger", "parte": "sm_hanger", "carpeta": AQUI, "pieza": "pieza_ej54",
       "nombre": "Too Tall Toby 23-02-02 SM Hanger", "masa_g": 1028.0, "tol_masa_g": 10.0, "densidad": 7800.0,
       "preferidos": e24.ACERO, "volumen_referencia": 131756.349,
       "fuente_referencia": "referencia.py de la practica (la de la guia de build123d): PC principal 19/10 y CATA 24/10, referencia_corrida_cata.txt"}

if __name__ == "__main__":
    sys.exit(e24.correr(CFG))
