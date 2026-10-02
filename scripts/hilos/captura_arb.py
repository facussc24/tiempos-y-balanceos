# -*- coding: utf-8 -*-
"""Imagen de la BOM de un producto tal como sale en el export RELACIONES del arb, con los hilos marcados.
Uso: python scripts/hilos/captura_arb.py <codigo del producto> <salida.png>"""
import importlib.util
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('arbRelaciones', os.path.join(AQUI, '..', '_lib', 'arbRelaciones.py'))
AR = importlib.util.module_from_spec(spec)
spec.loader.exec_module(AR)

codigo, png = sys.argv[1], os.path.abspath(sys.argv[2])
rel, sello = AR.cargar()
filas = rel.bom(codigo)
if not filas:
    raise SystemExit('el producto %s no tiene BOM en el export' % codigo)

mono = ImageFont.truetype(r'C:\Windows\Fonts\consola.ttf', 26)
monob = ImageFont.truetype(r'C:\Windows\Fonts\consolab.ttf', 26)
alto = 40
lineas = [('Artículo         Medida              Descripción                               Unidad  Consumo', True, False)]
for f in filas:
    es_hilo = bool(re.search(r'^(FX|BX|GM)\d', f.codigo))
    lineas.append(('%-16s %-19s %-41s %-7s %s' % (f.raiz[:16], f.codigo[:19], f.desc[:41], f.unidad, f.consumo), False, es_hilo))
ancho = int(max(mono.getlength(t) for t, _, _ in lineas)) + 40
im = Image.new('RGB', (ancho, alto * len(lineas) + 20), 'white')
d = ImageDraw.Draw(im)
for i, (t, negrita, hilo) in enumerate(lineas):
    y = 10 + i * alto
    if hilo:
        d.rectangle([8, y - 2, ancho - 8, y + alto - 6], outline=(198, 40, 40), width=3)
    d.text((20, y + 2), t, font=monob if negrita else mono, fill=(20, 20, 20))
im.save(png)
print('OK', png, '-', os.path.basename(sello.ruta), sello.export_dt.strftime('%d/%m/%Y %H:%M'))
