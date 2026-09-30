# -*- coding: utf-8 -*-
"""
_consumo.py - contesta consumos del ERP arb en segundos, SIN abrir el arb. SOLO LECTURA.

    python scripts/_consumo.py <codigo|texto>              BOM explotada de un producto
    python scripts/_consumo.py --donde-se-usa <codigo>     que productos usan ese insumo, y cuanto

    opciones:  --niveles N   cuantos niveles de semielaborado se abren (default 3; 0 = solo lineas directas)
               --max N       largo maximo de las listas (default 60; 0 = sin limite)
               --export RUT  usar ESE export RELACIONES en vez del mas nuevo

Lee el export RELACIONES mas nuevo (C:\\tmp\\RELACIONES.TXT y las copias de .arb-cache), las
descripciones de ARTICULO.TXT / INSUMOS.TXT y el journal .arb-cache/carga_*.jsonl. No escribe en
el arb, ni en el cache, ni en ningun lado. No depende de que `_refreshArb.mjs` haya corrido.

SIEMPRE imprime arriba el SELLO del dato: que export uso, de cuando es (la hora real, no la de una
copia) y si hubo escrituras al arb despues. Con mas de 24 h o con cargas posteriores dice
"PUEDE ESTAR VIEJO": ahi el numero hay que confirmarlo re-exportando antes de afirmarlo.

Por que existe (automejora 30/09/2026, docs/auto-mejora/2026-09-30-automejora-10-frentes.md §2): cada
sesion reescribia un parser del export (258 iconv y 63 parsers inline en 215 transcripciones) y el
cache insumos.csv estaba vacio. El parser unico vive en scripts/_lib/arbRelaciones.py.

Codigos de salida: 0 respondio · 1 no hay nada que coincida · 2 uso incorrecto o no hay export.
"""
import argparse
import importlib.util
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))


