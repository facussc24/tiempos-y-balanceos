# -*- coding: utf-8 -*-
"""Criterios de imagen de una hoja de proceso: los umbrales, la medicion y el reparto.

Una hoja de operaciones se lee de pie, al lado de la maquina, impresa en A4. Eso impone dos
cosas que ningun repartidor de imagenes sabe solo:

  · **cual imagen manda.** La que el paso obliga a mirar o a leer. Sin declararla, el reparto
    optimiza superficie total y puede dejar la tabla de parametros mas chica que una mano con
    un celular — paso el 03/09/2026 en la hoja 20.2 de la HOTMELT, y lo vio Fak, no yo.
  · **que se lea impreso.** Lo que decide es el cuerpo en CENTIMETROS sobre el papel, no como
    se ve la imagen ampliada en el monitor. Las 7 pantallas que yo daba por buenas median
    entre 2,3 y 4,5 pt; el minimo de la casa es 7.

Esta libreria es la unica fuente de esos numeros. La usan el generador (para dibujar) y el
gate (para rechazar), asi que no pueden separarse.
"""
import io
import json
import os

from PIL import Image, ImageFont
from PIL.PngImagePlugin import PngInfo

# ── geometria de la hoja (formulario I-IN-002.4-R01, A4 apaisado) ────────────
BODY_Y, BODY_H = 4.90, 9.90       # el cuerpo arranca bajo el cajetin
IMG_W, IMG_X = 16.20, 0.60        # bloque de IMAGENES
BANDA_H = 0.60                    # la franja con el titulo "IMAGENES"
PT_CM = 0.03527777

def bloque_cm():
    """Ancho y alto utiles del bloque de imagenes, en cm."""
    return IMG_W, BODY_H - BANDA_H

# ── umbrales ────────────────────────────────────────────────────────────────
# Cada uno con la razon por la que vale ESE numero. Cambiar uno sin cambiar la razon es
# como no tenerlo.
TOLERANCIA_PT = 0.01       # 1/100 de punto no lo ve nadie: evita el rojo por redondeo
CUERPO_MIN_PT = 7.0        # lo mas chico que Barack imprime en estas hojas (referencias EPP)
PRINCIPAL_MIN = 0.45       # la principal, sobre la superficie de FOTO de la hoja
PRINCIPAL_MIN_BLOQUE = 0.25   # y un piso sobre el bloque, para que no sea una estampilla
PRINCIPAL_VENTAJA = 1.6    # y le saca 1,6x a la segunda
IMAGENES_MAX = 3           # mas de 3 en A4 = ninguna se ve
ANCHO_MIN_LEER_CM = 7.0    # para una FOTO marcada `leer` (no lleva metrica adentro)
TOPE_ACOMPANANTE = 3.0     # cada acompañante, hasta 1/3 del area de la principal

# La fraccion se mide sobre la TINTA, no sobre el bloque: una foto vertical 9:16 a la altura
# completa del bloque ocupa el 32% y no hay forma de que ocupe mas. Con "45% del bloque",
# 13 de 17 hojas violaban un umbral imposible. Sobre la tinta el criterio si discrimina: la
# 20.2 con el celular daba 19%.

_TTF = {}
for _n, _a in (("Calibri", "calibri.ttf"), ("Calibri-b", "calibrib.ttf"),
               ("Arial", "arial.ttf"), ("Arial-b", "arialbd.ttf")):
    _p = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", _a)
    if os.path.exists(_p):
        _TTF[_n] = _p
_TTF.setdefault("Calibri", next(iter(_TTF.values()), None))


def _ttf(nombre, bold, px):
    ruta = _TTF.get(nombre + ("-b" if bold else ""), _TTF["Calibri"])
    return ImageFont.truetype(ruta, max(int(px), 4))

def ancho_cm(texto, size, fuente, bold):
    """Ancho real del texto medido con la TTF (a 96 dpi, 1 pt = 96/72 px)."""
    f = _ttf(fuente, bold, round(size * 96 / 72))
    return f.getlength(texto) / 96 * 2.54

def lineas_wrap(texto, size, w_cm, bold=False, fuente="Calibri"):
    """Cuantas lineas ocupa `texto` en un ancho de w_cm, midiendo con la fuente real."""
    lineas, actual = 1, ""
    for p in texto.split():
        probar = (actual + " " + p) if actual else p
        if ancho_cm(probar, size, fuente, bold) <= w_cm:
            actual = probar
        else:
            lineas += 1
            actual = p
    return lineas


