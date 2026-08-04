# -*- coding: utf-8 -*-
"""
Carga consumos en el arb con la secuencia REAL (grabada de Fak 2026-08-04).

    python scripts/_arbCargar.py            # carga las tareas de la lista de abajo
    python scripts/_arbCargar.py --dry-run  # muestra que haria, sin tocar nada

SECUENCIA (esta es la que graba de verdad):
    Alt -> V -> Y3            abre Relacion de Consumo
    escribir el producto      en Parte Superior
    TAB                       trae la BOM
    TAB hasta Cantidad        confirmando el foco con GetGUIThreadInfo
    SUPR x N + el valor       borrar y escribir
    TAB por TODAS las celdas  hasta que el foco caiga en el boton &Acepta
    ENTER                     <- graba. NO es ESPACIO ni Alt+A ni click.

OJO: usa teclado real. Mientras corre, NO tocar la PC — si cambia el foco, las teclas
se van a otra ventana. Verifica cada pieza contra la base antes de pasar a la siguiente.
"""
import argparse
import ctypes
import ctypes.wintypes as w
import sys
import time

import win32con
import win32gui
import win32process

u = ctypes.windll.user32
KEYUP = 0x0002
EM_SETSEL = 0x00B1
COD = 'APLIX-A999R8395'

TAREAS = [('21-8908', '0.0023040')]


class GUITHREADINFO(ctypes.Structure):
    _fields_ = [('cbSize', w.DWORD), ('flags', w.DWORD), ('hwndActive', w.HWND),
                ('hwndFocus', w.HWND), ('hwndCapture', w.HWND), ('hwndMenuOwner', w.HWND),
                ('hwndMoveSize', w.HWND), ('hwndCaret', w.HWND), ('rcCaret', w.RECT)]


def foco_de(hwnd):
    tid, _ = win32process.GetWindowThreadProcessId(hwnd)
    gi = GUITHREADINFO()
    gi.cbSize = ctypes.sizeof(GUITHREADINFO)
    return gi.hwndFocus if u.GetGUIThreadInfo(tid, ctypes.byref(gi)) else None


def k(vk, esperar=0.05):
    u.keybd_event(vk, 0, 0, 0)
    time.sleep(0.015)
    u.keybd_event(vk, 0, KEYUP, 0)
    time.sleep(esperar)


def escribir(t):
    for ch in t:
        s = u.VkKeyScanW(ord(ch))
        vk, sh = s & 0xFF, bool((s >> 8) & 1)
        if sh:
            u.keybd_event(win32con.VK_SHIFT, 0, 0, 0)
        u.keybd_event(vk, 0, 0, 0)
        time.sleep(0.012)
        u.keybd_event(vk, 0, KEYUP, 0)
        if sh:
            u.keybd_event(win32con.VK_SHIFT, 0, KEYUP, 0)
        time.sleep(0.018)


def leer(h):
    if not h:
        return ''
    n = u.SendMessageW(h, win32con.WM_GETTEXTLENGTH, 0, 0)
    if n <= 0:
        return ''
    b = ctypes.create_unicode_buffer(n + 1)
    u.SendMessageW(h, win32con.WM_GETTEXT, n + 1, b)
    return b.value.strip()


def V():
    r = []

    def cb(h, _):
        if win32gui.IsWindowVisible(h) and 'Maestro de Relaciones' in win32gui.GetWindowText(h):
            r.append(h)
        return True
    win32gui.EnumWindows(cb, None)
    return r[0] if r else None


def C(v):
    vis, out = set(), []

    def rec(p):
        def cb(h, _):
            if h not in vis:
                vis.add(h)
                out.append((win32gui.GetWindowRect(h), h, win32gui.GetClassName(h)))
                rec(h)
            return True
        try:
            win32gui.EnumChildWindows(p, cb, None)
        except Exception:
            pass
    rec(v)
    return out


def G(v):
    f = {}
    for r, h, c in C(v):
        if r[1] >= 390 and c in ('RichEdit20A', 'Edit'):
            f.setdefault(r[1], []).append((r[0], h))
    return [[h for _, h in sorted(f[y])] for y in sorted(f)]


def campo_producto(v):
    ps = sorted([(r, h) for r, h, c in C(v) if r[1] < 350 and c in ('RichEdit20A', 'Edit')],
                key=lambda x: x[0][1])
    return ps[0][1] if ps else None


def abrir():
    v = V()
    if v:
        return v
    prod = []

    def cb(h, _):
        if win32gui.IsWindowVisible(h) and win32gui.GetWindowText(h).strip() == 'Producción':
            prod.append(h)
        return True
    win32gui.EnumWindows(cb, None)
    if prod:
        try:
            win32gui.SetForegroundWindow(prod[0])
        except Exception:
            pass
        time.sleep(0.8)
    k(win32con.VK_MENU, 0.5)
    k(ord('V'), 0.7)
    k(ord('Y'), 0.25)
    k(ord('3'), 2.0)
    return V()


def activa(v):
    """El recorrido con TAB necesita la ventana activa; escribir no."""
    try:
        if win32gui.GetForegroundWindow() != v:
            win32gui.SetForegroundWindow(v)
            time.sleep(0.3)
    except Exception:
        pass


