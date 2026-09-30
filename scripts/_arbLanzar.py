# -*- coding: utf-8 -*-
"""Abrir el arb con doble click (acceso directo "ARB") o reiniciarlo ("ARB - reiniciar").

LO EJECUTA FAK, NUNCA CLAUDE. La contraseña la escribe Fak una sola vez en la ventana de
credenciales de Windows y queda guardada en el Administrador de credenciales (credencial
generica BARACK_ARB). Este script la lee ahi, la tipea en `Inicio de Sesion` y la olvida:
no la imprime, no la loguea, no la escribe en ningun archivo. Si lo lanza una sesion de Claude
(variable CLAUDECODE), se niega (salvo `--diagnostico`, que solo mira ventanas).

Pedido de Fak, 30/09/2026: "crea un link de arb facil de abrir... no guardes [la contraseña],
simplemente crea el link". Diseño: docs/auto-mejora/2026-09-30-automejora-10-frentes.md §2.

Uso (los accesos directos del Escritorio llaman a pythonw con esto):
    _arbLanzar.py                -> si el arb esta abierto lo trae al frente; si pide login, entra;
                                    si esta cerrado, lo abre y entra.
    _arbLanzar.py --reiniciar    -> pregunta, cierra el arb (trabado) y lo vuelve a abrir.
    _arbLanzar.py --guardar-clave-> vuelve a pedir usuario y contraseña (si cambio la clave).
    _arbLanzar.py --diagnostico  -> solo lista las ventanas del arb y sus campos (sin tocar nada).

Un solo intento de login: si la clave esta mal, frena y avisa (no se reintenta para no
bloquear la cuenta). Log sin secretos en ~/arb_fotos/lanzador.log.
"""
import ctypes, ctypes.wintypes as w, datetime, os, subprocess, sys, time

EXE = r'Z:\arb\prod\produc.exe'
DIR_EXE = r'Z:\arb\prod'
UNC_Z = r'\\server\sistema'          # lo que Windows tiene recordado para Z: (net use, 30/09/2026)
ICONO = os.path.join(os.path.expanduser('~'), 'arb_fotos', 'arb.ico')
CRED = 'BARACK_ARB'
USUARIO_DEFAULT = 'FACUNDO'
LOG = os.path.join(os.path.expanduser('~'), 'arb_fotos', 'lanzador.log')

u = ctypes.windll.user32
try:                                   # coordenadas reales aunque Windows escale la pantalla
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass
k = ctypes.windll.kernel32
CB = ctypes.WINFUNCTYPE(w.BOOL, w.HWND, w.LPARAM)

MB_OK, MB_YESNO, MB_ICONWARN, MB_ICONQ, MB_TOPMOST, IDYES = 0x0, 0x4, 0x30, 0x20, 0x40000, 6


def log(msg):
    try:
        os.makedirs(os.path.dirname(LOG), exist_ok=True)
        with open(LOG, 'a', encoding='utf-8') as f:
            f.write('%s  %s\n' % (datetime.datetime.now().strftime('%d/%m %H:%M:%S'), msg))
    except OSError:
        pass


def aviso(texto, flags=MB_OK | MB_ICONWARN):
    return u.MessageBoxW(None, texto, 'ARB', flags | MB_TOPMOST)


# ---------------------------------------------------------------- credencial (Windows)

def leer_cred():
    import win32cred
    try:
        c = win32cred.CredRead(CRED, win32cred.CRED_TYPE_GENERIC)
    except Exception:
        return None
    blob = c.get('CredentialBlob') or b''
    clave = blob if isinstance(blob, str) else blob.decode('utf-16-le')
    return (c.get('UserName') or USUARIO_DEFAULT), clave


def pedir_y_guardar_cred():
    """Ventana nativa de Windows para usuario y contraseña; la guarda en el Administrador de
    credenciales. Devuelve (usuario, clave) o None si Fak cancelo."""
    import win32cred
    flags = (win32cred.CREDUI_FLAGS_GENERIC_CREDENTIALS | win32cred.CREDUI_FLAGS_ALWAYS_SHOW_UI
             | win32cred.CREDUI_FLAGS_DO_NOT_PERSIST)
    try:
        usuario, clave, _ = win32cred.CredUIPromptForCredentials(
            'arb (Produccion)', 0, USUARIO_DEFAULT, None, False, flags, None)
    except Exception:
        return None
    usuario = (usuario or USUARIO_DEFAULT).strip()
    if not clave:
        return None
    win32cred.CredWrite({'Type': win32cred.CRED_TYPE_GENERIC, 'TargetName': CRED,
                         'UserName': usuario, 'CredentialBlob': clave,
                         'Persist': win32cred.CRED_PERSIST_LOCAL_MACHINE,
                         'Comment': 'Login del arb para el acceso directo ARB'}, 0)
    log('credencial guardada para el usuario %s' % usuario)
    return usuario, clave


