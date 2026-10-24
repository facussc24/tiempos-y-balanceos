# -*- coding: utf-8 -*-
"""Ejercicio 25 del banco de CATIA (cola del 24/10/2026): Too Tall Toby 01-06 Bearing Jig en CATIA, con la geometria del ej36_bearing_jig de la practica
del 19/10 copiado SIN cambios (ej36_bearing_jig.py, croquis.py y sus contornos en ej36_bearing_jig/; el gemelo de build123d de la practica en
ej36_bearing_jig/gemelo.py). Lo corre scripts/catia/practica_en_juez.py dentro del juez (con_bien=False).
Papel: guia de build123d, Too Tall Toby (https://build123d.readthedocs.io/en/stable/tttt.html, plano 01-06 Bearing Jig, libre para uso
educativo): 328,02 g (la guia tolera 1 g; aca 0,1 g, como el 23). Densidad 7.8e-3 g/mm3 (acero 7 800 del rotulo). Gemelo de build123d de la practica: 42053.828 mm3.
ok: ver practica_en_juez.py (masa contra el papel con la tolerancia que da la guia, volumen contra el gemelo, STEP)."""
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun y practica_en_juez
import practica_en_juez as pj  # noqa: E402

if __name__ == "__main__":
    sys.exit(pj.main("25_ttt_bearing_jig", "ej36_bearing_jig", "ej36_bearing_jig", 328.02, 0.1, 7.8e-3, 42053.828, AQUI))
