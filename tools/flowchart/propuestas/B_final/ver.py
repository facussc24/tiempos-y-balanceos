"""ver.py <clave> [dpi] — rasteriza el PDF A3 de la propuesta B a un PNG en el scratchpad."""
import sys, fitz, os
clave=sys.argv[1]; dpi=int(sys.argv[2]) if len(sys.argv)>2 else 100
pdf=rf'C:\Dev\BarackMercosul\exports\flujogramas_a3_propuestas\B_compacto\FLUJOGRAMA_{clave}_A3.pdf'
out=rf'C:\Users\FACUND~1\AppData\Local\Temp\claude\C--Dev-BarackMercosul\f14f5aae-366c-4b18-89dd-14c15ab3fd8c\scratchpad\v_{clave}.png'
d=fitz.open(pdf); p=d[0]; pm=p.get_pixmap(dpi=dpi); pm.save(out); print(len(d),'pag',p.rect, pm.width,pm.height,out)
