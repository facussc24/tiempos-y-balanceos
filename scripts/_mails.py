# -*- coding: utf-8 -*-
"""
Acceso a los mails de Fak desde Outlook clasico (COM, solo lectura).

El buzon vive en el servidor de la empresa; Outlook clasico lo sincroniza a un .ost
local y este script lo lee desde ahi. No hay credenciales aca: usa la sesion que
Outlook ya tiene abierta, como haria una macro de VBA.

    python scripts/_mails.py --sync                 # vuelca el buzon al cache (incremental)
    python scripts/_mails.py --buscar "aplix"       # busca en asunto y cuerpo, en el buzon de Fak Y en
                                                    # los mails del equipo que ya estan en la nube
    python scripts/_mails.py --buscar "bom" --desde 2026-01-01 --carpeta "Bandeja"
    python scripts/_mails.py --buscar "bom" --buzon carlos     # solo lo de ese buzon (nombre, casilla o persona)
    python scripts/_mails.py --buscar "bom" --solo-fak         # sin mirar la nube del equipo
    python scripts/_mails.py --buzones              # que buzones puedo leer, cuantos mails y hasta cuando
    python scripts/_mails.py --ver <id>             # un mail completo (el id sale del --buscar)
    python scripts/_mails.py --adjuntos <id>        # extrae sus adjuntos (solo si el mail esta en el buzon de Fak)
    python scripts/_mails.py --stats                # que hay en el cache de Fak
    python scripts/_mails.py --sin-respuesta        # pedidos de la Bandeja sin mail de Fak a 5 dias
                                 [--dias 5] [--ventana 45] [--json]   (lo corre _escritorio.mjs)

Cuatro lecturas mas (cola HOY-19a a d, 10/10/2026; la logica y su selftest, en scripts/_lib/mailsLectura.py):
    python scripts/_mails.py --nuevos               # lo que llego desde el ultimo mail del cache, en segundos:
                                 [--desde AAAA-MM-DD]   ordena cada carpeta por fecha y corta (no recorre todo, como --sync)
    python scripts/_mails.py --abrir <id>           # MUESTRA ese mail en Outlook, en la pantalla de Fak. No lo guarda ni
                                                    # lo mueve; si estaba sin leer, Outlook lo marca como leido al abrirlo
    python scripts/_mails.py --adjuntos <id> --abrir   # extrae los adjuntos y los abre con scripts/_abrir.mjs
    python scripts/_mails.py --borradores [--json]  # los borradores con su edad, sus adjuntos y si los armo un programa
    python scripts/_mails.py --agenda [--dias 7] [--json]   # reuniones de los proximos dias y tareas sin completar

LOS MAILS DEL EQUIPO (agregado el 07/10/2026): los de trabajo de algunos companeros (hoy Carlos Baptista y la PC
que era de Marcelo Nieve) suben solos a la nube de Ingenieria, en
`<biblioteca>\\<_CUARENTENA_>Claude Barack\\mails\\_entrada\\<persona>\\*.jsonl`, y esta herramienta los lee de ahi
(solo lectura). Antes de decir "no puedo leer el correo de X": `--buzones` y `--buscar`. Hermana de `_entrada` esta
`_cuarentena\\`, lo que el filtro aparto por privado: NO SE LEE NUNCA (ver `_en_cuarentena`). La nube guarda solo los
NOMBRES de los adjuntos, no los archivos.

ATENCION — el repo es PUBLICO. El cache va a .mail-cache/ (gitignoreado). Nunca
commitear contenido de mails ni pegarlo en archivos del repo.

Enviar, responder o borrar mails NO se hace desde aca: es a mano, por Fak. Nada de este archivo guarda, mueve,
borra ni transmite un item de Outlook; `--abrir` solo muestra una ventana.
"""
import argparse
import datetime
import glob
import hashlib
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '_lib'))
import mailsLectura  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# BARACK_MAIL_CACHE: otra carpeta de cache (la usan los tests para no tocar el real).
CACHE = os.environ.get('BARACK_MAIL_CACHE') or os.path.join(RAIZ, '.mail-cache')
MAILS = os.path.join(CACHE, 'mails.jsonl')
ADJ = os.path.join(CACHE, 'adjuntos')
ESTADO = os.path.join(CACHE, 'sync-state.json')

MAX_CUERPO = 20000   # un mail con 300 reenviados no aporta mas que sus primeras paginas

# Mails del equipo en la nube de Ingenieria. BARACK_MAIL_EQUIPO = la carpeta `mails` (la que tiene `_entrada`
# adentro): la usan los tests para no tocar la real; vacia = sin nube (solo el buzon de Fak).
BUZON_FAK = 'Fak'
ORGANIZACION = 'BARACK ARGENTINA SRL'
CUARENTENA = '_cuarentena'        # hermana de `_entrada`: lo que el filtro aparto por privado. NO SE LEE NUNCA.
CARPETA_EQUIPO_RE = re.compile(r'claude barack', re.I)    # `Claude Barack` y `_CUARENTENA_Claude Barack`
TOLERANCIA_MIN = 3        # minutos entre la copia de quien envia y la de quien recibe el mismo mail


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


