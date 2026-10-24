# -*- coding: utf-8 -*-
"""Ejercicio 29 del banco de CATIA (cola del 24/10/2026): Too Tall Toby 24-SPO-06 Buffer Stand en CATIA, con la geometria del ej39_buffer_stand de la practica
del 19/10 copiado SIN cambios (ej39_buffer_stand.py, croquis.py y sus contornos en ej39_buffer_stand/; el gemelo de build123d de la practica en
ej39_buffer_stand/gemelo.py). Lo corre scripts/catia/practica_en_juez.py dentro del juez (con_bien=False).
Papel: guia de build123d, Too Tall Toby (https://build123d.readthedocs.io/en/stable/tttt.html, plano 24-SPO-06 Buffer Stand, libre para uso
educativo): 3,923 lb +-0,02 (plano en pulgadas). Densidad 7.8e-3 g/mm3 (acero 7 800 del rotulo). Gemelo de build123d de la practica: 228696.0 mm3.
ok: ver practica_en_juez.py (masa contra el papel, volumen contra el gemelo, STEP). Limite (revisor 24/10): con la tolerancia
de la guia, una falta chica (un redondeo o un chaflan de ~1 g) pasa sin verse; el volumen contra el gemelo la ve solo si
el gemelo la tiene."""
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun y practica_en_juez
import practica_en_juez as pj  # noqa: E402

if __name__ == "__main__":
    sys.exit(pj.main("29_ttt_buffer_stand", "ej39_buffer_stand", "ej39_buffer_stand", 3.923, 0.02, 7.8e-3, 228696.0, AQUI, factor=453.592, unidad="lb"))
