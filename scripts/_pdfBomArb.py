"""_pdfBomArb.py — arma el PDF de difusion de cambios de BOM del arb (formato Leo).

Extracto FIEL del Maestro de Relaciones: una pagina por pieza con su BOM completa tal
cual sale de C:\\tmp\\RELACIONES.TXT. El bloque ACTUALIZACIONES y la nota de fiel extracto
se repiten en TODAS las paginas.

    python scripts/_pdfBomArb.py --piezas "<PRODUCTO A>,<PRODUCTO B>" \\
        --fecha 04/08/2026 \\
        --act "Se crea part number XXX ..." --act "Se da de baja YYY ..." \\
        --salida "C:\\...\\Modificaciones BOM ARB_20260804.pdf"

    python scripts/_pdfBomArb.py --verificar-vigencia --piezas "..."   # cruce vs ARTICULO.TXT

El PDF se hace DESPUES de cargar en el arb y DESPUES de re-exportar: es un extracto
post-carga, no una propuesta. Ver skill `carga-arb`.

═══ POR QUE ESTE ARCHIVO DESCONFIA DE TODO ═══
El 04/08/2026 este script genero un PDF que se difundio a 15 personas con TRES filas sin
unidad ni consumo y la leyenda "fiel extracto" al pie. Nadie lo noto: se revisaron 2 de las
5 paginas y las 2 estaban bien.

La PRIMERA correccion tambien estaba mal, y esa es la leccion que importa: reconocia la
continuacion de una fila partida preguntando "¿el campo 2 parece un numero?" — y una MEDIDA
numerica (hay codigos de insumo que son solo digitos) contestaba que si, se comia la fila
siguiente y armaba un registro Frankenstein con la unidad y el consumo de otra cosa. Sin
error, con formato normal, y anunciando "4 gates OK".

De ahi los principios de abajo:
  · Reconocer por FORMA COMPLETA, nunca por "este campo parece X".
  · Todo gate falla CERRADO: si no puedo verificar, aborto. Nunca sigo por default.
  · Toda linea del archivo que pertenezca a una pieza pedida tiene que quedar CLASIFICADA;
    una linea que no encaja en ninguna forma conocida aborta con su numero de linea.
  · El PDF se escribe con nombre provisorio y se renombra recien cuando pasaron todos los
    gates: un archivo con el nombre final es, por construccion, un archivo verificado.
  · El resumen final se arma con los gates que REALMENTE corrieron, no con un texto fijo.
Los tests viven en __tests__/scripts/pdfBomArb.test.mjs y cada gate tiene su caso verde y
su caso rojo — un gate se rompe en silencio igual que un parser.
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
Y_PRIMERA_FILA = 62
Y_PIE = ALTO - 118
FILAS_POR_PAGINA = int((Y_PIE - 24 - Y_PRIMERA_FILA) // LEADING)
NOTA = 'NOTA: la informacion es fiel extracto del Maestro de Relaciones de ARB'

# El arbol del TXT: los niveles arrancan en las columnas 0, 7, 14 y 21 (.arb-cache/README.md)
OFFSETS = (0, 7, 14, 21)

# Un consumo del arb SIEMPRE lleva coma decimal ('0,00015000', '21,00000000'). Sin la coma
# no es un consumo: es una medida, un rubro o un codigo. Aceptar enteros pelados fue el bug
# de la primera correccion.
RE_CONSUMO = re.compile(r'\d{1,3}(?:\.\d{3})*,\d+')
RE_UNIDAD = re.compile(r'[A-Za-z][A-Za-z0-9]{0,4}')


def limpiar(s):
    """El export viene en latin-1 y algunas descripciones arrastran bytes de control."""
    return re.sub(r'[\x00-\x1f\x7f]', ' ', s).strip()


def consumo_fmt(s):
    """'1,00000000' -> '1' ; '0,41066660' -> '0.4106666' ; '1.234,50000000' -> '1234.5'.

    No redondea: saca el separador de miles y los ceros de cola. Nada mas."""
    s = s.strip()
    if ',' not in s:
        return s
    s = s.replace('.', '').replace(',', '.')
    return s.rstrip('0').rstrip('.') or '0'


def es_consumo(s):
    return bool(RE_CONSUMO.fullmatch(s.strip()))


def es_unidad(s):
    return bool(RE_UNIDAD.fullmatch(s.strip()))


def verificar_export(path):
    """El arb a veces escupe un RELACIONES cortado y NO avisa. Sintoma real (04/08/2026):
    242 KB contra 819 KB del dia anterior, con la ultima linea partida al medio."""
    problemas = []
    with open(path, 'rb') as f:
        crudo = f.read()
    if not crudo.endswith(b'\n'):
        problemas.append('la ultima linea esta cortada al medio (el archivo no termina en '
                         'salto de linea): el export quedo INCOMPLETO')
    n = crudo.count(b'\n')
    if n < 4500:
        problemas.append(f'solo {n} lineas - un export completo ronda las 6200. Puede estar cortado')
    return problemas


def articulos_vigentes(path_relaciones):
    """Codigos del maestro ARTICULO.TXT (misma carpeta que RELACIONES), o None si no esta.

    Un producto dado de baja DESAPARECE de ARTICULO pero conserva sus lineas en RELACIONES:
    la BOM queda huerfana. Ese cruce es lo unico que distingue vigente de anulado, porque el
    export no trae flag de estado. Devolver None obliga al llamador a abortar: sin el maestro
    NO se puede afirmar que un producto este vigente."""
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


def _registro(campos, off):
    """[codigo, rubro, medida, desc, unidad, consumo, modulo, proceso] desde un offset de nivel."""
    def g(i):
        return limpiar(campos[off + i]) if off + i < len(campos) else ''
    return [g(i) for i in range(8)]


def _es_continuacion(campos, off, previa_vacia):
    """Forma COMPLETA de una continuacion de fila partida, en el offset del registro abierto:

        ['AL', ' KG   ', '   0,00015000', 'COS       ', 'PRDCOS         ', '']
          resto-desc   unidad    consumo      modulo        proceso

    Exige las TRES condiciones a la vez — la linea previa vacia, algo con forma de unidad y
    un consumo con coma decimal. Preguntar solo "¿el campo 2 parece numero?" hacia que una
    medida numerica se comiera la fila siguiente."""
    if not previa_vacia:
        return False
    if off + 2 >= len(campos):
        return False
    return es_unidad(campos[off + 1]) and es_consumo(campos[off + 2])


def leer_bom(path, piezas):
    """{pieza: [(nivel, rubro, medida, desc, unidad, consumo, modulo, proceso), ...]}

    Resuelve las dos trampas del formato y ABORTA ante cualquier linea que no sepa clasificar:
    perder una fila en silencio es el modo de falla que hay que hacer imposible.
    """
    boms = {p: [] for p in piezas}
    raiz = None
    abierto = None          # (offset, fila) del registro incompleto esperando continuacion
    previa_vacia = False
    sin_clasificar = []

    with open(path, encoding='latin-1') as f:
        lineas = f.read().split('\n')

    for nro, linea in enumerate(lineas[1:], start=2):     # [0] es el encabezado
        campos = linea.rstrip('\r').split('\t')
        if not any(c.strip() for c in campos):
            previa_vacia = True
            continue

        # 1) ¿continuacion del registro abierto? Se chequea PRIMERO: el resto de la
        #    descripcion cae en la columna del nivel y se haria pasar por un registro nuevo.
        if abierto is not None and _es_continuacion(campos, abierto[0], previa_vacia):
            off, fila = abierto
            fila[3] = limpiar(f'{fila[3]} {campos[off]}')
            fila[4] = limpiar(campos[off + 1])
            fila[5] = limpiar(campos[off + 2])
            fila[6] = limpiar(campos[off + 3]) if off + 3 < len(campos) else ''
            fila[7] = limpiar(campos[off + 4]) if off + 4 < len(campos) else ''
            abierto = None
            previa_vacia = False
            continue

        # 2) ¿registro nuevo en alguno de los offsets de nivel?
        nivel = next((i for i, off in enumerate(OFFSETS)
                      if off < len(campos) and campos[off].strip()), None)
        if nivel is None:
            sin_clasificar.append((nro, linea[:80]))
            previa_vacia = False
            continue

        if abierto is not None:
            # el registro anterior quedo incompleto y esta linea no lo cierra
            sin_clasificar.append((nro, f'(no cierra la fila partida anterior) {linea[:60]}'))
            abierto = None

        if nivel == 0:
            raiz = campos[0].strip()
        previa_vacia = False

        if raiz not in boms:
            continue

        _, rubro, medida, desc, unidad, consumo, modulo, proceso = _registro(campos, OFFSETS[nivel])
        fila = [nivel, rubro, medida, desc, unidad, consumo, modulo, proceso]
        boms[raiz].append(fila)
        abierto = (OFFSETS[nivel], fila) if not consumo else None

    if abierto is not None:
        sin_clasificar.append((len(lineas), '(fila partida abierta al final del archivo)'))

    return boms, sin_clasificar


def verificar_filas(boms):
    """Ninguna fila puede quedar sin unidad o sin consumo. Es exactamente el defecto que se
    difundio el 04/08/2026 y que no se ve en el PDF: la fila esta, con formato normal, pero
    le faltan dos columnas."""
    rotas = []
    for pieza, filas in boms.items():
        for f in filas:
            if not f[4] or not f[5] or not es_consumo(f[5]):
                rotas.append(f'{pieza} | {f[2]} | {f[3][:40]!r} -> unidad={f[4]!r} consumo={f[5]!r}')
    return rotas



def descripciones_producto(path=None):
    """{codigo_articulo: descripcion} desde ARTICULO.TXT.

    RELACIONES trae el codigo del producto pero NO su descripcion, asi que en el extracto
    cada pagina se identificaba solo con el codigo. Quien no vive en el arb no sabe que
    pieza esta mirando (pedido de Fak, 07/08/2026).
    """
    path = path or os.path.join(os.path.dirname(RELACIONES), 'ARTICULO.TXT')
    d = {}
    if not os.path.exists(path):
        return d
    with open(path, encoding='latin-1', errors='replace') as f:
        for linea in f.read().splitlines()[1:]:
            c = linea.split('	')
            if len(c) >= 2 and c[0].strip():
                d[c[0].strip()] = limpiar(c[1])
    return d


def pagina(doc, pieza, filas, fecha, actualizaciones, descripcion=''):
    p = doc.new_page(width=ANCHO, height=ALTO)
    y = 28
    titulo = pieza if not descripcion else '%s    %s' % (pieza, descripcion)
    p.insert_text((28, y), titulo, fontname='cobo', fontsize=FS + 1.5)
    y = 45
    for titulo, x in COLS:
        p.insert_text((x, y), titulo, fontname='cobo', fontsize=FS)
    y += 4
    p.draw_line(fitz.Point(28, y), fitz.Point(745, y), width=0.6)
    y = Y_PRIMERA_FILA

    for nivel, rubro, medida, desc, unidad, consumo, modulo, proceso in filas:
        etiqueta = pieza if nivel == 0 else '  ' + '.' * nivel + ' ' + pieza
        for (_, x), v in zip(COLS, [etiqueta, rubro, medida, desc, unidad,
                                    consumo_fmt(consumo), modulo, proceso]):
            p.insert_text((x, y), v, fontname='cour', fontsize=FS)
        y += LEADING

    y = Y_PIE
    p.draw_line(fitz.Point(28, y - 12), fitz.Point(745, y - 12), width=0.6)
    p.insert_text((30, y), f'ACTUALIZACIONES {fecha}', fontname='cobo', fontsize=FS)
    y += LEADING
    for item in actualizaciones:
        p.insert_text((30, y), item, fontname='cour', fontsize=8)
        y += 11
    p.insert_text((30, y + 4), NOTA, fontname='cobo', fontsize=8)


def validar_pdf(path, boms, piezas):
    """Releer el PDF generado y confirmar que CADA medida y CADA consumo estan ahi.

    Lo que se difunde es el PDF, asi que la ultima palabra la tiene el PDF releido — no el
    parser que dice haberlo hecho bien. Sobre el 100% de las filas, nunca por muestreo: el
    04/08/2026 se revisaron 2 paginas de 5 y las 2 eran las buenas."""
    doc = fitz.open(path)
    faltan = []
    try:
        if doc.page_count != len(piezas):
            faltan.append(f'el PDF tiene {doc.page_count} paginas y se pidieron {len(piezas)} piezas')
        for i, pieza in enumerate(piezas[:doc.page_count]):
            texto = doc[i].get_text()
            for f in boms[pieza]:
                if f[2] not in texto or consumo_fmt(f[5]) not in texto:
                    faltan.append(f'pag {i + 1} ({pieza}): {f[2]} consumo {consumo_fmt(f[5])}')
    finally:
        doc.close()
    return faltan


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

    if args.verificar_vigencia:
        if vigentes is None:
            sys.exit('ABORTA: no encuentro ARTICULO.TXT al lado de RELACIONES.TXT. Sin el '
                     'maestro no se puede saber si un producto esta vigente.')
        anulados = [p for p in piezas if p not in vigentes]
        print(f'maestro ARTICULO: {len(vigentes)} articulos')
        for p in piezas:
            print(f'  {"ANULADO  " if p in anulados else "vigente  "} {p}')
        sys.exit(1 if anulados else 0)

    if not (args.fecha and args.act and args.salida):
        ap.error('--fecha, --act y --salida son obligatorios para generar el PDF')

    gates = []

    # ── GATE 1: el export tiene que estar entero ──
    problemas = verificar_export(args.relaciones)
    if problemas:
        sys.exit('ABORTA: el export de RELACIONES esta INCOMPLETO.\n' +
                 ''.join(f'        - {p}\n' for p in problemas) +
                 '        Re-exportar del arb y volver a correr.')
    gates.append('export entero')

    # ── GATE 2: ningun producto anulado (falla CERRADO si no hay maestro) ──
    if vigentes is None:
        sys.exit('ABORTA: no encuentro ARTICULO.TXT al lado de RELACIONES.TXT. Sin el maestro '
                 'no puedo descartar que alguna pieza este anulada.')
    anulados = [p for p in piezas if p not in vigentes]
    if anulados:
        sys.exit(f'ABORTA: estos productos NO estan en ARTICULO.TXT, o sea que estan '
                 f'ANULADOS: {anulados}.\n'
                 f'        Sus lineas siguen en RELACIONES porque la BOM queda huerfana al '
                 f'dar de baja el articulo.')
    gates.append('sin productos anulados')

    # ── GATE 3: toda linea del archivo tiene que quedar clasificada ──
    boms, sin_clasificar = leer_bom(args.relaciones, piezas)
    if sin_clasificar:
        sys.exit('ABORTA: hay lineas del export que no supe clasificar. Antes que adivinar, '
                 'freno:\n' +
                 ''.join(f'        - linea {n}: {t!r}\n' for n, t in sin_clasificar[:10]) +
                 (f'        ... y {len(sin_clasificar) - 10} mas\n' if len(sin_clasificar) > 10 else ''))
    gates.append('todas las lineas clasificadas')

    faltan = [p for p in piezas if not boms[p]]
    if faltan:
        sys.exit(f'ABORTA: no hay lineas de BOM para {faltan} en {args.relaciones}.')

    # ── GATE 4: ninguna fila sin unidad o sin consumo ──
    rotas = verificar_filas(boms)
    if rotas:
        sys.exit('ABORTA: hay filas sin unidad o sin consumo valido (fila partida mal '
                 'fusionada).\n' + ''.join(f'        - {r}\n' for r in rotas))
    gates.append('sin filas rotas')

    largas = [f'{p} ({len(boms[p])} filas)' for p in piezas if len(boms[p]) > FILAS_POR_PAGINA]
    if largas:
        sys.exit(f'ABORTA: estas BOMs no entran en una pagina (tope {FILAS_POR_PAGINA} filas) '
                 f'y se pisarian con el bloque ACTUALIZACIONES: {largas}.')
    gates.append('todas las BOMs entran en su pagina')

    # ── El PDF se escribe con nombre provisorio: el nombre final se gana pasando el gate 5 ──
    salida = os.path.abspath(args.salida)
    os.makedirs(os.path.dirname(salida), exist_ok=True)
    parcial = salida + '.parcial'

    DESCR = descripciones_producto()
    doc = fitz.open()
    for pieza in piezas:
        pagina(doc, pieza, boms[pieza], args.fecha, args.act, DESCR.get(pieza, ''))
    doc.save(parcial)
    doc.close()

    # ── GATE 5: releer el PDF y confirmar que todo esta ahi ──
    try:
        perdidas = validar_pdf(parcial, boms, piezas)
    except Exception:
        os.remove(parcial)
        raise
    if perdidas:
        os.remove(parcial)
        sys.exit('ABORTA: el PDF tenia datos del origen que no llegaron a la hoja. No se '
                 'genero ningun archivo.\n' +
                 ''.join(f'        - {p}\n' for p in perdidas[:10]))
    gates.append('PDF releido y completo')
    os.replace(parcial, salida)

    print(f'OK  {salida}')
    for pieza in piezas:
        subs = sum(1 for f in boms[pieza] if f[0] > 0)
        extra = f'  ({subs} de sub-ensamble)' if subs else ''
        print(f'    {pieza:<18} {len(boms[pieza]):>2} filas, todas con unidad y consumo{extra}')
    print(f'\n{len(gates)} gates OK: ' + ', '.join(gates) + '.')


if __name__ == '__main__':
    main()
