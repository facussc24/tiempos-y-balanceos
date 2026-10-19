"""bmp_a_png.py <salida.png> <a.bmp> [b.bmp ...]: une las capturas en una fila (recortando el blanco) y guarda PNG."""
import sys
from PIL import Image, ImageChops

ims = []
for p in sys.argv[2:]:
    im = Image.open(p).convert("RGB")
    fondo = Image.new("RGB", im.size, (255, 255, 255))
    caja = ImageChops.difference(im, fondo).getbbox()
    if caja:
        x0, y0, x1, y1 = caja
        m = 20
        im = im.crop((max(0, x0 - m), max(0, y0 - m), min(im.width, x1 + m), min(im.height, y1 + m)))
    im.thumbnail((700, 700))
    ims.append(im)
w = sum(i.width for i in ims) + 10 * (len(ims) - 1)
h = max(i.height for i in ims)
hoja = Image.new("RGB", (w, h), (255, 255, 255))
x = 0
for i in ims:
    hoja.paste(i, (x, 0))
    x += i.width + 10
hoja.save(sys.argv[1])
