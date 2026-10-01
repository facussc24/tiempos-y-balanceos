# plancha de contacto: python contacto.py <carpeta> <salida.png> [filtro_excluir]
import sys, glob, os
from PIL import Image, ImageDraw, ImageOps
Image.MAX_IMAGE_PIXELS = None
carp, out = sys.argv[1], sys.argv[2]
excl = sys.argv[3] if len(sys.argv) > 3 else None
fs = sorted(f for f in glob.glob(os.path.join(carp, '*')) if f.lower().endswith(('.jpg', '.jpeg', '.png')) and not (excl and excl in f))
H = 420; cols = 4; pad = 8
ims = []
for f in fs:
    im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
    w, h = im.size
    r = min(560 / w, H / h)
    t = im.resize((int(w * r), int(h * r)))
    c = Image.new('RGB', (560, H + 26), 'white'); c.paste(t, ((560 - t.width) // 2, 26))
    d = ImageDraw.Draw(c); d.text((3, 2), os.path.basename(f)[:70], fill='black'); d.text((3, 13), '%dx%d' % (w, h), fill='red')
    ims.append(c)
rows = (len(ims) + cols - 1) // cols
sh = Image.new('RGB', (cols * (560 + pad), rows * (H + 26 + pad)), '#888')
for i, c in enumerate(ims):
    sh.paste(c, ((i % cols) * (560 + pad), (i // cols) * (H + 26 + pad)))
sh.save(out); print(len(ims), sh.size)
