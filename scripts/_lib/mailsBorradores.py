# -*- coding: utf-8 -*-
"""
mailsBorradores.py — limpiar los borradores viejos de Outlook clasico (cola HOY-19k, 11/10/2026; si de Fak del
10/10/2026 23:58). Lo usa `scripts/_mails.py --limpiar-borradores [--mover]`.

Es lo UNICO de `_mails.py` que escribe en Outlook, y por eso vive aparte de `mailsLectura.py` (que sigue siendo solo
lectura y tiene un test que lo exige). Lo que hace y lo que no:

  - `candidatos()` lee los borradores (con `mailsLectura.borradores`) y separa los de mas de N dias desde su ultima
    modificacion. No toca nada.
  - `mover()` pasa cada candidato a la carpeta Elementos eliminados DE LA MISMA CUENTA con el metodo de mover del
    item. Nunca borra un item, nunca vacia Eliminados, nunca manda ni guarda nada. De Eliminados se recuperan a mano.
  - `mover()` solo acepta lo que quedo escrito en la lista (`lista.json`): lo que se mueve es lo que se guardo ANTES.

Cada item se revalida justo antes de moverlo, y si algo no cierra se OMITE con su motivo:
    lo armo un programa del repo (esta en `.mail-cache/borradores_claude.json`: puede estar en uso)
    ya no esta en Borradores (se mando, se movio)
    lo modificaron despues de hacer la lista (lo toco Fak: es suyo)
    esta abierto en una ventana de Outlook
Una excepcion en un item no corta a los demas. No se mueve mientras se recorre la carpeta (cada movimiento corre la
coleccion y se saltean items): primero se juntan los ids, despues se pide cada uno por su id.

    python scripts/_lib/mailsBorradores.py --selftest        # sin Outlook
"""
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mailsLectura as L  # noqa: E402

ELIMINADOS = 3               # GetDefaultFolder: Elementos eliminados
DIAS = 90                    # «viejo» = mas de 90 dias desde la ultima modificacion (el tramo de resumen_borradores)
DIAS_MINIMO = 30             # por debajo de esto no se limpia: un borrador de este mes puede estar esperando


def candidatos(ns, registro=None, dias=DIAS, hoy=None):
    """(todos, viejos): todos los borradores y los de MAS de `dias` dias. Uno sin fecha legible no es candidato."""
    todos = L.borradores(ns, registro, hoy=hoy)
    viejos = [b for b in todos if b['dias'] is not None and b['dias'] > dias]
    return todos, viejos


def plan(todos, viejos, dias=DIAS, hecha=None):
    """Lo que se guarda en `lista.json` ANTES de mover: de aca, y solo de aca, lee `mover()`."""
    return {
        'hecha': (hecha or datetime.datetime.now()).strftime('%Y-%m-%d %H:%M'),
        'dias': dias,
        'total_borradores': len(todos),
        'candidatos': [{k: b[k] for k in ('id', 'modificado', 'dias', 'asunto', 'para', 'adjuntos', 'de_programa')}
                       for b in viejos],
    }


def _celda(s, largo=90):
    t = ' '.join(L._txt(s).split()).replace('|', '/')
    return (t[:largo - 1] + '…') if len(t) > largo else t


