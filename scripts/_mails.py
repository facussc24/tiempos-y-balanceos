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
    python scripts/_mails.py --sin-respuesta        # pedidos de la Bandeja sin mail de Fak a 5 dias
                                 [--dias 5] [--ventana 45] [--json]   (lo corre _escritorio.mjs)

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
# BARACK_MAIL_CACHE: otra carpeta de cache (la usan los tests para no tocar el real).
CACHE = os.environ.get('BARACK_MAIL_CACHE') or os.path.join(RAIZ, '.mail-cache')
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


# ─────────────────────────────────────────────────────────── pedidos sin respuesta

FAK_MAIL = 'f.santoro@barackmercosul.com'
FAK_NOMBRE = 'facundo santoro'
RUIDO_REMITENTE = re.compile(r'no-?_?reply|noreply|postmaster|mailer-?daemon|donotreply', re.I)
# Medido sobre los 64 hilos "sin respuesta" de los ultimos 45 dias al 05/09/2026 (regla de la
# casa: el umbral se prueba contra la POBLACION, no a ojo). Robots que no se contestan por mail:
#   - Info@vwgroupsupply.com (portal VW: "Canceled:", "Submit offer", "tasks will expire")   9 de 64
#   - "Microsoft on behalf of" (avisos del Planner) y "Read Assistant" (acuses de lectura)   1 de 64
REMITENTE_AUTOMATICO = re.compile(r'^info@|on behalf of|read assistant', re.I)
# Asuntos que no son un pedido: respuestas automaticas (3 de 64), avisos de calendario (2 de 64),
# y la lista diaria "Asaichi Ingenieria - Prioridades" de Carlos (8 de 64), que es la LISTA
# OFICIAL y tiene su propio canal (memoria project_prioridades_asaichi). Un RE: sobre el Asaichi
# SI queda: ahi adentro puede haber una pregunta.
ASUNTO_NO_PEDIDO = re.compile(
    r'^(respuesta automatica|automatic reply|out of office|fuera de la oficina|autoreply'
    r'|canceled|cancelado|accepted|aceptado|declined|rechazado|tentative|provisional'
    r'|asaichi)\b', re.I)
# Una difusion a 10 o mas destinatarios no le pide nada a Fak en particular (2 de 64: las
# "Difusion actualizacion BOM ARB" de Leo, a 15 personas).
DIFUSION_DESDE = 10
# Un mail que solo AGRADECE o ACUSA RECIBO no es un pedido: 3 de los 9 hilos "sin carpeta" que
# quedaron el 05/09/2026 eran "Muchas Gracias Facu" / "Gracias Facu" / "Gracias por el aporte"
# (Carlos y Marcelo contestando algo que Fak ya habia mandado). Se mira solo el texto PROPIO del
# mail (antes del primer "De:" / "From:" / "El ... escribio:" del citado); el agradecimiento
# tiene que estar AL FRENTE (tras un nombre o saludo, a lo sumo), el texto propio ser corto
# (firma incluida) y no traer ninguna marca de pedido. "Excelente sintesis. Difundilo" (Leo,
# 07/08) sigue siendo pedido: el "excelente" no esta al frente. "Gracias, ¿me pasas X?" tambien.
CITADO_RE = re.compile(r'(?:^|\s)(?:de|from|von)\s*:\s|_{5,}|-{5,}|\bel\b.{5,90}?\bescribi[oó]\s*:', re.I | re.S)
_INICIO = r'^(?:@?(?:[\wÀ-ÿ.]+\s*){1,3}[,:.!\-]\s*)?(?:(?:hola|buen\s*d[ií]a|buenas(?:\s+tardes|\s+noches)?|buenos\s+d[ií]as)\s*[,:.!\-]?\s*)?'
ACUSE_RE = re.compile(
    _INICIO + r'(?:(?:muchas|mil)\s+)?gracias\b'
    + '|' + _INICIO + r'(?:ok|oka|okey|dale|perfecto|genial|excelente|buen[ií]simo|recibido|listo|entendido|de acuerdo)\b',
    re.I)
