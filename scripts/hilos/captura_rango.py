# -*- coding: utf-8 -*-
"""Captura de un rango de una hoja de Excel como imagen (instancia propia de Excel, solo lectura).
Se le pasa una COPIA local, nunca el original del servidor.
Uso: python scripts/hilos/captura_rango.py <copia.xlsx> <hoja> <rango, p.ej. B2:R16> <salida.png>"""
import os
import sys
import time

import win32com.client

xlsx, hoja, rango, png = os.path.abspath(sys.argv[1]), sys.argv[2], sys.argv[3], os.path.abspath(sys.argv[4])

xl = win32com.client.DispatchEx('Excel.Application')  # instancia propia: no toca lo que este abierto
xl.Visible = False
xl.DisplayAlerts = False
try:
    wb = xl.Workbooks.Open(xlsx, ReadOnly=True, UpdateLinks=0)
    ws = wb.Worksheets(hoja)
    rng = ws.Range(rango)
    rng.CopyPicture(1, -4147)  # como en pantalla, vectorial
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
print('OK', png)
