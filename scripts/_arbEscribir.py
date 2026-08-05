# -*- coding: utf-8 -*-
"""
=====================================================================================
 OBSOLETO — NO USAR. Su premisa es FALSA y su verificacion da un OK que miente.
 Usar `scripts/_arbCargar.py`. Queda solo como registro del intento.
=====================================================================================

Se escribio creyendo que se podia modificar un consumo EN SEGUNDO PLANO, sin robar el
foco. Medido el 2026-08-05: **eso no funciona**. Escribir por mensaje en un control que
NO tiene el foco no entra en el arb — el valor se ve en pantalla y vuelve solo al viejo
en cuanto el foco pasa por ahi (y en un campo de codigo se pierde el guion).

Lo peligroso no es que no ande: es que su salvaguarda de leer-y-comparar **lee la
pantalla**, asi que confirma un valor que la base no tiene. Un OK de este script no
prueba nada. La unica prueba valida es exportar RELACIONES y mirar el archivo.

Ver la skill `arb-operar` y `scripts/_arbCargar.py`: recorre con teclado real, escribe
con el foco puesto y verifica contra el export.
"""
raise SystemExit(__doc__)
import argparse
import ctypes
import json
import os
import sys
import time

import win32con
import win32gui

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _arbUI import leer_pantalla, leer_control  # noqa: E402

user32 = ctypes.windll.user32

EM_SETSEL = 0x00B1
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRE = os.path.join(RAIZ, '.arb-cache', 'pre-cambio')


def tipear(h, texto):
    """Manda el texto tecla por tecla al control, como si se tipeara. Sin robar el foco."""
    # seleccionar todo lo que hay
    user32.SendMessageW(h, EM_SETSEL, 0, -1)
    time.sleep(0.05)
    # borrar la seleccion
    user32.PostMessageW(h, win32con.WM_KEYDOWN, win32con.VK_DELETE, 0)
    user32.PostMessageW(h, win32con.WM_KEYUP, win32con.VK_DELETE, 0)
    time.sleep(0.05)
    # escribir caracter por caracter
    for ch in texto:
        user32.PostMessageW(h, win32con.WM_CHAR, ord(ch), 0)
        time.sleep(0.02)
    time.sleep(0.15)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--codigo', required=True, help='codigo del insumo (columna Medida)')
    ap.add_argument('--valor', required=True, help='consumo nuevo, ej 0.0002560')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    antes = leer_pantalla()
    prod = antes['producto']
    if not prod:
        sys.exit('No hay ningun producto cargado en pantalla.')

    fila = next((f for f in antes['filas'] if f['codigo'].strip() == a.codigo.strip()), None)
    if not fila:
        print('Producto en pantalla: %s' % prod)
        print('Insumos que veo    : %s' % ', '.join(f['codigo'] for f in antes['filas']))
        sys.exit('ABORTO: el codigo "%s" no esta en esta pantalla.' % a.codigo)

    h = fila['_hwnd']['cantidad']
    actual = fila['cantidad']

    print('Producto : %s   %s' % (prod, antes['descripcion']))
    print('Insumo   : %s' % fila['codigo'])
    print('Cantidad : %s   ->   %s' % (actual, a.valor))
    print('control  : hwnd %d' % h)
    print()

    if a.dry_run:
        print('--dry-run: no toque nada.')
        return

    if not os.path.isdir(PRE):
        os.makedirs(PRE)
    snap = os.path.join(PRE, '%s_antes.json' % prod.replace('/', '_'))
    with open(snap, 'w', encoding='utf-8') as f:
        json.dump(antes, f, ensure_ascii=False, indent=2)
    print('estado previo guardado en %s' % snap)

    tipear(h, a.valor)

    despues = leer_control(h)
    print()
    print('valor en la celda ahora: %s' % despues)
    if despues.replace(',', '.') == a.valor.replace(',', '.'):
        print('OK — quedo escrito. FALTA GRABAR (ACEPTA).')
    else:
        print('ATENCION — no quedo como se esperaba.')
        print('   esperado: %s' % a.valor)
        print('   quedo   : %s' % despues)
        print('   valor original para restaurar: %s' % actual)


if __name__ == '__main__':
    main()
