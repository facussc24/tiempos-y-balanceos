# -*- coding: utf-8 -*-
"""Compara el consumo de un material de corte cargado en el arb contra la TIZADA mas nueva de la
pieza (.MRK de OptiTex). Solo lee: no toca el arb ni las tizadas.

Por que existe (06/10/2026, Upper Trimming): el 31/07 cargue 0,0724 m2 de microfibra con una cuenta
propia y todas las revisiones siguientes compararon el arb contra el arb. La tizada vigente daba
0,083 m2 por pieza SIN demasia: el arb tenia menos material que el que ocupa la pieza en el paño,
cosa que no puede ser. Fak: "tus validaciones no se dieron cuenta".

ES UN AVISO OPCIONAL, NO UNA FUENTE (Fak, 06/10/2026: "capaz Pablo Gamboa esta probando tizadas y
sacamos el consumo de ahi y eso no va... ante la duda le preguntamos a Pablo"). Una tizada en la
carpeta puede ser una prueba. El numero que se CARGA sale de la planilla oficial de Mesa de Corte
o de un mail de Pablo Gamboa: lo exige el freno 4 de scripts/_lib/respaldoCarga.py. Con un aviso
de aca NO se toca el arb: se le pregunta a Pablo.

Que mide:
  consumo de la tizada = largo x ancho / juegos        (m2, sin demasia)
                       = largo / juegos                (metros lineales, sin demasia)
  AVISO  el arb tiene MENOS que la tizada mas nueva sin demasia -> preguntarle a Pablo
  ok     el arb tiene lo de la tizada o mas (la planilla suma demasia y usa el ancho de rollo)
  AVISO  el patron cambio de tamaño entre las dos ultimas tizadas -> la planilla anterior puede
         haber quedado vieja

Uso:
  python scripts/_tizadaVsArb.py MP8404 [MP8405 ...]   # productos del arb
  python scripts/_tizadaVsArb.py --todos               # todas las familias del mapa
  python scripts/_tizadaVsArb.py --selftest            # sin arb ni servidor
Sale con 0 = sin avisos · 1 = hay un aviso para preguntar · 2 = no se pudo medir (falta el export o la carpeta).

El mapa producto -> carpeta de tizadas es scripts/_lib/tizadasPorProducto.data.json: se agrega una
familia cuando se toca su BOM (la carpeta se confirma abriendola, no por el nombre).
"""
import glob
import io
import json
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
MAPA = os.path.join(AQUI, '_lib', 'tizadasPorProducto.data.json')
EXPORTS = [r'C:\tmp\RELACIONES.TXT', os.path.join(os.path.dirname(AQUI), '.arb-cache', 'RELACIONES_*.TXT')]
TOL = 0.001                      # 0,1 %, la tolerancia de consumosCanon
CAMBIO_PATRON = 0.01             # 1 % de area entre dos tizadas = el patron cambio
M2 = ('MT2', 'M2')
LINEAL = ('MTS', 'MTL', 'ML', 'MT')


def leer_mrk(datos, nombre=''):
    """bytes de un .MRK -> dict. El archivo es XML despues de un encabezado binario."""
    i = datos.find(b'<?xml'); j = datos.find(b'</MARKER>')
    if i < 0 or j < 0:
        raise ValueError('%s no trae el bloque <MARKER>' % nombre)
    x = datos[i:j + 9].decode('latin-1')

    def g(tag):
        m = re.search(r'<%s>([^<]*)</%s>' % (tag, tag), x)
        if not m:
            raise ValueError('%s: falta <%s>' % (nombre, tag))
        return m.group(1).strip()
    d, mth, y = g('DATE').split('.')
    piezas = [float(a) for a in re.findall(r'<GEOM_INFO [^>]*AREA="([\d.]+)"', x)]
    juegos = [int(n) for n in re.findall(r'<NB_OF_SETS>(\d+)</NB_OF_SETS>', x)]
    puestas = int(g('PLACED_ON_TABLE'))
    r = dict(nombre=nombre, fecha='%s-%s-%s' % (y if len(y) == 4 else '20' + y, mth, d), largo_cm=float(g('LENGTH')),
             ancho_cm=float(g('WIDTH')), piezas=puestas, juegos=sum(juegos) if juegos else puestas,
             eficiencia=float(g('EFFICIENCY')), area_juego_m2=round(sum(piezas), 4), patrones=len(piezas))
    if r['juegos'] < 1 or r['largo_cm'] <= 0 or r['ancho_cm'] <= 0 or not piezas or r['area_juego_m2'] <= 0:
        raise ValueError('%s: tizada vacia' % nombre)
    # varios talles, o juegos declarados que no estan todos puestos en la mesa: no se medirla
    if len(juegos) > 1 or r['juegos'] * len(piezas) != puestas:
        raise ValueError('%s: %s juegos declarados, %d patrones y %d piezas puestas: no cierra (varios talles o '
                         'tizada a medio armar)' % (nombre, juegos, len(piezas), puestas))
    r['m2'] = r['largo_cm'] * r['ancho_cm'] / 1e4 / r['juegos']
    r['ml'] = r['largo_cm'] / 100.0 / r['juegos']
    return r


