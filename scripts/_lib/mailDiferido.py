# -*- coding: utf-8 -*-
"""
mailDiferido.py — programar la salida de un mail para una hora (cola HOY-19i, 11/10/2026). Lo usa
`scripts/_mailEnviar.py --a-las "AAAA-MM-DD HH:MM"`, DENTRO del circuito de envio de siempre.

Este modulo NO manda nada: valida la hora, la fija en el borrador (entrega diferida de Outlook) y, despues de que el
circuito hizo su envio, mira donde quedo el mail. El envio sigue siendo el unico de `_mailEnviar.py`.

Lo medido el 11/10/2026 sobre un borrador de prueba, en esta PC (zona -3):
  - Escribir la hora «pelada» (sin zona) la deja 3 HORAS CORRIDA: pedi 08:00 y quedo 11:00 (14:00 UTC en el servidor).
  - Escrita con la misma etiqueta con que Outlook la devuelve (hora de pared marcada como UTC) queda bien: 08:00
    locales, 11:00 UTC. Por eso `programar()` la escribe asi y la RELEE por dos vias antes de dejar seguir: por la
    propiedad del item y por la propiedad MAPI en UTC pasada a hora local por el propio Outlook. Si alguna no da la
    hora pedida, deshace y el mail no sale.
  - Sin programar, Outlook devuelve el anio 4501 («sin fecha»).

Sin verificar (no se mando ningun mail al hacer esto): que un mail programado espere en la Bandeja de salida y si
Outlook tiene que estar abierto a esa hora. Por eso `donde_quedo()` no supone: mira la Bandeja de salida y Enviados
y dice lo que ve.

    python scripts/_lib/mailDiferido.py --selftest        # sin Outlook
"""
import datetime
import io
import json
import os
import re
import sys

FORMATO = '%Y-%m-%d %H:%M'
MARGEN_MIN = 5               # la hora tiene que estar al menos a esto de ahora: los controles del circuito tardan
MAX_DIAS = 14                # mas lejos que esto no se programa: el dato del mail envejece sin que nadie lo revalide
SIN_FECHA = 4000             # Outlook usa el anio 4501 para «sin fecha»
PR_DEFERRED_SEND_TIME = 'http://schemas.microsoft.com/mapi/proptag/0x3FEF0040'      # en UTC
PR_MESSAGE_FLAGS = 'http://schemas.microsoft.com/mapi/proptag/0x0E070003'
MSGFLAG_SUBMIT, MSGFLAG_UNSENT = 0x04, 0x08
UTC = datetime.timezone.utc


def _pared(d):
    """La hora de pared de una fecha de Outlook, sin su etiqueta de zona (que no es cierta) y sin segundos."""
    try:
        return datetime.datetime(d.year, d.month, d.day, d.hour, d.minute)
    except Exception:
        return None


