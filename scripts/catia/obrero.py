# -*- coding: utf-8 -*-
"""obrero.py: el programa que corre solo en la notebook con CATIA, sin nadie adelante.

Cada 60 s mira `COLA 3D\\asignados\\*-<NOMBRE-PC>.txt` (lo deja la PC principal por la nube). Cada asignado es JSON
{"item": "...", "ejercicio": "<id>", "instrucciones": "...", "asignado": "<fecha>"}. Toma de a UNO, en orden de nombre,
los que todavia no tienen `COLA 3D\\<NOMBRE-PC>\\resultado-<item>.txt`; mide la RAM libre (con menos de 0,8 GB espera: Fak 23/10/2026, «si hay 1 gb libre se hace con eso»);
corre `ejercicios\\<id>\\catia.py <carpeta de trabajo>` con el mismo Python (20 min como mucho) y deja en
`COLA 3D\\<NOMBRE-PC>\\`: resultado-<item>.txt (JSON), la carpeta <item>\\ con STEP / BMP / PNG, latido.json cada 15 min
y obrero.log. Nunca renombra ni borra nada de `asignados\\`: escribe SOLO en su carpeta y en su carpeta local.

Contrato con el ejercicio: lee `<trabajo>\\asignado.json`, escribe `<trabajo>\\salida.json` ({"ok", "medidas",
"archivos": [rutas dentro de <trabajo>], ...}) y sale con 0 (termino), 3 (CATIA no arranco o no conecto: se reintenta
hasta 3 veces), 4 (hay una CATIA abierta que no es del obrero: no corrio, queda pendiente) u otro (error).
`ejercicios\\<id>\\ejercicio.json` dice si usa CATIA ({"usa_catia": true}); si falta, se toma que si.

Uso: python obrero.py [--cola <COLA 3D>] [--hostname X] [--una-vuelta] (ver --help).
"""
import argparse
import ctypes
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import traceback

VERSION = "1.0 (23/10/2026)"
sys.dont_write_bytecode = True          # nada de __pycache__ en la carpeta de la nube (escribe solo en la suya)
AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA_OK, SALIDA_SIN_CATIA, SALIDA_CATIA_AJENA = 0, 3, 4
EXTENSIONES_A_COPIAR = {".stp", ".step", ".stl", ".bmp", ".png", ".jpg", ".jpeg", ".pdf", ".json", ".txt", ".csv"}
TOPE_ARCHIVO = 50 * 1024 * 1024
ITEM_VALIDO = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.\-]*$")
EJERCICIO_VALIDO = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_\-]*$")


def ahora():
    return time.strftime("%Y-%m-%d %H:%M:%S")


def ram_libre_gb():
    """RAM libre en GB (psutil si esta; si no, GlobalMemoryStatusEx de Windows). None si no se pudo medir."""
    try:
        import psutil  # opcional
        return round(psutil.virtual_memory().available / 1024 ** 3, 2)
    except Exception:  # noqa: BLE001
        pass
    try:
        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                        ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                        ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                        ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                        ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
        m = MEMORYSTATUSEX()
        m.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)):
            return round(m.ullAvailPhys / 1024 ** 3, 2)
    except Exception:  # noqa: BLE001
        pass
    return None


def item_de_archivo(nombre, host):
    """'<item>-<HOST>.txt' -> item (se compara sin mayusculas; el nombre de la PC puede tener guiones: se saca el final
    entero). None si el archivo no es de este host; '' si es de este host pero el item no sirve para un nombre de archivo."""
    suf = "-" + host.upper() + ".TXT"
    if not nombre.upper().endswith(suf):
        return None
    item = nombre[: -len(suf)]
    if not item or ".." in item or not ITEM_VALIDO.match(item):
        return ""
    return item