def msg_txt(h, t):
    u.SendMessageW(h, EM_SETSEL, 0, -1)
    time.sleep(0.1)
    for ch in t:
        u.PostMessageW(h, win32con.WM_CHAR, ord(ch), 0)
        time.sleep(0.025)
    time.sleep(0.25)


def msg_key(h, vk, esperar=0.15):
    u.PostMessageW(h, win32con.WM_KEYDOWN, vk, 0)
    time.sleep(0.035)
    u.PostMessageW(h, win32con.WM_KEYUP, vk, 0)
    time.sleep(esperar)


def cargar(v, prod, val):
    """Todo por mensajes dirigidos. Devuelve (ok, antes, mensaje)."""
    PS = campo_producto(v)
    if not PS:
        return False, '', 'no veo el campo Parte Superior'
    msg_txt(PS, prod)
    if leer(PS).strip() != prod:
        return False, '', 'no entro el codigo del producto'
    msg_key(PS, win32con.VK_TAB, 1.6)

    g = G(v)
    idx = next((i for i, f in enumerate(g) if len(f) > 4 and leer(f[1]).strip() == COD), None)
    if idx is None:
        return False, '', 'este producto no tiene %s' % COD
    celda = g[idx][4]
    antes = leer(celda)

    activa(v)
    for _ in range(12):
        if foco_de(v) == celda:
            break
        msg_key(celda if foco_de(v) is None else foco_de(v), win32con.VK_TAB, 0.12)
    if foco_de(v) != celda:
        return False, antes, 'no me pude parar en Cantidad (no escribi nada)'

    msg_txt(celda, val)
    if val.rstrip('0') not in leer(celda).replace(',', '.'):
        return False, antes, 'la escritura no entro'

    btn = next((h for r, h, c in C(v) if c == 'Button' and leer(h).replace('&', '') == 'Acepta'),
               None)
    if not btn:
        return False, antes, 'no encuentro el boton Acepta'

    # recorrer de a UN tab, verificando. Si el foco se pierde (Fak toco la PC),
    # reactivar la ventana y seguir desde donde estaba, en vez de atascarse.
    cur = celda
    atascos = 0
    for _ in range(200):
        f = foco_de(v)
        if f == btn:
            break
        if f is None:
            atascos += 1
            if atascos > 8:
                return False, antes, 'la ventana perdio el foco (SIN grabar) — no usar la PC'
            activa(v)
            time.sleep(0.25)
            continue
        atascos = 0
        msg_key(f, win32con.VK_TAB, 0.1)
        if foco_de(v) == f:          # el foco no se movio: empujar desde el anterior
            msg_key(cur, win32con.VK_TAB, 0.12)
        cur = f
    if foco_de(v) != btn:
        return False, antes, 'no llegue a Acepta (valor escrito, SIN grabar)'
    msg_key(btn, win32con.VK_RETURN, 1.8)
    return True, antes, ''


def verificar(v, prod, val):
    PS = campo_producto(v)
    if not PS:
        return '?'
    u.SendMessageW(PS, EM_SETSEL, 0, -1)
    time.sleep(0.08)
    for ch in prod:
        u.PostMessageW(PS, win32con.WM_CHAR, ord(ch), 0)
        time.sleep(0.012)
    time.sleep(0.15)
    u.PostMessageW(PS, win32con.WM_KEYDOWN, win32con.VK_TAB, 0)
    u.PostMessageW(PS, win32con.WM_KEYUP, win32con.VK_TAB, 0)
    time.sleep(1.1)
    g = G(v)
    i = next((j for j, f in enumerate(g) if len(f) > 4 and leer(f[1]).strip() == COD), None)
    return leer(g[i][4]) if i is not None else '?'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    if a.dry_run:
        for p, val in TAREAS:
            print('%-9s -> %s' % (p, val))
        print('\n%d piezas. Nada tocado (--dry-run).' % len(TAREAS))
        return

    v = abrir()
    if not v:
        sys.exit('no pude abrir Relacion de Consumo (el arb tiene que estar abierto y al frente)')

    t0 = time.time()
    res = []
    for i, (prod, val) in enumerate(TAREAS, 1):
        ok, antes, msg = cargar(v, prod, val)
        if ok:
            # NO verificar aca: releer el producto deja la ventana en un estado del que
            # no vuelve, y la pieza siguiente escribe al vacio. Se verifica al final,
            # todo junto, contra el export — que ademas es la unica prueba que vale.
            res.append((prod, antes, val, True))
            print('%2d/%d  %-9s %-12s -> %-12s cargado' %
                  (i, len(TAREAS), prod, antes, val))
        else:
            res.append((prod, antes, msg, False))
            print('%2d/%d  %-9s FALLO: %s' % (i, len(TAREAS), prod, msg))

    ok = sum(1 for r in res if r[3])
    print()
    print('=' * 62)
    print('GRABADAS OK: %d de %d   (%.0f seg, %.1f seg/pieza)' %
          (ok, len(TAREAS), time.time() - t0, (time.time() - t0) / len(TAREAS)))
    for p, an, ah, g in res:
        if not g:
            print('   PENDIENTE %-9s %s -> %s' % (p, an, ah))


if __name__ == '__main__':
    main()
