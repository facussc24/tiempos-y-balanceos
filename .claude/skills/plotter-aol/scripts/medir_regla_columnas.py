"""Cuanto material deja la regla de columnas del plotter de corte, con LAS MISMAS condiciones de Fak (tanda 13, item 10).

  py -3 .claude/skills/plotter-aol/scripts/medir_regla_columnas.py <dxf 4 piezas> DEL|TRA <N> <GAP> [--ancho W] [--png salida.png]

La regla (skill plotter-aol §10, Fak 15/10/2026): N piezas DER en una columna y N IZQ en otra, a lo ancho del material
(eje Y), sin girar, sin espejar, con GAP mm reales entre piezas. Este script:
  1. arma la hoja de columnas con `acomodar_columnas.py` (el mismo que se usa de verdad; no se reimplementa) y la relee;
  2. busca otro acomodo de las MISMAS 2N piezas con las MISMAS condiciones (solo trasladar, GAP real, el mismo ancho
     de material) con un acomodo «abajo-izquierda» simple: cada pieza en la primera posicion libre de izquierda a
     derecha. No es el optimo: es un acomodo posible, asi que la diferencia que da es una cota de lo que se puede ganar
     como minimo, no de lo que se gana como maximo;
  3. da una cota de abajo: con GAP entre piezas, las piezas engordadas GAP/2 no se tocan, asi que su area no puede
     pasar el area de la hoja engordada GAP/2 por lado. Ningun acomodo puede ser mas corto que eso.
El ancho del material (--ancho) no esta medido: si no se pasa, se usa el ancho que ocupa la hoja de columnas (se
compara con el mismo ancho usado). El numero NO es un consumo (consumos-entregables.md §6): el consumo sale de la
planilla oficial de Mesa de Corte o de un mail de Pablo Gamboa, y a Pablo no se le pregunta por esto. Las razones de
Fak para las columnas pueden no ser geometricas (direccion del vinilo, como se descarga la mesa): solo se le muestra
el numero.

Necesita ezdxf y shapely (ya estan en esta PC); no corre en el CI. Selftest: medir_regla_columnas_selftest.py.
"""
import itertools
import os
import subprocess
import sys
import tempfile

import ezdxf
from shapely.affinity import scale, translate
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.prepared import prep

AQUI = os.path.dirname(os.path.abspath(__file__))
COLUMNAS = os.path.join(AQUI, 'acomodar_columnas.py')
AVISO = ('El numero NO es un consumo (consumos-entregables.md §6): el consumo sale de la planilla oficial de Mesa de '
         'Corte o de un mail de Pablo Gamboa. Las razones de Fak para las columnas pueden no ser geometricas.')


def leer_polis(ruta):
    return [Polygon([(p[0], p[1]) for p in e.get_points('xy')])
            for e in ezdxf.readfile(ruta).modelspace().query('LWPOLYLINE') if e.closed]


def hoja_columnas(src, tipo, n, gap):
    """Corre acomodar_columnas.py y relee su DXF: devuelve (DER, IZQ, piezas) con DER/IZQ en el origen."""
    with tempfile.TemporaryDirectory() as d:
        out = os.path.join(d, 'columnas.dxf')
        r = subprocess.run([sys.executable, COLUMNAS, src, tipo, str(n), str(gap), out],
                           capture_output=True, text=True, encoding='utf-8')
        if r.returncode != 0:
            sys.exit(f'*** acomodar_columnas.py fallo ({r.returncode}): {(r.stdout + r.stderr).strip()}')
        piezas = leer_polis(out)
    if len(piezas) != 2 * n:
        sys.exit(f'*** la hoja de columnas tiene {len(piezas)} contornos, esperaba {2 * n}')
    piezas.sort(key=lambda p: (round(p.bounds[0], 3), p.bounds[1]))
    col1, col2 = piezas[:n], piezas[n:]
    # acomodar_columnas.py pone la columna DER en x = 0 (`columna(der, 0)`) y la IZQ a su derecha. Lo que se verifica: la
    # columna 1 arranca en x = 0, cada columna es UNA sola forma, y la columna 2 es el ESPEJO de la 1 (las dos manos).
    # Lo que la geometria no puede decir es cual de las dos manos es la DER (son espejo una de la otra): eso sale del
    # orden de acomodar_columnas.py. Los largos no dependen de eso (el buscador prueba las dos primero); solo los colores
    # del PNG se invertirian si ese orden cambiara.
    al_origen = lambda p: translate(p, -p.bounds[0], -p.bounds[1])
    der, izq = al_origen(col1[0]), al_origen(col2[0])
    espejo = al_origen(scale(der, xfact=-1, yfact=1, origin=(0, 0)))
    if abs(col1[0].bounds[0]) > 0.01 or any(al_origen(p).symmetric_difference(der).area > 1.0 for p in col1) \
            or any(al_origen(p).symmetric_difference(izq).area > 1.0 for p in col2) \
            or espejo.symmetric_difference(izq).area > 1.0:
        sys.exit('*** la hoja de columnas no tiene una columna DER en x = 0 y su espejo IZQ al lado (cambio acomodar_columnas.py?): no mido')
    return der, izq, piezas


