# -*- coding: utf-8 -*-
"""Grabador de sesion del arb — para APRENDER una pantalla que el robot todavia no sabe usar.

Mira lo que hace Fak y lo anota: cada tecla, en que campo estaba parado, que decia ese campo
antes y despues, y una foto de la ventana. Al final arma un video y un log legible.

    python scripts/_arbAprender.py --salida <carpeta> [--minutos 40]

PRIVACIDAD: solo graba mientras la ventana al frente es del arb (produc.exe). Si Fak se va a
otra aplicacion (mail, navegador, lo que sea) NO se registra ni tecla ni foto. Para cortar:
crear el archivo STOP dentro de la carpeta de salida, o Ctrl+C.

Este script NO escribe en el arb y NO borra ningun archivo: solo lee la pantalla
(PrintWindow no roba el foco) y agrega archivos nuevos en la carpeta de salida.

Salida:
    frames/NNNN.png     fotos de la ventana (la repetida no se guarda)
    eventos.jsonl       una linea por tecla / click / cambio de foco / cambio de ventana
    controles.jsonl     mapa de campos cada vez que cambia la ventana
    video.mp4           las fotos a 2 fps
"""
import argparse
import ctypes
import ctypes.wintypes as w
import hashlib
import json
import os
import subprocess
import sys
import time

from PIL import Image

u = ctypes.windll.user32
g = ctypes.windll.gdi32
CB = ctypes.WINFUNCTYPE(w.BOOL, w.HWND, w.LPARAM)


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


class PT(ctypes.Structure):
    _fields_ = [('x', ctypes.c_long), ('y', ctypes.c_long)]


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


def raiz(h):
    return u.GetAncestor(h, 2) or h          # GA_ROOT


def foco():
    """(hwnd con foco, hwnd al frente). Leer NO roba el foco."""
    fg = u.GetForegroundWindow()
    if not fg:
        return None, None
    tid = u.GetWindowThreadProcessId(fg, None)
    gi = GUI()
    gi.cbSize = ctypes.sizeof(GUI)
    if not u.GetGUIThreadInfo(tid, ctypes.byref(gi)):
        return None, fg
    return gi.hwndFocus, fg


def rect(h):
    r = R()
    u.GetWindowRect(h, ctypes.byref(r))
    return r


def pantalla(h):
    """(imagen PIL, hash) de la ventana. Devuelve (None, None) si no se puede."""
    r = rect(h)
    an, al = r.r - r.l, r.b - r.t
    if an <= 0 or al <= 0 or an > 8000 or al > 8000:
        return None, None
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
    img = Image.frombuffer('RGB', (an, al), buf, 'raw', 'BGRX', 0, 1)
    return img, hashlib.md5(buf.raw).hexdigest()


def controles(h):
    """Mapa de campos de una ventana: clase, texto y rectangulo relativo a la ventana."""
    out = []
    base = rect(h)

    def cb(hh, _l):
        r = rect(hh)
        out.append({'hwnd': hh, 'clase': cls(hh), 'texto': txt(hh),
                    'x': r.l - base.l, 'y': r.t - base.t,
                    'an': r.r - r.l, 'al': r.b - r.t,
                    'id': u.GetDlgCtrlID(hh), 'visible': bool(u.IsWindowVisible(hh))})
        return True

    u.EnumChildWindows(h, CB(cb), 0)
    return out


VK = {0x01: 'CLICK_IZQ', 0x02: 'CLICK_DER', 0x08: 'BACKSPACE', 0x09: 'TAB', 0x0D: 'ENTER',
      0x10: 'SHIFT', 0x11: 'CTRL', 0x12: 'ALT', 0x13: 'PAUSA', 0x14: 'BLOQMAYUS',
      0x1B: 'ESC', 0x20: 'ESPACIO', 0x21: 'REPAG', 0x22: 'AVPAG', 0x23: 'FIN', 0x24: 'INICIO',
      0x25: 'IZQ', 0x26: 'ARRIBA', 0x27: 'DER', 0x28: 'ABAJO', 0x2D: 'INSERT', 0x2E: 'SUPR',
      0x5B: 'WIN', 0x6A: 'NUM_POR', 0x6B: 'NUM_MAS', 0x6D: 'NUM_MENOS', 0x6E: 'NUM_PUNTO',
      0x6F: 'NUM_DIV', 0xBA: 'OEM_1', 0xBB: 'OEM_MAS', 0xBC: 'OEM_COMA', 0xBD: 'OEM_MENOS',
      0xBE: 'OEM_PUNTO', 0xBF: 'OEM_2', 0xC0: 'OEM_3', 0xDB: 'OEM_4', 0xDC: 'OEM_5',
      0xDD: 'OEM_6', 0xDE: 'OEM_7'}
for _i in range(12):
    VK[0x70 + _i] = 'F%d' % (_i + 1)
for _i in range(10):
    VK[0x30 + _i] = str(_i)
    VK[0x60 + _i] = 'NUM%d' % _i
for _c in range(0x41, 0x5B):
    VK[_c] = chr(_c)

IGNORAR = {0x03, 0x04, 0x05, 0x06, 0x07}     # botones raros del mouse