# ---------------------------------------------------------------- ventanas del arb

def cls(h):
    b = ctypes.create_unicode_buffer(256); u.GetClassNameW(h, b, 256); return b.value


def txt(h):
    n = u.GetWindowTextLengthW(h) + 1; b = ctypes.create_unicode_buffer(n)
    u.GetWindowTextW(h, b, n); return b.value


def pid(h):
    p = w.DWORD(); u.GetWindowThreadProcessId(h, ctypes.byref(p)); return p.value


def pids_arb():
    out = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq produc.exe', '/FO', 'CSV'],
                         capture_output=True, text=True, creationflags=0x08000000).stdout
    return {int(l.split('","')[1]) for l in out.splitlines()[1:] if l.startswith('"produc.exe"')}


def ventanas():
    ps = pids_arb(); v = []

    def cb(h, l):
        if pid(h) in ps and u.IsWindowVisible(h):
            v.append(h)
        return True
    u.EnumWindows(CB(cb), 0)
    return v


def ventana_login():
    for h in ventanas():
        if 'Inicio de Sesi' in txt(h):
            return h
    return None


def ventana_principal():
    for h in ventanas():
        if cls(h) == 'ProdWindow':
            return h
    return None


class R(ctypes.Structure):
    _fields_ = [('l', ctypes.c_long), ('t', ctypes.c_long), ('r', ctypes.c_long), ('b', ctypes.c_long)]


def rect(h):
    r = R(); u.GetWindowRect(h, ctypes.byref(r)); return r


def campos_de_texto(h):
    """Los campos editables del login, de arriba hacia abajo (Usuario, Contraseña)."""
    hijos = []

    def cb(hh, l):
        c = cls(hh).lower()
        if u.IsWindowVisible(hh) and ('edit' in c or 'text' in c):
            hijos.append(hh)
        return True
    u.EnumChildWindows(h, CB(cb), 0)
    return sorted(hijos, key=lambda x: (rect(x).t, rect(x).l))


def al_frente(h):
    return u.GetForegroundWindow() == h


def activar(h):
    """Traer al frente con AttachThreadInput (SetForegroundWindow solo falla si el frente es
    de otro proceso). Mismo camino que _arbCargar.activar()."""
    if al_frente(h):
        return True
    me = k.GetCurrentThreadId()
    hilos = {u.GetWindowThreadProcessId(x, None) for x in (u.GetForegroundWindow(), h) if x}
    otros = [t for t in hilos if t and t != me]
    for t in otros:
        u.AttachThreadInput(me, t, True)
    try:
        u.ShowWindow(h, 9)          # SW_RESTORE
        u.SetForegroundWindow(h)
        u.BringWindowToTop(h)
        time.sleep(0.4)
    finally:
        for t in otros:
            u.AttachThreadInput(me, t, False)
    return al_frente(h)


# ---------------------------------------------------------------- teclado y mouse reales

class KEYBDINPUT(ctypes.Structure):
    _fields_ = [('wVk', w.WORD), ('wScan', w.WORD), ('dwFlags', w.DWORD), ('time', w.DWORD),
                ('dwExtraInfo', ctypes.POINTER(ctypes.c_ulong))]


class _U(ctypes.Union):
    _fields_ = [('ki', KEYBDINPUT), ('pad', ctypes.c_byte * 32)]


class INPUT(ctypes.Structure):
    _fields_ = [('type', w.DWORD), ('u', _U)]


def _enviar(vk=0, scan=0, flags=0):
    i = INPUT(); i.type = 1
    i.u.ki = KEYBDINPUT(vk, scan, flags, 0, None)
    u.SendInput(1, ctypes.byref(i), ctypes.sizeof(INPUT))


u.VkKeyScanW.argtypes = [w.WCHAR]
u.VkKeyScanW.restype = ctypes.c_short


