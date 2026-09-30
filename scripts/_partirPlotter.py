# -*- coding: utf-8 -*-
"""Parte en 2 un DXF que no entra en el plotter de corte, y deja cada mitad lista para cortar.

Por que existe: en el plotter (maquina de corte con CUCHILLA, software HTV2A) lo que manda
es el ANCHO del papel o material que esta puesto. Caso que lo origino (30/09/2026): una tapa
de 2000 x 1220 mm y papel de ~900 mm de ancho -> dos tiras de 2000 x 610 que corren a lo
largo del rollo, se pegan borde contra borde sobre la linea del medio y hacen de plantilla.
En el PLT el eje X es el ancho del rollo y el Y el avance (memoria del plotter).

Que hace, y que verifica antes de escribir nada:
  1. Lee LINE + ARC + LWPOLYLINE (todo lo que corta) y saca los tramos DUPLICADOS exactos:
     una linea dibujada dos veces es una doble pasada de cuchilla en el mismo lugar.
  2. Corta el dibujo por una recta vertical u horizontal (por defecto al centro, en el
     sentido que deja mitades que entran en el papel). Cada tramo que la cruza se parte en el
     punto exacto de cruce.
  3. Agrega el corte del medio SOLO donde hay material: se cuentan los cruces de la recta con
     los contornos cerrados (regla par/impar). Donde la recta atraviesa una ranura o un
     agujero no se agrega nada, y la media ranura queda como muesca de cada mitad.
  4. Encadena cada mitad en polilineas: UNA bajada de cuchilla por contorno, no una por tramo.
  5. Gira 90 grados si hace falta para entrar en el ancho del papel (--ancho; --largo si el
     material no es rollo), y lleva cada mitad al origen.
  6. Orden de corte: lo de ADENTRO primero (ranuras, agujeros, punteadas) y el contorno
     exterior AL FINAL. Si el contorno se corta antes, la pieza queda suelta y se mueve.
  7. Verifica y aborta si algo no cierra:
       - largo total cortado: mitades = original sin duplicados + corte del medio (0,000 mm)
       - cada vertice de una mitad es un vertice original o cae sobre la recta de corte
       - ningun nodo con 3 o mas tramos (la cadena seria ambigua)
       - cada mitad entra en el area util
       - el PLT escrito se RELEE y tiene que dar las mismas polilineas que el DXF
     Avisa (sin abortar) los pedacitos de menos de 2 mm que deja el corte: la cuchilla de
     arrastre no los hace bien.

Salida, por mitad: <NOMBRE> - PARTE k de 2.plt (HPGL, 40 unidades/mm, CRLF, todo en SP1) +
.dxf (R2018, mm, capa CORTE) + una imagen de control con el original, las dos mitades y los
archivos tal como van al plotter.

Uso:
    .venv-cad/Scripts/python.exe scripts/_partirPlotter.py ENTRADA.dxf CARPETA_SALIDA
        --ancho 900 [--largo 0] [--nombre "TAPA MEDIO AIRDUCT"]
        [--sentido auto|vertical|horizontal] [--en COORD] [--dry-run]

Los DXF salen a una carpeta temporal y pasan por scripts/_validarDxf.py (AutoCAD) antes de
copiarse al destino: el que dice si un DXF sirve es AutoCAD (regla dxf-entregable.md).
"""
import argparse
import math
import os
import sys
import tempfile
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _mixPlotter import leer_entidades, encadenar, _doc_nuevo  # noqa: E402

PLU_POR_MM = 40          # HPGL: unidades de plotter por mm (igual que patronlib)
TOL = 1e-4               # mm: dos puntas son la misma por debajo de esto
PEDACITO_MIN = 2.0       # mm: tramos mas cortos que esto la cuchilla no los hace bien
AREA_DEFAULT = (1373.0, 1030.0)   # hojas mas grandes que cortaron bien (APB RevB, mixto R2)


class PartirAbortado(Exception):
    pass


# ------------------------------------------------------------------ geometria

def _k(p):
    return (round(p[0] / TOL), round(p[1] / TOL))


def _largo(cad):
    return sum(math.dist(cad[i], cad[i + 1]) for i in range(len(cad) - 1))


def _cerrada(cad):
    return len(cad) > 3 and math.dist(cad[0], cad[-1]) < TOL * 10


def sin_duplicados(tramos):
    vistos, out, dup = set(), [], 0
    for t in tramos:
        a, b = _k(t[0]), _k(t[-1])
        clave = (min(a, b), max(a, b))
        if clave in vistos:
            dup += 1
            continue
        vistos.add(clave)
        out.append([tuple(t[0]), tuple(t[-1])])
    return out, dup


