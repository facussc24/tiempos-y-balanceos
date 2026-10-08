# -*- coding: utf-8 -*-
"""comparar_pdf_png.py — el PDF (lo que se imprime) tiene que ser igual a la vista previa (lo que mire en pantalla).
Rasteriza cada hoja del PDF con PyMuPDF a la misma escala que la vista previa y mide cuanto difieren, despues de
achicar 4x (las diferencias de suavizado de letra no cuentan; un nodo corrido o un texto cortado si).
Uso: python comparar_pdf_png.py <clave> [<carpeta para dejar los rasters>]"""
import sys, os
import fitz
from PIL import Image, ImageChops

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
SAL = os.path.join(RAIZ, 'exports', 'flujogramas_a3_propuestas', 'C_columnas')
clave = sys.argv[1]
destino = sys.argv[2] if len(sys.argv) > 2 else None
doc = fitz.open(os.path.join(SAL, f'FLUJOGRAMA_{clave}_C_columnas_A3.pdf'))
peor = 0.0
for i, page in enumerate(doc, 1):
    prev = Image.open(os.path.join(SAL, 'previews', f'{clave}_hoja{i}.png')).convert('L')
    pm = page.get_pixmap(matrix=fitz.Matrix(prev.size[0] / page.rect.width, prev.size[1] / page.rect.height), alpha=False)
    ras = Image.frombytes('RGB', (pm.width, pm.height), pm.samples).convert('L')
    if destino:
        os.makedirs(destino, exist_ok=True)
        ras.save(os.path.join(destino, f'{clave}_pdf_hoja{i}.png'))
    a = prev.resize((prev.size[0] // 4, prev.size[1] // 4), Image.BOX)
    b = ras.resize(a.size, Image.BOX)
    d = ImageChops.difference(a, b)
    px = d.getdata()
    fuerte = sum(1 for v in px if v > 70) / len(px)
    medio = sum(1 for v in px if v > 35) / len(px)
    peor = max(peor, fuerte)
    print(f'  hoja {i}: pixeles con diferencia fuerte {fuerte * 100:.3f}%  (media {medio * 100:.3f}%)  tamaño vista previa {prev.size} PDF raster {ras.size}')
print(f'{clave}: peor hoja {peor * 100:.3f}% de pixeles distintos ->', 'IGUAL' if peor < 0.01 else 'REVISAR')
