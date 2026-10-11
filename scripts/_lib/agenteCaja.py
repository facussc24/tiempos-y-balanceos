# -*- coding: utf-8 -*-
"""agenteCaja.py — corre un script de Python del agente por API adentro de una caja (cola HOY-24b, 11/10/2026).

    python -P agenteCaja.py <script.py> [argumentos...]
    python -P agenteCaja.py -m <pytest|unittest> [argumentos...]

Por que existe. El guardian de la casa lee el TEXTO del comando, no lo que hace el script: un .py escrito por el
agente abria cualquier ruta y el escaneo de palabras no lo veia (auditor, 11/10/2026). Aca el control corre
mientras el script corre: un "audit hook" de Python (PEP 578) recibe cada apertura de archivo, cada cambio en el
disco, cada proceso y cada conexion ANTES de que ocurra, con la ruta ya resuelta, y la niega si sale de la caja.

La caja (variables de entorno que pone agenteApi.mjs; las rutas van separadas por os.pathsep):
    AGENTE_CAJA_ESCRIBE   carpetas donde se puede escribir o crear (la carpeta de trabajo y su tmp)
    AGENTE_CAJA_LEE       carpetas que se pueden leer (el repo y la carpeta de la corrida); las de Python van solas

Que niega: escribir, mover o quitar fuera de ESCRIBE · leer fuera de LEE · leer un archivo de secretos (.env*,
.qr-secret) aunque este adentro · abrir otro programa (subprocess, os.system, os.startfile) · salir a la red
(socket, urllib, http, ftp, smtp) · cargar una DLL o pedirle una funcion con ctypes (salvo lo que el propio
`import ctypes` necesita) · escribir en el registro de Windows.

Lo que NO cubre (se sabe y queda escrito): un audit hook no es un candado del sistema operativo. Lo que un modulo
compilado hace por su cuenta (pywin32, un objeto COM) no pasa por aca: por eso el texto del script se escanea antes
(agenteApi.mjs, `escanear`: solo el ProgID de CATIA, nada de win32file/win32process/WScript). Las dos capas juntas
frenan el error y el ataque simple; no a quien escriba codigo ofuscado a proposito.

Sale con el codigo del script; 97 si faltan las variables de la caja.
"""
import os
import re
import sys

SECRETO = re.compile(r"^(\.env(\.[\w.-]+)?|\.qr-secret)$", re.I)

# Eventos que se niegan siempre, por nombre exacto (mas los prefijos de `hook`).
NEGADOS = (
    "os.system", "os.startfile", "os.startfile/2", "os.fork", "os.forkpty", "os.kill", "os.killpg",
    "pty.spawn", "_winapi.CreateProcess", "webbrowser.open",
    "socket.connect", "socket.bind", "socket.sendto", "socket.sendmsg", "socket.getaddrinfo",
    "socket.gethostbyname", "socket.gethostbyaddr", "socket.getnameinfo",
    "urllib.Request", "http.client.connect", "ftplib.connect", "smtplib.connect", "imaplib.open",
    "poplib.connect", "nntplib.connect", "telnetlib.Telnet.open",
    "winreg.CreateKey", "winreg.DeleteKey", "winreg.DeleteValue", "winreg.SetValue", "winreg.SaveKey",
    "winreg.LoadKey", "winreg.DisableReflectionKey", "winreg.EnableReflectionKey",
)
PREFIJOS_NEGADOS = ("subprocess.", "os.exec", "os.spawn", "os.posix_spawn")
# ctypes: en Windows el propio `import ctypes` carga kernel32 y le pide GetLastError, y numpy (y con el openpyxl)
# importa ctypes. Eso pasa; cualquier otra DLL o funcion se contesta como «no existe», que es lo que una libreria
# sabe manejar (medido 11/10/2026: con todo ctypes negado, `import openpyxl` no cargaba).
CTYPES_DLL = ("kernel32", "kernel32.dll")
CTYPES_FUNCIONES = ("GetLastError",)
# Eventos de `os` y `tempfile` que cambian el disco: TODAS sus rutas tienen que caer en ESCRIBE. Los de `shutil` que
# no estan en COPIAN se tratan igual sin nombrarlos uno por uno (ver `hook`): uno nuevo nace cerrado.
MUTAN = (
    "os.remove", "os.rmdir", "os.mkdir", "os.chmod", "os.chown", "os.link", "os.symlink", "os.truncate",
    "os.utime", "os.rename", "tempfile.mkstemp", "tempfile.mkdtemp", "os.mkfifo", "os.mknod", "os.chflags",
    "os.setxattr", "os.removexattr",
)
# Eventos que copian o mueven: (indices de lo que se lee), (indices de lo que se escribe).
COPIAN = {
    "shutil.copyfile": ((0,), (1,)), "shutil.copymode": ((0,), (1,)), "shutil.copystat": ((0,), (1,)),
    "shutil.copytree": ((0,), (1,)), "shutil.move": ((), (0, 1)),
}
# Eventos que miran una carpeta o cambian de carpeta: la ruta tiene que caer en LEE.
MIRAN = ("os.listdir", "os.scandir", "os.walk", "os.fwalk", "os.chdir", "glob.glob", "glob.glob/2", "pathlib.Path.glob", "pathlib.Path.rglob")


