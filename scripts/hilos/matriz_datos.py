# -*- coding: utf-8 -*-
"""
matriz_datos.py - los datos de la matriz de hilos por pieza: que piezas se consumen hoy (plan de entrega de
PCP), en que tabla va cada una y que hilos tiene cada pieza en el arb. Solo lee.

La carpeta de entrada lleva COPIAS locales (nunca se abre el original del servidor):
  PE.xlsx        <- Y:\\PRODUCCION\\PCP\\Barack Argentina\\Planes Entrega\\1- PE Consolidado\\PE_Wnn.xlsx
  PROGRAMA.xlsx  <- Y:\\PRODUCCION\\PCP\\Barack Argentina\\2- 26Wnn  Programa de Producción.xlsx
El arb sale del export RELACIONES (scripts/_lib/arbRelaciones.py elige el mas nuevo y da su sello).

El producto se busca en el arb por su codigo EXACTO: hay productos cargados dos veces con distinta grafia
y distinta BOM, y buscar "sin guiones" elige el equivocado (ver cruce_programa_arb.py).
"""
import collections
import datetime
import importlib.util
import os
import sys

import openpyxl

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
sys.path.insert(0, AQUI)
from criterio_hilo import es_hilo  # noqa: E402

_spec = importlib.util.spec_from_file_location('arbRelaciones', os.path.join(RAIZ, 'scripts', '_lib', 'arbRelaciones.py'))
AR = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(AR)

# Tabla -> sectores del plan de entrega (hoja Articulos, columna Sector), en el orden en que se muestran.
# Un sector que no esta aca no lleva costura; si alguno de sus articulos tiene hilo en el arb, cae en "Otros".
TABLAS = collections.OrderedDict([
    ('Patagonia', ['APC Patagonia', 'INSERT Patagonia', 'APB Patagonia', 'IP PAD Patagonia',
                   'APB Trasero Central Patagonia', 'APB Trasero Anterior Patagonia',
                   'APB Trasero Posterior Patagonia', 'TOP ROLL Patagonia']),
    ('Amarok', ['APC AMK', 'IP-AMK', 'TAPA AMK']),
    ('Taos', ['APC TAOS', 'IP-TAOS', 'INSERT TAOS', 'APB TAOS', 'TOP ROLL TAOS']),
    ('SMRC', ['P703', 'P21', 'BSUV', 'TAPA BSUV']),
    ('PWA Costura Blanco', ['BLANCO']),
    ('Otros', ['MIRGOR', 'COFIAS']),
])
SECTOR_A_TABLA = {s: t for t, ss in TABLAS.items() for s in ss}
# Una pieza esta ACTIVA si tiene programa en la semana, pedido en el plan de entrega o produccion declarada en
# los ultimos DIAS_RECIENTE dias de la base de produccion (las piezas de Novax no estan en el plan de entrega).
DIAS_RECIENTE = 90
NIVELES = 12        # el export anida hasta 4; con 12 la explosion llega siempre al ultimo nivel


def _num(v):
    return v if isinstance(v, (int, float)) else 0


def leer_pe(ruta, hoy):
    """Articulos vigentes del plan de entrega: [{art, cliente, sector, desc, inst, vigente, firme, fc6}]."""
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    rows = list(wb['Firme + Forecast'].iter_rows(values_only=True))
    semana = str(rows[0][2] or '').replace('Firme', '').strip()
    hdr = list(rows[1])
    i_tot = hdr.index('Total')
    fc_cols = [j for j, v in enumerate(hdr) if j > i_tot and v not in (None, '')]   # todo el forecast publicado
    pedido = {}
    for r in rows[2:]:
        if not r[2]:
            continue
        k = AR.clave(str(r[2]))
        d = pedido.setdefault(k, {'firme': 0, 'fc': 0})
        d['firme'] += _num(r[i_tot])
        d['fc'] += sum(_num(r[j]) for j in fc_cols if j < len(r))
    arts = collections.OrderedDict()
    for r in list(wb['Articulos'].iter_rows(values_only=True))[1:]:
        if not r[3]:
            continue
        art = str(r[3]).strip()
        hasta = r[6]
        vigente = not isinstance(hasta, datetime.datetime) or hasta >= hoy
        k = AR.clave(art)
        if k in arts and (arts[k]['vigente'] or not vigente):
            continue          # un articulo repetido: vale la fila vigente
        p = pedido.get(k, {})
        arts[k] = {'art': art, 'cliente': str(r[0] or '').strip(), 'sector': (str(r[2]).strip() if r[2] else ''),
                   'desc': str(r[4] or '').strip(), 'inst': str(r[7] or '').strip(), 'vigente': vigente,
                   'firme': p.get('firme'), 'fc': p.get('fc')}
    return [a for a in arts.values() if a['vigente']], semana


