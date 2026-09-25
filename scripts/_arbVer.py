# -*- coding: utf-8 -*-
"""Ver y operar el arb con clicks reales. Uso:
     python arbver.py foto            -> captura la ventana de Relaciones a rel.png
     python arbver.py foto prod       -> captura la ventana principal
     python arbver.py click X Y       -> click real en coordenadas de VENTANA (no de pantalla)
     python arbver.py estado          -> ventanas, modales y foco
     python arbver.py modal           -> cierra los modales #32770 con click real
     python arbver.py reset           -> saca la ventana de una celda sucia (cierra y reabre)
     python arbver.py excel --dry-run -> lista que ventanas de Excel cerraria cerrar_excel()
     python arbver.py excel           -> libera RELACIONES.TXT (cierra SOLO la ventana del export)
"""
import ctypes, ctypes.wintypes as w, os, subprocess, sys, time
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '_lib'))
import arbExcel as ax  # noqa: E402  que ventana de Excel es del export (probado en CI)

u = ctypes.windll.user32; k = ctypes.windll.kernel32; g = ctypes.windll.gdi32
CB = ctypes.WINFUNCTYPE(w.BOOL, w.HWND, w.LPARAM)
# Las fotos van a una carpeta fija del usuario, NO al scratchpad de una sesion: estuvo
# clavada al de la sesion 0fe4e13b (05/08/2026) y desde entonces `foto` reventaba con
# FileNotFoundError en cualquier otra sesion. Es la misma carpeta que usa `_arbInsumo.py`.
BASE = os.path.join(os.path.expanduser('~'), 'arb_fotos')
os.makedirs(BASE, exist_ok=True)


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

    Devuelve cuantos QUEDAN abiertos, no cuantos cerro: 0 = la ventana esta usable.
    Misma convencion que `estado()`, para que el exit code signifique lo mismo en los
    dos comandos (0 = seguir es seguro, 1 = hay un modal que mirar).
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


def reset_relaciones(forzar=False):
    """Saca la ventana `Maestro de Relaciones` de una celda sucia y la deja usable.

    🔴 25/09/2026, Fak: *"cuando reseteas relaciones la app crashea... es la segunda vez que
    pasa, anotalo para evitar hacerlo"*. CERRAR una Relaciones abierta (el WM_CLOSE de abajo)
    y reabrirla trabo el arb dos veces ese dia, y reabrirlo pide la contraseña de Fak. Por
    eso, con Relaciones abierta NO se cierra salvo `forzar=True` (CLI: `reset --forzar`, solo
    con OK de Fak). Si Relaciones NO esta abierta, esto solo la ABRE con clicks: ese camino
    anduvo. Ante un corte del cargador no hace falta: nada se graba sin ENTER, y reintentar
    la pieza con `--solo` anduvo tres veces seguidas el mismo dia.

    Cuando el arb rechaza un renglon (por ejemplo `No Ingreso Procesos`), el valor
    escrito sobrevive a CANCELA y a volver a entrar el producto: el buffer de edicion
    del registro sigue abierto y **envenena todas las corridas siguientes**. Lo unico
    que lo descarta es `WM_CLOSE` a la ventana.

    Lo que esta skill daba por imposible era REABRIRLA sin una persona ("las teclas
    sinteticas no abren el menu"). Cierto para las teclas — pero el boton del ribbon
    se abre con un click real. Medido 2026-08-20: cierra y reabre sin intervencion.
    """
    if cerrar_modales():
        # Un modal sin boton `Aceptar` deja al .exe con todas sus ventanas en
        # IsWindowEnabled=False: el WM_CLOSE y los clicks del ribbon no llegarian a
        # ningun lado y el reset "fallaria" apuntando al lugar equivocado, que es
        # exactamente el sintoma que costo una tanda entera el 07/08.
        print('queda un modal abierto sin poder cerrarlo: mirarlo antes de resetear')
        return 1
    h = buscar('rel')
    if h and not forzar:
        print('Relaciones esta ABIERTA y cerrarla crashea el arb (Fak 25/09/2026): no la cierro.\n'
              'Reintenta la pieza con --solo; si de verdad hay que cerrarla, pedile OK a Fak y '
              'corre `_arbVer.py reset --forzar`.')
        return 1
    if h:
        u.PostMessageW(h, 0x0010, 0, 0)          # WM_CLOSE: descarta, no graba
        time.sleep(1.5)
        print('Maestro de Relaciones cerrada: %s' % (buscar('rel') is None))
    p = buscar('prod')
    if not p:
        print('no encuentro la ventana Produccion: la reapertura la tiene que hacer una persona')
        return 1
    # El ribbon del arb NO es un ribbon de Office: no muestra KeyTips con ALT (probado
    # 2026-08-21), asi que la navegacion sigue siendo por click. Pero el boton vive en la
    # solapa `Menu de Insumos`, y clickear su coordenada con el ribbon parado en OTRA
    # solapa cae en el boton que ocupe ese lugar: el 21/08 abrio `Movimiento de Insumos
    # entre Depositos`, que ademas deja `Produccion` deshabilitada y traba todo lo demas.
    # Primero se para el ribbon en su solapa, despues se aprieta el boton.
    click(p, 849, 43)                            # solapa `Menu de Insumos`
    time.sleep(0.6)
    click(p, 296, 98)                            # `Relacion de Consumo de Prod. Terminados`
    time.sleep(1.5)
    abierta = buscar('rel')
    print('Maestro de Relaciones reabierta: %s' % bool(abierta))
    if abierta:
        click(abierta, 118, 68)                  # solapa `Altas de Insumos de Un Producto`
    return 0 if abierta else 1


