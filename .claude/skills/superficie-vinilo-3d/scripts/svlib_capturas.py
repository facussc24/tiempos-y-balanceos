# -*- coding: utf-8 -*-
"""svlib_capturas.py — las "fotos de evidencia": recortes de los documentos REALES con el
renglon que importa marcado en rojo. Corre con el Python del sistema (PIL, ezdxf).

Regla de Fak, 01/10/2026: si la presentacion nombra una fuente, lleva su captura — *"si no me
van a preguntar de donde saque los datos"*. La captura es del documento, no el dato retipeado.

Lo que trae:
  pdf_pagina / pdf_palabras      una pagina a imagen, y donde esta cada palabra (poppler)
  pdf_fila / pdf_bloque          recortes anclados a PALABRAS del documento, con marco rojo
  captura_xlsx                   rangos de un Excel como imagen (Excel por COM, sobre una COPIA)
  contorno_dxf / dibujo_dxf      area y dibujo a escala de un patron de corte
  apilar / marco                 composicion

Trampas ya pisadas:
  - el `pdftotext` del PATH es el xpdf viejo y NO tiene -bbox: se usa el de poppler, que vive
    al lado de `pdftoppm`.
  - de una orden de compra se recorta SIN los precios (pdf_fila con `hasta_palabra`).
  - un Excel ajeno se abre en solo lectura sobre una copia y no se guarda.
"""
import os
import re
import shutil
import subprocess
import tempfile

from PIL import Image, ImageDraw

ROJO = (214, 39, 40)
AQUI = os.path.dirname(os.path.abspath(__file__))


def _poppler(nombre):
    ppm = shutil.which('pdftoppm')
    if not ppm:
        raise SystemExit('no encuentro pdftoppm (poppler). Esta en %LOCALAPPDATA%\\Microsoft\\WinGet\\Packages\\oschwartz10612.Poppler*')
    exe = os.path.join(os.path.dirname(ppm), nombre + ('.exe' if os.name == 'nt' else ''))
    return exe if os.path.exists(exe) else os.path.join(os.path.dirname(ppm), nombre)


def pdf_pagina(pdf, pagina, dpi=200):
    """Devuelve la pagina como imagen PIL."""
    d = tempfile.mkdtemp(prefix='sv_pdf_')
    subprocess.run([_poppler('pdftoppm'), '-png', '-r', str(dpi), '-f', str(pagina), '-l', str(pagina), pdf, os.path.join(d, 'p')],
                   check=True, capture_output=True)
    f = [x for x in os.listdir(d) if x.endswith('.png')][0]
    return Image.open(os.path.join(d, f)).convert('RGB')


