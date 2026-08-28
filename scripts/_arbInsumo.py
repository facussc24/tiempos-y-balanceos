# -*- coding: utf-8 -*-
"""Operar la ventana `Maestro de Insumos - BA` del arb (ABM de Insumos).

Es la pantalla donde se dan de alta / se modifican los CODIGOS DE INSUMO del maestro.
Aprendida grabando a Fak el 2026-08-28 (`scripts/_arbAprender.py`).

    python scripts/_arbInsumo.py foto [nombre]        captura la ventana (no roba el foco)
    python scripts/_arbInsumo.py solapa <nombre>      Altas|Bajas|Modificaciones|Listado|...
    python scripts/_arbInsumo.py click <X> <Y>        click real, coords de la VENTANA
    python scripts/_arbInsumo.py teclas TAB,ENTER,... teclas reales sobre el foco actual
    python scripts/_arbInsumo.py escribir <texto>     tipea texto en el campo con foco
    python scripts/_arbInsumo.py campos               dump de los controles visibles

NO hace nada solo: cada paso se pide y se mira la foto. La pantalla no tiene deshacer y
`ESC` en el arb NO cancela (avanza de campo): para salir sin grabar se usa `&Cancela`.
"""
import ctypes
import ctypes.wintypes as w
import os
import subprocess
import sys
import time

from PIL import Image

u = ctypes.windll.user32
g = ctypes.windll.gdi32
k = ctypes.windll.kernel32
CB = ctypes.WINFUNCTYPE(w.BOOL, w.HWND, w.LPARAM)

SALIDA = os.environ.get('ARB_SALIDA') or os.path.join(os.path.expanduser('~'), 'arb_fotos')

# Solapas de la ventana, coordenada X del rotulo (Y = 67 en todas)
SOLAPAS = {'altas': 52, 'bajas': 96, 'modificaciones': 160, 'recupera': 231,
           'precios': 287, 'listado': 331, 'control de calidad': 403, 'escape': 477}
Y_SOLAPA = 67

# Campos de la solapa Altas/Modificaciones: (x, y) del centro de la caja
CAMPOS = {'rubro': (215, 152), 'medida': (355, 152), 'descripcion': (370, 181),
          'cc_ingreso': (215, 266), 'imp_ingreso': (477, 266),
          'cc_descarga': (215, 295), 'imp_descarga': (477, 295),
          'unidad': (217, 323), 'doble_medida': (466, 323),
          'stock_minimo': (245, 352), 'lote_optimo': (507, 352),
          'unidad_minima': (245, 380), 'tiempo_entrega': (471, 380),
          'proveedor1': (215, 409), 'cod_original1': (514, 409),
          'proveedor2': (215, 437), 'cod_original2': (514, 437),
          'sub_producto': (204, 466), 'etiquetas': (477, 466),
          'vencimiento': (204, 494), 'tipo_descarga': (466, 494), 'origen_descarga': (650, 494),
          'papp_psw': (204, 523),
          'acepta': (411, 580), 'cancela': (512, 580)}

TECLAS = {'TAB': 0x09, 'ENTER': 0x0D, 'ESC': 0x1B, 'IZQ': 0x25, 'ARRIBA': 0x26,
          'DER': 0x27, 'ABAJO': 0x28, 'SUPR': 0x2E, 'BACKSPACE': 0x08, 'FIN': 0x23,
          'INICIO': 0x24, 'F1': 0x70, 'F3': 0x72, 'ESPACIO': 0x20}


class R(ctypes.Structure):
    _fields_ = [('l', ctypes.c_long), ('t', ctypes.c_long),
                ('r', ctypes.c_long), ('b', ctypes.c_long)]


class GUI(ctypes.Structure):
    _fields_ = [('cbSize', ctypes.c_uint), ('flags', ctypes.c_uint), ('hwndActive', w.HWND),
                ('hwndFocus', w.HWND), ('hwndCapture', w.HWND), ('hwndMenuOwner', w.HWND),
                ('hwndMoveSize', w.HWND), ('hwndCaret', w.HWND), ('rcCaret', R)]