def texto_lista(p, notas=()):
    """La lista en Markdown, para leer: asunto, fecha, Para, adjuntos y que se hace con cada uno."""
    cs = p['candidatos']
    se_mueven = [c for c in cs if not c['de_programa']]
    out = ['# Borradores de Outlook de más de %d días' % p['dias'], '',
           'Lista hecha el %s, antes de mover nada. La edad se cuenta desde la última modificación del borrador.' % p['hecha'],
           '',
           '- Borradores en total: **%d**' % p['total_borradores'],
           '- De más de %d días: **%d**' % (p['dias'], len(cs)),
           '- Se mueven a Elementos eliminados: **%d**' % len(se_mueven),
           '- No se mueven (los armó un programa del repo y pueden estar en uso): **%d**' % (len(cs) - len(se_mueven)),
           '- Quedan en Borradores después de mover: **%d**' % (p['total_borradores'] - len(se_mueven)), '']
    out += ['- %s' % n for n in notas]
    out += ['', '| N.º | Última modificación | Días | Asunto | Para | Adjuntos | Qué se hace |', '|---|---|---|---|---|---|---|']
    for i, c in enumerate(cs, 1):
        out.append('| %d | %s | %s | %s | %s | %s | %s |' % (
            i, c['modificado'], c['dias'], _celda(c['asunto']) or '(sin asunto)', _celda(c['para'], 60) or '(sin destinatario)',
            ('sí (%d)' % c['adjuntos']) if c['adjuntos'] else 'no',
            'no se mueve: lo armó un programa' if c['de_programa'] else 'se mueve a Elementos eliminados'))
    out += ['', 'Para recuperar uno: en Outlook, carpeta Elementos eliminados, arrastrarlo de vuelta a Borradores.', '']
    return '\n'.join(out)


def _misma(ns, a, b, duda=False):
    """¿Los dos ids son del mismo item? Si Outlook no deja compararlos devuelve `duda`: al mirar donde esta un item la
    duda es «no» (no se mueve); al mirar si esta abierto la duda es «si» (tampoco se mueve)."""
    a, b = L._txt(a), L._txt(b)
    if not a or not b:
        return duda
    if a == b:
        return True
    try:
        return bool(ns.CompareEntryIDs(a, b))
    except Exception:
        return duda


def _abiertos(ns):
    """Los ids de los items abiertos en Outlook: en una ventana propia o escribiendose en el panel de lectura.
    None si no se pudieron mirar las ventanas."""
    try:
        insp = ns.Application.Inspectors
        n = int(insp.Count)
    except Exception:
        return None
    out = []
    for i in range(1, n + 1):
        try:
            out.append(L._txt(insp.Item(i).CurrentItem.EntryID))
        except Exception:
            out.append('?')          # una ventana que no se deja leer: no se sabe de quien es
    try:                             # el borrador que se escribe en el panel de lectura no tiene ventana propia
        exps = ns.Application.Explorers
        for i in range(1, int(exps.Count) + 1):
            try:
                en_linea = exps.Item(i).ActiveInlineResponse
            except Exception:
                continue             # un Outlook viejo no tiene esa propiedad
            if en_linea is not None:
                try:
                    out.append(L._txt(en_linea.EntryID) or '?')
                except Exception:
                    out.append('?')
    except Exception:
        pass
    return out


NO_ENCONTRADO = ('-2147221233', '8004010f', 'no existe ese item')      # MAPI_E_NOT_FOUND, y el del Outlook de mentira


def _no_encontrado(e):
    t = (repr(e) + ' ' + str(e)).lower()
    return any(s in t for s in NO_ENCONTRADO)