def pdf_palabras(pdf, pagina):
    """(ancho_pt, alto_pt, [(x0, y0, x1, y1, texto), ...])"""
    d = tempfile.mkdtemp(prefix='sv_bbox_')
    out = os.path.join(d, 'b.html')
    subprocess.run([_poppler('pdftotext'), '-bbox', '-f', str(pagina), '-l', str(pagina), pdf, out], check=True, capture_output=True)
    t = open(out, encoding='utf-8', errors='replace').read()
    pg = re.search(r'<page width="([\d.]+)" height="([\d.]+)"', t)
    w = [(float(a), float(b), float(c), float(dd), tx) for a, b, c, dd, tx in
         re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', t)]
    return float(pg.group(1)), float(pg.group(2)), w


def marco(im, caja, ancho=6, holg=8):
    x0, y0, x1, y1 = caja
    ImageDraw.Draw(im).rounded_rectangle((x0 - holg, y0 - holg, x1 + holg, y1 + holg), radius=10, outline=ROJO, width=ancho)
    return im


def _fila_de(W, palabra, tol=2.0):
    ws = [w for w in W if palabra in w[4]]
    if not ws:
        raise SystemExit('la palabra %r no esta en la pagina' % palabra)
    return [w for w in W if abs(w[1] - ws[0][1]) < tol], ws[0]


def pdf_bloque(pdf, pagina, marcar, exigir=(), desde=None, hasta=None, dpi=200, margen=28):
    """Recorta un bloque de la pagina y marca en rojo el renglon que contiene `marcar`.
    exigir: palabras que ESE renglon tiene que traer (si no, aborta: no se marca cualquier cosa).
    desde / hasta: palabras que fijan el borde de arriba y el de abajo del recorte.
    Devuelve (imagen, texto_del_renglon)."""
    pw, ph, W = pdf_palabras(pdf, pagina)
    im = pdf_pagina(pdf, pagina, dpi); k = im.width / pw
    fila, ancla = _fila_de(W, marcar)
    txt = ' '.join(w[4] for w in sorted(fila))
    for e in exigir:
        if e not in txt:
            raise SystemExit('el renglon de %r no trae %r: %s' % (marcar, e, txt))
    marco(im, (min(w[0] for w in fila) * k, ancla[1] * k, max(w[2] for w in fila) * k, ancla[3] * k))
    y0 = min(w[1] for w in W) if desde is None else _fila_de(W, desde)[1][1]
    y1 = max(w[3] for w in W) if hasta is None else _fila_de(W, hasta)[1][3]
    dentro = [w for w in W if y0 - 1 <= w[1] and w[3] <= y1 + 1]
    x0 = min(w[0] for w in dentro); x1 = max(w[2] for w in dentro)
    return im.crop((max(int(x0 * k) - margen, 0), max(int(y0 * k) - margen, 0),
                    min(int(x1 * k) + margen, im.width), min(int(y1 * k) + margen, im.height))), txt


def pdf_fila(pdf, pagina, palabra, hasta_palabra=None, encabezado=None, dpi=200, margen=28, abajo=0):
    """Recorta UN renglon (el que contiene `palabra`), opcionalmente cortado a la derecha en
    `hasta_palabra` (para dejar afuera los precios) y con su fila de encabezado arriba."""
    pw, ph, W = pdf_palabras(pdf, pagina)
    im = pdf_pagina(pdf, pagina, dpi); k = im.width / pw
    fila, ancla = _fila_de(W, palabra, tol=3.0)
    x0 = min(w[0] for w in fila)
    x1 = max(w[2] for w in fila) if hasta_palabra is None else [w for w in fila if hasta_palabra in w[4]][0][2]
    y0 = ancla[1] if encabezado is None else _fila_de(W, encabezado)[1][1]
    return im.crop((max(int(x0 * k) - margen, 0), max(int(y0 * k) - margen, 0),
                    min(int(x1 * k) + margen, im.width), min(int(ancla[3] * k) + margen + abajo, im.height)))


def apilar(imgs, sep=20, fondo='white'):
    w = max(i.width for i in imgs) + 2 * sep
    out = Image.new('RGB', (w, sum(i.height for i in imgs) + sep * (len(imgs) + 1)), fondo)
    y = sep
    for i in imgs:
        out.paste(i, (sep, y)); y += i.height + sep
    return out


def captura_xlsx(xlsx, rangos, hoja=1):
    """Rangos de un Excel como imagenes (lista de PIL). Trabaja sobre una COPIA en temporales,
    en solo lectura, y no guarda nada. Necesita Excel instalado."""
    d = tempfile.mkdtemp(prefix='sv_xlsx_')
    copia = os.path.join(d, 'copia' + os.path.splitext(xlsx)[1])
    shutil.copy2(xlsx, copia)
    r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', os.path.join(AQUI, 'sv_captura_xlsx.ps1'),
                        copia, d, str(hoja), ';'.join(rangos)], capture_output=True, text=True)
    out = [os.path.join(d, 'rango_%d.png' % (i + 1)) for i in range(len(rangos))]
    if r.returncode != 0 or not all(os.path.exists(f) for f in out):
        raise SystemExit('la captura del Excel fallo:\n%s\n%s' % (r.stdout[-600:], r.stderr[-600:]))
    return [Image.open(f).convert('RGB') for f in out]


def marcar_fila(im, n_filas, fila, ancho=5):
    """Marca la fila `fila` (desde 1) de una captura que tiene `n_filas` filas de igual alto."""
    fh = im.height / float(n_filas)
    return marco(im, (6, (fila - 1) * fh + 3, im.width - 6, fila * fh - 3), ancho=ancho, holg=0)


