# -*- coding: utf-8 -*-
"""
cruce_programa_arb.py - arma la foto de datos del plan de hilos: articulos del programa de Costura
(semanas 40 y 41) + plan de entrega + los hilos que cada uno tiene en el export RELACIONES del arb.

Uso:  python scripts/hilos/cruce_programa_arb.py <carpeta con las COPIAS de PCP> [salida.json]

La carpeta lleva copias locales (nunca se abre el original del servidor) con estos nombres:
  W40.xlsx, W41.xlsx   <- Y:\\PRODUCCION\\PCP\\Barack Argentina\\2- 26W4x  Programa de Producción.xlsx
  PE_W41.xlsx          <- ...\\Planes Entrega\\1- PE Consolidado\\PE_W41.xlsx
No escribe en el arb ni en el servidor: solo el json de salida (por defecto, base.json en esa carpeta).

El producto se busca en el arb por su codigo EXACTO: hay 10 productos cargados dos veces con distinta
grafia y distinta BOM (2HT857115 YZM y 2HT-857-115-YZM), y buscar "sin guiones" elige el equivocado.
"""
import importlib.util, os, sys, re, collections, json, openpyxl
sys.stdout.reconfigure(encoding='utf-8')
if len(sys.argv) < 2:
    raise SystemExit(__doc__)
S = os.path.abspath(sys.argv[1])
SALIDA = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(S, 'base.json')
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec = importlib.util.spec_from_file_location('arbRelaciones', os.path.join(RAIZ, 'scripts', '_lib', 'arbRelaciones.py'))
AR = importlib.util.module_from_spec(spec); spec.loader.exec_module(AR)
rel, sello = AR.cargar()
RX_DESC = re.compile(r'\bHILO|STCH|STITCH', re.I)
RX_COD = re.compile(r'^(FX\d|BX\d|GM\d\dW|NEO|B737|COATS|H-(AB|TN)|58\d{4}\.X|83010\d\d$|HILO )', re.I)
RX_NO = re.compile(r'^(COR-|MOI-|MC-)|CORTE|PIEZA COSTURADA', re.I)


def es_hilo(f):
    if RX_NO.search(f.codigo + ' ' + f.desc):
        return False
    return bool(RX_DESC.search(f.desc or '') or RX_COD.match(f.codigo or ''))


# --- programa
prog = collections.OrderedDict()
for w in ('W40', 'W41'):
    wb = openpyxl.load_workbook(os.path.join(S, w + '.xlsx'), read_only=True, data_only=True)
    for i, row in enumerate(wb['Difusion'].iter_rows(values_only=True)):
        if i == 0 or not row[1]:
            continue
        proc = str(row[3] or '').strip()
        if proc not in ('Costura', 'Costura Blanco'):
            continue
        k = str(row[1]).strip()
        d = prog.setdefault(k, {'linea': str(row[0]).strip(), 'desc': str(row[2] or '').strip(), 'proc': proc, 'W40': 0, 'W41': 0})
        d[w] += sum(v for v in row[4:9] if isinstance(v, (int, float)))   # Lu a Vi; un articulo repetido se suma

# --- PE W41
wb = openpyxl.load_workbook(os.path.join(S, 'PE_W41.xlsx'), read_only=True, data_only=True)
pe = {}
rows = list(wb['Firme + Forecast'].iter_rows(values_only=True))
hdr = list(rows[1])
i_tot = hdr.index('Total')
fc_cols = [j for j, v in enumerate(hdr) if isinstance(v, (int, float)) and j > i_tot]
for r in rows[2:]:
    if not r[2]:
        continue
    art = str(r[2]).strip()
    firme = r[i_tot] if isinstance(r[i_tot], (int, float)) else 0
    fc = [r[j] for j in fc_cols[:6] if j < len(r) and isinstance(r[j], (int, float))]
    pe[AR.compacto(art)] = {'art': art, 'cliente': r[0], 'desc': r[3], 'firme': firme, 'fc6': sum(fc), 'nfc': len(fc)}
arts = {}
for r in wb['Articulos'].iter_rows(values_only=True):
    if r[3] and r[3] != 'Artículo':
        arts[AR.compacto(str(r[3]))] = {'cliente': r[0], 'sector': r[2], 'desc': r[4], 'inst': r[7], 'hasta': str(r[6])[:10]}