def medidas(piezas):
    x0 = min(p.bounds[0] for p in piezas); y0 = min(p.bounds[1] for p in piezas)
    x1 = max(p.bounds[2] for p in piezas); y1 = max(p.bounds[3] for p in piezas)
    largo, ancho = x1 - x0, y1 - y0
    area = sum(p.area for p in piezas)
    return {'largo': largo, 'ancho': ancho, 'area_hoja': largo * ancho, 'area_piezas': area,
            'aprovechamiento': area / (largo * ancho)}


def verificar(piezas, gap, ancho=None):
    """Error (texto) si dos piezas quedan a menos de GAP o si una se sale del ancho; None si esta bien."""
    for (i, a), (j, b) in itertools.combinations(enumerate(piezas), 2):
        if a.distance(b) < gap - 0.01:
            return f'las piezas {i + 1} y {j + 1} quedan a {a.distance(b):.2f} mm (minimo {gap})'
    if ancho is not None:
        y0 = min(p.bounds[1] for p in piezas); y1 = max(p.bounds[3] for p in piezas)
        if y1 - y0 > ancho + 0.01:
            return f'el acomodo ocupa {y1 - y0:.1f} mm de ancho y el material tiene {ancho:.1f}'
    return None


def _grilla(desde, hasta, paso):
    n = int((hasta - desde) // paso) + 1
    return [desde + i * paso for i in range(max(n, 0))]


def abajo_izquierda(formas, ancho, gap, paso=10.0, largo_max=None):
    """Cada forma en la primera posicion libre (x mas chico, despues y mas chico) dentro del ancho, a GAP de las demas.
    Posiciones que se prueban: una grilla de `paso` mm mas las EXACTAS que dejan las piezas ya puestas (su borde + GAP,
    y pegada al borde del material); despues una pasada fina de a 1 mm hacia la izquierda de la elegida. Las exactas
    hacen falta: con el ancho justo de las columnas, una grilla sola no encuentra el lugar de la quinta pieza."""
    puestas = []
    largo_max = largo_max or sum(f.bounds[2] for f in formas) + gap * len(formas)
    for f in formas:
        w, h = f.bounds[2], f.bounds[3]
        if h > ancho + 1e-9:
            sys.exit(f'*** una pieza mide {h:.1f} de ancho y el material {ancho:.1f}: no entra sin girar')
        zona = prep(unary_union(puestas).buffer(gap - 0.005, quad_segs=16)) if puestas else None

        def libre(x, y):
            return zona is None or not zona.intersects(translate(f, x, y))

        tope_y = ancho - h
        exactas_y = [0.0, tope_y] + [p.bounds[3] + gap for p in puestas] + [p.bounds[1] - gap - h for p in puestas]
        ys = sorted({round(y, 6) for y in _grilla(0.0, tope_y, paso) + exactas_y if -1e-9 <= y <= tope_y + 1e-9})
        exactas_x = [0.0] + [p.bounds[2] + gap for p in puestas]
        xs = sorted({round(x, 6) for x in _grilla(0.0, largo_max, paso) + exactas_x if 0 <= x <= largo_max})
        mejor = next(((x, y) for x in xs for y in ys if libre(x, y)), None)
        if mejor is None:
            sys.exit('*** no encontre lugar para una pieza (largo maximo superado)')
        bx, _ = mejor
        ys_fino = sorted(set(ys) | {round(y, 6) for y in _grilla(0.0, tope_y, 1.0)})
        for xx in [bx - k for k in range(int(paso), 0, -1)]:
            if xx < 0:
                continue
            hallado = next(((xx, y) for y in ys_fino if libre(xx, y)), None)
            if hallado:
                mejor = hallado
                break
        puestas.append(translate(f, *mejor))
    return puestas


def mejor_acomodo(der, izq, n, ancho, gap, paso=10.0):
    ordenes = {
        'primero las DER': [der] * n + [izq] * n,
        'primero las IZQ': [izq] * n + [der] * n,
        'alternadas': [p for par in zip([der] * n, [izq] * n) for p in par],
    }
    resultados = []
    for nombre, formas in ordenes.items():
        # las mas anchas primero dentro de cada orden no cambia nada aca: DER e IZQ son espejo, miden lo mismo
        puestas = abajo_izquierda(formas, ancho, gap, paso)
        resultados.append((medidas(puestas)['largo'], nombre, puestas))
    resultados.sort(key=lambda r: r[0])
    return resultados[0][1], resultados[0][2]


def cota_de_abajo(piezas, ancho, gap):
    engordadas = sum(p.buffer(gap / 2, quad_segs=32).area for p in piezas)
    return engordadas / (ancho + gap) - gap


def medir(src, tipo, n, gap, ancho=None, paso=10.0):
    der, izq, cols = hoja_columnas(src, tipo, n, gap)
    mc = medidas(cols)
    ancho = ancho or mc['ancho']
    nombre, otro = mejor_acomodo(der, izq, n, ancho, gap, paso)
    error = verificar(otro, gap, ancho) or verificar(cols, gap)
    if error:
        sys.exit(f'*** el acomodo no cumple las condiciones: {error}')
    mo = medidas(otro)
    return {'tipo': tipo, 'n': n, 'gap': gap, 'ancho': ancho, 'columnas': mc, 'otro': mo, 'orden': nombre,
            'cota': cota_de_abajo(cols, ancho, gap), 'piezas_columnas': cols, 'piezas_otro': otro, 'der': der}


def texto(r):
    c, o, w = r['columnas'], r['otro'], r['ancho']
    ganancia = c['largo'] - o['largo']
    def sobra(m):
        hoja = m['largo'] * w
        return f"con el ancho de material, hoja {hoja / 1e6:.3f} m2, piezas {m['area_piezas'] / 1e6:.3f} m2, sobra {(hoja - m['area_piezas']) / 1e6:.3f} m2 ({100 * (1 - m['area_piezas'] / hoja):.1f} %)"
    l = [
        f"{r['tipo']}: {2 * r['n']} piezas ({r['n']} DER + {r['n']} IZQ), sin girar ni espejar, {r['gap']:.0f} mm reales entre piezas, ancho de material {w:.1f} mm",
        f"  columnas (regla de Fak): {c['largo']:.1f} x {c['ancho']:.1f} mm ocupados · {sobra(c)}",
        f"  otro acomodo posible ({r['orden']}): {o['largo']:.1f} x {o['ancho']:.1f} mm ocupados · {sobra(o)}",
        f"  diferencia de largo: {ganancia:.1f} mm ({ganancia * w / 1e6:.3f} m2 con ese ancho)" if ganancia > 0.05
        else f"  diferencia de largo: ninguna (el otro acomodo no es mas corto que las columnas)",
        f"  ningun acomodo con estas condiciones baja de {r['cota']:.1f} mm de largo (cota de abajo, no un acomodo)",
        f"  {AVISO}",
    ]
    return '\n'.join(l)


def dibujar(r, ruta):
    """Las dos hojas lado a lado, a la misma escala, con el ancho del material marcado (PIL: matplotlib no esta en esta PC)."""
    from PIL import Image, ImageDraw
    esc = 0.4  # pixeles por mm
    hojas = [('Columnas (regla de Fak)', r['piezas_columnas']), (f"Otro acomodo ({r['orden']})", r['piezas_otro'])]
    largo = max(medidas(p)['largo'] for _, p in hojas)
    ancho_px, alto_px = int(largo * esc) + 40, int(r['ancho'] * esc) + 70
    img = Image.new('RGB', (ancho_px * 2, alto_px), 'white')
    d = ImageDraw.Draw(img)
    for k, (titulo, piezas) in enumerate(hojas):
        ox, oy = k * ancho_px + 20, 50
        m = medidas(piezas)
        d.text((ox, 8), titulo, fill='black')
        d.text((ox, 24), f"{m['largo']:.0f} x {m['ancho']:.0f} mm - aprovechamiento {100 * m['aprovechamiento']:.1f} %", fill='black')
        d.rectangle([ox, oy, ox + int(largo * esc), oy + int(r['ancho'] * esc)], outline=(150, 150, 150))
        for p in piezas:
            pts = [(ox + x * esc, oy + (r['ancho'] - y) * esc) for x, y in p.exterior.coords]
            d.polygon(pts, fill=(170, 200, 235) if es_der(p, r['der']) else (200, 225, 170), outline='black')
    d.text((20, alto_px - 16), 'azul = DER, verde = IZQ; el rectangulo gris es el ancho del material', fill='black')
    img.save(ruta)


def es_der(p, der):
    """La pieza es la forma DER (y no su espejo IZQ): llevada al origen, coincide con DER a menos de 1 mm2."""
    q = translate(p, -p.bounds[0], -p.bounds[1])
    return q.symmetric_difference(der).area < 1.0


def main(argv):
    if len(argv) < 4:
        sys.exit(__doc__)
    src, tipo, n, gap = argv[0], argv[1], int(argv[2]), float(argv[3].replace(',', '.'))
    resto, ancho, png = argv[4:], None, None
    while resto:
        a = resto.pop(0)
        if a == '--ancho' and resto:
            ancho = float(resto.pop(0).replace(',', '.'))
        elif a == '--png' and resto:
            png = resto.pop(0)
        else:
            sys.exit(f'argumento que no conozco: {a}. No hago nada.')
    if tipo not in ('DEL', 'TRA'):
        sys.exit('el tipo es DEL o TRA')
    r = medir(src, tipo, n, gap, ancho)
    print(texto(r))
    if png:
        dibujar(r, png)
        print(f'  dibujo: {png}')


if __name__ == '__main__':
    main(sys.argv[1:])
