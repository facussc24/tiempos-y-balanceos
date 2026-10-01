# -*- coding: utf-8 -*-
"""Hoja de respaldo (interna) de los usos por pieza del Insert: tabla + capturas de las dos fuentes.
Uso: python scripts/lamina_proceso/insert_patagonia_respaldo.py <salida.pdf> <carpeta de datos>"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.abspath(sys.argv[2])  # carpeta de datos de la lamina
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
EXPORT = os.path.join(REPO, ".arb-cache", "RELACIONES_20261001_post-microfibra-ut.TXT")
W, H = 3308, 2339  # A4 apaisado a 283 dpi aprox (A3 a 200)
AZUL = (0, 78, 152)
OSC = (11, 37, 69)
GRIS = (90, 102, 114)
F = "C:/Windows/Fonts/"


def f(t, n="segoeui.ttf"):
    return ImageFont.truetype(F + n, t)


im = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(im)
d.text((110, 90), "Usos por pieza  ·  Insert Patagonia", font=f(78, "seguisb.ttf"), fill=AZUL)
d.text((110, 196), "Respaldo de los valores de la lámina de proceso", font=f(40), fill=GRIS)
d.rectangle([110, 262, W - 110, 268], fill=AZUL)

# ---- tabla
filas = [
    ("Material", "Paso", "Delantero", "Trasero", "Unidad", "Fuente"),
    ("Vinilo", "1", "0,179", "0,170", "m²", "arb: 0,128 y 0,1213 m lineales, rollo de 1,40 m  ·  planilla USOS: 0,1792 y 0,1699 m²"),
    ("Hilo unión", "2", "0,544", "0,544", "g", "arb: 0,000544 kg"),
    ("Hilo vista", "2", "0,351", "0,351", "g", "arb: 0,000351 kg"),
    ("Adhesivo", "3 y 8", "0,050", "0,050", "L", "arb: 0,05 L"),
    ("Reticulante", "3 y 8", "0,002", "0,002", "L", "arb: 0,002 L"),
    ("Plástico", "4", "0,265", "0,265", "kg", "arb: 0,265 kg en el Insert inyectado (INY-INS0001 a 0004)"),
    ("Espuma 3 mm", "5", "0,101", "0,094", "m²", "planilla USOS: 0,1009 y 0,0939 m²  ·  arb: 0,0106 y 0,00986 kg"),
    ("Cinta adhesiva", "5", "0,101", "0,101", "m²", "arb: 0,101 m² (el mismo valor en delantero y trasero)"),
    ("Grampas", "10", "36", "23", "unidades", "arb: 36 y 23"),
]
cols = [110, 520, 720, 960, 1180, 1420]
y = 320
fh = 74
for i, fila in enumerate(filas):
    if i == 0:
        d.rectangle([110, y, W - 110, y + fh], fill=AZUL)
    elif i % 2 == 0:
        d.rectangle([110, y, W - 110, y + fh], fill=(240, 244, 249))
    for x, t in zip(cols, fila):
        d.text((x + 18, y + 14), t, font=f(36, "seguisb.ttf" if i == 0 else "segoeui.ttf"),
               fill="white" if i == 0 else OSC)
    y += fh
d.rectangle([110, 320, W - 110, y], outline=(200, 208, 218), width=2)

# ---- captura 1: planilla USOS
y += 60
d.text((110, y), "Planilla de usos del legajo", font=f(40, "seguisb.ttf"), fill=AZUL)
cap = Image.open(os.path.join(AQUI, "usos", "captura_usos.png")).convert("RGB")
ancho = W - 220
cap = cap.resize((ancho, int(cap.height * ancho / cap.width)), Image.LANCZOS)
y1 = y + 66
im.paste(cap, (110, y1))
d.rectangle([110, y1, 110 + cap.width, y1 + cap.height], outline=(200, 208, 218), width=2)
pie1 = y1 + cap.height + 14
d.text((110, pie1), "USOS PATAGONIA 23-12-25.xlsx  ·  23/12/2025", font=f(28), fill=GRIS)
d.text((110, pie1 + 38), "PPAP CLIENTES\\NOVAX\\Tapizadas puerta\\13-Especificaciones de Ingenieria F\\02 -Computo Tizada de Corte- Consumo de Materiales\\USOS",
       font=f(22), fill=GRIS)

# ---- hoja 2: renglones del arb
im2 = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(im2)
d.text((110, 90), "Usos por pieza  ·  Insert Patagonia", font=f(78, "seguisb.ttf"), fill=AZUL)
d.text((110, 196), "Respaldo de los valores de la lámina de proceso", font=f(40), fill=GRIS)
d.rectangle([110, 262, W - 110, 268], fill=AZUL)
x2, y = 110, 330
d.text((x2, y), "Lista de materiales en el arb", font=f(40, "seguisb.ttf"), fill=AZUL)
lineas = []
with open(EXPORT, encoding="latin-1") as fh_:
    for ln in fh_:
        c = ln.rstrip("\r\n").split("\t")
        if c and c[0].strip() in ("N 227", "N 396", "INY-INS0002-V1", "INY-INS0004-V1") and len(c) > 5 and c[2].strip():
            lineas.append("%-15s %-15s %-34s %-5s %s" % (c[0].strip(), c[2].strip(), c[3].strip()[:34], c[4].strip(), c[5].strip()))
mono = f(36, "consola.ttf")
yy = y + 66
alto_caja = len(lineas) * 46 + 40
d.rectangle([x2, yy, W - 110, yy + alto_caja], fill=(248, 249, 251), outline=(200, 208, 218), width=2)
for k, ln in enumerate(lineas):
    d.text((x2 + 24, yy + 20 + k * 46), ln, font=mono, fill=OSC)
d.text((x2, yy + alto_caja + 14), "Export de relaciones del arb  ·  01/10/2026 11:40  ·  N 227 (delantero) y N 396 (trasero)",
       font=f(28), fill=GRIS)
d.text((x2, yy + alto_caja + 56), "Grampas: el arb las lista con la etiqueta CAJ; la cantidad es en unidades por pieza (36 y 23).",
       font=f(28), fill=GRIS)

im.save(sys.argv[1], "PDF", resolution=200.0, quality=92, save_all=True, append_images=[im2],
        title="Usos por pieza - Insert Patagonia", author="Ingeniería - Barack Mercosul")
im.save(os.path.splitext(sys.argv[1])[0] + "_1.png")
im2.save(os.path.splitext(sys.argv[1])[0] + "_2.png")
print("OK", len(lineas), "renglones del arb")
