# -*- coding: utf-8 -*-
"""Cada pantalla redibujada lleva ADENTRO el tamaño de su tipografía.

Por que: lo que decide si una pantalla se lee impresa no es su tamaño en pixeles, es el
cuerpo que le queda en centimetros dentro de la hoja. Eso solo se puede calcular sabiendo
cuantos pixeles mide su tipografia y cuantos mide la imagen de ancho.

El dato viaja en un chunk de texto del propio PNG, no en un archivo al lado, porque el
chequeo lee las imagenes YA EMBEBIDAS en el pptx, donde no hay nombre de archivo que
seguir. python-pptx guarda los bytes tal cual, asi que el chunk sobrevive.

    guardar(im, "_pantalla_fusor.png", cuerpo_px=28)
    ...
    print(cuerpo_impreso_pt(blob, ancho_cm=5.2))   ->  3.7
"""
import io
import json

from PIL import Image
from PIL.PngImagePlugin import PngInfo

CLAVE = "hoja_proceso"
# lo mas chico que Barack pone en una hoja de operaciones son las referencias de EPP, a 7 pt.
CUERPO_MINIMO_PT = 7.0
PT_CM = 0.0352778


def guardar(im, destino, cuerpo_px, que_es=""):
    """Guarda el PNG con su metrica adentro. `cuerpo_px` = alto de la tipografia de los
    VALORES (no la de los titulos): es la que el operario tiene que poder leer."""
    meta = PngInfo()
    meta.add_text(CLAVE, json.dumps({"cuerpo_px": int(cuerpo_px),
                                     "ancho_px": int(im.width),
                                     "que_es": que_es}))
    im.save(destino, pnginfo=meta)
    return destino, im.size


def metrica(blob_o_ruta):
    """Devuelve el dict de metrica de una imagen, o None si no la lleva (una foto normal)."""
    try:
        im = (Image.open(io.BytesIO(blob_o_ruta)) if isinstance(blob_o_ruta, (bytes, bytearray))
              else Image.open(blob_o_ruta))
        txt = (im.text or {}).get(CLAVE)
        return json.loads(txt) if txt else None
    except Exception:
        return None


def cuerpo_impreso_pt(blob_o_ruta, ancho_cm):
    """Cuerpo en puntos que va a tener esa pantalla impresa a `ancho_cm` de ancho."""
    m = metrica(blob_o_ruta)
    if not m or not m.get("ancho_px"):
        return None
    return m["cuerpo_px"] / m["ancho_px"] * ancho_cm / PT_CM


def ancho_minimo_cm(cuerpo_px, ancho_px, minimo_pt=CUERPO_MINIMO_PT):
    """Cuantos cm de ancho necesita esa imagen para llegar al cuerpo minimo legible."""
    return minimo_pt * PT_CM * ancho_px / cuerpo_px
