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
import io
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(RAIZ, '.mail-cache')
MAILS = os.path.join(CACHE, 'mails.jsonl')
ADJ = os.path.join(CACHE, 'adjuntos')

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
    # Outlook todavia no los tiene. Sin este aviso el sync diario miente en silencio.
    parcial = bool(previos) and revisados[0] < len(previos) * 0.8
    if parcial:
        print()
        print('  *** SYNC PARCIAL — NO confiar en "nuevos: %d" ***' % len(nuevos))
        print('  Outlook clasico solo mostro %d items y el cache ya tiene %d.'
              % (revisados[0], len(previos)))
        print('  Todavia esta bajando el buzon del servidor. Dejalo abierto y reintenta')
        print('  mas tarde:  python scripts/_mails.py --sync')

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
    a = ap.parse_args()

    if a.sync:
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
