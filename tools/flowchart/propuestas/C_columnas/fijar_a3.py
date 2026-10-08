# -*- coding: utf-8 -*-
"""fijar_a3.py — Chromium redondea la hoja (1191,12 x 841,92 pt = 420,2 x 297,0 mm). Se la lleva a A3 exacta
(420 x 297 mm = 1190,55 x 841,89 pt) recortando 0,6 pt de aire en blanco del borde derecho/inferior.
Uso: python fijar_a3.py <pdf>"""
import sys, os, fitz

W, H = 1190.551, 841.890
src = sys.argv[1]
doc = fitz.open(src)
for page in doc:
    mb = page.mediabox                      # coordenadas PDF (origen abajo a la izquierda)
    nuevo = fitz.Rect(mb.x0, mb.y1 - H, mb.x0 + W, mb.y1)
    page.set_mediabox(nuevo)
    page.set_cropbox(fitz.Rect(0, 0, W, H))      # el cropbox se da en coordenadas de pagina (origen arriba a la izquierda)
tmp = src + '.tmp'
doc.save(tmp, garbage=3, deflate=True)
doc.close()
os.replace(tmp, src)