def leer_json(ruta, reintentos=3, espera=5.0):
    """(dato, None, None) o (None, error, tipo): tipo 'no_se_lee' (la nube todavia no lo bajo: se reintenta en la
    proxima vuelta) o 'roto' (se leyo pero no es JSON). Reintenta las dos cosas: un archivo a medio sincronizar se ve
    roto un rato."""
    err, tipo = None, None
    for i in range(max(1, reintentos)):
        try:
            with open(ruta, "r", encoding="utf-8-sig") as f:
                texto = f.read()
            return json.loads(texto), None, None
        except OSError as e:
            err, tipo = f"no se pudo leer: {e!r}", "no_se_lee"
        except ValueError as e:
            err, tipo = f"JSON invalido: {e}", "roto"
        if i < reintentos - 1:
            time.sleep(espera)
    return None, err, tipo


def escribir_json(ruta, dato, reintentos=5, espera=2.0):
    """Escribe a un temporal en la misma carpeta y lo cambia de nombre (la principal nunca lee un archivo a medias).
    Reintenta: la nube a veces tiene el archivo tomado mientras lo sube. Devuelve True si quedo escrito."""
    tmp = ruta + ".escribiendo"
    for i in range(reintentos):
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(dato, f, ensure_ascii=False, indent=1, default=str)
            os.replace(tmp, ruta)
            return True
        except OSError:
            if i < reintentos - 1:
                time.sleep(espera)
    return False


def ultimas_lineas(ruta, n=40):
    try:
        with open(ruta, "r", encoding="utf-8", errors="replace") as f:
            return f.read().splitlines()[-n:]
    except OSError:
        return []


class Candado:
    """Un solo obrero por PC (un doble clic de mas serian dos CATIA): candado de Windows sobre un archivo local."""

    def __init__(self, ruta):
        self.ruta, self.f = ruta, None

    def tomar(self):
        import msvcrt
        self.f = open(self.ruta, "a+")
        try:
            self.f.seek(0)
            msvcrt.locking(self.f.fileno(), msvcrt.LK_NBLCK, 1)
            return True
        except OSError:
            self.f.close()
            self.f = None
            return False


