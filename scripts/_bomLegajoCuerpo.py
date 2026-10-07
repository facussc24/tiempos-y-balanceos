# -*- coding: utf-8 -*-
"""Lee el CUERPO de cada pagina de un PDF de BOM del arb (los que arma `_pdfBomArb.py`: el de
difusion y el `BOM ARB ultimo nivel` del legajo APQP).

    python scripts/_bomLegajoCuerpo.py <pdf> [<pdf> ...]

Imprime UN renglon JSON: una entrada por PDF, en el mismo orden en que se pidieron.
    {"paginas": [{"pieza": "...", "cuerpo": ["renglon", ...]}, ...]}     o     {"error": "..."}

El cuerpo es lo que queda ARRIBA del bloque ACTUALIZACIONES: titulo, encabezado y filas de la
BOM. El bloque, su fecha y la nota del pie no entran, porque cambian en cada difusion aunque
la BOM sea la misma. Lo usa `_lib/bomLegajoCheck.mjs` para no dar por atrasado un legajo que
tiene la misma BOM que una difusion posterior (falso rojo del 02 al 06/10/2026, familia APC).

Solo lee: no escribe ni mueve nada.

Falla CERRADO: una pagina que no tiene la forma conocida (sin bloque ACTUALIZACIONES, sin
filas, la primera fila no es de la pieza del titulo, pieza repetida) devuelve "error" para el
PDF entero, y el control se queda con el rojo por fecha. Los tests viven en
`__tests__/scripts/bomLegajoCheck.test.mjs`.
"""
import json
import re
import sys

import fitz

RE_BLOQUE = re.compile(r'^ACTUALIZACIONES\b')
SEP_TITULO = '    '         # `_pdfBomArb.pagina()` titula '<pieza>    <descripcion>'
MISMA_LINEA = 2             # pt; las filas del PDF van cada 13 y las del bloque cada 11


def renglones(pagina):
    """[[celda, ...]] de arriba hacia abajo. Un renglon es todo lo que comparte linea de base,
    de izquierda a derecha: se arma por POSICION, no por el orden en que el PDF guarda el texto.
    Cada celda es un tramo de texto separado de los demas (una columna de la tabla)."""
    trozos = []
    for bloque in pagina.get_text('dict')['blocks']:
        for linea in bloque.get('lines', []):
            texto = ''.join(s['text'] for s in linea['spans'])
            if texto.strip():
                trozos.append((linea['spans'][0]['origin'][1], linea['bbox'][0], texto))
    trozos.sort()
    filas = []
    for y, x, texto in trozos:
        if filas and y - filas[-1][0] < MISMA_LINEA:
            filas[-1][1].append((x, texto))
        else:
            filas.append((y, [(x, texto)]))
    return [[t for _, t in sorted(partes)] for _, partes in filas]


def compacto(texto):
    return ' '.join(texto.split())


def cuerpo_de(pagina):
    """(pieza, [renglones del cuerpo]) de una pagina, o ValueError si no tiene la forma conocida.

    Cada renglon sale con sus celdas separadas por tabulador: aplanarlo con espacios igualaba
    'AB' + 'CD EF' con 'AB CD' + 'EF' (un texto corrido de la medida a la descripcion)."""
    filas = renglones(pagina)
    corte = next((i for i, celdas in enumerate(filas) if RE_BLOQUE.match(celdas[0].strip())), None)
    if corte is None:
        raise ValueError('no tiene el bloque ACTUALIZACIONES')
    arriba = filas[:corte]
    if len(arriba) < 3:     # titulo, encabezado y al menos una fila de BOM
        raise ValueError('no tiene filas de BOM arriba del bloque ACTUALIZACIONES')
    pieza = compacto(arriba[0][0].split(SEP_TITULO, 1)[0])
    # La primera fila de una BOM es siempre de nivel 0 y arranca con el codigo del producto:
    # si no coincide con el titulo, la pieza quedo mal leida y no se compara nada con ella.
    if not pieza or not compacto(' '.join(arriba[2])).startswith(pieza + ' '):
        raise ValueError('la primera fila no es de la pieza del titulo (%r)' % pieza)
    return pieza, ['\t'.join(compacto(celda) for celda in celdas) for celdas in arriba]


def leer(ruta):
    try:
        doc = fitz.open(ruta)
    except Exception as e:      # archivo que no esta, que no bajo de la nube o que no es un PDF
        return {'error': 'no se pudo abrir (%s)' % str(e)[:120]}
    try:
        paginas, vistas = [], set()
        for n, pagina in enumerate(doc, start=1):
            try:
                pieza, cuerpo = cuerpo_de(pagina)
            except ValueError as e:
                return {'error': 'pagina %d: %s' % (n, e)}
            if pieza in vistas:
                return {'error': 'pagina %d: la pieza %s esta dos veces' % (n, pieza)}
            vistas.add(pieza)
            paginas.append({'pieza': pieza, 'cuerpo': cuerpo})
        if not paginas:
            return {'error': 'no tiene paginas'}
        return {'paginas': paginas}
    except Exception as e:
        return {'error': 'no se pudo leer (%s)' % str(e)[:120]}
    finally:
        doc.close()


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    print(json.dumps([leer(r) for r in argv]))      # ASCII puro: no depende de la consola
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