def _punto(e, s, v):
    """Punto con coordenada e = s y la otra = v (e = 0: recta vertical x = s;
    e = 1: recta horizontal y = s)."""
    return (s, v) if e == 0 else (v, s)


def _cruce(a, b, s, e):
    """Punto de cruce del tramo a-b con la recta de corte. Misma formula para el contorno
    y para el corte del medio: asi las dos puntas coinciden exacto y la cadena cierra."""
    o = 1 - e
    t = (s - a[e]) / (b[e] - a[e])
    return _punto(e, s, a[o] + t * (b[o] - a[o]))


def partir_tramos(tramos, s, e=0):
    """Devuelve (lado menor, lado mayor) respecto de la recta p[e] = s. Un tramo que la
    cruza se parte en el punto de cruce."""
    menor, mayor = [], []
    for a, b in tramos:
        da, db = a[e] - s, b[e] - s
        if abs(da) < TOL and abs(db) < TOL:
            raise PartirAbortado(
                f'La recta de corte {"xy"[e]}={s:.3f} cae justo sobre una linea del dibujo '
                f'({a} -> {b}). Correla con --en.')
        if da <= TOL and db <= TOL:
            menor.append([a, b])
        elif da >= -TOL and db >= -TOL:
            mayor.append([a, b])
        else:
            p = _cruce(a, b, s, e)
            lado_a, lado_b = (menor, mayor) if da < 0 else (mayor, menor)
            lado_a.append([a, p])
            lado_b.append([p, b])
    return menor, mayor


def dentro(q, poli):
    """Par/impar clasico. poli: lista de puntos con poli[0] == poli[-1]."""
    x, y = q
    c = False
    for i in range(len(poli) - 1):
        (x1, y1), (x2, y2) = poli[i], poli[i + 1]
        if (y1 > y) != (y2 > y):
            if x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                c = not c
    return c


def corte_del_medio(cerradas, s, e=0):
    """Segmentos sobre la recta p[e] = s donde hay MATERIAL: dentro de un numero impar de
    contornos cerrados (el exterior cuenta 1, una ranura adentro lo vuelve par)."""
    o = 1 - e
    vs = []
    for cad in cerradas:
        for i in range(len(cad) - 1):
            a, b = cad[i], cad[i + 1]
            if (a[e] < s) != (b[e] < s):            # semiabierto: un vertice en s cuenta 1 vez
                vs.append(_cruce(a, b, s, e)[o])
    vs.sort()
    segs = []
    for v0, v1 in zip(vs, vs[1:]):
        if v1 - v0 < TOL:
            continue
        n = sum(dentro(_punto(e, s, (v0 + v1) / 2), cad) for cad in cerradas)
        if n % 2 == 1:
            segs.append([_punto(e, s, v0), _punto(e, s, v1)])
    return segs


def _grados(tramos):
    g = Counter()
    for t in tramos:
        g[_k(t[0])] += 1
        g[_k(t[-1])] += 1
    return g


def armar_mitad(tramos, corte):
    ts = [t for t in tramos if math.dist(t[0], t[-1]) > TOL] + corte
    g = _grados(ts)
    if max(g.values()) > 2:
        raise PartirAbortado('Hay un nodo con 3 o mas tramos: la cadena seria ambigua.')
    cadenas = encadenar(ts, tol=TOL)
    cerradas = [c for c in cadenas if _cerrada(c)]
    abiertas = [c for c in cadenas if not _cerrada(c)]
    # exterior = cerrada que no esta dentro de ninguna otra
    ext, inter = [], []
    for c in cerradas:
        if any(o is not c and dentro(c[0], o) for o in cerradas):
            inter.append(c)
        else:
            ext.append(c)
    return {'exterior': ext, 'interior': inter, 'abiertas': abiertas}


def _bbox(cads):
    xs = [p[0] for c in cads for p in c]
    ys = [p[1] for c in cads for p in c]
    return min(xs), min(ys), max(xs), max(ys)


def _todas(m):
    return m['interior'] + m['abiertas'] + m['exterior']


def _entra(w, h, area):
    """area = (ancho, largo). X = ancho del rollo; Y corre a lo largo del rollo
    (memoria del plotter: el eje Y del PLT es el avance). largo = 0: rollo sin limite."""
    W, H = area
    return w <= W + TOL and (H <= 0 or h <= H + TOL)


