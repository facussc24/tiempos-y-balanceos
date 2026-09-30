# -*- coding: utf-8 -*-
"""
arbRelaciones_selftest.py - el selftest de scripts/_lib/arbRelaciones.py (no se corre solo):

    python scripts/_lib/arbRelaciones.py --selftest

Esta separado de la libreria a proposito: esta PC corre con PYTHONDONTWRITEBYTECODE=1, asi que cada
proceso COMPILA el codigo que importa, y 17 KB de pruebas sumaban ~0,1 s a cada `_consumo.py`.
`selftest(ns)` recibe el espacio de nombres de la libreria (sus funciones, clases y modulos) y lo usa
como propio, asi el cuerpo de las pruebas llama a las funciones por su nombre.
"""


def selftest(ns):
    globals().update({k: v for k, v in ns.items() if not k.startswith("__")})
    import shutil
    import tempfile
    ok = mal = 0

    def chk(nombre, cond, detalle=''):
        nonlocal ok, mal
        if cond:
            ok += 1
            print('  ok    %s' % nombre)
        else:
            mal += 1
            print('  MAL   %s  %s' % (nombre, detalle))

    def fx(n):
        with open(os.path.join(FIXTURES, n), 'rb') as fh:
            return fh.read()

    print('selftest arbRelaciones (fixtures reales recortados de __tests__/scripts/fixtures)')

    # --- numeros y unidades
    chk('num: coma decimal del arb', num('0,09800000') == 0.098)
    chk('num: miles con punto y decimales con coma', num('1.234,5') == 1234.5)
    chk('num: punto decimal del journal', num('0.0002215') == 0.0002215)
    chk('num: vacio o texto da None', num('') is None and num('KG') is None)
    chk('unidad: MTL, MTS y ML son la misma familia', len({familia_unidad(u) for u in ('MTL', 'MTS', 'ML')}) == 1)
    chk('unidad: MT2 no es metro lineal', familia_unidad('MT2') != familia_unidad('MTL'))
    chk('unidad: UN, UNI y UNID son la misma familia', len({familia_unidad(u) for u in ('UN', 'UNI', 'UNID')}) == 1)
    chk('unidad: CAJ y BOLSA son envases, UN no', es_envase('CAJ') and es_envase('bolsa') and not es_envase('UN'))

    # --- el parser, sobre lineas reales del export del 30/09/2026 (CRLF)
    p = parsear_relaciones(fx('arb_relaciones_muestra.TXT'))
    por_nivel = {n: sum(1 for f in p.filas if f.nivel == n) for n in (0, 1, 2)}
    chk('parser: 12 lineas de nivel 0 (6 del producto + las de sus 3 semielaborados), 5 de nivel 1 y 1 de nivel 2',
        por_nivel == {0: 12, 1: 5, 2: 1}, str(por_nivel))
    chk('parser: nivel 1 y 2 no se pierden (con el offset +9 del encabezado se pierden los dos)',
        por_nivel[1] > 0 and por_nivel[2] > 0, str(por_nivel))
    chk('parser: sin filas descartadas ni fusionadas en un export sano', not p.descartadas and not p.fusionadas)
    f0 = p.filas[0]
    chk('parser: primera linea = sustrato, unidad UN, consumo 1', (f0.codigo, f0.unidad, f0.cantidad, f0.nivel) == ('0024764702-FZHE', 'UN', 1.0, 0), str(f0))
    cor = [f for f in p.filas if f.nivel == 2][0]
    chk('parser: la linea de nivel 2 cuelga del producto raiz y de su semielaborado',
        (cor.raiz, cor.padre, cor.codigo, cor.unidad) == ('0024760703-FZHE', 'COR-002-607-FZH', '124.602.0228-1', 'MTL'), str(cor))
    tro = [f for f in p.filas if f.nivel == 0 and f.raiz == 'TRO-002-607-FZH'][0]
    chk('parser: modulo y proceso de nivel 0', (tro.modulo, tro.proceso) == ('TRO', 'TRO'), str(tro))
    # mismo contenido con LF (asi lo deja git con `eol=lf`) da lo mismo
    p_lf = parsear_relaciones(fx('arb_relaciones_muestra.TXT').replace(b'\r\n', b'\n'))
    chk('parser: LF o CRLF da lo mismo', [(f.codigo, f.cantidad) for f in p_lf.filas] == [(f.codigo, f.cantidad) for f in p.filas])

    # --- filas partidas (lineas reales del export de agosto)
    pp = parsear_relaciones(fx('arb_relaciones_partidas.TXT'))
    chk('partidas: las 2 filas partidas se completan (no se descartan)', not pp.descartadas and len(pp.fusionadas) == 2, str((pp.descartadas, pp.fusionadas)))
    n1 = [f for f in pp.filas if f.codigo == 'FX663TK-11703E' and f.nivel == 1][0]
    chk('partidas: nivel 1 toma unidad y consumo de la linea de abajo',
        (n1.unidad, n1.consumo, n1.cantidad) == ('KG', '0,00059000', 0.00059) and n1.desc.endswith('(TGA AT2)'), str(n1))
    n0 = [f for f in pp.filas if f.codigo == 'FX663TK-11703E' and f.nivel == 0][0]
    chk('partidas: nivel 0 toma tambien modulo y proceso de la continuacion',
        (n0.unidad, n0.cantidad, n0.modulo, n0.proceso) == ('KG', 0.00022, 'COS', 'PRDCOS'), str(n0))
    chk('partidas: la continuacion no crea productos fantasma ("(TGA AT2)" como raiz)',
        all(f.raiz in ('2GJ858417D AMB', '2GJ868110B ZKZ') for f in pp.filas), str({f.raiz for f in pp.filas}))
    nombres = {f.codigo for f in pp.filas}
    chk('partidas: la fila de abajo de la continuacion sigue entrando', 'PPBL - 3A' in nombres)

    # --- ARTICULO e INSUMOS
    arts = parsear_articulos(fx('arb_articulo_muestra.TXT'))
    chk('ARTICULO: descripcion con acento y ene', arts.get('40-12825') == 'CONJ. PAÑO D/I PVC JET BLACK FENIX', str(arts.get('40-12825')))
    chk('ARTICULO: codigo con espacio interno', arts.get('N 216') == 'TOP ROLL PTA. DEL. IZQ.')
    txt_ins = decodificar(fx('arb_insumos_listado_muestra.TXT'))
    chk('INSUMOS: detecta el listado impreso', formato_insumos(txt_ins) == 'listado')
    ins = parsear_insumos(txt_ins)
    chk('INSUMOS listado: 12 insumos, sin contar cajas, rubros ni "Hoja N"', len(ins) == 12, str(list(ins)))
    chk('INSUMOS listado: codigo con espacio ("Placa Izq.") y descripcion', ins.get('Placa Izq.', {}).get('desc') == 'Adhesivo Placa de cierre Izq.', str(ins.get('Placa Izq.')))
    chk('INSUMOS listado: descripcion partida en 2 lineas se junta',
        ins.get('427VAR002INY01', {}).get('desc') == 'BOLSA INYECCION PUR (INLET BAG) NYLON PA 6 30X130MM 50UM', str(ins.get('427VAR002INY01')))
    chk('INSUMOS listado: sin unidad (el reporte no la trae)', all(v['unidad'] == '' for v in ins.values()))
    cubo = parsear_insumos('  Hoja 1' + chr(10) + '   1    X-1             PLACA 2M' + chr(179) + ' ESPUMA' + chr(10))
    chk('INSUMOS listado: un "M3" con el caracter de marco en la descripcion NO descarta el insumo', list(cubo) == ['X-1'], str(cubo))
    chk('INSUMOS tabulado: col 2 codigo, col 5 unidad',
        parsear_insumos('Rubro\tx\tCodigo\tDescripcion\ty\tU.Medida\n1\t\tAB-1\tUN TORNILLO\t\tUN\n').get('AB-1') == {'desc': 'UN TORNILLO', 'rubro': '', 'unidad': 'UN'})
    chk('INSUMOS tabulado: se distingue del listado', formato_insumos('a\tb\tc\td\te\tf\n') == 'tabulado')

    # --- el modelo
    rel = Relaciones(p, arts, ins)
    PROD = '0024760703-FZHE'
    chk('bom: 6 lineas directas del producto, en el orden del export',
        [f.codigo for f in rel.bom(PROD)] == ['0024764702-FZHE', 'AD - REGV0.6', 'AD-ADNC18', 'ET-SATO-100X60', 'FUN-002-607-FZH', 'TRO-002-607-FZH'],
        str([f.codigo for f in rel.bom(PROD)]))
    chk('bom: clave sin distinguir mayusculas', len(rel.bom(PROD.lower())) == 6)
    chk('tipo: producto, semi e insumo', (rel.tipo(PROD), rel.tipo('FUN-002-607-FZH'), rel.tipo('124.602.0228-1')) == ('PRODUCTO', 'SEMI', 'INSUMO'),
        str((rel.tipo(PROD), rel.tipo('FUN-002-607-FZH'), rel.tipo('124.602.0228-1'))))
    nodos = rel.explotar(PROD, 3)
    vin = [n for n in nodos if n.fila.codigo == '124.602.0228-1']
    chk('explotar: el vinilo aparece a 2 niveles de las lineas directas (producto > FUNDA > CORTE > vinilo)', len(vin) == 1 and vin[0].nivel == 2, str([(n.nivel, n.fila.codigo) for n in nodos]))
    chk('explotar: acumulado = producto de las cantidades del camino (1 x 1 x 0,098)', vin[0].acumulado is not None and abs(vin[0].acumulado - 0.098) < 1e-12)
    chk('explotar: marca los semielaborados', {n.fila.codigo for n in nodos if n.es_semi} == {'FUN-002-607-FZH', 'COR-002-607-FZH', 'TRO-002-607-FZH'}, str({n.fila.codigo for n in nodos if n.es_semi}))
    un_nivel = rel.explotar(PROD, 0)
    chk('explotar: con 0 niveles solo las lineas directas, y marca lo que no abrio', len(un_nivel) == 6 and sum(1 for n in un_nivel if n.cortado) == 2, str([(n.fila.codigo, n.cortado) for n in un_nivel]))
    tot = {c: t for c, u, t, n in rel.totales_hojas(nodos)}
    chk('totales: suma por insumo final y no cuenta los semielaborados', '124.602.0228-1' in tot and 'FUN-002-607-FZH' not in tot and abs(tot['HDPE-1.5-2X1'] - 0.025) < 1e-12, str(tot))
    uso = rel.donde_se_usa('124.602.0228-1')
    chk('donde se usa: directo en el corte', [p_ for p_, f in uso['directos']] == ['COR-002-607-FZH'], str(uso['directos']))
    chk('donde se usa: el producto terminado lo consume por FUNDA y CORTE, con el acumulado',
        len(uso['terminados']) == 1 and uso['terminados'][0]['codigo'] == PROD and abs(uso['terminados'][0]['acumulado'] - 0.098) < 1e-12
        and uso['terminados'][0]['vias'] == [['FUN-002-607-FZH', 'COR-002-607-FZH']], str(uso['terminados']))
    chk('donde se usa: un codigo que nadie usa da vacio', rel.donde_se_usa('NO-EXISTE')['directos'] == [])
    chk('descripcion: de la linea de BOM, despues de ARTICULO', rel.descripcion('124.602.0228-1').startswith('VINILO SANSUY') and rel.descripcion('N 216') == 'TOP ROLL PTA. DEL. IZQ.')
    chk('unidad: la del export', rel.unidad('124.602.0228-1') == 'MTL' and rel.unidades('AD-ADNC18') == ['BI'])
    # un ciclo no cuelga el explotar
    p_ciclo = parsear_relaciones('Artículo\tRubro\tMedida\n' + 'A\t1\tB\tSEMI B\tUN\t1,00000000\n' + 'B\t1\tA\tSEMI A\tUN\t2,00000000\n')
    ciclo = Relaciones(p_ciclo).explotar('A', 5)
    # aritmetica del acumulado con un multiplicador que NO es 1 (los semielaborados de la muestra real
    # llevan 1 x 1, y con eso una multiplicacion mal hecha pasaba igual): P lleva 2 S, cada S lleva 0,5 X
    p_aritm = parsear_relaciones('Articulo' + chr(9) + 'Rubro' + chr(9) + 'Medida' + chr(10)
                                 + 'P' + chr(9) + '1' + chr(9) + 'S' + chr(9) + 'SEMI' + chr(9) + 'UN' + chr(9) + '2,00000000' + chr(10)
                                 + 'S' + chr(9) + '1' + chr(9) + 'X' + chr(9) + 'INSUMO' + chr(9) + 'KG' + chr(9) + '0,50000000' + chr(10))
    r_ar = Relaciones(p_aritm)
    x_ar = [n for n in r_ar.explotar('P', 3) if n.fila.codigo == 'X'][0]
    chk('explotar: acumulado con multiplicador distinto de 1 (2 S x 0,5 kg = 1 kg por P)', abs(x_ar.acumulado - 1.0) < 1e-12, str(x_ar.acumulado))
    t_ar = r_ar.donde_se_usa('X')['terminados']
    chk('donde se usa: el acumulado hacia arriba tambien multiplica (P consume 1 kg de X)', len(t_ar) == 1 and abs(t_ar[0]['acumulado'] - 1.0) < 1e-12, str(t_ar))
    chk('explotar: un ciclo A>B>A termina y se marca', len(ciclo) <= 4 and any(n.ciclo for n in ciclo), str([(n.fila.codigo, n.ciclo) for n in ciclo]))

    # --- busqueda
    b = rel.buscar('0024760703-fzhe')
    chk('buscar: codigo exacto (sin mayusculas) gana solo', b.exacto == PROD and not b.raices)
    b = rel.buscar('FUNDA APB DELANTERO')
    chk('buscar: texto, todas las palabras, sobre la descripcion de la BOM', b.raices == ['FUN-002-607-FZH'], str((b.raices, b.otros)))
    b = rel.buscar('top roll')
    chk('buscar: un articulo sin BOM sale en "otros" con su descripcion de ARTICULO', b.otros == ['N 216'] and not b.raices, str((b.raices, b.otros)))
    b = rel.buscar('1246020228')
    chk('buscar: codigo sin puntos encuentra el que los tiene', b.otros == ['124.602.0228-1'], str((b.raices, b.otros)))
    chk('buscar: lo que no existe da vacio', not rel.buscar('ZZZNOEXISTE').raices and not rel.buscar('ZZZNOEXISTE').otros)
    chk('buscar: sin la tilde tambien lo encuentra ("pano" encuentra PAÑO)', rel.buscar('pano').otros == ['40-12825', '40-12826', '40-12827'], str(rel.buscar('pano').otros))
    chk('buscar: acentos y mayusculas no importan', rel.buscar('paño').otros == ['40-12825', '40-12826', '40-12827'], str(rel.buscar('paño').otros))

    # --- avisos de unidad
    p_env = parsear_relaciones('Artículo\tRubro\tMedida\nP1\t1\tX-1\tGRAMPAS\tCAJ\t0,05000000\nP2\t1\tX-1\tGRAMPAS\tUN\t36,00000000\nP1\t1\tY-2\tVINILO\tMTL\t1,00000000\n')
    r2 = Relaciones(p_env, maestro_viejo={'Y-2': 'MT2'})
    av = r2.avisos_unidad('X-1')
    chk('avisos: dos unidades y envase', any('DOS unidades' in a for a in av) and any('ENVASE' in a or 'envase' in a.lower() for a in av), str(av))
    chk('avisos: cambio de etiqueta MT2 a MTL contra el maestro viejo', any('ETIQUETA' in a for a in r2.avisos_unidad('Y-2')), str(r2.avisos_unidad('Y-2')))
    chk('avisos: un insumo sano no avisa nada', Relaciones(p_env, maestro_viejo={'Y-2': 'MTS'}).avisos_unidad('Y-2') == [])

    # --- el sello (en una carpeta temporal: nada del arb real)
    with tempfile.TemporaryDirectory(prefix='arbrel_') as base:
        tmp = os.path.join(base, 'tmp')
        cache = os.path.join(base, 'cache')
        os.makedirs(os.path.join(cache, 'pre-cambio'))
        os.makedirs(tmp)
        t = lambda h, m, d=30: datetime.datetime(2026, 9, d, h, m, 0).timestamp()
        contenido = fx('arb_relaciones_muestra.TXT')
        orig = os.path.join(tmp, 'RELACIONES.TXT')
        copia = os.path.join(cache, 'pre-cambio', 'RELACIONES_20260930_pre-algo.TXT')
        otro = os.path.join(cache, 'RELACIONES_20260929_otro-contenido.TXT')
        for ruta, datos, hora in ((orig, contenido, t(13, 20)), (copia, contenido, t(14, 30)), (otro, contenido + b'\r\nX\t1\tY\tZ\tUN\t1,0\r\n', t(9, 0, 29))):
            with open(ruta, 'wb') as fh:
                fh.write(datos)
            os.utime(ruta, (hora, hora))
        el = elegir_export(tmp, cache)
        chk('sello: el mas nuevo por fecha de archivo es la copia de las 14:30', os.path.basename(el['ruta']) == 'RELACIONES_20260930_pre-algo.TXT', el['ruta'])
        chk('sello: pero la hora del export es la del original (13:20), no la de la copia', el['export_dt'] == datetime.datetime(2026, 9, 30, 13, 20) and el['original'] == orig, str(el['export_dt']))
        chk('sello: un archivo de distinto contenido no cuenta como copia', otro not in el['iguales'])
        with open(os.path.join(cache, 'carga_20260930.jsonl'), 'w', encoding='utf-8') as fh:
            fh.write(json.dumps({'t': '13:18:07', 'producto': 'A1', 'estado': 'por_grabar'}) + '\n')
            fh.write(json.dumps({'t': '13:18:09', 'producto': 'A1', 'estado': 'enter_ok'}) + '\n')
            fh.write(json.dumps({'t': '14:00:00', 'producto': 'B2', 'estado': 'por_grabar'}) + '\n')
            fh.write(json.dumps({'t': '14:00:02', 'producto': 'B2', 'estado': 'enter_ok'}) + '\n')
            fh.write(json.dumps({'t': '14:05:00', 'producto': 'C3', 'estado': 'por_grabar'}) + '\n')
            fh.write(json.dumps({'t': '14:06:00', 'producto': 'D4', 'estado': 'abortada', 'motivo': 'x'}) + '\n')
            fh.write('esto no es json\n')
        ahora = datetime.datetime(2026, 9, 30, 15, 0, 0)
        s = armar_sello(el, tmp, cache, ahora)
        chk('sello: la carga de las 14:00 es POSTERIOR al export real (13:20) aunque la copia diga 14:30',
            [e['producto'] for e in s.escritas] == ['B2'], str([e['producto'] for e in s.escritas]))
        chk('sello: la de las 13:18 es anterior y no cuenta', 'A1' not in [e['producto'] for e in s.escritas])
        chk('sello: un por_grabar sin enter_ok queda como sin confirmar; una abortada no', [e['producto'] for e in s.sin_confirmar] == ['C3'], str(s.sin_confirmar))
        chk('sello: con cargas posteriores avisa "puede estar viejo"', s.viejo and any('escritura' in m for m in s.motivos_viejo) and any('PUEDE ESTAR VIEJO' in l for l in s.lineas()))
        os.remove(os.path.join(cache, 'carga_20260930.jsonl'))
        s2 = armar_sello(el, tmp, cache, ahora)
        chk('sello: sin cargas y de menos de 24 h esta al dia', not s2.viejo and any('al dia' in l for l in s2.lineas()), '\n'.join(s2.lineas()))
        s3 = armar_sello(el, tmp, cache, datetime.datetime(2026, 10, 2, 9, 0, 0))
        chk('sello: con mas de 24 h avisa viejo aunque no haya cargas', s3.viejo and any('mas de 24 h' in m for m in s3.motivos_viejo), str(s3.motivos_viejo))
        with open(os.path.join(cache, 'alta_algo_20260930.csv'), 'w', encoding='utf-8') as fh:
            fh.write('a\n')
        os.utime(os.path.join(cache, 'alta_algo_20260930.csv'), (t(14, 27), t(14, 27)))
        s4 = armar_sello(el, tmp, cache, ahora)
        chk('sello: una tabla de carga mas nueva que el export se avisa pero no da "viejo" por si sola',
            s4.tablas_posteriores and not s4.viejo and any('tablas de carga' in l for l in s4.lineas()), '\n'.join(s4.lineas()))
        # cargar() completo contra las carpetas temporales
        shutil.copy(os.path.join(FIXTURES, 'arb_articulo_muestra.TXT'), os.path.join(tmp, 'ARTICULO.TXT'))
        shutil.copy(os.path.join(FIXTURES, 'arb_insumos_listado_muestra.TXT'), os.path.join(tmp, 'INSUMOS.TXT'))
        rel3, sello3 = cargar(tmp=tmp, cache=cache, ahora=ahora)
        chk('cargar: parsea el export elegido y junta las tres fuentes', len(rel3.bom(PROD)) == 6 and rel3.descripcion('N 216') and sello3.insumos[2] == 'listado')
        chk('cargar: el aviso del INSUMOS impreso sale en el sello', any('listado impreso' in l for l in sello3.lineas()))
        chk('export a mano: --export usa ese archivo y su fecha', elegir_export(tmp, cache, export=orig)['export_dt'] == datetime.datetime(2026, 9, 30, 13, 20))
        vacio = os.path.join(base, 'vacio')
        os.makedirs(vacio)
        try:
            elegir_export(vacio, vacio)
            chk('sello: sin ningun export falla con mensaje claro', False)
        except FileNotFoundError as e:
            chk('sello: sin ningun export falla con mensaje claro', 'Relaciones' in str(e))

    print('selftest arbRelaciones: %s (%d ok, %d mal)' % ('todo verde' if not mal else 'HAY FALLAS', ok, mal))
    return 1 if mal else 0
