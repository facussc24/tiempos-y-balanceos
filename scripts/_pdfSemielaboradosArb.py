# -*- coding: utf-8 -*-
"""_pdfSemielaboradosArb.py — extracto PDF de los SEMIELABORADOS de un proyecto en el arb.

Mismo formato de informe que `_pdfBomArb.py` (A4 apaisado, Courier, nota de fiel extracto al
pie), pero la consulta es otra: no es la BOM de una pieza, es el listado de codigos de
semielaborado dados de alta en los maestros del arb.

    python scripts/_pdfSemielaboradosArb.py --proyecto patagonia --proceso INY \
        --salida "C:\\...\\Semielaborados inyeccion Patagonia.pdf"

Fuentes (las tres del arb, sin intermediarios):
    C:\\tmp\\ARTICULO.TXT     maestro de articulos  -> codigo + descripcion
    C:\\tmp\\INSUMOS.TXT      maestro de insumos    -> si ademas esta dado de alta como insumo
    C:\\tmp\\RELACIONES.TXT   maestro de relaciones -> si se consume dentro de alguna BOM

Por que desconfia de todo: mismo motivo que `_pdfBomArb.py`. Un listado que se le manda a
otra area tiene que ser exacto o no salir. Los gates fallan CERRADO y el PDF se arma ENTERO
EN MEMORIA: se relee de ahi y recien cuando paso la relectura se escribe el archivo. Asi un
PDF en disco es, por construccion, un PDF verificado — y no hace falta borrar nada.

Criterio de seleccion (no es libre: sale del esquema de codificacion de Barack, el que Fak
difundio el 26/05/2026 -> P1 Depto/Proceso + P2 Familia+SKU base + version de ingenieria):
  - `<PROCESO>-<FAMILIA><NNNN>-V<n>`  con FAMILIA de las del proyecto
  - `N <nnn> - SM`  (semiterminados de top roll, formato pedido por C. Baptista el 08/06/2026)
Los que matchean el patron pero son de OTRO proyecto se descartan por descripcion, y el
descarte se imprime en consola para poder auditarlo a ojo.
"""
import argparse
import datetime
import os
import re
import sys

import fitz

TMP = r'C:\tmp'
ARTICULO = os.path.join(TMP, 'ARTICULO.TXT')
INSUMOS = os.path.join(TMP, 'INSUMOS.TXT')
RELACIONES = os.path.join(TMP, 'RELACIONES.TXT')

