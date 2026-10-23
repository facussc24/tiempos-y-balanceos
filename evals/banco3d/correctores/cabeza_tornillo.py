"""Corrector 'cabeza_tornillo': dos fallas del tornillo impreso de 7 mm, medidas por cortes con trimesh.

1. Radio bajo la cabeza (el acuerdo cabeza-vastago). Se gira la pieza con el eje del tornillo vertical y se corta cada
   0,05 mm; en cada corte se toma el pedazo que contiene el eje (el vastago, aunque la cabeza tenga rebaje) y su radio
   en la direccion sin caras planas. Despues de la cabeza, el material de mas sobre el vastago es el acuerdo: para un
   cuarto de circulo de radio R el area de ese sobrante es R^2 (1 - pi/4), de ahi sale R. Sin radio da ~0.
   Rojo si R < umbral - tolerancia. Umbral por defecto 0,9: el radio del tornillo validado (FUENTE, medidas holgura
   0,50.json, fillet_en_la_base_mm 0.9; memoria project_tornillo_cabeza_ancha_impreso.md, v5 «fillet 0,9»).
2. Cabeza que se ensancha en la base (la cara contra la cama, tal como viene el STL): ancho de la cabeza en el corte
   horizontal de abajo contra el de arriba. Rojo si abajo > arriba + tolerancia de ancho.

Uso: python cabeza_tornillo.py <archivo.stl> [--umbral 0.9] [--tolerancia 0.1] [--tol-ancho 0.1]
Imprime UNA linea JSON y sale con 0 (verde), 3 (rojo), 2 (error)."""
import argparse, json, math, sys

import numpy as np
import trimesh
from shapely.geometry import Point, box
from shapely.ops import unary_union

PASO = 0.05


def salir(veredicto, detalle, medidas=None):
    print(json.dumps({'corrector': 'cabeza_tornillo', 'veredicto': veredicto, 'detalle': detalle,
                      'medidas': medidas or {}}, ensure_ascii=True), flush=True)
    sys.exit({'verde': 0, 'rojo': 3}.get(veredicto, 2))


