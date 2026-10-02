# -*- coding: utf-8 -*-
"""Exporta cada hoja de un PowerPoint a PNG (para mirarlo antes de entregar) y, con --pdf, tambien el PDF.
Uso: python scripts/hilos/pptx_a_png.py <archivo.pptx> <carpeta de salida> [--pdf <salida.pdf>]"""
import os
import sys

import win32com.client

pptx, carpeta = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
os.makedirs(carpeta, exist_ok=True)
pp = win32com.client.DispatchEx('PowerPoint.Application')
try:
    pres = pp.Presentations.Open(pptx, True, False, False)   # solo lectura, sin ventana
    pres.Export(carpeta, 'PNG', 1600, 900)
    if '--pdf' in sys.argv:
        pres.SaveAs(os.path.abspath(sys.argv[sys.argv.index('--pdf') + 1]), 32)
    n = pres.Slides.Count
    pres.Close()
finally:
    pp.Quit()
print('OK', n, 'hojas en', carpeta)
