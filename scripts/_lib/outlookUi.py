"""
outlookUi.py — que Outlook no me deje ciego ni colgado.

Dos problemas distintos, los dos del 15/09/2026:

1. **Un Outlook que arranca MI script no es el Outlook de Fak.** Si `Dispatch('Outlook.Application')`
   encuentra Outlook cerrado, lo levanta el como cliente de automatizacion: queda sin ventana
   (`Explorers.Count == 0`) y ademas el **Object Model Guard** de Outlook lo trata como programa
   externo, asi que saca el cartel *"Un programa intenta enviar correo en su nombre"* en cada
   `Send()`. Con Outlook ya abierto por el usuario y el antivirus al dia, ese cartel no sale.
   -> `asegurar_outlook()` lo arranca como PROGRAMA NORMAL (el .exe), igual que si Fak hiciera
   doble clic, y recien despues se conecta.

2. **El cartel es MODAL y bloquea el COM: el script se queda colgado sin decir nada.** Fak:
   *"no te das cuenta y te impide mandar los mails"*. La corrida muere por timeout, sin salida.
   -> `vigilando()` corre la operacion en un hilo y, desde el principal, avisa EN EL MOMENTO en
   que el cartel aparece, con su texto. Lo que se ve en pantalla se dice, no se adivina.

Lo que este modulo NO hace, a proposito: apagar el cartel. Es el control que impide que un
programa mande correo a nombre de Fak, apagarlo es tocar la seguridad de su maquina, y el
interruptor soportado vive en Centro de confianza -> Acceso mediante programacion (lo elige el,
no yo).
"""
import ctypes
import ctypes.wintypes as w
import os
import subprocess
import sys
import threading
import time

user32 = ctypes.windll.user32

EXE_OUTLOOK = r'C:\Program Files\Microsoft Office\Root\Office16\OUTLOOK.EXE'

# Texto del cartel del Object Model Guard, en los dos idiomas en que puede salir.
SENALES = (
    'intenta enviar correo en su nombre',
    'intenta tener acceso a las direcciones',
    'trying to send an e-mail message on your behalf',
    'trying to access e-mail addresses',
)

_ENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, w.HWND, w.LPARAM)


def _texto(hwnd) -> str:
    n = user32.GetWindowTextLengthW(hwnd)
    buf = ctypes.create_unicode_buffer(n + 1)
    user32.GetWindowTextW(hwnd, buf, n + 1)
    return buf.value or ''


def _clase(hwnd) -> str:
    buf = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, buf, 256)
    return buf.value or ''


def _pid(hwnd) -> int:
    p = w.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(p))
    return p.value


def _hijos(hwnd):
    out = []
    user32.EnumChildWindows(hwnd, _ENUMPROC(lambda h, _l: (out.append(h), True)[1]), 0)
    return out


def _ventanas():
    out = []
    user32.EnumWindows(_ENUMPROC(lambda h, _l: (out.append(h), True)[1]), 0)
    return out


def _pids_outlook():
    """PIDs de OUTLOOK.EXE, sin depender de psutil."""
    try:
        sal = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq OUTLOOK.EXE', '/FO', 'CSV', '/NH'],
                             capture_output=True, text=True, timeout=30).stdout
    except Exception:                                              # noqa: BLE001
        return []
    pids = []
    for linea in sal.splitlines():
        partes = [p.strip('" ') for p in linea.split('","')]
        if len(partes) > 1 and partes[1].isdigit():
            pids.append(int(partes[1]))
    return pids


def es_cartel(texto: str) -> bool:
    """Si ESTE texto es el del Object Model Guard. Separado para poder probarlo sin Outlook."""
    return any(s in ' '.join(str(texto or '').split()).lower() for s in SENALES)


def cartel_de_seguridad():
    """
    El cartel del Object Model Guard, si esta en pantalla: devuelve su texto, o None.

    Se busca por CONTENIDO y no por titulo: el titulo es 'Microsoft Outlook', igual que
    cualquier otro aviso suyo. El texto vive en los controles hijos del dialogo (#32770).
    """
    pids = set(_pids_outlook())
    if not pids:
        return None
    for h in _ventanas():
        if not user32.IsWindowVisible(h) or _clase(h) != '#32770' or _pid(h) not in pids:
            continue
        partes = [_texto(h)] + [_texto(c) for c in _hijos(h)]
        junto = ' '.join(x for x in ' '.join(p for p in partes if p).split())
        if es_cartel(junto):
            return junto
    return None