PEDIDO_RE = re.compile(
    r'\?|por favor|podr[ií]as|pod[eé]s|necesit|pas[aá]me|mand[aá]me|envi[aá]me|carg[aá]|revis[aá]'
    r'|confirm[aá]|adjunto|te paso|hay que|ten[eé]s que|deber[ií]a|pendiente|urgente'
    r'|cuando (?:puedas|tengas|est[eé]s|termines|vuelvas)|falt[aeoó]|te pido|llam[aá]'
    r'|quedo (?:a la espera|atento)|difund|avis[aá]', re.I)
# "falt" y la familia "cuando tengas un rato" las agrego el auditor del 05/09: "Ok, perfecto. Falta el
# plano del 0428." y "Excelente, gracias! Cuando tengas un rato, llamame." quedaban escondidos.
ACUSE_MAX = 400   # texto propio con firma; un pedido real casi nunca entra en eso arrancando con "gracias"


def texto_propio(cuerpo):
    """El texto que escribio el remitente, sin el mail citado que viene abajo."""
    txt = ' '.join((cuerpo or '').split())
    m = CITADO_RE.search(txt)
    return txt[:m.start()].strip() if m else txt


def _es_acuse(m):
    propio = texto_propio(m.get('cuerpo'))
    if not propio or len(propio) > ACUSE_MAX:
        return False
    return bool(ACUSE_RE.match(propio)) and not PEDIDO_RE.search(propio)


def _normalizar(s):
    """Mismo criterio que normalizarTexto() de scripts/_lib/mailCache.mjs: sin tildes, minusculas,
    solo letras y numeros. Los dos lados agrupan el hilo igual o el Escritorio y este script se
    contradicen."""
    import unicodedata
    t = unicodedata.normalize('NFD', s or '')
    t = ''.join(ch for ch in t if not unicodedata.combining(ch)).lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9]+', ' ', t)).strip()


def clave_hilo(asunto):
    """'RE: RV: Alta código' -> 'alta codigo' (igual que claveHilo() del .mjs)."""
    t = _normalizar(asunto)
    while True:
        t2 = re.sub(r'^(re|rv|fw|fwd)\s+', '', t)
        if t2 == t:
            return t
        t = t2


def _es_de_fak(m):
    return (m.get('de_mail') or '').lower() == FAK_MAIL or FAK_NOMBRE in (m.get('de') or '').lower()


def _para_fak(m):
    p = (m.get('para') or '').lower()
    return FAK_MAIL in p or FAK_NOMBRE in p or 'f.santoro' in p


def _es_ruido(m):
    de_mail = (m.get('de_mail') or '').strip()
    de = (m.get('de') or '').strip()
    if RUIDO_REMITENTE.search(de_mail + ' ' + de) or REMITENTE_AUTOMATICO.search(de_mail) \
            or REMITENTE_AUTOMATICO.search(de):
        return True
    asunto = _normalizar(m.get('asunto'))
    if re.search(r'feli(z|ces) cumple', asunto):
        return True
    # el prefijo RE/RV se mira sobre el asunto ORIGINAL: "RE: Asaichi..." es conversacion, no lista
    sin_prefijo = not re.match(r'^\s*(re|rv|fw|fwd)\s*:', m.get('asunto') or '', re.I)
    if sin_prefijo and ASUNTO_NO_PEDIDO.match(asunto):
        return True
    destinatarios = [x for x in (m.get('para') or '').split(';') if x.strip()]
    return len(destinatarios) >= DIFUSION_DESDE


def _tipo_carpeta(carpeta):
    c = _normalizar(carpeta)
    if 'bandeja de entrada' in c:
        return 'entrada'
    if 'elementos enviados' in c or 'enviados' in c:
        return 'enviados'
    if 'bandeja de salida' in c:
        return 'salida'
    if 'borradores' in c:
        return 'borradores'
    return 'otro'


