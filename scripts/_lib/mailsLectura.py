# -*- coding: utf-8 -*-
"""
mailsLectura.py — cuatro lecturas de Outlook clasico que usa `scripts/_mails.py` (cola HOY-19a a HOY-19d, 10/10/2026):

    nuevos()       lo que llego desde la ultima lectura, sin recorrer el buzon entero        (_mails.py --nuevos)
    abrir()        mostrar en Outlook un mail que ya existe                                   (_mails.py --abrir <id>)
    borradores()   listar los borradores con su edad, sus adjuntos y quien los armo           (_mails.py --borradores)
    agenda()       reuniones de los proximos dias y tareas de Outlook sin completar           (_mails.py --agenda)

SOLO LECTURA. Nada de aca crea, guarda, mueve, borra ni transmite un item de Outlook. `abrir()` muestra una ventana y
nada mas. Las funciones reciben el `ns` (el espacio MAPI) por parametro: asi el selftest las corre contra un Outlook
de mentira que anota cualquier llamada que escriba, y falla si hay una.

De donde sale cada decision (plan `docs/PLAN_HOY19_SKILLS_FUNCIONES_NUEVAS_2026-10-10.md`, medido el 10/10/2026):
  - `--sync` recorre item por item: 35 s para 3.249 items y 0 nuevos. `nuevos()` ordena cada carpeta de mail por fecha
    de recibido, de la mas nueva a la mas vieja, y corta al pasar el limite: el mismo metodo de
    `tools/claude-area/mails_outlook.ps1`. No usa el filtro por fecha de Outlook, que depende del formato regional.
  - Ese filtro SI hace falta para la agenda (las citas que se repiten solo se expanden filtrando). El 10/10, con la
    fecha escrita mes/dia, «ultimos 30 dias» dio 0 citas y con dia/mes dio 51. Por eso `agenda()` escribe la fecha como
    la escribe Windows en esta PC y, ademas, CONTROLA el resultado contra una cuenta hecha a mano: si no cierra, lo dice
    y no devuelve una agenda en la que no se puede confiar.
  - Outlook entrega las horas como hora de pared local con una etiqueta de zona que no es cierta (regla
    `mail-envio.md`: 3 h corridas si se la toma en serio). Aca toda hora se usa SIN la etiqueta (`_sin_zona`).

    python scripts/_lib/mailsLectura.py --selftest        # sin Outlook
"""
import datetime
import json
import os
import sys

OL_MAIL = 43                 # MailItem.Class
OL_CARPETA_MAIL = 0          # Folder.DefaultItemType de una carpeta de mails
BORRADORES, CALENDARIO, TAREAS = 16, 9, 13      # GetDefaultFolder
MARGEN_DIAS = 2              # cuanto mas atras del ultimo mail del cache mira --nuevos (un mail que tardo en bajar)
TOPE_CARPETA = 5000          # ninguna pasada sigue mas alla de esto en una carpeta
RACHA_VIEJOS = 25            # --nuevos deja de mirar una carpeta ordenada despues de tantos mails viejos seguidos
TOPE_CITAS = 800
SIN_FECHA = 4000             # Outlook usa el anio 4501 para «sin fecha»


def _sin_zona(d):
    """La hora de pared que muestra Outlook, sin la etiqueta de zona (que no es cierta)."""
    try:
        return datetime.datetime(d.year, d.month, d.day, d.hour, d.minute, d.second)
    except Exception:
        return None


def _txt(x):
    return '' if x is None else str(x)


def _hm(d):
    return d.strftime('%Y-%m-%d %H:%M') if d else ''


# ───────────────────────────────────────────────────────────────── --nuevos

def corte_desde_cache(fechas, margen_dias=MARGEN_DIAS):
    """Desde cuando mirar: la fecha del mail mas nuevo del cache, menos un margen. None si el cache no tiene fechas."""
    # un borrador sin enviar puede traer el anio 4501 («sin fecha»): esa fecha no puede mover el corte
    tope_fecha = (datetime.datetime.now() + datetime.timedelta(days=1)).strftime('%Y-%m-%d %H:%M')
    buenas = sorted(f for f in fechas if f and len(f) >= 16 and f[:16] <= tope_fecha)
    if not buenas:
        return None
    try:
        ultimo = datetime.datetime.strptime(buenas[-1][:16], '%Y-%m-%d %H:%M')
    except ValueError:
        return None
    return ultimo - datetime.timedelta(days=margen_dias)


def nuevos(ns, conocidos, corte, registro, tope=TOPE_CARPETA):
    """Los mails recibidos desde `corte` que no estan en `conocidos` (ids del cache).

    Recorre SOLO las carpetas de mails, cada una ordenada de lo mas nuevo a lo mas viejo, y corta en el primer mail
    anterior al corte. Si una carpeta no se deja ordenar, se la recorre entera (como `--sync`) y se anota.
    `registro(mail, id, ruta)` arma el renglon del cache: es la misma funcion que usa `--sync`.

    Devuelve (lista de renglones, info). No escribe nada: el que llama decide si los agrega al cache.
    """
    info = {'carpetas': 0, 'mirados': 0, 'sin_ordenar': [], 'salteadas': 0, 'topadas': [], 'fallidas': []}
    out, vistos = [], set()

    def mails_de(carpeta, p):
        info['carpetas'] += 1
        ordenada = True
        items = carpeta.Items
        try:
            items.Sort('[ReceivedTime]', True)
        except Exception:
            ordenada = False
            info['sin_ordenar'].append(p)
        n = viejos_seguidos = 0
        m = items.GetFirst()
        while m is not None:
            n += 1
            if n > tope:
                info['topadas'].append(p)
                break
            info['mirados'] += 1
            try:
                if int(getattr(m, 'Class', OL_MAIL)) == OL_MAIL:
                    try:
                        rt = _sin_zona(m.ReceivedTime)
                    except Exception:
                        rt = None            # sin fecha legible: se guarda igual, como hace --sync
                    if rt is not None and rt < corte:
                        viejos_seguidos += 1
                        # no se corta en el PRIMER mail viejo: si el orden viene apenas corrido, uno nuevo puede
                        # quedar detras de uno viejo. Se corta despues de una racha.
                        if ordenada and viejos_seguidos >= RACHA_VIEJOS:
                            break
                    else:
                        viejos_seguidos = 0
                        eid = _txt(getattr(m, 'EntryID', ''))
                        if eid and eid not in conocidos and eid not in vistos:
                            vistos.add(eid)
                            out.append(registro(m, eid, p))
            except Exception:
                pass
            m = items.GetNext()

    def rec(carpeta, ruta=''):
        # cada carpeta en su propio intento: una que falla (un archivo desconectado, un buzon sin permiso) se
        # anota y NO corta a sus hermanas ni a sus hijas
        try:
            nombre = _txt(carpeta.Name)
        except Exception:
            nombre = '(carpeta sin nombre)'
        p = (ruta + ' / ' + nombre) if ruta else nombre
        try:
            try:
                tipo = int(carpeta.DefaultItemType)
            except Exception:
                tipo = OL_CARPETA_MAIL
            if tipo == OL_CARPETA_MAIL:
                mails_de(carpeta, p)
            else:
                info['salteadas'] += 1
        except Exception as e:
            info['fallidas'].append('%s (%s)' % (p, str(e)[:60]))
        try:
            hijas = int(carpeta.Folders.Count)
        except Exception as e:
            info['fallidas'].append('%s, sus subcarpetas (%s)' % (p, str(e)[:60]))
            hijas = 0
        for j in range(1, hijas + 1):
            try:
                hija = carpeta.Folders.Item(j)
            except Exception as e:
                info['fallidas'].append('%s, subcarpeta %d (%s)' % (p, j, str(e)[:60]))
                continue
            rec(hija, p)

    for i in range(1, ns.Folders.Count + 1):
        try:
            raiz = ns.Folders.Item(i)
        except Exception as e:
            info['fallidas'].append('buzon %d (%s)' % (i, str(e)[:60]))
            continue
        rec(raiz)
    out.sort(key=lambda r: r.get('fecha') or '')
    return out, info


