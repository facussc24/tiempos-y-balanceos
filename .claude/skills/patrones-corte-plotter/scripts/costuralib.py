# -*- coding: utf-8 -*-
"""
costuralib — simular cuanto se mueve la COSTURA al mover los PUNTOS de anclaje.

MODELO (derivado de datos reales, no de teoria):

  La pieza se posiciona en el armado por sus DOS puntos de anclaje. Si esos puntos se
  mueven en el patron, la pieza queda corrida respecto del sustrato, y la costura —que
  viaja con la pieza— cambia su distancia al borde doblado.

  Con dos anclas A y B, mover una sola hace que la pieza PIVOTEE sobre la otra: el efecto
  es maximo en el ancla que se movio y cero en la otra, con degrade lineal en el medio.
  Mover las dos igual es una TRASLACION: el efecto es parejo de punta a punta.

      v(p) = (1-t)*deltaA + t*deltaB        t = proyeccion de p sobre la recta A->B

  Y el cambio en la medida costura->borde en una estacion con normal interior n:

      Delta_d = k * ( v . n )

  SIGNO (confirmado por DOS fuentes independientes):
      el punto SUBE en Y  ->  la medida costura-borde SUBE.
    (a) 23/07: el punto de la punta bajo 8 mm y la medida en la punta bajo (21 -> 18-19).
    (b) 30/07: comparando las dos manos, la cruz de la punta de una esta 6,5 mm mas arriba
        y esa pieza mide 8 mm mas en la zona recta.

  FACTOR k: cuanto del movimiento del punto llega a la costura. NO es 1 por definicion —
  el armado se come parte. Estimado de (b): k = 8/6,5 = 1,23 en la zona recta y
  6/6,5 = 0,92 en la diagonal. De (a): k = 2,5/8 = 0,31. Se usa un RANGO y se reporta el
  abanico de resultados posibles, porque con una sola pieza por punto no alcanza para fijarlo.

  ESTE MODELO NO SE ESPEJA ENTRE MANOS. El patron es una compensacion de lo que tira la
  maquina, y cada mano se comporta distinto. La simetria es un chequeo, no un objetivo.
"""
from __future__ import annotations
import math

K_MIN, K_NOM, K_MAX = 0.31, 1.00, 1.23


def _u(v):
    n = math.hypot(v[0], v[1])
    return (v[0] / n, v[1] / n) if n else (0.0, 0.0)


def borde_inferior(C, x, banda=None):
    """Punto del borde INFERIOR en la columna x, y su normal interior (apunta hacia adentro).
    Devuelve (punto, normal) o None."""
    mejor = None
    n = len(C)
    for i in range(n):
        a, b = C[i], C[(i + 1) % n]
        if (a[0] > x) != (b[0] > x):
            t = (x - a[0]) / (b[0] - a[0])
            y = a[1] + (b[1] - a[1]) * t
            if mejor is None or y < mejor[0]:
                mejor = (y, a, b)
    if mejor is None:
        return None
    y, a, b = mejor
    tang = _u((b[0] - a[0], b[1] - a[1]))
    nor = (-tang[1], tang[0])
    if nor[1] < 0:                       # que apunte hacia arriba/adentro
        nor = (-nor[0], -nor[1])
    return ((x, y), nor)


def borde_cercano(C, p):
    """Segmento del contorno mas cercano a p, y su normal interior."""
    mejor = None
    n = len(C)
    for i in range(n):
        a, b = C[i], C[(i + 1) % n]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L2 = dx * dx + dy * dy
        if L2 == 0:
            continue
        t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2))
        q = (a[0] + t * dx, a[1] + t * dy)
        d = math.hypot(p[0] - q[0], p[1] - q[1])
        if mejor is None or d < mejor[0]:
            mejor = (d, q, a, b)
    d, q, a, b = mejor
    tang = _u((b[0] - a[0], b[1] - a[1]))
    nor = (-tang[1], tang[0])
    # que apunte de la arista HACIA p (hacia adentro)
    if (p[0] - q[0]) * nor[0] + (p[1] - q[1]) * nor[1] < 0:
        nor = (-nor[0], -nor[1])
    return (q, nor, d)


def parametro_t(p, A, B):
    """Donde cae p entre las dos anclas: 0 = sobre A, 1 = sobre B. Se recorta a [0,1]."""
    dx, dy = B[0] - A[0], B[1] - A[1]
    L2 = dx * dx + dy * dy
    if L2 == 0:
        return 0.0
    t = ((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / L2
    return max(0.0, min(1.0, t))


def desplazamiento(p, A, B, dA, dB):
    """Cuanto se corre la pieza en el punto p si el ancla A se mueve dA y la B dB."""
    t = parametro_t(p, A, B)
    return ((1 - t) * dA[0] + t * dB[0], (1 - t) * dA[1] + t * dB[1])


def delta_medida(p, normal, A, B, dA, dB, k=K_NOM):
    """Cuanto cambia la medida costura->borde en la estacion p."""
    v = desplazamiento(p, A, B, dA, dB)
    return k * (v[0] * normal[0] + v[1] * normal[1])


def simular(estaciones, A, B, dA, dB, k=K_NOM):
    """estaciones: [{'nombre','p','normal','medido','objetivo'}, ...]
    Devuelve la lista con 'delta' y 'predicho' agregados."""
    out = []
    for e in estaciones:
        d = delta_medida(e['p'], e['normal'], A, B, dA, dB, k)
        out.append({**e, 'delta': d, 'predicho': e['medido'] + d})
    return out


def resolver(estaciones, A, B, k=K_NOM, solo_y=True, mover=('A', 'B')):
    """Minimos cuadrados: que dA/dB dejan cada estacion lo mas cerca de su objetivo.

    solo_y=True restringe el movimiento a Y (lo habitual: la costura se corrige subiendo o
    bajando el punto). mover permite fijar una de las dos anclas ('B' sola = correccion en
    cuña sobre la punta).
    Devuelve (dA, dB, residuos).
    """
    import numpy as np
    cols = []
    if 'A' in mover:
        cols.append('A')
    if 'B' in mover:
        cols.append('B')
    M, y = [], []
    for e in estaciones:
        t = parametro_t(e['p'], A, B)
        fila = []
        for c in cols:
            w = (1 - t) if c == 'A' else t
            if solo_y:
                fila.append(k * w * e['normal'][1])
            else:
                fila.extend([k * w * e['normal'][0], k * w * e['normal'][1]])
        M.append(fila)
        y.append(e['objetivo'] - e['medido'])
    M = np.array(M, dtype=float)
    y = np.array(y, dtype=float)
    sol, *_ = np.linalg.lstsq(M, y, rcond=None)
    dA = [0.0, 0.0]
    dB = [0.0, 0.0]
    i = 0
    for c in cols:
        if solo_y:
            (dA if c == 'A' else dB)[1] = float(sol[i]); i += 1
        else:
            (dA if c == 'A' else dB)[0] = float(sol[i])
            (dA if c == 'A' else dB)[1] = float(sol[i + 1]); i += 2
    res = simular(estaciones, A, B, tuple(dA), tuple(dB), k)
    return tuple(dA), tuple(dB), res
