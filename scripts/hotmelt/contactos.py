# Hoja de contacto por video: N frames repartidos, con el segundo escrito encima.
import os, glob, sys
from PIL import Image, ImageDraw

TAR = r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\Hojas de proceso maquina HOTMELT - desde los videos"
FRM = os.path.join(TAR, "frames")
OUT = os.path.join(TAR, "_trabajo", "contactos")
os.makedirs(OUT, exist_ok=True)

COLS, W = 5, 420   # 5 columnas, 420 px de ancho por miniatura

for d in sorted(os.listdir(FRM)):
    dd = os.path.join(FRM, d)
    if not os.path.isdir(dd): continue
    dst = os.path.join(OUT, f"{d}.jpg")
    if os.path.exists(dst) and "--force" not in sys.argv: continue
    fs = sorted(glob.glob(os.path.join(dd, "*.jpg")))
    if not fs: continue
    n = min(15, len(fs))
    idx = [round(i * (len(fs) - 1) / max(n - 1, 1)) for i in range(n)]
    sel = [fs[i] for i in idx]
    im0 = Image.open(sel[0]); H = round(W * im0.height / im0.width)
    rows = (len(sel) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * W, rows * H), "black")
    dr = ImageDraw.Draw(sheet)
    for k, f in enumerate(sel):
        im = Image.open(f).convert("RGB").resize((W, H))
        x, y = (k % COLS) * W, (k // COLS) * H
        sheet.paste(im, (x, y))
        seg = (int(os.path.basename(f).split("_")[1].split(".")[0]) - 1) * 2   # 1 frame / 2 s
        t = f"{seg//60:d}:{seg%60:02d}"
        dr.rectangle([x + 2, y + 2, x + 78, y + 30], fill="black")
        dr.text((x + 8, y + 8), t, fill="yellow")
    sheet.save(dst, quality=80)
    print(f"{d}: {len(fs)} frames -> {n} en la hoja", flush=True)
print("LISTO", flush=True)