# ───────────────────────────────────────────────── mails del equipo (nube de Ingenieria)
#
# Por que existe (07/10/2026): le dije a Fak "el correo de Carlos no lo puedo leer, solo tengo acceso al tuyo" y era
# FALSO: los mails de trabajo de Carlos (cbaptista) y de la PC que era de Marcelo (lucca.tuccio) ya suben solos a la
# nube de Ingenieria, y esta herramienta solo miraba el Outlook de Fak. Fak: "si lo podes leer, esta en la nube...
# desde cuando no recordas eso?". Ahora `--buscar` mira los dos lados y cada resultado dice de que buzon sale.
#
# Solo lectura. Solo `_entrada\<persona>\*.jsonl`. `_cuarentena\` (hermana de `_entrada`: lo que el filtro aparto por
# privado) no se abre nunca: ni por la ruta, ni por un enlace que apunte ahi (`_en_cuarentena`).

def _partes(ruta):
    return [p.lower() for p in re.split(r'[\\/]+', str(ruta)) if p]


def _en_cuarentena(ruta):
    """True si la ruta, o a donde apunta si es un enlace, pasa por una carpeta que se llame `_cuarentena`.

    Exacto: `_CUARENTENA_Claude Barack` (la carpeta que contiene a todo) NO es `_cuarentena`."""
    return CUARENTENA in _partes(os.path.abspath(ruta)) or CUARENTENA in _partes(os.path.realpath(ruta))


def _adentro(ruta_real, base_real):
    try:
        return os.path.normcase(os.path.commonpath([ruta_real, base_real])) == os.path.normcase(base_real)
    except ValueError:        # otro disco
        return False


def _carpetas_equipo():
    """Las carpetas `mails` de la nube del equipo que esta PC tiene a la vista (cada una trae `_entrada\\<persona>`).

    Se buscan en la biblioteca de Ingenieria (`BARACK ARGENTINA SRL\\Ingenieria y Proyecto - General`), nunca en la
    nube personal de Fak. El nombre de la carpeta cambio de `Claude Barack` a `_CUARENTENA_Claude Barack`: se acepta
    cualquiera que nombre `Claude Barack` y tenga `mails\\_entrada` adentro. Si la carpeta se mueve otra vez, la
    ruta se pasa con BARACK_MAIL_EQUIPO."""
    env = os.environ.get('BARACK_MAIL_EQUIPO')
    if env is not None:
        return [env] if env.strip() else []
    org = os.path.join(os.path.expanduser('~'), ORGANIZACION)
    try:
        bibliotecas = [n for n in os.listdir(org) if re.match(r'^Ingenier.{1,2}a y Proyecto - General$', n, re.I)]
    except OSError:
        return []
    out = []
    for b in sorted(bibliotecas):
        raiz = os.path.join(org, b)
        try:
            hijos = sorted(os.listdir(raiz))
        except OSError:
            continue
        for h in hijos:
            if CARPETA_EQUIPO_RE.search(h) and os.path.isdir(os.path.join(raiz, h, 'mails', '_entrada')):
                out.append(os.path.join(raiz, h, 'mails'))
    return out


def _personas_de(base):
    """[(persona, carpeta)] de `<base>\\_entrada\\<persona>`. Nunca entra a `_cuarentena`, ni por la ruta ni por un
    enlace (una junction de `_entrada` hacia `_cuarentena` no se sigue), ni sale de `_entrada`."""
    entrada = os.path.join(base, '_entrada')
    if _en_cuarentena(base) or not os.path.isdir(entrada) or _en_cuarentena(entrada):
        return []
    real_entrada = os.path.realpath(entrada)
    if not _adentro(real_entrada, os.path.realpath(base)):
        return []
    try:
        nombres = sorted(os.listdir(entrada))
    except OSError:
        return []
    out = []
    for nombre in nombres:
        if nombre[:1] in ('_', '.'):
            continue
        d = os.path.join(entrada, nombre)
        if not os.path.isdir(d) or _en_cuarentena(d) or not _adentro(os.path.realpath(d), real_entrada):
            continue
        out.append((nombre, d))
    return out


def _leer_persona(carpeta):
    """(registros, ultima_subida) de los `*.jsonl` de una persona. Un renglon roto se salta, como en el cache de Fak."""
    registros, subida = [], 0
    for ruta in sorted(glob.glob(os.path.join(glob.escape(carpeta), '*.jsonl'))):
        if _en_cuarentena(ruta):
            continue
        try:
            subida = max(subida, os.path.getmtime(ruta))
            with io.open(ruta, encoding='utf-8') as f:
                for linea in f:
                    linea = linea.strip()
                    if not linea:
                        continue
                    try:
                        r = json.loads(linea)
                    except Exception:
                        continue
                    if isinstance(r, dict):
                        registros.append(r)
        except OSError:
            continue
    return registros, subida


def _texto(x):
    return '' if x is None else str(x)


def _campos(m):
    """Los campos de un mail como los usa todo este script, con texto aunque falten."""
    out = dict(m)
    for k in ('id', 'carpeta', 'fecha', 'de', 'de_mail', 'para', 'cc', 'asunto', 'cuerpo'):
        out[k] = _texto(m.get(k))
    adj = m.get('adjuntos') or []
    out['adjuntos'] = [_texto(a) for a in adj] if isinstance(adj, list) else [_texto(adj)]
    return out


def _liviano(s):
    """Para cruzar el MISMO mail entre buzones: minusculas y solo palabras. No hace falta sacar tildes: las dos copias
    salen del mismo Outlook."""
    return ' '.join(re.findall(r'\w+', _texto(s).lower()))