# ───────────────────────────────────────────────────────────────── --abrir

def abrir(ns, entry_id):
    """Muestra en Outlook un mail que ya existe. No lo guarda, no lo cambia, no lo manda.

    Devuelve {'asunto', 'fecha', 'de', 'sin_leer', 'ventana'}: `sin_leer` es como estaba ANTES de abrirlo (un mail sin
    leer queda marcado como leido cuando se cierra la ventana, igual que si lo abriera la persona) y `ventana` dice si
    despues de mostrarlo hay de verdad una ventana de ese mail (lanzar no es ver abierto).
    """
    it = ns.GetItemFromID(entry_id)
    info = {
        'asunto': _txt(getattr(it, 'Subject', '')),
        'fecha': _hm(_sin_zona(getattr(it, 'ReceivedTime', None))),
        'de': _txt(getattr(it, 'SenderName', '')),
        'sin_leer': bool(getattr(it, 'UnRead', False)),
        'ventana': False,
    }
    it.Display()
    try:
        app = ns.Application
        for i in range(1, app.Inspectors.Count + 1):
            try:
                otro = _txt(app.Inspectors.Item(i).CurrentItem.EntryID)
                es = bool(otro) and (otro == entry_id or bool(ns.CompareEntryIDs(otro, entry_id)))
            except Exception:
                continue
            if es:
                info['ventana'] = True
                break
    except Exception:
        pass
    return info


# ───────────────────────────────────────────────────────────────── --borradores

def clave_asunto(s):
    """'RE: RV: Alta codigo ' -> 'alta codigo' (para ver si dos borradores son del mismo asunto)."""
    t = ' '.join(_txt(s).lower().split())
    while True:
        for pref in ('re:', 'rv:', 'fw:', 'fwd:', 'res:'):
            if t.startswith(pref):
                t = t[len(pref):].strip()
                break
        else:
            return t


def ids_de_registro(registro):
    """Los EntryID de los borradores que armaron los programas (`.mail-cache/borradores_claude.json`)."""
    out = set()
    filas = registro if isinstance(registro, list) else (list(registro.values()) if isinstance(registro, dict) else [])
    for f in filas:
        if isinstance(f, dict):
            e = _txt(f.get('entry_id') or f.get('id')).strip().upper()
            if e:
                out.add(e)
    return out


def borradores(ns, registro=None, hoy=None, tope=TOPE_CARPETA):
    """Los borradores, del mas viejo al mas nuevo: [{id, modificado, dias, asunto, para, adjuntos, de_programa,
    repetido}]. Solo lee. `repetido` = hay otro borrador con el mismo asunto (sin RE:/RV:)."""
    hoy = hoy or datetime.datetime.now()
    propios = ids_de_registro(registro or [])
    items = ns.GetDefaultFolder(BORRADORES).Items
    out = []
    n = 0
    m = items.GetFirst()
    while m is not None and n < tope:
        n += 1
        try:
            mod = _sin_zona(m.LastModificationTime)
            eid = _txt(getattr(m, 'EntryID', ''))
            try:
                adj = int(m.Attachments.Count)
            except Exception:
                adj = 0
            out.append({
                'id': eid,
                'modificado': _hm(mod),
                'dias': (hoy.date() - mod.date()).days if mod else None,       # dias de calendario, no tramos de 24 h
                'asunto': _txt(getattr(m, 'Subject', '')),
                'para': _txt(getattr(m, 'To', '')),
                'adjuntos': adj,
                'de_programa': eid.strip().upper() in propios,
                'repetido': False,
            })
        except Exception:
            pass
        m = items.GetNext()
    cuenta = {}
    for b in out:
        k = clave_asunto(b['asunto'])
        cuenta[k] = cuenta.get(k, 0) + 1
    for b in out:
        b['repetido'] = bool(clave_asunto(b['asunto'])) and cuenta[clave_asunto(b['asunto'])] > 1
    out.sort(key=lambda b: (b['modificado'] or ''))
    return out


TRAMOS = ((0, 1, 'de hoy o de ayer'), (2, 7, 'de 2 a 7 dias'), (8, 30, 'de 8 a 30 dias'),
          (31, 90, 'de 31 a 90 dias'), (91, 10 ** 6, 'de mas de 90 dias'))


def resumen_borradores(lista):
    """{'total', 'tramos': [(texto, cantidad)], 'con_adjuntos', 'de_programa', 'repetidos', 'mas_viejo'}."""
    dias = [b['dias'] for b in lista if b['dias'] is not None]
    return {
        'total': len(lista),
        'tramos': [(t, sum(1 for d in dias if a <= d <= b)) for a, b, t in TRAMOS],
        'con_adjuntos': sum(1 for b in lista if b['adjuntos']),
        'de_programa': sum(1 for b in lista if b['de_programa']),
        'repetidos': sum(1 for b in lista if b['repetido']),
        'mas_viejo': max(dias) if dias else 0,
    }