def _txt_area(area):
    return f'{area[0]:.0f} de ancho' + (f' x {area[1]:.0f} de largo' if area[1] > 0 else '')


def orientar(m, area):
    """Gira 90 grados (antihorario) solo si hace falta para entrar en el area util, y
    lleva la mitad al origen. Todo junto, con el mismo minimo."""
    x0, y0, x1, y1 = _bbox(_todas(m))
    w, h = x1 - x0, y1 - y0
    if _entra(w, h, area):
        rot = False
    elif _entra(h, w, area):
        rot = True
    else:
        raise PartirAbortado(
            f'La mitad mide {w:.1f} x {h:.1f} mm y no entra en {_txt_area(area)} '
            f'ni girada. Hay que partir en mas pedazos.')
    f = (lambda p: (-p[1], p[0])) if rot else (lambda p: p)
    out = {k: [[f(p) for p in c] for c in v] for k, v in m.items()}
    x0, y0, _, _ = _bbox(_todas(out))
    out = {k: [[(p[0] - x0, p[1] - y0) for p in c] for c in v] for k, v in out.items()}
    return out, rot


def orden_de_corte(m):
    """Lo de adentro primero, por vecino mas cercano (menos viaje en vacio); el contorno
    exterior al final."""
    pend = m['interior'] + m['abiertas']
    out, pos = [], (0.0, 0.0)
    while pend:
        i = min(range(len(pend)), key=lambda j: math.dist(pos, pend[j][0]))
        c = pend.pop(i)
        if not _cerrada(c) and math.dist(pos, c[-1]) < math.dist(pos, c[0]):
            c = c[::-1]
        out.append(c)
        pos = c[-1]
    return out + m['exterior']


# ------------------------------------------------------------------ escritura

def escribir_plt(path, cadenas):
    def plu(p):
        return f'{round(p[0] * PLU_POR_MM)},{round(p[1] * PLU_POR_MM)}'
    o = ['IN;', 'SP1;']
    for c in cadenas:
        o.append(f'PU{plu(c[0])};')
        o.append('PD' + ','.join(plu(p) for p in c[1:]) + ';')
    o.append('PU;SP0;')
    with open(path, 'w', newline='') as f:        # newline='' + \r\n = CRLF real
        f.write('\r\n'.join(o) + '\r\n')


def leer_plt(path):
    """Relee el PLT a mm: [(pluma, [(x, y), ...]), ...]."""
    txt = open(path).read().replace('\r', '').replace('\n', '')
    pluma, act, out = 0, [], []
    for cmd in txt.split(';'):
        cmd = cmd.strip()
        if cmd.startswith('SP'):
            if act:
                out.append((pluma, act)); act = []
            pluma = int(cmd[2:] or 0)
        elif cmd.startswith(('PU', 'PD')) and len(cmd) > 2:
            n = [float(v) / PLU_POR_MM for v in cmd[2:].split(',')]
            pts = list(zip(n[0::2], n[1::2]))
            if cmd.startswith('PD'):
                act.extend(pts)
            else:
                if act:
                    out.append((pluma, act))
                act = list(pts)
    if act:
        out.append((pluma, act))
    return out


def escribir_dxf(path, cadenas):
    doc = _doc_nuevo()
    ms = doc.modelspace()
    for c in cadenas:
        cer = _cerrada(c)
        ms.add_lwpolyline(c[:-1] if cer else c, close=cer, dxfattribs={'layer': 'CORTE'})
    doc.saveas(path)


# ------------------------------------------------------------------ imagen

