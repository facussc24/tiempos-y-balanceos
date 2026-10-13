# -*- coding: utf-8 -*-
"""fotos_v3.py — prepara cada foto de las hojas HOTMELT (una por paso) desde su FUENTE.

Cada foto sale de un cuadro de video de la biblioteca, de una foto del celular o de una pagina
del manual del fabricante. Aca se recorta para que el objeto del paso llene la baldosa, se le
pone el recuadro numerado sobre lo que hay que tocar o mirar, y se guarda con la procedencia
ADENTRO del archivo (la misma clave que usa `fotodevideo.py leer`).

    py -3 scripts/hotmelt/fotos_v3.py            # arma todas las de FOTOS
    py -3 scripts/hotmelt/fotos_v3.py e03 l02    # solo esas

La lista FOTOS vive en `fotos_v3_lista.py`: nombre -> fuente, recorte, marcas y que muestra.
"""
import json
import os
import sys

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "..", "..", ".claude", "skills", "hojas-de-proceso", "scripts"))
from fotodevideo import guardar          # noqa: E402
from rotular import rotular, chequear_marcas   # noqa: E402

# Las fotos preparadas no van al repo: quedan al lado de las del deck anterior (fotos_hoja).
DESTINO = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
           r"\Hojas de proceso maquina HOTMELT - desde los videos\_trabajo\fotos_v3")
BIB =(r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General"
       r"\INGENIERIA BARACK (NUNCA BORRAR)\5- VIDEOS Y FOTOS\1- CLIENTES\NOVAX\TOP ROLL\MAQUINA HOTMELT")
CUADROS = os.path.join(BIB, ".claude", "fotogramas de cada video")
MANUAL = (r"C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General"
          r"\INGENIERIA BARACK (NUNCA BORRAR)\4- MANUALES\MAQUINA HOTMELT"
          r"\Operation Manual of roll coating machine_en.pdf")
FOTOS_HOJA = (r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop"
              r"\Hojas de proceso maquina HOTMELT - desde los videos\_trabajo\fotos_hoja")


def cuadro(video, n):
    """Ruta de un cuadro de la biblioteca: cuadro('9527', 356) o cuadro('0836', 3)."""
    carpeta = os.path.join(CUADROS, video)
    for patron in (f"{video}_{int(n):04d}.jpg", f"{video}_{int(n):02d}.jpg"):
        p = os.path.join(carpeta, patron)
        if os.path.exists(p):
            return p
    raise FileNotFoundError(f"no existe el cuadro {n} del video {video} en {carpeta}")


def pagina_manual(n, dpi=200):
    """Renderiza la pagina n del manual del fabricante y devuelve la imagen."""
    import fitz
    doc = fitz.open(MANUAL)
    pix = doc[n - 1].get_pixmap(dpi=dpi)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def abrir(fuente):
    """fuente = ruta de imagen, o ('manual', pagina)."""
    if isinstance(fuente, tuple) and fuente[0] == "manual":
        return pagina_manual(fuente[1]), f"manual del fabricante, pagina {fuente[1]}"
    if fuente.lower().endswith((".heic", ".heif")):
        import pillow_heif
        pillow_heif.register_heif_opener()
    from PIL import ImageOps
    im = ImageOps.exif_transpose(Image.open(fuente)).convert("RGB")
    return im, os.path.basename(fuente)