def _clave_cruce(m):
    """Un mail que esta en el buzon de Fak y en el de un companero es el MISMO si coinciden quien lo manda, el asunto,
    el arranque del texto y A QUIEN va. Medido el 07/10/2026 contra la nube real: el remitente se compara por su NOMBRE
    (en el cache de Fak el 78% de las casillas son un DN de Exchange, no una direccion), y los destinatarios se
    exigen: los avisos de un robot (portal VW, INCA) llegan como un mail aparte a cada persona, con el mismo texto
    y otro 'para', y esos NO son el mismo mail."""
    return (_liviano(m['de']), _liviano(m['asunto']), _liviano(m['cuerpo'][:400])[:120], _liviano(m['para']))


def _minutos(fecha):
    """'2026-10-05 14:00' -> minutos desde el dia 1 (a mano: strptime, 11 mil veces, tardaba 0,7 s)."""
    f = fecha[:16]
    if len(f) != 16 or f[4] != '-' or f[7] != '-' or f[10] != ' ' or f[13] != ':':
        return None
    try:
        return datetime.date(int(f[0:4]), int(f[5:7]), int(f[8:10])).toordinal() * 1440 + int(f[11:13]) * 60 + int(f[14:16])
    except ValueError:
        return None


def _idn(i):
    return _texto(i).strip().strip('<>').lower()


def _corto(i):
    return 'nube:' + hashlib.sha1(_texto(i).encode('utf-8', 'replace')).hexdigest()[:12]


def _mas_comun(valores):
    cuenta = {}
    for v in valores:
        if v:
            cuenta[v] = cuenta.get(v, 0) + 1
    return max(cuenta.items(), key=lambda kv: kv[1])[0] if cuenta else ''


def _identidad(mails):
    """(casilla, nombre) del dueno de un buzon, sacados de sus propios mails: la casilla es el principio de la carpeta
    (`cbaptista@... / Bandeja de entrada`) y el nombre, el que figura como remitente en sus Elementos enviados."""
    carpetas = {}
    for m in mails:
        carpetas[m['carpeta']] = carpetas.get(m['carpeta'], 0) + 1
    casillas = {}
    for c, n in carpetas.items():
        pref = c.split(' / ')[0].strip().lower()
        if '@' in pref:
            casillas[pref] = casillas.get(pref, 0) + n
    casilla = max(casillas.items(), key=lambda kv: kv[1])[0] if casillas else ''
    enviadas = {c for c in carpetas if _tipo_carpeta(c) == 'enviados'}      # una vez por carpeta, no por mail
    nombre = _mas_comun(m['de'] for m in mails if m['carpeta'] in enviadas)
    return casilla, nombre


def _unificar(solo_fak=False):
    """Todos los mails que puedo leer, cada uno UNA vez, con los buzones en que esta.

      mails    lista de mails (los campos del cache de Fak mas `buzones`, `en_outlook`, `ids`, `id_mostrar`)
      por_id   cualquier id con el que se pueda pedir un mail (EntryID de Fak, Message-ID, id corto `nube:...`)
      buzones  nombre -> {nombre, casilla, persona, total, ultimo, subida, origen}
      equipo   las carpetas `mails` de la nube que se leyeron ([] = esta PC no la ve o se pidio --solo-fak)

    El buzon de Fak se lee como siempre (`_leer_cache`). Los del equipo, de `_entrada\\<persona>`. Entre buzones del
    equipo, el mismo mail se junta por su Message-ID; con el de Fak, por `_clave_cruce`."""
    mails, buzones = [], {}
    fak = []
    for m in _leer_cache().values():
        x = _campos(m)
        x.update(buzones=[BUZON_FAK], en_outlook=x['id'], ids=[x['id']], id_mostrar=x['id'])
        fak.append(x)
    mails.extend(fak)
    if fak:
        casilla, nombre = _identidad(fak)
        buzones[BUZON_FAK] = {'nombre': BUZON_FAK, 'casilla': casilla, 'persona': nombre, 'total': len(fak),
                              'ultimo': max((x['fecha'] for x in fak if x['fecha']), default=''),
                              'subida': 0, 'origen': 'cache local (.mail-cache)'}
    equipo = [] if solo_fak else _carpetas_equipo()
    leidas = []
    nube = {}
    for base in equipo:
        for persona, carpeta in _personas_de(base):
            registros, subida = _leer_persona(carpeta)
            if not registros:
                continue
            propios = [_campos(r) for r in registros]
            casilla, nombre = _identidad(propios)
            info = buzones.setdefault(persona, {'nombre': persona, 'casilla': casilla, 'persona': nombre, 'total': 0,
                                                'ultimo': '', 'subida': 0, 'origen': 'nube del equipo'})
            info['subida'] = max(info['subida'], subida)
            leidas.append(base)
            vistos = set()
            for r, x in zip(registros, propios):
                mid = x['id'].strip()
                eid = _texto(r.get('eid')).strip()
                clave = mid or 'sin-id:%s:%s' % (persona, eid or len(vistos))
                if (persona, clave) in vistos:
                    continue
                vistos.add((persona, clave))
                info['total'] += 1
                if x['fecha'] > info['ultimo']:
                    info['ultimo'] = x['fecha']
                previo = nube.get(clave)
                if previo is not None:                       # el mismo Message-ID en otro buzon del equipo
                    if persona not in previo['buzones']:
                        previo['buzones'].append(persona)
                    if eid and eid not in previo['ids']:
                        previo['ids'].append(eid)
                    continue
                x.update(buzones=[persona], en_outlook='', id_mostrar=_corto(clave))
                x['ids'] = [i for i in (mid, eid, x['id_mostrar']) if i]
                x['id'] = x['id_mostrar']
                nube[clave] = x
    if nube:
        # Primero lo barato (el asunto tal cual y la hora, que descartan casi todo) y recien despues la clave entera.
        indice = {}
        for f in fak:
            d = _minutos(f['fecha'])
            if d is not None:
                indice.setdefault(_liviano(f['asunto']), []).append((d, f))
        for x in nube.values():
            destino, mejor = None, None
            t = _minutos(x['fecha'])
            if t is None:
                mails.append(x)
                continue
            clave = None
            for d, f in indice.get(_liviano(x['asunto']), []):
                if abs(t - d) > TOLERANCIA_MIN:
                    continue
                clave = clave or _clave_cruce(x)
                if _clave_cruce(f) != clave:
                    continue
                cual = (abs(t - d), 'sincroniz' in _liviano(f['carpeta']))     # a igual hora, la carpeta de verdad
                if mejor is None or cual < mejor:
                    destino, mejor = f, cual
            if destino is None:
                mails.append(x)
                continue
            destino['buzones'].extend(b for b in x['buzones'] if b not in destino['buzones'])
            destino['ids'].extend(i for i in x['ids'] if i not in destino['ids'])
    por_id, por_norm = {}, {}
    for x in mails:
        for i in x['ids']:
            por_id.setdefault(i, x)
            por_norm.setdefault(_idn(i), x)
    return {'mails': mails, 'por_id': por_id, 'por_norm': por_norm, 'buzones': buzones,
            'equipo': sorted(set(leidas)), 'esperada': equipo,
            'compartidos': sum(1 for x in mails if len(x['buzones']) > 1)}


