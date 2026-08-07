# -*- coding: utf-8 -*-
"""Ver y operar el arb con clicks reales. Uso:
     python arbver.py foto            -> captura la ventana de Relaciones a rel.png
     python arbver.py foto prod       -> captura la ventana principal
     python arbver.py click X Y       -> click real en coordenadas de VENTANA (no de pantalla)
     python arbver.py estado          -> ventanas, modales y foco
"""
import ctypes, ctypes.wintypes as w, subprocess, sys, time
from PIL import Image

u = ctypes.windll.user32; k = ctypes.windll.kernel32; g = ctypes.windll.gdi32
CB = ctypes.WINFUNCTYPE(w.BOOL, w.HWND, w.LPARAM)
BASE = r'C:\Users\FACUND~1\AppData\Local\Temp\claude\C--Dev-BarackMercosul\0fe4e13b-5c8b-455a-805a-69bd34e16439\scratchpad'


class R(ctypes.Structure):
    _fields_ = [('l', ctypes.c_long), ('t', ctypes.c_long), ('r', ctypes.c_long), ('b', ctypes.c_long)]


class GUI(ctypes.Structure):
    _fields_ = [('cbSize', ctypes.c_uint), ('flags', ctypes.c_uint), ('hwndActive', w.HWND),
                ('hwndFocus', w.HWND), ('hwndCapture', w.HWND), ('hwndMenuOwner', w.HWND),
                ('hwndMoveSize', w.HWND), ('hwndCaret', w.HWND), ('rcCaret', R)]


class BI(ctypes.Structure):
    _fields_ = [('biSize', ctypes.c_uint32), ('biWidth', ctypes.c_int32), ('biHeight', ctypes.c_int32),
                ('biPlanes', ctypes.c_uint16), ('biBitCount', ctypes.c_uint16), ('biCompression', ctypes.c_uint32),
                ('biSizeImage', ctypes.c_uint32), ('biX', ctypes.c_int32), ('biY', ctypes.c_int32),
                ('biClrUsed', ctypes.c_uint32), ('biClrImp', ctypes.c_uint32)]


def cls(h):
    b = ctypes.create_unicode_buffer(256); u.GetClassNameW(h, b, 256); return b.value


def txt(h):
    n = u.GetWindowTextLengthW(h) + 1; b = ctypes.create_unicode_buffer(n)
    u.GetWindowTextW(h, b, n); return b.value


def pid(h):
    p = w.DWORD(); u.GetWindowThreadProcessId(h, ctypes.byref(p)); return p.value


def pids_arb():
    out = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq produc.exe', '/FO', 'CSV'],
                         capture_output=True, text=True).stdout
    return {int(l.split('","')[1]) for l in out.splitlines()[1:] if l.startswith('"produc.exe"')}


def ventanas():
    ps = pids_arb(); v = []

    def cb(h, l):
        if pid(h) in ps and u.IsWindowVisible(h):
            v.append(h)
        return True
    u.EnumWindows(CB(cb), 0)
    return v


def buscar(clave='rel'):
    for h in ventanas():
        if clave == 'rel' and 'Maestro de Relaciones' in txt(h):
            return h
        if clave == 'prod' and cls(h) == 'ProdWindow':
            return h
    return None


def foto(h, nombre):
    r = R(); u.GetWindowRect(h, ctypes.byref(r))
    W, H = r.r - r.l, r.b - r.t
    hdc = u.GetWindowDC(h); mdc = g.CreateCompatibleDC(hdc)
    bmp = g.CreateCompatibleBitmap(hdc, W, H); g.SelectObject(mdc, bmp)
    u.PrintWindow(h, mdc, 2)
    bi = BI(); bi.biSize = ctypes.sizeof(bi); bi.biWidth = W; bi.biHeight = -H
    bi.biPlanes = 1; bi.biBitCount = 32
    buf = ctypes.create_string_buffer(W * H * 4)
    g.GetDIBits(mdc, bmp, 0, H, buf, ctypes.byref(bi), 0)
    p = '%s\\%s.png' % (BASE, nombre)
    Image.frombuffer('RGB', (W, H), buf, 'raw', 'BGRX', 0, 1).save(p)
    g.DeleteObject(bmp); g.DeleteDC(mdc); u.ReleaseDC(h, hdc)
    print('%s  ventana en (%d,%d) tamano %dx%d' % (p, r.l, r.t, W, H))
    return p


def click(h, dx, dy):
    """dx,dy en coordenadas de la VENTANA (las mismas de la captura)."""
    r = R(); u.GetWindowRect(h, ctypes.byref(r))
    tid = u.GetWindowThreadProcessId(h, None); me = k.GetCurrentThreadId()
    u.AttachThreadInput(me, tid, True)
    try:
        u.SetForegroundWindow(h); time.sleep(0.35)
        u.SetCursorPos(r.l + dx, r.t + dy); time.sleep(0.3)
        u.mouse_event(0x0002, 0, 0, 0, 0); time.sleep(0.09); u.mouse_event(0x0004, 0, 0, 0, 0)
        time.sleep(0.8)
        gi = GUI(); gi.cbSize = ctypes.sizeof(GUI); u.GetGUIThreadInfo(tid, ctypes.byref(gi))
        print('click en ventana(%d,%d) = pantalla(%d,%d)  hwndFocus=%s' %
              (dx, dy, r.l + dx, r.t + dy, gi.hwndFocus))
    finally:
        u.AttachThreadInput(me, tid, False)


def estado():
    print('ventanas visibles del arb:')
    modales = 0
    for h in ventanas():
        c = cls(h)
        print('   %-14s ena=%-5s %r' % (c, bool(u.IsWindowEnabled(h)), txt(h)[:45]))
        if c == '#32770':
            modales += 1

            def cb2(hh, l):
                t = txt(hh)
                if t.strip():
                    print('        [%s] %s' % (cls(hh), t))
                return True
            u.EnumChildWindows(h, CB(cb2), 0)
    h = buscar('rel') or buscar('prod')
    if h:
        tid = u.GetWindowThreadProcessId(h, None)
        gi = GUI(); gi.cbSize = ctypes.sizeof(GUI); u.GetGUIThreadInfo(tid, ctypes.byref(gi))
        print('hwndActive=%s hwndFocus=%s  (None = el arb NO tiene el foco)' % (gi.hwndActive, gi.hwndFocus))
    print('MODALES ABIERTOS: %d %s' % (modales, '<-- ABORTAR' if modales else ''))
    return modales


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'estado'
    if cmd == 'foto':
        cual = sys.argv[2] if len(sys.argv) > 2 else 'rel'
        h = buscar(cual)
        if not h:
            sys.exit('no encuentro la ventana %s' % cual)
        foto(h, 'rel' if cual == 'rel' else 'prod')
    elif cmd == 'click':
        cual = sys.argv[4] if len(sys.argv) > 4 else 'rel'
        h = buscar(cual)
        if not h:
            sys.exit('no encuentro la ventana %s' % cual)
        click(h, int(sys.argv[2]), int(sys.argv[3]))
    else:
        sys.exit(1 if estado() else 0)