def tecla(vk):
    sc = u.MapVirtualKeyW(vk, 0)
    _enviar(vk=vk, scan=sc); time.sleep(0.015); _enviar(vk=vk, scan=sc, flags=0x2); time.sleep(0.03)


def combo(mod, vk):
    sc = u.MapVirtualKeyW(mod, 0)
    _enviar(vk=mod, scan=sc); tecla(vk); _enviar(vk=mod, scan=sc, flags=0x2); time.sleep(0.05)


def escribir(texto):
    """TECLAS REALES, como un humano y como los scripts del arb que andan (_arbInsumo): la F es la
    tecla F con SHIFT. El 30/09/2026 la version con KEYEVENTF_UNICODE mostraba FACUNDO en el
    campo pero el arb contesto "usuario no definido en el sistema": el arb no lee el campo, lee
    las teclas. Bloq Mayus invierte el SHIFT de las letras. Solo un caracter que pide AltGr
    (@ \\ ^ ~ en es-AR) o que el teclado no tiene va como unicode."""
    caps = u.GetKeyState(0x14) & 1
    for ch in texto:
        r = u.VkKeyScanW(ch)
        if r == -1 or ((r >> 8) & 0x6):
            _enviar(scan=ord(ch), flags=0x4); _enviar(scan=ord(ch), flags=0x4 | 0x2)
        else:
            vk, shift = r & 0xFF, bool((r >> 8) & 1)
            if caps and ch.isalpha():
                shift = not shift
            if shift:
                _enviar(vk=0x10, scan=u.MapVirtualKeyW(0x10, 0))
            tecla(vk)
            if shift:
                _enviar(vk=0x10, scan=u.MapVirtualKeyW(0x10, 0), flags=0x2)
        time.sleep(0.03)