def _buscar_id(u, q):
    """Un mail por cualquiera de sus ids; el corto `nube:<hex>` tambien por un prefijo que no se repita."""
    q = _texto(q).strip()
    m = u['por_id'].get(q) or u['por_norm'].get(_idn(q))
    if m or not q.lower().startswith('nube:') or len(q) < 11:
        return m
    hallados = {id(x): x for k, x in u['por_id'].items() if k.lower().startswith(q.lower())}
    return next(iter(hallados.values())) if len(hallados) == 1 else None


def _etiqueta_buzon(m):
    """`Fak` · `cbaptista (nube del equipo)` · `Fak + cbaptista (el mismo mail en 2 buzones)`."""
    b = m['buzones']
    if len(b) > 1:
        return '%s  (el mismo mail en %d buzones)' % (' + '.join(b), len(b))
    return b[0] if b[0] == BUZON_FAK else '%s  (nube del equipo)' % b[0]


def _del_buzon(m, q, buzones):
    """--buzon: el texto esta en el nombre del buzon, en su casilla o en el nombre de su duena/o."""
    q = q.strip().lower()
    for b in m['buzones']:
        i = buzones.get(b, {})
        if q in ' '.join([b, i.get('casilla', ''), i.get('persona', '')]).lower():
            return True
    return False


def _fecha_subida(ts):
    return datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M') if ts else ''


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


def _registro(m, eid, p):
    """El renglon del cache de un mail de Outlook. Lo usan `--sync` y `--nuevos`: una sola forma de guardar un mail."""
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
    return {
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
    }


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
                nuevos.append(_registro(m, eid, p))
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


def _linea_buzones(u, solo_fak):
    """Una linea con cada buzon que se miro y hasta que mail llega: la prueba de que el de Carlos esta (o no)."""
    partes = ['%s %d (hasta %s)' % (b['nombre'], b['total'], b['ultimo'] or 's/f') for b in u['buzones'].values()]
    if solo_fak:
        partes.append('nube del equipo: no miro (--solo-fak)')
    elif not u['equipo']:
        partes.append('nube del equipo: NO la veo en esta PC (python scripts/_mails.py --buzones)')
    return 'buzones: ' + '  |  '.join(partes)


def buscar(terminos, desde=None, hasta=None, carpeta=None, solo_asunto=False, limite=40, buzon=None, solo_fak=False):
    u = _unificar(solo_fak=solo_fak)
    if not u['mails']:
        sys.exit('El cache esta vacio. Corre primero:  python scripts/_mails.py --sync')
    if buzon and not any(_del_buzon(m, buzon, u['buzones']) for m in u['mails']):
        sys.exit('Ningun buzon coincide con "%s". Buzones que puedo leer: %s.  (python scripts/_mails.py --buzones)'
                 % (buzon, ', '.join(u['buzones']) or 'ninguno'))
    ts = [t.lower() for t in terminos]
    hits = []
    for m in u['mails']:
        if buzon and not _del_buzon(m, buzon, u['buzones']):
            continue
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
    n_fak = sum(1 for m in u['mails'] if BUZON_FAK in m['buzones'])
    de_donde = '%d de Fak' % n_fak
    if len(u['mails']) > n_fak:
        de_donde += ' + %d solo del equipo (nube)' % (len(u['mails']) - n_fak)
    print('cache: %s  |  coincidencias: %d%s' % (
        de_donde, len(hits), '  (muestro las ultimas %d)' % limite if len(hits) > limite else ''))
    print(_linea_buzones(u, solo_fak))
    print()
    for m in hits[-limite:]:
        print('[%s]  %s' % (m['fecha'], m['asunto']))
        print('    de: %-30s  carpeta: %s' % (m['de'][:30], m['carpeta']))
        print('    %s: %s' % ('buzones' if len(m['buzones']) > 1 else 'buzon', _etiqueta_buzon(m)))
        if m['para']:
            print('    para: %s' % m['para'][:90])
        if m['adjuntos']:
            print('    ADJUNTOS: %s' % ' | '.join(m['adjuntos']))
        print('    id: %s' % m['id_mostrar'])
        print()