class BI(ctypes.Structure):
    _fields_ = [('biSize', ctypes.c_uint32), ('biWidth', ctypes.c_int32),
                ('biHeight', ctypes.c_int32), ('biPlanes', ctypes.c_uint16),
                ('biBitCount', ctypes.c_uint16), ('biCompression', ctypes.c_uint32),
                ('biSizeImage', ctypes.c_uint32), ('biX', ctypes.c_int32),
                ('biY', ctypes.c_int32), ('biClrUsed', ctypes.c_uint32),
                ('biClrImp', ctypes.c_uint32)]


def cls(h):
    b = ctypes.create_unicode_buffer(256)
    u.GetClassNameW(h, b, 256)
    return b.value


def txt(h):
    if not h:
        return ''
    n = u.GetWindowTextLengthW(h) + 1
    b = ctypes.create_unicode_buffer(n)
    u.GetWindowTextW(h, b, n)
    return b.value


def pid(h):
    p = w.DWORD()
    u.GetWindowThreadProcessId(h, ctypes.byref(p))
    return p.value


def pids_arb():
    out = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq produc.exe', '/FO', 'CSV'],
                         capture_output=True, text=True).stdout
    return {int(l.split('","')[1]) for l in out.splitlines()[1:] if l.startswith('"produc.exe"')}


def rect(h):
    r = R()
    u.GetWindowRect(h, ctypes.byref(r))
    return r


def ventana():
    """La ventana `Maestro de Insumos`. Aborta si no esta abierta."""
    ps = pids_arb()
    if not ps:
        sys.exit('el arb no esta corriendo')
    hit = []

    def cb(h, _l):
        if pid(h) in ps and u.IsWindowVisible(h) and 'Maestro de Insumos' in txt(h):
            hit.append(h)
        return True

    u.EnumWindows(CB(cb), 0)
    if not hit:
        sys.exit('no encuentro la ventana "Maestro de Insumos" — abrila: '
                 'ribbon Menu de Insumos -> ABM de Insumos')
    return hit[0]


def foto(h, nombre='insumo'):
    r = rect(h)
    an, al = r.r - r.l, r.b - r.t
    dc = u.GetWindowDC(h)
    mdc = g.CreateCompatibleDC(dc)
    bm = g.CreateCompatibleBitmap(dc, an, al)
    g.SelectObject(mdc, bm)
    u.PrintWindow(h, mdc, 2)
    bi = BI()
    bi.biSize = ctypes.sizeof(BI)
    bi.biWidth = an
    bi.biHeight = -al
    bi.biPlanes = 1
    bi.biBitCount = 32
    buf = ctypes.create_string_buffer(an * al * 4)
    g.GetDIBits(mdc, bm, 0, al, buf, ctypes.byref(bi), 0)
    g.DeleteObject(bm)
    g.DeleteDC(mdc)
    u.ReleaseDC(h, dc)
    os.makedirs(SALIDA, exist_ok=True)
    p = os.path.join(SALIDA, nombre + '.png')
    Image.frombuffer('RGB', (an, al), buf, 'raw', 'BGRX', 0, 1).save(p)
    print('%s   ventana %dx%d en (%d,%d)' % (p, an, al, r.l, r.t))
    return p


def foco(h):
    tid = u.GetWindowThreadProcessId(h, None)
    gi = GUI()
    gi.cbSize = ctypes.sizeof(GUI)
    u.GetGUIThreadInfo(tid, ctypes.byref(gi))
    return gi.hwndFocus


def activar(h):
    """Traer al frente. AttachThreadInput es obligatorio (medido 2026-08-06)."""
    tid = u.GetWindowThreadProcessId(h, None)
    me = k.GetCurrentThreadId()
    u.AttachThreadInput(me, tid, True)
    try:
        u.SetForegroundWindow(h)
        time.sleep(0.3)
        return u.GetForegroundWindow() == h
    finally:
        u.AttachThreadInput(me, tid, False)