# ───────────────────────────────────────────────────────────────── --agenda

def fecha_regional(d):
    """La fecha como la escribe Windows en esta PC (formato corto) mas la hora en 24 h: es lo que entiende el filtro
    de Outlook. Si no se puede preguntar a Windows, dia/mes/anio (el de esta PC, medido el 10/10/2026)."""
    try:
        import ctypes

        class _ST(ctypes.Structure):
            _fields_ = [(n, ctypes.c_uint16) for n in ('y', 'm', 'dow', 'd', 'h', 'mi', 's', 'ms')]
        st = _ST(d.year, d.month, 0, d.day, d.hour, d.minute, 0, 0)
        buf = ctypes.create_unicode_buffer(80)
        if ctypes.windll.kernel32.GetDateFormatW(0x0400, 0x1, ctypes.byref(st), None, buf, 80) and buf.value:
            return '%s %02d:%02d' % (buf.value, d.hour, d.minute)
    except Exception:
        pass
    return d.strftime('%d/%m/%Y %H:%M')


def _cita(x):
    ini = _sin_zona(x.Start)
    fin = _sin_zona(getattr(x, 'End', None))
    return {
        'inicio': _hm(ini), 'fin': _hm(fin),
        'asunto': _txt(getattr(x, 'Subject', '')),
        'lugar': _txt(getattr(x, 'Location', '')),
        'se_repite': bool(getattr(x, 'IsRecurring', False)),
        'reunion': int(getattr(x, 'MeetingStatus', 0) or 0) != 0,
        'todo_el_dia': bool(getattr(x, 'AllDayEvent', False)),
    }


def _sueltas(carpeta):
    """[(inicio, fin, asunto)] de las citas que NO se repiten, leidas sin filtro, y si se llego al tope."""
    out, k = [], 0
    planas = carpeta.Items
    y = planas.GetFirst()
    while y is not None and k < TOPE_CARPETA:
        k += 1
        try:
            if not bool(getattr(y, 'IsRecurring', False)):
                ini = _sin_zona(y.Start)
                if ini is not None and ini.year < SIN_FECHA:
                    out.append((ini, _sin_zona(getattr(y, 'End', None)) or ini, _txt(getattr(y, 'Subject', ''))))
        except Exception:
            pass
        y = planas.GetNext()
    return out, (y is not None and k >= TOPE_CARPETA)


def _sondear(carpeta, sueltas, formato):
    """¿El filtro, con ESTE formato de fecha, devuelve una cita que se sabe que esta?  -> 'ok' | 'falla' | 'sin ...'

    Se pide el DIA de una cita suelta (de 00:00 a 23:59) y tiene que volver. La cita se elige con el dia distinto
    del mes: con dia y mes cruzados, ese dia se lee como OTRA fecha (o como ninguna, si el dia pasa de 12) y la cita no
    vuelve. Una fecha como 10/10 no sirve de prueba (cruzada se lee igual) y no se usa."""
    utiles = sorted((s for s in sueltas if s[0].day != s[0].month), key=lambda s: s[0])
    if not utiles:
        return 'sin citas sueltas para probar', None
    ini, _fin, asunto = utiles[-1]
    a = ini.replace(hour=0, minute=0, second=0)
    b = ini.replace(hour=23, minute=59, second=0)
    try:
        prueba = carpeta.Items.Restrict("[Start] >= '%s' AND [Start] <= '%s'" % (formato(a), formato(b)))
        z = prueba.GetFirst()
        k = 0
        while z is not None and k < TOPE_CITAS:
            k += 1
            try:
                if _sin_zona(z.Start) == ini and _txt(getattr(z, 'Subject', '')) == asunto:
                    return 'ok', ini
            except Exception:
                pass
            z = prueba.GetNext()
    except Exception:
        pass
    return 'falla', ini


def agenda(ns, dias=7, hoy=None, formato=fecha_regional):
    """Citas desde `hoy` hasta `dias` dias despues (con las que se repiten) y tareas de Outlook sin completar.

    Entra todo lo que se SOLAPA con el rango: tambien la reunion que ya empezo y sigue, y la cita de todo el dia de
    hoy (el filtro pide «termina despues de ahora y empieza antes del final», no «empieza despues de ahora»).
    No lee organizador ni invitados (es lo que puede sacar el cartel de seguridad de Outlook).

    Devuelve {'desde', 'hasta', 'filtro', 'citas', 'tareas', 'control': {'ok', 'motivo', 'sueltas_a_mano', 'fuera',
    'sonda'}}. El control tiene dos partes. La cuenta a mano: toda cita SUELTA (que no se repite) que se solapa con el
    rango tiene que estar en lo que devolvio el filtro, tantas veces como este, y nada de lo devuelto puede caer fuera.
    Y la sonda (`_sondear`), porque un rango sin citas sueltas no prueba nada. Con `ok` en falso la agenda no sirve; con
    la sonda en «sin citas sueltas para probar» el formato de fecha quedo SIN comprobar y la salida lo dice.
    """
    hoy = hoy or datetime.datetime.now()
    hasta = hoy + datetime.timedelta(days=dias)
    un_min = datetime.timedelta(minutes=1)
    carpeta = ns.GetDefaultFolder(CALENDARIO)
    filtro = "[End] >= '%s' AND [Start] <= '%s'" % (formato(hoy), formato(hasta))

    citas, fuera, n, motivo = [], 0, 0, ''
    try:
        items = carpeta.Items
        items.Sort('[Start]')
        items.IncludeRecurrences = True
        r = items.Restrict(filtro)
        x = r.GetFirst()
        while x is not None and n < TOPE_CITAS:
            n += 1
            try:
                ini = _sin_zona(x.Start)
                fin = _sin_zona(getattr(x, 'End', None)) or ini
                if ini is None or ini > hasta + un_min or fin < hoy - un_min:
                    fuera += 1
                citas.append(_cita(x))
            except Exception:
                pass
            x = r.GetNext()
    except Exception as e:
        motivo = 'Outlook no acepto el filtro (%s)' % str(e)[:80]

    sueltas, topado = _sueltas(carpeta)
    a_mano = [(_hm(i), s) for i, f, s in sueltas if i <= hasta and f >= hoy]
    cuenta = {}
    for c in citas:
        cuenta[(c['inicio'], c['asunto'])] = cuenta.get((c['inicio'], c['asunto']), 0) + 1
    faltan = 0
    for m in a_mano:                              # cada suelta consume una de las devueltas: dos iguales piden dos
        if cuenta.get(m, 0) > 0:
            cuenta[m] -= 1
        else:
            faltan += 1
    sonda, _cual = _sondear(carpeta, sueltas, formato)

    if motivo:
        pass
    elif sonda == 'falla':
        motivo = 'el filtro no devuelve una cita que se sabe que esta (la del %s): el formato de fecha no es el de esta PC' % _hm(_cual)
    elif fuera:
        motivo = '%d cita(s) de las que devolvio el filtro caen fuera del rango pedido' % fuera
    elif faltan:
        motivo = '%d cita(s) suelta(s) del rango no estan en lo que devolvio el filtro' % faltan
    elif n >= TOPE_CITAS:
        motivo = 'el filtro devolvio %d citas o mas: no parece un rango de %d dias' % (TOPE_CITAS, dias)
    elif topado:
        motivo = 'el calendario tiene mas de %d items: la cuenta a mano quedo cortada y no sirve de control' % TOPE_CARPETA

    tareas = []
    try:
        ts = ns.GetDefaultFolder(TAREAS).Items
        t = ts.GetFirst()
        j = 0
        while t is not None and j < TOPE_CARPETA:
            j += 1
            try:
                if not bool(getattr(t, 'Complete', False)):
                    v = _sin_zona(getattr(t, 'DueDate', None))
                    vence = _hm(v)[:10] if v and v.year < SIN_FECHA else ''
                    # vence HOY no es vencida: se compara el dia, no la hora
                    tareas.append({'asunto': _txt(getattr(t, 'Subject', '')), 'vence': vence,
                                   'vencida': bool(vence) and v.date() < hoy.date()})
            except Exception:
                pass
            t = ts.GetNext()
    except Exception:
        pass

    citas.sort(key=lambda c: c['inicio'])
    return {'desde': _hm(hoy), 'hasta': _hm(hasta), 'filtro': filtro, 'citas': citas, 'tareas': tareas,
            'control': {'ok': not motivo, 'motivo': motivo, 'sueltas_a_mano': len(a_mano), 'fuera': fuera, 'sonda': sonda}}


