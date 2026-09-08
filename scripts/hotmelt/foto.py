# Prepara una FOTO para una hoja de proceso a partir de un frame de video.
#   foto.py <IMG> <segundo> --out <nombre> [--crop x0,y0,x1,y1 en %] [--rot 90]
# Recorta, endereza, sube un poco el contraste y afila. Sale a _trabajo\fotos_hoja\
import os, sys, glob
from PIL import Image, ImageEnhance, ImageFilter

TAR = r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\Hojas de proceso maquina HOTMELT - desde los videos"
FRM = os.path.join(TAR, "frames")
OUT = os.path.join(TAR, "_trabajo", "fotos_hoja")
os.makedirs(OUT, exist_ok=True)


def preparar(vid, seg, nombre, crop=None, rot=0, ancho=1400):
    idx = int(round(seg / 2)) + 1
    cands = sorted(glob.glob(os.path.join(FRM, vid, "*.jpg")))
    if not cands:
        raise SystemExit(f"sin frames para {vid}")
    # el frame mas cercano al segundo pedido
    def d(f):
        return abs(int(os.path.basename(f).split("_")[1].split(".")[0]) - idx)
    f = min(cands, key=d)
    im = Image.open(f).convert("RGB")
    if crop:
        w, h = im.size
        im = im.crop((int(crop[0] / 100 * w), int(crop[1] / 100 * h),
                      int(crop[2] / 100 * w), int(crop[3] / 100 * h)))
    if rot:
        im = im.rotate(-rot, expand=True)
    if im.width > ancho:
        im = im.resize((ancho, round(ancho * im.height / im.width)), Image.LANCZOS)
    im = ImageEnhance.Contrast(im).enhance(1.06)
    im = ImageEnhance.Color(im).enhance(1.04)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=95, threshold=3))
    dst = os.path.join(OUT, f"{nombre}.jpg")
    im.save(dst, quality=92)
    return dst, im.size


if __name__ == "__main__":
    vid, seg = sys.argv[1], float(sys.argv[2])
    nombre, crop, rot = f"{vid}_{int(seg)}", None, 0
    for i, a in enumerate(sys.argv):
        if a == "--out": nombre = sys.argv[i + 1]
        if a == "--crop": crop = [float(x) for x in sys.argv[i + 1].split(",")]
        if a == "--rot": rot = int(sys.argv[i + 1])
    print(*preparar(vid, seg, nombre, crop, rot))