def leer_programa(ruta):
    """{clave articulo: {'costura': unidades Lu-Vi en Costura / Costura Blanco, 'total': en cualquier proceso}}."""
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    prog = {}
    for i, row in enumerate(wb['Difusion'].iter_rows(values_only=True)):
        if i == 0 or not row[1]:
            continue
        proc = str(row[3] or '').strip()
        n = sum(_num(v) for v in row[4:9])
        d = prog.setdefault(AR.clave(str(row[1])), {'costura': None, 'total': 0, 'linea': str(row[0] or '').strip()})
        d['total'] += n
        if proc in ('Costura', 'Costura Blanco'):
            d['costura'] = (d['costura'] or 0) + n
    return prog


# ---------------------------------------------------------------------------- bases de PCP (opcionales)
# Copias de Y:\PRODUCCION\PCP (memoria reference_datos_produccion_pcp_federico). Dicen lo que se CARGO en el
# sistema, con la fecha del archivo: sirven para ver si una pieza se produjo y si un hilo se movio.

def _fecha(v):
    if isinstance(v, datetime.datetime):
        f = v
    else:
        try:
            f = datetime.datetime.strptime(str(v)[:10], '%Y-%m-%d')
        except (ValueError, TypeError):
            return None
    return f if 2015 < f.year and f <= datetime.datetime.now() else None   # el kardex trae fechas rotas (1921, 2126, 30/12/2026)


def _cant(v):
    try:
        return float(str(v).strip().replace(',', '.'))
    except (ValueError, TypeError):
        return 0.0


def leer_produccion(ruta):
    """db_produccion.xlsx -> ({clave articulo: {'ult': fecha de la ultima produccion OK, 'ok': unidades}}, (desde, hasta))."""
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    prod, fechas = {}, []
    for i, r in enumerate(wb.worksheets[0].iter_rows(values_only=True)):
        if i == 0 or not r or r[7] is None:
            continue
        f, ok = _fecha(r[6]), _cant(r[12])
        if not f:
            continue
        fechas.append(f)
        if ok <= 0:
            continue
        p = prod.setdefault(AR.clave(str(r[7])), {'ult': f, 'ok': 0.0})
        p['ult'] = max(p['ult'], f)
        p['ok'] += ok
    return prod, (min(fechas), max(fechas))


def leer_kardex(ruta, es_de_interes):
    """db_mov_depositos.xlsx (hoja KARDEX) -> ({clave insumo: {'ingreso': fecha, 'pase': fecha, 'consumo': fecha}}, (desde, hasta)).
    II = ingreso con remito y OC del proveedor; MD = pase entre depositos; EI = egreso por orden de produccion
    (lo descuenta el sistema segun la lista de materiales). Los ajustes (AD, AJ) no cuentan como movimiento."""
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    mov, fechas = {}, []
    campo = {'II': 'ingreso', 'MD': 'pase', 'EI': 'consumo'}
    for i, r in enumerate(wb['KARDEX'].iter_rows(values_only=True)):
        if i == 0 or not r or r[1] is None:
            continue
        f = _fecha(r[5])
        if not f:
            continue
        fechas.append(f)
        cod = str(r[1]).strip()
        c = campo.get(str(r[2]).strip())
        if not c or not es_de_interes(cod):
            continue
        m = mov.setdefault(AR.clave(cod), {'ingreso': None, 'pase': None, 'consumo': None})
        if m[c] is None or f > m[c]:
            m[c] = f
    return mov, (min(fechas), max(fechas))


def leer_ocs(ruta, es_de_interes):
    """db_ordenes_compra.xlsx -> ({clave insumo: {'fecha', 'oc', 'proveedor', 'n'}} con la ultima OC, (desde, hasta))."""
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    ocs, fechas = {}, []
    for i, r in enumerate(wb.worksheets[0].iter_rows(values_only=True)):
        if i == 0 or not r or r[7] is None:
            continue
        f = _fecha(r[0])
        if not f:
            continue
        fechas.append(f)
        partes = str(r[7]).split(None, 1)          # '  1    FX284-E0PTO   ' = rubro + codigo
        cod = partes[1].strip() if len(partes) > 1 else ''
        if not es_de_interes(cod):
            continue
        o = ocs.setdefault(AR.clave(cod), {'fecha': f, 'oc': str(r[1]).strip(), 'proveedor': str(r[3] or '').strip(), 'ocs': set()})
        o['ocs'].add(str(r[1]).strip())
        if f >= o['fecha']:
            o.update(fecha=f, oc=str(r[1]).strip(), proveedor=str(r[3] or '').strip())
    return ocs, (min(fechas), max(fechas))


