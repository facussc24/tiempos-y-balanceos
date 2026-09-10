# -*- coding: utf-8 -*-
"""Exporta los pptx del Dia 6 a PDF de vista previa, como los dias anteriores."""
import os, sys, win32com.client

ENT = (r"Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\NOVAX\Tapizadas puerta"
       r"\28- Corrida de Produccion\01- TryOut\T0 IMG BARACK\T0 Dia 6 08-09-2026")
ARCHIVOS = [
    ("TryOut_IMG_Dia1a6.pptx", "_vista previa - TryOut_IMG_Dia1a6.pdf"),
    ("TryOut_IMG_Dia6.pptx", "_vista previa - TryOut_IMG_Dia6.pdf"),
    ("TryOut_IMG_Day1to6_EN.pptx", "_vista previa - TryOut_IMG_Day1to6_EN.pdf"),
]

app = win32com.client.Dispatch("PowerPoint.Application")
for src, dst in ARCHIVOS:
    p_src, p_dst = os.path.join(ENT, src), os.path.join(ENT, dst)
    pres = app.Presentations.Open(p_src, WithWindow=False)
    pres.SaveAs(p_dst, 32)          # 32 = ppSaveAsPDF
    n = pres.Slides.Count
    pres.Close()
    print("%s -> %s  (%d slides, %d KB)" % (src, dst, n, os.path.getsize(p_dst) // 1024))
app.Quit()