def _lista(nombre):
    return [p for p in os.environ.get(nombre, "").split(os.pathsep) if p.strip()]


def _real(ruta):
    """La ruta real (enlaces resueltos), normalizada para comparar; None si no es una ruta."""
    try:
        if isinstance(ruta, int):
            return None
        return os.path.normcase(os.path.realpath(os.fsdecode(ruta)))
    except Exception:
        return None


def _dentro(real, raices):
    return any(real == base or real.startswith(base + os.sep) for base in raices)


def armar_caja(escribe, lee):
    """Devuelve el hook. `escribe` y `lee` son listas de carpetas; se congelan ya resueltas."""
    escribe = tuple(r for r in (_real(p) for p in escribe) if r)
    de_python = {sys.prefix, sys.base_prefix, sys.exec_prefix, os.path.dirname(os.path.abspath(__file__))}
    de_python.update(p for p in sys.path if p and os.path.isdir(p))
    try:
        import site
        de_python.add(site.getusersitepackages())
    except Exception:
        pass
    lee = tuple(r for r in (_real(p) for p in list(lee) + list(escribe) + sorted(de_python)) if r)
    nulo = os.path.normcase(os.path.realpath(os.devnull))
    de_escritura = os.O_WRONLY | os.O_RDWR | os.O_APPEND | os.O_CREAT | os.O_TRUNC

    def negar(evento, detalle):
        raise PermissionError(f"CAJA: {evento} no se permite ({detalle}). No reintentar.")

    def pide_escribir(evento, ruta):
        real = _real(ruta)
        if real is None or real == nulo:
            return
        if not _dentro(real, escribe):
            negar(evento, f"cambia algo fuera de la carpeta de trabajo: {ruta}")

    def pide_leer(evento, ruta):
        real = _real(ruta)
        if real is None or real == nulo:
            return
        if SECRETO.match(os.path.basename(real)):
            negar(evento, f"archivo de secretos: {ruta}")
        if not _dentro(real, lee):
            negar(evento, f"lee fuera del repo y de la carpeta de trabajo: {ruta}")

    def hook(evento, args):
        if evento == "open":
            ruta, modo, banderas = (tuple(args) + (None, None, None))[:3]
            escribiendo = (isinstance(modo, str) and any(c in modo for c in "wax+")) or (isinstance(banderas, int) and bool(banderas & de_escritura))
            (pide_escribir if escribiendo else pide_leer)(evento, ruta)
        elif evento in NEGADOS or evento.startswith(PREFIJOS_NEGADOS):
            negar(evento, "abrir programas, salir a la red o tocar el registro")
        elif evento == "ctypes.dlopen":
            if os.path.basename(str(args[0] if args else "")).lower() not in CTYPES_DLL:
                negar(evento, f"cargar la DLL {args[0] if args else ''!r}")
        elif evento in ("ctypes.dlsym", "ctypes.dlsym/handle"):
            if not (len(args) > 1 and args[1] in CTYPES_FUNCIONES):
                # AttributeError y no PermissionError: es lo que ctypes da cuando la funcion no existe
                raise AttributeError(f"CAJA: ctypes no entrega {args[1] if len(args) > 1 else '?'!r} adentro de la caja")
        elif evento in COPIAN:
            leidos, escritos = COPIAN[evento]
            for i in leidos:
                if i < len(args):
                    pide_leer(evento, args[i])
            for i in escritos:
                if i < len(args):
                    pide_escribir(evento, args[i])
        elif evento in MUTAN or evento.startswith("shutil."):
            for a in args:
                if isinstance(a, (str, bytes, os.PathLike)):
                    pide_escribir(evento, a)
        elif evento in MIRAN:
            if args and isinstance(args[0], (str, bytes, os.PathLike)):
                pide_leer(evento, args[0])
        elif evento == "sqlite3.connect":
            if args and isinstance(args[0], (str, bytes, os.PathLike)) and os.fsdecode(args[0]) != ":memory:":
                pide_escribir(evento, args[0])

    return hook


def main(argv):
    escribe, lee = _lista("AGENTE_CAJA_ESCRIBE"), _lista("AGENTE_CAJA_LEE")
    if not escribe or not argv:
        sys.stderr.write("agenteCaja: falta AGENTE_CAJA_ESCRIBE o el script. No corro nada.\n")
        return 97
    import runpy  # antes del hook: lo que la caja necesita se carga afuera de la caja

    sys.dont_write_bytecode = True  # sin __pycache__ en el repo ni en la carpeta de Python
    sys.addaudithook(armar_caja(escribe, lee))
    if argv[0] == "-m":
        if len(argv) < 2 or argv[1] not in ("pytest", "unittest"):
            sys.stderr.write("agenteCaja: -m solo con pytest o unittest.\n")
            return 97
        sys.argv = [argv[1]] + argv[2:]
        sys.path.insert(0, os.getcwd())
        runpy.run_module(argv[1], run_name="__main__", alter_sys=True)
    else:
        sys.argv = [argv[0]] + argv[1:]
        runpy.run_path(argv[0], run_name="__main__")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
