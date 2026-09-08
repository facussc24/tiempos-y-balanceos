# Busca los frames donde se ve la PANTALLA DEL TRADUCTOR del celular (fondo negro
# con texto blanco) o una PANTALLA DE HMI. Esos son la fuente real del contenido:
# el audio es charla de planta y whisper lo transcribe mal.
import os, glob, sys
from PIL import Image, ImageDraw
import numpy as np

TAR = r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\Hojas de proceso maquina HOTMELT - desde los videos"
FRM = os.path.join(TAR, "frames")
OUT = os.path.join(TAR, "_trabajo", "pantallas")
os.makedirs(OUT, exist_ok=True)

def puntaje(p):
    im = Image.open(p).convert("L").resize((240, 240))
    a = np.asarray(im, dtype=np.float32)
    oscuro = (a < 55).mean()                 # pantalla de celular apagada de fondo
    claro_en_oscuro = ((a > 150)).mean()
    # zona central (el celular suele estar centrado y ocupa buena parte)
    c = a[40:200, 40:200]
    c_osc = (c < 55).mean()
    return oscuro, c_osc, claro_en_oscuro

resumen = {}
for d in sorted(os.listdir(FRM)):
    dd = os.path.join(FRM, d)
    if not os.path.isdir(dd):
        continue
    fs = sorted(glob.glob(os.path.join(dd, "*.jpg")))
    cand = []
    for f in fs:
        osc, c_osc, cl = puntaje(f)
        # traductor: mucho negro en el centro + algo de texto claro adentro
        if c_osc > 0.30 and 0.02 < cl < 0.35:
            cand.append((c_osc, f))
    cand.sort(reverse=True)
    # quedarse con hasta 8, separados en el tiempo
    elegidos, ultimos = [], []
    for sc, f in cand:
        idx = int(os.path.basename(f).split("_")[1].split(".")[0])
        if all(abs(idx - u) > 4 for u in ultimos):
            elegidos.append((idx, f)); ultimos.append(idx)
        if len(elegidos) >= 8:
            break
    resumen[d] = len(elegidos)
    if not elegidos:
        continue
    elegidos.sort()
    W = 700
    im0 = Image.open(elegidos[0][1]); Hh = round(W * im0.height / im0.width)
    cols = min(4, len(elegidos)); filas = (len(elegidos) + cols - 1) // cols
    hoja = Image.new("RGB", (cols * W, filas * Hh), "black")
    dr = ImageDraw.Draw(hoja)
    for k, (idx, f) in enumerate(elegidos):
        hoja.paste(Image.open(f).convert("RGB").resize((W, Hh)), ((k % cols) * W, (k // cols) * Hh))
        seg = (idx - 1) * 2
        dr.rectangle([(k % cols) * W + 2, (k // cols) * Hh + 2,
                      (k % cols) * W + 110, (k // cols) * Hh + 40], fill="black")
        dr.text(((k % cols) * W + 8, (k // cols) * Hh + 10), f"{seg//60}:{seg%60:02d}", fill="yellow")
    hoja.save(os.path.join(OUT, f"{d}.jpg"), quality=88)

for k, v in resumen.items():
    if v:
        print(f"{k}: {v} pantallas")
print("LISTO")
