# -*- coding: utf-8 -*-
from PIL import Image
import os
D = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
     r"\Hojas de proceso maquina HOTMELT - desde los videos\_trabajo\fotos_hoja")
nombres = ["h02_a_panel_glsc","h02_b_panel_glsc2","h02_e_hmi_pegamento","h05_c_rodillo_pegamento"]
W = 460
ims = [Image.open(os.path.join(D, n + ".jpg")).convert("RGB") for n in nombres]
ims = [i.resize((W, int(i.height*W/i.width)), Image.LANCZOS) for i in ims]
h = max(i.height for i in ims)
hoja = Image.new("RGB", (W*len(ims)+10*(len(ims)+1), h+40), "white")
from PIL import ImageDraw
d = ImageDraw.Draw(hoja)
for k,(n,i) in enumerate(zip(nombres, ims)):
    x = 10 + k*(W+10)
    hoja.paste(i, (x, 30))
    d.text((x, 8), n, fill="black")
hoja.save("_cand4.jpg", quality=85)
print("ok", hoja.size)