def _cargar_lib():
    spec = importlib.util.spec_from_file_location('arbRelaciones', os.path.join(AQUI, '_lib', 'arbRelaciones.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


AR = _cargar_lib()

MAX_DESC = 44


def _corta(s, n=MAX_DESC):
    s = str(s or '')
    return s if len(s) <= n else s[:n - 1] + '~'


def _desc(rel, codigo):
    d = rel.descripcion(codigo)
    return d if d else '(sin descripcion en los exports)'


def _limitar(lista, maximo):
    """(visibles, cuantos_quedan_afuera)."""
    if maximo and len(lista) > maximo:
        return lista[:maximo], len(lista) - maximo
    return lista, 0


def _unidades_usadas(rel, codigos):
    """Leyenda de las unidades que aparecen: 'MTL = metro lineal, UN = unidades'."""
    vistas = []
    for c in codigos:
        for u in rel.unidades(c):
            if u and u not in vistas:
                vistas.append(u)
    partes = []
    for u in vistas:
        fam = AR.familia_unidad(u)
        nombre = AR.NOMBRE_FAMILIA.get(fam)
        partes.append('%s = %s' % (u, nombre) if nombre else u)
    return ', '.join(partes)


# ------------------------------------------------------------------------------ candidatos

def listar_candidatos(rel, consulta, codigos, maximo):
    print('Hay %d codigos que coinciden con "%s". Repetilo con el codigo exacto:' % (len(codigos), consulta))
    ancho = max([len(c) for c in codigos[:maximo or None]] + [6])
    print('  %-*s  %-8s  %-7s  %s' % (ancho, 'CODIGO', 'TIPO', 'LINEAS', 'DESCRIPCION'))
    visibles, resto = _limitar(sorted(codigos, key=AR.clave), maximo)
    for c in visibles:
        tipo = rel.tipo(c)
        n = len(rel.bom(c)) if rel.es_producto(c) else len(rel.donde_se_usa(c)['directos'])
        etiqueta = '%d lin' % n if rel.es_producto(c) else 'usa %d' % n
        print('  %-*s  %-8s  %-7s  %s' % (ancho, c, tipo, etiqueta, _corta(rel.descripcion(c) or '(sin descripcion)', 60)))
    if resto:
        print('  ... y %d mas (--max 0 para verlos todos, o agregale palabras a la busqueda)' % resto)
    print('  (TIPO: PRODUCTO = tiene BOM y nadie lo usa, SEMI = tiene BOM y lo usa otro, INSUMO = lo usan, sin BOM;')
    print('   "lin" = lineas directas de su BOM, "usa" = en cuantas BOM aparece)')


# ------------------------------------------------------------------------------ BOM explotada

def imprimir_bom(rel, codigo, niveles, maximo):
    nodos = rel.explotar(codigo, niveles)
    nombre = rel.nombre(codigo)
    directas = [n for n in nodos if n.nivel == 0]
    semis = [n for n in nodos if n.es_semi]
    print('%s %s   %s' % (rel.tipo(nombre), nombre, _desc(rel, nombre)))
    print('%d lineas directas, %d semielaborados (marcados SEMI), abiertos hasta %d nivel(es) por debajo'
          % (len(directas), len(semis), niveles))
    print()
    filas = []
    for n in nodos:
        f = n.fila
        filas.append(('  ' * n.nivel + f.codigo, 'SEMI' if n.es_semi else '', _corta(f.desc or rel.descripcion(f.codigo)),
                      f.unidad, f.consumo or AR.fmt_cant(f.cantidad),
                      AR.fmt_cant(n.acumulado) if n.nivel > 0 and n.acumulado is not None else '',
                      ('%s/%s' % (f.modulo, f.proceso)) if (f.modulo or f.proceso) else '',
                      ' (vuelve a un codigo de arriba: ciclo)' if n.ciclo else (' (sin abrir: --niveles mas alto)' if n.cortado else '')))
    visibles, resto = _limitar(filas, maximo)
    ac = min(max([len(r[0]) for r in visibles] + [6]), 34)
    print('  %-*s  %-4s  %-*s  %-5s  %12s  %12s  %s' % (ac, 'CODIGO', '', MAX_DESC, 'DESCRIPCION', 'UM', 'CANTIDAD', 'ACUMULADO', 'MOD/PROC'))
    for cod, semi, desc, um, cant, acum, mp, nota in visibles:
        print('  %-*s  %-4s  %-*s  %-5s  %12s  %12s  %s%s' % (ac, cod, semi, MAX_DESC, desc, um, cant, acum, mp, nota))
    if resto:
        print('  ... y %d lineas mas (--max 0 para verlas todas)' % resto)
    print('  CANTIDAD = lo que lleva UNA unidad de su padre; ACUMULADO = lo que lleva UNA unidad del producto (producto de las cantidades del camino).')

    if semis:
        print()
        print('TOTAL POR INSUMO FINAL (por unidad de producto; los semielaborados abiertos no se cuentan):')
        totales = rel.totales_hojas(nodos)
        visibles_t, resto_t = _limitar(totales, maximo)
        at = min(max([len(t[0]) for t in visibles_t] + [6]), 34)
        for cod, um, total, veces in visibles_t:
            print('  %-*s  %-*s  %-5s  %12s%s' % (at, cod, MAX_DESC, _corta(rel.descripcion(cod)), um,
                                               AR.fmt_cant(total) if total is not None else '?',
                                               '   (suma %d lineas)' % veces if veces > 1 else ''))
        if resto_t:
            print('  ... y %d mas' % resto_t)

    vistos, avisos = set(), []
    for n in nodos:
        k = AR.clave(n.fila.codigo)
        if k in vistos:
            continue
        vistos.add(k)
        for a in rel.avisos_unidad(n.fila.codigo):
            avisos.append('  ! %s: %s' % (n.fila.codigo, a))
    if avisos:
        print()
        print('AVISOS DE UNIDAD')
        print('\n'.join(avisos))
    leyenda = _unidades_usadas(rel, [n.fila.codigo for n in nodos])
    if leyenda:
        print()
        print('Unidades (del maestro, familias del canon): %s' % leyenda)
    usos = rel.donde_se_usa(nombre)['directos'] if rel.tipo(nombre) == 'SEMI' else []
    if usos:
        print('Este semielaborado lo usan %d productos: python scripts/_consumo.py --donde-se-usa "%s"' % (len(usos), nombre))
    if rel.parseo.descartadas:
        print('OJO: el parser descarto %d fila(s) con codigo y sin consumo (tiene que dar 0): %s'
              % (len(rel.parseo.descartadas), ', '.join('%s (linea %d)' % d for d in rel.parseo.descartadas[:5])))


# ------------------------------------------------------------------------------ donde se usa

def imprimir_uso(rel, codigo, maximo):
    nombre = rel.nombre(codigo)
    uso = rel.donde_se_usa(nombre)
    um = rel.unidades(nombre)
    fam = AR.familia_unidad(um[0]) if um else ''
    print('%s %s   %s' % (rel.tipo(nombre), nombre, _desc(rel, nombre)))
    if um:
        print('UM: %s%s' % (', '.join(um), ' (%s)' % AR.NOMBRE_FAMILIA.get(fam, fam) if fam else ''))
    for a in rel.avisos_unidad(nombre):
        print('  ! %s' % a)
    directos = sorted(uso['directos'], key=lambda t: AR.clave(t[0]))
    print()
    if not directos:
        print('Nadie lo usa en el export (ninguna BOM tiene una linea con este codigo).')
        if rel.es_producto(nombre):
            print('Tiene BOM propia: es un producto. Para verla: python scripts/_consumo.py "%s"' % nombre)
        return
    print('LO USAN DIRECTO (%d):' % len(directos))
    visibles, resto = _limitar(directos, maximo)
    ap = min(max([len(p) for p, _ in visibles] + [8]), 34)
    print('  %-*s  %-8s  %-*s  %-5s  %12s' % (ap, 'PRODUCTO', 'TIPO', MAX_DESC, 'DESCRIPCION', 'UM', 'CANTIDAD'))
    for padre, f in visibles:
        print('  %-*s  %-8s  %-*s  %-5s  %12s' % (ap, padre, rel.tipo(padre), MAX_DESC, _corta(rel.descripcion(padre) or '(sin descripcion)'),
                                                 f.unidad, f.consumo or AR.fmt_cant(f.cantidad)))
    if resto:
        print('  ... y %d mas (--max 0 para verlos todos)' % resto)
    hay_semi = any(rel.tipo(p) == 'SEMI' for p, _ in directos)
    if hay_semi:
        print()
        terminados = sorted(uso['terminados'], key=lambda t: AR.clave(t['codigo']))
        print('PRODUCTOS FINALES QUE LO CONSUMEN, directo o por semielaborado (%d), cantidad por unidad de producto:' % len(terminados))
        vis_t, resto_t = _limitar(terminados, maximo)
        at = min(max([len(t['codigo']) for t in vis_t] + [8]), 34)
        for t in vis_t:
            vias = []
            for v in t['vias']:
                txt = ' > '.join(v) if v else '(directo)'
                if txt not in vias:
                    vias.append(txt)
            via = ' | '.join(vias[:2]) + (' | y %d camino(s) mas' % (len(vias) - 2) if len(vias) > 2 else '')
            print('  %-*s  %-*s  %12s  via %s' % (at, t['codigo'], MAX_DESC, _corta(rel.descripcion(t['codigo']) or '(sin descripcion)'),
                                               AR.fmt_cant(t['acumulado']) if t['acumulado'] is not None else '?', via))
        if resto_t:
            print('  ... y %d mas' % resto_t)
        print('  (la cantidad suma los caminos cuando un producto lo consume por mas de un semielaborado)')


# ------------------------------------------------------------------------------ main

def main(argv=None):
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(errors='replace')
    ap = argparse.ArgumentParser(description='Consumos del arb en segundos (solo lectura).', add_help=True)
    ap.add_argument('consulta', nargs='*', help='codigo o texto de la descripcion de un producto')
    ap.add_argument('--donde-se-usa', nargs='+', metavar='CODIGO', dest='uso', help='que productos usan este insumo')
    ap.add_argument('--niveles', type=int, default=3, help='niveles de semielaborado que se abren (default 3)')
    ap.add_argument('--max', type=int, default=60, help='largo maximo de las listas (0 = sin limite)')
    ap.add_argument('--export', help='usar este archivo RELACIONES en vez del mas nuevo')
    a = ap.parse_args(argv)
    consulta = ' '.join(a.uso if a.uso else a.consulta).strip()
    if not consulta:
        ap.print_usage(sys.stderr)
        print('falta el codigo o el texto a buscar', file=sys.stderr)
        return 2

    try:
        rel, sello = AR.cargar(export=a.export)
    except FileNotFoundError as e:
        print('SIN EXPORT: %s' % e)
        return 2
    print('\n'.join(sello.lineas()))
    print()

    b = rel.buscar(consulta)
    if b.exacto:
        codigo = b.exacto
    elif a.uso:
        todos = b.otros + b.raices
        if not todos:
            print('No encontre ningun codigo ni descripcion que coincida con "%s".' % consulta)
            return 1
        if len(todos) > 1:
            listar_candidatos(rel, consulta, todos, a.max)
            return 0
        codigo = todos[0]
    else:
        if b.raices:
            if len(b.raices) > 1:
                listar_candidatos(rel, consulta, b.raices, a.max)
                if b.otros:
                    print('  (ademas coincide con %d codigos que son insumos, sin BOM: para esos, --donde-se-usa)' % len(b.otros))
                return 0
            codigo = b.raices[0]
        elif b.otros:
            if len(b.otros) > 1:
                listar_candidatos(rel, consulta, b.otros, a.max)
                return 0
            codigo = b.otros[0]
        else:
            print('No encontre ningun codigo ni descripcion que coincida con "%s".' % consulta)
            print('(Buscado en las BOM del export, en ARTICULO.TXT y en INSUMOS.TXT. Un material recien dado de alta en el')
            print(' arb y no exportado todavia no aparece: mirar el sello de arriba.)')
            return 1

    if a.uso or not rel.es_producto(codigo):
        if not a.uso:
            print('"%s" no tiene BOM propia: es un insumo. Te muestro donde se usa.' % rel.nombre(codigo))
            print()
        imprimir_uso(rel, codigo, a.max)
    else:
        imprimir_bom(rel, codigo, max(0, a.niveles), a.max)
    return 0


if __name__ == '__main__':
    sys.exit(main())
