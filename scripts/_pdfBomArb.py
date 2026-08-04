"""_pdfBomArb.py — arma el PDF de difusion de cambios de BOM del arb (formato Leo).

Extracto FIEL del Maestro de Relaciones: una pagina por pieza con su BOM completa tal
cual sale de C:\\tmp\\RELACIONES.TXT. El bloque ACTUALIZACIONES y la nota de fiel extracto
se repiten en TODAS las paginas. No inventa ni redondea: solo saca ceros de cola del
consumo, para que el numero se lea como lo escribe Leo.

    python scripts/_pdfBomArb.py --piezas "2HC881901 RL1,2HC885081 RL1" \\
        --fecha 04/08/2026 \\
        --act "Se crea part number XXX ..." --act "Se da de baja YYY ..." \\
        --salida "C:\\...\\Modificaciones BOM ARB_20260804.pdf"

El PDF se hace DESPUES de cargar en el arb y DESPUES de re-exportar: es un extracto
post-carga, no una propuesta. Ver skill `carga-arb`.
"""
import argparse
import os
import re
import sys

import fitz

RELACIONES = r'C:\tmp\RELACIONES.TXT'

# A4 apaisado; Courier 9pt => 5.4 pt por caracter
ANCHO, ALTO = 841.92, 595.32
COLS = [('Articulo', 30), ('Rubro', 120), ('Medida', 155), ('Descripcion', 245),
        ('Unidad', 478), ('Consumo', 515), ('Modulo', 595), ('Proceso', 660)]
FS, LEADING = 9, 13
NOTA = 'NOTA: la informacion es fiel extracto del Maestro de Relaciones de ARB'


def limpiar(s):
    """El export viene en latin-1 y algunas descripciones arrastran bytes de control."""
    return re.sub(r'[\x00-\x1f\x7f]', ' ', s).strip()


def consumo_fmt(s):
    """'1,00000000' -> '1' ; '0,41066660' -> '0.4106666'. No redondea: solo ceros de cola."""
    s = s.strip().replace(',', '.')
    if '.' not in s:
        return s
    return s.rstrip('0').rstrip('.') or '0'


def verificar_export(path):
    """El arb a veces escupe un RELACIONES cortado y NO avisa. Un extracto armado sobre un
    export truncado dice 'esta pieza no tiene tal insumo' cuando lo que falta es el archivo.
    Sintoma real (04/08/2026): 242 KB contra 819 KB del dia anterior, y la ultima linea
    cortada al medio sin salto de linea."""
    avisos = []
    with open(path, 'rb') as f:
        crudo = f.read()
    if not crudo.endswith(b'\n'):
        avisos.append('la ultima linea esta cortada al medio (el archivo no termina en salto '
                      'de linea): el export quedo INCOMPLETO')
    n = crudo.count(b'\n')
    if n < 4500:
        avisos.append(f'solo {n} lineas - un export completo ronda las 6200. Puede estar cortado')
    return avisos


def articulos_vigentes(path_relaciones):
    """Codigos del maestro ARTICULO.TXT (misma carpeta que RELACIONES).

    Un producto dado de baja DESAPARECE de ARTICULO pero puede conservar sus lineas en
    RELACIONES: la BOM queda huerfana. Ese cruce es lo unico que distingue un producto
    vigente de uno anulado, porque el export no trae flag de estado."""
    path = os.path.join(os.path.dirname(os.path.abspath(path_relaciones)), 'ARTICULO.TXT')
    if not os.path.exists(path):
        return None
    vigentes = set()
    with open(path, encoding='latin-1') as f:
        for linea in f:
            campos = linea.rstrip('\n').split('\t')
            if len(campos) >= 2:
                vigentes.add(campos[0].strip())
    return vigentes


def leer_bom(path, piezas):
    boms = {p: [] for p in piezas}
    with open(path, encoding='latin-1') as f:
        for linea in f:
            campos = linea.rstrip('\n').split('\t')
            if not campos or campos[0].strip() not in boms:
                continue
            def g(i):
                return limpiar(campos[i]) if i < len(campos) else ''
            boms[campos[0].strip()].append(
                (g(1), g(2), g(3), g(4), consumo_fmt(g(5)), g(6), g(7)))
    return boms