def leer_hora(texto, ahora=None):
    """'2026-10-12 08:00' -> (datetime, '') o (None, motivo). Formato estricto, en el futuro y con margen."""
    ahora = ahora or datetime.datetime.now()
    t = ' '.join(str(texto or '').split())
    if not re.match(r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$', t):
        return None, '--a-las va como "AAAA-MM-DD HH:MM" (con comillas, hora de 00 a 23): «%s» no se entiende' % t
    try:
        d = datetime.datetime.strptime(t, FORMATO)
    except ValueError:
        return None, '«%s» no es una fecha y hora que exista' % t
    if d <= ahora:
        return None, 'esa hora ya paso (%s; ahora son las %s)' % (d.strftime(FORMATO), ahora.strftime(FORMATO))
    if d < ahora + datetime.timedelta(minutes=MARGEN_MIN):
        return None, 'faltan menos de %d minutos para esa hora: para eso se manda ahora, sin --a-las' % MARGEN_MIN
    if d > ahora + datetime.timedelta(days=MAX_DIAS):
        return None, 'esa hora esta a mas de %d dias: no se programa tan lejos (el dato del mail envejece)' % MAX_DIAS
    return d, ''


def hora_puesta(item):
    """La hora de entrega diferida que tiene el item (hora de pared), o None si no tiene."""
    try:
        d = _pared(item.DeferredDeliveryTime)
    except Exception:
        return None
    return d if d is not None and d.year < SIN_FECHA else None


def _hora_por_mapi(item):
    """La misma hora leida por la otra via (MAPI en UTC, pasada a hora local por Outlook). None si no se pudo leer."""
    try:
        pa = item.PropertyAccessor
        d = _pared(pa.UTCToLocalTime(pa.GetProperty(PR_DEFERRED_SEND_TIME)))
    except Exception:
        return None
    return d if d is not None and d.year < SIN_FECHA else None


def texto_aviso(cuando):
    return '%s a las %s' % (cuando.strftime('%Y-%m-%d'), cuando.strftime('%H:%M'))


def programar(item, cuando, releer=None, ahora=None):
    """Fija en el borrador la hora de entrega diferida y la confirma. Devuelve (ok, motivo, item).

    No manda nada. `releer(item)` devuelve el item leido de nuevo de Outlook (para no confiar en lo que quedo en
    memoria). Si la relectura no da la hora pedida, por cualquiera de las dos vias, se deshace (se le saca la hora al
    borrador) y devuelve ok = False: el que llama NO sigue con el envio."""
    ahora = ahora or datetime.datetime.now()
    if cuando <= ahora + datetime.timedelta(minutes=2):
        return False, 'la hora programada (%s) ya llego (o falta menos de 2 minutos) mientras corrian los controles: no programo' % cuando.strftime(FORMATO), item
    pedida = _pared(cuando)
    OJO = ' — OJO: el borrador puede haber quedado con una hora puesta y no pude sacarsela: mirarlo antes de mandarlo a mano'
    original = item
    try:
        item.DeferredDeliveryTime = pedida.replace(tzinfo=UTC)      # hora de pared con la etiqueta que usa Outlook (ver arriba)
        item.Save()
        if releer:
            item = releer(item)
    except Exception as e:
        # puede haber fallado DESPUES de guardar: el borrador puede tener la hora. Se intenta dejarlo sin hora.
        motivo = 'no pude fijar y confirmar la hora de entrega diferida (%s)' % str(e)[:160]
        return False, motivo + ('' if quitar(original) else OJO), original
    por_propiedad = hora_puesta(item)
    por_mapi = _hora_por_mapi(item)
    if por_propiedad != pedida or por_mapi != pedida:
        motivo = 'la hora no quedo confirmada por las dos vias: pedi %s, el borrador dice %s y el servidor %s' % (
            pedida.strftime(FORMATO), por_propiedad.strftime(FORMATO) if por_propiedad else 'sin hora',
            por_mapi.strftime(FORMATO) if por_mapi else 'no se pudo leer')
        return False, motivo + ('' if quitar(item) else OJO), item
    return True, '', item


def quitar(item):
    """Le saca la hora de entrega diferida a un borrador y CONFIRMA que quedo sin hora. Devuelve True si quedo sin hora."""
    try:
        item.DeferredDeliveryTime = datetime.datetime(4501, 1, 1, tzinfo=UTC)
        item.Save()
        return hora_puesta(item) is None
    except Exception:
        return False


def _items(coleccion, tope=500):
    if isinstance(coleccion, (list, tuple)):
        return list(coleccion)
    out = []
    try:
        n = min(int(coleccion.Count), tope)
    except Exception:
        return out
    for i in range(1, n + 1):
        try:
            out.append(coleccion.Item(i))
        except Exception:
            continue
    return out


def _destinos(s):
    return {p.strip().lower() for p in re.split(r'[;,]', str(s or '')) if p.strip()}


def de_este_mail(coleccion, asunto, para, norm):
    """Los items de una carpeta que son ESTE mail: mismo asunto (normalizado con `norm`) y mismos destinatarios en Para."""
    out = []
    for x in _items(coleccion):
        try:
            if norm(str(x.Subject or '')) == norm(asunto) and _destinos(x.To) == _destinos(para):
                out.append(x)
        except Exception:
            continue
    return out


def del_mismo_asunto(coleccion, asunto, norm):
    out = []
    for x in _items(coleccion):
        try:
            if norm(str(x.Subject or '')) == norm(asunto):
                out.append(x)
        except Exception:
            continue
    return out


def sigue_en_cola(salida, asunto, norm):
    """Para verificar que un envio comun salio: los items de la Bandeja de salida que son de este asunto O QUE NO SE
    DEJAN LEER. Un error de lectura cuenta como «sigue en cola»: no se da por salido lo que no se pudo mirar."""
    try:
        n = int(salida.Count)
    except Exception:
        return [None]
    out = []
    for i in range(1, n + 1):
        try:
            x = salida.Item(i)
            if norm(str(x.Subject or '')) == norm(asunto):
                out.append(x)
        except Exception:
            out.append(None)
    return out


def en_enviados(recientes, asunto, norm, desde):
    """De una lista de enviados recientes (los mas nuevos primero), el de ESTE asunto enviado desde `desde`. None si no esta."""
    limite = _pared(desde) - datetime.timedelta(minutes=2)
    for x in _items(recientes):
        try:
            enviado = _pared(x.SentOn)
            if enviado is not None and enviado >= limite and norm(str(x.Subject or '')) == norm(asunto):
                return x
        except Exception:
            continue
    return None


def _flags(item):
    try:
        return int(item.PropertyAccessor.GetProperty(PR_MESSAGE_FLAGS))
    except Exception:
        return None


def donde_quedo(salida, enviados, asunto, para, cuando, norm, desde=None):
    """Despues del envio del circuito con una hora programada: ¿donde esta el mail?  -> (estado, texto)

      'programado'   esta en la Bandeja de salida, entregado a Outlook para salir, con la hora pedida
      'otra-hora'    esta en la Bandeja de salida pero con otra hora (o sin hora)
      'sin-confirmar' esta en la Bandeja de salida con la hora pedida, pero no figura como entregado para salir
      'salio'        no esta en la Bandeja de salida y aparece en Enviados despues de `desde`: salio YA, sin esperar
      'no-aparece'   no esta en ninguno de los dos lados
    Nunca dice 'programado' sin haber visto el item con su hora. En la Bandeja de salida se busca por ASUNTO y no por
    destinatarios: el circuito ya freno si habia otro de este asunto en la cola, y Outlook puede reescribir el «Para»
    al enviar (un programado bien hecho informado como fallido empuja a mandarlo a mano: dos mails). `para` queda en
    la firma por los que llaman; no se usa para decidir. `enviados` es una lista de los enviados mas recientes."""
    en_cola = del_mismo_asunto(salida, asunto, norm)
    if en_cola:
        x = en_cola[0]
        puesta = hora_puesta(x)
        f = _flags(x)
        if puesta != _pared(cuando):
            return 'otra-hora', 'esta en la Bandeja de salida con %s, y se pidio %s' % (
                ('la hora ' + puesta.strftime(FORMATO)) if puesta else 'NINGUNA hora programada (sale en cuanto Outlook transmita)',
                cuando.strftime(FORMATO))
        if f is not None and (f & MSGFLAG_UNSENT) and not (f & MSGFLAG_SUBMIT):
            # sin medir en un diferido real: no se afirma que no sale, se dice que no se pudo confirmar
            return 'sin-confirmar', ('esta en la Bandeja de salida con la hora pedida (%s), pero no figura como entregado para salir '
                                     '(marcas 0x%08X; no medido en un mail programado real). NO mandarlo de nuevo: mirarlo en Outlook'
                                     % (texto_aviso(cuando), f))
        return 'programado', 'esta en la Bandeja de salida con salida el %s%s' % (
            texto_aviso(cuando), '' if f is not None else ' (no pude leer si quedo entregado para salir)')
    x = en_enviados(enviados, asunto, norm, desde) if desde is not None else None
    if x is not None:
        return 'salio', 'NO quedo esperando: ya figura en Enviados (%s). YA SALIO, sin esperar la hora: no mandarlo de nuevo' % (
            _pared(x.SentOn).strftime(FORMATO))
    return 'no-aparece', 'no lo veo en la Bandeja de salida ni en Enviados: mirar Outlook a mano antes de dar nada por hecho, y no mandarlo de nuevo sin mirar'


def registrar(ruta, fila):
    """Agrega un renglon al registro de mails programados (`.mail-cache/programados.jsonl`, ignorado por git)."""
    carpeta = os.path.dirname(ruta)
    if carpeta and not os.path.isdir(carpeta):
        os.makedirs(carpeta)
    with io.open(ruta, 'a', encoding='utf-8') as f:
        f.write(json.dumps(fila, ensure_ascii=False) + '\n')


# ───────────────────────────────────────────────────────────────── Outlook de mentira (selftest)
#
# Un Outlook chico que hace lo que se midio en el real: la hora escrita sin zona se corre 3 h, la escrita con la
# etiqueta UTC queda de pared; y un item «despachado» con hora futura queda en la Bandeja de salida, sin hora pasa
# a Enviados. El despacho de mentira se llama `despachar()` a proposito: este modulo no manda nada y no lo llama.

class _ZonaPc(datetime.tzinfo):
    def utcoffset(self, d):
        return datetime.timedelta(0)

    def dst(self, d):
        return datetime.timedelta(0)


class _Accesor(object):
    def __init__(self, item):
        self._i = item

    def GetProperty(self, nombre):
        if self._i._sin_mapi:
            raise RuntimeError('propiedad no disponible')
        if nombre == PR_MESSAGE_FLAGS:
            return self._i._flags
        if nombre == PR_DEFERRED_SEND_TIME:
            return self._i._guardada + datetime.timedelta(hours=3)          # el servidor guarda UTC; la PC esta en -3
        raise RuntimeError(nombre)

    def UTCToLocalTime(self, d):
        return d - datetime.timedelta(hours=3)


class ItemFalso(object):
    """Un mail de mentira. Anota en `bitacora` cada cosa que se le hace."""

    def __init__(self, bitacora, asunto='Asunto', para='Fak', corre=0, sin_mapi=False, no_guarda=False):
        d = self.__dict__
        d.update(_b=bitacora, Subject=asunto, To=para, _guardada=datetime.datetime(4501, 1, 1), _pendiente=None,
                 _corre=corre, _sin_mapi=sin_mapi, _no_guarda=no_guarda, _flags=MSGFLAG_UNSENT, _donde='borradores',
                 SentOn=None)

    def __setattr__(self, nombre, valor):
        self._b.append(('asignar ' + nombre, valor))
        if nombre == 'DeferredDeliveryTime':
            if valor.tzinfo is None:                     # lo medido: sin zona, pywin32 la corre 3 h
                valor = valor + datetime.timedelta(hours=3)
            self.__dict__['_pendiente'] = valor.replace(tzinfo=None) + datetime.timedelta(hours=self._corre)
        else:
            self.__dict__[nombre] = valor

    @property
    def DeferredDeliveryTime(self):
        return self._guardada.replace(tzinfo=_ZonaPc())

    @property
    def PropertyAccessor(self):
        return _Accesor(self)

    def Save(self):
        self._b.append(('Save', self.Subject))
        if self._pendiente is not None and not self._no_guarda:
            if not (self.__dict__.get('_no_quita') and self._pendiente.year >= SIN_FECHA):
                self.__dict__['_guardada'] = self._pendiente
        self.__dict__['_pendiente'] = None

    def despachar(self, ahora):
        """Lo que hace Outlook con el envio del circuito: con hora futura queda en la cola; sin hora, sale."""
        self._b.append(('despachar', self.Subject))
        if self._guardada.year < SIN_FECHA and self._guardada > ahora:
            self.__dict__.update(_donde='salida', _flags=MSGFLAG_UNSENT | MSGFLAG_SUBMIT)
        else:
            self.__dict__.update(_donde='enviados', _flags=0, SentOn=ahora.replace(tzinfo=_ZonaPc()))


class Carpeta(object):
    def __init__(self, items, donde):
        self._items, self._donde = items, donde

    @property
    def Count(self):
        return len([x for x in self._items if x._donde == self._donde])

    def Item(self, i):
        return [x for x in self._items if x._donde == self._donde][i - 1]


def selftest():
    fallas = []

    def chk(nombre, obtenido, esperado):
        ok = obtenido == esperado
        print('  %s %s%s' % ('ok ' if ok else 'MAL', nombre, '' if ok else '   obtenido=%r esperado=%r' % (obtenido, esperado)))
        if not ok:
            fallas.append(nombre)

    norm = lambda s: re.sub(r'^\s*((re|rv|fw|fwd|res)\s*:\s*)+', '', s, flags=re.I).strip().lower()
    ahora = datetime.datetime(2026, 10, 11, 23, 0)
    maniana = datetime.datetime(2026, 10, 12, 8, 0)
    print('selftest de mailDiferido (Outlook de mentira):')

    # ── leer la hora
    chk('hora: una hora de maniana se acepta', leer_hora('2026-10-12 08:00', ahora), (maniana, ''))
    chk('ROJO hora: una hora que ya paso se rechaza', leer_hora('2026-10-11 08:00', ahora)[0], None)
    chk('ROJO hora: la hora de ahora mismo se rechaza', leer_hora('2026-10-11 23:00', ahora)[0], None)
    chk('ROJO hora: a menos de 5 minutos se rechaza (para eso se manda ahora)', leer_hora('2026-10-11 23:03', ahora)[0], None)
    chk('hora: a 6 minutos se acepta', leer_hora('2026-10-11 23:06', ahora)[0], datetime.datetime(2026, 10, 11, 23, 6))
    chk('ROJO hora: a mas de 14 dias se rechaza', leer_hora('2026-11-01 08:00', ahora)[0], None)
    chk('ROJO hora: formatos que no son el pedido se rechazan',
        [leer_hora(t, ahora)[0] for t in ('12/10/2026 08:00', '2026-10-12', '8am', '2026-10-12 8:00', '2026-10-12 08:00:00', '', None, 'mañana 8')], [None] * 8)
    chk('ROJO hora: una fecha que no existe se rechaza', leer_hora('2026-10-32 08:00', ahora)[0], None)
    chk('ROJO hora: la hora 24 no existe', leer_hora('2026-10-12 24:00', ahora)[0], None)

    # ── programar
    B = []
    it = ItemFalso(B)
    chk('sin programar, el borrador no tiene hora (anio 4501)', hora_puesta(it), None)
    ok, motivo, it2 = programar(it, maniana, releer=lambda x: x, ahora=ahora)
    chk('programar: queda la hora pedida, confirmada por las dos vias', (ok, motivo, hora_puesta(it), _hora_por_mapi(it)), (True, '', maniana, maniana))
    chk('programar: lo unico que le hizo al borrador fue fijar la hora y guardar', [b[0] for b in B], ['asignar DeferredDeliveryTime', 'Save'])
    chk('programar: la escribio con la etiqueta de zona (sin ella se corre 3 h)', B[0][1].tzinfo is not None, True)
    # el gemelo de la trampa medida: escrita sin zona, el Outlook de mentira la corre como el real
    Bg = []
    g = ItemFalso(Bg)
    g.DeferredDeliveryTime = maniana
    g.Save()
    chk('GEMELO: escrita sin zona queda 3 horas corrida, como se midio en el Outlook real', hora_puesta(g), datetime.datetime(2026, 10, 12, 11, 0))
    # un Outlook que corre la hora igual: programar lo ve, deshace y dice que no
    Bc = []
    c = ItemFalso(Bc, corre=3)
    okc, motivoc, _ = programar(c, maniana, releer=lambda x: x, ahora=ahora)
    chk('ROJO programar: si la relectura no da la hora pedida, dice que no y nombra las dos horas',
        (okc, 'pedi 2026-10-12 08:00' in motivoc, '11:00' in motivoc), (False, True, True))
    chk('ROJO programar: y le saca la hora al borrador (no queda programado a una hora que nadie pidio)', hora_puesta(c), None)
    # un Outlook que no guarda la hora
    n = ItemFalso([], no_guarda=True)
    chk('ROJO programar: si la hora no queda guardada, dice que no', programar(n, maniana, releer=lambda x: x, ahora=ahora)[0], False)
    # sin la segunda via: sigue, y lo dice
    s = ItemFalso([], sin_mapi=True)
    oks, motivos, _ = programar(s, maniana, releer=lambda x: x, ahora=ahora)
    chk('ROJO programar: sin la segunda via no alcanza: dice que no y deja el borrador sin hora',
        (oks, 'no se pudo leer' in motivos, hora_puesta(s)), (False, True, None))
    # falla la relectura DESPUES de guardar: el borrador ya tenia la hora; se la saca y lo dice
    f = ItemFalso([])

    def relectura_rota(x):
        raise RuntimeError('la llamada fue rechazada')
    okf, motivof, _ = programar(f, maniana, releer=relectura_rota, ahora=ahora)
    chk('ROJO programar: si falla la relectura despues de guardar, dice que no y le saca la hora al borrador',
        (okf, hora_puesta(f), 'OJO' in motivof), (False, None, False))
    # y si ademas no se la puede sacar, lo grita
    q = ItemFalso([], corre=3)
    q.__dict__['_no_quita'] = True
    okq, motivoq, _ = programar(q, maniana, releer=lambda x: x, ahora=ahora)
    chk('ROJO programar: si no puede sacarle la hora, avisa que el borrador quedo con una hora puesta', (okq, 'OJO' in motivoq), (False, True))
    # la hora llego mientras corrian los controles
    t = ItemFalso([])
    okt, motivot, _ = programar(t, maniana, releer=lambda x: x, ahora=datetime.datetime(2026, 10, 12, 7, 59, 30))
    chk('ROJO programar: si la hora llego mientras corrian los controles, no programa ni toca el borrador', (okt, t._b), (False, []))

    # ── donde quedo, despues del envio del circuito
    todos = []
    salida, enviados = Carpeta(todos, 'salida'), Carpeta(todos, 'enviados')
    prog = ItemFalso([], asunto='BOM IP Pad', para='Pablo Cejas; Daniel Rosello')
    todos.append(prog)
    programar(prog, maniana, releer=lambda x: x, ahora=ahora)
    prog.despachar(ahora)
    chk('programado: queda en la Bandeja de salida y NO en Enviados (no sale antes)', (salida.Count, enviados.Count), (1, 0))
    chk('programado: se lo ve en la cola con su hora',
        donde_quedo(salida, enviados, 'BOM IP Pad', 'Daniel Rosello; Pablo Cejas', maniana, norm, desde=ahora)[0], 'programado')
    chk('ROJO: si se pidio otra hora que la que tiene, no dice programado',
        donde_quedo(salida, enviados, 'BOM IP Pad', 'Pablo Cejas; Daniel Rosello', datetime.datetime(2026, 10, 12, 9, 0), norm, desde=ahora)[0], 'otra-hora')
    # sin --a-las: nada toca la hora y el mail sale en el momento
    comun = ItemFalso([], asunto='Otro tema', para='Carlos Baptista')
    todos.append(comun)
    comun.despachar(ahora)
    chk('sin programar: la propiedad no se toco y el mail salio en el momento', (hora_puesta(comun), comun._donde, [b[0] for b in comun._b]), (None, 'enviados', ['despachar']))
    chk('ROJO: un mail que salio en el momento no se informa como programado',
        donde_quedo(salida, enviados, 'Otro tema', 'Carlos Baptista', maniana, norm, desde=ahora)[0], 'salio')
    def viejo_de_otro():
        o = ItemFalso([], asunto='Asaichi', para='Todos')
        o.__dict__.update(_donde='enviados', SentOn=ahora.replace(tzinfo=_ZonaPc()))
        return o

    # un borrador parado en la cola (sin entregar para salir)
    parado = ItemFalso([], asunto='Parado', para='X')
    parado.__dict__.update(_donde='salida', _guardada=maniana, _flags=MSGFLAG_UNSENT)
    todos.append(parado)
    est_p, txt_p = donde_quedo(salida, enviados, 'Parado', 'X', maniana, norm)
    chk('ROJO: en la cola sin figurar como entregado no se dice programado ni «no sale»: sin confirmar, y que no se reenvie',
        (est_p, 'NO mandarlo de nuevo' in txt_p), ('sin-confirmar', True))
    chk('programado: se lo encuentra aunque Outlook haya reescrito el «Para» al enviar',
        donde_quedo(salida, enviados, 'BOM IP Pad', 'pcejas@barackmercosul.com', maniana, norm, desde=ahora)[0], 'programado')

    # ── verificar un envio comun: lo que no se deja leer cuenta como «sigue en cola», y ENVIADO es ESTE mail
    class _Ilegible(object):
        @property
        def Subject(self):
            raise RuntimeError('item en transito')
    chk('ROJO cola: un item de la cola que no se deja leer cuenta como que sigue en cola',
        (len(sigue_en_cola(Carpeta(todos, 'salida'), 'Otro tema', norm)), len(sigue_en_cola(type('_C', (object,), {'Count': 1, 'Item': lambda s, i: _Ilegible()})(), 'Otro tema', norm))), (0, 1))
    chk('ROJO cola: si la cola no se deja contar, tambien', len(sigue_en_cola(object(), 'Otro tema', norm)), 1)
    chk('enviados: se encuentra ESTE mail por asunto y hora, no el primero de la lista',
        (en_enviados([viejo_de_otro(), comun], 'RE: Otro tema', norm, ahora) is comun, en_enviados([viejo_de_otro()], 'Otro tema', norm, ahora)), (True, None))
    chk('ROJO: lo que no esta en ningun lado no se da por hecho', donde_quedo(salida, enviados, 'No existe', 'X', maniana, norm)[0], 'no-aparece')
    viejo = ItemFalso([], asunto='Tema viejo', para='X')
    viejo.__dict__.update(_donde='enviados', SentOn=datetime.datetime(2026, 10, 10, 9, 0, tzinfo=_ZonaPc()))
    todos.append(viejo)
    chk('ROJO: un enviado de ayer del mismo asunto no cuenta como «salio recien»',
        donde_quedo(salida, enviados, 'Tema viejo', 'X', maniana, norm, desde=ahora)[0], 'no-aparece')

    # ── la cola por mail: un programado ajeno no hace esperar ni confunde a un envio comun
    chk('cola: con un programado de otro asunto esperando, ESTE asunto no tiene nada en cola',
        (salida.Count, len(del_mismo_asunto(salida, 'Otro tema', norm))), (2, 0))
    chk('cola: y el del asunto programado si se ve (con RE: adelante tambien)', len(del_mismo_asunto(salida, 'RE: BOM IP Pad', norm)), 1)
    chk('cola: mismo asunto pero otros destinatarios no es este mail', len(de_este_mail(salida, 'BOM IP Pad', 'Carlos Baptista', norm)), 0)

    # ── el registro
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        ruta = os.path.join(td, 'sub', 'programados.jsonl')
        registrar(ruta, {'asunto': 'BOM IP Pad', 'a_las': maniana.strftime(FORMATO), 'estado': 'programado'})
        registrar(ruta, {'asunto': 'Otro', 'a_las': maniana.strftime(FORMATO), 'estado': 'programado'})
        filas = [json.loads(l) for l in io.open(ruta, encoding='utf-8') if l.strip()]
    chk('registro: suma un renglon por mail programado, sin pisar', [f['asunto'] for f in filas], ['BOM IP Pad', 'Otro'])
    chk('aviso: la hora se dice como dia y hora', texto_aviso(maniana), '2026-10-12 a las 08:00')

    total = 38
    if fallas:
        print('FALLARON %d: %s' % (len(fallas), ' | '.join(fallas)))
        return 1
    print('todo verde (mailDiferido, %d casos)' % total)
    return 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(errors='replace')
    except Exception:
        pass
    if '--selftest' in sys.argv:
        sys.exit(selftest())
    print('uso: python scripts/_lib/mailDiferido.py --selftest   (las funciones las usa scripts/_mailEnviar.py --a-las)')