def imagen(p):
    """Nombre del .exe del proceso `p`, en minusculas ('excel.exe'), o '' si no se puede leer."""
    hp = k.OpenProcess(0x1000, False, p)         # PROCESS_QUERY_LIMITED_INFORMATION
    if not hp:
        return ''
    try:
        n = w.DWORD(1024); b = ctypes.create_unicode_buffer(1024)
        ok = k.QueryFullProcessImageNameW(hp, 0, b, ctypes.byref(n))
        return os.path.basename(b.value).lower() if ok else ''
    finally:
        k.CloseHandle(hp)


def plan_excel(archivos=ax.ARCHIVOS_EXPORT):
    """Que haria `cerrar_excel` con cada ventana de Excel que hay ahora en pantalla.

    Solo mira ventanas visibles de un proceso EXCEL.EXE (asi nunca toca el arb ni un cartel de
    Word/Outlook, que tambien usan NUIDialog). Devuelve [(accion, hwnd, clase, titulo, detalle)]:
      'cerrar'     XLMAIN cuyo titulo nombra a un archivo del export
      'contestar'  NUIDialog que UI Automation confirma que es el cartel de conversiones;
                   detalle = nombre exacto del boton No convertir
      'dejar'      libros de Fak, y carteles MODALES que no son el de conversiones (guardar
                   cambios, o uno que no se pudo leer): se avisa y frenan el cierre en ese Excel
      'ignorar'    NUIDialog que no es modal: el boton flotante "Analisis rapido" que Excel
                   muestra al seleccionar celdas es un NUIDialog (medido 24/09/2026). No se toca.
      'esperar'    XLMAIN del export con un cartel modal encima: todavia no se cierra
    """
    plan = []

    def _cb(h, _l):
        if u.IsWindowVisible(h) and cls(h) in ('XLMAIN', 'NUIDialog') and imagen(pid(h)) == 'excel.exe':
            plan.append(h)
        return True
    u.EnumWindows(CB(_cb), 0)
    out = []
    for h in plan:
        c, t = cls(h), txt(h)
        if c == 'XLMAIN':
            del_export = ax.es_ventana_del_export(t, archivos)
            out.append(('cerrar' if del_export else 'dejar', h, c, t,
                        'es del export' if del_export else 'no es del export'))
            continue
        elementos = ax.leer_cartel(h)
        clase, boton = ax.clasificar_cartel(elementos or [])
        if clase == 'conversiones':
            out.append(('contestar', h, c, t, boton))
            continue
        leido = ('no se pudo leer (UI Automation)' if elementos is None else
                 ' | '.join(n for _t, n in elementos if n.strip())[:160] or 'sin texto')
        modal = es_modal(h)
        out.append(('dejar' if modal or clase == 'guardar' else 'ignorar', h, c, t,
                    'cartel %s%s: %s' % (clase, '' if modal else ', no modal', leido)))
    # Un cartel modal que no es el de conversiones frena el cierre en ESE Excel: el WM_CLOSE
    # quedaria encolado detras de el. La ventana deshabilitada es lo mismo visto desde ella.
    trabados = {pid(h) for a, h, c, _t, _d in out if a == 'dejar' and c == 'NUIDialog'}
    return [('esperar', h, c, t, 'tiene un cartel abierto encima: se cierra cuando lo contesten')
            if a == 'cerrar' and (pid(h) in trabados or not u.IsWindowEnabled(h))
            else (a, h, c, t, d) for a, h, c, t, d in out]


