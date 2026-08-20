# -*- coding: utf-8 -*-
"""Ver y operar el arb con clicks reales. Uso:
     python arbver.py foto            -> captura la ventana de Relaciones a rel.png
     python arbver.py foto prod       -> captura la ventana principal
     python arbver.py click X Y       -> click real en coordenadas de VENTANA (no de pantalla)
     python arbver.py estado          -> ventanas, modales y foco
     python arbver.py modal           -> cierra los modales #32770 con click real
     python arbver.py reset           -> saca la ventana de una celda sucia (cierra y reabre)
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


def cerrar_modales():
    """Cierra los modales #32770 del arb con un CLICK REAL sobre su boton Aceptar.

    La skill decia que el modal "lo tiene que cerrar una persona". Eso vale para
    `BM_CLICK`, que cambia el estado visual y no ejecuta la logica del programa —
    el mismo patron de todo lo sintetico en este .exe. Un click real del mouse con
    `AttachThreadInput` si lo cierra. Medido 2026-08-20 sobre el modal
    `Error / No Ingreso Procesos`: 1 modal -> 0.

    Devuelve cuantos cerro.
    """
    n = 0
    for h in [x for x in ventanas() if cls(x) == '#32770']:
        detalle = []

        def cb(hh, _l):
            t = txt(hh)
            if t.strip():
                detalle.append('[%s] %s' % (cls(hh), t))
            return True
        u.EnumChildWindows(h, CB(cb), 0)
        botones = []

        def cb2(hh, _l):
            if cls(hh) == 'Button' and txt(hh).replace('&', '').strip().lower() in ('aceptar', 'ok'):
                botones.append(hh)
            return True
        u.EnumChildWindows(h, CB(cb2), 0)
        print('modal: %s | %s' % (txt(h), ' - '.join(detalle)))
        if not botones:
            print('   sin boton Aceptar: lo tiene que mirar una persona')
            continue
        r = R(); u.GetWindowRect(botones[0], ctypes.byref(r))
        tid = u.GetWindowThreadProcessId(botones[0], None); me = k.GetCurrentThreadId()
        u.AttachThreadInput(me, tid, True)
        try:
            u.SetCursorPos((r.l + r.r) // 2, (r.t + r.b) // 2); time.sleep(0.3)
            u.mouse_event(0x0002, 0, 0, 0, 0); time.sleep(0.09); u.mouse_event(0x0004, 0, 0, 0, 0)
            time.sleep(0.7)
        finally:
            u.AttachThreadInput(me, tid, False)
        n += 1
    time.sleep(0.5)
    quedan = len([x for x in ventanas() if cls(x) == '#32770'])
    print('modales cerrados: %d  |  quedan: %d' % (n, quedan))
    return quedan


def reset_relaciones():
    """Saca la ventana `Maestro de Relaciones` de una celda sucia y la deja usable.

    Cuando el arb rechaza un renglon (por ejemplo `No Ingreso Procesos`), el valor
    escrito sobrevive a CANCELA y a volver a entrar el producto: el buffer de edicion
    del registro sigue abierto y **envenena todas las corridas siguientes**. Lo unico
    que lo descarta es `WM_CLOSE` a la ventana.

    Lo que esta skill daba por imposible era REABRIRLA sin una persona ("las teclas
    sinteticas no abren el menu"). Cierto para las teclas — pero el boton del ribbon
    se abre con un click real. Medido 2026-08-20: cierra y reabre sin intervencion.
    """
    cerrar_modales()
    h = buscar('rel')
    if h:
        u.PostMessageW(h, 0x0010, 0, 0)          # WM_CLOSE: descarta, no graba
        time.sleep(1.5)
        print('Maestro de Relaciones cerrada: %s' % (buscar('rel') is None))
    p = buscar('prod')
    if not p:
        print('no encuentro la ventana Produccion: la reapertura la tiene que hacer una persona')
        return 1
    click(p, 298, 95)                            # boton `Relacion de Consumo de Prod. Terminados`
    time.sleep(1.5)
    abierta = buscar('rel')
    print('Maestro de Relaciones reabierta: %s' % bool(abierta))
    if abierta:
        click(abierta, 118, 68)                  # solapa `Altas de Insumos de Un Producto`
    return 0 if abierta else 1


def cerrar_excel(espera=2.0):
    """El export abre el TXT en Excel y Excel SE QUEDA CON EL ARCHIVO: el export siguiente
    falla en silencio (mtime igual, ningun cartel del arb). Se cierra siempre, antes y
    despues de exportar.

    Ojo con el cartel "Excel realizara las siguientes conversiones: quitar ceros iniciales":
    hay que contestar **No convertir**. Aceptar destruiria cualquier consumo que arranque con ceros.
    """
    cerradas = 0
    for _ in range(3):
        dlg, xl = [], []

        def _cb(h, _l):
            if u.IsWindowVisible(h):
                c = cls(h)
                if c == 'NUIDialog':
                    dlg.append(h)
                elif c == 'XLMAIN':
                    xl.append(h)
            return True
        u.EnumWindows(CB(_cb), 0)
        if not dlg and not xl:
            break
        for d in dlg:                       # contestar "No convertir" (abajo a la derecha)
            r = R(); u.GetWindowRect(d, ctypes.byref(r))
            tid = u.GetWindowThreadProcessId(d, None); me = k.GetCurrentThreadId()
            u.AttachThreadInput(me, tid, True)
            try:
                u.SetForegroundWindow(d); u.BringWindowToTop(d); time.sleep(0.4)
                u.SetCursorPos((r.l + r.r) // 2, r.t + 14); time.sleep(0.15)
                u.mouse_event(0x0002, 0, 0, 0, 0); time.sleep(0.08)
                u.mouse_event(0x0004, 0, 0, 0, 0); time.sleep(0.4)
                u.SetCursorPos(r.l + 383, r.t + 227); time.sleep(0.25)
                u.mouse_event(0x0002, 0, 0, 0, 0); time.sleep(0.09)
                u.mouse_event(0x0004, 0, 0, 0, 0); time.sleep(1.0)
            finally:
                u.AttachThreadInput(me, tid, False)
            cerradas += 1
        for h in xl:
            u.PostMessageW(h, 0x0010, 0, 0); cerradas += 1
        time.sleep(espera)
    if cerradas:
        print('Excel cerrado (%d ventana/s) — el archivo queda libre' % cerradas)
    return cerradas


# ---------------------------------------------------------------- export

def export(timeout=240):
    """Dispara el export de RELACIONES y espera a que termine de escribir.

    La receta completa, medida el 2026-08-07. Los dos pasos que no son obvios:
      - el combo `Salida` se RESETEA a vacio al entrar a la solapa Listado, y con el combo
        vacio `ACEPTA` no hace nada (parece que el boton estuviera roto);
      - el click sobre el combo NO le da el foco: hay que llegar tabulando desde
        `Desde Articulo`.
    GATE: antes del ENTER se verifica que el combo diga `Tabla EXcel`. Desde vacio, tres
    flechas abajo caen en `Impresora` — aceptar ahi manda el listado a la impresora.
    """
    import os
    h = buscar('rel')
    if not h:
        raise SystemExit('no encuentro la ventana Maestro de Relaciones')
    P = os.path.join('C:' + os.sep, 'tmp', 'RELACIONES.TXT')
    cerrar_excel()                       # si Excel lo tiene tomado, el export no sale
    antes = os.path.getmtime(P) if os.path.exists(P) else 0
    r = R(); u.GetWindowRect(h, ctypes.byref(r))
    tid = u.GetWindowThreadProcessId(h, None); me = k.GetCurrentThreadId()
    KEYUP, VK_TAB, VK_UP, VK_DOWN, VK_RET = 0x0002, 0x09, 0x26, 0x28, 0x0D

    def tecla(vk, p=0.3):
        u.keybd_event(vk, 0, 0, 0); time.sleep(0.06)
        u.keybd_event(vk, 0, KEYUP, 0); time.sleep(p)

    def clic(dx, dy):
        u.SetCursorPos(r.l + dx, r.t + dy); time.sleep(0.3)
        u.mouse_event(0x0002, 0, 0, 0, 0); time.sleep(0.09)
        u.mouse_event(0x0004, 0, 0, 0, 0); time.sleep(0.7)

    CB_GETCURSEL = 0x0147
    combo = []

    def _cb(hh, _l):
        if cls(hh) == 'ComboBox':
            combo.append(hh)
        return True

    u.AttachThreadInput(me, tid, True)
    try:
        u.SetForegroundWindow(h); time.sleep(0.35)
        clic(297, 68)                     # solapa `Listado de Insumos de Un Producto`
        clic(228, 151)                    # campo `Desde Articulo` -> foco real
        # el combo se busca ACA: en la solapa Altas todavia no existe (daba idx=-1)
        del combo[:]
        u.EnumChildWindows(h, CB(_cb), 0)
        tecla(VK_TAB); tecla(VK_TAB)      # -> combo Salida
        for _ in range(8):
            tecla(VK_UP, 0.12)            # pisar en la opcion 0, venga de donde venga
        for _ in range(3):
            tecla(VK_DOWN, 0.25)          # 3 = Tabla EXcel

        # GATE, adentro del mismo bloque: soltar el foco para sacar una foto le hace perder
        # la seleccion al combo. Se le pregunta al control directamente.
        #   0 Pantalla · 1 Impresora · 2 Disco C · 3 Tabla EXcel · 4 PDF · 5 HTML · 6 RTF
        idx = u.SendMessageW(combo[0], CB_GETCURSEL, 0, 0) if combo else -1
        if idx != 3:
            raise SystemExit('ABORTADO: el combo Salida quedo en la opcion %s y se esperaba '
                             '3 (Tabla EXcel). Con 1 (Impresora) esto imprimiria el listado '
                             'entero.' % idx)
        for _ in range(3):
            tecla(VK_RET, 1.0)
    finally:
        u.AttachThreadInput(me, tid, False)

    prev, t0 = -1, time.time()
    while time.time() - t0 < timeout:
        time.sleep(3)
        if not os.path.exists(P):
            continue
        n, m = os.path.getsize(P), os.path.getmtime(P)
        if m > antes and n == prev and time.time() - m > 8:
            break
        prev = n
    cerrar_excel()                       # el export lo reabre: dejarlo libre para el proximo
    ok = os.path.getmtime(P) > antes
    print('export %s: %d bytes  mtime %s' % ('OK' if ok else 'NO SALIO',
          os.path.getsize(P), time.strftime('%H:%M:%S', time.localtime(os.path.getmtime(P)))))
    return ok


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
    elif cmd == 'export':
        sys.exit(0 if export() else 1)
    elif cmd == 'modal':
        sys.exit(1 if cerrar_modales() else 0)
    elif cmd == 'reset':
        sys.exit(reset_relaciones())
    else:
        sys.exit(1 if estado() else 0)