# ─── 3. pasos ─────────────────────────────────────────────────────────────────


# ── la metrica que viaja DENTRO del PNG ──────────────────────────────────────
# Va en un chunk de texto del propio PNG y no en un archivo al lado, porque el gate lee las
# imagenes YA EMBEBIDAS en el pptx, donde no hay nombre de archivo que seguir. python-pptx
# guarda los bytes tal cual, asi que el chunk sobrevive.
CLAVE = "hoja_proceso"


def guardar_pantalla(im, destino, cuerpo_px, que_es=""):
    """Guarda una pantalla redibujada con su metrica adentro. `cuerpo_px` es el alto de la
    tipografia mas chica que el operario TIENE que leer, no la de los titulos."""
    meta = PngInfo()
    meta.add_text(CLAVE, json.dumps({"cuerpo_px": int(cuerpo_px),
                                     "ancho_px": int(im.width), "que_es": que_es}))
    im.save(destino, pnginfo=meta)
    return destino, im.size


def metrica(blob_o_ruta):
    """El dict de metrica de una imagen, o None si no la lleva (una foto normal)."""
    try:
        im = (Image.open(io.BytesIO(blob_o_ruta))
              if isinstance(blob_o_ruta, (bytes, bytearray)) else Image.open(blob_o_ruta))
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


def ancho_minimo_cm(cuerpo_px, ancho_px, minimo_pt=CUERPO_MIN_PT):
    """Cuantos cm de ancho necesita esa imagen para llegar al cuerpo minimo legible.

    Redondea PARA ARRIBA al medio milimetro: el valor exacto cae justo en el umbral y, con
    el redondeo de coma flotante, usarlo tal cual vuelve a dar rojo. Un numero que le doy a
    alguien para que arregle algo tiene que arreglarlo.
    """
    import math
    return math.ceil(minimo_pt * PT_CM * ancho_px / cuerpo_px / 0.05) * 0.05


def ancho_que_le_toca_cm(ancho_px, alto_px, n_imagenes=2):
    """Cuanto ancho le va a dar el bloque a esa imagen si es la principal.

    Sirve para dimensionar una pantalla ANTES de dibujarla: la imagen se acomoda por su
    ALTURA dentro del bloque, asi que una pantalla mas alta termina mas angosta impresa —
    que es lo contrario de lo que uno espera al agrandar el dibujo.
    """
    W, H = bloque_cm()
    W, H = W - 0.2, H - 0.2
    ar = float(ancho_px) / float(alto_px)
    if n_imagenes == 1:
        return min(W, H * ar)
    return min(W, H * ar) if H * ar < W - 2.6 else min(W, (H * 0.62) * ar)


