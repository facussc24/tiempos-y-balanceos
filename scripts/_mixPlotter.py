# -*- coding: utf-8 -*-
"""Arma una hoja (mix) para el plotter de corte a partir de un DXF que trae las 2 manos.

Por que existe: el plotter de Barack es una maquina de CORTE CON CUCHILLA de arrastre.
Eso fija tres cosas que este script garantiza y verifica:

  1. La cuchilla solo corta mientras se DESPLAZA -> los puntos de anclaje van como
     circulo recorrido varias VUELTAS, no como cruz (en una X entra de canto, sin filo).
  2. Las piezas son cunas: la separacion se mide CONTORNO CONTRA CONTORNO, nunca entre
     bounding boxes. Dos cajas a 15 mm pueden tener los filos a 3.
  3. El contorno de un patron mezcla LINE + ARC + LWPOLYLINE. Tomar solo un tipo deja la
     pieza incompleta y no se ve mirando.

Las lineas de costura NO se cortan: se detectan porque quedan con puntas sin pareja
(el contorno cierra, la costura no) y se descartan.

Uso:
    python scripts/_mixPlotter.py ENTRADA.dxf SALIDA.dxf [opciones]

    --filas N        piezas por columna            (default 4)
    --sep MM         separacion real minima         (default 15.0)
    --diam MM        diametro del circulo de anclaje(default 3.0)
    --vueltas N      vueltas del circulo            (default 3)
    --sep-col MM     separacion entre COLUMNAS (default: la de --sep)
    --partir         emite ademas _1_AGUJEROS y _2_CONTORNO
    --dry-run        solo mide y reporta, no escribe
"""
import argparse
import math
import os
import sys
from collections import defaultdict

import numpy as np

try:
    import ezdxf
    from scipy.spatial import cKDTree
except ImportError:  # pragma: no cover
    sys.exit('faltan ezdxf / scipy — usar el interprete de .venv-cad')

TOL_UNION = 0.05        # mm: dos puntas se consideran unidas por debajo de esto
PASO_DENS = 1.0         # mm: densificado para medir separacion real


# ------------------------------------------------------------------ lectura

def _arco_a_segmentos(e, n=24):
    c, r = (e.dxf.center.x, e.dxf.center.y), e.dxf.radius
    a0 = math.radians(e.dxf.start_angle)
    a1 = math.radians(e.dxf.end_angle)
    if a1 < a0:
        a1 += 2 * math.pi
    pts = [(c[0] + r * math.cos(a0 + (a1 - a0) * k / n),
            c[1] + r * math.sin(a0 + (a1 - a0) * k / n)) for k in range(n + 1)]
    return [(pts[k], pts[k + 1]) for k in range(n)]


def leer_entidades(path):
    """Devuelve (polilineas, circulos). Cada polilinea es una lista de puntos;
    se conserva de que entidad vino para poder descartar la costura despues."""
    ms = ezdxf.readfile(path).modelspace()
    tramos, circulos = [], []
    for e in ms:
        t = e.dxftype()
        if t == 'LINE':
            tramos.append([(e.dxf.start.x, e.dxf.start.y), (e.dxf.end.x, e.dxf.end.y)])
        elif t == 'ARC':
            for a, b in _arco_a_segmentos(e):
                tramos.append([a, b])
        elif t == 'CIRCLE':
            circulos.append((e.dxf.center.x, e.dxf.center.y, e.dxf.radius * 2))
        elif t == 'LWPOLYLINE':
            p = [(q[0], q[1]) for q in e.get_points()]
            if e.closed:
                p = p + [p[0]]
            for k in range(len(p) - 1):
                tramos.append([p[k], p[k + 1]])
    return tramos, circulos


def descartar_puntas_libres(tramos):
    """El contorno cierra; la costura no. Se quitan iterativamente los tramos que
    tienen una punta sin pareja, hasta que solo queden cadenas cerradas."""
    vivos = list(range(len(tramos)))
    while True:
        conteo = defaultdict(list)
        for i in vivos:
            for p in (tramos[i][0], tramos[i][-1]):
                conteo[(round(p[0] / TOL_UNION), round(p[1] / TOL_UNION))].append(i)
        sueltos = {i for k, v in conteo.items() if len(v) == 1 for i in v}
        if not sueltos:
            return vivos, len(tramos) - len(vivos)
        vivos = [i for i in vivos if i not in sueltos]
        if not vivos:
            return [], len(tramos)


