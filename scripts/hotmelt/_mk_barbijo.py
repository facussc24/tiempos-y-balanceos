# -*- coding: utf-8 -*-
"""Pictograma ISO 7010 M016 - proteccion respiratoria obligatoria.
No existe en los documentos de Barack (revise 12 instructivos: solo hay ropa,
calzado, guantes, anteojos y auditiva). Se dibuja con el AZUL EXACTO de los
iconos reales (5,65,132) y el mismo diametro, para que no desentone."""
from PIL import Image, ImageDraw

S = 1024
AZUL = (5, 65, 132)
BLANCO = (250, 250, 250)
im = Image.new("RGB", (S, S), (255, 255, 255))
d = ImageDraw.Draw(im)
d.ellipse([12, 12, S-12, S-12], fill=AZUL)

cx = S // 2
# --- cabeza: contorno blanco (mismo criterio que el icono de anteojos) -------
d.ellipse([cx-268, 190, cx+268, 806], outline=BLANCO, width=30)
# pelo
d.pieslice([cx-268, 190, cx+268, 806], 190, 350, fill=BLANCO)
d.rectangle([cx-268, 190, cx+268, 300], fill=AZUL)
d.pieslice([cx-262, 196, cx+262, 800], 185, 355, fill=BLANCO)
d.ellipse([cx-268, 190, cx+268, 806], outline=BLANCO, width=30)

# --- ojos (para que se lea que es una cara y no una mancha) ------------------
d.ellipse([cx-140, 400, cx-72, 452], fill=BLANCO)
d.ellipse([cx+72, 400, cx+140, 452], fill=BLANCO)

# --- barbijo: cuerpo -------------------------------------------------------
cuerpo = [(cx-232, 520), (cx-206, 690), (cx-120, 782), (cx, 800),
          (cx+120, 782), (cx+206, 690), (cx+232, 520)]
d.polygon(cuerpo, fill=BLANCO)
# pliegues (lineas azules horizontales)
for y in (592, 660):
    d.line([(cx-216, y), (cx+216, y)], fill=AZUL, width=16)

# --- tiras a las orejas ----------------------------------------------------
d.line([(cx-228, 536), (cx-330, 452)], fill=BLANCO, width=30)
d.line([(cx+228, 536), (cx+330, 452)], fill=BLANCO, width=30)

im = im.resize((143, 143), Image.LANCZOS)
im.save("epp/ico_barbijo.png")
print("epp/ico_barbijo.png", im.size)

# contacto contra los que ya existen, para ver si pega el estilo
from PIL import Image as I
ns = ["ico_13756", "ico_16034", "ico_barbijo", "ico_11789", "ico_4449"]
W = 260
o = I.new("RGB", (W*len(ns)+10*(len(ns)+1), W+30), "white")
dd = ImageDraw.Draw(o)
for k, n in enumerate(ns):
    x = I.open(f"epp/{n}.png").convert("RGBA")
    bg = I.new("RGBA", x.size, (255,255,255,255)); bg.alpha_composite(x)
    o.paste(bg.convert("RGB").resize((W, W), I.LANCZOS), (10+k*(W+10), 25))
    dd.text((10+k*(W+10), 6), n, fill="black")
o.save("_epp3.jpg", quality=95)
print(o.size)
