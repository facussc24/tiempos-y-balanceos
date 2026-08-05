# -*- coding: utf-8 -*-
r"""
Lee planos de cliente (TIF/JPEG gigantes) por partes, para poder mirarlos de verdad.

Un plano de conjunto viene en una sola imagen de 200+ megapixeles. Abrirlo entero no
sirve: en pantalla entra como una mancha y PIL directamente lo rechaza por
"decompression bomb". El dato que casi siempre se busca (part number, cantidad, peso
calculado, material, norma) esta en la LISTA DE MATERIALES embebida en el plano, que
no esta siempre en el mismo lugar. Por eso este script no va a coordenadas fijas: las
BUSCA, detectando los bloques con lineas horizontales equiespaciadas (= tablas).

    python scripts/_leerPlano.py <plano.tif> --mapa
        Vista general + grilla de zonas del marco + lista de tablas detectadas.

    python scripts/_leerPlano.py <plano.tif> --tabla 2
        Recorta la tabla Nº2 del --mapa, a resolucion legible.

    python scripts/_leerPlano.py <plano.tif> --zona 19-25 --banda inferior
        Recorta por numero de zona del marco (los numeros impresos en el borde).

    python scripts/_leerPlano.py <plano.tif> --box 13107,5158,19847,6565
        Recorta por pixeles exactos.

Los PNG salen a --out (default: ./tmp/planos/) y el script imprime las rutas.

Origen: 2026-08-05. Buscando la medida de un tornillo recorri el plano a ojo, crop por
crop, sin encontrar la lista de materiales; Fak la ubico enseguida y aclaro que "no
siempre esta en el mismo lugar, pero mas o menos". De ahi la deteccion automatica.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # los planos de conjunto pasan los 200 Mpx

OUT_DEFAULT = os.path.join('tmp', 'planos')
ESCALA_MAPA = 8       # reduccion del thumbnail general
MIN_LINEAS = 4        # lineas horizontales para considerar que un bloque es tabla
LARGO_LINEA = 0.04    # una "linea" ocupa al menos este % del ancho del plano


def cargar(ruta):
    im = Image.open(ruta)
    if getattr(im, 'n_frames', 1) > 1:
        im.seek(0)
    return im.convert('L')


def reducir(im, k=ESCALA_MAPA):
    """Reduce k veces quedandose con el pixel MAS OSCURO de cada bloque.

    Promediar (Image.reduce) borra el trazo: una linea de 1 px dentro de un bloque de
    8x8 sale gris claro y deja de detectarse. El minimo la conserva.
    """
    arr = np.asarray(im)
    h, w = arr.shape
    h2, w2 = h // k, w // k
    return arr[:h2 * k, :w2 * k].reshape(h2, k, w2, k).min(axis=(1, 3))


def detectar_tablas(im, chico=None):
    """Devuelve [(x0, y0, x1, y1, n_lineas)] en pixeles del plano original.

    Una tabla se reconoce por sus lineas horizontales largas y repetidas.
    """
    W, H = im.size
    k = ESCALA_MAPA
    chico = (reducir(im, k) if chico is None else chico) < 128
    h, w = chico.shape
    min_run = max(8, int(w * LARGO_LINEA))

    # (fila, x_inicio, x_fin) de CADA linea horizontal larga. Todas, no solo la mas
    # larga de la fila: a una misma altura puede haber varias tablas, y quedarse con
    # una sola hace desaparecer al resto.
    filas = []
    for y in range(h):
        fila = chico[y]
        if fila.sum() < min_run:
            continue
        bordes = np.diff(np.concatenate(([0], fila.view(np.int8), [0])))
        ini = np.where(bordes == 1)[0]
        fin = np.where(bordes == -1)[0]
        for a, b in zip(ini, fin):
            if b - a >= min_run:
                filas.append((y, int(a), int(b)))

    # Agrupar lineas en tablas por sus EXTREMOS: las lineas que separan las filas de
    # una misma tabla empiezan y terminan en el mismo x. Agrupar por proximidad
    # (cualquier linea cercana entra) termina fusionando tablas vecinas hasta formar un
    # bloque del ancho del plano.
    t = 8
    por_clave = {}
    for y, x0, x1 in filas:
        por_clave.setdefault((round(x0 / t), round(x1 / t)), []).append((y, x0, x1))

    grupos = []
    for lineas in por_clave.values():
        lineas.sort()
        bloque = [lineas[0]]
        for ln in lineas[1:]:
            if ln[0] - bloque[-1][0] > 40:   # salto grande en Y: otra tabla
                grupos.append(bloque)
                bloque = []
            bloque.append(ln)
        grupos.append(bloque)

    grupos = [{'y0': b[0][0], 'y1': b[-1][0],
               'x0': min(l[1] for l in b), 'x1': max(l[2] for l in b),
               'n': len(b)} for b in grupos if b]

    tablas = []
    for g in grupos:
        if g['n'] < MIN_LINEAS:
            continue
        if (g['y1'] - g['y0']) < 8:            # una sola linea gruesa, no una tabla
            continue
        if (g['x1'] - g['x0']) > 0.95 * w:     # el marco del plano, no una tabla
            continue
        tablas.append((g['x0'] * k, g['y0'] * k, g['x1'] * k, g['y1'] * k, g['n']))

    tablas.sort(key=lambda t: -(t[2] - t[0]) * (t[3] - t[1]))
    return tablas


def zonas_del_marco(im, tablas):
    """Estima cuantas zonas (los numeros del borde) tiene el plano.

    El marco DIN divide el plano en zonas de ~210 mm. No se leen los numeros: se
    estima por proporcion, que es suficiente para ubicarse y hablar el mismo idioma
    que la columna Feld/Field de la lista de materiales ("J48" = zona 48, fila J).
    """
    W, H = im.size
    cols = max(1, round(W / (H / 8.0)))  # zonas cuadradas aprox.
    return cols, 8


def guardar(im, box, nombre, escala, out):
    os.makedirs(out, exist_ok=True)
    c = im.crop(box)
    w, h = c.size
    if escala != 1.0:
        c = c.resize((max(1, int(w * escala)), max(1, int(h * escala))), Image.LANCZOS)
    ruta = os.path.join(out, nombre + '.png')
    c.save(ruta)
    print('  {}  box={}  {}x{}'.format(ruta, box, c.size[0], c.size[1]))
    return ruta


def escala_legible(box, objetivo=2000):
    """Escala para que el recorte entre en ~2000 px sin achicar de mas."""
    w = box[2] - box[0]
    if w <= objetivo:
        return 1.0
    return round(objetivo / float(w), 3)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('plano')
    ap.add_argument('--mapa', action='store_true', help='vista general + tablas detectadas')
    ap.add_argument('--tabla', type=int, help='recortar la tabla Nº N que listo --mapa')
    ap.add_argument('--zona', help='rango de zonas del marco, ej 19-25')
    ap.add_argument('--banda', choices=['superior', 'medio', 'inferior', 'todo'], default='todo')
    ap.add_argument('--box', help='pixeles exactos x0,y0,x1,y1')
    ap.add_argument('--escala', type=float, help='forzar escala de salida (default: legible)')
    ap.add_argument('--out', default=OUT_DEFAULT)
    a = ap.parse_args()

    if not os.path.isfile(a.plano):
        sys.exit('No existe: ' + a.plano)

    im = cargar(a.plano)
    W, H = im.size
    base = os.path.splitext(os.path.basename(a.plano))[0][:40]

    if a.box:
        box = tuple(int(v) for v in a.box.split(','))
        guardar(im, box, base + '_box', a.escala or escala_legible(box), a.out)
        return

    if a.zona:
        cols, _ = zonas_del_marco(im, None)
        z0, z1 = (a.zona.split('-') + [a.zona])[:2]
        z0, z1 = int(z0), int(z1)
        x0 = int((z0 - 1) / float(cols) * W)
        x1 = int(z1 / float(cols) * W)
        y0, y1 = {'superior': (0, H // 3), 'medio': (H // 3, 2 * H // 3),
                  'inferior': (2 * H // 3, H), 'todo': (0, H)}[a.banda]
        box = (x0, y0, x1, y1)
        guardar(im, box, '{}_z{}-{}_{}'.format(base, z0, z1, a.banda),
                a.escala or escala_legible(box), a.out)
        return

    chico = reducir(im)
    tablas = detectar_tablas(im, chico)

    if a.tabla is not None:
        if not 1 <= a.tabla <= len(tablas):
            sys.exit('Tabla {} fuera de rango (hay {})'.format(a.tabla, len(tablas)))
        x0, y0, x1, y1, n = tablas[a.tabla - 1]
        # El encabezado (Pos. / Part-No. / Benennung / Gewicht...) queda ARRIBA de la
        # primera linea detectada y ocupa un par de filas: sin margen se corta justo el
        # renglon que dice que es cada columna.
        m = 60
        m_top = max(80, int(2.0 * (y1 - y0) / max(n, 1)))
        box = (max(0, x0 - m), max(0, y0 - m_top), min(W, x1 + m), min(H, y1 + m))
        guardar(im, box, '{}_tabla{}'.format(base, a.tabla),
                a.escala or escala_legible(box), a.out)
        return

    # --mapa (default)
    cols, filas = zonas_del_marco(im, tablas)
    print('{}\n  {} x {} px ({:.0f} Mpx) · ~{} zonas horizontales'.format(
        a.plano, W, H, W * H / 1e6, cols))
    os.makedirs(a.out, exist_ok=True)
    ruta = os.path.join(a.out, base + '_mapa.png')
    Image.fromarray(chico).save(ruta)
    print('  vista general: {}'.format(ruta))
    print('\n  {} tablas detectadas (ordenadas por tamaño):'.format(len(tablas)))
    print('  {:>3} {:>26}  {:>7}  {:>6}  {}'.format('Nº', 'box (x0,y0,x1,y1)', 'lineas', 'zonas', 'ancho x alto'))
    for i, (x0, y0, x1, y1, n) in enumerate(tablas, 1):
        z0 = int(x0 / float(W) * cols) + 1
        z1 = int(x1 / float(W) * cols) + 1
        print('  {:>3} {:>26}  {:>7}  {:>6}  {} x {}'.format(
            i, '{},{},{},{}'.format(x0, y0, x1, y1), n,
            '{}-{}'.format(z0, z1), x1 - x0, y1 - y0))
    print('\n  Recortar una: python scripts/_leerPlano.py "{}" --tabla N'.format(a.plano))


if __name__ == '__main__':
    main()
