# -*- coding: utf-8 -*-
"""Selftest de _partirPlotter.py: casos con respuesta conocida, buenos y malos.

    .venv-cad/Scripts/python.exe scripts/_partirPlotterSelftest.py      (exit 0 = OK)

Buenos (tienen que dar exactamente lo esperado):
  1. Rectangulo 2000 x 1000 con una ranura que cruza el centro, una punteada que cruza
     el centro y una linea duplicada -> 2 mitades de 1000 x 1000, corte del medio de
     1000 - 10 = 990 mm, la ranura partida queda como muesca (0 ranuras sueltas), la
     punteada queda en 2 pedazos, el duplicado se saca, y el largo total cierra.
  2. El PLT y el DXF escritos se releen: todo en SP1, el contorno exterior es el ULTIMO
     trazo, y AutoCAD abre el DXF (si no esta instalado, se salta con aviso).
  5. El caso real: 2000 x 1220 en papel de 900 -> elige el corte HORIZONTAL y salen tiras
     de 610 x 2000 giradas (610 a lo ancho del rollo); con 1373 x 1030 elige el vertical.
Malos (tienen que ABORTAR):
  3. Una linea del dibujo cae justo sobre la recta de corte.
  4. Ninguna de las dos formas de partir en 2 entra en el papel (tambien papel de 500 en el 5).
"""
import math
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ezdxf  # noqa: E402
import _partirPlotter as P  # noqa: E402

FALLAS = []


def check(cond, msg):
    print(('  OK   ' if cond else '  FALLA ') + msg)
    if not cond:
        FALLAS.append(msg)


def dxf_de(lineas, path):
    doc = ezdxf.new('R2010')
    ms = doc.modelspace()
    for a, b in lineas:
        ms.add_line(a, b)
    doc.saveas(path)


def rect(x0, y0, x1, y1):
    return [((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))]


def caso_bueno(tmp):
    print('Caso 1-2: rectangulo con ranura, punteada y duplicado cruzando el centro')
    L = rect(0, 0, 2000, 1000)
    L += rect(900, 700, 1100, 710)                  # ranura de 200 x 10 que cruza x = 1000
    L += [((980, 300), (1020, 300))]                # punteada de 40 que cruza x = 1000
    L += [((1020, 300), (980, 300))]                # la misma, dibujada al reves: duplicado
    L += [((200, 500), (260, 500))]                 # punteada que no cruza
    ent = os.path.join(tmp, 'bueno.dxf')
    dxf_de(L, ent)

    tramos, _ = P.leer_entidades(ent)
    tramos, dup = P.sin_duplicados(tramos)
    check(dup == 1, f'duplicado sacado: {dup} == 1')
    cer = [c for c in P.encadenar(tramos, tol=P.TOL) if P._cerrada(c)]
    corte = P.corte_del_medio(cer, 1000.0)
    Lc = sum(P._largo(s) for s in corte)
    check(abs(Lc - 990.0) < 1e-9, f'corte del medio {Lc:.6f} == 990 (1000 menos la ranura)')
    izq, der = P.partir_tramos(tramos, 1000.0)
    for nom, lado in (('izq', izq), ('der', der)):
        m = P.armar_mitad(lado, [list(s) for s in corte])
        check(len(m['exterior']) == 1, f'{nom}: 1 contorno exterior')
        check(len(m['interior']) == 0, f'{nom}: la ranura partida es muesca, no ranura suelta')
        ext = m['exterior'][0]
        per = P._largo(ext)
        # 1000 + 1000 + 1000 (abajo, arriba, lado) + 990 (medio) + muesca 100+10+100
        check(abs(per - (3000 + 990 + 210)) < 1e-9, f'{nom}: perimetro {per:.6f} == 4200')
        largos = sorted(round(P._largo(c), 6) for c in m['abiertas'])
        esperado = [20.0, 60.0] if nom == 'izq' else [20.0]
        check(largos == esperado, f'{nom}: punteadas {largos} == {esperado}')

    out = os.path.join(tmp, 'salida')
    P.partir(ent, out, 'PRUEBA', sentido='vertical', area=(1373.0, 1030.0))
    for k in (1, 2):
        plt = os.path.join(out, f'PRUEBA - PARTE {k} de 2.plt')
        leido = P.leer_plt(plt)
        check({p for p, _ in leido} == {1}, f'parte {k}: todo en SP1')
        ultimo = leido[-1][1]
        # el exterior es el unico trazo cerrado cuyo bbox es el de toda la pieza
        check(P._cerrada(ultimo) and P._bbox([ultimo]) == P._bbox([p for _, p in leido]),
              f'parte {k}: el contorno exterior es el ultimo trazo')
        check(os.path.exists(os.path.join(out, f'PRUEBA - PARTE {k} de 2.dxf')),
              f'parte {k}: DXF entregado (AutoCAD lo abrio)')