# ───────────────────────────────────────────────────────────────── Outlook de mentira (selftest)

ESCRITURAS = ('Save', 'Send', 'Delete', 'Move', 'Copy', 'Reply', 'ReplyAll', 'Forward', 'SaveAs', 'Close')
# Lo UNICO que las cuatro funciones pueden pedirle a un item. Cualquier otro nombre (MarkAsTask, Respond, PrintOut,
# Recipients, PropertyAccessor...) queda anotado como «desconocido» y el selftest falla: lista blanca, no lista negra.
LECTURAS = frozenset((
    'Class', 'EntryID', 'ReceivedTime', 'Subject', 'SenderName', 'UnRead', 'LastModificationTime', 'To', 'Attachments',
    'Start', 'End', 'Location', 'IsRecurring', 'MeetingStatus', 'AllDayEvent', 'Complete', 'DueDate', 'Display'))
# Lo unico que pueden pedirle a una coleccion de items o a una carpeta.
LECTURAS_COLECCION = frozenset(('Count', 'Item', 'Sort', 'GetFirst', 'GetNext', 'Restrict', 'IncludeRecurrences',
                                'Name', 'Items', 'Folders', 'DefaultItemType'))


class _Item(object):
    """Un item de mentira. Cualquier metodo que escriba, cualquier asignacion y cualquier nombre que no sea una de las
    LECTURAS queda anotado en `bitacora` (y el selftest falla)."""

    def __init__(self, bitacora, **campos):
        self.__dict__['_b'] = bitacora
        self.__dict__['_c'] = dict(campos)

    def __getattr__(self, nombre):
        if nombre in ESCRITURAS:
            def anotar(*a, **k):
                self._b.append((nombre, self._c.get('EntryID', '')))
            return anotar
        if nombre not in LECTURAS:
            self._b.append(('desconocido ' + nombre, self._c.get('EntryID', '')))
            raise AttributeError(nombre)
        if nombre == 'Display':
            def mostrar(*a, **k):
                self._b.append(('Display', self._c.get('EntryID', '')))
                self._c['_abierto'] = True
            return mostrar
        if nombre in self._c:
            v = self._c[nombre]
            if isinstance(v, Exception):
                raise v
            return v
        raise AttributeError(nombre)

    def __setattr__(self, nombre, valor):          # asignar un campo de un item ES escribir
        self._b.append(('asignar ' + nombre, self._c.get('EntryID', '')))


class _Vigilada(object):
    """Base de las colecciones y carpetas de mentira: pedirles algo que no es de lectura queda anotado."""

    def __getattr__(self, nombre):
        if nombre.startswith('_'):
            raise AttributeError(nombre)
        b = self.__dict__.get('_b')
        if b is not None and nombre not in LECTURAS_COLECCION:
            b.append(('desconocido en coleccion ' + nombre, ''))
        raise AttributeError(nombre)


class _Adjuntos(object):
    def __init__(self, n):
        self.Count = n


