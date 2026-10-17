"""Selftest de acomodar_columnas.py (tanda 12, 17/10/2026): los dos frenos en ROJO y en VERDE, con DXF sinteticos.

  py -3 .claude/skills/plotter-aol/scripts/acomodar_columnas_selftest.py     # tiene que dar "0 fallan"

No corre en `npm test`: el CI no instala ezdxf ni shapely (como hojalib_selftest.py, se corre aparte). Las 4 piezas son
rectangulos con el ancho y la posicion que el script usa para reconocer DEL/TRA y DER/IZQ (DEL si mide mas de 650 de
ancho; DER si arranca antes de x=300).
"""
import os
import subprocess
import sys
import tempfile

import ezdxf

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'acomodar_columnas.py')


def origen(ruta, con_circulo=False):
    doc = ezdxf.new('R2010')
    ms = doc.modelspace()
    for x0, ancho, alto in [(0, 700, 200), (1000, 700, 200), (0, 500, 150), (1000, 500, 150)]:
        y0 = 0 if ancho == 700 else 400
        ms.add_lwpolyline([(x0, y0), (x0 + ancho, y0), (x0 + ancho, y0 + alto), (x0, y0 + alto)], close=True)
    if con_circulo:
        ms.add_circle((50, 50), 1.0)
    doc.saveas(ruta)


def correr(*args):
    r = subprocess.run([sys.executable, SCRIPT, *args], capture_output=True, text=True, encoding='utf-8')
    return r.returncode, r.stdout + r.stderr


def main():
    malos = 0
    with tempfile.TemporaryDirectory() as d:
        sano, roto = os.path.join(d, 'sano.dxf'), os.path.join(d, 'circulo.dxf')
        origen(sano)
        origen(roto, con_circulo=True)
        casos = [
            ('VERDE: DEL, 5 por columna, 25 mm', (sano, 'DEL', '5', '25', os.path.join(d, 'a.dxf')), 0, 'releido: 10 contornos'),
            ('VERDE: TRA, 3 por columna, 25 mm', (sano, 'TRA', '3', '25', os.path.join(d, 'b.dxf')), 0, 'releido: 6 contornos'),
            ('ROJO: el origen trae un agujero (CIRCLE) que se perderia', (roto, 'DEL', '5', '25', os.path.join(d, 'c.dxf')), 1, 'ABORTADO: el origen trae CIRCLE'),
        ]
        for nombre, args, esperado, texto in casos:
            codigo, salida = correr(*args)
            ok = codigo == esperado and texto in salida
            malos += not ok
            print(f'  {"ok" if ok else "MAL"}  {nombre}  (salida {codigo})')
            if not ok:
                print('     ' + salida.strip().replace('\n', '\n     '))
        sin_archivo = not os.path.exists(os.path.join(d, 'c.dxf'))
        malos += not sin_archivo
        print(f'  {"ok" if sin_archivo else "MAL"}  ROJO: con el agujero no se escribe ningun archivo')
    print(f'{4} casos, {malos} fallan.')
    return 1 if malos else 0


if __name__ == '__main__':
    sys.exit(main())