def asegurar_outlook(segundos=90, log=print):
    """
    Deja Outlook corriendo COMO PROGRAMA DEL USUARIO, con su ventana abierta.

    Devuelve 'ya-estaba' | 'arrancado'. Si no llega a levantar, lanza RuntimeError: es mejor
    frenar aca que descubrirlo colgado adentro de un Send().
    """
    if _pids_outlook():
        return 'ya-estaba'
    if not os.path.exists(EXE_OUTLOOK):
        raise RuntimeError(f'no encuentro Outlook en {EXE_OUTLOOK}')
    log('Outlook estaba cerrado: lo abro como programa normal (no por automatizacion, '
        'que es lo que dispara el cartel de seguridad en cada envio).')
    subprocess.Popen([EXE_OUTLOOK], close_fds=True)
    for _ in range(segundos):
        if _pids_outlook():
            time.sleep(8)          # que termine de levantar el perfil antes de hablarle por COM
            return 'arrancado'
        time.sleep(1)
    raise RuntimeError(f'Outlook no levanto en {segundos} s')


def vigilando(fn, descripcion='la operacion', log=print):
    """
    Corre `fn()` y avisa APENAS aparece el cartel modal, en vez de colgarse mudo.

    El que va al hilo es el VIGIA, no la operacion: `fn` toca objetos COM creados en el hilo
    principal (apartamento STA) y llamarlos desde otro hilo sin marshalling revienta con
    RPC_E_WRONG_THREAD. El vigia solo usa APIs de ventanas, que si son seguras entre hilos.

    No puede haber timeout: `fn` bloquea el hilo principal mientras el cartel espera el clic.
    Lo que da es VISIBILIDAD — con la salida sin buffer, el aviso sale en el momento y se
    repite cada 15 s, asi que la corrida ya no parece colgada.

    Devuelve (resultado_de_fn, texto_del_cartel_o_None).
    """
    parar = threading.Event()
    visto = {}

    def vigia():
        t0 = time.time()
        ultimo = 0.0
        while not parar.wait(1.0):
            c = cartel_de_seguridad()
            if not c:
                if visto.get('texto') and not visto.get('cerrado'):
                    visto['cerrado'] = True
                    log('    (el cartel se cerro, sigo)')
                    sys.stdout.flush()
                continue
            if not visto.get('texto'):
                visto['texto'] = c
                log('')
                log('*** OUTLOOK PUSO UN CARTEL Y ESTA ESPERANDO QUE LO CONTESTES ***')
                log(f'    dice: {c[:300]}')
                log(f'    {descripcion} esta frenada hasta que aprietes Permitir.')
                ultimo = time.time()
                sys.stdout.flush()
            elif time.time() - ultimo >= 15:
                ultimo = time.time()
                log(f'    ... sigue esperando el clic ({int(time.time() - t0)} s)')
                sys.stdout.flush()

    hilo = threading.Thread(target=vigia, daemon=True)
    hilo.start()
    try:
        res = fn()
    finally:
        parar.set()
        hilo.join(3)
    return res, visto.get('texto')


def selftest() -> int:
    """Prueba en las dos direcciones lo unico que se puede probar sin Outlook delante."""
    casos = [
        # (texto, esperado) — el primero es el cartel REAL que fotografio Fak el 15/09/2026
        ('Un programa intenta enviar correo en su nombre. Si esto es inesperado, haga clic en '
         'Denegar y mire si el programa antivirus esta actualizado.', True),
        ('A program is trying to send an e-mail message on your behalf.', True),
        ('Un programa intenta tener acceso a las direcciones de correo electronico', True),
        ('Desea guardar los cambios?', False),                  # otro aviso de Outlook: NO es
        ('Microsoft Outlook', False),                           # el titulo pelado: NO alcanza
        ('No se pudo enviar el mensaje al destinatario', False),
        ('', False),
    ]
    malos = 0
    for texto, esp in casos:
        obt = es_cartel(texto)
        ok = obt == esp
        malos += (not ok)
        print(f'  {"OK  " if ok else "FALLA"}  esperado={esp!s:5} obtenido={obt!s:5}  {texto[:62]!r}')

    # vigilando: devuelve lo que devuelve fn, y sin cartel el segundo valor es None
    res, cartel = vigilando(lambda: 'listo', descripcion='una prueba')
    ok = res == 'listo' and cartel is None
    malos += (not ok)
    print(f'  {"OK  " if ok else "FALLA"}  vigilando devuelve ({res!r}, {cartel!r})')

    # y no se traga la excepcion de fn
    try:
        vigilando(lambda: (_ for _ in ()).throw(ValueError('x')), descripcion='una prueba')
        print('  FALLA  vigilando se comio la excepcion')
        malos += 1
    except ValueError:
        print('  OK    vigilando re-lanza la excepcion de fn')

    print(f'\nselftest: {len(casos) + 2 - malos}/{len(casos) + 2}')
    return 1 if malos else 0


if __name__ == '__main__':
    sys.exit(selftest())
