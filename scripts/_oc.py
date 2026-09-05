# -*- coding: utf-8 -*-
"""
Indice de ORDENES DE COMPRA del arb (solo lectura).

Compras emite cada OC como un PDF en `Z:\\arb\\oc\\ocauto\\BA`. Son PDF de TEXTO (no
escaneos), asi que se pueden leer todas y armar un indice: que se compro, cuando, a
quien, con que codigo, en que unidad y a que precio.

    python scripts/_oc.py --indexar               # arma/actualiza el cache (incremental)
    python scripts/_oc.py --indexar --full        # rehace el cache de cero
    python scripts/_oc.py --buscar 427ESP002TRO01 # todas las OC de un codigo o texto
    python scripts/_oc.py --cruzar                # OC contra las BOM del arb (RELACIONES)
    python scripts/_oc.py --stats                 # que hay en el cache
    python scripts/_oc.py --selftest              # prueba el parser, sin tocar el disco Z

POR QUE EXISTE (04/09/2026): Federico Kipersain (Produccion) empezo a cruzar a mano las OC
contra las BOM y en tres consultas seguidas destapo problemas reales. Cruzando las 10.705 OC
contra el export RELACIONES salio el caso del IP Pad: la espuma BOCO se COMPRA con el codigo
`185` y se CONSUME con `427ESP002TRO01` — dos codigos del maestro con la misma descripcion,
asi que lo que entra nunca se descuenta. Eso a mano no se ve; aca sale en una corrida.

`--cruzar` deja cuatro CSV en `.oc-cache/`. La que se mira es la 4 (mismo material con dos
codigos), y dentro de esa las marcadas `distinto`: las `raiz-comun` son el mismo codigo escrito
de dos largos, que rompe el descuento igual pero es otro problema.

LIMITE CONOCIDO: la lista 4 son CANDIDATOS por descripcion, no veredictos — dos materiales
distintos pueden compartir los primeros 40 caracteres (RELACIONES corta ahi). Cada par se
confirma abriendo la OC y la BOM antes de tocar nada.

ATENCION — el repo es PUBLICO. El cache va a `.oc-cache/` (gitignoreado): tiene proveedores,
precios y codigos. Nunca commitear su contenido ni pegarlo en archivos del repo.

Esto NO emite ni modifica ordenes de compra: lee los PDF que ya emitio Compras.
"""
import argparse
import csv
import io
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARPETA_OC = r'Z:\arb\oc\ocauto\BA'
CACHE = os.path.join(RAIZ, '.oc-cache')
ITEMS = os.path.join(CACHE, 'oc.csv')
ESTADO = os.path.join(CACHE, 'estado.json')

CAMPOS = ['oc', 'fecha', 'proveedor', 'cuit', 'sector', 'autorizo', 'imputacion', 'moneda',
          'rubro', 'codigo', 'descripcion', 'unidad', 'cantidad', 'precio', 'subtotal',
          'control_importe', 'archivo']

# Un renglon de material. Se ancla por la DERECHA (los importes) porque la descripcion tiene
# espacios dobles adentro ("Punz. PES 100  A 1.5 ML"): partir por espacios la cortaria al medio.
RE_ITEM = re.compile(r'^\s*(\d+)-(.*?)\s\s+(.*?)\s\s+(\S+)((?:\s+[\d.,]+){2,4})\s*$')
RE_OC = re.compile(r'O\. de Compra N.\s*(\d+).*?\((\d{2}/\d{2}/\d{4})\)', re.S)
RE_PROV = re.compile(r'Atenci.n\s*:\s*(.+)')
RE_CUIT = re.compile(r'CUIT\s*:\s*([\d\-]+)')
RE_SECTOR = re.compile(r'Sector Solicitante\s*:\s*(.+)')
RE_AUTOR = re.compile(r'Autoriz.\s*:\s*(.+)')
RE_MONEDA = re.compile(r'expresados en\s+(\w+)')
RE_IMPUT = re.compile(r'[A-Z][A-Z0-9_]{2,}(?:[ /\-][A-Z0-9_]+)*')
RE_NUMERO = re.compile(r'^[\d.,]+$')