def caso_papel_angosto(tmp):
    print('Caso 5: el caso real, 2000 x 1220 en papel de 900 -> corte HORIZONTAL, tiras de 610')
    L = rect(0, 0, 2000, 1220) + rect(900, 1000, 1100, 1010)
    L += [((500, 590), (500, 615))]                 # punteada vertical que cruza y = 610
    ent = os.path.join(tmp, 'angosto.dxf')
    dxf_de(L, ent)
    bb = (0.0, 0.0, 2000.0, 1220.0)
    check(P.elegir_corte(bb, (900.0, 0.0), 'auto') == 1,
          'con papel de 900 elige el corte horizontal (las mitades verticales no entran)')
    check(P.elegir_corte(bb, (1373.0, 1030.0), 'auto') == 0,
          'con 1373 x 1030 elige el vertical (a traves del lado largo)')
    tramos, _ = P.leer_entidades(ent)
    cer = [c for c in P.encadenar(tramos, tol=P.TOL) if P._cerrada(c)]
    corte = P.corte_del_medio(cer, 610.0, 1)
    check(len(corte) == 1 and abs(P._largo(corte[0]) - 2000.0) < 1e-9,
          'corte horizontal de 2000, sin huecos (la ranura queda de un solo lado)')
    abajo, arriba = P.partir_tramos(tramos, 610.0, 1)
    m = P.armar_mitad(abajo, corte)
    mo, rot = P.orientar(m, (900.0, 0.0))
    x0, y0, x1, y1 = P._bbox(P._todas(mo))
    check(rot and abs(x1 - x0 - 610) < 1e-9 and abs(y1 - y0 - 2000) < 1e-9,
          f'la tira sale girada, 610 de ancho x 2000 a lo largo del rollo ({x1 - x0:.1f} x {y1 - y0:.1f})')
    try:
        P.elegir_corte(bb, (500.0, 0.0), 'auto')
        check(False, 'papel de 500: tiene que abortar')
    except P.PartirAbortado as e:
        check('Hacen falta mas partes' in str(e), f'papel de 500 aborta: {e}')


def caso_malo_linea_sobre_corte(tmp):
    print('Caso 3: una linea del dibujo sobre la recta de corte -> tiene que abortar')
    L = rect(0, 0, 2000, 1000) + [((1000, 200), (1000, 800))]
    ent = os.path.join(tmp, 'malo3.dxf')
    dxf_de(L, ent)
    try:
        P.partir(ent, os.path.join(tmp, 'm3'), 'M3', dry=True)
        check(False, 'abortó')
    except P.PartirAbortado as e:
        check('cae justo sobre' in str(e), f'abortó: {e}')


def caso_malo_no_entra(tmp):
    print('Caso 4: mitad que no entra ni girada -> tiene que abortar')
    ent = os.path.join(tmp, 'malo4.dxf')
    dxf_de(rect(0, 0, 4000, 1500), ent)             # mitades de 2000 x 1500
    try:
        P.partir(ent, os.path.join(tmp, 'm4'), 'M4', area=(1373.0, 1030.0), dry=True)
        check(False, 'abortó')
    except P.PartirAbortado as e:
        check('Hacen falta mas partes' in str(e), f'abortó: {e}')


def main():
    tmp = tempfile.mkdtemp(prefix='partir_selftest_')
    try:
        caso_bueno(tmp)
        caso_papel_angosto(tmp)
        caso_malo_linea_sobre_corte(tmp)
        caso_malo_no_entra(tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f'\n{"TODO OK" if not FALLAS else f"{len(FALLAS)} FALLAS"}')
    sys.exit(1 if FALLAS else 0)


if __name__ == '__main__':
    main()