# ── reparto de las imagenes en el bloque ─────────────────────────────────────
def layout_principal(ars, W, H, idx):
    """Reparte dando prioridad a UNA imagen: la que el paso manda mirar.

    Existe por el incidente del 03/09/2026: repartiendo por geometria, la foto mas grande
    de la hoja 20.2 era una mano con un celular y la tabla de parametros del fusor era la
    mas chica. El area total salia optima y la hoja no servia.

    Prueba las dos formas en que una imagen puede mandar en un bloque apaisado —a la
    izquierda con altura completa, o arriba con ancho completo— y devuelve la que le deja
    MAS superficie a la principal. Con una sola imagen, ocupa todo.
    """
    n = len(ars)
    if not (0 <= idx < n):
        return None
    if n == 1:
        ar = ars[0]
        iw, ih = (W, W / ar) if W / ar <= H else (H * ar, H)
        return [((W - iw) / 2, (H - ih) / 2, iw, ih)]

    otras = [k for k in range(n) if k != idx]
    salidas = []

    # ── A. la principal a la izquierda, altura completa; las otras apiladas a la derecha
    ih_p = H
    iw_p = ih_p * ars[idx]
    # 2,6 cm es lo mas angosto que se le puede dejar a una foto de evidencia y que siga
    # sirviendo. Menos que eso, no se ve nada y conviene sacarla de la hoja.
    if iw_p < W - 2.6:
        wl = W - iw_p - 0.2
        hl = (H - 0.16 * (len(otras) - 1)) / len(otras)
        out = [None] * n
        out[idx] = (0.0, 0.0, iw_p, ih_p)
        # cada acompañante se limita a un tercio del area de la principal. Sin este tope,
        # dos fotos de la misma forma salian EXACTAMENTE iguales y la hoja volvia a no
        # tener jerarquia: la geometria sola nunca elige.
        tope = iw_p * ih_p / TOPE_ACOMPANANTE
        y = 0.0
        ok = True
        for k in otras:
            ih = min(hl, wl / ars[k])
            iw = ih * ars[k]
            if iw * ih > tope:
                esc = (tope / (iw * ih)) ** 0.5
                iw, ih = iw * esc, ih * esc
            if iw < 1.5 or ih < 1.0:
                ok = False
                break
            out[k] = (iw_p + 0.2 + (wl - iw) / 2, y + (hl - ih) / 2, iw, ih)
            y += hl + 0.16
        if ok:
            salidas.append(out)

    # ── B. la principal arriba, ancho completo; las otras en fila abajo
    for reparto in (0.62, 0.55, 0.70):
        h_p = H * reparto
        iw_p, ih_p = ((W, W / ars[idx]) if W / ars[idx] <= h_p
                      else (h_p * ars[idx], h_p))
        h_r = H - ih_p - 0.16
        if h_r < 1.2:
            continue
        anchos = [min((W - 0.16 * (len(otras) - 1)) / len(otras), h_r * ars[k]) for k in otras]
        if min(anchos) < 1.5:
            continue
        out = [None] * n
        out[idx] = ((W - iw_p) / 2, 0.0, iw_p, ih_p)
        total = sum(anchos) + 0.16 * (len(otras) - 1)
        x = (W - total) / 2
        for k, iw in zip(otras, anchos):
            ih = iw / ars[k]
            out[k] = (x, ih_p + 0.16 + (h_r - ih) / 2, iw, ih)
            x += iw + 0.16
        salidas.append(out)
        break

    if not salidas:
        return None
    # gana la que le da mas superficie a la PRINCIPAL, no la de mayor area total
    return max(salidas, key=lambda L: L[idx][2] * L[idx][3])

def layout_grilla(ars, W, H, cols):
    """Grilla uniforme de `cols` columnas. Devuelve [(x, y, w, h), ...] o None."""
    n = len(ars)
    filas = (n + cols - 1) // cols
    cw, ch = W / cols, H / filas
    bw, bh = cw - 0.16, ch - 0.16
    if bw <= 0 or bh <= 0:
        return None
    dib = [(bw, bw / ar) if bw / ar <= bh else (bh * ar, bh) for ar in ars]
    out = [None] * n
    for fila in range(filas):
        idx = list(range(fila * cols, min((fila + 1) * cols, n)))
        ancho = sum(dib[k][0] for k in idx) + 0.16 * (len(idx) - 1)
        x = (W - ancho) / 2                       # la fila se centra
        for k in idx:
            iw, ih = dib[k]
            out[k] = (x, fila * ch + (ch - ih) / 2, iw, ih)
            x += iw + 0.16
    return out

def layout_orientacion(ars, W, H):
    """Verticales en fila a la izquierda (altura completa), horizontales apiladas
    a la derecha. Es el unico que aprovecha bien una hoja que mezcla las dos."""
    vert = [k for k, ar in enumerate(ars) if ar < 1]
    hori = [k for k, ar in enumerate(ars) if ar >= 1]
    if not vert or not hori:
        return None
    out = [None] * len(ars)
    wv = sum(H * ars[k] for k in vert) + 0.16 * (len(vert) - 1)
    wl = W - wv - 0.20
    # Si al grupo apaisado le queda una franja, esta reparticion no sirve: paso con la 20.2,
    # donde una foto casi cuadrada (800x807) entro como "vertical", se llevo el ancho y la
    # pantalla redibujada quedo en 1,5 cm. Por area total ganaba igual, pero era ilegible.
    if wl <= 4.0:
        return None
    hl = (H - 0.16 * (len(hori) - 1)) / len(hori)
    x = 0.0
    for k in vert:
        iw = H * ars[k]
        out[k] = (x, 0.0, iw, H)
        x += iw + 0.16
    y = 0.0
    for k in hori:
        ih = min(hl, wl / ars[k])
        iw = ih * ars[k]
        out[k] = (wv + 0.20 + (wl - iw) / 2, y + (hl - ih) / 2, iw, ih)
        y += hl + 0.16
    return out

