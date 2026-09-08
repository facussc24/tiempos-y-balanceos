# -*- coding: utf-8 -*-
"""Busca en los documentos de Barack un pictograma de proteccion RESPIRATORIA."""
import glob, os, zipfile, io, hashlib
from PIL import Image
RAICES = [
 r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL",
]
vistos = {}
salida = "epp_cand"
os.makedirs(salida, exist_ok=True)
n = 0
for raiz in RAICES:
    for ext in ("xlsx", "docx", "pptx"):
        for f in glob.iglob(os.path.join(raiz, "**", f"*.{ext}"), recursive=True):
            bn = os.path.basename(f).lower()
            if not any(k in bn for k in ("instructiv", "io-", "i-in", "epp", "segurid",
                                         "adhesiv", "ho-", "operacion")):
                continue
            try:
                z = zipfile.ZipFile(f)
            except Exception:
                continue
            for m in z.namelist():
                if "/media/" not in m or not m.lower().endswith((".png", ".jpg", ".jpeg", ".emf")):
                    continue
                try:
                    b = z.read(m)
                except Exception:
                    continue
                if not (1500 < len(b) < 400000):
                    continue
                h = hashlib.md5(b).hexdigest()
                if h in vistos:
                    continue
                try:
                    im = Image.open(io.BytesIO(b))
                    w, hh = im.size
                except Exception:
                    continue
                if not (40 <= w <= 400 and 40 <= hh <= 400 and 0.7 < w/hh < 1.4):
                    continue
                vistos[h] = (f, m)
                im.convert("RGB").save(os.path.join(salida, f"c{n:03d}.png"))
                n += 1
            z.close()
print("candidatos:", n, "de", len(set(v[0] for v in vistos.values())), "archivos")
