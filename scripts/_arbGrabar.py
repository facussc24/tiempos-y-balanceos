# -*- coding: utf-8 -*-
"""
Graba lo que Fak hace en el arb (teclas y clicks) para deducir la receta exacta.

    python scripts/_arbGrabar.py                 # graba hasta que se presione F12
    python scripts/_arbGrabar.py --salida x.log

Anota, por cada evento: que tecla o click fue, y SOBRE QUE CONTROL cayo (clase, texto,
handle, y en que ventana). Con eso se reconstruye la secuencia real, incluida la parte
que no se deduce mirando: como entra en modo edicion una celda y como confirma el alta.

=== LO QUE NO GRABA ===
**Campos de contraseña.** Si el control tiene el estilo ES_PASSWORD, se registra
`<<CAMPO DE CONTRASEÑA — no registrado>>` y NADA del contenido. El login lo hace Fak;
el robot arranca despues. Una clave en texto plano en disco es peor que el problema
que estamos resolviendo.

Solo graba mientras la ventana activa sea del arb (produc.exe). Si Fak se va a Chrome
o al Excel, no se registra nada — no es un keylogger general.
"""
import argparse
import ctypes
import ctypes.wintypes as w
import os
import time

import win32con
import win32gui
import win32process

u = ctypes.windll.user32
k32 = ctypes.windll.kernel32

WH_KEYBOARD_LL = 13
WH_MOUSE_LL = 14
ES_PASSWORD = 0x0020
GWL_STYLE = -16

TECLAS = {
    win32con.VK_TAB: 'TAB', win32con.VK_RETURN: 'ENTER', win32con.VK_ESCAPE: 'ESC',
    win32con.VK_BACK: 'BACKSPACE', win32con.VK_DELETE: 'SUPR', win32con.VK_SPACE: 'ESPACIO',
    win32con.VK_UP: 'FLECHA_ARRIBA', win32con.VK_DOWN: 'FLECHA_ABAJO',
    win32con.VK_LEFT: 'FLECHA_IZQ', win32con.VK_RIGHT: 'FLECHA_DER',
    win32con.VK_HOME: 'INICIO', win32con.VK_END: 'FIN',
    win32con.VK_PRIOR: 'REPAG', win32con.VK_NEXT: 'AVPAG',
    win32con.VK_INSERT: 'INSERT', win32con.VK_MENU: 'ALT', win32con.VK_CONTROL: 'CTRL',
    win32con.VK_SHIFT: 'SHIFT', win32con.VK_LWIN: 'WIN',
}
for i in range(1, 13):
    TECLAS[win32con.VK_F1 + i - 1] = 'F%d' % i


class KBD(ctypes.Structure):
    _fields_ = [('vkCode', w.DWORD), ('scanCode', w.DWORD), ('flags', w.DWORD),
                ('time', w.DWORD), ('dwExtraInfo', ctypes.POINTER(w.ULONG))]


class MSLL(ctypes.Structure):
    _fields_ = [('pt', w.POINT), ('mouseData', w.DWORD), ('flags', w.DWORD),
                ('time', w.DWORD), ('dwExtraInfo', ctypes.POINTER(w.ULONG))]


class GUITHREADINFO(ctypes.Structure):
    _fields_ = [('cbSize', w.DWORD), ('flags', w.DWORD), ('hwndActive', w.HWND),
                ('hwndFocus', w.HWND), ('hwndCapture', w.HWND), ('hwndMenuOwner', w.HWND),
                ('hwndMoveSize', w.HWND), ('hwndCaret', w.HWND), ('rcCaret', w.RECT)]


def es_del_arb(hwnd):
    try:
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        h = k32.OpenProcess(0x0410, False, pid)
        buf = ctypes.create_unicode_buffer(512)
        n = w.DWORD(512)
        ctypes.windll.psapi.GetModuleFileNameExW(h, None, buf, 512) if h else None
        k32.CloseHandle(h)
        return 'produc' in buf.value.lower() or 'arb' in buf.value.lower()
    except Exception:
        return False


def contexto():
    """(ventana activa, control con foco, clase, texto, es_password)"""
    act = u.GetForegroundWindow()
    tit = win32gui.GetWindowText(act) if act else ''
    tid, _ = win32process.GetWindowThreadProcessId(act) if act else (0, 0)
    gi = GUITHREADINFO()
    gi.cbSize = ctypes.sizeof(GUITHREADINFO)
    foco = None
    if tid and u.GetGUIThreadInfo(tid, ctypes.byref(gi)):
        foco = gi.hwndFocus
    clase = txt = ''
    passwd = False
    if foco:
        try:
            clase = win32gui.GetClassName(foco)
            estilo = u.GetWindowLongW(foco, GWL_STYLE)
            passwd = bool(estilo & ES_PASSWORD)
            if not passwd:
                n = u.SendMessageW(foco, win32con.WM_GETTEXTLENGTH, 0, 0)
                if 0 < n < 200:
                    b = ctypes.create_unicode_buffer(n + 1)
                    u.SendMessageW(foco, win32con.WM_GETTEXT, n + 1, b)
                    txt = b.value.strip()
        except Exception:
            pass
    return act, tit, foco, clase, txt, passwd