def numero(txt):
    """'1.430,000' -> 1430.0 · '100.00' -> 100.0 · '342,342' -> 342.342

    El reporte mezcla los dos formatos en el mismo renglon: cantidad y precio salen con punto
    decimal y el importe con formato argentino. Se decide por lo que trae el texto, no por la
    columna, que es lo unico que no cambia entre reportes.
    """
    txt = (txt or '').strip()
    if not txt:
        return None
    if ',' in txt and '.' in txt:
        txt = txt.replace('.', '').replace(',', '.')
    elif ',' in txt:
        txt = txt.replace(',', '.')
    try:
        return float(txt)
    except ValueError:
        return None


def _cantidad_precio(nums, subtotal):
    """De los 2 a 4 numeros del renglon, cuales son cantidad y precio unitario.

    El reporte tiene columnas 'Unidades' y 'Cantidad' y a veces sale una sola. En vez de
    adivinar por posicion se usa la cuenta que tiene que cerrar: cantidad x precio = importe.
    """
    mejor, err_mejor = (None, None), None
    for i in range(len(nums) - 1):
        q, p = nums[i], nums[i + 1]
        if q is None or p is None:
            continue
        err = abs(q * p - subtotal) if subtotal is not None else None
        if err is None:
            continue
        if err_mejor is None or err < err_mejor:
            mejor, err_mejor = (q, p), err
    if err_mejor is None:
        return None, None, ''
    tolerancia = max(0.01, abs(subtotal) * 0.001)
    return mejor[0], mejor[1], ('ok' if err_mejor <= tolerancia else 'REVISAR')


def parsear(texto, archivo=''):
    """Texto crudo de una OC -> (cabecera, [items]).  Funcion pura: es la que prueba el selftest."""
    cab = {'archivo': os.path.basename(archivo), 'oc': '', 'fecha': '', 'proveedor': '',
           'cuit': '', 'sector': '', 'autorizo': '', 'imputacion': '', 'moneda': ''}
    m = RE_OC.search(texto)
    if m:
        cab['oc'], cab['fecha'] = m.group(1), m.group(2)
    for clave, rx in (('proveedor', RE_PROV), ('cuit', RE_CUIT), ('sector', RE_SECTOR),
                      ('autorizo', RE_AUTOR), ('moneda', RE_MONEDA)):
        m = rx.search(texto)
        if m:
            cab[clave] = m.group(1).strip()
    cab['sector'] = cab['sector'].split('  ')[0].strip()

    # Imputacion de gastos: entre ese titulo y el sector solicitante. La linea trae numeros de
    # cuenta y el centro de costo; se queda con el texto (ej. VW427_PATAGONIA).
    tramo = texto.split('Imputaci')
    if len(tramo) > 1:
        tramo = re.split(r'Sector Solicitante', tramo[1])[0]
        etiquetas = []
        for linea in tramo.split('\n')[1:]:
            for e in RE_IMPUT.findall(linea):
                e = e.strip()
                if e and e not in etiquetas:
                    etiquetas.append(e)
        cab['imputacion'] = ' + '.join(etiquetas)

    items = []
    for linea in texto.split('\n'):
        m = RE_ITEM.match(linea)
        if not m:
            continue
        rubro, codigo, desc, unidad, cola = m.groups()
        cola = cola.split()
        # Renglon SIN unidad: la columna esta vacia en el reporte y lo que quedo en el lugar
        # de la unidad es el primer numero. Pasa en ~2.600 de 27.800 renglones y, sin esto,
        # corre toda la fila: la cantidad sale en el precio y la cuenta nunca cierra.
        # La unidad se deja VACIA — no se adivina (memoria arb_insumos_maestro: se BUSCA).
        if RE_NUMERO.match(unidad):
            cola.insert(0, unidad)
            unidad = ''
        nums = [numero(x) for x in cola]
        subtotal = nums[-1]
        cantidad, precio, control = _cantidad_precio(nums[:-1] + [subtotal], subtotal)
        it = dict(cab)
        it.update(rubro=rubro, codigo=codigo.strip(), descripcion=desc.strip(), unidad=unidad,
                  cantidad=cantidad, precio=precio, subtotal=subtotal, control_importe=control)
        items.append(it)
    return cab, items


def _leer_pdf(ruta):
    import fitz
    doc = fitz.open(ruta)
    try:
        return ''.join(p.get_text() for p in doc)
    finally:
        doc.close()