def _uno(ns, c, umbral, propios, id_borradores, destino, id_destino, hoy):
    """Un candidato: lo revalida contra Outlook y, si todo cierra, lo mueve. Devuelve su fila."""
    fila = {'id': '', 'asunto': '', 'modificado': '', 'resultado': 'omitido', 'motivo': ''}
    if not isinstance(c, dict):
        fila.update(resultado='error', motivo='el renglón de la lista no es un borrador (%r)' % (c,))
        return fila
    eid = L._txt(c.get('id'))
    fila.update(id=eid, asunto=L._txt(c.get('asunto')), modificado=L._txt(c.get('modificado')))
    if c.get('de_programa') or eid.strip().upper() in propios:
        fila['motivo'] = 'lo armó un programa del repo: puede estar en uso'
        return fila
    try:
        it = ns.GetItemFromID(eid)
    except Exception as e:
        if _no_encontrado(e):
            fila['motivo'] = 'ya no existe con ese id (se movió, se mandó o se borró)'
        else:
            fila.update(resultado='error', motivo='Outlook no entregó el borrador (%s)' % str(e)[:200])
        return fila
    if not _misma(ns, it.Parent.EntryID, id_borradores):
        fila['motivo'] = 'ya no está en Borradores'
        return fila
    mod = L._sin_zona(it.LastModificationTime)
    if mod is None or L._hm(mod) != fila['modificado']:
        fila['motivo'] = 'lo modificaron después de hacer la lista (%s)' % (L._hm(mod) or 'sin fecha')
        return fila
    edad = (hoy.date() - mod.date()).days          # medida contra el item, no contra lo que dice la lista
    if edad <= umbral:
        fila['motivo'] = 'tiene %d días: no pasa de %d' % (edad, umbral)
        return fila
    abiertos = _abiertos(ns)                       # se mira en el momento: lo pueden abrir durante la corrida
    if abiertos is None:
        fila['motivo'] = 'no pude ver qué ventanas tiene abiertas Outlook'
        return fila
    if '?' in abiertos or any(_misma(ns, a, eid, duda=True) for a in abiertos):
        fila['motivo'] = 'está abierto en Outlook (o hay una ventana que no se deja leer)'
        return fila
    movido = it.Move(destino)
    try:
        confirmado = movido is not None and _misma(ns, movido.Parent.EntryID, id_destino)
    except Exception:
        confirmado = False
    if confirmado:
        fila['resultado'] = 'movido'
    else:
        fila.update(resultado='error', motivo='se pidió el movimiento y Outlook no confirmó dónde quedó: mirarlo en Elementos eliminados')
    return fila


def mover(ns, p, registro=None, hoy=None, al_fila=None):
    """Mueve a Elementos eliminados los candidatos de `p` (lo guardado en lista.json) que siguen cumpliendo todo.

    `al_fila(fila)` se llama al terminar CADA item: el que llama lo anota en el momento, asi una corrida que se corta
    deja escrito lo que ya movio. Devuelve {'filas': [{id, asunto, modificado, resultado: 'movido'|'omitido'|'error',
    motivo}], 'movidos', 'omitidos', 'errores', 'antes', 'despues', 'cierra', 'destino'}. `antes` y `despues` son la
    cuenta de Borradores hecha de cero (None si Outlook no la dio); `cierra` dice si antes - despues = movidos."""
    hoy = hoy or datetime.datetime.now()
    propios = L.ids_de_registro(registro or [])
    try:
        umbral = max(int(p.get('dias') or DIAS), DIAS_MINIMO)
    except (TypeError, ValueError):
        umbral = DIAS
    carpeta = ns.GetDefaultFolder(L.BORRADORES)
    id_borradores = L._txt(carpeta.EntryID)
    try:
        destino = carpeta.Store.GetDefaultFolder(ELIMINADOS)      # la de la MISMA cuenta que Borradores
        id_destino = L._txt(destino.EntryID)
    except Exception as e:
        raise RuntimeError('no pude ubicar la carpeta Elementos eliminados de la cuenta (%s): no muevo nada' % str(e)[:120])
    if not id_borradores or not id_destino or _misma(ns, id_destino, id_borradores, duda=True):
        raise RuntimeError('no pude ubicar la carpeta Elementos eliminados: no muevo nada')
    antes = len(L.borradores(ns, registro))
    filas = []
    for c in p.get('candidatos') or []:
        try:
            fila = _uno(ns, c, umbral, propios, id_borradores, destino, id_destino, hoy)
        except Exception as e:
            fila = {'id': L._txt(c.get('id')) if isinstance(c, dict) else '', 'asunto': L._txt(c.get('asunto')) if isinstance(c, dict) else '',
                    'modificado': L._txt(c.get('modificado')) if isinstance(c, dict) else '',
                    'resultado': 'error', 'motivo': 'Outlook devolvió un error (%s)' % str(e)[:200]}
        filas.append(fila)
        if al_fila:
            try:
                al_fila(fila)
            except Exception:
                pass                 # no poder anotar un renglon no corta el movimiento de los demas
    try:
        despues = len(L.borradores(ns, registro))
    except Exception:
        despues = None
    cuenta = lambda r: sum(1 for f in filas if f['resultado'] == r)
    return {'filas': filas, 'movidos': cuenta('movido'), 'omitidos': cuenta('omitido'), 'errores': cuenta('error'),
            'antes': antes, 'despues': despues, 'cierra': despues is not None and antes - despues == cuenta('movido'),
            'destino': L._txt(getattr(destino, 'Name', ''))}