def pedidos_sin_respuesta(mails, dias=5, ventana=45, hoy=None):
    """Hilos de la Bandeja de entrada dirigidos A Fak cuyo ultimo mail recibido lleva `dias` o mas
    sin un mail de Fak posterior en el mismo hilo. Funcion pura (sin Outlook): la prueba el selftest.

    Que cuenta como respuesta de Fak: un mail suyo (de_mail = f.santoro@) en cualquier carpeta,
    posterior al ultimo recibido, con la misma clave de hilo. Si la respuesta esta en la Bandeja
    de SALIDA (en cola, nunca salio) o en BORRADORES, el hilo se lista igual con ese estado: es
    la firma de "hecho pero no avisado" del triage del 03/08/2026.

    Que NO entra: mails en los que Fak esta solo en copia (79 de 256 en los ultimos 45 dias al
    05/09/2026: los mira, pero no le piden nada a el), remitentes automaticos y saludos de
    cumpleanos (mismo criterio que esRuido() del .mjs), los que solo agradecen o acusan recibo
    (`_es_acuse`), y los mails que mando el mismo Fak.
    Cada exclusion nueva ESCONDE pedidos: agregar solo casos inequivocos.

    Devuelve una lista de dicts ordenada por dias sin respuesta (el mas viejo primero).
    """
    hoy = hoy or datetime.date.today()
    corte = (hoy - datetime.timedelta(days=ventana)).strftime('%Y-%m-%d')
    hilos = {}
    for m in mails:
        fecha = m.get('fecha') or ''
        if not fecha or fecha < corte:
            continue
        k = clave_hilo(m.get('asunto'))
        if not k:
            continue
        h = hilos.setdefault(k, {'recibidos': [], 'de_fak': []})
        if _es_de_fak(m):
            h['de_fak'].append(m)
            continue
        if _tipo_carpeta(m.get('carpeta')) != 'entrada' or _es_ruido(m) or _es_acuse(m) or not _para_fak(m):
            continue
        h['recibidos'].append(m)

    out = []
    for k, h in hilos.items():
        if not h['recibidos']:
            continue
        ultimo = max(h['recibidos'], key=lambda m: m['fecha'])
        despues = [m for m in h['de_fak'] if m['fecha'] >= ultimo['fecha']]
        estado = 'sin respuesta'
        if despues:
            tipos = set(_tipo_carpeta(m.get('carpeta')) for m in despues)
            if tipos & {'enviados', 'entrada', 'otro'}:
                continue                      # Fak ya contesto (o su mail volvio a la Bandeja)
            estado = 'en cola de salida' if 'salida' in tipos else 'borrador sin enviar'
        try:
            f_ult = datetime.datetime.strptime(ultimo['fecha'][:10], '%Y-%m-%d').date()
        except ValueError:
            continue
        d = (hoy - f_ult).days
        if d < dias:
            continue
        out.append({
            'hilo': k,
            'asunto': ultimo.get('asunto') or '',
            'de': ultimo.get('de') or '',
            'de_mail': ultimo.get('de_mail') or '',
            'fecha': ultimo['fecha'],
            'dias': d,
            'mails': len(h['recibidos']),
            'estado': estado,
            'id': ultimo.get('id') or '',
        })
    out.sort(key=lambda x: (-x['dias'], x['asunto']))
    return out


def sin_respuesta(dias=5, ventana=45, como_json=False):
    cache = _leer_cache()
    if not cache:
        if como_json:
            print(json.dumps({'error': 'cache vacio', 'pedidos': []}))
            return 0
        sys.exit('El cache esta vacio. Corre primero:  python scripts/_mails.py --sync')
    pedidos = pedidos_sin_respuesta(cache.values(), dias=dias, ventana=ventana)
    if como_json:
        print(json.dumps({'dias': dias, 'ventana': ventana, 'total': len(pedidos), 'pedidos': pedidos},
                         ensure_ascii=False))
        return 0
    print('PEDIDOS SIN RESPUESTA  (Bandeja de entrada, dirigidos a Fak, ultimos %d dias, '
          'sin mail suyo en el hilo hace %d dias o mas): %d' % (ventana, dias, len(pedidos)))
    print()
    for p in pedidos:
        marca = '' if p['estado'] == 'sin respuesta' else '  [%s]' % p['estado'].upper()
        print('  %3d d  %-24s %s%s%s' % (p['dias'], p['de'][:24], p['asunto'][:70],
                                         ('  (%d mails)' % p['mails']) if p['mails'] > 1 else '', marca))
    print()
    print('Lista para OJEAR, no verdad: un hilo aca puede ser un FYI. Pero si es un pedido, hoy nadie lo')
    print('esta mirando. Los mails los contesta Fak; la carpeta en el Escritorio se abre solo con su OK.')
    return 0


