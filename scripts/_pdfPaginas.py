"""Pasa paginas de un PDF a PNG para MIRARLAS con la tool Read (que lee imagenes).

Por que existe (22/09/2026): la tool Read con `pages` necesita `pdftoppm` (Poppler), que en
esta PC no esta instalado, y el error aparecio en 25 sesiones distintas del ultimo mes: cada
una lo redescubria. PyMuPDF (fitz) si esta, y es la receta de la memoria
`reference_leer_pdfs_escaneados`. Sirve igual para PDFs escaneados (sin capa de texto) y
para tablas: `pdftotext -layout` puede correr las filas y la salida se lee perfecta
(memoria `reference_pdftotext_layout_corre_las_filas`); el juez es mirar la pagina.

Uso:
    python scripts/_pdfPaginas.py <archivo.pdf> <paginas> [--dpi 150] [--out <carpeta>]
      <paginas>: "3" · "3,5" · "3-7" · "1,4-6" · "todas" (numeradas desde 1, como las ve Fak)
      --out: por defecto una carpeta nueva en el TEMP del sistema (nunca al lado del PDF:
             la carpeta del PDF suele ser de Fak o del servidor).
    python scripts/_pdfPaginas.py --selftest

Imprime una ruta de PNG por pagina, y al final si la pagina trae capa de texto o no.
"""
import os
import sys
import tempfile


def parsear_paginas(spec, total):
    """'1,4-6' -> [1, 4, 5, 6]. Valida el rango contra el total de paginas."""
    if spec.strip().lower() == 'todas':
        return list(range(1, total + 1))
    paginas = []
    for parte in spec.split(','):
        parte = parte.strip()
        if not parte:
            continue
        if '-' in parte:
            a, b = parte.split('-', 1)
            a, b = int(a), int(b)
            if a > b:
                raise ValueError(f'rango al reves: {parte}')
            paginas.extend(range(a, b + 1))
        else:
            paginas.append(int(parte))
    fuera = [p for p in paginas if p < 1 or p > total]
    if fuera:
        raise ValueError(f'paginas fuera del PDF (tiene {total}): {fuera}')
    return sorted(set(paginas))


def selftest():
    casos = [('3', 10, [3]), ('1,4-6', 10, [1, 4, 5, 6]), ('todas', 3, [1, 2, 3]), (' 2 , 2 ', 5, [2])]
    for spec, total, esperado in casos:
        obtenido = parsear_paginas(spec, total)
        assert obtenido == esperado, (spec, obtenido, esperado)
    for spec, total in [('0', 5), ('6', 5), ('5-3', 9)]:
        try:
            parsear_paginas(spec, total)
        except ValueError:
            continue
        raise AssertionError(f'{spec} con {total} paginas tenia que fallar')
    print('selftest OK (7 casos)')


def main(argv):
    import argparse
    ap = argparse.ArgumentParser(description='Paginas de un PDF a PNG, para mirarlas con Read.')
    ap.add_argument('pdf', nargs='?')
    ap.add_argument('paginas', nargs='?')
    ap.add_argument('--dpi', type=int, default=150)
    ap.add_argument('--out')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args(argv)
    if a.selftest:
        selftest()
        return 0
    if not a.pdf or not a.paginas:
        print(__doc__)
        return 2

    if not os.path.isfile(a.pdf):
        print(f'ERROR: no existe el archivo: {a.pdf}', file=sys.stderr)
        return 2
    import fitz  # PyMuPDF
    doc = fitz.open(a.pdf)
    try:
        paginas = parsear_paginas(a.paginas, doc.page_count)
    except ValueError as e:
        print(f'ERROR: {e}', file=sys.stderr)
        return 2
    dpi, out = a.dpi, a.out
    if out is None:
        base = os.path.splitext(os.path.basename(a.pdf))[0][:40]
        out = tempfile.mkdtemp(prefix=f'pdf_{base}_')
    os.makedirs(out, exist_ok=True)
    for p in paginas:
        pagina = doc[p - 1]
        ruta = os.path.join(out, f'pag_{p:03d}.png')
        pagina.get_pixmap(dpi=dpi).save(ruta)
        con_texto = len(pagina.get_text('text').strip()) >= 50
        print(f'{ruta}\t{"con texto" if con_texto else "SIN capa de texto (escaneada): solo se lee mirandola"}')
    doc.close()
    return 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except (AttributeError, ValueError):
        pass
    sys.exit(main(sys.argv[1:]))
