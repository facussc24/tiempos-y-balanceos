# -*- coding: utf-8 -*-
"""
_verificarFlujogramas.py — que ningun flujograma salga CORTADO.

POR QUE EXISTE
Fak, 18/08/2026: *"un error comun que teniamos es que los flujogramas salian cortados"*.

Es el modo de falla propio de este motor. El layout lo resuelve **flexbox de Chromium**, y
las ramas laterales viven en `position:absolute`: no empujan el ancho del contenedor. El
motor lo compensa calculando un padding derecho e inferior a partir de la profundidad de las
ramas (`getRightPadding` / `getBottomPadding` en `tools/flowchart/Flowchart.jsx`). Si ese
calculo se queda corto, la rama se sale del lienzo y el PNG llega al cliente con una decision
del proceso amputada — **sin error, sin nada raro en el archivo**. Solo se ve mirandolo.

Este chequeo no mira el codigo: mide el PNG. Busca en cada borde el primer pixel que no sea
fondo y exige un margen minimo en los cuatro lados.

POR QUE EN PYTHON Y NO EN NODE, que seria mas coherente con el generador: para leer pixeles
en Node haria falta o una dependencia de imagen nueva, o Chromium — y por Chromium se pelea
dos veces (un `file://` desde `about:blank` lo bloquea el origen, un data URI revienta con
los flujogramas grandes, y cargarlo como hermano `file:` mancha el canvas). PIL lo hace en
cinco lineas y ya esta instalado.

Uso:  python scripts/_verificarFlujogramas.py [carpeta]
      (por defecto tools/flowchart/.build/)

Sale 1 si alguno esta cortado, para encadenarlo despues de generar.
"""
import sys
import io
import os
import glob

from PIL import Image

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARPETA = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(RAIZ, 'tools', 'flowchart', '.build')

FONDO = (243, 244, 246)   # bg-[#F3F4F6], el fondo que usa el motor
TOLERANCIA = 18           # margen de compresion del PNG
MIN = 12                  # px minimos de aire en cada borde
PASO = 7                  # se muestrea 1 de cada 7 px: alcanza y es ~7x mas rapido


def _margen(px, w, h, lado):
    """Cuantos px de fondo limpio hay antes del primer contenido, desde ese borde."""
    def vacio(x, y):
        p = px[x, y]
        if len(p) == 4 and p[3] < 12:
            return True
        return sum(abs(a - b) for a, b in zip(p[:3], FONDO)) <= TOLERANCIA

    if lado in ('izq', 'der'):
        for i in range(w):
            x = i if lado == 'izq' else w - 1 - i
            if any(not vacio(x, y) for y in range(0, h, PASO)):
                return i
        return w
    for i in range(h):
        y = i if lado == 'arr' else h - 1 - i
        if any(not vacio(x, y) for x in range(0, w, PASO)):
            return i
    return h


def main():
    if not os.path.isdir(CARPETA):
        print(f'No existe {CARPETA}. Genera los flujogramas primero: node scripts/_flujograma.mjs --todos')
        return 1
    pngs = sorted(glob.glob(os.path.join(CARPETA, 'FLUJOGRAMA_*.png')))
    if not pngs:
        print(f'No hay flujogramas en {CARPETA}.')
        return 1

    print(f"{'flujograma':<30}{'tamaño':>13}   izq  der  arr  aba   veredicto")
    print('-' * 88)

    cortados = 0
    for f in pngs:
        with Image.open(f) as im:
            im = im.convert('RGBA')
            w, h = im.size
            px = im.load()
            m = {l: _margen(px, w, h, l) for l in ('izq', 'der', 'arr', 'aba')}

        flojos = [l for l, v in m.items() if v < MIN]
        if flojos:
            cortados += 1
        nombre = os.path.basename(f).replace('FLUJOGRAMA_', '').replace('.png', '')
        veredicto = f"CORTADO en {', '.join(flojos)}" if flojos else 'OK'
        print(f"{nombre:<30}{f'{w}x{h}':>13} {m['izq']:>5}{m['der']:>5}{m['arr']:>5}{m['aba']:>5}   {veredicto}")

    print(f"\n{len(pngs) - cortados}/{len(pngs)} sin cortes (margen minimo exigido: {MIN}px)")
    if cortados:
        print('\nUn flujograma cortado casi siempre es una RAMA LATERAL que el padding no alcanzo a')
        print('cubrir. Mirar getRightPadding / getBottomPadding en tools/flowchart/Flowchart.jsx.')
    return 1 if cortados else 0


if __name__ == '__main__':
    sys.exit(main())