def ver(eid):
    u = _unificar()
    m = _buscar_id(u, eid)
    if not m:
        sys.exit('No encontre ese id en el cache de Fak ni en la nube del equipo.')
    print('=' * 78)
    print('ASUNTO   %s' % m['asunto'])
    print('DE       %s <%s>' % (m['de'], m['de_mail']))
    print('PARA     %s' % m['para'])
    if m['cc']:
        print('CC       %s' % m['cc'])
    print('FECHA    %s' % m['fecha'])
    print('CARPETA  %s' % m['carpeta'])
    print('BUZONES  %s' % _etiqueta_buzon(m))
    if m['adjuntos']:
        print('ADJUNTOS %s%s' % (' | '.join(m['adjuntos']),
                                 '' if m['en_outlook'] else '   (solo los nombres: los archivos no estan en la nube)'))
    print('=' * 78)
    print(m['cuerpo'])


def adjuntos(eid, destino=None):
    u = _unificar()
    m = _buscar_id(u, eid)
    if m is None and (eid.strip().lower().startswith('nube:') or eid.strip().startswith('<')):
        sys.exit('No encontre ese id en el cache de Fak ni en la nube del equipo.')
    if m is not None and not m['en_outlook'] and not m['adjuntos']:
        print('Ese mail (buzon %s, nube del equipo) no tiene adjuntos.' % ' + '.join(m['buzones']))
        return
    if m is not None and not m['en_outlook']:
        # un mail que solo esta en la nube del equipo: el programa que sube los mails guarda los NOMBRES de los adjuntos
        sys.exit('Ese mail es de la nube del equipo (buzon %s) y sus ARCHIVOS no estan en la nube: el programa que sube '
                 'los mails guarda solo los nombres de los adjuntos.\nAdjuntos (solo nombres): %s\n'
                 'Para tenerlos: pedirselos a quien lo recibio, buscar ese nombre en el servidor o en la carpeta de la '
                 'tarea, o abrir el mismo mail en el buzon de Fak si tambien le llego a el. No se escribio nada en %s.'
                 % (' + '.join(m['buzones']), ' | '.join(m['adjuntos']) or '(ninguno)', destino or ADJ))
    if m is not None:
        eid = m['en_outlook']         # mail del buzon de Fak (con el id de Fak o con el de la nube): se saca de su Outlook
    ns = _outlook()
    try:
        m = ns.GetItemFromID(eid)
    except Exception as e:
        sys.exit('No pude abrir ese mail en Outlook: %s' % e)
    destino = destino or os.path.join(ADJ, re.sub(r'[^A-Za-z0-9]', '', eid)[-16:])
    if not os.path.isdir(destino):
        os.makedirs(destino)
    n = 0
    rutas = []
    for k in range(1, m.Attachments.Count + 1):
        a = m.Attachments.Item(k)
        ruta = os.path.join(destino, re.sub(r'[^\w.\- ]', '_', str(a.FileName)))
        a.SaveAsFile(ruta)
        print('  %-45s %9d bytes' % (a.FileName, os.path.getsize(ruta)))
        rutas.append(ruta)
        n += 1
    print('%d adjuntos en %s' % (n, destino))
    return rutas


# ─────────────────────────────────────────── cuatro lecturas mas de Outlook (cola HOY-19a a d, 10/10/2026)
#
# La logica vive en scripts/_lib/mailsLectura.py (se prueba contra un Outlook de mentira). Aca va la consola.

def _vigilado(fn, que):
    """Corre una lectura de Outlook avisando en el momento si Outlook saca su cartel de seguridad (sin esto la corrida
    se queda colgada y muda). Si el modulo del vigia no esta, corre igual."""
    try:
        from outlookUi import vigilando
    except Exception:
        return fn()
    return vigilando(fn, descripcion=que)[0]


def abrir_adjuntos(rutas, lanzar=None):
    """Abre cada adjunto ya extraido con scripts/_abrir.mjs, que confirma que quedo una ventana abierta.
    Devuelve cuantos NO se vieron abiertos; si no habia nada para abrir, lo dice y devuelve 1 (no es un «abierto»).

    Se saltea solo la imagen pegada de una firma, que Outlook nombra `image001.png` (tres cifras) u `Outlook-xxxx.png`.
    `image0.jpeg` es la foto que manda un telefono: esa SI se abre (auditor 10/10: habia 2 mails asi en el cache)."""
    import subprocess

    def con_node(r):
        try:
            return subprocess.call(['node', os.path.join(RAIZ, 'scripts', '_abrir.mjs'), r])
        except OSError as e:
            print('  no pude lanzar scripts/_abrir.mjs (%s). La ruta: %s' % (e, r))
            return 1
    lanzar = lanzar or con_node
    de_firma = re.compile(r'(?i)^(image\d{3}\.(png|jpe?g|gif)|outlook-[\w\-]+\.(png|jpe?g))$')
    abribles = [r for r in rutas if not de_firma.match(os.path.basename(r))]
    if not abribles:
        print('NADA PARA ABRIR: %s. No decirle a Fak que hay algo abierto.'
              % ('el mail no trae adjuntos' if not rutas else 'los %d adjuntos son imagenes de la firma' % len(rutas)))
        return 1
    sin_ver = 0
    for r in abribles:
        if lanzar(r) != 0:
            sin_ver += 1
    return sin_ver


