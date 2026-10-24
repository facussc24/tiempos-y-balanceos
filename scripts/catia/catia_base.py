# -*- coding: utf-8 -*-
# Origen: copia de C:\Dev\_catia_practica\catia_base.py (base probada la noche del 19/10/2026), traida al repo el
# 23/10/2026 para el obrero de la notebook con CATIA. Cambios (nada mas): 1) pythoncom y win32com se importan adentro de
# conectar, Vigia.run y correr (asi el obrero y su prueba corren sin pywin32); 2) la carpeta de trabajo por defecto es
# %LOCALAPPDATA%\obrero_catia (el obrero siempre pasa CATIA_TRABAJO). captura() y medir_step() siguen necesitando
# .venv-cad (Pillow, build123d), que la notebook NO tiene: los ejercicios del obrero no las usan.
"""Base para practicar CATIA V5 R21 por COM (noche del 19/10/2026).

- Una sola CATIA PROPIA para toda la noche: la primera vez se arranca y su pid queda en mi_catia.json; despues cada
  ejercicio se engancha a ESA (si hay otra CATIA con otro pid, no se toca nada).
- Vigia de cuadros de aviso del propio proceso (acepta solo los de un boton OK/Aceptar, con un mensaje, nunca teclas).
- Registro de pasos (un paso que falla no frena los demas), medicion con SPAWorkbench, capturas del visor pasadas a PNG
  con el entorno CAD (.venv-cad tiene Pillow), guardar CATPart + STEP y medir el STEP con build123d para cruzar.

Corre con C:\\Dev\\_catia_env\\Scripts\\python.exe.
"""
import json
import os
import re
import subprocess
import sys
import threading
import time
import tempfile
import traceback

AQUI = os.path.dirname(os.path.abspath(__file__))
# carpeta de TRABAJO (fuera del repo): ahi van el pid de la CATIA propia y una carpeta por ejercicio o pieza
PRACTICA = os.environ.get("CATIA_TRABAJO", os.path.join(os.environ.get("LOCALAPPDATA") or tempfile.gettempdir(), "obrero_catia"))
os.makedirs(PRACTICA, exist_ok=True)
ESTADO = os.path.join(PRACTICA, "mi_catia.json")
CATIA_INSTALADA = os.environ.get("CATIA_INSTALADA", r"C:\Program Files (x86)\Dassault Systemes\B21")
VENV_CAD = r"C:\Dev\BarackMercosul\.venv-cad\Scripts\python.exe"


def cnext_abiertos(correr=subprocess.run):
    """PIDs de CNEXT.exe, o None si NO SE PUDO MIRAR (tasklist fallo): «no pude mirar» no es «no hay CATIA»
    (auditor del 17/10, I4, y del 19/10)."""
    try:
        r = correr(["tasklist", "/FI", "IMAGENAME eq CNEXT.exe", "/FO", "CSV", "/NH"],
                   capture_output=True, text=True, errors="replace", timeout=20)   # tasklist escribe en la pagina OEM (CATA 23/10)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if getattr(r, "returncode", 0) != 0:
        return None
    return [int(m.group(1)) for m in re.finditer(r'"CNEXT\.exe","(\d+)"', r.stdout or "", re.I)]


def hora_de_arranque(pid):
    """Hora de creacion del proceso (FILETIME en 100 ns), o None. Junto con el pid identifica el proceso: Windows recicla
    los pids, la hora de creacion no se repite."""
    try:
        import win32api
        import win32con
        import win32process
        h = win32api.OpenProcess(win32con.PROCESS_QUERY_LIMITED_INFORMATION if hasattr(win32con, "PROCESS_QUERY_LIMITED_INFORMATION")
                                 else 0x1000, False, int(pid))
        try:
            return int(win32process.GetProcessTimes(h)["CreationTime"].timestamp() * 1e6)
        finally:
            win32api.CloseHandle(h)
    except Exception:  # noqa: BLE001
        return None