def separar_manos(tramos, circulos):
    """Parte el dibujo en 2 por el hueco mas grande en X."""
    xs = sorted({round(q[0], 1) for t in tramos for q in t})
    saltos = [(xs[i + 1] - xs[i], xs[i]) for i in range(len(xs) - 1)]
    if not saltos:
        raise SystemExit('no puedo separar las manos: geometria vacia')
    ancho, x0 = max(saltos)
    corte = x0 + ancho / 2
    manos = []
    for dentro in (lambda v: v < corte, lambda v: v >= corte):
        T = [t for t in tramos if dentro(sum(q[0] for q in t) / len(t))]
        C = [c for c in circulos if dentro(c[0])]
        pts = np.array([q for t in T for q in t])
        off = pts.min(axis=0)
        manos.append(([[(q[0] - off[0], q[1] - off[1]) for q in t] for t in T],
                      [(c[0] - off[0], c[1] - off[1], c[2]) for c in C]))
    return manos


# ------------------------------------------------------------------ geometria

def densificar(tramos, paso=PASO_DENS):
    out = []
    for t in tramos:
        for k in range(len(t) - 1):
            a, b = np.array(t[k]), np.array(t[k + 1])
            d = np.linalg.norm(b - a)
            n = max(1, int(d / paso))
            for j in range(n):
                out.append(a + (b - a) * j / n)
    return np.array(out)


def circulo(cx, cy, diam, vueltas, n=72):
    r = diam / 2
    return [(cx + r * math.cos(2 * math.pi * k / n),
             cy + r * math.sin(2 * math.pi * k / n)) for k in range(int(n * vueltas) + 1)]


def bbox(tramos):
    p = np.array([q for t in tramos for q in t])
    return p.min(axis=0), p.max(axis=0)


def trasladar(tramos, circulos, dx, dy):
    return ([[(q[0] + dx, q[1] + dy) for q in t] for t in tramos],
            [(c[0] + dx, c[1] + dy, c[2]) for c in circulos])


# ------------------------------------------------------------------ armado

def armar(manos, filas, sep_real, diam, vueltas, sep_col=None):
    """Coloca 2 columnas x `filas`. Busca el offset minimo que garantiza `sep_real`
    medida contorno contra contorno — no entre bboxes."""
    (T0, C0), (T1, C1) = manos
    _, max0 = bbox(T0)
    _, max1 = bbox(T1)
    alto = max(max0[1], max1[1])
    D0, D1 = densificar(T0), densificar(T1)

    def sep(a, b):
        return cKDTree(b).query(a)[0].min()

    # separacion vertical: misma mano, una arriba de otra
    dy = sep_real
    while sep(D0, D0 + np.array([0.0, alto + dy])) < sep_real - 1e-6:
        dy += 0.25
    paso_y = alto + dy

    # separacion horizontal: mano izquierda contra derecha, con el peor solape vertical.
    # Va aparte de la vertical: Fak pide MAS aire entre columnas que entre filas, para
    # poder levantar una columna sin tocar la otra.
    objetivo_col = sep_col if sep_col is not None else sep_real
    ancho = max(max0[0], max1[0])
    dx = objetivo_col
    while True:
        peor = min(sep(D0 + np.array([0.0, i * paso_y]), D1 + np.array([ancho + dx, j * paso_y]))
                   for i in range(filas) for j in range(filas))
        if peor >= objetivo_col - 1e-6:
            break
        dx += 0.25
    paso_x = ancho + dx

    piezas = []
    for col, (T, C) in enumerate(manos):
        for f in range(filas):
            t, c = trasladar(T, C, col * paso_x, f * paso_y)
            piezas.append({'mano': 'IZQUIERDA' if col == 0 else 'DERECHA',
                           'fila': f + 1, 'tramos': t, 'circulos': c,
                           'delta': (col * paso_x, f * paso_y)})
    return piezas, paso_x, paso_y


