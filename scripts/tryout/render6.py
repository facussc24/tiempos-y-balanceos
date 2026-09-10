# -*- coding: utf-8 -*-
"""Render de control del Dia 6 a 1920x1080 (el juez es PowerPoint, no python-pptx).

`SaveCopyAs(..., 18)` exporta a 1280x720 y a ese tamaño se pierden los acentos: para mirar
el deck se usa `Slide.Export(path, "PNG", 1920, 1080)`.

    py scripts/tryout/render6.py [carpeta_destino]

OJO con el destino: PowerPoint no escribe en una ruta con nombre corto 8.3 (FACUND~1) —
devuelve "PowerPoint no puede guardar ^0 en ^1". Hay que pasarle la ruta larga.
"""
import os, sys, traceback
import win32com.client

OUT = (sys.argv[1] if len(sys.argv) > 1 else
       os.path.join(os.environ.get("TEMP", "."), "tryout_png_dia6"))
ENT = (r"Y:\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\NOVAX\Tapizadas puerta"
       r"\28- Corrida de Produccion\01- TryOut\T0 IMG BARACK\T0 Dia 6 08-09-2026")

TRABAJOS = [("TryOut_IMG_Dia1a6.pptx", "ES", range(46, 55)),        # las 9 laminas nuevas
            ("TryOut_IMG_Day1to6_EN.pptx", "EN", range(46, 55))]

os.makedirs(OUT, exist_ok=True)
app = win32com.client.Dispatch("PowerPoint.Application")
for fname, tag, pages in TRABAJOS:
    ruta = os.path.join(ENT, fname)
    try:
        pres = app.Presentations.Open(ruta, ReadOnly=True, WithWindow=False)
    except Exception:
        print("NO ABRE", fname)
        traceback.print_exc()
        continue
    print("abre", fname, pres.Slides.Count, "slides")
    for n in pages:
        if n > pres.Slides.Count:
            continue
        dst = os.path.join(OUT, "%s_%02d.png" % (tag, n))
        pres.Slides(n).Export(dst, "PNG", 1920, 1080)
    pres.Close()
app.Quit()
print("salida: %s" % OUT)