class _Items(_Vigilada):
    def __init__(self, lista, bitacora, regional='%d/%m/%Y %H:%M', ordenable=True, expandir=None, tira=False):
        self._l, self._b, self._reg, self._ord, self._exp = list(lista), bitacora, regional, ordenable, expandir
        self._tira = tira
        self._i = 0
        self.IncludeRecurrences = False

    @property
    def Count(self):
        return len(self._l)

    def Item(self, i):
        return self._l[i - 1]

    def Sort(self, campo, descendente=False):
        if not self._ord:
            raise RuntimeError('esta carpeta no se deja ordenar')
        k = campo.strip('[]')
        self._l.sort(key=lambda x: _sin_zona(getattr(x, k)) or datetime.datetime.min, reverse=bool(descendente))

    def GetFirst(self):
        if self._tira is True:
            raise RuntimeError('esta carpeta no se puede leer')
        self._i = 0
        return self._l[0] if self._l else None

    def GetNext(self):
        self._i += 1
        return self._l[self._i] if self._i < len(self._l) else None

    def Restrict(self, filtro):
        """Como Outlook: lee cada fecha del filtro CON SU formato regional. Si viene escrita en otro formato la
        entiende mal y devuelve otra cosa sin avisar (la trampa medida el 10/10), o directamente no la entiende:
        ahi devuelve nada, o tira si `tira` (no se sabe cual de las dos hace el Outlook real: se prueban las dos)."""
        import re
        clausulas = re.findall(r"\[(\w+)\]\s*(>=|<=)\s*'([^']+)'", filtro)
        try:
            leidas = [(c, op, datetime.datetime.strptime(f, self._reg)) for c, op, f in clausulas]
        except ValueError:
            if self._tira == 'restrict':
                raise RuntimeError('no se puede analizar la condicion')
            return _Items([], self._b)
        fechas = [f for _, _, f in leidas]
        base = self._exp(min(fechas), max(fechas)) if (self.IncludeRecurrences and self._exp) else self._l

        def pasa(x):
            for campo, op, f in leidas:
                v = _sin_zona(getattr(x, campo))
                if v is None or (op == '>=' and not v >= f) or (op == '<=' and not v <= f):
                    return False
            return True
        return _Items([x for x in base if pasa(x)], self._b)


class _Carpeta(_Vigilada):
    """Cada vez que se le piden los Items devuelve una coleccion NUEVA, como Outlook: ordenar una y recorrer otra
    (`carpeta.Items.Sort(...)` y despues `carpeta.Items.GetFirst()`) no anda, y aca tampoco."""

    def __init__(self, nombre, items, hijas=(), tipo=OL_CARPETA_MAIL, bitacora=None):
        self.Name, self._items, self.DefaultItemType = nombre, items, tipo
        self.Folders = _Lista(list(hijas))
        self._b = bitacora if bitacora is not None else getattr(items, '_b', None)

    @property
    def Items(self):
        if isinstance(self._items, Exception):
            raise self._items
        i = self._items
        return _Items(i._l, i._b, i._reg, i._ord, i._exp, i._tira)


class _Lista(object):
    def __init__(self, l):
        self._l = l

    @property
    def Count(self):
        return len(self._l)

    def Item(self, i):
        return self._l[i - 1]


class _Inspector(object):
    def __init__(self, item):
        self.CurrentItem = item


class _App(object):
    def __init__(self, ns):
        self._ns = ns

    @property
    def Inspectors(self):
        return _Lista([_Inspector(x) for x in self._ns._todos if x._c.get('_abierto')])


class OutlookFalso(object):
    def __init__(self, raices, especiales=None, todos=()):
        self.Folders = _Lista(list(raices))
        self._esp = especiales or {}
        self._todos = list(todos)
        self.Application = _App(self)

    def GetDefaultFolder(self, n):
        return self._esp[n]

    def GetItemFromID(self, eid):
        for x in self._todos:
            if x._c.get('EntryID') == eid:
                return x
        raise RuntimeError('no existe ese item')

    def CompareEntryIDs(self, a, b):
        return a == b


class _ZonaFalsa(datetime.tzinfo):
    """La etiqueta de zona que pone pywin32: dice UTC y la hora es la de pared."""

    def utcoffset(self, d):
        return datetime.timedelta(0)

    def dst(self, d):
        return datetime.timedelta(0)


def _f(texto):
    return datetime.datetime.strptime(texto, '%Y-%m-%d %H:%M').replace(tzinfo=_ZonaFalsa())


