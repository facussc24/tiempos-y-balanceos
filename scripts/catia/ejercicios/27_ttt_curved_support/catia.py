# -*- coding: utf-8 -*-
"""Ejercicio 27 del banco de CATIA (cola del 24/10/2026): Too Tall Toby 23-T-24 Curved Support en CATIA, con la geometria del ej38_curved_support de la practica
del 19/10 copiado SIN cambios (ej38_curved_support.py, croquis.py y sus contornos en ej38_curved_support/; el gemelo de build123d de la practica en
ej38_curved_support/gemelo.py). Lo corre scripts/catia/practica_en_juez.py dentro del juez (con_bien=False).
Papel: guia de build123d, Too Tall Toby (https://build123d.readthedocs.io/en/stable/tttt.html, plano 23-T-24 Curved Support, libre para uso
educativo): 1 294 g +-3. Densidad 7.8e-3 g/mm3 (acero 7 800 del rotulo). Gemelo de build123d de la practica: 166112.182 mm3.
ok: ver practica_en_juez.py (masa contra el papel, volumen contra el gemelo, STEP). Limite (revisor 24/10): con la tolerancia
de la guia, una falta chica (un redondeo o un chaflan de ~1 g) pasa sin verse; el volumen contra el gemelo la ve solo si
el gemelo la tiene."""
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(AQUI)))      # juez_comun y practica_en_juez
import practica_en_juez as pj  # noqa: E402

if __name__ == "__main__":
    sys.exit(pj.main("27_ttt_curved_support", "ej38_curved_support", "ej38_curved_support", 1294.0, 3.0, 7.8e-3, 166112.182, AQUI,
                     gemelo_cdg=(0.0, 35.9647, 22.8158)))      # centro del gemelo (= el STEP de CATIA 11:22, 24/10)