class Arb:
    """El export RELACIONES con las consultas que usa la matriz."""

    def __init__(self):
        self.rel, self.sello = AR.cargar()
        self.exactos = {}
        self.compactos = collections.defaultdict(list)
        for kr, (raiz, _) in self.rel._boms.items():
            self.exactos[AR.clave(raiz)] = raiz
            self.compactos[AR.compacto(raiz)].append(raiz)
        self._hilos = {}

    def buscar(self, art):
        """(codigo en el arb | None, como se encontro). Primero EXACTO; si hay varias grafias no se elige."""
        if AR.clave(art) in self.exactos:
            return self.exactos[AR.clave(art)], 'exacto'
        c = AR.compacto(art)
        cand = self.compactos.get(c) or [v for k, vs in self.compactos.items() if k.lstrip('0') == c.lstrip('0') for v in vs]
        if len(cand) == 1:
            return cand[0], 'otra grafia: %s' % cand[0]
        if cand:
            return None, 'varias grafias en el arb: %s' % ', '.join(cand)
        return None, 'sin BOM en el arb'

    def hilos(self, cod):
        """Hilos de un producto, abriendo los semielaborados hasta el ultimo nivel: OrderedDict {codigo: {desc, un, cons}}."""
        if cod not in self._hilos:
            out = collections.OrderedDict()
            for n in self.rel.explotar(cod, NIVELES):
                f = n.fila
                if n.es_semi and not n.cortado:
                    continue
                if es_hilo(f.codigo, f.desc):
                    d = out.setdefault(f.codigo, {'desc': f.desc, 'un': f.unidad, 'cons': 0.0})
                    d['cons'] += n.acumulado or 0.0
            self._hilos[cod] = out
        return self._hilos[cod]

    def productos(self):
        return [raiz for kr, (raiz, _) in self.rel._boms.items()]

    def grafias_dobles(self):
        return [v for v in self.compactos.values() if len(v) > 1]


def armar(carpeta, hoy=None):
    """Devuelve dict con todo lo que necesita la matriz."""
    hoy = hoy or datetime.datetime.now()
    arb = Arb()
    arts, semana = leer_pe(os.path.join(carpeta, 'PE.xlsx'), hoy)
    prog = leer_programa(os.path.join(carpeta, 'PROGRAMA.xlsx'))
    p_prod = os.path.join(carpeta, 'db_produccion.xlsx')
    produccion, rango_prod = leer_produccion(p_prod) if os.path.exists(p_prod) else ({}, None)
    piezas = []
    fuera = collections.Counter()
    en_pe = set()          # codigos del arb de TODOS los articulos del plan de entrega (esten o no en una tabla)
    for a in arts:
        cod, como = arb.buscar(a['art'])
        if cod:
            en_pe.add(AR.clave(cod))
        hs = arb.hilos(cod) if cod else collections.OrderedDict()
        tabla = SECTOR_A_TABLA.get(a['sector'])
        if not tabla:
            if not hs:
                fuera[a['sector'] or '(sin sector)'] += 1
                continue
            # un articulo con hilo en un sector que no es de costura: las telas de PWA van con las de PWA
            tabla = 'PWA Costura Blanco' if a['cliente'] == 'PWA' else 'Otros'
        p = prog.get(AR.clave(a['art']), {})
        if a['desc'] in ('', '-') and cod:
            a = dict(a, desc=arb.rel.descripcion(cod) or '')
        pedido = None if a['firme'] is None else a['firme'] + a['fc']
        ult = (produccion.get(AR.clave(a['art'])) or {}).get('ult')
        reciente = bool(ult and rango_prod and ult >= rango_prod[1] - datetime.timedelta(days=DIAS_RECIENTE))
        piezas.append(dict(a, tabla=tabla, arb=cod, como=como, hilos=hs, pedido=pedido,
                           prog_costura=p.get('costura'), prog_total=p.get('total'), ult_prod=ult,
                           demanda=bool((p.get('total') or 0) > 0 or (pedido or 0) > 0 or reciente)))
    orden_t = list(TABLAS)
    orden_s = {s: i for ss in TABLAS.values() for i, s in enumerate(ss)}
    piezas.sort(key=lambda p: (orden_t.index(p['tabla']), orden_s.get(p['sector'], 99), p['sector']))
    return {'arb': arb, 'piezas': piezas, 'fuera': fuera, 'semana': semana, 'n_pe': len(arts), 'hoy': hoy, 'en_pe': en_pe,
            'rango_prod': rango_prod}


def listar(carpeta):
    sys.stdout.reconfigure(encoding='utf-8')
    d = armar(carpeta)
    for l in d['arb'].sello.lineas():
        print(l)
    print('plan de entrega: %s, %d articulos; en las tablas: %d; sectores sin costura (afuera): %s'
          % (d['semana'], d['n_pe'], len(d['piezas']), dict(d['fuera'])))
    ult = None
    for p in d['piezas']:
        if (p['tabla'], p['sector']) != ult:
            ult = (p['tabla'], p['sector'])
            print('\n=== %s / %s' % ult)
        print('  %-20s %-34s %-8s %-9s prog %-6s ped %-7s | %s%s' % (
            p['art'], p['desc'][:34], p['cliente'][:8], p['inst'],
            '-' if p['prog_costura'] is None else int(p['prog_costura']),
            '-' if p['pedido'] is None else int(p['pedido']),
            '; '.join(p['hilos']) or '(sin hilo)', '' if p['como'] == 'exacto' else '   [%s]' % p['como']))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    listar(os.path.abspath(sys.argv[1]))