class Obrero:
    def __init__(self, a):
        self.a = a
        self.host = a.hostname.upper()
        self.cola = os.path.abspath(a.cola)
        self.asignados = os.path.join(self.cola, "asignados")
        self.mia = os.path.join(self.cola, self.host)
        self.local = os.path.abspath(a.local)
        self.ejercicios = os.path.abspath(a.ejercicios)
        os.makedirs(os.path.join(self.local, "trabajo"), exist_ok=True)
        # antes de importar catia_base: su carpeta de trabajo por defecto se fija al importarlo
        os.environ["CATIA_TRABAJO"] = os.path.join(self.local, "trabajo")
        self.log_local = os.path.join(self.local, "obrero.log")
        self.log_nube = os.path.join(self.mia, "obrero.log")
        self._pendiente_log = []
        self._lock = threading.Lock()
        self.inicio = ahora()
        self.en_curso = None
        self.estado = "arrancando"
        self.ultimo = None
        self.hechos = set()
        self.ignorados = set()
        self.pospuestos = {}
        self.avisados = set()
        self._ultimo_latido = 0.0
        self._parar = threading.Event()

    # ---------- registro y latido ----------
    def log(self, msg):
        linea = f"{ahora()}  {msg}"
        try:
            print(linea, flush=True)
        except Exception:  # noqa: BLE001
            pass
        with self._lock:
            try:
                with open(self.log_local, "a", encoding="utf-8") as f:
                    f.write(linea + "\n")
            except OSError:
                pass
            self._pendiente_log.append(linea)
            try:
                os.makedirs(self.mia, exist_ok=True)
                with open(self.log_nube, "a", encoding="utf-8") as f:
                    f.write("\n".join(self._pendiente_log) + "\n")
                self._pendiente_log = []
            except OSError:
                if len(self._pendiente_log) > 5000:          # la nube no deja escribir hace rato: no crecer sin fin
                    self._pendiente_log = self._pendiente_log[-5000:]

    def catia_abierta(self):
        try:
            return self.base().cnext_abiertos()
        except Exception:  # noqa: BLE001
            return None

    def latir(self, motivo="cada 15 min"):
        pids = self.catia_abierta()
        d = {"hostname": self.host, "version_obrero": VERSION, "hora": ahora(), "motivo": motivo,
             "item_en_curso": self.en_curso, "estado": self.estado, "ram_libre_gb": ram_libre_gb(),
             "catia_abierta": None if pids is None else bool(pids), "catia_pids": pids, "ultimo_resultado": self.ultimo,
             "arranco": self.inicio, "python": sys.version.split()[0], "pid_obrero": os.getpid(), "cola": self.cola}
        try:
            os.makedirs(self.mia, exist_ok=True)
        except OSError:
            pass
        if not escribir_json(os.path.join(self.mia, "latido.json"), d, reintentos=3, espera=1.0):
            self.log("AVISO: no pude escribir latido.json en la nube (lo reintento en el proximo)")
        self._ultimo_latido = time.time()

    def _hilo_latido(self):
        while not self._parar.wait(5.0):
            if time.time() - self._ultimo_latido >= self.a.latido_seg:
                try:
                    self.latir()
                except Exception as e:  # noqa: BLE001
                    self.log(f"AVISO: fallo el latido: {e!r}")

    # ---------- CATIA propia ----------
    def base(self):
        if AQUI not in sys.path:
            sys.path.insert(0, AQUI)
        import catia_base  # sin pywin32 se importa igual (lo de COM va adentro de las funciones)
        return catia_base

    @staticmethod
    def leer_mi_catia(trabajo):
        """Lo que conectar() guardo de la CATIA que arranco (pid + hora de arranque), o None."""
        try:
            with open(os.path.join(trabajo, "mi_catia.json"), encoding="utf-8") as f:
                g = json.load(f)
            return g if isinstance(g, dict) and g.get("pid") else None
        except (OSError, ValueError):
            return None

    def limpiar_catia(self, trabajo, vista=None):
        """Despues de cada corrida con CATIA: si quedo abierta LA DE ESTA CORRIDA (pid + hora de arranque que conectar()
        guardo en <trabajo>\\mi_catia.json, y es la unica abierta), se cierra. Cualquier otra no se toca. `vista` es la
        copia que el obrero guardo mientras corria: apagar() borra el archivo aunque CATIA no se haya ido (un cuadro
        abierto frena el Quit), y sin esa copia la CATIA de la corrida quedaria abierta y trabaria la cola."""
        b = self.base()
        pids = b.cnext_abiertos()
        if not pids:
            return "sin CATIA abierta" if pids is not None else "no se pudo mirar (tasklist fallo): no toco nada"
        g = self.leer_mi_catia(trabajo) or vista or {}
        if not b.es_mia(pids, g):
            return f"hay CATIA abierta (pids {pids}) que no es la de esta corrida: no se toca"
        subprocess.run(["taskkill", "/PID", str(g["pid"]), "/F"], capture_output=True)
        for _ in range(40):
            if g["pid"] not in (b.cnext_abiertos() or []):
                break
            time.sleep(1)
        return f"cerre la CATIA de esta corrida que quedo abierta (pid {g['pid']})"

    # ---------- cola ----------
    def pendientes(self):
        try:
            nombres = sorted(os.listdir(self.asignados), key=str.upper)
        except OSError as e:
            if "sin_asignados" not in self.avisados:
                self.log(f"AVISO: no puedo leer {self.asignados}: {e!r} (sigo mirando)")
                self.avisados.add("sin_asignados")
            return []
        out = []
        for n in nombres:
            item = item_de_archivo(n, self.host)
            if item is None:
                continue
            if item == "":
                if n not in self.avisados:
                    self.log(f"AVISO: {n} es para esta PC pero el item no sirve como nombre (letras, numeros, _ . -): no lo tomo")
                    self.avisados.add(n)
                continue
            if item in self.hechos or os.path.exists(os.path.join(self.mia, f"resultado-{item}.txt")):
                continue
            ruta = os.path.join(self.asignados, n)
            try:
                edad = time.time() - os.path.getmtime(ruta)
            except OSError:
                continue
            if edad < self.a.edad_min_seg:            # recien llegado: puede estar a medio sincronizar
                continue
            out.append((n, ruta, item))
        return out

    def leer_asignado(self, ruta, item):
        """(asignado, None) si sirve; (None, error) si hay que dejar resultado con error; (None, None) si se pospone."""
        d, err, tipo = leer_json(ruta, self.a.reintentos_lectura, self.a.espera_lectura)
        if tipo == "no_se_lee":
            self.log(f"{item}: {err} (la nube todavia no lo bajo; lo reintento)")
            return None, None
        if err:
            return None, err
        if not isinstance(d, dict):
            return None, "el asignado no es un objeto JSON {...}"
        if d.get("hostname") and str(d["hostname"]).upper() != self.host:
            self.ignorados.add(item)                    # dice que es para otra PC: no se toma en esta sesion
            self.log(f"{item}: el asignado dice hostname {d['hostname']!r}, no es esta PC: no lo tomo")
            return None, None
        if d.get("item") is not None and str(d["item"]) != item:
            return None, f"el item del contenido ({d['item']!r}) no coincide con el del nombre del archivo ({item!r})"
        ej = d.get("ejercicio")
        if not isinstance(ej, str) or not EJERCICIO_VALIDO.match(ej):
            return None, f"falta 'ejercicio' o no es un nombre valido: {ej!r}"
        if not os.path.isfile(os.path.join(self.ejercicios, ej, "catia.py")):
            return None, f"no existe el ejercicio {ej!r} en {self.ejercicios} (falta catia.py)"
        return d, None

    def usa_catia(self, ej):
        d, err, _ = leer_json(os.path.join(self.ejercicios, ej, "ejercicio.json"), 1, 0)
        return True if err or not isinstance(d, dict) else bool(d.get("usa_catia", True))

    # ---------- una corrida ----------
    def correr_una_vez(self, ej, asignado, trabajo):
        os.makedirs(trabajo, exist_ok=True)
        escribir_json(os.path.join(trabajo, "asignado.json"), asignado, reintentos=2, espera=0.5)
        env = dict(os.environ)
        env.update({"CATIA_TRABAJO": trabajo, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8", "PYTHONDONTWRITEBYTECODE": "1",
                    "PYTHONPATH": AQUI + os.pathsep + env.get("PYTHONPATH", ""), "OBRERO_HOST": self.host,
                    "OBRERO_VERSION": VERSION})
        cmd = [sys.executable, "-u", "-B", os.path.join(self.ejercicios, ej, "catia.py"), trabajo]
        t0 = time.time()
        with open(os.path.join(trabajo, "stdout.txt"), "w", encoding="utf-8") as so, \
                open(os.path.join(trabajo, "stderr.txt"), "w", encoding="utf-8") as se:
            p = subprocess.Popen(cmd, cwd=trabajo, env=env, stdout=so, stderr=se, stdin=subprocess.DEVNULL)
            corto, vista = False, None
            while True:
                try:
                    codigo = p.wait(timeout=2)
                    break
                except subprocess.TimeoutExpired:
                    if vista is None:
                        vista = self.leer_mi_catia(trabajo)
                    if time.time() - t0 > self.a.timeout_seg:
                        p.kill()
                        codigo = p.wait()
                        corto = True
                        break
        if vista is None:
            vista = self.leer_mi_catia(trabajo)
        return codigo, corto, round(time.time() - t0, 1), vista

    def procesar(self, nombre, ruta, item):
        """Devuelve 'hecho' (dejo resultado) o 'pospuesto' (queda pendiente para otra vuelta)."""
        asignado, err = self.leer_asignado(ruta, item)
        if asignado is None and err is None:
            return "pospuesto"
        t0 = time.time()
        res = {"item": item, "archivo_asignado": nombre, "hostname": self.host, "version_obrero": VERSION,
               "inicio": ahora()}
        if err:
            self.log(f"{item}: asignado con error: {err}")
            res.update({"ok": False, "estado": "error", "error": f"asignado roto: {err}", "fin": ahora(), "segundos": 0.0})
            return self.dejar_resultado(item, res, None)
        ej = asignado["ejercicio"]
        res.update({"ejercicio": ej, "asignado": asignado})
        catia = self.usa_catia(ej)
        if catia:
            pids = self.catia_abierta()
            if pids is None or pids:
                que = ("no pude mirar si hay CATIA abierta" if pids is None
                       else f"hay una CATIA abierta (pids {pids}) que no arranco el obrero")
                self.estado = f"espero: {que}"
                if ("catia_ajena", item) not in self.avisados:
                    self.log(f"{item}: {que}; no corro hasta que se cierre (no la toco)")
                    self.avisados.add(("catia_ajena", item))
                return "pospuesto"
        self.en_curso, self.estado = item, f"corriendo {ej}"
        self.log(f"{item}: arranco el ejercicio {ej} (usa CATIA: {'si' if catia else 'no'})")
        self.latir("arranca un item")
        sello = time.strftime("%Y%m%d-%H%M%S")
        intentos, codigo, corto, trabajo = 0, None, False, None
        max_intentos = max(1, self.a.intentos_catia)      # solo el codigo 3 (CATIA no arranco) reintenta
        while intentos < max_intentos:
            intentos += 1
            trabajo = os.path.join(self.local, "trabajo", f"{item}__{sello}__{intentos}")
            vista = None
            try:
                codigo, corto, seg, vista = self.correr_una_vez(ej, asignado, trabajo)
            except Exception as e:  # noqa: BLE001
                codigo, corto, seg = None, False, 0.0
                self.log(f"{item}: no se pudo lanzar el ejercicio: {e!r}")
                try:
                    os.makedirs(trabajo, exist_ok=True)
                    with open(os.path.join(trabajo, "stderr.txt"), "a", encoding="utf-8") as f:
                        f.write(traceback.format_exc())
                except OSError:
                    pass
            self.log(f"{item}: intento {intentos} termino con codigo {codigo}"
                     f"{' (cortado por tiempo)' if corto else ''} en {seg} s")
            if vista:
                res["catia_de_la_corrida"] = vista
            if catia:
                try:
                    res["catia_al_terminar"] = self.limpiar_catia(trabajo, vista)
                    self.log(f"{item}: {res['catia_al_terminar']}")
                except Exception as e:  # noqa: BLE001
                    self.log(f"{item}: AVISO al mirar CATIA despues de la corrida: {e!r}")
            if codigo == SALIDA_CATIA_AJENA and not corto:
                self.en_curso, self.estado = None, "espero: el ejercicio encontro una CATIA que no es del obrero"
                return "pospuesto"
            if codigo != SALIDA_SIN_CATIA or corto:
                break
            if intentos < max_intentos:
                self.log(f"{item}: CATIA no arranco; espero {self.a.espera_reintento_catia} s y reintento")
                time.sleep(self.a.espera_reintento_catia)
        salida, err_salida, _ = leer_json(os.path.join(trabajo, "salida.json"), 1, 0)
        if err_salida:
            salida = None
        ok = codigo == SALIDA_OK and not corto and isinstance(salida, dict) and salida.get("ok", True) is not False
        if ok:
            error = None
        elif corto:
            error = f"se paso del tiempo ({self.a.timeout_seg:g} s): lo corte"
        elif codigo == SALIDA_SIN_CATIA:
            error = f"CATIA no arranco en {intentos} intentos seguidos" + (
                f": {salida['error']}" if isinstance(salida, dict) and salida.get("error") else "")
        elif codigo == SALIDA_OK and salida is None:
            error = "el ejercicio termino pero no dejo salida.json"
        elif isinstance(salida, dict) and salida.get("error"):
            error = str(salida["error"])
        else:
            error = f"el ejercicio salio con codigo {codigo}"
        res.update({"ok": ok, "estado": "ok" if ok else "error", "error": error, "codigo_salida": codigo,
                    "intentos": intentos, "usa_catia": catia, "salida": salida, "fin": ahora(),
                    "segundos": round(time.time() - t0, 1), "carpeta_trabajo_local": trabajo})
        if not ok:
            res["stderr_ultimas_40"] = ultimas_lineas(os.path.join(trabajo, "stderr.txt"), 40)
        return self.dejar_resultado(item, res, trabajo)

    def copiar_archivos(self, item, trabajo, salida):
        """Copia a COLA 3D\\<PC>\\<item>\\ lo que el ejercicio declaro (solo de adentro de su carpeta de trabajo) y salida.json."""
        destino = os.path.join(self.mia, item)
        os.makedirs(destino, exist_ok=True)
        rutas = list((salida or {}).get("archivos") or []) if isinstance(salida, dict) else []
        if os.path.exists(os.path.join(trabajo, "salida.json")):
            rutas.append("salida.json")
        base_trabajo = os.path.join(os.path.normcase(os.path.abspath(trabajo)), "")
        copiados, saltados = [], []
        for r in rutas:
            r = str(r)
            origen = os.path.abspath(r if os.path.isabs(r) else os.path.join(trabajo, r))
            if not os.path.normcase(origen).startswith(base_trabajo):
                saltados.append({"archivo": r, "motivo": "fuera de la carpeta de trabajo"})
                continue
            if os.path.splitext(origen)[1].lower() not in EXTENSIONES_A_COPIAR:
                saltados.append({"archivo": r, "motivo": "tipo de archivo que no se copia"})
                continue
            try:
                tam = os.path.getsize(origen)
                if tam > TOPE_ARCHIVO:
                    saltados.append({"archivo": r, "motivo": f"pesa {tam} bytes (tope {TOPE_ARCHIVO})"})
                    continue
                shutil.copy2(origen, os.path.join(destino, os.path.basename(origen)))
                copiados.append({"archivo": os.path.basename(origen), "bytes": tam})
            except OSError as e:
                saltados.append({"archivo": r, "motivo": repr(e)[:200]})
        return copiados, saltados

    def dejar_resultado(self, item, res, trabajo):
        try:
            os.makedirs(self.mia, exist_ok=True)
        except OSError:
            pass
        if trabajo:
            try:
                res["archivos_copiados"], saltados = self.copiar_archivos(item, trabajo, res.get("salida"))
                if saltados:
                    res["archivos_no_copiados"] = saltados
            except Exception as e:  # noqa: BLE001
                res["archivos_copiados"], res["error_copia"] = [], repr(e)[:300]
        escrito = escribir_json(os.path.join(self.mia, f"resultado-{item}.txt"), res)
        self.hechos.add(item)              # aunque la nube no haya dejado escribir: no se corre dos veces en esta sesion
        self.en_curso = None
        self.ultimo = {"item": item, "estado": res["estado"], "fin": res.get("fin")}
        self.estado = "esperando trabajo"
        self.log(f"{item}: {res['estado'].upper()}" + (f" ({res.get('error')})" if res.get("error") else "")
                 + ("" if escrito else "  AVISO: NO pude escribir el resultado en la nube"))
        self.latir("termino un item")
        return "hecho"

    # ---------- ciclo ----------
    def ciclo(self):
        try:
            os.makedirs(self.mia, exist_ok=True)
        except OSError:
            pass
        self.log(f"obrero {VERSION} arranca en {self.host}; cola {self.cola}; Python {sys.version.split()[0]}; "
                 f"RAM libre {ram_libre_gb()} GB")
        self.estado = "esperando trabajo"
        self.latir("arranque")
        hilo = threading.Thread(target=self._hilo_latido, daemon=True)
        hilo.start()
        probados, ultimo_aviso_ram, ultimo_aviso_nada = set(), 0.0, time.time()
        try:
            while True:
                try:
                    pend = [p for p in self.pendientes() if p[2] not in probados and p[2] not in self.ignorados
                            and self.pospuestos.get(p[2], 0.0) <= time.time()]
                    if not pend:
                        if self.a.una_vuelta:
                            break
                        if time.time() - ultimo_aviso_nada >= self.a.latido_seg:
                            self.log("nada asignado; sigo mirando")
                            ultimo_aviso_nada = time.time()
                        time.sleep(self.a.espera_seg)
                        continue
                    nombre, ruta, item = pend[0]
                    ram = ram_libre_gb()
                    if ram is None or ram < self.a.ram_min_gb:
                        self.estado = (f"espero RAM: {ram} GB libres (hacen falta {self.a.ram_min_gb:g})" if ram is not None
                                       else "espero: no pude medir la RAM libre")
                        if time.time() - ultimo_aviso_ram >= self.a.latido_seg or self.a.una_vuelta:
                            self.log(f"{item}: {self.estado}")
                            ultimo_aviso_ram = time.time()
                        if self.a.una_vuelta:
                            break
                        time.sleep(self.a.espera_seg)
                        continue
                    r = self.procesar(nombre, ruta, item)
                    if self.a.una_vuelta:
                        probados.add(item)
                    elif r == "pospuesto":           # no tapa la cola: los de atras siguen; este vuelve en un rato
                        self.pospuestos[item] = time.time() + max(self.a.espera_seg, 1.0)
                except KeyboardInterrupt:
                    raise
                except Exception:  # noqa: BLE001
                    self.log("ERROR en la vuelta (sigo):\n" + traceback.format_exc())
                    self.en_curso = None
                    if self.a.una_vuelta:
                        break
                    time.sleep(self.a.espera_seg)
        finally:
            self._parar.set()
            self.estado = "detenido"
            self.latir("se detiene")
            self.log("obrero detenido")