def _doc_nuevo():
    doc = ezdxf.new('R2018', setup=True)
    doc.header['$INSUNITS'] = 4
    doc.header['$MEASUREMENT'] = 1
    if 'CORTE' not in doc.layers:
        doc.layers.add('CORTE', color=7)
    return doc


def _poner_circulos(ms, piezas, diam, vueltas):
    """Los agujeros van como entidad CIRCLE nativa, una por pasada.

    NO como polilinea: un circulo de O3 poligonizado en 72 lados da segmentos de
    0,13 mm, y el look-ahead del controlador tiene que frenar en cada vertice —
    la velocidad cae a casi cero y **la cuchilla baja y se queda quieta sin cortar**.
    Sintoma real reportado por Fak. Los patrones de la empresa que SI cortan usan
    CIRCLE nativo; el controlador lo interpola con su propia resolucion.
    """
    for pz in piezas:
        for (cx, cy, _) in pz['circulos']:
            for _ in range(max(1, vueltas)):
                ms.add_circle((cx, cy), diam / 2, dxfattribs={'layer': 'CORTE'})


def escribir(piezas, salida, diam, vueltas, partir=False):
    """TODOS los circulos primero, TODOS los contornos despues.

    Es la regla que mas caro se paga: una vez cortado el contorno la pieza queda
    suelta, se mueve, y el agujero de esa pieza sale mal o directamente no sale.
    Escribir pieza por pieza (contorno + sus agujeros) rompe esto aunque el
    archivo parezca ordenado.

    Con partir=True se emiten ademas dos archivos, _1_AGUJEROS y _2_CONTORNO, para
    cuando el plotter reordena por su cuenta y no respeta el orden del archivo.
    Comparten origen porque salen de las mismas coordenadas absolutas.
    """
    doc = _doc_nuevo()
    ms = doc.modelspace()
    _poner_circulos(ms, piezas, diam, vueltas)           # 1) agujeros
    for pz in piezas:                                    # 2) contornos
        for t in pz['tramos']:
            ms.add_lwpolyline(t, close=False, dxfattribs={'layer': 'CORTE'})
    doc.saveas(salida)

    if partir:
        base, ext = os.path.splitext(salida)
        d1 = _doc_nuevo(); m1 = d1.modelspace()
        _poner_circulos(m1, piezas, diam, vueltas)
        d1.saveas(f'{base}_1_AGUJEROS{ext}')
        d2 = _doc_nuevo(); m2 = d2.modelspace()
        for pz in piezas:
            for t in pz['tramos']:
                m2.add_lwpolyline(t, close=False, dxfattribs={'layer': 'CORTE'})
        d2.saveas(f'{base}_2_CONTORNO{ext}')


def verificar_orden(salida, n_vert_circulo=None):
    """Relee el archivo escrito y exige que no quede ningun agujero despues de un
    contorno. Se comprueba sobre el archivo, no sobre la intencion del codigo."""
    ms = ezdxf.readfile(salida).modelspace()
    sec = ['O' if e.dxftype() == 'CIRCLE' else '.' for e in ms]
    s = ''.join(sec)
    ultimo_circ = s.rfind('O')
    primer_cont = s.find('.')
    ok = ultimo_circ < primer_cont if 'O' in s else True
    return ok, s.count('O'), ultimo_circ, primer_cont


