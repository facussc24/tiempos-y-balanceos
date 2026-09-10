# -*- coding: utf-8 -*-
"""Exporta los pptx del entregable a PDF de vista previa, como los dias anteriores."""
import os, sys, win32com.client

BASE = r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\Informe TryOut IMG - Dia 5 (02-09)\04- Entregable"
ARCHIVOS = [
    ("TryOut_IMG_Dia1a5.pptx", "_vista previa - TryOut_IMG_Dia1a5.pdf"),
    ("TryOut_IMG_Dia5.pptx", "_vista previa - TryOut_IMG_Dia5.pdf"),
]

app = win32com.client.Dispatch("PowerPoint.Application")
for src, dst in ARCHIVOS:
    p_src, p_dst = os.path.join(BASE, src), os.path.join(BASE, dst)
    pres = app.Presentations.Open(p_src, WithWindow=False)
    pres.SaveAs(p_dst, 32)          # 32 = ppSaveAsPDF
    n = pres.Slides.Count
    pres.Close()
    print("%s -> %s  (%d slides, %d KB)" % (src, dst, n, os.path.getsize(p_dst) // 1024))
app.Quit()
