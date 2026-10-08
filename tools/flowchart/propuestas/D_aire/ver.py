"""ver.py <pdf> <salida.png> [dpi=60] [pagina=1] [x0 y0 x1 y1 en fracciones 0-1] — rasteriza una pagina (o un recorte) de un PDF."""
import sys, fitz
pdf, out = sys.argv[1], sys.argv[2]
dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 60
pag = int(sys.argv[4]) if len(sys.argv) > 4 else 1
d = fitz.open(pdf)
p = d[pag - 1]
clip = None
if len(sys.argv) > 8:
    x0, y0, x1, y1 = [float(v) for v in sys.argv[5:9]]
    r = p.rect
    clip = fitz.Rect(r.x0 + x0 * r.width, r.y0 + y0 * r.height, r.x0 + x1 * r.width, r.y0 + y1 * r.height)
pm = p.get_pixmap(dpi=dpi, clip=clip)
pm.save(out)
print(len(d), 'pag', pm.width, 'x', pm.height, out)