def nombre(vk):
    return VK.get(vk, 'VK_%02X' % vk)


def main():
    ap = argparse.ArgumentParser(description='Grabar una sesion del arb para aprenderla')
    ap.add_argument('--salida', required=True)
    ap.add_argument('--minutos', type=float, default=40.0)
    a = ap.parse_args()

    base = a.salida
    frames = os.path.join(base, 'frames')
    os.makedirs(frames, exist_ok=True)
    ev = open(os.path.join(base, 'eventos.jsonl'), 'a', encoding='utf-8')
    ctl = open(os.path.join(base, 'controles.jsonl'), 'a', encoding='utf-8')
    stop = os.path.join(base, 'STOP')

    ps = pids_arb()
    if not ps:
        print('NO encuentro produc.exe — abri el arb y volve a correrme')
        return 2
    print('GRABANDO | arb pid(s): %s' % sorted(ps))
    print('carpeta : %s' % base)
    print('cortar  : crear el archivo %s' % stop)
    sys.stdout.flush()

    t0 = time.time()
    abajo = set()
    estado = {'nf': 0, 'hash': None, 'ultima': 0.0}
    ult_win = None
    ult_foco = -1
    pendiente = None

    def registrar(d):
        d['t'] = round(time.time() - t0, 3)
        ev.write(json.dumps(d, ensure_ascii=False) + '\n')
        ev.flush()

    def capturar(top, ahora):
        img, h = pantalla(top)
        estado['ultima'] = ahora
        if img is None or h == estado['hash']:
            return
        estado['hash'] = h
        estado['nf'] += 1
        img.save(os.path.join(frames, '%04d.png' % estado['nf']))

    while time.time() - t0 < a.minutos * 60:
        if os.path.exists(stop):
            break
        h_foco, fg = foco()
        ahora = time.time()

        if not fg or pid(fg) not in ps:      # no es el arb: no se graba nada
            abajo.clear()
            time.sleep(0.08)
            continue

        top = raiz(fg)
        titulo = txt(top)
        if titulo != ult_win:
            ult_win = titulo
            registrar({'tipo': 'ventana', 'titulo': titulo, 'clase': cls(top)})
            ctl.write(json.dumps({'t': round(ahora - t0, 3), 'titulo': titulo,
                                  'controles': controles(top)}, ensure_ascii=False) + '\n')
            ctl.flush()
            capturar(top, ahora)

        if h_foco != ult_foco:
            ult_foco = h_foco
            if h_foco:
                registrar({'tipo': 'foco', 'clase': cls(h_foco),
                           'id': u.GetDlgCtrlID(h_foco), 'texto': txt(h_foco)})

        for vk in range(0x01, 0xFF):
            if vk in IGNORAR:
                continue
            if u.GetAsyncKeyState(vk) & 0x8000:
                if vk not in abajo:
                    abajo.add(vk)
                    d = {'tipo': 'tecla', 'k': nombre(vk),
                         'shift': bool(u.GetAsyncKeyState(0x10) & 0x8000),
                         'ctrl': bool(u.GetAsyncKeyState(0x11) & 0x8000),
                         'alt': bool(u.GetAsyncKeyState(0x12) & 0x8000)}
                    if h_foco:
                        d['campo'] = cls(h_foco)
                        d['campo_id'] = u.GetDlgCtrlID(h_foco)
                        d['antes'] = txt(h_foco)
                    if vk in (0x01, 0x02):
                        p = PT()
                        u.GetCursorPos(ctypes.byref(p))
                        r = rect(top)
                        d['xy'] = [p.x - r.l, p.y - r.t]
                    registrar(d)
                    pendiente = (ahora + 0.18, d['k'])
            else:
                abajo.discard(vk)

        if pendiente and ahora >= pendiente[0]:
            k = pendiente[1]
            pendiente = None
            hf, _ = foco()
            registrar({'tipo': 'efecto', 'de': k,
                       'campo': cls(hf) if hf else None,
                       'campo_id': u.GetDlgCtrlID(hf) if hf else None,
                       'despues': txt(hf) if hf else None,
                       'titulo': txt(raiz(u.GetForegroundWindow() or 0))})
            capturar(top, ahora)

        if ahora - estado['ultima'] > 1.0:
            capturar(top, ahora)

        time.sleep(0.02)

    ev.close()
    ctl.close()
    print('FIN. %d frames en %s' % (estado['nf'], frames))

    try:
        import cv2
        fs = sorted(f for f in os.listdir(frames) if f.endswith('.png'))
        if fs:
            im0 = cv2.imread(os.path.join(frames, fs[0]))
            al, an = im0.shape[:2]
            vid = cv2.VideoWriter(os.path.join(base, 'video.mp4'),
                                  cv2.VideoWriter_fourcc(*'mp4v'), 2.0, (an, al))
            for f in fs:
                im = cv2.imread(os.path.join(frames, f))
                if im is not None and im.shape[:2] == (al, an):
                    vid.write(im)
            vid.release()
            print('video : %s' % os.path.join(base, 'video.mp4'))
    except Exception as e:
        print('el video no salio (%s) — las fotos estan igual' % e)
    return 0


if __name__ == '__main__':
    sys.exit(main())
