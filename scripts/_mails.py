# -*- coding: utf-8 -*-
"""
Acceso a los mails de Fak desde Outlook clasico (COM, solo lectura).

El buzon vive en el servidor de la empresa; Outlook clasico lo sincroniza a un .ost
local y este script lo lee desde ahi. No hay credenciales aca: usa la sesion que
Outlook ya tiene abierta, como haria una macro de VBA.

    python scripts/_mails.py --sync                 # vuelca el buzon al cache (incremental)
    python scripts/_mails.py --buscar "aplix"       # busca en asunto y cuerpo
    python scripts/_mails.py --buscar "bom" --desde 2026-01-01 --carpeta "Bandeja"
    python scripts/_mails.py --ver <id>             # un mail completo
    python scripts/_mails.py --adjuntos <id>        # extrae sus adjuntos
    python scripts/_mails.py --stats                # que hay en el cache

ATENCION — el repo es PUBLICO. El cache va a .mail-cache/ (gitignoreado). Nunca
commitear contenido de mails ni pegarlo en archivos del repo.

Enviar, responder o borrar mails NO se hace desde aca: es a mano, por Fak.
"""
import argparse
import datetime
import io
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(RAIZ, '.mail-cache')
MAILS = os.path.join(CACHE, 'mails.jsonl')
ADJ = os.path.join(CACHE, 'adjuntos')
ESTADO = os.path.join(CACHE, 'sync-state.json')

MAX_CUERPO = 20000   # un mail con 300 reenviados no aporta mas que sus primeras paginas


def _limpiar(txt):
    if not txt:
        return ''
    txt = str(txt).replace('\r\n', '\n').replace('\r', '\n')
    txt = re.sub(r'\n{4,}', '\n\n\n', txt)
    txt = re.sub(r'[ \t]{3,}', '  ', txt)
    return txt.strip()[:MAX_CUERPO]


def _outlook():
    try:
        import win32com.client
    except ImportError:
        sys.exit('Falta pywin32.  pip install pywin32')
    try:
        return win32com.client.Dispatch('Outlook.Application').GetNamespace('MAPI')
    except Exception as e:
        sys.exit('No pude hablar con Outlook clasico (%s).\n'
                 'Abrilo y reintenta:  "C:\\Program Files\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE"' % e)


def _leer_cache():
    if not os.path.exists(MAILS):
        return {}
    out = {}
    with io.open(MAILS, encoding='utf-8') as f:
        for linea in f:
            linea = linea.strip()
            if not linea:
                continue
            try:
                m = json.loads(linea)
                out[m['id']] = m
            except Exception:
                pass
    return out