def _outlook_de_la_persona():
    """Outlook para las cuatro lecturas nuevas. Si esta cerrado se lo abre como programa de la persona ANTES de
    conectarse: uno levantado por la automatizacion queda sin ventana y despues traba un envio (regla mail-envio.md).
    Si no se lo puede abrir, se corta aca en vez de dejar un Outlook fantasma."""
    try:
        from outlookUi import asegurar_outlook
    except Exception:
        return _outlook()
    try:
        asegurar_outlook(log=lambda *a: None)
    except Exception as e:
        sys.exit('Outlook esta cerrado y no lo pude abrir (%s). Abrilo y reintenta.' % e)
    return _outlook()


def nuevos(desde=None, como_json=False):
    """`--nuevos`: lo que llego desde el ultimo mail del cache. Los agrega al cache y los lista."""
    previos = _leer_cache()
    if not previos:
        sys.exit('El cache esta vacio: la primera vez va entero.  python scripts/_mails.py --sync')
    if desde:
        try:
            corte = datetime.datetime.strptime(desde, '%Y-%m-%d')
        except ValueError:
            sys.exit('--desde va como AAAA-MM-DD')
    else:
        corte = mailsLectura.corte_desde_cache(m.get('fecha', '') for m in previos.values())
        if corte is None:
            sys.exit('El cache no tiene fechas para saber desde cuando mirar: usar --desde AAAA-MM-DD o --sync.')
    ns = _outlook_de_la_persona()
    lista, info = _vigilado(lambda: mailsLectura.nuevos(ns, previos, corte, _registro), 'la lectura de mails nuevos')
    incompleto = bool(info['topadas'] or info['fallidas'])
    if lista:
        with io.open(MAILS, 'a', encoding='utf-8') as f:
            for m in lista:
                f.write(json.dumps(m, ensure_ascii=False) + '\n')
    try:
        import time
        with io.open(os.path.join(CACHE, 'sync.log'), 'a', encoding='utf-8') as f:
            f.write('%s\tmirados=%d\tnuevos=%d\ttotal=%d\tNUEVOS\tdesde %s\n' % (
                time.strftime('%Y-%m-%d %H:%M'), info['mirados'], len(lista), len(previos) + len(lista),
                corte.strftime('%Y-%m-%d %H:%M')))
    except Exception:
        pass
    if como_json:
        print(json.dumps({'desde': corte.strftime('%Y-%m-%d %H:%M'), 'info': info, 'nuevos': [
            {k: m[k] for k in ('id', 'carpeta', 'fecha', 'de', 'asunto', 'adjuntos')} for m in lista]}, ensure_ascii=False))
        return 0          # con --json el que llama lee info.topadas e info.fallidas
    print('desde                : %s  (el ultimo mail del cache menos %d dias; --desde lo cambia)'
          % (corte.strftime('%Y-%m-%d %H:%M'), mailsLectura.MARGEN_DIAS) if not desde else 'desde                : %s' % desde)
    print('mirados en Outlook   : %d  en %d carpetas de mail' % (info['mirados'], info['carpetas']))
    print('nuevos al cache      : %d' % len(lista))
    print('total en el cache    : %d' % (len(previos) + len(lista)))
    if info['sin_ordenar']:
        print('  (no se dejaron ordenar y se recorrieron enteras: %s)' % ' | '.join(info['sin_ordenar']))
    if info['topadas']:
        print('  *** corte por tope en: %s — para estar seguro: python scripts/_mails.py --sync' % ' | '.join(info['topadas']))
    if info['fallidas']:
        print('  *** NO se pudieron leer: %s — lo que haya ahi no esta en esta lista: python scripts/_mails.py --sync' % ' | '.join(info['fallidas']))
    print()
    for m in lista:
        print('[%s]  %s' % (m['fecha'], m['asunto']))
        print('    de: %-30s  carpeta: %s' % (m['de'][:30], m['carpeta']))
        if m['adjuntos']:
            print('    ADJUNTOS: %s' % ' | '.join(m['adjuntos']))
        print('    id: %s' % m['id'])
        print()
    print('Esto mira solo lo recibido despues de esa fecha, y deja de mirar una carpeta tras %d mails viejos seguidos.' % mailsLectura.RACHA_VIEJOS)
    print('No trae: un mail viejo que nunca entro al cache, ni lo que Outlook todavia no termino de bajar. Eso lo trae --sync.')
    return 2 if incompleto else 0


def abrir(eid):
    """`--abrir <id>`: muestra el mail en Outlook. Sale con 0 si se ve su ventana, 1 si no."""
    u = _unificar()
    m = _buscar_id(u, eid)
    if m is not None and not m['en_outlook']:
        sys.exit('Ese mail es de la nube del equipo (buzon %s): no esta en el Outlook de Fak, asi que no se puede abrir '
                 'ahi. Su texto:  python scripts/_mails.py --ver %s' % (' + '.join(m['buzones']), m['id_mostrar']))
    if m is not None:
        eid = m['en_outlook']
    ns = _outlook_de_la_persona()    # sin una ventana de Outlook de la persona, mostrar un mail se cuelga
    try:
        r = _vigilado(lambda: mailsLectura.abrir(ns, eid), 'la apertura del mail')
    except Exception as e:
        sys.exit('No pude abrir ese mail en Outlook: %s' % e)
    if not r['ventana']:
        print('NO SE VE ABIERTO: [%s] %s — Outlook no muestra una ventana de ese mail. No decirle a Fak que esta abierto.'
              % (r['fecha'], r['asunto']))
        return 1
    print('ABIERTO en Outlook: [%s] %s  (de %s)' % (r['fecha'], r['asunto'], r['de']))
    if r['sin_leer']:
        print('  OJO: estaba SIN LEER y Outlook lo marca como leido al abrirlo, igual que si lo abriera Fak.')
    return 0