def es_modal(h):
    """Un cartel modal deshabilita la ventana de la que cuelga (GW_OWNER)."""
    o = u.GetWindow(h, 4)
    return bool(o) and not u.IsWindowEnabled(o)


def _seguro(s):
    """El texto de un cartel trae caracteres que la consola cp1252 no imprime (el de guardar
    tiene U+200E en la ruta, medido 24/09/2026): un print que revienta en medio de un export es
    peor que un '?'."""
    enc = getattr(sys.stdout, 'encoding', None) or 'utf-8'
    return str(s).encode(enc, 'replace').decode(enc, 'replace')


def cerrar_excel(espera=2.0, archivos=ax.ARCHIVOS_EXPORT, seco=False):
    """El export abre el TXT en Excel y Excel SE QUEDA CON EL ARCHIVO: el export siguiente
    falla en silencio (mtime igual, ningun cartel del arb). Se cierra antes y despues de exportar.

    Solo se cierra la ventana del ARCHIVO DEL EXPORT, nunca las demas. Hasta el 24/09/2026 se
    cerraban TODAS las ventanas de Excel y se clickeaba a ciegas en todo cartel `NUIDialog`: se
    llevo lo que Fak tenia abierto, y el cartel de "guardar cambios" es el mismo `NUIDialog`.

    El cartel "Excel realizara las siguientes conversiones: quitar ceros iniciales" se contesta
    **No convertir** (Convertir destruiria cualquier consumo que arranque con ceros), pero solo
    despues de leerlo por UI Automation y confirmar que es ESE cartel; el boton se aprieta por
    su nombre, no por coordenada. Cualquier otro cartel queda abierto y se avisa.

    Mientras Excel tenga un cartel MODAL que no es el de conversiones (o la ventana del export
    este deshabilitada, que es lo mismo visto desde ella), no se le manda WM_CLOSE a ninguna
    ventana de ese proceso: el cierre quedaria encolado detras de un cartel ajeno.
    Si algo no se pudo cerrar, lo dice; `archivo_tomado()` es el que confirma si quedo libre.

    `seco=True` solo lista que haria, sin tocar nada.
    """
    if seco:
        plan = plan_excel(archivos)
        if not plan:
            print('no hay ventanas de Excel abiertas')
        for accion, _h, c, t, det in plan:
            que = {'cerrar': 'CERRARIA', 'contestar': 'CONTESTARIA %r' % det,
                   'dejar': 'DEJA ABIERTA', 'ignorar': 'NO TOCA', 'esperar': 'NO CIERRA TODAVIA'}[accion]
            print(_seguro('  %-26s %-9s %r%s' % (que, c, t, '' if accion in ('cerrar', 'contestar') else '  (%s)' % det)))
        return 0
    enviados, contestados = set(), 0
    avisos, ajenas = {}, set()                   # hwnd -> motivo / libros de Fak (solo se cuentan)
    for _vuelta in range(3):
        plan = plan_excel(archivos)
        avisos = {h: det for a, h, _c, _t, det in plan              # los de ESTA vuelta
                  if a in ('dejar', 'esperar') and det != 'no es del export'}
        ajenas |= {h for _a, h, _c, _t, det in plan if det == 'no es del export'}
        hubo, fallidos = False, set()
        for a, h, _c, _t, det in plan:
            if a != 'contestar':
                continue
            if ax.apretar_boton(h, det):
                contestados += 1; hubo = True
                print(_seguro('Excel: cartel de conversiones contestado %r' % det))
            else:
                avisos[h] = 'no pude apretar %r en el cartel de conversiones' % det
                fallidos.add(pid(h))
        if hubo:                                 # el cartel frenaba a Excel: mirar de nuevo antes de cerrar
            time.sleep(espera)
            continue
        for a, h, _c, _t, _det in plan:
            if a != 'cerrar' or h in enviados or pid(h) in fallidos:
                continue
            u.PostMessageW(h, 0x0010, 0, 0)      # WM_CLOSE a la ventana del export, y a ninguna mas
            enviados.add(h); hubo = True
        if not hubo:
            break
        time.sleep(espera)
    t0 = time.time()                             # Excel puede tardar en soltar la ventana
    while any(u.IsWindow(h) for h in enviados) and time.time() - t0 < 6:
        time.sleep(0.5)
    for h in enviados:
        if u.IsWindow(h) and u.IsWindowVisible(h):
            avisos.setdefault(h, 'le pedi cerrar y sigue abierta')
    for h, motivo in avisos.items():
        if u.IsWindow(h) and u.IsWindowVisible(h):
            print(_seguro('   ATENCION Excel: dejo abierta %r — %s' % (txt(h) or cls(h), motivo)))
    cerradas = sum(1 for h in enviados if not u.IsWindow(h))
    ajenas = [h for h in ajenas if u.IsWindow(h)]
    if enviados or contestados or ajenas:
        print('Excel: %d ventana/s del export cerrada/s (%s) · %d cartel/es contestado/s · '
              '%d libro/s que no son del export, sin tocar'
              % (cerradas, ', '.join(archivos), contestados, len(ajenas)))
    return cerradas