def corte(m, z):
    s = m.section(plane_origin=[0, 0, z], plane_normal=[0, 0, 1])
    if s is None:
        return []
    pl, _ = s.to_2D(to_2D=np.eye(4))
    return list(pl.polygons_full)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('archivo')
    ap.add_argument('--umbral', type=float, default=0.9)
    ap.add_argument('--tolerancia', type=float, default=0.1)
    ap.add_argument('--tol-ancho', type=float, default=0.1)
    a = ap.parse_args()
    if not a.archivo.lower().endswith('.stl'):
        salir('error', 'este corrector trabaja sobre STL')
    m = trimesh.load(a.archivo, force='mesh')
    if not isinstance(m, trimesh.Trimesh) or len(m.faces) == 0:
        salir('error', 'no se pudo leer la malla')
    ext = m.extents
    eje = int(np.argmax(ext))
    otros = [i for i in range(3) if i != eje]
    libre = otros[int(np.argmax(ext[otros]))]       # direccion sin caras planas (la mas ancha)
    # girar: eje del tornillo -> Z, direccion libre -> X
    perm = [libre, [i for i in otros if i != libre][0], eje]
    T = np.zeros((4, 4)); T[3, 3] = 1
    for fila, col in enumerate(perm):
        T[fila, col] = 1
    if np.linalg.det(T[:3, :3]) < 0:
        T[1] *= -1
    g = m.copy(); g.apply_transform(T)
    c = (g.bounds[0] + g.bounds[1]) / 2
    zmin, zmax = g.bounds[0][2], g.bounds[1][2]

    def area_en(z):
        return sum(p.area for p in corte(g, z))
    # la cabeza esta en la punta de mayor seccion
    if area_en(zmax - 1.0) > area_en(zmin + 1.0):
        g.apply_transform(trimesh.transformations.rotation_matrix(math.pi, (1, 0, 0), point=c))
        c = (g.bounds[0] + g.bounds[1]) / 2
        zmin, zmax = g.bounds[0][2], g.bounds[1][2]
    centro = Point(c[0], c[1])
    zs = np.arange(zmin + PASO / 2, min(zmax, zmin + 9.0), PASO)
    perfil = []
    for z in zs:
        nucleo = [p for p in corte(g, z) if p.buffer(1e-6).contains(centro)]
        if not nucleo:
            perfil.append(0.0)
            continue
        xs = np.array(nucleo[0].exterior.coords)[:, 0]
        perfil.append(float(np.max(np.abs(xs - c[0]))))
    perfil = np.array(perfil)
    r_cabeza = float(perfil[: max(1, int(0.5 / PASO))].max())
    en_cabeza = perfil >= 0.85 * r_cabeza
    if not en_cabeza[0]:
        salir('error', 'no se encontro la cabeza en la punta del tornillo')
    fin = int(np.argmin(en_cabeza))                 # primer corte que ya no es cabeza
    if fin == 0:
        salir('error', 'no se encontro donde termina la cabeza')
    largo_cabeza = round(float(zs[fin] - zmin - PASO / 2), 2)
    tramo = perfil[fin: fin + int(2.5 / PASO)]
    if len(tramo) < 10:
        salir('error', 'el tornillo es demasiado corto para medir el vastago')
    r_vastago = float(np.median(perfil[fin + int(1.5 / PASO): fin + int(2.5 / PASO)]))
    sobra = np.clip(tramo - r_vastago, 0, None)
    if (sobra <= 0.005).any():
        sobra = sobra[: int(np.argmax(sobra <= 0.005))]
    area = float(sobra.sum() * PASO)
    radio = math.sqrt(area / (1 - math.pi / 4))
    largo_radio = round(len(sobra) * PASO, 2)

    # ancho de la cabeza abajo y arriba, en la posicion de impresion del STL (Z = capas)
    zb0, zb1 = m.bounds[0][2], m.bounds[1][2]
    lo, hi = m.bounds[0][eje], m.bounds[1][eje]
    cabeza_en_min = area_en_original(m, eje, lo + 0.5) > area_en_original(m, eje, hi - 0.5)
    r0, r1 = (lo, lo + largo_cabeza) if cabeza_en_min else (hi - largo_cabeza, hi)

    def ancho(z):
        polys = corte(m, z)
        if not polys:
            return 0.0
        u = unary_union(polys)
        lim = [m.bounds[0][0], m.bounds[0][1], m.bounds[1][0], m.bounds[1][1]]
        if eje == 0:
            lim[0], lim[2] = r0, r1
        elif eje == 1:
            lim[1], lim[3] = r0, r1
        cab = u.intersection(box(*lim))
        if cab.is_empty:
            return 0.0
        b = cab.bounds
        anchos = [b[2] - b[0], b[3] - b[1]]
        return float(anchos[1] if eje == 0 else anchos[0]) if eje in (0, 1) else float(max(anchos))
    if eje == 2:
        ancho_base = ancho_arriba = None
    else:
        ancho_base, ancho_arriba = round(ancho(zb0 + 0.1), 3), round(ancho(zb1 - 0.1), 3)
    medidas = {'radio_bajo_cabeza_mm': round(radio, 3), 'largo_del_acuerdo_mm': largo_radio,
               'radio_vastago_mm': round(r_vastago, 3), 'radio_cabeza_mm': round(r_cabeza, 3),
               'largo_cabeza_mm': largo_cabeza, 'ancho_cabeza_base_mm': ancho_base,
               'ancho_cabeza_arriba_mm': ancho_arriba, 'umbral_radio_mm': a.umbral, 'tolerancia_mm': a.tolerancia,
               'tol_ancho_mm': a.tol_ancho,
               'umbrales': {'radio_mm': a.umbral, 'tolerancia_mm': a.tolerancia, 'tol_ancho_mm': a.tol_ancho,
                            '_fuente': {'radio_mm': 'medido: fillet_en_la_base_mm 0.9 de "FUENTE (STEP para modificar)/'
                                                    'medidas holgura 0,50.json" (tornillo validado)'
                                        if abs(a.umbral - 0.9) < 1e-9 else 'pasado por --umbral',
                                        'tolerancia_mm': 'banco (23/10/2026), sin fuente de Barack',
                                        'tol_ancho_mm': 'banco (23/10/2026), sin fuente de Barack'}}}
    malos = []
    if radio < a.umbral - a.tolerancia:
        malos.append(f'radio bajo la cabeza {radio:.2f} mm (pide {a.umbral} - {a.tolerancia})')
    if ancho_base is not None and ancho_base > ancho_arriba + a.tol_ancho:
        malos.append(f'la cabeza se ensancha en la base: {ancho_base:.2f} abajo contra {ancho_arriba:.2f} arriba')
    if malos:
        salir('rojo', '; '.join(malos), medidas)
    salir('verde', f'radio bajo la cabeza {radio:.2f} mm; cabeza {ancho_base} abajo / {ancho_arriba} arriba', medidas)


def area_en_original(m, eje, x):
    n = [0, 0, 0]; n[eje] = 1
    o = [0, 0, 0]; o[eje] = x
    s = m.section(plane_origin=o, plane_normal=n)
    if s is None:
        return 0.0
    try:
        return float(s.to_2D()[0].area)
    except Exception:
        return 0.0


if __name__ == '__main__':
    main()