def contorno_dxf(path, hueco_max_mm=1.0):
    """El contorno de MAYOR AREA del DXF: (puntos, largo_mm, ancho_mm, area_cm2, hueco_de_cierre_mm).

    Se elige por area y no por cantidad de puntos: un agujero redondo tiene mas puntos que el
    rectangulo que lo contiene (auditoria 01/10/2026). Si el contorno viene abierto mas de
    `hueco_max_mm`, ABORTA: cerrarlo con un tramo recto es una decision que se toma a sabiendas,
    pasando el hueco tolerado, y se dice en la hoja."""
    import ezdxf
    from ezdxf import path as ep
    doc = ezdxf.readfile(path)
    mejor = None; mejor_a = -1.0
    for e in doc.modelspace():
        if e.dxftype() in ('LWPOLYLINE', 'POLYLINE', 'SPLINE'):
            pts = [(q.x, q.y) for q in ep.make_path(e).flattening(0.01)]
            if len(pts) < 3:
                continue
            xs = [q[0] for q in pts]; ys = [q[1] for q in pts]; n = len(pts)
            ar = 0.5 * abs(sum(xs[i] * ys[(i + 1) % n] - xs[(i + 1) % n] * ys[i] for i in range(n)))
            if ar > mejor_a:
                mejor, mejor_a = pts, ar
    if mejor is None:
        raise SystemExit('el DXF %s no trae una polilinea de contorno (solo lineas y arcos sueltos?)' % path)
    xs = [q[0] for q in mejor]; ys = [q[1] for q in mejor]
    hueco = ((xs[0] - xs[-1]) ** 2 + (ys[0] - ys[-1]) ** 2) ** 0.5
    if hueco > hueco_max_mm:
        raise SystemExit('el contorno de %s viene ABIERTO %.2f mm. Si se acepta cerrarlo con un tramo recto, pasar '
                         'hueco_max_mm=%.0f y decirlo en la hoja.' % (os.path.basename(path), hueco, hueco + 1))
    return mejor, max(xs) - min(xs), max(ys) - min(ys), mejor_a / 100.0, hueco


def dibujo_dxf(path, out, px_mm=2.6, lienzo=(2820, 960), fuente=r'C:\Windows\Fonts\segoeui.ttf', hueco_max_mm=1.0):
    """Dibuja el patron a escala con sus dos medidas. El MISMO lienzo y px_mm para todos los
    patrones de una hoja, asi quedan a la misma escala.
    Devuelve dict(largo_mm, ancho_mm, area_cm2, hueco_de_cierre_mm)."""
    from PIL import ImageFont
    pts, dx, dy, a, hueco = contorno_dxf(path, hueco_max_mm)
    W_, H_ = lienzo
    im = Image.new('RGB', (W_, H_), 'white'); d = ImageDraw.Draw(im); F = ImageFont.truetype(fuente, 62)
    x0 = min(q[0] for q in pts); y1 = max(q[1] for q in pts); ox, oy = 30, 20
    poly = [(ox + (x - x0) * px_mm, oy + (y1 - y) * px_mm) for x, y in pts]
    d.polygon(poly, fill=(255, 226, 190)); d.line(poly + [poly[0]], fill=(40, 40, 40), width=5)
    yb = oy + dy * px_mm + 40; xr = ox + dx * px_mm + 40
    if yb + 100 > H_ or xr + 300 > W_:
        raise SystemExit('el patron no entra en el lienzo %s a %.1f px/mm: agrandar el lienzo' % (lienzo, px_mm))
    d.line((ox, yb, ox + dx * px_mm, yb), fill=(90, 90, 90), width=4)
    for xx in (ox, ox + dx * px_mm):
        d.line((xx, yb - 16, xx, yb + 16), fill=(90, 90, 90), width=4)
    s = '%.0f mm' % dx
    d.text((ox + dx * px_mm / 2 - d.textlength(s, font=F) / 2, yb + 14), s, font=F, fill=(60, 60, 60))
    d.line((xr, oy, xr, oy + dy * px_mm), fill=(90, 90, 90), width=4)
    for yy in (oy, oy + dy * px_mm):
        d.line((xr - 16, yy, xr + 16, yy), fill=(90, 90, 90), width=4)
    d.text((xr + 26, oy + dy * px_mm / 2 - 40), '%.0f mm' % dy, font=F, fill=(60, 60, 60))
    im.save(out)
    return dict(largo_mm=dx, ancho_mm=dy, area_cm2=a, hueco_de_cierre_mm=hueco)
