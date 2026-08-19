# -*- coding: utf-8 -*-
"""
Historia de compra de un insumo, leida de las ordenes de compra reales.

Las OC de Barack viven en Z:\\arb\\oc\\ocauto\\BA como OC<numero>-<PROVEEDOR>.PDF
(~10.600 archivos, PDF de texto). Este script las abre, saca los items y arma la
linea de tiempo: que codigo, en que UNIDAD, cuanta cantidad y a que precio.

    python scripts/_ocHistoria.py APLIX               # por proveedor (nombre del archivo)
    python scripts/_ocHistoria.py --codigo A999R8395  # por codigo de material
    python scripts/_ocHistoria.py SINOYQX --csv salida.csv

POR QUE EXISTE (caso aplix, 19/08/2026):
  Compras reclamaba que "el proveedor factura en metros" y el arb tenia el consumo en m2.
  Las 31 OC a APLIX INC contestaron la discusion en un minuto: el MISMO material, con la
  MISMA cantidad (3000) y el MISMO precio (4,1495), salio impreso como MTS (2019-2025),
  ROLL (dic-2025) y MT2 (feb-2026). O sea: cambio la ETIQUETA del maestro, no la compra.

  Leccion que el script deja disponible: la unidad que imprime una OC es la del maestro del
  insumo, no una prueba de como se compra. Lo que prueba la compra es la CANTIDAD y el
  PRECIO — si esos dos no se movieron cuando cambio la unidad, nadie convirtio nada.
"""
import argparse
import csv
import glob
import os
import re
import sys

CARPETA = os.path.join('Z:', os.sep, 'arb', 'oc', 'ocauto', 'BA')

# "     1-CODIGO   DESCRIPCION   UNIDAD  [unidades]  cantidad  p.unit  subtotal"
ITEM = re.compile(
    r'^\s*\d+-(?P<cod>\S+)\s{2,}(?P<desc>.+?)\s{2,}'
    r'(?P<uni>[A-Z0-9]{2,5})?\s+(?P<cant>[\d.,]+)\s+(?P<pu>[\d.,]+)\s+(?P<sub>[\d.,]+)\s*$',
    re.M)
NRO = re.compile(r'O\. de Compra N\S*\s*(\d+)')
FECHA = re.compile(r'\((\d{2}/\d{2}/\d{4})\)')
MONEDA = re.compile(r'SubTotal O\. de Compra\s+(\w+)')


def leer(pdf):
    try:
        import fitz
    except ImportError:
        sys.exit('Falta pymupdf.  pip install pymupdf')
    try:
        d = fitz.open(pdf)
        txt = ''.join(p.get_text() for p in d)
        d.close()
        return txt
    except Exception as e:
        print('!! no pude leer %s: %s' % (os.path.basename(pdf), e), file=sys.stderr)
        return ''


def ordenar(fecha):
    """dd/mm/aaaa -> clave ordenable. Sin fecha va al final."""
    if not fecha or fecha == '?':
        return ('9999', '99', '99')
    return (fecha[6:10], fecha[3:5], fecha[0:2])


def main():
    ap = argparse.ArgumentParser(description='Historia de OC por proveedor o por codigo')
    ap.add_argument('proveedor', nargs='?', default='',
                    help='texto del nombre del archivo (proveedor). Vacio = todas')
    ap.add_argument('--codigo', default='', help='filtra los items por codigo de material')
    ap.add_argument('--carpeta', default=CARPETA)
    ap.add_argument('--csv', default='', help='ademas de imprimir, escribe un CSV')
    a = ap.parse_args()

    if not os.path.isdir(a.carpeta):
        sys.exit('No veo %s. Z: solo responde con el cable de red puesto.' % a.carpeta)

    patron = '*%s*.PDF' % a.proveedor if a.proveedor else '*.PDF'
    archivos = glob.glob(os.path.join(a.carpeta, patron))
    # el disco mezcla .pdf y .PDF; glob en Windows no distingue, pero por las dudas
    archivos = sorted(set(archivos))
    if not archivos:
        sys.exit('Ninguna OC coincide con "%s"' % a.proveedor)

    filas = []
    for p in archivos:
        txt = leer(p)
        if not txt:
            continue
        nro = NRO.search(txt)
        fec = FECHA.search(txt)
        mon = MONEDA.search(txt)
        for m in ITEM.finditer(txt):
            if a.codigo and a.codigo.upper() not in m.group('cod').upper():
                continue
            filas.append({
                'oc': nro.group(1) if nro else '?',
                'fecha': fec.group(1) if fec else '?',
                'archivo': os.path.basename(p),
                'codigo': m.group('cod'),
                'descripcion': m.group('desc').strip(),
                'unidad': (m.group('uni') or '-'),
                'cantidad': m.group('cant'),
                'p_unitario': m.group('pu'),
                'subtotal': m.group('sub'),
                'moneda': mon.group(1) if mon else '',
            })

    if not filas:
        sys.exit('Lei %d OC y ninguna trae items con ese filtro.' % len(archivos))

    filas.sort(key=lambda f: ordenar(f['fecha']))

    print('%d OC leidas, %d items' % (len(archivos), len(filas)))
    print()
    print('%-7s %-11s %-18s %-6s %14s %11s %-6s' %
          ('OC', 'fecha', 'codigo', 'unid', 'cantidad', 'p.unit', 'mon'))
    print('-' * 82)
    for f in filas:
        print('%-7s %-11s %-18s %-6s %14s %11s %-6s' %
              (f['oc'], f['fecha'], f['codigo'][:18], f['unidad'],
               f['cantidad'], f['p_unitario'], f['moneda']))

    # El chequeo que motivo el script. Va POR CODIGO: mezclar materiales distintos
    # infla la cuenta de unidades y de precios, y el aviso pierde sentido.
    for cod in sorted(set(f['codigo'] for f in filas)):
        delcod = [f for f in filas if f['codigo'] == cod]
        unidades = sorted(set(f['unidad'] for f in delcod))
        if len(unidades) < 2:
            continue
        print()
        print('*** OJO: %s salio impreso con %d unidades distintas: %s' %
              (cod, len(unidades), ', '.join(unidades)))
        for u in unidades:
            deu = [f for f in delcod if f['unidad'] == u]
            print('      %-6s %2d OC  %s -> %s   cantidades %s   precios %s' % (
                u, len(deu), deu[0]['fecha'], deu[-1]['fecha'],
                '/'.join(sorted(set(f['cantidad'].rstrip('0').rstrip('.,') for f in deu))),
                '/'.join(sorted(set(f['p_unitario'] for f in deu)))))
        cants = set(f['cantidad'].rstrip('0').rstrip('.,') for f in delcod)
        precios = set(f['p_unitario'] for f in delcod)
        if len(cants) == 1 or len(precios) <= len(unidades) - 1:
            print('    La cantidad y/o el precio NO acompanaron el cambio de unidad.')
            print('    => cambio la ETIQUETA del maestro, no la compra. La unidad de una OC')
            print('       no prueba en que unidad se compra: eso lo dice la FACTURA.')

    if a.csv:
        with open(a.csv, 'w', newline='', encoding='utf-8-sig') as fh:
            w = csv.DictWriter(fh, fieldnames=list(filas[0].keys()))
            w.writeheader()
            w.writerows(filas)
        print()
        print('CSV: %s' % a.csv)


if __name__ == '__main__':
    main()
