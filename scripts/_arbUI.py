# -*- coding: utf-8 -*-
"""
Hablarle a la ventana del ERP arb en SEGUNDO PLANO, sin robar el foco ni el teclado.

Los campos del arb son controles Win32 reales (RichEdit20A / Edit), cada uno con su handle.
Eso permite leerlos con WM_GETTEXT mientras Fak usa la PC para otra cosa.

    python scripts/_arbUI.py --leer            # BOM que est� en pantalla ahora
    python scripts/_arbUI.py --leer --json     # lo mismo, para consumir desde otro script
    python scripts/_arbUI.py --controles       # volcado de todos los controles y sus handles

ESCRITURA: todav�a NO. Ver la secci�n "Por qu� leer s� y escribir no" abajo y la skill
`arb-operar`. Antes de que esto escriba hace falta backup verificado del arb + OK de Fak.

Requiere que el arb est� abierto en:
  Men� de Insumos -> Relaci�n de Consumo de Prod. Terminados
con un producto ya tra�do (escribir el c�digo en "Parte Superior" y TAB).
"""
import argparse
import ctypes
import json
import sys

import win32con
import win32gui

user32 = ctypes.windll.user32

VENTANA = 'Maestro de Relaciones'
COLS = ['rubro', 'codigo', 'descripcion', 'unidad', 'cantidad', 'modulo', 'proceso']
EDITABLES = ('RichEdit20A', 'Edit')


def leer_control(h):
    """Texto de un control, v�a WM_GETTEXT. No toca el foco."""
    n = user32.SendMessageW(h, win32con.WM_GETTEXTLENGTH, 0, 0)
    if n <= 0:
        return ''
    buf = ctypes.create_unicode_buffer(n + 1)
    user32.SendMessageW(h, win32con.WM_GETTEXT, n + 1, buf)
    return buf.value.strip()


def ventana_arb():
    encontradas = []

    def cb(h, _):
        if win32gui.IsWindowVisible(h) and VENTANA in win32gui.GetWindowText(h):
            encontradas.append(h)
        return True

    win32gui.EnumWindows(cb, None)
    if not encontradas:
        sys.exit('No encuentro la ventana "%s".\n'
                 'Abrir: Men� de Insumos -> Relaci�n de Consumo de Prod. Terminados' % VENTANA)
    return encontradas[0]


def controles(raiz):
    """Todos los controles, deduplicados por handle. (rect, hwnd, clase)"""
    vistos, out = set(), []

    def rec(padre):
        def cb(h, _):
            if h not in vistos:
                vistos.add(h)
                out.append((win32gui.GetWindowRect(h), h, win32gui.GetClassName(h)))
                rec(h)
            return True
        try:
            win32gui.EnumChildWindows(padre, cb, None)
        except Exception:
            pass

    rec(raiz)
    return out


def leer_pantalla():
    """Devuelve {producto, descripcion, filas:[{col: valor, _hwnd:{col: handle}}]}"""
    raiz = ventana_arb()
    ctrls = controles(raiz)

    cabecera = sorted([c for c in ctrls if c[0][1] < 350], key=lambda x: x[0][0])
    producto = desc = ''
    for r, h, c in cabecera:
        v = leer_control(h)
        if not v or v.startswith('Parte Superior'):
            continue
        if c in EDITABLES and not producto:
            producto = v
        elif c == 'Static' and producto and not desc:
            desc = v

    # la grilla: agrupar por Y (fila) y ordenar por X (columna)
    por_fila = {}
    for r, h, c in ctrls:
        if r[1] >= 390 and c in EDITABLES:
            por_fila.setdefault(r[1], []).append((r[0], h))

    filas = []
    for y in sorted(por_fila):
        handles = [h for _, h in sorted(por_fila[y])]
        vals = [leer_control(h) for h in handles]
        if not any(vals):
            continue
        fila = {COLS[i]: (vals[i] if i < len(vals) else '') for i in range(len(COLS))}
        fila['_hwnd'] = {COLS[i]: handles[i] for i in range(min(len(COLS), len(handles)))}
        filas.append(fila)

    return {'producto': producto, 'descripcion': desc, 'filas': filas}


def main():
    ap = argparse.ArgumentParser(description='Leer el arb en segundo plano (solo lectura)')
    ap.add_argument('--leer', action='store_true', help='BOM en pantalla')
    ap.add_argument('--json', action='store_true', help='salida JSON')
    ap.add_argument('--controles', action='store_true', help='volcado de controles y handles')
    a = ap.parse_args()

    if a.controles:
        for r, h, c in sorted(controles(ventana_arb()), key=lambda x: (x[0][1], x[0][0])):
            v = leer_control(h) if c in EDITABLES + ('Static',) else ''
            print('hwnd=%-10d %-20s rect=%-26s %s' % (h, c, str(r), v[:40]))
        return

    if a.leer or not (a.controles):
        d = leer_pantalla()
        if a.json:
            print(json.dumps(d, ensure_ascii=False, indent=2))
            return
        print('Producto : %s   %s' % (d['producto'], d['descripcion']))
        print()
        print('%-3s %-6s %-18s %-28s %-5s %-13s %-6s %s' %
              ('#', 'Rubro', 'Codigo', 'Descripcion', 'U.M.', 'Cantidad', 'Mod.', 'Proceso'))
        for i, f in enumerate(d['filas'], 1):
            print('%-3d %-6s %-18s %-28s %-5s %-13s %-6s %s' % (
                i, f['rubro'], f['codigo'], f['descripcion'][:28], f['unidad'],
                f['cantidad'], f['modulo'], f['proceso']))
        print()
        print('filas: %d' % len(d['filas']))


if __name__ == '__main__':
    main()
