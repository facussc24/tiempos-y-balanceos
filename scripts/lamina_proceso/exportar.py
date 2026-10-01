# -*- coding: utf-8 -*-
"""Exporta la lamina: PNG de control y PDF de impresion.  python exportar.py <pptx> <png> [<pdf>]"""
import os
import sys

import win32com.client

pptx, png = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
pdf = os.path.abspath(sys.argv[3]) if len(sys.argv) > 3 else None
pp = win32com.client.Dispatch("PowerPoint.Application")
abiertas = pp.Presentations.Count
pres = pp.Presentations.Open(pptx, True, False, False)
try:
    pres.Slides(1).Export(png, "PNG", 4961, 3508)  # A3 a 300 dpi
    if pdf:
        try:
            # 2 = PDF, 2 = calidad de impresion (no achica las fotos)
            pres.ExportAsFixedFormat(pdf, 2, 2, 0, 1, 1, 0, None, 1, "", False, True, True, True, False)
            print("PDF por ExportAsFixedFormat")
        except Exception as e:  # noqa: BLE001
            print("ExportAsFixedFormat fallo (%s); uso SaveAs" % str(e)[:80])
            pres.SaveAs(pdf, 32)
finally:
    pres.Close()
    if abiertas == 0 and pp.Presentations.Count == 0:
        pp.Quit()
print("OK")