def pagina(doc, pieza, filas, fecha, actualizaciones):
    p = doc.new_page(width=ANCHO, height=ALTO)
    y = 45
    for titulo, x in COLS:
        p.insert_text((x, y), titulo, fontname='cobo', fontsize=FS)
    y += 4
    p.draw_line(fitz.Point(28, y), fitz.Point(745, y), width=0.6)
    y += LEADING

    for fila in filas:
        for (_, x), v in zip(COLS, (pieza,) + fila):
            p.insert_text((x, y), v, fontname='cour', fontsize=FS)
        y += LEADING

    y = ALTO - 118
    p.draw_line(fitz.Point(28, y - 12), fitz.Point(745, y - 12), width=0.6)
    p.insert_text((30, y), f'ACTUALIZACIONES {fecha}', fontname='cobo', fontsize=FS)
    y += LEADING
    for item in actualizaciones:
        p.insert_text((30, y), item, fontname='cour', fontsize=8)
        y += 11
    p.insert_text((30, y + 4), NOTA, fontname='cobo', fontsize=8)


def main():
    ap = argparse.ArgumentParser(description='PDF de difusion de cambios de BOM del arb')
    ap.add_argument('--piezas', required=True, help='codigos de producto terminado, separados por coma')
    ap.add_argument('--fecha', help='dd/mm/aaaa del bloque ACTUALIZACIONES')
    ap.add_argument('--act', action='append', metavar='TEXTO',
                    help='una linea del bloque ACTUALIZACIONES (repetible)')
    ap.add_argument('--salida', help='ruta del PDF a generar')
    ap.add_argument('--relaciones', default=RELACIONES)
    ap.add_argument('--verificar-vigencia', action='store_true',
                    help='solo cruzar las piezas contra ARTICULO.TXT y salir (no genera PDF). '
                         'Correrlo ANTES de armarle la tabla de carga a Fak.')
    args = ap.parse_args()

    piezas = [p.strip() for p in args.piezas.split(',') if p.strip()]

    vigentes = articulos_vigentes(args.relaciones)
    anulados = [] if vigentes is None else [p for p in piezas if p not in vigentes]

    if args.verificar_vigencia:
        if vigentes is None:
            sys.exit('ABORTA: no encuentro ARTICULO.TXT al lado de RELACIONES.TXT.')
        print(f'maestro ARTICULO: {len(vigentes)} articulos')
        for p in piezas:
            print(f'  {"ANULADO  " if p in anulados else "vigente  "} {p}')
        sys.exit(1 if anulados else 0)

    if not (args.fecha and args.act and args.salida):
        ap.error('--fecha, --act y --salida son obligatorios para generar el PDF')

    for aviso in verificar_export(args.relaciones):
        print(f'  AVISO  {aviso}', file=sys.stderr)

    if anulados:
        sys.exit(f'ABORTA: estos productos NO estan en ARTICULO.TXT, o sea que estan '
                 f'ANULADOS: {anulados}.\n'
                 f'        Sus lineas siguen en RELACIONES porque la BOM queda huerfana al '
                 f'dar de baja el articulo.\n'
                 f'        Sacarlos de --piezas. (Si el alta es reciente, chequear que '
                 f'ARTICULO.TXT no sea de un export viejo.)')

    boms = leer_bom(args.relaciones, piezas)
    faltan = [p for p in piezas if not boms[p]]
    if faltan:
        sys.exit(f'ABORTA: no hay lineas de BOM para {faltan} en {args.relaciones}.\n'
                 f'        O el codigo esta mal escrito, o el export quedo truncado. '
                 f'Re-exportar del arb antes de seguir.')

    doc = fitz.open()
    for pieza in piezas:
        pagina(doc, pieza, boms[pieza], args.fecha, args.act)
    os.makedirs(os.path.dirname(os.path.abspath(args.salida)), exist_ok=True)
    doc.save(args.salida)
    doc.close()

    print(f'OK  {args.salida}')
    for pieza in piezas:
        print(f'    {pieza:<18} {len(boms[pieza]):>2} lineas de BOM')
    print('\nAbrir el PDF y mirarlo antes de adjuntarlo.')


if __name__ == '__main__':
    main()
