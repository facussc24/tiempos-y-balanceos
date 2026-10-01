# -*- coding: utf-8 -*-
"""Captura de un rango de una planilla como imagen, con Excel (instancia propia, solo lectura).
Se le pasa una COPIA local, nunca el original del servidor.
Uso: python scripts/lamina_proceso/captura_planilla.py <copia.xlsx> <rango, p.ej. A1:I14> <salida.png>"""
import os
import time

import win32com.client

import sys

xlsx, rango, png = os.path.abspath(sys.argv[1]), sys.argv[2], os.path.abspath(sys.argv[3])

xl = win32com.client.DispatchEx("Excel.Application")  # instancia propia: no toca lo que Fak tenga abierto
xl.Visible = False
xl.DisplayAlerts = False
try:
    wb = xl.Workbooks.Open(xlsx, ReadOnly=True, UpdateLinks=0)
    ws = wb.Worksheets(1)
    rng = ws.Range(rango)
    rng.CopyPicture(1, -4147)  # como en pantalla, vectorial (se puede agrandar sin perder)
    k = 3.0
    co = ws.ChartObjects().Add(0, 0, rng.Width * k, rng.Height * k)
    co.Activate()
    time.sleep(0.5)
    co.Chart.Paste()
    sh = co.Chart.Shapes(1)
    sh.LockAspectRatio = True
    sh.Left, sh.Top = 0, 0
    sh.Width = rng.Width * k
    co.Chart.Export(png)
    co.Delete()
    wb.Close(False)
finally:
    xl.Quit()
print("OK", png)