def listar_borradores(como_json=False):
    """`--borradores`: solo lista. Mover o borrar un borrador no se hace desde aca (cola HOY-19k, con el si de Fak)."""
    try:
        with io.open(os.path.join(CACHE, 'borradores_claude.json'), encoding='utf-8') as f:
            registro = json.load(f)
    except Exception:
        registro = []
    ns = _outlook_de_la_persona()
    lista = _vigilado(lambda: mailsLectura.borradores(ns, registro), 'la lectura de borradores')
    res = mailsLectura.resumen_borradores(lista)
    if como_json:
        print(json.dumps({'resumen': res, 'borradores': lista}, ensure_ascii=False))
        return 0
    print('BORRADORES DE OUTLOOK: %d  (solo lectura: aca no se mueve ni se borra ninguno)' % res['total'])
    for texto, n in res['tramos']:
        print('  %-20s %3d' % (texto, n))
    print('  con adjuntos: %d  |  armados por un programa del repo: %d  |  con el asunto repetido: %d  |  el mas viejo: %d dias'
          % (res['con_adjuntos'], res['de_programa'], res['repetidos'], res['mas_viejo']))
    print()
    for b in lista:
        marcas = ' '.join(x for x in ('[programa]' if b['de_programa'] else '', '[REPETIDO]' if b['repetido'] else '',
                                      '[%d adj]' % b['adjuntos'] if b['adjuntos'] else '') if x)
        print('  %4s d  %s  %-60s  -> %s  %s' % ('?' if b['dias'] is None else b['dias'], b['modificado'][:10],
                                                 (b['asunto'] or '(sin asunto)')[:60], (b['para'] or '(sin destinatario)')[:40], marcas))
    print()
    print('Un borrador viejo con el asunto de un mail que ya salio se puede mandar por error (regla mail-envio.md).')
    print('Los [programa] los reemplaza solo _prepararMail.py al rehacer el mail; el resto los decide Fak.')
    return 0


def ver_agenda(dias=7, como_json=False):
    """`--agenda`: reuniones de los proximos dias y tareas sin completar. Sale con 2 si el control del filtro da rojo."""
    ns = _outlook_de_la_persona()
    a = _vigilado(lambda: mailsLectura.agenda(ns, dias=dias), 'la lectura del calendario')
    try:                                     # copia para la sesion de la manana; carpeta ignorada por git
        if not os.path.isdir(CACHE):
            os.makedirs(CACHE)
        with io.open(os.path.join(CACHE, 'agenda.json'), 'w', encoding='utf-8') as f:
            json.dump(a, f, ensure_ascii=False)
    except Exception:
        pass
    if como_json:
        print(json.dumps(a, ensure_ascii=False))
        return 0          # con --json el que llama lee control.ok (un codigo distinto de 0 le haria tirar el JSON)
    c = a['control']
    print('AGENDA de Outlook, del %s al %s  (%d dias)' % (a['desde'], a['hasta'], dias))
    if not c['ok']:
        print()
        print('  *** NO CONFIAR EN ESTA AGENDA: %s ***' % c['motivo'])
        print('  filtro usado: %s' % a['filtro'])
    print()
    dia = ''
    for x in a['citas']:
        if x['inicio'][:10] != dia:
            dia = x['inicio'][:10]
            print('  %s' % dia)
        print('     %s-%s  %-55s %s%s%s' % (
            'todo ' if x['todo_el_dia'] else x['inicio'][11:], 'el dia' if x['todo_el_dia'] else x['fin'][11:],
            x['asunto'][:55], ('en ' + x['lugar'][:25] + '  ') if x['lugar'] else '',
            '[se repite] ' if x['se_repite'] else '', '' if x['reunion'] else '[sin invitados]'))
    if not a['citas']:
        print('  (ninguna cita en esos dias)')
    print()
    print('TAREAS de Outlook sin completar: %d' % len(a['tareas']))
    for t in a['tareas']:
        print('     %-60s %s' % (t['asunto'][:60], ('vence %s%s' % (t['vence'], '  VENCIDA' if t['vencida'] else '')) if t['vence'] else 'sin fecha'))
    print()
    print('control del filtro: %s  (citas sueltas contadas a mano en el rango: %d; cita de prueba: %s)'
          % ('ok' if c['ok'] else 'ROJO', c['sueltas_a_mano'], c['sonda']))
    if c['ok'] and c['sonda'] != 'ok':
        print('  OJO: el formato de fecha del filtro quedo SIN COMPROBAR (%s). Si la lista parece corta, desconfiar.' % c['sonda'])
    print('Entra lo que se solapa con el rango (tambien lo de hoy que ya empezo). Es el calendario de Fak; una reunion')
    print('no es una tarea suya. No se leen organizador ni invitados.')
    return 0 if c['ok'] else 2


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