def _archivos():
    if not os.path.isdir(CARPETA_OC):
        sys.exit('No veo %s.  Monta el disco Z y reintenta.' % CARPETA_OC)
    return sorted(os.path.join(CARPETA_OC, f) for f in os.listdir(CARPETA_OC)
                  if f.lower().endswith('.pdf'))


def _leer_estado():
    try:
        with io.open(ESTADO, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def indexar(full=False, hilos=16):
    """Recorre las OC y arma .oc-cache/oc.csv (un renglon por material de cada OC)."""
    try:
        import fitz  # noqa: F401
    except ImportError:
        sys.exit('Falta PyMuPDF.  pip install pymupdf')
    if not os.path.isdir(CACHE):
        os.makedirs(CACHE)

    archivos = _archivos()
    estado = {} if full else _leer_estado()
    previos = []
    if not full and os.path.exists(ITEMS):
        with io.open(ITEMS, encoding='utf-8', newline='') as f:
            previos = [r for r in csv.DictReader(f)]

    pendientes = []
    for ruta in archivos:
        clave = os.path.basename(ruta)
        st = os.stat(ruta)
        firma = '%d/%d' % (st.st_size, int(st.st_mtime))
        if estado.get(clave) != firma:
            pendientes.append((ruta, clave, firma))
    print('OC en el disco: %d   |   a leer ahora: %d' % (len(archivos), len(pendientes)))
    if not pendientes and previos:
        print('nada nuevo; el cache ya esta al dia (%d renglones)' % len(previos))
        return 0

    nuevos, fallados = [], []

    def trabajo(t):
        ruta, clave, firma = t
        try:
            return clave, firma, parsear(_leer_pdf(ruta), ruta)[1], ''
        except Exception as e:
            return clave, firma, [], str(e)

    hechos = 0
    with ThreadPoolExecutor(max_workers=hilos) as ex:
        for clave, firma, items, error in ex.map(trabajo, pendientes):
            hechos += 1
            if error:
                fallados.append('%s (%s)' % (clave, error))
                continue
            estado[clave] = firma
            nuevos.extend(items)
            if hechos % 1000 == 0:
                print('  ...%d/%d' % (hechos, len(pendientes)))

    rehechas = set(i['archivo'] for i in nuevos)
    filas = [p for p in previos if p.get('archivo') not in rehechas] + nuevos
    filas.sort(key=lambda r: (str(r.get('oc') or '').zfill(8), str(r.get('codigo') or '')))
    with io.open(ITEMS, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS, extrasaction='ignore')
        w.writeheader()
        for r in filas:
            w.writerow(r)
    with io.open(ESTADO, 'w', encoding='utf-8') as f:
        json.dump(estado, f)

    dudosos = [r for r in filas if r.get('control_importe') == 'REVISAR']
    print('cache: %s  |  %d renglones de %d OC' % (ITEMS, len(filas), len(set(r['archivo'] for r in filas))))
    if dudosos:
        print('renglones donde cantidad x precio NO da el importe: %d (revisar a mano)' % len(dudosos))
    if fallados:
        print('NO se pudieron leer %d archivo(s):' % len(fallados))
        for f_ in fallados[:20]:
            print('   ', f_)
    return 0


def _cargar():
    if not os.path.exists(ITEMS):
        sys.exit('No hay cache todavia.  Corre:  python scripts/_oc.py --indexar')
    with io.open(ITEMS, encoding='utf-8', newline='') as f:
        return [r for r in csv.DictReader(f)]


def buscar(termino, limite=60):
    filas = _cargar()
    t = termino.lower()
    hits = [r for r in filas
            if t in (r.get('codigo') or '').lower() or t in (r.get('descripcion') or '').lower()
            or t in (r.get('proveedor') or '').lower()]
    print('%d renglon(es) para "%s"  (cache: %d)' % (len(hits), termino, len(filas)))
    for r in hits[:limite]:
        print('  OC %-6s %s  %-28s %-16s %-42s %-5s %12s %10s %s' % (
            r['oc'], r['fecha'], (r['proveedor'] or '')[:28], (r['codigo'] or '')[:16],
            (r['descripcion'] or '')[:42], r['unidad'] or '', r['cantidad'] or '',
            r['precio'] or '', r['moneda'] or ''))
    if len(hits) > limite:
        print('  ... y %d mas' % (len(hits) - limite))
    return 0


def clave_material(desc):
    """Descripcion -> huella para comparar dos codigos que nombran el MISMO material.

    Se saca todo lo que no sea letra o numero porque el mismo material aparece escrito
    distinto en cada tabla: la BOM dice "BOCO ET 45 GR IG 1550X3 LAMINADA" y la OC
    "BOCO ET 45 GR IG 1550 X 3 LAMINADA". Sin normalizar, ese par —que es el caso del
    IP Pad— no se cruza. RELACIONES ademas corta a 40 caracteres, asi que dos huellas
    se dan por iguales si una empieza con la otra (minimo 12 caracteres, para que
    "ESPUMA DE PU" no se coma media familia).
    """
    return re.sub(r'[^A-Z0-9]', '', (desc or '').upper())


def _mismo_material(a, b):
    if len(a) < 12 or len(b) < 12:
        return a == b and bool(a)
    return a.startswith(b) or b.startswith(a)


def _relaciones():
    """Codigos de insumo usados en alguna BOM del arb -> {codigo: (unidad, [articulos], desc)}.

    Lee el export RELACIONES mas nuevo de .arb-cache. Ojo con el formato (memoria
    reference_arb_export_estructura): latin-1, tabulado, el articulo viene rellenado a 15
    caracteres, y el arbol repite el bloque de columnas cada 7 (L1 codigo col2 / L2 col9 /
    L3 col16). Se leen los tres niveles: quedarse con el primero pierde ~860 filas.
    """
    cand = sorted(f for f in os.listdir(os.path.join(RAIZ, '.arb-cache'))
                  if f.upper().startswith('RELACIONES') and f.upper().endswith('.TXT'))
    if not cand:
        sys.exit('No hay export RELACIONES en .arb-cache/. Exportalo del arb primero.')
    ruta = os.path.join(RAIZ, '.arb-cache', cand[-1])
    usados = {}
    with io.open(ruta, encoding='latin-1') as f:
        for linea in f:
            c = linea.rstrip('\n').split('\t')
            for icod, iuni in ((2, 4), (9, 11), (16, 18)):
                if len(c) > iuni:
                    cod = c[icod].strip()
                    if cod and not cod.isdigit() or (cod.isdigit() and c[iuni].strip()):
                        if cod:
                            art = c[0].strip() or c[max(icod - 9, 0)].strip()
                            u, arts, desc = usados.get(cod, ('', [], ''))
                            if len(arts) < 8 and art:
                                arts.append(art)
                            usados[cod] = (u or c[iuni].strip(), arts,
                                           desc or c[icod + 1].strip())
    return os.path.basename(ruta), usados


def _ultima(ocs):
    """La compra mas reciente de un codigo (las fechas vienen dd/mm/aaaa, no ordenan solas)."""
    if not ocs:
        return ('', '', '', '')
    return sorted(ocs, key=lambda o: (o[0][6:], o[0][3:5], o[0][:2]))[-1]


def cruzar():
    """Cruza el indice de OC contra las BOM del arb y saca los desvios que importan."""
    filas = _cargar()
    fuente, usados = _relaciones()
    comprados, sin_unidad = {}, 0
    for r in filas:
        cod = (r.get('codigo') or '').strip()
        if not cod:
            continue
        # Una unidad numerica no es una unidad: es un renglon donde el reporte dejo la columna
        # vacia. No entra a la comparacion de unidades — comparar contra eso inventa desvios.
        uni = (r.get('unidad') or '').strip()
        if RE_NUMERO.match(uni):
            uni, sin_unidad = '', sin_unidad + 1
        u, ocs, desc = comprados.get(cod, ('', [], ''))
        ocs.append((r.get('fecha') or '', r.get('oc') or '', uni, r.get('proveedor') or ''))
        comprados[cod] = (uni or u, ocs, desc or (r.get('descripcion') or '').strip())

    en_bom_sin_oc = sorted(c for c in usados if c not in comprados)
    comprado_sin_bom = sorted(c for c in comprados if c not in usados)
    unidad_distinta = sorted(c for c in usados if c in comprados
                             and usados[c][0] and comprados[c][0]
                             and usados[c][0].upper() != comprados[c][0].upper())

    # LA LISTA QUE IMPORTA: el mismo material con un codigo para comprar y otro para consumir.
    # Sale de cruzar las dos primeras por DESCRIPCION, no por codigo — el codigo es justamente
    # lo que difiere. Asi aparecio el par 185 / 427ESP002TRO01 del IP Pad.
    huellas_oc = {}
    for c in comprado_sin_bom:
        huellas_oc.setdefault(clave_material(comprados[c][2]), []).append(c)
    partidos = []
    for c in en_bom_sin_oc:
        h = clave_material(usados[c][2])
        for h_oc, codigos in huellas_oc.items():
            if _mismo_material(h, h_oc):
                for c_oc in codigos:
                    # Si un codigo empieza con el otro (00152438-0 / 00152438-02-NHZ) es la
                    # misma raiz escrita de dos largos, no dos codigos distintos. Rompe igual
                    # el descuento, pero es otro problema — y ya conocido (codigos SMRC).
                    raiz = c.startswith(c_oc) or c_oc.startswith(c)
                    partidos.append((c, c_oc, 'raiz-comun' if raiz else 'distinto'))
    # Primero los codigos que no se parecen en nada (el caso IP Pad) y, dentro de eso, por
    # compra mas reciente: un par cuya ultima OC es de 2020 es arqueologia, no un pendiente.
    def _orden(p):
        f = _ultima(comprados[p[1]][1])[0] or '01/01/1900'
        return (p[2] != 'distinto', [-int(x) for x in f.split('/')[::-1]])
    partidos.sort(key=_orden)
    distintos = [p for p in partidos if p[2] == 'distinto']

    print('OC indexadas: %d renglones  |  BOM: %s  |  insumos usados en BOM: %d'
          % (len(filas), fuente, len(usados)))
    print()
    print('1) EN UNA BOM Y NUNCA COMPRADOS ........ %d' % len(en_bom_sin_oc))
    print('2) COMPRADOS Y EN NINGUNA BOM .......... %d' % len(comprado_sin_bom))
    print('3) UNIDAD DE LA OC != UNIDAD DE LA BOM . %d' % len(unidad_distinta))
    if sin_unidad:
        print('   (%d renglones de OC no traen unidad en el reporte: quedan fuera de la 3)'
              % sin_unidad)
    print()
    print('4) MISMO MATERIAL, DOS CODIGOS ......... %d, de los cuales %d con codigos que no'
          % (len(partidos), len(distintos)))
    print('   se parecen en nada  <- ESA es la lista que hay que mirar')
    print('   Se compra por uno y se consume por el otro, asi que lo que entra no se')
    print('   descuenta y lo que se consume no pide compra. Asi salio el caso del IP Pad.')
    for c_bom, c_oc, tipo in partidos[:15]:
        ult = _ultima(comprados[c_oc][1])
        print('   %-16s (BOM) <-> %-14s (compra) %-30s ult. OC %-6s %s'
              % (c_bom, c_oc, (comprados[c_oc][2] or '')[:30], ult[1], ult[0]))
    if len(partidos) > 15:
        print('   ... y %d mas en el CSV' % (len(partidos) - 15))

    if not os.path.isdir(CACHE):
        os.makedirs(CACHE)
    for nombre, codigos, cual in (('en_bom_sin_oc.csv', en_bom_sin_oc, 1),
                                  ('comprado_sin_bom.csv', comprado_sin_bom, 2),
                                  ('unidad_distinta.csv', unidad_distinta, 3)):
        with io.open(os.path.join(CACHE, nombre), 'w', encoding='utf-8', newline='') as f:
            w = csv.writer(f)
            w.writerow(['codigo', 'descripcion', 'unidad_bom', 'articulos_que_lo_usan',
                        'unidad_oc', 'compras', 'ultima_oc', 'ultima_fecha', 'proveedor'])
            for cod in codigos:
                u_bom, arts, d_bom = usados.get(cod, ('', [], ''))
                u_oc, ocs, d_oc = comprados.get(cod, ('', [], ''))
                ult = _ultima(ocs)
                w.writerow([cod, d_bom or d_oc, u_bom, ' '.join(arts), u_oc, len(ocs),
                            ult[1], ult[0], ult[3]])
        print('   lista %d -> %s' % (cual, os.path.join(CACHE, nombre)))

    ruta4 = os.path.join(CACHE, 'mismo_material_dos_codigos.csv')
    with io.open(ruta4, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['tipo', 'codigo_en_la_bom', 'descripcion_bom', 'unidad_bom',
                    'articulos_que_lo_usan', 'codigo_con_que_se_compra', 'descripcion_oc',
                    'unidad_oc', 'compras', 'ultima_oc', 'ultima_fecha', 'proveedor'])
        for c_bom, c_oc, tipo in partidos:
            u_bom, arts, d_bom = usados[c_bom]
            u_oc, ocs, d_oc = comprados[c_oc]
            ult = _ultima(ocs)
            w.writerow([tipo, c_bom, d_bom, u_bom, ' '.join(arts), c_oc, d_oc, u_oc,
                        len(ocs), ult[1], ult[0], ult[3]])
    print('   lista 4 -> %s' % ruta4)
    return 0


def stats():
    filas = _cargar()
    ocs = set(r['archivo'] for r in filas)
    anios = {}
    for r in filas:
        anios[(r.get('fecha') or '')[-4:]] = anios.get((r.get('fecha') or '')[-4:], 0) + 1
    print('renglones : %d' % len(filas))
    print('OC        : %d' % len(ocs))
    print('codigos   : %d' % len(set(r['codigo'] for r in filas if r['codigo'])))
    print('proveedores: %d' % len(set(r['proveedor'] for r in filas if r['proveedor'])))
    for a in sorted(anios):
        print('   %-6s %6d renglones' % (a or '(sin fecha)', anios[a]))
    return 0


# Texto real de OC15964-MENTVIL SA.PDF (la que fotografio Fak el 04/09/2026) y el renglon
# real de la OC 7205, que trae dos trampas: codigo con espacio adentro ("TPES100 -2") y
# descripcion con espacios dobles ("Punz. PES 100  A 1.5 ML").
OC_15964 = u"""Barack Argentina S.R.L.   30-71094289-3
 O. de Compra N\xb0 15964  -  Control  N\xb0 15964  (29/07/2026)
Imputaci\xf3n de Gastos
 105   185                VW427_PATAGONIA            100.00
 Sector Solicitante   :  INGENIERIA                     - DROSELLO
 Autoriz\xf3             :  DROSELLO
 Atenci\xf3n  : MENTVIL S.A.
 CUIT      : 30-60578035-7         TE        : 5648-6160
 C\xf3digo              Material                                            Unidad  Unidades  Cantidad  P.Unitario     Subtotal
      1-427ESP001TRO01    ESPUMA DE PU DENSIDAD 35KG/M3                        MT2                100.00     14.3000     1.430,000
                             Los precios de esta Orden de Compra estan expresados en  DOLAR
"""

OC_7205 = u""" O. de Compra N\xb0 7205  -  Control  N\xb0 7205  (24/06/2021)
 Atenci\xf3n  : TEXTIL VALERIO  S.A.C.I.F.
      1-TPES100 -2       Punz. PES 70 + TNT PP 30 BCO. Ancho: 2mt            MT2              18149.00      0.6000    10.889,400
      1-TPES100 -1       Punz. PES 100  A 1.5 ML Termofijado Blan            MT2               2643.00      0.5600     1.480,080
"""

# Renglon con la columna Unidad VACIA (OC 4703). Es el 9,3% del archivo: si no se detecta,
# la cantidad se lee como precio y la fila entera queda corrida.
OC_4703 = u""" O. de Compra N\xb0 4703  -  Control  N\xb0 4703  (14/11/2019)
      1-3641222           DILOUR SATIN BLACK                                    100.00     15.8400     1.584,000
"""


def selftest():
    """Prueba el parser contra OC reales — incluidos los casos donde tiene que decir REVISAR.

    Regla de la casa: un control se estrena contra el caso donde ya se conoce la respuesta, y
    se prueba tambien EN ROJO (un parser que nunca se queja no controla nada).
    """
    fallas = []

    def chequear(nombre, obtenido, esperado):
        ok = obtenido == esperado
        print('  %s %-52s %s' % ('ok ' if ok else 'MAL', nombre, obtenido if ok else
                                 '%r (esperaba %r)' % (obtenido, esperado)))
        if not ok:
            fallas.append(nombre)

    cab, items = parsear(OC_15964, 'OC15964-MENTVIL SA.PDF')
    chequear('OC 15964 - numero', cab['oc'], '15964')
    chequear('OC 15964 - fecha', cab['fecha'], '29/07/2026')
    chequear('OC 15964 - proveedor', cab['proveedor'], 'MENTVIL S.A.')
    chequear('OC 15964 - sector', cab['sector'], 'INGENIERIA')
    chequear('OC 15964 - imputacion', cab['imputacion'], 'VW427_PATAGONIA')
    chequear('OC 15964 - moneda', cab['moneda'], 'DOLAR')
    chequear('OC 15964 - renglones', len(items), 1)
    it = items[0]
    chequear('OC 15964 - codigo', it['codigo'], '427ESP001TRO01')
    chequear('OC 15964 - unidad (MT2, no KG)', it['unidad'], 'MT2')
    chequear('OC 15964 - cantidad', it['cantidad'], 100.0)
    chequear('OC 15964 - precio', it['precio'], 14.3)
    chequear('OC 15964 - importe', it['subtotal'], 1430.0)
    chequear('OC 15964 - la cuenta cierra', it['control_importe'], 'ok')

    _, items = parsear(OC_7205, 'OC07205-TEXTIL VALERIO SA.PDF')
    chequear('OC 7205 - renglones', len(items), 2)
    chequear('OC 7205 - codigo con espacio adentro', items[0]['codigo'], 'TPES100 -2')
    chequear('OC 7205 - descripcion entera', items[0]['descripcion'],
             'Punz. PES 70 + TNT PP 30 BCO. Ancho: 2mt')
    chequear('OC 7205 - descripcion con espacio doble', items[1]['descripcion'],
             'Punz. PES 100  A 1.5 ML Termofijado Blan')
    chequear('OC 7205 - cantidad', items[0]['cantidad'], 18149.0)

    _, items = parsear(OC_4703, 'OC04703.pdf')
    it = items[0]
    chequear('OC 4703 - sin unidad: queda VACIA', it['unidad'], '')
    chequear('OC 4703 - sin unidad: cantidad', it['cantidad'], 100.0)
    chequear('OC 4703 - sin unidad: precio', it['precio'], 15.84)
    chequear('OC 4703 - sin unidad: la cuenta cierra', it['control_importe'], 'ok')

    # EN ROJO: importe que no cierra con cantidad x precio -> tiene que avisar.
    roto = OC_15964.replace('1.430,000', '9.999,000')
    _, items = parsear(roto, 'roto.pdf')
    chequear('ROJO: importe que no cierra', items[0]['control_importe'], 'REVISAR')
    # EN ROJO: numeros en formato argentino donde el importe lleva coma decimal.
    chequear('ROJO: numero argentino', numero('1.430,000'), 1430.0)
    chequear('numero con punto decimal', numero('50.000'), 50.0)

    if fallas:
        print('FALLARON %d caso(s): %s' % (len(fallas), ', '.join(fallas)))
        return 1
    print('todo verde')
    return 0


def main():
    ap = argparse.ArgumentParser(description='Indice de ordenes de compra del arb (solo lectura)')
    ap.add_argument('--indexar', action='store_true', help='leer las OC del disco Z al cache')
    ap.add_argument('--full', action='store_true', help='con --indexar: rehacer el cache de cero')
    ap.add_argument('--buscar', metavar='TEXTO', help='codigo, descripcion o proveedor')
    ap.add_argument('--limite', type=int, default=60)
    ap.add_argument('--cruzar', action='store_true', help='OC contra las BOM del arb')
    ap.add_argument('--stats', action='store_true')
    ap.add_argument('--selftest', action='store_true', help='probar el parser, sin el disco Z')
    a = ap.parse_args()

    if a.selftest:
        sys.exit(selftest())
    elif a.indexar:
        sys.exit(indexar(full=a.full))
    elif a.buscar:
        sys.exit(buscar(a.buscar, a.limite))
    elif a.cruzar:
        sys.exit(cruzar())
    elif a.stats:
        sys.exit(stats())
    else:
        ap.print_help()


if __name__ == '__main__':
    main()