def veredicto(consumo_arb, unidad, tiz):
    """('ROJO'|'VERDE'|'NO APLICA', valor de la tizada, texto)."""
    u = unidad.strip().upper()
    if u in M2:
        ref, nom = tiz['m2'], 'm2'
    elif u in LINEAL:
        ref, nom = tiz['ml'], 'm lineales'
    else:
        return 'NO APLICA', None, 'unidad %s: no es m2 ni metro lineal' % unidad
    dif = (consumo_arb / ref - 1) * 100
    if consumo_arb < ref * (1 - TOL):
        return 'ROJO', ref, 'el arb tiene %.4f y la tizada ocupa %.4f %s por pieza SIN demasia (%.1f %% menos)' % (consumo_arb, ref, nom, -dif)
    return 'VERDE', ref, 'el arb tiene %.4f; la tizada sin demasia, %.4f %s (%.1f %% mas en el arb)' % (consumo_arb, ref, nom, dif)


def cambio_de_patron(tizadas):
    """tizadas en cualquier orden -> texto con la cadena de tamaños si el area del juego cambio alguna vez."""
    cadena = []
    for t in sorted(tizadas, key=lambda t: t['fecha']):
        if not cadena or abs(t['area_juego_m2'] / cadena[-1]['area_juego_m2'] - 1) > CAMBIO_PATRON:
            cadena.append(t)
    if len(cadena) < 2:
        return ''
    return 'el patron cambio: ' + ' -> '.join('%.4f m2 (%s, %s)' % (t['area_juego_m2'], t['nombre'], t['fecha']) for t in cadena)


def lineas_arb(texto, producto):
    """Lineas de primer nivel de un producto en RELACIONES.TXT -> [(insumo, descripcion, unidad, consumo)]."""
    out = []
    for ln in texto.splitlines():
        c = [x.strip() for x in ln.split('\t')]
        if len(c) >= 6 and c[0] == producto:
            try:
                out.append((c[2], c[3], c[4], float(c[5].replace('.', '').replace(',', '.') if ',' in c[5] else c[5])))
            except ValueError:
                pass
    return out


def export_mas_nuevo():
    cand = []
    for p in EXPORTS:
        cand += glob.glob(p)
    cand = [c for c in cand if os.path.isfile(c)]
    return max(cand, key=os.path.getmtime) if cand else None


def tizadas_de(carpetas):
    """Todas las tizadas de las carpetas, de vieja a nueva. Las de carpetas 'obsoleto' se leen pero no mandan."""
    vivas, viejas, ilegibles = [], [], []
    for c in carpetas:
        if not os.path.isdir(c):
            raise OSError('no se ve la carpeta de tizadas: %s' % c)
        for raiz, _, archivos in os.walk(c):
            for a in archivos:
                if a.lower().endswith('.mrk'):
                    p = os.path.join(raiz, a)
                    try:
                        t = leer_mrk(open(p, 'rb').read(), a)
                    except ValueError as e:
                        ilegibles.append('%s: %s' % (a, e))
                        continue
                    t['ruta'] = p
                    (viejas if re.search(r'obsolet', raiz, re.I) else vivas).append(t)
    orden = lambda t: (t['fecha'], os.path.getmtime(t['ruta']))        # noqa: E731
    return sorted(vivas, key=orden), sorted(viejas, key=orden), ilegibles