# --- arb
prods = {}
exactos = {}
for kr, (raiz, fs) in rel._boms.items():
    prods.setdefault(AR.compacto(raiz), []).append(raiz)
    exactos[AR.clave(raiz)] = raiz
for c, lista in prods.items():
    if len(lista) > 1:
        print('MISMO CODIGO CON DOS GRAFIAS EN EL ARB:', lista)


def buscar(art):
    """Primero el codigo EXACTO como lo escribe el programa; recien despues la grafia sin guiones ni espacios.
    (Hay productos cargados dos veces en el arb con distinta grafia y distinta BOM: 2HT857115 YZM y 2HT-857-115-YZM.)"""
    if AR.clave(art) in exactos:
        return exactos[AR.clave(art)]
    c = AR.compacto(art)
    if c in prods:
        if len(prods[c]) > 1:   # no se elige: cada grafia tiene su BOM y una es la vieja
            raise SystemExit('%s no esta con ese codigo exacto en el arb y hay varias grafias: %s' % (art, prods[c]))
        return prods[c][0]
    c2 = c.lstrip('0')
    hits = [v for k, vs in prods.items() if k.lstrip('0') == c2 for v in vs]
    if len(hits) > 1:
        raise SystemExit('%s: varias grafias en el arb sin el cero inicial: %s' % (art, hits))
    return hits[0] if hits else None


def hilos_de(cod):
    out = []
    for n in rel.explotar(cod, 4):
        f = n.fila
        if n.es_semi and not n.cortado:
            continue
        if es_hilo(f):
            out.append({'cod': f.codigo, 'desc': f.desc, 'un': f.unidad, 'cons': n.acumulado, 'mod': f.modulo})
    return out


base = []
for art, d in prog.items():
    arb = buscar(art)
    c = AR.compacto(art)
    p = pe.get(c) or pe.get(c.lstrip('0')) or {}
    a = arts.get(c) or {}
    base.append({'art': art, **d, 'arb': arb, 'hilos': hilos_de(arb) if arb else [], 'pe_firme': p.get('firme'), 'pe_fc6': p.get('fc6'),
                 'cliente': p.get('cliente') or a.get('cliente'), 'inst': a.get('inst'), 'pe_desc': p.get('desc') or a.get('desc')})
json.dump({'sello': sello.lineas(), 'base': base}, open(SALIDA, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('articulos en programa de costura:', len(base))
print('con programa>0 en W40 o W41:', sum(1 for b in base if b['W40'] + b['W41'] > 0))
print('sin BOM en arb:', [b['art'] for b in base if not b['arb']])
print('sin PE match:', [b['art'] for b in base if b['pe_firme'] is None])

# --- al reves: productos del arb con hilo y demanda en PE que NO estan en el programa de costura
enprog = {AR.compacto(a) for a in prog} | {AR.compacto(a).lstrip('0') for a in prog}
print('\nCON HILO EN ARB + DEMANDA EN PE, FUERA DEL PROGRAMA DE COSTURA W40/W41:')
for kr, (raiz, fs) in rel._boms.items():
    c = AR.compacto(raiz)
    if c in enprog or c.lstrip('0') in enprog:
        continue
    p = pe.get(c) or pe.get(c.lstrip('0'))
    if not p or (p['firme'] + p['fc6']) <= 0:
        continue
    h = hilos_de(raiz)
    if h:
        print('  %-20s %-28s firme %s fc6 %s  hilos: %s' % (raiz, str(p['desc'])[:28], p['firme'], p['fc6'], ', '.join(x['cod'] for x in h)))

print('\nRESUMEN por linea:')
for linea in collections.OrderedDict.fromkeys(b['linea'] for b in base):
    bs = [b for b in base if b['linea'] == linea]
    act = [b for b in bs if b['W40'] + b['W41'] > 0]
    hs = collections.Counter(h['cod'] for b in act for h in b['hilos'])
    print('  %-12s total %2d  con programa %2d  inst %s  hilos %s' % (linea, len(bs), len(act), collections.Counter(b['inst'] for b in bs).most_common(), dict(hs)))
print()
for b in base:
    print('%-10s %-18s P40 %5s P41 %5s | PE firme %6s fc6 %6s | %s | %s' % (
        b['linea'], b['art'], b['W40'], b['W41'], b['pe_firme'], b['pe_fc6'], b['inst'],
        '; '.join('%s %s %s' % (h['cod'], ('%.7f' % h['cons']).rstrip('0'), h['un']) for h in b['hilos'])))
