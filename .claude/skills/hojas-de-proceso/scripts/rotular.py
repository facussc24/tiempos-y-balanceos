# -*- coding: utf-8 -*-
"""rotular.py — le pone el nombre en castellano a lo que hay que mirar, SIN tapar la foto.

La regla (skill §3, pedido de Fak 08/09/2026): la pantalla o el control van con la FOTO
REAL; lo que agregamos nosotros es un recuadro, un numero y el rotulo **al costado**, en
banda blanca fuera de la foto. Nada se tapa, nada se retoca, nada pasa por un generador
de imagenes. Aca eso esta hecho codigo: los rotulos NO PUEDEN caer encima de la foto —
van en la banda, y si no entran, la banda crece.

Vale igual para un control con la serigrafia en chino (自动 / 手动 / 循环启动): el operario
tiene adelante ese texto, asi que la foto lo conserva y el rotulo dice al lado que quiere
decir. Un dibujo en castellano que no se le parece no le sirve para encontrarlo.

    rotular.py --foto F.jpg --out G.jpg
               --marca-color "verde|texto"  (la caja se MIDE: un pulsador de color no se
                                             puede poner mal si nadie tipea su posicion)
               --marca "x,y,w,h|texto"      (a mano, en % de la foto; se CHEQUEA que caiga
                                             sobre algo y no sobre panel liso)
               [--banda derecha|abajo|auto|ninguna] [--ancho 1600] [--titulo "..."]
               [--zona x0,y0,x1,y1] [--lisa-ok 2,5]

Conserva la procedencia que fotodevideo.py dejo adentro del archivo y le agrega los
rotulos puestos, para que despues se pueda auditar que dice cada marca.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROJO = (206, 32, 32)
AZUL = (68, 84, 106)
BLANCO = (255, 255, 255)
NEGRO = (28, 28, 30)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fotodevideo import CLAVE, foco, leer_origen, guardar  # noqa: E402
from medir_marca import manchas  # noqa: E402


# La serigrafia de estas maquinas esta en chino y el rotulo la cita ("自动 / 手动"): con
# Calibri eso sale como cuadraditos vacios y queda peor que no ponerlo. Microsoft YaHei
# trae latino y CJK en la misma fuente, asi que va primero. Si no esta, CHEQUEO_CJK avisa.
_BOLD = ("msyhbd.ttc", "msyh.ttc", "simhei.ttf", "calibrib.ttf", "arialbd.ttf")
_REG = ("msyh.ttc", "simsun.ttc", "calibri.ttf", "arial.ttf")


def _fuente(px, bold=True):
    base = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")
    for n in (_BOLD if bold else _REG):
        p = os.path.join(base, n)
        if os.path.exists(p):
            return ImageFont.truetype(p, px)
    return ImageFont.load_default()


def sin_glifo(texto: str, fuente) -> list[str]:
    """Caracteres que esta fuente NO sabe dibujar. Un rotulo con cuadraditos vacios se ve
    prolijo en el codigo y roto en el papel: se chequea antes de guardar, no despues."""
    try:
        cmap = fuente.getbestcmap() if hasattr(fuente, "getbestcmap") else None
    except Exception:
        cmap = None
    faltan = []
    for ch in texto:
        if ch.isspace():
            continue
        if cmap is not None:
            if ord(ch) not in cmap:
                faltan.append(ch)
        else:
            m = fuente.getmask(ch)
            if m.getbbox() is None and not ch.isspace():
                faltan.append(ch)
    return faltan


def _wrap(texto, fuente, ancho_px, draw):
    palabras, lineas, act = texto.split(), [], ""
    for w in palabras:
        prueba = (act + " " + w).strip()
        if draw.textlength(prueba, font=fuente) <= ancho_px or not act:
            act = prueba
        else:
            lineas.append(act)
            act = w
    if act:
        lineas.append(act)
    return lineas


def _circulo(d, cx, cy, r, n, fuente, relleno=ROJO):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=relleno, outline=BLANCO, width=max(2, r // 7))
    t = str(n)
    w = d.textlength(t, font=fuente)
    a = fuente.getbbox(t)[3] - fuente.getbbox(t)[1]
    d.text((cx - w / 2, cy - a / 2 - fuente.getbbox(t)[1]), t, font=fuente, fill=BLANCO)


LISA_FOCO = 12.0      # varianza del laplaciano de una chapa pintada, medida
LISA_RANGO = 26       # recorrido de gris dentro de la caja, en niveles 0-255


def caja_vacia(im, x, y, w, h):
    """¿Esta marca cae sobre algo, o sobre panel liso? Devuelve (vacia, foco, rango).

    Una marca corrida unos centimetros cae justo al lado del boton, sobre chapa: se ve
    prolija en el codigo y mal en el papel. Lo unico que la distingue es que adentro no
    hay nada, y eso se mide."""
    import numpy as np
    W, H = im.size
    X, Y = int(x * W / 100), int(y * H / 100)
    Wd, Hd = max(2, int(w * W / 100)), max(2, int(h * H / 100))
    rec = im.crop((max(0, X), max(0, Y), min(W, X + Wd), min(H, Y + Hd)))
    if rec.size[0] < 3 or rec.size[1] < 3:
        return True, 0.0, 0
    g = np.asarray(rec.convert("L"), dtype=np.float32)
    rango = int(np.percentile(g, 97) - np.percentile(g, 3))
    f = foco(rec)
    return (f < LISA_FOCO and rango < LISA_RANGO), f, rango


def chequear_marcas(foto, marcas, permitir_lisa):
    im = Image.open(foto).convert("RGB")
    W, H = im.size
    malas = []
    for i, (x, y, w, h, t) in enumerate(marcas, 1):
        if x < 0 or y < 0 or x + w > 100.5 or y + h > 100.5:
            malas.append((i, t, "se sale de la foto"))
            continue
        if w * W / 100 < 8 or h * H / 100 < 8:
            malas.append((i, t, "la caja es de menos de 8 px"))
            continue
        vacia, f, rango = caja_vacia(im, x, y, w, h)
        if vacia and i not in permitir_lisa:
            malas.append((i, t, f"cae sobre una zona lisa (foco {f:.0f}, rango {rango}): "
                                f"no hay nada adentro del recuadro"))
    return malas


def rotular(foto: str, marcas: list[tuple], banda: str, ancho: int, titulo: str | None,
            numeros: bool = True, grosor: int = 0):
    im = Image.open(foto).convert("RGB")
    if ancho and im.width != ancho:
        im = im.resize((ancho, round(im.height * ancho / im.width)), Image.LANCZOS)
    W, H = im.size

    if banda == "auto":
        banda = "abajo" if W / H >= 2.2 else "derecha"

    # marcas sobre la foto
    d = ImageDraw.Draw(im)
    # El grosor automatico sirve para una foto que va grande. En una hoja de SECUENCIA la foto
    # sale de ~8 cm impresa y 4 px sobre 1800 son 0,2 mm: el recuadro casi no se ve en el
    # papel (cambio de molde IMG, 25/09/2026). Ahi se pasa --grosor.
    grosor = grosor or max(3, W // 420)
    r = max(15, W // 52)
    f_num = _fuente(int(r * 1.35))
    for i, (x, y, w, h, _t) in enumerate(marcas, 1):
        X, Y = int(x * W / 100), int(y * H / 100)
        Wd, Hd = int(w * W / 100), int(h * H / 100)
        d.rectangle([X, Y, X + Wd, Y + Hd], outline=ROJO, width=grosor)
        # el numero va MONTADO SOBRE LA ESQUINA, no adentro: adentro le tapa al control
        # justo la serigrafia que el rotulo esta citando (paso el 21/09 con 循环启动).
        # con UNA sola marca el numerito sobra y encima choca con el badge del paso que
        # el generador dibuja en la misma esquina: queda el recuadro solo.
        if numeros and len(marcas) > 1:
            _circulo(d, min(max(X, r), W - r), min(max(Y, r), H - r), r, i, f_num)

    # "ninguna": la foto va DENTRO de una hoja, donde el texto de cada numero ya esta en el
    # bloque DESCRIPCION. Repetirlo en una banda al costado lo pone dos veces y, al tamano
    # que le toca a la foto en A4, la copia de la banda no se lee. Solo van los numeros.
    if banda == "ninguna" or (not marcas and not titulo):
        return im

    # banda de rotulos, fuera de la foto
    f_rot = _fuente(max(16, W // 46))
    f_tit = _fuente(max(15, W // 52))
    sep = max(10, W // 110)
    r_b = max(13, W // 62)
    f_numb = _fuente(int(r_b * 1.35))

    if banda == "derecha":
        bw = int(W * 0.34)
        txt_w = bw - 3 * sep - 2 * r_b
        dd = ImageDraw.Draw(Image.new("RGB", (1, 1)))
        alto = sep
        bloques = []
        for i, (_x, _y, _w, _h, t) in enumerate(marcas, 1):
            ls = _wrap(t, f_rot, txt_w, dd)
            bloques.append(ls)
            alto += max(2 * r_b, len(ls) * (f_rot.size + 4)) + sep
        hoja = Image.new("RGB", (W + bw, max(H, alto)), BLANCO)
        hoja.paste(im, (0, 0))
        d2 = ImageDraw.Draw(hoja)
        y = sep
        for i, ls in enumerate(bloques, 1):
            _circulo(d2, W + sep + r_b, y + r_b, r_b, i, f_numb)
            for j, ln in enumerate(ls):
                d2.text((W + 2 * sep + 2 * r_b, y + j * (f_rot.size + 4)), ln,
                        font=f_rot, fill=NEGRO)
            y += max(2 * r_b, len(ls) * (f_rot.size + 4)) + sep
    else:
        cols = 2 if len(marcas) > 2 else max(1, len(marcas))
        col_w = W // cols
        txt_w = col_w - 3 * sep - 2 * r_b
        dd = ImageDraw.Draw(Image.new("RGB", (1, 1)))
        bloques = [_wrap(t, f_rot, txt_w, dd) for (_x, _y, _w, _h, t) in marcas]
        filas = (len(marcas) + cols - 1) // cols
        alto_fila = max(max(2 * r_b, len(b) * (f_rot.size + 4)) for b in bloques) + sep
        bh = filas * alto_fila + sep
        hoja = Image.new("RGB", (W, H + bh), BLANCO)
        hoja.paste(im, (0, 0))
        d2 = ImageDraw.Draw(hoja)
        for i, ls in enumerate(bloques, 1):
            cx = ((i - 1) % cols) * col_w
            cy = H + sep + ((i - 1) // cols) * alto_fila
            _circulo(d2, cx + sep + r_b, cy + r_b, r_b, i, f_numb)
            for j, ln in enumerate(ls):
                d2.text((cx + 2 * sep + 2 * r_b, cy + j * (f_rot.size + 4)), ln,
                        font=f_rot, fill=NEGRO)

    if titulo:
        d3 = ImageDraw.Draw(hoja)
        th = f_tit.size + 10
        nueva = Image.new("RGB", (hoja.width, hoja.height + th), AZUL)
        nueva.paste(hoja, (0, th))
        d3 = ImageDraw.Draw(nueva)
        d3.text((6, 5), titulo, font=f_tit, fill=BLANCO)
        hoja = nueva
    return hoja


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--foto", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--marca", action="append", default=[],
                    help='"x,y,w,h|texto" en %% de la foto, o "color:verde|texto" / '
                         '"color:rojo#2|texto" para que la caja se MIDA sola. Los numeros '
                         'salen en el orden en que se escriben las marcas.')
    ap.add_argument("--margen-color", dest="margen_color", type=float, default=12.0,
                    help="cuanto agrandar la caja medida, en %% de su lado")
    ap.add_argument("--zona", help="acota la busqueda de color a x0,y0,x1,y1 en %% de la foto")
    ap.add_argument("--lisa-ok", dest="lisa_ok", default="",
                    help="numeros de marca (1,3) que a proposito rodean una zona lisa")
    ap.add_argument("--banda", default="auto", choices=["auto", "derecha", "abajo", "ninguna"])
    ap.add_argument("--ancho", type=int, default=1600)
    ap.add_argument("--titulo")
    ap.add_argument("--grosor", type=int, default=0,
                    help="grosor del recuadro en px (0 = automatico, W/420). Para una foto de "
                         "hoja de secuencia (~8 cm impresa) conviene 1/200 del ancho")
    a = ap.parse_args()

    marcas = []
    _cache = {}

    def _por_color(spec):
        """La caja de un pulsador de color, MEDIDA. Nadie tipea su posicion."""
        if "manchas" not in _cache:
            im0 = Image.open(a.foto)
            _cache["im"] = im0
            _cache["manchas"] = manchas(im0, 0.0008)[0]
        im0 = _cache["im"]
        W0, H0 = im0.size
        zx0, zy0, zx1, zy1 = (0.0, 0.0, 100.0, 100.0)
        if a.zona:
            zx0, zy0, zx1, zy1 = [float(v) for v in a.zona.split(",")]
        color, _, cual = spec.partition("#")
        color = color.strip()
        cands = [c for c in _cache["manchas"] if c[0] == color
                 and zx0 <= (c[1] + c[3] / 2) * 100 / W0 <= zx1
                 and zy0 <= (c[2] + c[4] / 2) * 100 / H0 <= zy1]
        if not cands:
            raise SystemExit(f"color:{color}: no encontre ninguna mancha "
                             f"{'en esa zona' if a.zona else 'en la foto'}. "
                             f"Correr medir_marca.py para ver que hay.")
        if len(cands) > 1 and not cual:
            lista = ", ".join(f"#{k+1} en x={c[1]*100/W0:.0f}%" for k, c in enumerate(cands))
            raise SystemExit(f"color:{color}: hay {len(cands)} manchas ({lista}). "
                             f"Elegir con {color}#1, o acotar con --zona.")
        c = cands[int(cual) - 1 if cual else 0]
        mx_, my_ = c[3] * a.margen_color / 100.0, c[4] * a.margen_color / 100.0
        X, Y = max(0.0, c[1] - mx_), max(0.0, c[2] - my_)
        Wd, Hd = min(W0 - X, c[3] + 2 * mx_), min(H0 - Y, c[4] + 2 * my_)
        print(f"  medido {color}: {X*100/W0:.1f},{Y*100/H0:.1f},{Wd*100/W0:.1f},{Hd*100/H0:.1f}")
        return X * 100 / W0, Y * 100 / H0, Wd * 100 / W0, Hd * 100 / H0

    for m in a.marca:
        if "|" not in m:
            raise SystemExit(f'--marca mal escrita: {m!r}. Va "x,y,w,h|texto"')
        geo, texto = m.split("|", 1)
        if geo.strip().startswith("color:"):
            x, y, w, h = _por_color(geo.strip()[6:])
            marcas.append((x, y, w, h, texto.strip()))
            continue
        p = [float(v) for v in geo.split(",")]
        if len(p) != 4:
            raise SystemExit(f'--marca mal escrita: {m!r}. La geometria va x,y,w,h en %, '
                             f'o "color:verde"')
        marcas.append((p[0], p[1], p[2], p[3], texto.strip()))

    permitir = {int(v) for v in a.lisa_ok.replace(" ", "").split(",") if v.strip().isdigit()}
    malas = chequear_marcas(a.foto, marcas, permitir)
    if malas:
        for i, t, por in malas:
            print(f"MARCA {i} ({t[:40]}): {por}", file=sys.stderr)
        raise SystemExit("marcas mal puestas. Medirlas con medir_marca.py, o usar "
                         "--marca-color, o declararlas con --lisa-ok si es a proposito.")

    f_chk = _fuente(24)
    rotos = {t: sin_glifo(t, f_chk) for (*_g, t) in marcas if sin_glifo(t, f_chk)}
    if a.titulo and sin_glifo(a.titulo, f_chk):
        rotos[a.titulo] = sin_glifo(a.titulo, f_chk)
    if rotos:
        for t, ch in rotos.items():
            print(f"ROTULO CON CARACTERES QUE LA FUENTE NO DIBUJA {ch}: {t}", file=sys.stderr)
        raise SystemExit("saldrian cuadraditos vacios en el papel: cambiar el texto o la fuente")

    im = rotular(a.foto, marcas, a.banda, a.ancho, a.titulo, grosor=a.grosor)
    origen = leer_origen(a.foto) or "{}"
    try:
        dic = json.loads(origen)
    except Exception:
        dic = {"origen_crudo": origen}
    # La CAJA tambien, no solo el texto: sin ella nadie puede chequear despues si la marca
    # cubre el sujeto, si dos chapas se pisan o si una quedo fuera del cuadro. Una posicion
    # que no queda escrita se vuelve a estimar, y ahi es donde se erro el 21/09.
    dic["rotulos"] = [t for (_x, _y, _w, _h, t) in marcas]
    dic["cajas"] = [[round(x, 2), round(y, 2), round(w, 2), round(h, 2)]
                    for (x, y, w, h, _t) in marcas]
    if a.titulo:
        dic["titulo"] = a.titulo
    guardar(im, a.out, json.dumps(dic, ensure_ascii=False))
    print(f"{a.out}  {im.size[0]}x{im.size[1]}  {len(marcas)} rotulos  (banda {a.banda})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