def texto_movimientos(r, p, cuando=None):
    out = ['# Movimiento de borradores a Elementos eliminados', '',
           'Corrida del %s, sobre la lista hecha el %s.' % ((cuando or datetime.datetime.now()).strftime('%Y-%m-%d %H:%M'), p.get('hecha', '?')),
           '',
           '- En la lista: **%d**' % len(r['filas']),
           '- Movidos a «%s»: **%d**' % (r['destino'] or 'Elementos eliminados', r['movidos']),
           '- Omitidos: **%d**' % r['omitidos'],
           '- Con error: **%d**' % r['errores'],
           '- Borradores antes: **%s** · después: **%s**%s' % (
               r['antes'], '?' if r['despues'] is None else r['despues'],
               '' if r.get('cierra', True) else ' · **OJO: la diferencia no coincide con los movidos, mirar Elementos eliminados**'), '',
           '| N.º | Última modificación | Asunto | Resultado | Por qué |', '|---|---|---|---|---|']
    for i, f in enumerate(r['filas'], 1):
        out.append('| %d | %s | %s | %s | %s |' % (i, f['modificado'], _celda(f['asunto']) or '(sin asunto)', f['resultado'], _celda(f['motivo'], 120)))
    out += ['', 'Ninguno se borró: están en Elementos eliminados y se recuperan arrastrándolos a Borradores.',
            'Sin verificar: si el servidor de correo borra solo lo que lleva mucho tiempo en Elementos eliminados.', '']
    return '\n'.join(out)


# ───────────────────────────────────────────────────────────────── Outlook de mentira (selftest)
#
# Es el de mailsLectura con UNA cosa permitida de mas: mover un item hacia la carpeta de Eliminados. Todo lo demas
# que escriba (borrar, guardar, mandar, asignar un campo, mover a otra carpeta) sigue quedando en la bitacora.

LECTURAS_ITEM_MAS = frozenset(('Parent',))


class _ItemB(L._Item):
    def __getattr__(self, nombre):
        if nombre == 'Move':
            def mover_a(destino=None, *a, **k):
                if isinstance(self._c.get('_tira_al_mover'), Exception):
                    raise self._c['_tira_al_mover']
                if not getattr(destino, '_es_eliminados', False):
                    self._b.append(('Move a otra carpeta', self._c.get('EntryID', '')))
                    return None
                origen = self._c['_parent']
                origen._items._l.remove(self)
                destino._items._l.append(self)
                self._c['_parent'] = destino
                self._c['_movs'].append(self._c.get('EntryID', ''))
                return self
            return mover_a
        if nombre == 'Parent':
            if self._c.get('_parent_tira_despues') and getattr(self._c['_parent'], '_es_eliminados', False):
                raise RuntimeError('no se puede leer la carpeta del item')
            return self._c['_parent']
        return L._Item.__getattr__(self, nombre)


class _Store(object):
    def __init__(self, eliminados):
        self._e = eliminados

    def GetDefaultFolder(self, n):
        if n != ELIMINADOS:
            raise RuntimeError('carpeta %s no prevista' % n)
        return self._e


class _CarpetaB(L._Carpeta):
    def __init__(self, nombre, items, eid, bitacora, eliminados=None):
        L._Carpeta.__init__(self, nombre, items, bitacora=bitacora)
        self.EntryID = eid
        self._es_eliminados = eliminados is None
        self.Store = _Store(self if eliminados is None else eliminados)


