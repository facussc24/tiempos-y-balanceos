"""crop.py <pdf> <x0> <y0> <x1> <y1> [dpi] [salida]  — recorte en fracciones de la pagina (0-1)."""
import sys, fitz
pdf=sys.argv[1]; x0,y0,x1,y1=[float(v) for v in sys.argv[2:6]]
dpi=int(sys.argv[6]) if len(sys.argv)>6 else 200
out=sys.argv[7] if len(sys.argv)>7 else r'C:\Users\FACUND~1\AppData\Local\Temp\claude\C--Dev-BarackMercosul\f14f5aae-366c-4b18-89dd-14c15ab3fd8c\scratchpad\crop.png'
d=fitz.open(pdf); p=d[0]; r=p.rect
clip=fitz.Rect(r.x0+x0*r.width, r.y0+y0*r.height, r.x0+x1*r.width, r.y0+y1*r.height)
pm=p.get_pixmap(dpi=dpi, clip=clip); pm.save(out); print(pm.width,pm.height,out)