def buzones():
    """Que buzones puedo leer, cuantos mails tiene cada uno y hasta cuando llega. Es la respuesta a "¿puedo leer lo de X?"
    ANTES de decir que no."""
    u = _unificar()
    info = u['buzones']
    print('BUZONES QUE PUEDO LEER (solo lectura)')
    print()
    filas = []
    for b in info.values():
        donde = b['origen']
        if b['subida']:
            donde += ', ultima subida %s' % _fecha_subida(b['subida'])
        filas.append((b['nombre'], b['casilla'] + (' (%s)' % b['persona'] if b['persona'] else ''), '%d' % b['total'],
                      b['ultimo'], donde))
    if BUZON_FAK not in info:
        filas.insert(0, (BUZON_FAK, '', '0', '', 'cache de Fak vacio: python scripts/_mails.py --sync'))
    ancho = max([len(f[1]) for f in filas] + [len('casilla (persona)')])
    for f in [('buzon', 'casilla (persona)', 'mails', 'mail mas nuevo', 'de donde sale')] + filas:
        print('  %-14s %-*s %7s  %-17s  %s' % (f[0], ancho, f[1], f[2], f[3], f[4]))
    print()
    if u['equipo']:
        print('nube del equipo: %s' % '  |  '.join(u['equipo']))
        print('  solo se lee _entrada\\<persona>; la carpeta _cuarentena (lo que el filtro aparto por privado) no se abre nunca.')
        print('  %d mails estan en mas de un buzon y se muestran una sola vez. De la nube NO salen los archivos adjuntos, solo sus nombres.'
              % u['compartidos'])
    else:
        print('nube del equipo: NO la veo en esta PC. La busque en %s\\Ingenieria y Proyecto - General\\*Claude Barack\\mails\\_entrada.'
              % os.path.join(os.path.expanduser('~'), ORGANIZACION))
        print('  Si la carpeta se movio: BARACK_MAIL_EQUIPO=<ruta de la carpeta mails>. Mientras tanto solo tengo el buzon de Fak.')
    print()
    print('Quien no figura aca no comparte sus mails: a Fak se le dice que no esta en la nube, no que no se puede leer.')


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
    ap.add_argument('--buzon', metavar='TEXTO', help='con --buscar: solo los mails de ese buzon (nombre, casilla o persona)')
    ap.add_argument('--solo-fak', action='store_true', help='con --buscar: sin mirar los mails del equipo de la nube')
    ap.add_argument('--buzones', action='store_true', help='que buzones puedo leer, cuantos mails y hasta cuando llega cada uno')
    ap.add_argument('--ver', metavar='ID')
    ap.add_argument('--adjuntos', metavar='ID')
    ap.add_argument('--out', metavar='CARPETA')
    ap.add_argument('--stats', action='store_true')
    ap.add_argument('--selftest', action='store_true', help='probar el detector de sync parcial y el de pedidos sin respuesta (sin Outlook)')
    ap.add_argument('--sin-respuesta', action='store_true', help='pedidos de la Bandeja dirigidos a Fak sin mail suyo en el hilo')
    ap.add_argument('--dias', type=int, default=None, help='con --sin-respuesta: dias sin respuesta para listar (default 5); con --agenda: cuantos dias mostrar (default 7)')
    ap.add_argument('--ventana', type=int, default=45, help='con --sin-respuesta: cuantos dias para atras mirar (default 45)')
    ap.add_argument('--json', action='store_true', help='con --sin-respuesta, --nuevos, --borradores o --agenda: salida JSON')
    ap.add_argument('--nuevos', action='store_true', help='lo que llego desde el ultimo mail del cache, sin recorrer el buzon (--desde lo cambia)')
    ap.add_argument('--abrir', nargs='?', const=True, metavar='ID',
                    help='mostrar ese mail en Outlook (uno sin leer queda leido); con --adjuntos <id>, abrir en pantalla los adjuntos extraidos')
    ap.add_argument('--borradores', action='store_true', help='listar los borradores de Outlook con su edad (solo lectura)')
    ap.add_argument('--agenda', action='store_true', help='reuniones de los proximos dias (--dias, default 7) y tareas sin completar')
    a = ap.parse_args()

    if a.selftest:
        sys.exit(selftest())
    elif a.sync:
        sys.exit(sync(full=a.full))
    elif a.nuevos:
        sys.exit(nuevos(desde=a.desde, como_json=a.json))
    elif a.buscar:
        buscar(a.buscar, a.desde, a.hasta, a.carpeta, a.asunto, a.limite, buzon=a.buzon, solo_fak=a.solo_fak)
    elif a.ver:
        ver(a.ver)
    elif a.adjuntos:
        rutas = adjuntos(a.adjuntos, a.out)
        if a.abrir:
            sys.exit(1 if abrir_adjuntos(rutas or []) else 0)
    elif a.abrir:
        if a.abrir is True:
            ap.error('--abrir va con el id del mail (sale de --buscar), o junto con --adjuntos <id>')
        sys.exit(abrir(a.abrir))
    elif a.borradores:
        sys.exit(listar_borradores(como_json=a.json))
    elif a.agenda:
        sys.exit(ver_agenda(dias=7 if a.dias is None else a.dias, como_json=a.json))
    elif a.stats:
        stats()
    elif a.buzones:
        buzones()
    elif a.sin_respuesta:
        sys.exit(sin_respuesta(dias=5 if a.dias is None else a.dias, ventana=a.ventana, como_json=a.json))
    else:
        ap.print_help()


if __name__ == '__main__':
    main()