def _guardado():
    try:
        return json.load(open(ESTADO, encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _pid_guardado():
    return _guardado().get("pid")


def es_mia(pids, guardado, hora=hora_de_arranque):
    """True solo si hay UNA CATIA y es la que arranque yo: mismo pid Y misma hora de arranque que la guardada (19/10,
    auditor: un mi_catia.json viejo y una CATIA de Fak con el pid reciclado se tomaban por mia y se cerraban)."""
    if pids is None or len(pids) != 1:
        return False
    pid = pids[0]
    if not guardado.get("pid") or pid != guardado["pid"] or guardado.get("hora") is None:
        return False
    return hora(pid) == guardado["hora"]


CLSCTX_ACTIVATE_32_BIT_SERVER = 0x40000     # pide el servidor COM de 32 bits aunque el proceso que llama sea de 64


def arrancar_catia(dispatch=None, co_create=None, envolver=None):
    """Abre CATIA por COM. Primero por la anotacion normal (Dispatch); si falla, pide el servidor de 32 bits con
    CoCreateInstance(CLSCTX_LOCAL_SERVER | CLSCTX_ACTIVATE_32_BIT_SERVER). CATA, 23/10/2026 (PEDIDO 19): el tecnico puso la
    R21 de 32 bits y la anotacion de 64 bits del registro quedo apuntando a la 2022 borrada, asi que Dispatch desde un Python
    de 64 bits fallaba; con el servidor de 32 bits CATIA abrio en 9 s. Los tres callables se inyectan para probarlo en seco."""
    if dispatch is None or envolver is None:
        import win32com.client
        dispatch = dispatch or win32com.client.Dispatch
        envolver = envolver or win32com.client.Dispatch
    try:
        return dispatch("CATIA.Application")
    except Exception as primero:  # noqa: BLE001  (pywintypes.com_error, que no se importa si no hace falta)
        error_dispatch = primero
    try:
        if co_create is None:
            import pythoncom
            import pywintypes
            obj = pythoncom.CoCreateInstance(pywintypes.IID("CATIA.Application"), None,
                                             pythoncom.CLSCTX_LOCAL_SERVER | CLSCTX_ACTIVATE_32_BIT_SERVER,
                                             pythoncom.IID_IDispatch)
        else:
            obj = co_create("CATIA.Application", CLSCTX_ACTIVATE_32_BIT_SERVER)
        return envolver(obj)
    except Exception as segundo:  # noqa: BLE001
        raise RuntimeError(f"CATIA no arranco por COM: la anotacion normal dio {error_dispatch!r} y el servidor de 32 bits "
                           f"dio {segundo!r}") from segundo


def exigir_archivo(ruta, que):
    r"""Un paso que dice «ok» sin dejar el archivo es un control ciego (CATA, 23/10/2026: CaptureToFile no da error y no deja
    nada en %LOCALAPPDATA%\obrero_catia; SaveAs y ExportData fallan ahi). Falla si no existe o pesa 0."""
    if not os.path.isfile(ruta) or os.path.getsize(ruta) == 0:
        raise RuntimeError(f"{que}: CATIA no dejo el archivo {ruta} (no existe o pesa 0). En algunas carpetas CATIA R21 no "
                           "escribe (CATA 23/10: %LOCALAPPDATA%\\obrero_catia); el obrero trabaja en %TEMP%\\obrero_catia")
    return ruta


def conectar(visible=False):
    """Devuelve (catia, pid). Arranca la propia si no hay ninguna; se engancha solo a la propia (pid + hora de arranque).
    Si no se puede saber que procesos hay, no hace nada."""
    import win32com.client
    pids = cnext_abiertos()
    if pids is None:
        raise SystemExit("No pude saber si hay una CATIA abierta (tasklist fallo): no arranco ni me engancho a nada.")
    if not pids:
        t0 = time.time()
        c = arrancar_catia()
        pids = cnext_abiertos() or []
        pid = pids[0] if len(pids) == 1 else None
        json.dump({"pid": pid, "hora": hora_de_arranque(pid) if pid else None,
                   "arranco": time.strftime("%Y-%m-%d %H:%M:%S"), "seg": round(time.time() - t0, 1)},
                  open(ESTADO, "w", encoding="utf-8"))
    else:
        g = _guardado()
        if not es_mia(pids, g):
            raise SystemExit(f"Hay una CATIA que no es la mia (pids {pids}, la mia {g.get('pid')} con otra hora de "
                             f"arranque o sin registrar): no toco nada.")
        c = win32com.client.GetActiveObject("CATIA.Application")
        pid = g["pid"]
    c.DisplayFileAlerts = False
    if visible:
        c.Visible = True
    return c, pid


def apagar(c):
    for i in range(c.Documents.Count, 0, -1):
        try:
            c.Documents.Item(i).Close()
        except Exception:  # noqa: BLE001
            pass
    c.Quit()
    for _ in range(30):
        if not cnext_abiertos():
            break
        time.sleep(1)
    try:
        os.remove(ESTADO)
    except OSError:
        pass


class Vigia(threading.Thread):
    """Acepta los cuadros de un solo boton OK del proceso `pid`; anota los demas sin tocarlos."""

    def __init__(self, pid):
        super().__init__(daemon=True)
        self.pid, self.vistos, self._parar = pid, [], threading.Event()

    def run(self):
        import win32con
        import win32gui
        import win32process
        import pythoncom
        pythoncom.CoInitialize()

        def cb(hwnd, _):
            _, p = win32process.GetWindowThreadProcessId(hwnd)
            if p != self.pid or win32gui.GetClassName(hwnd) != "#32770" or not win32gui.IsWindowVisible(hwnd):
                return True
            botones, textos = [], []

            def hijo(h, _):
                cls, t = win32gui.GetClassName(h), win32gui.GetWindowText(h)
                (botones if cls == "Button" else textos).append((h, t) if cls == "Button" else t.strip()[:200])
                return True

            win32gui.EnumChildWindows(hwnd, hijo, None)
            titulo = win32gui.GetWindowText(hwnd)
            textos = [t for t in textos if t]
            if len(botones) == 1 and botones[0][1].replace("&", "").strip().upper() in ("OK", "ACEPTAR", "CERRAR", "CLOSE"):
                win32gui.PostMessage(hwnd, win32con.WM_COMMAND, win32gui.GetDlgCtrlID(botones[0][0]), botones[0][0])
                self.vistos.append({"titulo": titulo, "texto": textos[:4], "accion": "aceptado"})
            else:
                clave = {"titulo": titulo, "texto": textos[:4], "botones": [b[1] for b in botones], "accion": "NO tocado"}
                if clave not in self.vistos:
                    self.vistos.append(clave)
            return True

        while not self._parar.wait(1.0):
            try:
                win32gui.EnumWindows(cb, None)
            except Exception:  # noqa: BLE001
                pass

    def parar(self):
        self._parar.set()


class Registro:
    def __init__(self, nombre):
        self.nombre, self.pasos, self.datos = nombre, [], {}
        self.carpeta = os.path.join(PRACTICA, nombre)
        os.makedirs(self.carpeta, exist_ok=True)

    def mostrar(self):
        """CATIA_MIRAR=lento (19/10, Fak quiere ver como crece la pieza): despues de cada paso encuadra la vista
        isometrica y espera CATIA_PAUSA segundos (2 por defecto). Con CATIA_MIRAR=1 o sin variable no hace nada."""
        c = getattr(self, "catia", None)
        if c is None or os.environ.get("CATIA_MIRAR") != "lento":
            return
        try:
            pausa = float(os.environ.get("CATIA_PAUSA", "2").replace(",", "."))
        except ValueError:
            pausa = 2.0
        try:
            v = c.ActiveWindow.ActiveViewer
            v.Viewpoint3D.PutSightDirection((-0.577, -0.577, -0.577))
            v.Viewpoint3D.PutUpDirection((0.0, 0.0, 1.0))
            v.Reframe()
            v.Update()
        except Exception:  # noqa: BLE001
            pass
        time.sleep(pausa)

    def paso(self, que, fn):
        t = time.time()
        try:
            r = fn()
            self.pasos.append({"paso": que, "ok": True, "seg": round(time.time() - t, 2),
                               **({"dato": r} if isinstance(r, (str, int, float, dict, list, tuple)) else {})})
            print(f"  ok    {que}" + (f"  -> {r}" if isinstance(r, (str, int, float, dict, list, tuple)) else ""))
            self.mostrar()
            return r
        except Exception as e:  # noqa: BLE001
            self.pasos.append({"paso": que, "ok": False, "seg": round(time.time() - t, 2), "error": repr(e)[:500],
                               "traza": traceback.format_exc()[-600:]})
            print(f"  FALLA {que}: {repr(e)[:300]}")
            return None

    def guardar(self, extra=None):
        d = {"ejercicio": self.nombre, "fecha": time.strftime("%Y-%m-%d %H:%M:%S"), "pasos": self.pasos, **self.datos,
             **(extra or {})}
        json.dump(d, open(os.path.join(self.carpeta, "registro.json"), "w", encoding="utf-8"), ensure_ascii=False,
                  indent=2, default=str)
        fallas = [p["paso"] for p in self.pasos if not p["ok"]]
        print(f"RESUMEN {self.nombre}: {len(self.pasos) - len(fallas)} ok, {len(fallas)} fallas {fallas if fallas else ''}")
        return fallas


def nueva_pieza(c, nombre=None):
    doc = c.Documents.Add("Part")
    part = doc.Part
    if nombre:
        try:                                   # Part.Name es de solo lectura ("The method Name failed", 19/10)
            doc.Product.PartNumber = nombre
        except Exception:  # noqa: BLE001
            pass
    return doc, part, part.MainBody, part.ShapeFactory


def ref(part, obj):
    return part.CreateReferenceFromObject(obj)


def poligono(f, pts):
    """Perfil cerrado por puntos (lista de (x, y)) con las lineas atadas a sus puntos (si no, no cierra)."""
    ps = [f.CreatePoint(x, y) for x, y in pts]
    lineas = []
    for i in range(len(pts)):
        (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % len(pts)]
        ln = f.CreateLine(x1, y1, x2, y2)
        ln.StartPoint, ln.EndPoint = ps[i], ps[(i + 1) % len(pts)]
        lineas.append(ln)
    return ps, lineas


def sketch(part, body, plano, dibujar):
    sk = body.Sketches.Add(ref(part, plano))
    f = sk.OpenEdition()
    dibujar(f, sk)
    sk.CloseEdition()
    part.Update()
    return sk


def medir(doc, part, obj):
    try:                                   # 19/10: medir un cuerpo SIN operaciones rompe todas las mediciones de la sesion
        vacio = obj.Shapes.Count == 0      # (ej13 y ej38): se niega antes de tocar el SPA
    except Exception:  # noqa: BLE001
        vacio = False                      # no es un cuerpo (cara, arista, set): se mide normal
    if vacio:
        raise ValueError("medir(): el cuerpo esta VACIO (sin operaciones); medirlo rompe la sesion de CATIA")
    spa = doc.GetWorkbench("SPAWorkbench")
    m = spa.GetMeasurable(ref(part, obj))
    out = {}
    for k, fac in (("Volume", 1e9), ("Area", 1e6)):
        try:
            out[k.lower()] = round(getattr(m, k) * fac, 3)
        except Exception:  # noqa: BLE001
            pass
    try:
        cog = evaluar(doc.Application, MACRO_COG, m)
        out["cdg_mm"] = [round(float(x.replace(",", ".")), 3) for x in cog.split(";")]
    except Exception as e:  # noqa: BLE001
        out["cdg_error"] = repr(e)[:200]
    return out


def topologia(doc, feature, tipo="Edge"):
    """Aristas (Edge) o caras (Face) de una operacion, cada una con su referencia, centro (mm) y largo o area.
    Se eligen por POSICION, no por el nombre interno: [{'ref', 'nombre', 'cdg', 'medida'}]."""
    sel = doc.Selection
    sel.Clear()
    sel.Add(feature)
    sel.Search(f"Topology.{tipo},sel")
    spa = doc.GetWorkbench("SPAWorkbench")
    out = []
    for i in range(1, sel.Count + 1):
        r = sel.Item(i).Reference
        d = {"ref": r, "nombre": r.DisplayName}
        try:
            m = spa.GetMeasurable(r)
            # OJO unidades (19/10): Length devuelve mm, Area m2 y Volume m3
            d["medida"] = round(m.Length if tipo == "Edge" else (m.Area * 1e6), 3)
            if tipo == "Edge":        # GetCOG no anda en una arista: el punto del medio de la curva
                txt = evaluar(doc.Application, MACRO_MEDIO, m)
            else:
                txt = evaluar(doc.Application, MACRO_COG, m)
            d["cdg"] = [round(float(x.replace(",", ".")), 3) for x in txt.split(";")]
        except Exception as e:  # noqa: BLE001
            d["error"] = repr(e)[:120]
        out.append(d)
    sel.Clear()
    return out


def elegir(lista, cond):
    return [d for d in lista if "cdg" in d and cond(*d["cdg"])]


MACRO_EXTREMOS = """Function CATMain(m)
    Dim p(8)
    m.GetPointsOnCurve p
    CATMain = p(0) & ";" & p(1) & ";" & p(2) & ";" & p(6) & ";" & p(7) & ";" & p(8)
End Function"""


def aristas_con_extremos(doc, feature):
    """Como topologia(..., 'Edge') pero con los dos extremos: [{'ref', 'p0', 'p1', 'medida'}]."""
    sel = doc.Selection
    sel.Clear()
    sel.Add(feature)
    sel.Search("Topology.Edge,sel")
    spa = doc.GetWorkbench("SPAWorkbench")
    out = []
    for i in range(1, sel.Count + 1):
        r = sel.Item(i).Reference
        try:
            m = spa.GetMeasurable(r)
            v = [float(x.replace(",", ".")) for x in evaluar(doc.Application, MACRO_EXTREMOS, m).split(";")]
            out.append({"ref": r, "p0": v[:3], "p1": v[3:], "medida": m.Length})
        except Exception:  # noqa: BLE001
            pass
    sel.Clear()
    return out


MACRO_MEDIO = """Function CATMain(m)
    Dim p(8)
    m.GetPointsOnCurve p
    CATMain = p(3) & ";" & p(4) & ";" & p(5)
End Function"""


MACRO_COG = """Function CATMain(m)
    Dim c(2)
    m.GetCOG c
    CATMain = c(0) & ";" & c(1) & ";" & c(2)
End Function"""


def evaluar(c, codigo, *objetos):
    """Corre un pedazo de VBScript adentro de CATIA (para lo que devuelve listas de salida que no llegan a Python)."""
    return c.SystemService.Evaluate(codigo, 0, "CATMain", list(objetos))


def captura(c, reg, nombre, vistas=("iso",), ocultar_planos=True):
    """Capturas del visor en BMP y pasadas a PNG (para poder mirarlas). Devuelve las rutas PNG."""
    try:
        c.ActiveWindow.Layout = 1          # catWindowGeomOnly: sin el arbol de especificaciones en la captura
    except Exception:  # noqa: BLE001
        pass
    visor = c.ActiveWindow.ActiveViewer
    visor.PutBackgroundColor((1.0, 1.0, 1.0))
    arriba = {"arriba": (0.0, 1.0, 0.0), "abajo": (0.0, 1.0, 0.0)}
    dirs = {"iso": (-0.577, -0.577, -0.577), "iso2": (0.577, -0.577, -0.577), "arriba": (0.0, 0.0, -1.0),
            "frente": (0.0, 1.0, 0.0), "costado": (-1.0, 0.0, 0.0), "abajo": (0.0, 0.0, 1.0)}
    pngs = []
    for v in vistas:
        visor.Viewpoint3D.PutSightDirection(dirs[v])
        visor.Viewpoint3D.PutUpDirection(arriba.get(v, (0.0, 0.0, 1.0)))
        visor.Reframe()
        visor.Update()
        bmp = os.path.join(reg.carpeta, f"{nombre}_{v}.bmp")
        visor.CaptureToFile(4, bmp)
        exigir_archivo(bmp, f"captura {v}")        # CATA 23/10: CaptureToFile decia ok y no habia archivo
        pngs.append(bmp)
    png = os.path.join(reg.carpeta, f"{nombre}.png")
    subprocess.run([VENV_CAD, os.path.join(AQUI, "bmp_a_png.py"), png] + pngs, check=True, capture_output=True)
    for b in pngs:
        os.remove(b)
    try:                                   # 19/10: dejar la ventana con arbol + pieza (2); 0 es SOLO el arbol (blanco)
        c.ActiveWindow.Layout = 2
    except Exception:  # noqa: BLE001
        pass
    return png


def guardar_pieza(doc, reg, nombre, step=True):
    rutas = {"catpart": os.path.join(reg.carpeta, nombre + ".CATPart")}
    for r in rutas.values():
        if os.path.exists(r):
            os.remove(r)
    doc.SaveAs(rutas["catpart"])
    exigir_archivo(rutas["catpart"], f"guardar {nombre}.CATPart")      # CATA 23/10: en %LOCALAPPDATA% SaveAs falla o no deja nada
    if step:
        rutas["step"] = os.path.join(reg.carpeta, nombre + ".stp")
        if os.path.exists(rutas["step"]):
            os.remove(rutas["step"])
        doc.ExportData(rutas["step"], "stp")
        exigir_archivo(rutas["step"], f"exportar {nombre}.stp")
    return rutas


def medir_step(step):
    """Volumen y centro de gravedad del STEP con build123d (otro motor: cruza lo que dice CATIA). 23/10/2026: apuntaba a un
    medir_step.py que nunca existio (camino muerto); ahora usa medir_b123d.py step (el del juez, probado) y devuelve el dict de
    esa parte ({volumen, cdg_mm, solidos}) o {"error": ...}; nunca un verde sin numero."""
    r = subprocess.run([VENV_CAD, "-I", os.path.join(AQUI, "medir_b123d.py"), "step", step], capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=300)
    try:
        partes = json.loads(r.stdout.strip().splitlines()[-1]).get("partes") or {}
        return next(iter(partes.values())) if partes else {"error": "medir_b123d no devolvio ninguna parte"}
    except (ValueError, IndexError, AttributeError):
        return {"error": (r.stderr or r.stdout)[-400:]}


def reiniciar_mia():
    """Cierra MI CATIA (Quit y, si no se va en 30 s, termina SOLO su pid). 19/10: despues de un «el servidor lanzo una
    excepcion» la instancia queda danada y hasta un pad simple da «Update failed» en las corridas siguientes."""
    pids = cnext_abiertos()
    if pids is None:
        raise SystemExit("No pude saber si hay una CATIA abierta (tasklist fallo): no reinicio nada.")
    g = _guardado()
    if not pids or not es_mia(pids, g):
        return                       # no hay ninguna, o la que hay NO es la mia: no se toca (conectar despues se niega)
    mio = g["pid"]
    c, _ = conectar()
    ajenos = []                      # auditor ronda 2 (19/10): fresca=True cerraba lo que Fak abrio en la CATIA propia
    for i in range(1, c.Documents.Count + 1):
        try:
            d = c.Documents.Item(i)
            if not es_del_ejercicio(d):
                ajenos.append(d.FullName)
        except Exception:  # noqa: BLE001
            ajenos.append(f"documento {i} (no se pudo leer)")
    if ajenos:
        raise SystemExit(f"No reinicio mi CATIA: tiene abierto algo que no es del ejercicio {ajenos}. Que lo cierre Fak.")
    try:
        apagar(c)
    except Exception:  # noqa: BLE001
        pass
    if mio in (cnext_abiertos() or []) and es_mia([mio], g):
        subprocess.run(["taskkill", "/PID", str(mio), "/F"], capture_output=True)
    # que desaparezca DEL TODO antes de arrancar otra: engancharse a una que se esta cerrando dejo el motor de macros
    # y las mediciones rotos en toda la corrida (19/10)
    for _ in range(40):
        if mio not in (cnext_abiertos() or []):
            break
        time.sleep(1)
    time.sleep(3)
    if cnext_abiertos():
        raise SystemExit(f"despues de reiniciar sigue habiendo CATIA: {cnext_abiertos()}")


def es_del_ejercicio(doc):
    """Un documento es del ejercicio si nunca se guardo (sin ruta) o vive en la carpeta de trabajo (PRACTICA). Lo que
    Fak abra desde otro lado en la CATIA propia (visible en modo mirar) no lo es. Limite: si Fak abre un archivo DE la
    carpeta de trabajo en esta CATIA, se toma como del ejercicio."""
    try:
        ruta = doc.FullName or ""
    except Exception:  # noqa: BLE001
        return False
    if not os.path.isabs(ruta):
        return True
    r = os.path.normcase(os.path.abspath(ruta))
    for base in (PRACTICA, CATIA_INSTALADA):     # la instalacion: el catalogo de materiales que abre un ejercicio
        b = os.path.join(os.path.normcase(os.path.abspath(base)), "")   # con separador: _catia_practica_vieja no entra
        if r.startswith(b):
            return True
    return False


def cerrar_del_ejercicio(c, avisos):
    try:
        n = c.Documents.Count
    except Exception:  # noqa: BLE001
        avisos.append("no se pudo contar los documentos")
        return
    for i in range(n, 0, -1):
        try:                                     # todo adentro: esto corre en el finally de correr (auditor ronda 2)
            d = c.Documents.Item(i)
            if es_del_ejercicio(d):
                d.Close()
            else:
                avisos.append(f"no cierro {d.FullName}: no es del ejercicio")
        except Exception as e:  # noqa: BLE001
            avisos.append(f"documento {i}: {repr(e)[:80]}")


def correr(nombre, cuerpo, visible=False, fresca=False):
    """Esqueleto de un ejercicio: conectar, vigia, cuerpo(c, reg), guardar el registro. fresca=True arranca con una
    CATIA recien abierta (para construcciones largas)."""
    import pythoncom
    pythoncom.CoInitialize()
    mirar = os.environ.get("CATIA_MIRAR") in ("1", "lento")  # 19/10: Fak quiere ver los disenos; la ultima pieza queda abierta
    if fresca:
        reiniciar_mia()
    c, pid = conectar(visible or mirar)
    if mirar and pid:                                 # Fak 19/10: CATIA siempre en su segunda pantalla
        try:
            import pantalla
            print("  ", pantalla.mover(pid))
        except Exception as e:  # noqa: BLE001
            print("   no pude mover CATIA a la segunda pantalla:", repr(e)[:80])
    if mirar:                                         # lo que dejo abierto el ejercicio ANTERIOR, nada mas (auditor 19/10:
        cerrar_del_ejercicio(c, reg_avisos := [])     # un documento que Fak abra en esta CATIA visible no se toca)
        for a in reg_avisos:
            print("  AVISO", a)
    vig = Vigia(pid) if pid else None
    if vig:
        vig.start()
    reg = Registro(nombre)
    reg.catia = c
    try:
        cuerpo(c, reg)
    finally:
        try:                                          # si CATIA se murio a mitad de corrida, Documents revienta: igual
            n_docs = c.Documents.Count                # se guarda el registro (auditor ronda 2, 19/10)
        except Exception:  # noqa: BLE001
            n_docs = 0
            reg.datos["catia_no_responde_al_cerrar"] = True
        if not mirar and n_docs:                      # sin mirar: se cierra lo del ejercicio (lo de Fak, nunca)
            cerrar_del_ejercicio(c, reg.datos.setdefault("avisos", []))
        if vig:
            vig.parar()
            reg.datos["cuadros"] = vig.vistos
        fallas = reg.guardar()
    return fallas
