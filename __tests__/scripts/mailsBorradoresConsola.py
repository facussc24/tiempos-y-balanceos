# -*- coding: utf-8 -*-
"""La CONSOLA de `scripts/_mails.py --limpiar-borradores [--mover]` contra un Outlook de mentira (lo corre
mailsBorradores.test.mjs). El selftest de `mailsBorradores.py` prueba la logica; esto prueba el camino entero: lo que
imprime, lo que devuelve, los archivos que deja y lo que le hace a Outlook.

Uso: BARACK_MAIL_CACHE=<carpeta temporal> python mailsBorradoresConsola.py <carpeta de salida>
     (imprime un renglon JSON por caso)
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
import mailsBorradores as M  # noqa: E402

SALIDA = sys.argv[1]
L.LECTURAS = L.LECTURAS | M.LECTURAS_ITEM_MAS
B, movs = [], []
hoy = datetime.datetime.now()
ns, borr, elim, por_id = M.outlook_falso(B, movs, [
    ('V1', 400, 'Viejo uno', 1, None), ('V2', 95, 'Viejo dos', 0, None), ('N1', 10, 'De este mes', 0, None),
    ('P1', 300, 'Viejo de un programa', 0, None),
    ('E1', 200, 'El que tira', 0, {'_tira_al_mover': RuntimeError('item bloqueado')})], hoy)
os.makedirs(_mails.CACHE, exist_ok=True)
with io.open(os.path.join(_mails.CACHE, 'borradores_claude.json'), 'w', encoding='utf-8') as fh:
    json.dump([{'entry_id': 'P1', 'clave': 'viejo de un programa'}], fh)

abierto = [True]
_mails._outlook = lambda: ns
_mails._outlook_de_la_persona = lambda: (_ for _ in ()).throw(RuntimeError('limpiar-borradores no puede abrir Outlook'))
_mails._vigilado = lambda fn, que: fn()
outlook_abierto_real = _mails._outlook_abierto
_mails._outlook_abierto = lambda: abierto[0]
no_vacia = lambda: False


def caso(nombre, fn):
    viejo_out = sys.stdout
    sys.stdout = buf = io.StringIO()
    try:
        cod = fn()
    except SystemExit as e:
        cod = 'exit:%s' % e.code
    finally:
        sys.stdout = viejo_out
    print(json.dumps({'caso': nombre, 'codigo': cod, 'salida': buf.getvalue(), 'movs': list(movs),
                      'archivos': sorted(os.listdir(SALIDA)) if os.path.isdir(SALIDA) else []}, ensure_ascii=True))


caso('mover sin lista', lambda: _mails.limpiar_borradores(mover=True, carpeta=SALIDA, vacia=no_vacia))
abierto[0] = False
caso('outlook cerrado', lambda: _mails.limpiar_borradores(carpeta=SALIDA, vacia=no_vacia))
abierto[0] = True
caso('menos de 30 dias', lambda: _mails.limpiar_borradores(dias=5, carpeta=SALIDA, vacia=no_vacia))
caso('lista', lambda: _mails.limpiar_borradores(carpeta=SALIDA, vacia=no_vacia))
caso('eliminados se vacia al cerrar', lambda: _mails.limpiar_borradores(mover=True, carpeta=SALIDA, vacia=lambda: True))
caso('no se sabe si se vacia', lambda: _mails.limpiar_borradores(mover=True, carpeta=SALIDA, vacia=lambda: None))
caso('viejos distinto de la lista', lambda: _mails.limpiar_borradores(mover=True, dias=60, carpeta=SALIDA, vacia=no_vacia))
REG = os.path.join(_mails.CACHE, 'borradores_claude.json')
bueno = io.open(REG, encoding='utf-8').read()
with io.open(REG, 'w', encoding='utf-8') as fh:
    fh.write('[{"entry_id": "P1", "cla')                      # a medio escribir
caso('registro ilegible', lambda: _mails.limpiar_borradores(mover=True, carpeta=SALIDA, vacia=no_vacia))
with io.open(REG, 'w', encoding='utf-8') as fh:
    fh.write(bueno)
caso('mover', lambda: _mails.limpiar_borradores(mover=True, carpeta=SALIDA, vacia=no_vacia))
caso('mover otra vez', lambda: _mails.limpiar_borradores(mover=True, carpeta=SALIDA, vacia=no_vacia))
caso('lista despues de mover', lambda: _mails.limpiar_borradores(carpeta=SALIDA, vacia=no_vacia))


# las tres funciones que el resto de esta corrida reemplaza, con lo que les puede contestar Windows
def tira(*a):
    raise OSError('sin clave')


def reg(valores):
    def leer(clave):
        if clave not in valores:
            raise OSError('sin clave')
        return valores[clave]
    return leer


POL, PREF = (b % '16.0' for b in (r'Software\Policies\Microsoft\Office\%s\Outlook\Preferences', r'Software\Microsoft\Office\%s\Outlook\Preferences'))
print(json.dumps({'caso': 'PURAS',
                  'abierto': [outlook_abierto_real(pids=lambda: [123]), outlook_abierto_real(pids=lambda: []), outlook_abierto_real(pids=tira)],
                  'vacia': [_mails._vacia_al_cerrar(leer=tira), _mails._vacia_al_cerrar(leer=reg({PREF: None})),
                            _mails._vacia_al_cerrar(leer=reg({PREF: 1})), _mails._vacia_al_cerrar(leer=reg({PREF: 0, POL: 1})),
                            _mails._vacia_al_cerrar(leer=reg({PREF: 1, POL: 0}))],
                  'registro': [_mails._registro_programas(os.path.join(_mails.CACHE, 'no-existe.json')), _mails._registro_programas(REG)[1]]}))
print(json.dumps({'caso': 'FIN', 'bitacora': B, 'movs': movs,
                  'log': [json.loads(l)['resultado'] for l in io.open(os.path.join(SALIDA, 'movimientos.jsonl'), encoding='utf-8') if l.strip()],
                  'borradores': sorted(x._c['EntryID'] for x in borr.Items._l),
                  'eliminados': sorted(x._c['EntryID'] for x in elim.Items._l),
                  'lista_md': io.open(os.path.join(SALIDA, 'lista.md'), encoding='utf-8').read(),
                  'movimientos_md': io.open(os.path.join(SALIDA, 'movimientos.md'), encoding='utf-8').read()}))