def imagen(path, original, s, e, mitades_marco, archivos, nombre, area):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    AZUL, ROJO, VERDE = '#1f4e8a', '#c0392b', '#1e8449'
    fig = plt.figure(figsize=(16, 13))
    ax0 = fig.add_subplot(2, 2, 1)
    for t in original:
        ax0.plot([t[0][0], t[1][0]], [t[0][1], t[1][1]], color=AZUL, lw=0.7)
    x0, y0, x1, y1 = _bbox(original)
    if e == 0:
        ax0.plot([s, s], [y0 - 40, y1 + 40], color=ROJO, lw=1.6, ls='--')
    else:
        ax0.plot([x0 - 40, x1 + 40], [s, s], color=ROJO, lw=1.6, ls='--')
    ax0.set_aspect('equal'); ax0.axis('off')
    ax0.set_title(f'{nombre}\noriginal {x1 - x0:.0f} x {y1 - y0:.0f} mm, '
                  f'linea de union en rojo', fontsize=12)
    ax1 = fig.add_subplot(2, 2, 2)
    sep = 120
    for k, m in enumerate(mitades_marco):
        d = -sep / 2 if k == 0 else sep / 2
        for c in _todas(m):
            ax1.plot([p[0] + (d if e == 0 else 0) for p in c],
                     [p[1] + (d if e == 1 else 0) for p in c], color=VERDE, lw=0.7)
    ax1.set_aspect('equal'); ax1.axis('off')
    ax1.set_title('las dos partes separadas: se unen borde contra borde\n'
                  'por la linea roja', fontsize=12)
    for k, (cads, rot) in enumerate(archivos):
        ax = fig.add_subplot(2, 2, 3 + k)
        if area[0] > 0:
            ax.axvline(area[0], color=ROJO, lw=1, ls=':')
            ax.text(area[0], 0, f'  ancho del papel {area[0]:.0f}', color=ROJO,
                    rotation=90, va='bottom', fontsize=9)
        for c in cads:
            ax.plot([p[0] for p in c], [p[1] for p in c], color=AZUL, lw=0.7)
        ext = cads[-1]
        ax.plot([p[0] for p in ext], [p[1] for p in ext], color=VERDE, lw=1.2)
        bx0, by0, bx1, by1 = _bbox(cads)
        ax.set_aspect('equal')
        ax.set_title(f'PARTE {k + 1} de 2 - como va al plotter\n{bx1 - bx0:.1f} x '
                     f'{by1 - by0:.1f} mm' + (' (girada 90 grados)' if rot else ''),
                     fontsize=11)
        ax.set_xlabel('X (mm)'); ax.set_ylabel('Y (mm)')
        ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=110)
    plt.close(fig)


# ------------------------------------------------------------------ main

def elegir_corte(bb, area, sentido):
    """Devuelve e: 0 = recta vertical (parte el largo en X), 1 = recta horizontal.
    En 'auto' prueba primero cortar a traves del lado largo y se queda con el primero
    cuyas mitades entran en el papel (derechas o giradas)."""
    x0, y0, x1, y1 = bb
    w, h = x1 - x0, y1 - y0
    if sentido == 'vertical':
        return 0
    if sentido == 'horizontal':
        return 1
    opciones = [0, 1] if w >= h else [1, 0]
    for e in opciones:
        mw, mh = (w / 2, h) if e == 0 else (w, h / 2)
        if _entra(mw, mh, area) or _entra(mh, mw, area):
            return e
    raise PartirAbortado(f'Pieza de {w:.1f} x {h:.1f} mm: ninguna de las dos formas de '
                         f'partirla en 2 entra en {_txt_area(area)}. Hacen falta mas partes.')