def click(h, dx, dy):
    """Click REAL. Es lo unico que da foco de teclado (foreground != foco)."""
    r = rect(h)
    tid = u.GetWindowThreadProcessId(h, None)
    me = k.GetCurrentThreadId()
    u.AttachThreadInput(me, tid, True)
    try:
        u.SetForegroundWindow(h)
        time.sleep(0.35)
        u.SetCursorPos(r.l + dx, r.t + dy)
        time.sleep(0.25)
        u.mouse_event(0x0002, 0, 0, 0, 0)
        time.sleep(0.09)
        u.mouse_event(0x0004, 0, 0, 0, 0)
        time.sleep(0.7)
        f = foco(h)
        print('click ventana(%d,%d) -> foco=%s %s' % (dx, dy, f, cls(f) if f else ''))
    finally:
        u.AttachThreadInput(me, tid, False)


def tecla(vk, pausa=0.06):
    u.keybd_event(vk, 0, 0, 0)
    time.sleep(0.03)
    u.keybd_event(vk, 0, 2, 0)
    time.sleep(pausa)


def escribir(h, texto):
    """Tipea con teclado real sobre el control que tiene el foco.

    Con foco es la unica forma que entra bien (sin foco se pierden guiones y puntos).
    """
    if not activar(h):
        sys.exit('no pude poner la ventana al frente')
    if not foco(h):
        sys.exit('la ventana no tiene foco de teclado: hace un click primero')
    for ch in texto:
        vk = u.VkKeyScanW(ord(ch))
        if vk == -1:
            print('  (no se tipear %r, lo salteo)' % ch)
            continue
        base, mods = vk & 0xFF, (vk >> 8) & 0xFF
        if mods & 1:
            u.keybd_event(0x10, 0, 0, 0)
        u.keybd_event(base, 0, 0, 0)
        time.sleep(0.02)
        u.keybd_event(base, 0, 2, 0)
        if mods & 1:
            u.keybd_event(0x10, 0, 2, 0)
        time.sleep(0.04)
    print('escrito: %r' % texto)


def campos(h):
    base = rect(h)
    out = []

    def cb(hh, _l):
        if not u.IsWindowVisible(hh):
            return True
        r = rect(hh)
        out.append((cls(hh), r.l - base.l, r.t - base.t, r.r - r.l, r.b - r.t, txt(hh)))
        return True

    u.EnumChildWindows(h, CB(cb), 0)
    for c in out:
        print('%-16s x=%-5d y=%-5d %3dx%-3d %r' % c)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    cmd = sys.argv[1]
    h = ventana()

    if cmd == 'foto':
        foto(h, sys.argv[2] if len(sys.argv) > 2 else 'insumo')
    elif cmd == 'campos':
        campos(h)
    elif cmd == 'solapa':
        nom = ' '.join(sys.argv[2:]).lower()
        if nom not in SOLAPAS:
            sys.exit('solapas: %s' % ', '.join(SOLAPAS))
        click(h, SOLAPAS[nom], Y_SOLAPA)
        foto(h, 'solapa_' + nom.replace(' ', '_'))
    elif cmd == 'click':
        arg = sys.argv[2]
        if arg in CAMPOS:
            x, y = CAMPOS[arg]
        else:
            x, y = int(sys.argv[2]), int(sys.argv[3])
        click(h, x, y)
        foto(h, 'click')
    elif cmd == 'teclas':
        if not activar(h):
            sys.exit('no pude poner la ventana al frente')
        for t in sys.argv[2].split(','):
            t = t.strip().upper()
            if t in TECLAS:
                tecla(TECLAS[t])
                print('  %s' % t)
            elif t.isdigit():
                time.sleep(float(t) / 1000.0)
            else:
                sys.exit('tecla desconocida: %s' % t)
        foto(h, 'teclas')
    elif cmd == 'escribir':
        escribir(h, ' '.join(sys.argv[2:]))
        foto(h, 'escribir')
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