eventos = []
t0 = [time.time()]
parar = [False]


def registrar(que):
    act, tit, foco, clase, txt, passwd = contexto()
    if not act or ('Producci' not in tit and 'Maestro' not in tit and 'arb' not in tit.lower()):
        return                     # solo el arb: no es un keylogger general
    if passwd:
        eventos.append('%7.2fs  %-16s  <<CAMPO DE CONTRASEÑA — no registrado>>' %
                       (time.time() - t0[0], que))
        return
    eventos.append('%7.2fs  %-16s  ventana="%s"  control=%s hwnd=%s  contenido="%s"' %
                   (time.time() - t0[0], que, tit.strip()[:34], clase, foco, txt[:34]))
    print(eventos[-1])


def cb_teclado(nCode, wParam, lParam):
    if nCode == 0 and wParam in (win32con.WM_KEYDOWN, 0x0104):
        vk = ctypes.cast(lParam, ctypes.POINTER(KBD)).contents.vkCode
        if vk == win32con.VK_F12:
            parar[0] = True
            return u.CallNextHookEx(None, nCode, wParam, lParam)
        nombre = TECLAS.get(vk)
        if not nombre:
            c = u.MapVirtualKeyW(vk, 2) & 0xFFFF
            nombre = ('"%s"' % chr(c)) if 32 <= c < 127 else 'VK_%d' % vk
        registrar(nombre)
    return u.CallNextHookEx(None, nCode, wParam, lParam)


def cb_mouse(nCode, wParam, lParam):
    if nCode == 0 and wParam in (win32con.WM_LBUTTONDOWN, win32con.WM_RBUTTONDOWN,
                                 win32con.WM_LBUTTONDBLCLK):
        p = ctypes.cast(lParam, ctypes.POINTER(MSLL)).contents.pt
        que = {win32con.WM_LBUTTONDOWN: 'CLICK', win32con.WM_RBUTTONDOWN: 'CLICK_DER',
               win32con.WM_LBUTTONDBLCLK: 'DOBLE_CLICK'}[wParam]
        bajo = u.WindowFromPoint(p)
        try:
            cl = win32gui.GetClassName(bajo)
        except Exception:
            cl = '?'
        registrar('%s(%d,%d)->%s' % (que, p.x, p.y, cl))
    return u.CallNextHookEx(None, nCode, wParam, lParam)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--salida', default=os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        '.arb-cache', 'grabacion_arb.log'))
    a = ap.parse_args()

    CMPK = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.c_int, w.WPARAM, w.LPARAM)
    pk, pm = CMPK(cb_teclado), CMPK(cb_mouse)
    hk = u.SetWindowsHookExW(WH_KEYBOARD_LL, pk, k32.GetModuleHandleW(None), 0)
    hm = u.SetWindowsHookExW(WH_MOUSE_LL, pm, k32.GetModuleHandleW(None), 0)
    if not hk:
        raise SystemExit('no pude instalar el hook de teclado')

    print('=' * 74)
    print('GRABANDO — solo mientras la ventana del arb este al frente.')
    print('Las contraseñas NO se registran.')
    print('Hace TODO el flujo normal y al terminar presiona  F12  para cortar.')
    print('=' * 74)
    print()

    msg = w.MSG()
    while not parar[0]:
        if u.PeekMessageW(ctypes.byref(msg), 0, 0, 0, 1):
            u.TranslateMessage(ctypes.byref(msg))
            u.DispatchMessageW(ctypes.byref(msg))
        time.sleep(0.008)

    u.UnhookWindowsHookEx(hk)
    if hm:
        u.UnhookWindowsHookEx(hm)

    d = os.path.dirname(a.salida)
    if d and not os.path.isdir(d):
        os.makedirs(d)
    with open(a.salida, 'w', encoding='utf-8') as f:
        f.write('GRABACION DEL ARB — %d eventos\n' % len(eventos))
        f.write('(las contraseñas no se registran)\n\n')
        f.write('\n'.join(eventos))
    print()
    print('listo: %d eventos -> %s' % (len(eventos), a.salida))


if __name__ == '__main__':
    main()