ANCHO, ALTO = 841.92, 595.32
COLS = [('Codigo', 30), ('Descripcion', 150), ('Conjunto', 470), ('Alta en ARB', 650)]
FS, LEADING = 9, 13
Y_PRIMERA_FILA = 74
Y_PIE = ALTO - 90            # abajo de esta linea empieza el bloque de notas
FILAS_POR_PAGINA = int((Y_PIE - Y_PRIMERA_FILA) // LEADING)
NOTA = ('NOTA: la informacion es fiel extracto de los maestros de ARB '
        '(Articulos, Insumos y Relaciones).')

OFFSETS = (0, 7, 14, 21)

# Un proyecto = las familias de codigo que le pertenecen + las palabras que delatan que un
# codigo con el mismo patron es de OTRO proyecto.
PROYECTOS = {
    'patagonia': {
        'nombre': 'PROYECTO PATAGONIA (VW427)',
        'familias': {'TRL': 'TOP ROLL',
                     'INS': 'INSERT',
                     'APB': 'APOYABRAZO DE PUERTA'},
        'conjunto_sm': 'TOP ROLL',   # los `N <nnn> - SM` son top roll (mail C. Baptista 08/06)
        'ajenos': ('AMAROK', 'MIRGOR', 'TAOS', 'FOCUS', 'P703', 'HILUX', 'TOYOTA'),
    },
}


def limpiar(s):
    return re.sub(r'[\x00-\x1f\x7f]', ' ', s or '').strip()


def leer_articulos(path):
    """{codigo: descripcion} del maestro de articulos (tab-delimitado, latin-1)."""
    d = {}
    with open(path, encoding='latin-1', errors='replace') as f:
        for linea in f.read().splitlines()[1:]:
            c = linea.split('\t')
            if len(c) >= 2 and c[0].strip():
                d[c[0].strip()] = limpiar(c[1])
    return d


def leer_insumos(path):
    """{codigo: descripcion} del maestro de insumos.

    OJO: no es tab-delimitado. Es el listado IMPRESO del arb, de ancho fijo, con cabeceras de
    rubro dibujadas con caracteres de linea. Las filas utiles tienen la forma
    `<rubro> <codigo(15)> <descripcion>`, con el codigo siempre en la misma columna.
    """
    d = {}
    fila = re.compile(r'^\s{2,4}(\d)\s{1,4}(.{15})(.*)$')
    with open(path, encoding='latin-1', errors='replace') as f:
        for linea in f.read().splitlines():
            m = fila.match(linea.rstrip())
            if not m:
                continue
            cod = m.group(2).strip()
            if cod:
                d[cod] = limpiar(m.group(3))
    return d


def consumos_en_bom(path, codigos):
    """{codigo: cuantas veces aparece consumido dentro de la BOM de algun producto}."""
    uso = {c: 0 for c in codigos}
    with open(path, encoding='latin-1', errors='replace') as f:
        for nro, linea in enumerate(f.read().splitlines()):
            if nro == 0:
                continue
            campos = linea.split('\t')
            for off in OFFSETS:
                i = off + 2
                if i < len(campos):
                    cod = campos[i].strip()
                    if cod in uso:
                        uso[cod] += 1
    return uso


def seleccionar(articulos, proyecto, proceso):
    """(elegidos, descartados). Elegido = (codigo, descripcion, conjunto)."""
    cfg = PROYECTOS[proyecto]
    re_cod = re.compile(r'^%s-([A-Z]{3})(\d{4})-V\d+$' % re.escape(proceso))
    re_sm = re.compile(r'^N\s+\d+\s*-\s*SM$')
    elegidos, descartados = [], []
    for cod in sorted(articulos):
        desc = articulos[cod]
        m = re_cod.match(cod)
        if m:
            fam = m.group(1)
            if fam not in cfg['familias']:
                descartados.append((cod, desc, 'familia %s no es del proyecto' % fam))
                continue
            ajeno = next((a for a in cfg['ajenos'] if a in desc.upper()), None)
            if ajeno:
                descartados.append((cod, desc, 'la descripcion dice %s' % ajeno))
                continue
            elegidos.append((cod, desc, cfg['familias'][fam]))
        elif re_sm.match(cod):
            ajeno = next((a for a in cfg['ajenos'] if a in desc.upper()), None)
            if ajeno:
                descartados.append((cod, desc, 'la descripcion dice %s' % ajeno))
                continue
            elegidos.append((cod, desc, cfg['conjunto_sm']))
    orden = list(cfg['familias'].values())
    elegidos.sort(key=lambda e: (orden.index(e[2]) if e[2] in orden else 99, e[0]))
    return elegidos, descartados


def verificar_export(path, minimo):
    problemas = []
    with open(path, 'rb') as f:
        crudo = f.read()
    if not crudo.endswith(b'\n'):
        problemas.append('%s no termina en salto de linea: el export quedo cortado'
                         % os.path.basename(path))
    n = crudo.count(b'\n')
    if n < minimo:
        problemas.append('%s tiene %d lineas y un export completo ronda las %d'
                         % (os.path.basename(path), n, minimo))
    return problemas


def fecha_archivo(path):
    return datetime.datetime.fromtimestamp(os.path.getmtime(path)).strftime('%d/%m/%Y %H:%M')


def pagina(doc, titulo, filas, pies):
    p = doc.new_page(width=ANCHO, height=ALTO)
    p.insert_text((28, 30), titulo, fontname='cobo', fontsize=FS + 2.5)
    p.insert_text((28, 46), 'SEMIELABORADOS DE INYECCION DADOS DE ALTA EN ARB',
                  fontname='cobo', fontsize=FS)
    y = 60
    for t, x in COLS:
        p.insert_text((x, y), t, fontname='cobo', fontsize=FS)
    y += 4
    p.draw_line(fitz.Point(28, y), fitz.Point(800, y), width=0.6)
    y = Y_PRIMERA_FILA
    conjunto_previo = None
    for cod, desc, conjunto, alta in filas:
        if conjunto_previo is not None and conjunto != conjunto_previo:
            y += 5
        conjunto_previo = conjunto
        for (_, x), v in zip(COLS, [cod, desc, conjunto, alta]):
            p.insert_text((x, y), v, fontname='cour', fontsize=FS)
        y += LEADING
    y += 10
    p.draw_line(fitz.Point(28, y), fitz.Point(800, y), width=0.6)
    y += 14
    for i, linea in enumerate(pies):
        fuente = 'cobo' if i == len(pies) - 1 else 'cour'
        p.insert_text((30, y), linea, fontname=fuente, fontsize=8)
        y += 11


def validar_pdf(crudo, filas):
    """Relee el PDF ya armado (desde memoria) y confirma que cada fila llego a la hoja."""
    doc = fitz.open(stream=crudo, filetype='pdf')
    faltan = []
    try:
        if doc.page_count != 1:
            faltan.append('el PDF quedo con %d paginas' % doc.page_count)
        texto = doc[0].get_text()
        for cod, desc, conjunto, alta in filas:
            if cod not in texto:
                faltan.append('falta el codigo %s' % cod)
            elif desc and desc[:18] not in texto:
                faltan.append('falta la descripcion de %s' % cod)
    finally:
        doc.close()
    return faltan


def main():
    ap = argparse.ArgumentParser(description='Extracto PDF de semielaborados del arb')
    ap.add_argument('--proyecto', required=True, choices=sorted(PROYECTOS))
    ap.add_argument('--proceso', default='INY', help='prefijo de proceso del codigo (default INY)')
    ap.add_argument('--salida', required=True)
    ap.add_argument('--articulo', default=ARTICULO)
    ap.add_argument('--insumos', default=INSUMOS)
    ap.add_argument('--relaciones', default=RELACIONES)
    args = ap.parse_args()

    gates = []

    # -- GATE 1: los tres exports tienen que existir y estar enteros --
    faltantes = [p for p in (args.articulo, args.insumos, args.relaciones) if not os.path.exists(p)]
    if faltantes:
        sys.exit('ABORTA: no encuentro estos exports del arb: %s' % faltantes)
    problemas = (verificar_export(args.articulo, 2000)
                 + verificar_export(args.insumos, 4000)
                 + verificar_export(args.relaciones, 4500))
    if problemas:
        sys.exit('ABORTA: hay exports incompletos.\n'
                 + ''.join('        - %s\n' % p for p in problemas))
    gates.append('los 3 exports enteros')

    articulos = leer_articulos(args.articulo)
    insumos = leer_insumos(args.insumos)
    print('maestro de articulos: %d  |  maestro de insumos: %d' % (len(articulos), len(insumos)))

    elegidos, descartados = seleccionar(articulos, args.proyecto, args.proceso)
    if not elegidos:
        sys.exit('ABORTA: la seleccion no devolvio ningun codigo.')

    print('\nDESCARTADOS (mismo patron de codigo, otro proyecto):')
    for cod, desc, motivo in descartados:
        print('   %-18s %-42s %s' % (cod, desc, motivo))

    # -- GATE 2: ninguna descripcion vacia (un codigo pelado no se difunde) --
    sin_desc = [c for c, d, _ in elegidos if not d]
    if sin_desc:
        sys.exit('ABORTA: estos codigos no tienen descripcion en el maestro: %s' % sin_desc)
    gates.append('todas las descripciones presentes')

    # -- GATE 3: el listado tiene que entrar en la hoja --
    # La pagina es una sola. Si el listado creciera (otro proyecto, mas familias), las filas
    # de abajo se irian fuera del papel: el gate de relectura las cazaria igual, pero diria
    # "falta el codigo X" en vez de decir que sobran filas. Se aborta ACA, explicando por que.
    if len(elegidos) > FILAS_POR_PAGINA:
        sys.exit('ABORTA: %d codigos no entran en una pagina (tope %d filas). Hay que paginar '
                 'el listado antes de generarlo.' % (len(elegidos), FILAS_POR_PAGINA))
    gates.append('el listado entra en la hoja')

    codigos = [c for c, _, _ in elegidos]
    uso = consumos_en_bom(args.relaciones, codigos)
    usados = {c: n for c, n in uso.items() if n}

    filas = [(c, d, conj, 'Articulo e Insumo' if c in insumos else 'Articulo')
             for c, d, conj in elegidos]

    print('\nSELECCION (%d codigos):' % len(filas))
    for c, d, conj, alta in filas:
        print('   %-18s %-42s %-22s %-18s consumido en BOM: %d' % (c, d, conj, alta, uso[c]))

    fechas = ('Extraido de ARB el %s (maestro de Articulos), %s (Insumos) y %s (Relaciones).'
              % (fecha_archivo(args.articulo), fecha_archivo(args.insumos),
                 fecha_archivo(args.relaciones)))
    if usados:
        linea_uso = ('Consumidos hoy dentro de una BOM del ARB: %s.'
                     % ', '.join('%s (%d)' % (c, n) for c, n in sorted(usados.items())))
    else:
        linea_uso = ('Ninguno de estos codigos se consume hoy dentro de una BOM del ARB: '
                     'la BOM del producto terminado lleva los insumos en forma directa.')
    pies = [fechas, linea_uso, NOTA]

    # El PDF se arma entero en memoria y se valida ANTES de tocar el disco.
    doc = fitz.open()
    pagina(doc, PROYECTOS[args.proyecto]['nombre'], filas, pies)
    crudo = doc.tobytes()
    doc.close()

    # -- GATE 4: releer el PDF y confirmar que todo llego a la hoja --
    perdidas = validar_pdf(crudo, filas)
    if perdidas:
        sys.exit('ABORTA: hay datos del origen que no llegaron al PDF. No se escribio nada.\n'
                 + ''.join('        - %s\n' % p for p in perdidas[:10]))
    gates.append('PDF releido y completo')

    salida = os.path.abspath(args.salida)
    os.makedirs(os.path.dirname(salida), exist_ok=True)
    with open(salida, 'wb') as f:
        f.write(crudo)

    print('\nOK  %s' % salida)
    print('    %d codigos | gates: %s' % (len(filas), ' + '.join(gates)))


if __name__ == '__main__':
    main()