def click_en(h):
    r = rect(h)
    u.SetCursorPos((r.l + r.r) // 2, (r.t + r.b) // 2); time.sleep(0.15)
    u.mouse_event(0x2, 0, 0, 0, 0); time.sleep(0.06); u.mouse_event(0x4, 0, 0, 0, 0)
    time.sleep(0.25)


WM_GETTEXT, WM_GETTEXTLENGTH, EM_SETSEL = 0x000D, 0x000E, 0x00B1


def texto_de(h):
    n = u.SendMessageW(h, WM_GETTEXTLENGTH, 0, 0)
    b = ctypes.create_unicode_buffer(n + 1)
    u.SendMessageW(h, WM_GETTEXT, n + 1, b)
    return b.value


def vaciar_campo(h=None):
    """Borra lo que tenga el campo ANTES de escribir. El arb precarga el Usuario con el nombre
    de la PC (FACUNDOS-PC): el 30/09/2026 HOME + SHIFT+END no lo selecciono y quedo
    'FACUNDOS-PCFACUNDO'. Ahora: seleccionar todo por mensaje + SUPR, y si el campo todavia
    tiene texto, END + tantos BACKSPACE como caracteres tenga."""
    if h:
        u.SendMessageW(h, EM_SETSEL, 0, -1)
        time.sleep(0.05)
        tecla(0x2E)               # SUPR
        resto = len(texto_de(h))
        if resto:
            tecla(0x23)           # END
            for _ in range(resto + 2):
                tecla(0x08)       # BACKSPACE
        return
    tecla(0x23)                   # END
    for _ in range(40):
        tecla(0x08)               # BACKSPACE (sin handle: se borra de mas, no de menos)


# ---------------------------------------------------------------- login

def entrar(login, usuario, clave):
    """Un solo intento. Devuelve 'ok'; 'foco' (la ventana perdio el frente antes de la clave:
    no se mando); 'foco_tarde' (lo perdio despues de tipear la clave: no se apreto Acepta);
    'usuario' (no quedo el usuario guardado); 'rechazo' (el arb puso un cartel);
    'sin_respuesta' (todo escrito pero el arb no tomo Acepta en 30 s)."""
    global ULTIMO_CARTEL
    if not activar(login):
        log('login: no pude traerla al frente')
        return 'foco'
    campos = campos_de_texto(login)
    log('login: %d campos (%s)' % (len(campos), ', '.join(cls(c) for c in campos)))
    if len(campos) >= 2:
        click_en(campos[0])
        if not al_frente(login):
            return 'foco'
        vaciar_campo(campos[0])
        if texto_de(campos[0]):
            log('login: no pude vaciar el Usuario')
            return 'usuario'
        escribir(usuario)
        time.sleep(0.2)
        visto = texto_de(campos[0])
        if visto != usuario:
            log('login: el Usuario no quedo igual al guardado (%d caracteres, esperaba %d)'
                % (len(visto), len(usuario)))
            return 'usuario'
        tecla(0x09)               # TAB -> Contraseña, como lo hace una persona
        time.sleep(0.6)
        cartel = cartel_del_arb()             # el arb puede validar el usuario al salir del campo
        if cartel:
            ULTIMO_CARTEL = cartel
            log('login: al salir del Usuario el arb dijo: %s' % cartel[:200])
            return 'rechazo'
        if not al_frente(login):
            return 'foco'
        if foco_de(login) != campos[1]:
            click_en(campos[1])
        vaciar_campo(campos[1]); escribir(clave)
        foto(login, 'login_antes_de_aceptar')   # la clave se ve con asteriscos
    else:
        # Sin campos visibles por clase: el cursor arranca en Contraseña (captura 31/08/2026).
        combo(0x10, 0x09)         # SHIFT+TAB -> Usuario
        vaciar_campo(); escribir(usuario)
        tecla(0x09)               # TAB -> Contraseña
        if not al_frente(login):
            return 'foco'
        vaciar_campo(); escribir(clave)
    if not al_frente(login):
        return 'foco_tarde'       # la clave ya se tipeo: no se aprieta Acepta
    apretar_acepta(login)
    foto(login, 'login_despues_de_aceptar')
    # OK recien cuando: no hay "Inicio de Sesion", no hay cartel del arb y la ventana principal
    # existe, tres segundos seguidos. El 30/09/2026 se dio por bueno solo porque se cerro el
    # login, y el arb habia puesto "usuario no definido en el sistema".
    fin = time.time() + 30
    seguidos = 0
    while time.time() < fin:
        time.sleep(0.5)
        cartel = cartel_del_arb()
        if cartel:
            ULTIMO_CARTEL = cartel
            log('login: el arb dijo: %s' % cartel[:200])
            return 'rechazo'
        if not ventana_login() and ventana_principal():
            seguidos += 1
            if seguidos >= 4:
                log('login OK')
                return 'ok'
        else:
            seguidos = 0
    log('login: el arb no tomo Aceptar en 30 s (sin cartel)')
    return 'sin_respuesta'


def boton_acepta(login):
    hallado = []

    def cb(hh, l):
        if 'cepta' in txt(hh).lower() and u.IsWindowVisible(hh):
            hallado.append(hh)
        return True
    u.EnumChildWindows(login, CB(cb), 0)
    return hallado[0] if hallado else None


def apretar_acepta(login):
    """El arb deja 'Acepta' gris hasta que procesa la clave, y el ENTER no lo aprieta (prueba
    de Fak 15:21, 30/09/2026: quedo todo escrito y no entro). Se espera a que se habilite (con
    un TAB a los 1,5 s para que el arb valide el campo) y se hace click real; si no aparece el
    boton, ALT+A (la A esta subrayada) y ENTER."""
    b = boton_acepta(login)
    fin = time.time() + 6
    tab = False
    while b and not u.IsWindowEnabled(b) and time.time() < fin:
        time.sleep(0.25)
        if not tab and time.time() > fin - 4.5:
            tecla(0x09); tab = True
    if b and u.IsWindowEnabled(b) and al_frente(login):
        log('login: click en Acepta')
        click_en(b)
        return
    log('login: Acepta %s; pruebo ALT+A y ENTER' % ('no se habilito' if b else 'no encontrado'))
    combo(0x12, 0x41)             # ALT+A
    time.sleep(0.5)
    if ventana_login():
        tecla(0x0D)


ULTIMO_CARTEL = ''


def cartel_del_arb():
    """Texto de un cuadro de mensaje (#32770) del arb, si hay uno visible."""
    for h in ventanas():
        if cls(h) == '#32770':
            partes = []

            def cb(hh, l):
                t = txt(hh).strip()
                if t and cls(hh).lower() == 'static':
                    partes.append(t)
                return True
            u.EnumChildWindows(h, CB(cb), 0)
            return ' '.join(partes) or txt(h) or 'cartel sin texto'
    return ''


class GUI(ctypes.Structure):
    _fields_ = [('cbSize', ctypes.c_uint), ('flags', ctypes.c_uint), ('hwndActive', w.HWND),
                ('hwndFocus', w.HWND), ('hwndCapture', w.HWND), ('hwndMenuOwner', w.HWND),
                ('hwndMoveSize', w.HWND), ('hwndCaret', w.HWND), ('rcCaret', R)]


def foco_de(h):
    gi = GUI(); gi.cbSize = ctypes.sizeof(GUI)
    u.GetGUIThreadInfo(u.GetWindowThreadProcessId(h, None), ctypes.byref(gi))
    return gi.hwndFocus


def foto(h, nombre):
    """Captura de la ventana a ~/arb_fotos/<nombre>.png (para ver que paso si falla)."""
    try:
        from PIL import ImageGrab
        r = rect(h)
        ImageGrab.grab(bbox=(r.l, r.t, r.r, r.b)).save(
            os.path.join(os.path.dirname(LOG), nombre + '.png'))
    except Exception as e:
        log('foto %s: %s' % (nombre, type(e).__name__))


def esperar_login(seg=90):
    fin = time.time() + seg
    while time.time() < fin:
        h = ventana_login()
        if h:
            time.sleep(0.5)
            return h
        time.sleep(0.5)
    return None


def cerrar_arb():
    subprocess.run(['taskkill', '/IM', 'produc.exe', '/F'], capture_output=True,
                   creationflags=0x08000000)
    fin = time.time() + 20
    while time.time() < fin and pids_arb():
        time.sleep(1)
    return not pids_arb()


def abrir_arb():
    subprocess.Popen([EXE], cwd=DIR_EXE)


def asegurar_z():
    """Z: suele quedar 'Desconectado' (conexion recordada): el Explorador la reconecta al abrirla,
    un programa no. Si el servidor responde, se reconecta con `net use`. Devuelve True si EXE
    quedo accesible; False si el servidor no responde (fuera de la red de la planta / sin VPN)."""
    if os.path.exists(EXE):
        return True
    unc_exe = UNC_Z + r'\arb\prod\produc.exe'
    if not os.path.exists(unc_exe):
        log('servidor no responde (%s)' % unc_exe)
        return False
    r = subprocess.run(['net', 'use', 'Z:', UNC_Z, '/persistent:yes'], capture_output=True,
                       text=True, creationflags=0x08000000)
    log('net use Z: -> %s' % (r.returncode,))
    return os.path.exists(EXE)


def asegurar_icono():
    """La primera vez que se llega al servidor, guarda el icono del arb en local y se lo pone a
    los accesos directos (un icono en Z: no se ve cuando Z: esta desconectado)."""
    if os.path.exists(ICONO) and os.path.getsize(ICONO) > 0:
        return
    try:
        _guardar_icono()
    except Exception as e:                   # sin icono el arb igual se abre
        log('icono: %s' % type(e).__name__)
        if os.path.exists(ICONO) and os.path.getsize(ICONO) == 0:
            os.remove(ICONO)


def _guardar_icono():
    ps = ("$i=[System.Drawing.Icon]::ExtractAssociatedIcon('%s'); $f=[IO.File]::Create('%s'); "
          "$i.Save($f); $f.Close(); $w=New-Object -ComObject WScript.Shell; "
          "$d=[Environment]::GetFolderPath('Desktop'); "
          "foreach($n in 'ARB.lnk','ARB - reiniciar.lnk'){ $p=Join-Path $d $n; "
          "if(Test-Path $p){ $l=$w.CreateShortcut($p); $l.IconLocation='%s,0'; $l.Save() } }"
          % (EXE, ICONO, ICONO))
    subprocess.run(['powershell.exe', '-NoProfile', '-Command', 'Add-Type -AssemblyName System.Drawing; ' + ps],
                   capture_output=True, creationflags=0x08000000, timeout=60)
    log('icono guardado: %s' % os.path.exists(ICONO))


def diagnostico():
    for h in ventanas():
        print('%-16s ena=%-5s %r' % (cls(h), bool(u.IsWindowEnabled(h)), txt(h)[:50]))
        if 'Inicio de Sesi' in txt(h):
            for i, c in enumerate(campos_de_texto(h)):
                r = rect(c)
                # Solo el primero (Usuario) muestra su texto; del resto, solo el largo.
                visto = repr(texto_de(c)) if i == 0 else '%d caracteres' % len(texto_de(c))
                print('    campo %-20s en (%d,%d)  %s' % (cls(c), r.l, r.t, visto))
    if not ventanas():
        print('el arb no esta abierto')


def main(argv):
    if '--diagnostico' in argv:
        diagnostico(); return 0
    if os.environ.get('CLAUDECODE'):
        print('Este lanzador lo usa Fak con doble click (ARB / ARB - reiniciar). '
              'Claude no lo ejecuta: pedile a Fak que lo apriete.')
        return 3

    cred = None if '--guardar-clave' in argv else leer_cred()
    if cred is None:
        cred = pedir_y_guardar_cred()
        if cred is None:
            return 1
    usuario, clave = cred

    if '--reiniciar' in argv and pids_arb():
        r = aviso('¿Cierro el arb y lo vuelvo a abrir?\n\n'
                  'Usalo cuando esta trabado. Si estabas grabando algo, se pierde.',
                  MB_YESNO | MB_ICONQ)
        if r != IDYES:
            return 0
        log('reiniciar: cerrando produc.exe')
        if not cerrar_arb():
            aviso('No se pudo cerrar el arb. Cerralo desde el Administrador de tareas.')
            return 1

    if pids_arb():
        login = ventana_login()
        if not login:
            p = ventana_principal()
            if p:
                activar(p)
            log('ya estaba abierto')
            return 0
    else:
        if not asegurar_z():
            aviso('No llego al servidor de la empresa (%s): el arb vive ahi.\n\n'
                  '¿Estas conectado a la red de la planta o a la VPN? '
                  'Conectate y volve a apretar ARB.' % UNC_Z)
            return 1
        asegurar_icono()
        log('abriendo produc.exe')
        abrir_arb()
        login = esperar_login()
        if not login:
            aviso('El arb no mostro la ventana de inicio de sesion en 90 segundos.')
            return 1

    res = entrar(login, usuario, clave)
    del clave
    if res == 'foco':
        aviso('No pude escribir en "Inicio de Sesion": otra ventana le saco el frente.\n'
              'No se mando la clave. Hacele click al arb y volve a apretar ARB.')
        return 1
    if res == 'foco_tarde':
        aviso('Otra ventana le saco el frente al arb mientras escribia la clave, asi que no '
              'apreté Aceptar.\nBorrá lo que haya quedado en "Inicio de Sesion" y volve a apretar ARB.')
        return 1
    if res == 'usuario':
        aviso('No pude dejar el Usuario en "%s" (el arb lo precarga con otro nombre).\n'
              'No se mando la clave. Borralo a mano, escribi %s y la clave.' % (usuario, usuario))
        return 1
    if res == 'sin_respuesta':
        aviso('Escribi el usuario y la clave pero el arb no tomo "Acepta".\n'
              'Ya esta todo escrito: apretá Acepta vos. (La clave guardada NO se cambia.)')
        return 1
    if res == 'rechazo':
        if aviso('El arb no dejo entrar%s.\n\n'
                 % ((': "%s"' % ULTIMO_CARTEL[:150]) if ULTIMO_CARTEL else '') +
                 '¿Queres cargarlos de nuevo? (despues apreta ARB otra vez)',
                 MB_YESNO | MB_ICONQ) == IDYES:
            pedir_y_guardar_cred()
        return 1
    p = ventana_principal()
    if p:
        activar(p)
    return 0


def una_sola_vez(argv):
    """Un doble click repetido no lanza un segundo login (mutex con nombre de Windows) y
    ningun error muere en silencio: pythonw no tiene consola, asi que va al log y a un aviso."""
    if '--diagnostico' not in argv:
        k32 = ctypes.WinDLL('kernel32', use_last_error=True)
        k32.CreateMutexW(None, False, 'Local\\BarackArbLanzar')
        if ctypes.get_last_error() == 183:   # ERROR_ALREADY_EXISTS
            log('ya hay un lanzador corriendo: salgo')
            return 0
    try:
        return main(argv)
    except Exception as e:
        log('error: %s: %s' % (type(e).__name__, str(e)[:200]))
        aviso('El acceso directo del arb fallo (%s).\nEl detalle quedo en %s' % (type(e).__name__, LOG))
        return 1


if __name__ == '__main__':
    sys.exit(una_sola_vez(sys.argv[1:]))