def argumentos(argv=None):
    p = argparse.ArgumentParser(description="Obrero de CATIA: corre los ejercicios que la PC principal deja en la nube.")
    p.add_argument("--cola", default=os.path.dirname(AQUI), help="carpeta COLA 3D (por defecto, la de arriba de obrero)")
    p.add_argument("--hostname", default=socket.gethostname(), help="nombre de esta PC (por defecto, el de Windows)")
    p.add_argument("--una-vuelta", action="store_true", help="procesa todo lo pendiente de esta PC, de a uno, y sale")
    p.add_argument("--local", default=os.path.join(os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"), "obrero_catia"),
                   help="carpeta local de trabajo (fuera de la nube)")
    p.add_argument("--ejercicios", default=os.path.join(AQUI, "ejercicios"))
    p.add_argument("--timeout-seg", type=float, default=1200.0)
    p.add_argument("--ram-min-gb", type=float, default=0.8,
                   help="GB libres para arrancar un ejercicio. 0,8: Fak 23/10/2026 «si hay 1 gb libre se hace con eso»; "
                        "CATA midio 0,9 a 2,0 GB libres y con 1 justo se frenaba (PEDIDO 18)")
    p.add_argument("--espera-seg", type=float, default=60.0)
    p.add_argument("--latido-seg", type=float, default=900.0)
    p.add_argument("--edad-min-seg", type=float, default=90.0,
                   help="no toma un asignado mas nuevo que esto (puede estar a medio sincronizar)")
    p.add_argument("--reintentos-lectura", type=int, default=3)
    p.add_argument("--espera-lectura", type=float, default=5.0)
    p.add_argument("--intentos-catia", type=int, default=3)
    p.add_argument("--espera-reintento-catia", type=float, default=30.0)
    return p.parse_args(argv)


def main(argv=None):
    a = argumentos(argv)
    ob = Obrero(a)
    candado = Candado(os.path.join(ob.local, "obrero.lock"))
    if not candado.tomar():
        print(f"Ya hay un obrero corriendo en esta PC (candado {candado.ruta}). Cierre la otra ventana negra primero.")
        return 2
    try:
        ob.ciclo()
    except KeyboardInterrupt:
        print("Obrero detenido con Ctrl+C.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