def _poner_nombres(im, marcas):
    """Escribe el NOMBRE de cada marca sobre la foto, en un cartel blanco de borde rojo unido al recuadro por
    una flecha. Fak, 13/10/2026: "falta la flechita que diga acumulador... no sirve que pongas acumulador abajo
    porque en la foto se ven mas flechas, es confuso". El pie solo no alcanza."""
    from PIL import ImageDraw, ImageFont
    rojo = (200, 0, 0)
    W, H = im.size
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", max(16, W // 11))
    g = max(3, W // 110)
    for x, y, w, h, texto in marcas:
        if not texto:
            continue
        bx0, by0, bx1, by1 = W * x / 100, H * y / 100, W * (x + w) / 100, H * (y + h) / 100
        tb = d.textbbox((0, 0), texto, font=f)
        tw, th = tb[2] - tb[0] + 4 * g, tb[3] - tb[1] + 4 * g
        cx = min(max((bx0 + bx1) / 2, tw / 2 + g), W - tw / 2 - g)
        sep = max(H * 0.07, 3 * g)
        arriba = by0 - sep - th > g          # el cartel va arriba del recuadro si entra; si no, abajo
        ty = by0 - sep - th if arriba else by1 + sep
        caja = (cx - tw / 2, ty, cx + tw / 2, ty + th)
        # la flecha: del cartel al borde del recuadro, con su punta
        px, py = cx, (by0 if arriba else by1)
        ox, oy = cx, (caja[3] if arriba else caja[1])
        d.line((ox, oy, px, py), fill=rojo, width=g)
        s = 3 * g * (1 if arriba else -1)
        d.polygon([(px, py), (px - 2 * g, py - s), (px + 2 * g, py - s)], fill=rojo)
        d.rectangle(caja, fill="white", outline=rojo, width=g)
        d.text((caja[0] + 2 * g - tb[0], caja[1] + 2 * g - tb[1]), texto, font=f, fill=rojo)
    return im


def preparar(nombre, fuente, crop=None, rot=0, marcas=None, nota="", ancho=1500, lisa_ok=(), nombres=False):
    im, de_donde = abrir(fuente)
    if rot:
        im = im.rotate(-rot, expand=True)       # rot en sentido horario, como el telefono
    if crop:
        x0, y0, x1, y1 = crop
        W, H = im.size
        im = im.crop((int(W * x0 / 100), int(H * y0 / 100), int(W * x1 / 100), int(H * y1 / 100)))
    if im.width < ancho * 0.45:
        print(f"  ⚠ {nombre}: el recorte mide {im.width} px de ancho; impreso puede verse blando")
    origen = json.dumps({"fuente": de_donde, "rot": rot, "crop": list(crop) if crop else "",
                         "marcas": [list(m[:4]) for m in (marcas or [])], "nota": nota}, ensure_ascii=False)
    os.makedirs(DESTINO, exist_ok=True)
    dst = os.path.join(DESTINO, nombre + ".jpg")
    tmp = os.path.join(DESTINO, "_" + nombre + "_sinmarca.jpg")
    guardar(im, tmp, origen)
    if marcas:
        m5 = [(m[0], m[1], m[2], m[3], m[4] if len(m) > 4 else "") for m in marcas]
        malas = chequear_marcas(tmp, m5, set(lisa_ok))
        if malas:
            os.remove(tmp)
            raise SystemExit(f"{nombre}: marcas mal puestas: {malas}")
        im = rotular(tmp, m5, "ninguna", min(ancho, im.width), None, numeros=True,
                     grosor=max(5, min(ancho, im.width) // 180))
        if nombres:
            im = _poner_nombres(im, m5)
    elif im.width > ancho:
        im = im.resize((ancho, round(im.height * ancho / im.width)), Image.LANCZOS)
    guardar(im, dst, origen)
    os.remove(tmp)
    return dst


def ruta(nombre):
    return os.path.join(DESTINO, nombre + ".jpg")


if __name__ == "__main__":
    from fotos_v3_lista import FOTOS
    pedidas = sys.argv[1:]
    hechas = 0
    for nombre, f in FOTOS.items():
        if pedidas and nombre not in pedidas:
            continue
        preparar(nombre, f["fuente"], crop=f.get("crop"), rot=f.get("rot", 0), marcas=f.get("marcas"),
                 nota=f.get("nota", ""), lisa_ok=f.get("lisa_ok", ()), nombres=f.get("nombres", False))
        hechas += 1
        print("ok", nombre)
    print(hechas, "fotos en", DESTINO)