def partir(entrada, salida, nombre, pos=None, sentido='auto', area=AREA_DEFAULT, dry=False):
    tramos, circulos = leer_entidades(entrada)
    if circulos:
        raise PartirAbortado('El dibujo trae CIRCLE: este script todavia no los reparte.')
    tramos, dup = sin_duplicados(tramos)
    bb = _bbox(tramos)
    x0, y0, x1, y1 = bb
    e = elegir_corte(bb, area, sentido)
    s = pos if pos is not None else ((x0 + x1) / 2 if e == 0 else (y0 + y1) / 2)
    print(f'Original: {len(tramos) + dup} tramos ({dup} duplicados sacados), '
          f'{x1 - x0:.3f} x {y1 - y0:.3f} mm. Papel: {_txt_area(area)}. '
          f'Corte {"vertical" if e == 0 else "horizontal"} en {"xy"[e]} = {s:.6f}')

    cad_orig = encadenar(tramos, tol=TOL)
    cerradas = [c for c in cad_orig if _cerrada(c)]
    corte = corte_del_medio(cerradas, s, e)
    izq, der = partir_tramos(tramos, s, e)
    mitades = [armar_mitad(izq, corte), armar_mitad(der, [list(q) for q in corte])]

    # --- verificacion: largo total
    L_orig = sum(_largo(t) for t in tramos)
    L_corte = sum(_largo(s) for s in corte)
    L_mit = sum(_largo(c) for m in mitades for c in _todas(m))
    dif = abs(L_mit - (L_orig + 2 * L_corte))
    print(f'Largo cortado: original {L_orig:.3f} + corte del medio 2 x {L_corte:.3f} '
          f'= {L_orig + 2 * L_corte:.3f} | mitades {L_mit:.3f} | diferencia {dif:.6f} mm')
    if dif > 1e-3:
        raise PartirAbortado('El largo total no cierra: se perdio o se agrego geometria.')

    # --- verificacion: vertices
    orig_v = {_k(p) for t in tramos for p in t}
    for k, m in enumerate(mitades):
        raros = [p for c in _todas(m) for p in c
                 if _k(p) not in orig_v and abs(p[e] - s) > TOL]
        if raros:
            raise PartirAbortado(f'Parte {k + 1}: {len(raros)} vertices que no son del '
                                 f'original ni caen sobre el corte, ej. {raros[0]}')
    print('Vertices: todos son del original o caen sobre la recta de corte.')

    pedacitos = [(k + 1, _largo(c)) for k, m in enumerate(mitades)
                 for c in m['abiertas'] if _largo(c) < PEDACITO_MIN]
    for k, L in pedacitos:
        print(f'  AVISO parte {k}: pedacito de {L:.2f} mm (la cuchilla no lo hace bien)')

    archivos = []
    for k, m in enumerate(mitades):
        mo, rot = orientar(m, area)
        seq = orden_de_corte(mo)
        bx0, by0, bx1, by1 = _bbox(seq)
        print(f'PARTE {k + 1}: {bx1 - bx0:.3f} x {by1 - by0:.3f} mm'
              f'{" (girada 90)" if rot else ""} | contorno exterior {len(mo["exterior"])}, '
              f'ranuras/agujeros {len(mo["interior"])}, punteadas {len(mo["abiertas"])} '
              f'= {len(seq)} bajadas de cuchilla')
        if len(mo['exterior']) != 1:
            raise PartirAbortado(f'Parte {k + 1}: {len(mo["exterior"])} contornos '
                                 f'exteriores (se esperaba 1).')
        archivos.append((seq, rot))

    if dry:
        return
    os.makedirs(salida, exist_ok=True)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from _validarDxf import normalizar, entregar_dxf
    tmp = tempfile.mkdtemp(prefix='partir_')
    for k, (seq, rot) in enumerate(archivos):
        base = f'{nombre} - PARTE {k + 1} de 2'
        plt = os.path.join(salida, base + '.plt')
        escribir_plt(plt, seq)
        leido = leer_plt(plt)
        dmax = max(math.dist(p, q) for (_, a), b in zip(leido, seq) for p, q in zip(a, b))
        if len(leido) != len(seq) or any(len(a) != len(b) for (_, a), b in zip(leido, seq)) \
                or dmax > 0.5 / PLU_POR_MM + 1e-9 or {p for p, _ in leido} != {1}:
            raise PartirAbortado(f'{plt}: al releerlo no coincide con lo que se escribio.')
        print(f'  {os.path.basename(plt)}: releido, {len(leido)} trazos en SP1, '
              f'redondeo max {dmax:.4f} mm')
        crudo = os.path.join(tmp, base + '_crudo.dxf')
        norm = os.path.join(tmp, base + '.dxf')
        escribir_dxf(crudo, seq)
        normalizar(crudo, norm)
        entregar_dxf(norm, os.path.join(salida, base + '.dxf'))
        print(f'  {base}.dxf: AutoCAD lo abrio limpio y se copio')

    marco = [armar_mitad(izq, corte), armar_mitad(der, [list(q) for q in corte])]
    png = os.path.join(salida, f'{nombre} - control del corte.png')
    imagen(png, tramos, s, e, marco, archivos, nombre, area)
    print(f'  {os.path.basename(png)}')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('entrada')
    ap.add_argument('salida')
    ap.add_argument('--nombre', default=None)
    ap.add_argument('--ancho', type=float, required=True,
                    help='ancho del papel/material puesto en el plotter, en mm')
    ap.add_argument('--largo', type=float, default=0.0,
                    help='largo maximo a lo largo del rollo, mm (0 = rollo, sin limite)')
    ap.add_argument('--sentido', choices=['auto', 'vertical', 'horizontal'], default='auto',
                    help='recta de corte; auto = la que deja mitades que entran')
    ap.add_argument('--en', type=float, default=None,
                    help='coordenada de la recta de corte (default: el centro)')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    nombre = a.nombre or os.path.splitext(os.path.basename(a.entrada))[0]
    try:
        partir(a.entrada, a.salida, nombre, a.en, a.sentido, (a.ancho, a.largo), a.dry_run)
    except PartirAbortado as e:
        sys.exit(f'ABORTADO: {e}')


if __name__ == '__main__':
    main()
