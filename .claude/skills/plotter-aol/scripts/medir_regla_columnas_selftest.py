"""Selftest de medir_regla_columnas.py (tanda 13, item 10), con DXF sinteticos de respuesta conocida.

  py -3 .claude/skills/plotter-aol/scripts/medir_regla_columnas_selftest.py     # tiene que dar "0 fallan"

No corre en `npm test`: el CI no instala ezdxf ni shapely (como acomodar_columnas_selftest.py).
Casos:
  VERDE  rectangulos de 700 x 200 (DEL): las columnas dan 1425 x 1100 (700 + 25 + 700; 5 x 200 + 4 x 25), y con ese
         mismo ancho el otro acomodo NO puede ser mas corto: tiene que dar 1425 tambien (ninguna ganancia inventada).
  VERDE  la cota de abajo no pasa al acomodo de columnas ni al otro.
  VERDE  con 1300 mm de ancho siguen entrando 5 por columna (6 pedirian 1325): 10 piezas siguen en 2 columnas, 1425.
  ROJO   el verificador frena dos piezas a menos de 25 mm y una que se sale del ancho.
  VERDE  con el DXF real de 4 piezas del 15/10 (si esta en esta PC), las columnas dan 1380,4 x 1187,1 (DEL) y
         1293,1 x 1284,6 (TRA): los numeros que la skill plotter-aol dice del 17/10.
"""
import os
import sys
import tempfile

import ezdxf
from shapely.geometry import box

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import medir_regla_columnas as m  # noqa: E402

REAL = r'C:\Dev\BarackMercosul\exports\INSERT_OREJITA_COSTURA_20261015\INSERT PATAGONIA - 4 PIEZAS (1 de cada mano) - OREJITA COSTURA - 2026-10-15.dxf'


def origen(ruta):
    doc = ezdxf.new('R2010')
    ms = doc.modelspace()
    for x0, ancho, alto in [(0, 700, 200), (1000, 700, 200), (0, 500, 150), (1000, 500, 150)]:
        y0 = 0 if ancho == 700 else 400
        ms.add_lwpolyline([(x0, y0), (x0 + ancho, y0), (x0 + ancho, y0 + alto), (x0, y0 + alto)], close=True)
    doc.saveas(ruta)


def main():
    casos = []
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, 'rect.dxf')
        origen(src)
        r = m.medir(src, 'DEL', 5, 25)
        c, o = r['columnas'], r['otro']
        casos.append(('VERDE: columnas de rectangulos 1425 x 1100', abs(c['largo'] - 1425) < 0.05 and abs(c['ancho'] - 1100) < 0.05))
        casos.append(('VERDE: el otro acomodo no inventa ganancia (1425)', abs(o['largo'] - 1425) < 0.05))
        casos.append(('VERDE: la cota de abajo no pasa a ninguno', r['cota'] <= o['largo'] + 1e-6 and r['cota'] <= c['largo'] + 1e-6))
        r2 = m.medir(src, 'DEL', 5, 25, ancho=1300)
        casos.append(('VERDE: con 1300 de ancho siguen siendo 2 columnas de 5 (1425)', abs(r2['otro']['largo'] - 1425) < 0.05))
    a, b = box(0, 0, 100, 50), box(110, 0, 210, 50)
    casos.append(('ROJO: dos piezas a 10 mm con minimo 25', (m.verificar([a, b], 25) or '').startswith('las piezas 1 y 2 quedan a 10.00')))
    casos.append(('ROJO: una pieza que se sale del ancho', 'el material tiene 40.0' in (m.verificar([a], 25, ancho=40) or '')))
    casos.append(('VERDE: piezas a 25 mm justos pasan', m.verificar([a, box(125, 0, 225, 50)], 25) is None))
    if os.path.exists(REAL):
        rd = m.hoja_columnas(REAL, 'DEL', 5, 25)[2]
        rt = m.hoja_columnas(REAL, 'TRA', 5, 25)[2]
        md, mt = m.medidas(rd), m.medidas(rt)
        casos.append(('VERDE: DXF real del 15/10, DEL 1380,4 x 1187,1', f"{md['largo']:.1f} x {md['ancho']:.1f}" == '1380.4 x 1187.1'))
        casos.append(('VERDE: DXF real del 15/10, TRA 1293,1 x 1284,6', f"{mt['largo']:.1f} x {mt['ancho']:.1f}" == '1293.1 x 1284.6'))
    else:
        print('  (el DXF real del 15/10 no esta en esta PC: esos dos casos no corren)')
    malos = 0
    for nombre, ok in casos:
        malos += not ok
        print(f'  {"ok" if ok else "MAL"}  {nombre}')
    print(f'{len(casos)} casos, {malos} fallan.')
    sys.exit(1 if malos else 0)


if __name__ == '__main__':
    main()