def selftest_sin_respuesta():
    """Casos sinteticos con fecha fija (hoy = 05/09/2026). Cada regla se ve fallar y pasar."""
    hoy = datetime.date(2026, 9, 5)
    ENT = 'f.santoro@barackmercosul.com / Bandeja de entrada'
    ENV = 'f.santoro@barackmercosul.com / Elementos enviados'
    SAL = 'f.santoro@barackmercosul.com / Bandeja de salida'
    BOR = 'f.santoro@barackmercosul.com / Borradores'
    FAK = 'Facundo Santoro'
    n = [0]

    def mail(carpeta, fecha, de, asunto, para=FAK, cc='', de_mail=None, cuerpo=''):
        n[0] += 1
        if de_mail is None:
            de_mail = FAK_MAIL if de == FAK else de.lower().replace(' ', '.') + '@x.com'
        return {'id': 'm%d' % n[0], 'carpeta': carpeta, 'fecha': fecha, 'de': de, 'de_mail': de_mail,
                'para': para, 'cc': cc, 'asunto': asunto, 'adjuntos': [], 'cuerpo': cuerpo}

    fallas = []

    def caso(nombre, mails, esperado, **kw):
        res = pedidos_sin_respuesta(mails, hoy=hoy, **kw)
        got = [(p['hilo'], p['dias'], p['estado']) for p in res]
        ok = got == esperado
        print('  %s %-64s -> %s' % ('ok ' if ok else 'MAL', nombre, got if got else 'nada'))
        if not ok:
            fallas.append(nombre)

    print('selftest de pedidos_sin_respuesta (19 casos):')
    # 1. ROJO: el caso real — codigos 21-9694/95, Pablo, 14 dias sin respuesta.
    caso('ROJO: pedido de hace 14 dias sin mail de Fak', [
        mail(ENT, '2026-08-22 10:00', 'Pablo Gamboa', 'Alta codigos 21-9694/95')],
        [('alta codigos 21 9694 95', 14, 'sin respuesta')])
    # 2. Todavia dentro de los 5 dias: no molesta.
    caso('pedido de hace 3 dias: todavia no', [
        mail(ENT, '2026-09-02 10:00', 'Pablo Gamboa', 'Alta codigos 21-9694/95')], [])
    # 3. Fak contesto (Elementos enviados, mismo hilo con RE:): no.
    caso('contestado por Fak en Enviados', [
        mail(ENT, '2026-08-22 10:00', 'Pablo Gamboa', 'Alta codigos 21-9694/95'),
        mail(ENV, '2026-08-23 09:00', FAK, 'RE: Alta codigos 21-9694/95', para='Pablo Gamboa')], [])
    # 4. ROJO: Fak contesto, pero le VOLVIERON a escribir despues y eso quedo sin respuesta.
    caso('ROJO: Fak contesto y le volvieron a escribir (10 dias)', [
        mail(ENT, '2026-08-20 10:00', 'Carlos Baptista', 'BOM IP Pad'),
        mail(ENV, '2026-08-21 09:00', FAK, 'RE: BOM IP Pad', para='Carlos Baptista'),
        mail(ENT, '2026-08-26 15:00', 'Carlos Baptista', 'RE: BOM IP Pad')],
        [('bom ip pad', 10, 'sin respuesta')])
    # 5. Fak solo en copia: lo mira, no le piden nada.
    caso('Fak solo en CC: no', [
        mail(ENT, '2026-08-22 10:00', 'Marcelo Nieve', 'PSW vinilos', para='Leo Perez', cc=FAK)], [])
    # 6. Remitente automatico y cumpleanos: ruido.
    caso('no-reply y feliz cumple: ruido', [
        mail(ENT, '2026-08-22 10:00', 'Portal', 'Notificacion INCA', de_mail='no-reply@portal.com'),
        mail(ENT, '2026-08-22 10:00', 'RRHH', 'Feliz cumple Facu!')], [])
    # 7. La respuesta esta EN COLA DE SALIDA: se lista con ese estado (nunca salio).
    caso('respuesta en Bandeja de salida: en cola', [
        mail(ENT, '2026-08-22 10:00', 'Federico Kipersain', 'Dispositivo adhesivado'),
        mail(SAL, '2026-08-25 09:00', FAK, 'RE: Dispositivo adhesivado', para='Federico Kipersain')],
        [('dispositivo adhesivado', 14, 'en cola de salida')])
    # 8. Un borrador no es una respuesta.
    caso('respuesta en Borradores: borrador sin enviar', [
        mail(ENT, '2026-08-22 10:00', 'Federico Kipersain', 'Relevamiento de medios'),
        mail(BOR, '2026-08-25 09:00', FAK, 'RE: Relevamiento de medios', para='Federico Kipersain')],
        [('relevamiento de medios', 14, 'borrador sin enviar')])
    # 9. Un mail del propio Fak que cayo en la Bandeja (a si mismo o en copia) no es un pedido.
    caso('mail de Fak en la Bandeja: no es pedido', [
        mail(ENT, '2026-08-22 10:00', FAK, 'Nota para mi')], [])
    # 10. Fuera de la ventana de 45 dias: no se mira.
    caso('pedido de hace 60 dias: fuera de la ventana', [
        mail(ENT, '2026-07-07 10:00', 'Pablo Gamboa', 'Algo viejo')], [])
    # 11. RV: y RE: del mismo asunto son UN hilo; cuenta los mails recibidos.
    caso('RV/RE del mismo asunto = un hilo de 2 mails', [
        mail(ENT, '2026-08-20 10:00', 'Pablo Gamboa', 'RV: Codigos Sansuy'),
        mail(ENT, '2026-08-24 10:00', 'Carlos Baptista', 'RE: RV: Codigos Sansuy')],
        [('codigos sansuy', 12, 'sin respuesta')])
    # 12. --dias y --ventana se respetan: con dias=20 el de 14 no entra.
    caso('con --dias 20 el de 14 dias no entra', [
        mail(ENT, '2026-08-22 10:00', 'Pablo Gamboa', 'Alta codigos 21-9694/95')], [], dias=20)
    # 13-16. Lo que la poblacion del 05/09 mostro como ruido (23 de 64 hilos).
    caso('portal VW (Info@vwgroupsupply.com) y acuse de lectura: robots', [
        mail(ENT, '2026-08-22 10:00', 'Info@vwgroupsupply.com', 'Submit offer: G BM I 26 202', de_mail='Info@vwgroupsupply.com'),
        mail(ENT, '2026-08-22 10:00', 'Read Assistant', 'Piezas para PWA | Read', de_mail='ra@toyota.com')], [])
    caso('respuesta automatica y aviso de calendario: no son pedidos', [
        mail(ENT, '2026-08-22 10:00', 'Gonzalo Cal', 'Respuesta autom\u00e1tica: Mesa de corte'),
        mail(ENT, '2026-08-22 10:00', 'Portal', 'Canceled: F PA I 24 45 - K1 Sitzsystem', de_mail='p@vw.com')], [])
    caso('la lista Asaichi de Carlos no es pedido, pero un RE: sobre ella si', [
        mail(ENT, '2026-08-22 10:00', 'Carlos Baptista', 'Asaichi Ingeneiria - Prioridades 22/08/2026', para='Facundo Santoro; Leo; Nico; Pablo'),
        mail(ENT, '2026-08-24 10:00', 'Leo Lattanzi', 'RE: Asaichi Ingeneiria - Prioridades 24/08/2026', para='Facundo Santoro; Carlos')],
        [('asaichi ingeneiria prioridades 24 08 2026', 12, 'sin respuesta')])
    caso('difusion a 15 personas: no le pide nada a Fak; a 4 si', [
        mail(ENT, '2026-08-22 10:00', 'Leo Lattanzi', 'PATAGONIA ARMREST REAR - Difusion BOM ARB', para='; '.join(['Facundo Santoro'] + ['P%d' % i for i in range(14)])),
        mail(ENT, '2026-08-22 10:00', 'Carlos Baptista', 'Relevamiento de medios', para='Facundo Santoro; Leo; Nico; Pablo')],
        [('relevamiento de medios', 14, 'sin respuesta')])
    # 17-18. Acuses (05/09: 3 de los 9 "sin carpeta" eran un "gracias" con firma). Se ve fallar y pasar.
    FIRMA = ' Eng. Carlos Baptista Engineering - Ingenieria Barack Mercosul Los Arboles 842 B1686 - Hurlingham'
    CITA = ' ________________________________ De: Facundo Santoro <f.santoro@barackmercosul.com> Enviado: viernes Asunto: RE: Medios carton Buenas, les paso los medios...'
    caso('un "gracias" con firma y citado no es pedido; "Gracias, ¿me pasas el de Patagonia?" si', [
        mail(ENT, '2026-08-22 10:00', 'Carlos Baptista', 'RE: Medios carton', cuerpo='Muchas Gracias Facu.' + FIRMA + CITA),
        mail(ENT, '2026-08-22 10:00', 'Marcelo Nieve', 'RE: PDF modificados', cuerpo='Facus, Gracias por el aporte. Quedo a su disposicion ante cualquier consulta, Marcelo Nieve Quality Projects' + CITA),
        mail(ENT, '2026-08-22 10:00', 'Carlos Baptista', 'RE: Codigos Sansuy', cuerpo='Gracias Facu, ¿me pasas tambien el de Patagonia?' + FIRMA)],
        [('codigos sansuy', 14, 'sin respuesta')])
    caso('"Excelente sintesis. Difundilo" y "@Facundo buen dia, por favor tomar..." siguen siendo pedidos', [
        mail(ENT, '2026-08-22 10:00', 'Leo Lattanzi', 'RE: Modificaciones BOM', cuerpo='Parece estar todo en orden Facu. Excelente sintesis. Difundilo' + CITA),
        mail(ENT, '2026-08-22 10:00', 'Carlos Baptista', 'RE: MUESTREO DE PESOS', cuerpo='@Facundo Santoro buen dia, Por favor tomar los valores adjuntos +15% por perdida en aplicado, para el uso de adhesivos para las BOM, Gracias.' + FIRMA + CITA)],
        [('muestreo de pesos', 14, 'sin respuesta'), ('modificaciones bom', 14, 'sin respuesta')])
    # 19. Las dos evasiones que encontro el auditor independiente del 05/09 (arrancan como acuse y piden algo
    #     sin ninguna de las palabras de la lista original); el control "Perfecto, gracias." sigue escondido.
    caso('"Ok, perfecto. Falta el plano" y "gracias! Cuando tengas un rato, llamame" son pedidos; "Perfecto, gracias." no', [
        mail(ENT, '2026-08-22 10:00', 'Carlos Baptista', 'RE: Plano 0428', cuerpo='Ok, perfecto. Falta el plano del 0428.' + FIRMA + CITA),
        mail(ENT, '2026-08-22 10:00', 'Leo Lattanzi', 'RE: Layout linea', cuerpo='Excelente, gracias! Cuando tengas un rato, llamame.' + CITA),
        mail(ENT, '2026-08-22 10:00', 'Pablo Gamboa', 'RE: Fichas tecnicas', cuerpo='Perfecto, gracias.' + CITA)],
        [('layout linea', 14, 'sin respuesta'), ('plano 0428', 14, 'sin respuesta')])

    if fallas:
        print('FALLARON %d caso(s): %s' % (len(fallas), ', '.join(fallas)))
        return 1
    print('todo verde (sin respuesta)')
    return 0


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
    print()
    if selftest_sin_respuesta():
        return 1
    print('todo verde')
    return 0


def main():
    # La consola de Windows es cp1252: un emoji en un asunto tumbaba el listado entero.
    try:
        sys.stdout.reconfigure(errors='replace')
    except Exception:
        pass
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
    ap.add_argument('--selftest', action='store_true', help='probar el detector de sync parcial y el de pedidos sin respuesta (sin Outlook)')
    ap.add_argument('--sin-respuesta', action='store_true', help='pedidos de la Bandeja dirigidos a Fak sin mail suyo en el hilo')
    ap.add_argument('--dias', type=int, default=5, help='con --sin-respuesta: dias sin respuesta para listar (default 5)')
    ap.add_argument('--ventana', type=int, default=45, help='con --sin-respuesta: cuantos dias para atras mirar (default 45)')
    ap.add_argument('--json', action='store_true', help='con --sin-respuesta: salida JSON (la lee _escritorio.mjs)')
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
    elif a.sin_respuesta:
        sys.exit(sin_respuesta(dias=a.dias, ventana=a.ventana, como_json=a.json))
    else:
        ap.print_help()


if __name__ == '__main__':
    main()