def _leer_estado():
    try:
        with io.open(ESTADO, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def _guardar_estado(estado):
    try:
        if not os.path.isdir(CACHE):
            os.makedirs(CACHE)
        with io.open(ESTADO, 'w', encoding='utf-8') as f:
            json.dump(estado, f)
    except Exception:
        pass


def evaluar_parcial(revisados, fechas_cache, estado, hoy=None):
    """¿El .ost estaba entero cuando se sincronizo?  ->  (parcial, motivo, estado_nuevo)

    HISTORIA: la version anterior comparaba los items que expone Outlook contra el TOTAL
    del cache — pero el cache guarda mails desde 2023 y el .ost solo una ventana (~2 años,
    hoy ~2.780 items contra 5.241 del cache), asi que daba PARCIAL en TODAS las corridas.
    Un control que da siempre el mismo resultado no detecta nada: el dia que el sync
    fallara en serio, nadie se iba a enterar (medido 30/08/2026: PARCIAL eterno desde que
    el cache supero la ventana).

    Dos señales, comparando siempre contra lo que Outlook PUEDE tener:
      1. PISO — los mails de los ultimos 60 dias del cache tienen que estar si o si en la
         ventana del .ost (hoy son ~560 contra ~2.780: margen 5x). Menos que eso = el .ost
         no termino de bajar. Caza el arranque en frio (40 items).
      2. CAIDA — mas de 20% menos items que la ultima corrida completa = descarga a medias.
         Caza el .ost cargado por la mitad, que el piso solo no ve.

    Y para no fabricar el mismo PARCIAL eterno del otro lado: si la ventana del .ost se
    achica DE VERDAD (limpieza de buzon, cambio de politica), tres corridas seguidas
    estables en el numero nuevo lo aceptan como base. Una caida real de descarga no es
    estable: cada corrida ve un numero distinto mientras el .ost sigue bajando.
    """
    estado = dict(estado or {})
    if not fechas_cache:
        estado.update(revisados_ok=revisados, sospechas=0, ultimo_revisados=revisados)
        return False, '', estado

    hoy = hoy or datetime.date.today()
    corte = (hoy - datetime.timedelta(days=60)).strftime('%Y-%m-%d')
    piso = sum(1 for f in fechas_cache if f and f[:10] >= corte)
    if revisados < piso:
        estado.update(sospechas=0, ultimo_revisados=revisados)
        return True, ('Outlook mostro %d items y solo los ultimos 60 dias del cache ya son %d: '
                      'el .ost no termino de bajar.' % (revisados, piso)), estado

    ok_previo = estado.get('revisados_ok') or 0
    if ok_previo and revisados < ok_previo * 0.8:
        ultimo = estado.get('ultimo_revisados') or 0
        estable = ultimo and abs(revisados - ultimo) <= ultimo * 0.05
        sospechas = (estado.get('sospechas') or 0) + 1 if estable else 1
        if sospechas >= 3:
            estado.update(revisados_ok=revisados, sospechas=0, ultimo_revisados=revisados)
            return False, ('ventana del .ost mas chica aceptada como nueva base: %d items, '
                           '3 corridas estables' % revisados), estado
        estado.update(sospechas=sospechas, ultimo_revisados=revisados)
        return True, ('Outlook mostro %d items; la ultima corrida completa habia mostrado %d.'
                      % (revisados, ok_previo)), estado

    estado.update(revisados_ok=revisados, sospechas=0, ultimo_revisados=revisados)
    return False, '', estado


def sync(full=False):
    ns = _outlook()
    previos = {} if full else _leer_cache()
    nuevos, revisados = [], [0]

    def rec(folder, ruta=''):
        p = (ruta + ' / ' + folder.Name) if ruta else folder.Name
        try:
            items = folder.Items
            n = items.Count
        except Exception:
            n = 0
        for i in range(1, n + 1):
            try:
                m = items.Item(i)
                eid = str(getattr(m, 'EntryID', '') or '')
                revisados[0] += 1
                if not eid or eid in previos:
                    continue
                if getattr(m, 'Class', 43) != 43:      # 43 = olMail
                    continue
                try:
                    fecha = m.ReceivedTime.strftime('%Y-%m-%d %H:%M')
                except Exception:
                    fecha = ''
                adjuntos = []
                try:
                    for k in range(1, m.Attachments.Count + 1):
                        adjuntos.append(str(m.Attachments.Item(k).FileName))
                except Exception:
                    pass
                nuevos.append({
                    'id': eid,
                    'carpeta': p,
                    'fecha': fecha,
                    'de': str(getattr(m, 'SenderName', '') or ''),
                    'de_mail': str(getattr(m, 'SenderEmailAddress', '') or ''),
                    'para': str(getattr(m, 'To', '') or ''),
                    'cc': str(getattr(m, 'CC', '') or ''),
                    'asunto': str(getattr(m, 'Subject', '') or ''),
                    'adjuntos': adjuntos,
                    'cuerpo': _limpiar(getattr(m, 'Body', '')),
                })
            except Exception:
                pass
        try:
            for j in range(1, folder.Folders.Count + 1):
                rec(folder.Folders.Item(j), p)
        except Exception:
            pass

    for i in range(1, ns.Folders.Count + 1):
        rec(ns.Folders.Item(i))

    if not os.path.isdir(CACHE):
        os.makedirs(CACHE)
    modo = 'w' if full else 'a'
    with io.open(MAILS, modo, encoding='utf-8') as f:
        for m in nuevos:
            f.write(json.dumps(m, ensure_ascii=False) + '\n')

    total = len(previos) + len(nuevos)
    print('revisados en Outlook : %d' % revisados[0])
    print('nuevos al cache      : %d' % len(nuevos))
    print('total en el cache    : %d' % total)
    rango = ''
    if nuevos:
        fs = sorted(m['fecha'] for m in nuevos if m['fecha'])
        if fs:
            rango = '%s -> %s' % (fs[0], fs[-1])
            print('rango de los nuevos  : %s' % rango)

    # Guard: Outlook clasico tarda en bajar el .ost. Si todavia no termino, el recorrido
    # ve unos pocos items y "0 nuevos" NO prueba que no haya mails nuevos: prueba que
    # Outlook todavia no los tiene. La decision vive en evaluar_parcial() — la version
    # anterior comparaba contra el cache ENTERO y daba PARCIAL eterno (ver su docstring).
    fechas_cache = [m.get('fecha', '') for m in previos.values()]
    parcial, motivo, estado = evaluar_parcial(revisados[0], fechas_cache, _leer_estado())
    _guardar_estado(estado)
    if parcial:
        print()
        print('  *** SYNC PARCIAL — NO confiar en "nuevos: %d" ***' % len(nuevos))
        print('  ' + motivo)
        print('  Todavia esta bajando el buzon del servidor. Dejalo abierto y reintenta')
        print('  mas tarde:  python scripts/_mails.py --sync')
    elif motivo:
        print('  (%s)' % motivo)

    try:
        with io.open(os.path.join(CACHE, 'sync.log'), 'a', encoding='utf-8') as f:
            import time
            f.write('%s\trevisados=%d\tnuevos=%d\ttotal=%d\t%s\t%s\n' % (
                time.strftime('%Y-%m-%d %H:%M'), revisados[0], len(nuevos), total,
                'PARCIAL' if parcial else 'OK', rango))
    except Exception:
        pass

    return 2 if parcial else 0


def buscar(terminos, desde=None, hasta=None, carpeta=None, solo_asunto=False, limite=40):
    cache = _leer_cache()
    if not cache:
        sys.exit('El cache esta vacio. Corre primero:  python scripts/_mails.py --sync')
    ts = [t.lower() for t in terminos]
    hits = []
    for m in cache.values():
        if desde and (m['fecha'] or '') < desde:
            continue
        if hasta and (m['fecha'] or '') > hasta + '~':
            continue
        if carpeta and carpeta.lower() not in m['carpeta'].lower():
            continue
        heno = m['asunto'].lower() if solo_asunto else (
            m['asunto'] + ' ' + m['cuerpo'] + ' ' + m['de'] + ' ' + ' '.join(m['adjuntos'])).lower()
        if all(t in heno for t in ts):
            hits.append(m)
    hits.sort(key=lambda m: m['fecha'] or '')
    print('cache: %d mails  |  coincidencias: %d%s' % (
        len(cache), len(hits), '  (muestro las ultimas %d)' % limite if len(hits) > limite else ''))
    print()
    for m in hits[-limite:]:
        print('[%s]  %s' % (m['fecha'], m['asunto']))
        print('    de: %-30s  carpeta: %s' % (m['de'][:30], m['carpeta']))
        if m['para']:
            print('    para: %s' % m['para'][:90])
        if m['adjuntos']:
            print('    ADJUNTOS: %s' % ' | '.join(m['adjuntos']))
        print('    id: %s' % m['id'])
        print()


def ver(eid):
    m = _leer_cache().get(eid)
    if not m:
        sys.exit('No encontre ese id en el cache.')
    print('=' * 78)
    print('ASUNTO   %s' % m['asunto'])
    print('DE       %s <%s>' % (m['de'], m['de_mail']))
    print('PARA     %s' % m['para'])
    if m['cc']:
        print('CC       %s' % m['cc'])
    print('FECHA    %s' % m['fecha'])
    print('CARPETA  %s' % m['carpeta'])
    if m['adjuntos']:
        print('ADJUNTOS %s' % ' | '.join(m['adjuntos']))
    print('=' * 78)
    print(m['cuerpo'])


def adjuntos(eid, destino=None):
    ns = _outlook()
    try:
        m = ns.GetItemFromID(eid)
    except Exception as e:
        sys.exit('No pude abrir ese mail en Outlook: %s' % e)
    destino = destino or os.path.join(ADJ, re.sub(r'[^A-Za-z0-9]', '', eid)[-16:])
    if not os.path.isdir(destino):
        os.makedirs(destino)
    n = 0
    for k in range(1, m.Attachments.Count + 1):
        a = m.Attachments.Item(k)
        ruta = os.path.join(destino, re.sub(r'[^\w.\- ]', '_', str(a.FileName)))
        a.SaveAsFile(ruta)
        print('  %-45s %9d bytes' % (a.FileName, os.path.getsize(ruta)))
        n += 1
    print('%d adjuntos en %s' % (n, destino))


def stats():
    cache = _leer_cache()
    if not cache:
        print('cache vacio')
        return
    porc, fechas = {}, []
    for m in cache.values():
        porc[m['carpeta']] = porc.get(m['carpeta'], 0) + 1
        if m['fecha']:
            fechas.append(m['fecha'])
    print('mails en el cache: %d' % len(cache))
    if fechas:
        print('rango            : %s  ->  %s' % (min(fechas), max(fechas)))
    print('tamano           : %.1f MB' % (os.path.getsize(MAILS) / 1024.0 / 1024))
    print()
    for c, n in sorted(porc.items(), key=lambda x: -x[1])[:15]:
        print('  %-58s %6d' % (c[:58], n))


def selftest():
    """Prueba evaluar_parcial() SIN Outlook — incluidos los casos en ROJO.

    Regla de la casa: un control nuevo se estrena contra el caso donde ya se conoce la
    respuesta, y se prueba que da ROJO contra un caso rojo (un control que da verde
    siempre no controla nada). Los numeros son los reales del 30/08/2026.
    """
    hoy = datetime.date(2026, 8, 30)
    viejos = ['2024-%02d-01 09:00' % (i % 12 + 1) for i in range(4600)]
    recientes = ['2026-08-%02d 09:00' % (i % 28 + 1) for i in range(641)]
    cache = viejos + recientes          # 5.241 mails, como el cache real
    fallas = []

    def caso(nombre, esperado, revisados, fechas, estado):
        parcial, motivo, estado_nuevo = evaluar_parcial(revisados, fechas, estado, hoy=hoy)
        ok = parcial == esperado
        print('  %s %-58s -> %s%s' % ('ok ' if ok else 'MAL', nombre,
                                      'PARCIAL' if parcial else 'OK',
                                      ('  (%s)' % motivo) if motivo else ''))
        if not ok:
            fallas.append(nombre)
        return estado_nuevo

    print('selftest de evaluar_parcial (%d casos):' % 9)
    # 1. La corrida real de hoy: 2.779 items contra un cache de 5.241 desde 2023 = OK.
    #    (la version vieja daba PARCIAL aca: es EL caso que motivo el fix)
    caso('corrida real de hoy (ventana .ost < cache historico)', False, 2779, cache, {'revisados_ok': 2787})
    # 2. EN ROJO: .ost cargado por la mitad -> lo caza la señal de CAIDA.
    caso('ROJO: descarga por la mitad (1.400 de 2.787)', True, 1400, cache, {'revisados_ok': 2787})
    # 3. EN ROJO: arranque en frio, sin estado previo -> lo caza el PISO de 60 dias.
    caso('ROJO: arranque en frio (40 items, sin estado)', True, 40, cache, {})
    # 4. Primer sync de la vida: cache vacio, nada con que comparar.
    caso('primer sync (cache vacio)', False, 2779, [], {})
    # 5. Deriva normal de la ventana (items que van saliendo por atras).
    caso('deriva normal (2.779 tras 2.790)', False, 2779, cache, {'revisados_ok': 2790})
    # 6-8. Ventana que se achico DE VERDAD: 3 corridas estables la aceptan como base...
    e = caso('ventana achicada, corrida 1 (avisa)', True, 1800, cache, {'revisados_ok': 2787})
    e = caso('ventana achicada, corrida 2 estable (avisa)', True, 1810, cache, e)
    e = caso('ventana achicada, corrida 3 estable (acepta base)', False, 1795, cache, e)
    # ...y con la base nueva, una caida real se vuelve a cazar.
    caso('ROJO: caida contra la base nueva (1.400 de 1.795)', True, 1400, cache, e)

    if fallas:
        print('FALLARON %d caso(s): %s' % (len(fallas), ', '.join(fallas)))
        return 1
    print('todo verde')
    return 0


def main():
    ap = argparse.ArgumentParser(description='Mails de Outlook (solo lectura)')
    ap.add_argument('--sync', action='store_true', help='volcar el buzon al cache (incremental)')
    ap.add_argument('--full', action='store_true', help='con --sync: rehacer el cache de cero')
    ap.add_argument('--buscar', nargs='+', metavar='TERMINO')
    ap.add_argument('--asunto', action='store_true', help='buscar solo en el asunto')
    ap.add_argument('--desde', metavar='AAAA-MM-DD')
    ap.add_argument('--hasta', metavar='AAAA-MM-DD')
    ap.add_argument('--carpeta', metavar='TEXTO')
    ap.add_argument('--limite', type=int, default=40)
    ap.add_argument('--ver', metavar='ID')
    ap.add_argument('--adjuntos', metavar='ID')
    ap.add_argument('--out', metavar='CARPETA')
    ap.add_argument('--stats', action='store_true')
    ap.add_argument('--selftest', action='store_true', help='probar el detector de sync parcial (sin Outlook)')
    a = ap.parse_args()

    if a.selftest:
        sys.exit(selftest())
    elif a.sync:
        sys.exit(sync(full=a.full))
    elif a.buscar:
        buscar(a.buscar, a.desde, a.hasta, a.carpeta, a.asunto, a.limite)
    elif a.ver:
        ver(a.ver)
    elif a.adjuntos:
        adjuntos(a.adjuntos, a.out)
    elif a.stats:
        stats()
    else:
        ap.print_help()


if __name__ == '__main__':
    main()
