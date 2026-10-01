# PDF A3 a 300 dpi desde el PNG de PowerPoint (el PDF propio de PowerPoint baja las fotos a 200 ppp y las comprime)
import sys
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
im = Image.open(sys.argv[1]).convert("RGB")
im.save(sys.argv[2], "PDF", resolution=300.0, quality=94, subsampling=0,
        title="Proceso de fabricación - Insert Patagonia", author="Ingeniería - Barack Mercosul")
print(im.size)