def revisar(productos, mapa, texto_arb):
    peor = 0
    for prod in productos:
        fam = next((f for f in mapa['familias'] if prod in f['productos']), None)
        if not fam:
            print('%s: NO SE MIDIO - sin tizada en el mapa (%s). Si lleva material de corte, agregar su carpeta.'
                  % (prod, os.path.basename(MAPA)))
            peor = max(peor, 2)
            continue
        try:
            vivas, viejas, ilegibles = tizadas_de(fam['carpetas'])
        except OSError as e:
            print('%s: NO SE PUDO MEDIR - %s' % (prod, e)); peor = max(peor, 2); continue
        for x in ilegibles:                      # puede ser la mas nueva: no se da un ok con la anterior
            print('%s: NO SE PUDO LEER una tizada - %s' % (prod, x)); peor = max(peor, 2)
        if not vivas:
            print('%s: NO SE PUDO MEDIR - no hay ninguna tizada vigente en %s' % (prod, fam['carpetas'])); peor = max(peor, 2); continue
        tiz = vivas[-1]
        lineas = [l for l in lineas_arb(texto_arb, prod) if l[0].upper().startswith(fam['insumo_empieza'].upper())]
        if not lineas:
            print('%s: NO SE PUDO MEDIR - el export no trae el insumo %s* en ese producto' % (prod, fam['insumo_empieza'])); peor = max(peor, 2); continue
        print('%s (%s) - tizada %s del %s: %d juegos en %.1f x %.1f cm, aprovecha %.1f %%'
              % (prod, fam['familia'], tiz['nombre'], tiz['fecha'], tiz['juegos'], tiz['largo_cm'], tiz['ancho_cm'], tiz['eficiencia']))
        for insumo, desc, unidad, consumo in lineas:
            v, _, txt = veredicto(consumo, unidad, tiz)
            if v == 'ROJO':
                peor = max(peor, 1)
                print('   [AVISO] %s: %s. Preguntarle a Pablo Gamboa si esa tizada es la que se usa '
                      '(puede ser una prueba); el consumo no se cambia sin su planilla o su mail.' % (insumo, txt))
            else:
                print('   [%s] %s: %s' % ('ok' if v == 'VERDE' else v, insumo, txt))
        aviso = cambio_de_patron(viejas + vivas)        # toda la historia, no solo las dos ultimas
        if aviso:
            peor = max(peor, 1)
            print('   [AVISO] ' + aviso + '. Una planilla de consumo anterior a esa fecha puede haber quedado vieja.')
    return peor