# ------------------------------------------------------------------ main

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('entrada')
    ap.add_argument('salida')
    ap.add_argument('--filas', type=int, default=4)
    ap.add_argument('--sep', type=float, default=15.0)
    ap.add_argument('--diam', type=float, default=3.0)
    ap.add_argument('--vueltas', type=int, default=3)
    ap.add_argument('--sep-col', type=float, default=None, dest='sep_col',
                    help='separacion real minima entre COLUMNAS (default: la de --sep)')
    ap.add_argument('--partir', action='store_true',
                    help='ademas del archivo unico, emite _1_AGUJEROS y _2_CONTORNO')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    tramos, circulos = leer_entidades(a.entrada)
    vivos, descartados = descartar_puntas_libres(tramos)
    print(f'{os.path.basename(a.entrada)}')
    print(f'   tramos {len(tramos)} | contorno {len(vivos)} | descartados por punta libre '
          f'(lineas de costura) {descartados} | circulos {len(circulos)}')
    if descartados == 0:
        print('   AVISO: no se descarto nada — revisar que el archivo traiga la costura')

    manos = separar_manos([tramos[i] for i in vivos], circulos)
    for i, (T, C) in enumerate(manos):
        mn, mx = bbox(T)
        print(f'   mano {i+1}: bbox {mx[0]-mn[0]:8.3f} x {mx[1]-mn[1]:8.3f} mm | '
              f'circulos {len(C)}')

    # Espejo entre manos. OJO: con densificado grueso el vecino mas cercano da un error
    # del orden del paso y parece asimetria. Se mide fino (0,05) y el umbral va acorde:
    # si el resultado baja proporcional al paso, lo que se estaba midiendo era el muestreo.
    PASO_ESP = 0.05
    A = densificar(manos[0][0], PASO_ESP); B = densificar(manos[1][0], PASO_ESP).copy()
    B[:, 0] = B[:, 0].max() - B[:, 0]
    esp = max(cKDTree(B).query(A)[0].max(), cKDTree(A).query(B)[0].max())
    print(f'   espejo izq/der: desviacion max {esp:.4f} mm (densificado {PASO_ESP}) '
          f'-> {"SIMETRICOS OPUESTOS" if esp < 2 * PASO_ESP else "*** NO son espejo ***"}')

    piezas, paso_x, paso_y = armar(manos, a.filas, a.sep, a.diam, a.vueltas, a.sep_col)

    # --- verificacion ---
    dens = [densificar(p['tramos']) for p in piezas]
    peor, par = 1e9, None
    for i in range(len(dens)):
        for j in range(i + 1, len(dens)):
            s = cKDTree(dens[j]).query(dens[i])[0].min()
            if s < peor:
                peor, par = s, (i, j)
    todo = np.vstack(dens)
    izq = sum(1 for p in piezas if p['mano'] == 'IZQUIERDA')
    ncirc = sum(len(p['circulos']) for p in piezas)
    rec = sum(math.dist(c[0], c[1]) for c in
              zip(circulo(0, 0, a.diam, a.vueltas)[:-1], circulo(0, 0, a.diam, a.vueltas)[1:]))

    print(f'\n   piezas {len(piezas)} ({izq} izq + {len(piezas)-izq} der) | '
          f'circulos O{a.diam} x{a.vueltas} vueltas = {ncirc}  ({rec:.2f} mm de recorrido c/u)')
    print(f'   paso entre columnas {paso_x:.3f} mm | entre filas {paso_y:.3f} mm')
    minimo = min(a.sep, a.sep_col) if a.sep_col is not None else a.sep
    print(f'   SEPARACION REAL minima {peor:.3f} mm entre pieza {par[0]+1} y {par[1]+1} '
          f'-> {"OK" if peor >= minimo - 1e-6 else "*** POR DEBAJO DEL MINIMO ***"}')
    print(f'   bbox hoja {todo[:,0].max()-todo[:,0].min():.3f} x '
          f'{todo[:,1].max()-todo[:,1].min():.3f} mm')

    if peor < minimo - 1e-6:
        sys.exit('*** ABORTADO: la separacion real quedo por debajo del minimo ***')

    if a.dry_run:
        print('\n   dry-run: no se escribio nada')
        return
    escribir(piezas, a.salida, a.diam, a.vueltas, partir=a.partir)

    ok, ncirc, ult, pri = verificar_orden(a.salida)
    print(f'\n   ORDEN DE CORTE: {ncirc} agujeros, el ultimo en la posicion {ult}; '
          f'primer tramo de contorno en la {pri}')
    print(f'   -> {"OK: todos los agujeros van ANTES del contorno" if ok else "*** MAL: hay agujeros despues de un contorno ***"}')
    if not ok:
        sys.exit('*** ABORTADO: con ese orden la pieza queda suelta antes de su agujero ***')
    print(f'\n   escrito {a.salida}')
    if a.partir:
        base, ext = os.path.splitext(a.salida)
        print(f'   escrito {base}_1_AGUJEROS{ext}')
        print(f'   escrito {base}_2_CONTORNO{ext}')


if __name__ == '__main__':
    main()
