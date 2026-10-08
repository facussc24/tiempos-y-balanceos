"""
comparar.py [--dpi 60] — una imagen por flujograma con B (FINAL) a la izquierda y D (aire) a la derecha, para mirarlos lado a lado
como los veria alguien impreso. Si D lleva 2 hojas, van las dos juntas a la derecha.
Lee:  exports/flujogramas_a3_propuestas/FINAL/FLUJOGRAMA <n> - ... - A3.pdf     (B)
      exports/flujogramas_a3_propuestas/D_aire/FLUJOGRAMA <n> - ... - A3.pdf     (D)
Escribe: exports/flujogramas_a3_propuestas/D_aire/comparacion/<n>_B_vs_D.png
"""
import fitz, glob, os, re, sys
from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..', '..'))
B = os.path.join(RAIZ, 'exports', 'flujogramas_a3_propuestas', 'FINAL')
D = os.path.join(RAIZ, 'exports', 'flujogramas_a3_propuestas', 'D_aire')
OUT = os.path.join(D, 'comparacion')
os.makedirs(OUT, exist_ok=True)
dpi = int(sys.argv[sys.argv.index('--dpi') + 1]) if '--dpi' in sys.argv else 60


def paginas(pdf):
    d = fitz.open(pdf)
    ims = []
    for p in d:
        pm = p.get_pixmap(dpi=dpi)
        ims.append(Image.frombytes('RGB', (pm.width, pm.height), pm.samples))
    return ims


def fuente(sz):
    for f in ('C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/arialbd.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, sz)
    return ImageFont.load_default()


def buscar(carpeta, num):
    r = [f for f in glob.glob(os.path.join(carpeta, f'FLUJOGRAMA {num} - *.pdf')) if 'PARA_IMPRIMIR' not in f]
    return r[0] if r else None


nums = sorted({re.match(r'FLUJOGRAMA (\d+) - ', os.path.basename(f)).group(1) for f in glob.glob(os.path.join(B, 'FLUJOGRAMA *.pdf')) if 'PARA_IMPRIMIR' not in f})
for num in nums:
    pb, pd = buscar(B, num), buscar(D, num)
    if not pd:
        print(num, 'sin D todavia')
        continue
    ib, idd = paginas(pb), paginas(pd)
    gap, tit = 18, 34
    cols = [('B  compacto (FINAL de ayer)', ib)] + [(f'D  aire  ({len(idd)} hoja{"s" if len(idd) > 1 else ""})', idd)]
    ancho = sum(sum(i.width for i in ims) + gap * (len(ims) - 1) for _, ims in cols) + gap * (len(cols) + 1)
    alto = max(max(i.height for i in ims) for _, ims in cols) + tit + gap * 2
    lienzo = Image.new('RGB', (ancho, alto), (120, 120, 120))
    dr = ImageDraw.Draw(lienzo)
    x = gap
    for nombre, ims in cols:
        dr.text((x, 6), nombre, fill=(255, 255, 255), font=fuente(20))
        for im in ims:
            lienzo.paste(im, (x, tit + gap // 2))
            x += im.width + gap
        x += gap - 0
    out = os.path.join(OUT, f'{num}_B_vs_D.png')
    lienzo.save(out, optimize=True)
    print(num, out, lienzo.size)