def selftest():
    def mrk(fecha, largo, ancho, juegos, areas):
        piezas = ''.join('<PIECE><GEOM_INFO SIZE_X="1" SIZE_Y="1" AREA="%s" PERIMETER="1" /></PIECE>' % a for a in areas)
        return (b'\xdc\x54 Default Table<' + ('<?xml version="1.0"?><MARKER><NAME>N</NAME><DATE>%s</DATE><LENGTH>%s</LENGTH>'
                '<WIDTH>%s</WIDTH><EFFICIENCY>80.0</EFFICIENCY><PLACED_ON_TABLE>%d</PLACED_ON_TABLE><STYLE><SIZE>'
                '<NB_OF_SETS>%d</NB_OF_SETS>%s</SIZE></STYLE></MARKER>' % (fecha, largo, ancho, juegos * len(areas), juegos, piezas)).encode('latin-1') + b'\x00\x01')
    casos = 0
    feb = leer_mrk(mrk('20.02.26', '167.0553', '135.0000', 42, ['0.0450']), 'feb')
    sep = leer_mrk(mrk('15.09.26', '153.4729', '135.0000', 25, ['0.0634']), 'sep')
    assert feb['fecha'] == '2026-02-20' and abs(feb['m2'] - 0.0537) < 0.0001 and abs(sep['m2'] - 0.0829) < 0.0001; casos += 1
    # el caso real: 0,0724 contra la tizada de septiembre -> ROJO; 0,058 contra la de febrero -> VERDE
    assert veredicto(0.0724, 'MT2', sep)[0] == 'ROJO'; casos += 1
    assert veredicto(0.058, 'MT2', feb)[0] == 'VERDE'; casos += 1
    assert veredicto(0.0829, 'MT2 ', sep)[0] == 'VERDE'; casos += 1                 # igual a la tizada: pasa
    assert veredicto(0.0827, 'MT2', sep)[0] == 'ROJO'; casos += 1                   # 0,2 % menos: no pasa
    # metros lineales: 1,5347 m / 25 = 0,0614
    assert veredicto(0.05, 'MTS', sep)[0] == 'ROJO' and veredicto(0.065, 'MTL', sep)[0] == 'VERDE'; casos += 2
    assert veredicto(1, 'KG', sep)[0] == 'NO APLICA'; casos += 1
    # un juego de dos patrones: PLACED cuenta piezas, el consumo va por JUEGO
    dos = leer_mrk(mrk('01.10.26', '200.0', '140.0', 10, ['0.10', '0.05']), 'dos')
    assert dos['piezas'] == 20 and dos['juegos'] == 10 and abs(dos['m2'] - 0.28) < 1e-9 and dos['area_juego_m2'] == 0.15; casos += 1
    assert 'cambio' in cambio_de_patron([feb, sep]) and cambio_de_patron([sep, sep]) == '' and cambio_de_patron([sep]) == ''; casos += 3
    # el cambio se ve aunque las dos ultimas sean iguales (R2 del 30/07 y la del 15/09), y en cualquier orden
    r2 = leer_mrk(mrk('30.07.26', '33.03', '135.0000', 5, ['0.0634']), 'r2')
    assert cambio_de_patron([sep, r2, feb]).count('->') == 1; casos += 1
    assert leer_mrk(mrk('15.09.2026', '153.4729', '135.0000', 25, ['0.0634']), 'a')['fecha'] == '2026-09-15'; casos += 1
    for malo in (mrk('15.09.26', '153', '135', 25, ['0.06']).replace(b'<PLACED_ON_TABLE>25', b'<PLACED_ON_TABLE>10'),      # a medio armar
                 mrk('15.09.26', '153', '135', 10, ['0.06']).replace(b'</SIZE>', b'<NB_OF_SETS>15</NB_OF_SETS></SIZE>')):  # dos talles
        try:
            leer_mrk(malo, 'malo'); raise AssertionError('tenia que negarse')
        except ValueError:
            casos += 1
    arb = 'MP8404         \t 1    \t 9PQ009-BK25-2  \t MICROFIBER SUEDE \t MT2  \t   0,07240000\tCO        \tCUM            \t\nMP84040\t1\tX\tY\tMT2\t1,0\tCO\tCUM\n'
    assert lineas_arb(arb, 'MP8404') == [('9PQ009-BK25-2', 'MICROFIBER SUEDE', 'MT2', 0.0724)]; casos += 1   # codigo exacto
    for malo in (b'nada', mrk('15.09.26', '0', '135', 25, ['0.06'])):
        try:
            leer_mrk(malo, 'malo'); raise AssertionError('tenia que negarse')
        except ValueError:
            casos += 1
    print('selftest OK: %d casos' % casos)


def main(argv):
    if '--selftest' in argv:
        return selftest() or 0
    mapa = json.load(io.open(MAPA, encoding='utf-8'))
    productos = [p for f in mapa['familias'] for p in f['productos']] if '--todos' in argv else [a for a in argv if not a.startswith('--')]
    if not productos:
        print(__doc__); return 2
    exp = export_mas_nuevo()
    if not exp:
        print('NO SE PUDO MEDIR - no hay export RELACIONES del arb en C:\\tmp ni en .arb-cache'); return 2
    import datetime
    print('arb: %s (%s)' % (exp, datetime.datetime.fromtimestamp(os.path.getmtime(exp)).strftime('%d/%m/%Y %H:%M')))
    return revisar(productos, mapa, io.open(exp, encoding='latin-1').read())


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.exit(main(sys.argv[1:]))