def archivo_tomado(path):
    """True si otro programa (Excel) tiene el archivo abierto y el arb no lo podria escribir.
    Abre para lectura+escritura sin truncar: no cambia nada del archivo."""
    if not os.path.exists(path):
        return False
    try:
        with open(path, 'r+b'):
            return False
    except FileNotFoundError:                    # se borro entre el exists() y el open()
        return False
    except PermissionError:
        return True


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
    if archivo_tomado(P):                # y fallaria EN SILENCIO: mejor frenar aca y decir por que
        raise SystemExit('ABORTADO: %s sigue abierto en otro programa (Excel) y el export no lo '
                         'podria escribir. Cerrar esa ventana a mano, sin guardar, y reintentar.' % P)
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
    if archivo_tomado(P):
        print('ATENCION: %s quedo abierto en Excel: el proximo export va a frenar hasta que se cierre' % P)
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
        sys.exit(reset_relaciones(forzar='--forzar' in sys.argv[2:]))
    elif cmd == 'excel':
        seco = '--dry-run' in sys.argv[2:]
        cerrar_excel(seco=seco)
        P = os.path.join('C:' + os.sep, 'tmp', 'RELACIONES.TXT')
        tomado = archivo_tomado(P)
        print('%s: %s' % (P, 'TOMADO por otro programa' if tomado else 'libre'))
        sys.exit(1 if tomado and not seco else 0)
    else:
        sys.exit(1 if estado() else 0)
