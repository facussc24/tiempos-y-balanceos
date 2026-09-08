# -*- coding: utf-8 -*-
"""Recorta una foto a la PANTALLA y le marca los campos con recuadro + flecha + rotulo.

  anotar.py <video> <segundo> --out <nombre> [--crop x0,y0,x1,y1 en % del frame]
            --marca "bx,by,bw,bh|lx,ly|texto"  [--marca ...]

  bx,by,bw,bh  recuadro rojo sobre el campo, en % de la foto YA RECORTADA
  lx,ly        donde arranca el rotulo (esquina sup. izq.), en % de la misma foto
  texto        rotulo corto; se parte en dos lineas con "\n"

Se usa solo donde el paso obliga a LEER la pantalla (Fak, 03/09: "solo cuando si o si
necesites ver en la imagen de la hoja de operaciones bien la pantalla").
"""
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter
import os, sys, glob, math

FRM = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
       r"\Hojas de proceso maquina HOTMELT - desde los videos\frames")
OUT = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
       r"\Hojas de proceso maquina HOTMELT - desde los videos\_trabajo\fotos_hoja")
ROJO = (200, 0, 0)
BLANCO = (255, 255, 255)
NEGRO = (25, 25, 25)


def _fuente(px):
    for n in ("calibrib.ttf", "arialbd.ttf", "segoeuib.ttf"):
        p = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", n)
        if os.path.exists(p):
            return ImageFont.truetype(p, px)
    return ImageFont.load_default()


def flecha(d, x0, y0, x1, y1, color, w):
    d.line([(x0, y0), (x1, y1)], fill=color, width=w)
    ang = math.atan2(y1 - y0, x1 - x0)
    L = w * 4.0
    for s in (2.6, -2.6):
        d.line([(x1, y1), (x1 - L * math.cos(ang + s / 3.6), y1 - L * math.sin(ang + s / 3.6))],
               fill=color, width=w)


def main():
    vid, seg = sys.argv[1], float(sys.argv[2])
    nombre, crop, marcas, ancho = None, None, [], 1500
    for i, a in enumerate(sys.argv):
        if a == "--out":   nombre = sys.argv[i + 1]
        if a == "--crop":  crop = [float(x) for x in sys.argv[i + 1].split(",")]
        if a == "--marca": marcas.append(sys.argv[i + 1])
        if a == "--ancho": ancho = int(sys.argv[i + 1])

    idx = int(round(seg / 2)) + 1
    for i, a in enumerate(sys.argv):
        if a == '--frame':
            idx = int(sys.argv[i + 1])   # 9527: son keyframes, no cada 2 s
    cands = sorted(glob.glob(os.path.join(FRM, vid, "*.jpg")))
    f = min(cands, key=lambda p: abs(int(os.path.basename(p).split("_")[1].split(".")[0]) - idx))
    im = Image.open(f).convert("RGB")
    if crop:
        w, h = im.size
        im = im.crop((int(crop[0] / 100 * w), int(crop[1] / 100 * h),
                      int(crop[2] / 100 * w), int(crop[3] / 100 * h)))
    if im.width != ancho:
        im = im.resize((ancho, round(ancho * im.height / im.width)), Image.LANCZOS)
    im = ImageEnhance.Contrast(im).enhance(1.10)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.8, percent=120, threshold=3))

    W, H = im.size
    d = ImageDraw.Draw(im)
    gr = max(3, round(W / 300))            # grosor de linea
    # el rotulo se lee a 5 cm de ancho impreso: por eso 1/20 del ancho y no 1/26
    fs = max(18, round(W / 20))            # cuerpo del rotulo
    ft = _fuente(fs)

    for m in marcas:
        caja, rot, texto = m.split("|")
        bx, by, bw, bh = [float(v) for v in caja.split(",")]
        lx, ly = [float(v) for v in rot.split(",")]
        X0, Y0 = bx / 100 * W, by / 100 * H
        X1, Y1 = (bx + bw) / 100 * W, (by + bh) / 100 * H
        d.rectangle([X0, Y0, X1, Y1], outline=ROJO, width=gr)

        lineas = texto.split(chr(126))
        anchos = [d.textlength(t, font=ft) for t in lineas]
        tw, th = max(anchos) + fs * 0.7, len(lineas) * fs * 1.22 + fs * 0.45
        LX, LY = lx / 100 * W, ly / 100 * H
        LX = min(max(LX, 4), W - tw - 4)
        LY = min(max(LY, 4), H - th - 4)
        # flecha desde el borde del rotulo hasta el borde del recuadro
        cx, cy = (X0 + X1) / 2, (Y0 + Y1) / 2
        ox, oy = LX + tw / 2, LY + th / 2
        dx, dy = cx - ox, cy - oy
        n = max(1e-6, math.hypot(dx, dy))
        px, py = ox + dx / n * (tw / 2 + 6), oy + dy / n * (th / 2 + 6)
        qx, qy = cx - dx / n * ((X1 - X0) / 2 + 6), cy - dy / n * ((Y1 - Y0) / 2 + 6)
        flecha(d, px, py, qx, qy, ROJO, gr)
        d.rectangle([LX, LY, LX + tw, LY + th], fill=BLANCO, outline=ROJO, width=gr)
        for k, t in enumerate(lineas):
            d.text((LX + fs * 0.35, LY + fs * 0.22 + k * fs * 1.22), t, font=ft, fill=NEGRO)

    dst = os.path.join(OUT, nombre + ".jpg")
    im.save(dst, quality=93)
    print(dst, im.size, f"({len(marcas)} marcas)")


main()
