# -*- coding: utf-8 -*-
"""La CONSOLA de las cuatro lecturas de `scripts/_mails.py`, corrida contra un Outlook de mentira (lo corre
mailsLectura.test.mjs). El selftest de `mailsLectura.py` prueba la logica; esto prueba el camino entero: las funciones
de `_mails.py` (`nuevos`, `abrir`, `listar_borradores`, `ver_agenda`, `abrir_adjuntos`), lo que imprimen, lo que
devuelven y lo que escriben en el cache. Al final, la bitacora del Outlook de mentira: solo puede haber un Display.

Uso: BARACK_MAIL_CACHE=<carpeta temporal> python mailsLecturaConsola.py     (imprime un renglon JSON por caso)
"""
import datetime
import io
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', '..', 'scripts'))
sys.path.insert(0, os.path.join(AQUI, '..', '..', 'scripts', '_lib'))
import _mails  # noqa: E402
import mailsLectura as L  # noqa: E402

B = []
hoy = datetime.datetime.now().replace(second=0, microsecond=0)


def f(d):
    return d.replace(tzinfo=L._ZonaFalsa())


def mail(eid, cuando, asunto, **mas):
    campos = dict(EntryID=eid, ReceivedTime=f(cuando), Subject=asunto, Class=L.OL_MAIL, SenderName='Pablo',
                  SenderEmailAddress='p@x', To='Fak', CC='', Body='hola', Attachments=L._Adjuntos(0), UnRead=True)
    campos.update(mas)
    return L._Item(B, **campos)


# `_registro` (el de verdad) lee tres campos que las funciones de lectura no leen: se suman a la lista blanca del
# Outlook de mentira solo para esta corrida.
L.LECTURAS = L.LECTURAS | frozenset(('SenderEmailAddress', 'CC', 'Body'))
nuevo = mail('N1', hoy - datetime.timedelta(hours=2), 'Mail nuevo con ñ y 😀')
conocido = mail('C1', hoy - datetime.timedelta(hours=5), 'Ya estaba')
viejo = mail('V1', hoy - datetime.timedelta(days=40), 'Viejo')
borr = L._Item(B, EntryID='B1', LastModificationTime=f(hoy - datetime.timedelta(days=100)), Subject='Borrador viejo',
               To='Carlos', Attachments=L._Adjuntos(1))


def cita(cuando, asunto, horas=1, **mas):
    campos = dict(EntryID=asunto, Start=f(cuando), End=f(cuando + datetime.timedelta(hours=horas)), Subject=asunto,
                  Location='Sala', IsRecurring=False, MeetingStatus=1, AllDayEvent=False)
    campos.update(mas)
    return L._Item(B, **campos)


# la cita de prueba de la sonda tiene que tener el dia distinto del mes
base = hoy - datetime.timedelta(days=20)
if base.day == base.month:
    base -= datetime.timedelta(days=1)
citas = [cita(hoy - datetime.timedelta(minutes=30), 'En curso'), cita(hoy + datetime.timedelta(days=2), 'Pasado maniana'),
         cita(hoy + datetime.timedelta(days=6), 'Fuera de 3 dias'), cita(base, 'Vieja para la sonda')]
regional = '%d/%m/%Y %H:%M'
ns = L.OutlookFalso(
    [L._Carpeta('f.santoro@x', L._Items([], B), hijas=[L._Carpeta('Bandeja de entrada', L._Items([nuevo, conocido, viejo], B))])],
    especiales={L.BORRADORES: L._Carpeta('Borradores', L._Items([borr], B)),
                L.CALENDARIO: L._CarpetaCal(citas, B, regional, lambda a, b: list(citas)),
                L.TAREAS: L._Carpeta('Tareas', L._Items([], B))},
    todos=[nuevo, conocido])
_mails._outlook_de_la_persona = lambda: ns
_mails._outlook = lambda: ns
_mails._vigilado = lambda fn, que: fn()
L.fecha_regional = lambda d: d.strftime(regional)          # la «PC» de mentira lee dia/mes
_real_agenda = L.agenda
L.agenda = lambda n, dias=7, hoy=None, formato=None: _real_agenda(n, dias=dias, hoy=hoy, formato=L.fecha_regional)

# el cache de prueba: un mail conocido, de hace 5 horas
os.makedirs(_mails.CACHE, exist_ok=True)
with io.open(_mails.MAILS, 'w', encoding='utf-8') as fh:
    fh.write(json.dumps({'id': 'C1', 'carpeta': 'f.santoro@x / Bandeja de entrada', 'fecha': (hoy - datetime.timedelta(hours=5)).strftime('%Y-%m-%d %H:%M'),
                         'de': 'Pablo', 'de_mail': 'p@x', 'para': 'Fak', 'cc': '', 'asunto': 'Ya estaba', 'adjuntos': [], 'cuerpo': ''}) + '\n')


def caso(nombre, fn):
    viejo_out = sys.stdout
    sys.stdout = buf = io.StringIO()
    try:
        cod = fn()
    except SystemExit as e:
        cod = 'exit:%s' % e.code
    finally:
        sys.stdout = viejo_out
    print(json.dumps({'caso': nombre, 'codigo': cod, 'salida': buf.getvalue()}, ensure_ascii=True))


caso('nuevos', lambda: _mails.nuevos())
caso('nuevos otra vez', lambda: _mails.nuevos())
caso('abrir', lambda: _mails.abrir('N1'))
caso('borradores', lambda: _mails.listar_borradores())
caso('agenda 3 dias', lambda: _mails.ver_agenda(dias=3))
caso('agenda json', lambda: _mails.ver_agenda(dias=3, como_json=True))
abiertos = []
caso('adjuntos: la foto del telefono si, la firma no',
     lambda: _mails.abrir_adjuntos(['c:/x/image001.png', 'c:/x/image0.jpeg', 'c:/x/Plano.pdf', 'c:/x/Outlook-abc.png'],
                                   lanzar=lambda r: abiertos.append(os.path.basename(r)) or 0))
caso('adjuntos: solo la firma', lambda: _mails.abrir_adjuntos(['c:/x/image001.png'], lanzar=lambda r: 0))
caso('adjuntos: ninguno', lambda: _mails.abrir_adjuntos([], lanzar=lambda r: 0))
caso('adjuntos: uno que no se ve abierto', lambda: _mails.abrir_adjuntos(['c:/x/Plano.pdf'], lanzar=lambda r: 1))
print(json.dumps({'caso': 'FIN', 'abiertos': abiertos, 'bitacora': B,
                  'cache': [json.loads(l)['id'] for l in io.open(_mails.MAILS, encoding='utf-8') if l.strip()],
                  'agenda_json': os.path.exists(os.path.join(_mails.CACHE, 'agenda.json'))}))