def outlook_falso(B, movs, filas, hoy):
    """Un Outlook de mentira con Borradores y Eliminados. `filas`: [(id, dias_atras, asunto, adjuntos, extra)]."""
    elim = _CarpetaB('Elementos eliminados', L._Items([], B), 'ID-ELIM', B)
    borr = _CarpetaB('Borradores', L._Items([], B), 'ID-BORR', B, eliminados=elim)
    items = []
    for eid, atras, asunto, adj, extra in filas:
        mod = (hoy - datetime.timedelta(days=atras)).replace(hour=10, minute=0, second=0, microsecond=0)
        campos = dict(EntryID=eid, LastModificationTime=mod.replace(tzinfo=L._ZonaFalsa()), Subject=asunto,
                      To='Carlos Baptista', Attachments=L._Adjuntos(adj), _parent=borr, _movs=movs)
        campos.update(extra or {})
        items.append(_ItemB(B, **campos))
    borr._items._l.extend(items)
    ns = L.OutlookFalso([], especiales={L.BORRADORES: borr, ELIMINADOS: elim}, todos=items)
    return ns, borr, elim, {x._c['EntryID']: x for x in items}


def selftest():
    fallas = []

    def chk(nombre, obtenido, esperado):
        ok = obtenido == esperado
        print('  %s %s%s' % ('ok ' if ok else 'MAL', nombre, '' if ok else '   obtenido=%r esperado=%r' % (obtenido, esperado)))
        if not ok:
            fallas.append(nombre)

    L.LECTURAS = L.LECTURAS | LECTURAS_ITEM_MAS
    hoy = datetime.datetime(2026, 10, 11, 9, 0)
    B, movs = [], []
    FILAS = [('V1', 862, 'Muy viejo', 2, None), ('V2', 91, 'Justo 91', 0, None), ('L90', 90, 'Justo 90', 1, None),
             ('N1', 3, 'Nuevo', 0, None), ('P1', 400, 'Viejo de un programa', 1, None),
             ('E1', 200, 'El que tira', 0, {'_tira_al_mover': RuntimeError('item bloqueado')}),
             ('A1', 150, 'Abierto en pantalla', 0, {'_abierto': True}), ('T1', 120, 'Lo toca Fak', 0, None),
             ('S1', 300, 'Sale de Borradores', 0, None), ('V3', 100, 'Otro | viejo', 0, None)]
    registro = [{'entry_id': 'p1', 'clave': 'viejo de un programa'}]
    print('selftest de mailsBorradores (Outlook de mentira):')
    ns, borr, elim, por_id = outlook_falso(B, movs, FILAS, hoy)

    # ── la lista: no mueve nada
    todos, viejos = candidatos(ns, registro, hoy=hoy)
    chk('lista: todos los borradores y los de MAS de 90 dias (el de 90 justos no entra)',
        (len(todos), sorted(b['id'] for b in viejos)), (10, ['A1', 'E1', 'P1', 'S1', 'T1', 'V1', 'V2', 'V3']))
    chk('lista: no movio, no borro ni cambio nada', (B, movs, len(borr.Items._l), len(elim.Items._l)), ([], [], 10, 0))
    p = plan(todos, viejos, hecha=hoy)
    md = texto_lista(p, notas=['nota de prueba'])
    chk('lista: el texto dice cuantos hay, cuantos se mueven y cuantos quedan',
        all(x in md for x in ('en total: **10**', 'De más de 90 días: **8**', 'eliminados: **7**', 'después de mover: **3**', 'nota de prueba')), True)
    chk('lista: cada fila con asunto, fecha, Para y adjuntos; el de un programa dice que no se mueve',
        ('| Muy viejo | Carlos Baptista | sí (2) | se mueve' in md, '| Viejo de un programa | Carlos Baptista | sí (1) | no se mueve' in md,
         'Otro / viejo' in md, 'Justo 90' in md, 'Nuevo' in md), (True, True, True, False, False))
    chk('lista: el plan pasa entero por JSON', json.loads(json.dumps(p))['candidatos'][0]['id'], 'V1')

    # ── entre la lista y el movimiento: Fak toca uno y otro sale de Borradores
    por_id['T1']._c['LastModificationTime'] = hoy.replace(tzinfo=L._ZonaFalsa())
    borr._items._l.remove(por_id['S1'])
    por_id['S1']._c['_parent'] = _CarpetaB('Elementos enviados', L._Items([], B), 'ID-ENV', B, eliminados=elim)

    # ── el movimiento
    anotadas = []
    r = mover(ns, json.loads(json.dumps(p)), registro, hoy=hoy, al_fila=lambda f: anotadas.append(f['id']))
    res = {f['id']: f['resultado'] for f in r['filas']}
    chk('mover: cada item se avisa al terminar, en orden (el registro no espera al final)', anotadas, [f['id'] for f in r['filas']])
    chk('mover: se mueven solo los viejos que siguen cumpliendo todo', sorted(movs), ['V1', 'V2', 'V3'])
    chk('mover: quedaron en Elementos eliminados y salieron de Borradores',
        (sorted(x._c['EntryID'] for x in elim.Items._l), sorted(x._c['EntryID'] for x in borr.Items._l)),
        (['V1', 'V2', 'V3'], ['A1', 'E1', 'L90', 'N1', 'P1', 'T1']))
    chk('mover: el de un programa NUNCA se mueve', (res['P1'], 'programa' in [f for f in r['filas'] if f['id'] == 'P1'][0]['motivo']), ('omitido', True))
    chk('mover: una excepcion en un item no corta a los demas (V3 venia despues y se movio)', (res['E1'], res['V3']), ('error', 'movido'))
    chk('mover: el que se modifico despues de la lista se omite', (res['T1'], 'modificaron' in [f for f in r['filas'] if f['id'] == 'T1'][0]['motivo']), ('omitido', True))
    chk('mover: el que esta abierto en una ventana se omite', res['A1'], 'omitido')
    chk('mover: el que ya no esta en Borradores se omite', res['S1'], 'omitido')
    chk('mover: la cuenta de antes y despues, hecha de cero, y cierra con los movidos',
        (r['antes'], r['despues'], r['movidos'], r['omitidos'], r['errores'], r['cierra']), (9, 6, 3, 4, 1, True))
    chk('mover: los nuevos y el de 90 dias justos no se tocaron', all(x not in res for x in ('N1', 'L90')), True)
    chk('NADA se borro, se guardo, se mando ni se asigno: la bitacora esta vacia', B, [])
    mdm = texto_movimientos(r, p, cuando=hoy)
    chk('registro: dice movidos, omitidos, errores y la cuenta', all(x in mdm for x in ('eliminados»: **3**', 'Omitidos: **4**', 'error: **1**', 'antes: **9** · después: **6**', 'item bloqueado')), True)

    # ── ROJOS
    # un plan armado a mano con un borrador nuevo: no alcanza con estar en la lista, tiene que figurar como viejo
    mod_n1 = L._hm(L._sin_zona(por_id['N1'].LastModificationTime))
    r2 = mover(ns, {'dias': 90, 'candidatos': [{'id': 'N1', 'modificado': mod_n1, 'dias': 3, 'asunto': 'Nuevo'}]}, registro, hoy=hoy)
    chk('ROJO: un borrador de 3 dias metido en la lista no se mueve', (r2['movidos'], 'N1' in movs), (0, False))
    # la edad se mide contra el ITEM: una lista tocada a mano (dias 500, o el umbral del plan en -1) no alcanza
    r2b = mover(ns, {'dias': 90, 'candidatos': [{'id': 'N1', 'modificado': mod_n1, 'dias': 500, 'asunto': 'Nuevo'}]}, registro, hoy=hoy)
    r2c = mover(ns, {'dias': -1, 'candidatos': [{'id': 'N1', 'modificado': mod_n1, 'dias': 500, 'asunto': 'Nuevo'}]}, registro, hoy=hoy)
    chk('ROJO: con la lista adulterada (dias 500, umbral -1) el de 3 dias tampoco se mueve; el piso es 30',
        (r2b['movidos'], r2c['movidos'], 'N1' in movs, 'tiene 3 días' in r2c['filas'][0]['motivo']), (0, 0, False, True))
    mod_l90 = L._hm(L._sin_zona(por_id['L90'].LastModificationTime))
    r2d = mover(ns, {'dias': 90, 'candidatos': [{'id': 'L90', 'modificado': mod_l90, 'dias': 91, 'asunto': 'x'}]}, registro, hoy=hoy)
    chk('ROJO: el de 90 dias justos no se mueve aunque la lista diga 91', (r2d['movidos'], 'L90' in movs), (0, False))
    # correr dos veces no mueve de nuevo ni rompe: los ya movidos «ya no estan en Borradores»
    r3 = mover(ns, json.loads(json.dumps(p)), registro, hoy=hoy)
    chk('ROJO: una segunda corrida no mueve nada mas', (r3['movidos'], sorted(movs)), (0, ['V1', 'V2', 'V3']))
    # si no se pueden ver las ventanas abiertas, no se mueve ninguno
    B4, movs4 = [], []
    ns4, _b4, _e4, _ = outlook_falso(B4, movs4, [('V9', 500, 'Viejo', 0, None)], hoy)
    t4, v4 = candidatos(ns4, [], hoy=hoy)
    ns4.Application = None
    r4 = mover(ns4, plan(t4, v4, hecha=hoy), [], hoy=hoy)
    chk('ROJO: sin poder ver las ventanas abiertas no se mueve ninguno', (r4['movidos'], r4['omitidos'], movs4), (0, 1, []))

    # ── el candado del borrador de un programa tiene DOS mitades y cada una alcanza sola
    def mundo(filas):
        b, m = [], []
        n, bo, el, pi = outlook_falso(b, m, filas, hoy)
        t, v = candidatos(n, [], hoy=hoy)
        return n, bo, pi, m, b, json.loads(json.dumps(plan(t, v, hecha=hoy)))
    n6, _bo, _pi, m6, _b, p6 = mundo([('PX', 300, 'De un programa', 0, None)])
    r6 = mover(n6, p6, [{'entry_id': 'px'}], hoy=hoy)                 # la lista no lo marca; el registro de hoy si
    chk('ROJO programa: lo frena el registro aunque la lista no lo marque', (r6['movidos'], m6), (0, []))
    n7, _bo, _pi, m7, _b, p7 = mundo([('PX', 300, 'De un programa', 0, None)])
    p7['candidatos'][0]['de_programa'] = True
    r7 = mover(n7, p7, [], hoy=hoy)                                   # la lista lo marca; el registro de hoy no
    chk('ROJO programa: lo frena la marca de la lista aunque el registro ya no lo tenga', (r7['movidos'], m7), (0, []))

    # ── ventanas: una que no se deja leer frena a todos; el que se escribe en el panel de lectura tambien cuenta
    class _Rota(object):
        @property
        def CurrentItem(self):
            raise RuntimeError('ventana sin item')
    n8, _bo, _pi, m8, _b, p8 = mundo([('V8', 300, 'Viejo', 0, None)])
    n8.Application = type('_AppR', (object,), {'Inspectors': L._Lista([_Rota()])})()
    r8 = mover(n8, p8, [], hoy=hoy)
    chk('ROJO: con una ventana que no se deja leer no se mueve ninguno', (r8['movidos'], m8), (0, []))
    n9, _bo, pi9, m9, _b, p9 = mundo([('V9', 300, 'En el panel de lectura', 0, None), ('V10', 300, 'Otro', 0, None)])
    explorador = type('_Exp', (object,), {'ActiveInlineResponse': pi9['V9']})()
    n9.Application = type('_AppE', (object,), {'Inspectors': L._Lista([]), 'Explorers': L._Lista([explorador])})()
    r9 = mover(n9, p9, [], hoy=hoy)
    chk('ROJO: el que se esta escribiendo en el panel de lectura no se mueve; el otro si', m9, ['V10'])

    # ── lo que Outlook contesta mal: se anota como error, no como «ya no existe», y no corta
    n10, bo10, pi10, m10, _b, p10 = mundo([('V11', 300, 'Uno', 0, None), ('V12', 300, 'Dos', 0, None)])
    real = n10.GetItemFromID
    n10.GetItemFromID = lambda e: (_ for _ in ()).throw(RuntimeError('la llamada fue rechazada')) if e == 'V11' else real(e)
    p10['candidatos'].insert(1, None)                                 # y un renglon de la lista que no es un borrador
    r10 = mover(n10, p10, [], hoy=hoy)
    chk('ROJO: una llamada rechazada es un error (no «ya no existe»), un renglon roto tambien, y el ultimo se mueve igual',
        ([f['resultado'] for f in r10['filas']], 'rechazada' in r10['filas'][0]['motivo'], m10), (['error', 'error', 'movido'], True, ['V12']))
    # el movimiento se hace y Outlook no deja confirmar donde quedo: error que manda a mirar, y la cuenta no cierra
    n11, bo11, pi11, m11, _b, p11 = mundo([('V13', 300, 'Uno', 0, None)])
    pi11['V13']._c['_parent_tira_despues'] = True
    r11 = mover(n11, p11, [], hoy=hoy)
    chk('ROJO: movido sin confirmar queda como error con «mirarlo», y `cierra` avisa que la cuenta no da',
        (r11['filas'][0]['resultado'], 'no confirmó' in r11['filas'][0]['motivo'], r11['cierra'], m11), ('error', True, False, ['V13']))
    # si la cuenta final falla, igual se devuelven las filas (y ya se avisaron una por una)
    n12, bo12, pi12, m12, _b, p12 = mundo([('V14', 300, 'Uno', 0, None)])
    avisos = []
    veces = [0]
    carp12 = n12.GetDefaultFolder(L.BORRADORES)

    class _NsQueFalla(object):
        def __getattr__(self, k):
            return getattr(n12, k)

        def GetDefaultFolder(self, n):
            if n == L.BORRADORES:
                veces[0] += 1
                if veces[0] >= 3:                                    # 1: mover(), 2: la cuenta de antes, 3: la de despues
                    raise RuntimeError('la llamada fue rechazada')
            return n12.GetDefaultFolder(n)
    r12 = mover(_NsQueFalla(), p12, [], hoy=hoy, al_fila=lambda f: avisos.append(f['resultado']))
    chk('ROJO: si la cuenta final falla, lo movido ya quedo avisado y la corrida devuelve sus filas',
        (avisos, r12['movidos'], r12['despues'], r12['cierra']), (['movido'], 1, None, False))
    # si Eliminados no se puede ubicar (o es la misma carpeta que Borradores), se corta antes de tocar nada
    B5, movs5 = [], []
    ns5, b5, _e5, _ = outlook_falso(B5, movs5, [('V9', 500, 'Viejo', 0, None)], hoy)
    b5.Store = _Store(b5)
    try:
        mover(ns5, {'dias': 90, 'candidatos': []}, [])
        chk('ROJO: si Eliminados resulta ser Borradores, se corta', 'no corto', 'corta')
    except RuntimeError:
        chk('ROJO: si Eliminados resulta ser Borradores, se corta', 'corta', 'corta')
    # el gemelo: el Outlook de mentira SI ve un borrado y un movimiento a otra carpeta
    testigo, mt = [], []
    nsg, bg, _eg, pg = outlook_falso(testigo, mt, [('G1', 500, 'Gemelo', 0, None)], hoy)
    pg['G1'].Delete()
    pg['G1'].Move(bg)
    pg['G1'].Subject = 'x'
    chk('GEMELO: borrar, mover a otra carpeta y asignar un campo quedan anotados',
        ([t[0] for t in testigo], mt), (['Delete', 'Move a otra carpeta', 'asignar Subject'], []))

    total = 31
    if fallas:
        print('FALLARON %d: %s' % (len(fallas), ' | '.join(fallas)))
        return 1
    print('todo verde (mailsBorradores, %d casos)' % total)
    return 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(errors='replace')
    except Exception:
        pass
    if '--selftest' in sys.argv:
        sys.exit(selftest())
    print('uso: python scripts/_lib/mailsBorradores.py --selftest   (las funciones las usa scripts/_mails.py)')