def selftest():
    fallas = []

    def chk(nombre, obtenido, esperado):
        ok = obtenido == esperado
        print('  %s %s%s' % ('ok ' if ok else 'MAL', nombre, '' if ok else '   obtenido=%r esperado=%r' % (obtenido, esperado)))
        if not ok:
            fallas.append(nombre)

    B = []                                   # la bitacora de TODO el selftest
    reg = lambda m, eid, p: {'id': eid, 'carpeta': p, 'fecha': _hm(_sin_zona(m.ReceivedTime)), 'asunto': m.Subject}

    def mail(eid, fecha, asunto='x', clase=OL_MAIL, **mas):
        return _Item(B, EntryID=eid, ReceivedTime=_f(fecha), Subject=asunto, Class=clase, **mas)

    print('selftest de mailsLectura (Outlook de mentira):')
    # ── nuevos
    entrada = [mail('E1', '2026-10-01 09:00'), mail('E2', '2026-10-09 23:30'), mail('E3', '2026-10-10 08:00'),
               mail('E4', '2026-10-10 20:10'), mail('E5', '2026-09-01 10:00'),
               _Item(B, EntryID='R1', ReceivedTime=_f('2026-10-10 12:00'), Subject='convocatoria', Class=53)]
    enviados = [mail('S1', '2026-10-10 19:00'), mail('S2', '2026-08-01 10:00')]
    rota = [mail('D1', '2026-07-01 10:00'), mail('D2', '2026-10-10 21:00')]
    cal = _Carpeta('Calendario', _Items([mail('C1', '2026-10-10 10:00')], B), tipo=1)
    raiz = _Carpeta('f.santoro@x', _Items([], B), hijas=[
        _Carpeta('Bandeja de entrada', _Items(entrada, B)), _Carpeta('Elementos enviados', _Items(enviados, B)),
        _Carpeta('Problemas', _Items(rota, B, ordenable=False)), cal])
    ns = OutlookFalso([raiz])
    corte = datetime.datetime(2026, 10, 8, 20, 0)
    lista, info = nuevos(ns, {'E3'}, corte, reg)
    chk('nuevos: trae lo posterior al corte que no esta en el cache, en orden de fecha',
        [r['id'] for r in lista], ['E2', 'S1', 'E4', 'D2'])
    chk('nuevos: una convocatoria (no es mail) y el calendario no entran', ('R1' in [r['id'] for r in lista], info['salteadas']), (False, 1))
    chk('nuevos: sin fallas ni topes en un buzon sano', (info['fallidas'], info['topadas']), ([], []))
    # la racha: 3 nuevos, 60 viejos y, perdido detras de 10 viejos, uno nuevo (un orden apenas corrido)
    larga = [mail('N%d' % i, '2026-10-10 1%d:00' % i) for i in range(3)] + \
            [mail('V%d' % i, '2026-09-01 10:00') for i in range(60)]
    desordenada = _Items(larga, B)
    desordenada.Sort = lambda *a, **k: None          # un Outlook cuyo Sort no tira pero tampoco ordena
    desordenada._l = larga[:3] + larga[3:13] + [mail('PERDIDO', '2026-10-10 15:00')] + larga[13:]
    carp = _Carpeta('Bandeja de entrada', desordenada)
    carp.__class__ = type('_CarpetaFija', (_Carpeta,), {'Items': property(lambda s: desordenada)})
    l3, i3 = nuevos(OutlookFalso([_Carpeta('raiz', _Items([], B), hijas=[carp])]), set(), corte, reg)
    chk('nuevos: un mail nuevo detras de 10 viejos igual entra (no corta en el primer viejo)', 'PERDIDO' in [r['id'] for r in l3], True)
    chk('nuevos: y deja de mirar despues de %d viejos seguidos (mira 39 de 64)' % RACHA_VIEJOS, i3['mirados'], 3 + 10 + 1 + RACHA_VIEJOS)
    # carpetas anidadas, una que no se puede leer en el medio, y un mail sin fecha legible
    nieta = _Carpeta('Clientes', _Items([mail('G1', '2026-10-10 11:00')], B))
    rota2 = _Carpeta('Archivo desconectado', _Items([mail('X1', '2026-10-10 11:00')], B, tira=True))
    hermana = _Carpeta('Proyectos', _Items([mail('H1', '2026-10-10 12:00'), _Item(B, EntryID='SF', ReceivedTime=RuntimeError('sin fecha'), Subject='s', Class=OL_MAIL)], B), hijas=[nieta])
    ns_b = OutlookFalso([_Carpeta('buzon', _Items([], B), hijas=[rota2, hermana])])
    reg2 = lambda m, eid, p: {'id': eid, 'carpeta': p, 'fecha': ''}
    l4, i4 = nuevos(ns_b, set(), corte, reg2)
    chk('nuevos: una carpeta que no se puede leer NO corta a su hermana ni a la nieta', sorted(r['id'] for r in l4), ['G1', 'H1', 'SF'])
    chk('nuevos: y queda anotada', [f.split(' (')[0] for f in i4['fallidas']], ['buzon / Archivo desconectado'])
    chk('nuevos: la nieta sale con su ruta entera', [r['carpeta'] for r in l4 if r['id'] == 'G1'], ['buzon / Proyectos / Clientes'])
    l5, i5 = nuevos(ns, set(), corte, reg, tope=2)
    chk('nuevos: el tope se anota por carpeta', i5['topadas'], ['f.santoro@x / Bandeja de entrada'])
    chk('nuevos: la carpeta que no se deja ordenar se recorre entera y se anota', info['sin_ordenar'], ['f.santoro@x / Problemas'])
    chk('nuevos: el renglon sale con la ruta de la carpeta', lista[0]['carpeta'], 'f.santoro@x / Bandeja de entrada')
    # la hora: Outlook dice 23:30 «UTC» y es 23:30 de pared. Con el corte a las 22:00 del 09/10 entra; si la etiqueta
    # se tomara en serio (23:30 UTC = 20:30 de Argentina) quedaria afuera.
    lista2, _ = nuevos(ns, set(), datetime.datetime(2026, 10, 9, 22, 0), reg)
    chk('nuevos: la hora se compara como hora de pared, sin correr 3 h', 'E2' in [r['id'] for r in lista2], True)
    chk('ROJO nuevos: con todo ya en el cache no trae nada', nuevos(ns, {'E2', 'E3', 'E4', 'S1', 'D2'}, corte, reg)[0], [])
    chk('corte_desde_cache: el mail mas nuevo menos 2 dias', corte_desde_cache(['2026-10-01 09:00', '', '2026-10-10 20:43']),
        datetime.datetime(2026, 10, 8, 20, 43))
    chk('corte_desde_cache: sin fechas no hay corte', corte_desde_cache(['', None]), None)
    chk('ROJO corte_desde_cache: un borrador con anio 4501 no mueve el corte',
        corte_desde_cache(['2026-10-01 09:00', '4501-01-01 00:00']), datetime.datetime(2026, 9, 29, 9, 0))

    # ── abrir
    leido = mail('A1', '2026-10-05 10:00', 'BOM IP Pad', SenderName='Carlos', UnRead=False)
    sin_leer = mail('A2', '2026-10-06 10:00', 'Otro', SenderName='Pablo', UnRead=True)
    ns2 = OutlookFalso([], todos=[leido, sin_leer])
    antes = len(B)
    r = abrir(ns2, 'A1')
    chk('abrir: muestra el mail y ve su ventana', (r['asunto'], r['sin_leer'], r['ventana']), ('BOM IP Pad', False, True))
    chk('abrir: lo unico que le hizo al mail fue mostrarlo', B[antes:], [('Display', 'A1')])
    chk('abrir: avisa que estaba sin leer', abrir(ns2, 'A2')['sin_leer'], True)
    try:
        abrir(ns2, 'NO-EXISTE')
        chk('ROJO abrir: un id que no existe tira', 'no tiro', 'tira')
    except RuntimeError:
        chk('ROJO abrir: un id que no existe tira', 'tira', 'tira')

    # ── borradores
    hoy = datetime.datetime(2026, 10, 10, 21, 0)

    def borr(eid, mod, asunto, adj=0, para='Carlos Baptista'):
        return _Item(B, EntryID=eid, LastModificationTime=_f(mod), Subject=asunto, To=para, Attachments=_Adjuntos(adj))

    bs = [borr('B1', '2026-10-09 10:00', 'RE: BOM IP Pad', 1), borr('B2', '2024-06-01 10:00', 'Viejo', 2),
          borr('B3', '2026-10-01 09:00', 'BOM IP Pad'), borr('B4', '2026-08-20 10:00', 'RV: Otro tema'),
          borr('B5', '2026-10-10 20:00', '')]
    ns3 = OutlookFalso([], especiales={BORRADORES: _Carpeta('Borradores', _Items(bs, B))})
    lb = borradores(ns3, registro=[{'entry_id': 'b1', 'clave': 'bom ip pad'}], hoy=hoy)
    chk('borradores: del mas viejo al mas nuevo', [b['id'] for b in lb], ['B2', 'B4', 'B3', 'B1', 'B5'])
    chk('borradores: la edad en dias', [b['dias'] for b in lb], [861, 51, 9, 1, 0])
    chk('borradores: los del mismo asunto (sin RE:) salen como repetidos; uno sin asunto, no',
        [b['id'] for b in lb if b['repetido']], ['B3', 'B1'])
    chk('borradores: el del registro de los programas se reconoce aunque cambie la caja del id',
        [b['id'] for b in lb if b['de_programa']], ['B1'])
    res = resumen_borradores(lb)
    chk('borradores: el resumen por edad', [n for _, n in res['tramos']], [2, 0, 1, 1, 1])
    chk('borradores: con adjuntos, de un programa, repetidos y el mas viejo',
        (res['con_adjuntos'], res['de_programa'], res['repetidos'], res['mas_viejo']), (2, 1, 2, 861))
    chk('clave_asunto saca RE: y RV: anidados', clave_asunto('RE: RV:  Alta   codigo '), 'alta codigo')

    # ── agenda
    def cita(inicio, asunto, repite=False, reunion=1, eid=None):
        d = _f(inicio)
        return _Item(B, EntryID=eid or asunto, Start=d, End=d + datetime.timedelta(hours=1), Subject=asunto,
                     Location='Sala', IsRecurring=repite, MeetingStatus=reunion, AllDayEvent=False)

    sueltas = [cita('2026-10-12 10:00', 'Reunion AMFE'), cita('2026-11-05 09:00', 'Lejana'),
               cita('2026-08-01 09:00', 'Vieja'), cita('2026-10-11 08:00', 'Medico', reunion=0)]
    maestra = cita('2026-01-05 09:00', 'Asaichi', repite=True)

    def expandir(a, b):                       # una serie diaria a las 09:00
        out = list(sueltas)
        d = (a - datetime.timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
        while d <= b:                         # el recorte fino lo hace el filtro, como en Outlook
            out.append(cita(d.strftime('%Y-%m-%d %H:%M'), 'Asaichi', repite=True))
            d += datetime.timedelta(days=1)
        return out

    tareas = [_Item(B, Subject='Pasar tiempos', Complete=False, DueDate=_f('2026-10-08 00:00')),
              _Item(B, Subject='Hecha', Complete=True, DueDate=_f('2026-10-01 00:00')),
              _Item(B, Subject='Sin fecha', Complete=False, DueDate=datetime.datetime(4501, 1, 1))]

    def outlook_con(regional):
        return OutlookFalso([], especiales={
            CALENDARIO: _CarpetaCal(sueltas + [maestra], B, regional, expandir),
            TAREAS: _Carpeta('Tareas', _Items(tareas, B))})

    dia_mes = lambda d: d.strftime('%d/%m/%Y %H:%M')
    mes_dia = lambda d: d.strftime('%m/%d/%Y %H:%M')
    hoy2 = datetime.datetime(2026, 10, 10, 21, 0)
    ag = agenda(outlook_con('%d/%m/%Y %H:%M'), dias=7, hoy=hoy2, formato=dia_mes)
    chk('agenda: control verde con el formato de la PC', (ag['control']['ok'], ag['control']['sueltas_a_mano']), (True, 2))
    chk('agenda: las citas del rango, en orden, con las repeticiones de la serie',
        [(c['inicio'], c['asunto']) for c in ag['citas']][:4],
        [('2026-10-11 08:00', 'Medico'), ('2026-10-11 09:00', 'Asaichi'), ('2026-10-12 09:00', 'Asaichi'), ('2026-10-12 10:00', 'Reunion AMFE')])
    chk('agenda: 7 repeticiones y 2 sueltas', len(ag['citas']), 9)
    chk('agenda: una cita personal no es reunion', [c['reunion'] for c in ag['citas'] if c['asunto'] == 'Medico'], [False])
    chk('agenda: tareas sin completar, con su vencimiento', [(t['asunto'], t['vence'], t['vencida']) for t in ag['tareas']],
        [('Pasar tiempos', '2026-10-08', True), ('Sin fecha', '', False)])
    # ROJO: la PC lee dia/mes y le escriben mes/dia. 10/10 se lee igual, pero el 17/10 se escribe «10/17», que no es
    # una fecha valida en dia/mes: Outlook devuelve otra cosa. El control lo tiene que ver.
    rojo = agenda(outlook_con('%d/%m/%Y %H:%M'), dias=7, hoy=hoy2, formato=mes_dia)
    chk('ROJO agenda: con la fecha en el formato equivocado el control da rojo', rojo['control']['ok'], False)
    # ROJO 2: fecha que SI se deja leer al reves (05/10 -> 10 de mayo): devuelve citas de otro rango o ninguna
    hoy3 = datetime.datetime(2026, 10, 5, 8, 0)
    rojo2 = agenda(outlook_con('%d/%m/%Y %H:%M'), dias=6, hoy=hoy3, formato=mes_dia)
    chk('ROJO agenda: dia y mes cruzados (05/10 leido como 10 de mayo) tambien da rojo', rojo2['control']['ok'], False)
    # ROJO 3: el caso de esta PC el 10/10 (ninguna cita suelta en el rango). «13/10» escrito mes/dia no es una fecha:
    # el filtro devuelve nada, y nada tambien es lo que hay de sueltas. Solo la sonda lo ve.
    hoy4 = datetime.datetime(2026, 10, 13, 8, 0)
    rojo3 = agenda(outlook_con('%d/%m/%Y %H:%M'), dias=7, hoy=hoy4, formato=mes_dia)
    chk('ROJO agenda: sin citas sueltas en el rango, la sonda ve el formato equivocado',
        (rojo3['control']['ok'], rojo3['control']['sueltas_a_mano'], rojo3['control']['sonda']), (False, 0, 'falla'))
    verde3 = agenda(outlook_con('%d/%m/%Y %H:%M'), dias=7, hoy=hoy4, formato=dia_mes)
    chk('agenda: el mismo rango con el formato bueno da verde y trae la serie', (verde3['control']['ok'], verde3['control']['sonda'], len(verde3['citas'])), (True, 'ok', 7))
    chk('agenda: una PC que lee mes/dia, con la fecha en mes/dia, tambien da verde',
        agenda(outlook_con('%m/%d/%Y %H:%M'), dias=7, hoy=hoy2, formato=mes_dia)['control']['ok'], True)
    # lo que ya empezo: a las 09:10 del 12/10 la serie de las 09:00 esta en curso y hay una cita de todo el dia
    todo_el_dia = _Item(B, EntryID='TD', Start=_f('2026-10-12 00:00'), End=_f('2026-10-13 00:00'), Subject='Feriado puente',
                        Location='', IsRecurring=False, MeetingStatus=0, AllDayEvent=True)
    sueltas.append(todo_el_dia)
    curso = agenda(outlook_con('%d/%m/%Y %H:%M'), dias=1, hoy=datetime.datetime(2026, 10, 12, 9, 10), formato=dia_mes)
    chk('agenda: entra la reunion que ya empezo y sigue, y la de todo el dia de hoy',
        [(c['inicio'][11:], c['asunto']) for c in curso['citas']],
        [('00:00', 'Feriado puente'), ('09:00', 'Asaichi'), ('10:00', 'Reunion AMFE'), ('09:00', 'Asaichi')])
    chk('agenda: y el control las cuenta (2 sueltas a mano, verde)', (curso['control']['ok'], curso['control']['sueltas_a_mano']), (True, 2))
    sueltas.remove(todo_el_dia)
    # dos citas sueltas iguales (mismo asunto, misma hora): si el filtro devuelve una sola, falta una
    gemela = cita('2026-10-12 10:00', 'Reunion AMFE', eid='GEMELA')
    sueltas.append(gemela)
    doble = agenda(outlook_con('%d/%m/%Y %H:%M'), dias=7, hoy=hoy2, formato=dia_mes)
    chk('agenda: dos citas iguales se cuentan dos veces', (doble['control']['ok'], doble['control']['sueltas_a_mano']), (True, 3))
    cal_que_pierde = outlook_con('%d/%m/%Y %H:%M')
    cal_que_pierde._esp[CALENDARIO] = _CarpetaCal(sueltas + [maestra], B, '%d/%m/%Y %H:%M',
                                                  lambda a, b: [x for x in expandir(a, b) if x is not gemela])
    chk('ROJO agenda: si el filtro devuelve una de las dos iguales, el control lo ve',
        agenda(cal_que_pierde, dias=7, hoy=hoy2, formato=dia_mes)['control']['ok'], False)
    sueltas.remove(gemela)
    # la sonda no se deja enganiar por una fecha como 10/10 (cruzada se lee igual): usa otra, o dice que no pudo probar
    solo_diagonal = [cita('2026-10-10 15:00', 'Diez del diez')]
    ns_diag = OutlookFalso([], especiales={CALENDARIO: _CarpetaCal(solo_diagonal, B, '%d/%m/%Y %H:%M', lambda a, b: list(solo_diagonal)),
                                           TAREAS: _Carpeta('Tareas', _Items([], B))})
    diag = agenda(ns_diag, dias=7, hoy=hoy4, formato=mes_dia)
    chk('agenda: con una sola cita suelta en 10/10 la sonda dice que NO pudo probar (no dice ok)', diag['control']['sonda'], 'sin citas sueltas para probar')
    # un Outlook que TIRA cuando no entiende la fecha (no se sabe si el real tira o devuelve nada: valen las dos)
    ns_tira = OutlookFalso([], especiales={
        CALENDARIO: type('_CalTira', (_CarpetaCal,), {'Items': property(lambda s: _Items(sueltas + [maestra], B, '%d/%m/%Y %H:%M', True, expandir, 'restrict'))})([], B, '', None),
        TAREAS: _Carpeta('Tareas', _Items([], B))})
    tira = agenda(ns_tira, dias=7, hoy=hoy4, formato=mes_dia)
    chk('ROJO agenda: si Outlook rechaza el filtro, sale control rojo con el motivo (no una excepcion)',
        (tira['control']['ok'], tira['control']['motivo'][:25]), (False, 'Outlook no acepto el filt'))
    # una tarea que vence HOY no esta vencida
    hoy5 = datetime.datetime(2026, 10, 8, 15, 0)
    chk('agenda: una tarea que vence hoy no sale como vencida',
        [t['vencida'] for t in agenda(outlook_con('%d/%m/%Y %H:%M'), dias=1, hoy=hoy5, formato=dia_mes)['tareas'] if t['vence']], [False])
    chk('fecha_regional devuelve una fecha con su hora en 24 h', fecha_regional(datetime.datetime(2026, 10, 10, 21, 5))[-5:], '21:05')

    # ── lo que importa: nada de lo anterior escribio en Outlook
    escrituras = [b for b in B if b[0] != 'Display']
    chk('NINGUNA funcion guardo, mando, movio, borro ni cambio un item', escrituras, [])
    chk('y solo abrir() mostro una ventana', sorted(set(b[1] for b in B if b[0] == 'Display')), ['A1', 'A2'])
    # el gemelo: la bitacora SI ve una escritura cuando la hay
    testigo = []
    it = _Item(testigo, EntryID='T')
    it.Save()
    it.UnRead = False
    chk('GEMELO: el Outlook de mentira anota un Save() y una asignacion', testigo, [('Save', 'T'), ('asignar UnRead', 'T')])
    # y tambien lo que no esta en la lista de lecturas: marcar como tarea, tocar destinatarios, sacar de una coleccion
    for nombre in ('MarkAsTask', 'Recipients', 'PropertyAccessor'):
        try:
            getattr(it, nombre)
        except AttributeError:
            pass
    col = _Items([it], testigo)
    for nombre in ('Remove', 'Add'):
        try:
            getattr(col, nombre)
        except AttributeError:
            pass
    chk('GEMELO: y anota cualquier cosa que no sea una lectura conocida (item y coleccion)', [t[0] for t in testigo[2:]],
        ['desconocido MarkAsTask', 'desconocido Recipients', 'desconocido PropertyAccessor',
         'desconocido en coleccion Remove', 'desconocido en coleccion Add'])

    total = 49
    if fallas:
        print('FALLARON %d: %s' % (len(fallas), ' | '.join(fallas)))
        return 1
    print('todo verde (mailsLectura, %d casos)' % total)
    return 0


class _CarpetaCal(object):
    """El calendario de mentira: cada vez que se le piden los Items devuelve una coleccion nueva, como Outlook."""

    def __init__(self, lista, bitacora, regional, expandir):
        self._a = (lista, bitacora, regional, True, expandir)
        self.Name, self.DefaultItemType = 'Calendario', 1
        self.Folders = _Lista([])

    @property
    def Items(self):
        return _Items(*self._a)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(errors='replace')
    except Exception:
        pass
    if '--selftest' in sys.argv:
        sys.exit(selftest())
    print('uso: python scripts/_lib/mailsLectura.py --selftest   (las funciones las usa scripts/_mails.py)')
